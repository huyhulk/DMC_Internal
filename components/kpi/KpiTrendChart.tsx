'use client'

import {
  CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { formatKpiValue } from '@/lib/kpi/format'
import type { KpiResultRow, KpiTrendPoint } from '@/lib/kpi/types'

interface Props {
  row: KpiResultRow
  points: KpiTrendPoint[]
}

export function KpiTrendChart({ row, points }: Props) {
  if (points.length === 0) return null

  const data = points.map((p) => ({
    period: p.period_label,
    actual: p.actual_value,
    target: p.target_value,
  }))

  return (
    <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold text-dmc-primary">{row.kpi_code}</p>
          <p className="text-[13px] font-semibold text-[#1d1d1f]">{row.kpi_name}</p>
        </div>
        <p className="text-[11px] font-medium text-[#6e6e73]">6 kỳ gần nhất</p>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ left: 0, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip formatter={(value: number) => formatKpiValue(value, row.unit)} />
          <ReferenceLine y={row.target_value} stroke="#ff3b30" strokeDasharray="4 3" />
          <Line type="monotone" dataKey="actual" stroke="#3b5bdb" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
