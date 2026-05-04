import { getUserWorkspaces } from '@/lib/utils'

const MAINTENANCE_WORKSHOPS = ['DMC1', 'DMC3', 'DMC4', 'DMC5'] as const

export type MaintenanceFrequency = 'weekly' | 'monthly' | 'quarterly'

export type DrawingMode = 'request' | 'deliver'

export function generateMaintenanceScheduleDates(
  startDate: string,
  endDate: string,
  frequency: MaintenanceFrequency
): string[] {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return []

  const dates: string[] = []
  const cur = new Date(start)

  while (cur <= end) {
    dates.push(formatDateKey(cur))
    if (frequency === 'weekly') cur.setDate(cur.getDate() + 7)
    else if (frequency === 'monthly') cur.setMonth(cur.getMonth() + 1)
    else cur.setMonth(cur.getMonth() + 3)
  }

  return dates
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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
