import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/actions/auth'
import { canAccessWorkspace, getWorkspaceScopedFilter } from '@/lib/approval/workflow'
import type { WorkshopCode, ReportMode, GroupBy, FilterBy } from '@/lib/reports/report-types'
import { WORKSHOP_CODES } from '@/lib/reports/report-types'
import type { SessionUser } from '@/types'

const VALID_GROUP_BY: GroupBy[] = ['day', 'week', 'month', 'year', 'hour']
const VALID_FILTER_BY: FilterBy[] = ['deadline', 'initialdate', 'production_date', 'completed_date']
const CANONICAL_FILTER_BY: FilterBy[] = ['deadline', 'initialdate', 'production_date']

export function normalizeReportFilterBy(value: FilterBy): FilterBy {
  return value === 'completed_date' ? 'production_date' : value
}

export async function requireAuth() {
  return getSessionUser()
}

export function resolveReportWorkshopAccess(user: SessionUser, mode: ReportMode, workshopId: WorkshopCode | null): string | null {
  const scope = getWorkspaceScopedFilter(user.role, user.workspace)
  if (scope.unrestricted) return null
  if (mode !== 'detail' || !workshopId) return 'Tài khoản giới hạn xưởng phải chọn mode=detail và workshopId hợp lệ'
  if (!canAccessWorkspace(user.role, user.workspace, workshopId)) return 'Không có quyền xem dữ liệu xưởng này'
  return null
}

export function parseReportParams(searchParams: URLSearchParams) {
  const mode       = (searchParams.get('mode') ?? 'comparison') as ReportMode
  const workshopId = searchParams.get('workshopId') as WorkshopCode | null
  const from       = searchParams.get('from') ?? dfltDate(-7)
  const to         = searchParams.get('to')   ?? dfltDate(0)
  const groupBy    = (searchParams.get('groupBy') ?? 'day') as GroupBy
  const rawFilterBy = (searchParams.get('filterBy') ?? 'deadline') as FilterBy
  const filterBy   = normalizeReportFilterBy(rawFilterBy)

  const errors: string[] = []
  if (!['detail', 'comparison'].includes(mode)) errors.push('mode phải là detail hoặc comparison')
  if (mode === 'detail' && (!workshopId || !WORKSHOP_CODES.includes(workshopId))) {
    errors.push(`workshopId bắt buộc khi mode=detail, phải là ${WORKSHOP_CODES.join('/')}`)
  }
  if (!VALID_GROUP_BY.includes(groupBy)) {
    errors.push(`groupBy không hợp lệ: "${groupBy}". Dùng: ${VALID_GROUP_BY.join(', ')}`)
  }
  if (!VALID_FILTER_BY.includes(rawFilterBy)) {
    errors.push(`filterBy không hợp lệ: "${rawFilterBy}". Dùng: ${CANONICAL_FILTER_BY.join(', ')}`)
  }
  if (!isValidDateOnly(from)) errors.push('from phải là ngày hợp lệ YYYY-MM-DD')
  if (!isValidDateOnly(to)) errors.push('to phải là ngày hợp lệ YYYY-MM-DD')
  if (isValidDateOnly(from) && isValidDateOnly(to) && from > to) errors.push('from phải nhỏ hơn hoặc bằng to')

  return {
    mode,
    workshopId: mode === 'detail' ? workshopId : null,
    from,
    to,
    groupBy,
    filterBy,
    errors,
  }
}

export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000)
}

export function errResponse(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status })
}

export function okResponse<T>(data: T, meta: object) {
  return NextResponse.json({ success: true, data, meta })
}

function dfltDate(offsetDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}
