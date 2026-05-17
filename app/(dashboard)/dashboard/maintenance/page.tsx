import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/modules/auth/actions'
import { canEdit, canView, requireTabView } from '@/modules/permissions/server'
import { MaintenanceShell } from '@/components/maintenance/maintenance-shell'
import { resolveMaintenanceSub } from '@/modules/navigation/dashboard'
import type { PermissionKey } from '@/modules/permissions/tabs'

export const metadata: Metadata = { title: 'Bảo Trì | DMC Production' }

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string }>
}) {
  const [user, params] = await Promise.all([requireTabView('maintenance'), searchParams])
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }

  const activeSub = resolveMaintenanceSub(params.sub)
  const permissionKey = `maintenance.${activeSub}` as PermissionKey
  if (!await canView(user, permissionKey)) redirect('/dashboard')
  const canEditTab = await canEdit(user, permissionKey)

  return (
    <div className="h-full overflow-hidden">
      <MaintenanceShell user={user} activeSub={activeSub} canEdit={canEditTab} />
    </div>
  )
}
