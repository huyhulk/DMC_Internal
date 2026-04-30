import { NextRequest } from 'next/server'
import { parseKpiParams, requireAuth, errResponse, okResponse } from '../_shared'
import { queryKpiRows } from '@/lib/kpi/queries'
import { summarizeKpiRows } from '@/lib/kpi/format'

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!user) return errResponse('Chưa đăng nhập', 401)

  const { periodType, anchorDate, workshop, errors } = parseKpiParams(req.nextUrl.searchParams, 'COORDINATION')
  if (errors.length > 0) return errResponse(errors.join('; '))

  const rows = await queryKpiRows({ department: 'COORDINATION', periodType, anchorDate, workshop })

  return okResponse(
    { rows, summary: summarizeKpiRows(rows) },
    { department: 'COORDINATION', periodType, anchorDate, workshop },
  )
}
