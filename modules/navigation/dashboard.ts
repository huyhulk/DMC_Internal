export type {
  DashboardGroupDefinition,
  DashboardGroupId,
  DashboardSubTab,
  DashboardTopLevelTab,
} from '@/modules/core/module-registry'

import {
  getDashboardGroupTabs,
  getDashboardTopLevelTabs,
  resolveDashboardGroupSubTab,
  type DashboardGroupId,
} from '@/modules/core/module-registry'

export type CoordinationTabKey = 'delivery' | 'findings5s' | 'reports'
export type MaintenanceTabKey = 'breakdowns' | 'schedule' | 'drawings' | 'surveys' | 'machines'
export type AdministrationTabKey = 'overtime' | 'hr' | 'hr-performance' | 'findings5s' | 'iso'

export function getCoordinationTabs() {
  return getDashboardGroupTabs('coordination')
}

export function getMaintenanceTabs() {
  return getDashboardGroupTabs('maintenance')
}

export function getAdministrationTabs() {
  return getDashboardGroupTabs('administration')
}

export function resolveCoordinationSub(requested: string | null | undefined): CoordinationTabKey {
  return resolveDashboardGroupSubTab('coordination', requested) as CoordinationTabKey
}

export function resolveMaintenanceSub(requested: string | null | undefined): MaintenanceTabKey {
  return resolveDashboardGroupSubTab('maintenance', requested) as MaintenanceTabKey
}

export function resolveAdministrationSub(requested: string | null | undefined): AdministrationTabKey {
  return resolveDashboardGroupSubTab('administration', requested) as AdministrationTabKey
}

export function getDashboardTabs() {
  return getDashboardTopLevelTabs()
}
