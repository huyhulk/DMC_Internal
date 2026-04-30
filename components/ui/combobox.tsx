'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  allowCreate?: boolean
  disabled?: boolean
  className?: string
}

export function Combobox({
  value, onChange, options, placeholder = 'Chọn hoặc nhập…',
  allowCreate = true, disabled = false, className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  )

  const showCreate = allowCreate && query.trim() && !options.some(
    (o) => o.toLowerCase() === query.toLowerCase()
  )

  function select(v: string) {
    onChange(v)
    setQuery(v)
    setOpen(false)
  }

  function clear() {
    onChange('')
    setQuery('')
  }

  const inputCls = cn(
    'w-full h-9 pl-2 pr-8 rounded-lg text-[12px] font-medium',
    'text-[#1d1d1f] placeholder:text-[#aeaeb2]',
    'bg-white border border-[#d2d2d7]',
    'focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50',
    'disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150',
    className
  )

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className={inputCls}
      />
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        {value && !disabled && (
          <button type="button" onClick={clear} className="text-[#aeaeb2] hover:text-[#6e6e73]">
            <X size={12} />
          </button>
        )}
        <ChevronDown size={12} className={cn('text-[#aeaeb2] transition-transform', open && 'rotate-180')} />
      </div>

      {open && (filtered.length > 0 || showCreate) && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-[#d2d2d7] rounded-xl shadow-lg max-h-48 overflow-y-auto py-1">
          {filtered.map((opt) => (
            <button
              key={opt} type="button"
              onClick={() => select(opt)}
              className={cn(
                'w-full text-left px-3 py-2 text-[12px] hover:bg-[#f2f2f7] transition-colors',
                opt === value && 'bg-dmc-primary/8 text-dmc-primary font-semibold'
              )}
            >
              {opt}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              onClick={() => select(query.trim())}
              className="w-full text-left px-3 py-2 text-[12px] text-dmc-primary hover:bg-dmc-primary/5 border-t border-[#d2d2d7] transition-colors"
            >
              + Tạo mới &quot;{query.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  )
}
