import { getSessionUser } from '@/lib/actions/auth'
import { getKpiTargetsAction } from '@/lib/actions/kpi-settings'
import { canEdit, requireTabView } from '@/lib/permissions/server'
import { KpiSettingsTab } from '@/components/admin/kpi-settings-tab'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Cài đặt KPI | DMC Production' }

const ADMIN_TABS = [
  { key: 'users', label: 'Người dùng', href: '/dashboard/admin' },
  { key: 'permissions', label: 'Phân quyền tab', href: '/dashboard/admin?sub=permissions' },
  { key: 'kpi-settings', label: 'Cài đặt KPI', href: '/dashboard/admin/kpi-settings' },
] as const

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
        <AdminTabs />
        <div className="flex h-[calc(100%-57px)] items-center justify-center text-sm text-red-500">
          Lỗi tải dữ liệu: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-hidden bg-[#f5f5f7]">
      <AdminTabs />
      <div className="h-[calc(100%-57px)] overflow-hidden">
        <KpiSettingsTab initialRows={data} canEdit={canEditKpiSettings} />
      </div>
    </div>
  )
}

function AdminTabs() {
  return (
    <div className="flex h-[57px] shrink-0 items-center gap-2 border-b border-dmc-border bg-white px-5">
      {ADMIN_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            'rounded-xl px-4 py-2 text-sm font-medium transition',
            tab.key === 'kpi-settings'
              ? 'bg-dmc-primary text-white shadow-sm'
              : 'text-dmc-text-muted hover:bg-[#f5f5f7] hover:text-dmc-text-primary'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
