'use client'

import { OvertimeTab } from './overtime-tab'
import { HRTab } from '@/components/coordination/hr-tab'
import { Findings5sTab } from '@/components/coordination/findings-5s-tab'
import { IsoTab } from '@/components/coordination/iso-tab'
import type { SessionUser } from '@/types'
import { resolveAdministrationSub } from '@/lib/navigation/dashboard'

interface Props {
  user: SessionUser
  activeSub: string
}

export function AdministrationShell({ user, activeSub }: Props) {
  const sub = resolveAdministrationSub(activeSub)

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      {sub === 'overtime' && <OvertimeTab user={user} />}
      {sub === 'hr' && <HRTab user={user} />}
      {sub === 'findings5s' && <Findings5sTab dept="COORDINATION" user={user} />}
      {sub === 'iso' && <IsoTab user={user} />}
    </div>
  )
}
