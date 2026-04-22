'use client'

import { cn } from '@/lib/utils'
import type { NormItem, ProductLine } from '@/types'

interface Props {
  index: number
  line: ProductLine
  products: string[]
  normHint: NormItem | null
  disabled?: boolean
  onChange: (field: keyof ProductLine, value: string | number) => void
}

export function ProductLineCard({ index, line, products, normHint, disabled, onChange }: Props) {
  const normOk = normHint && line.realnorm > 0 && line.realnorm >= normHint.norm

  return (
    <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-4 space-y-3 animate-in
                    shadow-[0_1px_3px_rgba(0,0,0,0.06)]">

      {/* Header badge */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full
                         text-[11px] font-semibold
                         bg-dmc-primary/10 text-dmc-primary border border-dmc-primary/20">
          Sản phẩm #{index + 1}
        </span>

        {/* Norm achievement indicator */}
        {normHint && line.realnorm > 0 && (
          <span className={cn(
            'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
            normOk
              ? 'text-[#2f9e44] bg-[#2f9e44]/10 border-[#2f9e44]/20'
              : 'text-[#b37700] bg-[#ff9500]/10 border-[#ff9500]/20'
          )}>
            {line.realnorm} / {normHint.norm} sp/h
          </span>
        )}
      </div>

      {/* Row 1: Product + Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldGroup label="Sản phẩm">
          <select
            value={line.product}
            onChange={(e) => onChange('product', e.target.value)}
            disabled={disabled || products.length === 0}
            className={selectCls}
          >
            <option value="">— Chọn sản phẩm —</option>
            {products.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </FieldGroup>

        <FieldGroup label="Ngày sản xuất">
          <input
            type="date"
            value={line.pdate}
            onChange={(e) => onChange('pdate', e.target.value)}
            className={inputCls}
          />
        </FieldGroup>
      </div>

      {/* Row 2: Times + Workforce + Outputs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">

        <FieldGroup label="Bắt đầu">
          <input type="time" value={line.starttime}
            onChange={(e) => onChange('starttime', e.target.value)}
            className={inputCls} />
        </FieldGroup>

        <FieldGroup label="Kết thúc">
          <input type="time" value={line.endtime}
            onChange={(e) => onChange('endtime', e.target.value)}
            className={inputCls} />
        </FieldGroup>

        {/* Workforce — plain number input */}
        <FieldGroup label="Nhân sự">
          <input
            type="number" value={line.workforce} min={0}
            onChange={(e) => onChange('workforce', Number(e.target.value))}
            className={inputCls}
          />
        </FieldGroup>

        <FieldGroup label="Sản lượng">
          <input type="number" value={line.poutput || ''} min={0} placeholder="0"
            onChange={(e) => onChange('poutput', Number(e.target.value))}
            className={cn(inputCls, 'text-[#2f9e44] font-semibold')} />
        </FieldGroup>

        <FieldGroup label="Lỗi">
          <input type="number" value={line.eoutput || ''} min={0} placeholder="0"
            onChange={(e) => onChange('eoutput', Number(e.target.value))}
            className={cn(inputCls, 'text-[#ff3b30] font-semibold')} />
        </FieldGroup>

        <FieldGroup label="Tái chế">
          <input type="number" value={line.routput || ''} min={0} placeholder="0"
            onChange={(e) => onChange('routput', Number(e.target.value))}
            className={cn(inputCls, 'text-[#b37700] font-semibold')} />
        </FieldGroup>
      </div>

      {normHint && line.product && line.realnorm === 0 && (
        <p className="text-[11px] text-[#6e6e73]">
          Gợi ý: {normHint.nwforce} người · Định mức {normHint.norm} sp/giờ
        </p>
      )}
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-[#6e6e73] tracking-[0.01em]">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full h-9 px-3 rounded-xl text-[13px] font-medium ' +
  'text-dmc-text-primary placeholder:text-dmc-text-muted ' +
  'bg-[#f2f2f7] border border-[#d2d2d7]/70 ' +
  'focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150'

const selectCls = inputCls + ' cursor-pointer'
