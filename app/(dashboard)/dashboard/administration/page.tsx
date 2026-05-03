import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/actions/auth'
import { AdministrationShell } from '@/components/administration/administration-shell'

export const metadata: Metadata = { title: 'Hành Chính Nhân Sự | DMC Production' }

export default async function AdministrationPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string }>
}) {
  const [user, params] = await Promise.all([getSessionUser(), searchParams])
  if (!user) redirect('/login')

  const activeSub = params.sub ?? 'overtime'

  return (
    <div className="h-full overflow-hidden">
      <AdministrationShell user={user} activeSub={activeSub} />
    </div>
  )
}
