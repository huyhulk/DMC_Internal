'use client'

import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PERIOD_LABELS, PERIOD_TYPES } from '@/lib/kpi/constants'
import type { PeriodType } from '@/lib/kpi/types'

export interface PeriodSelectorValue {
  periodType: PeriodType
  anchorDate: string
}

interface Props {
  value: PeriodSelectorValue
  onChange: (value: PeriodSelectorValue) => void
  defaultPeriodType?: PeriodType
}

const controlCls =
  'h-9 rounded-xl border border-[#d2d2d7]/70 bg-white px-3 text-[13px] font-medium text-[#1d1d1f] ' +
  'focus:outline-none focus:ring-1 focus:ring-dmc-primary/40'

export function PeriodSelector({ value, onChange }: Props) {
  const year    = Number(value.anchorDate.substring(0, 4)) || new Date().getFullYear()
  const quarter = Math.floor(((Number(value.anchorDate.substring(5, 7)) || 1) - 1) / 3) + 1

  function setPeriodType(periodType: PeriodType) { onChange({ ...value, periodType }) }
  function setAnchorDate(anchorDate: string)     { onChange({ ...value, anchorDate }) }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">Kỳ báo cáo</label>
        <div className="flex gap-[3px] rounded-[10px] bg-[#f2f2f7] p-[3px]">
          {PERIOD_TYPES.map((periodType) => (
            <button
              key={periodType}
              type="button"
              onClick={() => setPeriodType(periodType)}
              className={cn(
                'h-8 px-3 rounded-[8px] text-[12px] font-semibold transition-all',
                value.periodType === periodType
                  ? 'bg-white text-dmc-primary shadow-sm'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              )}
            >
              {PERIOD_LABELS[periodType]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">Mốc tính</label>
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="text-[#6e6e73]" />
          {value.periodType === 'weekly' && (
            <input
              type="week"
              value={dateToIsoWeekValue(value.anchorDate)}
              onChange={(e) => setAnchorDate(isoWeekToDate(e.target.value))}
              className={controlCls}
            />
          )}
          {value.periodType === 'monthly' && (
            <input
              type="month"
              value={value.anchorDate.substring(0, 7)}
              onChange={(e) => setAnchorDate(`${e.target.value}-15`)}
              className={controlCls}
            />
          )}
          {value.periodType === 'quarterly' && (
            <div className="flex gap-2">
              <select
                value={quarter}
                onChange={(e) => setAnchorDate(quarterAnchor(year, Number(e.target.value)))}
                className={controlCls}
              >
                {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
              </select>
              <input
                type="number" min={2020} max={2035} value={year}
                onChange={(e) => setAnchorDate(quarterAnchor(Number(e.target.value), quarter))}
                className={cn(controlCls, 'w-24')}
              />
            </div>
          )}
          {value.periodType === 'yearly' && (
            <input
              type="number" min={2020} max={2035} value={year}
              onChange={(e) => setAnchorDate(`${e.target.value}-07-01`)}
              className={cn(controlCls, 'w-28')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function quarterAnchor(year: number, quarter: number) {
  const month = String((quarter - 1) * 3 + 2).padStart(2, '0')
  return `${year}-${month}-15`
}

function isoWeekToDate(value: string) {
  const match = /^(\d{4})-W(\d{2})$/.exec(value)
  if (!match) return formatDateLocal(new Date())
  const year = Number(match[1]), week = Number(match[2])
  const simple = new Date(year, 0, 1 + (week - 1) * 7)
  const dow = simple.getDay()
  const start = new Date(simple)
  if (dow <= 4) { start.setDate(simple.getDate() - simple.getDay() + 1) }
  else          { start.setDate(simple.getDate() + 8 - simple.getDay()) }
  return formatDateLocal(start)
}

function dateToIsoWeekValue(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  const target = new Date(date.valueOf())
  const dayNr = (date.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const week = 1 + Math.round(
    ((target.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7
  )
  return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function formatDateLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
