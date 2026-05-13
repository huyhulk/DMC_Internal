import { createClient } from '@/lib/supabase/server'
import { workshopToDataFilters, workshopCode, normalizeWorkshop, normalizeLocalDateTimeString, compareLocalDateTimeStrings } from '@/lib/utils'
import {
  calcA, calcP, calcQ, calcOEE, weightedAvg, durationHours,
} from './oee-calculator'
import { classifyShift, toPeriodKey } from '@/lib/shifts'
import type {
  WorkshopCode, GroupBy, FilterBy, ProdRow, OEELine, OEEWorkshop,
  OrderStatus, ProgressSummary, HeatmapCell,
} from './report-types'
import { WORKSHOP_CODES, SHIFT_LABELS } from './report-types'
import { buildProductionStatusMapFromRows, applyEffectiveStatusToOrder } from '@/lib/production/status-server'
import { calculateProductionCompletion, calculateProductionCompletionTime, buildProductionDeadlineCutoff } from '@/lib/production/workflow'

function toVietnamLocalDateTimeString(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`
}

// Hour-aware period key: combines pdate + starttime HH when groupBy='hour'
function getPeriodKey(r: ProdRow, groupBy: GroupBy): string {
  if (groupBy === 'hour') {
    const h = r.starttime ? r.starttime.substring(0, 2) : '??'
    return `${r.pdate} ${h}:00`
  }
  return toPeriodKey(r.pdate, groupBy)
}

// ── fetchProdRows ─────────────────────────────────────────────────────────
// RPC path (migration 005): 1 query — JOIN Production+DATA+Norm trong SQL.
// Legacy path (fallback): 3 queries — hoạt động khi chưa chạy migration 005.

type RpcRow = {
  pcode: string | null; pdate: string | null; workshop: string | null; product: string | null
  poutput: number | null; eoutput: number | null; routput: number | null
  workforce: number | null; starttime: string | null; endtime: string | null
  realnorm: number | null; norm: number | null; pspeed: number | null
}

type ProgressDataSelect = {
  PCODE: string; WORKSHOP: string | null; DESCRIPTION: string | null
  CUSTOMER: string | null; QUANTITY: number | null; INITIALDATE: string | null
  DEADLINEDATE: string | null; STATUS: string | null
}

type ProgressProductionRow = {
  pcode: string | null
  poutput: number | null
  pdate: string | null
  endtime: string | null
  save_status?: 'draft' | 'closed' | null
}

type ProgressRpcRow = {
  pcode: string | null
  workshop: string | null
  description: string | null
  customer: string | null
  quantity: number | string | null
  initialdate: string | null
  deadlinedate: string | null
  source_status: string | null
  production_rows: unknown
  period_production_rows: unknown
}

type ProgressSourceRow = ProgressDataSelect & {
  productionRows: ProgressProductionRow[]
  periodProductionRows: ProgressProductionRow[] | null
}

function isWorkshopCode(value: string): value is WorkshopCode {
  return WORKSHOP_CODES.includes(value as WorkshopCode)
}

export function resolveReportWorkshop(rawWorkshop: string | null | undefined): WorkshopCode | null {
  const ws = workshopCode(normalizeWorkshop(rawWorkshop ?? ''))
  return isWorkshopCode(ws) ? ws : null
}

function buildPcodeOutputMap(rows: Array<{ pcode: string | null; poutput: number | null }>): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    if (!row.pcode) continue
    map.set(row.pcode, (map.get(row.pcode) ?? 0) + (row.poutput ?? 0))
  }
  return map
}

function mapRpcRow(r: RpcRow): ProdRow | null {
  const validWs = resolveReportWorkshop(r.workshop)
  if (!validWs) return null
  return {
    pcode: r.pcode ?? '', pdate: r.pdate ?? '', workshop: validWs, product: r.product ?? '',
    poutput: r.poutput ?? 0, eoutput: r.eoutput ?? 0, routput: r.routput ?? 0,
    workforce: r.workforce ?? 0, starttime: r.starttime ?? '', endtime: r.endtime ?? '',
    realnorm: r.realnorm ?? 0, norm: r.norm ?? 0, pspeed: r.pspeed ?? 0,
  }
}

async function fetchProdRows(
  workshopId: WorkshopCode | null,
  from: string,
  to: string,
): Promise<ProdRow[]> {
  const supabase = await createClient()

  // RPC path — requires migration 005
  const { data: rpcData, error: rpcErr } = await supabase
    .rpc('rpc_fetch_prod_rows', { p_from: from, p_to: to, p_workshop_code: workshopId ?? null })

  if (!rpcErr && Array.isArray(rpcData)) {
    return (rpcData as RpcRow[]).map(mapRpcRow).filter((row): row is ProdRow => row !== null)
  }

  // Legacy fallback (3 queries)
  return _fetchProdRowsLegacy(supabase, workshopId, from, to)
}

async function _fetchProdRowsLegacy(
  supabase: any,
  workshopId: WorkshopCode | null,
  from: string,
  to: string,
): Promise<ProdRow[]> {
  let workshopPcodes: string[] | null = null
  if (workshopId) {
    const filters = workshopToDataFilters(workshopId)
    const orStr = filters.map((f) => `WORKSHOP.ilike.${f}`).join(',')
    const { data } = await supabase.from('data').select('PCODE').or(orStr)
    workshopPcodes = ((data ?? []) as { PCODE: string }[]).map((r: { PCODE: string }) => r.PCODE)
    if (workshopPcodes.length === 0) return []
  }

  type ProdSelect = {
    pcode: string | null; pdate: string | null; products: string | null
    poutput: number | null; eoutput: number | null; routput: number | null
    workforce: number | null; starttime: string | null; endtime: string | null
    realnorm: number | null
  }
  let query: any = supabase
    .from('Production')
    .select('pcode,pdate,products,poutput,eoutput,routput,workforce,starttime,endtime,realnorm')
    .gte('pdate', from).lte('pdate', to)
  if (workshopPcodes) query = query.in('pcode', workshopPcodes)

  const { data: prodData } = await query as { data: ProdSelect[] | null }
  if (!prodData || prodData.length === 0) return []

  const uniquePcodes = [...new Set(prodData.map((r) => r.pcode).filter(Boolean))] as string[]
  const { data: orderData } = await supabase
    .from('data').select('PCODE,WORKSHOP').in('PCODE', uniquePcodes) as {
      data: { PCODE: string; WORKSHOP: string | null }[] | null
    }
  const pcodeToWs = new Map<string, string>(
    (orderData ?? []).map((r: { PCODE: string; WORKSHOP: string | null }) => [r.PCODE, r.WORKSHOP ?? ''])
  )

  const { data: normData } = await supabase.from('Norm').select('products,norm,pspeed,workshop') as {
    data: { products: string; norm: number | null; pspeed: number | null; workshop: string | null }[] | null
  }
  const normMap = new Map<string, { norm: number; pspeed: number }>()
  for (const n of normData ?? []) {
    normMap.set(`${n.products}|||${workshopCode(n.workshop ?? '')}`, { norm: n.norm ?? 0, pspeed: n.pspeed ?? 0 })
  }

  const mappedRows: ProdRow[] = []
  for (const r of prodData) {
    const validWs = resolveReportWorkshop(pcodeToWs.get(r.pcode ?? ''))
    if (!validWs) continue
    const normInfo = normMap.get(`${r.products}|||${validWs}`) ?? { norm: 0, pspeed: 0 }
    mappedRows.push({
      pcode: r.pcode ?? '', pdate: r.pdate ?? '', workshop: validWs, product: r.products ?? '',
      poutput: r.poutput ?? 0, eoutput: r.eoutput ?? 0, routput: r.routput ?? 0,
      workforce: r.workforce ?? 0, starttime: r.starttime ?? '', endtime: r.endtime ?? '',
      realnorm: r.realnorm ?? 0, norm: normInfo.norm, pspeed: normInfo.pspeed,
    })
  }
  return mappedRows
}

// ── 1. Tiến độ sản xuất ──────────────────────────────────────────────────

export function isProgressReportCompleted(completionPct: number): boolean {
  return completionPct >= 100
}

export function normalizeProgressFilterBy(filterBy: FilterBy): FilterBy {
  return filterBy === 'completed_date' ? 'production_date' : filterBy
}

export function isProductionDateProgressFilter(filterBy: FilterBy): boolean {
  return normalizeProgressFilterBy(filterBy) === 'production_date'
}

export function getActiveProductionPcodes(rows: Array<{ pcode: string | null; [key: string]: unknown }>): string[] {
  return [...new Set(rows.map((row) => row.pcode).filter(Boolean))] as string[]
}

export function getOrderProductionDate(rows: Array<{ pdate: string | null; poutput: number | null }>): string {
  return rows
    .filter((row) => row.pdate && (row.poutput ?? 0) > 0)
    .map((row) => row.pdate as string)
    .sort((a, b) => b.localeCompare(a))[0] ?? ''
}

export function isProductionCompletionLate(completionAt: string | null, deadline: string | null | undefined): boolean {
  const deadlineCutoff = buildProductionDeadlineCutoff(deadline)
  const comparison = compareLocalDateTimeStrings(completionAt, deadlineCutoff)
  return comparison !== null && comparison > 0
}

function toFiniteNumber(value: number | string | null | undefined): number {
  const num = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(num) ? num : 0
}

function normalizeProgressProductionRows(value: unknown): ProgressProductionRow[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object')
    .map((row) => ({
      pcode: typeof row.pcode === 'string' ? row.pcode : null,
      poutput: toFiniteNumber(row.poutput as number | string | null | undefined),
      pdate: typeof row.pdate === 'string' ? row.pdate : null,
      endtime: typeof row.endtime === 'string' ? row.endtime : null,
      save_status: row.save_status === 'closed' || row.save_status === 'draft' ? row.save_status : null,
    }))
}

function mapProgressRpcRow(row: ProgressRpcRow): ProgressSourceRow | null {
  if (!row.pcode) return null
  return {
    PCODE: row.pcode,
    WORKSHOP: row.workshop,
    DESCRIPTION: row.description,
    CUSTOMER: row.customer,
    QUANTITY: toFiniteNumber(row.quantity),
    INITIALDATE: row.initialdate,
    DEADLINEDATE: row.deadlinedate,
    STATUS: row.source_status,
    productionRows: normalizeProgressProductionRows(row.production_rows),
    periodProductionRows: Array.isArray(row.period_production_rows)
      ? normalizeProgressProductionRows(row.period_production_rows)
      : null,
  }
}

const emptyProgressSummary = (workshop: WorkshopCode): ProgressSummary => ({
  workshop,
  total: 0,
  completed: 0,
  completedOnTime: 0,
  completedLate: 0,
  overdue: 0,
  dueSoon: 0,
  progressPct: 0,
})

function emptyProgressResult(workshopId: WorkshopCode | null) {
  return workshopId
    ? { orders: [], summary: emptyProgressSummary(workshopId) }
    : { summaries: WORKSHOP_CODES.map(emptyProgressSummary) }
}

function makeProgressSummary(ws: WorkshopCode, list: OrderStatus[]): ProgressSummary {
  const total           = list.length
  const completedOnTime = list.filter((o) => o.status === 'completed').length
  const completedLate   = list.filter((o) => o.status === 'completed_late').length
  const completed       = completedOnTime + completedLate
  const overdue         = list.filter((o) => o.status === 'overdue').length
  const dueSoon         = list.filter((o) => o.status === 'due_soon').length
  return { workshop: ws, total, completed, completedOnTime, completedLate, overdue, dueSoon, progressPct: total > 0 ? (completed / total) * 100 : 0 }
}

function buildProgressResultFromSourceRows(
  workshopId: WorkshopCode | null,
  sourceRows: ProgressSourceRow[],
): { orders?: OrderStatus[]; summary?: ProgressSummary; summaries?: ProgressSummary[] } {
  if (sourceRows.length === 0) return emptyProgressResult(workshopId)

  const nowDate = new Date()
  const now = toVietnamLocalDateTimeString(nowDate)
  const dueSoonCutoff = toVietnamLocalDateTimeString(new Date(nowDate.getTime() + 86_400_000))
  const allPcodes = sourceRows.map((r) => r.PCODE).filter(Boolean)
  const usesPeriodProductionRows = sourceRows.some((row) => row.periodProductionRows !== null)

  const productionRowsByPcode = new Map<string, ProgressProductionRow[]>()
  const periodRowsByPcode = new Map<string, ProgressProductionRow[]>()
  for (const source of sourceRows) {
    if (!productionRowsByPcode.has(source.PCODE)) {
      productionRowsByPcode.set(source.PCODE, source.productionRows)
    }
    if (source.periodProductionRows !== null && !periodRowsByPcode.has(source.PCODE)) {
      periodRowsByPcode.set(source.PCODE, source.periodProductionRows)
    }
  }

  const allProductionRows = [...productionRowsByPcode.values()].flat()
  const quantityByPcode = new Map(sourceRows.map((r) => [r.PCODE, r.QUANTITY ?? 0]))
  const statusMap = buildProductionStatusMapFromRows({
    pcodes: allPcodes,
    productionRows: allProductionRows,
    quantityByPcode,
  })

  const orders: OrderStatus[] = []
  for (const r of sourceRows) {
    const validWs = resolveReportWorkshop(r.WORKSHOP)
    if (!validWs) continue

    const productionRows = productionRowsByPcode.get(r.PCODE) ?? []
    const periodRows = usesPeriodProductionRows
      ? periodRowsByPcode.get(r.PCODE) ?? []
      : productionRows
    const totalOutput   = buildPcodeOutputMap(productionRows).get(r.PCODE) ?? 0
    const periodOutput  = buildPcodeOutputMap(periodRows).get(r.PCODE) ?? 0
    const hasProduction = usesPeriodProductionRows ? periodOutput > 0 : totalOutput > 0
    const qty           = r.QUANTITY ?? 0
    const completion = calculateProductionCompletion(qty, totalOutput)
    const effectiveOrder = applyEffectiveStatusToOrder({
      pcode: r.PCODE,
      initialdate: r.INITIALDATE ?? '',
      workshop: validWs,
      customer: r.CUSTOMER ?? '',
      quantity: qty > 0 ? String(qty) : '',
      description: r.DESCRIPTION ?? '',
      deadlinedate: r.DEADLINEDATE ?? '',
      status: r.STATUS ?? '',
    }, statusMap)
    const isCompleted = isProgressReportCompleted(completion.completionPct)
    const completionPct = completion.completionPct
    const completionAt = calculateProductionCompletionTime(qty, productionRows)
    const productionDate = getOrderProductionDate(periodRows)
    const deadlineLocal = normalizeLocalDateTimeString(r.DEADLINEDATE)

    let status: OrderStatus['status'] = 'in_progress'
    if (isCompleted) {
      status = isProductionCompletionLate(completionAt, r.DEADLINEDATE) ? 'completed_late' : 'completed'
    } else if (deadlineLocal) {
      if (deadlineLocal < now) status = 'overdue'
      else if (deadlineLocal < dueSoonCutoff) status = 'due_soon'
    }

    const dlStr = r.DEADLINEDATE ?? ''
    orders.push({
      pcode:         r.PCODE,
      workshop:      validWs,
      description:   r.DESCRIPTION ?? '',
      customer:      r.CUSTOMER ?? '',
      quantity:      qty > 0 ? String(qty) : '',
      initialdate:   r.INITIALDATE ?? '',
      productionDate,
      deadlinedate:  dlStr.substring(0, 10),
      deadlinetime:  dlStr.includes('T') ? dlStr.substring(11, 16) : '',
      status,
      productionStatus: effectiveOrder.status,
      hasProduction,
      totalOutput,
      periodOutput,
      completionPct,
      completionAt: completionAt ?? undefined,
    })
  }

  if (workshopId) {
    return { orders, summary: makeProgressSummary(workshopId, orders) }
  }

  return {
    summaries: WORKSHOP_CODES.map((ws) => makeProgressSummary(ws, orders.filter((o) => o.workshop === ws))),
  }
}

async function queryProgressLegacy(
  supabase: any,
  workshopId: WorkshopCode | null,
  from: string,
  to: string,
  progressFilterBy: FilterBy,
): Promise<{ orders?: OrderStatus[]; summary?: ProgressSummary; summaries?: ProgressSummary[] }> {
  let dataQuery: any = supabase
    .from('data')
    .select('PCODE,WORKSHOP,DESCRIPTION,CUSTOMER,QUANTITY,INITIALDATE,DEADLINEDATE,STATUS')

  let periodProductionRows: ProgressProductionRow[] | null = null

  if (isProductionDateProgressFilter(progressFilterBy)) {
    const { data: prodRows } = await supabase
      .from('Production').select('pcode,poutput,pdate,endtime,save_status')
      .gte('pdate', from).lte('pdate', to) as { data: ProgressProductionRow[] | null }
    periodProductionRows = prodRows ?? []
    const activePcodes = getActiveProductionPcodes(periodProductionRows)
    if (activePcodes.length === 0) return emptyProgressResult(workshopId)
    dataQuery = dataQuery.in('PCODE', activePcodes)
  } else if (progressFilterBy === 'initialdate') {
    dataQuery = dataQuery.gte('INITIALDATE', from).lte('INITIALDATE', to)
  } else {
    // default: deadline
    dataQuery = dataQuery.gte('DEADLINEDATE', `${from}T00:00:00`).lte('DEADLINEDATE', `${to}T23:59:59`)
  }

  if (workshopId) {
    const filters = workshopToDataFilters(workshopId)
    const orStr = filters.map((f) => `WORKSHOP.ilike.${f}`).join(',')
    dataQuery = dataQuery.or(orStr)
  }

  const { data: dataRows } = await dataQuery as { data: ProgressDataSelect[] | null }
  if (!dataRows || dataRows.length === 0) return emptyProgressResult(workshopId)

  const allPcodes = dataRows.map((r) => r.PCODE).filter(Boolean)
  const { data: prodRows } = await supabase
    .from('Production')
    .select('pcode,poutput,pdate,endtime,save_status')
    .in('pcode', allPcodes) as { data: ProgressProductionRow[] | null }

  const productionRowsByPcode = new Map<string, ProgressProductionRow[]>()
  for (const row of prodRows ?? []) {
    if (!row.pcode) continue
    const list = productionRowsByPcode.get(row.pcode) ?? []
    list.push(row)
    productionRowsByPcode.set(row.pcode, list)
  }

  const periodRowsByPcode = new Map<string, ProgressProductionRow[]>()
  for (const row of periodProductionRows ?? []) {
    if (!row.pcode) continue
    const list = periodRowsByPcode.get(row.pcode) ?? []
    list.push(row)
    periodRowsByPcode.set(row.pcode, list)
  }

  const sourceRows: ProgressSourceRow[] = dataRows.map((row) => ({
    ...row,
    productionRows: productionRowsByPcode.get(row.PCODE) ?? [],
    periodProductionRows: periodProductionRows
      ? periodRowsByPcode.get(row.PCODE) ?? []
      : null,
  }))

  return buildProgressResultFromSourceRows(workshopId, sourceRows)
}

export async function queryProgress(
  workshopId: WorkshopCode | null,
  from: string,
  to: string,
  filterBy: FilterBy = 'deadline',
): Promise<{ orders?: OrderStatus[]; summary?: ProgressSummary; summaries?: ProgressSummary[] }> {
  const supabase = await createClient()

  const progressFilterBy = normalizeProgressFilterBy(filterBy)
  if (typeof supabase.rpc === 'function') {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('rpc_fetch_progress_rows', {
      p_from: from,
      p_to: to,
      p_workshop_code: workshopId ?? null,
      p_filter_by: progressFilterBy,
    }) as { data: ProgressRpcRow[] | null; error: unknown }

    if (!rpcErr && Array.isArray(rpcData)) {
      const sourceRows = rpcData
        .map(mapProgressRpcRow)
        .filter((row): row is ProgressSourceRow => row !== null)
      return buildProgressResultFromSourceRows(workshopId, sourceRows)
    }
  }

  return queryProgressLegacy(supabase, workshopId, from, to, progressFilterBy)
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

  // Theo kỳ (ngày/tuần/tháng/năm/giờ)
  const periodAcc = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const period = getPeriodKey(r, groupBy)
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
    const period = getPeriodKey(r, groupBy)
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
  groupBy: GroupBy = 'day',
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

  // Group by period and compute weighted OEE metrics
  const periodRollup = (
    recs: typeof withMetrics,
    filterWs?: WorkshopCode,
  ): Array<{ period: string; A: number; P: number; Q: number; OEE: number; poutput: number }> => {
    const map = new Map<string, typeof withMetrics>()
    for (const r of recs) {
      if (filterWs && r.workshop !== filterWs) continue
      const p = getPeriodKey(r, groupBy)
      if (!map.has(p)) map.set(p, [])
      map.get(p)!.push(r)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, pts]) => ({ period, ...rollup(pts) }))
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
      trendByPeriod: periodRollup(withMetrics),
    }
  }

  const workshops: OEEWorkshop[] = WORKSHOP_CODES.map((ws) => ({
    workshop: ws,
    ...rollup(withMetrics.filter((r) => r.workshop === ws)),
  }))
  const ranking = [...workshops]
    .sort((a, b) => b.OEE - a.OEE)
    .map((ws, i) => ({ ...ws, rank: i + 1 }))

  // Comparison trend: per period, OEE per workshop
  const allPeriods = new Set<string>()
  const wsOeeByPeriod = new Map<WorkshopCode, Map<string, number>>()
  for (const ws of WORKSHOP_CODES) {
    const pts = periodRollup(withMetrics, ws)
    const m = new Map<string, number>()
    for (const pt of pts) { allPeriods.add(pt.period); m.set(pt.period, pt.OEE) }
    wsOeeByPeriod.set(ws, m)
  }
  const trendByPeriod = [...allPeriods].sort().map((period) => {
    const entry: Record<string, number | string> = { period }
    for (const ws of WORKSHOP_CODES) entry[ws] = wsOeeByPeriod.get(ws)?.get(period) ?? 0
    return entry
  })

  return { workshops, ranking, trendByPeriod }
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

// toPeriodKey đã chuyển sang lib/shifts.ts (ISO 8601 week).
