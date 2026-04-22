'use client'

import { HRTab } from './hr-tab'
import { CoordinationPlaceholder } from './coordination-placeholder'
import type { SessionUser } from '@/types'

interface Props {
  activeSub: string
  user: SessionUser
}

export function CoordinationTab({ activeSub, user }: Props) {
  if (activeSub === 'hr') return <HRTab user={user} />
  return <CoordinationPlaceholder sub={activeSub} />
}
