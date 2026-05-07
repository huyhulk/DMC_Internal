import {
  calculateActualHeadcount,
  calculateEffectiveWorkHours,
  calculateHRLaborHoursByFactory,
  elapsedWorkHours,
  isProductionHRGroup,
} from '@/lib/hr/workflow'

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

  it('calculates effective transfer hours inside workday and excludes lunch', () => {
    expect(calculateEffectiveWorkHours('08:00', '10:00')).toBe(2)
    expect(calculateEffectiveWorkHours('09:00', '14:00')).toBe(4)
    expect(calculateEffectiveWorkHours('12:30', '16:30')).toBe(4)
  })

  it('clamps transfer hours to the configured workday', () => {
    expect(calculateEffectiveWorkHours('06:00', '18:00')).toBe(8)
    expect(calculateEffectiveWorkHours('16:30', '18:00')).toBe(0)
  })

  it('moves available labor hours from source to destination factories', () => {
    const transferRecords = [{ employeeId: 2, fromFactory: 'DMC1' as const, toFactory: 'DMC3' as const, startTime: '08:00', endTime: '12:00' }]
    const result = calculateHRLaborHoursByFactory([
      {
        factory: 'DMC1',
        totalem: 10,
        absentIds: [1],
        transferRecords,
      },
      {
        factory: 'DMC3',
        totalem: 5,
        absentIds: [],
        transferRecords: [],
      },
    ], 8)

    expect(JSON.parse(JSON.stringify(transferRecords))).toEqual(transferRecords)
    expect(result.get('DMC1')).toMatchObject({ actualHeadcount: 9, availableLaborHours: 68.5, transferredOutHours: 3.5 })
    expect(result.get('DMC3')).toMatchObject({ actualHeadcount: 5, availableLaborHours: 43.5, transferredInHours: 3.5 })
  })

  it('does not allocate transfer hours for absent employees', () => {
    const result = calculateHRLaborHoursByFactory([
      {
        factory: 'DMC1',
        totalem: 2,
        absentIds: [1],
        transferRecords: [{ employeeId: 1, fromFactory: 'DMC1', toFactory: 'DMC3', startTime: '08:00', endTime: '10:00' }],
      },
      {
        factory: 'DMC3',
        totalem: 1,
        absentIds: [],
        transferRecords: [],
      },
    ], 8)

    expect(result.get('DMC1')).toMatchObject({ actualHeadcount: 1, availableLaborHours: 8, transferredOutHours: 0 })
    expect(result.get('DMC3')).toMatchObject({ actualHeadcount: 1, availableLaborHours: 8, transferredInHours: 0 })
  })
})
