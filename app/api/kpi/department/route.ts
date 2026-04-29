import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errResponse, okResponse } from '@/app/api/reports/_shared'
import type { Department, PeriodType } from '@/lib/kpi/types'

const VALID_DEPARTMENTS: Department[] = ['PRODUCTION', 'MAINTENANCE', 'COORDINATION']
const VALID_PERIODS: PeriodType[] = ['weekly', 'monthly', 'quarterly', 'yearly']

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errResponse('Chưa đăng nhập', 401)

  const sp = req.nextUrl.searchParams
  const department = sp.get('department') as Department
  const period     = (sp.get('period') ?? 'monthly') as PeriodType
  const anchor     = sp.get('anchor') ?? new Date().toISOString().substring(0, 10)
  const workshop   = sp.get('workshop') ?? null

  if (!VALID_DEPARTMENTS.includes(department)) {
    return errResponse(`department phải là: ${VALID_DEPARTMENTS.join(', ')}`)
  }
  if (!VALID_PERIODS.includes(period)) {
    return errResponse(`period phải là: ${VALID_PERIODS.join(', ')}`)
  }

  const { data, error } = await supabase.rpc('rpc_calculate_kpi', {
    p_department:  department,
    p_period_type: period,
    p_anchor_date: anchor,
    p_workshop:    workshop,
  })

  if (error) {
    console.error('[kpi/department]', error)
    return errResponse('Lỗi tính KPI: ' + error.message, 500)
  }

  const achieved = (data ?? []).filter((r: { is_achieved: boolean }) => r.is_achieved).length
  return okResponse(data ?? [], {
    department, period, anchor, workshop,
    total: (data ?? []).length,
    achieved,
  })
}
