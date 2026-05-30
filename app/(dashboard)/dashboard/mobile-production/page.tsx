import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { canEdit, requireTabView } from '@/lib/permissions/server'
import { getSessionUser } from '@/lib/actions/auth'
import { MobileProductionEntry } from '@/components/production/mobile-production-entry'

export const metadata: Metadata = { title: 'Nhập sản xuất Mobile | DMC Production' }

export default async function MobileProductionPage() {
  const user = await requireTabView('production')
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }

  const canEditTab = await canEdit(user, 'production')
  if (!canEditTab) redirect('/dashboard')

  return <MobileProductionEntry user={user} canEdit={canEditTab} />
}
