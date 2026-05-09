'use server'

import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCachedNorms, getCachedMaterials } from '@/lib/db/queries'
import {
  calculateProductionCompletion,
  calculateProductionCompletionTime,
  getProductionOrderStatusRank,
  getProductionRowsValidationError,
  isProductionOrderCreatedOnOrAfter,
  isProductionOrderDeadlineExpired,
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
import { shouldShowOpenProductionOrder } from '@/lib/production/status'
import { requireTabEdit, requireTabView } from '@/lib/permissions/server'
import { isWorkspaceAllowed, getUserWorkspaces, normalizeWorkshop, workshopCode, getTodayLocal, getLocalDateAfterDays } from '@/lib/utils'
import logger from '@/lib/logger'
import type { InitData, OpenProductionOrdersData, Order, ProductionInputHistoryRow, ProductionReportRow } from '@/types'
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
  'pcode' | 'status' | 'produced_quantity' | 'quantity' | 'completion_pct'
>

// Columns that exist in the "data" table (uppercase, no deadlinetime, no created_at)
const DATA_SELECT = 'PCODE,INITIALDATE,CUSTOMER,WORKSHOP,DESCRIPTION,QUANTITY,DEADLINEDATE,STATUS'

function mapDataRowToOrder(row: DataRow): Order {
  // DEADLINEDATE is "TIMESTAMP WITHOUT TIME ZONE" → "2026-04-13T11:00:00"
  // Split into date "2026-04-13" and time "11:00" for clean display
  const deadlineRaw = row.DEADLINEDATE ?? ''
  const deadlineDate = deadlineRaw ? deadlineRaw.substring(0, 10) : ''
  const deadlineTime = deadlineRaw.includes('T') ? deadlineRaw.substring(11, 16) : ''

  return {
    pcode: row.PCODE,
    initialdate: row.INITIALDATE ?? '',
    workshop: normalizeWorkshop(row.WORKSHOP ?? ''),
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
        .eq('INITIALDATE', selectedDate),
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
      .filter((row) => {
        const ws = normalizeWorkshop(row.WORKSHOP ?? '') // "DMC1 - Tôn & Phụ kiện"
        const code = workshopCode(ws)                    // "DMC1"
        const allowed = isWorkspaceAllowed(ws, role, userWorkspaces)
        return allowed && (!hasNormData || validWorkshops.has(code))
      })
      .map(mapDataRowToOrder)

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
    const effectiveOrders = applyEffectiveStatusToOrders(orders, statusMap)

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
): Promise<{ success: boolean; order?: Order; message?: string }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('data')
      .select(DATA_SELECT)
      .ilike('PCODE', pcode.trim())
      .limit(1)
      .single()

    if (error || !data) {
      return { success: false, message: `Không tìm thấy mã ${pcode}` }
    }

    const order = mapDataRowToOrder(data as DataRow)
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
    const effectiveOrder = applyEffectiveStatusToOrder(order, statusMap)

    // Verify the current user has access to this order's workshop
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profileData } = await supabase
        .from('profiles').select('role,workspace').eq('id', user.id).single()
      if (profileData) {
        const p = profileData as { role: string; workspace: string }
        const ws = getUserWorkspaces(p.workspace ?? '')
        if (!isWorkspaceAllowed(order.workshop, p.role, ws)) {
          return { success: false, message: `Không có quyền truy cập mã ${pcode} (xưởng ${workshopCode(order.workshop)}).` }
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
      .select('pcode,status,produced_quantity,quantity,completion_pct')
      .in('pcode', chunk)

    if (statusRes.error) {
      if (isMissingProductionOrderStatusTableError(statusRes.error)) return []
      throw new Error(statusRes.error.message)
    }

    rows.push(...((statusRes.data ?? []) as ProductionOrderStatusRow[]))
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

function getLocalPreviousMonthStart(dateString: string): string {
  const year = Number(dateString.slice(0, 4))
  const monthIndex = Number(dateString.slice(5, 7)) - 1
  return new Date(year, monthIndex - 1, 1).toLocaleDateString('en-CA')
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

    const today = getTodayLocal()
    const fromDate = getLocalPreviousMonthStart(today)
    // Also include orders whose DEADLINEDATE is within the last 2 days (covers 36h grace window),
    // so orders created before fromDate but with an active/recent deadline are not missed.
    const deadlineFrom = getLocalDateAfterDays(-2)

    const [norms, materials, dataRes] = await Promise.all([
      getCachedNorms(),
      getCachedMaterials(),
      supabase
        .from('data')
        .select(DATA_SELECT)
        .lte('INITIALDATE', today)
        .or(`INITIALDATE.gte.${fromDate},DEADLINEDATE.gte.${deadlineFrom}`),
    ])

    if (dataRes.error) return { success: false, error: dataRes.error.message }

    const dataRows = (dataRes.data ?? []) as DataRow[]
    const scopedDataRows = dataRows.filter((row) =>
      isWorkspaceAllowed(normalizeWorkshop(row.WORKSHOP ?? ''), role, userWorkspaces)
    )
    const scopedOrders = scopedDataRows.map(mapDataRowToOrder)
    const pcodes = [...new Set(scopedOrders.map((order) => order.pcode).filter(Boolean))]
    const quantityByPcode = new Map(scopedOrders.map((order) => [order.pcode, Number(order.quantity) || 0]))

    let statusRows: ProductionOrderStatusRow[] = []
    let productionRows: Array<Pick<ProductionRow, 'pcode' | 'pdate' | 'endtime' | 'poutput'>> = []

    if (pcodes.length > 0) {
      const [fetchedStatusRows, productionRowsRes] = await Promise.all([
        fetchProductionOrderStatusRows(supabase, pcodes),
        supabase
          .from('Production')
          .select('pcode,pdate,endtime,poutput')
          .in('pcode', pcodes),
      ])

      statusRows = fetchedStatusRows
      if (productionRowsRes.error) return { success: false, error: productionRowsRes.error.message }
      productionRows = (productionRowsRes.data ?? []) as Array<Pick<ProductionRow, 'pcode' | 'pdate' | 'endtime' | 'poutput'>>
    }

    const statusMap = buildProductionStatusMapFromRows({
      pcodes,
      productionRows: [],
      statusRows,
      quantityByPcode,
    })

    const productionRowsByPcode = new Map<string, Array<Pick<ProductionRow, 'pcode' | 'pdate' | 'endtime' | 'poutput'>>>()
    for (const row of productionRows) {
      if (!row.pcode) continue
      const rows = productionRowsByPcode.get(row.pcode) ?? []
      rows.push(row)
      productionRowsByPcode.set(row.pcode, rows)
    }

    const effectiveOrders = scopedOrders.map((order) => {
      const info = statusMap.get(order.pcode)
      const completion = calculateProductionCompletion(Number(order.quantity) || 0, info?.producedQuantity ?? 0)
      const completedAt = calculateProductionCompletionTime(
        Number(order.quantity) || 0,
        productionRowsByPcode.get(order.pcode) ?? [],
      )
      return applyEffectiveStatusToOrder({ ...order, ...completion, completedAt }, statusMap)
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

    const now = new Date()
    const NOT_STARTED_BASELINE_DATE = '2026-04-01'
    const DEADLINE_VISIBILITY_WINDOW_MS = 72 * 60 * 60 * 1000
    const closedPcodeSet = new Set(closedPcodes)
    const orders = sortProductionOrdersForEntry(
      effectiveOrders.filter((order) => {
        if (!shouldShowOpenProductionOrder({
          status: order.status,
          closed: closedPcodeSet.has(order.pcode),
          completion: order,
          deadlinedate: order.deadlinedate,
          deadlinetime: order.deadlinetime,
          now,
        })) return false

        if (getProductionOrderStatusRank(order.status) === 0) {
          if (!isProductionOrderCreatedOnOrAfter(order.initialdate, NOT_STARTED_BASELINE_DATE)) return false
          if (isProductionOrderDeadlineExpired(order.deadlinedate, order.deadlinetime, now, DEADLINE_VISIBILITY_WINDOW_MS)) return false
        }

        return true
      })
    ) as OpenProductionOrdersData['orders']

    return { success: true, data: { orders, norms, materials, submittedPcodes, closedPcodes } }
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

    // ── 2. Workshop permission check — only ADMIN is unrestricted ───────────
    // MANAGER/SUPERVISOR/USER are all workspace-scoped.
    if (profile.role !== 'ADMIN') {
      logger.info(
        { userId: user.id, role: profile.role, workspaceFromDB: profile.workspace, userWorkspaces },
        'recordProduction: permission check'
      )

      // Empty workspace = full access (admin explicitly left it blank to mean "all").
      // This is logged above so misconfigurations are visible in server logs.
      if (userWorkspaces.length > 0) {
        const uniquePcodes = [...new Set(rows.map((r) => r.pcode).filter(Boolean))]

        const { data: orderData } = await supabase
          .from('data').select('PCODE,WORKSHOP').in('PCODE', uniquePcodes)

        const foundPcodes = new Set(((orderData ?? []) as Array<{ PCODE: string }>).map((row) => row.PCODE))
        const missingPcode = uniquePcodes.find((pcode) => !foundPcodes.has(pcode))
        if (missingPcode) {
          return { success: false, message: `Không tìm thấy mã ${missingPcode}.` }
        }

        for (const row of (orderData ?? []) as Array<{ PCODE: string; WORKSHOP: string | null }>) {
          const ws = normalizeWorkshop(row.WORKSHOP ?? '')
          if (!isWorkspaceAllowed(ws, profile.role, userWorkspaces)) {
            logger.warn(
              { userId: user.id, pcode: row.PCODE, workshop: workshopCode(ws), userWorkspaces },
              'recordProduction: unauthorized workshop — blocked'
            )
            return {
              success: false,
              message: `Không có quyền nhập sản xuất cho xưởng ${workshopCode(ws)}. Bạn chỉ được phép nhập cho: ${userWorkspaces.join(', ')}.`,
            }
          }
        }
      }
    }

    // ── 3. Insert ─────────────────────────────────────────────────────────────
    const validationError = getProductionRowsValidationError(rows)
    if (validationError) {
      return { success: false, message: validationError }
    }

    const uniquePcodes = [...new Set(rows.map((r) => r.pcode).filter(Boolean))]
    const { data: orderData, error: orderError } = await supabase
      .from('data')
      .select('PCODE,QUANTITY,STATUS,WORKSHOP')
      .in('PCODE', uniquePcodes)

    if (orderError) {
      logger.error({ error: orderError.message, pcodes: uniquePcodes, userId: user.id }, 'recordProduction status source error')
      return { success: false, message: `Lỗi đọc trạng thái LSX: ${orderError.message}` }
    }

    const statusDataRows = (orderData ?? []) as Array<{ PCODE: string; QUANTITY: number | null; STATUS: string | null; WORKSHOP: string | null }>
    const foundPcodes = new Set(statusDataRows.map((row) => row.PCODE))
    const productionPcodes = uniquePcodes.filter((pcode) => !pcode.startsWith('5S') && !pcode.startsWith('Đào tạo') && !pcode.startsWith('Hỗ trợ PX khác'))
    const missingPcode = productionPcodes.find((pcode) => !foundPcodes.has(pcode))
    if (missingPcode) {
      return { success: false, message: `Không tìm thấy mã ${missingPcode}.` }
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

    let { error } = await supabase.from('Production').insert(rows)

    if (error?.code === '23505' && error.message.includes('Production_pkey')) {
      await repairProductionIdSequence(supabase)
      const retry = await supabase.from('Production').insert(rows)
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

export async function listProductionInputHistoryAction(filters: {
  fromDate: string
  toDate: string
  query?: string
}): Promise<{ success: boolean; data?: ProductionInputHistoryRow[]; error?: string }> {
  try {
    const viewer = await requireTabView('production.input-history')
    if (!viewer) return { success: false, error: 'Bạn không có quyền xem lịch sử nhập.' }

    const supabase = await createClient()

    const [prodRes, dataRes] = await Promise.all([
      supabase
        .from('Production')
        .select('id,pdate,pcode,products,poutput,eoutput,routput,workforce,realnorm,starttime,endtime,log,save_status,created_at')
        .gte('pdate', filters.fromDate)
        .lte('pdate', filters.toDate)
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase.from('data').select('PCODE,CUSTOMER,WORKSHOP,DESCRIPTION'),
    ])

    if (prodRes.error) return { success: false, error: prodRes.error.message }
    if (dataRes.error) return { success: false, error: dataRes.error.message }

    const dataRows = (dataRes.data ?? []) as Pick<DataRow, 'PCODE' | 'CUSTOMER' | 'WORKSHOP' | 'DESCRIPTION'>[]
    const orderMap = new Map(dataRows.map((row) => [row.PCODE, row]))
    const userWorkspaces = getUserWorkspaces(viewer.workspace ?? '')
    const needle = (filters.query ?? '').trim().toLowerCase()

    const rows: ProductionInputHistoryRow[] = ((prodRes.data ?? []) as Pick<
      ProductionRow,
      'id' | 'pdate' | 'pcode' | 'products' | 'poutput' | 'eoutput' | 'routput' | 'workforce' | 'realnorm' | 'starttime' | 'endtime' | 'log' | 'save_status' | 'created_at'
    >[])
      .map((row) => {
        const order = orderMap.get(row.pcode ?? '')
        const workshop = normalizeWorkshop(order?.WORKSHOP ?? '')
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
      .filter((row) => isWorkspaceAllowed(row.workshop, viewer.role, userWorkspaces))
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
