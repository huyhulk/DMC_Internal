'use client'

import dynamic from 'next/dynamic'
import type { OEEWorkshop, WorkshopCode } from '@/modules/reports/report-types'
import { WORKSHOP_COLORS, WORKSHOP_LABEL } from '@/modules/reports/report-types'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

// Gauge OEE tổng + 3 gauge nhỏ A/P/Q (detail mode)
export function OEEGaugeChart({ data }: { data: OEEWorkshop }) {
  const pct = (v: number) => Math.round(v * 1000) / 10

  const gaugeOption = (value: number, name: string, color: string) => ({
    series: [{
      type: 'gauge',
      radius: '90%',
      progress: { show: true, width: 10 },
      axisLine: { lineStyle: { width: 10 } },
      axisLabel: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      pointer: { show: false },
      detail: {
        valueAnimation: true,
        formatter: '{value}%',
        color: '#1d1d1f',
        fontSize: 18,
        fontWeight: 700,
        offsetCenter: [0, '0%'],
      },
      title: { show: false },
      data: [{ value: pct(value), name, itemStyle: { color } }],
      min: 0,
      max: 100,
    }],
  })

  const oeeOption = gaugeOption(data.OEE, 'OEE', WORKSHOP_COLORS[data.workshop])

  const subGauges = [
    { label: 'A — Hoạt động', value: data.A, color: '#3b82f6' },
    { label: 'P — Hiệu suất',  value: data.P, color: '#f97316' },
    { label: 'Q — Chất lượng', value: data.Q, color: '#10b981' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="w-48 h-48">
          <ReactECharts option={oeeOption} style={{ height: '100%' }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {subGauges.map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <div className="h-28">
              <ReactECharts option={gaugeOption(value, label, color)} style={{ height: '100%' }} />
            </div>
            <p className="text-[11px] text-[#6e6e73] mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// Radar chart so sánh 4 xưởng (comparison mode)
export function OEERadarChart({ workshops }: { workshops: OEEWorkshop[] }) {
  const pct = (v: number) => Math.round(v * 1000) / 10

  const option = {
    legend: {
      data: workshops.map((w) => w.workshop),
      bottom: 0,
      textStyle: { fontSize: 11 },
    },
    radar: {
      indicator: [
        { name: 'OEE',       max: 100 },
        { name: 'A — Hoạt động', max: 100 },
        { name: 'P — Hiệu suất',  max: 100 },
        { name: 'Q — Chất lượng', max: 100 },
      ],
      radius: '60%',
      center: ['50%', '45%'],
    },
    series: [{
      type: 'radar',
      data: workshops.map((w) => ({
        name:  w.workshop,
        value: [pct(w.OEE), pct(w.A), pct(w.P), pct(w.Q)],
        lineStyle:  { color: WORKSHOP_COLORS[w.workshop as WorkshopCode] },
        areaStyle:  { color: WORKSHOP_COLORS[w.workshop as WorkshopCode], opacity: 0.12 },
        itemStyle:  { color: WORKSHOP_COLORS[w.workshop as WorkshopCode] },
        symbol:     'circle',
        symbolSize: 5,
      })),
    }],
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value: number[] }) =>
        `${WORKSHOP_LABEL[params.name as WorkshopCode] ?? params.name}<br/>` +
        ['OEE', 'A', 'P', 'Q'].map((k, i) => `${k}: ${params.value[i]}%`).join('<br/>'),
    },
  }

  return <ReactECharts option={option} style={{ height: 280 }} />
}

// Heatmap tỷ lệ lỗi theo xưởng × thời gian (comparison quality)
export function QualityHeatmap({ cells, workshops, periods }: {
  cells: { workshop: WorkshopCode; period: string; defectRate: number }[]
  workshops: WorkshopCode[]
  periods: string[]
}) {
  const wsIndex = Object.fromEntries(workshops.map((w, i) => [w, i]))
  const ptIndex = Object.fromEntries(periods.map((p, i) => [p, i]))

  const data = cells.map((c) => [ptIndex[c.period] ?? 0, wsIndex[c.workshop] ?? 0, c.defectRate])

  const option = {
    grid: { top: 10, bottom: 60, left: 100, right: 20 },
    xAxis: { type: 'category', data: periods, axisLabel: { rotate: 30, fontSize: 10 } },
    yAxis: { type: 'category', data: workshops.map((w) => WORKSHOP_LABEL[w] ?? w), axisLabel: { fontSize: 11 } },
    visualMap: {
      min: 0, max: 15,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: { color: ['#f0fff4', '#fef3c7', '#fee2e2'] },
      text: ['Cao', 'Thấp'],
      textStyle: { fontSize: 10 },
    },
    series: [{
      type: 'heatmap',
      data,
      label: { show: true, formatter: ({ value }: { value: number[] }) => `${value[2]}%`, fontSize: 10 },
    }],
    tooltip: {
      formatter: ({ value }: { value: number[] }) =>
        `Tỷ lệ lỗi: ${value[2]}%`,
    },
  }

  return <ReactECharts option={option} style={{ height: 200 }} />
}
