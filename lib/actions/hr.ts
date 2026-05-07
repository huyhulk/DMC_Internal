'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'
import { z } from 'zod'
import { getSessionUser } from '@/lib/actions/auth'
import { canAccessWorkspace, getWorkspaceScopedFilter } from '@/lib/approval/workflow'
import { requireTabEdit, requireTabView } from '@/lib/permissions/server'
import { calcDurationHours, normalizeWorkshop, workshopCode } from '@/lib/utils'
import { calculateHRLaborHoursByFactory, elapsedWorkHours, getVietnamNow, isProductionHRGroup } from '@/lib/hr/workflow'
import {
  HR_DAILY_GROUPS,
  HUMAN_RESOURCE_FACTORIES,
  type HumanResource,
  type HRDailyGroupKey,
  type HRDayData,
  type HRTransferRecord,
  type HumanResourceFactoryKey,
  type SessionUser,
} from '@/types'

// Direct admin client — same pattern as lib/db/queries.ts
function getDb() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// ─── Constants & Types ────────────────────────────────────────────────────────

type HRProfile = Pick<SessionUser, 'role' | 'workspace'>
const PRODUCTION_GROUPS = ['DMC1', 'DMC3', 'DMC4', 'DMC5'] as const satisfies readonly HRDailyGroupKey[]

type HRDailyRow = {
  factory: string
  totalem: number | null
  absent_ids: number[] | null
  transferred_ids: number[] | null
  transfer_records: HRTransferRecord[] | null
  auto_filled: boolean | null
  pdate: string | null
}

type ProductionEfficiencySourceRow = {
  pcode: string | null
  workforce: number | null
  starttime: string | null
  endtime: string | null
}

type DataWorkshopRow = {
  PCODE: string
  WORKSHOP: string | null
}

export interface HREfficiencyRow {
  factory: HRDailyGroupKey
  productionLaborHours: number
  elapsedHours: number
  actualHeadcount: number
  availableLaborHours: number
  transferredOutHours: number
  transferredInHours: number
  efficiency: number | null
  warnings: string[]
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

const transferRecordSchema = z.object({
  employeeId: z.number().int().positive(),
  fromFactory: z.enum(HR_DAILY_GROUPS),
  toFactory: z.enum(HR_DAILY_GROUPS),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ bắt đầu điều chuyển không hợp lệ'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ kết thúc điều chuyển không hợp lệ'),
})

const saveHRDailySchema = z.object({
  date: dateSchema,
  factory: z.enum(HR_DAILY_GROUPS),
  absentIds: z.array(z.number().int().positive()),
  transferRecords: z.array(transferRecordSchema),
})

const humanResourceSchema = z.object({
  name: z.string().min(1, 'Họ tên không được để trống'),
  factory: z.enum(HUMAN_RESOURCE_FACTORIES, { required_error: 'Nhà máy không được để trống' }),
  machine: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
})

async function requireHREditUser(): Promise<SessionUser | null> {
  return requireTabEdit('administration.hr')
}

function canAccessFactory(profile: HRProfile, factory: string): boolean {
  return canAccessWorkspace(profile.role, profile.workspace, factory)
}

function getVisibleHumanResourceFactories(profile: HRProfile): HumanResourceFactoryKey[] {
  return HUMAN_RESOURCE_FACTORIES.filter((factory) => canAccessFactory(profile, factory)) as HumanResourceFactoryKey[]
}

function getVisibleHRDailyGroups(profile: HRProfile): HRDailyGroupKey[] {
  return HR_DAILY_GROUPS.filter((factory) => canAccessFactory(profile, factory))
}

function countEmployeesByGroup(employees: HumanResource[]): Map<HRDailyGroupKey, number> {
  const counts = new Map<HRDailyGroupKey, number>()
  for (const group of HR_DAILY_GROUPS) counts.set(group, 0)
  for (const employee of employees) {
    if ((HR_DAILY_GROUPS as readonly string[]).includes(employee.factory ?? '')) {
      const group = employee.factory as HRDailyGroupKey
      counts.set(group, (counts.get(group) ?? 0) + 1)
    }
  }
  return counts
}

function uniqueIds(ids: number[]): number[] {
  return Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)))
}

function timeToMinutes(value: string): number | null {
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

function normalizeTransferRecords(factory: HRDailyGroupKey, absentIds: number[], records: HRTransferRecord[]): { records: HRTransferRecord[]; error?: string } {
  const absent = new Set(absentIds)
  const normalized: HRTransferRecord[] = []
  const intervalsByEmployee = new Map<number, Array<{ start: number; end: number }>>()

  for (const record of records) {
    if (record.fromFactory !== factory) return { records: [], error: 'Xưởng đi không khớp với xưởng đang lưu.' }
    if (record.toFactory === factory) return { records: [], error: 'Xưởng đến phải khác xưởng hiện tại.' }
    if (absent.has(record.employeeId)) return { records: [], error: 'Nhân sự đã nghỉ không thể điều chuyển.' }

    const start = timeToMinutes(record.startTime)
    const end = timeToMinutes(record.endTime)
    if (start === null || end === null) return { records: [], error: 'Giờ điều chuyển không hợp lệ.' }
    if (end <= start) return { records: [], error: 'Giờ kết thúc điều chuyển phải sau giờ bắt đầu.' }

    const intervals = intervalsByEmployee.get(record.employeeId) ?? []
    if (intervals.some((interval) => start < interval.end && end > interval.start)) {
      return { records: [], error: 'Một nhân sự không thể có nhiều khoảng điều chuyển chồng giờ.' }
    }
    intervals.push({ start, end })
    intervalsByEmployee.set(record.employeeId, intervals)

    normalized.push({
      employeeId: record.employeeId,
      fromFactory: record.fromFactory,
      toFactory: record.toFactory,
      startTime: record.startTime,
      endTime: record.endTime,
    })
  }

  return { records: normalized }
}

function parseTransferRecords(value: unknown): HRTransferRecord[] {
  const parsed = z.array(transferRecordSchema).safeParse(value)
  return parsed.success ? parsed.data : []
}

function shouldEnsureDefaultRows(date: string): boolean {
  const now = getVietnamNow()
  return date === now.date && (now.hour > 16 || (now.hour === 16 && now.minute >= 0))
}

// ─── getHRData ────────────────────────────────────────────────────────────────

export async function getHRData(
  date: string,
  scopeUser?: HRProfile
): Promise<{ employees: HumanResource[]; dailyData: HRDayData[] }> {
  const parsedDate = dateSchema.safeParse(date)
  if (!parsedDate.success) {
    logger.warn({ date }, 'getHRData: invalid date')
    return { employees: [], dailyData: [] }
  }

  const profile = scopeUser ?? await getSessionUser()
  if (!profile) return { employees: [], dailyData: [] }
  const scope = getWorkspaceScopedFilter(profile.role, profile.workspace)
  if (!scope.unrestricted && scope.workspaces.length === 0) return { employees: [], dailyData: [] }

  const factories = getVisibleHumanResourceFactories(profile)
  const dailyGroups = getVisibleHRDailyGroups(profile)
  const supabase = getDb()

  const [empRes, dailyRes] = await Promise.all([
    supabase
      .from('human_resource')
      .select('id,name,factory,machine,position,phone')
      .in('factory', [...factories])
      .order('name', { ascending: true }),
    supabase
      .from('hr_daily')
      .select('factory,totalem,absent_ids,transferred_ids,transfer_records,auto_filled,pdate')
      .eq('pdate', date)
      .in('factory', [...dailyGroups]),
  ])

  if (empRes.error) {
    logger.error({ err: empRes.error.message }, 'getHRData: employees query failed')
  }
  if (dailyRes.error) {
    logger.error({ err: dailyRes.error.message }, 'getHRData: hr_daily query failed')
  }

  const employees: HumanResource[] = (empRes.data ?? []).map((row) => ({
    id: row.id as number,
    name: row.name as string,
    factory: row.factory as string | null,
    machine: row.machine as string | null,
    position: row.position as string | null,
    phone: row.phone as string | null,
  }))

  const headcountByGroup = countEmployeesByGroup(employees)
  const todayMap = new Map<string, HRDailyRow>()
  for (const row of (dailyRes.data ?? []) as HRDailyRow[]) {
    todayMap.set(row.factory, row)
  }

  const dailyData: HRDayData[] = dailyGroups.map((factory) => {
    const todayRow = todayMap.get(factory)
    return {
      factory,
      totalem: headcountByGroup.get(factory) ?? 0,
      absentIds: todayRow?.absent_ids ?? [],
      transferredIds: todayRow?.transferred_ids ?? [],
      transferRecords: parseTransferRecords(todayRow?.transfer_records ?? []),
      isAutoFilled: todayRow?.auto_filled ?? !todayRow,
    }
  })

  logger.info(
    { date, employees: employees.length, dailyFactories: dailyData.length },
    'getHRData success'
  )

  return { employees, dailyData }
}

// ─── saveHRDaily ─────────────────────────────────────────────────────────────

export async function saveHRDaily(
  date: string,
  factory: string,
  absentIds: number[],
  transferRecords: HRTransferRecord[] = []
): Promise<{ success: boolean; error?: string }> {
  const parsed = saveHRDailySchema.safeParse({ date, factory, absentIds, transferRecords })
  if (!parsed.success) {
    const msg = parsed.error.errors[0].message
    logger.warn({ date, factory, zodError: msg }, 'saveHRDaily: validation failed')
    return { success: false, error: msg }
  }

  const { date: pdate, factory: fac } = parsed.data
  const absent = uniqueIds(parsed.data.absentIds)
  const transferResult = normalizeTransferRecords(fac, absent, parsed.data.transferRecords)
  if (transferResult.error) return { success: false, error: transferResult.error }
  const transfers = transferResult.records
  const transferred = uniqueIds(transfers.map((record) => record.employeeId))
  const user = await requireHREditUser()
  if (!user) return { success: false, error: 'Không có quyền cập nhật nhân sự.' }
  if (!canAccessFactory(user, fac)) return { success: false, error: 'Không có quyền cập nhật xưởng này.' }

  const supabase = getDb()
  const total = await getHeadcountForGroup(supabase, fac)

  const { error: upsertError } = await supabase
    .from('hr_daily')
    .upsert(
      {
        factory: fac,
        pdate,
        totalem: total,
        absent_ids: absent,
        transferred_ids: transferred,
        transfer_records: transfers,
        auto_filled: false,
        auto_filled_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'factory,pdate' }
    )

  if (upsertError) {
    logger.error({ err: upsertError.message, factory: fac, date: pdate }, 'saveHRDaily: upsert failed')
    return { success: false, error: upsertError.message }
  }

  logger.info({ factory: fac, date: pdate, totalem: total, absentCount: absent.length, transferredCount: transferred.length }, 'saveHRDaily success')
  return { success: true }
}

async function getHeadcountForGroup(supabase: ReturnType<typeof getDb>, factory: HRDailyGroupKey): Promise<number> {
  const { count, error } = await supabase
    .from('human_resource')
    .select('id', { count: 'exact', head: true })
    .eq('factory', factory)

  if (error) {
    logger.error({ err: error.message, factory }, 'getHeadcountForGroup failed')
    return 0
  }
  return count ?? 0
}

export async function ensureDefaultHRDailyRows(date: string, scopeUser?: HRProfile): Promise<void> {
  const parsedDate = dateSchema.safeParse(date)
  if (!parsedDate.success || !shouldEnsureDefaultRows(date)) return

  const profile = scopeUser ?? await getSessionUser()
  if (!profile) return

  const groups = getVisibleHRDailyGroups(profile)
  if (groups.length === 0) return

  const supabase = getDb()
  const [empRes, dailyRes] = await Promise.all([
    supabase
      .from('human_resource')
      .select('id,name,factory,machine,position,phone')
      .in('factory', [...groups]),
    supabase
      .from('hr_daily')
      .select('factory')
      .eq('pdate', date)
      .in('factory', [...groups]),
  ])

  if (empRes.error || dailyRes.error) {
    logger.error({ empErr: empRes.error?.message, dailyErr: dailyRes.error?.message }, 'ensureDefaultHRDailyRows query failed')
    return
  }

  const employees: HumanResource[] = (empRes.data ?? []).map((row) => ({
    id: row.id as number,
    name: row.name as string,
    factory: row.factory as string | null,
    machine: row.machine as string | null,
    position: row.position as string | null,
    phone: row.phone as string | null,
  }))
  const counts = countEmployeesByGroup(employees)
  const existing = new Set(((dailyRes.data ?? []) as Array<{ factory: string }>).map((row) => row.factory))
  const now = new Date().toISOString()
  const rows = groups
    .filter((factory) => !existing.has(factory))
    .map((factory) => ({
      factory,
      pdate: date,
      totalem: counts.get(factory) ?? 0,
      absent_ids: [],
      transferred_ids: [],
      transfer_records: [],
      auto_filled: true,
      auto_filled_at: now,
      updated_at: now,
    }))

  if (rows.length === 0) return

  const { error } = await supabase
    .from('hr_daily')
    .upsert(rows, { onConflict: 'factory,pdate' })

  if (error) logger.error({ err: error.message, date }, 'ensureDefaultHRDailyRows upsert failed')
}

export async function getHREfficiencyData(date: string, scopeUser?: HRProfile): Promise<HREfficiencyRow[]> {
  const parsedDate = dateSchema.safeParse(date)
  if (!parsedDate.success) {
    logger.warn({ date }, 'getHREfficiencyData: invalid date')
    return []
  }

  const profile = scopeUser ?? await requireTabView('administration.hr-performance')
  if (!profile) return []

  const visibleGroups = PRODUCTION_GROUPS.filter((factory) => canAccessFactory(profile, factory))
  if (visibleGroups.length === 0) return []

  const supabase = getDb()
  const [hrData, productionRes] = await Promise.all([
    getHRData(date, profile),
    supabase
      .from('Production')
      .select('pcode,workforce,starttime,endtime')
      .eq('pdate', date),
  ])

  if (productionRes.error) {
    logger.error({ err: productionRes.error.message, date }, 'getHREfficiencyData: production query failed')
  }

  const productionRows = (productionRes.data ?? []) as ProductionEfficiencySourceRow[]
  const pcodes = Array.from(new Set(productionRows.map((row) => row.pcode).filter((pcode): pcode is string => Boolean(pcode))))
  const pcodeToWorkshop = new Map<string, string>()

  if (pcodes.length > 0) {
    const { data, error } = await supabase
      .from('data')
      .select('PCODE,WORKSHOP')
      .in('PCODE', pcodes)

    if (error) {
      logger.error({ err: error.message, date }, 'getHREfficiencyData: data query failed')
    } else {
      for (const row of (data ?? []) as DataWorkshopRow[]) {
        pcodeToWorkshop.set(row.PCODE, workshopCode(normalizeWorkshop(row.WORKSHOP ?? '')))
      }
    }
  }

  const elapsedHours = elapsedWorkHours(date)
  const laborHoursByFactory = calculateHRLaborHoursByFactory(hrData.dailyData.map((row) => ({
    factory: row.factory,
    totalem: row.totalem,
    absentIds: row.absentIds,
    transferRecords: row.transferRecords,
  })), elapsedHours)
  const rows = new Map<HRDailyGroupKey, HREfficiencyRow>()
  for (const factory of visibleGroups) {
    const labor = laborHoursByFactory.get(factory)
    rows.set(factory, {
      factory,
      productionLaborHours: 0,
      elapsedHours,
      actualHeadcount: labor?.actualHeadcount ?? 0,
      availableLaborHours: labor?.availableLaborHours ?? 0,
      transferredOutHours: labor?.transferredOutHours ?? 0,
      transferredInHours: labor?.transferredInHours ?? 0,
      efficiency: null,
      warnings: [],
    })
  }

  for (const row of productionRows) {
    if (!row.pcode) continue
    const factory = pcodeToWorkshop.get(row.pcode)
    if (!factory || !isProductionHRGroup(factory)) continue
    const target = rows.get(factory)
    if (!target) continue

    const workforce = Number(row.workforce ?? 0)
    const duration = row.starttime && row.endtime ? calcDurationHours(row.starttime, row.endtime) : 0

    if (workforce <= 0) target.warnings.push(`${row.pcode}: thiếu nhân sự lệnh`)
    if (duration <= 0) target.warnings.push(`${row.pcode}: thiếu giờ bắt đầu/kết thúc`)
    if (workforce > 0 && duration > 0) target.productionLaborHours += duration * workforce
  }

  for (const row of rows.values()) {
    if (row.actualHeadcount <= 0) row.warnings.push('Chưa có nhân sự làm việc thực tế')
    if (row.elapsedHours <= 0) row.warnings.push('Chưa đến giờ làm việc 07:30')
    row.productionLaborHours = Math.round(row.productionLaborHours * 100) / 100
    row.efficiency = row.availableLaborHours > 0 ? Math.round((row.productionLaborHours / row.availableLaborHours) * 10000) / 100 : null
  }

  return Array.from(rows.values())
}

// ─── createHumanResource ─────────────────────────────────────────────────────

export async function createHumanResource(
  formData: FormData
): Promise<{ success: boolean; employee?: HumanResource; error?: string }> {
  const raw = {
    name: formData.get('name') as string,
    factory: formData.get('factory') as string,
    machine: (formData.get('machine') as string) || null,
    position: (formData.get('position') as string) || null,
    phone: (formData.get('phone') as string) || null,
  }

  const parsed = humanResourceSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.errors[0].message
    return { success: false, error: msg }
  }

  const user = await requireHREditUser()
  if (!user) return { success: false, error: 'Không có quyền cập nhật nhân sự.' }
  if (!canAccessFactory(user, parsed.data.factory)) return { success: false, error: 'Không có quyền cập nhật xưởng này.' }

  const supabase = getDb()
  const { data, error } = await supabase
    .from('human_resource')
    .insert({
      name: parsed.data.name,
      factory: parsed.data.factory,
      machine: parsed.data.machine ?? null,
      position: parsed.data.position ?? null,
      phone: parsed.data.phone ?? null,
    })
    .select('id,name,factory,machine,position,phone')
    .single()

  if (error || !data) {
    logger.error({ err: error?.message }, 'createHumanResource failed')
    return { success: false, error: error?.message ?? 'Insert failed' }
  }

  const row = data as { id: number; name: string; factory: string | null; machine: string | null; position: string | null; phone: string | null }
  logger.info({ id: row.id, name: row.name }, 'createHumanResource success')
  return {
    success: true,
    employee: {
      id: row.id,
      name: row.name,
      factory: row.factory,
      machine: row.machine,
      position: row.position,
      phone: row.phone,
    },
  }
}

// ─── updateHumanResource ─────────────────────────────────────────────────────

export async function updateHumanResource(
  id: number,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const raw = {
    name: formData.get('name') as string,
    factory: formData.get('factory') as string,
    machine: (formData.get('machine') as string) || null,
    position: (formData.get('position') as string) || null,
    phone: (formData.get('phone') as string) || null,
  }

  const parsed = humanResourceSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.errors[0].message
    return { success: false, error: msg }
  }

  const user = await requireHREditUser()
  if (!user) return { success: false, error: 'Không có quyền cập nhật nhân sự.' }

  const supabase = getDb()
  const { data: existing, error: readError } = await supabase
    .from('human_resource')
    .select('factory')
    .eq('id', id)
    .single()

  if (readError || !existing) return { success: false, error: readError?.message ?? 'Không tìm thấy nhân sự.' }
  if (!canAccessFactory(user, String(existing.factory ?? ''))) return { success: false, error: 'Không có quyền cập nhật xưởng này.' }
  if (!canAccessFactory(user, parsed.data.factory)) return { success: false, error: 'Không có quyền chuyển nhân sự sang xưởng này.' }

  const { error } = await supabase
    .from('human_resource')
    .update({
      name: parsed.data.name,
      factory: parsed.data.factory,
      machine: parsed.data.machine ?? null,
      position: parsed.data.position ?? null,
      phone: parsed.data.phone ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    logger.error({ err: error.message, id }, 'updateHumanResource failed')
    return { success: false, error: error.message }
  }

  logger.info({ id }, 'updateHumanResource success')
  return { success: true }
}

// ─── deleteHumanResource ─────────────────────────────────────────────────────

export async function deleteHumanResource(
  id: number
): Promise<{ success: boolean; error?: string }> {
  if (!Number.isInteger(id) || id <= 0) {
    return { success: false, error: 'Invalid id' }
  }

  const user = await requireHREditUser()
  if (!user) return { success: false, error: 'Không có quyền cập nhật nhân sự.' }

  const supabase = getDb()
  const { data: existing, error: readError } = await supabase
    .from('human_resource')
    .select('factory')
    .eq('id', id)
    .single()

  if (readError || !existing) return { success: false, error: readError?.message ?? 'Không tìm thấy nhân sự.' }
  if (!canAccessFactory(user, String(existing.factory ?? ''))) return { success: false, error: 'Không có quyền xóa nhân sự xưởng này.' }

  const { error } = await supabase
    .from('human_resource')
    .delete()
    .eq('id', id)

  if (error) {
    logger.error({ err: error.message, id }, 'deleteHumanResource failed')
    return { success: false, error: error.message }
  }

  logger.info({ id }, 'deleteHumanResource success')
  return { success: true }
}
