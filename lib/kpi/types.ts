export type Department = 'PRODUCTION' | 'MAINTENANCE' | 'COORDINATION'
export type PeriodType = 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type OperatorType = 'lte' | 'gte' | 'lt' | 'gt' | 'eq'
export type ViewMode = 'overview' | 'workshop' | 'compare'

export const WORKSHOPS = ['DMC1', 'DMC3', 'DMC4', 'DMC5'] as const
export type WorkshopCode = typeof WORKSHOPS[number]

export const WORKSHOP_COLORS: Record<WorkshopCode, string> = {
  DMC1: '#3b5bdb',
  DMC3: '#2f9e44',
  DMC4: '#d4870c',
  DMC5: '#ae3ec9',
}

export const DEPARTMENTS: { key: Department; label: string; shortLabel: string; kpiCount: number }[] = [
  { key: 'PRODUCTION',   label: 'Sản Xuất',  shortLabel: 'SX', kpiCount: 6 },
  { key: 'MAINTENANCE',  label: 'Bảo Trì',   shortLabel: 'KT', kpiCount: 7 },
  { key: 'COORDINATION', label: 'Phối Hợp',  shortLabel: 'KH', kpiCount: 6 },
]

export const PERIOD_LABELS: Record<PeriodType, string> = {
  weekly:    'Tuần',
  monthly:   'Tháng',
  quarterly: 'Quý',
  yearly:    'Năm',
}

export interface KpiResult {
  kpi_code: string
  kpi_name: string
  target_value: number
  target_operator: OperatorType
  actual_value: number
  unit: string
  is_achieved: boolean
  achievement_pct: number
  data_count: number
  period_start: string
  period_end: string
  period_label: string
  default_period: string
  is_period_match: boolean
}

export interface KpiWorkshopResult {
  kpi_code: string
  kpi_name: string
  workshop: string
  target_value: number
  target_operator: string
  actual_value: number
  is_achieved: boolean
  achievement_pct: number
  data_count: number
}

export interface OvertimeSummary {
  workshop: string
  ot_count: number
  total_employees: number
  unique_employees: number
  total_hours: number
  by_category: Record<string, number>
  by_reason: Record<string, number>
  period_start: string
  period_end: string
  period_label: string
}

export interface TopOvertimeEmployee {
  employee_name: string
  workshop: string
  ot_count: number
  total_hours: number
}

export const OT_CATEGORY_LABELS: Record<string, string> = {
  PRODUCTION: 'Sản xuất',
  DELIVERY:   'Giao nhận hàng',
  INTERNAL:   'Nội bộ',
}

export const OT_REASON_LABELS: Record<string, string> = {
  kh_dat_tre:       'KH đặt trễ / YC gấp',
  don_hang_nhieu:   'Đơn hàng nhiều, SX không kịp',
  noi_bo_sx:        'Nội bộ SX',
  xe_vao_tre:       'Xe vào trễ',
  don_hang_sll:     'Đơn hàng SX SLL',
  giao_hang_sll:    'Giao hàng SLL',
  khong_du_nhan_su: 'Không đủ nhân sự SX/GH',
}
