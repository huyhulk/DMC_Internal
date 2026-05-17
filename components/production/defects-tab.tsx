'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus, Trash2, Save, RefreshCw } from 'lucide-react'
import { cn, getTodayLocal, formatDate } from '@/lib/utils'
import {
  defectsBulkSchema,
  DEFECT_TYPES,
  DEFECT_TYPE_LABELS,
  SHIFT_KEYS,
  SHIFT_LABELS,
  type DefectsBulkInput,
} from '@/modules/defects/validation'
import { submitDefectsAction, getDefectsListAction } from '@/modules/defects/actions'
import type { SessionUser } from '@/types'
import type { Database } from '@/types/database'

type DefectRow = Database['public']['Tables']['production_defects']['Row']

interface Props {
  user: SessionUser
  allowedWorkshops: string[]
  canEdit: boolean
}

const inputCls =
  'w-full h-9 px-2 rounded-lg text-[12px] font-medium ' +
  'text-dmc-text-primary placeholder:text-dmc-text-muted ' +
  'bg-white border border-dmc-border ' +
  'focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150'

const EMPTY_ROW: DefectsBulkInput['rows'][number] = {
  pcode:        '',
  product_name: '',
  total_qty:    0,
  defect_qty:   0,
  defect_type:  undefined,
  defect_cause: '',
  unit:         'm',
  notes:        '',
}

export function DefectsTab({ allowedWorkshops, canEdit }: Props) {
  const [submitting, setSubmitting]       = useState(false)
  const [history, setHistory]             = useState<DefectRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const firstWorkshop = (allowedWorkshops[0] ?? 'DMC1') as DefectsBulkInput['shared']['workshop']

  const form = useForm<DefectsBulkInput>({
    resolver: zodResolver(defectsBulkSchema),
    defaultValues: {
      shared: {
        report_date: getTodayLocal(),
        workshop:    firstWorkshop,
        shift:       undefined,
      },
      rows: [{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }],
    },
  })

  const { register, handleSubmit, reset, formState, watch } = form
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'rows' })

  const watchedRows = watch('rows')

  async function loadHistory() {
    setLoadingHistory(true)
    const res = await getDefectsListAction({ limit: 20 })
    if (res.success && res.data) setHistory(res.data)
    setLoadingHistory(false)
  }

  useEffect(() => { void loadHistory() }, [])

  async function onSubmit(values: DefectsBulkInput) {
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }

    setSubmitting(true)
    const res = await submitDefectsAction(values)
    if (res.success) {
      toast.success(res.message)
      reset({
        shared: values.shared,
        rows: [{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }],
      })
      void loadHistory()
    } else {
      toast.error(res.message)
    }
    setSubmitting(false)
  }

  const totalDefectRate = useMemo(() => {
    const totalQty  = watchedRows.reduce((s, r) => s + (Number(r.total_qty)  || 0), 0)
    const defectQty = watchedRows.reduce((s, r) => s + (Number(r.defect_qty) || 0), 0)
    return totalQty === 0 ? 0 : (defectQty / totalQty) * 100
  }, [watchedRows])

  return (
    <div className="space-y-6">
      {!canEdit && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
          Bạn chỉ có quyền xem tab này.
        </div>
      )}
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-dmc-text-primary">Lỗi thành phẩm (SX-01)</h1>
          <p className="text-sm text-dmc-text-muted mt-1">Nhập số lượng lỗi theo ngày / xưởng / ca</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-dmc-text-muted">Tỷ lệ lỗi (đang nhập)</div>
          <div className={cn(
            'text-xl font-bold',
            totalDefectRate > 5 ? 'text-red-600' : 'text-emerald-600'
          )}>
            {totalDefectRate.toFixed(2)}%
          </div>
        </div>
      </header>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-2xl shadow-sm border border-dmc-border p-6 space-y-4"
      >
        {/* Shared fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73] mb-1">
              Ngày báo cáo
            </label>
            <input
              type="date"
              {...register('shared.report_date')}
              className={cn(inputCls, 'h-10')}
              max={getTodayLocal()}
            />
            {formState.errors.shared?.report_date && (
              <p className="text-xs text-red-600 mt-1">{formState.errors.shared.report_date.message}</p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73] mb-1">
              Phân xưởng
            </label>
            <select {...register('shared.workshop')} className={cn(inputCls, 'h-10')}>
              {allowedWorkshops.map((ws) => (
                <option key={ws} value={ws}>{ws}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73] mb-1">
              Ca sản xuất
            </label>
            <select {...register('shared.shift')} className={cn(inputCls, 'h-10')}>
              <option value="">— Chọn ca —</option>
              {SHIFT_KEYS.map((k) => (
                <option key={k} value={k}>{SHIFT_LABELS[k]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Rows table */}
        <div className="overflow-x-auto rounded-xl border border-dmc-border">
          <table className="w-full text-sm">
            <thead className="bg-[#f5f5f7] text-[11px] uppercase text-[#6e6e73]">
              <tr>
                <th className="p-2 text-center w-8">#</th>
                <th className="p-2 text-left min-w-[130px]">PCODE</th>
                <th className="p-2 text-left min-w-[140px]">Sản phẩm</th>
                <th className="p-2 text-right w-24">Tổng SL</th>
                <th className="p-2 text-right w-24">SL lỗi</th>
                <th className="p-2 text-left w-36">Loại lỗi</th>
                <th className="p-2 text-left min-w-[140px]">Nguyên nhân</th>
                <th className="p-2 text-left w-20">Đơn vị</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, idx) => (
                <tr key={field.id} className="border-t border-dmc-border hover:bg-[#fafafa]">
                  <td className="p-2 text-center text-[11px] text-[#6e6e73]">{idx + 1}</td>
                  <td className="p-2">
                    <input
                      {...register(`rows.${idx}.pcode`)}
                      className={inputCls}
                      placeholder="LSX01/26-…"
                    />
                  </td>
                  <td className="p-2">
                    <input {...register(`rows.${idx}.product_name`)} className={inputCls} />
                  </td>
                  <td className="p-2">
                    <input
                      type="number" step="0.01" min="0"
                      {...register(`rows.${idx}.total_qty`, { valueAsNumber: true })}
                      className={cn(inputCls, 'text-right')}
                    />
                    {formState.errors.rows?.[idx]?.total_qty && (
                      <p className="text-[10px] text-red-500 mt-0.5">
                        {formState.errors.rows[idx]?.total_qty?.message}
                      </p>
                    )}
                  </td>
                  <td className="p-2">
                    <input
                      type="number" step="0.01" min="0"
                      {...register(`rows.${idx}.defect_qty`, { valueAsNumber: true })}
                      className={cn(inputCls, 'text-right')}
                    />
                    {formState.errors.rows?.[idx]?.defect_qty && (
                      <p className="text-[10px] text-red-500 mt-0.5">
                        {formState.errors.rows[idx]?.defect_qty?.message}
                      </p>
                    )}
                  </td>
                  <td className="p-2">
                    <select {...register(`rows.${idx}.defect_type`)} className={inputCls}>
                      <option value="">— Chọn —</option>
                      {DEFECT_TYPES.map((t) => (
                        <option key={t} value={t}>{DEFECT_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input {...register(`rows.${idx}.defect_cause`)} className={inputCls} />
                  </td>
                  <td className="p-2">
                    <input {...register(`rows.${idx}.unit`)} className={inputCls} placeholder="m" />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      disabled={!canEdit || fields.length === 1}
                      className="text-red-400 hover:text-red-600 disabled:opacity-25 transition-colors"
                      title="Xóa dòng"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Form actions */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => append({ ...EMPTY_ROW })}
            disabled={!canEdit}
            className="text-sm text-dmc-primary hover:underline flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
          >
            <Plus size={14} /> Thêm dòng
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => reset()}
              disabled={!canEdit}
              className="px-4 py-2 text-sm rounded-xl border border-dmc-border hover:bg-[#f5f5f7] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!canEdit || submitting}
              className="px-4 py-2 text-sm rounded-xl bg-dmc-primary text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 transition-opacity"
            >
              {submitting
                ? <RefreshCw size={14} className="animate-spin" />
                : <Save size={14} />}
              Lưu {fields.length} dòng
            </button>
          </div>
        </div>
      </form>

      {/* History */}
      <section className="bg-white rounded-2xl shadow-sm border border-dmc-border p-6">
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-dmc-text-primary">Lịch sử nhập gần đây</h2>
          <button
            onClick={() => void loadHistory()}
            className="text-sm text-dmc-primary hover:underline flex items-center gap-1"
          >
            <RefreshCw size={12} className={cn(loadingHistory && 'animate-spin')} /> Làm mới
          </button>
        </header>

        {loadingHistory ? (
          <div className="flex justify-center py-8">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-dmc-primary/30 border-t-dmc-primary" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-dmc-text-muted text-center py-8">Chưa có dữ liệu</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f5f5f7] text-[11px] uppercase text-[#6e6e73]">
                <tr>
                  <th className="p-2 text-left">Ngày</th>
                  <th className="p-2 text-left">Xưởng</th>
                  <th className="p-2 text-left">Ca</th>
                  <th className="p-2 text-left">PCODE</th>
                  <th className="p-2 text-right">Tổng SL</th>
                  <th className="p-2 text-right">SL lỗi</th>
                  <th className="p-2 text-right">Tỷ lệ</th>
                  <th className="p-2 text-left">Loại lỗi</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => {
                  const rate = row.total_qty > 0 ? (row.defect_qty / row.total_qty) * 100 : 0
                  return (
                    <tr key={row.id} className="border-t border-dmc-border hover:bg-[#fafafa]">
                      <td className="p-2">{formatDate(row.report_date)}</td>
                      <td className="p-2 font-medium">{row.workshop}</td>
                      <td className="p-2 text-[12px]">
                        {row.shift
                          ? (SHIFT_LABELS[row.shift as keyof typeof SHIFT_LABELS] ?? row.shift)
                          : '—'}
                      </td>
                      <td className="p-2 font-mono text-[12px]">{row.pcode ?? '—'}</td>
                      <td className="p-2 text-right">{row.total_qty}</td>
                      <td className="p-2 text-right text-red-600">{row.defect_qty}</td>
                      <td className={cn(
                        'p-2 text-right font-semibold',
                        rate > 5 ? 'text-red-600' : 'text-emerald-600'
                      )}>
                        {rate.toFixed(2)}%
                      </td>
                      <td className="p-2 text-[12px]">
                        {row.defect_type
                          ? (DEFECT_TYPE_LABELS[row.defect_type as keyof typeof DEFECT_TYPE_LABELS] ?? row.defect_type)
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
