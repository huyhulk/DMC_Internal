'use server'

import { createClient } from '@/lib/supabase/server'
import { isWorkspaceAllowed, getUserWorkspaces } from '@/lib/utils'
import logger from '@/lib/logger'
import type { InitData, Order, NormItem, ProductionReportRow } from '@/types'
import type { Database } from '@/types/database'

type NormRow = Database['public']['Tables']['Norm']['Row']
type DataRow = Database['public']['Tables']['DATA']['Row']
type MaterialRow = Database['public']['Tables']['Material']['Row']
type ProductionRow = Database['public']['Tables']['Production']['Row']

export async function getInitData(
  selectedDate: string,
  userId: string,
  role: string,
  workspace: string
): Promise<{ success: boolean; data?: InitData; error?: string }> {
  try {
    const supabase = await createClient()
    const userWorkspaces = getUserWorkspaces(workspace)

    const [normsRes, dataRes, materialsRes, productionRes] = await Promise.all([
      supabase.from('Norm').select('*'),
      supabase.from('DATA').select('*').eq('initialdate', selectedDate),
      supabase.from('Material').select('*'),
      supabase.from('Production').select('pcode').eq('pdate', selectedDate),
    ])

    const norms: NormItem[] = ((normsRes.data ?? []) as NormRow[]).map((n) => ({
      products: n.products,
      norm: n.norm ?? 0,
      nwforce: n.nwforce ?? 0,
      workshop: n.workshop ?? '',
      pspeed: n.pspeed ?? 0,
    }))

    const validWorkshops = new Set(norms.map((n) => n.workshop).filter(Boolean))

    const orders: Order[] = ((dataRes.data ?? []) as DataRow[])
      .filter((row) => {
        const ws = row.workshop ?? ''
        const allowed = isWorkspaceAllowed(ws, role, userWorkspaces)
        return allowed && validWorkshops.has(ws)
      })
      .map((row) => ({
        pcode: row.pcode,
        initialdate: row.initialdate ?? '',
        workshop: row.workshop ?? '',
        customer: row.customer ?? '',
        quantity: row.quantity ?? '',
        description: row.description ?? '',
        deadlinedate: row.deadlinedate ?? '',
        deadlinetime: row.deadlinetime ?? '',
        status: row.status ?? '',
      }))

    const materials = ((materialsRes.data ?? []) as MaterialRow[]).map((m) => ({
      product: m.product,
      material: m.material,
    }))

    const prodRows = (productionRes.data ?? []) as Pick<ProductionRow, 'pcode'>[]
    const submittedPcodes = [
      ...new Set(prodRows.map((p) => p.pcode).filter(Boolean) as string[]),
    ]

    logger.info(
      { orders: orders.length, norms: norms.length, submitted: submittedPcodes.length },
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
      .from('DATA')
      .select('*')
      .ilike('pcode', pcode.trim())
      .limit(1)
      .single()

    if (error || !data) {
      return { success: false, message: `Không tìm thấy mã ${pcode}` }
    }

    const row = data as DataRow
    return {
      success: true,
      order: {
        pcode: row.pcode,
        initialdate: row.initialdate ?? '',
        workshop: row.workshop ?? '',
        customer: row.customer ?? '',
        quantity: row.quantity ?? '',
        description: row.description ?? '',
        deadlinedate: row.deadlinedate ?? '',
        deadlinetime: row.deadlinetime ?? '',
        status: row.status ?? '',
      },
    }
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

    const [prodRes, dataRes, normRes] = await Promise.all([
      supabase
        .from('Production')
        .select('*')
        .gte('pdate', startDate)
        .lte('pdate', endDate)
        .order('pdate', { ascending: true }),
      supabase.from('DATA').select('pcode,workshop'),
      supabase.from('Norm').select('products,workshop,norm,pspeed'),
    ])

    const dataRows = (dataRes.data ?? []) as Pick<DataRow, 'pcode' | 'workshop'>[]
    const normRows = (normRes.data ?? []) as Pick<NormRow, 'products' | 'workshop' | 'norm' | 'pspeed'>[]
    const prodRows = (prodRes.data ?? []) as ProductionRow[]

    const pcodeToWs = new Map(
      dataRows.map((d) => [d.pcode, d.workshop ?? ''])
    )

    const normMap = new Map(
      normRows.map((n) => [
        `${n.products}|||${n.workshop}`,
        { norm: n.norm ?? 0, pspeed: n.pspeed ?? 0 },
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
