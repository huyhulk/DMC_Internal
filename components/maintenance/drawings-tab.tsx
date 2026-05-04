'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus, RefreshCw, Send, Trash2 } from 'lucide-react'
import { cn, formatDate, getLocalCompactDate, getLocalDateAfterDays, getTodayLocal } from '@/lib/utils'
import { getDrawingListFilter } from '@/lib/maintenance/workflow'
import {
  drawingCreateSchema, drawingCompleteSchema,
  DRAWING_STATUSES, DRAWING_STATUS_LABELS,
  type DrawingCreateInput, type DrawingCompleteInput,
} from '@/lib/validations/maintenance'
import {
  createDrawingAction, completeDrawingAction, deleteDrawingAction, listDrawingsAction,
  type DrawingRow,
} from '@/lib/actions/maintenance'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import type { SessionUser } from '@/types'

const inputCls = 'w-full h-9 px-2.5 rounded-lg text-[12px] font-medium text-[#1d1d1f] placeholder:text-[#aeaeb2] bg-white border border-[#d2d2d7] focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 transition-all'
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73] mb-1'

function genDrawingCode() {
  const yyyymmdd = getLocalCompactDate()
  const nnn = String(Math.floor(Math.random() * 900) + 100)
  return `BV-${yyyymmdd}-${nnn}`
}

function statusVariant(s: string): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
  if (s === 'released') return 'success'
  if (s === 'approved') return 'info'
  if (s === 'reviewing') return 'warning'
  if (s === 'revised')  return 'danger'
  return 'neutral'
}

interface Props {
  user: SessionUser
  canEdit: boolean
}

export function DrawingsTab({ user, canEdit }: Props) {
  const [rows, setRows]       = useState<DrawingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode]       = useState<'request' | 'deliver'>('request')
  const [showCreate, setShowCreate] = useState(false)
  const [deliverId, setDeliverId]   = useState<string | null>(null)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [filter, setFilter] = useState({ from: '', to: '', status: 'ALL' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const drawingFilter = getDrawingListFilter(mode, filter.status)
      const res = await listDrawingsAction({
        from:   filter.from || undefined,
        to:     filter.to   || undefined,
        status: drawingFilter.status,
        openOnly: drawingFilter.openOnly,
      })
      if (res.success) setRows(res.data ?? [])
      else setRows([])
    } finally {
      setLoading(false)
    }
  }, [filter, mode])

  useEffect(() => { void load() }, [load])

  const createForm = useForm<DrawingCreateInput>({
    resolver: zodResolver(drawingCreateSchema),
    defaultValues: {
      drawing_code: genDrawingCode(),
      request_date: getTodayLocal(),
      due_date:     getLocalDateAfterDays(7),
    },
  })

  const completeForm = useForm<DrawingCompleteInput>({
    resolver: zodResolver(drawingCompleteSchema),
    defaultValues: { delivered_date: getTodayLocal(), has_errors: false, status: 'released' },
  })

  const hasErrors = completeForm.watch('has_errors')

  async function onCreateSubmit(values: DrawingCreateInput) {
    setSubmitting(true)
    const res = await createDrawingAction(values)
    if (res.success) { toast.success(res.message); setShowCreate(false); createForm.reset({ drawing_code: genDrawingCode(), request_date: getTodayLocal(), due_date: getLocalDateAfterDays(7) }); void load() }
    else toast.error(res.message)
    setSubmitting(false)
  }

  async function onCompleteSubmit(values: DrawingCompleteInput) {
    if (!deliverId) return
    setSubmitting(true)
    const res = await completeDrawingAction(deliverId, values)
    if (res.success) { toast.success(res.message); setDeliverId(null); void load() }
    else toast.error(res.message)
    setSubmitting(false)
  }

  async function onDelete() {
    if (!deleteId) return
    setSubmitting(true)
    const res = await deleteDrawingAction(deleteId)
    if (res.success) { toast.success(res.message); setDeleteId(null); void load() }
    else toast.error(res.message)
    setSubmitting(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">Bản vẽ kỹ thuật (KT-05/06)</h1>
          <p className="text-[13px] text-[#6e6e73] mt-0.5">Quản lý yêu cầu, tiến độ và bàn giao bản vẽ</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium bg-dmc-primary text-white rounded-xl hover:opacity-90">
            <Plus size={14} /> Thêm yêu cầu
          </button>
        )}
      </div>

      {/* Mode + filter */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4 space-y-3">
        <div className="flex gap-2">
          {(['request', 'deliver'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={cn('px-4 py-1.5 text-[12px] font-semibold rounded-full transition-all',
                mode === m ? 'bg-dmc-primary text-white' : 'border border-[#d2d2d7] text-[#6e6e73] hover:bg-[#f2f2f7]')}>
              {m === 'request' ? 'Đăng ký yêu cầu' : 'Bàn giao / Hoàn thành'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {mode === 'request' && (
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Trạng thái</label>
              <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))} className={cn(inputCls, 'w-36')}>
                <option value="ALL">Tất cả</option>
                {DRAWING_STATUSES.map((s) => <option key={s} value={s}>{DRAWING_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Từ ngày</label>
            <input type="date" value={filter.from} onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))} className={cn(inputCls, 'w-36')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Đến ngày</label>
            <input type="date" value={filter.to} onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))} className={cn(inputCls, 'w-36')} />
          </div>
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
          <EmptyState icon="📐" title="Chưa có bản vẽ nào" subtitle="Thêm yêu cầu bản vẽ mới" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#f5f5f7] text-[11px] uppercase text-[#6e6e73]">
                <tr>
                  <th className="p-3 text-left">Mã BV</th>
                  <th className="p-3 text-left">Tên / Loại</th>
                  <th className="p-3 text-left">Khách hàng</th>
                  <th className="p-3 text-left">Yêu cầu / Hạn</th>
                  <th className="p-3 text-left">Bàn giao</th>
                  <th className="p-3 text-center">Đúng hạn</th>
                  <th className="p-3 text-center">Trạng thái</th>
                  <th className="p-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#d2d2d7]/40 hover:bg-[#fafafa]">
                    <td className="p-3 font-mono text-[12px] font-semibold">{row.drawing_code}</td>
                    <td className="p-3">
                      <p className="font-medium text-[12px]">{row.drawing_name}</p>
                    </td>
                    <td className="p-3 text-[12px]">{row.customer ?? '—'}</td>
                    <td className="p-3 text-[12px]">
                      <span>{formatDate(row.request_date)}</span>
                      <span className="text-[#6e6e73]"> → </span>
                      <span className={cn(row.delivered_date == null && row.due_date < getTodayLocal() ? 'text-red-600 font-semibold' : '')}>
                        {formatDate(row.due_date)}
                      </span>
                    </td>
                    <td className="p-3 text-[12px]">{row.delivered_date ? formatDate(row.delivered_date) : '—'}</td>
                    <td className="p-3 text-center">
                      {row.delivered_date
                        ? <Badge variant={row.is_on_time ? 'success' : 'danger'}>{row.is_on_time ? '✓' : '✗'}</Badge>
                        : <span className="text-[#aeaeb2]">—</span>}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={statusVariant(row.status)}>
                        {DRAWING_STATUS_LABELS[row.status as typeof DRAWING_STATUSES[number]] ?? row.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {canEdit && row.status !== 'released' && (
                          <button onClick={() => { setDeliverId(row.id); completeForm.reset({ delivered_date: getTodayLocal(), has_errors: false, status: 'released' }) }}
                            title="Bàn giao" className="text-blue-600 hover:text-blue-700">
                            <Send size={14} />
                          </button>
                        )}
                        {canEdit && user.role === 'ADMIN' && (
                          <button onClick={() => setDeleteId(row.id)} title="Xóa" className="text-red-400 hover:text-red-600">
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
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="Thêm yêu cầu bản vẽ" size="lg">
        <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-3">
          <div>
            <label className={labelCls}>Mã bản vẽ *</label>
            <input {...createForm.register('drawing_code')} className={inputCls} />
            {createForm.formState.errors.drawing_code && (
              <p className="text-[11px] text-red-500 mt-0.5">{createForm.formState.errors.drawing_code.message}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Tên bản vẽ *</label>
            <input {...createForm.register('drawing_name')} className={inputCls} />
            {createForm.formState.errors.drawing_name && (
              <p className="text-[11px] text-red-500 mt-0.5">{createForm.formState.errors.drawing_name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Khách hàng</label>
              <input {...createForm.register('customer')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Mã dự án</label>
              <input {...createForm.register('project_code')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ngày yêu cầu *</label>
              <input type="date" {...createForm.register('request_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Hạn giao *</label>
              <input type="date" {...createForm.register('due_date')} className={inputCls} />
              {createForm.formState.errors.due_date && (
                <p className="text-[11px] text-red-500 mt-0.5">{createForm.formState.errors.due_date.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Người vẽ</label>
              <input {...createForm.register('drafter')} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Ghi chú</label>
            <textarea {...createForm.register('notes')} rows={2} className={cn(inputCls, 'h-auto resize-none')} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">Hủy</button>
            <button type="submit" disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-dmc-primary text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Đang lưu…' : 'Thêm yêu cầu'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Deliver Dialog */}
      <Dialog open={!!deliverId} onClose={() => setDeliverId(null)} title="Bàn giao bản vẽ" size="md">
        <form onSubmit={completeForm.handleSubmit(onCompleteSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Ngày bàn giao *</label>
              <input type="date" {...completeForm.register('delivered_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Trạng thái *</label>
              <select {...completeForm.register('status')} className={inputCls}>
                <option value="released">Phát hành</option>
                <option value="approved">Đã duyệt</option>
                <option value="revised">Sửa lại</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Người duyệt</label>
              <input {...completeForm.register('reviewer')} className={inputCls} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="has_errors" {...completeForm.register('has_errors')}
              className="w-4 h-4 accent-red-500" />
            <label htmlFor="has_errors" className="text-[13px] text-[#1d1d1f]">Bản vẽ có lỗi</label>
          </div>
          {hasErrors && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Số lỗi</label>
                <input type="number" min="0" {...completeForm.register('error_count', { valueAsNumber: true })} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Chi tiết lỗi</label>
                <textarea {...completeForm.register('error_details')} rows={2} className={cn(inputCls, 'h-auto resize-none')} />
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setDeliverId(null)}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">Hủy</button>
            <button type="submit" disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-dmc-primary text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Đang lưu…' : 'Bàn giao'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Xác nhận xóa" size="sm">
        <p className="text-[13px] mb-4">Bạn có chắc muốn xóa bản vẽ này?</p>
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
