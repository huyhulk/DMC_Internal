'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  breakdownCreateSchema, breakdownUpdateSchema, breakdownResolveSchema,
  scheduleCreateSchema, scheduleBulkCreateSchema, scheduleCompleteSchema,
  drawingCreateSchema, drawingCompleteSchema,
  surveyCreateSchema,
  machineCreateSchema, machineUpdateSchema,
  type BreakdownCreateInput, type BreakdownUpdateInput, type BreakdownResolveInput,
  type ScheduleCreateInput, type ScheduleBulkCreateInput, type ScheduleCompleteInput,
  type DrawingCreateInput, type DrawingCompleteInput,
  type SurveyCreateInput,
  type MachineCreateInput,
} from '@/lib/validations/maintenance'
import logger from '@/lib/logger'
import { requireTabEdit } from '@/lib/permissions/server'
import type { PermissionKey } from '@/lib/permissions/tabs'
import { isBreakdownEndAfterStart, generateMaintenanceScheduleDates } from '@/lib/maintenance/workflow'
import { canAccessWorkspace, canApproveRequests, canApproveWorkspace, getWorkspaceScopedFilter } from '@/lib/approval/workflow'

// ─── Types from DB ────────────────────────────────────────────────────────────

export type BreakdownRow = {
  id: string; workshop: string; machine_code: string; machine_name: string | null
  breakdown_start: string; breakdown_end: string | null; downtime_minutes: number | null
  failure_type: string | null; root_cause: string | null; is_planned: boolean
  repair_action: string | null; parts_replaced: string | null; technician: string | null
  status: string; created_at: string
}

export type ScheduleRow = {
  id: string; workshop: string; machine_code: string; machine_name: string | null
  maintenance_type: string; scheduled_date: string; actual_date: string | null
  is_completed: boolean; is_on_time: boolean | null; checklist_items: unknown | null
  technician: string | null; notes: string | null; created_at: string
  approval_status: 'pending' | 'approved' | 'rejected'
  requested_by: string | null; approved_by: string | null
  approved_at: string | null; approval_note: string | null
}

export type DrawingRow = {
  id: string; drawing_code: string; drawing_name: string; customer: string | null
  project_code: string | null; request_date: string; due_date: string
  delivered_date: string | null; is_on_time: boolean | null; has_errors: boolean
  error_count: number; error_details: string | null; reviewer: string | null
  drafter: string | null; status: string; notes: string | null; created_at: string
}

export type SurveyRow = {
  id: string; survey_code: string; project_code: string | null; customer: string | null
  survey_date: string; surveyor: string | null; total_items: number; error_items: number
  accuracy_pct: number | null; error_details: unknown | null; notes: string | null
  created_at: string
}

export type MachineRow = {
  id: string; machine_name: string; machine_code: string | null
  machine_location: string; machine_status: string; machine_capacity: string | null
  created_at: string; updated_at: string
}

type ActionResult<T = undefined> = { success: boolean; message: string; data?: T; id?: string }

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null, supabase }

  const { data: profileData } = await supabase
    .from('profiles').select('role,workspace').eq('id', user.id).single()

  return { user, profile: profileData as { role: string; workspace: string } | null, supabase }
}

async function requireEdit(key: PermissionKey): Promise<ActionResult<never> | null> {
  const user = await requireTabEdit(key)
  return user ? null : { success: false, message: 'Bạn chỉ có quyền xem tab này.' }
}

function revalidate() {
  revalidatePath('/dashboard/maintenance')
  revalidatePath('/dashboard/report/kpi')
}

function canAccessWorkshop(profile: { role: string; workspace: string }, workshop: string): boolean {
  return canAccessWorkspace(profile.role, profile.workspace, workshop)
}

// ─── Machine Breakdowns ───────────────────────────────────────────────────────

export async function createBreakdownAction(input: BreakdownCreateInput): Promise<ActionResult<string>> {
  try {
    const denied = await requireEdit('maintenance.breakdowns')
    if (denied) return denied

    const parsed = breakdownCreateSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    if (!canAccessWorkshop(profile, parsed.data.workshop)) {
      return { success: false, message: 'Không có quyền thao tác với xưởng này.' }
    }

    const { breakdown_end, ...rest } = parsed.data
    const hasEnd = breakdown_end && breakdown_end.trim() !== ''
    const status = hasEnd ? 'resolved' : 'in_progress'

    const { data, error } = await supabase.from('machine_breakdowns').insert({
      ...rest,
      machine_name:    rest.machine_name || null,
      failure_type:    rest.failure_type || null,
      root_cause:      rest.root_cause || null,
      repair_action:   rest.repair_action || null,
      parts_replaced:  rest.parts_replaced || null,
      technician:      rest.technician || null,
      breakdown_end:   hasEnd ? breakdown_end : null,
      status,
      created_by: user.id,
    }).select('id').single()

    if (error) {
      logger.error({ error: error.message, userId: user.id }, 'createBreakdown DB error')
      return { success: false, message: `Lỗi DB: ${error.message}` }
    }

    revalidate()
    return { success: true, message: 'Đã lưu sự cố máy.', id: data?.id }
  } catch (err) {
    logger.error({ err }, 'createBreakdownAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function updateBreakdownAction(id: string, input: Omit<BreakdownUpdateInput, 'id'>): Promise<ActionResult> {
  try {
    const denied = await requireEdit('maintenance.breakdowns')
    if (denied) return denied

    const parsed = breakdownUpdateSchema.safeParse({ ...input, id })
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (!['ADMIN', 'MANAGER'].includes(profile.role)) return { success: false, message: 'Không có quyền cập nhật.' }

    const { id: _, ...rest } = parsed.data
    const hasEnd = rest.breakdown_end && rest.breakdown_end.trim() !== ''
    const updatePayload = {
      ...rest,
      machine_name:  rest.machine_name || null,
      failure_type:  rest.failure_type || null,
      root_cause:    rest.root_cause || null,
      repair_action: rest.repair_action || null,
      parts_replaced: rest.parts_replaced || null,
      technician:    rest.technician || null,
      breakdown_end: hasEnd ? rest.breakdown_end : null,
      status: hasEnd ? 'resolved' : (rest.status ?? 'in_progress'),
    }

    const { error } = await supabase.from('machine_breakdowns').update(updatePayload).eq('id', id)
    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã cập nhật sự cố.' }
  } catch (err) {
    logger.error({ err }, 'updateBreakdownAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function resolveBreakdownAction(id: string, input: BreakdownResolveInput): Promise<ActionResult> {
  try {
    const denied = await requireEdit('maintenance.breakdowns')
    if (denied) return denied

    const parsed = breakdownResolveSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { data: existing, error: readError } = await supabase
      .from('machine_breakdowns')
      .select('breakdown_start,workshop')
      .eq('id', id)
      .single()

    if (readError || !existing) return { success: false, message: readError?.message ?? 'Không tìm thấy sự cố.' }
    if (!canAccessWorkshop(profile, String(existing.workshop))) {
      return { success: false, message: 'Không có quyền thao tác với xưởng này.' }
    }
    if (!isBreakdownEndAfterStart(String(existing.breakdown_start), parsed.data.breakdown_end)) {
      return { success: false, message: 'Thời gian kết thúc phải sau thời gian bắt đầu.' }
    }

    const { error } = await supabase.from('machine_breakdowns').update({
      breakdown_end:  parsed.data.breakdown_end,
      repair_action:  parsed.data.repair_action || null,
      parts_replaced: parsed.data.parts_replaced || null,
      technician:     parsed.data.technician || null,
      status: 'resolved',
    }).eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã đánh dấu hoàn thành.' }
  } catch (err) {
    logger.error({ err }, 'resolveBreakdownAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function deleteBreakdownAction(id: string): Promise<ActionResult> {
  try {
    const denied = await requireEdit('maintenance.breakdowns')
    if (denied) return denied

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (profile.role !== 'ADMIN') return { success: false, message: 'Chỉ Admin mới được xóa.' }

    const { error } = await supabase.from('machine_breakdowns').delete().eq('id', id)
    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã xóa sự cố.' }
  } catch (err) {
    logger.error({ err }, 'deleteBreakdownAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function listBreakdownsAction(filter: {
  workshop?: string; from?: string; to?: string
  status?: string; failure_type?: string; limit?: number
}): Promise<ActionResult<BreakdownRow[]>> {
  try {
    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Chưa đăng nhập', data: [] }

    let query = supabase.from('machine_breakdowns')
      .select('*')
      .order('breakdown_start', { ascending: false })
      .limit(filter.limit ?? 100)

    if (filter.from)         query = query.gte('breakdown_start', filter.from)
    if (filter.to)           query = query.lte('breakdown_start', filter.to + 'T23:59:59')
    if (filter.workshop && filter.workshop !== 'ALL') query = query.eq('workshop', filter.workshop)
    if (filter.status && filter.status !== 'ALL')    query = query.eq('status', filter.status)
    if (filter.failure_type && filter.failure_type !== 'ALL') query = query.eq('failure_type', filter.failure_type)

    const scope = getWorkspaceScopedFilter(profile.role, profile.workspace)
    if (!scope.unrestricted) {
      if (scope.workspaces.length === 0) return { success: true, message: '', data: [] }
      query = query.in('workshop', scope.workspaces)
    }

    const { data, error } = await query
    if (error) return { success: false, message: error.message, data: [] }
    return { success: true, message: '', data: (data ?? []) as BreakdownRow[] }
  } catch (err) {
    logger.error({ err }, 'listBreakdownsAction error')
    return { success: false, message: String(err), data: [] }
  }
}

// ─── Maintenance Schedule ─────────────────────────────────────────────────────

export async function createScheduleAction(input: ScheduleCreateInput): Promise<ActionResult<string>> {
  try {
    const denied = await requireEdit('maintenance.schedule')
    if (denied) return denied

    const parsed = scheduleCreateSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    if (!profile || !canAccessWorkshop(profile, parsed.data.workshop)) {
      return { success: false, message: 'Không có quyền thao tác với xưởng này.' }
    }

    const { data, error } = await supabase.from('maintenance_schedule').insert({
      workshop:         parsed.data.workshop,
      machine_code:     parsed.data.machine_code,
      machine_name:     parsed.data.machine_name || null,
      maintenance_type: parsed.data.maintenance_type,
      scheduled_date:   parsed.data.scheduled_date,
      checklist_items:  parsed.data.checklist_items?.length ? parsed.data.checklist_items : null,
      technician:       parsed.data.technician || null,
      notes:            parsed.data.notes || null,
      requested_by:      user.id,
    }).select('id').single()

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã thêm lịch bảo trì.', id: data?.id }
  } catch (err) {
    logger.error({ err }, 'createScheduleAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function bulkCreateScheduleAction(input: ScheduleBulkCreateInput): Promise<ActionResult<number>> {
  try {
    const denied = await requireEdit('maintenance.schedule')
    if (denied) return denied

    const parsed = scheduleBulkCreateSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { start_date, end_date, frequency, workshop, machines,
            maintenance_type, checklist_items, technician, notes } = parsed.data
    if (!profile || !canAccessWorkshop(profile, workshop)) {
      return { success: false, message: 'Không có quyền thao tác với xưởng này.' }
    }

    const dates = generateMaintenanceScheduleDates(start_date, end_date, frequency)
    if (dates.length === 0) return { success: false, message: 'Không tạo được lịch nào trong khoảng ngày này.' }

    const totalRows = dates.length * machines.length
    if (totalRows > 500) {
      return { success: false, message: `Bạn đang tạo ${totalRows} lịch. Vui lòng thu hẹp khoảng ngày hoặc số thiết bị (tối đa 500 lịch/lần).` }
    }

    const { data: existingRows, error: existingError } = await supabase
      .from('maintenance_schedule')
      .select('machine_code,scheduled_date')
      .eq('workshop', workshop)
      .eq('maintenance_type', maintenance_type)
      .in('machine_code', machines.map((m) => m.machine_code))
      .gte('scheduled_date', start_date)
      .lte('scheduled_date', end_date)

    if (existingError) return { success: false, message: `Lỗi DB: ${existingError.message}` }

    const existingKeys = new Set(
      (existingRows ?? []).map((row) => `${row.machine_code}|||${row.scheduled_date}`)
    )

    const inserts = machines.flatMap((machine) =>
      dates
        .filter((d) => !existingKeys.has(`${machine.machine_code}|||${d}`))
        .map((d) => ({
          workshop,
          machine_code: machine.machine_code,
          machine_name: machine.machine_name || null,
          maintenance_type,
          scheduled_date: d,
          checklist_items: checklist_items?.length ? checklist_items : null,
          technician: technician || null,
          notes: notes || null,
          requested_by: user.id,
        }))
    )

    const skipped = totalRows - inserts.length
    if (inserts.length === 0) {
      return { success: true, message: `Không tạo lịch mới. ${skipped} lịch đã tồn tại.`, data: 0 }
    }

    const { error } = await supabase.from('maintenance_schedule').insert(inserts)
    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return {
      success: true,
      message: skipped > 0
        ? `Đã tạo ${inserts.length} lịch bảo trì, bỏ qua ${skipped} lịch đã tồn tại.`
        : `Đã tạo ${inserts.length} lịch bảo trì.`,
      data: inserts.length,
    }
  } catch (err) {
    logger.error({ err }, 'bulkCreateScheduleAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function completeScheduleAction(id: string, input: ScheduleCompleteInput): Promise<ActionResult> {
  try {
    const denied = await requireEdit('maintenance.schedule')
    if (denied) return denied

    const parsed = scheduleCompleteSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { data: existing, error: readError } = await supabase
      .from('maintenance_schedule')
      .select('workshop, approval_status')
      .eq('id', id)
      .single()

    if (readError || !existing) return { success: false, message: readError?.message ?? 'Không tìm thấy lịch bảo trì.' }
    if (!profile || !canAccessWorkshop(profile, String(existing.workshop))) {
      return { success: false, message: 'Không có quyền thao tác với xưởng này.' }
    }

    if (String(existing.approval_status) !== 'approved') {
      return { success: false, message: 'Lịch bảo trì phải được duyệt trước khi ghi nhận thực hiện.' }
    }

    const serviceDb = await createServiceClient()
    const { error } = await serviceDb.from('maintenance_schedule').update({
      actual_date:     parsed.data.actual_date,
      technician:      parsed.data.technician || null,
      notes:           parsed.data.notes || null,
      checklist_items: parsed.data.checklist_items?.length ? parsed.data.checklist_items : null,
    }).eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã đánh dấu hoàn thành bảo trì.' }
  } catch (err) {
    logger.error({ err }, 'completeScheduleAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function reviewScheduleAction(
  id: string,
  decision: 'approved' | 'rejected',
  note?: string
): Promise<ActionResult> {
  try {
    const denied = await requireEdit('maintenance.schedule')
    if (denied) return denied

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (!canApproveRequests(profile.role)) return { success: false, message: 'Chỉ Manager hoặc Admin được phê duyệt.' }
    if (!['approved', 'rejected'].includes(decision)) return { success: false, message: 'Trạng thái duyệt không hợp lệ.' }

    const { data: existing, error: readError } = await supabase
      .from('maintenance_schedule')
      .select('approval_status,workshop')
      .eq('id', id)
      .single()

    if (readError || !existing) return { success: false, message: readError?.message ?? 'Không tìm thấy lịch bảo trì.' }
    if (!canApproveWorkspace(profile.role, profile.workspace, String(existing.workshop))) {
      return { success: false, message: 'Không có quyền duyệt lịch của xưởng này.' }
    }
    if (String(existing.approval_status) !== 'pending') {
      return { success: false, message: 'Lịch bảo trì này đã được duyệt hoặc từ chối.' }
    }

    const { error } = await supabase
      .from('maintenance_schedule')
      .update({
        approval_status: decision,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        approval_note: note || null,
      })
      .eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return {
      success: true,
      message: decision === 'approved'
        ? 'Đã duyệt lịch bảo trì.'
        : 'Đã từ chối lịch bảo trì.',
    }
  } catch (err) {
    logger.error({ err }, 'reviewScheduleAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function updateScheduleAction(id: string, input: Partial<ScheduleCreateInput>): Promise<ActionResult> {
  try {
    const denied = await requireEdit('maintenance.schedule')
    if (denied) return denied

    const parsed = scheduleCreateSchema.partial().safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (!['ADMIN', 'MANAGER'].includes(profile.role)) return { success: false, message: 'Không có quyền cập nhật.' }

    const { data: existing, error: readError } = await supabase
      .from('maintenance_schedule')
      .select('workshop')
      .eq('id', id)
      .single()

    if (readError || !existing) return { success: false, message: readError?.message ?? 'Không tìm thấy lịch bảo trì.' }
    if (!canAccessWorkshop(profile, String(existing.workshop))) {
      return { success: false, message: 'Không có quyền cập nhật lịch của xưởng này.' }
    }
    if (parsed.data.workshop && !canAccessWorkshop(profile, parsed.data.workshop)) {
      return { success: false, message: 'Không có quyền chuyển lịch sang xưởng này.' }
    }

    const { error } = await supabase.from('maintenance_schedule').update({
      ...parsed.data,
      machine_name: parsed.data.machine_name || null,
      checklist_items: parsed.data.checklist_items?.length ? parsed.data.checklist_items : null,
      technician: parsed.data.technician || null,
      notes: parsed.data.notes || null,
    }).eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã cập nhật lịch bảo trì.' }
  } catch (err) {
    logger.error({ err }, 'updateScheduleAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function deleteScheduleAction(id: string): Promise<ActionResult> {
  try {
    const denied = await requireEdit('maintenance.schedule')
    if (denied) return denied

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (profile.role !== 'ADMIN') return { success: false, message: 'Chỉ Admin mới được xóa.' }

    const { error } = await supabase.from('maintenance_schedule').delete().eq('id', id)
    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã xóa lịch bảo trì.' }
  } catch (err) {
    logger.error({ err }, 'deleteScheduleAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function listScheduleAction(filter: {
  workshop?: string; from?: string; to?: string
  status?: 'pending' | 'completed' | 'ALL'
  completion_status?: 'pending' | 'completed' | 'ALL'
  approval_status?: 'pending' | 'approved' | 'rejected' | 'ALL'
  maintenance_type?: string; limit?: number
}): Promise<ActionResult<ScheduleRow[]>> {
  try {
    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Chưa đăng nhập', data: [] }

    let query = supabase.from('maintenance_schedule')
      .select('*')
      .order('scheduled_date', { ascending: false })
      .limit(filter.limit ?? 200)

    if (filter.from)  query = query.gte('scheduled_date', filter.from)
    if (filter.to)    query = query.lte('scheduled_date', filter.to)
    if (filter.workshop && filter.workshop !== 'ALL') query = query.eq('workshop', filter.workshop)
    if (filter.maintenance_type && filter.maintenance_type !== 'ALL') {
      query = query.eq('maintenance_type', filter.maintenance_type)
    }
    const completionStatus = filter.completion_status ?? filter.status
    if (completionStatus === 'completed')  query = query.not('actual_date', 'is', null)
    if (completionStatus === 'pending')    query = query.is('actual_date', null)
    if (filter.approval_status && filter.approval_status !== 'ALL') {
      query = query.eq('approval_status', filter.approval_status)
    }

    const scope = getWorkspaceScopedFilter(profile.role, profile.workspace)
    if (!scope.unrestricted) {
      if (scope.workspaces.length === 0) return { success: true, message: '', data: [] }
      query = query.in('workshop', scope.workspaces)
    }

    const { data, error } = await query
    if (error) return { success: false, message: error.message, data: [] }
    return { success: true, message: '', data: (data ?? []) as ScheduleRow[] }
  } catch (err) {
    logger.error({ err }, 'listScheduleAction error')
    return { success: false, message: String(err), data: [] }
  }
}

// ─── Technical Drawings ───────────────────────────────────────────────────────

export async function createDrawingAction(input: DrawingCreateInput): Promise<ActionResult<string>> {
  try {
    const denied = await requireEdit('maintenance.drawings')
    if (denied) return denied

    const parsed = drawingCreateSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { drawing_type: _, ...rest } = parsed.data

    const { data, error } = await supabase.from('technical_drawings').insert({
      drawing_code: rest.drawing_code,
      drawing_name: rest.drawing_name,
      customer:     rest.customer || null,
      project_code: rest.project_code || null,
      request_date: rest.request_date,
      due_date:     rest.due_date,
      drafter:      rest.drafter || null,
      notes:        rest.notes || null,
      status:       'in_progress',
    }).select('id').single()

    if (error) {
      if (error.code === '23505') return { success: false, message: 'Mã bản vẽ đã tồn tại.' }
      return { success: false, message: `Lỗi DB: ${error.message}` }
    }

    revalidate()
    return { success: true, message: 'Đã tạo yêu cầu bản vẽ.', id: data?.id }
  } catch (err) {
    logger.error({ err }, 'createDrawingAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function updateDrawingAction(id: string, input: Partial<DrawingCreateInput>): Promise<ActionResult> {
  try {
    const denied = await requireEdit('maintenance.drawings')
    if (denied) return denied

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (!['ADMIN', 'MANAGER'].includes(profile.role)) return { success: false, message: 'Không có quyền cập nhật.' }

    const { drawing_type: _, ...rest } = input

    const { error } = await supabase.from('technical_drawings').update({
      ...rest,
      customer:     rest.customer || null,
      project_code: rest.project_code || null,
      drafter:      rest.drafter || null,
      notes:        rest.notes || null,
    }).eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã cập nhật bản vẽ.' }
  } catch (err) {
    logger.error({ err }, 'updateDrawingAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function completeDrawingAction(id: string, input: DrawingCompleteInput): Promise<ActionResult> {
  try {
    const denied = await requireEdit('maintenance.drawings')
    if (denied) return denied

    const parsed = drawingCompleteSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { error } = await supabase.from('technical_drawings').update({
      delivered_date: parsed.data.delivered_date,
      has_errors:     parsed.data.has_errors,
      error_count:    parsed.data.has_errors ? (parsed.data.error_count ?? 0) : 0,
      error_details:  parsed.data.has_errors ? (parsed.data.error_details || null) : null,
      reviewer:       parsed.data.reviewer || null,
      status:         parsed.data.status,
    }).eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã bàn giao bản vẽ.' }
  } catch (err) {
    logger.error({ err }, 'completeDrawingAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function deleteDrawingAction(id: string): Promise<ActionResult> {
  try {
    const denied = await requireEdit('maintenance.drawings')
    if (denied) return denied

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (profile.role !== 'ADMIN') return { success: false, message: 'Chỉ Admin mới được xóa.' }

    const { error } = await supabase.from('technical_drawings').delete().eq('id', id)
    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã xóa bản vẽ.' }
  } catch (err) {
    logger.error({ err }, 'deleteDrawingAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function listDrawingsAction(filter: {
  from?: string; to?: string; status?: string; openOnly?: boolean; limit?: number
}): Promise<ActionResult<DrawingRow[]>> {
  try {
    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Chưa đăng nhập', data: [] }

    let query = supabase.from('technical_drawings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(filter.limit ?? 100)

    if (filter.from) query = query.gte('request_date', filter.from)
    if (filter.to)   query = query.lte('request_date', filter.to)
    if (filter.status && filter.status !== 'ALL') query = query.eq('status', filter.status)
    if (filter.openOnly) query = query.neq('status', 'released')

    const { data, error } = await query
    if (error) return { success: false, message: error.message, data: [] }
    return { success: true, message: '', data: (data ?? []) as DrawingRow[] }
  } catch (err) {
    logger.error({ err }, 'listDrawingsAction error')
    return { success: false, message: String(err), data: [] }
  }
}

// ─── Site Surveys ─────────────────────────────────────────────────────────────

export async function createSurveyAction(input: SurveyCreateInput): Promise<ActionResult<string>> {
  try {
    const denied = await requireEdit('maintenance.surveys')
    if (denied) return denied

    const parsed = surveyCreateSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { data, error } = await supabase.from('site_surveys').insert({
      survey_code:   parsed.data.survey_code,
      survey_date:   parsed.data.survey_date,
      project_code:  parsed.data.project_code || null,
      customer:      parsed.data.customer || null,
      surveyor:      parsed.data.surveyor || null,
      total_items:   parsed.data.total_items,
      error_items:   parsed.data.error_items,
      error_details: parsed.data.error_details?.length ? parsed.data.error_details : null,
      notes:         parsed.data.notes || null,
    }).select('id').single()

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã lưu kết quả khảo sát.', id: data?.id }
  } catch (err) {
    logger.error({ err }, 'createSurveyAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function updateSurveyAction(id: string, input: Partial<SurveyCreateInput>): Promise<ActionResult> {
  try {
    const denied = await requireEdit('maintenance.surveys')
    if (denied) return denied

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (!['ADMIN', 'MANAGER'].includes(profile.role)) return { success: false, message: 'Không có quyền cập nhật.' }

    const { error } = await supabase.from('site_surveys').update({
      ...input,
      project_code:  input.project_code || null,
      customer:      input.customer || null,
      surveyor:      input.surveyor || null,
      error_details: input.error_details?.length ? input.error_details : null,
      notes:         input.notes || null,
    }).eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã cập nhật khảo sát.' }
  } catch (err) {
    logger.error({ err }, 'updateSurveyAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function deleteSurveyAction(id: string): Promise<ActionResult> {
  try {
    const denied = await requireEdit('maintenance.surveys')
    if (denied) return denied

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (profile.role !== 'ADMIN') return { success: false, message: 'Chỉ Admin mới được xóa.' }

    const { error } = await supabase.from('site_surveys').delete().eq('id', id)
    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã xóa khảo sát.' }
  } catch (err) {
    logger.error({ err }, 'deleteSurveyAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function listSurveysAction(filter: {
  from?: string; to?: string; limit?: number
}): Promise<ActionResult<SurveyRow[]>> {
  try {
    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Chưa đăng nhập', data: [] }

    let query = supabase.from('site_surveys')
      .select('*')
      .order('survey_date', { ascending: false })
      .limit(filter.limit ?? 100)

    if (filter.from) query = query.gte('survey_date', filter.from)
    if (filter.to)   query = query.lte('survey_date', filter.to)

    const { data, error } = await query
    if (error) return { success: false, message: error.message, data: [] }
    return { success: true, message: '', data: (data ?? []) as SurveyRow[] }
  } catch (err) {
    logger.error({ err }, 'listSurveysAction error')
    return { success: false, message: String(err), data: [] }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function listMachineCodesAction(workshop?: string): Promise<{ machine_code: string; machine_name: string | null }[]> {
  try {
    const { user, supabase } = await requireAuth()
    if (!user) return []

    let query = supabase
      .from('machines')
      .select('machine_code, machine_name')
      .eq('machine_status', 'active')
      .not('machine_code', 'is', null)
      .order('machine_code')
    if (workshop && workshop !== 'ALL') query = query.eq('machine_location', workshop)

    const { data } = await query
    if (!data) return []
    return (data as { machine_code: string; machine_name: string }[]).map((r) => ({
      machine_code: r.machine_code,
      machine_name: r.machine_name,
    }))
  } catch {
    return []
  }
}

// Re-export types needed by MAINTENANCE_TYPES constant
// ─── Machines CRUD ────────────────────────────────────────────────────────────

export async function listMachinesAction(location?: string): Promise<ActionResult<MachineRow[]>> {
  try {
    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Chưa đăng nhập', data: [] }

    let query = supabase.from('machines').select('*').order('machine_location').order('machine_code')
    if (location && location !== 'ALL') query = query.eq('machine_location', location)

    const { data, error } = await query
    if (error) return { success: false, message: error.message, data: [] }
    return { success: true, message: '', data: (data ?? []) as MachineRow[] }
  } catch (err) {
    logger.error({ err }, 'listMachinesAction error')
    return { success: false, message: String(err), data: [] }
  }
}

export async function createMachineAction(input: MachineCreateInput): Promise<ActionResult<string>> {
  try {
    const denied = await requireEdit('maintenance.machines')
    if (denied) return denied

    const parsed = machineCreateSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (!['ADMIN', 'MANAGER'].includes(profile.role)) return { success: false, message: 'Không có quyền thêm.' }

    const { data, error } = await supabase.from('machines').insert({
      machine_name:     parsed.data.machine_name,
      machine_code:     parsed.data.machine_code || null,
      machine_location: parsed.data.machine_location,
      machine_status:   parsed.data.machine_status,
      machine_capacity: parsed.data.machine_capacity || null,
    }).select('id').single()

    if (error) {
      if (error.code === '23505') return { success: false, message: 'Mã thiết bị đã tồn tại.' }
      return { success: false, message: `Lỗi DB: ${error.message}` }
    }

    revalidatePath('/dashboard/maintenance')
    return { success: true, message: 'Đã thêm thiết bị.', id: data?.id }
  } catch (err) {
    logger.error({ err }, 'createMachineAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function updateMachineAction(id: string, input: MachineCreateInput): Promise<ActionResult> {
  try {
    const denied = await requireEdit('maintenance.machines')
    if (denied) return denied

    const parsed = machineCreateSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (!['ADMIN', 'MANAGER'].includes(profile.role)) return { success: false, message: 'Không có quyền cập nhật.' }

    const { error } = await supabase.from('machines').update({
      machine_name:     parsed.data.machine_name,
      machine_code:     parsed.data.machine_code || null,
      machine_location: parsed.data.machine_location,
      machine_status:   parsed.data.machine_status,
      machine_capacity: parsed.data.machine_capacity || null,
    }).eq('id', id)

    if (error) {
      if (error.code === '23505') return { success: false, message: 'Mã thiết bị đã tồn tại.' }
      return { success: false, message: `Lỗi DB: ${error.message}` }
    }

    revalidatePath('/dashboard/maintenance')
    return { success: true, message: 'Đã cập nhật thiết bị.' }
  } catch (err) {
    logger.error({ err }, 'updateMachineAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function deleteMachineAction(id: string): Promise<ActionResult> {
  try {
    const denied = await requireEdit('maintenance.machines')
    if (denied) return denied

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (profile.role !== 'ADMIN') return { success: false, message: 'Chỉ Admin mới được xóa.' }

    const { error } = await supabase.from('machines').delete().eq('id', id)
    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidatePath('/dashboard/maintenance')
    return { success: true, message: 'Đã xóa thiết bị.' }
  } catch (err) {
    logger.error({ err }, 'deleteMachineAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

// ─── Staff lookup (human_resource table) ─────────────────────────────────────

export async function listStaffByWorkshopAction(factory: string): Promise<{ id: number; name: string }[]> {
  try {
    const { user, supabase } = await requireAuth()
    if (!user) return []

    const { data } = await supabase
      .from('human_resource')
      .select('id, name')
      .eq('factory', factory)
      .order('name')

    return (data ?? []) as { id: number; name: string }[]
  } catch {
    return []
  }
}
