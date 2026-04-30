import { getSessionUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { DefectsTab } from '@/components/production/defects-tab'
import { getUserWorkspaces } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lỗi thành phẩm (SX-01) | DMC Production',
}

export default async function DefectsPage() {
  const user = await getSessionUser()
  if (!user) return null

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role,workspace')
    .eq('id', user.id)
    .single()

  const userWorkspaces = getUserWorkspaces(profile?.workspace ?? '')
  const allowedWorkshops =
    profile?.role === 'ADMIN' || userWorkspaces.length === 0
      ? ['DMC1', 'DMC3', 'DMC4', 'DMC5', 'PKT-SX']
      : userWorkspaces

  return (
    <div className="h-full overflow-auto p-6">
      <DefectsTab user={user} allowedWorkshops={allowedWorkshops} />
    </div>
  )
}
