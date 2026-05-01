'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react'
import { cn, formatDate, getTodayLocal } from '@/lib/utils'
import {
  surveyCreateSchema, type SurveyCreateInput,
} from '@/lib/validations/maintenance'
import {
  createSurveyAction, updateSurveyAction, deleteSurveyAction, listSurveysAction,
  type SurveyRow,
} from '@/lib/actions/maintenance'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import type { SessionUser } from '@/types'

const inputCls = 'w-full h-9 px-2.5 rounded-lg text-[12px] font-medium text-[#1d1d1f] placeholder:text-[#aeaeb2] bg-white border border-[#d2d2d7] focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 transition-all'
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73] mb-1'

function genSurveyCode() {
  const d = new Date()
  const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, '')
  const nnn = String(Math.floor(Math.random() * 900) + 100)
  return `KS-${yyyymmdd}-${nnn}`
}

function accuracyColor(pct: number | null) {
  if (pct === null) return 'text-[#6e6e73]'
  if (pct >= 95) return 'text-emerald-600 font-semibold'
  if (pct >= 90) return 'text-amber-600 font-semibold'
  return 'text-red-600 font-semibold'
}

interface Props { user: SessionUser }

export function SurveysTab({ user }: Props) {
  const [rows, setRows]       = useState<SurveyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editRow, setEditRow]       = useState<SurveyRow | null>(null)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [filter, setFilter] = useState({ from: '', to: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listSurveysAction({ from: filter.from || undefined, to: filter.to || undefined })
      if (res.success) setRows(res.data ?? [])
      else setRows([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  const form = useForm<SurveyCreateInput>({
    resolver: zodResolver(surveyCreateSchema),
    defaultValues: { survey_code: genSurveyCode(), survey_date: getTodayLocal(), error_items: 0 },
  })

  const { fields: errorFields, append: appendError, remove: removeError } = useFieldArray({
    control: form.control, name: 'error_details' as never,
  })

  function openCreate() {
    form.reset({ survey_code: genSurveyCode(), survey_date: getTodayLocal(), error_items: 0 })
    setShowCreate(true)
  }

  function openEdit(row: SurveyRow) {
    const details = Array.isArray(row.error_details) ? row.error_details as SurveyCreateInput['error_details'] : undefined
    form.reset({
      survey_code:   row.survey_code,
      survey_date:   row.survey_date,
      project_code:  row.project_code ?? '',
      customer:      row.customer ?? '',
      surveyor:      row.surveyor ?? '',
      total_items:   row.total_items,
      error_items:   row.error_items,
      error_details: details,
      notes:         row.notes ?? '',
    })
    setEditRow(row)
  }

  async function onSubmit(values: SurveyCreateInput) {
    setSubmitting(true)
    const res = editRow
      ? await updateSurveyAction(editRow.id, values)
      : await createSurveyAction(values)
    if (res.success) {
      toast.success(res.message)
      setShowCreate(false)
      setEditRow(null)
      form.reset()
      void load()
    } else toast.error(res.message)
    setSubmitting(false)
  }

  async function onDelete() {
    if (!deleteId) return
    setSubmitting(true)
    const res = await deleteSurveyAction(deleteId)
    if (res.success) { toast.success(res.message); setDeleteId(null); void load() }
    else toast.error(res.message)
    setSubmitting(false)
  }

  const isOpen = showCreate || !!editRow

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">Khảo sát công trình (KT-07)</h1>
          <p className="text-[13px] text-[#6e6e73] mt-0.5">Ghi nhận kết quả đo kiểm và độ chính xác thi công</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium bg-dmc-primary text-white rounded-xl hover:opacity-90">
          <Plus size={14} /> Nhập kết quả
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4 flex flex-wrap gap-3">
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

      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 overflow-hidden">
        {loading ? <TableSkeleton rows={4} cols={7} /> : rows.length === 0 ? (
          <EmptyState icon="📏" title="Chưa có khảo sát nào" subtitle="Nhấn 'Nhập kết quả' để thêm mới" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#f5f5f7] text-[11px] uppercase text-[#6e6e73]">
                <tr>
                  <th className="p-3 text-left">Mã KS</th>
                  <th className="p-3 text-left">Ngày</th>
                  <th className="p-3 text-left">Công trình / Khách hàng</th>
                  <th className="p-3 text-left">Người KS</th>
                  <th className="p-3 text-right">Mục đo</th>
                  <th className="p-3 text-right">Mục lỗi</th>
                  <th className="p-3 text-right">Độ CX</th>
                  <th className="p-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#d2d2d7]/40 hover:bg-[#fafafa]">
                    <td className="p-3 font-mono text-[12px] font-semibold">{row.survey_code}</td>
                    <td className="p-3 text-[12px]">{formatDate(row.survey_date)}</td>
                    <td className="p-3 text-[12px]">
                      {row.project_code && <span className="font-medium">{row.project_code}</span>}
                      {row.customer && <span className="text-[#6e6e73] ml-1">{row.customer}</span>}
                      {!row.project_code && !row.customer && '—'}
                    </td>
                    <td className="p-3 text-[12px]">{row.surveyor ?? '—'}</td>
                    <td className="p-3 text-right">{row.total_items}</td>
                    <td className="p-3 text-right text-red-600">{row.error_items}</td>
                    <td className={cn('p-3 text-right', accuracyColor(row.accuracy_pct))}>
                      {row.accuracy_pct != null ? `${Number(row.accuracy_pct).toFixed(1)}%` : '—'}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(row)} title="Sửa" className="text-[#6e6e73] hover:text-dmc-primary">
                          <Pencil size={14} />
                        </button>
                        {user.role === 'ADMIN' && (
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

      {/* Create/Edit Dialog */}
      <Dialog open={isOpen} onClose={() => { setShowCreate(false); setEditRow(null) }}
        title={editRow ? 'Sửa khảo sát' : 'Nhập kết quả khảo sát'} size="lg">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mã KS *</label>
              <input {...form.register('survey_code')} className={inputCls} />
              {form.formState.errors.survey_code && (
                <p className="text-[11px] text-red-500 mt-0.5">{form.formState.errors.survey_code.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Ngày khảo sát *</label>
              <input type="date" {...form.register('survey_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Mã công trình</label>
              <input {...form.register('project_code')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Khách hàng</label>
              <input {...form.register('customer')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Người khảo sát</label>
              <input {...form.register('surveyor')} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tổng số mục đo *</label>
              <input type="number" min="1" {...form.register('total_items', { valueAsNumber: true })} className={inputCls} />
              {form.formState.errors.total_items && (
                <p className="text-[11px] text-red-500 mt-0.5">{form.formState.errors.total_items.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Số mục lỗi *</label>
              <input type="number" min="0" {...form.register('error_items', { valueAsNumber: true })} className={inputCls} />
              {form.formState.errors.error_items && (
                <p className="text-[11px] text-red-500 mt-0.5">{form.formState.errors.error_items.message}</p>
              )}
            </div>
          </div>
          {/* Error detail list */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls}>Chi tiết mục lỗi</label>
              <button type="button" onClick={() => appendError({ item: '', expected: '', actual: '', note: '' } as never)}
                className="text-[11px] text-dmc-primary hover:underline flex items-center gap-1">
                <Plus size={11} /> Thêm
              </button>
            </div>
            {errorFields.map((field, idx) => (
              <div key={field.id} className="grid grid-cols-4 gap-2 mb-1.5">
                <input {...form.register(`error_details.${idx}.item` as never)} placeholder="Mục đo" className={inputCls} />
                <input {...form.register(`error_details.${idx}.expected` as never)} placeholder="Yêu cầu" className={inputCls} />
                <input {...form.register(`error_details.${idx}.actual` as never)} placeholder="Thực tế" className={inputCls} />
                <div className="flex gap-1">
                  <input {...form.register(`error_details.${idx}.note` as never)} placeholder="Ghi chú" className={inputCls} />
                  <button type="button" onClick={() => removeError(idx)} className="text-red-400 hover:text-red-600 shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className={labelCls}>Ghi chú</label>
            <textarea {...form.register('notes')} rows={2} className={cn(inputCls, 'h-auto resize-none')} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => { setShowCreate(false); setEditRow(null) }}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">Hủy</button>
            <button type="submit" disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-dmc-primary text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Đang lưu…' : editRow ? 'Cập nhật' : 'Lưu kết quả'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Xác nhận xóa" size="sm">
        <p className="text-[13px] mb-4">Bạn có chắc muốn xóa khảo sát này?</p>
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
