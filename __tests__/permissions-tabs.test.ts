import { USER_ROLES } from '@/types'
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_KEYS,
  canEditLevel,
  canViewLevel,
  isPermissionKey,
  normalizePermissionLevel,
} from '@/lib/permissions/tabs'

describe('role tab permissions', () => {
  it('defines a default level for every role and permission key', () => {
    expect(Object.keys(DEFAULT_ROLE_PERMISSIONS).sort()).toEqual([...USER_ROLES].sort())

    for (const matrix of Object.values(DEFAULT_ROLE_PERMISSIONS)) {
      expect(Object.keys(matrix).sort()).toEqual([...PERMISSION_KEYS].sort())
    }
  })

  it('allows configurable HR edit access for workshop managers', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.WORKSHOP_MANAGER['administration.hr']).toBe('view')
    expect(normalizePermissionLevel('WORKSHOP_MANAGER', 'administration.hr', 'edit')).toBe('edit')
  })

  it('keeps system permissions admin-only even if configured otherwise', () => {
    expect(normalizePermissionLevel('MANAGER', 'admin', 'edit')).toBe('invisible')
    expect(normalizePermissionLevel('TEAM_LEADER', 'admin.users', 'view')).toBe('invisible')
    expect(normalizePermissionLevel('HR', 'admin.kpi-settings', 'edit')).toBe('invisible')
    expect(normalizePermissionLevel('ADMIN', 'admin.users', 'edit')).toBe('edit')
  })

  it('maps levels to view and edit capabilities', () => {
    expect(canViewLevel('invisible')).toBe(false)
    expect(canViewLevel('view')).toBe(true)
    expect(canViewLevel('edit')).toBe(true)

    expect(canEditLevel('invisible')).toBe(false)
    expect(canEditLevel('view')).toBe(false)
    expect(canEditLevel('edit')).toBe(true)
  })

  it('recognizes every declared permission key and rejects unknown keys', () => {
    for (const key of PERMISSION_KEYS) {
      expect(isPermissionKey(key)).toBe(true)
    }

    expect(isPermissionKey('coordination.iso')).toBe(false)
    expect(isPermissionKey('admin.permissions')).toBe(false)
  })
})
