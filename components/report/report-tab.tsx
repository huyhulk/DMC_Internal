'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ReportDashboard } from './report-dashboard'
import { TrendingUp, Wrench, Users2, ShieldCheck, Construction } from 'lucide-react'

const REPORT_ITEMS = [
  { code: 'production',   label: 'Sản Xuất',           icon: TrendingUp },
  { code: 'maintenance',  label: 'Bảo Trì',            icon: Wrench },
  { code: 'coordination', label: 'Điều Phối',          icon: Users2 },
  { code: 'hr_hse',       label: 'Nhân Sự & An Toàn',  icon: ShieldCheck },
]

function ReportTabInner() {
  const searchParams = useSearchParams()
  const activeSub = searchParams.get('sub') ?? 'production'

  return (
    <div className="h-full overflow-hidden bg-[#f5f5f7]">
      {activeSub === 'production' && <ReportDashboard />}
      {activeSub !== 'production' && (
        <PlaceholderReport
          code={activeSub}
          label={REPORT_ITEMS.find((m) => m.code === activeSub)?.label ?? activeSub}
        />
      )}
    </div>
  )
}

export function ReportTab() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ReportTabInner />
    </Suspense>
  )
}

function PlaceholderReport({ code, label }: { code: string; label: string }) {
  const item = REPORT_ITEMS.find((m) => m.code === code)
  const Icon = item?.icon ?? Construction

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-[#aeaeb2]">
      <div className="w-16 h-16 rounded-[20px] bg-white border border-[#d2d2d7]/60
                      flex items-center justify-center shadow-apple-sm">
        <Icon size={28} className="text-[#d2d2d7]" strokeWidth={1.5} />
      </div>
      <div className="text-center space-y-1">
        <p className="text-[15px] font-semibold text-[#1d1d1f]">{label}</p>
        <p className="text-[13px] text-[#6e6e73]">Đang được phát triển…</p>
      </div>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="h-full p-4 space-y-4 bg-[#f5f5f7] animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white border border-[#d2d2d7]/60" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-white border border-[#d2d2d7]/60" />
    </div>
  )
}
