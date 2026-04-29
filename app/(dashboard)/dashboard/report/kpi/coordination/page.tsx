import { KpiDepartmentDashboard } from '@/components/kpi/kpi-department-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'KPI Phối Hợp | DMC Production' }

export default function KpiCoordinationPage() {
  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-[20px] font-bold text-[#1d1d1f]">KPI Phối Hợp</h1>
        <p className="text-[13px] text-[#6e6e73] mt-0.5">Bộ phận KH — 6 chỉ số</p>
      </div>
      <KpiDepartmentDashboard department="COORDINATION" defaultPeriod="monthly" />
    </div>
  )
}
