'use client'

import type { KpiResult } from '@/lib/kpi/types'

interface Props {
  data: KpiResult
  showPeriodHint?: boolean
}

const OPERATOR_LABEL: Record<string, string> = {
  lte: '≤', gte: '≥', lt: '<', gt: '>', eq: '=',
}

function formatValue(v: number, unit: string): string {
  if (unit === '%') return `${v.toFixed(v < 1 ? 2 : 1)}%`
  if (unit === 'h/ngày') return `${v.toFixed(1)}h`
  if (unit === 'phút/lần') return `${Math.round(v)} phút`
  if (unit === 'giờ') return `${Math.round(v)}h`
  return `${v.toFixed(1)} ${unit}`
}

export function KpiCard({ data, showPeriodHint = false }: Props) {
  const bar = Math.min(100, Math.max(0, data.achievement_pct))
  const hasData = data.data_count > 0

  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-3 transition-all ${
      !hasData
        ? 'bg-[#f2f2f7] border-[#d2d2d7]/60'
        : data.is_achieved
          ? 'bg-white border-[#34c759]/30 shadow-sm'
          : 'bg-white border-[#ff3b30]/20 shadow-sm'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[10px] font-bold text-[#aeaeb2] tracking-wide uppercase">
            {data.kpi_code}
          </span>
          <p className="text-[13px] font-semibold text-[#1d1d1f] leading-snug mt-0.5">
            {data.kpi_name}
          </p>
        </div>
        {hasData && (
          <span className={`shrink-0 text-[20px] ${data.is_achieved ? '' : 'opacity-90'}`}>
            {data.is_achieved ? '✅' : '❌'}
          </span>
        )}
      </div>

      {/* Value */}
      {hasData ? (
        <div className="flex items-end justify-between">
          <div>
            <span className="text-[28px] font-bold tracking-tight text-[#1d1d1f] leading-none">
              {formatValue(data.actual_value, data.unit)}
            </span>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-[#6e6e73]">Mục tiêu</p>
            <p className="text-[13px] font-semibold text-[#6e6e73]">
              {OPERATOR_LABEL[data.target_operator]}{formatValue(data.target_value, data.unit)}
            </p>
          </div>
        </div>
      ) : (
        <div className="py-2">
          <p className="text-[13px] text-[#aeaeb2]">Chưa có dữ liệu</p>
          <p className="text-[11px] text-[#c7c7cc] mt-0.5">
            Mục tiêu: {OPERATOR_LABEL[data.target_operator]}{formatValue(data.target_value, data.unit)}
          </p>
        </div>
      )}

      {/* Progress bar */}
      {hasData && (
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[10px] text-[#6e6e73]">Đạt {bar.toFixed(0)}%</span>
            <span className="text-[10px] text-[#aeaeb2]">{data.data_count} bản ghi</span>
          </div>
          <div className="h-1.5 bg-[#f2f2f7] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                data.is_achieved ? 'bg-[#34c759]' : 'bg-[#ff3b30]'
              }`}
              style={{ width: `${bar}%` }}
            />
          </div>
        </div>
      )}

      {/* Period hint */}
      {showPeriodHint && !data.is_period_match && (
        <p className="text-[10px] text-[#d4870c] border-t border-[#d2d2d7]/50 pt-2">
          ⚠️ Mục tiêu chuẩn theo {data.default_period}
        </p>
      )}
    </div>
  )
}
