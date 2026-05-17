import { DepartmentKpiDashboard } from '@/components/kpi/DepartmentKpiDashboard'
import { requireTabView } from '@/modules/permissions/server'
import { getSessionUser } from '@/modules/auth/actions'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'KPI Điều Phối | DMC Production' }

export default async function KpiCoordinationPage() {
  const user = await requireTabView('report')
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }

  return <DepartmentKpiDashboard department="COORDINATION" endpoint="coordination" />
}
