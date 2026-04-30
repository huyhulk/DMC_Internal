import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/actions/auth'
import { MaintenanceShell } from '@/components/maintenance/maintenance-shell'

export const metadata: Metadata = { title: 'Bảo Trì | DMC Production' }

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string }>
}) {
  const [user, params] = await Promise.all([getSessionUser(), searchParams])
  if (!user) redirect('/login')

  const activeSub = params.sub ?? 'breakdowns'

  return (
    <div className="h-full overflow-hidden">
      <MaintenanceShell user={user} activeSub={activeSub} />
    </div>
  )
}
