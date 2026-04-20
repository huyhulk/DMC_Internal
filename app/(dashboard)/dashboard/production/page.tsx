import { getSessionUser } from '@/lib/actions/auth'
import { ProductionTab } from '@/components/production/production-tab'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Sản Xuất | DMC Production' }

export default async function ProductionPage() {
  const user = await getSessionUser()
  if (!user) return null

  return (
    <div className="h-full overflow-hidden">
      <ProductionTab user={user} />
    </div>
  )
}
