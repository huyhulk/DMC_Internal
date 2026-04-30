import type { KpiDepartment, KpiWorkshop, PeriodType } from './types'

export const PERIOD_TYPES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const satisfies readonly PeriodType[]

export const KPI_DEPARTMENTS = ['PRODUCTION', 'MAINTENANCE', 'COORDINATION'] as const satisfies readonly KpiDepartment[]

export const KPI_WORKSHOPS = ['DMC1', 'DMC3', 'DMC4', 'DMC5'] as const

export const KPI_WORKSHOP_OPTIONS = ['ALL', 'DMC1', 'DMC3', 'DMC4', 'DMC5'] as const

export const PERIOD_LABELS: Record<PeriodType, string> = {
  weekly: 'Tuần',
  monthly: 'Tháng',
  quarterly: 'Quý',
  yearly: 'Năm',
}

export const DEPARTMENT_LABELS: Record<KpiDepartment, string> = {
  PRODUCTION: 'Sản xuất',
  MAINTENANCE: 'Bảo trì',
  COORDINATION: 'Điều Phối',
}

export const KPI_WORKSHOP_LABELS: Record<KpiWorkshop, string> = {
  DMC1: 'DMC1 - Tôn & phụ kiện',
  DMC3: 'DMC3 - Tôn Panel',
  DMC4: 'DMC4 - Xà gồ',
  DMC5: 'DMC5 - Tôn & PU',
}

export const KPI_WORKSHOP_COLORS: Record<KpiWorkshop, string> = {
  DMC1: '#3b5bdb',
  DMC3: '#2f9e44',
  DMC4: '#d4870c',
  DMC5: '#ae3ec9',
}

export const PRODUCTION_KPI_CODES = ['SX-01', 'SX-02', 'SX-03', 'SX-04', 'SX-05', 'SX-06'] as const

export function isPeriodType(value: string | null): value is PeriodType {
  return PERIOD_TYPES.includes(value as PeriodType)
}

export function isKpiDepartment(value: string | null): value is KpiDepartment {
  return KPI_DEPARTMENTS.includes(value as KpiDepartment)
}

export function isKpiWorkshop(value: string | null): value is KpiWorkshop {
  return value === 'DMC1' || value === 'DMC3' || value === 'DMC4' || value === 'DMC5'
}
