import { getLocalCompactDate, getLocalDateAfterDays, getTodayLocal } from '@/lib/utils'

describe('date helpers', () => {
  it('formats today using the local calendar date', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 3, 9, 15, 0))

    expect(getTodayLocal()).toBe('2026-05-03')

    jest.useRealTimers()
  })

  it('adds days by local calendar date', () => {
    const date = new Date(2026, 4, 3, 9, 15, 0)

    expect(getLocalDateAfterDays(7, date)).toBe('2026-05-10')
  })

  it('formats compact local dates for generated codes', () => {
    const date = new Date(2026, 4, 3, 9, 15, 0)

    expect(getLocalCompactDate(date)).toBe('20260503')
  })
})
