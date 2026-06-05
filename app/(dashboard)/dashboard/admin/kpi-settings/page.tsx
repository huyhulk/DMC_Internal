import { getSessionUser } from '@/lib/actions/auth'
import { getKpiTargetsAction } from '@/lib/actions/kpi-settings'
import { canEdit, requireTabView } from '@/lib/permissions/server'
import { KpiSettingsTab } from '@/components/admin/kpi-settings-tab'
import { AdminTabs } from '@/components/admin/admin-tabs'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Cài đặt KPI | DMC Production' }

export default async function KpiSettingsPage() {
  const user = await requireTabView('admin.kpi-settings')
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }
  if (user.role !== 'ADMIN') redirect('/dashboard')

  const canEditKpiSettings = await canEdit(user, 'admin.kpi-settings')
  const { data, error } = await getKpiTargetsAction()
  if (error) {
    return (
      <div className="h-full overflow-hidden bg-[#f5f5f7]">
        <AdminTabs active="kpi-settings" />
        <div className="flex h-[calc(100%-57px)] items-center justify-center text-sm text-red-500">
          Lỗi tải dữ liệu: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-hidden bg-[#f5f5f7]">
      <AdminTabs active="kpi-settings" />
      <div className="h-[calc(100%-57px)] overflow-hidden">
        <KpiSettingsTab initialRows={data} canEdit={canEditKpiSettings} />
      </div>
    </div>
  )
}
