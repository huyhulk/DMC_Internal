import { executeGoogleSheetSync, testConfiguredGoogleSheet } from '@/lib/google-sheets/sync'
import { DEFAULT_GOOGLE_SHEET_COLUMN_MAP, type GoogleSheetColumnMap, type GoogleSheetSyncConfig } from '@/lib/google-sheets/sync-config'
import { readGoogleSheetValues, testGoogleSheetConnection } from '@/lib/google-sheets/client'

jest.mock('@/lib/google-sheets/client', () => ({
  readGoogleSheetValues: jest.fn(),
  testGoogleSheetConnection: jest.fn(),
}))

const mockReadGoogleSheetValues = readGoogleSheetValues as jest.MockedFunction<typeof readGoogleSheetValues>
const mockTestGoogleSheetConnection = testGoogleSheetConnection as jest.MockedFunction<typeof testGoogleSheetConnection>

const sheetCColumnMap: GoogleSheetColumnMap[] = [
  { src: 'Mã LSX', dest: 'PCODE', required: true, type: 'text' },
  { src: 'Ngày tạo', dest: 'INITIALDATE', required: true, type: 'date' },
  { src: 'Khách', dest: 'CUSTOMER', required: false, type: 'text' },
  { src: 'Xưởng', dest: 'WORKSHOP', required: false, type: 'text' },
  { src: 'Tên hàng', dest: 'DESCRIPTION', required: false, type: 'text' },
  { src: 'SL', dest: 'QUANTITY', required: false, type: 'number' },
  { src: 'Deadline', dest: 'DEADLINEDATE', required: false, type: 'datetime' },
]

const config: GoogleSheetSyncConfig = {
  name: 'Test sync',
  enabled: true,
  sheet_a_file_id: 'sheet-a',
  sheet_a_tab_name: 'Tổng hợp 2026',
  sheet_c_file_id: null,
  sheet_c_tab_name: 'STEP3',
  sheet_b_file_id: 'sheet-b',
  sheet_b_tab_name: 'OnlyView',
  sheet_b_pcode_col: 'số YCSX',
  sheet_b_status_col: 'Tình trạng',
  sheet_b_override_statuses: ['Đã giao', 'Đang SX'],
  cutoff_date: null,
  default_status: 'Chưa SX',
  sheet_c_status: 'Đang kiểm',
  source_name: 'google_sheet',
  soft_delete_missing: true,
  soft_delete_reason: 'missing_from_google_sheet_reconcile',
  max_soft_delete_ratio: 1,
  column_map: DEFAULT_GOOGLE_SHEET_COLUMN_MAP,
  sheet_c_column_map: sheetCColumnMap,
}

const headers = ['số YCSX', 'Ngày lập phiếu', 'Khách hàng', 'Xưởng Sản Xuất', 'Diễn giải', 'Số lượng', 'Ngày KD']
const sheetA = [
  headers,
  ['LSX-A-NEW', '04/06/2026', 'A', 'DMC1', 'Mới', 100, '05/06/2026'],
  ['LSX-A-EXISTING', '04/06/2026', 'B', 'DMC1', 'Cập nhật', 200, '05/06/2026'],
]
const sheetCHeaders = ['Mã LSX', 'Ngày tạo', 'Khách', 'Xưởng', 'Tên hàng', 'SL', 'Deadline']
const sheetC = [
  sheetCHeaders,
  ['LSX-C-PENDING', '04/06/2026', 'C', 'DMC3', 'Đang kiểm', 300, '06/06/2026'],
  ['LSX-A-NEW', '04/06/2026', 'A', 'DMC1', 'Trùng A', 999, '05/06/2026'],
]
const sheetB = [
  ['số YCSX', 'Tình trạng'],
  ['LSX-A-NEW', 'Đang SX'],
]

type ExistingRow = Record<string, unknown>

type UpsertCall = {
  table: string
  payload: ExistingRow[]
  options?: Record<string, unknown>
}

function createSupabaseMock(existingRows: ExistingRow[], activePcodes: string[]) {
  const upserts: UpsertCall[] = []

  const supabase = {
    from: jest.fn((table: string) => ({
      select: jest.fn((columns?: string) => {
        if (table !== 'data') return Promise.resolve({ data: [], error: null })

        if (columns === 'PCODE') {
          const query: Record<string, jest.Mock> = {
            eq: jest.fn(() => query),
            is: jest.fn(() => query),
            order: jest.fn(() => query),
            gte: jest.fn(() => query),
            range: jest.fn(() => Promise.resolve({
              data: activePcodes.map((PCODE) => ({ PCODE })),
              error: null,
            })),
          }
          return query
        }

        return {
          in: jest.fn((_column: string, pcodes: string[]) => Promise.resolve({
            data: existingRows.filter((row) => pcodes.includes(String(row.PCODE))),
            error: null,
          })),
        }
      }),
    })),
    rpc: jest.fn((_name: string, args: Record<string, unknown>) => {
        upserts.push({ table: 'rpc_apply_google_sheet_sync', payload: args.p_records as ExistingRow[], options: args })
        if (Array.isArray(args.p_soft_delete_pcodes) && args.p_soft_delete_pcodes.length > 0) {
          upserts.push({
            table: 'rpc_apply_google_sheet_sync.soft_delete',
            payload: (args.p_soft_delete_pcodes as string[]).map((PCODE) => ({ PCODE })),
            options: args,
          })
        }
      return Promise.resolve({ data: null, error: null })
    }),
  }

  return { supabase, upserts }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockReadGoogleSheetValues.mockImplementation(async (_fileId: string, tabName: string) => {
    if (tabName === 'Tổng hợp 2026') return sheetA
    if (tabName === 'STEP3') return sheetC
    if (tabName === 'OnlyView') return sheetB
    return []
  })
})

describe('google sheet sync', () => {
  it('previews inserts, updates, sheet C pending rows, sheet B overrides and soft-deletes without writing', async () => {
    const { supabase, upserts } = createSupabaseMock([
      {
        id: 1,
        PCODE: 'LSX-A-EXISTING',
        INITIALDATE: '2026-06-04',
        CUSTOMER: 'B',
        WORKSHOP: 'DMC1',
        DESCRIPTION: 'Cũ',
        QUANTITY: 150,
        DEADLINEDATE: '2026-06-05T00:00:00+07:00',
        STATUS: 'Chưa SX',
        source_name: 'google_sheet',
        source_last_seen_at: '2026-06-03T00:00:00+07:00',
        source_deleted_at: null,
        source_deleted_reason: null,
      },
    ], ['LSX-A-EXISTING', 'LSX-SOFT-DELETE'])

    const summary = await executeGoogleSheetSync(supabase as never, config, 'preview')

    expect(summary.insertedRows).toBe(2)
    expect(summary.updatedRows).toBe(1)
    expect(summary.softDeletedRows).toBe(1)
    expect(summary.statusOverrides).toBe(1)
    expect(summary.samples.inserts).toEqual(['LSX-A-NEW', 'LSX-C-PENDING'])
    expect(summary.samples.updates).toEqual(['LSX-A-EXISTING'])
    expect(summary.samples.softDeletes).toEqual(['LSX-SOFT-DELETE'])
    expect(upserts).toEqual([])
  })

  it('runs writes for changed, unchanged and missing source rows', async () => {
    const { supabase, upserts } = createSupabaseMock([
      {
        id: 1,
        PCODE: 'LSX-A-EXISTING',
        INITIALDATE: '2026-06-04',
        CUSTOMER: 'B',
        WORKSHOP: 'DMC1',
        DESCRIPTION: 'Cập nhật',
        QUANTITY: 200,
        DEADLINEDATE: '2026-06-05T00:00:00+07:00',
        STATUS: 'Chưa SX',
        source_name: 'google_sheet',
        source_last_seen_at: '2026-06-03T00:00:00+07:00',
        source_deleted_at: null,
        source_deleted_reason: null,
      },
    ], ['LSX-A-EXISTING', 'LSX-SOFT-DELETE'])

    const summary = await executeGoogleSheetSync(supabase as never, config, 'run')

    expect(summary.softDeletedRows).toBe(1)
    expect(upserts).toHaveLength(2)
    expect(upserts[0].payload.map((row) => row.PCODE)).toEqual(['LSX-A-NEW', 'LSX-C-PENDING', 'LSX-A-EXISTING'])
    expect(upserts[0].options).toMatchObject({
      p_soft_delete_pcodes: ['LSX-SOFT-DELETE'],
      p_source_name: 'google_sheet',
      p_soft_delete_reason: 'missing_from_google_sheet_reconcile',
    })
    expect(upserts[1].payload).toEqual([{ PCODE: 'LSX-SOFT-DELETE' }])
  })

  it('reports Sheet B header issues in the sync summary', async () => {
    mockReadGoogleSheetValues.mockImplementation(async (_fileId: string, tabName: string) => {
      if (tabName === 'Tổng hợp 2026') return sheetA
      if (tabName === 'STEP3') return sheetC
      if (tabName === 'OnlyView') return [['Sai PCODE', 'Sai STATUS'], ['LSX-A-NEW', 'Đang SX']]
      return []
    })
    const { supabase } = createSupabaseMock([], [])

    const summary = await executeGoogleSheetSync(supabase as never, config, 'preview')

    expect(summary.errorCount).toBe(2)
    expect(summary.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ rowNumber: 1, reason: 'Thiếu cột số YCSX', source: 'sheet_b' }),
      expect.objectContaining({ rowNumber: 1, reason: 'Thiếu cột Tình trạng', source: 'sheet_b' }),
    ]))
    expect(summary.statusOverrides).toBe(0)
  })

  it('tests Sheet A, Sheet C and configured Sheet B connections', async () => {
    mockTestGoogleSheetConnection.mockImplementation(async (_fileId: string, tabName: string) => {
      if (tabName === 'Tổng hợp 2026') return { rows: 2, columns: 7 }
      if (tabName === 'STEP3') return { rows: 3, columns: 7 }
      if (tabName === 'OnlyView') return { rows: 4, columns: 2 }
      return { rows: 0, columns: 0 }
    })

    const result = await testConfiguredGoogleSheet(config)

    expect(result).toEqual({ rows: 9, columns: 7 })
    expect(mockTestGoogleSheetConnection).toHaveBeenCalledWith('sheet-a', 'Tổng hợp 2026')
    expect(mockTestGoogleSheetConnection).toHaveBeenCalledWith('sheet-a', 'STEP3')
    expect(mockTestGoogleSheetConnection).toHaveBeenCalledWith('sheet-b', 'OnlyView')
  })
})
