import { getSessionUser } from '@/modules/auth/actions'
import { canEdit, requireTabView } from '@/modules/permissions/server'
import { ProductionTab } from '@/components/production/production-tab'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Sản Xuất | DMC Production' }

export default async function ProductionPage() {
  const user = await requireTabView('production')
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }

  const canEditTab = await canEdit(user, 'production')

  return (
    <div className="h-full overflow-hidden">
      <ProductionTab user={user} canEdit={canEditTab} />
    </div>
  )
}
