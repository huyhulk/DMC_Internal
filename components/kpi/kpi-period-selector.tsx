'use client'

import { PERIOD_LABELS } from '@/lib/kpi/constants'
import type { PeriodType } from '@/lib/kpi/types'

interface Props {
  period: PeriodType
  anchor: string
  onPeriod: (p: PeriodType) => void
  onAnchor: (d: string) => void
}

const PERIODS: PeriodType[] = ['weekly', 'monthly', 'quarterly', 'yearly']

export function KpiPeriodSelector({ period, anchor, onPeriod, onAnchor }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period type buttons */}
      <div className="flex items-center gap-1 bg-[#f2f2f7] rounded-xl p-1">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => onPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
              period === p
                ? 'bg-white text-[#1d1d1f] shadow-sm shadow-black/10'
                : 'text-[#6e6e73] hover:text-[#1d1d1f]'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Anchor date */}
      <div className="flex items-center gap-1.5">
        <span className="text-[12px] text-[#6e6e73]">Mốc:</span>
        <input
          type="date"
          value={anchor}
          onChange={(e) => onAnchor(e.target.value)}
          className="text-[12px] border border-[#d2d2d7] rounded-lg px-2.5 py-1.5
                     bg-white text-[#1d1d1f] focus:outline-none focus:ring-2
                     focus:ring-[#3b5bdb]/30 focus:border-[#3b5bdb]"
        />
      </div>
    </div>
  )
}
