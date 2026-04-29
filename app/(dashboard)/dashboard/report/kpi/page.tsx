import Link from 'next/link'
import type { Metadata } from 'next'
import { DEPARTMENTS } from '@/lib/kpi/types'

export const metadata: Metadata = { title: 'KPI | DMC Production' }

const DEPT_HREF: Record<string, string> = {
  PRODUCTION:   '/dashboard/report/kpi/production',
  MAINTENANCE:  '/dashboard/report/kpi/maintenance',
  COORDINATION: '/dashboard/report/kpi/coordination',
}

const DEPT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PRODUCTION:   { bg: '#eff6ff', text: '#3b5bdb', border: '#3b5bdb30' },
  MAINTENANCE:  { bg: '#f0fff4', text: '#2f9e44', border: '#2f9e4430' },
  COORDINATION: { bg: '#fff9e6', text: '#d4870c', border: '#d4870c30' },
}

export default function KpiIndexPage() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#1d1d1f]">Bảng KPI</h1>
          <p className="text-[14px] text-[#6e6e73] mt-1">Chọn bộ phận để xem chi tiết</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {DEPARTMENTS.map((dept) => {
            const colors = DEPT_COLORS[dept.key]
            return (
              <Link
                key={dept.key}
                href={DEPT_HREF[dept.key]}
                className="group block bg-white rounded-2xl border p-5 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                style={{ borderColor: colors.border }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 text-[18px] font-bold"
                  style={{ background: colors.bg, color: colors.text }}
                >
                  {dept.shortLabel}
                </div>
                <p className="text-[15px] font-semibold text-[#1d1d1f]">{dept.label}</p>
                <p className="text-[12px] text-[#6e6e73] mt-1">{dept.kpiCount} chỉ số KPI</p>
                <p
                  className="text-[12px] font-medium mt-3 group-hover:underline"
                  style={{ color: colors.text }}
                >
                  Xem chi tiết →
                </p>
              </Link>
            )
          })}
        </div>

        <div className="bg-[#f2f2f7] rounded-2xl p-4">
          <p className="text-[13px] font-semibold text-[#1d1d1f] mb-1">Hướng dẫn</p>
          <ul className="text-[12px] text-[#6e6e73] space-y-1 list-disc list-inside">
            <li>Chọn kỳ báo cáo: Tuần / Tháng / Quý / Năm</li>
            <li>Thay đổi mốc thời gian để xem kỳ khác</li>
            <li>Chế độ <strong>So sánh</strong> hiển thị matrix tất cả xưởng</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
