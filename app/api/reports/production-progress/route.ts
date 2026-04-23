import { NextRequest } from 'next/server'
import { requireAuth, parseReportParams, errResponse, okResponse } from '../_shared'
import { queryProgress } from '@/lib/reports/report-queries'

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!user) return errResponse('Chưa đăng nhập', 401)

  const { mode, workshopId, from, to, groupBy, filterBy, errors } = parseReportParams(req.nextUrl.searchParams)
  if (errors.length > 0) return errResponse(errors.join('; '))

  const data = await queryProgress(workshopId, from, to, filterBy)
  return okResponse(data, { mode, from, to, groupBy, filterBy })
}
