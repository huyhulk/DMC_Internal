import { CheckCircle2, CircleAlert, Database, Gauge } from 'lucide-react'
import type { KpiSummary } from '@/lib/kpi/types'

interface Props { summary: KpiSummary }

export function KpiSummaryStrip({ summary }: Props) {
  const items = [
    { label: 'KPI đạt',      value: `${summary.achieved}/${summary.total}`, icon: CheckCircle2, color: 'text-[#2f9e44]' },
    { label: 'KPI chưa đạt', value: summary.failed.toString(),              icon: CircleAlert,  color: 'text-[#c92a2a]' },
    { label: 'Tỷ lệ đạt',    value: `${Math.round(summary.achievementRate)}%`, icon: Gauge,    color: 'text-dmc-primary' },
    { label: 'Điểm dữ liệu', value: summary.dataPoints.toLocaleString('vi-VN'), icon: Database, color: 'text-[#6e6e73]' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2">
            <Icon size={16} className={color} />
            <p className="text-[12px] font-semibold text-[#6e6e73]">{label}</p>
          </div>
          <p className="mt-2 text-[24px] font-bold tracking-tight text-[#1d1d1f]">{value}</p>
        </div>
      ))}
    </div>
  )
}
