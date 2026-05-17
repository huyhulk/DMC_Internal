import { NextRequest } from 'next/server'
import { requireAuth, parseReportParams, errResponse, okResponse, resolveReportWorkshopAccess } from '../_shared'
import { queryProgress } from '@/modules/reports/report-queries'

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!user) return errResponse('Chưa đăng nhập', 401)

  const { mode, workshopId, from, to, groupBy, filterBy, errors } = parseReportParams(req.nextUrl.searchParams)
  if (errors.length > 0) return errResponse(errors.join('; '))
  const accessError = resolveReportWorkshopAccess(user, mode, workshopId)
  if (accessError) return errResponse(accessError, 403)

  const data = await queryProgress(workshopId, from, to, filterBy)
  return okResponse(data, { mode, from, to, groupBy, filterBy })
}
