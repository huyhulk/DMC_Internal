'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { VietnameseDatePicker } from '@/components/ui/vietnamese-date-picker'
import { cn, getTodayLocal } from '@/lib/utils'
import type { NormItem, ProductLine } from '@/types'

interface Props {
  index: number
  line: ProductLine
  products: string[]
  normHint: NormItem | null
  disabled?: boolean
  onChange: (field: keyof ProductLine, value: string | number | boolean) => void
}

export function ProductLineCard({ index, line, products, normHint, disabled, onChange }: Props) {
  const normOk = normHint && line.realnorm > 0 && line.realnorm >= normHint.norm

  return (
    <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-4 space-y-3 animate-in
                    shadow-[0_1px_3px_rgba(0,0,0,0.06)]">

      {/* Header badge */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full
                         text-[11px] font-semibold
                         bg-dmc-primary/10 text-dmc-primary border border-dmc-primary/20">
          Sản phẩm #{index + 1}
        </span>

        {/* Norm achievement indicator */}
        {normHint && line.realnorm > 0 && (
          <span className={cn(
            'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
            normOk
              ? 'text-[#2f9e44] bg-[#2f9e44]/10 border-[#2f9e44]/20'
              : 'text-[#b37700] bg-[#ff9500]/10 border-[#ff9500]/20'
          )}>
            {line.realnorm} / {normHint.norm} sp/h
          </span>
        )}
      </div>

      {/* Row 1: Product + Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldGroup label="Sản phẩm">
          <select
            value={line.product}
            onChange={(e) => onChange('product', e.target.value)}
            disabled={disabled || products.length === 0}
            className={selectCls}
          >
            <option value="">— Chọn sản phẩm —</option>
            {products.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </FieldGroup>

        <FieldGroup label="Ngày sản xuất">
          <VietnameseDatePicker
            value={line.pdate || getTodayLocal()}
            onChange={(value) => onChange('pdate', value)}
            disabled={disabled}
            className={inputCls}
          />
        </FieldGroup>
      </div>

      {/* Row 2: Times + Workforce + Outputs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[repeat(2,minmax(0,1.4fr))_repeat(5,minmax(0,1fr))] gap-3">

        <FieldGroup label="Bắt đầu">
          <TimePicker24
            value={line.starttime}
            onChange={(v) => onChange('starttime', v)}
            disabled={disabled}
          />
        </FieldGroup>

        <FieldGroup label="Kết thúc">
          <TimePicker24
            value={line.endtime}
            onChange={(v) => onChange('endtime', v)}
            disabled={disabled}
          />
        </FieldGroup>

        <FieldGroup label="Tăng ca trưa">
          <label className={cn(
            'flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#d2d2d7]/70 bg-[#f2f2f7] px-2',
            'text-[11px] font-semibold text-[#1d1d1f] transition-all duration-150',
            disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-[#34c759]/50'
          )}>
            <input
              type="checkbox"
              checked={line.lunchOvertime}
              disabled={disabled}
              onChange={(e) => onChange('lunchOvertime', e.target.checked)}
              className="h-3.5 w-3.5 rounded border-[#d2d2d7] accent-[#34c759]"
            />
            <span className="leading-tight">Có làm trưa</span>
          </label>
        </FieldGroup>

        {/* Workforce — plain number input */}
        <FieldGroup label="Nhân sự">
          <input
            type="number" value={line.workforce} min={0}
            onChange={(e) => onChange('workforce', Number(e.target.value))}
            className={inputCls}
          />
          {normHint && line.product && (
            <p className="text-[10px] leading-snug text-[#6e6e73]">
              Gợi ý: {normHint.nwforce} người · {normHint.norm} sp/giờ
              {line.realnorm > 0 ? ` · TT ${line.realnorm}` : ''}
            </p>
          )}
        </FieldGroup>

        <FieldGroup label="Sản lượng">
          <input type="number" value={line.poutput || ''} min={0} placeholder="0"
            onChange={(e) => onChange('poutput', Number(e.target.value))}
            className={cn(inputCls, 'text-[#2f9e44] font-semibold')} />
        </FieldGroup>

        <FieldGroup label="Lỗi">
          <input type="number" value={line.eoutput || ''} min={0} placeholder="0"
            onChange={(e) => onChange('eoutput', Number(e.target.value))}
            className={cn(inputCls, 'text-[#ff3b30] font-semibold')} />
        </FieldGroup>

        <FieldGroup label="Tái chế">
          <input type="number" value={line.routput || ''} min={0} placeholder="0"
            onChange={(e) => onChange('routput', Number(e.target.value))}
            className={cn(inputCls, 'text-[#b37700] font-semibold')} />
        </FieldGroup>
      </div>
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-[#6e6e73] tracking-[0.01em]">
        {label}
      </label>
      {children}
    </div>
  )
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINS  = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const WHEEL_ITEM_HEIGHT = 32

function TimePicker24({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const [selH, setSelH] = useState(value ? value.split(':')[0] : '')
  const [selM, setSelM] = useState(value ? value.split(':')[1] : '')

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':')
      setSelH(h ?? '')
      setSelM(m ?? '')
    } else {
      setSelH('')
      setSelM('')
    }
  }, [value])

  function updateTime(h: string, m: string) {
    setSelH(h)
    setSelM(m)
    if (h && m) onChange(`${h}:${m}`)
    else onChange('')
  }

  function handleH(h: string) { updateTime(h, selM) }
  function handleM(m: string) { updateTime(selH, m) }

  return (
    <div className={cn(
      'relative grid grid-cols-[1fr_auto_1fr] items-center gap-1 w-full h-28 px-1.5 rounded-xl',
      'bg-[#f2f2f7] border border-[#d2d2d7]/70 overflow-hidden',
      'focus-within:ring-1 focus-within:ring-[#34c759]/40 focus-within:border-[#34c759]/50',
      disabled && 'opacity-40 cursor-not-allowed'
    )}>
      <div className="pointer-events-none absolute left-2 right-2 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-[#34c759]/10 border border-[#34c759]/35 shadow-[0_0_0_1px_rgba(52,199,89,0.08)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[#f2f2f7] to-[#f2f2f7]/0" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#f2f2f7] to-[#f2f2f7]/0" />

      <WheelColumn
        value={selH}
        values={HOURS}
        emptyLabel="HH"
        ariaLabel="Giờ"
        onChange={handleH}
        disabled={disabled}
      />
      <span className="relative z-10 text-[15px] font-bold text-[#6e6e73] select-none">:</span>
      <WheelColumn
        value={selM}
        values={MINS}
        emptyLabel="MM"
        ariaLabel="Phút"
        onChange={handleM}
        disabled={disabled}
      />
    </div>
  )
}

function WheelColumn({
  value,
  values,
  emptyLabel,
  ariaLabel,
  disabled,
  onChange,
}: {
  value: string
  values: string[]
  emptyLabel: string
  ariaLabel: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const scrollTimer = useRef<number | null>(null)
  const options = useMemo(
    () => [{ value: '', label: emptyLabel }, ...values.map((item) => ({ value: item, label: item }))],
    [emptyLabel, values]
  )
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ top: selectedIndex * WHEEL_ITEM_HEIGHT })
  }, [selectedIndex])

  function commitFromScroll(el: HTMLDivElement) {
    const nextIndex = Math.min(
      options.length - 1,
      Math.max(0, Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT))
    )
    const nextValue = options[nextIndex]?.value ?? ''
    if (nextValue !== value) onChange(nextValue)
  }

  function handleScroll() {
    const el = ref.current
    if (!el || disabled) return
    if (scrollTimer.current !== null) window.clearTimeout(scrollTimer.current)
    scrollTimer.current = window.setTimeout(() => commitFromScroll(el), 80)
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (disabled) return
    event.preventDefault()
    event.currentTarget.scrollBy({
      top: Math.sign(event.deltaY) * WHEEL_ITEM_HEIGHT,
      behavior: 'smooth',
    })
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const direction = event.key === 'ArrowDown' ? 1 : -1
    const nextIndex = Math.min(options.length - 1, Math.max(0, selectedIndex + direction))
    onChange(options[nextIndex]?.value ?? '')
  }

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={disabled ? -1 : 0}
      onScroll={handleScroll}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative z-10 h-24 overflow-y-auto overscroll-contain touch-pan-y scrollbar-none rounded-lg',
        'snap-y snap-mandatory focus:outline-none focus:ring-1 focus:ring-[#34c759]/45',
        disabled ? 'pointer-events-none' : 'cursor-ns-resize'
      )}
    >
      <div style={{ height: WHEEL_ITEM_HEIGHT }} />
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.label}
            type="button"
            role="option"
            aria-selected={selected}
            tabIndex={-1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-8 w-full snap-center rounded-md text-center text-[14px] font-semibold',
              'transition-all duration-150 select-none',
              selected
                ? 'text-[#1d1d1f] scale-105'
                : 'text-[#8e8e93] hover:text-[#2f9e44]'
            )}
          >
            {option.label}
          </button>
        )
      })}
      <div style={{ height: WHEEL_ITEM_HEIGHT }} />
    </div>
  )
}

const inputCls =
  'w-full h-9 px-3 rounded-xl text-[13px] font-medium ' +
  'text-dmc-text-primary placeholder:text-dmc-text-muted ' +
  'bg-[#f2f2f7] border border-[#d2d2d7]/70 ' +
  'focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150'

const selectCls = inputCls + ' cursor-pointer'
