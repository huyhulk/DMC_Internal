'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AreaChart,
  BarChart,
  DonutChart,
  BarList,
  Card,
  Metric,
  Text,
  Title,
  Badge,
  Grid,
} from '@tremor/react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import { format, subDays } from 'date-fns'
import * as XLSX from 'xlsx'
import { useReportData } from '@/hooks/use-report-data'
import { cn } from '@/lib/utils'
import type { ProductionReportRow } from '@/types'

const colHelper = createColumnHelper<ProductionReportRow>()

const columns = [
  colHelper.accessor('pdate',    { header: 'Ngày SX',    cell: (i) => i.getValue() }),
  colHelper.accessor('pcode',    { header: 'Mã LSX',     cell: (i) => i.getValue() }),
  colHelper.accessor('workshop', { header: 'Xưởng',      cell: (i) => i.getValue() }),
  colHelper.accessor('product',  { header: 'Sản phẩm',   cell: (i) => i.getValue() }),
  colHelper.accessor('poutput',  { header: 'Sản lượng',  cell: (i) => <span className="text-green-400 font-semibold">{i.getValue()}</span> }),
  colHelper.accessor('eoutput',  { header: 'Lỗi',        cell: (i) => <span className="text-red-400">{i.getValue()}</span> }),
  colHelper.accessor('routput',  { header: 'Tái chế',    cell: (i) => <span className="text-yellow-400">{i.getValue()}</span> }),
  colHelper.accessor('realnorm', { header: 'Định mức TT',cell: (i) => i.getValue().toFixed(2) }),
  colHelper.accessor('norm',     { header: 'Định mức',   cell: (i) => i.getValue() }),
  colHelper.accessor('starttime',{ header: 'Bắt đầu',    cell: (i) => i.getValue() }),
  colHelper.accessor('endtime',  { header: 'Kết thúc',   cell: (i) => i.getValue() }),
]

export function ProductionReport() {
  const { state, loadReport, kpis, chartByDate, chartByProduct, chartByWorkshop, normComparisonData } =
    useReportData()

  const today = format(new Date(), 'yyyy-MM-dd')
  const defaultStart = format(subDays(new Date(), 29), 'yyyy-MM-dd')

  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(today)
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])

  useEffect(() => {
    loadReport(defaultStart, today)
  }, [])

  const table = useReactTable({
    data: state.data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const kpi = kpis()
  const dateData = chartByDate()
  const productData = chartByProduct()
  const workshopData = chartByWorkshop()
  const normData = normComparisonData()

  function handleExportCSV() {
    const ws = XLSX.utils.json_to_sheet(state.data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'SanXuat')
    XLSX.writeFile(wb, `BaoCaoSanXuat_${startDate}_${endDate}.xlsx`)
  }

  const workshopDonut = workshopData.map((d) => ({ name: d.workshop, value: d.value }))
  const productBarList = productData.map((d) => ({ name: d.product, value: d.output }))

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-5">
        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-dmc-text-secondary">Từ ngày</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 px-3 rounded-lg bg-dmc-bg-input border border-dmc-border text-dmc-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-dmc-primary/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-dmc-text-secondary">Đến ngày</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 px-3 rounded-lg bg-dmc-bg-input border border-dmc-border text-dmc-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-dmc-primary/50"
            />
          </div>
          <button
            onClick={() => loadReport(startDate, endDate)}
            disabled={state.loading}
            className="h-9 px-5 rounded-lg bg-dmc-primary hover:bg-dmc-primary-dark text-white font-semibold text-sm transition-all disabled:opacity-60 flex items-center gap-2"
          >
            {state.loading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang tải...</>
            ) : '🔍 Xem báo cáo'}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={state.data.length === 0}
            className="h-9 px-5 rounded-lg border border-dmc-border text-dmc-text-secondary hover:text-dmc-text-primary hover:border-dmc-text-muted text-sm transition-all disabled:opacity-40"
          >
            📥 Xuất Excel
          </button>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard title="Tổng sản lượng" value={kpi.totalOutput.toLocaleString()} color="green" icon="✅" />
          <KpiCard title="Tổng lỗi" value={kpi.totalError.toLocaleString()} color="red" icon="❌" />
          <KpiCard title="Tái chế" value={kpi.totalRecycle.toLocaleString()} color="yellow" icon="♻️" />
          <KpiCard title="Tỷ lệ lỗi" value={`${kpi.errorRate}%`} color={Number(kpi.errorRate) > 5 ? 'red' : 'green'} icon="📊" />
          <KpiCard title="ĐM trung bình" value={kpi.avgNorm} color="blue" icon="⚡" />
        </div>

        {/* ── Charts Row 1 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Area chart - by date */}
          <div className="lg:col-span-2 bg-dmc-bg-card border border-dmc-border rounded-xl p-4">
            <h3 className="text-sm font-bold text-dmc-text-primary mb-3">📈 Sản lượng theo ngày</h3>
            <AreaChart
              className="h-52"
              data={dateData}
              index="date"
              categories={['output', 'error', 'recycle']}
              colors={['emerald', 'rose', 'amber']}
              valueFormatter={(n) => n.toLocaleString()}
              showLegend
              showGridLines={false}
              curveType="natural"
              connectNulls
            />
          </div>

          {/* Donut - by workshop */}
          <div className="bg-dmc-bg-card border border-dmc-border rounded-xl p-4">
            <h3 className="text-sm font-bold text-dmc-text-primary mb-3">🏭 Theo xưởng</h3>
            {workshopDonut.length > 0 ? (
              <DonutChart
                className="h-40"
                data={workshopDonut}
                category="value"
                index="name"
                valueFormatter={(n) => n.toLocaleString()}
                colors={['indigo', 'cyan', 'amber', 'emerald', 'rose']}
                showAnimation
              />
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>

        {/* ── Charts Row 2 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bar chart - by product */}
          <div className="bg-dmc-bg-card border border-dmc-border rounded-xl p-4">
            <h3 className="text-sm font-bold text-dmc-text-primary mb-3">📦 Top 10 sản phẩm</h3>
            {productBarList.length > 0 ? (
              <BarList
                data={productBarList}
                className="mt-2"
                valueFormatter={(n: number) => n.toLocaleString()}
                color="indigo"
              />
            ) : (
              <EmptyChart />
            )}
          </div>

          {/* Bar chart - norm comparison */}
          <div className="bg-dmc-bg-card border border-dmc-border rounded-xl p-4">
            <h3 className="text-sm font-bold text-dmc-text-primary mb-3">⚡ So sánh định mức</h3>
            {normData.length > 0 ? (
              <BarChart
                className="h-52"
                data={normData}
                index="product"
                categories={['Định mức', 'Thực tế']}
                colors={['indigo', 'emerald']}
                valueFormatter={(n) => n.toFixed(1)}
                showLegend
                showGridLines={false}
              />
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>

        {/* ── Data Table ── */}
        <div className="bg-dmc-bg-card border border-dmc-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-dmc-border">
            <h3 className="text-sm font-bold text-dmc-text-primary">
              📋 Chi tiết ({table.getRowCount()} dòng)
            </h3>
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Tìm kiếm..."
              className="h-8 w-48 px-3 rounded-lg bg-dmc-bg-input border border-dmc-border text-dmc-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-dmc-primary/50"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-dmc-border bg-dmc-bg-input">
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          'px-3 py-2.5 text-left font-semibold text-dmc-text-secondary whitespace-nowrap',
                          header.column.getCanSort() && 'cursor-pointer hover:text-dmc-text-primary'
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && ' ↑'}
                        {header.column.getIsSorted() === 'desc' && ' ↓'}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-3 py-8 text-center text-dmc-text-muted">
                      Không có dữ liệu
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-dmc-border/50 hover:bg-white/5 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2 whitespace-nowrap text-dmc-text-primary">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  title, value, color, icon,
}: {
  title: string
  value: string
  color: 'green' | 'red' | 'yellow' | 'blue'
  icon: string
}) {
  const colorMap = {
    green:  { text: 'text-green-400',  bg: 'bg-green-900/20',  border: 'border-green-700/30' },
    red:    { text: 'text-red-400',    bg: 'bg-red-900/20',    border: 'border-red-700/30' },
    yellow: { text: 'text-yellow-400', bg: 'bg-yellow-900/20', border: 'border-yellow-700/30' },
    blue:   { text: 'text-blue-400',   bg: 'bg-blue-900/20',   border: 'border-blue-700/30' },
  }
  const c = colorMap[color]
  return (
    <div className={cn('rounded-xl border p-4 space-y-1 transition-transform hover:scale-[1.02]', c.bg, c.border)}>
      <p className="text-xs text-dmc-text-muted">{icon} {title}</p>
      <p className={cn('text-xl font-bold', c.text)}>{value}</p>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-40 flex items-center justify-center text-dmc-text-muted text-sm">
      Chưa có dữ liệu
    </div>
  )
}
