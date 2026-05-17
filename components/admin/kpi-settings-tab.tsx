'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Save, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateKpiTargetsAction, type KpiTargetRow } from '@/modules/admin/kpi-settings'

interface Props {
  initialRows: KpiTargetRow[]
  canEdit: boolean
}

type FormValues = {
  rows: {
    kpi_code: string
    target_value: number
    target_monthly: number | ''
    target_quarterly: number | ''
    target_yearly: number | ''
  }[]
}

const DEPT_LABELS: Record<string, string> = {
  PRODUCTION:   'Sản Xuất',
  MAINTENANCE:  'Bảo Trì',
  COORDINATION: 'Điều Phối',
}

const DEPT_COLOR: Record<string, string> = {
  PRODUCTION:   'bg-[#3b5bdb]/8 text-[#3b5bdb] border-[#3b5bdb]/20',
  MAINTENANCE:  'bg-[#2f9e44]/8 text-[#2f9e44] border-[#2f9e44]/20',
  COORDINATION: 'bg-[#d4870c]/8 text-[#d4870c] border-[#d4870c]/20',
}

const PERIOD_LABEL: Record<string, string> = {
  monthly:   'Tháng',
  quarterly: 'Quý',
  yearly:    'Năm',
}

const inputCls =
  'w-full h-8 px-2 rounded-lg text-[12px] font-medium text-right ' +
  'text-dmc-text-primary bg-white border border-dmc-border ' +
  'focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 ' +
  'transition-all duration-150 disabled:opacity-40'

function OperatorBadge({ op }: { op: string }) {
  if (op === 'gte' || op === 'gt')
    return <TrendingUp size={13} className="text-emerald-500 shrink-0" />
  if (op === 'lte' || op === 'lt')
    return <TrendingDown size={13} className="text-red-400 shrink-0" />
  return <Minus size={13} className="text-gray-400 shrink-0" />
}

export function KpiSettingsTab({ initialRows, canEdit }: Props) {
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, formState: { isDirty } } = useForm<FormValues>({
    defaultValues: {
      rows: initialRows.map(r => ({
        kpi_code:        r.kpi_code,
        target_value:    r.target_value,
        target_monthly:  r.target_monthly   ?? '',
        target_quarterly: r.target_quarterly ?? '',
        target_yearly:   r.target_yearly    ?? '',
      })),
    },
  })

  async function onSubmit(values: FormValues) {
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    setSaving(true)
    const updates = values.rows.map(r => ({
      kpi_code:         r.kpi_code,
      target_value:     Number(r.target_value) || 0,
      target_monthly:   r.target_monthly   === '' ? null : Number(r.target_monthly),
      target_quarterly: r.target_quarterly === '' ? null : Number(r.target_quarterly),
      target_yearly:    r.target_yearly    === '' ? null : Number(r.target_yearly),
    }))
    const res = await updateKpiTargetsAction(updates)
    if (res.success) toast.success(res.message)
    else toast.error(res.message)
    setSaving(false)
  }

  // Group by department
  const grouped = initialRows.reduce<Record<string, KpiTargetRow[]>>((acc, r) => {
    ;(acc[r.department] ??= []).push(r)
    return acc
  }, {})

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="h-full overflow-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-dmc-text-primary">Cài đặt chỉ tiêu KPI</h1>
          <p className="text-sm text-dmc-text-muted mt-0.5">
            Đặt mục tiêu theo tháng, quý, năm cho từng KPI. Để trống = dùng giá trị mặc định.
          </p>
        </div>
        <button
          type="submit"
          disabled={!canEdit || saving || !isDirty}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all',
            'bg-dmc-primary text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          <Save size={14} />
          {saving ? 'Đang lưu...' : 'Lưu tất cả'}
        </button>
      </div>

      {/* Table per department */}
      {Object.entries(grouped).map(([dept, rows]) => {
        const deptColor = DEPT_COLOR[dept] ?? 'bg-gray-50 text-gray-700'
        return (
          <div key={dept} className="bg-white rounded-2xl shadow-sm border border-dmc-border overflow-hidden">
            {/* Dept header */}
            <div className="px-5 py-3 border-b border-dmc-border flex items-center gap-2">
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', deptColor)}>
                {DEPT_LABELS[dept] ?? dept}
              </span>
              <span className="text-xs text-dmc-text-muted">{rows.length} chỉ tiêu</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f5f5f7] text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">
                    <th className="px-4 py-2.5 text-left w-20">Mã KPI</th>
                    <th className="px-4 py-2.5 text-left">Tên chỉ tiêu</th>
                    <th className="px-4 py-2.5 text-center w-16">Đơn vị</th>
                    <th className="px-4 py-2.5 text-center w-10">Hướng</th>
                    <th className="px-4 py-2.5 text-center w-10">Kỳ chuẩn</th>
                    <th className="px-4 py-2.5 text-center w-28">Mục tiêu tháng</th>
                    <th className="px-4 py-2.5 text-center w-28">Mục tiêu quý</th>
                    <th className="px-4 py-2.5 text-center w-28">Mục tiêu năm</th>
                    <th className="px-4 py-2.5 text-center w-28 bg-[#ede9fe]/60">Mặc định</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dmc-border">
                  {rows.map((row, idx) => {
                    // Find index in full initialRows array for form registration
                    const formIdx = initialRows.findIndex(r => r.kpi_code === row.kpi_code)
                    return (
                      <tr key={row.kpi_code} className={cn('hover:bg-[#f9f9fb]', idx % 2 === 0 ? '' : 'bg-[#fafafa]')}>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-[12px] font-semibold text-dmc-primary">
                            {row.kpi_code}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-dmc-text-primary">{row.name}</td>
                        <td className="px-4 py-2.5 text-center text-[12px] text-dmc-text-muted">{row.unit}</td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex justify-center">
                            <OperatorBadge op={row.target_operator} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-[11px] font-medium text-dmc-text-muted">
                            {PERIOD_LABEL[row.default_period] ?? row.default_period}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="—"
                            {...register(`rows.${formIdx}.target_monthly`, { valueAsNumber: false })}
                            disabled={!canEdit}
                            className={inputCls}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="—"
                            {...register(`rows.${formIdx}.target_quarterly`, { valueAsNumber: false })}
                            disabled={!canEdit}
                            className={inputCls}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="—"
                            {...register(`rows.${formIdx}.target_yearly`, { valueAsNumber: false })}
                            disabled={!canEdit}
                            className={inputCls}
                          />
                        </td>
                        <td className="px-3 py-2 bg-[#ede9fe]/30">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            {...register(`rows.${formIdx}.target_value`, { valueAsNumber: false })}
                            disabled={!canEdit}
                            className={cn(inputCls, 'border-violet-200 focus:ring-violet-300/40 focus:border-violet-300')}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-dmc-text-muted pb-2">
        <span className="flex items-center gap-1"><TrendingUp size={12} className="text-emerald-500" /> Cao hơn = tốt hơn</span>
        <span className="flex items-center gap-1"><TrendingDown size={12} className="text-red-400" /> Thấp hơn = tốt hơn</span>
        <span className="flex items-center gap-1 ml-4">
          <span className="inline-block w-3 h-3 rounded bg-[#ede9fe]/60 border border-violet-200" />
          Mặc định: dùng khi không có mục tiêu theo kỳ cụ thể
        </span>
      </div>
    </form>
  )
}
