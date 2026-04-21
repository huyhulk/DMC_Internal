import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/actions/auth'
import { DashboardShell } from '@/components/layout/dashboard-shell'

// No force-dynamic needed: cookies() inside getSessionUser makes this dynamic automatically

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return <DashboardShell user={user}>{children}</DashboardShell>
}
