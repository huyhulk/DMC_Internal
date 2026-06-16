'use client'

import dynamic from 'next/dynamic'
import {
  DEADLINE_URGENCY_BUCKETS,
  getDeadlineUrgencyBucket,
  type DeadlineProductionPlanRow,
  type DeadlineUrgencyBucket,
  type WorkshopDeadlineBucketStat,
} from '@/lib/production/workflow'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

export type DeadlineMetric = 'hours' | 'count' | 'quantity'

export const DEADLINE_METRICS: DeadlineMetric[] = ['hours', 'count', 'quantity']

export const DEADLINE_METRIC_META: Record<DeadlineMetric, { label: string; short: string; unit: string }> = {
  hours:    { label: 'Tổng giờ SX còn lại', short: 'Giờ SX',     unit: 'giờ' },
  count:    { label: 'Số lượng LSX',         short: 'Số LSX',     unit: 'LSX' },
  quantity: { label: 'Sản lượng còn lại',    short: 'Sản lượng',  unit: '' },
}

export const URGENCY_META: Record<DeadlineUrgencyBucket, { label: string; short: string; color: string; chipClass: string }> = {
  overdue: { label: 'Quá hạn',           short: 'Quá hạn',  color: '#ff3b30', chipClass: 'bg-[#ff3b30]/10 text-[#ff3b30] border-[#ff3b30]/20' },
  today:   { label: 'Hôm nay',           short: 'Hôm nay',  color: '#ff9500', chipClass: 'bg-[#ff9500]/10 text-[#b37700] border-[#ff9500]/20' },
  d1_3:    { label: '1–3 ngày',          short: '1–3 ngày', color: '#ffcc00', chipClass: 'bg-[#ffcc00]/15 text-[#8a6d00] border-[#ffcc00]/40' },
  d4_7:    { label: '4–7 ngày',          short: '4–7 ngày', color: '#3b82f6', chipClass: 'bg-[#3b82f6]/10 text-[#3b5bdb] border-[#3b5bdb]/20' },
  later:   { label: 'Sau / chưa có hạn', short: 'Sau',      color: '#8e8e93', chipClass: 'bg-[#8e8e93]/10 text-[#6e6e73] border-[#8e8e93]/20' },
}

export function getBucketMetricValue(stat: WorkshopDeadlineBucketStat, metric: DeadlineMetric): number {
  if (metric === 'hours') return stat.hours
  if (metric === 'count') return stat.count
  return stat.quantity
}

function rowMetricValue(row: DeadlineProductionPlanRow, metric: DeadlineMetric): number {
  if (metric === 'count') return 1
  if (metric === 'hours') return row.estimatedHours ?? 0
  return row.order.remainingQuantity
}

export function formatMetricValue(value: number): string {
  return (Math.round(value * 100) / 100).toLocaleString('vi-VN')
}

function toDayMonth(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return match ? `${match[3]}/${match[2]}` : iso
}

// Donut nhỏ trong thẻ xưởng: phân bố chỉ số đang chọn theo 5 nhóm độ khẩn.
export function WorkshopDeadlineDonut({
  buckets,
  metric,
  size = 104,
}: {
  buckets: Record<DeadlineUrgencyBucket, WorkshopDeadlineBucketStat>
  metric: DeadlineMetric
  size?: number
}) {
  const data = DEADLINE_URGENCY_BUCKETS
    .map((bucket) => ({
      name: URGENCY_META[bucket].label,
      value: Math.round(getBucketMetricValue(buckets[bucket], metric) * 100) / 100,
      itemStyle: { color: URGENCY_META[bucket].color },
    }))
    .filter((item) => item.value > 0)

  const total = data.reduce((sum, item) => sum + item.value, 0)

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value: number; percent: number }) =>
        `${params.name}<br/><b>${formatMetricValue(params.value)}</b> (${params.percent}%)`,
    },
    series: [{
      type: 'pie',
      radius: ['60%', '92%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      label: { show: false },
      labelLine: { show: false },
      emphasis: { scale: true, scaleSize: 4 },
      data,
    }],
  }

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {total > 0 ? (
        <ReactECharts option={option} style={{ width: '100%', height: '100%' }} />
      ) : (
        <div className="w-full h-full rounded-full border-[7px] border-[#f2f2f7]" />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[15px] font-bold text-[#1d1d1f] leading-none">{formatMetricValue(total)}</span>
        <span className="text-[9px] font-medium text-[#aeaeb2] uppercase tracking-wide mt-0.5">
          {DEADLINE_METRIC_META[metric].short}
        </span>
      </div>
    </div>
  )
}

// Biểu đồ cột theo NGÀY giao: gộp "Quá hạn" + từng ngày tới + "Chưa có hạn",
// màu cột theo nhóm độ khẩn, giá trị theo chỉ số đang chọn.
export function DeadlineTimelineChart({
  rows,
  metric,
  todayISO,
}: {
  rows: DeadlineProductionPlanRow[]
  metric: DeadlineMetric
  todayISO: string
}) {
  const map = new Map<string, { label: string; sortKey: string; value: number; color: string }>()

  for (const row of rows) {
    const bucket = getDeadlineUrgencyBucket(row.order.deadlinedate, todayISO)
    const value = rowMetricValue(row, metric)

    let key: string
    let label: string
    let sortKey: string
    let color: string
    if (bucket === 'overdue') {
      key = '__overdue'; label = 'Quá hạn'; sortKey = '0000-00-00'; color = URGENCY_META.overdue.color
    } else if (!row.order.deadlinedate) {
      key = '__none'; label = 'Chưa có hạn'; sortKey = '9999-99-99'; color = URGENCY_META.later.color
    } else {
      key = row.order.deadlinedate
      label = toDayMonth(row.order.deadlinedate)
      sortKey = row.order.deadlinedate
      color = URGENCY_META[bucket].color
    }

    const entry = map.get(key) ?? { label, sortKey, value: 0, color }
    entry.value += value
    map.set(key, entry)
  }

  // So sánh chuỗi thuần (code-unit) để thứ tự ổn định: quá hạn -> ngày tăng dần -> chưa có hạn.
  const bars = [...map.values()].sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))

  if (bars.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-[12px] text-[#aeaeb2]">
        Không có dữ liệu hạn giao
      </div>
    )
  }

  const option = {
    grid: { top: 24, bottom: bars.length > 8 ? 44 : 28, left: 48, right: 14 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ name: string; value: number }>) => {
        const point = params[0]
        return `${point.name}<br/><b>${formatMetricValue(point.value)}</b> ${DEADLINE_METRIC_META[metric].unit}`.trim()
      },
    },
    xAxis: {
      type: 'category',
      data: bars.map((bar) => bar.label),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#d2d2d7' } },
      axisLabel: { fontSize: 10, color: '#6e6e73', interval: 0, rotate: bars.length > 8 ? 38 : 0 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, color: '#aeaeb2' },
      splitLine: { lineStyle: { color: '#f2f2f7' } },
    },
    series: [{
      type: 'bar',
      barMaxWidth: 40,
      data: bars.map((bar) => ({
        value: Math.round(bar.value * 100) / 100,
        itemStyle: { color: bar.color, borderRadius: [4, 4, 0, 0] },
      })),
      label: {
        show: true,
        position: 'top',
        fontSize: 10,
        color: '#6e6e73',
        formatter: (params: { value: number }) => formatMetricValue(params.value),
      },
    }],
  }

  return <ReactECharts option={option} style={{ height: 240 }} />
}
