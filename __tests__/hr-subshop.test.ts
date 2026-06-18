import type { HumanResource } from '@/types'
import {
  buildHRSubshopBoard,
  getProductionHeadcountByWorkshop,
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
  it('groups personnel by assigned subshop and counts định biên', () => {
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
    // future/no daily → tất cả working → actual = plan.
    expect(group(board, 'DMC1-PK').actualHeadcount).toBe(2)
    expect(group(board, 'DMC1-PK').sessionLaborHours).toBe(2 * HR_SESSION_HOURS)
  })

  it('always lists the full fixed HR group set even when empty', () => {
    const board = buildHRSubshopBoard([], [])
    for (const g of HR_GROUPS) {
      expect(board.some((b) => b.group === g)).toBe(true)
    }
    expect(group(board, 'DMC1-PU').planHeadcount).toBe(0)
  })

  it('derives status: absent → red, transfer → yellow, else working', () => {
    const daily: HRDailyGroupState[] = [
      {
        group: 'DMC1-PK',
        absentIds: [2],
        transferRecords: [{ employeeId: 3, fromGroup: 'DMC1-PK', toGroup: 'DMC1-CT', startTime: '07:30', endTime: '16:30' }],
      },
    ]
    const board = buildHRSubshopBoard(
      [
        emp(1, 'A', { subshop: 'DMC1-PK' }),
        emp(2, 'B', { subshop: 'DMC1-PK' }),
        emp(3, 'C', { subshop: 'DMC1-PK' }),
      ],
      daily,
    )
    const pk = group(board, 'DMC1-PK')
    expect(pk.members.find((m) => m.id === 1)!.status).toBe('working')
    expect(pk.members.find((m) => m.id === 2)!.status).toBe('absent')
    expect(pk.members.find((m) => m.id === 3)!.status).toBe('transferred')
    expect(pk.members.find((m) => m.id === 3)!.transferTo).toBe('DMC1-CT')
  })

  it('moves transferred labor to the destination workshop headcount', () => {
    const daily: HRDailyGroupState[] = [
      {
        group: 'DMC1-PK',
        absentIds: [],
        transferRecords: [{ employeeId: 3, fromGroup: 'DMC1-PK', toGroup: 'DMC1-CT', startTime: '07:30', endTime: '16:30' }],
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
    // PK: 2 nhà, 1 điều chuyển đi → thực tế 1.
    expect(pk.planHeadcount).toBe(2)
    expect(pk.actualHeadcount).toBe(1)
    // CT: 1 nhà + 1 chuyển đến → thực tế 2.
    expect(ct.planHeadcount).toBe(1)
    expect(ct.actualHeadcount).toBe(2)
    expect(ct.transferredIn).toHaveLength(1)
    expect(ct.transferredIn[0].id).toBe(3)
  })

  it('an absent person does not reduce headcount twice and is excluded from work', () => {
    const daily: HRDailyGroupState[] = [{ group: 'DMC5', absentIds: [9], transferRecords: [] }]
    const board = buildHRSubshopBoard(
      [emp(9, 'X', { factory: 'DMC5', subshop: null }), emp(10, 'Y', { factory: 'DMC5', subshop: null })],
      daily,
    )
    const dmc5 = group(board, 'DMC5')
    expect(dmc5.planHeadcount).toBe(2)
    expect(dmc5.actualHeadcount).toBe(1)
  })

  it('puts unassigned base personnel (no subshop) into a trailing base group', () => {
    const board = buildHRSubshopBoard([emp(1, 'A', { factory: 'DMC1', subshop: null })], [])
    // 'DMC1' (base, chưa gán) không nằm trong HR_GROUPS nhưng vẫn xuất hiện vì có người.
    expect(board.some((b) => b.group === 'DMC1')).toBe(true)
    expect(group(board, 'DMC1').planHeadcount).toBe(1)
  })

  it('exposes only production workshops for the capacity headcount map', () => {
    const board = buildHRSubshopBoard(
      [
        emp(1, 'A', { subshop: 'DMC1-PK' }),
        emp(2, 'B', { factory: 'PKT-SX', subshop: null }),
      ],
      [],
    )
    const map = getProductionHeadcountByWorkshop(board)
    expect(map.get('DMC1-PK')).toEqual({ plan: 1, actual: 1 })
    // phòng ban không phải production → không có trong map.
    expect(map.has('PKT-SX')).toBe(false)
  })
})
