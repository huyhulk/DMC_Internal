import type { HumanResource } from '@/types'
import {
  buildHRSubshopBoard,
  getProductionLaborHoursByWorkshop,
  HR_SESSION_HOURS,
  type HRDailyGroupState,
} from '@/lib/hr/subshop'
import { HR_GROUPS } from '@/lib/hr/groups'

function emp(
  id: number,
  name: string,
  opts: { factory?: string | null; position?: string | null } = {},
): HumanResource {
  return {
    id,
    name,
    factory: opts.factory === undefined ? 'DMC1' : opts.factory,
    subshop: null, // không gán cứng — người là kho chung xưởng chính
    machine: null,
    position: opts.position ?? null,
    phone: null,
  }
}

function group(board: ReturnType<typeof buildHRSubshopBoard>, g: string) {
  return board.find((b) => b.group === g)!
}

describe('buildHRSubshopBoard — gom theo XƯỞNG CHÍNH (kho chung)', () => {
  it('groups personnel by main workshop (factory), full-day labor = 4h/ca', () => {
    const board = buildHRSubshopBoard(
      [emp(1, 'A', { factory: 'DMC1' }), emp(2, 'B', { factory: 'DMC1' }), emp(3, 'C', { factory: 'DMC3' })],
      [],
    )
    expect(group(board, 'DMC1').planHeadcount).toBe(2)
    expect(group(board, 'DMC3').planHeadcount).toBe(1)
    expect(group(board, 'DMC1').laborHoursMorning).toBe(2 * HR_SESSION_HOURS)
    expect(group(board, 'DMC1').laborHoursAfternoon).toBe(2 * HR_SESSION_HOURS)
  })

  it('always lists the full fixed HR group set (main workshops + departments)', () => {
    const board = buildHRSubshopBoard([], [])
    for (const g of HR_GROUPS) expect(board.some((b) => b.group === g)).toBe(true)
    expect(group(board, 'DMC1').planHeadcount).toBe(0)
  })

  it('derives status: absent → 0h, transfer → split', () => {
    const daily: HRDailyGroupState[] = [
      {
        group: 'DMC1',
        absentIds: [2],
        transferRecords: [{ employeeId: 3, fromGroup: 'DMC1', toGroup: 'DMC3', startTime: '07:30', endTime: '16:30' }],
      },
    ]
    const board = buildHRSubshopBoard(
      [emp(1, 'A', { factory: 'DMC1' }), emp(2, 'B', { factory: 'DMC1' }), emp(3, 'C', { factory: 'DMC1' })],
      daily,
    )
    const dmc1 = group(board, 'DMC1')
    expect(dmc1.members.find((m) => m.id === 1)!.status).toBe('working')
    expect(dmc1.members.find((m) => m.id === 2)!.status).toBe('absent')
    expect(dmc1.members.find((m) => m.id === 3)!.status).toBe('transferred')
    expect(dmc1.members.find((m) => m.id === 3)!.transferTo).toBe('DMC3')
  })

  it('splits a mid-morning transfer (10:00) between home and destination main workshop', () => {
    const daily: HRDailyGroupState[] = [
      {
        group: 'DMC1',
        absentIds: [],
        transferRecords: [{ employeeId: 3, fromGroup: 'DMC1', toGroup: 'DMC3', startTime: '10:00', endTime: '16:30' }],
      },
    ]
    const board = buildHRSubshopBoard(
      [emp(1, 'A', { factory: 'DMC1' }), emp(3, 'C', { factory: 'DMC1' }), emp(5, 'E', { factory: 'DMC3' })],
      daily,
    )
    const dmc1 = group(board, 'DMC1')
    const dmc3 = group(board, 'DMC3')

    const moved = dmc1.members.find((m) => m.id === 3)!
    expect(moved.morningHours).toBeCloseTo(2.5)
    expect(moved.afternoonHours).toBe(0)
    expect(moved.transferStart).toBe('10:00')

    const incoming = dmc3.transferredIn.find((m) => m.id === 3)!
    expect(incoming.morningHours).toBeCloseTo(1.5)
    expect(incoming.afternoonHours).toBe(4)

    expect(dmc3.laborHoursMorning).toBeCloseTo(5.5) // E (4) + chuyển đến (1.5)
    expect(dmc3.laborHoursAfternoon).toBe(8)
    expect(dmc1.laborHoursMorning).toBeCloseTo(6.5) // A (4) + C (2.5)
    expect(dmc1.laborHoursAfternoon).toBe(4)
  })

  it('an absent person reduces the workshop labor-hours', () => {
    const daily: HRDailyGroupState[] = [{ group: 'DMC5', absentIds: [9], transferRecords: [] }]
    const board = buildHRSubshopBoard(
      [emp(9, 'X', { factory: 'DMC5' }), emp(10, 'Y', { factory: 'DMC5' })],
      daily,
    )
    const dmc5 = group(board, 'DMC5')
    expect(dmc5.planHeadcount).toBe(2)
    expect(dmc5.laborHoursMorning).toBe(HR_SESSION_HOURS) // chỉ Y làm
  })

  it('exposes per-session labor hours for production main workshops only', () => {
    const board = buildHRSubshopBoard(
      [emp(1, 'A', { factory: 'DMC1' }), emp(2, 'B', { factory: 'PKT-SX' })],
      [],
    )
    const map = getProductionLaborHoursByWorkshop(board)
    expect(map.get('DMC1')).toEqual({ planHeadcount: 1, morning: 4, afternoon: 4 })
    expect(map.has('PKT-SX')).toBe(false)
  })
})
