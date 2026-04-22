'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { OEEGaugeChart, OEERadarChart } from '../charts/oee-chart'
import type { OEEWorkshop, WorkshopCode } from '@/lib/reports/report-types'
import { WORKSHOP_COLORS, WORKSHOP_LABEL } from '@/lib/reports/report-types'

interface OEEData {
  workshop?:  OEEWorkshop
  workshops?: OEEWorkshop[]
  ranking?:   Array<OEEWorkshop & { rank: number }>
}

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`

// ── Detail mode ──────────────────────────────────────────────────────────

export function OEEDetail({ data }: { data: OEEData }) {
  const ws = data.workshop
  if (!ws) return <EmptyState />

  return (
    <div className="space-y-6">
      <OEEGaugeChart data={ws} />

      {ws.lines && ws.lines.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold text-[#6e6e73] mb-2 uppercase tracking-wide">
            OEE theo dòng sản xuất
          </p>
          <div className="overflow-x-auto rounded-xl border border-[#d2d2d7]/60">
            <table className="w-full text-[12px]">
              <thead className="bg-[#f2f2f7]">
                <tr>
                  {['Dòng SX', 'Sản lượng', 'A', 'P', 'Q', 'OEE'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[#6e6e73] font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ws.lines.map((l) => (
                  <tr key={l.product} className="border-t border-[#d2d2d7]/40 hover:bg-[#f2f2f7]/60">
                    <td className="px-3 py-2 font-medium max-w-[180px] truncate">{l.product}</td>
                    <td className="px-3 py-2 text-center">{l.poutput.toLocaleString()}</td>
                    <td className="px-3 py-2 text-center text-[#3b82f6] font-semibold">{pct(l.A)}</td>
                    <td className="px-3 py-2 text-center text-[#f97316] font-semibold">{pct(l.P)}</td>
                    <td className="px-3 py-2 text-center text-[#10b981] font-semibold">{pct(l.Q)}</td>
                    <td className={`px-3 py-2 text-center font-bold ${l.OEE >= 0.6 ? 'text-[#2f9e44]' : l.OEE >= 0.4 ? 'text-[#b37700]' : 'text-[#ff3b30]'}`}>
                      {pct(l.OEE)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Comparison mode ──────────────────────────────────────────────────────

export function OEEComparison({ data }: { data: OEEData }) {
  const workshops = data.workshops ?? []
  if (workshops.length === 0) return <EmptyState />

  const barData = workshops.map((w) => ({
    name: w.workshop,
    OEE: Math.round(w.OEE * 1000) / 10,
    A:   Math.round(w.A   * 1000) / 10,
    P:   Math.round(w.P   * 1000) / 10,
    Q:   Math.round(w.Q   * 1000) / 10,
    fill: WORKSHOP_COLORS[w.workshop as WorkshopCode],
  }))

  return (
    <div className="space-y-6">
      {/* Radar */}
      <OEERadarChart workshops={workshops} />

      {/* Bar chart OEE */}
      <div>
        <p className="text-[12px] font-semibold text-[#6e6e73] mb-2 uppercase tracking-wide">So sánh OEE (%)</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={barData} margin={{ left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Bar dataKey="OEE" radius={[4, 4, 0, 0]} maxBarSize={48}
              label={{ position: 'top', formatter: (v: number) => `${v}%`, fontSize: 11, fontWeight: 700 }}>
              {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Ranking table */}
      {data.ranking && (
        <div>
          <p className="text-[12px] font-semibold text-[#6e6e73] mb-2 uppercase tracking-wide">Xếp hạng OEE</p>
          <div className="overflow-x-auto rounded-xl border border-[#d2d2d7]/60">
            <table className="w-full text-[12px]">
              <thead className="bg-[#f2f2f7]">
                <tr>
                  {['#', 'Xưởng', 'Sản lượng', 'A', 'P', 'Q', 'OEE'].map((h) => (
                    <th key={h} className="px-3 py-2 text-center text-[#6e6e73] font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.ranking.map((r) => (
                  <tr key={r.workshop} className="border-t border-[#d2d2d7]/40 hover:bg-[#f2f2f7]/60">
                    <td className="px-3 py-2 text-center font-bold text-[#1d1d1f]">#{r.rank}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: WORKSHOP_COLORS[r.workshop as WorkshopCode] }}>
                      {WORKSHOP_LABEL[r.workshop as WorkshopCode] ?? r.workshop}
                    </td>
                    <td className="px-3 py-2 text-center">{r.poutput.toLocaleString()}</td>
                    <td className="px-3 py-2 text-center text-[#3b82f6]">{pct(r.A)}</td>
                    <td className="px-3 py-2 text-center text-[#f97316]">{pct(r.P)}</td>
                    <td className="px-3 py-2 text-center text-[#10b981]">{pct(r.Q)}</td>
                    <td className={`px-3 py-2 text-center font-bold ${r.OEE >= 0.6 ? 'text-[#2f9e44]' : r.OEE >= 0.4 ? 'text-[#b37700]' : 'text-[#ff3b30]'}`}>
                      {pct(r.OEE)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return <p className="text-center text-[#aeaeb2] py-8 text-[13px]">Chưa có dữ liệu OEE trong khoảng thời gian này</p>
}
