export const USER_ROLES = ['ADMIN', 'MANAGER', 'WORKSHOP_MANAGER', 'TEAM_LEADER', 'MAINTENANCE', 'COORDINATION', 'SALES', 'HR'] as const

export type UserRole = typeof USER_ROLES[number]

export type TabId = 'production' | 'maintenance' | 'coordination' | 'administration' | 'report' | 'admin'

export const ROLE_TABS: Record<UserRole, TabId[]> = {
  ADMIN:            ['production', 'maintenance', 'coordination', 'administration', 'report', 'admin'],
  MANAGER:          ['production', 'maintenance', 'coordination', 'administration', 'report'],
  WORKSHOP_MANAGER: ['production', 'maintenance', 'coordination', 'administration', 'report'],
  TEAM_LEADER:      ['production', 'coordination', 'administration', 'report'],
  MAINTENANCE:      ['maintenance', 'report'],
  COORDINATION:     ['coordination', 'report'],
  SALES:            ['coordination', 'report'],
  HR:               ['administration', 'report'],
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Quản lý',
  WORKSHOP_MANAGER: 'Trưởng xưởng',
  TEAM_LEADER: 'Tổ trưởng',
  MAINTENANCE: 'Bảo trì',
  COORDINATION: 'Điều phối',
  SALES: 'Kinh doanh',
  HR: 'Nhân sự',
}

export interface SessionUser {
  id: string
  username: string
  role: UserRole
  workspace: string
  email: string
}

export interface Order {
  pcode: string
  initialdate: string
  workshop: string
  customer: string
  quantity: string
  description: string
  deadlinedate: string
  deadlinetime?: string  // extracted from DEADLINEDATE timestamp (HH:mm part)
  status: string
}

export interface NormItem {
  products: string
  norm: number
  nwforce: number
  workshop: string
  pspeed: number
}

export interface MaterialItem {
  product: string
  material: string
}

export interface ProductionRecord {
  pdate: string
  totalem: string
  pcode: string
  products: string
  material: string
  poutput: number
  eoutput: number
  routput: number
  workforce: number
  starttime: string
  endtime: string
  realnorm: number
  log: string
  save_status?: 'draft' | 'closed'
}

export interface InitData {
  orders: Order[]
  norms: NormItem[]
  materials: MaterialItem[]
  submittedPcodes: string[]
  closedPcodes: string[]
}

export interface ProductionReportRow {
  pdate: string
  pcode: string
  workshop: string
  product: string
  poutput: number
  eoutput: number
  routput: number
  realnorm: number
  norm: number
  pspeed: number
  starttime: string
  endtime: string
  created_at?: string
}

export type ProductionSaveStatus = 'draft' | 'closed'

export interface ProductionInputHistoryRow {
  id: number
  pdate: string
  pcode: string
  workshop: string
  customer: string
  product: string
  orderDescription: string
  poutput: number
  eoutput: number
  routput: number
  workforce: number
  realnorm: number
  starttime: string
  endtime: string
  log: string
  save_status: ProductionSaveStatus
  created_at: string
  updated_at?: string
}

export interface ProductLine {
  product: string
  pdate: string
  starttime: string
  endtime: string
  workforce: number
  poutput: number
  eoutput: number
  routput: number
  realnorm: number
}

export interface PcodeStatus {
  pcode: string
  locked: boolean
  reason: 'submitted' | 'delivered' | 'closed' | ''
}

export const FACTORIES = ['DMC1', 'DMC3', 'DMC4', 'DMC5'] as const
export type FactoryKey = typeof FACTORIES[number]

// Display labels for each factory — used in dropdowns, charts, badges
export const WORKSHOP_LABELS: Record<FactoryKey, string> = {
  DMC1: 'DMC1 — Tôn & Phụ kiện',
  DMC3: 'DMC3 — Tôn Panel & Phụ kiện',
  DMC4: 'DMC4 — Xà gồ, phụ kiện',
  DMC5: 'DMC5 — Tôn, PU & Phụ kiện',
}

export interface HumanResource {
  id: number
  name: string
  factory: string | null
  machine: string | null
  position: string | null
  phone: string | null
}

export interface HRDayData {
  factory: FactoryKey
  totalem: number
  absentIds: number[]
  isAutoFilled: boolean
}
