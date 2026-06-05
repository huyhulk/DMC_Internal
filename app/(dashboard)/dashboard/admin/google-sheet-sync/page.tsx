import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { AdminTabs } from '@/components/admin/admin-tabs'
import { GoogleSheetSyncTab } from '@/components/admin/google-sheet-sync-tab'
import { getGoogleSheetSyncSetupAction } from '@/lib/actions/google-sheet-sync'
import { canEdit, requireTabView } from '@/lib/permissions/server'

export const metadata: Metadata = { title: 'Đồng bộ Google Sheet | DMC Production' }

export default async function GoogleSheetSyncPage() {
  const user = await requireTabView('admin.google-sheet-sync')
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')

  const result = await getGoogleSheetSyncSetupAction()
  const editable = (await canEdit(user, 'admin.google-sheet-sync')) && user.role === 'ADMIN'

  if (result.error || !result.data) {
    return (
      <div className="flex h-full flex-col bg-[#f7f7f8]">
        <AdminTabs active="google-sheet-sync" />
        <div className="p-6">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
            {result.error ?? 'Không tải được cấu hình đồng bộ Google Sheet.'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[#f7f7f8]">
      <AdminTabs active="google-sheet-sync" />
      <GoogleSheetSyncTab
        initialConfig={result.data.config}
        history={result.data.history}
        canEdit={editable}
      />
    </div>
  )
}
