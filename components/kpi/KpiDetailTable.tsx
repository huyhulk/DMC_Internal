import { formatKpiValue, formatTarget } from '@/lib/kpi/format'
import type { KpiResultRow } from '@/lib/kpi/types'
import { KpiTargetBadge } from './KpiTargetBadge'

interface Props { rows: KpiResultRow[] }

export function KpiDetailTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-8 text-center text-[13px] text-[#aeaeb2]">
        Chưa có KPI nào trong kỳ này.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#d2d2d7]/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[12px]">
          <thead className="bg-[#f9f9fb]">
            <tr>
              {['KPI', 'Mục tiêu', 'Thực tế', 'Achievement', 'Dữ liệu', 'Trạng thái'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-[#6e6e73]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.kpi_code} className="border-t border-[#d2d2d7]/45 hover:bg-[#f2f2f7]/50">
                <td className="px-4 py-3">
                  <p className="font-bold text-dmc-primary">{row.kpi_code}</p>
                  <p className="mt-0.5 max-w-[280px] truncate font-medium text-[#1d1d1f]">{row.kpi_name}</p>
                </td>
                <td className="px-4 py-3 font-semibold text-[#1d1d1f]">{formatTarget(row)}</td>
                <td className="px-4 py-3 font-semibold text-[#1d1d1f]">{formatKpiValue(row.actual_value, row.unit)}</td>
                <td className="px-4 py-3">{Math.round(row.achievement_pct)}%</td>
                <td className="px-4 py-3">{row.data_count}</td>
                <td className="px-4 py-3"><KpiTargetBadge row={row} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
