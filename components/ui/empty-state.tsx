'use client'

import { cn } from '@/lib/utils'

interface Props {
  icon?: string
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon = '📭', title, subtitle, action, className }: Props) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-16 text-center',
      className
    )}>
      <span className="text-4xl mb-3">{icon}</span>
      <p className="text-[15px] font-semibold text-[#1d1d1f]">{title}</p>
      {subtitle && <p className="text-[13px] text-[#6e6e73] mt-1 max-w-xs">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
