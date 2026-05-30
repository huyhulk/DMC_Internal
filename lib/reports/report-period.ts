import { addDays, endOfMonth, endOfYear, format, isValid, startOfMonth, startOfYear, subDays } from 'date-fns'
import type { GroupBy } from '@/lib/reports/report-types'

export interface ReportPeriodRange {
  from: string
  to: string
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(year, month - 1, day)

  if (!isValid(parsed)) return null
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null

  return parsed
}

function formatDateOnly(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function getFridayBasedWeekRange(base: Date): ReportPeriodRange {
  const daysSinceFriday = (base.getDay() + 2) % 7
  const start = subDays(base, daysSinceFriday)

  return {
    from: formatDateOnly(start),
    to: formatDateOnly(addDays(start, 6)),
  }
}

export function getReportPeriodRange(
  groupBy: GroupBy,
  baseDate: string,
  currentFrom: string,
  currentTo: string
): ReportPeriodRange {
  if (groupBy === 'day' || groupBy === 'hour') {
    return { from: currentFrom, to: currentTo }
  }

  const base = parseDateOnly(baseDate) ?? parseDateOnly(currentFrom) ?? new Date()

  if (groupBy === 'week') {
    return getFridayBasedWeekRange(base)
  }

  if (groupBy === 'month') {
    return {
      from: formatDateOnly(startOfMonth(base)),
      to: formatDateOnly(endOfMonth(base)),
    }
  }

  return {
    from: formatDateOnly(startOfYear(base)),
    to: formatDateOnly(endOfYear(base)),
  }
}
