import {
  DEFAULT_ROLE_PERMISSIONS,
  type PermissionKey,
} from '@/modules/permissions/tabs'
import {
  getAdministrationTabs,
  getCoordinationTabs,
  getMaintenanceTabs,
  resolveAdministrationSub,
  resolveCoordinationSub,
  resolveMaintenanceSub,
} from '@/modules/navigation/dashboard'

describe('dashboard navigation tabs', () => {
  it('keeps Coordination limited to live data-entry tabs', () => {
    expect(getCoordinationTabs().map((tab) => tab.key)).toEqual(['delivery', 'findings5s', 'reports'])
    expect(getCoordinationTabs().map((tab) => tab.key)).not.toEqual(
      expect.arrayContaining(['hr', 'iso', 'kho', 'hse'])
    )
  })

  it('keeps ISO and HR under Administration and HR', () => {
    expect(getAdministrationTabs().map((tab) => tab.key)).toEqual(['overtime', 'hr', 'hr-performance', 'findings5s', 'iso'])
    expect(getAdministrationTabs().map((tab) => tab.label)).toContain('Hiệu suất NS')
    expect(getAdministrationTabs().map((tab) => tab.label)).toContain('Quy trình ISO')
  })

  it('resolves stale sub-tab links to the current default tab', () => {
    expect(resolveCoordinationSub('iso')).toBe('delivery')
    expect(resolveCoordinationSub('kho')).toBe('delivery')
    expect(resolveCoordinationSub(undefined)).toBe('delivery')
    expect(resolveMaintenanceSub('not-real')).toBe('breakdowns')
    expect(resolveAdministrationSub('iso')).toBe('iso')
  })

  it('keeps Maintenance tab choices in the header dropdown order', () => {
    expect(getMaintenanceTabs().map((tab) => tab.key)).toEqual([
      'breakdowns',
      'schedule',
      'drawings',
      'surveys',
      'machines',
    ])
  })

  it('has permission keys for every dropdown sub-tab', () => {
    const keys: PermissionKey[] = [
      ...getMaintenanceTabs().map((tab) => `maintenance.${tab.key}` as PermissionKey),
      ...getCoordinationTabs().map((tab) => `coordination.${tab.key}` as PermissionKey),
      ...getAdministrationTabs().map((tab) => `administration.${tab.key}` as PermissionKey),
    ]

    for (const key of keys) {
      expect(DEFAULT_ROLE_PERMISSIONS.ADMIN[key]).toBe('edit')
    }
  })
})
