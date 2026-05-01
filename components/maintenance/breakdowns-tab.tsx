'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus, RefreshCw, CheckCircle, Pencil, Trash2 } from 'lucide-react'
import { cn, formatDate, getTodayLocal } from '@/lib/utils'
import {
  breakdownCreateSchema, breakdownResolveSchema,
  FAILURE_TYPES, FAILURE_TYPE_LABELS, BREAKDOWN_STATUSES, BREAKDOWN_STATUS_LABELS,
  KPI_WORKSHOPS, type BreakdownCreateInput, type BreakdownResolveInput,
} from '@/lib/validations/maintenance'
import {
  createBreakdownAction, resolveBreakdownAction, deleteBreakdownAction, listBreakdownsAction,
  listMachineCodesAction, listStaffByWorkshopAction, type BreakdownRow,
} from '@/lib/actions/maintenance'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import type { SessionUser } from '@/types'

const inputCls = 'w-full h-9 px-2.5 rounded-lg text-[12px] font-medium text-[#1d1d1f] placeholder:text-[#aeaeb2] bg-white border border-[#d2d2d7] focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 transition-all'
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73] mb-1'

function statusVariant(s: string) {
  if (s === 'resolved')    return 'success'
  if (s === 'in_progress') return 'info'
  return 'warning'
}

function formatDowntime(minutes: number | null) {
  if (minutes === null || minutes === undefined) return '—'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}p`
  return `${h}g ${m}p`
}

interface Props { user: SessionUser }

export function BreakdownsTab({ user }: Props) {
  const [rows, setRows]             = useState<BreakdownRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [resolveId, setResolveId]   = useState<string | null>(null)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [machines, setMachines]     = useState<{ machine_code: string; machine_name: string | null }[]>([])
  const [pktStaff, setPktStaff]     = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const [filter, setFilter] = useState({
    workshop: user.role === 'ADMIN' || user.role === 'MANAGER' ? 'ALL' : user.workspace,
    from: '', to: '', status: 'ALL', failure_type: 'ALL',
  })

  const allowedWorkshops = user.role === 'ADMIN' || user.role === 'MANAGER'
    ? ['ALL', ...KPI_WORKSHOPS]
    : [user.workspace]

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listBreakdownsAction({
      workshop:     filter.workshop !== 'ALL' ? filter.workshop : undefined,
      from:         filter.from || undefined,
      to:           filter.to   || undefined,
      status:       filter.status !== 'ALL' ? filter.status : undefined,
      failure_type: filter.failure_type !== 'ALL' ? filter.failure_type : undefined,
    })
    if (res.success) setRows(res.data ?? [])
    setLoading(false)
  }, [filter])

  const createForm = useForm<BreakdownCreateInput>({
    resolver: zodResolver(breakdownCreateSchema),
    defaultValues: {
      workshop: (allowedWorkshops[0] === 'ALL' ? KPI_WORKSHOPS[0] : allowedWorkshops[0]) as typeof KPI_WORKSHOPS[number],
      breakdown_start: new Date().toISOString().slice(0, 16),
      is_planned: false,
    },
  })

  const resolveForm = useForm<BreakdownResolveInput>({
    resolver: zodResolver(breakdownResolveSchema),
    defaultValues: { breakdown_end: new Date().toISOString().slice(0, 16) },
  })

  const formWorkshop = createForm.watch('workshop')

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    listMachineCodesAction(formWorkshop).then(setMachines)
  }, [formWorkshop])

  useEffect(() => {
    listStaffByWorkshopAction('PKT-SX').then((staff) => setPktStaff(staff.map((s) => s.name)))
  }, [])

  async function onCreateSubmit(values: BreakdownCreateInput) {
    setSubmitting(true)
    const res = await createBreakdownAction(values)
    if (res.success) {
      toast.success(res.message)
      setShowCreate(false)
      createForm.reset()
      void load()
    } else {
      toast.error(res.message)
    }
    setSubmitting(false)
  }

  async function onResolveSubmit(values: BreakdownResolveInput) {
    if (!resolveId) return
    setSubmitting(true)
    const res = await resolveBreakdownAction(resolveId, values)
    if (res.success) {
      toast.success(res.message)
      setResolveId(null)
      resolveForm.reset()
      void load()
    } else {
      toast.error(res.message)
    }
    setSubmitting(false)
  }

  async function onDelete() {
    if (!deleteId) return
    setSubmitting(true)
    const res = await deleteBreakdownAction(deleteId)
    if (res.success) {
      toast.success(res.message)
      setDeleteId(null)
      void load()
    } else {
      toast.error(res.message)
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">Sự cố máy (KT-01/02/03)</h1>
          <p className="text-[13px] text-[#6e6e73] mt-0.5">Theo dõi downtime, loại lỗi và xử lý sự cố</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium bg-dmc-primary text-white rounded-xl hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Báo cáo sự cố
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4 flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Xưởng</label>
          <select value={filter.workshop} onChange={(e) => setFilter((f) => ({ ...f, workshop: e.target.value }))}
            className={cn(inputCls, 'w-28')}>
            {allowedWorkshops.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Từ ngày</label>
          <input type="date" value={filter.from} onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))}
            className={cn(inputCls, 'w-36')} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Đến ngày</label>
          <input type="date" value={filter.to} onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))}
            className={cn(inputCls, 'w-36')} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Trạng thái</label>
          <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
            className={cn(inputCls, 'w-36')}>
            <option value="ALL">Tất cả</option>
            {BREAKDOWN_STATUSES.map((s) => <option key={s} value={s}>{BREAKDOWN_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Loại lỗi</label>
          <select value={filter.failure_type} onChange={(e) => setFilter((f) => ({ ...f, failure_type: e.target.value }))}
            className={cn(inputCls, 'w-36')}>
            <option value="ALL">Tất cả</option>
            {FAILURE_TYPES.map((t) => <option key={t} value={t}>{FAILURE_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={() => void load()} className="flex items-center gap-1 px-3 py-2 text-[12px] rounded-xl border border-[#d2d2d7] hover:bg-[#f2f2f7] transition-colors">
            <RefreshCw size={12} className={cn(loading && 'animate-spin')} /> Làm mới
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 overflow-hidden">
        {loading ? <TableSkeleton rows={5} cols={7} /> : rows.length === 0 ? (
          <EmptyState icon="🔧" title="Chưa có sự cố nào" subtitle="Nhấn 'Báo cáo sự cố' để thêm mới" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#f5f5f7] text-[11px] uppercase text-[#6e6e73]">
                <tr>
                  <th className="p-3 text-left">Ngày bắt đầu</th>
                  <th className="p-3 text-left">Máy</th>
                  <th className="p-3 text-left">Xưởng</th>
                  <th className="p-3 text-left">Loại lỗi</th>
                  <th className="p-3 text-right">Downtime</th>
                  <th className="p-3 text-center">Trạng thái</th>
                  <th className="p-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#d2d2d7]/40 hover:bg-[#fafafa]">
                    <td className="p-3 text-[12px]">{formatDate(row.breakdown_start, 'dd/MM HH:mm')}</td>
                    <td className="p-3">
                      <span className="font-semibold">{row.machine_code}</span>
                      {row.machine_name && <span className="text-[#6e6e73] text-[11px] ml-1">{row.machine_name}</span>}
                    </td>
                    <td className="p-3"><Badge variant="neutral">{row.workshop}</Badge></td>
                    <td className="p-3 text-[12px]">
                      {row.failure_type ? FAILURE_TYPE_LABELS[row.failure_type as typeof FAILURE_TYPES[number]] ?? row.failure_type : '—'}
                    </td>
                    <td className="p-3 text-right font-mono text-[12px]">
                      {formatDowntime(row.downtime_minutes)}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={statusVariant(row.status)}>
                        {BREAKDOWN_STATUS_LABELS[row.status as typeof BREAKDOWN_STATUSES[number]] ?? row.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {row.status !== 'resolved' && (
                          <button
                            onClick={() => { setResolveId(row.id); resolveForm.reset({ breakdown_end: new Date().toISOString().slice(0, 16) }) }}
                            title="Đánh dấu xong"
                            className="text-emerald-600 hover:text-emerald-700 transition-colors"
                          >
                            <CheckCircle size={15} />
                          </button>
                        )}
                        {user.role === 'ADMIN' && (
                          <button onClick={() => setDeleteId(row.id)} title="Xóa"
                            className="text-red-400 hover:text-red-600 transition-colors">
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

      {/* Create Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="Báo cáo sự cố máy" size="lg">
        <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Xưởng *</label>
              <select {...createForm.register('workshop')} className={inputCls}>
                {KPI_WORKSHOPS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tên thiết bị *</label>
              <select
                className={inputCls}
                value={createForm.watch('machine_code') ?? ''}
                onChange={(e) => {
                  const code = e.target.value
                  const found = machines.find((m) => m.machine_code === code)
                  createForm.setValue('machine_name', found?.machine_name ?? '', { shouldValidate: true })
                  createForm.setValue('machine_code', code, { shouldValidate: true })
                }}
              >
                <option value="">— Chọn thiết bị —</option>
                {machines.map((m) => (
                  <option key={m.machine_code} value={m.machine_code}>
                    {m.machine_name ?? m.machine_code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Mã thiết bị</label>
              <input
                {...createForm.register('machine_code')}
                className={inputCls}
                placeholder="Tự điền khi chọn tên"
              />
              {createForm.formState.errors.machine_code && (
                <p className="text-[11px] text-red-500 mt-0.5">{createForm.formState.errors.machine_code.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Loại lỗi</label>
              <select {...createForm.register('failure_type')} className={inputCls}>
                <option value="">— Chọn loại —</option>
                {FAILURE_TYPES.map((t) => <option key={t} value={t}>{FAILURE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Thời gian bắt đầu *</label>
              <input type="datetime-local" {...createForm.register('breakdown_start')} className={inputCls} />
              {createForm.formState.errors.breakdown_start && (
                <p className="text-[11px] text-red-500 mt-0.5">{createForm.formState.errors.breakdown_start.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Thời gian kết thúc</label>
              <input type="datetime-local" {...createForm.register('breakdown_end')} className={inputCls} />
              {createForm.formState.errors.breakdown_end && (
                <p className="text-[11px] text-red-500 mt-0.5">{createForm.formState.errors.breakdown_end.message}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelCls}>Nguyên nhân gốc</label>
              <textarea {...createForm.register('root_cause')} rows={2}
                className={cn(inputCls, 'h-auto resize-none')} />
            </div>
            <div>
              <label className={labelCls}>Hành động sửa chữa</label>
              <textarea {...createForm.register('repair_action')} rows={2}
                className={cn(inputCls, 'h-auto resize-none')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phụ tùng thay thế</label>
              <input {...createForm.register('parts_replaced')} className={inputCls} placeholder="ổ bi 6204, dầu 5L…" />
            </div>
            <div>
              <label className={labelCls}>Thợ sửa</label>
              <select {...createForm.register('technician')} className={inputCls}>
                <option value="">— Chọn —</option>
                {pktStaff.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_planned" {...createForm.register('is_planned')}
              className="w-4 h-4 accent-dmc-primary" />
            <label htmlFor="is_planned" className="text-[13px] text-[#1d1d1f]">Đây là bảo trì có kế hoạch (không phải sự cố đột xuất)</label>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7] transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-dmc-primary text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {submitting ? 'Đang lưu…' : 'Lưu sự cố'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={!!resolveId} onClose={() => setResolveId(null)} title="Cập nhật thực hiện" size="sm">
        <form onSubmit={resolveForm.handleSubmit(onResolveSubmit)} className="space-y-3">
          <div>
            <label className={labelCls}>Thời gian kết thúc *</label>
            <input type="datetime-local" {...resolveForm.register('breakdown_end')} className={inputCls} />
            {resolveForm.formState.errors.breakdown_end && (
              <p className="text-[11px] text-red-500 mt-0.5">{resolveForm.formState.errors.breakdown_end.message}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Hành động sửa chữa</label>
            <textarea {...resolveForm.register('repair_action')} rows={2}
              className={cn(inputCls, 'h-auto resize-none')} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Phụ tùng thay thế</label>
              <input {...resolveForm.register('parts_replaced')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Thợ sửa</label>
              <select {...resolveForm.register('technician')} className={inputCls}>
                <option value="">— Chọn —</option>
                {pktStaff.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setResolveId(null)}
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
        <p className="text-[13px] text-[#1d1d1f] mb-4">Bạn có chắc muốn xóa sự cố này? Hành động không thể hoàn tác.</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteId(null)}
            className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">Hủy</button>
          <button onClick={onDelete} disabled={submitting}
            className="flex-1 h-10 rounded-xl bg-red-600 text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
            {submitting ? 'Đang xóa…' : 'Xóa'}
          </button>
        </div>
      </Dialog>
    </div>
  )
}
