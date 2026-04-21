'use server'

import { createClient } from '@/lib/supabase/server'
import { getCachedNorms, getCachedMaterials } from '@/lib/db/queries'
import { isWorkspaceAllowed, getUserWorkspaces } from '@/lib/utils'
import logger from '@/lib/logger'
import type { InitData, Order, ProductionReportRow } from '@/types'
import type { Database } from '@/types/database'

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
    workshop: row.WORKSHOP ?? '',
    customer: row.CUSTOMER ?? '',
    quantity: row.QUANTITY != null ? String(row.QUANTITY) : '',
    description: row.DESCRIPTION ?? '',
    deadlinedate: deadlineDate,
    deadlinetime: deadlineTime,
    status: row.STATUS ?? '',
  }
}

export async function getInitData(
  selectedDate: string,
  userId: string,
  role: string,
  workspace: string
): Promise<{ success: boolean; data?: InitData; error?: string }> {
  try {
    const supabase = await createClient()
    const userWorkspaces = getUserWorkspaces(workspace)

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
        .select('pcode')
        .eq('pdate', selectedDate),
    ])

    const validWorkshops = new Set(norms.map((n) => n.workshop).filter(Boolean))
    // When Norm table has data: only show orders whose workshop has defined products.
    // When Norm table is empty: show all orders (fallback so UI is not blank).
    const hasNormData = validWorkshops.size > 0

    if (!hasNormData) {
      logger.warn('Norm table is empty — showing all workshops without norm validation')
    }

    const orders: Order[] = ((dataRes.data ?? []) as DataRow[])
      .filter((row) => {
        const ws = row.WORKSHOP ?? ''
        const allowed = isWorkspaceAllowed(ws, role, userWorkspaces)
        return allowed && (!hasNormData || validWorkshops.has(ws))
      })
      .map(mapDataRowToOrder)

    const prodRows = (productionRes.data ?? []) as Pick<ProductionRow, 'pcode'>[]
    const submittedPcodes = [
      ...new Set(prodRows.map((p) => p.pcode).filter(Boolean) as string[]),
    ]

    logger.info(
      {
        date: selectedDate,
        ordersFound: orders.length,
        normsFound: norms.length,
        submittedPcodes: submittedPcodes.length,
        workshopsAvailable: [...new Set(orders.map((o) => o.workshop))],
      },
      'getInitData success'
    )

    return {
      success: true,
      data: { orders, norms, materials, submittedPcodes },
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

    return { success: true, order: mapDataRowToOrder(data as DataRow) }
  } catch (err) {
    logger.error({ err }, 'searchOrderByPcode error')
    return { success: false, message: String(err) }
  }
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
}>): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('Production').insert(rows)

    if (error) {
      logger.error({ error: error.message }, 'recordProduction DB error')
      return { success: false, message: `Lỗi: ${error.message}` }
    }

    logger.info({ count: rows.length }, 'Production recorded')
    return { success: true, message: `Đã lưu ${rows.length} dòng sản xuất thành công!` }
  } catch (err) {
    logger.error({ err }, 'recordProductionAction error')
    return { success: false, message: String(err) }
  }
}

export async function getProductionReportData(
  startDate: string,
  endDate: string
): Promise<{ success: boolean; data?: ProductionReportRow[]; error?: string }> {
  try {
    const supabase = await createClient()

    // Norm data is cached; Production + data are per-request
    const [prodRes, dataRes, normRows] = await Promise.all([
      supabase
        .from('Production')
        .select('pdate,pcode,products,poutput,eoutput,routput,realnorm,starttime,endtime')
        .gte('pdate', startDate)
        .lte('pdate', endDate)
        .order('pdate', { ascending: true }),
      supabase.from('data').select('PCODE,WORKSHOP'),
      getCachedNorms(),
    ])

    const dataRows = (dataRes.data ?? []) as Pick<DataRow, 'PCODE' | 'WORKSHOP'>[]
    const prodRows = (prodRes.data ?? []) as Pick<
      ProductionRow,
      'pdate' | 'pcode' | 'products' | 'poutput' | 'eoutput' | 'routput' | 'realnorm' | 'starttime' | 'endtime'
    >[]

    const pcodeToWs = new Map(dataRows.map((d) => [d.PCODE, d.WORKSHOP ?? '']))

    const normMap = new Map(
      normRows.map((n) => [
        `${n.products}|||${n.workshop}`,
        { norm: n.norm, pspeed: n.pspeed },
      ])
    )

    const rows: ProductionReportRow[] = prodRows
      .filter((r) => r.products)
      .map((r) => {
        const ws = pcodeToWs.get(r.pcode ?? '') ?? ''
        const normInfo = normMap.get(`${r.products}|||${ws}`) ?? { norm: 0, pspeed: 0 }
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
        }
      })

    return { success: true, data: rows }
  } catch (err) {
    logger.error({ err }, 'getProductionReportData error')
    return { success: false, error: String(err) }
  }
}
