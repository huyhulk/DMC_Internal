import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errResponse, okResponse } from '@/app/api/reports/_shared'
import { getSessionUser } from '@/modules/auth/actions'
import { canAccessWorkspace, getWorkspaceScopedFilter } from '@/modules/approval/workflow'
import type { Department, PeriodType } from '@/modules/kpi/types'

const VALID_DEPARTMENTS: Department[] = ['PRODUCTION', 'MAINTENANCE', 'COORDINATION']
const VALID_PERIODS: PeriodType[] = ['weekly', 'monthly', 'quarterly', 'yearly']

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return errResponse('Chưa đăng nhập', 401)

  const supabase = await createClient()

  const sp = req.nextUrl.searchParams
  const department = sp.get('department') as Department
  const period     = (sp.get('period') ?? 'monthly') as PeriodType
  const anchor     = sp.get('anchor') ?? todayLocal()
  const workshop   = sp.get('workshop') ?? null

  if (!VALID_DEPARTMENTS.includes(department)) {
    return errResponse(`department phải là: ${VALID_DEPARTMENTS.join(', ')}`)
  }
  if (!VALID_PERIODS.includes(period)) {
    return errResponse(`period phải là: ${VALID_PERIODS.join(', ')}`)
  }
  const scope = getWorkspaceScopedFilter(sessionUser.role, sessionUser.workspace)
  if (!scope.unrestricted) {
    if (!workshop) return errResponse('Tài khoản giới hạn xưởng phải chọn workshop cụ thể', 403)
    if (!canAccessWorkspace(sessionUser.role, sessionUser.workspace, workshop)) return errResponse('Không có quyền xem KPI xưởng này', 403)
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

function todayLocal() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
