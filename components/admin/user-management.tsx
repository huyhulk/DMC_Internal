'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { UserPlus, Search, Trash2, KeyRound, Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  listUsersAction,
  createUserAction,
  updateUserAction,
  deleteUserAction,
  adminResetPasswordAction,
  type UserRow,
} from '@/lib/actions/admin'
import { WORKSPACE_OPTIONS, normalizeWorkspaceList } from '@/lib/approval/workflow'
import type { UserRole } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full h-[38px] px-3 rounded-[10px] bg-[#f5f5f7] border border-[#d2d2d7]/80 ' +
  'text-[13px] text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#3b5bdb]/40 transition-all'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'ADMIN',      label: 'Admin' },
  { value: 'MANAGER',    label: 'Quản lý' },
  { value: 'SUPERVISOR', label: 'Tổ trưởng' },
  { value: 'USER',       label: 'Công nhân' },
]

const ROLE_BADGE: Record<UserRole, string> = {
  ADMIN:      'text-[#3b5bdb] bg-[#3b5bdb]/10 border border-[#3b5bdb]/25',
  MANAGER:    'text-[#2f9e44] bg-[#2f9e44]/10 border border-[#2f9e44]/25',
  SUPERVISOR: 'text-[#d4870c] bg-[#d4870c]/10 border border-[#d4870c]/25',
  USER:       'text-[#6e6e73] bg-[#6e6e73]/10 border border-[#6e6e73]/20',
}

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN:      'Admin',
  MANAGER:    'Quản lý',
  SUPERVISOR: 'Tổ trưởng',
  USER:       'Công nhân',
}

const EMPTY_FORM = { username: '', password: '', role: 'USER' as UserRole, workspace: '' }

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  currentUserId: string
  canEdit: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UserManagement({ currentUserId, canEdit }: Props) {
  const [users, setUsers]           = useState<UserRow[]>([])
  const [search, setSearch]         = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reset password sub-section
  const [showReset, setShowReset]     = useState(false)
  const [resetPass, setResetPass]     = useState('')
  const [resetting, setResetting]     = useState(false)

  // ── Load users ──────────────────────────────────────────────────────────────

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const result = await listUsersAction()
    if (result.error) {
      toast.error(result.error)
    } else {
      setUsers(result.users ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { void loadUsers() }, [loadUsers])

  // ── Select user ─────────────────────────────────────────────────────────────

  function selectUser(user: UserRow) {
    setSelectedId(user.id)
    setForm({ username: user.username, password: '', role: user.role, workspace: user.workspace })
    setConfirmDelete(false)
    setShowReset(false)
    setResetPass('')
  }

  function selectNew() {
    setSelectedId(null)
    setForm(EMPTY_FORM)
    setConfirmDelete(false)
    setShowReset(false)
    setResetPass('')
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, value: typeof EMPTY_FORM[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const selectedWorkspaces = form.workspace
    ? form.workspace.split(',').map((w) => w.trim()).filter(Boolean)
    : []

  function toggleWorkspace(value: string, checked: boolean) {
    if (value === 'ALL') {
      setField('workspace', checked ? 'ALL' : '')
      return
    }

    const next = new Set(selectedWorkspaces.filter((item) => item !== 'ALL'))
    if (checked) next.add(value)
    else next.delete(value)
    setField('workspace', normalizeWorkspaceList(Array.from(next).join(',')))
  }

  // ── Save (create or update) ─────────────────────────────────────────────────

  async function handleSave() {
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    setSaving(true)
    try {
      if (selectedId === null) {
        // Create
        const result = await createUserAction({
          username:  form.username.trim(),
          password:  form.password,
          role:      form.role,
          workspace: normalizeWorkspaceList(form.workspace),
        })
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Đã tạo người dùng mới')
          await loadUsers()
          selectNew()
        }
      } else {
        // Update
        const result = await updateUserAction(selectedId, { role: form.role, workspace: normalizeWorkspaceList(form.workspace) })
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Đã cập nhật người dùng')
          setUsers((prev) =>
            prev.map((u) => u.id === selectedId ? { ...u, role: form.role, workspace: normalizeWorkspaceList(form.workspace) } : u)
          )
        }
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!selectedId) return
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      const result = await deleteUserAction(selectedId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Đã xóa người dùng')
        await loadUsers()
        selectNew()
      }
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  // ── Reset password ──────────────────────────────────────────────────────────

  async function handleResetPassword() {
    if (!selectedId || !resetPass) return
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    setResetting(true)
    try {
      const result = await adminResetPasswordAction(selectedId, resetPass)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Đã đặt lại mật khẩu')
        setShowReset(false)
        setResetPass('')
      }
    } finally {
      setResetting(false)
    }
  }

  // ── Filtered list ───────────────────────────────────────────────────────────

  const filtered = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  )

  const selectedUser = users.find((u) => u.id === selectedId) ?? null
  const isSelf = selectedId === currentUserId

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#f5f5f7]">

      {/* ── Top bar ── */}
      <div className="shrink-0 px-5 py-4 bg-white border-b border-[#d2d2d7]/60">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[17px] font-bold text-[#1d1d1f] tracking-[-0.02em]">
              Quản lý người dùng
            </h1>
            <p className="text-[12px] text-[#6e6e73] mt-0.5">{users.length} tài khoản</p>
          </div>
          {canEdit && (
            <button
              onClick={selectNew}
              className="flex items-center gap-1.5 h-9 px-4 rounded-[10px]
                         bg-[#3b5bdb] hover:bg-[#2f4ac4] active:scale-[0.98]
                         text-white text-[13px] font-semibold
                         transition-all duration-150 shadow-sm"
            >
              <UserPlus size={14} strokeWidth={2.5} />
              Thêm người dùng
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden gap-4 p-4">

        {/* ── Left panel: user list ── */}
        <aside className="w-72 shrink-0 flex flex-col gap-3">

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aeaeb2]" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-3 rounded-[10px]
                         bg-white border border-[#d2d2d7]/70
                         text-[13px] text-[#1d1d1f] placeholder:text-[#aeaeb2]
                         focus:outline-none focus:ring-1 focus:ring-[#3b5bdb]/40
                         transition-all"
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto rounded-2xl border border-[#d2d2d7]/60 bg-white divide-y divide-[#f2f2f7]">
            {/* New user item */}
            {canEdit && (
              <button
                onClick={selectNew}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3.5 py-3 text-left transition-all duration-100',
                  selectedId === null
                    ? 'bg-[#3b5bdb]/5 border-l-2 border-[#3b5bdb]'
                    : 'hover:bg-[#f5f5f7]'
                )}
              >
                <div className="w-7 h-7 rounded-full bg-[#3b5bdb]/10 flex items-center justify-center shrink-0">
                  <UserPlus size={12} className="text-[#3b5bdb]" strokeWidth={2.5} />
                </div>
                <span className="text-[13px] font-semibold text-[#3b5bdb]">Tạo mới</span>
              </button>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-[#3b5bdb]/30 border-t-[#3b5bdb] rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-[12px] text-[#aeaeb2] text-center py-10">Không có kết quả</p>
            ) : (
              filtered.map((u) => (
                <UserListItem
                  key={u.id}
                  user={u}
                  selected={selectedId === u.id}
                  isSelf={u.id === currentUserId}
                  onClick={() => selectUser(u)}
                />
              ))
            )}
          </div>
        </aside>

        {/* ── Right panel: form ── */}
        <section className="flex-1 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-6 max-w-xl">

            <h2 className="text-[15px] font-bold text-[#1d1d1f] mb-5">
              {selectedId === null ? 'Tạo người dùng mới' : `Chỉnh sửa: ${selectedUser?.username ?? ''}`}
            </h2>

            <div className="space-y-4">

              {/* Username */}
              <FormField label="Tên đăng nhập" required={selectedId === null}>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setField('username', e.target.value)}
                  disabled={!canEdit || selectedId !== null}
                  placeholder="vd: nguyen_van_a"
                  className={cn(
                    INPUT_CLS,
                    selectedId !== null && 'opacity-60 cursor-not-allowed'
                  )}
                />
              </FormField>

              {/* Password (create only) */}
              {selectedId === null && (
                <FormField label="Mật khẩu" required>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setField('password', e.target.value)}
                    placeholder="Ít nhất 4 ký tự"
                    disabled={!canEdit}
                    className={INPUT_CLS}
                  />
                </FormField>
              )}

              {/* Role */}
              <FormField label="Vai trò" required>
                <select
                  value={form.role}
                  onChange={(e) => setField('role', e.target.value as UserRole)}
                  disabled={!canEdit}
                  className={INPUT_CLS}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </FormField>

              {/* Workspace */}
              <FormField label="Xưởng / phòng ban">
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#d2d2d7]/70 bg-[#f5f5f7] p-2">
                  {WORKSPACE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-[12px] font-medium text-[#1d1d1f] border border-[#d2d2d7]/50 cursor-pointer hover:border-[#3b5bdb]/40"
                    >
                      <input
                        type="checkbox"
                        checked={selectedWorkspaces.includes(opt.value)}
                        onChange={(e) => toggleWorkspace(opt.value, e.target.checked)}
                        disabled={!canEdit}
                        className="h-3.5 w-3.5 accent-[#3b5bdb]"
                      />
                      <span className="truncate">{opt.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-[#aeaeb2] mt-1">
                  ALL = toàn quyền. Có thể chọn nhiều xưởng hoặc phòng ban cho Supervisor/User.
                </p>
              </FormField>

            </div>

            {/* Action buttons */}
            <div className="mt-6 flex items-center gap-2.5 flex-wrap">
              <button
                onClick={handleSave}
                disabled={!canEdit || saving || isSelf && selectedId !== null}
                className="flex items-center gap-1.5 h-9 px-5 rounded-[10px]
                           bg-[#3b5bdb] hover:bg-[#2f4ac4] active:scale-[0.98]
                           text-white text-[13px] font-semibold
                           transition-all duration-150 shadow-sm
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={13} strokeWidth={2.5} />
                {saving ? 'Đang lưu...' : selectedId === null ? 'Tạo tài khoản' : 'Lưu thay đổi'}
              </button>

              {/* Reset password (edit mode only, not self) */}
              {canEdit && selectedId !== null && !isSelf && (
                <button
                  onClick={() => { setShowReset((v) => !v); setResetPass('') }}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-[10px]
                             border border-[#d2d2d7]/80 bg-white hover:bg-[#f5f5f7]
                             text-[#1d1d1f] text-[13px] font-medium
                             active:scale-[0.98] transition-all duration-150"
                >
                  <KeyRound size={13} strokeWidth={2} />
                  Đặt lại mật khẩu
                </button>
              )}

              {/* Delete (edit mode only, not self) */}
              {canEdit && selectedId !== null && !isSelf && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className={cn(
                    'flex items-center gap-1.5 h-9 px-4 rounded-[10px]',
                    'text-[13px] font-medium transition-all duration-150 active:scale-[0.98]',
                    confirmDelete
                      ? 'bg-[#ff3b30] text-white hover:bg-[#e0362c]'
                      : 'border border-[#ff3b30]/40 text-[#ff3b30] hover:bg-[#ff3b30]/5',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Trash2 size={13} strokeWidth={2} />
                  {deleting ? 'Đang xóa...' : confirmDelete ? 'Xác nhận xóa?' : 'Xóa'}
                </button>
              )}

              {confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="h-9 px-3 rounded-[10px] border border-[#d2d2d7]/80
                             text-[#6e6e73] text-[13px] hover:bg-[#f5f5f7] transition-all"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {isSelf && selectedId !== null && (
              <p className="text-[12px] text-[#aeaeb2] mt-3">
                Không thể chỉnh sửa tài khoản của chính mình tại đây. Dùng chức năng Đổi mật khẩu.
              </p>
            )}

            {/* Inline reset password panel */}
            {showReset && selectedId !== null && (
              <div className="mt-5 p-4 rounded-xl bg-[#f5f5f7] border border-[#d2d2d7]/70 space-y-3">
                <p className="text-[12px] font-semibold text-[#1d1d1f]">Mật khẩu mới cho {selectedUser?.username}</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={resetPass}
                    onChange={(e) => setResetPass(e.target.value)}
                    placeholder="Nhập mật khẩu mới"
                    className={cn(INPUT_CLS, 'flex-1')}
                  />
                  <button
                    onClick={handleResetPassword}
                    disabled={resetting || resetPass.length < 4}
                    className="h-9 px-4 rounded-[10px] bg-[#3b5bdb] hover:bg-[#2f4ac4]
                               text-white text-[13px] font-semibold
                               transition-all active:scale-[0.98]
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetting ? 'Đang lưu...' : 'Đặt lại'}
                  </button>
                  <button
                    onClick={() => { setShowReset(false); setResetPass('') }}
                    className="h-9 px-3 rounded-[10px] border border-[#d2d2d7]/80
                               text-[#6e6e73] hover:bg-white transition-all"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            )}

          </div>
        </section>
      </div>

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UserListItem({
  user,
  selected,
  isSelf,
  onClick,
}: {
  user: UserRow
  selected: boolean
  isSelf: boolean
  onClick: () => void
}) {
  const workspaces = user.workspace
    ? user.workspace.split(',').map((w) => w.trim()).filter(Boolean)
    : []

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex flex-col gap-1 px-3.5 py-3 text-left transition-all duration-100',
        selected
          ? 'bg-[#3b5bdb]/5 border-l-2 border-[#3b5bdb]'
          : 'hover:bg-[#f5f5f7] border-l-2 border-transparent'
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-[#1d1d1f] truncate flex-1">
          {user.username}
          {isSelf && <span className="ml-1 text-[11px] font-normal text-[#aeaeb2]">(bạn)</span>}
        </span>
        <span className={cn(
          'text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
          ROLE_BADGE[user.role]
        )}>
          {ROLE_LABEL[user.role]}
        </span>
      </div>

      {workspaces.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {workspaces.map((ws) => (
            <span
              key={ws}
              className="text-[10px] font-medium px-1.5 py-px rounded-md
                         bg-[#f2f2f7] text-[#6e6e73] border border-[#d2d2d7]/60"
            >
              {ws}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}

function FormField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-semibold text-[#1d1d1f]">
        {label}
        {required && <span className="text-[#ff3b30] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
