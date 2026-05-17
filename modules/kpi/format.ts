import type {
  KpiMatrixRow,
  KpiResultRow,
  KpiSummary,
  KpiTargetOperator,
  KpiTrendPoint,
} from './types'

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? value as UnknownRecord : {}
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function toStringValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (value == null) return fallback
  return String(value)
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value === 'true'
  return Boolean(value)
}

function toTargetOperator(value: unknown): KpiTargetOperator {
  const op = toStringValue(value)
  if (op === 'lte' || op === 'gte' || op === 'lt' || op === 'gt' || op === 'eq') return op
  return 'gte'
}

function toPeriodType(value: unknown): KpiResultRow['default_period'] {
  const period = toStringValue(value)
  if (period === 'weekly' || period === 'monthly' || period === 'quarterly' || period === 'yearly') return period
  return 'monthly'
}

export function normalizeKpiRow(value: unknown): KpiResultRow {
  const row = asRecord(value)
  return {
    kpi_code: toStringValue(row.kpi_code),
    kpi_name: toStringValue(row.kpi_name),
    target_value: toNumber(row.target_value),
    target_operator: toTargetOperator(row.target_operator),
    actual_value: toNumber(row.actual_value),
    unit: toStringValue(row.unit),
    is_achieved: toBoolean(row.is_achieved),
    achievement_pct: toNumber(row.achievement_pct),
    data_count: Math.trunc(toNumber(row.data_count)),
    period_start: toStringValue(row.period_start),
    period_end: toStringValue(row.period_end),
    period_label: toStringValue(row.period_label),
    default_period: toPeriodType(row.default_period),
    is_period_match: toBoolean(row.is_period_match),
  }
}

export function normalizeKpiMatrixRow(value: unknown): KpiMatrixRow {
  const row = asRecord(value)
  return {
    ...normalizeKpiRow(value),
    workshop: toStringValue(row.workshop) as KpiMatrixRow['workshop'],
  }
}

export function normalizeTrendPoint(value: unknown): KpiTrendPoint {
  const row = asRecord(value)
  return {
    period_label: toStringValue(row.period_label),
    period_start: toStringValue(row.period_start),
    period_end: toStringValue(row.period_end),
    actual_value: toNumber(row.actual_value),
    target_value: toNumber(row.target_value),
    is_achieved: toBoolean(row.is_achieved),
  }
}

export function summarizeKpiRows(rows: KpiResultRow[]): KpiSummary {
  const total = rows.length
  const achieved = rows.filter((row) => row.is_achieved).length
  const failed = total - achieved

  // Production KPIs (SX-01/02/06) reuse the same Production rows → summing data_count
  // triple-counts the same records. Use SX-01.data_count directly (= số lệnh SX đã
  // tính trong kỳ, filter theo xưởng). Maintenance/Coordination have independent
  // data sources per KPI → keep the sum as total data points.
  const sx01 = rows.find((row) => row.kpi_code === 'SX-01')
  const dataPoints = sx01 !== undefined
    ? sx01.data_count
    : rows.reduce((sum, row) => sum + row.data_count, 0)

  const avgAchievement = total > 0
    ? rows.reduce((sum, row) => sum + clamp(row.achievement_pct, 0, 200), 0) / total
    : 0

  return {
    total,
    achieved,
    failed,
    achievementRate: total > 0 ? (achieved / total) * 100 : 0,
    avgAchievement,
    dataPoints,
  }
}

export function formatKpiValue(value: number, unit: string): string {
  const rounded = Number.isInteger(value)
    ? value.toLocaleString('vi-VN')
    : value.toLocaleString('vi-VN', { maximumFractionDigits: unit === '%' ? 2 : 1 })
  return unit ? `${rounded}${unit === '%' ? '%' : ` ${unit}`}` : rounded
}

export function targetOperatorLabel(operator: KpiTargetOperator): string {
  switch (operator) {
    case 'lte': return '<='
    case 'lt':  return '<'
    case 'gte': return '>='
    case 'gt':  return '>'
    case 'eq':  return '='
  }
}

export function formatTarget(row: Pick<KpiResultRow, 'target_operator' | 'target_value' | 'unit'>): string {
  return `${targetOperatorLabel(row.target_operator)} ${formatKpiValue(row.target_value, row.unit)}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
