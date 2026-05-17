import { NextRequest } from 'next/server'
import { parseKpiParams, requireAuth, errResponse, okResponse, resolveKpiWorkshopAccess } from '../_shared'
import { queryKpiTrend, queryProductionKpiRows } from '@/modules/kpi/queries'
import { summarizeKpiRows } from '@/modules/kpi/format'

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!user) return errResponse('Chưa đăng nhập', 401)

  const { periodType, anchorDate, workshop, errors } = parseKpiParams(req.nextUrl.searchParams, 'PRODUCTION')
  if (errors.length > 0) return errResponse(errors.join('; '))
  const accessError = resolveKpiWorkshopAccess(user, workshop)
  if (accessError) return errResponse(accessError, 403)

  const rows = await queryProductionKpiRows({ periodType, anchorDate, workshop })
  const trends = await Promise.all(
    rows.map((row) =>
      queryKpiTrend({ kpiCode: row.kpi_code, periodType, anchorDate, count: 6, workshop })
        .then((points) => [row.kpi_code, points] as const)
    )
  )

  return okResponse(
    { rows, summary: summarizeKpiRows(rows), trends: Object.fromEntries(trends) },
    { department: 'PRODUCTION', periodType, anchorDate, workshop },
  )
}
