import { NextRequest } from 'next/server'
import { KPI_DEPARTMENTS } from '@/modules/kpi/constants'
import { queryKpiDepartmentSummary } from '@/modules/kpi/queries'
import { parseKpiParams, requireAuth, errResponse, okResponse, resolveKpiComparisonAccess } from '../_shared'

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!user) return errResponse('Chưa đăng nhập', 401)

  const { periodType, anchorDate, errors } = parseKpiParams(req.nextUrl.searchParams)
  if (errors.length > 0) return errResponse(errors.join('; '))
  const accessError = resolveKpiComparisonAccess(user)
  if (accessError) return errResponse(accessError, 403)

  const departments = await Promise.all(
    KPI_DEPARTMENTS.map((department) => queryKpiDepartmentSummary({ department, periodType, anchorDate }))
  )

  return okResponse({ departments }, { periodType, anchorDate })
}
