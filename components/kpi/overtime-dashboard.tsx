'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { KpiPeriodSelector } from './kpi-period-selector'
import {
  WORKSHOPS, WORKSHOP_COLORS, OT_CATEGORY_LABELS, OT_REASON_LABELS,
  type WorkshopCode, type PeriodType, type OvertimeSummary, type TopOvertimeEmployee,
} from '@/lib/kpi/types'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface OvertimeApiData {
  summary: OvertimeSummary[]
  top_employees: TopOvertimeEmployee[]
  totals: { ot_count: number; total_employees: number; total_hours: number }
}

export function OvertimeDashboard() {
  const today = new Date().toISOString().substring(0, 10)
  const [period, setPeriod] = useState<PeriodType>('monthly')
  const [anchor, setAnchor] = useState(today)
  const [data, setData]     = useState<OvertimeApiData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const res  = await fetch(`/api/kpi/overtime?period=${period}&anchor=${anchor}`)
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data as OvertimeApiData
  }, [period, anchor])

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchData()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu'))
      .finally(() => setLoading(false))
  }, [fetchData])

  const barOption = data ? {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['Lượt OT', 'Tổng giờ'], bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: 8, right: 8, bottom: 32, containLabel: true },
    xAxis: {
      type: 'category',
      data: WORKSHOPS,
      axisLabel: { fontSize: 11, fontWeight: 600 },
    },
    yAxis: [
      { type: 'value', name: 'Lượt', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
      { type: 'value', name: 'Giờ',  nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
    ],
    series: [
      {
        name: 'Lượt OT',
        type: 'bar',
        barMaxWidth: 32,
        data: WORKSHOPS.map((ws) => {
          const s = data.summary.find((x) => x.workshop === ws)
          return { value: s?.ot_count ?? 0, itemStyle: { color: WORKSHOP_COLORS[ws as WorkshopCode] ?? '#999' } }
        }),
      },
      {
        name: 'Tổng giờ',
        type: 'bar',
        yAxisIndex: 1,
        barMaxWidth: 32,
        data: WORKSHOPS.map((ws) => {
          const s = data.summary.find((x) => x.workshop === ws)
          return {
            value: s ? +s.total_hours.toFixed(1) : 0,
            itemStyle: { color: WORKSHOP_COLORS[ws as WorkshopCode] ?? '#999', opacity: 0.45 },
          }
        }),
      },
    ],
  } : null

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4">
        <KpiPeriodSelector period={period} anchor={anchor} onPeriod={setPeriod} onAnchor={setAnchor} />
      </div>

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

      {!loading && !error && data && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Tổng lượt OT',     value: data.totals.ot_count,        unit: 'lượt' },
              { label: 'Tổng nhân viên OT', value: data.totals.total_employees, unit: 'lượt tham gia' },
              { label: 'Tổng giờ OT',       value: +data.totals.total_hours.toFixed(1), unit: 'giờ' },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4 text-center">
                <p className="text-[11px] text-[#6e6e73] mb-1">{item.label}</p>
                <p className="text-[28px] font-bold text-[#1d1d1f] leading-none">{item.value}</p>
                <p className="text-[11px] text-[#aeaeb2] mt-1">{item.unit}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          {barOption && (
            <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4">
              <h3 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">Theo phân xưởng</h3>
              <ReactECharts option={barOption} style={{ height: 220 }} />
            </div>
          )}

          {/* Per-workshop detail */}
          {data.summary.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {WORKSHOPS.map((ws) => {
                const s = data.summary.find((x) => x.workshop === ws)
                if (!s) return (
                  <div key={ws} className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4">
                    <p className="text-[13px] font-bold" style={{ color: WORKSHOP_COLORS[ws as WorkshopCode] }}>{ws}</p>
                    <p className="text-[12px] text-[#aeaeb2] mt-2">Chưa có dữ liệu</p>
                  </div>
                )
                return (
                  <div key={ws} className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[14px] font-bold" style={{ color: WORKSHOP_COLORS[ws as WorkshopCode] }}>{ws}</p>
                      <span className="text-[12px] text-[#6e6e73]">{s.ot_count} lượt</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-center">
                      <div>
                        <p className="text-[20px] font-bold text-[#1d1d1f]">{s.unique_employees}</p>
                        <p className="text-[10px] text-[#aeaeb2]">NV unique</p>
                      </div>
                      <div>
                        <p className="text-[20px] font-bold text-[#1d1d1f]">{s.total_hours.toFixed(0)}h</p>
                        <p className="text-[10px] text-[#aeaeb2]">Tổng giờ</p>
                      </div>
                    </div>
                    {Object.keys(s.by_category).length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-[#f2f2f7]">
                        <p className="text-[10px] font-semibold text-[#aeaeb2] uppercase">Phân loại</p>
                        {Object.entries(s.by_category).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-[11px]">
                            <span className="text-[#6e6e73]">{OT_CATEGORY_LABELS[k] ?? k}</span>
                            <span className="font-semibold text-[#1d1d1f]">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Top employees */}
          {data.top_employees.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-[#d2d2d7]/40">
                <h3 className="text-[13px] font-semibold text-[#1d1d1f]">Top nhân viên OT nhiều nhất</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#f2f2f7]">
                      {['#', 'Họ tên', 'Xưởng', 'Lượt OT', 'Tổng giờ'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-[11px] font-semibold text-[#6e6e73]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_employees.map((emp, i) => (
                      <tr key={i} className={`border-t border-[#d2d2d7]/30 ${i % 2 === 0 ? 'bg-white' : 'bg-[#f9f9fb]'}`}>
                        <td className="px-4 py-2.5 text-[12px] text-[#aeaeb2]">{i + 1}</td>
                        <td className="px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f]">{emp.employee_name}</td>
                        <td className="px-4 py-2.5 text-[12px] font-semibold" style={{ color: WORKSHOP_COLORS[emp.workshop as WorkshopCode] ?? '#6e6e73' }}>{emp.workshop}</td>
                        <td className="px-4 py-2.5 text-[12px] text-[#1d1d1f]">{emp.ot_count}</td>
                        <td className="px-4 py-2.5 text-[12px] text-[#1d1d1f]">{emp.total_hours.toFixed(1)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
