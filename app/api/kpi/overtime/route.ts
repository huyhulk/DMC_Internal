import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errResponse, okResponse } from '@/app/api/reports/_shared'
import { getSessionUser } from '@/modules/auth/actions'
import { canAccessWorkspace, getWorkspaceScopedFilter } from '@/modules/approval/workflow'
import type { PeriodType } from '@/modules/kpi/types'

const VALID_PERIODS: PeriodType[] = ['weekly', 'monthly', 'quarterly', 'yearly']

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return errResponse('Chưa đăng nhập', 401)

  const supabase = await createClient()

  const sp       = req.nextUrl.searchParams
  const period   = (sp.get('period') ?? 'monthly') as PeriodType
  const anchor   = sp.get('anchor') ?? todayLocal()
  const workshop = sp.get('workshop') ?? null
  const topLimit = parseInt(sp.get('top') ?? '10', 10)

  if (!VALID_PERIODS.includes(period)) {
    return errResponse(`period phải là: ${VALID_PERIODS.join(', ')}`)
  }
  const scope = getWorkspaceScopedFilter(sessionUser.role, sessionUser.workspace)
  if (!scope.unrestricted) {
    if (!workshop) return errResponse('Tài khoản giới hạn xưởng phải chọn workshop cụ thể', 403)
    if (!canAccessWorkspace(sessionUser.role, sessionUser.workspace, workshop)) return errResponse('Không có quyền xem tăng ca xưởng này', 403)
  }

  const [summaryResult, topResult] = await Promise.all([
    supabase.rpc('rpc_overtime_summary', {
      p_period_type: period,
      p_anchor_date: anchor,
      p_workshop:    workshop,
    }),
    supabase.rpc('rpc_top_overtime_employees', {
      p_period_type: period,
      p_anchor_date: anchor,
      p_limit:       topLimit,
    }),
  ])

  if (summaryResult.error) {
    console.error('[kpi/overtime summary]', summaryResult.error)
    return errResponse('Lỗi tổng hợp tăng ca: ' + summaryResult.error.message, 500)
  }

  const summary = summaryResult.data ?? []
  const totals = {
    ot_count:         summary.reduce((s: number, r: { ot_count: number }) => s + r.ot_count, 0),
    total_employees:  summary.reduce((s: number, r: { total_employees: number }) => s + r.total_employees, 0),
    total_hours:      summary.reduce((s: number, r: { total_hours: number }) => s + r.total_hours, 0),
  }

  return okResponse(
    { summary, top_employees: topResult.data ?? [], totals },
    { period, anchor, workshop }
  )
}

function todayLocal() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
