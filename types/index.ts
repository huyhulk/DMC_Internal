export type UserRole = 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'USER'

export type TabId = 'production' | 'maintenance' | 'coordination' | 'report'

export const ROLE_TABS: Record<UserRole, TabId[]> = {
  ADMIN:      ['production', 'maintenance', 'coordination', 'report'],
  MANAGER:    ['production', 'maintenance', 'coordination', 'report'],
  SUPERVISOR: ['production', 'maintenance', 'report'],
  USER:       ['production'],
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
  deadlinetime: string
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
