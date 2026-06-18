import { CONSTRUCTION_WORKSHOP_CODE } from '@/lib/utils'
import { PRODUCTION_OVERVIEW_WORKSHOPS } from '@/lib/production/workflow'

// Nhóm xưởng nhỏ cho tab Nhân sự (thiết kế mới). Phần sản xuất TÁI DÙNG đúng mã của tab
// "Tổng quan sản xuất" (PRODUCTION_OVERVIEW_WORKSHOPS) để headcount khớp 1-1 khi liên kết capacity.
//   Sản xuất: DMC1-PU/PK/CT, DMC3-PN/PK/CT, DMC4-XG/PK, DMC5, CONG_TRINH (Công trình).
//   Phòng ban (không feed capacity): PKT-SX, DIEU-PHOI, Khác.
export const HR_PRODUCTION_SUBSHOPS: readonly string[] = PRODUCTION_OVERVIEW_WORKSHOPS
export const HR_DEPARTMENT_GROUPS: readonly string[] = ['PKT-SX', 'DIEU-PHOI', 'Khác']
export const HR_GROUPS: readonly string[] = [...HR_PRODUCTION_SUBSHOPS, ...HR_DEPARTMENT_GROUPS]

const SUBSHOP_SET = new Set(HR_PRODUCTION_SUBSHOPS)

// Nhóm của 1 nhân sự: ưu tiên subshop đã gán; nếu chưa gán thì suy từ factory.
// Người DMC1/3/4 chưa gán subshop → trả về base ('DMC1'…) như nhóm "chưa gán".
export function getHRGroup(person: { factory: string | null | undefined; subshop?: string | null }): string {
  const sub = (person.subshop ?? '').trim()
  if (sub && SUBSHOP_SET.has(sub)) return sub

  const factory = (person.factory ?? '').trim()
  if (!factory) return 'Khác'
  if (factory.toUpperCase() === CONSTRUCTION_WORKSHOP_CODE || factory.toLocaleLowerCase('vi').includes('công trình')) {
    return CONSTRUCTION_WORKSHOP_CODE
  }
  return factory // 'DMC5', 'PKT-SX', 'DIEU-PHOI', 'Khác', hoặc base chưa gán ('DMC1'/'DMC3'/'DMC4')
}

// Một nhóm có thuộc phần sản xuất (feed tab Tổng quan sản xuất / capacity) không?
export function isProductionSubshop(group: string): boolean {
  return SUBSHOP_SET.has(group)
}

const DEPARTMENT_LABELS: Record<string, string> = {
  'PKT-SX': 'PKT-SX — Kỹ thuật SX',
  'DIEU-PHOI': 'Điều phối',
  'Khác': 'Khác',
}

// Nhãn hiển thị của 1 nhóm: 'DMC1-PK' → 'DMC1 · PK', 'CONG_TRINH' → 'Công trình', phòng ban → nhãn riêng.
export function getHRGroupLabel(group: string): string {
  if (group === CONSTRUCTION_WORKSHOP_CODE) return 'Công trình'
  if (DEPARTMENT_LABELS[group]) return DEPARTMENT_LABELS[group]
  const match = /^(DMC\d)-(.+)$/.exec(group)
  if (match) return `${match[1]} · ${match[2]}`
  return group
}
