'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { OrderStatus, OrderStatusCode, ProgressSummary, ReportMode, WorkshopCode } from '@/lib/reports/report-types'
import { WORKSHOP_COLORS, WORKSHOP_LABEL } from '@/lib/reports/report-types'
import { cn } from '@/lib/utils'

const STATUS_COLOR: Record<OrderStatus['status'], string> = {
  completed:   'bg-[#34c759]/15 text-[#2f9e44] border-[#2f9e44]/20',
  in_progress: 'bg-[#3b82f6]/10 text-[#3b5bdb] border-[#3b5bdb]/20',
  due_soon:    'bg-[#ff9500]/10 text-[#b37700] border-[#ff9500]/20',
  overdue:     'bg-[#ff3b30]/10 text-[#ff3b30] border-[#ff3b30]/20',
}
const STATUS_LABEL: Record<OrderStatus['status'], string> = {
  completed:   'Hoàn thành',
  in_progress: 'Đang SX',
  due_soon:    'Sắp hết hạn',
  overdue:     'Trễ deadline',
}

const PRODUCTION_STATUS_COLOR: Record<string, string> = {
  'Đã giao': 'bg-[#8e8e93]/10 text-[#6e6e73] border-[#8e8e93]/20',
  'Đã SX': 'bg-[#34c759]/15 text-[#2f9e44] border-[#2f9e44]/20',
  'Đang SX': 'bg-[#3b82f6]/10 text-[#3b5bdb] border-[#3b5bdb]/20',
  'Chưa SX': 'bg-[#f2f2f7] text-[#6e6e73] border-[#d2d2d7]',
}

// ── Detail mode ──────────────────────────────────────────────────────────

export function ProgressDetail({ orders, summary }: {
  orders: OrderStatus[]
  summary: ProgressSummary
}) {
  const [activeFilter, setActiveFilter] = useState<OrderStatusCode | null>(null)

  const kpiItems: { label: string; value: number; color: string; activeColor: string; filter: OrderStatusCode | null }[] = [
    { label: 'Tổng LSX',   value: summary.total,     color: 'text-[#1d1d1f]',  activeColor: 'bg-[#1d1d1f]/8 border-[#1d1d1f]/20',   filter: null },
    { label: 'Hoàn thành', value: summary.completed, color: 'text-[#2f9e44]',  activeColor: 'bg-[#34c759]/15 border-[#2f9e44]/30',  filter: 'completed' },
    { label: 'Trễ hạn',    value: summary.overdue,   color: 'text-[#ff3b30]',  activeColor: 'bg-[#ff3b30]/10 border-[#ff3b30]/30',  filter: 'overdue' },
    { label: 'Sắp hạn',    value: summary.dueSoon,   color: 'text-[#b37700]',  activeColor: 'bg-[#ff9500]/10 border-[#ff9500]/30',  filter: 'due_soon' },
  ]

  const visibleOrders = activeFilter
    ? orders.filter((o) => o.status === activeFilter)
    : orders

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-3 bg-[#e5e5ea] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#34c759] rounded-full transition-all"
            style={{ width: `${summary.progressPct.toFixed(1)}%` }}
          />
        </div>
        <span className="text-[15px] font-bold text-[#2f9e44] w-16 text-right">
          {summary.progressPct.toFixed(1)}%
        </span>
      </div>

      {/* KPI filter buttons */}
      <div className="flex gap-2 flex-wrap">
        {kpiItems.map(({ label, value, color, activeColor, filter }) => {
          const isActive = activeFilter === filter
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveFilter(isActive ? null : filter)}
              className={cn(
                'flex flex-col items-center min-w-[72px] px-3 py-2 rounded-xl border transition-all',
                'cursor-pointer select-none active:scale-[0.97]',
                isActive
                  ? cn('shadow-sm', activeColor)
                  : 'bg-[#f2f2f7] border-transparent hover:border-[#d2d2d7]'
              )}
            >
              <span className={cn('text-[20px] font-bold', color)}>{value}</span>
              <span className="text-[11px] text-[#6e6e73]">{label}</span>
            </button>
          )
        })}
      </div>

      {/* Orders table */}
      <div className="overflow-x-auto rounded-xl border border-[#d2d2d7]/60">
        <table className="w-full text-[12px]">
          <thead className="bg-[#f2f2f7]">
            <tr>
              {['Mã LSX', 'Mô tả', 'KH', 'Ngày SX', 'Deadline', 'SL thực / ĐH', 'Trạng thái SX', 'Tiến độ'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[#6e6e73] font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleOrders.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-[#aeaeb2]">Không có dữ liệu</td></tr>
            ) : visibleOrders.map((o) => (
              <tr key={o.pcode} className="border-t border-[#d2d2d7]/40 hover:bg-[#f2f2f7]/60">
                <td className="px-3 py-2 font-mono font-semibold text-[#3b5bdb]">{o.pcode}</td>
                <td className="px-3 py-2 max-w-[200px] truncate">{o.description}</td>
                <td className="px-3 py-2 text-[#6e6e73]">{o.customer}</td>
                <td className="px-3 py-2 whitespace-nowrap">{o.initialdate}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {o.deadlinedate}{o.deadlinetime ? ` ${o.deadlinetime}` : ''}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className={cn('font-medium', o.status === 'completed' ? 'text-[#2f9e44]' : 'text-[#1d1d1f]')}>
                      {(o.totalOutput ?? 0).toLocaleString()}
                      {o.quantity ? `/${o.quantity}` : ''}
                    </span>
                    {o.quantity ? (
                      <span className="text-[10px] text-[#6e6e73]">({o.completionPct ?? 0}%)</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium border', PRODUCTION_STATUS_COLOR[o.productionStatus] ?? PRODUCTION_STATUS_COLOR['Chưa SX'])}>
                    {o.productionStatus || 'Chưa SX'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium border', STATUS_COLOR[o.status])}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Comparison mode ──────────────────────────────────────────────────────

export function ProgressComparison({ summaries }: { summaries: ProgressSummary[] }) {
  const chartData = summaries.map((s) => ({
    name: s.workshop,
    'Tiến độ (%)': Math.round(s.progressPct * 10) / 10,
    fill: WORKSHOP_COLORS[s.workshop as WorkshopCode],
  }))

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 30 }}>
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
          <Tooltip formatter={(v: number) => [`${v}%`, 'Tiến độ']} />
          <Bar dataKey="Tiến độ (%)" radius={4} label={{ position: 'right', formatter: (v: number) => `${v}%`, fontSize: 11 }}>
            {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <table className="w-full text-[12px]">
        <thead className="bg-[#f2f2f7]">
          <tr>
            {['Xưởng', 'Tổng LSX', 'Hoàn thành', 'Trễ hạn', 'Sắp hạn', 'Tiến độ'].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[#6e6e73] font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summaries.map((s) => (
            <tr key={s.workshop} className="border-t border-[#d2d2d7]/40 hover:bg-[#f2f2f7]/60">
              <td className="px-3 py-2 font-semibold" style={{ color: WORKSHOP_COLORS[s.workshop as WorkshopCode] }}>
                {WORKSHOP_LABEL[s.workshop as WorkshopCode] ?? s.workshop}
              </td>
              <td className="px-3 py-2 text-center">{s.total}</td>
              <td className="px-3 py-2 text-center text-[#2f9e44] font-medium">{s.completed}</td>
              <td className="px-3 py-2 text-center text-[#ff3b30] font-medium">{s.overdue}</td>
              <td className="px-3 py-2 text-center text-[#b37700] font-medium">{s.dueSoon}</td>
              <td className="px-3 py-2 text-center font-bold">{s.progressPct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
