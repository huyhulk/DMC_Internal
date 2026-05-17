import { MasterKpiDashboard } from '@/components/kpi/master/MasterKpiDashboard'
import { requireTabView } from '@/modules/permissions/server'
import { getSessionUser } from '@/modules/auth/actions'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'KPI | DMC Production' }

export default async function KpiIndexPage() {
  const user = await requireTabView('report')
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }

  return <MasterKpiDashboard />
}
