'use client'

import { OvertimeTab } from './overtime-tab'
import { HRTab } from '@/components/coordination/hr-tab'
import { HRPerformanceTab } from './hr-performance-tab'
import { Findings5sTab } from '@/components/coordination/findings-5s-tab'
import { IsoTab } from '@/components/coordination/iso-tab'
import type { SessionUser } from '@/types'
import { resolveAdministrationSub } from '@/lib/navigation/dashboard'

interface Props {
  user: SessionUser
  activeSub: string
  canEdit: boolean
}

export function AdministrationShell({ user, activeSub, canEdit }: Props) {
  const sub = resolveAdministrationSub(activeSub)

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      {!canEdit && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
          Bạn chỉ có quyền xem tab này.
        </div>
      )}
      {sub === 'overtime' && <OvertimeTab user={user} canEdit={canEdit} />}
      {sub === 'hr' && <HRTab user={user} canEdit={canEdit} />}
      {sub === 'hr-performance' && <HRPerformanceTab canEdit={canEdit} />}
      {sub === 'findings5s' && <Findings5sTab dept="COORDINATION" user={user} canEdit={canEdit} />}
      {sub === 'iso' && <IsoTab user={user} canEdit={canEdit} />}
    </div>
  )
}
