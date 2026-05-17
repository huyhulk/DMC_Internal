import { Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'
import { clamp, formatKpiValue, formatTarget } from '@/modules/kpi/format'
import type { KpiResultRow } from '@/modules/kpi/types'
import { KpiTargetBadge } from './KpiTargetBadge'

interface Props {
  row: KpiResultRow
}

export function KpiMetricCard({ row }: Props) {
  const progress = clamp(row.achievement_pct, 0, 100)

  return (
    <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-dmc-primary">{row.kpi_code}</p>
          <h3 className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug text-[#1d1d1f]">
            {row.kpi_name}
          </h3>
        </div>
        <KpiTargetBadge row={row} compact />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[24px] font-bold tracking-tight text-[#1d1d1f]">
            {formatKpiValue(row.actual_value, row.unit)}
          </p>
          <p className="mt-1 text-[11px] font-medium text-[#6e6e73]">
            Mục tiêu {formatTarget(row)}
          </p>
        </div>
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          row.is_achieved ? 'bg-[#34c759]/10 text-[#2f9e44]' : 'bg-[#ff3b30]/10 text-[#c92a2a]'
        )}>
          <Gauge size={18} strokeWidth={2.4} />
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-[#f2f2f7]">
          <div
            className={cn('h-full rounded-full transition-all', row.is_achieved ? 'bg-[#34c759]' : 'bg-[#ff9500]')}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-[#6e6e73]">
          <span>{Math.round(row.achievement_pct)}% achievement</span>
          <span>{row.data_count} records</span>
        </div>
      </div>
    </div>
  )
}
