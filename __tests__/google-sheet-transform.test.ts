import { DEFAULT_GOOGLE_SHEET_COLUMN_MAP, type GoogleSheetColumnMap, type GoogleSheetSyncConfig } from '@/lib/google-sheets/sync-config'
import { normalizePcode, transformSheetValues, withSourceMetadata } from '@/lib/google-sheets/transform'

const sheetCColumnMap: GoogleSheetColumnMap[] = [
  { src: 'Mã LSX', dest: 'PCODE', required: true, type: 'text' },
  { src: 'Ngày tạo', dest: 'INITIALDATE', required: true, type: 'date' },
  { src: 'Khách', dest: 'CUSTOMER', required: false, type: 'text' },
  { src: 'Xưởng', dest: 'WORKSHOP', required: false, type: 'text' },
  { src: 'Tên hàng', dest: 'DESCRIPTION', required: false, type: 'text' },
  { src: 'SL', dest: 'QUANTITY', required: false, type: 'number' },
  { src: 'Deadline', dest: 'DEADLINEDATE', required: false, type: 'datetime' },
]

const baseConfig: GoogleSheetSyncConfig = {
  name: 'Test sync',
  enabled: true,
  sheet_a_file_id: 'sheet-a',
  sheet_a_tab_name: 'Tổng hợp 2026',
  sheet_c_file_id: null,
  sheet_c_tab_name: 'STEP3',
  sheet_b_file_id: null,
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
  max_soft_delete_ratio: 0.2,
  auto_sync_enabled: false,
  auto_sync_time: '07:00',
  auto_sync_timezone: 'Asia/Ho_Chi_Minh',
  column_map: DEFAULT_GOOGLE_SHEET_COLUMN_MAP,
  sheet_c_column_map: DEFAULT_GOOGLE_SHEET_COLUMN_MAP,
}

const headers = ['số YCSX', 'Ngày lập phiếu', 'Khách hàng', 'Xưởng Sản Xuất', 'Diễn giải', 'Số lượng', 'Ngày KD']

describe('google sheet transform', () => {
  it('normalizes PCODE, dates, numbers and source metadata', () => {
    const result = transformSheetValues([
      headers,
      [' lsx-001 ', '04/06/2026', 'ACME', 'DMC1', 'Áo thun', '1.234,5', '05/06/2026 14:30'],
    ], baseConfig)

    expect(result.issues).toEqual([])
    expect(result.rawCount).toBe(1)
    expect(result.records).toEqual([
      {
        PCODE: 'LSX-001',
        INITIALDATE: '2026-06-04',
        CUSTOMER: 'ACME',
        WORKSHOP: 'DMC1',
        DESCRIPTION: 'Áo thun',
        QUANTITY: 1234.5,
        DEADLINEDATE: '2026-06-05T14:30:00+07:00',
      },
    ])

    expect(withSourceMetadata(result.records[0], baseConfig, '2026-06-04T09:00:00+07:00')).toMatchObject({
      source_name: 'google_sheet',
      source_last_seen_at: '2026-06-04T09:00:00+07:00',
      source_deleted_at: null,
      source_deleted_reason: null,
    })
  })

  it('reports missing required data and keeps the later duplicate PCODE', () => {
    const result = transformSheetValues([
      headers,
      ['', '04/06/2026', 'ACME', 'DMC1', 'Thiếu PCODE', 1, '05/06/2026'],
      ['LSX-002', '04/06/2026', 'A', 'DMC1', 'Bản cũ', 10, '05/06/2026'],
      ['lsx-002', '05/06/2026', 'B', 'DMC3', 'Bản mới', 20, '06/06/2026'],
    ], baseConfig)

    expect(result.records).toHaveLength(1)
    expect(result.records[0]).toMatchObject({
      PCODE: 'LSX-002',
      INITIALDATE: '2026-06-05',
      CUSTOMER: 'B',
      WORKSHOP: 'DMC3',
      QUANTITY: 20,
    })
    expect(result.issues).toEqual([
      { rowNumber: 2, pcode: '', reason: 'Thiếu dữ liệu bắt buộc: PCODE (số YCSX)' },
      { rowNumber: 4, pcode: 'LSX-002', reason: 'Trùng PCODE, giữ dòng xuất hiện sau cùng' },
    ])
  })

  it('filters rows before cutoff date', () => {
    const result = transformSheetValues([
      headers,
      ['LSX-OLD', '31/05/2026', 'A', 'DMC1', 'Cũ', 1, '01/06/2026'],
      ['LSX-NEW', '01/06/2026', 'B', 'DMC1', 'Mới', 2, '02/06/2026'],
    ], { ...baseConfig, cutoff_date: '2026-06-01' })

    expect(result.records.map((row) => row.PCODE)).toEqual(['LSX-NEW'])
  })

  it('uses an explicit column map for sheets with different headers', () => {
    const result = transformSheetValues([
      ['Mã LSX', 'Ngày tạo', 'Khách', 'Xưởng', 'Tên hàng', 'SL', 'Deadline'],
      ['lsx-c-001', '04/06/2026', 'Khách C', 'DMC3', 'Hàng đang kiểm', '300', '06/06/2026 08:15'],
    ], baseConfig, sheetCColumnMap)

    expect(result.issues).toEqual([])
    expect(result.records).toEqual([
      {
        PCODE: 'LSX-C-001',
        INITIALDATE: '2026-06-04',
        CUSTOMER: 'Khách C',
        WORKSHOP: 'DMC3',
        DESCRIPTION: 'Hàng đang kiểm',
        QUANTITY: 300,
        DEADLINEDATE: '2026-06-06T08:15:00+07:00',
      },
    ])
  })

  it('reports which required source column is missing after normalization', () => {
    const result = transformSheetValues([
      headers,
      ['LSX-NO-DATE', '', 'ACME', 'DMC1', 'Thiếu ngày lập phiếu', 1, '05/06/2026'],
    ], baseConfig, baseConfig.column_map, 'sheet_a')

    expect(result.records).toEqual([])
    expect(result.issues).toEqual([
      {
        rowNumber: 2,
        pcode: 'LSX-NO-DATE',
        source: 'sheet_a',
        reason: 'Thiếu dữ liệu bắt buộc: INITIALDATE (Ngày lập phiếu)',
      },
    ])
  })

  it('parses datetime when time appears before Vietnamese date', () => {
    const result = transformSheetValues([
      headers,
      ['LSX-TIME-FIRST', '04/06/2026', 'ACME', 'DMC1', 'Dự kiến giờ trước ngày', 1, '16:30 20/03/2026'],
    ], baseConfig)

    expect(result.issues).toEqual([])
    expect(result.records[0].DEADLINEDATE).toBe('2026-03-20T16:30:00+07:00')
  })

  it('normalizes PCODE consistently', () => {
    expect(normalizePcode(' lsx-abc ')).toBe('LSX-ABC')
  })
})
