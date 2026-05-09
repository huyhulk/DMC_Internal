const mockCreateClient = jest.fn()
const mockGetCachedNorms = jest.fn()
const mockGetCachedMaterials = jest.fn()
const mockGetOpenProductionOrdersQueryWindow = jest.fn()
const mockLoggerError = jest.fn()

let mockLte: jest.Mock
let mockOr: jest.Mock

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

    mockGetCachedNorms.mockResolvedValue([])
    mockGetCachedMaterials.mockResolvedValue([])
    mockGetOpenProductionOrdersQueryWindow.mockReturnValue({
      today: '2099-12-31',
      fromDate: '2099-12-01',
      deadlineFrom: '2099-12-29',
    })

    const mockSingle = jest.fn().mockResolvedValue({
      data: { role: 'admin', workspace: 'DMC1' },
    })
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle })
    const mockProfilesSelect = jest.fn().mockReturnValue({ eq: mockEq })

    mockOr = jest.fn().mockResolvedValue({ data: [], error: null })
    mockLte = jest.fn().mockReturnValue({ or: mockOr })
    const mockDataSelect = jest.fn().mockReturnValue({ lte: mockLte })

    const mockFrom = jest.fn((table: string) => {
      if (table === 'profiles') return { select: mockProfilesSelect }
      if (table === 'data') return { select: mockDataSelect }
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

  it('uses the dedicated open-orders query window when building the server query', async () => {
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
    expect(mockLte).toHaveBeenCalledWith('INITIALDATE', '2099-12-31')
    expect(mockOr).toHaveBeenCalledWith('INITIALDATE.gte.2099-12-01,DEADLINEDATE.gte.2099-12-29')
  })
})
