'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus, RefreshCw, CheckCircle, Trash2 } from 'lucide-react'
import { cn, formatDate, getTodayLocal } from '@/lib/utils'
import {
  isoCreateSchema, isoCompleteSchema,
  ISO_CATEGORIES, ISO_CATEGORY_LABELS, ISO_STATUSES, ISO_STATUS_LABELS,
  type IsoCreateInput, type IsoCompleteInput,
} from '@/lib/validations/coordination'
import {
  createIsoAction, updateIsoProgressAction, completeIsoAction,
  deleteIsoAction, listIsoAction,
  type IsoProcedureRow,
} from '@/lib/actions/coordination'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import type { SessionUser } from '@/types'

const inputCls = 'w-full h-9 px-2.5 rounded-lg text-[12px] font-medium text-[#1d1d1f] placeholder:text-[#aeaeb2] bg-white border border-[#d2d2d7] focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 transition-all'
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73] mb-1'

function genIsoCode() {
  const y = new Date().getFullYear()
  const nnn = String(Math.floor(Math.random() * 900) + 100)
  return `ISO-${y}-${nnn}`
}

function statusVariant(s: string): 'neutral' | 'warning' | 'info' | 'success' | 'danger' {
  if (s === 'released')  return 'success'
  if (s === 'approved')  return 'info'
  if (s === 'reviewing') return 'warning'
  if (s === 'revised')   return 'danger'
  return 'neutral'
}

interface Props {
  user: SessionUser
  canEdit: boolean
}

export function IsoTab({ user, canEdit }: Props) {
  const [rows, setRows]         = useState<IsoProcedureRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [completeId, setCompleteId] = useState<string | null>(null)
  const [progressId, setProgressId] = useState<string | null>(null)
  const [progressVal, setProgressVal] = useState(0)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [filter, setFilter] = useState({ from: '', to: '', status: 'ALL' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listIsoAction({
      from:   filter.from || undefined,
      to:     filter.to   || undefined,
      status: filter.status !== 'ALL' ? filter.status : undefined,
    })
    if (res.success) setRows(res.data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { void load() }, [load])

  const createForm = useForm<IsoCreateInput>({
    resolver: zodResolver(isoCreateSchema),
    defaultValues: {
      procedure_code:          genIsoCode(),
      planned_completion_date: getTodayLocal(),
    },
  })

  const completeForm = useForm<IsoCompleteInput>({
    resolver: zodResolver(isoCompleteSchema),
    defaultValues: { actual_completion_date: getTodayLocal(), status: 'released' },
  })

  async function onCreateSubmit(values: IsoCreateInput) {
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    setSubmitting(true)
    const res = await createIsoAction(values)
    if (res.success) {
      toast.success(res.message)
      setShowCreate(false)
      createForm.reset({ procedure_code: genIsoCode(), planned_completion_date: getTodayLocal() })
      void load()
    } else toast.error(res.message)
    setSubmitting(false)
  }

  async function onCompleteSubmit(values: IsoCompleteInput) {
    if (!completeId) return
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    setSubmitting(true)
    const res = await completeIsoAction(completeId, values)
    if (res.success) { toast.success(res.message); setCompleteId(null); void load() }
    else toast.error(res.message)
    setSubmitting(false)
  }

  async function saveProgress() {
    if (!progressId) return
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    setSubmitting(true)
    const res = await updateIsoProgressAction(progressId, progressVal)
    if (res.success) { toast.success(res.message); setProgressId(null); void load() }
    else toast.error(res.message)
    setSubmitting(false)
  }

  async function onDelete() {
    if (!deleteId) return
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    setSubmitting(true)
    const res = await deleteIsoAction(deleteId)
    if (res.success) { toast.success(res.message); setDeleteId(null); void load() }
    else toast.error(res.message)
    setSubmitting(false)
  }

  const today = getTodayLocal()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">Quy trình ISO (KH-06)</h1>
          <p className="text-[13px] text-[#6e6e73] mt-0.5">Xây dựng, cập nhật tiến độ và phát hành quy trình</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium bg-dmc-primary text-white rounded-xl hover:opacity-90">
            <Plus size={14} /> Thêm quy trình
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4 flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Trạng thái</label>
          <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
            className={cn(inputCls, 'w-36')}>
            <option value="ALL">Tất cả</option>
            {ISO_STATUSES.map((s) => <option key={s} value={s}>{ISO_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Từ hạn KH</label>
          <input type="date" value={filter.from}
            onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))}
            className={cn(inputCls, 'w-36')} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Đến hạn KH</label>
          <input type="date" value={filter.to}
            onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))}
            className={cn(inputCls, 'w-36')} />
        </div>
        <div className="flex items-end">
          <button onClick={() => void load()}
            className="flex items-center gap-1 px-3 py-2 text-[12px] rounded-xl border border-[#d2d2d7] hover:bg-[#f2f2f7]">
            <RefreshCw size={12} className={cn(loading && 'animate-spin')} /> Làm mới
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 overflow-hidden">
        {loading ? <TableSkeleton rows={4} cols={7} /> : rows.length === 0 ? (
          <EmptyState icon="📄" title="Chưa có quy trình nào" subtitle="Thêm quy trình ISO mới" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#f5f5f7] text-[11px] uppercase text-[#6e6e73]">
                <tr>
                  <th className="p-3 text-left">Mã</th>
                  <th className="p-3 text-left">Tên / Loại</th>
                  <th className="p-3 text-left">Phụ trách</th>
                  <th className="p-3 text-left">Hạn KH</th>
                  <th className="p-3 text-left">Hoàn thành</th>
                  <th className="p-3 text-left w-32">Tiến độ</th>
                  <th className="p-3 text-center">Trạng thái</th>
                  <th className="p-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#d2d2d7]/40 hover:bg-[#fafafa]">
                    <td className="p-3 font-mono text-[12px] font-semibold">{row.procedure_code}</td>
                    <td className="p-3">
                      <p className="text-[12px] font-medium">{row.procedure_name}</p>
                      {row.category && (
                        <Badge variant="neutral" className="mt-0.5">
                          {ISO_CATEGORY_LABELS[row.category as typeof ISO_CATEGORIES[number]] ?? row.category}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-[12px]">{row.responsible_person ?? '—'}</td>
                    <td className={cn('p-3 text-[12px]',
                      !row.actual_completion_date && row.planned_completion_date < today && 'text-red-600 font-semibold')}>
                      {formatDate(row.planned_completion_date)}
                    </td>
                    <td className="p-3 text-[12px]">
                      {row.actual_completion_date
                        ? <span className={row.is_on_time ? 'text-emerald-600' : 'text-red-600'}>{formatDate(row.actual_completion_date)}</span>
                        : '—'}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[#f2f2f7] rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all',
                              Number(row.progress_pct) >= 100 ? 'bg-emerald-500' :
                              Number(row.progress_pct) >= 50  ? 'bg-dmc-primary' : 'bg-amber-500')}
                            style={{ width: `${Math.min(100, Number(row.progress_pct))}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-[#6e6e73] w-8 shrink-0">{Number(row.progress_pct).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={statusVariant(row.status)}>
                        {ISO_STATUS_LABELS[row.status as typeof ISO_STATUSES[number]] ?? row.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {canEdit && row.status !== 'released' && (
                          <>
                            <button
                              onClick={() => { setProgressId(row.id); setProgressVal(Number(row.progress_pct)) }}
                              title="Cập nhật tiến độ"
                              className="text-[#6e6e73] hover:text-dmc-primary text-[11px] font-semibold border border-[#d2d2d7] px-2 py-0.5 rounded-lg hover:border-dmc-primary transition-colors"
                            >
                              %
                            </button>
                            <button onClick={() => { setCompleteId(row.id); completeForm.reset({ actual_completion_date: getTodayLocal(), status: 'released' }) }}
                              title="Hoàn thành" className="text-emerald-600 hover:text-emerald-700">
                              <CheckCircle size={15} />
                            </button>
                          </>
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
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="Thêm quy trình ISO" size="md">
        <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mã quy trình *</label>
              <input {...createForm.register('procedure_code')} className={inputCls} />
              {createForm.formState.errors.procedure_code && (
                <p className="text-[11px] text-red-500 mt-0.5">{createForm.formState.errors.procedure_code.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Loại</label>
              <select {...createForm.register('category')} className={inputCls}>
                <option value="">— Chọn loại —</option>
                {ISO_CATEGORIES.map((c) => <option key={c} value={c}>{ISO_CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Tên quy trình *</label>
            <input {...createForm.register('procedure_name')} className={inputCls} />
            {createForm.formState.errors.procedure_name && (
              <p className="text-[11px] text-red-500 mt-0.5">{createForm.formState.errors.procedure_name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Hạn hoàn thành KH *</label>
              <input type="date" {...createForm.register('planned_completion_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Người phụ trách</label>
              <input {...createForm.register('responsible_person')} className={inputCls} />
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
              {submitting ? 'Đang lưu…' : 'Thêm quy trình'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Progress Dialog */}
      <Dialog open={!!progressId} onClose={() => setProgressId(null)} title="Cập nhật tiến độ" size="sm">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Tiến độ: {progressVal}%</label>
            <input
              type="range" min="0" max="100" value={progressVal}
              onChange={(e) => setProgressVal(Number(e.target.value))}
              className="w-full accent-dmc-primary"
            />
            <div className="flex justify-between text-[11px] text-[#6e6e73] mt-1">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>
          <div className="h-2 bg-[#f2f2f7] rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all',
              progressVal >= 100 ? 'bg-emerald-500' : progressVal >= 50 ? 'bg-dmc-primary' : 'bg-amber-500')}
              style={{ width: `${progressVal}%` }} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setProgressId(null)}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">Hủy</button>
            <button onClick={saveProgress} disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-dmc-primary text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Đang lưu…' : 'Lưu tiến độ'}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={!!completeId} onClose={() => setCompleteId(null)} title="Hoàn thành quy trình" size="md">
        <form onSubmit={completeForm.handleSubmit(onCompleteSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Ngày hoàn thành *</label>
              <input type="date" {...completeForm.register('actual_completion_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Trạng thái *</label>
              <select {...completeForm.register('status')} className={inputCls}>
                <option value="released">Phát hành</option>
                <option value="approved">Đã duyệt</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Link tài liệu</label>
            <input {...completeForm.register('document_url')} className={inputCls} placeholder="https://drive.google.com/..." />
          </div>
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
        <p className="text-[13px] mb-4">Bạn có chắc muốn xóa quy trình này?</p>
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
