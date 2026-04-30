'use client'

import { HRTab } from './hr-tab'
import { DeliveryTab } from './delivery-tab'
import { Findings5sTab } from './findings-5s-tab'
import { ReportsTab } from './reports-tab'
import { IsoTab } from './iso-tab'
import { CoordinationPlaceholder } from './coordination-placeholder'
import type { SessionUser } from '@/types'

interface Props {
  activeSub: string
  user: SessionUser
}

export function CoordinationTab({ activeSub, user }: Props) {
  if (activeSub === 'hr')         return <HRTab user={user} />
  if (activeSub === 'delivery')   return <DeliveryTab user={user} />
  if (activeSub === 'findings5s') return <Findings5sTab dept="COORDINATION" user={user} />
  if (activeSub === 'reports')    return <ReportsTab user={user} />
  if (activeSub === 'iso')        return <IsoTab user={user} />
  return <CoordinationPlaceholder sub={activeSub} />
}
