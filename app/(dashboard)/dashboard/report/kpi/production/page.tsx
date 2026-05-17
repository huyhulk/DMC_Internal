import { ProductionKpiDashboard } from '@/components/kpi/production/ProductionKpiDashboard'
import { requireTabView } from '@/modules/permissions/server'
import { getSessionUser } from '@/modules/auth/actions'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'KPI Sản Xuất | DMC Production' }

export default async function KpiProductionPage() {
  const user = await requireTabView('report')
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }

  return <ProductionKpiDashboard />
}
