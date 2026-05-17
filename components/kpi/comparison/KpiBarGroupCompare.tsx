'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { KPI_WORKSHOP_COLORS } from '@/modules/kpi/constants'
import { clamp } from '@/modules/kpi/format'
import type { KpiMatrixRow } from '@/modules/kpi/types'

interface Props { rows: KpiMatrixRow[] }

export function KpiBarGroupCompare({ rows }: Props) {
  const data = [...new Set(rows.map((r) => r.kpi_code))].map((code) => {
    const entry: Record<string, number | string> = { kpi: code }
    rows.filter((r) => r.kpi_code === code)
        .forEach((r) => { entry[r.workshop] = Math.round(clamp(r.achievement_pct, 0, 140)) })
    return entry
  })

  if (data.length === 0) return null

  return (
    <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <p className="mb-3 text-[13px] font-semibold text-[#1d1d1f]">Bar achievement theo KPI</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ left: 0, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="kpi" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 140]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v: number) => `${v}%`} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          {Object.entries(KPI_WORKSHOP_COLORS).map(([ws, color]) => (
            <Bar key={ws} dataKey={ws} fill={color} radius={[3, 3, 0, 0]} maxBarSize={24} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
