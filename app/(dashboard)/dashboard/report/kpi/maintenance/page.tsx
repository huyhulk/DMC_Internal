import { DepartmentKpiDashboard } from '@/components/kpi/DepartmentKpiDashboard'
import { requireTabView } from '@/lib/permissions/server'
import { getSessionUser } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'KPI Bảo Trì | DMC Production' }

export default async function KpiMaintenancePage() {
  const user = await requireTabView('report')
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }

  return <DepartmentKpiDashboard department="MAINTENANCE" endpoint="maintenance" />
}
