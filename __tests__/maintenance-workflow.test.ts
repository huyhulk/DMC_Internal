import { getLocalDateTimeInputValue } from '@/lib/utils'
import {
  generateMaintenanceScheduleDates,
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

  it('generates maintenance dates by weekly, monthly, and quarterly frequency', () => {
    expect(generateMaintenanceScheduleDates('2026-05-04', '2026-05-25', 'weekly')).toEqual([
      '2026-05-04',
      '2026-05-11',
      '2026-05-18',
      '2026-05-25',
    ])
    expect(generateMaintenanceScheduleDates('2026-05-04', '2026-08-04', 'monthly')).toEqual([
      '2026-05-04',
      '2026-06-04',
      '2026-07-04',
      '2026-08-04',
    ])
    expect(generateMaintenanceScheduleDates('2026-05-04', '2026-11-04', 'quarterly')).toEqual([
      '2026-05-04',
      '2026-08-04',
      '2026-11-04',
    ])
  })

  it('returns no maintenance dates for invalid ranges', () => {
    expect(generateMaintenanceScheduleDates('2026-05-05', '2026-05-04', 'weekly')).toEqual([])
    expect(generateMaintenanceScheduleDates('not-date', '2026-05-04', 'weekly')).toEqual([])
  })

  it('rejects breakdown end times that are not after the start time', () => {
    expect(isBreakdownEndAfterStart('2026-05-01T09:00', '2026-05-01T08:59')).toBe(false)
    expect(isBreakdownEndAfterStart('2026-05-01T09:00', '2026-05-01T09:00')).toBe(false)
    expect(isBreakdownEndAfterStart('2026-05-01T09:00', '2026-05-01T09:01')).toBe(true)
  })
})
