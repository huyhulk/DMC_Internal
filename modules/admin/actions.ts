'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'
import { z } from 'zod'
import { USER_ROLES, type UserRole } from '@/types'
import { isKnownWorkspaceToken, normalizeWorkspaceList } from '@/modules/approval/workflow'
import { requireTabEdit } from '@/modules/permissions/server'

function getAdminDb() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserRow {
  id: string
  username: string
  role: UserRole
  workspace: string
  created_at: string
}

// ─── Validation schemas ───────────────────────────────────────────────────────

const workspaceSchema = z.string()
  .transform((value) => normalizeWorkspaceList(value))
  .refine(
    (value) => value === '' || value.split(',').every(isKnownWorkspaceToken),
    'Workspace chỉ được chọn trong danh sách xưởng/phòng ban'
  )

const createUserSchema = z.object({
  username:  z.string().min(2, 'Tên đăng nhập phải có ít nhất 2 ký tự').max(50).regex(/^[a-z0-9_]+$/, 'Chỉ dùng chữ thường, số, dấu gạch dưới'),
  password:  z.string().min(4, 'Mật khẩu phải có ít nhất 4 ký tự'),
  role:      z.enum(USER_ROLES),
  workspace: workspaceSchema,
})

const updateUserSchema = z.object({
  role:      z.enum(USER_ROLES),
  workspace: workspaceSchema,
})

// ─── Helper: verify caller is ADMIN ──────────────────────────────────────────

async function requireAdmin() {
  const user = await requireTabEdit('admin.users')
  return user?.role === 'ADMIN' ? user : null
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function listUsersAction(): Promise<{
  success?: boolean
  users?: UserRow[]
  error?: string
}> {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Không có quyền truy cập' }

  try {
    const supabase = getAdminDb()

    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, username, role, workspace, created_at')
      .order('created_at', { ascending: true })

    if (profilesErr) {
      logger.error({ error: profilesErr.message }, 'listUsersAction: fetch profiles failed')
      return { error: profilesErr.message }
    }

    const users: UserRow[] = (profiles ?? []).map((p) => ({
      id:         p.id as string,
      username:   p.username as string,
      role:       p.role as UserRole,
      workspace:  (p.workspace as string) ?? '',
      created_at: p.created_at as string,
    }))

    return { success: true, users }
  } catch (err) {
    logger.error({ err }, 'listUsersAction: unexpected error')
    return { error: 'Lỗi hệ thống' }
  }
}

export async function createUserAction(params: {
  username: string
  password: string
  role: UserRole
  workspace: string
}): Promise<{ success?: boolean; userId?: string; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Không có quyền truy cập' }

  const parsed = createUserSchema.safeParse(params)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const { username, password, role, workspace } = parsed.data
  const email = `${username.toLowerCase()}@dmc.local`

  const supabase = getAdminDb()

  // 1. Create auth user — pass user_metadata so the DB trigger handle_new_user()
  //    picks up username/role/workspace and creates the profile row automatically.
  const { data, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, role, workspace },
  })

  if (authErr) {
    logger.error({ error: authErr.message }, 'createUserAction: create auth user failed')
    return { error: authErr.message }
  }

  const userId = data.user.id

  // 2. Upsert profile row — the trigger may have already inserted it via user_metadata;
  //    upsert ensures the correct values are set regardless of trigger timing.
  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert({ id: userId, username, role, workspace }, { onConflict: 'id' })

  if (profileErr) {
    logger.error({ error: profileErr.message, userId }, 'createUserAction: upsert profile failed — rolling back')
    await supabase.auth.admin.deleteUser(userId)
    return { error: profileErr.message }
  }

  logger.info({ userId, username, role }, 'createUserAction: user created')
  return { success: true, userId }
}

export async function updateUserAction(
  targetId: string,
  updates: { role: UserRole; workspace: string }
): Promise<{ success?: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Không có quyền truy cập' }

  if (targetId === admin.id) return { error: 'Không thể tự chỉnh sửa tài khoản của mình' }

  const parsed = updateUserSchema.safeParse(updates)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const { role, workspace } = parsed.data

  const supabase = getAdminDb()
  const { error } = await supabase
    .from('profiles')
    .update({ role, workspace })
    .eq('id', targetId)

  if (error) {
    logger.error({ error: error.message, targetId }, 'updateUserAction failed')
    return { error: error.message }
  }

  logger.info({ targetId, role, workspace, by: admin.id }, 'updateUserAction: user updated')
  return { success: true }
}

export async function deleteUserAction(
  targetId: string
): Promise<{ success?: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Không có quyền truy cập' }

  if (targetId === admin.id) return { error: 'Không thể xóa tài khoản của mình' }

  const supabase = getAdminDb()

  const { error: authErr } = await supabase.auth.admin.deleteUser(targetId)
  if (authErr) {
    logger.error({ error: authErr.message, targetId }, 'deleteUserAction: delete auth user failed')
    return { error: authErr.message }
  }

  logger.info({ targetId, by: admin.id }, 'deleteUserAction: user deleted')
  return { success: true }
}

export async function adminResetPasswordAction(
  targetId: string,
  newPassword: string
): Promise<{ success?: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Không có quyền truy cập' }

  if (newPassword.length < 4) return { error: 'Mật khẩu phải có ít nhất 4 ký tự' }

  const supabase = getAdminDb()
  const { error } = await supabase.auth.admin.updateUserById(targetId, { password: newPassword })

  if (error) {
    logger.error({ error: error.message, targetId }, 'adminResetPasswordAction failed')
    return { error: error.message }
  }

  logger.info({ targetId, by: admin.id }, 'adminResetPasswordAction: password reset')
  return { success: true }
}
