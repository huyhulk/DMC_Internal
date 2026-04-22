import type { Metadata } from 'next'
import { getSessionUser } from '@/lib/actions/auth'
import { CoordinationTab } from '@/components/coordination/coordination-tab'

export const metadata: Metadata = { title: 'Phối Hợp | DMC Production' }

export default async function CoordinationPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string }>
}) {
  const [user, params] = await Promise.all([getSessionUser(), searchParams])
  if (!user) return null

  const activeSub = params.sub ?? 'hr'

  return (
    <div className="h-full overflow-hidden">
      <CoordinationTab activeSub={activeSub} user={user} />
    </div>
  )
}
