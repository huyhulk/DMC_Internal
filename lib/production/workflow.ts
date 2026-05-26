import { normalizeProductionStatus } from '@/lib/production/status'
import { normalizeWorkshop, workshopCode } from '@/lib/utils'
import type { NormItem, OpenProductionOrder, Order } from '@/types'

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

export interface DeadlineProductionPlanRow {
  order: OpenProductionOrder
  norm: NormItem | null
  estimatedHours: number | null
  missingNorm: boolean
}

export interface DeadlineProductionPlanSummary {
  totalOrders: number
  notStartedOrders: number
  inProgressOrders: number
  missingNormOrders: number
  totalEstimatedHours: number
}

const PRODUCTION_APP_TIME_ZONE = 'Asia/Ho_Chi_Minh'

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

export function getProductionEntryWorkshop(workshop: string, description: string | null | undefined): string {
  const normalizedWorkshop = normalizeWorkshop(workshop)
  const baseCode = workshopCode(normalizedWorkshop)
  if (baseCode !== 'DMC1') return normalizedWorkshop

  const normalizedDescription = (description ?? '').toLocaleLowerCase('vi')
  if (normalizedDescription.includes('pu')) return 'DMC1-PU'
  if (normalizedDescription.includes('phụ kiện') || normalizedDescription.includes('pk')) return 'DMC1-PK'
  return 'DMC1-CT'
}

function normalizeDeadlinePlanText(value: string): string {
  return normalizeProductionStatus(value).replace(/[^a-z0-9]+/g, ' ').trim()
}

function getDeadlinePlanWords(value: string): Set<string> {
  return new Set(normalizeDeadlinePlanText(value).split(' ').filter(Boolean))
}

function getDeadlinePlanBaseWorkshop(workshop: string): string {
  const normalized = normalizeWorkshop(workshop).trim().toUpperCase()
  const match = /DMC\s*([1345])/.exec(normalized)
  return match ? `DMC${match[1]}` : normalized.split(/\s*[-—]\s*/)[0]
}

function isDeadlinePlanWorkshopMatch(orderWorkshop: string, normWorkshop: string): boolean {
  const orderCode = getDeadlinePlanBaseWorkshop(orderWorkshop)
  const normCode = getDeadlinePlanBaseWorkshop(normWorkshop)
  if (!orderCode || !normCode) return false
  return orderCode === normCode
}

function deadlinePlanHasAnyWord(words: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => words.has(candidate))
}

function deadlinePlanHasAnyText(value: string, candidates: string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate))
}

function getDeadlinePlanNormFamily(description: string): string | null {
  const value = normalizeDeadlinePlanText(description)
  const words = getDeadlinePlanWords(description)

  if (!value) return null
  if (deadlinePlanHasAnyWord(words, ['louver'])) return 'louver'
  if (deadlinePlanHasAnyText(value, ['kliplock', 'seamlock'])) return 'ton kliplock seamlock'
  if (deadlinePlanHasAnyWord(words, ['deck'])) return 'ton san deck'
  if (deadlinePlanHasAnyWord(words, ['vom'])) return 'ton nhan vom'
  if (deadlinePlanHasAnyText(value, ['roc', 'chiet', 'ton cuon'])) return 'roc chiet ton cuon'
  if (deadlinePlanHasAnyWord(words, ['pu'])) return 'ton pu'
  if (deadlinePlanHasAnyText(value, ['panel bong']) || deadlinePlanHasAnyWord(words, ['bong'])) return 'panel bong'
  if (deadlinePlanHasAnyText(value, ['vach ngoai', 'tuong ngoai'])) return 'panel xop vach ngoai'
  if (deadlinePlanHasAnyText(value, ['vach trong', 'pnv']) || deadlinePlanHasAnyWord(words, ['pn'])) {
    return deadlinePlanHasAnyWord(words, ['1150']) ? 'panel xop vach trong 1150' : 'panel xop vach trong 1000'
  }
  if (deadlinePlanHasAnyWord(words, ['xg']) || deadlinePlanHasAnyText(value, ['xa go'])) return 'xa go'
  if (deadlinePlanHasAnyWord(words, ['tcs']) || /\b\d{1,2}s\b/.test(value)) return 'ton can 5 13 song'
  if (deadlinePlanHasAnyText(value, ['pk inox', 'pk kem', 'pkk']) || deadlinePlanHasAnyWord(words, ['inox', 'kem'])) return 'phu kien inox kem'
  if (deadlinePlanHasAnyWord(words, ['pk']) || deadlinePlanHasAnyText(value, ['phu kien'])) return 'phu kien ton trung binh'

  return null
}

function getDeadlinePlanNormFamilyScore(descriptionFamily: string | null, normProduct: string): number {
  if (!descriptionFamily) return 0

  const product = normalizeDeadlinePlanText(normProduct)
  if (!product) return 0
  if (product === descriptionFamily) return 9
  if (product.includes(descriptionFamily)) return 8
  if (descriptionFamily.includes(product)) return 7

  if (descriptionFamily === 'xa go' && product.includes('xa go')) return 7
  if (descriptionFamily === 'ton can 5 13 song' && product.includes('ton can') && product.includes('song')) return 7
  if (descriptionFamily === 'phu kien ton trung binh' && product.includes('phu kien ton trung binh')) return 9
  if (descriptionFamily === 'phu kien inox kem' && product.includes('phu kien inox kem')) return 9

  return 0
}

function getDeadlinePlanNormMatchScore(order: OpenProductionOrder, norm: NormItem): number {
  if (!isDeadlinePlanWorkshopMatch(order.workshop, norm.workshop)) return 0

  const description = normalizeDeadlinePlanText(order.description)
  const product = normalizeDeadlinePlanText(norm.products)
  if (!description || !product) return 0

  const familyScore = getDeadlinePlanNormFamilyScore(getDeadlinePlanNormFamily(order.description), norm.products)
  if (familyScore > 0) return familyScore

  if (description === product) return 4
  if (description.includes(product)) return 3
  if (product.includes(description)) return 2

  const descriptionWords = new Set(description.split(' ').filter((word) => word.length > 1))
  const sharedWords = product.split(' ').filter((word) => word.length > 1 && descriptionWords.has(word))
  return sharedWords.length >= 2 ? 1 : 0
}

function findDeadlineProductionNorm(order: OpenProductionOrder, norms: NormItem[]): NormItem | null {
  const matches = norms
    .map((norm) => ({ norm, score: getDeadlinePlanNormMatchScore(order, norm) }))
    .filter((match) => match.score > 0 && Number.isFinite(match.norm.norm) && match.norm.norm > 0)
    .sort((a, b) => {
      const scoreDiff = b.score - a.score
      if (scoreDiff !== 0) return scoreDiff
      return b.norm.products.length - a.norm.products.length
    })

  const topScore = matches[0]?.score ?? 0
  const topMatches = matches.filter((match) => match.score === topScore)
  if (topMatches.length === 0) return null
  if (topMatches.length === 1) return topMatches[0].norm

  const averageNorm = topMatches.reduce((sum, match) => sum + match.norm.norm, 0) / topMatches.length
  return {
    ...topMatches[0].norm,
    norm: Math.round(averageNorm * 100) / 100,
  }
}

function sortDeadlineProductionPlanRows(rows: DeadlineProductionPlanRow[]): DeadlineProductionPlanRow[] {
  return [...rows].sort((a, b) => {
    const deadlineA = `${a.order.deadlinedate || '9999-99-99'}T${a.order.deadlinetime || '99:99'}`
    const deadlineB = `${b.order.deadlinedate || '9999-99-99'}T${b.order.deadlinetime || '99:99'}`
    const deadlineDiff = deadlineA.localeCompare(deadlineB)
    if (deadlineDiff !== 0) return deadlineDiff
    return a.order.pcode.localeCompare(b.order.pcode, 'vi', { numeric: true, sensitivity: 'base' })
  })
}

export function buildDeadlineProductionPlan(
  orders: OpenProductionOrder[],
  norms: NormItem[],
): { rows: DeadlineProductionPlanRow[]; summary: DeadlineProductionPlanSummary } {
  const eligibleOrders = orders.filter((order) => {
    const rank = getProductionOrderStatusRank(order.status)
    return (rank === 0 || rank === 1) && order.remainingQuantity > 0
  })

  const rows = sortDeadlineProductionPlanRows(eligibleOrders.map((order) => {
    const norm = findDeadlineProductionNorm(order, norms)
    const estimatedHours = norm
      ? Math.round((order.remainingQuantity / norm.norm) * 100) / 100
      : null

    return {
      order,
      norm,
      estimatedHours,
      missingNorm: norm === null,
    }
  }))

  const summary = rows.reduce<DeadlineProductionPlanSummary>((acc, row) => {
    const rank = getProductionOrderStatusRank(row.order.status)
    return {
      totalOrders: acc.totalOrders + 1,
      notStartedOrders: acc.notStartedOrders + (rank === 0 ? 1 : 0),
      inProgressOrders: acc.inProgressOrders + (rank === 1 ? 1 : 0),
      missingNormOrders: acc.missingNormOrders + (row.missingNorm ? 1 : 0),
      totalEstimatedHours: acc.totalEstimatedHours + (row.estimatedHours ?? 0),
    }
  }, {
    totalOrders: 0,
    notStartedOrders: 0,
    inProgressOrders: 0,
    missingNormOrders: 0,
    totalEstimatedHours: 0,
  })

  return {
    rows,
    summary: {
      ...summary,
      totalEstimatedHours: Math.round(summary.totalEstimatedHours * 100) / 100,
    },
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
  gracePeriodMs = 36 * 60 * 60 * 1000,
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

export function isProductionOrderCreatedOnOrAfter(
  initialdate: string | null | undefined,
  baselineDate: string,
): boolean {
  if (!initialdate) return false
  const initialDateTrim = initialdate.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(initialDateTrim)) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baselineDate)) return false
  return initialDateTrim >= baselineDate
}

export function shouldKeepNotStartedOrderVisible(input: {
  initialdate: string | null | undefined
  baselineDate: string
}): boolean {
  return isProductionOrderCreatedOnOrAfter(input.initialdate, input.baselineDate)
}

function getDatePartsInTimeZone(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`Unable to derive date parts for timezone ${timeZone}`)
  }

  return { year, month, day }
}

function formatDateParts(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function shiftDateString(dateString: string, days: number): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString)
  if (!dateMatch) throw new Error(`Invalid date string: ${dateString}`)

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const shifted = new Date(Date.UTC(year, month - 1, day + days))

  return formatDateParts({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  })
}

function getPreviousMonthStart(dateString: string): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString)
  if (!dateMatch) throw new Error(`Invalid date string: ${dateString}`)

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const previousMonthStart = new Date(Date.UTC(year, month - 2, 1))

  return formatDateParts({
    year: previousMonthStart.getUTCFullYear(),
    month: previousMonthStart.getUTCMonth() + 1,
    day: previousMonthStart.getUTCDate(),
  })
}

export function getOpenProductionOrdersQueryWindow(now = new Date()): {
  today: string
  fromDate: string
  deadlineFrom: string
} {
  const today = formatDateParts(getDatePartsInTimeZone(now, PRODUCTION_APP_TIME_ZONE))

  return {
    today,
    fromDate: getPreviousMonthStart(today),
    deadlineFrom: shiftDateString(today, -2),
  }
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
