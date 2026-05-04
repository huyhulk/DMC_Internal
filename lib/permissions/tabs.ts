import type { TabId, UserRole } from '@/types'

export type PermissionLevel = 'invisible' | 'view' | 'edit'

export type PermissionKey =
  | TabId
  | 'production.input-history'
  | 'maintenance.breakdowns'
  | 'maintenance.schedule'
  | 'maintenance.drawings'
  | 'maintenance.surveys'
  | 'maintenance.machines'
  | 'coordination.delivery'
  | 'coordination.findings5s'
  | 'coordination.reports'
  | 'administration.overtime'
  | 'administration.hr'
  | 'administration.findings5s'
  | 'administration.iso'
  | 'admin.users'
  | 'admin.kpi-settings'

export type RolePermissionMatrix = Record<PermissionKey, PermissionLevel>
export type PermissionMatrixByRole = Record<UserRole, RolePermissionMatrix>

export const PERMISSION_LEVELS: PermissionLevel[] = ['invisible', 'view', 'edit']

export const TOP_LEVEL_PERMISSION_KEYS: TabId[] = [
  'production',
  'maintenance',
  'coordination',
  'administration',
  'report',
  'admin',
]

export const PERMISSION_KEYS: PermissionKey[] = [
  ...TOP_LEVEL_PERMISSION_KEYS,
  'production.input-history',
  'maintenance.breakdowns',
  'maintenance.schedule',
  'maintenance.drawings',
  'maintenance.surveys',
  'maintenance.machines',
  'coordination.delivery',
  'coordination.findings5s',
  'coordination.reports',
  'administration.overtime',
  'administration.hr',
  'administration.findings5s',
  'administration.iso',
  'admin.users',
  'admin.kpi-settings',
]

export const PERMISSION_LABELS: Record<PermissionKey, { label: string; group: string }> = {
  production: { label: 'Sản Xuất', group: 'Tab chính' },
  'production.input-history': { label: 'Lịch sử nhập', group: 'Sản Xuất' },
  maintenance: { label: 'Bảo Trì', group: 'Tab chính' },
  coordination: { label: 'Điều Phối', group: 'Tab chính' },
  administration: { label: 'Hành Chính NS', group: 'Tab chính' },
  report: { label: 'Báo Cáo', group: 'Tab chính' },
  admin: { label: 'Hệ Thống', group: 'Tab chính' },
  'maintenance.breakdowns': { label: 'Sự Cố Máy', group: 'Bảo Trì' },
  'maintenance.schedule': { label: 'Lịch Bảo Trì', group: 'Bảo Trì' },
  'maintenance.drawings': { label: 'Bản Vẽ KT', group: 'Bảo Trì' },
  'maintenance.surveys': { label: 'Khảo Sát', group: 'Bảo Trì' },
  'maintenance.machines': { label: 'Thiết Bị', group: 'Bảo Trì' },
  'coordination.delivery': { label: 'Giao Hàng', group: 'Điều Phối' },
  'coordination.findings5s': { label: '5S', group: 'Điều Phối' },
  'coordination.reports': { label: 'Báo Cáo TK', group: 'Điều Phối' },
  'administration.overtime': { label: 'Tăng ca', group: 'Hành Chính NS' },
  'administration.hr': { label: 'Nhân sự', group: 'Hành Chính NS' },
  'administration.findings5s': { label: '5S', group: 'Hành Chính NS' },
  'administration.iso': { label: 'Quy trình ISO', group: 'Hành Chính NS' },
  'admin.users': { label: 'Quản lý người dùng', group: 'Hệ Thống' },
  'admin.kpi-settings': { label: 'Cài đặt KPI', group: 'Hệ Thống' },
}

const invisibleMatrix = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, 'invisible'])) as RolePermissionMatrix

function matrix(overrides: Partial<RolePermissionMatrix>): RolePermissionMatrix {
  return { ...invisibleMatrix, ...overrides }
}

export const DEFAULT_ROLE_PERMISSIONS: PermissionMatrixByRole = {
  ADMIN: matrix(Object.fromEntries(PERMISSION_KEYS.map((key) => [key, 'edit'])) as RolePermissionMatrix),
  MANAGER: matrix({
    production: 'edit',
    'production.input-history': 'edit',
    maintenance: 'edit',
    coordination: 'edit',
    administration: 'edit',
    report: 'view',
    'maintenance.breakdowns': 'edit',
    'maintenance.schedule': 'edit',
    'maintenance.drawings': 'edit',
    'maintenance.surveys': 'edit',
    'maintenance.machines': 'edit',
    'coordination.delivery': 'edit',
    'coordination.findings5s': 'edit',
    'coordination.reports': 'edit',
    'administration.overtime': 'edit',
    'administration.hr': 'edit',
    'administration.findings5s': 'edit',
    'administration.iso': 'edit',
  }),
  WORKSHOP_MANAGER: matrix({
    production: 'edit',
    'production.input-history': 'edit',
    maintenance: 'view',
    coordination: 'view',
    administration: 'view',
    report: 'view',
    'maintenance.breakdowns': 'view',
    'maintenance.schedule': 'view',
    'maintenance.drawings': 'view',
    'maintenance.surveys': 'view',
    'maintenance.machines': 'view',
    'coordination.delivery': 'view',
    'coordination.findings5s': 'view',
    'coordination.reports': 'view',
    'administration.overtime': 'edit',
    'administration.hr': 'view',
    'administration.findings5s': 'edit',
    'administration.iso': 'view',
  }),
  TEAM_LEADER: matrix({
    production: 'edit',
    'production.input-history': 'edit',
    coordination: 'view',
    administration: 'edit',
    report: 'view',
    'coordination.delivery': 'view',
    'coordination.findings5s': 'edit',
    'coordination.reports': 'view',
    'administration.overtime': 'edit',
    'administration.hr': 'view',
    'administration.findings5s': 'edit',
    'administration.iso': 'view',
  }),
  MAINTENANCE: matrix({
    maintenance: 'edit',
    report: 'view',
    'maintenance.breakdowns': 'edit',
    'maintenance.schedule': 'edit',
    'maintenance.drawings': 'edit',
    'maintenance.surveys': 'edit',
    'maintenance.machines': 'edit',
  }),
  COORDINATION: matrix({
    coordination: 'edit',
    report: 'view',
    'coordination.delivery': 'edit',
    'coordination.findings5s': 'edit',
    'coordination.reports': 'edit',
  }),
  SALES: matrix({
    coordination: 'view',
    report: 'view',
    'coordination.delivery': 'view',
    'coordination.reports': 'view',
  }),
  HR: matrix({
    administration: 'edit',
    report: 'view',
    'administration.overtime': 'edit',
    'administration.hr': 'edit',
    'administration.findings5s': 'edit',
    'administration.iso': 'edit',
  }),
}

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as string[]).includes(value)
}

export function normalizePermissionLevel(role: UserRole, key: PermissionKey, level: PermissionLevel): PermissionLevel {
  if (role !== 'ADMIN' && (key === 'admin' || key.startsWith('admin.'))) return 'invisible'
  return level
}

export function canViewLevel(level: PermissionLevel): boolean {
  return level === 'view' || level === 'edit'
}

export function canEditLevel(level: PermissionLevel): boolean {
  return level === 'edit'
}
