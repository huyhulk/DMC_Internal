'use client'

import { useMemo, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { addMonths, endOfMonth, format, getDay, isSameDay, startOfMonth, subMonths } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, formatDate, formatMonthDisplay, getTodayLocal } from '@/lib/utils'

interface PickerProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const MONTHS = Array.from({ length: 12 }, (_, i) => i)

function parseDateValue(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return new Date()
  return new Date(year, month - 1, day)
}

function toDateValue(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function parseMonthValue(value: string) {
  const [year, month] = value.split('-').map(Number)
  const now = new Date()
  return { year: year || now.getFullYear(), month: month || now.getMonth() + 1 }
}

function toMonthValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function VietnameseDatePicker({ value, onChange, disabled, className }: PickerProps) {
  const selectedDate = useMemo(() => parseDateValue(value), [value])
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(selectedDate)
  const today = useMemo(() => parseDateValue(getTodayLocal()), [])

  const days = useMemo(() => {
    const start = startOfMonth(viewDate)
    const end = endOfMonth(viewDate)
    const leading = (getDay(start) + 6) % 7
    const total = leading + end.getDate()
    return Array.from({ length: Math.ceil(total / 7) * 7 }, (_, index) => {
      const dayNumber = index - leading + 1
      return dayNumber >= 1 && dayNumber <= end.getDate()
        ? new Date(viewDate.getFullYear(), viewDate.getMonth(), dayNumber)
        : null
    })
  }, [viewDate])

  function selectDate(date: Date) {
    onChange(toDateValue(date))
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-[#d2d2d7]/70 bg-[#f2f2f7] px-3 text-left text-[13px] text-[#1d1d1f]',
            'transition-all focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        >
          <span>{formatDate(value) || 'dd/MM/yyyy'}</span>
          <CalendarDays size={14} className="shrink-0 text-[#6e6e73]" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[80] w-[284px] rounded-2xl border border-[#d2d2d7]/70 bg-white p-3 shadow-[0_18px_45px_rgba(0,0,0,0.18)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => setViewDate(subMonths(viewDate, 1))} className={navButtonCls} aria-label="Tháng trước">
              <ChevronLeft size={15} />
            </button>
            <p className="text-[13px] font-semibold text-[#1d1d1f]">Tháng {format(viewDate, 'MM/yyyy')}</p>
            <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} className={navButtonCls} aria-label="Tháng sau">
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#6e6e73]">
            {WEEKDAYS.map((day) => <span key={day} className="py-1">{day}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((day, index) => (
              <div key={day ? toDateValue(day) : `empty-${index}`} className="h-8">
                {day && (
                  <button
                    type="button"
                    onClick={() => selectDate(day)}
                    className={cn(
                      'h-8 w-8 rounded-full text-[12px] font-medium transition-all',
                      isSameDay(day, selectedDate)
                        ? 'bg-dmc-primary text-white shadow-sm'
                        : 'text-[#1d1d1f] hover:bg-[#f2f2f7]',
                      isSameDay(day, today) && !isSameDay(day, selectedDate) && 'ring-1 ring-dmc-primary/40'
                    )}
                  >
                    {day.getDate()}
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setViewDate(today)
              selectDate(today)
            }}
            className="mt-3 h-8 w-full rounded-xl bg-[#f2f2f7] text-[12px] font-semibold text-dmc-primary transition-all hover:bg-[#e5e5ea]"
          >
            Hôm nay
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function VietnameseMonthPicker({ value, onChange, disabled, className }: PickerProps) {
  const selected = useMemo(() => parseMonthValue(value), [value])
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(selected.year)

  function selectMonth(monthIndex: number) {
    onChange(toMonthValue(viewYear, monthIndex + 1))
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-[#d2d2d7]/70 bg-[#f2f2f7] px-3 text-left text-[13px] text-[#1d1d1f]',
            'transition-all focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        >
          <span>{formatMonthDisplay(value) || 'MM/yyyy'}</span>
          <CalendarDays size={14} className="shrink-0 text-[#6e6e73]" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[80] w-[260px] rounded-2xl border border-[#d2d2d7]/70 bg-white p-3 shadow-[0_18px_45px_rgba(0,0,0,0.18)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => setViewYear((year) => year - 1)} className={navButtonCls} aria-label="Năm trước">
              <ChevronLeft size={15} />
            </button>
            <p className="text-[13px] font-semibold text-[#1d1d1f]">Năm {viewYear}</p>
            <button type="button" onClick={() => setViewYear((year) => year + 1)} className={navButtonCls} aria-label="Năm sau">
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((month) => {
              const selectedMonth = selected.year === viewYear && selected.month === month + 1
              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => selectMonth(month)}
                  className={cn(
                    'h-9 rounded-xl text-[12px] font-semibold transition-all',
                    selectedMonth
                      ? 'bg-dmc-primary text-white shadow-sm'
                      : 'bg-[#f2f2f7] text-[#1d1d1f] hover:bg-[#e5e5ea]'
                  )}
                >
                  T{month + 1}
                </button>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

const navButtonCls = 'flex h-8 w-8 items-center justify-center rounded-full text-[#6e6e73] transition-all hover:bg-[#f2f2f7] hover:text-[#1d1d1f]'
