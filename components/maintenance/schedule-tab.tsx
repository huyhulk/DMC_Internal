'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus, RefreshCw, CheckCircle, Trash2, Repeat, XCircle } from 'lucide-react'
import { cn, formatDate, getTodayLocal } from '@/lib/utils'
import { getMaintenanceWorkshopOptions } from '@/lib/maintenance/workflow'
import { canApproveRequests, getMaintenanceScheduleFilter, type ApprovalStatus } from '@/lib/approval/workflow'
import {
  scheduleBulkCreateSchema, scheduleCompleteSchema,
  MAINTENANCE_TYPES, MAINTENANCE_TYPE_LABELS, KPI_WORKSHOPS,
  type ScheduleBulkCreateInput, type ScheduleCompleteInput,
} from '@/lib/validations/maintenance'
import {
  createScheduleAction, bulkCreateScheduleAction, completeScheduleAction,
  deleteScheduleAction, listScheduleAction, reviewScheduleAction,
  type ScheduleRow,
} from '@/lib/actions/maintenance'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import type { SessionUser } from '@/types'

const inputCls = 'w-full h-9 px-2.5 rounded-lg text-[12px] font-medium text-[#1d1d1f] placeholder:text-[#aeaeb2] bg-white border border-[#d2d2d7] focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 transition-all'
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73] mb-1'

type Machine = { machine_code: string; machine_name: string | null }

// Shared fields for Create dialog — machine(s) come from checkbox state, not the form
type CreateFields = {
  workshop:         (typeof KPI_WORKSHOPS)[number]
  maintenance_type: (typeof MAINTENANCE_TYPES)[number]
  scheduled_date:   string
  technician:       string
  notes:            string
}

interface Props { user: SessionUser }

export function ScheduleTab({ user }: Props) {
  const [rows, setRows]       = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode]       = useState<'plan' | 'execute'>('plan')
  const [showCreate, setShowCreate]   = useState(false)
  const [showBulk, setShowBulk]       = useState(false)
  const [completeId, setCompleteId]   = useState<string | null>(null)
  const [completeChecklist, setCompleteChecklist] = useState<{ item: string; ok: boolean; note: string }[]>([])
  const [deleteId, setDeleteId]       = useState<string | null>(null)
  const [createMachines, setCreateMachines] = useState<Machine[]>([])
  const [bulkMachines,   setBulkMachines]   = useState<Machine[]>([])
  const [selectedMachines, setSelectedMachines] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting]   = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const allowedWorkshops = getMaintenanceWorkshopOptions(user.role, user.workspace, true)
  const createWorkshopOptions = allowedWorkshops.filter((w) => w !== 'ALL')
  const defaultWorkshop = (createWorkshopOptions[0] ?? KPI_WORKSHOPS[0]) as typeof KPI_WORKSHOPS[number]
  const [filter, setFilter] = useState({
    workshop: allowedWorkshops[0] ?? defaultWorkshop,
    from: '',
    to: '',
    type: 'ALL',
    approval: 'pending' as ApprovalStatus,
  })
  const approver = canApproveRequests(user.role)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listScheduleAction({
        workshop: filter.workshop !== 'ALL' ? filter.workshop : undefined,
        from:     filter.from || undefined,
        to:       filter.to   || undefined,
        maintenance_type: filter.type !== 'ALL' ? filter.type : undefined,
        completion_status: getMaintenanceScheduleFilter(mode).completion_status,
        approval_status: mode === 'execute' ? 'approved' : filter.approval,
      })
      if (res.success) setRows(res.data ?? [])
      else setRows([])
    } finally {
      setLoading(false)
    }
  }, [filter, mode])

  // ─── Forms ───────────────────────────────────────────────────────────────────

  const createForm = useForm<CreateFields>({
    defaultValues: {
      workshop:         defaultWorkshop,
      maintenance_type: 'monthly',
      scheduled_date:   getTodayLocal(),
      technician:       '',
      notes:            '',
    },
  })

  const bulkForm = useForm<ScheduleBulkCreateInput>({
    resolver: zodResolver(scheduleBulkCreateSchema),
    defaultValues: {
      workshop:         defaultWorkshop,
      machine_code:     '',
      machine_name:     '',
      maintenance_type: 'monthly',
      frequency:        'monthly',
      start_date:       getTodayLocal(),
      end_date:         getTodayLocal(),
    },
  })

  const completeForm = useForm<ScheduleCompleteInput>({
    resolver: zodResolver(scheduleCompleteSchema),
    defaultValues: { actual_date: getTodayLocal() },
  })

  const createWorkshop  = createForm.watch('workshop')
  const bulkWorkshop    = bulkForm.watch('workshop')
  const bulkMachineCode = bulkForm.watch('machine_code')

  useEffect(() => { void load() }, [load])

  // Fetch machine list for Create dialog, clear selection when workshop changes
  useEffect(() => {
    setSelectedMachines(new Set())
    fetch(`/api/machines?location=${createWorkshop}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setCreateMachines(data))
      .catch(() => {})
  }, [createWorkshop])

  // Fetch machine list for Bulk dialog, reset machine selection when workshop changes
  useEffect(() => {
    bulkForm.setValue('machine_code', '')
    bulkForm.setValue('machine_name', '')
    fetch(`/api/machines?location=${bulkWorkshop}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setBulkMachines(data))
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkWorkshop])

  // ─── Handlers ────────────────────────────────────────────────────────────────

  async function onCreateSubmit(values: CreateFields) {
    if (selectedMachines.size === 0) {
      toast.warning('Chọn ít nhất một thiết bị')
      return
    }
    setSubmitting(true)
    try {
      let successCount = 0
      for (const code of selectedMachines) {
        const m = createMachines.find((x) => x.machine_code === code)
        const res = await createScheduleAction({
          ...values,
          machine_code: code,
          machine_name: m?.machine_name ?? '',
        })
        if (res.success) successCount++
        else toast.error(res.message)
      }
      if (successCount > 0) {
        toast.success(`Đã tạo ${successCount} lịch bảo trì`)
        setShowCreate(false)
        createForm.reset({
          workshop: defaultWorkshop, maintenance_type: 'monthly',
          scheduled_date: getTodayLocal(), technician: '', notes: '',
        })
        setSelectedMachines(new Set())
        void load()
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function onBulkSubmit(values: ScheduleBulkCreateInput) {
    setSubmitting(true)
    try {
      const res = await bulkCreateScheduleAction(values)
      if (res.success) { toast.success(res.message); setShowBulk(false); bulkForm.reset(); void load() }
      else toast.error(res.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function onCompleteSubmit(values: ScheduleCompleteInput) {
    if (!completeId) return
    setSubmitting(true)
    try {
      const payload = { ...values, checklist_items: completeChecklist.length ? completeChecklist : undefined }
      const res = await completeScheduleAction(completeId, payload)
      if (res.success) { toast.success(res.message); setCompleteId(null); void load() }
      else toast.error(res.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete() {
    if (!deleteId) return
    setSubmitting(true)
    try {
      const res = await deleteScheduleAction(deleteId)
      if (res.success) { toast.success(res.message); setDeleteId(null); void load() }
      else toast.error(res.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function onReview(id: string, decision: 'approved' | 'rejected') {
    setReviewingId(id)
    try {
      const res = await reviewScheduleAction(id, decision)
      if (res.success) { toast.success(res.message); void load() }
      else toast.error(res.message)
    } finally {
      setReviewingId(null)
    }
  }

  function openComplete(row: ScheduleRow) {
    setCompleteId(row.id)
    completeForm.reset({ actual_date: getTodayLocal() })
    const items = Array.isArray(row.checklist_items) ? (row.checklist_items as string[]) : []
    setCompleteChecklist(items.map((item: string) => ({ item, ok: false, note: '' })))
  }

  const today = getTodayLocal()

  function scheduleStatus(row: ScheduleRow) {
    if (row.is_completed) return row.is_on_time ? 'success' : 'danger'
    if (row.scheduled_date < today) return 'danger'
    return 'warning'
  }

  function scheduleLabel(row: ScheduleRow) {
    if (row.is_completed) return row.is_on_time ? 'Đúng hạn' : 'Trễ hạn'
    if (row.scheduled_date < today) return 'Quá hạn'
    return 'Chưa thực hiện'
  }

  function approvalStatus(row: ScheduleRow) {
    if (row.approval_status === 'approved') return 'success'
    if (row.approval_status === 'rejected') return 'danger'
    return 'warning'
  }

  function approvalLabel(row: ScheduleRow) {
    if (row.approval_status === 'approved') return 'Đã duyệt'
    if (row.approval_status === 'rejected') return 'Từ chối'
    return 'Chờ duyệt'
  }

  const allSelected  = createMachines.length > 0 && selectedMachines.size === createMachines.length
  const someSelected = selectedMachines.size > 0 && !allSelected

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">Lịch bảo trì (KT-04)</h1>
          <p className="text-[13px] text-[#6e6e73] mt-0.5">Lập kế hoạch và theo dõi thực hiện bảo trì định kỳ</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border border-dmc-primary text-dmc-primary rounded-xl hover:bg-dmc-primary/5 transition-colors">
            <Repeat size={14} /> Tạo định kỳ
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium bg-dmc-primary text-white rounded-xl hover:opacity-90 transition-opacity">
            <Plus size={14} /> Thêm lịch
          </button>
        </div>
      </div>

      {/* Mode toggle + filter */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4 space-y-3">
        <div className="flex gap-2">
          {(['plan', 'execute'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={cn('px-4 py-1.5 text-[12px] font-semibold rounded-full transition-all',
                mode === m ? 'bg-dmc-primary text-white' : 'border border-[#d2d2d7] text-[#6e6e73] hover:bg-[#f2f2f7]')}>
              {m === 'plan' ? 'Kế hoạch' : 'Thực hiện'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Xưởng</label>
            <select value={filter.workshop} onChange={(e) => setFilter((f) => ({ ...f, workshop: e.target.value }))} className={cn(inputCls, 'w-28')}>
              {allowedWorkshops.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Từ ngày</label>
            <input type="date" value={filter.from} onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))} className={cn(inputCls, 'w-36')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Đến ngày</label>
            <input type="date" value={filter.to} onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))} className={cn(inputCls, 'w-36')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Loại BT</label>
            <select value={filter.type} onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))} className={cn(inputCls, 'w-36')}>
              <option value="ALL">Tất cả</option>
              {MAINTENANCE_TYPES.map((t) => <option key={t} value={t}>{MAINTENANCE_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          {mode === 'plan' && (
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Duyệt</label>
              <select
                value={filter.approval}
                onChange={(e) => setFilter((f) => ({ ...f, approval: e.target.value as ApprovalStatus }))}
                className={cn(inputCls, 'w-32')}
              >
                <option value="pending">Chờ duyệt</option>
                <option value="approved">Đã duyệt</option>
                <option value="rejected">Từ chối</option>
                <option value="ALL">Tất cả</option>
              </select>
            </div>
          )}
          <div className="flex items-end">
            <button onClick={() => void load()} className="flex items-center gap-1 px-3 py-2 text-[12px] rounded-xl border border-[#d2d2d7] hover:bg-[#f2f2f7]">
              <RefreshCw size={12} className={cn(loading && 'animate-spin')} /> Làm mới
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 overflow-hidden">
        {loading ? <TableSkeleton rows={5} cols={8} /> : rows.length === 0 ? (
          <EmptyState icon="📅" title="Chưa có lịch bảo trì" subtitle="Thêm lịch hoặc tạo lịch định kỳ" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#f5f5f7] text-[11px] uppercase text-[#6e6e73]">
                <tr>
                  <th className="p-3 text-left">Ngày lịch</th>
                  <th className="p-3 text-left">Máy</th>
                  <th className="p-3 text-left">Xưởng</th>
                  <th className="p-3 text-left">Loại BT</th>
                  <th className="p-3 text-left">Ngày thực hiện</th>
                  <th className="p-3 text-center">Trạng thái</th>
                  <th className="p-3 text-center">Duyệt</th>
                  <th className="p-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#d2d2d7]/40 hover:bg-[#fafafa]">
                    <td className="p-3 font-medium">{formatDate(row.scheduled_date)}</td>
                    <td className="p-3">
                      <span className="font-semibold">{row.machine_code}</span>
                      {row.machine_name && <span className="text-[#6e6e73] text-[11px] ml-1">{row.machine_name}</span>}
                    </td>
                    <td className="p-3"><Badge variant="neutral">{row.workshop}</Badge></td>
                    <td className="p-3 text-[12px]">
                      {MAINTENANCE_TYPE_LABELS[row.maintenance_type as (typeof MAINTENANCE_TYPES)[number]] ?? row.maintenance_type}
                    </td>
                    <td className="p-3 text-[12px]">{row.actual_date ? formatDate(row.actual_date) : '—'}</td>
                    <td className="p-3 text-center">
                      <Badge variant={scheduleStatus(row)}>{scheduleLabel(row)}</Badge>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={approvalStatus(row)}>{approvalLabel(row)}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {approver && row.approval_status === 'pending' && (
                          <>
                            <button
                              onClick={() => onReview(row.id, 'approved')}
                              disabled={reviewingId === row.id}
                              title="Duyệt lịch"
                              className="text-emerald-600 hover:text-emerald-700 disabled:opacity-40"
                            >
                              <CheckCircle size={15} />
                            </button>
                            <button
                              onClick={() => onReview(row.id, 'rejected')}
                              disabled={reviewingId === row.id}
                              title="Từ chối lịch"
                              className="text-red-500 hover:text-red-600 disabled:opacity-40"
                            >
                              <XCircle size={15} />
                            </button>
                          </>
                        )}
                        {!row.is_completed && row.approval_status === 'approved' && (
                          <button onClick={() => openComplete(row)} title="Đánh dấu hoàn thành"
                            className="text-emerald-600 hover:text-emerald-700">
                            <CheckCircle size={15} />
                          </button>
                        )}
                        {user.role === 'ADMIN' && (
                          <button onClick={() => setDeleteId(row.id)} title="Xóa"
                            className="text-red-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Dialog — multi-machine checkbox list */}
      <Dialog open={showCreate} onClose={() => { setShowCreate(false); setSelectedMachines(new Set()) }} title="Thêm lịch bảo trì" size="lg">
        <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Xưởng *</label>
              <select {...createForm.register('workshop')} className={inputCls}>
                {createWorkshopOptions.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Loại BT *</label>
              <select {...createForm.register('maintenance_type')} className={inputCls}>
                {MAINTENANCE_TYPES.map((t) => <option key={t} value={t}>{MAINTENANCE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Ngày lịch *</label>
              <input type="date" {...createForm.register('scheduled_date', { required: 'Chọn ngày lịch' })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Thợ bảo trì</label>
              <input {...createForm.register('technician')} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Ghi chú</label>
            <textarea {...createForm.register('notes')} rows={2} className={cn(inputCls, 'h-auto resize-none')} />
          </div>

          {/* Machine checkbox list */}
          <div>
            <label className={labelCls}>
              Chọn thiết bị *{selectedMachines.size > 0 && (
                <span className="text-dmc-primary normal-case font-normal ml-1">— {selectedMachines.size} đã chọn</span>
              )}
            </label>
            <div className="border border-[#d2d2d7] rounded-lg overflow-hidden">
              {/* Select all row */}
              <label className="flex items-center gap-2.5 px-3 py-2 bg-[#f5f5f7] border-b border-[#d2d2d7] cursor-pointer hover:bg-[#ebebeb]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected }}
                  onChange={(e) =>
                    setSelectedMachines(
                      e.target.checked ? new Set(createMachines.map((m) => m.machine_code)) : new Set()
                    )
                  }
                  className="w-4 h-4 accent-dmc-primary"
                />
                <span className="text-[11px] font-semibold text-[#6e6e73] select-none">
                  Chọn tất cả ({selectedMachines.size}/{createMachines.length})
                </span>
              </label>
              {/* Machine rows */}
              <div className="max-h-52 overflow-y-auto divide-y divide-[#d2d2d7]/40">
                {createMachines.length === 0 ? (
                  <p className="text-[12px] text-[#aeaeb2] px-3 py-5 text-center">Không có thiết bị nào trong xưởng này</p>
                ) : (
                  createMachines.map((m) => (
                    <label key={m.machine_code} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[#f5f5f7]">
                      <input
                        type="checkbox"
                        checked={selectedMachines.has(m.machine_code)}
                        onChange={(e) => {
                          const next = new Set(selectedMachines)
                          if (e.target.checked) next.add(m.machine_code)
                          else next.delete(m.machine_code)
                          setSelectedMachines(next)
                        }}
                        className="w-4 h-4 accent-dmc-primary shrink-0"
                      />
                      <span className="text-[12px] text-[#1d1d1f] flex-1 select-none">{m.machine_name ?? m.machine_code}</span>
                      <span className="text-[10px] text-[#aeaeb2] font-mono">{m.machine_code}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => { setShowCreate(false); setSelectedMachines(new Set()) }}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">Hủy</button>
            <button type="submit" disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-dmc-primary text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting
                ? 'Đang lưu…'
                : selectedMachines.size > 0
                  ? `Tạo ${selectedMachines.size} lịch`
                  : 'Tạo lịch'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Bulk Create Dialog — single machine + date range */}
      <Dialog open={showBulk} onClose={() => setShowBulk(false)} title="Tạo lịch định kỳ" size="md">
        <form onSubmit={bulkForm.handleSubmit(onBulkSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Xưởng *</label>
              <select {...bulkForm.register('workshop')} className={inputCls}>
                {createWorkshopOptions.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tên thiết bị *</label>
              <select
                className={inputCls}
                value={bulkMachineCode ?? ''}
                onChange={(e) => {
                  const code = e.target.value
                  const found = bulkMachines.find((m) => m.machine_code === code)
                  bulkForm.setValue('machine_name', found?.machine_name ?? '', { shouldValidate: true })
                  bulkForm.setValue('machine_code', code, { shouldValidate: true })
                }}
              >
                <option value="">— Chọn thiết bị —</option>
                {bulkMachines.map((m) => (
                  <option key={m.machine_code} value={m.machine_code}>
                    {m.machine_name ?? m.machine_code}
                  </option>
                ))}
              </select>
              {bulkForm.formState.errors.machine_code && (
                <p className="text-[11px] text-red-500 mt-0.5">{bulkForm.formState.errors.machine_code.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Loại BT *</label>
              <select {...bulkForm.register('maintenance_type')} className={inputCls}>
                {MAINTENANCE_TYPES.map((t) => <option key={t} value={t}>{MAINTENANCE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Chu kỳ *</label>
              <select {...bulkForm.register('frequency')} className={inputCls}>
                <option value="weekly">Hàng tuần</option>
                <option value="monthly">Hàng tháng</option>
                <option value="quarterly">Hàng quý</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Ngày bắt đầu *</label>
              <input type="date" {...bulkForm.register('start_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ngày kết thúc *</label>
              <input type="date" {...bulkForm.register('end_date')} className={inputCls} />
              {bulkForm.formState.errors.end_date && (
                <p className="text-[11px] text-red-500 mt-0.5">{bulkForm.formState.errors.end_date.message}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowBulk(false)}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">Hủy</button>
            <button type="submit" disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-dmc-primary text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Đang tạo…' : 'Tạo lịch định kỳ'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={!!completeId} onClose={() => setCompleteId(null)} title="Đánh dấu hoàn thành" size="md">
        <form onSubmit={completeForm.handleSubmit(onCompleteSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Ngày thực hiện *</label>
              <input type="date" {...completeForm.register('actual_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Thợ bảo trì</label>
              <input {...completeForm.register('technician')} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Ghi chú kết quả</label>
            <textarea {...completeForm.register('notes')} rows={2} className={cn(inputCls, 'h-auto resize-none')} />
          </div>
          {completeChecklist.length > 0 && (
            <div>
              <label className={labelCls}>Danh sách kiểm tra</label>
              <div className="space-y-1.5">
                {completeChecklist.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input type="checkbox" checked={item.ok}
                      onChange={(e) => setCompleteChecklist((prev) => prev.map((x, i) => i === idx ? { ...x, ok: e.target.checked } : x))}
                      className="w-4 h-4 accent-dmc-primary shrink-0" />
                    <span className="text-[12px] text-[#1d1d1f] flex-1">{item.item}</span>
                    <input value={item.note}
                      onChange={(e) => setCompleteChecklist((prev) => prev.map((x, i) => i === idx ? { ...x, note: e.target.value } : x))}
                      placeholder="Ghi chú" className={cn(inputCls, 'w-32 h-7 text-[11px]')} />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setCompleteId(null)}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">Hủy</button>
            <button type="submit" disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Đang lưu…' : 'Hoàn thành'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Xác nhận xóa" size="sm">
        <p className="text-[13px] mb-4">Bạn có chắc muốn xóa lịch này?</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteId(null)} className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">Hủy</button>
          <button onClick={onDelete} disabled={submitting} className="flex-1 h-10 rounded-xl bg-red-600 text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
            {submitting ? 'Đang xóa…' : 'Xóa'}
          </button>
        </div>
      </Dialog>
    </div>
  )
}
