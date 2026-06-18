import type { HumanResource } from '@/types'
import { getHRGroup, getHRGroupLabel, HR_GROUPS, isProductionSubshop } from '@/lib/hr/groups'

// Giờ hành chính 1 ca = 4h (sáng 07:30–11:30, chiều 12:30–16:30). Tăng ca 16:30–20:30 xử lý ở capacity.
export const HR_SESSION_HOURS = 4

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
}

export interface HRSubshopGroup {
  group: string
  label: string
  isProduction: boolean // có feed tab Tổng quan sản xuất không
  members: HRMember[] // nhân sự "nhà" của xưởng (kèm trạng thái)
  transferredIn: HRMember[] // người từ xưởng khác điều chuyển ĐẾN đây hôm nay
  planHeadcount: number // định biên = số nhân sự nhà
  actualHeadcount: number // thực tế tại xưởng hôm nay = nhà đang làm + điều chuyển đến
  sessionLaborHours: number // giờ nhân công 1 ca = actualHeadcount × 4
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

/**
 * Dựng bảng nhân sự theo xưởng nhỏ + headcount/giờ nhân công.
 * @param employees  toàn bộ human_resource (đã gồm subshop).
 * @param dailyStates trạng thái ngày theo nhóm (absent/transfer). Ngày tương lai không có → mọi người "working".
 */
export function buildHRSubshopBoard(
  employees: HumanResource[],
  dailyStates: HRDailyGroupState[],
): HRSubshopGroup[] {
  const stateByGroup = new Map<string, HRDailyGroupState>()
  for (const s of dailyStates) stateByGroup.set(s.group, s)

  // Nhóm nhân sự theo "nhà" (home group).
  const homeByGroup = new Map<string, HumanResource[]>()
  for (const emp of employees) {
    const g = getHRGroup(emp)
    const list = homeByGroup.get(g)
    if (list) list.push(emp)
    else homeByGroup.set(g, [emp])
  }

  // Bản đồ điều chuyển ĐẾN: group đích → danh sách HRMember.
  const transferredInByGroup = new Map<string, HRMember[]>()

  // Trạng thái từng người (theo nhóm nhà).
  const membersByGroup = new Map<string, HRMember[]>()
  for (const [group, emps] of homeByGroup) {
    const state = stateByGroup.get(group)
    const absent = uniquePositiveIds(state?.absentIds)
    const transferById = new Map<number, HRSubshopTransfer>()
    for (const rec of state?.transferRecords ?? []) transferById.set(rec.employeeId, rec)

    const members: HRMember[] = emps.map((emp) => {
      let status: HRStatus = 'working'
      let transferTo: string | null = null
      if (absent.has(emp.id)) {
        status = 'absent'
      } else if (transferById.has(emp.id)) {
        status = 'transferred'
        transferTo = transferById.get(emp.id)!.toGroup
      }
      const member: HRMember = {
        id: emp.id,
        name: emp.name,
        position: emp.position,
        machine: emp.machine,
        homeGroup: group,
        status,
        transferTo,
        transferToLabel: transferTo ? getHRGroupLabel(transferTo) : null,
      }
      // Gom người điều chuyển đến nhóm đích.
      if (status === 'transferred' && transferTo) {
        const inList = transferredInByGroup.get(transferTo)
        if (inList) inList.push(member)
        else transferredInByGroup.set(transferTo, [member])
      }
      return member
    })
    membersByGroup.set(group, members)
  }

  // Xuất theo thứ tự cố định HR_GROUPS, rồi nhóm lạ (chưa gán / base) ở cuối.
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
    // Nếu nhóm không có người nhà lẫn người chuyển đến và không thuộc danh sách cố định → bỏ.
    if (members.length === 0 && transferredIn.length === 0 && !HR_GROUPS.includes(group)) continue

    const working = members.filter((m) => m.status === 'working').length
    const actualHeadcount = working + transferredIn.length
    result.push({
      group,
      label: getHRGroupLabel(group),
      isProduction: isProductionSubshop(group),
      members,
      transferredIn,
      planHeadcount: members.length,
      actualHeadcount,
      sessionLaborHours: actualHeadcount * HR_SESSION_HOURS,
    })
  }

  return result
}

/**
 * Headcount theo xưởng SẢN XUẤT để feed tab Tổng quan sản xuất.
 * @returns Map group → { plan, actual } chỉ cho các nhóm production (DMC1-PK… DMC5, CONG_TRINH).
 */
export function getProductionHeadcountByWorkshop(
  board: HRSubshopGroup[],
): Map<string, { plan: number; actual: number }> {
  const map = new Map<string, { plan: number; actual: number }>()
  for (const g of board) {
    if (g.isProduction) map.set(g.group, { plan: g.planHeadcount, actual: g.actualHeadcount })
  }
  return map
}
