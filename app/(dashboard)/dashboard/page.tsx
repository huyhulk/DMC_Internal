import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/actions/auth'
import { getVisibleTopLevelTabs } from '@/lib/permissions/server'

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const visibleTabs = await getVisibleTopLevelTabs(user.role)
  redirect(`/dashboard/${visibleTabs[0] ?? 'production'}`)
}
