import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/modules/auth/actions'
import type { SessionUser, TabId, UserRole } from '@/types'
import {
  canEditLevel,
  canViewLevel,
  DEFAULT_ROLE_PERMISSIONS,
  isPermissionKey,
  normalizePermissionLevel,
  PERMISSION_KEYS,
  TOP_LEVEL_PERMISSION_KEYS,
  type PermissionKey,
  type PermissionLevel,
  type RolePermissionMatrix,
} from '@/modules/permissions/tabs'

function getDefaultRolePermissionMatrix(role: UserRole): RolePermissionMatrix {
  return { ...DEFAULT_ROLE_PERMISSIONS[role] }
}

export const getRolePermissionMatrix = cache(async (role: UserRole): Promise<RolePermissionMatrix> => {
  const fallback = getDefaultRolePermissionMatrix(role)

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('role_tab_permissions')
      .select('permission_key,level')
      .eq('role', role)

    if (error) return fallback

    const matrix = { ...fallback }
    for (const row of data ?? []) {
      const key = String(row.permission_key)
      const level = String(row.level) as PermissionLevel
      if (isPermissionKey(key) && (level === 'invisible' || level === 'view' || level === 'edit')) {
        matrix[key] = normalizePermissionLevel(role, key, level)
      }
    }
    return matrix
  } catch {
    return fallback
  }
})

export async function getPermissionLevel(user: Pick<SessionUser, 'role'>, key: PermissionKey): Promise<PermissionLevel> {
  const matrix = await getRolePermissionMatrix(user.role)
  return normalizePermissionLevel(user.role, key, matrix[key] ?? 'invisible')
}

export async function canView(user: Pick<SessionUser, 'role'>, key: PermissionKey): Promise<boolean> {
  return canViewLevel(await getPermissionLevel(user, key))
}

export async function canEdit(user: Pick<SessionUser, 'role'>, key: PermissionKey): Promise<boolean> {
  return canEditLevel(await getPermissionLevel(user, key))
}

export async function requireTabView(key: PermissionKey): Promise<SessionUser | null> {
  const user = await getSessionUser()
  if (!user) return null
  return await canView(user, key) ? user : null
}

export async function requireTabEdit(key: PermissionKey): Promise<SessionUser | null> {
  const user = await getSessionUser()
  if (!user) return null
  return await canEdit(user, key) ? user : null
}

export async function getVisibleTopLevelTabs(role: UserRole): Promise<TabId[]> {
  const matrix = await getRolePermissionMatrix(role)
  return TOP_LEVEL_PERMISSION_KEYS.filter((key) => canViewLevel(matrix[key]))
}

export async function getVisiblePermissionKeys(role: UserRole): Promise<PermissionKey[]> {
  const matrix = await getRolePermissionMatrix(role)
  return PERMISSION_KEYS.filter((key) => canViewLevel(matrix[key]))
}

export async function getEditablePermissionKeys(role: UserRole): Promise<PermissionKey[]> {
  const matrix = await getRolePermissionMatrix(role)
  return PERMISSION_KEYS.filter((key) => canEditLevel(matrix[key]))
}

export async function getSubTabPermission(user: Pick<SessionUser, 'role'>, key: PermissionKey): Promise<{
  level: PermissionLevel
  canView: boolean
  canEdit: boolean
}> {
  const level = await getPermissionLevel(user, key)
  return { level, canView: canViewLevel(level), canEdit: canEditLevel(level) }
}
