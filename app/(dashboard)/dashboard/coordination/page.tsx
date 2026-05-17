import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/modules/auth/actions'
import { CoordinationTab } from '@/components/coordination/coordination-tab'
import { resolveCoordinationSub } from '@/modules/navigation/dashboard'
import { canEdit, canView, requireTabView } from '@/modules/permissions/server'
import type { PermissionKey } from '@/modules/permissions/tabs'

export const metadata: Metadata = { title: 'Điều Phối | DMC Production' }

export default async function CoordinationPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string }>
}) {
  const [user, params] = await Promise.all([requireTabView('coordination'), searchParams])
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }

  const activeSub = resolveCoordinationSub(params.sub)
  const permissionKey = `coordination.${activeSub}` as PermissionKey
  if (!await canView(user, permissionKey)) redirect('/dashboard')
  const canEditTab = await canEdit(user, permissionKey)

  return (
    <div className="h-full overflow-hidden">
      <CoordinationTab activeSub={activeSub} user={user} canEdit={canEditTab} />
    </div>
  )
}
