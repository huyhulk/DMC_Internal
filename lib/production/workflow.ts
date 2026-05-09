import { normalizeProductionStatus } from '@/lib/production/status'
import type { OpenProductionOrder, Order } from '@/types'

export const PRODUCTION_DEADLINE_CUTOFF_TIME = '16:30:00'
const PRODUCTION_TIMEZONE_OFFSET = '+07:00'

export type OpenOrdersStatusFilter = 'ALL' | 'NOT_STARTED' | 'IN_PROGRESS' | 'INSPECTION'

export interface ProductionInputRow {
  pdate: string
  pcode: string
  products?: string
  poutput: number
  eoutput: number
  routput: number
  workforce: number
  starttime: string
  endtime: string
}

export interface ProductionCompletion {
  producedQuantity: number
  remainingQuantity: number
  completionPct: number
}

export interface ProductionCompletionTimeRow {
  pdate: string | null
  endtime: string | null
  poutput: number | null
}

export function getProductionOrderStatusRank(status: string): number {
  const normalized = normalizeProductionStatus(status)

  if (normalized.includes('chua sx') || normalized.includes('chua san xuat') || normalized === '') return 0
  if (normalized.includes('dang sx') || normalized.includes('dang san xuat')) return 1
  if (normalized.includes('dang kiem')) return 2
  if (
    normalized.includes('da sx') ||
    normalized.includes('da san xuat') ||
    normalized.includes('hoan thanh')
  ) return 3
  if (normalized.includes('da giao') || normalized.includes('giao hang')) return 4

  return 5
}

export function shouldAutoCloseProductionOrder(quantity: number, produced: number): boolean {
  if (!Number.isFinite(quantity) || quantity <= 0) return false
  if (!Number.isFinite(produced)) return false
  return produced >= quantity
}

export function calculateProductionCompletion(quantity: number, produced: number): ProductionCompletion {
  const safeQuantity = Math.max(0, quantity)
  const producedQuantity = Math.max(0, produced)
  return {
    producedQuantity,
    remainingQuantity: Math.max(0, safeQuantity - producedQuantity),
    completionPct: safeQuantity > 0
      ? Math.min(100, Math.round((producedQuantity / safeQuantity) * 1000) / 10)
      : producedQuantity > 0 ? 100 : 0,
  }
}

function buildProductionTimestamp(pdate: string | null, endtime: string | null): string | null {
  const endDate = buildProductionEndDate(pdate, endtime)
  if (!endDate) return null

  const year = endDate.getFullYear()
  const month = String(endDate.getMonth() + 1).padStart(2, '0')
  const day = String(endDate.getDate()).padStart(2, '0')
  const hours = String(endDate.getHours()).padStart(2, '0')
  const minutes = String(endDate.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:00`
}

function buildProductionEndDate(pdate: string | null, endtime: string | null): Date | null {
  if (!pdate || !endtime) return null

  const date = pdate.trim()
  const time = endtime.trim()
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!dateMatch) return null

  const timeMatch = time.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!timeMatch) return null

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const hours = Number(timeMatch[1])
  const minutes = Number(timeMatch[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  const parsed = new Date(year, month - 1, day, hours, minutes)
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hours ||
    parsed.getMinutes() !== minutes
  ) return null

  return parsed
}

export function buildProductionDeadlineCutoff(deadline: string | null | undefined): string | null {
  if (!deadline) return null

  const value = deadline.trim()
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!dateMatch) return null

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const parsed = new Date(year, month - 1, day)
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) return null

  return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${PRODUCTION_DEADLINE_CUTOFF_TIME}`
}

export function calculateProductionCompletionTime(quantity: number, rows: ProductionCompletionTimeRow[]): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null

  const timedRows = rows
    .map((row) => ({
      timestamp: buildProductionTimestamp(row.pdate, row.endtime),
      output: row.poutput ?? 0,
    }))
    .filter((row): row is { timestamp: string; output: number } => row.timestamp !== null && Number.isFinite(row.output) && row.output > 0)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  let produced = 0
  for (const row of timedRows) {
    produced += row.output
    if (produced >= quantity) return row.timestamp
  }

  return null
}

export function isOpenProductionOrder(
  order: Pick<Order, 'quantity' | 'status'>,
  produced: number,
  closed: boolean,
): boolean {
  if (closed) return false
  const quantity = Number(order.quantity) || 0
  return calculateProductionCompletion(quantity, produced).completionPct < 100
}

export function sortProductionOrdersForEntry(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    const rankDiff = getProductionOrderStatusRank(a.status) - getProductionOrderStatusRank(b.status)
    if (rankDiff !== 0) return rankDiff
    return a.pcode.localeCompare(b.pcode, 'vi', { numeric: true, sensitivity: 'base' })
  })
}

export function filterProductionOrdersByPcode(orders: Order[], query: string): Order[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return orders
  return orders.filter((order) => order.pcode.toLowerCase().includes(normalizedQuery))
}

function matchesOpenOrdersStatusFilter(order: OpenProductionOrder, statusFilter: OpenOrdersStatusFilter): boolean {
  if (statusFilter === 'ALL') return true
  if (statusFilter === 'INSPECTION') return normalizeProductionStatus(order.status).includes('dang kiem')

  const rank = getProductionOrderStatusRank(order.status)
  if (statusFilter === 'NOT_STARTED') return rank === 0
  if (statusFilter === 'IN_PROGRESS') return rank === 1
  return true
}

export function getOpenOrdersSearchState(
  orders: OpenProductionOrder[],
  statusFilter: OpenOrdersStatusFilter,
  query: string,
): { query: string; statusFilter: OpenOrdersStatusFilter } {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return { query: trimmedQuery, statusFilter }

  const exactMatch = orders.find((order) => order.pcode.toLowerCase() === trimmedQuery.toLowerCase())
  if (exactMatch && !matchesOpenOrdersStatusFilter(exactMatch, statusFilter)) {
    return { query: trimmedQuery, statusFilter: 'ALL' }
  }

  return { query: trimmedQuery, statusFilter }
}

function parseTimeToMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return hours * 60 + minutes
}

export function isProductionTimeRangeValid(starttime: string, endtime: string): boolean {
  const start = parseTimeToMinutes(starttime)
  const end = parseTimeToMinutes(endtime)
  if (start === null || end === null) return false
  return end > start
}

/**
 * Trả về epoch (ms) của (pdate, endtime) được neo theo timezone Asia/Ho_Chi_Minh (+07:00),
 * không phụ thuộc TZ của runtime. Dùng để so sánh với `Date.now()` an toàn trên server UTC.
 */
export function getProductionEndEpoch(pdate: string | null, endtime: string | null): number | null {
  if (!pdate || !endtime) return null

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(pdate.trim())
  if (!dateMatch) return null

  const timeMatch = endtime.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!timeMatch) return null

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const hours = Number(timeMatch[1])
  const minutes = Number(timeMatch[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const iso = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${hh}:${mm}:00${PRODUCTION_TIMEZONE_OFFSET}`
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

/**
 * Trả về true nếu deadline của lệnh đã qua hơn gracePeriodMs (mặc định 24h).
 * Deadline được neo theo Asia/Ho_Chi_Minh (+07:00) để tránh lỗi TZ trên server UTC.
 * Nếu không có deadline → không ẩn lệnh.
 */
export function isProductionOrderDeadlineExpired(
  deadlinedate: string | null | undefined,
  deadlinetime: string | null | undefined,
  now: Date,
  gracePeriodMs = 24 * 60 * 60 * 1000,
): boolean {
  if (!deadlinedate) return false
  const dateTrim = deadlinedate.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTrim)) return false

  // Nếu không có giờ deadline → coi là cuối ngày (23:59)
  const rawTime = (deadlinetime ?? '').trim()
  const timeMatch = (rawTime || '23:59').match(/^(\d{1,2}):(\d{2})/)
  if (!timeMatch) return false

  const hh = timeMatch[1].padStart(2, '0')
  const mm = timeMatch[2]
  const deadlineMs = Date.parse(`${dateTrim}T${hh}:${mm}:00+07:00`)
  if (!Number.isFinite(deadlineMs)) return false

  return now.getTime() - deadlineMs > gracePeriodMs
}

export function getProductionRowsValidationError(rows: ProductionInputRow[], now = new Date()): string | null {
  if (rows.length === 0) return 'Vui lòng chọn ít nhất 1 sản phẩm.'

  for (const [index, row] of rows.entries()) {
    const line = index + 1

    if (!row.pdate) return `Dòng ${line}: vui lòng chọn ngày sản xuất.`
    if (!row.pcode) return `Dòng ${line}: vui lòng chọn mã LSX.`
    if (!row.starttime || !row.endtime) {
      return `Dòng ${line}: vui lòng nhập giờ bắt đầu và kết thúc.`
    }
    if (!isProductionTimeRangeValid(row.starttime, row.endtime)) {
      return `Dòng ${line}: giờ kết thúc phải lớn hơn giờ bắt đầu.`
    }

    // So sánh theo Asia/Ho_Chi_Minh để tránh phụ thuộc TZ của runtime (Vercel chạy UTC).
    const productionEndMs = getProductionEndEpoch(row.pdate, row.endtime)
    if (productionEndMs !== null && productionEndMs > now.getTime()) {
      return `Dòng ${line}: giờ kết thúc không được lớn hơn thời gian hiện tại theo ngày sản xuất.`
    }

    const numericValues = [row.poutput, row.eoutput, row.routput, row.workforce]
    if (numericValues.some((value) => !Number.isFinite(value) || value < 0)) {
      return `Dòng ${line}: số lượng và nhân sự không được âm.`
    }
  }

  return null
}
