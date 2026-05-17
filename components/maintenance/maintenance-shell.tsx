'use client'

import { BreakdownsTab } from './breakdowns-tab'
import { ScheduleTab } from './schedule-tab'
import { DrawingsTab } from './drawings-tab'
import { SurveysTab } from './surveys-tab'
import { MachinesTab } from './machines-tab'
import type { SessionUser } from '@/types'
import { resolveMaintenanceSub } from '@/modules/navigation/dashboard'

interface Props {
  user: SessionUser
  activeSub: string
  canEdit: boolean
}

export function MaintenanceShell({ user, activeSub, canEdit }: Props) {
  const sub = resolveMaintenanceSub(activeSub)

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      {!canEdit && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
          Bạn chỉ có quyền xem tab này.
        </div>
      )}
      {sub === 'breakdowns' && <BreakdownsTab user={user} canEdit={canEdit} />}
      {sub === 'schedule'   && <ScheduleTab user={user} canEdit={canEdit} />}
      {sub === 'drawings'   && <DrawingsTab user={user} canEdit={canEdit} />}
      {sub === 'surveys'    && <SurveysTab user={user} canEdit={canEdit} />}
      {sub === 'machines'   && <MachinesTab user={user} canEdit={canEdit} />}
    </div>
  )
}
