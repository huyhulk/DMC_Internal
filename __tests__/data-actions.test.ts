const mockCreateClient = jest.fn()
const mockGetCachedNorms = jest.fn()
const mockGetCachedMaterials = jest.fn()
const mockGetOpenProductionOrdersQueryWindow = jest.fn()
const mockLoggerError = jest.fn()
const mockRequireTabView = jest.fn()

let mockLte: jest.Mock
let mockOr: jest.Mock
let mockDataIn: jest.Mock
let mockDataOrder: jest.Mock
let mockDataRange: jest.Mock
let mockStatusIn: jest.Mock
let mockProductionIn: jest.Mock
let mockHistoryGte: jest.Mock
let mockHistoryLte: jest.Mock
let mockHistoryOrder: jest.Mock
let mockHistoryLimit: jest.Mock
let currentDataRows: Array<Record<string, unknown>>
let currentStatusRows: Array<Record<string, unknown>>
let currentProductionRows: Array<Record<string, unknown>>
let currentHistoryRows: Array<Record<string, unknown>>

jest.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
  unstable_cache: (fn: unknown) => fn,
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

jest.mock('@/lib/db/queries', () => ({
  getCachedNorms: mockGetCachedNorms,
  getCachedMaterials: mockGetCachedMaterials,
}))

jest.mock('@/lib/permissions/server', () => ({
  requireTabEdit: jest.fn(),
  requireTabView: mockRequireTabView,
}))

jest.mock('@/lib/production/workflow', () => {
  const actual = jest.requireActual('@/lib/production/workflow')
  return {
    ...actual,
    getOpenProductionOrdersQueryWindow: mockGetOpenProductionOrdersQueryWindow,
  }
})

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    error: mockLoggerError,
    info: jest.fn(),
    warn: jest.fn(),
  },
}))

import { getOpenProductionOrdersAction, listProductionInputHistoryAction } from '@/lib/actions/data'

describe('data actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    currentDataRows = []
    currentStatusRows = []
    currentProductionRows = []
    currentHistoryRows = []

    mockGetCachedNorms.mockResolvedValue([])
    mockGetCachedMaterials.mockResolvedValue([])
    mockGetOpenProductionOrdersQueryWindow.mockReturnValue({
      today: '2026-05-09',
      fromDate: '2026-04-01',
      deadlineFrom: '2026-05-07',
    })
    mockRequireTabView.mockResolvedValue({ role: 'admin', workspace: 'ALL' })

    const mockSingle = jest.fn().mockResolvedValue({
      data: { role: 'admin', workspace: 'DMC1' },
    })
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle })
    const mockProfilesSelect = jest.fn().mockReturnValue({ eq: mockEq })

    mockOr = jest.fn().mockImplementation(() => Promise.resolve({ data: currentDataRows, error: null }))
    mockDataIn = jest.fn().mockImplementation(() => Promise.resolve({ data: currentDataRows, error: null }))
    mockDataRange = jest.fn().mockImplementation((from: number, to: number) =>
      Promise.resolve({ data: currentDataRows.slice(from, to + 1), error: null })
    )
    const dataQueryResult = {
      order: (...args: unknown[]) => {
        mockDataOrder(...args)
        return dataQueryResult
      },
      range: (...args: unknown[]) => mockDataRange(...args),
    }
    mockDataOrder = jest.fn().mockReturnValue(dataQueryResult)
    mockLte = jest.fn().mockReturnValue(dataQueryResult)
    const mockDataSelect = jest.fn((columns: string) => {
      if (columns === 'PCODE,CUSTOMER,WORKSHOP,DESCRIPTION') return { in: mockDataIn }
      return { lte: mockLte }
    })

    mockStatusIn = jest.fn().mockImplementation(() => Promise.resolve({ data: currentStatusRows, error: null }))
    const mockStatusSelect = jest.fn().mockReturnValue({ in: mockStatusIn })

    mockProductionIn = jest.fn().mockImplementation(() => Promise.resolve({ data: currentProductionRows, error: null }))
    const historyQueryResult = {
      lte: (...args: unknown[]) => {
        mockHistoryLte(...args)
        return historyQueryResult
      },
      order: (...args: unknown[]) => {
        mockHistoryOrder(...args)
        return historyQueryResult
      },
      limit: (...args: unknown[]) => {
        mockHistoryLimit(...args)
        return Promise.resolve({ data: currentHistoryRows, error: null })
      },
    }
    mockHistoryLimit = jest.fn()
    mockHistoryOrder = jest.fn().mockReturnValue(historyQueryResult)
    mockHistoryLte = jest.fn().mockReturnValue(historyQueryResult)
    mockHistoryGte = jest.fn().mockReturnValue(historyQueryResult)
    const mockProductionSelect = jest.fn((columns: string) => {
      if (columns.includes('id,pdate,pcode,products')) return { gte: mockHistoryGte }
      return { in: mockProductionIn }
    })

    const mockFrom = jest.fn((table: string) => {
      if (table === 'profiles') return { select: mockProfilesSelect }
      if (table === 'data') return { select: mockDataSelect }
      if (table === 'production_order_status') return { select: mockStatusSelect }
      if (table === 'Production') return { select: mockProductionSelect }
      throw new Error(`Unexpected table: ${table}`)
    })

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: mockFrom,
    })
  })

  it('queries all production orders up to the Vietnam current day without applying a lower-bound window', async () => {
    await expect(getOpenProductionOrdersAction()).resolves.toEqual({
      success: true,
      data: {
        orders: [],
        norms: [],
        materials: [],
        submittedPcodes: [],
        closedPcodes: [],
      },
    })

    expect(mockGetOpenProductionOrdersQueryWindow).toHaveBeenCalledWith()
    expect(mockLte).toHaveBeenCalledWith('INITIALDATE', '2026-05-09')
    expect(mockDataOrder).toHaveBeenCalledWith('INITIALDATE', { ascending: true })
    expect(mockDataOrder).toHaveBeenCalledWith('PCODE', { ascending: true })
    expect(mockDataRange).toHaveBeenCalledWith(0, 999)
    expect(mockOr).not.toHaveBeenCalled()
  })

  it('paginates source data so open orders after the first Supabase page are included', async () => {
    currentDataRows = Array.from({ length: 1001 }, (_, index) => ({
      PCODE: index === 1000 ? 'LSX-AFTER-FIRST-PAGE' : `LSX-PAGE-${String(index + 1).padStart(4, '0')}`,
      INITIALDATE: index === 1000 ? '2026-05-09' : '2026-05-08',
      CUSTOMER: 'Paged Customer',
      WORKSHOP: 'DMC1',
      DESCRIPTION: 'Paged open order',
      QUANTITY: 100,
      DEADLINEDATE: '2026-05-09T15:30:00',
      STATUS: 'Chua san xuat',
    }))

    currentStatusRows = []
    currentProductionRows = []

    const result = await getOpenProductionOrdersAction()

    expect(result.success).toBe(true)
    expect(mockDataRange).toHaveBeenCalledTimes(2)
    expect(mockDataRange).toHaveBeenNthCalledWith(1, 0, 999)
    expect(mockDataRange).toHaveBeenNthCalledWith(2, 1000, 1999)
    expect(result.data?.orders.map((order) => order.pcode)).toContain('LSX-AFTER-FIRST-PAGE')
  })

  it('keeps older not-started orders and orders newly closed today visible in the open orders list', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-09T10:00:00+07:00'))

    currentDataRows = [
      {
        PCODE: 'LSX-OLD-OPEN',
        INITIALDATE: '2026-03-15',
        CUSTOMER: 'Open Customer',
        WORKSHOP: 'DMC1',
        DESCRIPTION: 'Older open order',
        QUANTITY: 100,
        DEADLINEDATE: '2026-03-20T16:30:00',
        STATUS: 'Chua san xuat',
      },
      {
        PCODE: 'LSX-CLOSED-TODAY',
        INITIALDATE: '2026-05-01',
        CUSTOMER: 'Closed Customer',
        WORKSHOP: 'DMC1',
        DESCRIPTION: 'Closed today order',
        QUANTITY: 100,
        DEADLINEDATE: '2026-05-01T16:30:00',
        STATUS: 'Da SX',
      },
    ]

    currentStatusRows = [
      {
        pcode: 'LSX-CLOSED-TODAY',
        status: 'Da SX',
        produced_quantity: 40,
        quantity: 100,
        completion_pct: 40,
        updated_at: '2026-05-09T08:30:00+07:00',
      },
    ]
    currentProductionRows = []

    const result = await getOpenProductionOrdersAction()

    expect(result.success).toBe(true)
    expect(result.data?.orders.map((order) => order.pcode)).toEqual(
      expect.arrayContaining(['LSX-OLD-OPEN', 'LSX-CLOSED-TODAY'])
    )

    jest.useRealTimers()
  })

  it('treats recently delivered zero-output orders as not started in open orders', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-09T09:00:00+07:00'))

    currentDataRows = [
      {
        PCODE: 'LSX-DELIVERED-RECENT',
        INITIALDATE: '2026-05-08',
        CUSTOMER: 'Delivered Customer',
        WORKSHOP: 'DMC1',
        DESCRIPTION: 'Recently delivered with no output',
        QUANTITY: 100,
        DEADLINEDATE: '2026-05-08T10:00:00',
        STATUS: 'Da giao',
      },
    ]

    currentStatusRows = [
      {
        pcode: 'LSX-DELIVERED-RECENT',
        status: 'Dang kiem',
        produced_quantity: 0,
        quantity: 100,
        completion_pct: 0,
        updated_at: '2026-05-09T08:30:00+07:00',
      },
    ]

    currentProductionRows = []

    const result = await getOpenProductionOrdersAction()

    expect(result.success).toBe(true)
    expect(result.data?.orders).toHaveLength(1)
    expect(result.data?.orders[0]).toMatchObject({
      pcode: 'LSX-DELIVERED-RECENT',
      status: 'Chưa SX',
      producedQuantity: 0,
      completionPct: 0,
    })

    jest.useRealTimers()
  })

  it('treats the same recently delivered order as in progress when produced is below quantity', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-09T09:00:00+07:00'))

    currentDataRows = [
      {
        PCODE: 'LSX-DELIVERED-RECENT',
        INITIALDATE: '2026-05-08',
        CUSTOMER: 'Delivered Customer',
        WORKSHOP: 'DMC1',
        DESCRIPTION: 'Recently delivered with partial output',
        QUANTITY: 100,
        DEADLINEDATE: '2026-05-08T10:00:00',
        STATUS: 'Da giao',
      },
    ]

    currentStatusRows = [
      {
        pcode: 'LSX-DELIVERED-RECENT',
        status: 'Dang kiem',
        produced_quantity: 40,
        quantity: 100,
        completion_pct: 40,
        updated_at: '2026-05-09T08:30:00+07:00',
      },
    ]

    currentProductionRows = [
      {
        pcode: 'LSX-DELIVERED-RECENT',
        pdate: '2026-05-09',
        endtime: '08:00',
        poutput: 40,
      },
    ]

    const result = await getOpenProductionOrdersAction()

    expect(result.success).toBe(true)
    expect(result.data?.orders).toHaveLength(1)
    expect(result.data?.orders[0]).toMatchObject({
      pcode: 'LSX-DELIVERED-RECENT',
      status: 'Đang SX',
      producedQuantity: 40,
      completionPct: 40,
    })

    jest.useRealTimers()
  })

  it('uses fresh production output instead of stale internal status rows for open-order UI state', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-09T09:00:00+07:00'))

    currentDataRows = [
      {
        PCODE: 'LSX-COMPLETE-FRESH',
        INITIALDATE: '2026-05-08',
        CUSTOMER: 'Completed Customer',
        WORKSHOP: 'DMC1',
        DESCRIPTION: 'Completed from production output',
        QUANTITY: 100,
        DEADLINEDATE: '2026-05-08T10:00:00',
        STATUS: 'Chua san xuat',
      },
    ]

    currentStatusRows = [
      {
        pcode: 'LSX-COMPLETE-FRESH',
        status: 'Chua SX',
        produced_quantity: 0,
        quantity: 100,
        completion_pct: 0,
        updated_at: '2026-05-09T08:30:00+07:00',
      },
    ]

    currentProductionRows = [
      {
        pcode: 'LSX-COMPLETE-FRESH',
        pdate: '2026-05-09',
        endtime: '08:00',
        poutput: 60,
        save_status: 'draft',
      },
      {
        pcode: 'LSX-COMPLETE-FRESH',
        pdate: '2026-05-09',
        endtime: '08:30',
        poutput: 40,
        save_status: 'draft',
      },
    ]

    const result = await getOpenProductionOrdersAction()

    expect(result.success).toBe(true)
    expect(result.data?.submittedPcodes).toEqual(['LSX-COMPLETE-FRESH'])
    expect(result.data?.closedPcodes).toEqual(['LSX-COMPLETE-FRESH'])
    expect(result.data?.orders).toHaveLength(1)
    expect(result.data?.orders[0]).toMatchObject({
      pcode: 'LSX-COMPLETE-FRESH',
      status: 'Đã SX',
      internalStatus: 'Đã SX',
      producedQuantity: 100,
      remainingQuantity: 0,
      completionPct: 100,
    })

    jest.useRealTimers()
  })

  it('chunks production history lookups for large open-order lists', async () => {
    currentDataRows = Array.from({ length: 201 }, (_, index) => ({
      PCODE: `LSX-BULK-${String(index + 1).padStart(3, '0')}`,
      INITIALDATE: '2026-05-08',
      CUSTOMER: 'Bulk Customer',
      WORKSHOP: 'DMC1',
      DESCRIPTION: 'Bulk open order',
      QUANTITY: 100,
      DEADLINEDATE: '2026-05-12T10:00:00',
      STATUS: 'Chua san xuat',
    }))

    currentStatusRows = []
    currentProductionRows = []

    const result = await getOpenProductionOrdersAction()

    expect(result.success).toBe(true)
    expect(mockProductionIn).toHaveBeenCalledTimes(2)
    expect(mockProductionIn.mock.calls[0][0]).toBe('pcode')
    expect(mockProductionIn.mock.calls[0][1]).toHaveLength(200)
    expect(mockProductionIn.mock.calls[1][0]).toBe('pcode')
    expect(mockProductionIn.mock.calls[1][1]).toHaveLength(1)
  })

  it('loads production input history workshops by the history pcodes instead of relying on an unbounded data page', async () => {
    currentHistoryRows = [
      {
        id: 1,
        pdate: '2026-05-10',
        pcode: 'LSX-HISTORY-OUTSIDE-FIRST-PAGE',
        products: 'Product A',
        poutput: 12,
        eoutput: 0,
        routput: 0,
        workforce: 3,
        realnorm: 4,
        starttime: '08:00',
        endtime: '09:00',
        log: '',
        save_status: 'draft',
        created_at: '2026-05-10T09:05:00+07:00',
      },
    ]
    currentDataRows = [
      {
        PCODE: 'LSX-HISTORY-OUTSIDE-FIRST-PAGE',
        CUSTOMER: 'History Customer',
        WORKSHOP: 'DMC4',
        DESCRIPTION: 'History order',
      },
    ]

    const result = await listProductionInputHistoryAction({
      fromDate: '2026-05-10',
      toDate: '2026-05-10',
      query: '',
    })

    expect(result.success).toBe(true)
    expect(mockDataIn).toHaveBeenCalledWith('PCODE', ['LSX-HISTORY-OUTSIDE-FIRST-PAGE'])
    expect(result.data?.[0]).toMatchObject({
      pcode: 'LSX-HISTORY-OUTSIDE-FIRST-PAGE',
      workshop: 'DMC4',
      customer: 'History Customer',
    })
  })
})
