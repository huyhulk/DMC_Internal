'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart,
  BarChart,
  DonutChart,
  BarList,
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
import { format, startOfMonth, startOfYear, endOfMonth, parse, getYear } from 'date-fns'
import * as XLSX from 'xlsx'
import { Search, Download } from 'lucide-react'
import { useReportData, type ReportType } from '@/hooks/use-report-data'
import { cn, formatDate, formatMonthDisplay, parseDisplayDate, parseDisplayMonth } from '@/lib/utils'
import type { ProductionReportRow, FactoryKey } from '@/types'
import { WORKSHOP_LABELS } from '@/types'

/* ── Column definitions ──────────────────────────────────────────── */
const colHelper = createColumnHelper<ProductionReportRow>()
const columns = [
  colHelper.accessor('pdate',    { header: 'Ngày SX',     cell: (i) => formatDate(i.getValue()) }),
  colHelper.accessor('pcode',    { header: 'Mã LSX',      cell: (i) => i.getValue() }),
  colHelper.accessor('workshop', { header: 'Xưởng',       cell: (i) => WORKSHOP_LABELS[i.getValue() as FactoryKey] ?? i.getValue() }),
  colHelper.accessor('product',  { header: 'Sản phẩm',    cell: (i) => i.getValue() }),
  colHelper.accessor('poutput',  { header: 'Sản lượng',   cell: (i) => <span className="text-[#2f9e44] font-semibold">{i.getValue()}</span> }),
  colHelper.accessor('eoutput',  { header: 'Lỗi',         cell: (i) => <span className="text-[#ff3b30]">{i.getValue()}</span> }),
  colHelper.accessor('routput',  { header: 'Tái chế',     cell: (i) => <span className="text-[#b37700]">{i.getValue()}</span> }),
  colHelper.accessor('realnorm', { header: 'ĐM thực tế',  cell: (i) => i.getValue().toFixed(2) }),
  colHelper.accessor('norm',     { header: 'ĐM chuẩn',    cell: (i) => i.getValue() }),
  colHelper.accessor('starttime',{ header: 'Bắt đầu',     cell: (i) => i.getValue() }),
  colHelper.accessor('endtime',  { header: 'Kết thúc',    cell: (i) => i.getValue() }),
]

/* ── Report type config ──────────────────────────────────────────── */
const REPORT_TYPES: { code: ReportType; label: string }[] = [
  { code: 'hour',  label: 'Giờ' },
  { code: 'day',   label: 'Ngày' },
  { code: 'month', label: 'Tháng' },
  { code: 'year',  label: 'Năm' },
]

const CHART_TITLE: Record<ReportType, string> = {
  hour:  'Sản lượng theo giờ',
  day:   'Sản lượng theo ngày',
  month: 'Sản lượng theo tháng',
  year:  'Sản lượng theo năm',
}

/* ── Default values per type ─────────────────────────────────────── */
function defaultValues(type: ReportType): { from: string; to: string } {
  const now = new Date()
  switch (type) {
    case 'hour':
      return { from: '07:30', to: format(now, 'HH:mm') }
    case 'day':
      return {
        from: format(startOfMonth(now), 'yyyy-MM-dd'),
        to:   format(now, 'yyyy-MM-dd'),
      }
    case 'month':
      return {
        from: format(startOfYear(now), 'yyyy-MM'),
        to:   format(now, 'yyyy-MM'),
      }
    case 'year':
      return {
        from: String(getYear(now) - 1),
        to:   String(getYear(now)),
      }
  }
}

/* ── Build UTC ISO range from local filter values ────────────────── */
function buildISORange(type: ReportType, from: string, to: string): { startISO: string; endISO: string } {
  const today = format(new Date(), 'yyyy-MM-dd')
  switch (type) {
    case 'hour':
      return {
        startISO: new Date(`${today}T${from}:00`).toISOString(),
        endISO:   new Date(`${today}T${to}:00`).toISOString(),
      }
    case 'day':
      return {
        startISO: new Date(`${from}T00:00:00`).toISOString(),
        endISO:   new Date(`${to}T23:59:59`).toISOString(),
      }
    case 'month': {
      const lastDay = format(endOfMonth(parse(`${to}-01`, 'yyyy-MM-dd', new Date())), 'dd')
      return {
        startISO: new Date(`${from}-01T00:00:00`).toISOString(),
        endISO:   new Date(`${to}-${lastDay}T23:59:59`).toISOString(),
      }
    }
    case 'year':
      return {
        startISO: new Date(`${from}-01-01T00:00:00`).toISOString(),
        endISO:   new Date(`${to}-12-31T23:59:59`).toISOString(),
      }
  }
}

/* ── Shared input style ──────────────────────────────────────────── */
const filterInputCls =
  'h-9 px-3 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/70 ' +
  'text-[13px] font-medium text-[#1d1d1f] ' +
  'focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 ' +
  'transition-all duration-150'

/* ── Main component ──────────────────────────────────────────────── */
export function ProductionReport() {
  const { state, loadReport, kpis, chartByDate, chartByProduct, chartByWorkshop, normComparisonData } =
    useReportData()

  const [reportType, setReportType] = useState<ReportType>('hour')
  const [fromVal,    setFromVal]    = useState(() => defaultValues('hour').from)
  const [toVal,      setToVal]      = useState(() => defaultValues('hour').to)
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting,      setSorting]      = useState<SortingState>([])

  // Auto-load on mount with default hour range
  useEffect(() => {
    const { from, to } = defaultValues('hour')
    const { startISO, endISO } = buildISORange('hour', from, to)
    loadReport('hour', startISO, endISO)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTypeChange(type: ReportType) {
    setReportType(type)
    const { from, to } = defaultValues(type)
    setFromVal(from)
    setToVal(to)
  }

  function handleSearch() {
    const { startISO, endISO } = buildISORange(reportType, fromVal, toVal)
    loadReport(reportType, startISO, endISO)
  }

  function handleExportCSV() {
    const ws = XLSX.utils.json_to_sheet(state.data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'SanXuat')
    const { startISO, endISO } = buildISORange(reportType, fromVal, toVal)
    XLSX.writeFile(wb, `BaoCaoSanXuat_${startISO.substring(0, 10)}_${endISO.substring(0, 10)}.xlsx`)
  }

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

  const kpi         = kpis()
  const dateData    = chartByDate()
  const productData = chartByProduct()
  const workshopData = chartByWorkshop()
  const normData    = normComparisonData()

  const workshopDonut  = workshopData.map((d) => ({ name: d.workshop, value: d.value }))
  const productBarList = productData.map((d) => ({ name: d.product, value: d.output }))

  return (
    <div className="h-full overflow-y-auto bg-[#f5f5f7]">
      <div className="p-4 space-y-4">

        {/* ── Filter Card ── */}
        <div className="rounded-2xl bg-white border border-[#d2d2d7]/60 p-4
                        shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex flex-wrap items-end gap-4">

            {/* Loại báo cáo — segmented control */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-[0.06em]">
                Loại báo cáo
              </label>
              <div className="flex items-center gap-[3px] bg-[#f2f2f7] rounded-[10px] p-[3px]">
                {REPORT_TYPES.map(({ code, label }) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleTypeChange(code)}
                    className={cn(
                      'px-3 py-1.5 rounded-[8px] text-[12px] whitespace-nowrap',
                      'transition-all duration-150 select-none',
                      reportType === code
                        ? 'bg-white text-dmc-primary font-semibold shadow-sm shadow-black/[0.08]'
                        : 'font-medium text-[#6e6e73] hover:text-[#1d1d1f]'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Từ */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-[0.06em]">Từ</label>
              <FilterInput type={reportType} value={fromVal} onChange={setFromVal} />
            </div>

            {/* Đến */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-[0.06em]">Đến</label>
              <FilterInput type={reportType} value={toVal} onChange={setToVal} />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSearch}
                disabled={state.loading}
                className="h-9 px-4 rounded-xl bg-dmc-primary hover:bg-dmc-primary-dark
                           text-white text-[13px] font-semibold
                           flex items-center gap-1.5 transition-all duration-150
                           disabled:opacity-50 active:scale-[0.98]
                           shadow-sm shadow-dmc-primary/20"
              >
                {state.loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Search size={13} strokeWidth={2.5} />}
                <span>{state.loading ? 'Đang tải…' : 'Xem báo cáo'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={state.data.length === 0}
                className="h-9 px-4 rounded-xl border border-[#d2d2d7]/70
                           text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#f2f2f7]
                           text-[13px] font-medium
                           flex items-center gap-1.5 transition-all duration-150
                           disabled:opacity-40 active:scale-[0.98]"
              >
                <Download size={13} strokeWidth={2} />
                <span>Xuất Excel</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard title="Tổng sản lượng" value={kpi.totalOutput.toLocaleString()} variant="green" />
          <KpiCard title="Tổng lỗi"       value={kpi.totalError.toLocaleString()}   variant="red" />
          <KpiCard title="Tái chế"        value={kpi.totalRecycle.toLocaleString()} variant="amber" />
          <KpiCard
            title="Tỷ lệ lỗi"
            value={`${kpi.errorRate}%`}
            variant={Number(kpi.errorRate) > 5 ? 'red' : 'green'}
          />
          <KpiCard title="ĐM trung bình"  value={kpi.avgNorm}                       variant="blue" />
        </div>

        {/* ── Charts Row 1 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white border border-[#d2d2d7]/60 rounded-2xl p-4
                          shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-3">
              {CHART_TITLE[state.reportType]}
            </p>
            {dateData.length > 0 ? (
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
            ) : <EmptyChart />}
          </div>

          <div className="bg-white border border-[#d2d2d7]/60 rounded-2xl p-4
                          shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-3">Theo xưởng</p>
            {workshopDonut.length > 0 ? (
              <DonutChart
                className="h-44"
                data={workshopDonut}
                category="value"
                index="name"
                valueFormatter={(n) => n.toLocaleString()}
                colors={['indigo', 'cyan', 'amber', 'emerald', 'rose']}
                showAnimation
              />
            ) : <EmptyChart />}
          </div>
        </div>

        {/* ── Charts Row 2 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-[#d2d2d7]/60 rounded-2xl p-4
                          shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-3">Top 10 sản phẩm</p>
            {productBarList.length > 0 ? (
              <BarList
                data={productBarList}
                className="mt-2"
                valueFormatter={(n: number) => n.toLocaleString()}
                color="indigo"
              />
            ) : <EmptyChart />}
          </div>

          <div className="bg-white border border-[#d2d2d7]/60 rounded-2xl p-4
                          shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-3">So sánh định mức</p>
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
            ) : <EmptyChart />}
          </div>
        </div>

        {/* ── Data Table ── */}
        <div className="bg-white border border-[#d2d2d7]/60 rounded-2xl overflow-hidden
                        shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between px-4 py-3
                          border-b border-[#d2d2d7]/50">
            <p className="text-[13px] font-semibold text-[#1d1d1f]">
              Chi tiết
              <span className="ml-1.5 text-[11px] font-normal text-[#6e6e73]">
                ({table.getRowCount()} dòng)
              </span>
            </p>
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Tìm kiếm…"
              className="h-8 w-44 px-3 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/70
                         text-[12px] text-[#1d1d1f] placeholder:text-[#aeaeb2]
                         focus:outline-none focus:ring-1 focus:ring-dmc-primary/40
                         focus:border-dmc-primary/50 transition-all"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-[#d2d2d7]/50 bg-[#f2f2f7]">
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          'px-3 py-2.5 text-left font-semibold text-[#6e6e73] whitespace-nowrap',
                          header.column.getCanSort() && 'cursor-pointer hover:text-[#1d1d1f] select-none'
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
                    <td colSpan={columns.length}
                        className="px-3 py-10 text-center text-[#aeaeb2]">
                      {state.loading ? 'Đang tải dữ liệu…' : 'Không có dữ liệu trong khoảng thời gian này'}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[#d2d2d7]/40 last:border-0
                                 hover:bg-[#f2f2f7]/70 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}
                            className="px-3 py-2 whitespace-nowrap text-[#1d1d1f]">
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

/* ── Sub-components ──────────────────────────────────────────────── */

function FilterInput({
  type, value, onChange,
}: {
  type: ReportType
  value: string
  onChange: (v: string) => void
}) {
  if (type === 'hour')
    return (
      <input type="time" value={value}
        onChange={(e) => onChange(e.target.value)}
        className={filterInputCls} />
    )
  if (type === 'day')
    return (
      <DisplayDateInput value={value} onChange={onChange} className={filterInputCls} />
    )
  if (type === 'month')
    return (
      <DisplayMonthInput value={value} onChange={onChange} className={filterInputCls} />
    )
  // year
  return (
    <input type="number" value={value} min={2020} max={2099}
      onChange={(e) => onChange(e.target.value)}
      className={cn(filterInputCls, 'w-24')} />
  )
}

function DisplayDateInput({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const [displayValue, setDisplayValue] = useState(formatDate(value))

  useEffect(() => {
    setDisplayValue(formatDate(value))
  }, [value])

  function commit(nextDisplayValue: string) {
    const parsed = parseDisplayDate(nextDisplayValue)
    if (/^\d{4}-\d{2}-\d{2}$/.test(parsed)) onChange(parsed)
    else setDisplayValue(formatDate(value))
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      placeholder="dd/MM/yyyy"
      onChange={(e) => setDisplayValue(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className={className}
    />
  )
}

function DisplayMonthInput({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const [displayValue, setDisplayValue] = useState(formatMonthDisplay(value))

  useEffect(() => {
    setDisplayValue(formatMonthDisplay(value))
  }, [value])

  function commit(nextDisplayValue: string) {
    const parsed = parseDisplayMonth(nextDisplayValue)
    if (/^\d{4}-\d{2}$/.test(parsed)) onChange(parsed)
    else setDisplayValue(formatMonthDisplay(value))
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      placeholder="MM/yyyy"
      onChange={(e) => setDisplayValue(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className={className}
    />
  )
}

const KPI_VARIANT = {
  green: { text: 'text-[#2f9e44]', bg: 'bg-[#34c759]/8', border: 'border-[#2f9e44]/20' },
  red:   { text: 'text-[#ff3b30]', bg: 'bg-[#ff3b30]/8', border: 'border-[#ff3b30]/20' },
  amber: { text: 'text-[#b37700]', bg: 'bg-[#ff9500]/8', border: 'border-[#ff9500]/20' },
  blue:  { text: 'text-[#3b5bdb]', bg: 'bg-[#3b5bdb]/8', border: 'border-[#3b5bdb]/20' },
} as const

function KpiCard({ title, value, variant }: {
  title: string
  value: string
  variant: keyof typeof KPI_VARIANT
}) {
  const c = KPI_VARIANT[variant]
  return (
    <div className={cn(
      'rounded-2xl border p-4 space-y-1.5 transition-transform hover:scale-[1.01]',
      'shadow-[0_1px_3px_rgba(0,0,0,0.05)]',
      c.bg, c.border
    )}>
      <p className="text-[11px] font-medium text-[#6e6e73]">{title}</p>
      <p className={cn('text-[22px] font-bold tracking-tight', c.text)}>{value}</p>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-44 flex items-center justify-center text-[#aeaeb2] text-[13px]">
      Chưa có dữ liệu
    </div>
  )
}
