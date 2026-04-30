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
  PeriodType,
} from './types'
import type { WorkshopCode } from '@/lib/reports/report-types'

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
  const rows = await queryKpiRows({
    department: 'PRODUCTION',
    periodType: params.periodType,
    anchorDate: params.anchorDate,
    workshop: params.workshop,
  })
  const oeeRow = await queryProductionOeeRow(params, rows[0])

  return [...rows.filter((row) => row.kpi_code !== 'SX-03'), oeeRow]
    .sort((a, b) => a.kpi_code.localeCompare(b.kpi_code))
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
  const comparison = await queryKpiComparison({
    department: 'PRODUCTION',
    periodType: params.periodType,
    anchorDate: params.anchorDate,
  })
  const target = await queryKpiTarget('SX-03', params.periodType)
  const oee = await queryOEE(null, comparison.period.start, comparison.period.end)
  const workshops = oee.workshops ?? []

  const oeeRows: KpiMatrixRow[] = KPI_WORKSHOPS.map((workshop) => {
    const current = workshops.find((row) => row.workshop === workshop)
    const actual = ((current?.OEE ?? 0) * 100)
    return makeOeeRow({
      actual,
      target,
      dataCount: current && current.poutput > 0 ? 1 : 0,
      periodType: params.periodType,
      periodStart: comparison.period.start,
      periodEnd: comparison.period.end,
      periodLabel: comparison.period.label,
      workshop,
    }) as KpiMatrixRow
  })

  const rows: KpiMatrixRow[] = [...comparison.rows.filter((row) => row.kpi_code !== 'SX-03'), ...oeeRows]
    .sort((a, b) => a.kpi_code.localeCompare(b.kpi_code) || a.workshop.localeCompare(b.workshop))

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

async function queryProductionOeeRow(
  params: { periodType: PeriodType; anchorDate: string; workshop?: KpiWorkshop | null },
  periodRow?: KpiResultRow,
): Promise<KpiResultRow> {
  const period = periodRow ?? await queryPeriodFromDb(params.periodType, params.anchorDate)
  const target = await queryKpiTarget('SX-03', params.periodType)

  if (params.workshop === 'PKT-SX') {
    return makeOeeRow({
      actual: 0, target, dataCount: 0,
      periodType: params.periodType,
      periodStart: period.period_start,
      periodEnd: period.period_end,
      periodLabel: period.period_label,
    }) as KpiResultRow
  }

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
