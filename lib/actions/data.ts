'use server'

import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCachedNorms, getCachedMaterials } from '@/lib/db/queries'
import {
  calculateProductionCompletion,
  getProductionRowsValidationError,
  isOpenProductionOrder,
  sortProductionOrdersForEntry,
} from '@/lib/production/workflow'
import { requireTabEdit, requireTabView } from '@/lib/permissions/server'
import { isWorkspaceAllowed, getUserWorkspaces, normalizeWorkshop, workshopCode } from '@/lib/utils'
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
        .select('pcode,save_status')
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

    const prodRows = (productionRes.data ?? []) as Pick<ProductionRow, 'pcode' | 'save_status'>[]
    const submittedPcodes = [
      ...new Set(prodRows.map((p) => p.pcode).filter(Boolean) as string[]),
    ]
    const closedPcodes = [
      ...new Set(
        prodRows
          .filter((p) => p.save_status === 'closed')
          .map((p) => p.pcode)
          .filter(Boolean) as string[]
      ),
    ]

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
      data: { orders, norms, materials, submittedPcodes, closedPcodes },
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

    return { success: true, order }
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

    const [norms, materials, dataRes, productionRes] = await Promise.all([
      getCachedNorms(),
      getCachedMaterials(),
      supabase.from('data').select(DATA_SELECT),
      supabase.from('Production').select('pcode,poutput,save_status'),
    ])

    if (dataRes.error) return { success: false, error: dataRes.error.message }
    if (productionRes.error) return { success: false, error: productionRes.error.message }

    const dataRows = (dataRes.data ?? []) as DataRow[]
    const prodRows = (productionRes.data ?? []) as Pick<ProductionRow, 'pcode' | 'poutput' | 'save_status'>[]
    const outputByPcode = buildPcodeOutputMap(prodRows)
    const submittedPcodes = [...new Set(prodRows.map((p) => p.pcode).filter(Boolean) as string[])]
    const closedPcodes = [
      ...new Set(prodRows.filter((p) => p.save_status === 'closed').map((p) => p.pcode).filter(Boolean) as string[]),
    ]

    const orders = sortProductionOrdersForEntry(
      dataRows
        .filter((row) => isWorkspaceAllowed(normalizeWorkshop(row.WORKSHOP ?? ''), role, userWorkspaces))
        .map((row) => {
          const order = mapDataRowToOrder(row)
          const produced = outputByPcode.get(order.pcode) ?? 0
          const completion = calculateProductionCompletion(Number(order.quantity) || 0, produced)
          return { ...order, ...completion }
        })
        .filter((order) => isOpenProductionOrder(order, order.producedQuantity, closedPcodes.includes(order.pcode)))
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
    const fromISO = `${filters.fromDate}T00:00:00+07:00`
    const toISO = `${filters.toDate}T23:59:59.999+07:00`

    const [prodRes, dataRes] = await Promise.all([
      supabase
        .from('Production')
        .select('id,pdate,pcode,products,poutput,eoutput,routput,workforce,realnorm,starttime,endtime,log,save_status,created_at')
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
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
