import { getUserWorkspaces } from '@/lib/utils'

const MAINTENANCE_WORKSHOPS = ['DMC1', 'DMC3', 'DMC4', 'DMC5'] as const

export type DrawingMode = 'request' | 'deliver'

export function getDrawingListFilter(
  mode: DrawingMode,
  selectedStatus: string
): { status?: string; openOnly?: boolean } {
  if (mode === 'deliver') return { openOnly: true }
  if (selectedStatus && selectedStatus !== 'ALL') return { status: selectedStatus }
  return {}
}

export function getMaintenanceWorkshopOptions(
  role: string,
  workspace: string | null | undefined,
  includeAll: boolean
): string[] {
  const unrestricted = role === 'ADMIN' || role === 'MANAGER' || workspace?.trim().toUpperCase() === 'ALL'
  const options = unrestricted
    ? [...MAINTENANCE_WORKSHOPS]
    : getUserWorkspaces(workspace ?? '')
        .filter((ws) => (MAINTENANCE_WORKSHOPS as readonly string[]).includes(ws))

  const uniqueOptions = Array.from(new Set(options))
  return includeAll && unrestricted ? ['ALL', ...uniqueOptions] : uniqueOptions
}

export function isBreakdownEndAfterStart(start: string, end: string): boolean {
  const startDate = new Date(start)
  const endDate = new Date(end)
  return !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate > startDate
}
