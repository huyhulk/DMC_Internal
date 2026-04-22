'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { ReportMode, WorkshopCode } from '@/lib/reports/report-types'
import { WORKSHOP_COLORS } from '@/lib/reports/report-types'

const LINE_COLORS = [
  '#3b82f6', '#f97316', '#8b5cf6', '#ef4444',
  '#10b981', '#f59e0b', '#06b6d4', '#ec4899',
]

interface OutputData {
  bySlot:    Record<string, number | string>[]
  byPeriod:  Record<string, number | string>[]
  seriesKeys: string[]
}

export function OutputSection({ data, mode }: { data: OutputData; mode: ReportMode }) {
  const colorFor = (key: string, idx: number): string =>
    mode === 'comparison'
      ? (WORKSHOP_COLORS[key as WorkshopCode] ?? LINE_COLORS[idx % LINE_COLORS.length])
      : LINE_COLORS[idx % LINE_COLORS.length]

  return (
    <div className="space-y-6">
      {/* Theo ca */}
      <div>
        <p className="text-[12px] font-semibold text-[#6e6e73] mb-2 uppercase tracking-wide">Theo ca sản xuất</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.bySlot} margin={{ left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => v.toLocaleString()} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            {data.seriesKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={colorFor(key, i)} radius={[3, 3, 0, 0]} maxBarSize={32} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Theo kỳ */}
      <div>
        <p className="text-[12px] font-semibold text-[#6e6e73] mb-2 uppercase tracking-wide">Theo kỳ</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.byPeriod} margin={{ left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => v.toLocaleString()} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            {data.seriesKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={colorFor(key, i)} radius={[3, 3, 0, 0]} maxBarSize={32} stackId={mode === 'comparison' ? 'a' : undefined} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
