import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isKpiDepartment, isKpiWorkshop, isPeriodType } from '@/lib/kpi/constants'
import type { KpiDepartment, KpiWorkshop, PeriodType } from '@/lib/kpi/types'

export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) errors.push('anchorDate phải có định dạng YYYY-MM-DD')

  if (workshopValue && workshopValue !== 'ALL') {
    if (isKpiWorkshop(workshopValue)) {
      workshop = workshopValue
    } else {
      errors.push('workshop phải là ALL, DMC1, DMC3, DMC4, DMC5 hoặc PKT-SX')
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
