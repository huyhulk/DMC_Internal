import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parse, isValid } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null, fmt = 'dd/MM/yyyy'): string {
  if (!date) return ''
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return isValid(d) ? format(d, fmt) : ''
  } catch {
    return ''
  }
}

export function parseDisplayDate(displayDate: string): string {
  if (!displayDate) return ''
  try {
    if (displayDate.includes('/')) {
      const parts = displayDate.split('/')
      if (parts.length === 3 && parts[0].length <= 2) {
        const d = parse(displayDate, 'dd/MM/yyyy', new Date())
        return isValid(d) ? format(d, 'yyyy-MM-dd') : displayDate
      }
    }
    return displayDate.substring(0, 10)
  } catch {
    return displayDate
  }
}

export function apiDateToDisplay(apiDate: string): string {
  if (!apiDate) return ''
  try {
    const d = new Date(apiDate)
    return isValid(d) ? format(d, 'dd/MM/yyyy') : apiDate
  } catch {
    return apiDate
  }
}

export function calcDurationHours(start: string, end: string): number {
  try {
    const [sh, sm] = start.trim().split(':').map(Number)
    const [eh, em] = end.trim().split(':').map(Number)
    const startMin = sh * 60 + sm
    const endMin = eh * 60 + em
    if (endMin <= startMin) return 0
    return (endMin - startMin) / 60
  } catch {
    return 0
  }
}

export function calcRealNorm(params: {
  nwforce: number
  workforce: number
  poutput: number
  starttime: string
  endtime: string
}): number {
  const { nwforce, workforce, poutput, starttime, endtime } = params
  const dtHours = calcDurationHours(starttime, endtime)
  if (nwforce === 0 || workforce === 0 || dtHours === 0) return 0
  const achievedRate = (poutput * nwforce) / (workforce * dtHours)
  return Math.round(achievedRate * 100) / 100
}

export function isWorkspaceAllowed(
  workshop: string,
  role: string,
  workspaces: string[]
): boolean {
  if (role === 'ADMIN' || role === 'MANAGER' || workspaces.length === 0) return true
  return workspaces.includes(workshop)
}

export function getUserWorkspaces(workspace: string): string[] {
  if (!workspace || workspace.toUpperCase() === 'ALL') return []
  return workspace.split(',').map((w) => w.trim()).filter(Boolean)
}
