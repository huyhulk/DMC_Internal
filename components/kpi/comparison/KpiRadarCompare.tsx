'use client'

import {
  Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  Radar, RadarChart, ResponsiveContainer, Tooltip,
} from 'recharts'
import { KPI_WORKSHOP_COLORS } from '@/lib/kpi/constants'
import { clamp } from '@/lib/kpi/format'
import type { KpiMatrixRow } from '@/lib/kpi/types'

interface Props { rows: KpiMatrixRow[] }

export function KpiRadarCompare({ rows }: Props) {
  const data = [...new Set(rows.map((r) => r.kpi_code))].map((code) => {
    const entry: Record<string, number | string> = { kpi: code }
    rows.filter((r) => r.kpi_code === code)
        .forEach((r) => { entry[r.workshop] = Math.round(clamp(r.achievement_pct, 0, 120)) })
    return entry
  })

  if (data.length === 0) return null

  return (
    <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <p className="mb-3 text-[13px] font-semibold text-[#1d1d1f]">Radar achievement 4 xưởng</p>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data}>
          <PolarGrid stroke="#e5e5ea" />
          <PolarAngleAxis dataKey="kpi" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis angle={90} domain={[0, 120]} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v: number) => `${v}%`} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          {Object.entries(KPI_WORKSHOP_COLORS).map(([ws, color]) => (
            <Radar
              key={ws} name={ws} dataKey={ws}
              stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
