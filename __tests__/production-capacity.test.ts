import type { NormItem, OpenProductionOrder } from '@/types'
import type { DeadlineProductionPlanRow } from '@/lib/production/workflow'
import {
  buildProductionCapacityTimeline,
  capacityColor,
  SESSION_HOURS,
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
    nwforce: 1,
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
