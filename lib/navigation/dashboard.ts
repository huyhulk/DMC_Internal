export type DashboardSubTab<TKey extends string = string> = {
  key: TKey
  label: string
  href: string
}

export const COORDINATION_TABS = [
  { key: 'delivery',   label: 'Giao Hàng',  href: '/dashboard/coordination?sub=delivery' },
  { key: 'findings5s', label: '5S',         href: '/dashboard/coordination?sub=findings5s' },
  { key: 'reports',    label: 'Báo Cáo TK', href: '/dashboard/coordination?sub=reports' },
] as const satisfies readonly DashboardSubTab[]

export const MAINTENANCE_TABS = [
  { key: 'breakdowns', label: 'Sự Cố Máy',   href: '/dashboard/maintenance?sub=breakdowns' },
  { key: 'schedule',   label: 'Lịch Bảo Trì', href: '/dashboard/maintenance?sub=schedule' },
  { key: 'drawings',   label: 'Bản Vẽ KT',   href: '/dashboard/maintenance?sub=drawings' },
  { key: 'surveys',    label: 'Khảo Sát',    href: '/dashboard/maintenance?sub=surveys' },
  { key: 'machines',   label: 'Thiết Bị',    href: '/dashboard/maintenance?sub=machines' },
] as const satisfies readonly DashboardSubTab[]

export const ADMINISTRATION_TABS = [
  { key: 'overtime',   label: 'Tăng ca',      href: '/dashboard/administration?sub=overtime' },
  { key: 'hr',         label: 'Nhân sự',      href: '/dashboard/administration?sub=hr' },
  { key: 'findings5s', label: '5S',           href: '/dashboard/administration?sub=findings5s' },
  { key: 'iso',        label: 'Quy trình ISO', href: '/dashboard/administration?sub=iso' },
] as const satisfies readonly DashboardSubTab[]

export type CoordinationTabKey = typeof COORDINATION_TABS[number]['key']
export type MaintenanceTabKey = typeof MAINTENANCE_TABS[number]['key']
export type AdministrationTabKey = typeof ADMINISTRATION_TABS[number]['key']

function cloneTabs<T extends readonly DashboardSubTab[]>(tabs: T): Array<T[number]> {
  return tabs.map((tab) => ({ ...tab })) as Array<T[number]>
}

function resolveSubTab<T extends readonly DashboardSubTab[]>(
  tabs: T,
  requested: string | null | undefined
): T[number]['key'] {
  const fallback = tabs[0].key
  return tabs.some((tab) => tab.key === requested) ? requested as T[number]['key'] : fallback
}

export function getCoordinationTabs() {
  return cloneTabs(COORDINATION_TABS)
}

export function getMaintenanceTabs() {
  return cloneTabs(MAINTENANCE_TABS)
}

export function getAdministrationTabs() {
  return cloneTabs(ADMINISTRATION_TABS)
}

export function resolveCoordinationSub(requested: string | null | undefined): CoordinationTabKey {
  return resolveSubTab(COORDINATION_TABS, requested)
}

export function resolveMaintenanceSub(requested: string | null | undefined): MaintenanceTabKey {
  return resolveSubTab(MAINTENANCE_TABS, requested)
}

export function resolveAdministrationSub(requested: string | null | undefined): AdministrationTabKey {
  return resolveSubTab(ADMINISTRATION_TABS, requested)
}
