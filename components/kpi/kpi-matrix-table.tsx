'use client'

import { WORKSHOPS, WORKSHOP_COLORS, type WorkshopCode } from '@/lib/kpi/types'

interface MatrixValues {
  actual_value: number
  is_achieved: boolean
  achievement_pct: number
  data_count: number
}

interface MatrixRow {
  kpi_name: string
  target_value: number
  target_operator: string
  values: Record<string, MatrixValues>
}

interface Rankings {
  [workshop: string]: { achieved: number; total: number; rank: number }
}

interface Props {
  kpiCodes: string[]
  matrix: Record<string, MatrixRow>
  rankings: Rankings
}

const OPERATOR_SYMBOL: Record<string, string> = {
  lte: '≤', gte: '≥', lt: '<', gt: '>', eq: '=',
}

const RANK_EMOJI = ['🥇', '🥈', '🥉', '4️⃣']

function Cell({ v }: { v?: MatrixValues }) {
  if (!v || v.data_count === 0) {
    return <td className="px-3 py-2.5 text-center text-[12px] text-[#c7c7cc]">—</td>
  }
  return (
    <td className={`px-3 py-2.5 text-center text-[12px] font-semibold transition-colors ${
      v.is_achieved ? 'bg-[#f0fff4] text-[#2f9e44]' : 'bg-[#fff5f5] text-[#e03131]'
    }`}>
      <span title={`Đạt ${v.achievement_pct.toFixed(0)}% | ${v.data_count} bản ghi`}>
        {v.actual_value < 10 ? v.actual_value.toFixed(2) : v.actual_value.toFixed(1)}
        {v.is_achieved ? ' ✅' : ' ❌'}
      </span>
    </td>
  )
}

export function KpiMatrixTable({ kpiCodes, matrix, rankings }: Props) {
  if (kpiCodes.length === 0) {
    return (
      <div className="text-center py-12 text-[#6e6e73] text-[14px]">
        Không có dữ liệu KPI
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#d2d2d7]/60">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[#f2f2f7] border-b border-[#d2d2d7]/60">
            <th className="px-4 py-3 text-[12px] font-semibold text-[#6e6e73] w-56">KPI</th>
            {WORKSHOPS.map((ws) => (
              <th key={ws} className="px-3 py-3 text-center text-[12px] font-bold"
                style={{ color: WORKSHOP_COLORS[ws as WorkshopCode] }}>
                {ws}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {kpiCodes.map((code, idx) => {
            const row = matrix[code]
            if (!row) return null
            return (
              <tr key={code} className={`border-b border-[#d2d2d7]/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f9f9fb]'}`}>
                <td className="px-4 py-2.5">
                  <span className="text-[10px] font-bold text-[#aeaeb2] uppercase mr-1.5">{code}</span>
                  <span className="text-[12px] text-[#1d1d1f]">{row.kpi_name}</span>
                  <span className="block text-[10px] text-[#aeaeb2] mt-0.5">
                    Mục tiêu: {OPERATOR_SYMBOL[row.target_operator]}{row.target_value}
                  </span>
                </td>
                {WORKSHOPS.map((ws) => <Cell key={ws} v={row.values[ws]} />)}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-[#f2f2f7] border-t border-[#d2d2d7]">
            <td className="px-4 py-3 text-[12px] font-semibold text-[#1d1d1f]">Tổng đạt / Xếp hạng</td>
            {WORKSHOPS.map((ws) => {
              const r = rankings[ws]
              return (
                <td key={ws} className="px-3 py-3 text-center">
                  <div className="font-bold text-[13px] text-[#1d1d1f]">
                    {r ? `${r.achieved}/${r.total}` : '—'}
                  </div>
                  {r && (
                    <div className="text-[12px] mt-0.5">
                      {RANK_EMOJI[r.rank - 1] ?? `#${r.rank}`}
                    </div>
                  )}
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
