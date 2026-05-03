'use client'

import { BreakdownsTab } from './breakdowns-tab'
import { ScheduleTab } from './schedule-tab'
import { DrawingsTab } from './drawings-tab'
import { SurveysTab } from './surveys-tab'
import { MachinesTab } from './machines-tab'
import type { SessionUser } from '@/types'
import { resolveMaintenanceSub } from '@/lib/navigation/dashboard'

interface Props {
  user: SessionUser
  activeSub: string
}

export function MaintenanceShell({ user, activeSub }: Props) {
  const sub = resolveMaintenanceSub(activeSub)

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      {sub === 'breakdowns' && <BreakdownsTab user={user} />}
      {sub === 'schedule'   && <ScheduleTab user={user} />}
      {sub === 'drawings'   && <DrawingsTab user={user} />}
      {sub === 'surveys'    && <SurveysTab user={user} />}
      {sub === 'machines'   && <MachinesTab user={user} />}
    </div>
  )
}
