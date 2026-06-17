import { getProductionOverviewWorkshop } from '@/lib/production/workflow'
import type { DeadlineProductionPlanRow } from '@/lib/production/workflow'

// Tổng quan sản xuất: timeline sức chứa theo từng phân xưởng nhỏ.
// Cửa sổ = 6 ngày làm việc (bỏ Chủ nhật) tính từ "now"; mỗi ngày 2 ca (sáng/chiều), mỗi ca 4h.
// % mỗi ca = giờ SX các đơn đã đổ vào ca / 4h. Màu: <50 xanh, 50-75 vàng, 75-100 đỏ, >100 tím.

export type SessionPeriod = 'sang' | 'chieu'

export const SESSION_HOURS = 4
export const OVERTIME_HOURS = 4 // tăng ca tối đa thêm 4h mỗi ca
export const MAX_SESSION_HOURS = SESSION_HOURS + OVERTIME_HOURS // tổng tối đa 8h/ca
export const WORKING_DAYS = 6
const MORNING_END_MIN = 11 * 60 + 30 // 11:30 — hết ca sáng
const AFTERNOON_END_MIN = 16 * 60 + 30 // 16:30 — hết ca chiều / hết ngày

export interface CapacitySessionOrder {
  pcode: string
  products: string | null
  customer: string
  hours: number // số giờ của đơn này đổ vào ca này
  remainingQuantity: number // sản lượng còn cần SX của cả đơn
  norm: number | null // định mức SX (sản lượng/giờ); null = thiếu định mức
  overtime: boolean
  overloaded: boolean // tăng ca vẫn không đủ → không kịp deadline
}

export interface CapacitySession {
  date: string // YYYY-MM-DD
  label: string // dd-mm
  period: SessionPeriod
  filledHours: number // có thể > 4 (tăng ca)
  pct: number // filledHours / 4 * 100 (làm tròn)
  orderCount: number
  orders: CapacitySessionOrder[]
  deadlineOverflow: boolean // ca này là deadline của ≥1 đơn không kịp dù đã tăng ca
  // Chỉ ca CHIỀU THỨ 7 (trước 1 Chủ nhật bị bắc qua) dùng: tăng ca Chủ nhật gắn vào đây dạng bong bóng.
  // Giờ CN KHÔNG cộng vào filledHours/pct của ca này (CN là ngày khác).
  sundayOvertimeHours: number
  sundayOrders: CapacitySessionOrder[]
}

export interface WorkshopCapacityRow {
  workshop: string
  sessions: CapacitySession[]
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function toDayMonthLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return match ? `${match[3]}-${match[2]}` : iso
}

// 6 ngày làm việc (bỏ Chủ nhật, getDay()===0) tính từ ngày của `now`; mỗi ngày 2 ca.
function buildSessions(now: Date): CapacitySession[] {
  const sessions: CapacitySession[] = []
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let workingDays = 0
  while (workingDays < WORKING_DAYS) {
    if (cursor.getDay() !== 0) {
      const iso = toISODate(cursor)
      const label = toDayMonthLabel(iso)
      sessions.push({ date: iso, label, period: 'sang', filledHours: 0, pct: 0, orderCount: 0, orders: [], deadlineOverflow: false, sundayOvertimeHours: 0, sundayOrders: [] })
      sessions.push({ date: iso, label, period: 'chieu', filledHours: 0, pct: 0, orderCount: 0, orders: [], deadlineOverflow: false, sundayOvertimeHours: 0, sundayOrders: [] })
      workingDays += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return sessions
}

// Thời điểm KẾT THÚC của một ca (local Date) — dùng để so với "now" và deadline.
function sessionEndDate(session: CapacitySession): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(session.date)!
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const endMin = session.period === 'sang' ? MORNING_END_MIN : AFTERNOON_END_MIN
  return new Date(year, month, day, Math.floor(endMin / 60), endMin % 60, 0, 0)
}

// Ca đầu tiên còn "đổ" được: ca có thời điểm kết thúc > now (bỏ các ca đã qua trong hôm nay).
function findNowIndex(sessions: CapacitySession[], now: Date): number {
  const idx = sessions.findIndex((s) => sessionEndDate(s).getTime() > now.getTime())
  return idx === -1 ? sessions.length : idx
}

function parseDeadlineMinutes(deadlinetime: string | null | undefined): number {
  const match = /^(\d{1,2}):(\d{2})/.exec((deadlinetime ?? '').trim())
  if (!match) return AFTERNOON_END_MIN // không có giờ → coi như cuối ngày
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isInteger(h) || !Number.isInteger(m)) return AFTERNOON_END_MIN
  return h * 60 + m
}

// Chỉ số ca muộn nhất mà đơn (deadline) có thể chiếm — kẹp trong [nowIdx, lastIdx].
// Deadline quá hạn (trước cửa sổ/now) → nowIdx. Deadline sau cửa sổ → lastIdx.
function findDeadlineIndex(
  sessions: CapacitySession[],
  deadlinedate: string | null | undefined,
  deadlinetime: string | null | undefined,
  nowIdx: number,
): number {
  const lastIdx = sessions.length - 1
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec((deadlinedate ?? '').trim())
  if (!dateMatch) return lastIdx // không có deadline → đổ lùi từ cuối cửa sổ

  const dlDate = dateMatch[0]
  const dlPeriod: SessionPeriod = parseDeadlineMinutes(deadlinetime) <= MORNING_END_MIN ? 'sang' : 'chieu'

  // Khớp đúng ngày deadline trong cửa sổ.
  const exact = sessions.findIndex((s) => s.date === dlDate && s.period === dlPeriod)
  if (exact !== -1) return Math.max(nowIdx, exact)

  // Ngày deadline có trong cửa sổ nhưng là ca khác (chỉ có thể là deadline buổi sáng nhưng… đã khớp ở trên),
  // hoặc ngày deadline không phải ngày làm việc (CN) / nằm ngoài cửa sổ.
  // Lấy ca muộn nhất có date <= dlDate.
  let candidate = -1
  for (let i = 0; i < sessions.length; i += 1) {
    if (sessions[i].date <= dlDate) candidate = i
    else break
  }
  if (candidate === -1) return nowIdx // deadline trước cả cửa sổ → đổ từ now
  return Math.max(nowIdx, candidate)
}

function recalc(session: CapacitySession): void {
  session.pct = Math.round((session.filledHours / SESSION_HOURS) * 100)
  session.orderCount = new Set(session.orders.map((o) => o.pcode)).size
}

function addOrderHours(
  session: CapacitySession,
  row: DeadlineProductionPlanRow,
  hours: number,
  overtime: boolean,
  overloaded: boolean,
): void {
  if (hours <= 0) return
  session.filledHours += hours
  session.orders.push({
    pcode: row.order.pcode,
    products: row.norm?.products ?? null,
    customer: row.order.customer ?? '',
    hours: Math.round(hours * 100) / 100,
    remainingQuantity: row.order.remainingQuantity,
    norm: row.norm?.norm ?? null,
    overtime,
    overloaded,
  })
}

// Chia đều `hours` vào các ca tăng ca (chiều), cap tổng mỗi ca ở MAX_SESSION_HOURS (8h).
// Trả về phân bổ theo chỉ số ca + phần dư không nhét được (đã hết chỗ kể cả tăng ca).
function distributeOvertimeEven(
  sessions: CapacitySession[],
  targetIdxs: number[],
  hours: number,
): { alloc: Map<number, number>; leftover: number } {
  const alloc = new Map<number, number>()
  const room = new Map<number, number>()
  for (const s of targetIdxs) room.set(s, Math.max(0, MAX_SESSION_HOURS - sessions[s].filledHours))

  let pool = hours
  let active = targetIdxs.filter((s) => (room.get(s) ?? 0) > 1e-6)
  while (pool > 1e-6 && active.length > 0) {
    const share = pool / active.length
    let distributed = 0
    for (const s of active) {
      const r = room.get(s) ?? 0
      const add = Math.min(share, r)
      alloc.set(s, (alloc.get(s) ?? 0) + add)
      room.set(s, r - add)
      distributed += add
    }
    pool -= distributed
    active = active.filter((s) => (room.get(s) ?? 0) > 1e-6)
    if (distributed < 1e-9) break
  }
  return { alloc, leftover: pool }
}

// Tìm "khe Chủ nhật" trong cửa sổ: ca chiều Thứ 7 ngay trước 1 Chủ nhật bị bỏ qua (kế đó là Thứ 2).
// Cửa sổ tối đa chỉ có 1 khe như vậy. Trả về null nếu không có (vd cửa sổ kết thúc đúng Thứ 7).
function findSundayGap(sessions: CapacitySession[]): { satChieuIdx: number; mondayFirstIdx: number } | null {
  const dayCount = Math.floor(sessions.length / 2)
  for (let j = 0; j + 1 < dayCount; j += 1) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(sessions[2 * j].date)
    if (!m) continue
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    if (d.getDay() === 6) {
      // Thứ 7 có ngày làm việc kế tiếp (Thứ 2) → tồn tại 1 Chủ nhật bị bắc qua.
      return { satChieuIdx: 2 * j + 1, mondayFirstIdx: 2 * (j + 1) }
    }
  }
  return null
}

// Xếp 1 phân xưởng: đổ lùi từ ca deadline về now (cap 4h/ca); phần dư → tăng ca chia đều ca chiều
// (cap +4h/ca, tổng 8h/ca). Nếu lịch bắc qua Chủ nhật và T2–T7 đã hết tăng ca thì dùng tiếp Chủ nhật
// (tối đa 8h, chung cho ngày CN). Kể cả vậy vẫn không đủ → đánh dấu ô deadline để cảnh báo.
function fillWorkshop(sessions: CapacitySession[], rows: DeadlineProductionPlanRow[], nowIdx: number): void {
  // Đơn deadline sớm xếp trước (ưu tiên chiếm khung giờ).
  const ordered = [...rows].sort((a, b) => {
    const da = `${a.order.deadlinedate || '9999-99-99'}T${a.order.deadlinetime || '99:99'}`
    const db = `${b.order.deadlinedate || '9999-99-99'}T${b.order.deadlinetime || '99:99'}`
    return da.localeCompare(db)
  })

  const sundayGap = findSundayGap(sessions)
  let sundayRemaining = sundayGap ? MAX_SESSION_HOURS : 0 // 8h tăng ca CN, chung cho cả ngày CN
  const sundayOrders: CapacitySessionOrder[] = []

  for (const row of ordered) {
    const estimated = row.estimatedHours ?? 0
    if (estimated <= 0) continue

    const deadlineIdx = findDeadlineIndex(sessions, row.order.deadlinedate, row.order.deadlinetime, nowIdx)
    if (deadlineIdx < nowIdx) continue

    // Lịch đơn có bắc qua Chủ nhật không? (khe CN nằm trong [nowIdx..deadlineIdx]).
    const spansSunday =
      !!sundayGap && nowIdx <= sundayGap.satChieuIdx && deadlineIdx >= sundayGap.mondayFirstIdx

    // Sức chứa còn lại cho đơn này trong [nowIdx..deadlineIdx]: ca sáng tối đa 4h, ca chiều tối đa 8h.
    let totalAvail = 0
    for (let s = nowIdx; s <= deadlineIdx; s += 1) {
      const cap = sessions[s].period === 'chieu' ? MAX_SESSION_HOURS : SESSION_HOURS
      totalAvail += Math.max(0, cap - sessions[s].filledHours)
    }
    if (spansSunday) totalAvail += sundayRemaining
    const overloaded = estimated > totalAvail + 1e-6

    // 1. Đổ lùi giờ thường (cap 4h/ca) từ deadline về now.
    let hours = estimated
    for (let s = deadlineIdx; s >= nowIdx && hours > 0; s -= 1) {
      const put = Math.min(hours, Math.max(0, SESSION_HOURS - sessions[s].filledHours))
      if (put > 0) {
        addOrderHours(sessions[s], row, put, false, overloaded)
        hours -= put
      }
    }

    // 2. Phần dư → tăng ca: chia đều vào các ca CHIỀU [now..deadline], cap +4h/ca (tổng 8h).
    if (hours > 0.0001) {
      const chieuIdx: number[] = []
      for (let s = nowIdx; s <= deadlineIdx; s += 1) {
        if (sessions[s].period === 'chieu') chieuIdx.push(s)
      }
      const { alloc, leftover } = distributeOvertimeEven(sessions, chieuIdx, hours)
      for (const [s, h] of alloc) addOrderHours(sessions[s], row, h, true, overloaded)
      hours = leftover
    }

    // 3. Vẫn dư & lịch bắc qua CN & T2–T7 đã hết tăng ca → dùng tăng ca Chủ nhật (tối đa 8h, chung).
    if (hours > 0.0001 && spansSunday && sundayRemaining > 1e-6) {
      const put = Math.min(hours, sundayRemaining)
      sundayRemaining -= put
      hours -= put
      sundayOrders.push({
        pcode: row.order.pcode,
        products: row.norm?.products ?? null,
        customer: row.order.customer ?? '',
        hours: Math.round(put * 100) / 100,
        remainingQuantity: row.order.remainingQuantity,
        norm: row.norm?.norm ?? null,
        overtime: true,
        overloaded,
      })
    }

    // 4. Kể cả tăng ca (và CN) vẫn không đủ → đánh dấu ô deadline để cảnh báo "không kịp".
    if (overloaded) sessions[deadlineIdx].deadlineOverflow = true
  }

  // Gắn tăng ca Chủ nhật vào ô chiều Thứ 7 (bong bóng), không cộng vào filledHours của ca.
  if (sundayGap && sundayOrders.length > 0) {
    const sat = sessions[sundayGap.satChieuIdx]
    sat.sundayOrders = sundayOrders
    sat.sundayOvertimeHours = Math.round(sundayOrders.reduce((acc, o) => acc + o.hours, 0) * 100) / 100
  }

  for (const s of sessions) recalc(s)
}

/**
 * Dựng timeline sức chứa cho từng phân xưởng nhỏ từ các dòng kế hoạch deadline.
 * @param rows  plan.rows từ buildDeadlineProductionPlan (đã gồm remainingQuantity, estimatedHours, deadline).
 * @param now   thời điểm hiện tại (client truyền new Date(); test truyền Date cố định).
 */
export function buildProductionCapacityTimeline(
  rows: DeadlineProductionPlanRow[],
  now: Date,
  includeWorkshops?: string[],
): WorkshopCapacityRow[] {
  const byWorkshop = new Map<string, DeadlineProductionPlanRow[]>()
  // Seed các xưởng cố định (nếu có) để LUÔN hiện đủ hàng, kể cả khi không có LSX mở.
  if (includeWorkshops) {
    for (const ws of includeWorkshops) {
      if (!byWorkshop.has(ws)) byWorkshop.set(ws, [])
    }
  }
  for (const row of rows) {
    const workshop = getProductionOverviewWorkshop(row.order.workshop, row.order.description) || '—'
    const list = byWorkshop.get(workshop)
    if (list) list.push(row)
    else byWorkshop.set(workshop, [row])
  }

  const result: WorkshopCapacityRow[] = []
  for (const [workshop, wsRows] of byWorkshop) {
    const sessions = buildSessions(now)
    const nowIdx = findNowIndex(sessions, now)
    fillWorkshop(sessions, wsRows, nowIdx)
    result.push({ workshop, sessions })
  }

  // Thứ tự: theo includeWorkshops trước (giữ thứ tự cố định), phần còn lại sắp theo tên.
  const order = new Map<string, number>((includeWorkshops ?? []).map((ws, i) => [ws, i]))
  return result.sort((a, b) => {
    const ia = order.has(a.workshop) ? order.get(a.workshop)! : Number.MAX_SAFE_INTEGER
    const ib = order.has(b.workshop) ? order.get(b.workshop)! : Number.MAX_SAFE_INTEGER
    if (ia !== ib) return ia - ib
    return a.workshop.localeCompare(b.workshop, 'vi', { numeric: true, sensitivity: 'base' })
  })
}

// Màu trạng thái theo % (dùng chung UI): <50 xanh, 50-75 vàng, 75-100 đỏ, >100 tím.
export type CapacityColor = 'green' | 'yellow' | 'red' | 'purple' | 'empty'
export function capacityColor(pct: number): CapacityColor {
  if (pct <= 0) return 'empty'
  if (pct < 50) return 'green'
  if (pct < 75) return 'yellow'
  if (pct <= 100) return 'red'
  return 'purple'
}
