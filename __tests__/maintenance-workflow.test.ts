import { getLocalDateTimeInputValue } from '@/lib/utils'
import {
  getDrawingListFilter,
  getMaintenanceWorkshopOptions,
  isBreakdownEndAfterStart,
} from '@/lib/maintenance/workflow'

describe('maintenance workflow helpers', () => {
  it('formats datetime-local values using local clock fields instead of UTC ISO fields', () => {
    const date = new Date(2026, 4, 1, 8, 5)

    expect(getLocalDateTimeInputValue(date)).toBe('2026-05-01T08:05')
  })

  it('marks drawing deliver mode as open-only instead of only in_progress', () => {
    expect(getDrawingListFilter('deliver', 'ALL')).toEqual({ openOnly: true })
    expect(getDrawingListFilter('request', 'approved')).toEqual({ status: 'approved' })
    expect(getDrawingListFilter('request', 'ALL')).toEqual({})
  })

  it('scopes maintenance workshop dropdowns for non-manager roles', () => {
    expect(getMaintenanceWorkshopOptions('ADMIN', 'ALL', true)).toEqual(['ALL', 'DMC1', 'DMC3', 'DMC4', 'DMC5'])
    expect(getMaintenanceWorkshopOptions('MANAGER', 'ALL', true)).toEqual(['ALL', 'DMC1', 'DMC3', 'DMC4', 'DMC5'])
    expect(getMaintenanceWorkshopOptions('TEAM_LEADER', 'DMC3', true)).toEqual(['DMC3'])
    expect(getMaintenanceWorkshopOptions('TEAM_LEADER', 'DMC1,DMC5', true)).toEqual(['DMC1', 'DMC5'])
    expect(getMaintenanceWorkshopOptions('TEAM_LEADER', '', true)).toEqual([])
    expect(getMaintenanceWorkshopOptions('TEAM_LEADER', null, true)).toEqual([])
  })

  it('rejects breakdown end times that are not after the start time', () => {
    expect(isBreakdownEndAfterStart('2026-05-01T09:00', '2026-05-01T08:59')).toBe(false)
    expect(isBreakdownEndAfterStart('2026-05-01T09:00', '2026-05-01T09:00')).toBe(false)
    expect(isBreakdownEndAfterStart('2026-05-01T09:00', '2026-05-01T09:01')).toBe(true)
  })
})
