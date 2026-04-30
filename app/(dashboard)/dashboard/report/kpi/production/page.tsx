import { ProductionKpiDashboard } from '@/components/kpi/production/ProductionKpiDashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'KPI Sản Xuất | DMC Production' }

export default function KpiProductionPage() {
  return <ProductionKpiDashboard />
}
