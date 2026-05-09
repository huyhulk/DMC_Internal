import type { ProductionCompletion } from '@/lib/production/workflow'
import type { ProductionOrderInternalStatus, ProductionOrderEffectiveStatus } from '@/types'

const COMPLETED_ORDER_DEADLINE_VISIBILITY_WINDOW_MS = 72 * 60 * 60 * 1000

export const PRODUCTION_ORDER_INTERNAL_STATUSES: ProductionOrderInternalStatus[] = [
  'Chưa SX',
  'Đang SX',
  'Đang kiểm',
  'Đã SX',
]

export function normalizeProductionStatus(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
}

export function isSourceCompletedStatus(status: string): boolean {
  const normalized = normalizeProductionStatus(status)
  return normalized.includes('da sx') || normalized.includes('da san xuat')
}

export function isSourceDeliveredStatus(status: string): boolean {
  const normalized = normalizeProductionStatus(status)
  return normalized.includes('da giao') || normalized.includes('giao hang')
}

export function isProtectedSourceProductionStatus(status: string): boolean {
  return isSourceCompletedStatus(status) || isSourceDeliveredStatus(status)
}

export function normalizeProductionOrderInternalStatus(value: string | null | undefined): ProductionOrderInternalStatus | null {
  const normalized = normalizeProductionStatus(value ?? '')
  if (normalized.includes('dang kiem')) return 'Đang kiểm'
  if (normalized.includes('dang sx') || normalized.includes('dang san xuat')) return 'Đang SX'
  if (normalized.includes('da sx') || normalized.includes('da san xuat') || normalized.includes('hoan thanh')) return 'Đã SX'
  if (normalized.includes('chua sx') || normalized.includes('chua san xuat') || normalized === '') return 'Chưa SX'
  return null
}

export function isProductionOrderInternalStatus(value: string | null | undefined): value is ProductionOrderInternalStatus {
  return normalizeProductionOrderInternalStatus(value) !== null
}

export function resolveProductionOrderStatus(input: {
  sourceStatus: string
  quantity: number
  produced: number
  closed: boolean
  internalStatus?: string | null
}): ProductionOrderEffectiveStatus {
  const sourceStatus = input.sourceStatus.trim()
  if (isProtectedSourceProductionStatus(sourceStatus)) return sourceStatus

  const quantity = Math.max(0, input.quantity)
  const produced = Math.max(0, input.produced)
  if (input.closed || (quantity > 0 && produced >= quantity)) return 'Đã SX'
  if (produced > 0) return 'Đang SX'
  // Prefer an explicit internalStatus (e.g. 'Đang kiểm' stored in production_order_status).
  const fromInternal = normalizeProductionOrderInternalStatus(input.internalStatus)
  if (fromInternal !== null && fromInternal !== 'Chưa SX') return fromInternal
  // Inspection status from the data source (Google Sheet) should surface even when the
  // system has not yet recorded any production. Other source statuses (e.g. 'Đang sản xuất')
  // are not inherited when produced = 0 — trust actual production data instead.
  if (normalizeProductionOrderInternalStatus(input.sourceStatus) === 'Đang kiểm') return 'Đang kiểm'
  return fromInternal ?? 'Chưa SX'
}

export function resolveProductionOrderInternalStatus(input: {
  quantity: number
  produced: number
  closed: boolean
}): ProductionOrderInternalStatus {
  return resolveProductionOrderStatus({
    sourceStatus: '',
    quantity: input.quantity,
    produced: input.produced,
    closed: input.closed,
  }) as ProductionOrderInternalStatus
}

export function isEffectiveCompletedProductionStatus(status: string): boolean {
  return isSourceCompletedStatus(status)
}

export function isEffectiveDeliveredProductionStatus(status: string): boolean {
  return isSourceDeliveredStatus(status)
}

export function isEffectiveClosedProductionStatus(status: string): boolean {
  return isEffectiveCompletedProductionStatus(status) || isEffectiveDeliveredProductionStatus(status)
}

function getProductionDeadlineEpoch(deadlinedate: string | null | undefined, deadlinetime: string | null | undefined): number | null {
  if (!deadlinedate) return null
  const dateTrim = deadlinedate.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTrim)) return null

  const rawTime = (deadlinetime ?? '').trim()
  const timeMatch = (rawTime || '23:59').match(/^(\d{1,2}):(\d{2})/)
  if (!timeMatch) return null

  const hh = timeMatch[1].padStart(2, '0')
  const mm = timeMatch[2]
  const deadlineMs = Date.parse(`${dateTrim}T${hh}:${mm}:00+07:00`)
  return Number.isFinite(deadlineMs) ? deadlineMs : null
}

function isCompletedOrderVisibleWithinWindow(
  deadlinedate: string | null | undefined,
  deadlinetime: string | null | undefined,
  now: Date,
): boolean {
  const deadlineMs = getProductionDeadlineEpoch(deadlinedate, deadlinetime)
  if (deadlineMs === null) return false

  const elapsedMs = now.getTime() - deadlineMs
  return elapsedMs <= COMPLETED_ORDER_DEADLINE_VISIBILITY_WINDOW_MS
}

export function shouldShowOpenProductionOrder(input: {
  status: string
  closed: boolean
  completion: ProductionCompletion
  completedAt?: string | null
  deadlinedate?: string | null
  deadlinetime?: string | null
  now?: Date
}): boolean {
  if (isEffectiveDeliveredProductionStatus(input.status) || isEffectiveCompletedProductionStatus(input.status)) {
    return isCompletedOrderVisibleWithinWindow(input.deadlinedate, input.deadlinetime, input.now ?? new Date())
  }
  if (input.closed) return false
  return input.completion.completionPct < 100
}
