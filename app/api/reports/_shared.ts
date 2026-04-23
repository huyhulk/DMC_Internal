import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { WorkshopCode, ReportMode, GroupBy } from '@/lib/reports/report-types'
import { WORKSHOP_CODES } from '@/lib/reports/report-types'

const VALID_GROUP_BY: GroupBy[] = ['day', 'week', 'month', 'year']

export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
}

export function parseReportParams(searchParams: URLSearchParams) {
  const mode       = (searchParams.get('mode') ?? 'comparison') as ReportMode
  const workshopId = searchParams.get('workshopId') as WorkshopCode | null
  const from       = searchParams.get('from') ?? dfltDate(-7)
  const to         = searchParams.get('to')   ?? dfltDate(0)
  const groupBy    = (searchParams.get('groupBy') ?? 'day') as GroupBy

  const errors: string[] = []
  if (!['detail', 'comparison'].includes(mode)) errors.push('mode phải là detail hoặc comparison')
  if (mode === 'detail' && (!workshopId || !WORKSHOP_CODES.includes(workshopId))) {
    errors.push('workshopId bắt buộc khi mode=detail, phải là DMC1/DMC3/DMC4/DMC5')
  }
  if (!VALID_GROUP_BY.includes(groupBy as GroupBy)) {
    errors.push(`groupBy không hợp lệ: "${groupBy}". Dùng: ${VALID_GROUP_BY.join(', ')}`)
  }
  if (from > to) errors.push('from phải nhỏ hơn hoặc bằng to')

  return {
    mode,
    workshopId: mode === 'detail' ? workshopId : null,
    from,
    to,
    groupBy,
    errors,
  }
}

export function errResponse(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status })
}

export function okResponse<T>(data: T, meta: object) {
  return NextResponse.json({ success: true, data, meta })
}

function dfltDate(offsetDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().substring(0, 10)
}
