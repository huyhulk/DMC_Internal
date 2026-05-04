import { NextRequest } from 'next/server'
import { requireAuth, errResponse, okResponse } from '../../_shared'
import { getWorkspaceScopedFilter } from '@/lib/approval/workflow'
import { queryRanking } from '@/lib/reports/report-queries'

const VALID_METRICS = ['oee', 'quality', 'output', 'progress'] as const

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!user) return errResponse('Chưa đăng nhập', 401)

  const params  = req.nextUrl.searchParams
  const metric  = params.get('metric') ?? 'oee'
  const from    = params.get('from')   ?? dfltDate(-7)
  const to      = params.get('to')     ?? dfltDate(0)
  const scope = getWorkspaceScopedFilter(user.role, user.workspace)
  if (!scope.unrestricted) return errResponse('Tài khoản giới hạn xưởng không có quyền xem xếp hạng toàn bộ xưởng', 403)

  if (!VALID_METRICS.includes(metric as typeof VALID_METRICS[number])) {
    return errResponse('metric phải là oee | quality | output | progress')
  }

  const data = await queryRanking(metric, from, to)
  return okResponse(data, { metric, from, to })
}

function dfltDate(offsetDays: number) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
