import {
  getDashboardGroupTabs,
  getDashboardTopLevelTabs,
  resolveDashboardGroupSubTab,
} from '@/modules/core/module-registry'

describe('module registry', () => {
  it('declares the top-level modular monolith domains in display order', () => {
    expect(getDashboardTopLevelTabs().map((tab) => tab.key)).toEqual([
      'production',
      'maintenance',
      'coordination',
      'administration',
      'report',
      'admin',
    ])
  })

  it('keeps group sub-tabs centralized and clone-safe', () => {
    const first = getDashboardGroupTabs('maintenance')
    const second = getDashboardGroupTabs('maintenance')

    expect(first[0]).not.toBe(second[0])
    expect(second.map((tab) => tab.key)).toEqual(['breakdowns', 'schedule', 'drawings', 'surveys', 'machines'])
    expect(second[0].label).toBe('Sự Cố Máy')
  })

  it('resolves stale sub-tab requests to the module default', () => {
    expect(resolveDashboardGroupSubTab('coordination', 'iso')).toBe('delivery')
    expect(resolveDashboardGroupSubTab('administration', 'iso')).toBe('iso')
    expect(resolveDashboardGroupSubTab('maintenance', undefined)).toBe('breakdowns')
  })
})
