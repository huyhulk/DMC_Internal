import { getSessionUser } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import { UserManagement } from '@/components/admin/user-management'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Hệ Thống | DMC Production' }

export default async function AdminPage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard/production')
  return (
    <div className="h-full overflow-hidden">
      <UserManagement currentUserId={user.id} />
    </div>
  )
}
