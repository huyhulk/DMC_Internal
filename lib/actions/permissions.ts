'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/actions/auth'
import { USER_ROLES, type UserRole } from '@/types'
import {
  DEFAULT_ROLE_PERMISSIONS,
  isPermissionKey,
  normalizePermissionLevel,
  PERMISSION_KEYS,
  type PermissionKey,
  type PermissionLevel,
} from '@/lib/permissions/tabs'

export type RoleTabPermissionRow = {
  role: UserRole
  permission_key: PermissionKey
  level: PermissionLevel
}

function adminDb() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireAdmin() {
  const user = await getSessionUser()
  return user?.role === 'ADMIN' ? user : null
}

function defaultRows(): RoleTabPermissionRow[] {
  return (Object.entries(DEFAULT_ROLE_PERMISSIONS) as Array<[UserRole, Record<PermissionKey, PermissionLevel>]>).flatMap(
    ([role, matrix]) => PERMISSION_KEYS.map((key) => ({
      role,
      permission_key: key,
      level: normalizePermissionLevel(role, key, matrix[key]),
    }))
  )
}

function normalizeRows(rows: RoleTabPermissionRow[]): RoleTabPermissionRow[] {
  const defaults = new Map(defaultRows().map((row) => [`${row.role}:${row.permission_key}`, row]))
  for (const row of rows) {
    defaults.set(`${row.role}:${row.permission_key}`, {
      role: row.role,
      permission_key: row.permission_key,
      level: normalizePermissionLevel(row.role, row.permission_key, row.level),
    })
  }
  return Array.from(defaults.values())
}

export async function listRoleTabPermissionsAction(): Promise<{ success?: boolean; rows?: RoleTabPermissionRow[]; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Không có quyền truy cập' }

  const { data, error } = await adminDb()
    .from('role_tab_permissions')
    .select('role,permission_key,level')

  if (error) return { success: true, rows: defaultRows() }

  const rows = (data ?? [])
    .filter((row) => (USER_ROLES as readonly string[]).includes(String(row.role)))
    .filter((row) => isPermissionKey(String(row.permission_key)))
    .filter((row) => ['invisible', 'view', 'edit'].includes(String(row.level)))
    .map((row) => ({
      role: row.role as UserRole,
      permission_key: row.permission_key as PermissionKey,
      level: row.level as PermissionLevel,
    }))

  return { success: true, rows: normalizeRows(rows) }
}

export async function updateRoleTabPermissionsAction(
  updates: RoleTabPermissionRow[]
): Promise<{ success?: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Không có quyền truy cập' }

  try {
    const rows = updates.map((row) => {
      if (!['ADMIN', 'MANAGER', 'SUPERVISOR', 'USER'].includes(row.role)) throw new Error('Role không hợp lệ')
      if (!isPermissionKey(row.permission_key)) throw new Error('Tab không hợp lệ')
      if (!['invisible', 'view', 'edit'].includes(row.level)) throw new Error('Quyền không hợp lệ')
      return {
        role: row.role,
        permission_key: row.permission_key,
        level: normalizePermissionLevel(row.role, row.permission_key, row.level),
      }
    })

    const { error } = await adminDb()
      .from('role_tab_permissions')
      .upsert(rows, { onConflict: 'role,permission_key' })

    if (error) return { error: error.message }

    revalidatePath('/dashboard', 'layout')
    revalidatePath('/dashboard/admin')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function resetRoleTabPermissionsAction(): Promise<{ success?: boolean; error?: string }> {
  return updateRoleTabPermissionsAction(defaultRows())
}
