import {
  mergeWithStatic,
  STATIC_MODULE_NAV_CONFIGS,
  type ModuleNavConfig,
} from '@/modules/config/module-config'

describe('mergeWithStatic', () => {
  it('returns static defaults when dbConfigs is empty', () => {
    const result = mergeWithStatic([])
    expect(result).toEqual(STATIC_MODULE_NAV_CONFIGS)
  })

  it('overrides top-level label from DB', () => {
    const db: ModuleNavConfig[] = [
      { module_key: 'production', label: 'SX Tùy Chỉnh', is_enabled: true, display_order: 1, subtabs: [] },
    ]
    const result = mergeWithStatic(db)
    expect(result.find((m) => m.module_key === 'production')!.label).toBe('SX Tùy Chỉnh')
  })

  it('sets is_enabled = false from DB', () => {
    const db: ModuleNavConfig[] = [
      { module_key: 'maintenance', label: 'Bảo Trì', is_enabled: false, display_order: 2, subtabs: [] },
    ]
    const result = mergeWithStatic(db)
    expect(result.find((m) => m.module_key === 'maintenance')!.is_enabled).toBe(false)
  })

  it('keeps static subtabs when DB subtabs array is empty', () => {
    const db: ModuleNavConfig[] = [
      { module_key: 'maintenance', label: 'Bảo Trì', is_enabled: false, display_order: 2, subtabs: [] },
    ]
    const result = mergeWithStatic(db)
    expect(result.find((m) => m.module_key === 'maintenance')!.subtabs).toHaveLength(5)
  })

  it('overrides subtab is_enabled from DB', () => {
    const db: ModuleNavConfig[] = [
      {
        module_key: 'maintenance',
        label: 'Bảo Trì',
        is_enabled: true,
        display_order: 2,
        subtabs: [{ subtab_key: 'drawings', label: 'Bản Vẽ', is_enabled: false, display_order: 3 }],
      },
    ]
    const result = mergeWithStatic(db)
    const drawings = result
      .find((m) => m.module_key === 'maintenance')!
      .subtabs.find((s) => s.subtab_key === 'drawings')!
    expect(drawings.is_enabled).toBe(false)
    expect(drawings.label).toBe('Bản Vẽ')
  })

  it('preserves non-overridden subtabs from static', () => {
    const db: ModuleNavConfig[] = [
      {
        module_key: 'maintenance',
        label: 'Bảo Trì',
        is_enabled: true,
        display_order: 2,
        subtabs: [{ subtab_key: 'drawings', label: 'Bản Vẽ', is_enabled: false, display_order: 3 }],
      },
    ]
    const result = mergeWithStatic(db)
    const maint = result.find((m) => m.module_key === 'maintenance')!
    const breakdowns = maint.subtabs.find((s) => s.subtab_key === 'breakdowns')!
    expect(breakdowns.is_enabled).toBe(true)
  })

  it('sorts modules by display_order', () => {
    const db: ModuleNavConfig[] = [
      { module_key: 'maintenance', label: 'Bảo Trì', is_enabled: true, display_order: 99, subtabs: [] },
      { module_key: 'production',  label: 'Sản Xuất', is_enabled: true, display_order: 1,  subtabs: [] },
    ]
    const result = mergeWithStatic(db)
    const idx = (key: string) => result.findIndex((m) => m.module_key === key)
    expect(idx('production')).toBeLessThan(idx('maintenance'))
  })

  it('does not add unknown module_keys from DB', () => {
    const db: ModuleNavConfig[] = [
      { module_key: 'nonexistent', label: 'Ghost', is_enabled: true, display_order: 0, subtabs: [] },
    ]
    const result = mergeWithStatic(db)
    expect(result.find((m) => m.module_key === 'nonexistent')).toBeUndefined()
    expect(result).toHaveLength(STATIC_MODULE_NAV_CONFIGS.length)
  })
})
