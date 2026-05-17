'use client'

import { DeliveryTab } from './delivery-tab'
import { Findings5sTab } from './findings-5s-tab'
import { ReportsTab } from './reports-tab'
import type { SessionUser } from '@/types'
import { resolveCoordinationSub } from '@/modules/navigation/dashboard'

interface Props {
  activeSub: string
  user: SessionUser
  canEdit: boolean
}

export function CoordinationTab({ activeSub, user, canEdit }: Props) {
  const sub = resolveCoordinationSub(activeSub)

  if (sub === 'delivery')   return <DeliveryTab user={user} canEdit={canEdit} />
  if (sub === 'findings5s') return <Findings5sTab dept="COORDINATION" user={user} canEdit={canEdit} />
  return <ReportsTab user={user} canEdit={canEdit} />
}
