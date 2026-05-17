import { redirect } from 'next/navigation'
import { getSessionUser } from '@/modules/auth/actions'
import { getVisibleTopLevelTabs } from '@/modules/permissions/server'

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const visibleTabs = await getVisibleTopLevelTabs(user.role)
  redirect(`/dashboard/${visibleTabs[0] ?? 'production'}`)
}
