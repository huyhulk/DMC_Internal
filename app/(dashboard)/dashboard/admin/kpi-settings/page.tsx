import { getSessionUser } from '@/lib/actions/auth'
import { getKpiTargetsAction } from '@/lib/actions/kpi-settings'
import { KpiSettingsTab } from '@/components/admin/kpi-settings-tab'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Cài đặt KPI | DMC Production' }

export default async function KpiSettingsPage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard/production')

  const { data, error } = await getKpiTargetsAction()
  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-red-500">
        Lỗi tải dữ liệu: {error}
      </div>
    )
  }

  return (
    <div className="h-full overflow-hidden">
      <KpiSettingsTab initialRows={data} />
    </div>
  )
}
