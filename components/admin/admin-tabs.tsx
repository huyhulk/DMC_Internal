import { cn } from '@/lib/utils'
import Link from 'next/link'

export type AdminTabKey = 'users' | 'permissions' | 'kpi-settings' | 'google-sheet-sync'

const ADMIN_TABS: Array<{ key: AdminTabKey; label: string; href: string }> = [
  { key: 'users', label: 'Người dùng', href: '/dashboard/admin' },
  { key: 'permissions', label: 'Phân quyền tab', href: '/dashboard/admin?sub=permissions' },
  { key: 'kpi-settings', label: 'Cài đặt KPI', href: '/dashboard/admin/kpi-settings' },
  { key: 'google-sheet-sync', label: 'Đồng bộ Google Sheet', href: '/dashboard/admin/google-sheet-sync' },
]

export function AdminTabs({ active }: { active: AdminTabKey }) {
  return (
    <div className="flex h-[57px] shrink-0 items-center gap-2 border-b border-dmc-border bg-white px-5">
      {ADMIN_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            'rounded-xl px-4 py-2 text-sm font-medium transition',
            active === tab.key
              ? 'bg-dmc-primary text-white shadow-sm'
              : 'text-dmc-text-muted hover:bg-[#f5f5f7] hover:text-dmc-text-primary'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
