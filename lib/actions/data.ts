'use server'

import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCachedNorms, getFreshNorms, getFreshNormOverrides, getCachedMaterials } from '@/lib/db/queries'
import {
  calculateProductionCompletion,
  calculateProductionCompletionTime,
  getOpenProductionOrdersQueryWindow,
  getProductionEntryBaseWorkshop,
  getProductionEntryWorkshop,
  getProductionRowsValidationError,
  isOtherProductionEntryTask,
  isProductionEntryWorkspaceAllowed,
  shouldAutoCloseProductionOrder,
  sortProductionOrdersForEntry,
} from '@/lib/production/workflow'
import {
  applyEffectiveStatusToOrder,
  applyEffectiveStatusToOrders,
  buildProductionStatusMapFromRows,
  upsertProductionOrderStatuses,
  type ProductionSourceRow,
} from '@/lib/production/status-server'
import {
  isProductionOrderInternalStatus,
  resolveOpenProductionOrderStatus,
  shouldShowOpenProductionOrder,
} from '@/lib/production/status'
import { requireTabEdit, requireTabView } from '@/lib/permissions/server'
import { isWorkspaceAllowed, getUserWorkspaces, normalizeWorkshop, parseDecimalInput, workshopCode } from '@/lib/utils'
import logger from '@/lib/logger'
import type { InitData, OpenProductionOrder, OpenProductionOrdersData, Order, ProductionInputHistoryRow, ProductionReportRow } from '@/types'
import type { Database } from '@/types/database'

// Bust the unstable_cache for Norm + Material tables.
// Call this after updating data in the Norm or Material tables in Supabase.
export async function revalidateNormsAction(): Promise<void> {
  revalidateTag('norms', {})
  revalidateTag('materials', {})
}

// Actual column names in Supabase table "data" use quoted uppercase identifiers
type DataRow = Database['public']['Tables']['data']['Row']
type ProductionRow = Database['public']['Tables']['Production']['Row']
type ProductionOrderStatusRow = Pick<
  Database['public']['Tables']['production_order_status']['Row'],
  'pcode' | 'status' | 'produced_quantity' | 'quantity' | 'completion_pct' | 'updated_at'
>
type SemiFinishedProductionInsert = Database['public']['Tables']['semi_finished_production']['Insert']
type SemiFinishedProductionInput = {
  pdate: string
  pcode: string
  workshop?: string
  products: string
  material?: string
  quantity: number
  defect_quantity: number
  recycle_quantity: number
  workforce: number
  starttime: string
  endtime: string
  realnorm: number
  log: string
}

// Columns that exist in the "data" table (uppercase, no deadlinetime, no created_at)
const DATA_SELECT = 'PCODE,INITIALDATE,CUSTOMER,WORKSHOP,DESCRIPTION,QUANTITY,DEADLINEDATE,STATUS,source_deleted_at'
const ACTIVE_SOURCE_FILTER_COLUMN = 'source_deleted_at'
const SUPABASE_PAGE_SIZE = 1000

function mapDataRowToOrder(row: DataRow): Order {
  return mapDataRowToOrderWithWorkshop(row, normalizeWorkshop(row.WORKSHOP ?? ''))
}

function mapDataRowToProductionEntryOrder(row: DataRow): Order {
  return mapDataRowToOrderWithWorkshop(row, getProductionEntryWorkshop(row.WORKSHOP ?? '', row.DESCRIPTION))
}

function mapDataRowToOrderWithWorkshop(row: DataRow, workshop: string): Order {
  // DEADLINEDATE is "TIMESTAMP WITHOUT TIME ZONE" → "2026-04-13T11:00:00"
  // Split into date "2026-04-13" and time "11:00" for clean display
  const deadlineRaw = row.DEADLINEDATE ?? ''
  const deadlineDate = deadlineRaw ? deadlineRaw.substring(0, 10) : ''
  const deadlineTime = deadlineRaw.includes('T') ? deadlineRaw.substring(11, 16) : ''

  return {
    pcode: row.PCODE,
    initialdate: row.INITIALDATE ?? '',
    workshop,
    customer: row.CUSTOMER ?? '',
    quantity: row.QUANTITY != null ? String(row.QUANTITY) : '',
    description: row.DESCRIPTION ?? '',
    deadlinedate: deadlineDate,
    deadlinetime: deadlineTime,
    status: row.STATUS ?? '',
  }
}

export async function getInitData(
  selectedDate: string
): Promise<{ success: boolean; data?: InitData; error?: string }> {
  try {
    const supabase = await createClient()

    // Fetch session server-side — never trust client-passed role/workspace
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' }

    const { data: profileData } = await supabase
      .from('profiles').select('role,workspace').eq('id', user.id).single()
    if (!profileData) return { success: false, error: 'Không tìm thấy thông tin người dùng.' }

    const { role, workspace: rawWorkspace } = profileData as { role: string; workspace: string }
    const userWorkspaces = getUserWorkspaces(rawWorkspace ?? '')

    // Norm + Material are cached (static data) — data + Production are per-request
    const [norms, materials, dataRes, productionRes] = await Promise.all([
      getCachedNorms(),
      getCachedMaterials(),
      supabase
        .from('data')
        .select(DATA_SELECT)
        .eq('INITIALDATE', selectedDate)
        .is(ACTIVE_SOURCE_FILTER_COLUMN, null),
      supabase
        .from('Production')
        .select('pcode,poutput,save_status')
        .eq('pdate', selectedDate),
    ])

    // Always use pure DMC code so "DMC1 - ..." and "DMC1" both resolve to "DMC1"
    const validWorkshops = new Set(norms.map((n) => workshopCode(n.workshop)).filter(Boolean))
    // When Norm table has data: only show orders whose workshop has defined products.
    // When Norm table is empty: show all orders (fallback so UI is not blank).
    const hasNormData = validWorkshops.size > 0

    if (!hasNormData) {
      logger.warn('Norm table is empty — showing all workshops without norm validation')
    }

    const orders: Order[] = ((dataRes.data ?? []) as DataRow[])
      .map((row) => ({ row, entryWorkshop: getProductionEntryWorkshop(row.WORKSHOP ?? '', row.DESCRIPTION) }))
      .filter(({ entryWorkshop }) => {
        const baseWorkshop = getProductionEntryBaseWorkshop(entryWorkshop)
        const allowed = isProductionEntryWorkspaceAllowed(entryWorkshop, role, userWorkspaces, rawWorkspace)
        return allowed && (!hasNormData || validWorkshops.has(baseWorkshop))
      })
      .map(({ row }) => mapDataRowToProductionEntryOrder(row))

    const orderPcodes = orders.map((order) => order.pcode)
    const { data: cumulativeProductionRows, error: cumulativeProductionError } = orderPcodes.length > 0
      ? await supabase
          .from('Production')
          .select('pcode,poutput,save_status')
          .in('pcode', orderPcodes)
      : { data: [], error: null }

    if (cumulativeProductionError) return { success: false, error: cumulativeProductionError.message }

    const quantityByPcode = new Map(orders.map((order) => [order.pcode, Number(order.quantity) || 0]))
    const prodRows = (productionRes.data ?? []) as ProductionSourceRow[]
    const cumulativeRows = (cumulativeProductionRows ?? []) as ProductionSourceRow[]
    const statusMap = buildProductionStatusMapFromRows({
      pcodes: orderPcodes,
      productionRows: cumulativeRows,
      quantityByPcode,
    })
    // Gắn SL đã SX / còn lại để form nhập prefill đúng phần còn lại (đã trừ các lần lưu trước),
    // tránh lần nhập thứ 2 trở lên điền dư theo tổng SL lệnh.
    const effectiveOrders: OpenProductionOrder[] = applyEffectiveStatusToOrders(orders, statusMap).map((order) => {
      const info = statusMap.get(order.pcode)
      const completion = calculateProductionCompletion(Number(order.quantity) || 0, info?.producedQuantity ?? 0)
      return { ...order, ...completion }
    })

    const submittedPcodes = [
      ...new Set(prodRows.map((p) => p.pcode).filter(Boolean) as string[]),
    ]
    const closedPcodes = getClosedPcodesFromProduction(cumulativeRows, quantityByPcode)

    logger.info(
      {
        date: selectedDate,
        userId: user.id,
        role,
        workspaceFromDB: rawWorkspace,
        userWorkspaces,
        ordersFound: orders.length,
        normsFound: norms.length,
        submittedPcodes: submittedPcodes.length,
        closedPcodes: closedPcodes.length,
        workshopsAvailable: [...new Set(orders.map((o) => o.workshop))],
      },
      'getInitData success'
    )

    return {
      success: true,
      data: { orders: effectiveOrders, norms, materials, submittedPcodes, closedPcodes },
    }
  } catch (err) {
    logger.error({ err }, 'getInitData error')
    return { success: false, error: String(err) }
  }
}

export async function searchOrderByPcode(
  pcode: string
): Promise<{ success: boolean; order?: OpenProductionOrder; message?: string }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('data')
      .select(DATA_SELECT)
      .ilike('PCODE', pcode.trim())
      .is(ACTIVE_SOURCE_FILTER_COLUMN, null)
      .limit(1)
      .single()

    if (error || !data) {
      return { success: false, message: `Không tìm thấy mã ${pcode}` }
    }

    const order = mapDataRowToProductionEntryOrder(data as DataRow)
    const { data: productionRows, error: productionError } = await supabase
      .from('Production')
      .select('pcode,poutput,save_status')
      .eq('pcode', order.pcode)
    if (productionError) return { success: false, message: productionError.message }

    const quantityByPcode = new Map([[order.pcode, Number(order.quantity) || 0]])
    const statusMap = buildProductionStatusMapFromRows({
      pcodes: [order.pcode],
      productionRows: (productionRows ?? []) as ProductionSourceRow[],
      quantityByPcode,
    })
    const info = statusMap.get(order.pcode)
    const completion = calculateProductionCompletion(Number(order.quantity) || 0, info?.producedQuantity ?? 0)
    const effectiveOrder: OpenProductionOrder = { ...applyEffectiveStatusToOrder(order, statusMap), ...completion }

    // Verify the current user has access to this order's workshop
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profileData } = await supabase
        .from('profiles').select('role,workspace').eq('id', user.id).single()
      if (profileData) {
        const p = profileData as { role: string; workspace: string }
        const ws = getUserWorkspaces(p.workspace ?? '')
        if (!isProductionEntryWorkspaceAllowed(order.workshop, p.role, ws, p.workspace)) {
          return { success: false, message: `Không có quyền truy cập mã ${pcode} (xưởng ${order.workshop}).` }
        }
      }
    }

    return { success: true, order: effectiveOrder }
  } catch (err) {
    logger.error({ err }, 'searchOrderByPcode error')
    return { success: false, message: String(err) }
  }
}

function buildPcodeOutputMap(rows: Array<Pick<ProductionRow, 'pcode' | 'poutput'>>): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    if (!row.pcode) continue
    map.set(row.pcode, (map.get(row.pcode) ?? 0) + (row.poutput ?? 0))
  }
  return map
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

async function fetchProductionOrderStatusRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pcodes: string[],
): Promise<ProductionOrderStatusRow[]> {
  const rows: ProductionOrderStatusRow[] = []

  for (const chunk of chunkArray([...new Set(pcodes.filter(Boolean))], 200)) {
    const statusRes = await supabase
      .from('production_order_status')
      .select('pcode,status,produced_quantity,quantity,completion_pct,updated_at')
      .in('pcode', chunk)

    if (statusRes.error) {
      if (isMissingProductionOrderStatusTableError(statusRes.error)) return []
      throw new Error(statusRes.error.message)
    }

    rows.push(...((statusRes.data ?? []) as ProductionOrderStatusRow[]))
  }

  return rows
}

async function fetchProductionRowsByPcodes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pcodes: string[],
): Promise<Array<Pick<ProductionRow, 'pcode' | 'pdate' | 'endtime' | 'poutput'>>> {
  const rows: Array<Pick<ProductionRow, 'pcode' | 'pdate' | 'endtime' | 'poutput'>> = []

  for (const chunk of chunkArray([...new Set(pcodes.filter(Boolean))], 200)) {
    const productionRowsRes = await supabase
      .from('Production')
      .select('pcode,pdate,endtime,poutput')
      .in('pcode', chunk)

    if (productionRowsRes.error) throw new Error(productionRowsRes.error.message)

    rows.push(...((productionRowsRes.data ?? []) as Array<Pick<ProductionRow, 'pcode' | 'pdate' | 'endtime' | 'poutput'>>))
  }

  return rows
}

async function fetchHistoryDataRowsByPcodes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pcodes: string[],
): Promise<Array<Pick<DataRow, 'PCODE' | 'CUSTOMER' | 'WORKSHOP' | 'DESCRIPTION'>>> {
  const rows: Array<Pick<DataRow, 'PCODE' | 'CUSTOMER' | 'WORKSHOP' | 'DESCRIPTION'>> = []

  for (const chunk of chunkArray([...new Set(pcodes.filter(Boolean))], 200)) {
    const dataRowsRes = await supabase
      .from('data')
      .select('PCODE,CUSTOMER,WORKSHOP,DESCRIPTION')
      .in('PCODE', chunk)

    if (dataRowsRes.error) throw new Error(dataRowsRes.error.message)

    rows.push(...((dataRowsRes.data ?? []) as Array<Pick<DataRow, 'PCODE' | 'CUSTOMER' | 'WORKSHOP' | 'DESCRIPTION'>>))
  }

  return rows
}

async function fetchDataRowsInOpenOrdersWindow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fromDate: string,
  today: string,
): Promise<DataRow[]> {
  const rows: DataRow[] = []

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('data')
      .select(DATA_SELECT)
      .gte('INITIALDATE', fromDate)
      .lte('INITIALDATE', today)
      .is(ACTIVE_SOURCE_FILTER_COLUMN, null)
      .order('INITIALDATE', { ascending: false })
      .order('PCODE', { ascending: true })
      .range(from, from + SUPABASE_PAGE_SIZE - 1)

    if (error) throw new Error(error.message)

    const page = (data ?? []) as DataRow[]
    rows.push(...page)

    if (page.length < SUPABASE_PAGE_SIZE) break
  }

  return rows
}

function getClosedPcodesFromProduction(
  rows: Array<{ pcode: string | null; poutput: number | null; save_status?: 'draft' | 'closed' | null }>,
  quantityByPcode: Map<string, number>
): string[] {
  const outputByPcode = buildPcodeOutputMap(rows)
  const closed = new Set<string>()

  for (const row of rows) {
    if (row.pcode && row.save_status === 'closed') closed.add(row.pcode)
  }

  for (const [pcode, quantity] of quantityByPcode) {
    if (shouldAutoCloseProductionOrder(quantity, outputByPcode.get(pcode) ?? 0)) closed.add(pcode)
  }

  return [...closed]
}

function getLockedProductionPcodes(
  rows: Array<{ pcode: string | null; poutput: number | null; save_status?: 'draft' | 'closed' | null }>,
  quantityByPcode: Map<string, number>
): string[] {
  return getClosedPcodesFromProduction(rows, quantityByPcode)
}

function isMissingProductionOrderStatusTableError(error: { code?: string; message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? ''
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    error?.code === 'PGRST200' ||
    (message.includes('production_order_status') && message.includes('schema')) ||
    (message.includes('production_order_status') && message.includes('not find')) ||
    (message.includes('production_order_status') && message.includes('does not exist'))
  )
}

async function autoCloseCompletedProductionOrders(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orders: Array<{ PCODE: string; QUANTITY: number | null }>,
): Promise<string[]> {
  const quantityByPcode = new Map(orders.map((row) => [row.PCODE, row.QUANTITY ?? 0]))
  const pcodes = [...quantityByPcode.keys()].filter(Boolean)
  if (pcodes.length === 0) return []

  const { data, error } = await supabase
    .from('Production')
    .select('pcode,poutput')
    .in('pcode', pcodes)

  if (error) throw new Error(error.message)

  const outputByPcode = buildPcodeOutputMap((data ?? []) as Array<Pick<ProductionRow, 'pcode' | 'poutput'>>)
  const completedPcodes = pcodes.filter((pcode) =>
    shouldAutoCloseProductionOrder(quantityByPcode.get(pcode) ?? 0, outputByPcode.get(pcode) ?? 0)
  )

  if (completedPcodes.length === 0) return []

  const { error: updateError } = await supabase
    .from('Production')
    .update({ save_status: 'closed' })
    .in('pcode', completedPcodes)

  if (updateError) throw new Error(updateError.message)
  return completedPcodes
}

export async function getOpenProductionOrdersAction(): Promise<{ success: boolean; data?: OpenProductionOrdersData; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' }

    const { data: profileData } = await supabase
      .from('profiles').select('role,workspace').eq('id', user.id).single()
    if (!profileData) return { success: false, error: 'Không tìm thấy thông tin người dùng.' }

    const { role, workspace: rawWorkspace } = profileData as { role: string; workspace: string }
    const userWorkspaces = getUserWorkspaces(rawWorkspace ?? '')

    const { today, fromDate } = getOpenProductionOrdersQueryWindow()

    const [norms, normOverrides, materials, dataRows] = await Promise.all([
      getFreshNorms(),
      getFreshNormOverrides(),
      getCachedMaterials(),
      fetchDataRowsInOpenOrdersWindow(supabase, fromDate, today),
    ])
    const scopedDataRows = dataRows.filter((row) => {
      const entryWorkshop = getProductionEntryWorkshop(row.WORKSHOP ?? '', row.DESCRIPTION)
      return isProductionEntryWorkspaceAllowed(entryWorkshop, role, userWorkspaces, rawWorkspace)
    })
    const scopedOrders = scopedDataRows.map(mapDataRowToProductionEntryOrder)
    const pcodes = [...new Set(scopedOrders.map((order) => order.pcode).filter(Boolean))]
    const quantityByPcode = new Map(scopedOrders.map((order) => [order.pcode, Number(order.quantity) || 0]))

    let statusRows: ProductionOrderStatusRow[] = []
    let productionRows: Array<Pick<ProductionRow, 'pcode' | 'pdate' | 'endtime' | 'poutput'>> = []

    if (pcodes.length > 0) {
      const [fetchedStatusRows, fetchedProductionRows] = await Promise.all([
        fetchProductionOrderStatusRows(supabase, pcodes),
        fetchProductionRowsByPcodes(supabase, pcodes),
      ])

      statusRows = fetchedStatusRows
      productionRows = fetchedProductionRows
    }

    const statusMap = buildProductionStatusMapFromRows({
      pcodes,
      productionRows,
      statusRows,
      quantityByPcode,
    })
    const statusUpdatedAtByPcode = new Map(statusRows.map((row) => [row.pcode, row.updated_at]))

    const productionRowsByPcode = new Map<string, Array<Pick<ProductionRow, 'pcode' | 'pdate' | 'endtime' | 'poutput'>>>()
    for (const row of productionRows) {
      if (!row.pcode) continue
      const rows = productionRowsByPcode.get(row.pcode) ?? []
      rows.push(row)
      productionRowsByPcode.set(row.pcode, rows)
    }

    const now = new Date()
    const effectiveOrders = scopedOrders.map((order) => {
      const info = statusMap.get(order.pcode)
      const completion = calculateProductionCompletion(Number(order.quantity) || 0, info?.producedQuantity ?? 0)
      const completedAt = calculateProductionCompletionTime(
        Number(order.quantity) || 0,
        productionRowsByPcode.get(order.pcode) ?? [],
      )
      const effectiveOrder = applyEffectiveStatusToOrder({ ...order, ...completion, completedAt }, statusMap)
      const status = resolveOpenProductionOrderStatus({
        sourceStatus: effectiveOrder.sourceStatus ?? effectiveOrder.status,
        quantity: Number(order.quantity) || info?.quantity || 0,
        produced: info?.producedQuantity ?? 0,
        closed: info?.closed ?? false,
        internalStatus: effectiveOrder.internalStatus,
        deadlinedate: order.deadlinedate,
        deadlinetime: order.deadlinetime,
        now,
      })

      return {
        ...effectiveOrder,
        status,
        internalStatus: isProductionOrderInternalStatus(status) ? status : effectiveOrder.internalStatus,
      }
    })

    const submittedPcodes = effectiveOrders
      .filter((order) => (statusMap.get(order.pcode)?.producedQuantity ?? 0) > 0)
      .map((order) => order.pcode)
    const closedPcodes = effectiveOrders
      .filter((order) => {
        const info = statusMap.get(order.pcode)
        return (info?.closed ?? false) || (info?.completionPct ?? 0) >= 100
      })
      .map((order) => order.pcode)

    const closedPcodeSet = new Set(closedPcodes)
    const todayDate = now.toLocaleDateString('en-CA')
    const orders = sortProductionOrdersForEntry(
      effectiveOrders.filter((order) => {
        if (closedPcodeSet.has(order.pcode) && order.completedAt?.slice(0, 10) !== todayDate) return false

        if (!shouldShowOpenProductionOrder({
          status: order.status,
          closed: closedPcodeSet.has(order.pcode),
          completion: order,
          completedAt: order.completedAt,
          statusUpdatedAt: statusUpdatedAtByPcode.get(order.pcode) ?? null,
          deadlinedate: order.deadlinedate,
          deadlinetime: order.deadlinetime,
          now,
        })) return false

        return true
      })
    ) as OpenProductionOrdersData['orders']

    return { success: true, data: { orders, norms, normOverrides, materials, submittedPcodes, closedPcodes } }
  } catch (err) {
    logger.error({ err }, 'getOpenProductionOrdersAction error')
    return { success: false, error: String(err) }
  }
}

async function repairProductionIdSequence(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { error } = await supabase.rpc('repair_production_id_sequence')
  if (error) throw new Error(error.message)
}

export async function recordProductionAction(rows: Array<{
  pdate: string
  totalem: string
  pcode: string
  products: string
  material: string
  poutput: number
  eoutput: number
  routput: number
  workforce: number
  starttime: string
  endtime: string
  realnorm: number
  log: string
  save_status?: 'draft' | 'closed'
}>): Promise<{ success: boolean; message: string }> {
  try {
    const editor = await requireTabEdit('production')
    if (!editor) return { success: false, message: 'Bạn chỉ có quyền xem tab này.' }

    const supabase = await createClient()

    // ── 1. Verify session (server-side, cannot be spoofed by client) ─────────
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, message: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' }
    }

    const { data: profileData } = await supabase
      .from('profiles').select('role,workspace').eq('id', user.id).single()
    if (!profileData) {
      return { success: false, message: 'Không tìm thấy thông tin người dùng.' }
    }
    const profile = profileData as { role: string; workspace: string }
    const userWorkspaces = getUserWorkspaces(profile.workspace ?? '')

    const uniquePcodes = [...new Set(rows.map((r) => r.pcode).filter(Boolean))]
    const productionPcodes = uniquePcodes.filter((pcode) => !isOtherProductionEntryTask(pcode))
    const { data: orderData, error: orderError } = productionPcodes.length > 0
      ? await supabase
          .from('data')
          .select('PCODE,QUANTITY,STATUS,WORKSHOP,DESCRIPTION')
          .in('PCODE', productionPcodes)
          .is(ACTIVE_SOURCE_FILTER_COLUMN, null)
      : { data: [], error: null }

    if (orderError) {
      logger.error({ error: orderError.message, pcodes: productionPcodes, userId: user.id }, 'recordProduction status source error')
      return { success: false, message: `Lỗi đọc trạng thái LSX: ${orderError.message}` }
    }

    const statusDataRows = (orderData ?? []) as Array<{ PCODE: string; QUANTITY: number | null; STATUS: string | null; WORKSHOP: string | null; DESCRIPTION: string | null }>
    const foundPcodes = new Set(statusDataRows.map((row) => row.PCODE))
    const missingPcode = productionPcodes.find((pcode) => !foundPcodes.has(pcode))
    if (missingPcode) {
      return { success: false, message: `Không tìm thấy mã ${missingPcode}.` }
    }

    // ── 2. Workshop permission check — only ADMIN is unrestricted ───────────
    // MANAGER/SUPERVISOR/USER are all workspace-scoped.
    if (profile.role !== 'ADMIN') {
      logger.info(
        { userId: user.id, role: profile.role, workspaceFromDB: profile.workspace, userWorkspaces },
        'recordProduction: permission check'
      )

      for (const row of statusDataRows) {
        const entryWorkshop = getProductionEntryWorkshop(row.WORKSHOP ?? '', row.DESCRIPTION)
        if (!isProductionEntryWorkspaceAllowed(entryWorkshop, profile.role, userWorkspaces, profile.workspace)) {
          logger.warn(
            { userId: user.id, pcode: row.PCODE, workshop: entryWorkshop, userWorkspaces },
            'recordProduction: unauthorized workshop — blocked'
          )
          return {
            success: false,
            message: `Không có quyền nhập sản xuất cho xưởng ${entryWorkshop}. Bạn chỉ được phép nhập cho: ${userWorkspaces.join(', ')}.`,
          }
        }
      }
    }

    // ── 3. Insert ─────────────────────────────────────────────────────────────
    const validationError = getProductionRowsValidationError(rows)
    if (validationError) {
      return { success: false, message: validationError }
    }

    const productionLockRes = productionPcodes.length > 0
      ? await supabase
          .from('Production')
          .select('pcode,poutput,save_status')
          .in('pcode', productionPcodes)
      : { data: [], error: null }

    if (productionLockRes.error) {
      logger.error({ error: productionLockRes.error.message, pcodes: productionPcodes, userId: user.id }, 'recordProduction lock source error')
      return { success: false, message: `Lỗi kiểm tra trạng thái đóng LSX: ${productionLockRes.error.message}` }
    }

    const quantityByPcode = new Map(statusDataRows.map((row) => [row.PCODE, row.QUANTITY ?? 0]))
    const lockedPcodes = getLockedProductionPcodes(
      (productionLockRes.data ?? []) as Array<Pick<ProductionRow, 'pcode' | 'poutput' | 'save_status'>>,
      quantityByPcode
    )
    if (lockedPcodes.length > 0) {
      return { success: false, message: `LSX ${lockedPcodes.join(', ')} đã đóng hoặc đã đủ sản lượng, không thể nhập thêm.` }
    }

    const statusDataRowsByPcode = new Map(statusDataRows.map((row) => [row.PCODE, row]))
    const insertRows = rows.map((row) => {
      const sourceRow = statusDataRowsByPcode.get(row.pcode)
      const entryWorkshop = sourceRow
        ? getProductionEntryWorkshop(sourceRow.WORKSHOP ?? '', sourceRow.DESCRIPTION)
        : row.totalem
      return {
        ...row,
        totalem: getProductionEntryBaseWorkshop(entryWorkshop),
        poutput: parseDecimalInput(row.poutput),
        eoutput: parseDecimalInput(row.eoutput),
        routput: parseDecimalInput(row.routput),
        workforce: parseDecimalInput(row.workforce),
        realnorm: parseDecimalInput(row.realnorm),
      }
    })

    let { error } = await supabase.from('Production').insert(insertRows)

    if (error?.code === '23505' && error.message.includes('Production_pkey')) {
      await repairProductionIdSequence(supabase)
      const retry = await supabase.from('Production').insert(insertRows)
      error = retry.error
    }

    if (error) {
      logger.error({ error: error.message }, 'recordProduction DB error')
      return { success: false, message: `Lỗi: ${error.message}` }
    }

    try {
      const closedPcodes = await autoCloseCompletedProductionOrders(supabase, statusDataRows)
      if (closedPcodes.length > 0) {
        logger.info({ pcodes: closedPcodes, userId: user.id }, 'recordProduction auto-closed completed orders')
      }
    } catch (closeError) {
      logger.error({ err: closeError, pcodes: uniquePcodes, userId: user.id }, 'recordProduction auto-close error')
      return { success: false, message: `Đã lưu sản xuất nhưng lỗi tự động đóng LSX đã đủ: ${String(closeError)}` }
    }

    try {
      await upsertProductionOrderStatuses({
        supabase,
        pcodes: uniquePcodes,
        dataRows: statusDataRows,
        userId: user.id,
      })
    } catch (statusError) {
      logger.error({ err: statusError, pcodes: uniquePcodes, userId: user.id }, 'recordProduction status upsert error')
      return { success: false, message: `Đã lưu sản xuất nhưng lỗi cập nhật trạng thái LSX: ${String(statusError)}` }
    }

    logger.info({ count: rows.length, userId: user.id }, 'Production recorded')
    return { success: true, message: `Đã lưu ${rows.length} dòng sản xuất thành công!` }
  } catch (err) {
    logger.error({ err }, 'recordProductionAction error')
    return { success: false, message: String(err) }
  }
}

export async function recordSemiFinishedProductionAction(rows: SemiFinishedProductionInput[]): Promise<{ success: boolean; message: string }> {
  try {
    const editor = await requireTabEdit('production')
    if (!editor) return { success: false, message: 'Bạn chỉ có quyền xem tab này.' }

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, message: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' }
    }

    const { data: profileData } = await supabase
      .from('profiles').select('role,workspace').eq('id', user.id).single()
    if (!profileData) {
      return { success: false, message: 'Không tìm thấy thông tin người dùng.' }
    }

    const profile = profileData as { role: string; workspace: string }
    const userWorkspaces = getUserWorkspaces(profile.workspace ?? '')
    const uniquePcodes = [...new Set(rows.map((row) => row.pcode).filter(Boolean))]

    const { data: orderData, error: orderError } = uniquePcodes.length > 0
      ? await supabase
          .from('data')
          .select('PCODE,WORKSHOP,DESCRIPTION')
          .in('PCODE', uniquePcodes)
      : { data: [], error: null }

    if (orderError) {
      logger.error({ error: orderError.message, pcodes: uniquePcodes, userId: user.id }, 'recordSemiFinishedProduction source error')
      return { success: false, message: `Lỗi đọc LSX: ${orderError.message}` }
    }

    const orderRows = (orderData ?? []) as Array<{ PCODE: string; WORKSHOP: string | null; DESCRIPTION: string | null }>
    const orderRowsByPcode = new Map(orderRows.map((row) => [row.PCODE, row]))
    const missingPcode = uniquePcodes.find((pcode) => !orderRowsByPcode.has(pcode))
    if (missingPcode) return { success: false, message: `Không tìm thấy mã ${missingPcode}.` }

    for (const row of orderRows) {
      const entryWorkshop = getProductionEntryWorkshop(row.WORKSHOP ?? '', row.DESCRIPTION)
      if (!isProductionEntryWorkspaceAllowed(entryWorkshop, profile.role, userWorkspaces, profile.workspace)) {
        logger.warn(
          { userId: user.id, pcode: row.PCODE, workshop: entryWorkshop, userWorkspaces },
          'recordSemiFinishedProduction: unauthorized workshop — blocked'
        )
        return {
          success: false,
          message: `Không có quyền nhập bán thành phẩm cho xưởng ${entryWorkshop}. Bạn chỉ được phép nhập cho: ${userWorkspaces.join(', ')}.`,
        }
      }
    }

    const validationError = getProductionRowsValidationError(rows.map((row) => ({
      pdate: row.pdate,
      pcode: row.pcode,
      products: row.products,
      poutput: parseDecimalInput(row.quantity),
      eoutput: parseDecimalInput(row.defect_quantity),
      routput: parseDecimalInput(row.recycle_quantity),
      workforce: parseDecimalInput(row.workforce),
      starttime: row.starttime,
      endtime: row.endtime,
    })))
    if (validationError) return { success: false, message: validationError }

    const insertRows: SemiFinishedProductionInsert[] = rows.map((row) => {
      const sourceRow = orderRowsByPcode.get(row.pcode)
      const entryWorkshop = sourceRow
        ? getProductionEntryWorkshop(sourceRow.WORKSHOP ?? '', sourceRow.DESCRIPTION)
        : row.workshop ?? ''

      return {
        pdate: row.pdate,
        pcode: row.pcode,
        workshop: getProductionEntryBaseWorkshop(entryWorkshop),
        products: row.products,
        material: row.material ?? '',
        quantity: parseDecimalInput(row.quantity),
        defect_quantity: parseDecimalInput(row.defect_quantity),
        recycle_quantity: parseDecimalInput(row.recycle_quantity),
        workforce: parseDecimalInput(row.workforce),
        starttime: row.starttime,
        endtime: row.endtime,
        realnorm: parseDecimalInput(row.realnorm),
        log: row.log,
        created_by: user.id,
      }
    })

    const { error } = await supabase.from('semi_finished_production').insert(insertRows)
    if (error) {
      logger.error({ error: error.message }, 'recordSemiFinishedProduction DB error')
      return { success: false, message: `Lỗi: ${error.message}` }
    }

    logger.info({ count: rows.length, userId: user.id }, 'Semi-finished production recorded')
    return { success: true, message: `Đã lưu ${rows.length} dòng bán thành phẩm thành công!` }
  } catch (err) {
    logger.error({ err }, 'recordSemiFinishedProductionAction error')
    return { success: false, message: String(err) }
  }
}

export async function listProductionInputHistoryAction(filters: {
  fromDate: string
  toDate: string
  query?: string
}): Promise<{ success: boolean; data?: ProductionInputHistoryRow[]; error?: string }> {
  try {
    const viewer = await requireTabView('production.input-history')
    if (!viewer) return { success: false, error: 'Bạn không có quyền xem lịch sử nhập.' }

    const supabase = await createClient()

    const prodRes = await supabase
      .from('Production')
      .select('id,pdate,pcode,products,poutput,eoutput,routput,workforce,realnorm,starttime,endtime,log,save_status,created_at')
      .gte('pdate', filters.fromDate)
      .lte('pdate', filters.toDate)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (prodRes.error) return { success: false, error: prodRes.error.message }

    const prodRows = (prodRes.data ?? []) as Pick<
      ProductionRow,
      'id' | 'pdate' | 'pcode' | 'products' | 'poutput' | 'eoutput' | 'routput' | 'workforce' | 'realnorm' | 'starttime' | 'endtime' | 'log' | 'save_status' | 'created_at'
    >[]
    const historyPcodes = [...new Set(prodRows.map((row) => row.pcode ?? '').filter(Boolean))]
    const dataRows = await fetchHistoryDataRowsByPcodes(supabase, historyPcodes)
    const orderMap = new Map(dataRows.map((row) => [row.PCODE, row]))
    const userWorkspaces = getUserWorkspaces(viewer.workspace ?? '')
    const needle = (filters.query ?? '').trim().toLowerCase()

    const rows: ProductionInputHistoryRow[] = prodRows
      .map((row) => {
        const order = orderMap.get(row.pcode ?? '')
        const workshop = getProductionEntryWorkshop(order?.WORKSHOP ?? '', order?.DESCRIPTION)
        return {
          id: row.id,
          pdate: row.pdate ?? '',
          pcode: row.pcode ?? '',
          workshop,
          customer: order?.CUSTOMER ?? '',
          product: row.products ?? '',
          orderDescription: order?.DESCRIPTION ?? '',
          poutput: row.poutput ?? 0,
          eoutput: row.eoutput ?? 0,
          routput: row.routput ?? 0,
          workforce: row.workforce ?? 0,
          realnorm: row.realnorm ?? 0,
          starttime: row.starttime ?? '',
          endtime: row.endtime ?? '',
          log: row.log ?? '',
          save_status: row.save_status,
          created_at: row.created_at ?? '',
        }
      })
      .filter((row) => isProductionEntryWorkspaceAllowed(row.workshop, viewer.role, userWorkspaces, viewer.workspace))
      .filter((row) => {
        if (!needle) return true
        const statusLabel = row.save_status === 'closed' ? 'đã đóng da dong closed' : 'lưu tạm luu tam draft'
        return [
          row.pcode,
          row.product,
          row.workshop,
          row.customer,
          row.orderDescription,
          row.log,
          statusLabel,
        ].some((value) => value.toLowerCase().includes(needle))
      })

    return { success: true, data: rows }
  } catch (err) {
    logger.error({ err }, 'listProductionInputHistoryAction error')
    return { success: false, error: String(err) }
  }
}

// Filter by created_at (UTC ISO string) — covers Giờ/Ngày/Tháng/Năm modes
export async function getProductionReportData(
  startISO: string,
  endISO: string,
): Promise<{ success: boolean; data?: ProductionReportRow[]; error?: string }> {
  try {
    const supabase = await createClient()

    const [prodRes, dataRes, normRows] = await Promise.all([
      supabase
        .from('Production')
        .select('pdate,pcode,products,poutput,eoutput,routput,realnorm,starttime,endtime,created_at')
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: true }),
      supabase.from('data').select('PCODE,WORKSHOP'),
      getCachedNorms(),
    ])

    const dataRows = (dataRes.data ?? []) as Pick<DataRow, 'PCODE' | 'WORKSHOP'>[]
    const prodRows = (prodRes.data ?? []) as Pick<
      ProductionRow,
      'pdate' | 'pcode' | 'products' | 'poutput' | 'eoutput' | 'routput' | 'realnorm' | 'starttime' | 'endtime' | 'created_at'
    >[]

    const pcodeToWs = new Map(dataRows.map((d) => [d.PCODE, normalizeWorkshop(d.WORKSHOP ?? '')]))

    // Key by workshopCode so both "DMC1" and "DMC1 - ..." norms resolve to same key
    const normMap = new Map(
      normRows.map((n) => [
        `${n.products}|||${workshopCode(n.workshop)}`,
        { norm: n.norm, pspeed: n.pspeed },
      ])
    )

    const rows: ProductionReportRow[] = prodRows
      .filter((r) => r.products)
      .map((r) => {
        const ws = pcodeToWs.get(r.pcode ?? '') ?? ''
        const normInfo = normMap.get(`${r.products}|||${workshopCode(ws)}`) ?? { norm: 0, pspeed: 0 }
        return {
          pdate: r.pdate ?? '',
          pcode: r.pcode ?? '',
          workshop: ws,
          product: r.products ?? '',
          poutput: r.poutput ?? 0,
          eoutput: r.eoutput ?? 0,
          routput: r.routput ?? 0,
          realnorm: r.realnorm ?? 0,
          norm: normInfo.norm,
          pspeed: normInfo.pspeed,
          starttime: r.starttime ?? '',
          endtime: r.endtime ?? '',
          created_at: r.created_at ?? '',
        }
      })

    return { success: true, data: rows }
  } catch (err) {
    logger.error({ err }, 'getProductionReportData error')
    return { success: false, error: String(err) }
  }
}
