'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireTabEdit } from '@/lib/permissions/server'
import logger from '@/lib/logger'
import { canAccessWorkspace, canApproveRequests, canApproveWorkspace, getWorkspaceScopedFilter, summarizeOvertimeParticipants } from '@/lib/approval/workflow'
import {
  getIncompleteOvertimeOrderOptions,
  getOvertimeEmployeeOptions,
  type OvertimeEmployeeOption,
  type OvertimeOrderOption,
} from '@/lib/overtime/workflow'
import { normalizeWorkshop, workshopCode, workshopToDataFilters } from '@/lib/utils'
import {
  overtimeRequestCreateSchema,
  overtimeReviewSchema,
  type OvertimeRequestCreateInput,
} from '@/lib/validations/overtime'

type ActionResult<T = undefined> = { success: boolean; message: string; data?: T; id?: string }

type DataOrderRow = {
  PCODE: string
  CUSTOMER: string | null
  WORKSHOP: string | null
  STATUS: string | null
  INITIALDATE: string | null
}

export type OvertimeProductionOrderOption = OvertimeOrderOption

export type OvertimeRequestParticipantRow = {
  id: string
  employee_id: string | null
  employee_name: string
  hours: number
}

export type OvertimeRequestRow = {
  id: string
  ot_date: string
  customer: string | null
  pcode: string | null
  workshop: string
  ot_category: string
  reasons: Record<string, boolean>
  total_employees: number
  total_hours: number
  required_output: number | null
  planned_hours: number | null
  notes: string | null
  approval_status: 'pending' | 'approved' | 'rejected'
  requested_by: string
  approved_by: string | null
  approved_at: string | null
  approval_note: string | null
  approved_overtime_id: string | null
  created_at: string
  overtime_request_participants?: OvertimeRequestParticipantRow[]
}

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null, supabase }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role,workspace')
    .eq('id', user.id)
    .single()

  return { user, profile: profileData as { role: string; workspace: string } | null, supabase }
}

function revalidateOvertime() {
  revalidatePath('/dashboard/administration')
  revalidatePath('/dashboard/report/overtime')
  revalidatePath('/dashboard/report/kpi')
}

function canAccessWorkshop(profile: { role: string; workspace: string }, workshop: string): boolean {
  return canAccessWorkspace(profile.role, profile.workspace, workshop)
}

function mapDataOrderRow(row: DataOrderRow): OvertimeProductionOrderOption {
  return {
    pcode: row.PCODE,
    customer: row.CUSTOMER ?? '',
    workshop: workshopCode(normalizeWorkshop(row.WORKSHOP ?? '')),
    status: row.STATUS ?? '',
    initialdate: row.INITIALDATE,
  }
}

async function getIncompleteOrdersForWorkshop(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: { role: string; workspace: string },
  workshop: string,
  initialdate?: string
): Promise<{ options: OvertimeProductionOrderOption[]; error?: string }> {
  if (!canAccessWorkshop(profile, workshop)) return { options: [] }

  const filters = [...workshopToDataFilters(workshop), `${workshop}%`]
  let query = supabase
    .from('data')
    .select('PCODE,CUSTOMER,WORKSHOP,STATUS,INITIALDATE')
    .not('PCODE', 'is', null)
    .limit(1000)

  if (initialdate) query = query.eq('INITIALDATE', initialdate)

  query = filters.length > 0
    ? query.or(filters.map((filter) => `WORKSHOP.ilike.${filter}`).join(','))
    : query.eq('WORKSHOP', workshop)

  const { data, error } = await query
  if (error) return { options: [], error: error.message }

  const rows = ((data ?? []) as DataOrderRow[])
    .map(mapDataOrderRow)
    .filter((row) => canAccessWorkshop(profile, row.workshop))

  return {
    options: getIncompleteOvertimeOrderOptions(rows, workshop, initialdate),
  }
}

export async function listIncompleteOvertimeOrdersAction(
  workshop: string,
  initialdate?: string
): Promise<ActionResult<OvertimeProductionOrderOption[]>> {
  try {
    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Chưa đăng nhập', data: [] }
    if (!workshop) return { success: true, message: '', data: [] }
    if (!canAccessWorkshop(profile, workshop)) {
      return { success: false, message: 'Không có quyền xem LSX của xưởng này.', data: [] }
    }

    const result = await getIncompleteOrdersForWorkshop(supabase, profile, workshop, initialdate)
    if (result.error) return { success: false, message: result.error, data: [] }
    return { success: true, message: '', data: result.options }
  } catch (err) {
    logger.error({ err }, 'listIncompleteOvertimeOrdersAction error')
    return { success: false, message: String(err), data: [] }
  }
}

export async function listOvertimeEmployeesByWorkshopAction(
  workshop: string
): Promise<ActionResult<OvertimeEmployeeOption[]>> {
  try {
    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Chưa đăng nhập', data: [] }
    if (!workshop) return { success: true, message: '', data: [] }
    if (!canAccessWorkshop(profile, workshop)) {
      return { success: false, message: 'Không có quyền xem nhân sự của xưởng này.', data: [] }
    }

    const { data, error } = await supabase
      .from('human_resource')
      .select('id,name,factory')
      .eq('factory', workshop)
      .order('name', { ascending: true })

    if (error) return { success: false, message: error.message, data: [] }

    return {
      success: true,
      message: '',
      data: getOvertimeEmployeeOptions((data ?? []) as Array<{ id: number; name: string; factory: string | null }>, workshop),
    }
  } catch (err) {
    logger.error({ err }, 'listOvertimeEmployeesByWorkshopAction error')
    return { success: false, message: String(err), data: [] }
  }
}

export async function createOvertimeRequestAction(
  input: OvertimeRequestCreateInput
): Promise<ActionResult<string>> {
  try {
    const editor = await requireTabEdit('administration.overtime')
    if (!editor) return { success: false, message: 'Bạn chỉ có quyền xem tab này.' }

    const parsed = overtimeRequestCreateSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu tăng ca không hợp lệ' }
    }

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (!canAccessWorkshop(profile, parsed.data.workshop)) {
      return { success: false, message: 'Không có quyền tạo tăng ca cho xưởng này.' }
    }

    let selectedOrder: OvertimeProductionOrderOption | undefined
    const selectedPcode = parsed.data.pcode?.trim()
    if (selectedPcode) {
      const orderResult = await getIncompleteOrdersForWorkshop(supabase, profile, parsed.data.workshop, parsed.data.ot_date)
      if (orderResult.error) return { success: false, message: `Không kiểm tra được LSX: ${orderResult.error}` }

      selectedOrder = orderResult.options.find((order) => order.pcode === selectedPcode)
      if (!selectedOrder) {
        return {
          success: false,
          message: 'LSX đã hoàn thành/đã giao hoặc không thuộc xưởng được chọn.',
        }
      }
    }

    const participants = parsed.data.participants.map((participant) => ({
      employee_id: participant.employee_id ?? null,
      employee_name: participant.employee_name.trim(),
      hours: participant.hours,
    }))
    const summary = summarizeOvertimeParticipants(participants)

    const { data, error } = await supabase
      .from('overtime_requests')
      .insert({
        ot_date: parsed.data.ot_date,
        customer: selectedOrder?.customer || parsed.data.customer || null,
        pcode: selectedOrder?.pcode || parsed.data.pcode || null,
        workshop: parsed.data.workshop,
        ot_category: parsed.data.ot_category,
        reasons: parsed.data.reasons,
        total_employees: summary.total_employees,
        total_hours: summary.total_hours,
        required_output: parsed.data.required_output ?? null,
        planned_hours: parsed.data.planned_hours ?? null,
        notes: parsed.data.notes || null,
        requested_by: user.id,
      })
      .select('id')
      .single()

    if (error || !data?.id) {
      logger.error({ error: error?.message, userId: user.id }, 'createOvertimeRequestAction: request insert failed')
      return { success: false, message: `Lỗi DB: ${error?.message ?? 'Không tạo được request tăng ca'}` }
    }

    const { error: participantError } = await supabase
      .from('overtime_request_participants')
      .insert(participants.map((participant) => ({ ...participant, request_id: data.id })))

    if (participantError) {
      await supabase.from('overtime_requests').delete().eq('id', data.id)
      logger.error({ error: participantError.message, requestId: data.id }, 'createOvertimeRequestAction: participants insert failed')
      return { success: false, message: `Lỗi DB: ${participantError.message}` }
    }

    revalidateOvertime()
    return { success: true, message: 'Đã gửi yêu cầu tăng ca, chờ phê duyệt.', id: data.id }
  } catch (err) {
    logger.error({ err }, 'createOvertimeRequestAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function reviewOvertimeRequestAction(
  id: string,
  decision: 'approved' | 'rejected',
  note?: string
): Promise<ActionResult<string | null>> {
  try {
    const editor = await requireTabEdit('administration.overtime')
    if (!editor) return { success: false, message: 'Bạn chỉ có quyền xem tab này.' }

    const parsed = overtimeReviewSchema.safeParse({ id, decision, note })
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu duyệt không hợp lệ' }

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (!canApproveRequests(profile.role)) return { success: false, message: 'Chỉ Manager hoặc Admin được phê duyệt.' }

    const { data: requestRow, error: requestError } = await supabase
      .from('overtime_requests')
      .select('workshop')
      .eq('id', parsed.data.id)
      .single()

    if (requestError || !requestRow) return { success: false, message: requestError?.message ?? 'Không tìm thấy yêu cầu tăng ca.' }
    if (!canApproveWorkspace(profile.role, profile.workspace, String(requestRow.workshop))) {
      return { success: false, message: 'Không có quyền duyệt yêu cầu của xưởng này.' }
    }

    const { data, error } = await supabase.rpc('rpc_review_overtime_request', {
      p_request_id: parsed.data.id,
      p_decision: parsed.data.decision,
      p_note: parsed.data.note || null,
    })

    if (error) {
      logger.error({ error: error.message, requestId: parsed.data.id, by: user.id }, 'reviewOvertimeRequestAction failed')
      return { success: false, message: `Lỗi duyệt: ${error.message}` }
    }

    revalidateOvertime()
    return {
      success: true,
      message: parsed.data.decision === 'approved'
        ? 'Đã duyệt và ghi nhận tăng ca.'
        : 'Đã từ chối yêu cầu tăng ca.',
      data: data as string | null,
    }
  } catch (err) {
    logger.error({ err }, 'reviewOvertimeRequestAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function listOvertimeRequestsAction(filter: {
  workshop?: string
  status?: 'pending' | 'approved' | 'rejected' | 'ALL'
  from?: string
  to?: string
  limit?: number
}): Promise<ActionResult<OvertimeRequestRow[]>> {
  try {
    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Chưa đăng nhập', data: [] }

    let query = supabase
      .from('overtime_requests')
      .select('*, overtime_request_participants(id, employee_id, employee_name, hours)')
      .order('ot_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(filter.limit ?? 200)

    if (filter.workshop && filter.workshop !== 'ALL') query = query.eq('workshop', filter.workshop)
    if (filter.status && filter.status !== 'ALL') query = query.eq('approval_status', filter.status)
    if (filter.from) query = query.gte('ot_date', filter.from)
    if (filter.to) query = query.lte('ot_date', filter.to)

    const scope = getWorkspaceScopedFilter(profile.role, profile.workspace)
    if (!scope.unrestricted) {
      if (scope.workspaces.length === 0) return { success: true, message: '', data: [] }
      query = query.in('workshop', scope.workspaces)
    }

    const { data, error } = await query
    if (error) return { success: false, message: error.message, data: [] }

    return { success: true, message: '', data: (data ?? []) as OvertimeRequestRow[] }
  } catch (err) {
    logger.error({ err }, 'listOvertimeRequestsAction error')
    return { success: false, message: String(err), data: [] }
  }
}
