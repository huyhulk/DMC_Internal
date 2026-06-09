import { z } from 'zod'

export type GoogleSheetColumnType = 'text' | 'date' | 'datetime' | 'number'

export type GoogleSheetColumnMap = {
  src: string
  dest: 'PCODE' | 'INITIALDATE' | 'CUSTOMER' | 'WORKSHOP' | 'DESCRIPTION' | 'QUANTITY' | 'DEADLINEDATE'
  required: boolean
  type: GoogleSheetColumnType
}

export const DEFAULT_GOOGLE_SHEET_COLUMN_MAP: GoogleSheetColumnMap[] = [
  { src: 'số YCSX', dest: 'PCODE', required: true, type: 'text' },
  { src: 'Ngày lập phiếu', dest: 'INITIALDATE', required: true, type: 'date' },
  { src: 'Khách hàng', dest: 'CUSTOMER', required: false, type: 'text' },
  { src: 'Xưởng Sản Xuất', dest: 'WORKSHOP', required: false, type: 'text' },
  { src: 'Diễn giải', dest: 'DESCRIPTION', required: false, type: 'text' },
  { src: 'Số lượng', dest: 'QUANTITY', required: false, type: 'number' },
  { src: 'Ngày KD', dest: 'DEADLINEDATE', required: false, type: 'datetime' },
]

const DEFAULT_AUTO_SYNC_TIME = '07:00'
const DEFAULT_AUTO_SYNC_TIMEZONE = 'Asia/Ho_Chi_Minh'
export const DEFAULT_AUTO_SYNC_INTERVAL_MINUTES = 5
export const MIN_AUTO_SYNC_INTERVAL_MINUTES = 5
export const MAX_AUTO_SYNC_INTERVAL_MINUTES = 1440

const columnMapSchema = z.object({
  src: z.string().trim().min(1),
  dest: z.enum(['PCODE', 'INITIALDATE', 'CUSTOMER', 'WORKSHOP', 'DESCRIPTION', 'QUANTITY', 'DEADLINEDATE']),
  required: z.boolean(),
  type: z.enum(['text', 'date', 'datetime', 'number']),
})

export const googleSheetSyncConfigSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).default('Google Sheet sản xuất'),
  enabled: z.boolean().default(true),
  sheet_a_file_id: z.string().trim().min(1, 'Thiếu Google Sheet file ID cho Sheet A'),
  sheet_a_tab_name: z.string().trim().min(1).default('Tổng hợp 2026'),
  sheet_c_file_id: z.string().trim().optional().nullable(),
  sheet_c_tab_name: z.string().trim().min(1).default('STEP3'),
  sheet_b_file_id: z.string().trim().optional().nullable(),
  sheet_b_tab_name: z.string().trim().min(1).default('OnlyView'),
  sheet_b_pcode_col: z.string().trim().min(1).default('số YCSX'),
  sheet_b_status_col: z.string().trim().min(1).default('Tình trạng'),
  sheet_b_override_statuses: z.array(z.string().trim().min(1)).default(['Đã giao', 'Đang SX']),
  cutoff_date: z.string().trim().optional().nullable(),
  default_status: z.string().trim().min(1).default('Chưa SX'),
  sheet_c_status: z.string().trim().min(1).default('Đang kiểm'),
  source_name: z.string().trim().min(1).default('google_sheet'),
  soft_delete_missing: z.boolean().default(true),
  soft_delete_reason: z.string().trim().min(1).default('missing_from_google_sheet_reconcile'),
  max_soft_delete_ratio: z.coerce.number().min(0).max(1).default(0.2),
  auto_sync_enabled: z.boolean().default(false),
  auto_sync_time: z.string().trim().default(DEFAULT_AUTO_SYNC_TIME),
  auto_sync_timezone: z.string().trim().min(1).default(DEFAULT_AUTO_SYNC_TIMEZONE),
  auto_sync_interval_minutes: z.coerce
    .number()
    .int()
    .min(MIN_AUTO_SYNC_INTERVAL_MINUTES)
    .max(MAX_AUTO_SYNC_INTERVAL_MINUTES)
    .refine((value) => value % 5 === 0, 'Khoảng cách auto sync phải là bội số của 5 phút')
    .default(DEFAULT_AUTO_SYNC_INTERVAL_MINUTES),
  column_map: z.array(columnMapSchema).min(1).default(DEFAULT_GOOGLE_SHEET_COLUMN_MAP),
  sheet_c_column_map: z.array(columnMapSchema).min(1).default(DEFAULT_GOOGLE_SHEET_COLUMN_MAP),
})

export type GoogleSheetSyncConfigInput = z.input<typeof googleSheetSyncConfigSchema>
export type GoogleSheetSyncConfig = z.output<typeof googleSheetSyncConfigSchema>

export const DEFAULT_GOOGLE_SHEET_SYNC_CONFIG: GoogleSheetSyncConfig = googleSheetSyncConfigSchema.parse({
  sheet_a_file_id: 'placeholder',
  column_map: DEFAULT_GOOGLE_SHEET_COLUMN_MAP,
  sheet_c_column_map: DEFAULT_GOOGLE_SHEET_COLUMN_MAP,
})

export function normalizeConfigInput(input: GoogleSheetSyncConfigInput): GoogleSheetSyncConfig {
  const parsed = googleSheetSyncConfigSchema.parse(input)
  return {
    ...parsed,
    sheet_c_file_id: parsed.sheet_c_file_id || null,
    sheet_b_file_id: parsed.sheet_b_file_id || null,
    cutoff_date: parsed.cutoff_date || null,
  }
}

export function configFromDatabaseRow(
  row: (Record<string, unknown> & { column_map?: unknown; sheet_c_column_map?: unknown }) | null | undefined
): GoogleSheetSyncConfigInput {
  if (!row) {
    return {
      name: 'Google Sheet sản xuất',
      enabled: true,
      sheet_a_file_id: '',
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
      auto_sync_time: DEFAULT_AUTO_SYNC_TIME,
      auto_sync_timezone: DEFAULT_AUTO_SYNC_TIMEZONE,
      auto_sync_interval_minutes: DEFAULT_AUTO_SYNC_INTERVAL_MINUTES,
      column_map: DEFAULT_GOOGLE_SHEET_COLUMN_MAP,
      sheet_c_column_map: DEFAULT_GOOGLE_SHEET_COLUMN_MAP,
    }
  }

  const sheetAColumnMap = Array.isArray(row.column_map) ? row.column_map : DEFAULT_GOOGLE_SHEET_COLUMN_MAP
  const sheetCColumnMap = Array.isArray(row.sheet_c_column_map) ? row.sheet_c_column_map : sheetAColumnMap

  return {
    ...row,
    column_map: sheetAColumnMap,
    sheet_c_column_map: sheetCColumnMap,
  } as GoogleSheetSyncConfigInput
}
