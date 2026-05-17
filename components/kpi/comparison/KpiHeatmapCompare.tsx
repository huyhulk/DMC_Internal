import { KPI_WORKSHOP_COLORS } from '@/modules/kpi/constants'
import { cn } from '@/lib/utils'
import type { KpiMatrixRow } from '@/modules/kpi/types'

interface Props { rows: KpiMatrixRow[] }

export function KpiHeatmapCompare({ rows }: Props) {
  const codes     = [...new Set(rows.map((r) => r.kpi_code))]
  const workshops = [...new Set(rows.map((r) => r.workshop))]
  const byCell    = new Map(rows.map((r) => [`${r.kpi_code}:${r.workshop}`, r]))

  if (rows.length === 0) return null

  return (
    <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <p className="mb-3 text-[13px] font-semibold text-[#1d1d1f]">Heatmap trạng thái KPI</p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `84px repeat(${workshops.length}, minmax(52px, 1fr))` }}
      >
        <div />
        {workshops.map((ws) => (
          <div key={ws} className="text-center text-[11px] font-bold" style={{ color: KPI_WORKSHOP_COLORS[ws] }}>
            {ws}
          </div>
        ))}
        {codes.map((code) => (
          <HeatmapRow key={code} code={code} workshops={workshops} byCell={byCell} />
        ))}
      </div>
    </div>
  )
}

function HeatmapRow({ code, workshops, byCell }: {
  code: string
  workshops: KpiMatrixRow['workshop'][]
  byCell: Map<string, KpiMatrixRow>
}) {
  return (
    <>
      <div className="flex h-9 items-center text-[12px] font-bold text-dmc-primary">{code}</div>
      {workshops.map((ws) => {
        const cell = byCell.get(`${code}:${ws}`)
        return (
          <div
            key={ws}
            title={cell ? `${ws} ${code}: ${Math.round(cell.achievement_pct)}%` : undefined}
            className={cn(
              'h-9 rounded-xl border',
              cell?.is_achieved
                ? 'border-[#34c759]/20 bg-[#34c759]/80'
                : 'border-[#ff3b30]/20 bg-[#ff3b30]/80'
            )}
          />
        )
      })}
    </>
  )
}
