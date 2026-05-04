import { calculateActualHeadcount, elapsedWorkHours, isProductionHRGroup } from '@/lib/hr/workflow'

describe('HR workflow helpers', () => {
  it('subtracts absent and transferred ids once from total headcount', () => {
    expect(calculateActualHeadcount(10, [1, 2, 2], [2, 3, 0, -1])).toBe(7)
  })

  it('never returns a negative actual headcount', () => {
    expect(calculateActualHeadcount(2, [1, 2], [3])).toBe(0)
  })

  it('calculates elapsed work hours from 07:30 Vietnam time', () => {
    expect(elapsedWorkHours('2026-05-04', new Date('2026-05-04T03:00:00.000Z'))).toBe(2.5)
  })

  it('excludes the 11:30-12:30 lunch break from same-day elapsed hours', () => {
    expect(elapsedWorkHours('2026-05-04', new Date('2026-05-04T06:00:00.000Z'))).toBe(4.5)
  })

  it('uses full capped workday hours for past dates and zero for future dates', () => {
    const now = new Date('2026-05-04T03:00:00.000Z')
    expect(elapsedWorkHours('2026-05-03', now)).toBe(8)
    expect(elapsedWorkHours('2026-05-05', now)).toBe(0)
  })

  it('caps same-day elapsed work hours at 16:30 Vietnam time excluding lunch break', () => {
    expect(elapsedWorkHours('2026-05-04', new Date('2026-05-04T11:00:00.000Z'))).toBe(8)
  })

  it('identifies only production HR groups for efficiency reporting', () => {
    expect(isProductionHRGroup('DMC1')).toBe(true)
    expect(isProductionHRGroup('DMC5')).toBe(true)
    expect(isProductionHRGroup('PKT-SX')).toBe(false)
    expect(isProductionHRGroup('DIEU-PHOI')).toBe(false)
  })
})
