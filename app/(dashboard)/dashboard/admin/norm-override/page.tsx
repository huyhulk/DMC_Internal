import { getSessionUser } from '@/lib/actions/auth'
import { listNormOverridesAction } from '@/lib/actions/norm-override'
import { getFreshNorms } from '@/lib/db/queries'
import { requireTabView } from '@/lib/permissions/server'
import { workshopCode } from '@/lib/utils'
import { NormOverrideTab, type NormProductOption } from '@/components/admin/norm-override-tab'
import { AdminTabs } from '@/components/admin/admin-tabs'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Định mức (override) | DMC Production' }

export default async function NormOverridePage() {
  const user = await requireTabView('admin.norm-override')
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }
  if (user.role !== 'ADMIN') redirect('/dashboard')

  const [{ data, error }, norms] = await Promise.all([
    listNormOverridesAction(),
    getFreshNorms(),
  ])

  const normOptions: NormProductOption[] = [
    ...new Map(
      norms
        .filter((n) => n.products && Number.isFinite(n.norm) && n.norm > 0)
        .map((n) => [`${n.products}|||${n.workshop}`, {
          products: n.products,
          workshop: n.workshop,
          workshopCode: workshopCode(n.workshop),
          norm: n.norm,
        }]),
    ).values(),
  ].sort((a, b) => a.products.localeCompare(b.products, 'vi'))

  return (
    <div className="h-full overflow-hidden bg-[#f5f5f7]">
      <AdminTabs active="norm-override" />
      <div className="h-[calc(100%-57px)] overflow-y-auto">
        <NormOverrideTab initialRows={data} loadError={error} normOptions={normOptions} />
      </div>
    </div>
  )
}
