import { createClient } from '@/lib/supabase/server'
import { workshopToDataFilters, workshopCode } from '@/lib/utils'
import {
  calcA, calcP, calcQ, calcOEE, weightedAvg, durationHours, classifyShift,
} from './oee-calculator'
import type {
  WorkshopCode, GroupBy, ProdRow, OEELine, OEEWorkshop,
  OrderStatus, ProgressSummary, HeatmapCell,
} from './report-types'
import { WORKSHOP_CODES, SHIFT_LABELS } from './report-types'

// Lấy Production rows cho 1 xưởng (hoặc tất cả) + join norm/workshop
async function fetchProdRows(
  workshopId: WorkshopCode | null,
  from: string,
  to: string,
): Promise<ProdRow[]> {
  const supabase = await createClient()

  // Bước 1: Lấy pcode thuộc xưởng đích
  let workshopPcodes: string[] | null = null
  if (workshopId) {
    const filters = workshopToDataFilters(workshopId)
    const orStr = filters.map((f) => `WORKSHOP.ilike.${f}`).join(',')
    const { data } = await supabase.from('data').select('PCODE').or(orStr)
    workshopPcodes = ((data ?? []) as { PCODE: string }[]).map((r) => r.PCODE)
    if (workshopPcodes.length === 0) return []
  }

  // Bước 2: Lấy production records theo ngày
  type ProdSelect = {
    pcode: string | null; pdate: string | null; products: string | null
    poutput: number | null; eoutput: number | null; routput: number | null
    workforce: number | null; starttime: string | null; endtime: string | null
    realnorm: number | null
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('Production')
    .select('pcode,pdate,products,poutput,eoutput,routput,workforce,starttime,endtime,realnorm')
    .gte('pdate', from)
    .lte('pdate', to)

  if (workshopPcodes) query = query.in('pcode', workshopPcodes)

  const { data: prodData } = await query as { data: ProdSelect[] | null }
  if (!prodData || prodData.length === 0) return []

  // Bước 3: Map pcode → workshop
  const uniquePcodes = [...new Set(prodData.map((r) => r.pcode).filter(Boolean))] as string[]
  const { data: orderData } = await supabase
    .from('data')
    .select('PCODE,WORKSHOP')
    .in('PCODE', uniquePcodes) as { data: { PCODE: string; WORKSHOP: string | null }[] | null }

  const pcodeToWs = new Map<string, string>(
    (orderData ?? []).map((r) => [r.PCODE, r.WORKSHOP ?? ''])
  )

  // Bước 4: Lấy norm + pspeed
  const { data: normData } = await supabase
    .from('Norm')
    .select('products,norm,pspeed,workshop') as {
      data: { products: string; norm: number | null; pspeed: number | null; workshop: string | null }[] | null
    }

  const normMap = new Map<string, { norm: number; pspeed: number }>()
  for (const n of normData ?? []) {
    const key = `${n.products}|||${workshopCode(n.workshop ?? '')}`
    normMap.set(key, { norm: n.norm ?? 0, pspeed: n.pspeed ?? 0 })
  }

  // Bước 5: Kết hợp thành ProdRow
  return prodData.map((r) => {
    const rawWs = pcodeToWs.get(r.pcode ?? '') ?? ''
    const ws = workshopCode(rawWs) as WorkshopCode
    const validWs: WorkshopCode = WORKSHOP_CODES.includes(ws) ? ws : 'DMC1'
    const normKey = `${r.products}|||${validWs}`
    const normInfo = normMap.get(normKey) ?? { norm: 0, pspeed: 0 }
    return {
      pcode:     r.pcode ?? '',
      pdate:     r.pdate ?? '',
      workshop:  validWs,
      product:   r.products ?? '',
      poutput:   r.poutput ?? 0,
      eoutput:   r.eoutput ?? 0,
      routput:   r.routput ?? 0,
      workforce: r.workforce ?? 0,
      starttime: r.starttime ?? '',
      endtime:   r.endtime ?? '',
      realnorm:  r.realnorm ?? 0,
      norm:      normInfo.norm,
      pspeed:    normInfo.pspeed,
    }
  })
}

// ── 1. Tiến độ sản xuất ──────────────────────────────────────────────────

export async function queryProgress(
  workshopId: WorkshopCode | null,
  from: string,
  to: string,
): Promise<{ orders?: OrderStatus[]; summary?: ProgressSummary; summaries?: ProgressSummary[] }> {
  const supabase = await createClient()
  const now = new Date()

  type DataSelect = {
    PCODE: string; WORKSHOP: string | null; DESCRIPTION: string | null
    CUSTOMER: string | null; QUANTITY: number | null; INITIALDATE: string | null
    DEADLINEDATE: string | null; STATUS: string | null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dataQuery: any = supabase
    .from('data')
    .select('PCODE,WORKSHOP,DESCRIPTION,CUSTOMER,QUANTITY,INITIALDATE,DEADLINEDATE,STATUS')
    .gte('INITIALDATE', from)
    .lte('INITIALDATE', to)

  if (workshopId) {
    const filters = workshopToDataFilters(workshopId)
    const orStr = filters.map((f) => `WORKSHOP.ilike.${f}`).join(',')
    dataQuery = dataQuery.or(orStr)
  }

  const { data: dataRows } = await dataQuery as { data: DataSelect[] | null }
  if (!dataRows || dataRows.length === 0) {
    return workshopId
      ? { orders: [], summary: { workshop: workshopId, total: 0, completed: 0, overdue: 0, dueSoon: 0, progressPct: 0 } }
      : { summaries: WORKSHOP_CODES.map((ws) => ({ workshop: ws, total: 0, completed: 0, overdue: 0, dueSoon: 0, progressPct: 0 })) }
  }

  const allPcodes = dataRows.map((r) => r.PCODE).filter(Boolean)
  const { data: prodRows } = await supabase
    .from('Production')
    .select('pcode')
    .in('pcode', allPcodes) as { data: { pcode: string | null }[] | null }

  const submittedSet = new Set((prodRows ?? []).map((r) => r.pcode).filter(Boolean))

  const orders: OrderStatus[] = dataRows.map((r) => {
    const ws = workshopCode(r.WORKSHOP ?? '') as WorkshopCode
    const validWs: WorkshopCode = WORKSHOP_CODES.includes(ws) ? ws : 'DMC1'
    const hasProduction = submittedSet.has(r.PCODE)
    const dl = r.DEADLINEDATE ? new Date(r.DEADLINEDATE) : null

    let status: OrderStatus['status'] = hasProduction ? 'completed' : 'in_progress'
    if (!hasProduction && dl) {
      if (dl < now) status = 'overdue'
      else if (dl.getTime() - now.getTime() < 86_400_000) status = 'due_soon'
    }

    const dlStr = r.DEADLINEDATE ?? ''
    return {
      pcode:        r.PCODE,
      workshop:     validWs,
      description:  r.DESCRIPTION ?? '',
      customer:     r.CUSTOMER ?? '',
      quantity:     r.QUANTITY != null ? String(r.QUANTITY) : '',
      initialdate:  r.INITIALDATE ?? '',
      deadlinedate: dlStr.substring(0, 10),
      deadlinetime: dlStr.includes('T') ? dlStr.substring(11, 16) : '',
      status,
      hasProduction,
    }
  })

  const makeSummary = (ws: WorkshopCode, list: OrderStatus[]): ProgressSummary => {
    const total     = list.length
    const completed = list.filter((o) => o.status === 'completed').length
    const overdue   = list.filter((o) => o.status === 'overdue').length
    const dueSoon   = list.filter((o) => o.status === 'due_soon').length
    return { workshop: ws, total, completed, overdue, dueSoon, progressPct: total > 0 ? (completed / total) * 100 : 0 }
  }

  if (workshopId) {
    return { orders, summary: makeSummary(workshopId, orders) }
  }

  return {
    summaries: WORKSHOP_CODES.map((ws) => makeSummary(ws, orders.filter((o) => o.workshop === ws))),
  }
}

// ── 2. Kết quả sản xuất ──────────────────────────────────────────────────

export async function queryOutput(
  workshopId: WorkshopCode | null,
  from: string,
  to: string,
  groupBy: GroupBy,
) {
  const rows = await fetchProdRows(workshopId, from, to)
  const seriesKeys: string[] = workshopId
    ? [...new Set(rows.map((r) => r.product))].filter(Boolean).sort()
    : [...WORKSHOP_CODES]

  // Theo ca
  const slotAcc = new Map<string, Map<string, number>>(
    Object.keys(SHIFT_LABELS).map((s) => [s, new Map(seriesKeys.map((k) => [k, 0]))])
  )
  for (const r of rows) {
    const slot = classifyShift(r.starttime)
    const key  = workshopId ? r.product : r.workshop
    if (seriesKeys.includes(key)) {
      const m = slotAcc.get(slot)!
      m.set(key, (m.get(key) ?? 0) + r.poutput)
    }
  }

  const bySlot = Object.entries(SHIFT_LABELS).map(([slot, label]) => {
    const entry: Record<string, number | string> = { slot, label }
    seriesKeys.forEach((k) => { entry[k] = slotAcc.get(slot)!.get(k) ?? 0 })
    return entry
  })

  // Theo kỳ (ngày/tuần/tháng/năm)
  const periodAcc = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const period = toPeriodKey(r.pdate, groupBy)
    const key    = workshopId ? r.product : r.workshop
    if (!periodAcc.has(period)) periodAcc.set(period, new Map(seriesKeys.map((k) => [k, 0])))
    if (seriesKeys.includes(key)) {
      const m = periodAcc.get(period)!
      m.set(key, (m.get(key) ?? 0) + r.poutput)
    }
  }

  const byPeriod = [...periodAcc.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, m]) => {
    const entry: Record<string, number | string> = { period }
    seriesKeys.forEach((k) => { entry[k] = m.get(k) ?? 0 })
    return entry
  })

  return { bySlot, byPeriod, seriesKeys }
}

// ── 3. Chất lượng ────────────────────────────────────────────────────────

type Acc = { bad: number; total: number }

export async function queryQuality(
  workshopId: WorkshopCode | null,
  from: string,
  to: string,
  groupBy: GroupBy,
) {
  const rows = await fetchProdRows(workshopId, from, to)
  const seriesKeys: string[] = workshopId
    ? [...new Set(rows.map((r) => r.product))].filter(Boolean).sort()
    : [...WORKSHOP_CODES]

  const makeAcc = () => new Map<string, Acc>(seriesKeys.map((k) => [k, { bad: 0, total: 0 }]))
  const toRate  = (a: Acc) => a.total > 0 ? Math.round((a.bad / a.total) * 1000) / 10 : 0

  // Theo ca
  const slotAcc = new Map<string, Map<string, Acc>>(Object.keys(SHIFT_LABELS).map((s) => [s, makeAcc()]))
  for (const r of rows) {
    const slot = classifyShift(r.starttime)
    const key  = workshopId ? r.product : r.workshop
    if (seriesKeys.includes(key)) {
      const cur = slotAcc.get(slot)!.get(key)!
      cur.bad   += r.eoutput + r.routput
      cur.total += r.poutput
    }
  }

  const bySlot = Object.entries(SHIFT_LABELS).map(([slot, label]) => {
    const entry: Record<string, number | string> = { slot, label }
    seriesKeys.forEach((k) => { entry[k] = toRate(slotAcc.get(slot)!.get(k)!) })
    return entry
  })

  // Xu hướng theo kỳ
  const periodAcc = new Map<string, Map<string, Acc>>()
  for (const r of rows) {
    const period = toPeriodKey(r.pdate, groupBy)
    const key    = workshopId ? r.product : r.workshop
    if (!periodAcc.has(period)) periodAcc.set(period, makeAcc())
    if (seriesKeys.includes(key)) {
      const cur = periodAcc.get(period)!.get(key)!
      cur.bad   += r.eoutput + r.routput
      cur.total += r.poutput
    }
  }

  const trend = [...periodAcc.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, m]) => {
    const entry: Record<string, number | string> = { period }
    seriesKeys.forEach((k) => { entry[k] = toRate(m.get(k)!) })
    return entry
  })

  // Heatmap — chỉ dùng ở comparison mode
  const heatmap: HeatmapCell[] = !workshopId
    ? [...periodAcc.entries()].flatMap(([period, m]) =>
        WORKSHOP_CODES.map((ws) => ({ workshop: ws, period, defectRate: toRate(m.get(ws) ?? { bad: 0, total: 0 }) }))
      )
    : []

  return { bySlot, trend, heatmap, seriesKeys, threshold: 5 }
}

// ── 4. OEE ───────────────────────────────────────────────────────────────

export async function queryOEE(
  workshopId: WorkshopCode | null,
  from: string,
  to: string,
) {
  const rows = await fetchProdRows(workshopId, from, to)

  const withMetrics = rows.map((r) => {
    const hours = durationHours(r.starttime, r.endtime)
    const A     = calcA(r.poutput, r.pspeed, hours)
    const P     = calcP(r.realnorm, r.norm)
    const Q     = calcQ(r.poutput, r.eoutput, r.routput)
    return { ...r, A, P, Q, OEE: calcOEE(A, P, Q) }
  })

  const rollup = (recs: typeof withMetrics): Omit<OEEWorkshop, 'workshop' | 'lines'> => {
    const poutput = recs.reduce((s, r) => s + r.poutput, 0)
    const w = (field: 'A' | 'P' | 'Q' | 'OEE') =>
      weightedAvg(recs.map((r) => ({ value: r[field], weight: r.poutput })))
    return { poutput, A: w('A'), P: w('P'), Q: w('Q'), OEE: w('OEE') }
  }

  if (workshopId) {
    const lineMap = new Map<string, typeof withMetrics>()
    for (const r of withMetrics) {
      if (!lineMap.has(r.product)) lineMap.set(r.product, [])
      lineMap.get(r.product)!.push(r)
    }
    const lines: OEELine[] = [...lineMap.entries()].map(([product, recs]) => ({
      product,
      ...rollup(recs),
    }))
    return {
      workshop: { workshop: workshopId, ...rollup(withMetrics), lines },
    }
  }

  const workshops: OEEWorkshop[] = WORKSHOP_CODES.map((ws) => ({
    workshop: ws,
    ...rollup(withMetrics.filter((r) => r.workshop === ws)),
  }))
  const ranking = [...workshops]
    .sort((a, b) => b.OEE - a.OEE)
    .map((ws, i) => ({ ...ws, rank: i + 1 }))

  return { workshops, ranking }
}

// ── 5. Xếp hạng ─────────────────────────────────────────────────────────

export async function queryRanking(metric: string, from: string, to: string) {
  if (metric === 'progress') {
    const { summaries } = await queryProgress(null, from, to)
    return (summaries ?? [])
      .sort((a, b) => b.progressPct - a.progressPct)
      .map((s, i) => ({
        rank: i + 1, workshop: s.workshop,
        label: s.workshop, value: Math.round(s.progressPct * 10) / 10, unit: '%',
      }))
  }

  const rows = await fetchProdRows(null, from, to)
  const wsMap = new Map<WorkshopCode, ProdRow[]>(WORKSHOP_CODES.map((ws) => [ws, []]))
  for (const r of rows) wsMap.get(r.workshop)?.push(r)

  if (metric === 'output') {
    return [...wsMap.entries()]
      .map(([ws, recs]) => ({ ws, value: recs.reduce((s, r) => s + r.poutput, 0) }))
      .sort((a, b) => b.value - a.value)
      .map((x, i) => ({ rank: i + 1, workshop: x.ws, label: x.ws, value: x.value, unit: 'sản phẩm' }))
  }

  if (metric === 'quality') {
    return [...wsMap.entries()]
      .map(([ws, recs]) => {
        const tot = recs.reduce((s, r) => s + r.poutput, 0)
        const bad = recs.reduce((s, r) => s + r.eoutput + r.routput, 0)
        return { ws, value: tot > 0 ? Math.round((1 - bad / tot) * 1000) / 10 : 0 }
      })
      .sort((a, b) => b.value - a.value)
      .map((x, i) => ({ rank: i + 1, workshop: x.ws, label: x.ws, value: x.value, unit: '%' }))
  }

  // OEE
  const { ranking } = await queryOEE(null, from, to)
  return (ranking ?? []).map((r) => ({
    rank: r.rank, workshop: r.workshop, label: r.workshop,
    value: Math.round(r.OEE * 1000) / 10, unit: '%',
  }))
}

// ── Helpers ───────────────────────────────────────────────────────────────

function toPeriodKey(pdate: string, groupBy: GroupBy): string {
  if (!pdate) return '?'
  switch (groupBy) {
    case 'week': {
      const d    = new Date(pdate)
      const jan1 = new Date(d.getFullYear(), 0, 1)
      const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7)
      return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
    }
    case 'month': return pdate.substring(0, 7)
    case 'year':  return pdate.substring(0, 4)
    default:      return pdate.substring(0, 10) // day or shift
  }
}
