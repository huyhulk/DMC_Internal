'use client'

import { Info } from 'lucide-react'
import { KPI_WORKSHOP_LABELS, KPI_WORKSHOP_OPTIONS } from '@/modules/kpi/constants'
import type { KpiWorkshop } from '@/modules/kpi/types'

interface Props {
  value: KpiWorkshop | 'ALL'
  onChange: (value: KpiWorkshop | 'ALL') => void
  includeAll?: boolean
}

export function WorkshopSelect({ value, onChange, includeAll = true }: Props) {
  const options = includeAll ? KPI_WORKSHOP_OPTIONS : KPI_WORKSHOP_OPTIONS.filter((o) => o !== 'ALL')

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">
        Phân xưởng
        <Info size={12} className="text-[#aeaeb2]" />
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as KpiWorkshop | 'ALL')}
        title="DMC1 bao gồm dữ liệu DM1 và DM2 đã chuẩn hóa khi import."
        className="h-9 min-w-[180px] rounded-xl border border-[#d2d2d7]/70 bg-white px-3 text-[13px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-dmc-primary/40"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === 'ALL' ? 'Toàn nhà máy' : KPI_WORKSHOP_LABELS[option as KpiWorkshop]}
          </option>
        ))}
      </select>
    </div>
  )
}
