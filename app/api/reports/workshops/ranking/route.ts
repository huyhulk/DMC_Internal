import { NextRequest } from 'next/server'
import { requireAuth, errResponse, okResponse } from '../../_shared'
import { queryRanking } from '@/lib/reports/report-queries'

const VALID_METRICS = ['oee', 'quality', 'output', 'progress'] as const

export async function GET(req: NextRequest) {
  const user = await requireAuth()
  if (!user) return errResponse('Chưa đăng nhập', 401)

  const params  = req.nextUrl.searchParams
  const metric  = params.get('metric') ?? 'oee'
  const from    = params.get('from')   ?? new Date(Date.now() - 7 * 86_400_000).toISOString().substring(0, 10)
  const to      = params.get('to')     ?? new Date().toISOString().substring(0, 10)

  if (!VALID_METRICS.includes(metric as typeof VALID_METRICS[number])) {
    return errResponse('metric phải là oee | quality | output | progress')
  }

  const data = await queryRanking(metric, from, to)
  return okResponse(data, { metric, from, to })
}
