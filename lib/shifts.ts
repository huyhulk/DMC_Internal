import type { ShiftSlot, GroupBy } from '@/lib/reports/report-types'

/**
 * Phân loại ca theo starttime "HH:mm" hoặc "HH:mm:ss".
 * Trả về 'khac' cho mọi input không hợp lệ (null, '', 'abc').
 */
export function classifyShift(starttime: string | null | undefined): ShiftSlot {
  if (!starttime) return 'khac'
  const parts = starttime.trim().split(':')
  const h = parseInt(parts[0] ?? '', 10)
  const m = parseInt(parts[1] ?? '', 10)
  if (isNaN(h) || isNaN(m)) return 'khac'
  const t = h * 60 + m
  if (t >= 450 && t < 570) return 'ca_sang_1'   // 07:30–09:30
  if (t >= 570 && t < 690) return 'ca_sang_2'   // 09:30–11:30
  if (t >= 750 && t < 870) return 'ca_chieu_1'  // 12:30–14:30
  if (t >= 870 && t < 990)  return 'ca_chieu_2'  // 14:30–16:30
  if (t >= 990 && t < 1320) return 'ca_tang_ca'  // 16:30–22:00
  return 'khac'
}

/**
 * ISO 8601 week key — Thứ 2 là đầu tuần, Thứ 5 quyết định năm ISO.
 * "2025-12-29" (Thứ 2) → "2026-W01"
 * "2026-04-21" (Thứ 3) → "2026-W17"
 */
export function toIsoWeekKey(pdate: string): string {
  const d = new Date(pdate + 'T00:00:00Z')
  // Dịch đến Thứ 5 của tuần hiện tại (Thứ 5 quyết định năm ISO)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/**
 * Chuyển pdate thành period key theo groupBy.
 * GroupBy không còn bao gồm 'shift' — dùng biểu đồ bySlot riêng cho ca.
 */
export function toPeriodKey(pdate: string, groupBy: GroupBy): string {
  if (!pdate) return '?'
  switch (groupBy) {
    case 'week':  return toIsoWeekKey(pdate)
    case 'month': return pdate.substring(0, 7)
    case 'year':  return pdate.substring(0, 4)
    default:      return pdate.substring(0, 10) // 'day'
  }
}
