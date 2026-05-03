'use client'

import { DeliveryTab } from './delivery-tab'
import { Findings5sTab } from './findings-5s-tab'
import { ReportsTab } from './reports-tab'
import type { SessionUser } from '@/types'
import { resolveCoordinationSub } from '@/lib/navigation/dashboard'

interface Props {
  activeSub: string
  user: SessionUser
}

export function CoordinationTab({ activeSub, user }: Props) {
  const sub = resolveCoordinationSub(activeSub)

  if (sub === 'delivery')   return <DeliveryTab user={user} />
  if (sub === 'findings5s') return <Findings5sTab dept="COORDINATION" user={user} />
  return <ReportsTab user={user} />
}
