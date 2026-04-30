import { Lightbulb } from 'lucide-react'

interface Props { insights: string[] }

export function KpiInsightCard({ insights }: Props) {
  return (
    <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2">
        <Lightbulb size={16} className="text-[#b37700]" />
        <p className="text-[13px] font-semibold text-[#1d1d1f]">Insight tự động</p>
      </div>
      {insights.length === 0 ? (
        <p className="mt-3 text-[13px] text-[#6e6e73]">Không có xưởng nào fail từ 3 KPI trở lên trong kỳ này.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {insights.map((insight) => (
            <p key={insight} className="rounded-xl bg-[#ff9500]/10 px-3 py-2 text-[13px] font-medium text-[#8a5a00]">
              {insight}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
