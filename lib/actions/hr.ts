'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'
import { z } from 'zod'
import { getSessionUser } from '@/lib/actions/auth'
import { canAccessWorkspace, getWorkspaceScopedFilter } from '@/lib/approval/workflow'
import type { HumanResource, HRDayData } from '@/types'
import type { SessionUser } from '@/types'

// Direct admin client — same pattern as lib/db/queries.ts
function getDb() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// ─── Constants & Types ────────────────────────────────────────────────────────

// Internal-only constant — not exported (use server files cannot export non-async values)
const FACTORIES = ['DMC1', 'DMC3', 'DMC4', 'DMC5'] as const
type FactoryKey = typeof FACTORIES[number]
type HRProfile = Pick<SessionUser, 'role' | 'workspace'>

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

const saveHRDailySchema = z.object({
  date: dateSchema,
  factory: z.enum(['DMC1', 'DMC3', 'DMC4', 'DMC5']),
  totalem: z.number().min(0, 'Total employees must be >= 0'),
  absentIds: z.array(z.number().int().positive()),
})

const humanResourceSchema = z.object({
  name: z.string().min(1, 'Họ tên không được để trống'),
  factory: z.string().min(1, 'Nhà máy không được để trống'),
  machine: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
})

async function requireHRUser(): Promise<SessionUser | null> {
  const user = await getSessionUser()
  if (!user) return null
  if (!['ADMIN', 'MANAGER'].includes(user.role)) return null
  return user
}

function canAccessFactory(profile: HRProfile, factory: string): boolean {
  return canAccessWorkspace(profile.role, profile.workspace, factory)
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

  const factories = scope.unrestricted
    ? FACTORIES
    : FACTORIES.filter((factory) => scope.workspaces.includes(factory))
  const supabase = getDb()

  // Parallel: all employees + today's hr_daily rows
  const [empRes, dailyRes] = await Promise.all([
    supabase
      .from('human_resource')
      .select('id,name,factory,machine,position,phone')
      .in('factory', [...factories])
      .order('name', { ascending: true }),
    supabase
      .from('hr_daily')
      .select('factory,totalem,absent_ids,pdate')
      .eq('pdate', date)
      .in('factory', [...factories]),
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

  // Build a map of factory → today's daily row
  type DailyRow = { factory: string; totalem: number | null; absent_ids: number[] | null; pdate: string | null }
  const todayMap = new Map<string, DailyRow>()
  for (const row of (dailyRes.data ?? []) as DailyRow[]) {
    todayMap.set(row.factory, row)
  }

  // For factories that have no record today: fetch latest totalem via Promise.allSettled
  const factoriesWithoutToday = factories.filter((f) => !todayMap.has(f))

  const latestResults = await Promise.allSettled(
    factoriesWithoutToday.map((factory) =>
      supabase
        .from('hr_daily')
        .select('factory,totalem,absent_ids,pdate')
        .eq('factory', factory)
        .order('pdate', { ascending: false })
        .limit(1)
        .maybeSingle()
    )
  )

  const latestMap = new Map<string, number>()
  latestResults.forEach((result, idx) => {
    const factory = factoriesWithoutToday[idx]
    if (result.status === 'fulfilled' && result.value.data) {
      const val = result.value.data as DailyRow
      latestMap.set(factory, val.totalem ?? 0)
    }
  })

  // Build final HRDayData for all 4 factories
  const dailyData: HRDayData[] = factories.map((factory) => {
    const todayRow = todayMap.get(factory)
    if (todayRow) {
      return {
        factory,
        totalem: todayRow.totalem ?? 0,
        absentIds: todayRow.absent_ids ?? [],
        isAutoFilled: false,
      }
    }
    return {
      factory,
      totalem: latestMap.get(factory) ?? 0,
      absentIds: [],
      isAutoFilled: true,
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
  totalem: number,
  absentIds: number[]
): Promise<{ success: boolean; error?: string }> {
  const parsed = saveHRDailySchema.safeParse({ date, factory, totalem, absentIds })
  if (!parsed.success) {
    const msg = parsed.error.errors[0].message
    logger.warn({ date, factory, zodError: msg }, 'saveHRDaily: validation failed')
    return { success: false, error: msg }
  }

  const { date: pdate, factory: fac, totalem: total, absentIds: absent } = parsed.data
  const user = await requireHRUser()
  if (!user) return { success: false, error: 'Không có quyền cập nhật nhân sự.' }
  if (!canAccessFactory(user, fac)) return { success: false, error: 'Không có quyền cập nhật xưởng này.' }

  const supabase = getDb()

  // Upsert hr_daily — conflict on (factory, pdate)
  const { error: upsertError } = await supabase
    .from('hr_daily')
    .upsert(
      { factory: fac, pdate, totalem: total, absent_ids: absent },
      { onConflict: 'factory,pdate' }
    )

  if (upsertError) {
    logger.error({ err: upsertError.message, factory: fac, date: pdate }, 'saveHRDaily: upsert failed')
    return { success: false, error: upsertError.message }
  }

  logger.info({ factory: fac, date: pdate, totalem: total, absentCount: absent.length }, 'saveHRDaily success')
  return { success: true }
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

  const user = await requireHRUser()
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

  const user = await requireHRUser()
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

  const user = await requireHRUser()
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
