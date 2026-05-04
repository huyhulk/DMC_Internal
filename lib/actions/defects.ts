'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireTabEdit } from '@/lib/permissions/server'
import { defectsBulkSchema, type DefectsBulkInput } from '@/lib/validations/defects'
import { getUserWorkspaces, isWorkspaceAllowed, workshopCode } from '@/lib/utils'
import logger from '@/lib/logger'
import type { Database } from '@/types/database'

type DefectInsert = Database['public']['Tables']['production_defects']['Insert']
type DefectRow    = Database['public']['Tables']['production_defects']['Row']

export async function submitDefectsAction(
  input: DefectsBulkInput
): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    const editor = await requireTabEdit('production')
    if (!editor) return { success: false, message: 'Bạn chỉ có quyền xem tab này.' }

    const parsed = defectsBulkSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, message: 'Dữ liệu không hợp lệ: ' + (parsed.error.issues[0]?.message ?? '') }
    }
    const { shared, rows } = parsed.data

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { data: profileData } = await supabase
      .from('profiles').select('role,workspace').eq('id', user.id).single()
    if (!profileData) return { success: false, message: 'Không tìm thấy thông tin người dùng.' }

    const profile = profileData as { role: string; workspace: string }
    const userWorkspaces = getUserWorkspaces(profile.workspace ?? '')

    if (profile.role !== 'ADMIN' && userWorkspaces.length > 0) {
      if (!isWorkspaceAllowed(shared.workshop, profile.role, userWorkspaces)) {
        const targetWs = workshopCode(shared.workshop)
        logger.warn(
          { userId: user.id, workshop: targetWs, userWorkspaces },
          'submitDefects: unauthorized workshop blocked'
        )
        return {
          success: false,
          message: `Không có quyền nhập dữ liệu cho xưởng ${targetWs}. Bạn chỉ được phép: ${userWorkspaces.join(', ')}.`,
        }
      }
    }

    const inserts: DefectInsert[] = rows.map((r) => ({
      report_date:  shared.report_date,
      workshop:     shared.workshop,
      shift:        shared.shift ?? null,
      pcode:        r.pcode || null,
      product_name: r.product_name || null,
      total_qty:    r.total_qty,
      defect_qty:   r.defect_qty,
      defect_type:  r.defect_type ?? null,
      defect_cause: r.defect_cause || null,
      unit:         r.unit,
      notes:        r.notes || null,
      reported_by:  user.id,
    }))

    const { error } = await supabase.from('production_defects').insert(inserts)
    if (error) {
      logger.error({ error: error.message, userId: user.id }, 'submitDefects DB error')
      return { success: false, message: `Lỗi DB: ${error.message}` }
    }

    logger.info(
      { count: inserts.length, userId: user.id, workshop: shared.workshop },
      'Defects recorded successfully'
    )

    revalidatePath('/dashboard/production/defects')
    revalidatePath('/dashboard/report/kpi/production')

    return {
      success: true,
      message: `Đã lưu ${inserts.length} dòng lỗi thành phẩm.`,
      count: inserts.length,
    }
  } catch (err) {
    logger.error({ err }, 'submitDefectsAction unexpected error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function getDefectsListAction(filters?: {
  from?: string
  to?: string
  workshop?: string
  limit?: number
}): Promise<{ success: boolean; data?: DefectRow[]; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Chưa đăng nhập' }

    const { data: profileData } = await supabase
      .from('profiles').select('role,workspace').eq('id', user.id).single()
    if (!profileData) return { success: false, error: 'Không tìm thấy profile' }

    const profile = profileData as { role: string; workspace: string }
    const userWorkspaces = getUserWorkspaces(profile.workspace ?? '')

    let query = supabase
      .from('production_defects')
      .select('*')
      .order('report_date', { ascending: false })
      .order('created_at',  { ascending: false })
      .limit(filters?.limit ?? 50)

    if (filters?.from)    query = query.gte('report_date', filters.from)
    if (filters?.to)      query = query.lte('report_date', filters.to)
    if (filters?.workshop && filters.workshop !== 'ALL') {
      query = query.eq('workshop', filters.workshop)
    }

    if (profile.role !== 'ADMIN' && userWorkspaces.length > 0) {
      query = query.in('workshop', userWorkspaces)
    }

    const { data, error } = await query
    if (error) return { success: false, error: error.message }

    return { success: true, data: (data ?? []) as DefectRow[] }
  } catch (err) {
    logger.error({ err }, 'getDefectsListAction error')
    return { success: false, error: String(err) }
  }
}
