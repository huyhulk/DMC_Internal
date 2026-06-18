import { CONSTRUCTION_WORKSHOP_CODE, normalizeWorkshop, workshopCode } from '@/lib/utils'

// Nhân sự gom theo XƯỞNG CHÍNH (kho chung), KHÔNG gán cứng xưởng nhỏ.
//   Sản xuất (feed capacity): DMC1, DMC3, DMC4, DMC5, CONG_TRINH (Công trình).
//   Phòng ban (không feed capacity): PKT-SX, DIEU-PHOI, Khác.
export const HR_PRODUCTION_GROUPS: readonly string[] = ['DMC1', 'DMC3', 'DMC4', 'DMC5', CONSTRUCTION_WORKSHOP_CODE]
export const HR_DEPARTMENT_GROUPS: readonly string[] = ['PKT-SX', 'DIEU-PHOI', 'Khác']
export const HR_GROUPS: readonly string[] = [...HR_PRODUCTION_GROUPS, ...HR_DEPARTMENT_GROUPS]

const DMC_BASES = new Set(['DMC1', 'DMC3', 'DMC4', 'DMC5'])
const PRODUCTION_SET = new Set(HR_PRODUCTION_GROUPS)

// Nhóm của 1 nhân sự = XƯỞNG CHÍNH (theo factory). Bỏ qua subshop (người là kho chung).
export function getHRGroup(person: { factory: string | null | undefined; subshop?: string | null }): string {
  const factory = (person.factory ?? '').trim()
  if (!factory) return 'Khác'
  if (factory.toUpperCase() === CONSTRUCTION_WORKSHOP_CODE || factory.toLocaleLowerCase('vi').includes('công trình')) {
    return CONSTRUCTION_WORKSHOP_CODE
  }
  const code = workshopCode(normalizeWorkshop(factory))
  if (DMC_BASES.has(code)) return code // DMC1/DMC3/DMC4/DMC5
  return factory // PKT-SX, DIEU-PHOI, Khác
}

// Nhóm có thuộc phần sản xuất (feed tab Tổng quan sản xuất) không?
export function isProductionGroup(group: string): boolean {
  return PRODUCTION_SET.has(group)
}

const GROUP_LABELS: Record<string, string> = {
  DMC1: 'DMC1 — Tôn & Phụ kiện',
  DMC3: 'DMC3 — Panel & Phụ kiện',
  DMC4: 'DMC4 — Xà gồ & Phụ kiện',
  DMC5: 'DMC5',
  [CONSTRUCTION_WORKSHOP_CODE]: 'Công trình',
  'PKT-SX': 'PKT-SX — Kỹ thuật SX',
  'DIEU-PHOI': 'Điều phối',
  'Khác': 'Khác',
}

export function getHRGroupLabel(group: string): string {
  return GROUP_LABELS[group] ?? group
}
