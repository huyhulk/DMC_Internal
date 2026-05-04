import type { HRDailyGroupKey } from '@/types'

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
  const startMinutes = 7 * 60 + 30
  const lunchStartMinutes = 11 * 60 + 30
  const lunchEndMinutes = 12 * 60 + 30
  const endMinutes = 16 * 60 + 30
  const currentMinutes = Math.min(vietnamNow.hour * 60 + vietnamNow.minute, endMinutes)
  const elapsedMinutes = currentMinutes - startMinutes
  const lunchBreakMinutes = Math.max(0, Math.min(currentMinutes, lunchEndMinutes) - lunchStartMinutes)
  return Math.max(0, Math.round(((elapsedMinutes - lunchBreakMinutes) / 60) * 100) / 100)
}

export function isProductionHRGroup(value: string): value is HRDailyGroupKey {
  return value === 'DMC1' || value === 'DMC3' || value === 'DMC4' || value === 'DMC5'
}
