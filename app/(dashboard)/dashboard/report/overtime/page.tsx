import { OvertimeDashboard } from '@/components/kpi/overtime-dashboard'
import { requireTabView } from '@/lib/permissions/server'
import { getSessionUser } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Tăng Ca | DMC Production' }

export default async function OvertimePage() {
  const user = await requireTabView('report')
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-[20px] font-bold text-[#1d1d1f]">Báo Cáo Tăng Ca</h1>
        <p className="text-[13px] text-[#6e6e73] mt-0.5">Thống kê OT theo kỳ và xưởng</p>
      </div>
      <OvertimeDashboard />
    </div>
  )
}
