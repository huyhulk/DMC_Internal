'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, isValid, parse } from 'date-fns'
import { toast } from 'sonner'
import { AlertCircle, Calculator, Clock, TrendingUp, Users } from 'lucide-react'
import { getHREfficiencyData, type HREfficiencyRow } from '@/lib/actions/hr'
import { getTodayLocal } from '@/lib/utils'
import { HR_DAILY_GROUP_LABELS } from '@/types'

interface Props {
  canEdit: boolean
}

export function HRPerformanceTab({ canEdit: _canEdit }: Props) {
  const today = getTodayLocal()
  const [date, setDate] = useState(today)
  const [rows, setRows] = useState<HREfficiencyRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await getHREfficiencyData(date)
        if (!cancelled) setRows(data)
      } catch (err) {
        if (!cancelled) toast.error(`Lỗi tải hiệu suất nhân sự: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [date])

  const totals = useMemo(() => {
    const productionLaborHours = rows.reduce((sum, row) => sum + row.productionLaborHours, 0)
    const availableLaborHours = rows.reduce((sum, row) => sum + row.availableLaborHours, 0)
    const efficiency = availableLaborHours > 0 ? (productionLaborHours / availableLaborHours) * 100 : null
    return {
      productionLaborHours: Math.round(productionLaborHours * 100) / 100,
      availableLaborHours: Math.round(availableLaborHours * 100) / 100,
      efficiency: efficiency === null ? null : Math.round(efficiency * 100) / 100,
    }
  }, [rows])

  function formatDateLabel(d: string): string {
    try {
      const parsed = parse(d, 'yyyy-MM-dd', new Date())
      return isValid(parsed) ? format(parsed, 'dd/MM/yyyy') : d
    } catch { return d }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#f5f5f7] rounded-2xl border border-[#d2d2d7]/60">
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[#d2d2d7]/60 bg-white rounded-t-2xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Hiệu suất NS</h2>
            <p className="mt-1 text-[12px] text-[#6e6e73]">
              Tổng giờ công sản xuất / (giờ làm việc đã trôi qua từ 07:30 × nhân sự làm việc thực tế)
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[#6e6e73] tracking-[0.02em]">Ngày</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 px-3 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/70 text-[13px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#3b5bdb]/40 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.07em]">
            Báo cáo ngày {formatDateLabel(date)}
          </span>
          <div className="flex-1 h-px bg-[#d2d2d7]/50" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryCard icon={Calculator} label="Giờ công sản xuất" value={totals.productionLaborHours.toLocaleString('vi-VN')} suffix="giờ" tone="blue" />
          <SummaryCard icon={Clock} label="Giờ công khả dụng" value={totals.availableLaborHours.toLocaleString('vi-VN')} suffix="giờ" tone="gray" />
          <SummaryCard icon={TrendingUp} label="Hiệu suất tổng" value={totals.efficiency === null ? '—' : totals.efficiency.toLocaleString('vi-VN')} suffix={totals.efficiency === null ? '' : '%'} tone="green" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-[#3b5bdb]/30 border-t-[#3b5bdb] rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white px-4 py-10 text-center text-[13px] text-[#6e6e73]">
            Không có dữ liệu hiệu suất nhân sự trong phạm vi quyền xem.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {rows.map((row) => (
              <EfficiencyCard key={row.factory} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: typeof Calculator
  label: string
  value: string
  suffix: string
  tone: 'blue' | 'gray' | 'green'
}) {
  const toneClass = {
    blue: 'bg-[#3b5bdb]/10 text-[#3b5bdb] border-[#3b5bdb]/20',
    gray: 'bg-white text-[#1d1d1f] border-[#d2d2d7]/70',
    green: 'bg-[#34c759]/10 text-[#248a3d] border-[#34c759]/20',
  }[tone]

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.06em] font-medium opacity-80">
        <Icon size={14} strokeWidth={2.5} />
        {label}
      </div>
      <div className="mt-2 text-[22px] font-semibold">
        {value}{suffix && <span className="ml-1 text-[13px] font-medium">{suffix}</span>}
      </div>
    </div>
  )
}

function EfficiencyCard({ row }: { row: HREfficiencyRow }) {
  return (
    <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center bg-[#3b5bdb]/10 text-[#3b5bdb] border border-[#3b5bdb]/20 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
          {HR_DAILY_GROUP_LABELS[row.factory]}
        </span>
        <span className="text-[20px] font-semibold text-[#248a3d]">
          {row.efficiency === null ? '—' : `${row.efficiency.toLocaleString('vi-VN')}%`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="Giờ công sản xuất" value={row.productionLaborHours} suffix="giờ" />
        <Metric label="Giờ đã trôi qua" value={row.elapsedHours} suffix="giờ" />
        <Metric label="Nhân sự thực tế" value={row.actualHeadcount} suffix="người" icon={Users} />
        <Metric label="Giờ công khả dụng" value={row.availableLaborHours} suffix="giờ" />
        <Metric label="Điều chuyển đi" value={row.transferredOutHours} suffix="giờ" />
        <Metric label="Điều chuyển đến" value={row.transferredInHours} suffix="giờ" />
      </div>

      {row.warnings.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 space-y-1">
          {row.warnings.slice(0, 4).map((warning) => (
            <div key={warning} className="flex items-start gap-1.5 text-[11px] text-amber-700">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
          {row.warnings.length > 4 && (
            <div className="text-[11px] text-amber-700">+{row.warnings.length - 4} cảnh báo khác</div>
          )}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, suffix, icon: Icon }: { label: string; value: number; suffix: string; icon?: typeof Users }) {
  return (
    <div className="rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/70 px-3 py-2">
      <div className="text-[10px] text-[#6e6e73] uppercase tracking-[0.06em] font-medium">{label}</div>
      <div className="mt-1 flex items-center gap-1.5 text-[16px] font-semibold text-[#1d1d1f]">
        {Icon && <Icon size={14} strokeWidth={2.5} />}
        {value.toLocaleString('vi-VN')}
        <span className="text-[11px] font-medium text-[#6e6e73]">{suffix}</span>
      </div>
    </div>
  )
}
