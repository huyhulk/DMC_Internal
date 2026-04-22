export type UserRole = 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'USER'

export type TabId = 'production' | 'maintenance' | 'coordination' | 'report' | 'admin'

export const ROLE_TABS: Record<UserRole, TabId[]> = {
  ADMIN:      ['production', 'maintenance', 'coordination', 'report', 'admin'],
  MANAGER:    ['production', 'maintenance', 'coordination', 'report'],
  SUPERVISOR: ['production', 'coordination', 'report'],
  USER:       ['production'],
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN:      'Admin',
  MANAGER:    'Quản lý',
  SUPERVISOR: 'Tổ trưởng',
  USER:       'Công nhân',
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
}

export interface InitData {
  orders: Order[]
  norms: NormItem[]
  materials: MaterialItem[]
  submittedPcodes: string[]
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
  reason: 'submitted' | 'delivered' | ''
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
