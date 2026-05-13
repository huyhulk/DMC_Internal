const mockCreateClient = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

import { queryProgress } from '@/lib/reports/report-queries'

describe('queryProgress RPC path', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses the Supabase progress RPC and skips legacy table queries when the RPC is available', async () => {
    const mockRpc = jest.fn().mockResolvedValue({
      data: [{
        pcode: 'LSX-001',
        workshop: 'DMC1',
        description: 'Khung thép',
        customer: 'DMC',
        quantity: 100,
        initialdate: '2026-05-01',
        deadlinedate: '2026-05-12T10:00:00',
        source_status: '',
        production_rows: [
          { pcode: 'LSX-001', poutput: 40, pdate: '2026-05-08', endtime: '15:00', save_status: null },
          { pcode: 'LSX-001', poutput: 60, pdate: '2026-05-09', endtime: '16:00', save_status: null },
        ],
        period_production_rows: null,
      }],
      error: null,
    })
    const mockFrom = jest.fn(() => {
      throw new Error('legacy Supabase table path should not run when RPC succeeds')
    })
    mockCreateClient.mockResolvedValue({ rpc: mockRpc, from: mockFrom })

    const result = await queryProgress('DMC1', '2026-05-01', '2026-05-31', 'deadline')

    expect(mockRpc).toHaveBeenCalledWith('rpc_fetch_progress_rows', {
      p_from: '2026-05-01',
      p_to: '2026-05-31',
      p_workshop_code: 'DMC1',
      p_filter_by: 'deadline',
    })
    expect(mockFrom).not.toHaveBeenCalled()
    expect(result.summary).toEqual({
      workshop: 'DMC1',
      total: 1,
      completed: 1,
      completedOnTime: 1,
      completedLate: 0,
      overdue: 0,
      dueSoon: 0,
      progressPct: 100,
    })
    expect(result.orders).toEqual([expect.objectContaining({
      pcode: 'LSX-001',
      workshop: 'DMC1',
      totalOutput: 100,
      periodOutput: 100,
      productionDate: '2026-05-09',
      status: 'completed',
      completionPct: 100,
      completionAt: '2026-05-09T16:00:00',
      deadlinedate: '2026-05-12',
      deadlinetime: '10:00',
    })])
  })


  it('excludes empty or unknown workshops returned by the progress RPC', async () => {
    const mockRpc = jest.fn().mockResolvedValue({
      data: [
        {
          pcode: 'LSX-003',
          workshop: 'DMC1',
          description: 'Khung thép',
          customer: 'DMC',
          quantity: 100,
          initialdate: '2026-05-01',
          deadlinedate: '2026-05-12T10:00:00',
          source_status: '',
          production_rows: [
            { pcode: 'LSX-003', poutput: 100, pdate: '2026-05-08', endtime: '15:00', save_status: null },
          ],
          period_production_rows: null,
        },
        {
          pcode: 'LSX-004',
          workshop: '',
          description: 'Vật tư',
          customer: 'DMC',
          quantity: 50,
          initialdate: '2026-05-01',
          deadlinedate: '2026-05-12T10:00:00',
          source_status: '',
          production_rows: [
            { pcode: 'LSX-004', poutput: 50, pdate: '2026-05-08', endtime: '15:00', save_status: null },
          ],
          period_production_rows: null,
        },
        {
          pcode: 'LSX-005',
          workshop: 'Kho vật tư',
          description: 'Vật tư',
          customer: 'DMC',
          quantity: 75,
          initialdate: '2026-05-01',
          deadlinedate: '2026-05-12T10:00:00',
          source_status: '',
          production_rows: [
            { pcode: 'LSX-005', poutput: 75, pdate: '2026-05-08', endtime: '15:00', save_status: null },
          ],
          period_production_rows: null,
        },
      ],
      error: null,
    })
    mockCreateClient.mockResolvedValue({ rpc: mockRpc, from: jest.fn() })

    const result = await queryProgress('DMC1', '2026-05-01', '2026-05-31', 'deadline')

    expect(result.summary).toEqual(expect.objectContaining({
      workshop: 'DMC1',
      total: 1,
      completed: 1,
      progressPct: 100,
    }))
    expect(result.orders).toEqual([expect.objectContaining({ pcode: 'LSX-003', workshop: 'DMC1' })])
  })
})
