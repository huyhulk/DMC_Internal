'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { PeriodSelector, type PeriodSelectorValue } from '@/components/forms/PeriodSelector'
import { KpiDetailTable } from '@/components/kpi/KpiDetailTable'
import { KpiSummaryStrip } from '@/components/kpi/KpiSummaryStrip'
import { getTodayLocal } from '@/lib/utils'
import type { KpiDepartmentSummary } from '@/lib/kpi/types'

interface ApiResponse<T> { success: boolean; data?: T; error?: string }
interface Payload { departments: KpiDepartmentSummary[] }

const DEPARTMENT_LINK: Record<KpiDepartmentSummary['department'], string> = {
  PRODUCTION:   '/dashboard/report/kpi/production',
  MAINTENANCE:  '/dashboard/report/kpi/maintenance',
  COORDINATION: '/dashboard/report/kpi/coordination',
}

export function MasterKpiDashboard() {
  const [period, setPeriod] = useState<PeriodSelectorValue>(() => ({ periodType: 'monthly', anchorDate: getTodayLocal() }))
  const [payload, setPayload] = useState<Payload>({ departments: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ periodType: period.periodType, anchorDate: period.anchorDate })
      const res  = await fetch(`/api/kpi/summary?${params}`)
      const json = await res.json() as ApiResponse<Payload>
      if (!json.success || !json.data) throw new Error(json.error ?? 'Không tải được master KPI')
      setPayload(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setLoading(false) }
  }, [period])

  useEffect(() => {
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  const allRows = payload.departments.flatMap((d) => d.rows)

  return (
    <div className="h-full overflow-y-auto bg-[#f5f5f7]">
      <div className="space-y-4 p-4">
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide text-dmc-primary">Master KPI Dashboard</p>
              <h1 className="mt-1 text-[22px] font-bold tracking-tight text-[#1d1d1f]">Tổng hợp 19 KPI năm 2026</h1>
              <p className="mt-1 text-[13px] text-[#6e6e73]">Sản xuất, bảo trì và điều phối theo cùng kỳ báo cáo.</p>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <PeriodSelector value={period} onChange={setPeriod} />
              <button
                type="button" onClick={() => void load()} disabled={loading}
                className="flex h-9 items-center justify-center gap-2 rounded-xl bg-dmc-primary px-4 text-[13px] font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Tải lại
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-[#ff3b30]/25 bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#c92a2a]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center rounded-2xl border border-[#d2d2d7]/60 bg-white py-10">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-dmc-primary/30 border-t-dmc-primary" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-3">
              {payload.departments.map((dept) => (
                <div key={dept.department} className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-bold text-dmc-primary">{dept.department}</p>
                      <h2 className="mt-1 text-[17px] font-semibold text-[#1d1d1f]">{dept.label}</h2>
                    </div>
                    <Link
                      href={DEPARTMENT_LINK[dept.department]}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6e6e73] hover:bg-[#f2f2f7] hover:text-dmc-primary"
                    >
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                  <div className="mt-4">
                    <KpiSummaryStrip summary={dept.summary} />
                  </div>
                </div>
              ))}
            </div>
            <KpiDetailTable rows={allRows} />
          </>
        )}
      </div>
    </div>
  )
}
