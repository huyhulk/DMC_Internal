import { DepartmentKpiDashboard } from '@/components/kpi/DepartmentKpiDashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'KPI Bảo Trì | DMC Production' }

export default function KpiMaintenancePage() {
  return <DepartmentKpiDashboard department="MAINTENANCE" endpoint="maintenance" />
}
