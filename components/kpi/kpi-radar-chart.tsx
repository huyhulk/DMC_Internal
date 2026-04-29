'use client'

import dynamic from 'next/dynamic'
import { WORKSHOP_COLORS, WORKSHOPS, type WorkshopCode } from '@/lib/kpi/types'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface WorkshopKpiPoint {
  workshop: string
  values: number[]  // achievement_pct for each KPI code, in order
}

interface Props {
  kpiCodes: string[]
  kpiNames: string[]
  workshopPoints: WorkshopKpiPoint[]
}

export function KpiRadarChart({ kpiCodes, kpiNames, workshopPoints }: Props) {
  if (workshopPoints.length === 0 || kpiCodes.length === 0) return null

  const indicators = kpiCodes.map((_, i) => ({
    name: kpiNames[i] ?? kpiCodes[i],
    max: 100,
  }))

  const option = {
    legend: {
      data: WORKSHOPS.filter((ws) => workshopPoints.some((p) => p.workshop === ws)),
      bottom: 0,
      textStyle: { fontSize: 11 },
    },
    radar: {
      indicator: indicators,
      radius: '58%',
      center: ['50%', '46%'],
      axisName: { fontSize: 11, color: '#6e6e73' },
    },
    series: [{
      type: 'radar',
      data: workshopPoints.map((p) => ({
        name:       p.workshop,
        value:      p.values,
        lineStyle:  { color: WORKSHOP_COLORS[p.workshop as WorkshopCode] ?? '#999', width: 2 },
        areaStyle:  { color: WORKSHOP_COLORS[p.workshop as WorkshopCode] ?? '#999', opacity: 0.10 },
        itemStyle:  { color: WORKSHOP_COLORS[p.workshop as WorkshopCode] ?? '#999' },
        symbol:     'circle',
        symbolSize: 5,
      })),
    }],
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value: number[] }) =>
        `<b>${params.name}</b><br/>` +
        kpiCodes.map((c, i) => `${c}: ${(params.value[i] ?? 0).toFixed(0)}%`).join('<br/>'),
    },
  }

  return <ReactECharts option={option} style={{ height: 300 }} />
}
