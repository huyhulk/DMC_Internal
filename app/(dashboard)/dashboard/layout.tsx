import { redirect } from 'next/navigation'
import { getSessionUser } from '@/modules/auth/actions'
import { getVisiblePermissionKeys, getVisibleTopLevelTabs } from '@/modules/permissions/server'
import { DashboardShell } from '@/components/layout/dashboard-shell'

// No force-dynamic needed: cookies() inside getSessionUser makes this dynamic automatically

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [visibleTabs, visiblePermissionKeys] = await Promise.all([
    getVisibleTopLevelTabs(user.role),
    getVisiblePermissionKeys(user.role),
  ])

  return (
    <DashboardShell user={user} visibleTabs={visibleTabs} visiblePermissionKeys={visiblePermissionKeys}>
      {children}
    </DashboardShell>
  )
}
