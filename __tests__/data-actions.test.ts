const mockCreateClient = jest.fn()
const mockGetCachedNorms = jest.fn()
const mockGetCachedMaterials = jest.fn()
const mockGetOpenProductionOrdersQueryWindow = jest.fn()
const mockLoggerError = jest.fn()

let mockLte: jest.Mock
let mockOr: jest.Mock
let mockStatusIn: jest.Mock
let mockProductionIn: jest.Mock
let currentDataRows: Array<Record<string, unknown>>
let currentStatusRows: Array<Record<string, unknown>>
let currentProductionRows: Array<Record<string, unknown>>

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
  requireTabView: jest.fn(),
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

import { getOpenProductionOrdersAction } from '@/lib/actions/data'

describe('data actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    currentDataRows = []
    currentStatusRows = []
    currentProductionRows = []

    mockGetCachedNorms.mockResolvedValue([])
    mockGetCachedMaterials.mockResolvedValue([])
    mockGetOpenProductionOrdersQueryWindow.mockReturnValue({
      today: '2026-05-09',
      fromDate: '2026-04-01',
      deadlineFrom: '2026-05-07',
    })

    const mockSingle = jest.fn().mockResolvedValue({
      data: { role: 'admin', workspace: 'DMC1' },
    })
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle })
    const mockProfilesSelect = jest.fn().mockReturnValue({ eq: mockEq })

    mockOr = jest.fn().mockImplementation(() => Promise.resolve({ data: currentDataRows, error: null }))
    const dataQueryResult = {
      or: (...args: unknown[]) => mockOr(...args),
      then: (resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown) =>
        resolve({ data: currentDataRows, error: null }),
    }
    mockLte = jest.fn().mockReturnValue(dataQueryResult)
    const mockDataSelect = jest.fn().mockReturnValue({ lte: mockLte })

    mockStatusIn = jest.fn().mockImplementation(() => Promise.resolve({ data: currentStatusRows, error: null }))
    const mockStatusSelect = jest.fn().mockReturnValue({ in: mockStatusIn })

    mockProductionIn = jest.fn().mockImplementation(() => Promise.resolve({ data: currentProductionRows, error: null }))
    const mockProductionSelect = jest.fn().mockReturnValue({ in: mockProductionIn })

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
    expect(mockOr).not.toHaveBeenCalled()
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
})
