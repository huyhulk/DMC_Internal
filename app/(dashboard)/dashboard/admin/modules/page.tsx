import { redirect } from 'next/navigation'
import { requireTabView } from '@/modules/permissions/server'
import { getSessionUser } from '@/modules/auth/actions'
import { getModuleNavConfigs } from '@/modules/config/module-config'
import { ModuleManager } from '@/components/admin/module-manager'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Cài đặt Module | DMC Production' }

export default async function AdminModulesPage() {
  const user = await requireTabView('admin')
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }
  if (user.role !== 'ADMIN') redirect('/dashboard/admin')

  const moduleNavConfigs = await getModuleNavConfigs()

  return (
    <div className="h-full overflow-hidden bg-[#f5f5f7]">
      <div className="h-full overflow-y-auto px-6 py-5">
        <div className="mb-5">
          <h1 className="text-[18px] font-semibold text-[#1d1d1f]">Cài đặt Module</h1>
          <p className="text-[13px] text-[#6e6e73] mt-0.5">
            Bật/tắt module, đổi tên hiển thị, điều chỉnh thứ tự và quản lý sub-tab.
          </p>
        </div>
        <ModuleManager initialConfigs={moduleNavConfigs} />
      </div>
    </div>
  )
}
