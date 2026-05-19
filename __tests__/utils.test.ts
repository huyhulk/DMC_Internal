import { calcRealNorm, getLocalCompactDate, getLocalDateAfterDays, getTodayLocal, parseDecimalInput } from '@/lib/utils'

describe('parseDecimalInput', () => {
  it('parses dot and comma decimal separators', () => {
    expect(parseDecimalInput('43.88')).toBe(43.88)
    expect(parseDecimalInput('43,88')).toBe(43.88)
  })

  it('parses grouped decimal values', () => {
    expect(parseDecimalInput('1.234,56')).toBe(1234.56)
    expect(parseDecimalInput('1,234.56')).toBe(1234.56)
    expect(parseDecimalInput('1 234,56')).toBe(1234.56)
  })

  it('returns zero for empty or invalid input', () => {
    expect(parseDecimalInput('')).toBe(0)
    expect(parseDecimalInput(null)).toBe(0)
    expect(parseDecimalInput(undefined)).toBe(0)
    expect(parseDecimalInput('abc')).toBe(0)
    expect(parseDecimalInput(Number.NaN)).toBe(0)
  })
})
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

describe('calcRealNorm', () => {
  it('subtracts the lunch break when the time range crosses 11:30-12:30', () => {
    expect(calcRealNorm({
      nwforce: 4,
      workforce: 4,
      poutput: 100,
      starttime: '09:00',
      endtime: '14:00',
    })).toBe(25)
  })

  it('keeps the lunch hour when lunch overtime is checked', () => {
    expect(calcRealNorm({
      nwforce: 4,
      workforce: 4,
      poutput: 100,
      starttime: '09:00',
      endtime: '14:00',
      lunchOvertime: true,
    })).toBe(20)
  })

  it('does not change ranges outside the lunch break window', () => {
    const params = {
      nwforce: 4,
      workforce: 4,
      poutput: 100,
      starttime: '13:00',
      endtime: '17:00',
    }

    expect(calcRealNorm(params)).toBe(25)
    expect(calcRealNorm({ ...params, lunchOvertime: true })).toBe(25)
  })
})
