'use client'

import { cn, formatDateTimeDisplay } from '@/lib/utils'
import { Calendar, Building2, Package, Clock, Tag } from 'lucide-react'
import type { Order } from '@/types'

interface Props {
  order: Order | null
  className?: string
}

const STATUS_STYLE: Record<string, string> = {
  'đã giao':  'text-[#2f9e44] bg-[#2f9e44]/10 border-[#2f9e44]/20',
  'đang sx':  'text-[#b37700] bg-[#ff9500]/10 border-[#ff9500]/20',
  'đang sản xuất':  'text-[#b37700] bg-[#ff9500]/10 border-[#ff9500]/20',
  'chưa sx':  'text-[#6e6e73] bg-[#f2f2f7] border-[#d2d2d7]',
  'chưa sản xuất':  'text-[#6e6e73] bg-[#f2f2f7] border-[#d2d2d7]',
  'đã sx':    'text-[#1971c2] bg-[#1971c2]/10 border-[#1971c2]/20',
}

export function OrderInfoCard({ order, className }: Props) {
  if (!order) return null

  const deadlineDisplay = formatDateTimeDisplay(order.deadlinedate, order.deadlinetime)

  const statusKey = order.status?.toLowerCase() ?? ''
  const statusStyle = STATUS_STYLE[statusKey] ??
    'text-[#6e6e73] bg-[#6e6e73]/08 border-[#d2d2d7]/60'

  return (
    <div className={cn(
      'rounded-2xl border border-[#d2d2d7]/60 bg-white',
      'shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 animate-in',
      className
    )}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

        <InfoItem
          icon={<Building2 size={12} />}
          label="Khách hàng"
          value={order.customer}
        />

        <InfoItem
          icon={<Package size={12} />}
          label="Số lượng"
          value={order.quantity}
        />

        <InfoItem
          icon={<Calendar size={12} />}
          label="Deadline (giờ/ngày)"
          value={deadlineDisplay}
        />

        {/* Status */}
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-[#6e6e73] flex items-center gap-1">
            <Tag size={11} />
            Trạng thái
          </p>
          <span className={cn(
            'inline-flex items-center text-[11px] font-semibold',
            'px-2 py-0.5 rounded-full border',
            statusStyle
          )}>
            {order.status || '—'}
          </span>
        </div>
      </div>

      {order.description && (
        <p className="mt-3 pt-3 text-[12px] text-[#6e6e73]
                      border-t border-[#d2d2d7]/50 leading-relaxed">
          {order.description}
        </p>
      )}
    </div>
  )
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-[#6e6e73] flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-[13px] font-medium text-[#1d1d1f] leading-snug">
        {value || '—'}
      </p>
    </div>
  )
}
