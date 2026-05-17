'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireTabEdit } from '@/modules/permissions/server'
import logger from '@/lib/logger'

export type KpiTargetRow = {
  id: string
  kpi_code: string
  department: string
  name: string
  unit: string
  target_operator: string
  default_period: string
  target_value: number
  target_monthly: number | null
  target_quarterly: number | null
  target_yearly: number | null
  is_active: boolean
  year: number
}

export type KpiTargetUpdate = {
  kpi_code: string
  target_monthly: number | null
  target_quarterly: number | null
  target_yearly: number | null
  target_value: number
}

export async function getKpiTargetsAction(): Promise<{ data: KpiTargetRow[]; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: 'Chưa đăng nhập' }

    const { data, error } = await supabase
      .from('kpi_targets')
      .select('id,kpi_code,department,name,unit,target_operator,default_period,target_value,target_monthly,target_quarterly,target_yearly,is_active,year')
      .eq('is_active', true)
      .order('department')
      .order('kpi_code')

    if (error) return { data: [], error: error.message }
    return { data: (data ?? []) as KpiTargetRow[] }
  } catch (err) {
    return { data: [], error: String(err) }
  }
}

export async function updateKpiTargetsAction(
  updates: KpiTargetUpdate[]
): Promise<{ success: boolean; message: string }> {
  try {
    const editor = await requireTabEdit('admin.kpi-settings')
    if (!editor) return { success: false, message: 'Bạn chỉ có quyền xem tab này.' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: 'Chưa đăng nhập' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'ADMIN') {
      return { success: false, message: 'Chỉ ADMIN mới được chỉnh sửa chỉ tiêu KPI' }
    }

    for (const row of updates) {
      const { error } = await supabase
        .from('kpi_targets')
        .update({
          target_value: row.target_value,
          target_monthly: row.target_monthly,
          target_quarterly: row.target_quarterly,
          target_yearly: row.target_yearly,
          updated_at: new Date().toISOString(),
        })
        .eq('kpi_code', row.kpi_code)

      if (error) {
        logger.error({ error: error.message, kpi_code: row.kpi_code }, 'updateKpiTargets error')
        return { success: false, message: `Lỗi cập nhật ${row.kpi_code}: ${error.message}` }
      }
    }

    logger.info({ count: updates.length, userId: user.id }, 'KPI targets updated')
    revalidatePath('/dashboard/admin/kpi-settings')
    revalidatePath('/dashboard/report/kpi')
    return { success: true, message: `Đã cập nhật ${updates.length} chỉ tiêu KPI` }
  } catch (err) {
    return { success: false, message: String(err) }
  }
}
