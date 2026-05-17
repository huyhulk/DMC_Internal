import { NextRequest } from 'next/server'
import { parseKpiParams, requireAuth, errResponse, okResponse, resolveKpiComparisonAccess } from '../_shared'
import { queryKpiComparison, queryProductionKpiComparison } from '@/modules/kpi/queries'

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!user) return errResponse('Chưa đăng nhập', 401)

  const { department, periodType, anchorDate, errors } = parseKpiParams(req.nextUrl.searchParams, 'PRODUCTION')
  if (errors.length > 0) return errResponse(errors.join('; '))
  const accessError = resolveKpiComparisonAccess(user)
  if (accessError) return errResponse(accessError, 403)

  const data = department === 'PRODUCTION'
    ? await queryProductionKpiComparison({ periodType, anchorDate })
    : await queryKpiComparison({ department, periodType, anchorDate })

  return okResponse(data, { department, periodType, anchorDate })
}
