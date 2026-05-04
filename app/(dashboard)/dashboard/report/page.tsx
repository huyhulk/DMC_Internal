import { ReportTab } from '@/components/report/report-tab'
import { requireTabView } from '@/lib/permissions/server'
import { getSessionUser } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Báo Cáo | DMC Production' }

export default async function ReportPage() {
  const user = await requireTabView('report')
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }

  return (
    <div className="h-full overflow-hidden">
      <ReportTab />
    </div>
  )
}
