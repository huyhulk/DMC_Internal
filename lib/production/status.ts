import type { ProductionCompletion } from '@/lib/production/workflow'
import type { ProductionOrderInternalStatus, ProductionOrderEffectiveStatus } from '@/types'

export const PRODUCTION_ORDER_INTERNAL_STATUSES: ProductionOrderInternalStatus[] = [
  'Chưa SX',
  'Đang SX',
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

export function isProductionOrderInternalStatus(value: string | null | undefined): value is ProductionOrderInternalStatus {
  return PRODUCTION_ORDER_INTERNAL_STATUSES.includes(value as ProductionOrderInternalStatus)
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
  if (isProductionOrderInternalStatus(input.internalStatus)) return input.internalStatus
  return 'Chưa SX'
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

export function shouldShowOpenProductionOrder(input: {
  status: string
  closed: boolean
  completion: ProductionCompletion
}): boolean {
  if (input.closed) return false
  if (isEffectiveClosedProductionStatus(input.status)) return false
  return input.completion.completionPct < 100
}
