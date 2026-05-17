import { normalizeProductionStatus } from '@/modules/production/status'

export type OvertimeOrderSourceRow = {
  pcode: string
  customer: string
  workshop: string
  status: string
  quantity?: string
  initialdate?: string | null
}

export type OvertimeOrderOption = OvertimeOrderSourceRow

export type OvertimeEmployeeSourceRow = {
  id: number
  name: string
  factory: string | null
}

export type OvertimeEmployeeOption = {
  id: number
  name: string
}

function getOvertimeOrderStatusRank(status: string): number {
  const normalized = normalizeProductionStatus(status)

  if (normalized.includes('dang sx') || normalized.includes('dang san xuat')) return 0
  if (normalized.includes('chua sx') || normalized.includes('chua san xuat') || normalized === '') return 1
  return 2
}

export function getIncompleteOvertimeOrderOptions(
  rows: OvertimeOrderSourceRow[],
  workshop?: string,
  initialdate?: string
): OvertimeOrderOption[] {
  return rows
    .filter((row) => row.pcode.trim())
    .filter((row) => !workshop || row.workshop === workshop)
    .filter((row) => !initialdate || row.initialdate === initialdate)
    .filter((row) => getOvertimeOrderStatusRank(row.status) < 2)
    .sort((a, b) => {
      const rankDiff = getOvertimeOrderStatusRank(a.status) - getOvertimeOrderStatusRank(b.status)
      if (rankDiff !== 0) return rankDiff
      return a.pcode.localeCompare(b.pcode, 'vi', { numeric: true, sensitivity: 'base' })
    })
}

export function getOvertimeEmployeeOptions(
  rows: OvertimeEmployeeSourceRow[],
  workshop: string
): OvertimeEmployeeOption[] {
  return rows
    .filter((row) => row.factory === workshop)
    .map((row) => ({ id: row.id, name: row.name.trim() }))
    .filter((row) => row.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true, sensitivity: 'base' }))
}
