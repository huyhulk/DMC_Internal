'use client'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KPI_WORKSHOP_COLORS, KPI_WORKSHOP_LABELS } from '@/lib/kpi/constants'
import { formatKpiValue, formatTarget } from '@/lib/kpi/format'
import type { KpiMatrixRow } from '@/lib/kpi/types'
import { KpiTargetBadge } from '../KpiTargetBadge'

interface Props { rows: KpiMatrixRow[] }

export function KpiMatrixTable({ rows }: Props) {
  const [selected, setSelected] = useState<KpiMatrixRow | null>(null)
  const kpiCodes = useMemo(() => [...new Set(rows.map((r) => r.kpi_code))], [rows])
  const workshops = useMemo(() => [...new Set(rows.map((r) => r.workshop))], [rows])
  const byCell = useMemo(() => {
    const map = new Map<string, KpiMatrixRow>()
    rows.forEach((r) => map.set(`${r.kpi_code}:${r.workshop}`, r))
    return map
  }, [rows])

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-8 text-center text-[13px] text-[#aeaeb2]">
        Chưa có dữ liệu matrix trong kỳ này.
      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-[#d2d2d7]/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[12px]">
            <thead className="bg-[#f9f9fb]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-[#6e6e73]">KPI</th>
                {workshops.map((ws) => (
                  <th key={ws} className="px-4 py-3 text-center font-semibold text-[#6e6e73]">
                    <span style={{ color: KPI_WORKSHOP_COLORS[ws] }}>{ws}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kpiCodes.map((code) => {
                const first = rows.find((r) => r.kpi_code === code)
                return (
                  <tr key={code} className="border-t border-[#d2d2d7]/45">
                    <td className="px-4 py-3">
                      <p className="font-bold text-dmc-primary">{code}</p>
                      <p className="mt-0.5 max-w-[260px] truncate font-medium text-[#1d1d1f]">{first?.kpi_name}</p>
                      {first && <p className="mt-1 text-[11px] text-[#6e6e73]">{formatTarget(first)}</p>}
                    </td>
                    {workshops.map((ws) => {
                      const cell = byCell.get(`${code}:${ws}`)
                      if (!cell) return <td key={ws} className="px-4 py-3 text-center text-[#aeaeb2]">-</td>
                      return (
                        <td key={ws} className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelected(cell)}
                            className={cn(
                              'mx-auto flex min-h-[64px] w-full min-w-[112px] flex-col items-center justify-center gap-1 rounded-xl border px-3 py-2 transition-all',
                              cell.is_achieved
                                ? 'border-[#34c759]/25 bg-[#34c759]/8 hover:bg-[#34c759]/12'
                                : 'border-[#ff3b30]/25 bg-[#ff3b30]/8 hover:bg-[#ff3b30]/12'
                            )}
                          >
                            <span className="text-[14px] font-bold text-[#1d1d1f]">
                              {formatKpiValue(cell.actual_value, cell.unit)}
                            </span>
                            <KpiTargetBadge row={cell} compact />
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button" aria-label="Đóng"
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div className="relative w-full max-w-md rounded-[20px] border border-[#d2d2d7]/60 bg-white p-5 shadow-apple-lg">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-[#6e6e73] hover:bg-[#f2f2f7]"
            >
              <X size={16} />
            </button>
            <p className="text-[12px] font-bold text-dmc-primary">{selected.workshop} - {selected.kpi_code}</p>
            <h3 className="mt-1 pr-8 text-[16px] font-semibold text-[#1d1d1f]">{selected.kpi_name}</h3>
            <div className="mt-4 space-y-2 rounded-2xl bg-[#f9f9fb] p-4 text-[13px]">
              <DetailRow label="Xưởng"       value={KPI_WORKSHOP_LABELS[selected.workshop]} />
              <DetailRow label="Thực tế"     value={formatKpiValue(selected.actual_value, selected.unit)} />
              <DetailRow label="Mục tiêu"    value={formatTarget(selected)} />
              <DetailRow label="Achievement" value={`${Math.round(selected.achievement_pct)}%`} />
              <DetailRow label="Số records"  value={selected.data_count.toString()} />
              <DetailRow label="Kỳ"          value={selected.period_label} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#6e6e73]">{label}</span>
      <span className="text-right font-semibold text-[#1d1d1f]">{value}</span>
    </div>
  )
}
