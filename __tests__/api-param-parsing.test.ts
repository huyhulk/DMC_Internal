jest.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

import { parseKpiParams, resolveKpiComparisonAccess } from '@/app/api/kpi/_shared'
import { parseReportParams, resolveReportWorkshopAccess } from '@/app/api/reports/_shared'

describe('API parameter parsing', () => {
  it('rejects impossible KPI calendar dates', () => {
    const params = new URLSearchParams({ anchorDate: '2026-99-99' })

    expect(parseKpiParams(params).errors).toContain('anchorDate phải là ngày hợp lệ YYYY-MM-DD')
  })

  it('rejects invalid KPI workshops with the current allowed list', () => {
    const params = new URLSearchParams({ workshop: 'PKT-SX' })

    expect(parseKpiParams(params).errors).toContain('workshop phải là ALL, DMC1, DMC3, DMC4, DMC5, CONG_TRINH')
  })

  it('accepts construction site KPI workshop', () => {
    const params = new URLSearchParams({ workshop: 'CONG_TRINH' })

    const result = parseKpiParams(params)

    expect(result.workshop).toBe('CONG_TRINH')
    expect(result.errors).not.toEqual(expect.arrayContaining([expect.stringContaining('workshop phải là')]))
  })

  it('accepts construction site report detail workshop', () => {
    const params = new URLSearchParams({ mode: 'detail', workshopId: 'CONG_TRINH' })

    const result = parseReportParams(params)

    expect(result.workshopId).toBe('CONG_TRINH')
    expect(result.errors).not.toEqual(expect.arrayContaining([expect.stringContaining('workshopId bắt buộc')]))
  })

  it('rejects impossible report calendar dates', () => {
    const params = new URLSearchParams({ from: '2026-02-31', to: '2026-03-01' })

    expect(parseReportParams(params).errors).toContain('from phải là ngày hợp lệ YYYY-MM-DD')
  })

  it('rejects report ranges with invalid calendar ordering', () => {
    const params = new URLSearchParams({ from: '2026-05-02', to: '2026-05-01' })

    expect(parseReportParams(params).errors).toContain('from phải nhỏ hơn hoặc bằng to')
  })

  it('blocks global KPI summary/comparison for workspace-scoped users', () => {
    expect(resolveKpiComparisonAccess({ id: 'u1', username: 'u', email: 'u@dmc.local', role: 'TEAM_LEADER', workspace: 'DMC1' })).toBe(
      'Tài khoản giới hạn xưởng không có quyền xem so sánh toàn bộ xưởng'
    )
    expect(resolveKpiComparisonAccess({ id: 'a1', username: 'a', email: 'a@dmc.local', role: 'ADMIN', workspace: '' })).toBeNull()
  })

  it('requires report detail mode for workspace-scoped users', () => {
    const user = { id: 'u1', username: 'u', email: 'u@dmc.local', role: 'TEAM_LEADER' as const, workspace: 'DMC1' }

    expect(resolveReportWorkshopAccess(user, 'comparison', null)).toBe(
      'Tài khoản giới hạn xưởng phải chọn mode=detail và workshopId hợp lệ'
    )
    expect(resolveReportWorkshopAccess(user, 'detail', 'DMC3')).toBe('Không có quyền xem dữ liệu xưởng này')
    expect(resolveReportWorkshopAccess(user, 'detail', 'DMC1')).toBeNull()
    expect(resolveReportWorkshopAccess({ ...user, workspace: 'CONG_TRINH' }, 'detail', 'CONG_TRINH')).toBeNull()
  })
})
