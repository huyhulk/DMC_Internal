import type { HRDailyGroupKey, HRTransferRecord } from '@/types'

const WORK_START_MINUTES = 7 * 60 + 30
const LUNCH_START_MINUTES = 11 * 60 + 30
const LUNCH_END_MINUTES = 12 * 60 + 30
const WORK_END_MINUTES = 16 * 60 + 30

function uniquePositiveIds(ids: number[]): number[] {
  return Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)))
}

export function calculateActualHeadcount(totalem: number, absentIds: number[], transferredIds: number[]): number {
  return Math.max(0, totalem - new Set([...uniquePositiveIds(absentIds), ...uniquePositiveIds(transferredIds)]).size)
}

export function getVietnamNow(date = new Date()): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour')),
    minute: Number(value('minute')),
  }
}

export function elapsedWorkHours(date: string, now = new Date()): number {
  const vietnamNow = getVietnamNow(now)
  if (date < vietnamNow.date) return 8
  if (date > vietnamNow.date) return 0
  const currentMinutes = Math.min(vietnamNow.hour * 60 + vietnamNow.minute, WORK_END_MINUTES)
  const elapsedMinutes = currentMinutes - WORK_START_MINUTES
  const lunchBreakMinutes = Math.max(0, Math.min(currentMinutes, LUNCH_END_MINUTES) - LUNCH_START_MINUTES)
  return Math.max(0, Math.round(((elapsedMinutes - lunchBreakMinutes) / 60) * 100) / 100)
}

function parseTimeToMinutes(value: string): number | null {
  const [hours, minutes] = value.trim().split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

export function calculateEffectiveWorkHours(startTime: string, endTime: string): number {
  const start = parseTimeToMinutes(startTime)
  const end = parseTimeToMinutes(endTime)
  if (start === null || end === null || end <= start) return 0

  const clampedStart = Math.max(start, WORK_START_MINUTES)
  const clampedEnd = Math.min(end, WORK_END_MINUTES)
  if (clampedEnd <= clampedStart) return 0

  const lunchOverlap = Math.max(0, Math.min(clampedEnd, LUNCH_END_MINUTES) - Math.max(clampedStart, LUNCH_START_MINUTES))
  return Math.round(((clampedEnd - clampedStart - lunchOverlap) / 60) * 100) / 100
}

export function calculateHRLaborHoursByFactory(rows: Array<{
  factory: HRDailyGroupKey
  totalem: number
  absentIds: number[]
  transferRecords: HRTransferRecord[]
}>, elapsedHours: number): Map<HRDailyGroupKey, {
  actualHeadcount: number
  availableLaborHours: number
  transferredOutHours: number
  transferredInHours: number
}> {
  const result = new Map<HRDailyGroupKey, {
    actualHeadcount: number
    availableLaborHours: number
    transferredOutHours: number
    transferredInHours: number
  }>()

  for (const row of rows) {
    const actualHeadcount = Math.max(0, row.totalem - uniquePositiveIds(row.absentIds).length)
    result.set(row.factory, {
      actualHeadcount,
      availableLaborHours: Math.round(actualHeadcount * elapsedHours * 100) / 100,
      transferredOutHours: 0,
      transferredInHours: 0,
    })
  }

  const absentByFactory = new Map(rows.map((row) => [row.factory, new Set(uniquePositiveIds(row.absentIds))]))

  for (const row of rows) {
    for (const record of row.transferRecords) {
      if (absentByFactory.get(row.factory)?.has(record.employeeId)) continue
      const hours = calculateEffectiveWorkHours(record.startTime, record.endTime)
      if (hours <= 0) continue

      const from = result.get(row.factory)
      if (from) {
        from.transferredOutHours = Math.round((from.transferredOutHours + hours) * 100) / 100
        from.availableLaborHours = Math.max(0, Math.round((from.availableLaborHours - hours) * 100) / 100)
      }

      const to = result.get(record.toFactory)
      if (to) {
        to.transferredInHours = Math.round((to.transferredInHours + hours) * 100) / 100
        to.availableLaborHours = Math.round((to.availableLaborHours + hours) * 100) / 100
      }
    }
  }

  return result
}

export function isProductionHRGroup(value: string): value is HRDailyGroupKey {
  return value === 'DMC1' || value === 'DMC3' || value === 'DMC4' || value === 'DMC5'
}
