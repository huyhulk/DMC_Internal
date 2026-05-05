'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus, RefreshCw, Send, Trash2, Repeat, FileText } from 'lucide-react'
import { cn, formatDate, getTodayLocal } from '@/lib/utils'
import {
  statReportCreateSchema, statReportBulkSchema, statReportSubmitSchema,
  REPORT_TYPES, REPORT_TYPE_LABELS,
  type StatReportCreateInput, type StatReportBulkInput, type StatReportSubmitInput,
} from '@/lib/validations/coordination'
import {
  createStatReportAction, bulkCreateStatReportAction, submitStatReportAction,
  updateStatReportAction, deleteStatReportAction, listStatReportsAction,
  type StatReportRow,
} from '@/lib/actions/coordination'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import type { SessionUser } from '@/types'

const inputCls = 'w-full h-9 px-2.5 rounded-lg text-[12px] font-medium text-[#1d1d1f] placeholder:text-[#aeaeb2] bg-white border border-[#d2d2d7] focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 transition-all'
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73] mb-1'

function statusVariant(s: string): 'warning' | 'success' | 'danger' {
  if (s === 'submitted') return 'success'
  if (s === 'overdue')   return 'danger'
  return 'warning'
}

function statusLabel(s: string) {
  if (s === 'submitted') return 'Đã nộp'
  if (s === 'overdue')   return 'Quá hạn'
  return 'Chờ nộp'
}

interface Props {
  user: SessionUser
  canEdit: boolean
}

export function ReportsTab({ user, canEdit }: Props) {
  const [rows, setRows]         = useState<StatReportRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showBulk, setShowBulk]     = useState(false)
  const [submitId, setSubmitId]     = useState<string | null>(null)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [filter, setFilter] = useState({ from: '', to: '', status: 'ALL' })
  const [dailyReport, setDailyReport] = useState({ date: getTodayLocal(), type: 'both' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listStatReportsAction({
      from:   filter.from || undefined,
      to:     filter.to   || undefined,
      status: filter.status !== 'ALL' ? filter.status : undefined,
    })
    if (res.success) setRows(res.data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { void load() }, [load])

  const createForm = useForm<StatReportCreateInput>({
    resolver: zodResolver(statReportCreateSchema),
    defaultValues: { due_date: getTodayLocal() },
  })

  const bulkForm = useForm<StatReportBulkInput>({
    resolver: zodResolver(statReportBulkSchema),
    defaultValues: { frequency: 'monthly', start_date: getTodayLocal(), end_date: getTodayLocal() },
  })

  const submitForm = useForm<StatReportSubmitInput>({
    resolver: zodResolver(statReportSubmitSchema),
    defaultValues: { submitted_date: getTodayLocal() },
  })

  async function onCreateSubmit(values: StatReportCreateInput) {
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    setSubmitting(true)
    const res = await createStatReportAction(values)
    if (res.success) { toast.success(res.message); setShowCreate(false); createForm.reset({ due_date: getTodayLocal() }); void load() }
    else toast.error(res.message)
    setSubmitting(false)
  }

  async function onBulkSubmit(values: StatReportBulkInput) {
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    setSubmitting(true)
    const res = await bulkCreateStatReportAction(values)
    if (res.success) { toast.success(res.message); setShowBulk(false); bulkForm.reset(); void load() }
    else toast.error(res.message)
    setSubmitting(false)
  }

  async function onSubmitReport(values: StatReportSubmitInput) {
    if (!submitId) return
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    setSubmitting(true)
    const res = await submitStatReportAction(submitId, values)
    if (res.success) { toast.success(res.message); setSubmitId(null); void load() }
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
    const res = await deleteStatReportAction(deleteId)
    if (res.success) { toast.success(res.message); setDeleteId(null); void load() }
    else toast.error(res.message)
    setSubmitting(false)
  }

  const today = getTodayLocal()
  const dailyReportHref = `/dashboard/coordination/daily-report?date=${encodeURIComponent(dailyReport.date)}&type=${encodeURIComponent(dailyReport.type)}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">Báo cáo thống kê (KH-05)</h1>
          <p className="text-[13px] text-[#6e6e73] mt-0.5">Lịch nộp báo cáo định kỳ và theo dõi tiến độ</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setShowBulk(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border border-dmc-primary text-dmc-primary rounded-xl hover:bg-dmc-primary/5">
              <Repeat size={14} /> Tạo định kỳ
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium bg-dmc-primary text-white rounded-xl hover:opacity-90">
              <Plus size={14} /> Thêm báo cáo
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-emerald-200 p-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-700">
            <FileText size={17} />
            <h2 className="text-[15px] font-semibold">Xuất báo cáo ngày</h2>
          </div>
          <p className="text-[12px] text-[#6e6e73] mt-1">KHSX ngày kế tiếp và KQSX theo dữ liệu Production của ngày báo cáo</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Ngày báo cáo</label>
            <input
              type="date"
              value={dailyReport.date}
              onChange={(e) => setDailyReport((r) => ({ ...r, date: e.target.value }))}
              className={cn(inputCls, 'w-40')}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Loại báo cáo</label>
            <select
              value={dailyReport.type}
              onChange={(e) => setDailyReport((r) => ({ ...r, type: e.target.value }))}
              className={cn(inputCls, 'w-44')}
            >
              <option value="both">KHSX + KQSX</option>
              <option value="plan">Chỉ KHSX</option>
              <option value="result">Chỉ KQSX</option>
            </select>
          </div>
          <div className="flex items-end">
            <a
              href={dailyReportHref}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-[12px] font-semibold text-white hover:opacity-90"
            >
              <FileText size={14} /> Xem / Xuất PDF
            </a>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4 flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Trạng thái</label>
          <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))} className={cn(inputCls, 'w-36')}>
            <option value="ALL">Tất cả</option>
            <option value="pending">Chờ nộp</option>
            <option value="submitted">Đã nộp</option>
            <option value="overdue">Quá hạn</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Từ hạn</label>
          <input type="date" value={filter.from} onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))} className={cn(inputCls, 'w-36')} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Đến hạn</label>
          <input type="date" value={filter.to} onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))} className={cn(inputCls, 'w-36')} />
        </div>
        <div className="flex items-end">
          <button onClick={() => void load()} className="flex items-center gap-1 px-3 py-2 text-[12px] rounded-xl border border-[#d2d2d7] hover:bg-[#f2f2f7]">
            <RefreshCw size={12} className={cn(loading && 'animate-spin')} /> Làm mới
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 overflow-hidden">
        {loading ? <TableSkeleton rows={5} cols={6} /> : rows.length === 0 ? (
          <EmptyState icon="📋" title="Chưa có báo cáo nào" subtitle="Thêm báo cáo hoặc tạo lịch định kỳ" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#f5f5f7] text-[11px] uppercase text-[#6e6e73]">
                <tr>
                  <th className="p-3 text-left">Tên báo cáo</th>
                  <th className="p-3 text-left">Người phụ trách</th>
                  <th className="p-3 text-left">Hạn nộp</th>
                  <th className="p-3 text-left">Đã nộp</th>
                  <th className="p-3 text-center">Đúng hạn</th>
                  <th className="p-3 text-center">Trạng thái</th>
                  <th className="p-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#d2d2d7]/40 hover:bg-[#fafafa]">
                    <td className="p-3">
                      <p className="font-medium text-[12px]">{row.report_name}</p>
                      {row.report_type && (
                        <Badge variant="neutral" className="mt-0.5">
                          {REPORT_TYPE_LABELS[row.report_type as typeof REPORT_TYPES[number]] ?? row.report_type}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-[12px]">{row.responsible_person ?? '—'}</td>
                    <td className={cn('p-3 text-[12px]',
                      !row.submitted_date && row.due_date < today && 'text-red-600 font-semibold')}>
                      {formatDate(row.due_date)}
                    </td>
                    <td className="p-3 text-[12px]">{row.submitted_date ? formatDate(row.submitted_date) : '—'}</td>
                    <td className="p-3 text-center">
                      {row.submitted_date
                        ? <Badge variant={row.is_on_time ? 'success' : 'danger'}>{row.is_on_time ? '✓' : '✗'}</Badge>
                        : <span className="text-[#aeaeb2]">—</span>}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {canEdit && row.status !== 'submitted' && (
                          <button onClick={() => { setSubmitId(row.id); submitForm.reset({ submitted_date: getTodayLocal() }) }}
                            title="Nộp báo cáo" className="text-blue-600 hover:text-blue-700">
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
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="Thêm báo cáo" size="md">
        <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-3">
          <div>
            <label className={labelCls}>Tên báo cáo *</label>
            <input {...createForm.register('report_name')} className={inputCls} placeholder="Báo cáo doanh thu T4/2026" />
            {createForm.formState.errors.report_name && (
              <p className="text-[11px] text-red-500 mt-0.5">{createForm.formState.errors.report_name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Loại báo cáo</label>
              <select {...createForm.register('report_type')} className={inputCls}>
                <option value="">— Chọn loại —</option>
                {REPORT_TYPES.map((t) => <option key={t} value={t}>{REPORT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Hạn nộp *</label>
              <input type="date" {...createForm.register('due_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Người nhận</label>
              <input {...createForm.register('recipient')} className={inputCls} placeholder="BGĐ, Sở Công Thương..." />
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
              {submitting ? 'Đang lưu…' : 'Thêm báo cáo'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Bulk Dialog */}
      <Dialog open={showBulk} onClose={() => setShowBulk(false)} title="Tạo lịch báo cáo định kỳ" size="md">
        <form onSubmit={bulkForm.handleSubmit(onBulkSubmit)} className="space-y-3">
          <div>
            <label className={labelCls}>Tên báo cáo *</label>
            <input {...bulkForm.register('report_name')} className={inputCls} placeholder="Báo cáo sản lượng" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Loại</label>
              <select {...bulkForm.register('report_type')} className={inputCls}>
                <option value="">— Chọn —</option>
                {REPORT_TYPES.map((t) => <option key={t} value={t}>{REPORT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Chu kỳ *</label>
              <select {...bulkForm.register('frequency')} className={inputCls}>
                <option value="weekly">Tuần</option>
                <option value="monthly">Tháng</option>
                <option value="quarterly">Quý</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Từ ngày *</label>
              <input type="date" {...bulkForm.register('start_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Đến ngày *</label>
              <input type="date" {...bulkForm.register('end_date')} className={inputCls} />
              {bulkForm.formState.errors.end_date && (
                <p className="text-[11px] text-red-500 mt-0.5">{bulkForm.formState.errors.end_date.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Người nhận</label>
              <input {...bulkForm.register('recipient')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Người phụ trách</label>
              <input {...bulkForm.register('responsible_person')} className={inputCls} />
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

      {/* Submit Dialog */}
      <Dialog open={!!submitId} onClose={() => setSubmitId(null)} title="Nộp báo cáo" size="sm">
        <form onSubmit={submitForm.handleSubmit(onSubmitReport)} className="space-y-3">
          <div>
            <label className={labelCls}>Ngày nộp *</label>
            <input type="date" {...submitForm.register('submitted_date')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Ghi chú (link Drive, file...)</label>
            <textarea {...submitForm.register('notes')} rows={3} className={cn(inputCls, 'h-auto resize-none')} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setSubmitId(null)}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">Hủy</button>
            <button type="submit" disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Đang lưu…' : 'Xác nhận nộp'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Xác nhận xóa" size="sm">
        <p className="text-[13px] mb-4">Bạn có chắc muốn xóa báo cáo này?</p>
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
