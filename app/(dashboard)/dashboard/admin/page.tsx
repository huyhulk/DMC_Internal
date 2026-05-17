import { getSessionUser } from '@/modules/auth/actions'
import { listRoleTabPermissionsAction } from '@/modules/permissions/actions'
import { canEdit, requireTabView } from '@/modules/permissions/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { UserManagement } from '@/components/admin/user-management'
import { PermissionMatrixTab } from '@/components/admin/permission-matrix-tab'
import { cn } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Hệ Thống | DMC Production' }

const ADMIN_TABS = [
  { key: 'users', label: 'Người dùng', href: '/dashboard/admin' },
  { key: 'permissions', label: 'Phân quyền tab', href: '/dashboard/admin?sub=permissions' },
  { key: 'kpi-settings', label: 'Cài đặt KPI', href: '/dashboard/admin/kpi-settings' },
] as const

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

function AdminTabs({ active }: { active: 'users' | 'permissions' | 'kpi-settings' }) {
  return (
    <div className="flex h-[57px] shrink-0 items-center gap-2 border-b border-dmc-border bg-white px-5">
      {ADMIN_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            'rounded-xl px-4 py-2 text-sm font-medium transition',
            active === tab.key
              ? 'bg-dmc-primary text-white shadow-sm'
              : 'text-dmc-text-muted hover:bg-[#f5f5f7] hover:text-dmc-text-primary'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
