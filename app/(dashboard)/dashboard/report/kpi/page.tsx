import { MasterKpiDashboard } from '@/components/kpi/master/MasterKpiDashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'KPI | DMC Production' }

export default function KpiIndexPage() {
  return <MasterKpiDashboard />
}
