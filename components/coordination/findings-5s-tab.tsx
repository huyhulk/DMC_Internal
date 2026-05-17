'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus, RefreshCw, CheckCircle, Trash2 } from 'lucide-react'
import { cn, formatDate, getLocalDateAfterDays, getTodayLocal } from '@/lib/utils'
import {
  finding5sCreateSchema, finding5sResolveSchema,
  FIVE_S_CATEGORIES, SEVERITIES, SEVERITY_LABELS,
  KPI_WORKSHOPS, FIVE_S_DEPARTMENTS,
  type Finding5sCreateInput, type Finding5sResolveInput,
} from '@/modules/coordination/validation'
import {
  createFinding5sAction, resolveFinding5sAction, deleteFinding5sAction, listFindings5sAction,
  type Finding5sRow,
} from '@/modules/coordination/actions'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import type { SessionUser } from '@/types'

const inputCls = 'w-full h-9 px-2.5 rounded-lg text-[12px] font-medium text-[#1d1d1f] placeholder:text-[#aeaeb2] bg-white border border-[#d2d2d7] focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 transition-all'
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73] mb-1'

const WORKSHOP_OPTIONS = ['DMC1', 'DMC3', 'DMC4', 'DMC5', 'Văn phòng']

function severityVariant(s: string): 'danger' | 'warning' | 'info' {
  if (s === 'high')   return 'danger'
  if (s === 'medium') return 'warning'
  return 'info'
}

function dueDateColor(dueDate: string, resolvedDate: string | null) {
  if (resolvedDate) return ''
  const today = getTodayLocal()
  if (dueDate < today) return 'text-red-600 font-semibold'
  const diff = (new Date(dueDate).getTime() - new Date(today).getTime()) / 86400000
  if (diff <= 3) return 'text-amber-600 font-semibold'
  return ''
}

interface Props {
  user: SessionUser
  dept: typeof FIVE_S_DEPARTMENTS[number]
  canEdit: boolean
}

export function Findings5sTab({ user, dept, canEdit }: Props) {
  const [rows, setRows]         = useState<Finding5sRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [resolveId, setResolveId]   = useState<string | null>(null)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [filter, setFilter] = useState({ workshop: 'ALL', from: '', to: '', status: 'ALL' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listFindings5sAction({
      dept,
      workshop: filter.workshop !== 'ALL' ? filter.workshop : undefined,
      from:     filter.from || undefined,
      to:       filter.to   || undefined,
      status:   filter.status !== 'ALL' ? filter.status : undefined,
    })
    if (res.success) setRows(res.data ?? [])
    setLoading(false)
  }, [filter, dept])

  useEffect(() => { void load() }, [load])

  const createForm = useForm<Finding5sCreateInput>({
    resolver: zodResolver(finding5sCreateSchema),
    defaultValues: {
      finding_date: getTodayLocal(),
      department:   dept,
      severity:     'medium',
      due_date:     getLocalDateAfterDays(7),
      workshop:     'DMC1',
    },
  })

  const resolveForm = useForm<Finding5sResolveInput>({
    resolver: zodResolver(finding5sResolveSchema),
    defaultValues: { resolved_date: getTodayLocal() },
  })

  async function onCreateSubmit(values: Finding5sCreateInput) {
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    setSubmitting(true)
    const res = await createFinding5sAction(values)
    if (res.success) { toast.success(res.message); setShowCreate(false); createForm.reset({ finding_date: getTodayLocal(), department: dept, severity: 'medium', due_date: getLocalDateAfterDays(7), workshop: 'DMC1' }); void load() }
    else toast.error(res.message)
    setSubmitting(false)
  }

  async function onResolveSubmit(values: Finding5sResolveInput) {
    if (!resolveId) return
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    setSubmitting(true)
    const res = await resolveFinding5sAction(resolveId, values)
    if (res.success) { toast.success(res.message); setResolveId(null); void load() }
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
    const res = await deleteFinding5sAction(deleteId)
    if (res.success) { toast.success(res.message); setDeleteId(null); void load() }
    else toast.error(res.message)
    setSubmitting(false)
  }

  const deptLabel = dept === 'PRODUCTION' ? 'Sản xuất' : dept === 'COORDINATION' ? 'Bộ phận KH' : 'Bảo trì'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">5S {deptLabel} (KH-04)</h1>
          <p className="text-[13px] text-[#6e6e73] mt-0.5">Theo dõi phát hiện và xử lý vấn đề 5S</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium bg-dmc-primary text-white rounded-xl hover:opacity-90">
            <Plus size={14} /> Phát hiện mới
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4 flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Xưởng</label>
          <select value={filter.workshop} onChange={(e) => setFilter((f) => ({ ...f, workshop: e.target.value }))} className={cn(inputCls, 'w-32')}>
            <option value="ALL">Tất cả</option>
            {WORKSHOP_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Trạng thái</label>
          <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))} className={cn(inputCls, 'w-36')}>
            <option value="ALL">Tất cả</option>
            <option value="pending">Chưa xử lý</option>
            <option value="resolved">Đã xử lý</option>
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
        <div className="flex items-end">
          <button onClick={() => void load()} className="flex items-center gap-1 px-3 py-2 text-[12px] rounded-xl border border-[#d2d2d7] hover:bg-[#f2f2f7]">
            <RefreshCw size={12} className={cn(loading && 'animate-spin')} /> Làm mới
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 overflow-hidden">
        {loading ? <TableSkeleton rows={5} cols={7} /> : rows.length === 0 ? (
          <EmptyState icon="✅" title="Chưa có phát hiện 5S" subtitle="Thêm phát hiện mới" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#f5f5f7] text-[11px] uppercase text-[#6e6e73]">
                <tr>
                  <th className="p-3 text-left">Ngày</th>
                  <th className="p-3 text-left">Khu vực</th>
                  <th className="p-3 text-left">Loại 5S</th>
                  <th className="p-3 text-left">Mô tả</th>
                  <th className="p-3 text-left">Hạn xử lý</th>
                  <th className="p-3 text-center">Đúng hạn</th>
                  <th className="p-3 text-center">Mức độ</th>
                  <th className="p-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#d2d2d7]/40 hover:bg-[#fafafa]">
                    <td className="p-3 text-[12px]">{formatDate(row.finding_date)}</td>
                    <td className="p-3 text-[12px]">
                      <Badge variant="neutral">{row.workshop}</Badge>
                      {row.area && <span className="ml-1 text-[#6e6e73]">{row.area}</span>}
                    </td>
                    <td className="p-3"><Badge variant="info">{row.category}</Badge></td>
                    <td className="p-3 text-[12px] max-w-[200px]">
                      <p className="line-clamp-2">{row.description}</p>
                    </td>
                    <td className={cn('p-3 text-[12px]', dueDateColor(row.due_date, row.resolved_date))}>
                      {formatDate(row.due_date)}
                      {row.resolved_date && <p className="text-emerald-600 font-normal">→ {formatDate(row.resolved_date)}</p>}
                    </td>
                    <td className="p-3 text-center">
                      {row.resolved_date
                        ? <Badge variant={row.is_on_time ? 'success' : 'danger'}>{row.is_on_time ? '✓' : '✗'}</Badge>
                        : <span className="text-[#aeaeb2]">—</span>}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={severityVariant(row.severity)}>
                        {SEVERITY_LABELS[row.severity as typeof SEVERITIES[number]] ?? row.severity}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {canEdit && !row.resolved_date && (
                          <button onClick={() => { setResolveId(row.id); resolveForm.reset({ resolved_date: getTodayLocal() }) }}
                            title="Xử lý" className="text-emerald-600 hover:text-emerald-700">
                            <CheckCircle size={15} />
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
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="Phát hiện 5S mới" size="lg">
        <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Ngày phát hiện *</label>
              <input type="date" {...createForm.register('finding_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Xưởng / Khu vực *</label>
              <select {...createForm.register('workshop')} className={inputCls}>
                {WORKSHOP_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Loại 5S *</label>
              <select {...createForm.register('category')} className={inputCls}>
                <option value="">— Chọn loại —</option>
                {FIVE_S_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {createForm.formState.errors.category && (
                <p className="text-[11px] text-red-500 mt-0.5">{createForm.formState.errors.category.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Mức độ *</label>
              <select {...createForm.register('severity')} className={inputCls}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Hạn xử lý *</label>
              <input type="date" {...createForm.register('due_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Người phụ trách</label>
              <input {...createForm.register('responsible_person')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Khu vực cụ thể</label>
              <input {...createForm.register('area')} className={inputCls} placeholder="Khu thành phẩm, Kho NVL..." />
            </div>
            <div>
              <label className={labelCls}>Link ảnh</label>
              <input {...createForm.register('photo_url')} className={inputCls} placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className={labelCls}>Mô tả vấn đề *</label>
            <textarea {...createForm.register('description')} rows={3} className={cn(inputCls, 'h-auto resize-none')} />
            {createForm.formState.errors.description && (
              <p className="text-[11px] text-red-500 mt-0.5">{createForm.formState.errors.description.message}</p>
            )}
          </div>
          <input type="hidden" {...createForm.register('department')} />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">Hủy</button>
            <button type="submit" disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-dmc-primary text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Đang lưu…' : 'Lưu phát hiện'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={!!resolveId} onClose={() => setResolveId(null)} title="Đánh dấu đã xử lý" size="sm">
        <form onSubmit={resolveForm.handleSubmit(onResolveSubmit)} className="space-y-3">
          <div>
            <label className={labelCls}>Ngày xử lý *</label>
            <input type="date" {...resolveForm.register('resolved_date')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Ghi chú kết quả</label>
            <textarea {...resolveForm.register('resolution_notes')} rows={3} className={cn(inputCls, 'h-auto resize-none')} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setResolveId(null)}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">Hủy</button>
            <button type="submit" disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Đang lưu…' : 'Xác nhận xử lý'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Xác nhận xóa" size="sm">
        <p className="text-[13px] mb-4">Bạn có chắc muốn xóa phát hiện 5S này?</p>
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
