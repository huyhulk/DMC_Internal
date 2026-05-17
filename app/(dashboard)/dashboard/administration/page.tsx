import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/modules/auth/actions'
import { AdministrationShell } from '@/components/administration/administration-shell'
import { resolveAdministrationSub } from '@/modules/navigation/dashboard'
import { canEdit, canView, requireTabView } from '@/modules/permissions/server'
import type { PermissionKey } from '@/modules/permissions/tabs'

export const metadata: Metadata = { title: 'Hành Chính Nhân Sự | DMC Production' }

export default async function AdministrationPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string }>
}) {
  const [user, params] = await Promise.all([requireTabView('administration'), searchParams])
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }

  const activeSub = resolveAdministrationSub(params.sub)
  const permissionKey = `administration.${activeSub}` as PermissionKey
  if (!await canView(user, permissionKey)) redirect('/dashboard')
  const canEditTab = await canEdit(user, permissionKey)

  return (
    <div className="h-full overflow-hidden">
      <AdministrationShell user={user} activeSub={activeSub} canEdit={canEditTab} />
    </div>
  )
}
