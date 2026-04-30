import { createClient } from '@/lib/supabase/server'
import { queryOEE } from '@/lib/reports/report-queries'
import { DEPARTMENT_LABELS, KPI_WORKSHOPS } from './constants'
import {
  normalizeKpiMatrixRow,
  normalizeKpiRow,
  normalizeTrendPoint,
  summarizeKpiRows,
  toNumber,
} from './format'
import type {
  KpiComparisonResponse,
  KpiDepartment,
  KpiDepartmentSummary,
  KpiMatrixRow,
  KpiResultRow,
  KpiTrendPoint,
  KpiWorkshop,
  OperatorType,
  PeriodType,
} from './types'
import type { WorkshopCode } from '@/lib/reports/report-types'

// ── Private types ────────────────────────────────────────────────────────────

type ProdDataRow = {
  pcode: string | null
  poutput: number | null
  eoutput: number | null
  routput: number | null
  totalem: string | null
  pdate: string | null
}
type OrderDataRow = {
  PCODE: string
  QUANTITY: number | null
  DEADLINEDATE: string | null
}
type ProdDataset = { prodRows: ProdDataRow[]; orderRows: OrderDataRow[] }

type KpiDef = {
  code: string
  name: string
  unit: string
  operator: OperatorType
  defaultPeriod: PeriodType
}

const SX01_DEF: KpiDef = { code: 'SX-01', name: 'Tỷ lệ lỗi thành phẩm',          unit: '%', operator: 'lte', defaultPeriod: 'quarterly' }
const SX02_DEF: KpiDef = { code: 'SX-02', name: 'Đúng tiến độ đơn hàng',          unit: '%', operator: 'gte', defaultPeriod: 'quarterly' }
const SX04_DEF: KpiDef = { code: 'SX-04', name: 'Chi phí NVL trong định mức',     unit: '%', operator: 'gte', defaultPeriod: 'quarterly' }
const SX05_DEF: KpiDef = { code: 'SX-05', name: 'Tỷ lệ hoàn thành 5S',           unit: '%', operator: 'gte', defaultPeriod: 'monthly'   }
const SX06_DEF: KpiDef = { code: 'SX-06', name: 'Tiến độ sản lượng đơn hàng',    unit: '%', operator: 'gte', defaultPeriod: 'monthly'   }

// ── Public queries ────────────────────────────────────────────────────────────

export async function queryKpiRows(params: {
  department: KpiDepartment
  periodType: PeriodType
  anchorDate: string
  workshop?: KpiWorkshop | null
}): Promise<KpiResultRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('rpc_calculate_kpi', {
    p_department: params.department,
    p_period_type: params.periodType,
    p_anchor_date: params.anchorDate,
    p_workshop: params.workshop ?? null,
  })

  if (error) throw new Error(error.message)
  return Array.isArray(data) ? data.map(normalizeKpiRow) : []
}

export async function queryProductionKpiRows(params: {
  periodType: PeriodType
  anchorDate: string
  workshop?: KpiWorkshop | null
}): Promise<KpiResultRow[]> {
  const period = await queryPeriodFromDb(params.periodType, params.anchorDate)
  const periodRef = {
    period_start: period.period_start,
    period_end: period.period_end,
    period_label: period.period_label,
  }
  const ws = params.workshop ?? null

  const [dataset, sx01T, sx02T, sx04T, sx05T, sx06T, oeeRow] = await Promise.all([
    fetchProdDataForPeriod(period.period_start, period.period_end),
    queryKpiTarget('SX-01', params.periodType),
    queryKpiTarget('SX-02', params.periodType),
    queryKpiTarget('SX-04', params.periodType),
    queryKpiTarget('SX-05', params.periodType),
    queryKpiTarget('SX-06', params.periodType),
    queryProductionOeeRow(params, period),
  ])

  const sx01 = calcSX01(dataset.prodRows, ws)
  const sx02 = calcSX02(dataset.prodRows, dataset.orderRows, period.period_start, period.period_end, ws)
  const sx06 = calcSX06(dataset.prodRows, dataset.orderRows, ws)

  return [
    buildProdKpiRow(SX01_DEF, sx01T, sx01.actual, sx01.count, params.periodType, periodRef),
    buildProdKpiRow(SX02_DEF, sx02T, sx02.actual, sx02.count, params.periodType, periodRef),
    oeeRow,
    buildProdKpiRow(SX04_DEF, sx04T, 0, 0, params.periodType, periodRef),
    buildProdKpiRow(SX05_DEF, sx05T, 0, 0, params.periodType, periodRef),
    buildProdKpiRow(SX06_DEF, sx06T, sx06.actual, sx06.count, params.periodType, periodRef),
  ].sort((a, b) => a.kpi_code.localeCompare(b.kpi_code))
}

export async function queryKpiTrend(params: {
  kpiCode: string
  periodType: PeriodType
  anchorDate: string
  count?: number
  workshop?: KpiWorkshop | null
}): Promise<KpiTrendPoint[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('rpc_kpi_trend', {
    p_kpi_code: params.kpiCode,
    p_period_type: params.periodType,
    p_anchor_date: params.anchorDate,
    p_count: params.count ?? 12,
    p_workshop: params.workshop ?? null,
  })

  if (error) throw new Error(error.message)
  return Array.isArray(data) ? data.map(normalizeTrendPoint) : []
}

export async function queryKpiComparison(params: {
  department: KpiDepartment
  periodType: PeriodType
  anchorDate: string
}): Promise<KpiComparisonResponse> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('rpc_kpi_workshop_matrix', {
    p_department: params.department,
    p_period_type: params.periodType,
    p_anchor_date: params.anchorDate,
  })

  if (error) throw new Error(error.message)

  const rows = Array.isArray(data) ? data.map(normalizeKpiMatrixRow) : []
  const first = rows[0]
  const summaryByWorkshop = Object.fromEntries(
    KPI_WORKSHOPS.map((workshop) => [
      workshop,
      summarizeKpiRows(rows.filter((row) => row.workshop === workshop)),
    ])
  )
  const insights = KPI_WORKSHOPS
    .map((workshop) => {
      const failedCodes = rows
        .filter((row) => row.workshop === workshop && !row.is_achieved)
        .map((row) => row.kpi_code)
      return failedCodes.length >= 3
        ? `${workshop} cần focus ${failedCodes.length} KPI: ${failedCodes.join(', ')}`
        : null
    })
    .filter((value): value is string => Boolean(value))

  return {
    department: params.department,
    period: {
      type: params.periodType,
      anchor: params.anchorDate,
      label: first?.period_label ?? '',
      start: first?.period_start ?? '',
      end: first?.period_end ?? '',
    },
    workshops: [...KPI_WORKSHOPS],
    rows,
    summaryByWorkshop,
    insights,
  }
}

export async function queryProductionKpiComparison(params: {
  periodType: PeriodType
  anchorDate: string
}): Promise<KpiComparisonResponse> {
  // Get period + department metadata from RPC (rows discarded, replaced below)
  const comparison = await queryKpiComparison({
    department: 'PRODUCTION',
    periodType: params.periodType,
    anchorDate: params.anchorDate,
  })

  const { start: from, end: to, label } = comparison.period
  const periodRef = { period_start: from, period_end: to, period_label: label }

  const [dataset, oee, sx01T, sx02T, sx04T, sx05T, sx06T, oeeTarget] = await Promise.all([
    fetchProdDataForPeriod(from, to),
    queryOEE(null, from, to),
    queryKpiTarget('SX-01', params.periodType),
    queryKpiTarget('SX-02', params.periodType),
    queryKpiTarget('SX-04', params.periodType),
    queryKpiTarget('SX-05', params.periodType),
    queryKpiTarget('SX-06', params.periodType),
    queryKpiTarget('SX-03', params.periodType),
  ])

  // SX-03 OEE per workshop
  const oeeWorkshops = oee.workshops ?? []
  const oeeRows: KpiMatrixRow[] = KPI_WORKSHOPS.map((workshop) => {
    const current = oeeWorkshops.find((r) => r.workshop === workshop)
    return makeOeeRow({
      actual: (current?.OEE ?? 0) * 100,
      target: oeeTarget,
      dataCount: current && current.poutput > 0 ? 1 : 0,
      periodType: params.periodType,
      periodStart: from,
      periodEnd: to,
      periodLabel: label,
      workshop,
    }) as KpiMatrixRow
  })

  // SX-01/02/04/05/06 per workshop — computed from Production + data tables
  const prodMatrixRows: KpiMatrixRow[] = KPI_WORKSHOPS.flatMap((workshop) => {
    const sx01 = calcSX01(dataset.prodRows, workshop)
    const sx02 = calcSX02(dataset.prodRows, dataset.orderRows, from, to, workshop)
    const sx06 = calcSX06(dataset.prodRows, dataset.orderRows, workshop)
    return [
      buildProdKpiRow(SX01_DEF, sx01T, sx01.actual, sx01.count, params.periodType, periodRef, workshop) as KpiMatrixRow,
      buildProdKpiRow(SX02_DEF, sx02T, sx02.actual, sx02.count, params.periodType, periodRef, workshop) as KpiMatrixRow,
      buildProdKpiRow(SX04_DEF, sx04T, 0, 0, params.periodType, periodRef, workshop) as KpiMatrixRow,
      buildProdKpiRow(SX05_DEF, sx05T, 0, 0, params.periodType, periodRef, workshop) as KpiMatrixRow,
      buildProdKpiRow(SX06_DEF, sx06T, sx06.actual, sx06.count, params.periodType, periodRef, workshop) as KpiMatrixRow,
    ]
  })

  const rows: KpiMatrixRow[] = [...prodMatrixRows, ...oeeRows]
    .sort((a, b) => a.kpi_code.localeCompare(b.kpi_code) || a.workshop.localeCompare(b.workshop))

  const summaryByWorkshop = Object.fromEntries(
    KPI_WORKSHOPS.map((workshop) => [
      workshop,
      summarizeKpiRows(rows.filter((r) => r.workshop === workshop)),
    ])
  )

  const insights = KPI_WORKSHOPS
    .map((workshop) => {
      const failedCodes = rows
        .filter((r) => r.workshop === workshop && !r.is_achieved && r.data_count > 0)
        .map((r) => r.kpi_code)
      return failedCodes.length >= 3
        ? `${workshop} cần focus ${failedCodes.length} KPI: ${failedCodes.join(', ')}`
        : null
    })
    .filter((v): v is string => Boolean(v))

  return { ...comparison, rows, summaryByWorkshop, insights }
}

export async function queryKpiDepartmentSummary(params: {
  department: KpiDepartment
  periodType: PeriodType
  anchorDate: string
}): Promise<KpiDepartmentSummary> {
  const rows = params.department === 'PRODUCTION'
    ? await queryProductionKpiRows({ periodType: params.periodType, anchorDate: params.anchorDate })
    : await queryKpiRows({ department: params.department, periodType: params.periodType, anchorDate: params.anchorDate })

  return {
    department: params.department,
    label: DEPARTMENT_LABELS[params.department],
    summary: summarizeKpiRows(rows),
    rows,
  }
}

// ── Data fetcher ─────────────────────────────────────────────────────────────

async function fetchProdDataForPeriod(from: string, to: string): Promise<ProdDataset> {
  const supabase = await createClient()

  const { data: prodRows } = await supabase
    .from('Production')
    .select('pcode,poutput,eoutput,routput,totalem,pdate')
    .gte('pdate', from)
    .lte('pdate', to)

  const pcodes = [...new Set(
    (prodRows ?? []).map(r => r.pcode).filter((p): p is string => !!p)
  )]

  if (pcodes.length === 0) return { prodRows: [], orderRows: [] }

  const { data: orderRows } = await supabase
    .from('data')
    .select('PCODE,QUANTITY,DEADLINEDATE')
    .in('PCODE', pcodes)

  return {
    prodRows: (prodRows ?? []) as ProdDataRow[],
    orderRows: (orderRows ?? []) as OrderDataRow[],
  }
}

// ── Calc functions (pure) ─────────────────────────────────────────────────────

// SX-01: tỷ lệ lỗi = eoutput (sản phẩm lỗi) / poutput (sản phẩm đã sản xuất)
function calcSX01(
  prodRows: ProdDataRow[],
  workshop: string | null,
): { actual: number; count: number } {
  const rows = workshop ? prodRows.filter(r => r.totalem === workshop) : prodRows
  const totalProd = rows.reduce((s, r) => s + (r.poutput ?? 0), 0)
  const defects = rows.reduce((s, r) => s + (r.eoutput ?? 0), 0)
  return {
    actual: totalProd > 0 ? (defects / totalProd) * 100 : 0,
    count: rows.length,
  }
}

// SX-02: đúng tiến độ = % đơn có deadline trong kỳ mà ngày sx cuối ≤ deadline
function calcSX02(
  prodRows: ProdDataRow[],
  orderRows: OrderDataRow[],
  from: string,
  to: string,
  workshop: string | null,
): { actual: number; count: number } {
  // Build pcode → { maxPdate, workshop } from production rows
  const maxByPcode = new Map<string, { maxDate: string; ws: string }>()
  for (const r of prodRows) {
    if (!r.pcode) continue
    const ex = maxByPcode.get(r.pcode)
    if (!ex || (r.pdate ?? '') > ex.maxDate)
      maxByPcode.set(r.pcode, { maxDate: r.pdate ?? '', ws: r.totalem ?? '' })
  }

  // Orders: deadline in period + have production + workshop matches via Production.totalem
  const scoped = orderRows.filter(o => {
    if (!o.DEADLINEDATE) return false
    const dl = o.DEADLINEDATE.substring(0, 10)
    if (dl < from || dl > to) return false
    const prod = maxByPcode.get(o.PCODE)
    if (!prod) return false // no production at all → exclude
    if (workshop && prod.ws !== workshop) return false
    return true
  })

  if (scoped.length === 0) return { actual: 0, count: 0 }

  const onTime = scoped.filter(o => {
    const dl = o.DEADLINEDATE!.substring(0, 10)
    return (maxByPcode.get(o.PCODE)?.maxDate ?? '') <= dl
  }).length

  return { actual: (onTime / scoped.length) * 100, count: scoped.length }
}

// SX-06: tiến độ sản lượng = SUM(eoutput trong kỳ) / SUM(QUANTITY của đơn đang sx) × 100
function calcSX06(
  prodRows: ProdDataRow[],
  orderRows: OrderDataRow[],
  workshop: string | null,
): { actual: number; count: number } {
  const qtyMap = new Map(orderRows.map(o => [o.PCODE, o.QUANTITY ?? 0]))

  const rows = workshop ? prodRows.filter(r => r.totalem === workshop) : prodRows

  const outputByPcode = new Map<string, number>()
  for (const r of rows) {
    if (!r.pcode) continue
    outputByPcode.set(r.pcode, (outputByPcode.get(r.pcode) ?? 0) + (r.eoutput ?? 0))
  }

  let totalOut = 0, totalQty = 0, count = 0
  for (const [pcode, out] of outputByPcode) {
    const qty = qtyMap.get(pcode) ?? 0
    if (qty > 0) { totalOut += out; totalQty += qty; count++ }
  }

  return {
    actual: totalQty > 0 ? Math.min(100, (totalOut / totalQty) * 100) : 0,
    count,
  }
}

// ── Row builder ───────────────────────────────────────────────────────────────

function buildProdKpiRow(
  def: KpiDef,
  target: number,
  actual: number,
  count: number,
  periodType: PeriodType,
  period: Pick<KpiResultRow, 'period_start' | 'period_end' | 'period_label'>,
  workshop?: KpiWorkshop,
): KpiResultRow {
  const isLower = def.operator === 'lte' || def.operator === 'lt'
  const isAchieved = isLower ? actual <= target : actual >= target

  const achievementPct = count === 0 || target === 0 ? 0
    : isLower
      ? Math.min(100, actual === 0 ? 100 : (target / actual) * 100)
      : Math.min(100, (actual / target) * 100)

  const row: KpiResultRow = {
    kpi_code: def.code,
    kpi_name: def.name,
    target_value: target,
    target_operator: def.operator,
    actual_value: actual,
    unit: def.unit,
    is_achieved: count === 0 ? false : isAchieved,
    achievement_pct: achievementPct,
    data_count: count,
    period_start: period.period_start,
    period_end: period.period_end,
    period_label: period.period_label,
    default_period: def.defaultPeriod,
    is_period_match: periodType === def.defaultPeriod,
  }
  return workshop ? { ...row, workshop } as KpiResultRow : row
}

// ── OEE helpers (SX-03) ───────────────────────────────────────────────────────

async function queryProductionOeeRow(
  params: { periodType: PeriodType; anchorDate: string; workshop?: KpiWorkshop | null },
  periodRow?: Pick<KpiResultRow, 'period_start' | 'period_end' | 'period_label'>,
): Promise<KpiResultRow> {
  const period = periodRow ?? await queryPeriodFromDb(params.periodType, params.anchorDate)
  const target = await queryKpiTarget('SX-03', params.periodType)

  if (params.workshop) {
    const data = await queryOEE(params.workshop as WorkshopCode, period.period_start, period.period_end)
    const actual = ((data.workshop?.OEE ?? 0) * 100)
    return makeOeeRow({
      actual, target,
      dataCount: data.workshop && data.workshop.poutput > 0 ? 1 : 0,
      periodType: params.periodType,
      periodStart: period.period_start,
      periodEnd: period.period_end,
      periodLabel: period.period_label,
    }) as KpiResultRow
  }

  const data = await queryOEE(null, period.period_start, period.period_end)
  const ws = data.workshops ?? []
  const totalOutput = ws.reduce((sum, w) => sum + w.poutput, 0)
  const actual = totalOutput > 0
    ? ws.reduce((sum, w) => sum + (w.OEE * w.poutput), 0) / totalOutput * 100
    : 0

  return makeOeeRow({
    actual, target,
    dataCount: ws.filter((w) => w.poutput > 0).length,
    periodType: params.periodType,
    periodStart: period.period_start,
    periodEnd: period.period_end,
    periodLabel: period.period_label,
  }) as KpiResultRow
}

async function queryKpiTarget(kpiCode: string, periodType: PeriodType): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_kpi_target', {
    p_kpi_code: kpiCode,
    p_period: periodType,
  })
  if (error) throw new Error(error.message)
  return toNumber(data, 90)
}

async function queryPeriodFromDb(
  periodType: PeriodType,
  anchorDate: string,
): Promise<Pick<KpiResultRow, 'period_start' | 'period_end' | 'period_label'>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_period_range', {
    p_period_type: periodType,
    p_anchor_date: anchorDate,
  })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined
  return {
    period_start: String(row?.period_start ?? anchorDate),
    period_end: String(row?.period_end ?? anchorDate),
    period_label: String(row?.period_label ?? anchorDate),
  }
}

function makeOeeRow(params: {
  actual: number
  target: number
  dataCount: number
  periodType: PeriodType
  periodStart: string
  periodEnd: string
  periodLabel: string
  workshop?: KpiMatrixRow['workshop']
}): KpiResultRow | KpiMatrixRow {
  const isAchieved = params.actual >= params.target
  const row: KpiResultRow = {
    kpi_code: 'SX-03',
    kpi_name: 'Hiệu suất sản xuất (OEE)',
    target_value: params.target,
    target_operator: 'gte',
    actual_value: params.actual,
    unit: '%',
    is_achieved: isAchieved,
    achievement_pct: params.target > 0 ? Math.min(100, (params.actual / params.target) * 100) : 0,
    data_count: params.dataCount,
    period_start: params.periodStart,
    period_end: params.periodEnd,
    period_label: params.periodLabel,
    default_period: 'monthly',
    is_period_match: params.periodType === 'monthly',
  }
  return params.workshop ? { ...row, workshop: params.workshop } : row
}
