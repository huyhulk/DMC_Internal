import { DEFAULT_GOOGLE_SHEET_COLUMN_MAP, type GoogleSheetSyncConfig } from '@/lib/google-sheets/sync-config'
import { normalizePcode, transformSheetValues, withSourceMetadata } from '@/lib/google-sheets/transform'

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
  column_map: DEFAULT_GOOGLE_SHEET_COLUMN_MAP,
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
      { rowNumber: 2, pcode: '', reason: 'Thiếu dữ liệu bắt buộc' },
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

  it('normalizes PCODE consistently', () => {
    expect(normalizePcode(' lsx-abc ')).toBe('LSX-ABC')
  })
})
