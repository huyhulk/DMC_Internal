import { shouldIncludeProductionOrderRow } from '@/modules/production/order-policy'
import type { ProductionOrderVisibilityPolicy } from '@/modules/config/schemas'

const basePolicy: ProductionOrderVisibilityPolicy = {
  requireNormMatchWhenNormsExist: true,
  showAllWhenNormsMissing: true,
  excludedWorkshopCodes: [],
}

describe('production order visibility policy', () => {
  it('keeps the legacy fallback visible when Norm has no data', () => {
    expect(shouldIncludeProductionOrderRow({
      rawWorkshop: 'DMC1 - Tôn',
      role: 'USER',
      userWorkspaces: ['DMC1'],
      validWorkshopCodes: new Set(),
      hasNormData: false,
      policy: basePolicy,
    })).toBe(true)
  })

  it('requires Norm workshop mapping when configured and Norm data exists', () => {
    expect(shouldIncludeProductionOrderRow({
      rawWorkshop: 'DMC5 - Sơn',
      role: 'USER',
      userWorkspaces: ['DMC5'],
      validWorkshopCodes: new Set(['DMC1']),
      hasNormData: true,
      policy: basePolicy,
    })).toBe(false)
  })

  it('honors excluded workshops from configuration', () => {
    expect(shouldIncludeProductionOrderRow({
      rawWorkshop: 'DMC3 - Cơ khí',
      role: 'ADMIN',
      userWorkspaces: [],
      validWorkshopCodes: new Set(['DMC3']),
      hasNormData: true,
      policy: { ...basePolicy, excludedWorkshopCodes: ['DMC3'] },
    })).toBe(false)
  })
})

