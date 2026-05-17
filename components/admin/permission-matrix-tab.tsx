'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { RotateCcw, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  PERMISSION_LEVELS,
  normalizePermissionLevel,
  type PermissionKey,
  type PermissionLevel,
} from '@/modules/permissions/tabs'
import {
  resetRoleTabPermissionsAction,
  updateRoleTabPermissionsAction,
  type RoleTabPermissionRow,
} from '@/modules/permissions/actions'
import { ROLE_LABELS, USER_ROLES, type UserRole } from '@/types'

interface Props {
  initialRows: RoleTabPermissionRow[]
}

const ROLES: UserRole[] = [...USER_ROLES]

const LEVEL_LABELS: Record<PermissionLevel, string> = {
  invisible: 'Ẩn',
  view: 'Xem',
  edit: 'Sửa',
}

const LEVEL_STYLE: Record<PermissionLevel, string> = {
  invisible: 'bg-gray-100 text-gray-500 border-gray-200',
  view: 'bg-amber-50 text-amber-700 border-amber-200',
  edit: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

function rowId(role: UserRole, key: PermissionKey) {
  return `${role}:${key}`
}

function buildMatrix(rows: RoleTabPermissionRow[]) {
  const matrix = new Map<string, PermissionLevel>()
  for (const row of rows) {
    matrix.set(rowId(row.role, row.permission_key), normalizePermissionLevel(row.role, row.permission_key, row.level))
  }
  return matrix
}

export function PermissionMatrixTab({ initialRows }: Props) {
  const initialMatrix = useMemo(() => buildMatrix(initialRows), [initialRows])
  const [matrix, setMatrix] = useState(initialMatrix)
  const [saving, setSaving] = useState(false)

  const dirty = useMemo(() => {
    for (const key of PERMISSION_KEYS) {
      for (const role of ROLES) {
        if (matrix.get(rowId(role, key)) !== initialMatrix.get(rowId(role, key))) return true
      }
    }
    return false
  }, [initialMatrix, matrix])

  function getLevel(role: UserRole, key: PermissionKey) {
    return matrix.get(rowId(role, key)) ?? 'invisible'
  }

  function setLevel(role: UserRole, key: PermissionKey, level: PermissionLevel) {
    setMatrix((prev) => {
      const next = new Map(prev)
      next.set(rowId(role, key), normalizePermissionLevel(role, key, level))
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updates = ROLES.flatMap((role) =>
        PERMISSION_KEYS.map((permission_key) => ({
          role,
          permission_key,
          level: getLevel(role, permission_key),
        }))
      )
      const result = await updateRoleTabPermissionsAction(updates)
      if (result.error) toast.error(result.error)
      else toast.success('Đã lưu phân quyền tab')
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    setSaving(true)
    try {
      const result = await resetRoleTabPermissionsAction()
      if (result.error) toast.error(result.error)
      else {
        toast.success('Đã khôi phục phân quyền mặc định')
        window.location.reload()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full overflow-auto bg-[#f5f5f7] p-5 space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-dmc-border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-dmc-text-primary">Phân quyền tab</h1>
          <p className="mt-1 text-sm text-dmc-text-muted">
            Thiết lập quyền Ẩn / Xem / Sửa cho từng role theo từng tab và sub-tab.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dmc-border bg-white px-4 py-2 text-sm font-medium text-dmc-text-primary transition hover:bg-gray-50 disabled:opacity-40"
          >
            <RotateCcw size={14} />
            Mặc định
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 rounded-xl bg-dmc-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={14} />
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-dmc-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] text-sm">
            <thead>
              <tr className="bg-[#f5f5f7] text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">
                <th className="w-44 px-4 py-3 text-left">Nhóm</th>
                <th className="px-4 py-3 text-left">Tab / chức năng</th>
                {ROLES.map((role) => (
                  <th key={role} className="w-36 px-3 py-3 text-center">{ROLE_LABELS[role]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-dmc-border">
              {PERMISSION_KEYS.map((key) => {
                const meta = PERMISSION_LABELS[key]
                const isTopLevel = !key.includes('.')
                return (
                  <tr key={key} className={cn('hover:bg-[#fafafa]', isTopLevel && 'bg-[#fbfbfd]')}>
                    <td className="px-4 py-3 text-[12px] font-medium text-dmc-text-muted">{meta.group}</td>
                    <td className="px-4 py-3">
                      <div className={cn('font-medium text-dmc-text-primary', isTopLevel && 'font-semibold')}>
                        {meta.label}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-dmc-text-muted">{key}</div>
                    </td>
                    {ROLES.map((role) => {
                      const selected = getLevel(role, key)
                      const adminLocked = role !== 'ADMIN' && (key === 'admin' || key.startsWith('admin.'))
                      return (
                        <td key={role} className="px-3 py-3">
                          <div className="flex justify-center rounded-xl bg-[#f5f5f7] p-1">
                            {PERMISSION_LEVELS.map((level) => {
                              const active = selected === level
                              return (
                                <button
                                  key={level}
                                  type="button"
                                  disabled={adminLocked || saving}
                                  onClick={() => setLevel(role, key, level)}
                                  className={cn(
                                    'min-w-10 rounded-lg border px-2 py-1 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45',
                                    active ? LEVEL_STYLE[selected] : 'border-transparent text-dmc-text-muted hover:bg-white'
                                  )}
                                >
                                  {LEVEL_LABELS[level]}
                                </button>
                              )
                            })}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
