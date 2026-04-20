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
  return (
    <div className="bg-dmc-bg-card border border-dmc-border rounded-xl p-4 space-y-3 animate-in">
      {/* Badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-dmc-primary text-white">
          Sản phẩm #{index + 1}
        </span>
      </div>

      {/* Row 1: Product + Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldGroup label="🔧 Sản phẩm">
          <select
            value={line.product}
            onChange={(e) => onChange('product', e.target.value)}
            disabled={disabled || products.length === 0}
            className="w-full h-9 px-3 rounded-lg bg-dmc-bg-input border border-dmc-border text-dmc-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-dmc-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">-- Chọn sản phẩm --</option>
            {products.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </FieldGroup>

        <FieldGroup label="📅 Ngày sản xuất">
          <input
            type="date"
            value={line.pdate}
            onChange={(e) => onChange('pdate', e.target.value)}
            className="w-full h-9 px-3 rounded-lg bg-dmc-bg-input border border-dmc-border text-dmc-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-dmc-primary/50"
          />
        </FieldGroup>
      </div>

      {/* Row 2: Times + Numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <FieldGroup label="▶️ Bắt đầu">
          <input
            type="time"
            value={line.starttime}
            onChange={(e) => onChange('starttime', e.target.value)}
            className={inputCls}
          />
        </FieldGroup>

        <FieldGroup label="⏹️ Kết thúc">
          <input
            type="time"
            value={line.endtime}
            onChange={(e) => onChange('endtime', e.target.value)}
            className={inputCls}
          />
        </FieldGroup>

        <FieldGroup label="⛑️ Nhân sự">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onChange('workforce', Math.max(0, line.workforce - 1))}
              className="w-7 h-9 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-800/40 text-lg font-bold flex-shrink-0 transition-all"
            >−</button>
            <input
              type="number"
              value={line.workforce}
              min={0}
              onChange={(e) => onChange('workforce', Number(e.target.value))}
              className={cn(inputCls, 'text-center')}
            />
            <button
              type="button"
              onClick={() => onChange('workforce', line.workforce + 1)}
              className="w-7 h-9 rounded-lg bg-green-900/30 text-green-400 hover:bg-green-800/40 text-lg font-bold flex-shrink-0 transition-all"
            >+</button>
          </div>
        </FieldGroup>

        <FieldGroup label="✅ Sản lượng">
          <input
            type="number"
            value={line.poutput || ''}
            min={0}
            placeholder="0"
            onChange={(e) => onChange('poutput', Number(e.target.value))}
            className={cn(inputCls, 'text-green-400')}
          />
        </FieldGroup>

        <FieldGroup label="❌ Lỗi">
          <input
            type="number"
            value={line.eoutput || ''}
            min={0}
            placeholder="0"
            onChange={(e) => onChange('eoutput', Number(e.target.value))}
            className={cn(inputCls, 'text-red-400')}
          />
        </FieldGroup>

        <FieldGroup label="♻️ Tái chế">
          <input
            type="number"
            value={line.routput || ''}
            min={0}
            placeholder="0"
            onChange={(e) => onChange('routput', Number(e.target.value))}
            className={cn(inputCls, 'text-yellow-400')}
          />
        </FieldGroup>
      </div>

      {/* Norm hint */}
      {normHint && line.product && (
        <p className="text-xs text-dmc-info">
          ℹ️ Gợi ý: {normHint.nwforce} người | Định mức: {normHint.norm} sp/giờ
          {line.realnorm > 0 && (
            <span className={cn('ml-3 font-semibold', line.realnorm >= normHint.norm ? 'text-green-400' : 'text-yellow-400')}>
              | Thực tế: {line.realnorm} sp/giờ
            </span>
          )}
        </p>
      )}
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-dmc-text-secondary">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full h-9 px-3 rounded-lg bg-dmc-bg-input border border-dmc-border text-dmc-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-dmc-primary/50 transition-all'
