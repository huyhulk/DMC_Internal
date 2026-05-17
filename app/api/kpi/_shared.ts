import { NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/actions'
import { canAccessWorkspace, getWorkspaceScopedFilter } from '@/modules/approval/workflow'
import { isKpiDepartment, isKpiWorkshop, isPeriodType } from '@/modules/kpi/constants'
import type { KpiDepartment, KpiWorkshop, PeriodType } from '@/modules/kpi/types'
import type { SessionUser } from '@/types'

export async function requireAuth() {
  return getSessionUser()
}

export function resolveKpiWorkshopAccess(user: SessionUser, workshop: KpiWorkshop | null): string | null {
  const scope = getWorkspaceScopedFilter(user.role, user.workspace)
  if (scope.unrestricted) return null
  if (!workshop) return 'Tài khoản giới hạn xưởng phải chọn workshop cụ thể'
  if (!canAccessWorkspace(user.role, user.workspace, workshop)) return 'Không có quyền xem KPI xưởng này'
  return null
}

export function resolveKpiComparisonAccess(user: SessionUser): string | null {
  const scope = getWorkspaceScopedFilter(user.role, user.workspace)
  return scope.unrestricted ? null : 'Tài khoản giới hạn xưởng không có quyền xem so sánh toàn bộ xưởng'
}

export function errResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export function okResponse<T>(data: T, meta: object = {}) {
  return NextResponse.json({ success: true, data, meta })
}

export function parseKpiParams(searchParams: URLSearchParams, defaultDepartment?: KpiDepartment) {
  const periodValue     = searchParams.get('periodType') ?? searchParams.get('period') ?? 'monthly'
  const anchorDate      = searchParams.get('anchorDate') ?? searchParams.get('anchor') ?? todayLocal()
  const departmentValue = searchParams.get('department') ?? defaultDepartment ?? 'PRODUCTION'
  const workshopValue   = searchParams.get('workshop')

  const errors: string[] = []
  const periodType: PeriodType   = isPeriodType(periodValue)     ? periodValue     : 'monthly'
  const department: KpiDepartment = isKpiDepartment(departmentValue) ? departmentValue : 'PRODUCTION'
  let workshop: KpiWorkshop | null = null

  if (!isPeriodType(periodValue))     errors.push('periodType phải là weekly, monthly, quarterly hoặc yearly')
  if (!isKpiDepartment(departmentValue)) errors.push('department phải là PRODUCTION, MAINTENANCE hoặc COORDINATION')
  if (!isValidDateOnly(anchorDate)) errors.push('anchorDate phải là ngày hợp lệ YYYY-MM-DD')

  if (workshopValue && workshopValue !== 'ALL') {
    if (isKpiWorkshop(workshopValue)) {
      workshop = workshopValue
    } else {
      errors.push('workshop phải là ALL, DMC1, DMC3, DMC4 hoặc DMC5')
    }
  }

  return { periodType, anchorDate, department, workshop, errors }
}

function todayLocal() {
  const date = new Date()
  const year  = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day   = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}
