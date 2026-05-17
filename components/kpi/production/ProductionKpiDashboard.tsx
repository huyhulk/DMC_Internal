'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { PeriodSelector, type PeriodSelectorValue } from '@/components/forms/PeriodSelector'
import { WorkshopSelect } from '@/components/forms/WorkshopSelect'
import { KpiDetailTable } from '@/components/kpi/KpiDetailTable'
import { KpiMetricCard } from '@/components/kpi/KpiMetricCard'
import { KpiSummaryStrip } from '@/components/kpi/KpiSummaryStrip'
import { KpiTrendChart } from '@/components/kpi/KpiTrendChart'
import { KpiBarGroupCompare } from '@/components/kpi/comparison/KpiBarGroupCompare'
import { KpiHeatmapCompare } from '@/components/kpi/comparison/KpiHeatmapCompare'
import { KpiInsightCard } from '@/components/kpi/comparison/KpiInsightCard'
import { KpiMatrixTable } from '@/components/kpi/comparison/KpiMatrixTable'
import { KpiRadarCompare } from '@/components/kpi/comparison/KpiRadarCompare'
import { KpiViewModeToggle, type ProductionKpiViewMode } from '@/components/kpi/comparison/KpiViewModeToggle'
import { getTodayLocal } from '@/lib/utils'
import type { KpiComparisonResponse, KpiResultRow, KpiSummary, KpiTrendPoint, KpiWorkshop } from '@/modules/kpi/types'

interface KpiRowsPayload { rows: KpiResultRow[]; summary: KpiSummary; trends?: Record<string, KpiTrendPoint[]> }
interface ApiResponse<T> { success: boolean; data?: T; error?: string }

const EMPTY_SUMMARY: KpiSummary = { total: 0, achieved: 0, failed: 0, achievementRate: 0, avgAchievement: 0, dataPoints: 0 }

export function ProductionKpiDashboard() {
  const [period, setPeriod]     = useState<PeriodSelectorValue>(() => ({ periodType: 'monthly', anchorDate: getTodayLocal() }))
  const [viewMode, setViewMode] = useState<ProductionKpiViewMode>('workshop')
  const [workshop, setWorkshop] = useState<KpiWorkshop | 'ALL'>('ALL')
  const [rowsData, setRowsData] = useState<KpiRowsPayload>({ rows: [], summary: EMPTY_SUMMARY, trends: {} })
  const [comparison, setComparison] = useState<KpiComparisonResponse | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const query = useMemo(() => {
    const params = new URLSearchParams({ periodType: period.periodType, anchorDate: period.anchorDate })
    if (viewMode === 'workshop') params.set('workshop', workshop)
    return params
  }, [period, viewMode, workshop])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      if (viewMode === 'comparison') {
        const params = new URLSearchParams({ department: 'PRODUCTION', periodType: period.periodType, anchorDate: period.anchorDate })
        const res  = await fetch(`/api/kpi/comparison?${params}`)
        const json = await res.json() as ApiResponse<KpiComparisonResponse>
        if (!json.success || !json.data) throw new Error(json.error ?? 'Không tải được KPI comparison')
        setComparison(json.data)
      } else {
        const res  = await fetch(`/api/kpi/production?${query}`)
        const json = await res.json() as ApiResponse<KpiRowsPayload>
        if (!json.success || !json.data) throw new Error(json.error ?? 'Không tải được KPI sản xuất')
        setRowsData(json.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setLoading(false) }
  }, [period, query, viewMode])

  useEffect(() => {
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  const trendRows = rowsData.rows.slice(0, 3)

  return (
    <div className="h-full overflow-y-auto bg-[#f5f5f7]">
      <div className="space-y-4 p-4">
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide text-dmc-primary">KPI Sản xuất</p>
              <h1 className="mt-1 text-[22px] font-bold tracking-tight text-[#1d1d1f]">SX-01 đến SX-06</h1>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <PeriodSelector value={period} onChange={setPeriod} />
              {viewMode === 'workshop' && <WorkshopSelect value={workshop} onChange={setWorkshop} />}
              <button
                type="button" onClick={() => void load()} disabled={loading}
                className="flex h-9 items-center justify-center gap-2 rounded-xl bg-dmc-primary px-4 text-[13px] font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Tải lại
              </button>
            </div>
          </div>
          <div className="mt-4"><KpiViewModeToggle value={viewMode} onChange={setViewMode} /></div>
        </div>

        {error && (
          <div className="rounded-2xl border border-[#ff3b30]/25 bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#c92a2a]">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center rounded-2xl border border-[#d2d2d7]/60 bg-white py-10">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-dmc-primary/30 border-t-dmc-primary" />
          </div>
        )}

        {!loading && viewMode !== 'comparison' && (
          <>
            <KpiSummaryStrip summary={rowsData.summary} />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rowsData.rows.map((row) => <KpiMetricCard key={row.kpi_code} row={row} />)}
            </div>
            {trendRows.length > 0 && (
              <div className="grid gap-3 xl:grid-cols-3">
                {trendRows.map((row) => (
                  <KpiTrendChart key={row.kpi_code} row={row} points={rowsData.trends?.[row.kpi_code] ?? []} />
                ))}
              </div>
            )}
            <KpiDetailTable rows={rowsData.rows} />
          </>
        )}

        {!loading && viewMode === 'comparison' && comparison && (
          <>
            <KpiInsightCard insights={comparison.insights} />
            <KpiMatrixTable rows={comparison.rows} />
            <div className="grid gap-3 xl:grid-cols-2">
              <KpiRadarCompare rows={comparison.rows} />
              <KpiBarGroupCompare rows={comparison.rows} />
            </div>
            <KpiHeatmapCompare rows={comparison.rows} />
          </>
        )}
      </div>
    </div>
  )
}
