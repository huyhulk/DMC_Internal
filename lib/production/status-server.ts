import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateProductionCompletion } from '@/lib/production/workflow'
import {
  isProductionOrderInternalStatus,
  isProtectedSourceProductionStatus,
  resolveProductionOrderInternalStatus,
  resolveProductionOrderStatus,
} from '@/lib/production/status'
import type { Database } from '@/types/database'
import type { ProductionOrderInternalStatus } from '@/types'

type StatusRow = Database['public']['Tables']['production_order_status']['Row']

type SupabaseLikeError = {
  code?: string
  message?: string
}

function isMissingProductionOrderStatusTableError(error: SupabaseLikeError): boolean {
  const message = error.message?.toLowerCase() ?? ''
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.code === 'PGRST200' ||
    (message.includes('production_order_status') && message.includes('schema')) ||
    (message.includes('production_order_status') && message.includes('not find')) ||
    (message.includes('production_order_status') && message.includes('does not exist'))
  )
}

export interface ProductionSourceRow {
  pcode: string | null
  poutput: number | null
  save_status?: 'draft' | 'closed' | null
}

export interface ProductionStatusInfo {
  internalStatus?: ProductionOrderInternalStatus
  producedQuantity: number
  quantity: number
  completionPct: number
  closed: boolean
}

export function buildProductionStatusMapFromRows(input: {
  pcodes: string[]
  productionRows: ProductionSourceRow[]
  statusRows?: Array<Pick<StatusRow, 'pcode' | 'status' | 'produced_quantity' | 'quantity' | 'completion_pct'>>
  quantityByPcode?: Map<string, number>
}): Map<string, ProductionStatusInfo> {
  const map = new Map<string, ProductionStatusInfo>()

  for (const statusRow of input.statusRows ?? []) {
    map.set(statusRow.pcode, {
      internalStatus: isProductionOrderInternalStatus(statusRow.status) ? statusRow.status : undefined,
      producedQuantity: statusRow.produced_quantity ?? 0,
      quantity: statusRow.quantity ?? 0,
      completionPct: statusRow.completion_pct ?? 0,
      closed: false,
    })
  }

  for (const pcode of input.pcodes) {
    if (!map.has(pcode)) {
      const quantity = input.quantityByPcode?.get(pcode) ?? 0
      const completion = calculateProductionCompletion(quantity, 0)
      map.set(pcode, {
        producedQuantity: completion.producedQuantity,
        quantity,
        completionPct: completion.completionPct,
        closed: false,
      })
    }
  }

  for (const row of input.productionRows) {
    if (!row.pcode) continue
    const current = map.get(row.pcode)
    const quantity = input.quantityByPcode?.get(row.pcode) ?? current?.quantity ?? 0
    const producedQuantity = (current?.producedQuantity ?? 0) + (row.poutput ?? 0)
    const completion = calculateProductionCompletion(quantity, producedQuantity)
    map.set(row.pcode, {
      internalStatus: current?.internalStatus,
      producedQuantity: completion.producedQuantity,
      quantity,
      completionPct: completion.completionPct,
      closed: (current?.closed ?? false) || row.save_status === 'closed',
    })
  }

  return map
}

export async function getProductionStatusMap(
  supabase: SupabaseClient,
  pcodes: string[],
  quantityByPcode?: Map<string, number>,
): Promise<Map<string, ProductionStatusInfo>> {
  const uniquePcodes = [...new Set(pcodes.filter(Boolean))]
  if (uniquePcodes.length === 0) return new Map()

  const [productionRes, statusRes] = await Promise.all([
    supabase.from('Production').select('pcode,poutput,save_status').in('pcode', uniquePcodes),
    supabase.from('production_order_status').select('pcode,status,produced_quantity,quantity,completion_pct').in('pcode', uniquePcodes),
  ])

  if (productionRes.error) throw new Error(productionRes.error.message)
  if (statusRes.error && !isMissingProductionOrderStatusTableError(statusRes.error)) {
    throw new Error(statusRes.error.message)
  }

  return buildProductionStatusMapFromRows({
    pcodes: uniquePcodes,
    productionRows: (productionRes.data ?? []) as ProductionSourceRow[],
    statusRows: statusRes.error
      ? []
      : (statusRes.data ?? []) as Array<Pick<StatusRow, 'pcode' | 'status' | 'produced_quantity' | 'quantity' | 'completion_pct'>>,
    quantityByPcode,
  })
}

export interface ProductionStatusTarget {
  pcode: string
  quantity?: string | number | null
  status: string
  sourceStatus?: string
  internalStatus?: ProductionOrderInternalStatus
}

export function applyEffectiveStatusToOrder<T extends ProductionStatusTarget>(
  order: T,
  statusMap: Map<string, ProductionStatusInfo>,
): T {
  const info = statusMap.get(order.pcode)
  const sourceStatus = order.sourceStatus ?? order.status
  const quantity = Number(order.quantity) || info?.quantity || 0
  const produced = info?.producedQuantity ?? 0
  const status = resolveProductionOrderStatus({
    sourceStatus,
    quantity,
    produced,
    closed: info?.closed ?? false,
    internalStatus: info?.internalStatus,
  })

  return {
    ...order,
    status,
    sourceStatus,
    internalStatus: isProductionOrderInternalStatus(status) ? status : info?.internalStatus,
  }
}

export function applyEffectiveStatusToOrders<T extends ProductionStatusTarget>(
  orders: T[],
  statusMap: Map<string, ProductionStatusInfo>,
): T[] {
  return orders.map((order) => applyEffectiveStatusToOrder(order, statusMap))
}

export async function upsertProductionOrderStatuses(input: {
  supabase: SupabaseClient
  pcodes: string[]
  dataRows: Array<{ PCODE: string; QUANTITY: number | null; STATUS: string | null }>
  userId: string
}): Promise<void> {
  const uniquePcodes = [...new Set(input.pcodes.filter(Boolean))]
  if (uniquePcodes.length === 0) return

  const quantityByPcode = new Map(input.dataRows.map((row) => [row.PCODE, row.QUANTITY ?? 0]))
  const statusByPcode = new Map(input.dataRows.map((row) => [row.PCODE, row.STATUS ?? '']))
  const statusMap = await getProductionStatusMap(input.supabase, uniquePcodes, quantityByPcode)

  const rows = uniquePcodes
    .filter((pcode) => !isProtectedSourceProductionStatus(statusByPcode.get(pcode) ?? ''))
    .map((pcode) => {
      const info = statusMap.get(pcode)
      const quantity = quantityByPcode.get(pcode) ?? info?.quantity ?? 0
      const producedQuantity = info?.producedQuantity ?? 0
      const completion = calculateProductionCompletion(quantity, producedQuantity)
      const status = resolveProductionOrderInternalStatus({
        quantity,
        produced: producedQuantity,
        closed: info?.closed ?? false,
      })

      return {
        pcode,
        status,
        produced_quantity: completion.producedQuantity,
        quantity,
        completion_pct: completion.completionPct,
        updated_by: input.userId,
        updated_at: new Date().toISOString(),
      }
    })

  if (rows.length === 0) return

  const { error } = await input.supabase
    .from('production_order_status')
    .upsert(rows, { onConflict: 'pcode' })

  if (error && !isMissingProductionOrderStatusTableError(error)) throw new Error(error.message)
}
