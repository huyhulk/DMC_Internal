import type { HumanResource } from '@/types'
import { getHRGroup, getHRGroupLabel, HR_GROUPS, isProductionSubshop } from '@/lib/hr/groups'

// Khung giờ hành chính: ca sáng 07:30–11:30 (4h), ca chiều 12:30–16:30 (4h). Tăng ca 16:30–20:30 xử lý ở capacity.
export const HR_SESSION_HOURS = 4
const MORNING = { start: 7 * 60 + 30, end: 11 * 60 + 30 } // 450–690
const AFTERNOON = { start: 12 * 60 + 30, end: 16 * 60 + 30 } // 750–990

export type HRStatus = 'working' | 'transferred' | 'absent'

export interface HRMember {
  id: number
  name: string
  position: string | null
  machine: string | null
  homeGroup: string
  status: HRStatus
  transferTo: string | null // nhóm điều chuyển đến (khi status='transferred')
  transferToLabel: string | null
  transferStart: string | null // mốc giờ điều chuyển (HH:mm)
  // Giờ nhân công của người này TẠI nhóm đang xét (nhà: giờ ở nhà; điều chuyển-đến: giờ ở xưởng đến).
  morningHours: number
  afternoonHours: number
}

export interface HRSubshopGroup {
  group: string
  label: string
  isProduction: boolean // có feed tab Tổng quan sản xuất không
  members: HRMember[] // nhân sự "nhà" của xưởng (kèm trạng thái + giờ tại nhà)
  transferredIn: HRMember[] // người từ xưởng khác điều chuyển ĐẾN đây hôm nay (kèm giờ tại đây)
  planHeadcount: number // định biên = số nhân sự nhà
  actualHeadcount: number // số người thực tế có mặt (nhà làm cả ngày + điều chuyển đến)
  laborHoursMorning: number // giờ nhân công ca sáng = tổng giờ mọi người làm tại xưởng trong 07:30–11:30
  laborHoursAfternoon: number // giờ nhân công ca chiều (12:30–16:30)
}

// Điều chuyển theo xưởng nhỏ (nhóm = chuỗi mã 'DMC1-PK'…). Lưu JSON trong hr_daily.transfer_records.
export interface HRSubshopTransfer {
  employeeId: number
  fromGroup: string
  toGroup: string
  startTime: string
  endTime: string
}

// hr_daily theo xưởng nhỏ: cột factory = mã nhóm (DMC1-PK…), absent_ids/transfer_records của nhóm đó.
export interface HRDailyGroupState {
  group: string
  absentIds: number[]
  transferRecords: HRSubshopTransfer[]
}

function uniquePositiveIds(ids: number[] | null | undefined): Set<number> {
  return new Set((ids ?? []).filter((id) => Number.isInteger(id) && id > 0))
}

function parseHM(value: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec((value ?? '').trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Số giờ của khoảng [startMin, endMin] giao với 1 ca (đơn vị giờ).
function hoursInSession(startMin: number, endMin: number, session: { start: number; end: number }): number {
  return Math.max(0, Math.min(endMin, session.end) - Math.max(startMin, session.start)) / 60
}

/**
 * Dựng bảng nhân sự theo xưởng nhỏ + giờ nhân công theo TỪNG CA.
 * Điều chuyển tính theo GIỜ THỰC: xưởng nhà nhận [07:30 → mốc điều chuyển], xưởng đến nhận [mốc → kết thúc (16:30)].
 * @param employees  toàn bộ human_resource (đã gồm subshop).
 * @param dailyStates trạng thái ngày theo nhóm (absent/transfer). Ngày tương lai không có → mọi người "working".
 */
export function buildHRSubshopBoard(
  employees: HumanResource[],
  dailyStates: HRDailyGroupState[],
): HRSubshopGroup[] {
  const stateByGroup = new Map<string, HRDailyGroupState>()
  for (const s of dailyStates) stateByGroup.set(s.group, s)

  const homeByGroup = new Map<string, HumanResource[]>()
  for (const emp of employees) {
    const g = getHRGroup(emp)
    const list = homeByGroup.get(g)
    if (list) list.push(emp)
    else homeByGroup.set(g, [emp])
  }

  const transferredInByGroup = new Map<string, HRMember[]>()
  const membersByGroup = new Map<string, HRMember[]>()

  for (const [group, emps] of homeByGroup) {
    const state = stateByGroup.get(group)
    const absent = uniquePositiveIds(state?.absentIds)
    const transferById = new Map<number, HRSubshopTransfer>()
    for (const rec of state?.transferRecords ?? []) transferById.set(rec.employeeId, rec)

    const members: HRMember[] = emps.map((emp) => {
      const base: HRMember = {
        id: emp.id,
        name: emp.name,
        position: emp.position,
        machine: emp.machine,
        homeGroup: group,
        status: 'working',
        transferTo: null,
        transferToLabel: null,
        transferStart: null,
        morningHours: HR_SESSION_HOURS,
        afternoonHours: HR_SESSION_HOURS,
      }

      if (absent.has(emp.id)) {
        return { ...base, status: 'absent', morningHours: 0, afternoonHours: 0 }
      }

      const transfer = transferById.get(emp.id)
      if (transfer) {
        const tStart = parseHM(transfer.startTime) ?? MORNING.start
        const tEnd = parseHM(transfer.endTime) ?? AFTERNOON.end
        // Tại nhà: làm từ đầu ngày (07:30) đến mốc điều chuyển.
        const homeMorning = round2(hoursInSession(MORNING.start, tStart, MORNING))
        const homeAfternoon = round2(hoursInSession(MORNING.start, tStart, AFTERNOON))
        // Tại xưởng đến: từ mốc điều chuyển đến hết (16:30 hoặc giờ kết thúc).
        const destMorning = round2(hoursInSession(tStart, tEnd, MORNING))
        const destAfternoon = round2(hoursInSession(tStart, tEnd, AFTERNOON))

        const transferred: HRMember = {
          ...base,
          status: 'transferred',
          transferTo: transfer.toGroup,
          transferToLabel: getHRGroupLabel(transfer.toGroup),
          transferStart: transfer.startTime,
          morningHours: homeMorning,
          afternoonHours: homeAfternoon,
        }

        const inList = transferredInByGroup.get(transfer.toGroup)
        const incoming: HRMember = { ...transferred, morningHours: destMorning, afternoonHours: destAfternoon }
        if (inList) inList.push(incoming)
        else transferredInByGroup.set(transfer.toGroup, [incoming])

        return transferred
      }

      return base
    })
    membersByGroup.set(group, members)
  }

  const orderedGroups = [
    ...HR_GROUPS,
    ...[...homeByGroup.keys()].filter((g) => !HR_GROUPS.includes(g)).sort(),
  ]
  const seen = new Set<string>()

  const result: HRSubshopGroup[] = []
  for (const group of orderedGroups) {
    if (seen.has(group)) continue
    seen.add(group)
    const members = membersByGroup.get(group) ?? []
    const transferredIn = transferredInByGroup.get(group) ?? []
    if (members.length === 0 && transferredIn.length === 0 && !HR_GROUPS.includes(group)) continue

    const laborHoursMorning = round2(
      members.reduce((acc, m) => acc + m.morningHours, 0) + transferredIn.reduce((acc, m) => acc + m.morningHours, 0),
    )
    const laborHoursAfternoon = round2(
      members.reduce((acc, m) => acc + m.afternoonHours, 0) + transferredIn.reduce((acc, m) => acc + m.afternoonHours, 0),
    )
    const working = members.filter((m) => m.status === 'working').length

    result.push({
      group,
      label: getHRGroupLabel(group),
      isProduction: isProductionSubshop(group),
      members,
      transferredIn,
      planHeadcount: members.length,
      actualHeadcount: working + transferredIn.length,
      laborHoursMorning,
      laborHoursAfternoon,
    })
  }

  return result
}

/**
 * Giờ nhân công theo ca của các xưởng SẢN XUẤT để feed tab Tổng quan sản xuất (Phase 2).
 * @returns Map group → { planHeadcount, morning, afternoon }.
 */
export function getProductionLaborHoursByWorkshop(
  board: HRSubshopGroup[],
): Map<string, { planHeadcount: number; morning: number; afternoon: number }> {
  const map = new Map<string, { planHeadcount: number; morning: number; afternoon: number }>()
  for (const g of board) {
    if (g.isProduction) {
      map.set(g.group, { planHeadcount: g.planHeadcount, morning: g.laborHoursMorning, afternoon: g.laborHoursAfternoon })
    }
  }
  return map
}
