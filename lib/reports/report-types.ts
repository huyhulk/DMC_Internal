export type ReportMode = 'detail' | 'comparison'
export type GroupBy = 'day' | 'week' | 'month' | 'year'
export type RankingMetric = 'oee' | 'quality' | 'output' | 'progress'

export const WORKSHOP_CODES = ['DMC1', 'DMC3', 'DMC4', 'DMC5'] as const
export type WorkshopCode = typeof WORKSHOP_CODES[number]

// Bảng màu cố định 4 xưởng — dùng nhất quán trên mọi chart
export const WORKSHOP_COLORS: Record<WorkshopCode, string> = {
  DMC1: '#3b82f6', // xanh
  DMC3: '#f97316', // cam
  DMC4: '#8b5cf6', // tím
  DMC5: '#ef4444', // đỏ
}

export const WORKSHOP_LABEL: Record<WorkshopCode, string> = {
  DMC1: 'DMC1 — Tôn & Phụ kiện',
  DMC3: 'DMC3 — Tôn Panel',
  DMC4: 'DMC4 — Xà gồ',
  DMC5: 'DMC5 — Tôn & PU',
}

// 5 khung giờ ca sản xuất (bao gồm tăng ca)
export type ShiftSlot = 'ca_sang_1' | 'ca_sang_2' | 'ca_chieu_1' | 'ca_chieu_2' | 'ca_tang_ca' | 'khac'

export const SHIFT_LABELS: Record<ShiftSlot, string> = {
  ca_sang_1:  '7:30–9:30',
  ca_sang_2:  '9:30–11:30',
  ca_chieu_1: '12:30–14:30',
  ca_chieu_2: '14:30–16:30',
  ca_tang_ca: 'Tăng ca (16:30–22:00)',
  khac:       'Ngoài ca',
}

// Row nội bộ dùng cho mọi tính toán
export interface ProdRow {
  pcode:     string
  pdate:     string
  workshop:  WorkshopCode
  product:   string      // = dòng sản xuất
  poutput:   number
  eoutput:   number
  routput:   number
  workforce: number
  starttime: string
  endtime:   string
  realnorm:  number
  norm:      number
  pspeed:    number
}

// Metrics OEE cho 1 record hoặc đã tổng hợp
export interface OEEMetrics {
  A:       number
  P:       number
  Q:       number
  OEE:     number
  poutput: number
}

export interface OEELine extends OEEMetrics {
  product: string
}

export interface OEEWorkshop extends OEEMetrics {
  workshop: WorkshopCode
  lines?: OEELine[]
}

// Progress
export type OrderStatusCode = 'completed' | 'in_progress' | 'overdue' | 'due_soon'

export interface OrderStatus {
  pcode:         string
  workshop:      WorkshopCode
  description:   string
  customer:      string
  quantity:      string
  initialdate:   string
  deadlinedate:  string
  deadlinetime:  string
  status:        OrderStatusCode
  hasProduction: boolean
  totalOutput:   number
  completionPct: number
}

export interface ProgressSummary {
  workshop:    WorkshopCode
  total:       number
  completed:   number
  overdue:     number
  dueSoon:     number
  progressPct: number
}

// Output / Quality
export interface OutputPoint {
  period: string
  [key: string]: number | string
}

export interface HeatmapCell {
  workshop:   WorkshopCode
  period:     string
  defectRate: number
}

// Rankings
export interface WorkshopRank {
  rank:     number
  workshop: WorkshopCode
  label:    string
  value:    number
  unit:     string
}

export interface ReportMeta {
  mode:    ReportMode
  from:    string
  to:      string
  groupBy: GroupBy
}
