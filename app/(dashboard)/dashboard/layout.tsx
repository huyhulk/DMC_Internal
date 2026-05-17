import { redirect } from 'next/navigation'
import { getSessionUser } from '@/modules/auth/actions'
import { getVisiblePermissionKeys, getVisibleTopLevelTabs } from '@/modules/permissions/server'
import { getModuleNavConfigs } from '@/modules/config/module-config'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import type { TabId } from '@/types'

// No force-dynamic needed: cookies() inside getSessionUser makes this dynamic automatically

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [visibleTabsByRole, visiblePermissionKeys, moduleNavConfigs] = await Promise.all([
    getVisibleTopLevelTabs(user.role),
    getVisiblePermissionKeys(user.role),
    getModuleNavConfigs(),
  ])

  // Tab must be both permitted by role AND not disabled in module_configs.
  // If a module_key has no DB entry (not yet seeded), allow it through by default.
  const visibleTabs = visibleTabsByRole.filter((tabKey) => {
    if (tabKey === 'admin') return true  // admin tab is never hidden for ADMIN role
    const cfg = moduleNavConfigs.find((m) => m.module_key === tabKey)
    return cfg === undefined || cfg.is_enabled
  }) as TabId[]

  return (
    <DashboardShell
      user={user}
      visibleTabs={visibleTabs}
      visiblePermissionKeys={visiblePermissionKeys}
      moduleNavConfigs={moduleNavConfigs}
    >
      {children}
    </DashboardShell>
  )
}
