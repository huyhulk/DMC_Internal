import { NextRequest } from 'next/server'
import { requireAuth, parseReportParams, errResponse, okResponse, daysBetween, resolveReportWorkshopAccess } from '../_shared'
import { queryQuality } from '@/modules/reports/report-queries'

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!user) return errResponse('Chưa đăng nhập', 401)

  const { mode, workshopId, from, to, groupBy, errors } = parseReportParams(req.nextUrl.searchParams)
  if (errors.length > 0) return errResponse(errors.join('; '))
  const accessError = resolveReportWorkshopAccess(user, mode, workshopId)
  if (accessError) return errResponse(accessError, 403)

  if (groupBy === 'hour' && daysBetween(from, to) > 7) {
    return errResponse('groupBy=hour chỉ áp dụng cho khoảng ≤ 7 ngày')
  }

  const data = await queryQuality(workshopId, from, to, groupBy)
  return okResponse(data, { mode, from, to, groupBy })
}
