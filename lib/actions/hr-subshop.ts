'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import logger from '@/lib/logger'
import { canEdit, requireTabEdit, requireTabView } from '@/lib/permissions/server'
import { canAccessWorkspace } from '@/lib/approval/workflow'
import { isProductionEntryWorkspaceAllowed } from '@/lib/production/workflow'
import { getUserWorkspaces } from '@/lib/utils'
import { getHRGroup, HR_GROUPS, isProductionSubshop } from '@/lib/hr/groups'
import {
  buildHRSubshopBoard,
  type HRDailyGroupState,
  type HRSubshopGroup,
  type HRSubshopTransfer,
} from '@/lib/hr/subshop'
import type { HumanResource, SessionUser } from '@/types'

function getDb() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

const HR_TRANSFER_START = '07:30'
const HR_TRANSFER_END = '16:30'

// Trưởng xưởng chỉ sửa xưởng trong workspace của họ; base (DMC1) bao mọi sub-shop; ADMIN/ALL bao tất cả.
function canEditGroup(group: string, profile: Pick<SessionUser, 'role' | 'workspace'>): boolean {
  if (isProductionSubshop(group)) {
    return isProductionEntryWorkspaceAllowed(group, profile.role, getUserWorkspaces(profile.workspace), profile.workspace)
  }
  return canAccessWorkspace(profile.role, profile.workspace, group)
}

function mapEmployees(rows: unknown[]): HumanResource[] {
  return (rows ?? []).map((raw) => {
    const row = raw as Record<string, unknown>
    return {
      id: row.id as number,
      name: row.name as string,
      factory: (row.factory as string | null) ?? null,
      subshop: (row.subshop as string | null) ?? null,
      machine: (row.machine as string | null) ?? null,
      position: (row.position as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
    }
  })
}

export interface HRSubshopBoardResult {
  board: HRSubshopGroup[]
  editableGroups: string[]
  canEditStatus: boolean
  error?: string
}

// Bảng nhân sự theo xưởng nhỏ cho ngày `date`. Ngày tương lai không có hr_daily → mọi người "working" (= định biên).
export async function getHRSubshopBoard(date: string): Promise<HRSubshopBoardResult> {
  const user = await requireTabView('administration.hr')
  if (!user) return { board: [], editableGroups: [], canEditStatus: false, error: 'Không có quyền xem nhân sự.' }

  const db = getDb()
  const [empRes, dailyRes] = await Promise.all([
    db.from('human_resource').select('id,name,factory,subshop,machine,position,phone').order('name', { ascending: true }),
    db.from('hr_daily').select('factory,absent_ids,transfer_records').eq('pdate', date).in('factory', [...HR_GROUPS]),
  ])

  if (empRes.error) logger.error({ err: empRes.error.message }, 'getHRSubshopBoard: employees query failed')
  if (dailyRes.error) logger.error({ err: dailyRes.error.message }, 'getHRSubshopBoard: hr_daily query failed')

  const employees = mapEmployees(empRes.data ?? [])
  const states: HRDailyGroupState[] = (dailyRes.data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>
    return {
      group: row.factory as string,
      absentIds: (row.absent_ids as number[] | null) ?? [],
      transferRecords: (row.transfer_records as HRSubshopTransfer[] | null) ?? [],
    }
  })

  const board = buildHRSubshopBoard(employees, states)
  const canEditStatus = await canEdit(user, 'administration.hr-status')
  const editableGroups = canEditStatus ? board.filter((g) => canEditGroup(g.group, user)).map((g) => g.group) : []

  return { board, editableGroups, canEditStatus }
}

const setStatusSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ (YYYY-MM-DD)'),
    employeeId: z.number().int().positive(),
    status: z.enum(['working', 'transferred', 'absent']),
    toGroup: z.string().optional(),
  })
  .refine((v) => v.status !== 'transferred' || (!!v.toGroup && HR_GROUPS.includes(v.toGroup)), {
    message: 'Điều chuyển phải chọn xưởng đến hợp lệ.',
    path: ['toGroup'],
  })

// Đổi trạng thái 1 nhân sự (làm việc / điều chuyển / nghỉ) cho ngày `date`.
// Quyền: administration.hr-status (trưởng xưởng↑), scoped theo workspace của xưởng NHÀ.
export async function setHREmployeeStatus(input: {
  date: string
  employeeId: number
  status: 'working' | 'transferred' | 'absent'
  toGroup?: string
}): Promise<{ success: boolean; error?: string }> {
  const parsed = setStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }
  }
  const { date, employeeId, status, toGroup } = parsed.data

  const user = await requireTabEdit('administration.hr-status')
  if (!user) return { success: false, error: 'Bạn không có quyền đổi trạng thái nhân sự.' }

  const db = getDb()
  const empRes = await db.from('human_resource').select('id,name,factory,subshop').eq('id', employeeId).maybeSingle()
  if (empRes.error || !empRes.data) {
    return { success: false, error: 'Không tìm thấy nhân sự.' }
  }
  const [emp] = mapEmployees([empRes.data])
  const homeGroup = getHRGroup(emp)

  if (!canEditGroup(homeGroup, user)) {
    return { success: false, error: 'Nhân sự này ngoài phạm vi xưởng của bạn.' }
  }
  if (status === 'transferred' && toGroup === homeGroup) {
    return { success: false, error: 'Xưởng đến phải khác xưởng hiện tại.' }
  }

  // Đọc bản ghi hr_daily hiện có của xưởng NHÀ (nếu chưa có thì tạo mới).
  const rowRes = await db
    .from('hr_daily')
    .select('absent_ids,transfer_records,totalem')
    .eq('pdate', date)
    .eq('factory', homeGroup)
    .maybeSingle()

  const current = rowRes.data as
    | { absent_ids: number[] | null; transfer_records: HRSubshopTransfer[] | null; totalem: number | null }
    | null

  // Xoá nhân sự này khỏi cả 2 danh sách, rồi áp trạng thái mới.
  const absentIds = ((current?.absent_ids ?? []).filter((id) => id !== employeeId))
  const transfers = ((current?.transfer_records ?? []).filter((t) => t.employeeId !== employeeId))

  if (status === 'absent') {
    absentIds.push(employeeId)
  } else if (status === 'transferred' && toGroup) {
    transfers.push({
      employeeId,
      fromGroup: homeGroup,
      toGroup,
      startTime: HR_TRANSFER_START,
      endTime: HR_TRANSFER_END,
    })
  }

  const { error: upsertError } = await db.from('hr_daily').upsert(
    {
      factory: homeGroup,
      pdate: date,
      totalem: current?.totalem ?? 0,
      absent_ids: absentIds,
      transferred_ids: transfers.map((t) => t.employeeId),
      transfer_records: transfers,
      auto_filled: false,
      auto_filled_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'factory,pdate' },
  )

  if (upsertError) {
    logger.error({ err: upsertError.message, group: homeGroup, date }, 'setHREmployeeStatus upsert failed')
    return { success: false, error: upsertError.message }
  }

  logger.info({ employeeId, homeGroup, status, toGroup, date }, 'setHREmployeeStatus success')
  return { success: true }
}
