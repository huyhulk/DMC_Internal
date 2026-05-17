import type { TabId } from '@/types'

export type DashboardGroupId = 'coordination' | 'maintenance' | 'administration'
export type DashboardGroupTabKey =
  | 'delivery'
  | 'findings5s'
  | 'reports'
  | 'breakdowns'
  | 'schedule'
  | 'drawings'
  | 'surveys'
  | 'machines'
  | 'overtime'
  | 'hr'
  | 'hr-performance'
  | 'iso'

export type DashboardSubTab<TKey extends string = string> = {
  key: TKey
  label: string
  href: string
}

export interface DashboardTopLevelTab {
  key: TabId
  label: string
  href: string
}

export interface DashboardGroupDefinition<TKey extends string = string> {
  key: DashboardGroupId
  label: string
  tabs: readonly DashboardSubTab<TKey>[]
}

export const DASHBOARD_TOP_LEVEL_TABS = [
  { key: 'production', label: 'Sản Xuất', href: '/dashboard/production' },
  { key: 'maintenance', label: 'Bảo Trì', href: '/dashboard/maintenance' },
  { key: 'coordination', label: 'Điều Phối', href: '/dashboard/coordination' },
  { key: 'administration', label: 'HC-NS', href: '/dashboard/administration' },
  { key: 'report', label: 'Báo Cáo', href: '/dashboard/report' },
  { key: 'admin', label: 'Hệ Thống', href: '/dashboard/admin' },
] as const satisfies readonly DashboardTopLevelTab[]

const COORDINATION_TABS = [
  { key: 'delivery', label: 'Giao Hàng', href: '/dashboard/coordination?sub=delivery' },
  { key: 'findings5s', label: 'Kho nguyên phụ liệu', href: '/dashboard/coordination?sub=findings5s' },
  { key: 'reports', label: 'Báo Cáo TK', href: '/dashboard/coordination?sub=reports' },
] as const satisfies readonly DashboardSubTab<'delivery' | 'findings5s' | 'reports'>[]

const MAINTENANCE_TABS = [
  { key: 'breakdowns', label: 'Sự Cố Máy', href: '/dashboard/maintenance?sub=breakdowns' },
  { key: 'schedule', label: 'Lịch Bảo Trì', href: '/dashboard/maintenance?sub=schedule' },
  { key: 'drawings', label: 'Bản Vẽ KT', href: '/dashboard/maintenance?sub=drawings' },
  { key: 'surveys', label: 'Khảo Sát', href: '/dashboard/maintenance?sub=surveys' },
  { key: 'machines', label: 'Thiết Bị', href: '/dashboard/maintenance?sub=machines' },
] as const satisfies readonly DashboardSubTab<'breakdowns' | 'schedule' | 'drawings' | 'surveys' | 'machines'>[]

const ADMINISTRATION_TABS = [
  { key: 'overtime', label: 'Tăng ca', href: '/dashboard/administration?sub=overtime' },
  { key: 'hr', label: 'Nhân sự', href: '/dashboard/administration?sub=hr' },
  { key: 'hr-performance', label: 'Hiệu suất NS', href: '/dashboard/administration?sub=hr-performance' },
  { key: 'findings5s', label: '5S', href: '/dashboard/administration?sub=findings5s' },
  { key: 'iso', label: 'Quy trình ISO', href: '/dashboard/administration?sub=iso' },
] as const satisfies readonly DashboardSubTab<'overtime' | 'hr' | 'hr-performance' | 'findings5s' | 'iso'>[]

export const DASHBOARD_GROUPS = {
  coordination: {
    key: 'coordination',
    label: 'Điều Phối',
    tabs: COORDINATION_TABS,
  },
  maintenance: {
    key: 'maintenance',
    label: 'Bảo Trì',
    tabs: MAINTENANCE_TABS,
  },
  administration: {
    key: 'administration',
    label: 'HC-NS',
    tabs: ADMINISTRATION_TABS,
  },
} as const satisfies {
  coordination: DashboardGroupDefinition<'delivery' | 'findings5s' | 'reports'>
  maintenance: DashboardGroupDefinition<'breakdowns' | 'schedule' | 'drawings' | 'surveys' | 'machines'>
  administration: DashboardGroupDefinition<'overtime' | 'hr' | 'hr-performance' | 'findings5s' | 'iso'>
}

function cloneTabs<T extends readonly { key: string; label: string; href: string }[]>(tabs: T): Array<T[number]> {
  return tabs.map((tab) => ({ ...tab })) as Array<T[number]>
}

export function getDashboardTopLevelTabs() {
  return cloneTabs(DASHBOARD_TOP_LEVEL_TABS)
}

export function getDashboardGroupTabs(group: 'coordination'): Array<DashboardSubTab<'delivery' | 'findings5s' | 'reports'>>
export function getDashboardGroupTabs(group: 'maintenance'): Array<DashboardSubTab<'breakdowns' | 'schedule' | 'drawings' | 'surveys' | 'machines'>>
export function getDashboardGroupTabs(group: 'administration'): Array<DashboardSubTab<'overtime' | 'hr' | 'hr-performance' | 'findings5s' | 'iso'>>
export function getDashboardGroupTabs(group: DashboardGroupId): Array<DashboardSubTab<DashboardGroupTabKey>> {
  return cloneTabs(DASHBOARD_GROUPS[group].tabs) as Array<DashboardSubTab<DashboardGroupTabKey>>
}

export function resolveDashboardGroupSubTab(group: 'coordination', requested: string | null | undefined): 'delivery' | 'findings5s' | 'reports'
export function resolveDashboardGroupSubTab(group: 'maintenance', requested: string | null | undefined): 'breakdowns' | 'schedule' | 'drawings' | 'surveys' | 'machines'
export function resolveDashboardGroupSubTab(group: 'administration', requested: string | null | undefined): 'overtime' | 'hr' | 'hr-performance' | 'findings5s' | 'iso'
export function resolveDashboardGroupSubTab(group: DashboardGroupId, requested: string | null | undefined): DashboardGroupTabKey {
  const tabs = DASHBOARD_GROUPS[group].tabs
  const fallback = tabs[0].key
  return (tabs.some((tab) => tab.key === requested) ? requested : fallback) as DashboardGroupTabKey
}
