import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errResponse, okResponse } from '@/app/api/reports/_shared'
import type { Department, PeriodType, KpiWorkshopResult } from '@/lib/kpi/types'
import { WORKSHOPS } from '@/lib/kpi/types'

const VALID_DEPARTMENTS: Department[] = ['PRODUCTION', 'MAINTENANCE', 'COORDINATION']
const VALID_PERIODS: PeriodType[] = ['weekly', 'monthly', 'quarterly', 'yearly']

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errResponse('Chưa đăng nhập', 401)

  const sp = req.nextUrl.searchParams
  const department = sp.get('department') as Department
  const period     = (sp.get('period') ?? 'monthly') as PeriodType
  const anchor     = sp.get('anchor') ?? new Date().toISOString().substring(0, 10)

  if (!VALID_DEPARTMENTS.includes(department)) {
    return errResponse(`department phải là: ${VALID_DEPARTMENTS.join(', ')}`)
  }
  if (!VALID_PERIODS.includes(period)) {
    return errResponse(`period phải là: ${VALID_PERIODS.join(', ')}`)
  }

  const { data, error } = await supabase.rpc('rpc_kpi_workshop_matrix', {
    p_department:  department,
    p_period_type: period,
    p_anchor_date: anchor,
  })

  if (error) {
    console.error('[kpi/comparison]', error)
    return errResponse('Lỗi tính KPI matrix: ' + error.message, 500)
  }

  const rows = (data ?? []) as KpiWorkshopResult[]

  // Transform flat rows → matrix: kpiCode → { workshop → result }
  const kpiCodes = [...new Set(rows.map((r) => r.kpi_code))]
  const matrix: Record<string, { kpi_name: string; target_value: number; target_operator: string; unit?: string; values: Record<string, { actual_value: number; is_achieved: boolean; achievement_pct: number; data_count: number }> }> = {}

  for (const code of kpiCodes) {
    const forCode = rows.filter((r) => r.kpi_code === code)
    matrix[code] = {
      kpi_name:        forCode[0]?.kpi_name ?? code,
      target_value:    forCode[0]?.target_value ?? 0,
      target_operator: forCode[0]?.target_operator ?? 'gte',
      values: {},
    }
    for (const r of forCode) {
      matrix[code].values[r.workshop] = {
        actual_value:    r.actual_value,
        is_achieved:     r.is_achieved,
        achievement_pct: r.achievement_pct,
        data_count:      r.data_count,
      }
    }
  }

  // Compute per-workshop rankings
  const rankings: Record<string, { achieved: number; total: number; rank: number }> = {}
  for (const ws of WORKSHOPS) {
    const total    = kpiCodes.length
    const achieved = kpiCodes.filter((c) => matrix[c]?.values[ws]?.is_achieved).length
    rankings[ws] = { achieved, total, rank: 0 }
  }
  const sorted = [...WORKSHOPS].sort((a, b) => (rankings[b].achieved - rankings[a].achieved))
  sorted.forEach((ws, i) => { rankings[ws].rank = i + 1 })

  return okResponse({ kpiCodes, matrix, rankings }, { department, period, anchor })
}
