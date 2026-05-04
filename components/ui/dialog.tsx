'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_CLS: Record<NonNullable<Props['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

export function Dialog({ open, onClose, title, children, size = 'md', className }: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={cn(
        'relative w-full bg-white rounded-2xl shadow-2xl',
        'border border-[#d2d2d7]/60',
        'flex flex-col max-h-[90vh]',
        SIZE_CLS[size], className
      )}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#d2d2d7]/50 shrink-0">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
                       text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#f2f2f7]
                       transition-all duration-150"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
