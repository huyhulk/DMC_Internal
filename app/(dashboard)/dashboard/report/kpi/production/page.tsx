import { KpiDepartmentDashboard } from '@/components/kpi/kpi-department-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'KPI Sản Xuất | DMC Production' }

export default function KpiProductionPage() {
  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-[20px] font-bold text-[#1d1d1f]">KPI Sản Xuất</h1>
        <p className="text-[13px] text-[#6e6e73] mt-0.5">Bộ phận SX — 6 chỉ số</p>
      </div>
      <KpiDepartmentDashboard department="PRODUCTION" defaultPeriod="monthly" />
    </div>
  )
}
