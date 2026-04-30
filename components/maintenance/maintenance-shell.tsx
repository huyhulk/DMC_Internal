'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BreakdownsTab } from './breakdowns-tab'
import { ScheduleTab } from './schedule-tab'
import { DrawingsTab } from './drawings-tab'
import { SurveysTab } from './surveys-tab'
import type { SessionUser } from '@/types'

type MaintenanceSub = 'breakdowns' | 'schedule' | 'drawings' | 'surveys'

const TABS: { key: MaintenanceSub; label: string }[] = [
  { key: 'breakdowns', label: 'Sự cố máy' },
  { key: 'schedule',   label: 'Lịch BT' },
  { key: 'drawings',   label: 'Bản vẽ' },
  { key: 'surveys',    label: 'Khảo sát' },
]

interface Props {
  user: SessionUser
  activeSub: string
}

export function MaintenanceShell({ user, activeSub }: Props) {
  const router = useRouter()
  const sub = (TABS.some((t) => t.key === activeSub) ? activeSub : 'breakdowns') as MaintenanceSub

  function goTo(key: MaintenanceSub) {
    router.push(`/dashboard/maintenance?sub=${key}`)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sub-nav */}
      <div className="shrink-0 border-b border-[#d2d2d7]/60 bg-white px-4">
        <div className="flex gap-1 pt-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => goTo(tab.key)}
              className={cn(
                'px-4 py-2 text-[13px] font-medium rounded-t-lg transition-all duration-150',
                sub === tab.key
                  ? 'bg-dmc-primary/8 text-dmc-primary border-b-2 border-dmc-primary'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#f2f2f7]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {sub === 'breakdowns' && <BreakdownsTab user={user} />}
        {sub === 'schedule'   && <ScheduleTab user={user} />}
        {sub === 'drawings'   && <DrawingsTab user={user} />}
        {sub === 'surveys'    && <SurveysTab user={user} />}
      </div>
    </div>
  )
}
