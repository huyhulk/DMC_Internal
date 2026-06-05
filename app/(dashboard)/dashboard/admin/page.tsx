import { getSessionUser } from '@/lib/actions/auth'
import { listRoleTabPermissionsAction } from '@/lib/actions/permissions'
import { canEdit, requireTabView } from '@/lib/permissions/server'
import { redirect } from 'next/navigation'
import { UserManagement } from '@/components/admin/user-management'
import { PermissionMatrixTab } from '@/components/admin/permission-matrix-tab'
import { AdminTabs } from '@/components/admin/admin-tabs'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Hệ Thống | DMC Production' }

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string }>
}) {
  const [user, params] = await Promise.all([requireTabView('admin'), searchParams])
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }
  if (user.role !== 'ADMIN') redirect('/dashboard')

  const activeSub = params.sub === 'permissions' ? 'permissions' : 'users'
  const canEditUsers = await canEdit(user, 'admin.users')

  if (activeSub === 'permissions') {
    const result = await listRoleTabPermissionsAction()
    return (
      <div className="h-full overflow-hidden bg-[#f5f5f7]">
        <AdminTabs active="permissions" />
        {result.error ? (
          <div className="flex h-[calc(100%-57px)] items-center justify-center text-sm text-red-500">
            {result.error}
          </div>
        ) : (
          <div className="h-[calc(100%-57px)] overflow-hidden">
            <PermissionMatrixTab initialRows={result.rows ?? []} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full overflow-hidden bg-[#f5f5f7]">
      <AdminTabs active="users" />
      <div className="h-[calc(100%-57px)] overflow-hidden">
        <UserManagement currentUserId={user.id} canEdit={canEditUsers} />
      </div>
    </div>
  )
}
