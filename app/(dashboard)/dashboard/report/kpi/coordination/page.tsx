import { DepartmentKpiDashboard } from '@/components/kpi/DepartmentKpiDashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'KPI Điều Phối | DMC Production' }

export default function KpiCoordinationPage() {
  return <DepartmentKpiDashboard department="COORDINATION" endpoint="coordination" />
}
