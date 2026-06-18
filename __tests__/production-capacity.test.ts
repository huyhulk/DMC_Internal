import type { NormItem, OpenProductionOrder } from '@/types'
import type { DeadlineProductionPlanRow } from '@/lib/production/workflow'
import {
  buildProductionCapacityTimeline,
  capacityColor,
  SESSION_HOURS,
  type WorkshopPeoplePool,
} from '@/lib/production/capacity'

// now cố định: Thứ Hai 15-06-2026, 08:00 local.
// Cửa sổ 6 ngày làm việc (bỏ CN) = 15..20/06 → 12 ca (sáng/chiều mỗi ngày).
//  idx: 0=15 sáng 1=15 chiều 2=16 sáng 3=16 chiều 4=17 sáng 5=17 chiều
//       6=18 sáng 7=18 chiều 8=19 sáng 9=19 chiều 10=20 sáng 11=20 chiều
const NOW = new Date(2026, 5, 15, 8, 0, 0)

function planRow(overrides: {
  pcode?: string
  workshop?: string
  description?: string
  customer?: string
  deadlinedate?: string
  deadlinetime?: string
  estimatedHours?: number | null
  products?: string
  nwforce?: number
}): DeadlineProductionPlanRow {
  const order = {
    pcode: overrides.pcode ?? 'LSX-1',
    initialdate: '2026-06-01',
    workshop: overrides.workshop ?? 'DMC1',
    customer: overrides.customer ?? 'KH',
    quantity: '100',
    description: overrides.description ?? 'CT tôn sóng',
    deadlinedate: overrides.deadlinedate ?? '2026-06-17',
    deadlinetime: overrides.deadlinetime ?? '16:00',
    status: 'Chưa SX',
    producedQuantity: 0,
    remainingQuantity: 100,
    completionPct: 0,
  } as OpenProductionOrder

  const norm: NormItem = {
    products: overrides.products ?? 'Tôn sóng',
    norm: 10,
    nwforce: overrides.nwforce ?? 1,
    workshop: 'DMC1',
    pspeed: 0,
  }

  return {
    order,
    norm,
    estimatedHours: overrides.estimatedHours === undefined ? 1 : overrides.estimatedHours,
    missingNorm: false,
    matchSource: 'heuristic',
  }
}

describe('buildProductionCapacityTimeline', () => {
  it('builds a 6-working-day window (12 sessions) with dd-mm labels, skipping Sunday', () => {
    const [row] = buildProductionCapacityTimeline([planRow({ estimatedHours: 1 })], NOW)
    expect(row.sessions).toHaveLength(12)
    expect(row.sessions.map((s) => s.label)).toEqual([
      '15-06', '15-06',
      '16-06', '16-06',
      '17-06', '17-06',
      '18-06', '18-06',
      '19-06', '19-06',
      '20-06', '20-06',
    ])
    expect(row.sessions.map((s) => s.period)).toEqual([
      'sang', 'chieu', 'sang', 'chieu', 'sang', 'chieu',
      'sang', 'chieu', 'sang', 'chieu', 'sang', 'chieu',
    ])
  })

  it('fills backward from the deadline session toward now, capping each session at 4h', () => {
    // deadline 17-06 chiều (idx 5), 6h SX còn lại → 4h vào idx5, 2h vào idx4 (17-06 sáng).
    const [row] = buildProductionCapacityTimeline(
      [planRow({ deadlinedate: '2026-06-17', deadlinetime: '16:00', estimatedHours: 6 })],
      NOW,
    )
    expect(row.sessions[5].filledHours).toBe(4)
    expect(row.sessions[5].pct).toBe(100)
    expect(row.sessions[4].filledHours).toBe(2)
    expect(row.sessions[4].pct).toBe(50)
    // Các ca khác trống.
    expect(row.sessions[3].filledHours).toBe(0)
    expect(row.sessions[6].filledHours).toBe(0)
    expect(row.sessions[5].orderCount).toBe(1)
  })

  it('routes a morning deadline to the morning session', () => {
    // deadline 17-06 08:00 (sáng) → idx4; 2h → chỉ idx4.
    const [row] = buildProductionCapacityTimeline(
      [planRow({ deadlinedate: '2026-06-17', deadlinetime: '08:00', estimatedHours: 2 })],
      NOW,
    )
    expect(row.sessions[4].filledHours).toBe(2)
    expect(row.sessions[5].filledHours).toBe(0)
  })

  it('pushes overflow into afternoon sessions as overtime (>100%) up to the deadline', () => {
    // deadline 17-06 chiều (idx5). Sức chứa idx0..5 = 6 ca × 4h = 24h. estimatedHours 27 → dư 3h.
    // 3h tăng ca chia đều vào ca chiều trong [0..5] = idx1,3,5 → mỗi ca +1h.
    const [row] = buildProductionCapacityTimeline(
      [planRow({ deadlinedate: '2026-06-17', deadlinetime: '16:00', estimatedHours: 27 })],
      NOW,
    )
    expect(row.sessions[5].filledHours).toBeCloseTo(5)
    expect(row.sessions[3].filledHours).toBeCloseTo(5)
    expect(row.sessions[1].filledHours).toBeCloseTo(5)
    // ca sáng giữ nguyên 4h (không tăng ca).
    expect(row.sessions[0].filledHours).toBe(4)
    expect(row.sessions[2].filledHours).toBe(4)
    expect(row.sessions[4].filledHours).toBe(4)
    expect(row.sessions[5].pct).toBe(125)
    // ca chiều có tăng ca đánh dấu overtime.
    expect(row.sessions[5].orders.some((o) => o.overtime)).toBe(true)
  })

  it('marks a single same-day afternoon deadline overflow as overtime in that session', () => {
    // deadline hôm nay (15-06) chiều idx1. Đổ lùi idx1=4, idx0=4 → 8h; estimatedHours 10 → dư 2h.
    // ca chiều trong [0..1] = chỉ idx1 → +2h tăng ca.
    const [row] = buildProductionCapacityTimeline(
      [planRow({ deadlinedate: '2026-06-15', deadlinetime: '16:00', estimatedHours: 10 })],
      NOW,
    )
    expect(row.sessions[0].filledHours).toBe(4)
    expect(row.sessions[1].filledHours).toBeCloseTo(6)
    expect(row.sessions[1].pct).toBe(150)
  })

  it('caps overtime at +4h/session (max 8h) and flags overloaded when even OT is not enough', () => {
    // deadline hôm nay (15-06) chiều idx1. Phạm vi [0..1]: idx0 sáng (cap 4h), idx1 chiều (cap 8h).
    // Sức chứa tối đa = 12h; estimatedHours 14 → kể cả tăng ca vẫn thiếu 2h → "không kịp".
    const [row] = buildProductionCapacityTimeline(
      [planRow({ deadlinedate: '2026-06-15', deadlinetime: '16:00', estimatedHours: 14 })],
      NOW,
    )
    // idx1 đầy đến trần 8h (4 thường + 4 tăng ca), idx0 đầy 4h.
    expect(row.sessions[1].filledHours).toBeCloseTo(8)
    expect(row.sessions[1].pct).toBe(200)
    expect(row.sessions[0].filledHours).toBe(4)
    // ô deadline được đánh dấu cảnh báo; ô khác thì không.
    expect(row.sessions[1].deadlineOverflow).toBe(true)
    expect(row.sessions[0].deadlineOverflow).toBe(false)
    // đơn trong ô deadline mang cờ overloaded.
    expect(row.sessions[1].orders.every((o) => o.overloaded)).toBe(true)
  })

  it('does not flag overloaded when work fits exactly within overtime capacity', () => {
    // estimatedHours 12 = đúng sức chứa (4h sáng + 8h chiều) → vừa đủ, không cảnh báo.
    const [row] = buildProductionCapacityTimeline(
      [planRow({ deadlinedate: '2026-06-15', deadlinetime: '16:00', estimatedHours: 12 })],
      NOW,
    )
    expect(row.sessions[1].filledHours).toBeCloseTo(8)
    expect(row.sessions[1].deadlineOverflow).toBe(false)
    expect(row.sessions[1].orders.every((o) => !o.overloaded)).toBe(true)
  })

  it('ignores rows with no remaining production hours', () => {
    const rows = buildProductionCapacityTimeline(
      [planRow({ estimatedHours: 0 }), planRow({ estimatedHours: null })],
      NOW,
    )
    // vẫn tạo hàng xưởng nhưng mọi ca trống.
    expect(rows).toHaveLength(1)
    expect(rows[0].sessions.every((s) => s.filledHours === 0)).toBe(true)
  })

  it('groups rows by production-entry sub-workshop', () => {
    const rows = buildProductionCapacityTimeline(
      [
        planRow({ pcode: 'A', workshop: 'DMC1', description: 'PU cánh cửa', estimatedHours: 2 }),
        planRow({ pcode: 'B', workshop: 'DMC1', description: 'phụ kiện inox', estimatedHours: 2 }),
        planRow({ pcode: 'C', workshop: 'DMC1', description: 'khung thép CT', estimatedHours: 2 }),
      ],
      NOW,
    )
    const names = rows.map((r) => r.workshop).sort()
    expect(names).toEqual(['DMC1-CT', 'DMC1-PK', 'DMC1-PU'])
  })

  it('keeps SESSION_HOURS at 4h per session', () => {
    expect(SESSION_HOURS).toBe(4)
  })
})

describe('buildProductionCapacityTimeline — tăng ca Chủ nhật', () => {
  // now = Thứ Bảy 20-06-2026, 08:00. Cửa sổ: T7 20, [bỏ CN 21], T2 22, T3 23, T4 24, T5 25, T6 26.
  //  idx: 0=20 sáng 1=20 chiều | 2=22 sáng 3=22 chiều | 4=23 sáng 5=23 chiều | ...
  // Khe Chủ nhật: ô chiều Thứ 7 = idx1; Thứ 2 bắt đầu = idx2.
  const NOW_SAT = new Date(2026, 5, 20, 8, 0, 0)

  function planRowSat(estimatedHours: number, deadlinedate: string, deadlinetime = '16:00'): DeadlineProductionPlanRow {
    return planRow({ deadlinedate, deadlinetime, estimatedHours })
  }

  it('uses Sunday overtime (max 8h) only after weekday OT is exhausted, shown as a bubble on Sat afternoon', () => {
    // deadline T2 22 chiều (idx3). Phạm vi [0..3]: sức chứa T7+T2 = 4+8+4+8 = 24h.
    // estimatedHours 28 → dư 4h sau khi đầy T7/T2 → CN gánh 4h (≤8). Không "không kịp".
    const [row] = buildProductionCapacityTimeline([planRowSat(28, '2026-06-22')], NOW_SAT)
    // T7 sáng/chiều và T2 sáng/chiều đầy trần.
    expect(row.sessions[0].filledHours).toBe(4)
    expect(row.sessions[1].filledHours).toBeCloseTo(8)
    expect(row.sessions[2].filledHours).toBe(4)
    expect(row.sessions[3].filledHours).toBeCloseTo(8)
    // 4h tăng ca Chủ nhật gắn ở ô chiều Thứ 7 (bong bóng), không cộng vào filledHours.
    expect(row.sessions[1].sundayOvertimeHours).toBeCloseTo(4)
    expect(row.sessions[1].sundayOrders).toHaveLength(1)
    expect(row.sessions[1].sundayOrders[0].hours).toBeCloseTo(4)
    expect(row.sessions[1].sundayOrders[0].overtime).toBe(true)
    // Không quá tải.
    expect(row.sessions[3].deadlineOverflow).toBe(false)
  })

  it('flags overloaded only when even full 8h Sunday overtime is not enough', () => {
    // estimatedHours 37 > 24 (T7+T2) + 8 (CN) = 32 → vẫn thiếu 5h → "không kịp".
    const [row] = buildProductionCapacityTimeline([planRowSat(37, '2026-06-22')], NOW_SAT)
    expect(row.sessions[1].sundayOvertimeHours).toBeCloseTo(8) // CN dùng hết 8h
    expect(row.sessions[3].deadlineOverflow).toBe(true)
    expect(row.sessions[3].orders.every((o) => o.overloaded)).toBe(true)
  })

  it('does not touch Sunday when weekday overtime still has room', () => {
    // estimatedHours 20 < 24 → đủ chỗ trong T7/T2 (thường + tăng ca chiều), không đụng CN.
    const [row] = buildProductionCapacityTimeline([planRowSat(20, '2026-06-22')], NOW_SAT)
    expect(row.sessions[1].sundayOvertimeHours).toBe(0)
    expect(row.sessions[1].sundayOrders).toHaveLength(0)
  })

  it('ignores Sunday for orders whose deadline does not cross the Sunday', () => {
    // deadline ngay T7 20 chiều (idx1) → không bắc qua CN. est 14 > 12 (4+8) → không kịp, CN không dùng.
    const [row] = buildProductionCapacityTimeline([planRowSat(14, '2026-06-20')], NOW_SAT)
    expect(row.sessions[1].sundayOvertimeHours).toBe(0)
    expect(row.sessions[1].deadlineOverflow).toBe(true)
  })
})

describe('buildProductionCapacityTimeline — danh sách xưởng cố định', () => {
  const FIXED = [
    'DMC1-PU', 'DMC1-PK', 'DMC1-CT',
    'DMC3-PN', 'DMC3-PK', 'DMC3-CT',
    'DMC4-XG', 'DMC4-PK',
    'DMC5', 'CONG_TRINH',
  ]

  it('always lists every fixed workshop (even idle ones) in the given order', () => {
    const timeline = buildProductionCapacityTimeline(
      [planRow({ workshop: 'DMC1', description: 'CT tôn sóng', estimatedHours: 2 })],
      NOW,
      FIXED,
    )
    expect(timeline.map((r) => r.workshop)).toEqual(FIXED)
    // Hàng có đơn được đổ giờ; hàng không có đơn vẫn xuất hiện nhưng trống.
    expect(timeline.find((r) => r.workshop === 'DMC1-CT')!.sessions.some((s) => s.filledHours > 0)).toBe(true)
    expect(timeline.find((r) => r.workshop === 'DMC1-PU')!.sessions.every((s) => s.filledHours === 0)).toBe(true)
    expect(timeline.find((r) => r.workshop === 'DMC5')!.sessions.every((s) => s.filledHours === 0)).toBe(true)
  })

  it('collapses DMC5 variants (description suffix) into a single DMC5 row', () => {
    const timeline = buildProductionCapacityTimeline(
      [
        planRow({ workshop: 'Phân xưởng 5 - Tôn', description: 'abc', estimatedHours: 2 }),
        planRow({ workshop: 'Phân xưởng 5 - Phụ kiện', description: 'xyz', estimatedHours: 2 }),
      ],
      NOW,
      ['DMC5'],
    )
    expect(timeline.map((r) => r.workshop)).toEqual(['DMC5'])
  })
})

describe('buildProductionCapacityTimeline — máy nền + ràng buộc người (kho chung xưởng chính)', () => {
  // Đơn PU + PK của DMC1, cùng deadline 17-06 chiều (idx5, ngày tương lai). Mỗi đơn 4h máy × nwforce 3 → cần 12 giờ-người/ca.
  function dmc1Orders() {
    return [
      planRow({ pcode: 'PU1', workshop: 'DMC1', description: 'PU cánh cửa', deadlinedate: '2026-06-17', deadlinetime: '16:00', estimatedHours: 4, nwforce: 3 }),
      planRow({ pcode: 'PK1', workshop: 'DMC1', description: 'phụ kiện inox', deadlinedate: '2026-06-17', deadlinetime: '16:00', estimatedHours: 4, nwforce: 3 }),
    ]
  }

  it('without pool data → machine governs (% theo máy, nwforce không ảnh hưởng)', () => {
    const timeline = buildProductionCapacityTimeline(dmc1Orders(), NOW)
    const pu = timeline.find((r) => r.workshop === 'DMC1-PU')!
    const pk = timeline.find((r) => r.workshop === 'DMC1-PK')!
    expect(pu.sessions[5].pct).toBe(100) // 4h máy / 4h
    expect(pk.sessions[5].pct).toBe(100)
  })

  it('enough people → machine governs (người dư không kéo % xuống)', () => {
    // DMC1 định biên 6 → chiều tương lai = 6×4×2 = 48 giờ-người ≥ 24 cần → đủ.
    const pool = new Map<string, WorkshopPeoplePool>([['DMC1', { planHeadcount: 6, todayMorning: 48, todayAfternoon: 48 }]])
    const timeline = buildProductionCapacityTimeline(dmc1Orders(), NOW, undefined, pool)
    expect(timeline.find((r) => r.workshop === 'DMC1-PU')!.sessions[5].pct).toBe(100)
    expect(timeline.find((r) => r.workshop === 'DMC1-PK')!.sessions[5].pct).toBe(100)
  })

  it('short people → priority PU > PK: PU full, PK starved → % pushed up', () => {
    // DMC1 định biên 2 → chiều = 2×4×2 = 16 giờ-người < 24 cần. PU (ưu tiên) lấy 12, PK còn 4 → factor 1/3.
    const pool = new Map<string, WorkshopPeoplePool>([['DMC1', { planHeadcount: 2, todayMorning: 16, todayAfternoon: 16 }]])
    const timeline = buildProductionCapacityTimeline(dmc1Orders(), NOW, undefined, pool)
    const pu = timeline.find((r) => r.workshop === 'DMC1-PU')!
    const pk = timeline.find((r) => r.workshop === 'DMC1-PK')!
    expect(pu.sessions[5].pct).toBe(100) // đủ người → máy
    expect(pk.sessions[5].capacity).toBeCloseTo(4 / 3) // 4h × (4/12)
    expect(pk.sessions[5].pct).toBe(300) // 4h máy / (4/3)
  })

  it("uses today's actual people-hours for the current day", () => {
    // Đơn PU deadline HÔM NAY chiều (idx1). DMC1 hôm nay chiều chỉ 2 giờ-người thực tế → thiếu.
    const orders = [planRow({ pcode: 'PU1', workshop: 'DMC1', description: 'PU cánh', deadlinedate: '2026-06-15', deadlinetime: '16:00', estimatedHours: 4, nwforce: 1 })]
    const pool = new Map<string, WorkshopPeoplePool>([['DMC1', { planHeadcount: 5, todayMorning: 2, todayAfternoon: 2 }]])
    const timeline = buildProductionCapacityTimeline(orders, NOW, undefined, pool)
    const pu = timeline.find((r) => r.workshop === 'DMC1-PU')!
    // chiều hôm nay: available = todayAfternoon×2 = 4 giờ-người; cần = 4×1 = 4 → vừa đủ → máy (100%).
    expect(pu.sessions[1].pct).toBe(100)
  })
})

describe('capacityColor', () => {
  it('maps percentage to status color thresholds', () => {
    expect(capacityColor(0)).toBe('empty')
    expect(capacityColor(49)).toBe('green')
    expect(capacityColor(50)).toBe('yellow')
    expect(capacityColor(74)).toBe('yellow')
    expect(capacityColor(75)).toBe('red')
    expect(capacityColor(100)).toBe('red')
    expect(capacityColor(101)).toBe('purple')
  })
})
