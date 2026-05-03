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

import { parseKpiParams } from '@/app/api/kpi/_shared'
import { parseReportParams } from '@/app/api/reports/_shared'

describe('API parameter parsing', () => {
  it('rejects impossible KPI calendar dates', () => {
    const params = new URLSearchParams({ anchorDate: '2026-99-99' })

    expect(parseKpiParams(params).errors).toContain('anchorDate phải là ngày hợp lệ YYYY-MM-DD')
  })

  it('rejects impossible report calendar dates', () => {
    const params = new URLSearchParams({ from: '2026-02-31', to: '2026-03-01' })

    expect(parseReportParams(params).errors).toContain('from phải là ngày hợp lệ YYYY-MM-DD')
  })

  it('rejects report ranges with invalid calendar ordering', () => {
    const params = new URLSearchParams({ from: '2026-05-02', to: '2026-05-01' })

    expect(parseReportParams(params).errors).toContain('from phải nhỏ hơn hoặc bằng to')
  })
})
