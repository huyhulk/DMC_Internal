import { KpiDepartmentDashboard } from '@/components/kpi/kpi-department-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'KPI Bảo Trì | DMC Production' }

export default function KpiMaintenancePage() {
  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-[20px] font-bold text-[#1d1d1f]">KPI Bảo Trì</h1>
        <p className="text-[13px] text-[#6e6e73] mt-0.5">Bộ phận KT — 7 chỉ số</p>
      </div>
      <KpiDepartmentDashboard department="MAINTENANCE" defaultPeriod="monthly" />
    </div>
  )
}
