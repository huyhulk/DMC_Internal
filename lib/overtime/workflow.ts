import { getProductionOrderStatusRank } from '@/lib/production/workflow'

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

export function getIncompleteOvertimeOrderOptions(
  rows: OvertimeOrderSourceRow[],
  workshop?: string,
  initialdate?: string
): OvertimeOrderOption[] {
  return rows
    .filter((row) => row.pcode.trim())
    .filter((row) => !workshop || row.workshop === workshop)
    .filter((row) => !initialdate || row.initialdate === initialdate)
    .filter((row) => getProductionOrderStatusRank(row.status) < 2)
    .sort((a, b) => {
      const rankDiff = getProductionOrderStatusRank(a.status) - getProductionOrderStatusRank(b.status)
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
