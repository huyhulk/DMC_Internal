'use client'

import { Factory, Grid2X2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ProductionKpiViewMode = 'workshop' | 'comparison'

interface Props {
  value: ProductionKpiViewMode
  onChange: (value: ProductionKpiViewMode) => void
}

const MODES: Array<{ value: ProductionKpiViewMode; label: string; icon: typeof Factory }> = [
  { value: 'workshop',   label: 'Theo xưởng',    icon: Factory },
  { value: 'comparison', label: 'Matrix 4 xưởng', icon: Grid2X2 },
]

export function KpiViewModeToggle({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-[3px] rounded-[12px] bg-[#f2f2f7] p-[3px]">
      {MODES.map((mode) => {
        const Icon = mode.icon
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            className={cn(
              'flex h-9 items-center gap-2 rounded-[10px] px-3 text-[12px] font-semibold transition-all',
              value === mode.value
                ? 'bg-white text-dmc-primary shadow-sm'
                : 'text-[#6e6e73] hover:text-[#1d1d1f]'
            )}
          >
            <Icon size={14} strokeWidth={2.3} />
            {mode.label}
          </button>
        )
      })}
    </div>
  )
}
