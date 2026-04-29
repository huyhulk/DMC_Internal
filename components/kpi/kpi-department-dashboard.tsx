'use client'

import { useState, useEffect, useCallback } from 'react'
import { KpiPeriodSelector } from './kpi-period-selector'
import { KpiCard } from './kpi-card'
import { KpiMatrixTable } from './kpi-matrix-table'
import { KpiRadarChart } from './kpi-radar-chart'
import { WORKSHOPS, type Department, type PeriodType, type KpiResult, type ViewMode } from '@/lib/kpi/types'
import type { WorkshopCode } from '@/lib/kpi/types'

interface MatrixValues {
  actual_value: number; is_achieved: boolean; achievement_pct: number; data_count: number
}
interface MatrixData {
  kpiCodes: string[]
  matrix: Record<string, { kpi_name: string; target_value: number; target_operator: string; values: Record<string, MatrixValues> }>
  rankings: Record<string, { achieved: number; total: number; rank: number }>
}

interface Props {
  department: Department
  defaultPeriod?: PeriodType
}

const VIEW_LABELS: Record<ViewMode, string> = {
  overview: '📊 Tổng hợp',
  workshop: '🏭 Theo xưởng',
  compare:  '🔀 So sánh',
}

export function KpiDepartmentDashboard({ department, defaultPeriod = 'monthly' }: Props) {
  const today = new Date().toISOString().substring(0, 10)
  const [period, setPeriod]   = useState<PeriodType>(defaultPeriod)
  const [anchor, setAnchor]   = useState(today)
  const [view, setView]       = useState<ViewMode>('overview')
  const [workshop, setWorkshop] = useState<WorkshopCode>('DMC1')

  const [overview, setOverview]   = useState<KpiResult[] | null>(null)
  const [matrix, setMatrix]       = useState<MatrixData | null>(null)
  const [wsData, setWsData]       = useState<KpiResult[] | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const fetchOverview = useCallback(async () => {
    const res = await fetch(`/api/kpi/department?department=${department}&period=${period}&anchor=${anchor}`)
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data as KpiResult[]
  }, [department, period, anchor])

  const fetchMatrix = useCallback(async () => {
    const res = await fetch(`/api/kpi/comparison?department=${department}&period=${period}&anchor=${anchor}`)
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data as MatrixData
  }, [department, period, anchor])

  const fetchWorkshop = useCallback(async (ws: WorkshopCode) => {
    const res = await fetch(`/api/kpi/department?department=${department}&period=${period}&anchor=${anchor}&workshop=${ws}`)
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data as KpiResult[]
  }, [department, period, anchor])

  useEffect(() => {
    setLoading(true)
    setError(null)
    const load = async () => {
      try {
        if (view === 'overview') {
          setOverview(await fetchOverview())
        } else if (view === 'compare') {
          setMatrix(await fetchMatrix())
        } else {
          setWsData(await fetchWorkshop(workshop))
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [view, period, anchor, workshop, fetchOverview, fetchMatrix, fetchWorkshop])

  const achievedCount = overview ? overview.filter((r) => r.is_achieved).length : 0

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4 flex flex-wrap items-center justify-between gap-4">
        <KpiPeriodSelector period={period} anchor={anchor} onPeriod={setPeriod} onAnchor={setAnchor} />

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-[#f2f2f7] rounded-xl p-1">
          {(['overview', 'workshop', 'compare'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                view === v
                  ? 'bg-white text-[#1d1d1f] shadow-sm shadow-black/10'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {/* Workshop selector (view=workshop) */}
      {view === 'workshop' && (
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[#6e6e73]">Phân xưởng:</span>
          <div className="flex gap-1">
            {WORKSHOPS.map((ws) => (
              <button
                key={ws}
                onClick={() => setWorkshop(ws)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                  workshop === ws
                    ? 'bg-[#3b5bdb] text-white border-[#3b5bdb]'
                    : 'bg-white text-[#6e6e73] border-[#d2d2d7] hover:border-[#3b5bdb]/40'
                }`}
              >
                {ws}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary badge (overview only) */}
      {view === 'overview' && overview && !loading && (
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border ${
            achievedCount === overview.length
              ? 'bg-[#f0fff4] text-[#2f9e44] border-[#34c759]/30'
              : achievedCount >= overview.length / 2
                ? 'bg-[#fff9e6] text-[#d4870c] border-[#d4870c]/30'
                : 'bg-[#fff5f5] text-[#e03131] border-[#ff3b30]/20'
          }`}>
            {achievedCount === overview.length ? '✅' : '⚠️'}
            Đạt {achievedCount}/{overview.length} KPI
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#3b5bdb]/20 border-t-[#3b5bdb] rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-[#fff5f5] border border-[#ff3b30]/20 rounded-2xl p-6 text-center text-[#e03131] text-[14px]">
          ⚠️ {error}
        </div>
      )}

      {/* Overview view: KPI cards grid */}
      {!loading && !error && view === 'overview' && overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {overview.map((kpi) => (
            <KpiCard key={kpi.kpi_code} data={kpi} showPeriodHint />
          ))}
        </div>
      )}

      {/* Workshop view: KPI cards for 1 workshop */}
      {!loading && !error && view === 'workshop' && wsData && (
        <div className="space-y-3">
          <p className="text-[13px] text-[#6e6e73]">
            Hiển thị KPI cho <strong>{workshop}</strong>
            {workshop === 'DMC1' && <span className="ml-1 text-[#d4870c]">(bao gồm DM1 + DM2)</span>}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {wsData.map((kpi) => (
              <KpiCard key={kpi.kpi_code} data={kpi} showPeriodHint />
            ))}
          </div>
        </div>
      )}

      {/* Compare view: matrix table + radar chart */}
      {!loading && !error && view === 'compare' && matrix && (
        <div className="space-y-4">
          {/* Insights */}
          {matrix.rankings && (() => {
            const alerts = WORKSHOPS
              .map((ws) => {
                const r = matrix.rankings[ws]
                if (!r) return null
                const failed = matrix.kpiCodes.filter((c) => matrix.matrix[c]?.values[ws] && !matrix.matrix[c].values[ws].is_achieved && matrix.matrix[c].values[ws].data_count > 0)
                return failed.length >= 3 ? { ws, failed, achieved: r.achieved, total: r.total } : null
              })
              .filter(Boolean)

            return alerts.length > 0 ? (
              <div className="bg-[#fff9e6] border border-[#d4870c]/30 rounded-xl p-3 space-y-1">
                <p className="text-[12px] font-semibold text-[#d4870c]">💡 Cần chú ý:</p>
                {alerts.map((a) => a && (
                  <p key={a.ws} className="text-[12px] text-[#1d1d1f]">
                    • <strong>{a.ws}</strong> cần focus {a.failed.length} KPI: {a.failed.join(', ')}
                  </p>
                ))}
              </div>
            ) : null
          })()}

          <KpiMatrixTable
            kpiCodes={matrix.kpiCodes}
            matrix={matrix.matrix}
            rankings={matrix.rankings}
          />

          {/* Radar chart */}
          {matrix.kpiCodes.length > 2 && (() => {
            const points = WORKSHOPS
              .filter((ws) => matrix.kpiCodes.some((c) => matrix.matrix[c]?.values[ws]?.data_count > 0))
              .map((ws) => ({
                workshop: ws,
                values: matrix.kpiCodes.map((c) => {
                  const v = matrix.matrix[c]?.values[ws]
                  return v ? Math.min(100, v.achievement_pct) : 0
                }),
              }))

            return points.length > 1 ? (
              <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4">
                <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">
                  Radar — % đạt mục tiêu theo xưởng
                </h3>
                <KpiRadarChart
                  kpiCodes={matrix.kpiCodes}
                  kpiNames={matrix.kpiCodes.map((c) => matrix.matrix[c]?.kpi_name ?? c)}
                  workshopPoints={points}
                />
              </div>
            ) : null
          })()}
        </div>
      )}
    </div>
  )
}
