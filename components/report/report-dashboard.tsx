'use client'

import { useState, useCallback, useEffect } from 'react'
import { format, subDays } from 'date-fns'
import { Search, BarChart2, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReportMode, WorkshopCode, GroupBy, FilterBy } from '@/lib/reports/report-types'
import { WORKSHOP_CODES, WORKSHOP_LABEL } from '@/lib/reports/report-types'
import { ProgressDetail, ProgressComparison } from './sections/progress-section'
import { OutputSection } from './sections/output-section'
import { QualitySection } from './sections/quality-section'
import { OEEDetail, OEEComparison } from './sections/oee-section'

// ── Types for API response data ───────────────────────────────────────────

type AnyData = Record<string, unknown>

interface SectionState {
  loading: boolean
  data:    AnyData | null
  error:   string | null
}

const INIT: SectionState = { loading: false, data: null, error: null }

const GROUP_BY_OPTS: { value: GroupBy; label: string; requiresShortRange?: boolean }[] = [
  { value: 'hour',  label: 'Giờ',   requiresShortRange: true },
  { value: 'day',   label: 'Ngày' },
  { value: 'week',  label: 'Tuần' },
  { value: 'month', label: 'Tháng' },
  { value: 'year',  label: 'Năm' },
]

const FILTER_BY_OPTS: { value: FilterBy; label: string }[] = [
  { value: 'deadline',       label: 'Theo deadline' },
  { value: 'initialdate',    label: 'Theo ngày SX' },
  { value: 'completed_date', label: 'Đã có SX' },
]

function daysBetween(from: string, to: string) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000)
}

// ── Filter bar ────────────────────────────────────────────────────────────

function FilterBar({
  from, to, groupBy, filterBy,
  onFrom, onTo, onGroupBy, onFilterBy,
  onSearch, loading,
}: {
  from: string; to: string; groupBy: GroupBy; filterBy: FilterBy
  onFrom: (v: string) => void; onTo: (v: string) => void
  onGroupBy: (v: GroupBy) => void; onFilterBy: (v: FilterBy) => void
  onSearch: () => void; loading: boolean
}) {
  const inp = 'h-9 px-3 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/70 text-[13px] text-[#1d1d1f] ' +
              'focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 transition-all'
  const days = daysBetween(from, to)
  const hourBlocked = groupBy === 'hour' && days > 7

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 bg-white rounded-2xl border border-[#d2d2d7]/60 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wide">Từ</label>
        <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className={inp} />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wide">Đến</label>
        <input type="date" value={to} onChange={(e) => onTo(e.target.value)} className={inp} />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wide">Nhóm theo</label>
        <div className="flex gap-[3px] bg-[#f2f2f7] rounded-[10px] p-[3px]">
          {GROUP_BY_OPTS.map((opt) => {
            const disabled = opt.requiresShortRange && days > 7
            return (
              <button key={opt.value} type="button"
                onClick={() => !disabled && onGroupBy(opt.value)}
                disabled={disabled}
                title={disabled ? 'Chọn khoảng ≤ 7 ngày để dùng nhóm theo Giờ' : undefined}
                className={cn('px-3 py-1.5 rounded-[8px] text-[12px] transition-all select-none',
                  disabled
                    ? 'text-[#aeaeb2] cursor-not-allowed'
                    : groupBy === opt.value
                      ? 'bg-white text-dmc-primary font-semibold shadow-sm'
                      : 'font-medium text-[#6e6e73] hover:text-[#1d1d1f]')}>
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wide">Lọc LSX theo</label>
        <select value={filterBy} onChange={(e) => onFilterBy(e.target.value as FilterBy)}
          className={inp + ' pr-8 cursor-pointer'}>
          {FILTER_BY_OPTS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        {hourBlocked && (
          <p className="text-[11px] text-[#ff3b30]">Giờ: chọn khoảng ≤ 7 ngày</p>
        )}
        <button type="button" onClick={onSearch} disabled={loading || hourBlocked}
          className="h-9 px-5 rounded-xl bg-dmc-primary text-white text-[13px] font-semibold
                     flex items-center gap-1.5 transition-all disabled:opacity-50 active:scale-[0.98]
                     shadow-sm shadow-dmc-primary/20 hover:bg-dmc-primary-dark">
          {loading
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Search size={13} strokeWidth={2.5} />}
          <span>{loading ? 'Đang tải…' : 'Xem báo cáo'}</span>
        </button>
      </div>
    </div>
  )
}

// ── Section card wrapper ──────────────────────────────────────────────────

function SectionCard({ title, children, loading, error }: {
  title: string; children: React.ReactNode
  loading: boolean; error: string | null
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#d2d2d7]/50 bg-[#f9f9fb]">
        <p className="text-[14px] font-semibold text-[#1d1d1f]">{title}</p>
      </div>
      <div className="p-4">
        {loading  && <Spinner />}
        {!loading && error   && <ErrorMsg msg={error} />}
        {!loading && !error  && children}
      </div>
    </div>
  )
}

const Spinner = () => (
  <div className="flex justify-center py-12">
    <span className="w-6 h-6 border-2 border-[#d2d2d7] border-t-dmc-primary rounded-full animate-spin" />
  </div>
)

const ErrorMsg = ({ msg }: { msg: string }) => (
  <p className="text-center text-[#ff3b30] text-[13px] py-8">{msg}</p>
)

// ── Main dashboard ────────────────────────────────────────────────────────

export function ReportDashboard() {
  const [mode, setMode]           = useState<ReportMode>('comparison')
  const [workshopId, setWorkshop] = useState<WorkshopCode>('DMC1')
  const [from, setFrom]           = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [to, setTo]               = useState(format(new Date(), 'yyyy-MM-dd'))
  const [groupBy, setGroupBy]     = useState<GroupBy>('day')
  const [filterBy, setFilterBy]   = useState<FilterBy>(() => {
    if (typeof window === 'undefined') return 'deadline'
    return (localStorage.getItem('report_filterBy') as FilterBy) ?? 'deadline'
  })

  const handleFilterBy = (v: FilterBy) => {
    setFilterBy(v)
    localStorage.setItem('report_filterBy', v)
  }

  const [progress, setProgress] = useState<SectionState>(INIT)
  const [output,   setOutput]   = useState<SectionState>(INIT)
  const [quality,  setQuality]  = useState<SectionState>(INIT)
  const [oee,      setOEE]      = useState<SectionState>(INIT)

  const fetchSection = useCallback(async (
    endpoint: string,
    setter: (s: SectionState) => void,
    extraParams: Record<string, string> = {},
  ) => {
    setter({ loading: true, data: null, error: null })
    try {
      const params = new URLSearchParams({
        mode, from, to, groupBy,
        ...(mode === 'detail' ? { workshopId } : {}),
        ...extraParams,
      })
      const res  = await fetch(`/api/reports/${endpoint}?${params}`)
      const json = await res.json() as { success: boolean; data?: AnyData; error?: string }
      if (!json.success) throw new Error(json.error ?? 'Lỗi server')
      setter({ loading: false, data: json.data ?? null, error: null })
    } catch (err) {
      setter({ loading: false, data: null, error: String(err) })
    }
  }, [mode, workshopId, from, to, groupBy])

  const loadAll = useCallback(() => {
    fetchSection('production-progress', setProgress, { filterBy })
    fetchSection('production-output',   setOutput)
    fetchSection('quality-result',      setQuality)
    fetchSection('oee',                 setOEE)
  }, [fetchSection, filterBy])

  // Auto-load on mount
  useEffect(() => { loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const anyLoading = progress.loading || output.loading || quality.loading || oee.loading

  return (
    <div className="h-full overflow-y-auto bg-[#f5f5f7]">
      <div className="p-4 space-y-4">

        {/* ── Mode toggle ── */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMode('comparison')}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border transition-all',
              mode === 'comparison'
                ? 'bg-dmc-primary text-white border-transparent shadow-sm'
                : 'bg-white text-[#6e6e73] border-[#d2d2d7]/70 hover:bg-[#f2f2f7]')}>
            <Layers size={14} />
            So sánh 4 xưởng
          </button>
          <button type="button" onClick={() => setMode('detail')}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border transition-all',
              mode === 'detail'
                ? 'bg-dmc-primary text-white border-transparent shadow-sm'
                : 'bg-white text-[#6e6e73] border-[#d2d2d7]/70 hover:bg-[#f2f2f7]')}>
            <BarChart2 size={14} />
            Chi tiết 1 xưởng
          </button>
        </div>

        {/* ── Workshop selector (detail mode) ── */}
        {mode === 'detail' && (
          <div className="flex gap-2 flex-wrap">
            {WORKSHOP_CODES.map((ws) => (
              <button key={ws} type="button" onClick={() => setWorkshop(ws)}
                className={cn('px-4 py-2 rounded-xl text-[13px] font-medium border transition-all',
                  workshopId === ws
                    ? 'bg-[#1d1d1f] text-white border-transparent'
                    : 'bg-white text-[#6e6e73] border-[#d2d2d7]/70 hover:bg-[#f2f2f7]')}>
                {WORKSHOP_LABEL[ws]}
              </button>
            ))}
          </div>
        )}

        {/* ── Filter bar ── */}
        <FilterBar
          from={from} to={to} groupBy={groupBy} filterBy={filterBy}
          onFrom={setFrom} onTo={setTo} onGroupBy={setGroupBy} onFilterBy={handleFilterBy}
          onSearch={loadAll} loading={anyLoading}
        />

        {/* ── Section 1: Tiến độ sản xuất ── */}
        <SectionCard title="1. Tiến độ sản xuất" loading={progress.loading} error={progress.error}>
          {progress.data && mode === 'detail' && (progress.data as AnyData).orders != null && (
            <ProgressDetail
              orders={(progress.data as { orders: Parameters<typeof ProgressDetail>[0]['orders'] }).orders}
              summary={(progress.data as { summary: Parameters<typeof ProgressDetail>[0]['summary'] }).summary}
            />
          )}
          {progress.data && mode === 'comparison' && (
            <ProgressComparison
              summaries={(progress.data as { summaries: Parameters<typeof ProgressComparison>[0]['summaries'] }).summaries ?? []}
            />
          )}
        </SectionCard>

        {/* ── Section 2: Kết quả sản xuất ── */}
        <SectionCard title="2. Kết quả sản xuất" loading={output.loading} error={output.error}>
          {output.data && (
            <OutputSection
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data={output.data as any}
              mode={mode}
            />
          )}
        </SectionCard>

        {/* ── Section 3: Chất lượng ── */}
        <SectionCard title="3. Kết quả chất lượng" loading={quality.loading} error={quality.error}>
          {quality.data && (
            <QualitySection
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data={quality.data as any}
              mode={mode}
            />
          )}
        </SectionCard>

        {/* ── Section 4: OEE ── */}
        <SectionCard title="4. Hiệu suất tổng thể OEE" loading={oee.loading} error={oee.error}>
          {oee.data && mode === 'detail' && <OEEDetail data={oee.data as Parameters<typeof OEEDetail>[0]['data']} />}
          {oee.data && mode === 'comparison' && <OEEComparison data={oee.data as Parameters<typeof OEEComparison>[0]['data']} />}
        </SectionCard>

      </div>
    </div>
  )
}
