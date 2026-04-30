import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTarget } from '@/lib/kpi/format'
import { PERIOD_LABELS } from '@/lib/kpi/constants'
import type { KpiResultRow } from '@/lib/kpi/types'

interface Props {
  row: KpiResultRow
  compact?: boolean
}

export function KpiTargetBadge({ row, compact = false }: Props) {
  const Icon   = row.is_achieved ? CheckCircle2 : row.data_count === 0 ? AlertTriangle : XCircle
  const status = row.is_achieved ? 'Đạt' : row.data_count === 0 ? 'Chưa có dữ liệu' : 'Chưa đạt'
  const title  = row.is_period_match
    ? `Mục tiêu ${formatTarget(row)}`
    : `Mục tiêu chuẩn theo ${PERIOD_LABELS[row.default_period].toLowerCase()}: ${formatTarget(row)}`

  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold',
        row.is_achieved
          ? 'border-[#34c759]/25 bg-[#34c759]/10 text-[#2f9e44]'
          : row.data_count === 0
            ? 'border-[#ff9500]/25 bg-[#ff9500]/10 text-[#b37700]'
            : 'border-[#ff3b30]/25 bg-[#ff3b30]/10 text-[#c92a2a]',
        compact && 'px-1.5 py-0.5'
      )}
    >
      <Icon size={12} strokeWidth={2.4} />
      {!compact && status}
    </span>
  )
}
