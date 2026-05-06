import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parse, isValid, addDays } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns today's date as "YYYY-MM-DD" using the browser/server's LOCAL clock.
 * Use this instead of new Date().toISOString().split('T')[0] which always
 * returns the UTC date and causes off-by-one errors after midnight in UTC+7.
 */
export function getTodayLocal(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function getLocalDateAfterDays(days: number, date = new Date()): string {
  return format(addDays(date, days), 'yyyy-MM-dd')
}

export function getLocalCompactDate(date = new Date()): string {
  return format(date, 'yyyyMMdd')
}

export function getLocalDateTimeInputValue(date = new Date()): string {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

const LOCAL_TIMESTAMP_FORMATS = ["yyyy-MM-dd'T'HH:mm:ss", 'yyyy-MM-dd HH:mm:ss', "yyyy-MM-dd'T'HH:mm", 'yyyy-MM-dd HH:mm']

export function parseLocalDateTimeString(value: string): Date | null {
  const normalized = value.trim()
  if (!normalized) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const parsed = parse(normalized, 'yyyy-MM-dd', new Date())
    return isValid(parsed) ? parsed : null
  }

  const isLocalTimestamp = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/.test(normalized)
  if (isLocalTimestamp) {
    const withoutFraction = normalized.replace(/(\.\d{1,6})$/, '')
    for (const pattern of LOCAL_TIMESTAMP_FORMATS) {
      const parsed = parse(withoutFraction, pattern, new Date())
      if (isValid(parsed)) return parsed
    }
    return null
  }

  const parsed = new Date(normalized)
  return isValid(parsed) ? parsed : null
}

export function formatLocalDateTimeString(value: string | null, fmt = 'dd/MM/yyyy'): string {
  if (!value) return ''
  const parsed = parseLocalDateTimeString(value)
  return parsed ? format(parsed, fmt) : ''
}

export function normalizeLocalDateTimeString(value: string | null | undefined): string {
  if (!value) return ''
  const normalized = value.trim().replace(' ', 'T')
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?/)
  if (!match) return ''
  return `${match[1]}T${match[2]}:${match[3] ?? '00'}`
}

/**
 * Formats a date value to display string.
 * Handles both "YYYY-MM-DD" (DATE) and "YYYY-MM-DDTHH:mm:ss" (TIMESTAMP) inputs.
 * Parses date-only strings as local dates (avoids UTC midnight offset issues).
 */
export function formatDate(date: string | Date | null, fmt = 'dd/MM/yyyy'): string {
  if (!date) return ''
  try {
    const d = typeof date === 'string' ? parseLocalDateTimeString(date) : date
    return d && isValid(d) ? format(d, fmt) : ''
  } catch {
    return ''
  }
}

/**
 * Converts display date "DD/MM/YYYY" → "YYYY-MM-DD" for API/DB queries.
 */
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

/**
 * Converts "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss" API date → "DD/MM/YYYY" for display.
 */
export function apiDateToDisplay(apiDate: string): string {
  if (!apiDate) return ''
  return formatDate(apiDate, 'dd/MM/yyyy')
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

function parseTimeToMinutes(value: string): number | null {
  const [hours, minutes] = value.trim().split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function includesLunchBreak(start: string, end: string): boolean {
  const startMin = parseTimeToMinutes(start)
  const endMin = parseTimeToMinutes(end)
  if (startMin === null || endMin === null || endMin <= startMin) return false
  return startMin < 750 && endMin > 690
}

export function calcRealNorm(params: {
  nwforce: number
  workforce: number
  poutput: number
  starttime: string
  endtime: string
  lunchOvertime?: boolean
}): number {
  const { nwforce, workforce, poutput, starttime, endtime, lunchOvertime } = params
  const durationHours = calcDurationHours(starttime, endtime)
  const dtHours = !lunchOvertime && includesLunchBreak(starttime, endtime)
    ? Math.max(0, durationHours - 1)
    : durationHours
  if (nwforce === 0 || workforce === 0 || dtHours === 0) return 0
  const achievedRate = (poutput * nwforce) / (workforce * dtHours)
  return Math.round(achievedRate * 100) / 100
}

// Bidirectional mapping: data.WORKSHOP (long, read-only) ↔ internal DMC codes
// data.WORKSHOP is the source of truth and MUST NOT be modified.
// normalizeWorkshop  → converts long name to DMC code when READING from data table
// workshopToDataFilter → returns ilike prefix when QUERYING data table by DMC code
// data.WORKSHOP is source of truth — NEVER modify it.
// PX1 and PX2 both belong to DMC1 but keep distinct display labels.
const WORKSHOP_MAP: Array<{ prefix: string; code: string }> = [
  { prefix: 'Phân xưởng 1', code: 'DMC1' },
  { prefix: 'Phân xưởng 2', code: 'DMC1' },
  { prefix: 'Phân xưởng 3', code: 'DMC3' },
  { prefix: 'Phân xưởng 4', code: 'DMC4' },
  { prefix: 'Phân xưởng 5', code: 'DMC5' },
]

// Replaces "Phân xưởng N" prefix with DMC code, preserving the description suffix.
// "Phân xưởng 1 - Tôn & Phụ kiện"    → "DMC1 - Tôn & Phụ kiện"
// "Phân xưởng 2 - Tôn Pu & Phụ kiện" → "DMC1 - Tôn Pu & Phụ kiện"
// Already-coded values ("DMC1") pass through unchanged.
export function normalizeWorkshop(ws: string): string {
  if (!ws) return ws
  const trimmed = ws.trim()
  const lower = trimmed.toLowerCase()
  for (const { prefix, code } of WORKSHOP_MAP) {
    if (lower.startsWith(prefix.toLowerCase())) {
      const rest = trimmed.slice(prefix.length) // " - Tôn & Phụ kiện"
      return `${code}${rest}`
    }
  }
  return trimmed
}

// Extracts the DMC code from a workshop display label.
// "DMC1 - Tôn & Phụ kiện" → "DMC1"
// "DMC1"                   → "DMC1"
export function workshopCode(ws: string): string {
  return ws.split(/\s*[-—]\s*/)[0].trim().toUpperCase()
}

// Returns ilike patterns for querying data.WORKSHOP by DMC code.
// DMC1 → ['Phân xưởng 1%', 'Phân xưởng 2%']
export function workshopToDataFilters(code: string): string[] {
  return WORKSHOP_MAP
    .filter((m) => m.code === code.toUpperCase())
    .map((m) => `${m.prefix}%`)
}

// workspaces: parsed list from getUserWorkspaces().
// ADMIN/MANAGER → always allowed.
// Empty list → getUserWorkspaces returned [] for '' OR 'ALL' → allow all.
// Non-empty list → must match workshop code.
// Only ADMIN bypasses workspace restrictions. MANAGER/SUPERVISOR/USER are all
// workspace-scoped — their workspace field in profiles determines what they can access.
// Empty workspaces list (from '' or 'ALL' in DB) → full access (no filter).
export function isWorkspaceAllowed(
  workshop: string,
  role: string,
  workspaces: string[]
): boolean {
  if (role === 'ADMIN' || workspaces.length === 0) return true
  const code = workshopCode(workshop) // "DMC1 - Tôn & Phụ kiện" → "DMC1"
  return workspaces.some((w) => w.toUpperCase() === code)
}

export function getUserWorkspaces(workspace: string): string[] {
  if (!workspace || workspace.trim().toUpperCase() === 'ALL') return []
  return workspace.split(',').map((w) => w.trim().toUpperCase()).filter(Boolean)
}
