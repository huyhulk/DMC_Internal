'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  deliveryCreateSchema, deliveryCompleteSchema, deliveryBaselineSchema,
  finding5sCreateSchema, finding5sResolveSchema,
  statReportCreateSchema, statReportBulkSchema, statReportSubmitSchema,
  isoCreateSchema, isoUpdateProgressSchema, isoCompleteSchema,
  type DeliveryCreateInput, type DeliveryCompleteInput, type DeliveryBaselineInput,
  type Finding5sCreateInput, type Finding5sResolveInput,
  type StatReportCreateInput, type StatReportBulkInput, type StatReportSubmitInput,
  type IsoCreateInput, type IsoUpdateProgressInput, type IsoCompleteInput,
  REPORT_TYPES,
} from '@/lib/validations/coordination'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeliveryRow = {
  id: string; delivery_code: string; pcode: string | null; customer: string
  delivery_address: string | null; planned_date: string; actual_date: string | null
  is_on_time: boolean | null; total_weight_tons: number; damaged_weight_tons: number
  damage_pct: number; damage_reason: string | null; vehicle_code: string | null
  driver: string | null; delivery_cost: number | null; cost_per_ton: number | null
  status: string; notes: string | null; created_at: string
}

export type BaselineRow = {
  id: string; year: number; month: number | null; avg_cost_per_ton: number; notes: string | null
}

export type Finding5sRow = {
  id: string; finding_date: string; workshop: string; department: string
  area: string | null; category: string; description: string; photo_url: string | null
  severity: string; due_date: string; resolved_date: string | null
  is_resolved: boolean; is_on_time: boolean | null; responsible_person: string | null
  resolution_notes: string | null; created_at: string
}

export type StatReportRow = {
  id: string; report_name: string; report_type: string | null; due_date: string
  submitted_date: string | null; is_on_time: boolean | null; recipient: string | null
  responsible_person: string | null; status: string; notes: string | null; created_at: string
}

export type IsoProcedureRow = {
  id: string; procedure_code: string; procedure_name: string; category: string | null
  planned_completion_date: string; actual_completion_date: string | null
  is_on_time: boolean | null; progress_pct: number; responsible_person: string | null
  status: string; document_url: string | null; notes: string | null; created_at: string
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

function revalidate() {
  revalidatePath('/dashboard/coordination')
  revalidatePath('/dashboard/report/kpi')
}

// ─── Deliveries ───────────────────────────────────────────────────────────────

export async function createDeliveryAction(input: DeliveryCreateInput): Promise<ActionResult<string>> {
  try {
    const parsed = deliveryCreateSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { data, error } = await supabase.from('deliveries').insert({
      delivery_code:    parsed.data.delivery_code,
      pcode:            parsed.data.pcode || null,
      customer:         parsed.data.customer,
      delivery_address: parsed.data.delivery_address || null,
      planned_date:     parsed.data.planned_date,
      total_weight_tons: parsed.data.total_weight_tons,
      vehicle_code:     parsed.data.vehicle_code || null,
      driver:           parsed.data.driver || null,
      notes:            parsed.data.notes || null,
      status:           'planned',
    }).select('id').single()

    if (error) {
      if (error.code === '23505') return { success: false, message: 'Mã giao hàng đã tồn tại.' }
      return { success: false, message: `Lỗi DB: ${error.message}` }
    }

    revalidate()
    return { success: true, message: 'Đã tạo lịch giao hàng.', id: data?.id }
  } catch (err) {
    logger.error({ err }, 'createDeliveryAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function updateDeliveryAction(id: string, input: Partial<DeliveryCreateInput>): Promise<ActionResult> {
  try {
    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (!['ADMIN', 'MANAGER'].includes(profile.role)) return { success: false, message: 'Không có quyền cập nhật.' }

    const { error } = await supabase.from('deliveries').update({
      ...input,
      pcode:            input.pcode || null,
      delivery_address: input.delivery_address || null,
      vehicle_code:     input.vehicle_code || null,
      driver:           input.driver || null,
      notes:            input.notes || null,
    }).eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã cập nhật giao hàng.' }
  } catch (err) {
    logger.error({ err }, 'updateDeliveryAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function completeDeliveryAction(id: string, input: DeliveryCompleteInput): Promise<ActionResult> {
  try {
    const parsed = deliveryCompleteSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    // If damaged weight is recorded, force status to 'damaged' regardless of what was submitted
    const finalStatus = (parsed.data.damaged_weight_tons ?? 0) > 0 ? 'damaged' : parsed.data.status

    const { error } = await supabase.from('deliveries').update({
      actual_date:         parsed.data.actual_date,
      damaged_weight_tons: parsed.data.damaged_weight_tons ?? 0,
      damage_reason:       parsed.data.damage_reason || null,
      delivery_cost:       parsed.data.delivery_cost ?? null,
      status:              finalStatus,
    }).eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã cập nhật kết quả giao hàng.' }
  } catch (err) {
    logger.error({ err }, 'completeDeliveryAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function cancelDeliveryAction(id: string, reason?: string): Promise<ActionResult> {
  try {
    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { error } = await supabase.from('deliveries').update({
      status: 'cancelled',
      notes:  reason || null,
    }).eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã hủy lịch giao hàng.' }
  } catch (err) {
    logger.error({ err }, 'cancelDeliveryAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function startDeliveryAction(id: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { error } = await supabase.from('deliveries').update({ status: 'in_transit' }).eq('id', id)
    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã bắt đầu giao hàng.' }
  } catch (err) {
    logger.error({ err }, 'startDeliveryAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function deleteDeliveryAction(id: string): Promise<ActionResult> {
  try {
    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (profile.role !== 'ADMIN') return { success: false, message: 'Chỉ Admin mới được xóa.' }

    const { error } = await supabase.from('deliveries').delete().eq('id', id)
    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã xóa lịch giao hàng.' }
  } catch (err) {
    logger.error({ err }, 'deleteDeliveryAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function listDeliveriesAction(filter: {
  from?: string; to?: string; status?: string; limit?: number
}): Promise<ActionResult<DeliveryRow[]>> {
  try {
    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Chưa đăng nhập', data: [] }

    let query = supabase.from('deliveries')
      .select('*')
      .order('planned_date', { ascending: false })
      .limit(filter.limit ?? 100)

    if (filter.from) query = query.gte('planned_date', filter.from)
    if (filter.to)   query = query.lte('planned_date', filter.to)
    if (filter.status && filter.status !== 'ALL') query = query.eq('status', filter.status)

    const { data, error } = await query
    if (error) return { success: false, message: error.message, data: [] }
    return { success: true, message: '', data: (data ?? []) as DeliveryRow[] }
  } catch (err) {
    logger.error({ err }, 'listDeliveriesAction error')
    return { success: false, message: String(err), data: [] }
  }
}

// ─── Cost Baseline ────────────────────────────────────────────────────────────

export async function upsertCostBaselineAction(input: DeliveryBaselineInput): Promise<ActionResult> {
  try {
    const parsed = deliveryBaselineSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (profile.role !== 'ADMIN') return { success: false, message: 'Chỉ Admin mới được cập nhật baseline.' }

    const { error } = await supabase.from('delivery_cost_baseline').upsert({
      year:              parsed.data.year,
      month:             parsed.data.month ?? null,
      avg_cost_per_ton:  parsed.data.avg_cost_per_ton,
      notes:             parsed.data.notes || null,
    }, { onConflict: 'year,month' })

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidatePath('/dashboard/report/kpi')
    return { success: true, message: 'Đã cập nhật baseline chi phí.' }
  } catch (err) {
    logger.error({ err }, 'upsertCostBaselineAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function listCostBaselinesAction(): Promise<ActionResult<BaselineRow[]>> {
  try {
    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Chưa đăng nhập', data: [] }

    const { data, error } = await supabase.from('delivery_cost_baseline')
      .select('*').order('year', { ascending: false }).order('month', { ascending: true })

    if (error) return { success: false, message: error.message, data: [] }
    return { success: true, message: '', data: (data ?? []) as BaselineRow[] }
  } catch (err) {
    return { success: false, message: String(err), data: [] }
  }
}

// ─── Findings 5S ─────────────────────────────────────────────────────────────

export async function createFinding5sAction(input: Finding5sCreateInput): Promise<ActionResult<string>> {
  try {
    const parsed = finding5sCreateSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { data, error } = await supabase.from('findings_5s').insert({
      finding_date:       parsed.data.finding_date,
      workshop:           parsed.data.workshop,
      department:         parsed.data.department,
      area:               parsed.data.area || null,
      category:           parsed.data.category,
      description:        parsed.data.description,
      severity:           parsed.data.severity,
      due_date:           parsed.data.due_date,
      responsible_person: parsed.data.responsible_person || null,
      photo_url:          parsed.data.photo_url || null,
      created_by:         user.id,
    }).select('id').single()

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã lưu phát hiện 5S.', id: data?.id }
  } catch (err) {
    logger.error({ err }, 'createFinding5sAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function resolveFinding5sAction(id: string, input: Finding5sResolveInput): Promise<ActionResult> {
  try {
    const parsed = finding5sResolveSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { error } = await supabase.from('findings_5s').update({
      resolved_date:    parsed.data.resolved_date,
      resolution_notes: parsed.data.resolution_notes || null,
    }).eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã đánh dấu xử lý 5S.' }
  } catch (err) {
    logger.error({ err }, 'resolveFinding5sAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function updateFinding5sAction(id: string, input: Partial<Finding5sCreateInput>): Promise<ActionResult> {
  try {
    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (!['ADMIN', 'MANAGER'].includes(profile.role)) return { success: false, message: 'Không có quyền cập nhật.' }

    const { error } = await supabase.from('findings_5s').update({
      ...input,
      area:               input.area || null,
      responsible_person: input.responsible_person || null,
      photo_url:          input.photo_url || null,
    }).eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã cập nhật phát hiện 5S.' }
  } catch (err) {
    logger.error({ err }, 'updateFinding5sAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function deleteFinding5sAction(id: string): Promise<ActionResult> {
  try {
    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (profile.role !== 'ADMIN') return { success: false, message: 'Chỉ Admin mới được xóa.' }

    const { error } = await supabase.from('findings_5s').delete().eq('id', id)
    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã xóa phát hiện 5S.' }
  } catch (err) {
    logger.error({ err }, 'deleteFinding5sAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function listFindings5sAction(filter: {
  dept: 'PRODUCTION' | 'COORDINATION' | 'MAINTENANCE' | 'ALL'
  from?: string; to?: string; workshop?: string; status?: string; limit?: number
}): Promise<ActionResult<Finding5sRow[]>> {
  try {
    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Chưa đăng nhập', data: [] }

    let query = supabase.from('findings_5s')
      .select('*')
      .order('finding_date', { ascending: false })
      .limit(filter.limit ?? 100)

    if (filter.dept !== 'ALL') query = query.eq('department', filter.dept)
    if (filter.from) query = query.gte('finding_date', filter.from)
    if (filter.to)   query = query.lte('finding_date', filter.to)
    if (filter.workshop && filter.workshop !== 'ALL') query = query.eq('workshop', filter.workshop)
    if (filter.status === 'resolved')  query = query.not('resolved_date', 'is', null)
    if (filter.status === 'pending')   query = query.is('resolved_date', null)

    const { data, error } = await query
    if (error) return { success: false, message: error.message, data: [] }
    return { success: true, message: '', data: (data ?? []) as Finding5sRow[] }
  } catch (err) {
    logger.error({ err }, 'listFindings5sAction error')
    return { success: false, message: String(err), data: [] }
  }
}

// ─── Statistical Reports ──────────────────────────────────────────────────────

export async function createStatReportAction(input: StatReportCreateInput): Promise<ActionResult<string>> {
  try {
    const parsed = statReportCreateSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { data, error } = await supabase.from('statistical_reports').insert({
      report_name:        parsed.data.report_name,
      report_type:        parsed.data.report_type ?? null,
      due_date:           parsed.data.due_date,
      recipient:          parsed.data.recipient || null,
      responsible_person: parsed.data.responsible_person || null,
      notes:              parsed.data.notes || null,
      status:             'pending',
    }).select('id').single()

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã thêm báo cáo.', id: data?.id }
  } catch (err) {
    logger.error({ err }, 'createStatReportAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function bulkCreateStatReportAction(input: StatReportBulkInput): Promise<ActionResult<number>> {
  try {
    const parsed = statReportBulkSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { start_date, end_date, frequency, report_name, report_type,
            recipient, responsible_person, notes } = parsed.data

    const dates: string[] = []
    const cur = new Date(start_date)
    const endD = new Date(end_date)

    while (cur <= endD) {
      dates.push(cur.toISOString().split('T')[0])
      if (frequency === 'weekly')     cur.setDate(cur.getDate() + 7)
      else if (frequency === 'monthly')   cur.setMonth(cur.getMonth() + 1)
      else if (frequency === 'quarterly') cur.setMonth(cur.getMonth() + 3)
    }

    if (dates.length === 0) return { success: false, message: 'Không tạo được báo cáo nào.' }

    const inserts = dates.map((d, i) => ({
      report_name:        `${report_name} — ${i + 1}`,
      report_type:        report_type ?? null,
      due_date:           d,
      recipient:          recipient || null,
      responsible_person: responsible_person || null,
      notes:              notes || null,
      status:             'pending',
    }))

    const { error } = await supabase.from('statistical_reports').insert(inserts)
    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: `Đã tạo ${dates.length} báo cáo.`, data: dates.length }
  } catch (err) {
    logger.error({ err }, 'bulkCreateStatReportAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function submitStatReportAction(id: string, input: StatReportSubmitInput): Promise<ActionResult> {
  try {
    const parsed = statReportSubmitSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { error } = await supabase.from('statistical_reports').update({
      submitted_date: parsed.data.submitted_date,
      notes:          parsed.data.notes || null,
      status:         'submitted',
    }).eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã nộp báo cáo.' }
  } catch (err) {
    logger.error({ err }, 'submitStatReportAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function updateStatReportAction(id: string, input: Partial<StatReportCreateInput>): Promise<ActionResult> {
  try {
    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (!['ADMIN', 'MANAGER'].includes(profile.role)) return { success: false, message: 'Không có quyền cập nhật.' }

    const { error } = await supabase.from('statistical_reports').update({
      ...input,
      report_type:        input.report_type ?? null,
      recipient:          input.recipient || null,
      responsible_person: input.responsible_person || null,
      notes:              input.notes || null,
    }).eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã cập nhật báo cáo.' }
  } catch (err) {
    logger.error({ err }, 'updateStatReportAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function deleteStatReportAction(id: string): Promise<ActionResult> {
  try {
    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (profile.role !== 'ADMIN') return { success: false, message: 'Chỉ Admin mới được xóa.' }

    const { error } = await supabase.from('statistical_reports').delete().eq('id', id)
    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã xóa báo cáo.' }
  } catch (err) {
    logger.error({ err }, 'deleteStatReportAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function listStatReportsAction(filter: {
  from?: string; to?: string; status?: string; limit?: number
}): Promise<ActionResult<StatReportRow[]>> {
  try {
    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Chưa đăng nhập', data: [] }

    let query = supabase.from('statistical_reports')
      .select('*')
      .order('due_date', { ascending: false })
      .limit(filter.limit ?? 100)

    if (filter.from) query = query.gte('due_date', filter.from)
    if (filter.to)   query = query.lte('due_date', filter.to)
    if (filter.status && filter.status !== 'ALL') query = query.eq('status', filter.status)

    const { data, error } = await query
    if (error) return { success: false, message: error.message, data: [] }
    return { success: true, message: '', data: (data ?? []) as StatReportRow[] }
  } catch (err) {
    logger.error({ err }, 'listStatReportsAction error')
    return { success: false, message: String(err), data: [] }
  }
}

// ─── ISO Procedures ───────────────────────────────────────────────────────────

export async function createIsoAction(input: IsoCreateInput): Promise<ActionResult<string>> {
  try {
    const parsed = isoCreateSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { data, error } = await supabase.from('iso_procedures').insert({
      procedure_code:          parsed.data.procedure_code,
      procedure_name:          parsed.data.procedure_name,
      category:                parsed.data.category ?? null,
      planned_completion_date: parsed.data.planned_completion_date,
      responsible_person:      parsed.data.responsible_person || null,
      notes:                   parsed.data.notes || null,
      status:                  'draft',
      progress_pct:            0,
    }).select('id').single()

    if (error) {
      if (error.code === '23505') return { success: false, message: 'Mã quy trình đã tồn tại.' }
      return { success: false, message: `Lỗi DB: ${error.message}` }
    }

    revalidate()
    return { success: true, message: 'Đã thêm quy trình ISO.', id: data?.id }
  } catch (err) {
    logger.error({ err }, 'createIsoAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function updateIsoProgressAction(id: string, progress_pct: number): Promise<ActionResult> {
  try {
    const parsed = isoUpdateProgressSchema.safeParse({ progress_pct })
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const status = progress_pct >= 100 ? 'reviewing' : 'draft'

    const { error } = await supabase.from('iso_procedures').update({
      progress_pct: parsed.data.progress_pct,
      status,
    }).eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã cập nhật tiến độ.' }
  } catch (err) {
    logger.error({ err }, 'updateIsoProgressAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function completeIsoAction(id: string, input: IsoCompleteInput): Promise<ActionResult> {
  try {
    const parsed = isoCompleteSchema.safeParse(input)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }

    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Phiên đăng nhập hết hạn.' }

    const { error } = await supabase.from('iso_procedures').update({
      actual_completion_date: parsed.data.actual_completion_date,
      document_url:           parsed.data.document_url || null,
      status:                 parsed.data.status,
      progress_pct:           100,
    }).eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã hoàn thành quy trình ISO.' }
  } catch (err) {
    logger.error({ err }, 'completeIsoAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function updateIsoAction(id: string, input: Partial<IsoCreateInput>): Promise<ActionResult> {
  try {
    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (!['ADMIN', 'MANAGER'].includes(profile.role)) return { success: false, message: 'Không có quyền cập nhật.' }

    const { error } = await supabase.from('iso_procedures').update({
      ...input,
      category:           input.category ?? null,
      responsible_person: input.responsible_person || null,
      notes:              input.notes || null,
    }).eq('id', id)

    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã cập nhật quy trình ISO.' }
  } catch (err) {
    logger.error({ err }, 'updateIsoAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function deleteIsoAction(id: string): Promise<ActionResult> {
  try {
    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Phiên đăng nhập hết hạn.' }
    if (profile.role !== 'ADMIN') return { success: false, message: 'Chỉ Admin mới được xóa.' }

    const { error } = await supabase.from('iso_procedures').delete().eq('id', id)
    if (error) return { success: false, message: `Lỗi DB: ${error.message}` }

    revalidate()
    return { success: true, message: 'Đã xóa quy trình ISO.' }
  } catch (err) {
    logger.error({ err }, 'deleteIsoAction error')
    return { success: false, message: 'Lỗi không xác định: ' + String(err) }
  }
}

export async function listIsoAction(filter: {
  from?: string; to?: string; status?: string; limit?: number
}): Promise<ActionResult<IsoProcedureRow[]>> {
  try {
    const { user, supabase } = await requireAuth()
    if (!user) return { success: false, message: 'Chưa đăng nhập', data: [] }

    let query = supabase.from('iso_procedures')
      .select('*')
      .order('planned_completion_date', { ascending: false })
      .limit(filter.limit ?? 100)

    if (filter.from) query = query.gte('planned_completion_date', filter.from)
    if (filter.to)   query = query.lte('planned_completion_date', filter.to)
    if (filter.status && filter.status !== 'ALL') query = query.eq('status', filter.status)

    const { data, error } = await query
    if (error) return { success: false, message: error.message, data: [] }
    return { success: true, message: '', data: (data ?? []) as IsoProcedureRow[] }
  } catch (err) {
    logger.error({ err }, 'listIsoAction error')
    return { success: false, message: String(err), data: [] }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function listCustomersAction(): Promise<string[]> {
  try {
    const { user, supabase } = await requireAuth()
    if (!user) return []

    const { data } = await supabase.from('data').select('"CUSTOMER"').not('"CUSTOMER"', 'is', null).limit(500)
    if (!data) return []

    const seen = new Set<string>()
    for (const row of data as { CUSTOMER: string | null }[]) {
      if (row.CUSTOMER) seen.add(row.CUSTOMER)
    }
    return Array.from(seen).sort()
  } catch {
    return []
  }
}

export async function listVehicleCodesAction(): Promise<string[]> {
  try {
    const { user, supabase } = await requireAuth()
    if (!user) return []

    const { data } = await supabase.from('deliveries')
      .select('vehicle_code').not('vehicle_code', 'is', null).limit(200)
    if (!data) return []

    const seen = new Set<string>()
    for (const row of data as { vehicle_code: string | null }[]) {
      if (row.vehicle_code) seen.add(row.vehicle_code)
    }
    return Array.from(seen).sort()
  } catch {
    return []
  }
}

export { REPORT_TYPES }
