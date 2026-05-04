'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Plus, Trash2, Save, Search } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  createHumanResource,
  updateHumanResource,
  deleteHumanResource,
} from '@/lib/actions/hr'
import { getTodayLocal } from '@/lib/utils'
import { FACTORIES, type HumanResource } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  name: string
  factory: string
  machine: string
  position: string
  phone: string
}

function emptyForm(): FormData {
  return { name: '', factory: 'DMC1', machine: '', position: '', phone: '' }
}

interface Props {
  open: boolean
  canEdit: boolean
  onClose: () => void
  onRefresh: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function HRAdminModal({ open, canEdit, onClose, onRefresh }: Props) {
  const [employees, setEmployees]     = useState<HumanResource[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId]   = useState<number | null>(null)
  const [formData, setFormData]       = useState<FormData>(emptyForm())
  const [nameError, setNameError]     = useState('')
  const [loading, setLoading]         = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [fetching, setFetching]       = useState(false)

  // ── Load employees on open ──
  const loadEmployees = useCallback(async () => {
    setFetching(true)
    try {
      const date = getTodayLocal()
      const res = await fetch(`/api/hr?date=${date}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { employees: HumanResource[] }
      setEmployees(json.employees)
    } catch (err) {
      toast.error(`Không tải được nhân sự: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadEmployees()
      setSelectedId(null)
      setFormData(emptyForm())
      setNameError('')
      setSearchQuery('')
    }
  }, [open, loadEmployees])

  // ── Select employee ──
  function selectEmployee(emp: HumanResource) {
    setSelectedId(emp.id)
    setFormData({
      name: emp.name,
      factory: emp.factory ?? 'DMC1',
      machine: emp.machine ?? '',
      position: emp.position ?? '',
      phone: emp.phone ?? '',
    })
    setNameError('')
  }

  function selectNew() {
    setSelectedId(null)
    setFormData(emptyForm())
    setNameError('')
  }

  // ── Form field updater ──
  function setField(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (field === 'name' && value.trim()) setNameError('')
  }

  // ── Save ──
  async function handleSave() {
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    if (!formData.name.trim()) {
      setNameError('Họ tên không được để trống')
      return
    }

    setLoading(true)
    try {
      const fd = new window.FormData()
      fd.set('name',     formData.name.trim())
      fd.set('factory',  formData.factory)
      fd.set('machine',  formData.machine.trim())
      fd.set('position', formData.position.trim())
      fd.set('phone',    formData.phone.trim())

      let result: { success: boolean; error?: string }

      if (selectedId === null) {
        result = await createHumanResource(fd)
      } else {
        result = await updateHumanResource(selectedId, fd)
      }

      if (result.success) {
        toast.success(selectedId === null ? 'Đã thêm nhân sự mới' : 'Đã cập nhật thông tin')
        await loadEmployees()
        onRefresh()
        if (selectedId === null) {
          setFormData(emptyForm())
          setSelectedId(null)
        }
      } else {
        toast.error(result.error ?? 'Lưu thất bại')
      }
    } catch {
      toast.error('Lỗi kết nối, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  // ── Delete ──
  async function handleDelete() {
    if (selectedId === null) return
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }

    const emp = employees.find((e) => e.id === selectedId)
    const confirmed = window.confirm(
      `Xóa nhân sự "${emp?.name ?? selectedId}"?\nHành động này không thể hoàn tác.`
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      const result = await deleteHumanResource(selectedId)
      if (result.success) {
        toast.success('Đã xóa nhân sự')
        setSelectedId(null)
        setFormData(emptyForm())
        await loadEmployees()
        onRefresh()
      } else {
        toast.error(result.error ?? 'Xóa thất bại')
      }
    } catch {
      toast.error('Lỗi kết nối, vui lòng thử lại')
    } finally {
      setDeleting(false)
    }
  }

  // ── Filtered list ──
  const filtered = employees.filter((emp) =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.factory ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div
        className="relative w-full max-w-2xl bg-white rounded-[20px]
                   shadow-[0_20px_60px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.08)]
                   flex flex-col max-h-[85vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#d2d2d7]/60 shrink-0">
          <h2 className="text-[16px] font-semibold text-[#1d1d1f] tracking-[-0.01em]">
            Quản lý nhân sự
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#f2f2f7] hover:bg-[#e5e5ea]
                       flex items-center justify-center transition-colors duration-150"
          >
            <X size={14} strokeWidth={2.5} className="text-[#6e6e73]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">

          {/* ── LEFT PANEL ── */}
          <div className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r
                          border-[#d2d2d7]/60 flex flex-col">
            {/* Search */}
            <div className="p-3 border-b border-[#d2d2d7]/60">
              <div className="relative">
                <Search
                  size={13}
                  strokeWidth={2.5}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#aeaeb2]"
                />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm…"
                  className="w-full h-8 pl-7 pr-3 rounded-lg bg-[#f2f2f7]
                             border border-[#d2d2d7]/70 text-[12px] text-[#1d1d1f]
                             focus:outline-none focus:ring-1 focus:ring-[#3b5bdb]/40
                             placeholder:text-[#aeaeb2] transition-all"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {fetching ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[#3b5bdb]/30 border-t-[#3b5bdb] rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-[12px] text-[#aeaeb2] text-center py-6 px-3">
                  Không có nhân sự
                </p>
              ) : (
                filtered.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => selectEmployee(emp)}
                    className={cn(
                      'w-full px-3 py-2.5 text-left flex items-center justify-between gap-2',
                      'hover:bg-[#f5f5f7] transition-colors duration-100',
                      selectedId === emp.id && 'bg-[#3b5bdb]/8'
                    )}
                  >
                    <span className={cn(
                      'text-[13px] font-medium truncate',
                      selectedId === emp.id ? 'text-[#3b5bdb]' : 'text-[#1d1d1f]'
                    )}>
                      {emp.name}
                    </span>
                    {emp.factory && (
                      <span className={cn(
                        'shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                        selectedId === emp.id
                          ? 'bg-[#3b5bdb]/15 text-[#3b5bdb]'
                          : 'bg-[#f2f2f7] text-[#6e6e73]'
                      )}>
                        {emp.factory}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Add new button */}
            <div className="p-3 border-t border-[#d2d2d7]/60 shrink-0">
              <button
                type="button"
                onClick={selectNew}
                className={cn(
                  'w-full h-8 rounded-lg border text-[12px] font-semibold',
                  'flex items-center justify-center gap-1.5 transition-all duration-150',
                  selectedId === null
                    ? 'bg-[#3b5bdb] text-white border-[#3b5bdb]'
                    : 'bg-white text-[#3b5bdb] border-[#3b5bdb]/40 hover:bg-[#3b5bdb]/5'
                )}
              >
                <Plus size={13} strokeWidth={2.5} />
                Thêm mới
              </button>
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            <div className="p-5 flex flex-col gap-4 flex-1">

              {/* Name */}
              <FormField label="Họ và tên" required error={nameError}>
                <input
                  value={formData.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Nguyễn Văn A"
                  disabled={!canEdit}
                  className={cn(inputCls, nameError && 'border-[#ff3b30]/60 focus:ring-[#ff3b30]/30')}
                />
              </FormField>

              {/* Factory */}
              <FormField label="Nhà máy / Tổ">
                <select
                  value={formData.factory}
                  onChange={(e) => setField('factory', e.target.value)}
                  disabled={!canEdit}
                  className={cn(inputCls, 'cursor-pointer')}
                >
                  {FACTORIES.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                  <option value="PKT-SX">PKT-SX (Kỹ thuật-SX)</option>
                  <option value="DIEU-PHOI">DIEU-PHOI (Điều phối)</option>
                  <option value="Khác">Khác</option>
                </select>
              </FormField>

              {/* Machine */}
              <FormField label="Máy / Thiết bị">
                <input
                  value={formData.machine}
                  onChange={(e) => setField('machine', e.target.value)}
                  placeholder="Máy may 01"
                  disabled={!canEdit}
                  className={inputCls}
                />
              </FormField>

              {/* Position */}
              <FormField label="Chức vụ">
                <input
                  value={formData.position}
                  onChange={(e) => setField('position', e.target.value)}
                  placeholder="Công nhân"
                  disabled={!canEdit}
                  className={inputCls}
                />
              </FormField>

              {/* Phone */}
              <FormField label="Số điện thoại">
                <input
                  value={formData.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="0901 234 567"
                  disabled={!canEdit}
                  className={inputCls}
                />
              </FormField>
            </div>

            {/* Action row */}
            <div className="px-5 pb-5 shrink-0 flex items-center justify-between gap-3 pt-2
                            border-t border-[#d2d2d7]/60">
              {/* Delete (only when editing existing) */}
              {selectedId !== null ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!canEdit || deleting || loading}
                  className="h-10 px-4 rounded-[10px] border border-[#ff3b30]/40
                             text-[#ff3b30] text-[13px] font-semibold
                             hover:bg-[#ff3b30]/5 active:scale-[0.98]
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-all duration-150 flex items-center gap-2"
                >
                  {deleting ? (
                    <span className="w-3.5 h-3.5 border-2 border-[#ff3b30]/30 border-t-[#ff3b30] rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={13} strokeWidth={2.5} />
                  )}
                  {deleting ? 'Đang xóa…' : 'Xóa'}
                </button>
              ) : (
                <div />
              )}

              {/* Save */}
              <button
                type="button"
                onClick={handleSave}
                disabled={!canEdit || loading || deleting}
                className="h-10 px-5 rounded-[10px] bg-[#3b5bdb] hover:bg-[#2f4ac4]
                           text-white text-[13px] font-semibold
                           active:scale-[0.98] transition-all duration-150
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center gap-2 shadow-sm"
              >
                {loading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save size={13} strokeWidth={2.5} />
                )}
                {loading ? 'Đang lưu…' : selectedId === null ? 'Thêm mới' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const inputCls =
  'w-full h-10 px-3 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/70 ' +
  'text-[13px] text-[#1d1d1f] ' +
  'focus:outline-none focus:ring-1 focus:ring-[#3b5bdb]/40 ' +
  'transition-all duration-150 ' +
  'placeholder:text-[#aeaeb2]'

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-[#6e6e73] tracking-[0.02em]">
        {label}
        {required && <span className="text-[#ff3b30] ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-[11px] text-[#ff3b30]">{error}</p>
      )}
    </div>
  )
}
