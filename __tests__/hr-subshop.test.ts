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
  opts: { factory?: string | null; subshop?: string | null; position?: string | null } = {},
): HumanResource {
  return {
    id,
    name,
    factory: opts.factory === undefined ? 'DMC1' : opts.factory,
    subshop: opts.subshop ?? null,
    machine: null,
    position: opts.position ?? null,
    phone: null,
  }
}

function group(board: ReturnType<typeof buildHRSubshopBoard>, g: string) {
  return board.find((b) => b.group === g)!
}

describe('buildHRSubshopBoard', () => {
  it('groups personnel by subshop, counts định biên, full-day labor = 4h/ca', () => {
    const board = buildHRSubshopBoard(
      [
        emp(1, 'A', { factory: 'DMC1', subshop: 'DMC1-PK' }),
        emp(2, 'B', { factory: 'DMC1', subshop: 'DMC1-PK' }),
        emp(3, 'C', { factory: 'DMC1', subshop: 'DMC1-CT' }),
      ],
      [],
    )
    expect(group(board, 'DMC1-PK').planHeadcount).toBe(2)
    expect(group(board, 'DMC1-CT').planHeadcount).toBe(1)
    // không có biến động → mỗi người làm đủ 4h sáng + 4h chiều.
    expect(group(board, 'DMC1-PK').laborHoursMorning).toBe(2 * HR_SESSION_HOURS)
    expect(group(board, 'DMC1-PK').laborHoursAfternoon).toBe(2 * HR_SESSION_HOURS)
    expect(group(board, 'DMC1-PK').actualHeadcount).toBe(2)
  })

  it('always lists the full fixed HR group set even when empty', () => {
    const board = buildHRSubshopBoard([], [])
    for (const g of HR_GROUPS) expect(board.some((b) => b.group === g)).toBe(true)
    expect(group(board, 'DMC1-PU').planHeadcount).toBe(0)
    expect(group(board, 'DMC1-PU').laborHoursMorning).toBe(0)
  })

  it('derives status: absent → 0h, transfer → split, else working', () => {
    const daily: HRDailyGroupState[] = [
      {
        group: 'DMC1-PK',
        absentIds: [2],
        transferRecords: [{ employeeId: 3, fromGroup: 'DMC1-PK', toGroup: 'DMC1-CT', startTime: '07:30', endTime: '16:30' }],
      },
    ]
    const board = buildHRSubshopBoard(
      [emp(1, 'A', { subshop: 'DMC1-PK' }), emp(2, 'B', { subshop: 'DMC1-PK' }), emp(3, 'C', { subshop: 'DMC1-PK' })],
      daily,
    )
    const pk = group(board, 'DMC1-PK')
    expect(pk.members.find((m) => m.id === 1)!.status).toBe('working')
    const absent = pk.members.find((m) => m.id === 2)!
    expect(absent.status).toBe('absent')
    expect(absent.morningHours).toBe(0)
    expect(absent.afternoonHours).toBe(0)
    expect(pk.members.find((m) => m.id === 3)!.status).toBe('transferred')
    expect(pk.members.find((m) => m.id === 3)!.transferTo).toBe('DMC1-CT')
  })

  it('splits a mid-morning transfer (10:00) by session between home and destination', () => {
    // chuyển 10:00 từ DMC1-PK → DMC1-CT. Nhà: 07:30–10:00 = 2.5h sáng, 0h chiều.
    // Đến: 10:00–16:30 = 1.5h sáng (đến 11:30) + 4h chiều = 5.5h.
    const daily: HRDailyGroupState[] = [
      {
        group: 'DMC1-PK',
        absentIds: [],
        transferRecords: [{ employeeId: 3, fromGroup: 'DMC1-PK', toGroup: 'DMC1-CT', startTime: '10:00', endTime: '16:30' }],
      },
    ]
    const board = buildHRSubshopBoard(
      [
        emp(1, 'A', { subshop: 'DMC1-PK' }),
        emp(3, 'C', { subshop: 'DMC1-PK' }),
        emp(5, 'E', { subshop: 'DMC1-CT' }),
      ],
      daily,
    )
    const pk = group(board, 'DMC1-PK')
    const ct = group(board, 'DMC1-CT')

    const moved = pk.members.find((m) => m.id === 3)!
    expect(moved.morningHours).toBeCloseTo(2.5) // ở nhà tới 10:00
    expect(moved.afternoonHours).toBe(0)
    expect(moved.transferStart).toBe('10:00')

    const incoming = ct.transferredIn.find((m) => m.id === 3)!
    expect(incoming.morningHours).toBeCloseTo(1.5) // 10:00–11:30
    expect(incoming.afternoonHours).toBe(4) // 12:30–16:30

    // Giờ nhân công ca của xưởng đến: E (4 sáng/4 chiều) + người chuyển đến (1.5/4).
    expect(ct.laborHoursMorning).toBeCloseTo(5.5)
    expect(ct.laborHoursAfternoon).toBe(8)
    // Xưởng nhà: A đủ (4/4) + C chuyển đi (2.5/0).
    expect(pk.laborHoursMorning).toBeCloseTo(6.5)
    expect(pk.laborHoursAfternoon).toBe(4)
  })

  it('puts unassigned base personnel (no subshop) into a trailing base group', () => {
    const board = buildHRSubshopBoard([emp(1, 'A', { factory: 'DMC1', subshop: null })], [])
    expect(board.some((b) => b.group === 'DMC1')).toBe(true)
    expect(group(board, 'DMC1').planHeadcount).toBe(1)
  })

  it('exposes per-session labor hours for production workshops only', () => {
    const board = buildHRSubshopBoard(
      [emp(1, 'A', { subshop: 'DMC1-PK' }), emp(2, 'B', { factory: 'PKT-SX', subshop: null })],
      [],
    )
    const map = getProductionLaborHoursByWorkshop(board)
    expect(map.get('DMC1-PK')).toEqual({ planHeadcount: 1, morning: 4, afternoon: 4 })
    expect(map.has('PKT-SX')).toBe(false)
  })
})
