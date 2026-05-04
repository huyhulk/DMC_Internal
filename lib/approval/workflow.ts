import type { UserRole } from '@/types'
import {
  getAdministrationTabs as getDashboardAdministrationTabs,
  type AdministrationTabKey,
} from '@/lib/navigation/dashboard'

export type { AdministrationTabKey }
export type MaintenanceMode = 'plan' | 'execute'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'ALL'

export const FACTORY_WORKSPACES = ['DMC1', 'DMC3', 'DMC4', 'DMC5'] as const
export const DEPARTMENT_WORKSPACES = [
  'PKT-SX',
  'Phòng điều phối',
  'Phòng HC-NS',
  'Phòng Kinh Doanh',
] as const

export const WORKSPACE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả' },
  ...FACTORY_WORKSPACES.map((value) => ({ value, label: value })),
  ...DEPARTMENT_WORKSPACES.map((value) => ({ value, label: value })),
] as const

const NORMALIZED_WORKSPACES = new Map<string, string>([
  ['ALL', 'ALL'],
  ['DMC1', 'DMC1'],
  ['DM1', 'DMC1'],
  ['DM2', 'DMC1'],
  ['DMC3', 'DMC3'],
  ['DM3', 'DMC3'],
  ['DMC4', 'DMC4'],
  ['DM4', 'DMC4'],
  ['DMC5', 'DMC5'],
  ['DM5', 'DMC5'],
  ['PKT-SX', 'PKT-SX'],
  ['PKT_SX', 'PKT-SX'],
  ['PKTSX', 'PKT-SX'],
  ['DIEU-PHOI', 'DIEU-PHOI'],
  ['DIEU PHOI', 'DIEU-PHOI'],
  ['DIEU_PHOI', 'DIEU-PHOI'],
  ['ĐIỀU PHỐI', 'DIEU-PHOI'],
  ['PHÒNG ĐIỀU PHỐI', 'DIEU-PHOI'],
  ['PHONG DIEU PHOI', 'DIEU-PHOI'],
  ['PHÒNG HC-NS', 'Phòng HC-NS'],
  ['PHONG HC-NS', 'Phòng HC-NS'],
  ['PHONG HCNS', 'Phòng HC-NS'],
  ['PHÒNG KINH DOANH', 'Phòng Kinh Doanh'],
  ['PHONG KINH DOANH', 'Phòng Kinh Doanh'],
])

export function canApproveRequests(role: UserRole | string): boolean {
  return role === 'ADMIN' || role === 'MANAGER'
}

export function canApproveWorkspace(
  role: UserRole | string,
  workspace: string | null | undefined,
  targetWorkspace: string
): boolean {
  return canApproveRequests(role) && canAccessWorkspace(role, workspace, targetWorkspace)
}

export function getWorkspaceScopedFilter(
  role: UserRole | string,
  workspace: string | null | undefined
): { unrestricted: boolean; workspaces: string[] } {
  const tokens = getScopedWorkspaceTokens(workspace)
  if (role === 'ADMIN' || tokens.includes('ALL')) return { unrestricted: true, workspaces: [] }
  return { unrestricted: false, workspaces: tokens }
}

export function getAdministrationTabs(): Array<{ key: AdministrationTabKey; label: string }> {
  return getDashboardAdministrationTabs().map(({ key, label }) => ({ key, label }))
}

export function normalizeWorkspaceToken(value: string): string {
  const key = value.trim().replace(/\s+/g, ' ').toUpperCase()
  return NORMALIZED_WORKSPACES.get(key) ?? value.trim()
}

export function normalizeWorkspaceList(value: string): string {
  const tokens = value
    .split(',')
    .map(normalizeWorkspaceToken)
    .filter(Boolean)

  if (tokens.some((token) => token === 'ALL')) return 'ALL'
  return Array.from(new Set(tokens)).join(',')
}

function workspaceComparable(value: string): string {
  const normalized = normalizeWorkspaceToken(value)
  const factoryMatch = normalized.match(/^(DMC\d+)/i)
  if (factoryMatch) return factoryMatch[1].toUpperCase()
  return normalized.toUpperCase()
}

export function getScopedWorkspaceTokens(value: string | null | undefined): string[] {
  const normalized = normalizeWorkspaceList(value ?? '')
  if (!normalized) return []
  return normalized.split(',').map((token) => token.trim()).filter(Boolean)
}

export function canAccessWorkspace(
  role: UserRole | string,
  workspace: string | null | undefined,
  targetWorkspace: string
): boolean {
  if (role === 'ADMIN') return true

  const tokens = getScopedWorkspaceTokens(workspace)
  if (tokens.includes('ALL')) return true
  if (tokens.length === 0) return false

  const target = workspaceComparable(targetWorkspace)
  return tokens.some((token) => workspaceComparable(token) === target)
}

export function isKnownWorkspaceToken(value: string): boolean {
  const normalized = normalizeWorkspaceToken(value)
  return WORKSPACE_OPTIONS.some((option) => option.value === normalized)
}

export function summarizeOvertimeParticipants(
  participants: Array<{ employee_name: string; hours: number }>
): { total_employees: number; total_hours: number } {
  const validParticipants = participants.filter((participant) => participant.employee_name.trim() && participant.hours > 0)
  return {
    total_employees: validParticipants.length,
    total_hours: validParticipants.reduce((sum, participant) => sum + participant.hours, 0),
  }
}

export function getMaintenanceScheduleFilter(
  mode: MaintenanceMode
): { completion_status?: 'pending' | 'completed'; approval_status: ApprovalStatus } {
  if (mode === 'execute') {
    return { completion_status: 'pending', approval_status: 'approved' }
  }
  return { approval_status: 'ALL' }
}
