'use client'

import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import { QualityHeatmap } from '../charts/oee-chart'
import type { ReportMode, WorkshopCode, HeatmapCell } from '@/lib/reports/report-types'
import { WORKSHOP_CODES, WORKSHOP_COLORS } from '@/lib/reports/report-types'

const LINE_COLORS = [
  '#3b82f6', '#f97316', '#8b5cf6', '#ef4444',
  '#10b981', '#f59e0b', '#06b6d4', '#ec4899',
]

interface QualityData {
  bySlot:     Record<string, number | string>[]
  trend:      Record<string, number | string>[]
  heatmap:    HeatmapCell[]
  seriesKeys: string[]
  threshold:  number
}

export function QualitySection({ data, mode }: { data: QualityData; mode: ReportMode }) {
  const colorFor = (key: string, idx: number): string =>
    mode === 'comparison'
      ? (WORKSHOP_COLORS[key as WorkshopCode] ?? LINE_COLORS[idx % LINE_COLORS.length])
      : LINE_COLORS[idx % LINE_COLORS.length]

  const periods = [...new Set(data.heatmap.map((c) => c.period))].sort()

  return (
    <div className="space-y-6">
      {/* Line chart xu hướng */}
      <div>
        <p className="text-[12px] font-semibold text-[#6e6e73] mb-2 uppercase tracking-wide">
          Xu hướng tỷ lệ lỗi (%) {data.threshold > 0 && `— ngưỡng cảnh báo ${data.threshold}%`}
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.trend} margin={{ left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`${v}%`, '']} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={data.threshold} stroke="#ff3b30" strokeDasharray="4 4"
              label={{ value: `${data.threshold}%`, fill: '#ff3b30', fontSize: 10 }} />
            {data.seriesKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={colorFor(key, i)}
                strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Heatmap — chỉ comparison mode */}
      {mode === 'comparison' && data.heatmap.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold text-[#6e6e73] mb-2 uppercase tracking-wide">Heatmap tỷ lệ lỗi</p>
          <QualityHeatmap
            cells={data.heatmap}
            workshops={[...WORKSHOP_CODES]}
            periods={periods}
          />
        </div>
      )}

      {/* Theo ca */}
      <div>
        <p className="text-[12px] font-semibold text-[#6e6e73] mb-2 uppercase tracking-wide">Tỷ lệ lỗi theo ca (%)</p>
        <div className="overflow-x-auto rounded-xl border border-[#d2d2d7]/60">
          <table className="w-full text-[12px]">
            <thead className="bg-[#f2f2f7]">
              <tr>
                <th className="px-3 py-2 text-left text-[#6e6e73] font-semibold">Ca</th>
                {data.seriesKeys.map((k) => (
                  <th key={k} className="px-3 py-2 text-center text-[#6e6e73] font-semibold">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.bySlot.map((row, i) => (
                <tr key={i} className="border-t border-[#d2d2d7]/40">
                  <td className="px-3 py-2 font-medium">{String(row.label)}</td>
                  {data.seriesKeys.map((k) => {
                    const v = Number(row[k] ?? 0)
                    return (
                      <td key={k} className={`px-3 py-2 text-center font-semibold ${v > data.threshold ? 'text-[#ff3b30]' : 'text-[#2f9e44]'}`}>
                        {v.toFixed(1)}%
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
