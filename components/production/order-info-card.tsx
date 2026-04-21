'use client'

import { cn, apiDateToDisplay } from '@/lib/utils'
import type { Order } from '@/types'

interface Props {
  order: Order | null
  className?: string
}

export function OrderInfoCard({ order, className }: Props) {
  if (!order) return null

  // deadlinedate = "2026-04-13", deadlinetime = "11:00" (parsed from TIMESTAMP in DB)
  const deadline = [
    order.deadlinedate ? apiDateToDisplay(order.deadlinedate) : '',
    order.deadlinetime,
  ].filter(Boolean).join(' ')
  const statusColor =
    order.status?.toLowerCase() === 'đã giao'
      ? 'text-green-400 bg-green-900/20 border-green-700/30'
      : order.status?.toLowerCase() === 'đang sx'
      ? 'text-yellow-400 bg-yellow-900/20 border-yellow-700/30'
      : 'text-dmc-text-secondary bg-dmc-bg-input border-dmc-border'

  return (
    <div
      className={cn(
        'rounded-xl border border-dmc-primary/30 bg-dmc-primary/5 p-4 animate-in',
        className
      )}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoItem label="Khách hàng" value={order.customer} icon="🏢" />
        <InfoItem label="Số lượng" value={order.quantity} icon="📦" />
        <InfoItem label="Deadline" value={deadline} icon="⏰" />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-dmc-text-muted">📋 Trạng thái</p>
          <span className={cn('inline-block text-xs font-semibold px-2 py-0.5 rounded border', statusColor)}>
            {order.status || '—'}
          </span>
        </div>
      </div>
      {order.description && (
        <p className="mt-3 text-xs text-dmc-text-secondary border-t border-dmc-border pt-2">
          📝 {order.description}
        </p>
      )}
    </div>
  )
}

function InfoItem({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-dmc-text-muted">
        {icon} {label}
      </p>
      <p className="text-sm font-medium text-dmc-text-primary">{value || '—'}</p>
    </div>
  )
}
