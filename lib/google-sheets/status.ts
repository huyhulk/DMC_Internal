import type { DataRecord } from './transform'
import type { GoogleSheetSyncConfig } from './sync-config'

export type ExistingDataRecord = DataRecord & {
  id?: number
  STATUS: string | null
}

export type ClassifiedRecord = DataRecord & {
  STATUS: string | null
}

export type StatusStats = {
  defaultStatusApplied: number
  statusUpgradedFromPending: number
  statusFixedNull: number
  sheetBOverrides: number
}

export function classifySheetARecord(
  record: DataRecord,
  existing: ExistingDataRecord | undefined,
  config: GoogleSheetSyncConfig,
  stats: StatusStats
): ClassifiedRecord {
  const next: ClassifiedRecord = { ...record, STATUS: existing?.STATUS ?? config.default_status }

  if (!existing) {
    next.STATUS = config.default_status
    stats.defaultStatusApplied += 1
    return next
  }

  if (existing.STATUS == null || existing.STATUS === '') {
    next.STATUS = config.default_status
    stats.statusFixedNull += 1
    return next
  }

  if (existing.STATUS === config.sheet_c_status) {
    next.STATUS = config.default_status
    stats.statusUpgradedFromPending += 1
  }

  return next
}

export function classifySheetCRecord(
  record: DataRecord,
  existing: ExistingDataRecord | undefined,
  config: GoogleSheetSyncConfig,
  stats: StatusStats
): ClassifiedRecord {
  if (existing) return { ...record, STATUS: existing.STATUS ?? config.sheet_c_status }
  stats.defaultStatusApplied += 1
  return { ...record, STATUS: config.sheet_c_status }
}

export type SheetBStatusRow = {
  pcode: string
  status: string
}

export function parseSheetBStatusRows(
  values: unknown[][],
  config: GoogleSheetSyncConfig
): { rows: SheetBStatusRow[]; issues: Array<{ rowNumber: number; reason: string }> } {
  const [headers = [], ...body] = values
  const normalizedHeaders = headers.map((header) => String(header ?? '').trim().toLowerCase())
  const pcodeIndex = normalizedHeaders.indexOf(config.sheet_b_pcode_col.trim().toLowerCase())
  const statusIndex = normalizedHeaders.indexOf(config.sheet_b_status_col.trim().toLowerCase())
  const issues: Array<{ rowNumber: number; reason: string }> = []

  if (pcodeIndex < 0) issues.push({ rowNumber: 1, reason: `Thiếu cột ${config.sheet_b_pcode_col}` })
  if (statusIndex < 0) issues.push({ rowNumber: 1, reason: `Thiếu cột ${config.sheet_b_status_col}` })
  if (issues.length > 0) return { rows: [], issues }

  const allowed = new Set(config.sheet_b_override_statuses)
  const rows: SheetBStatusRow[] = []
  body.forEach((row, index) => {
    const pcode = String(row[pcodeIndex] ?? '').trim().toUpperCase()
    const status = String(row[statusIndex] ?? '').trim()
    if (!pcode || !status) return
    if (!allowed.has(status)) return
    rows.push({ pcode, status })
  })

  return { rows, issues }
}

export function applySheetBOverrides<T extends ClassifiedRecord>(
  records: T[],
  overrides: SheetBStatusRow[],
  stats: StatusStats
): T[] {
  const overrideMap = new Map(overrides.map((row) => [row.pcode, row.status]))
  return records.map((record) => {
    const status = overrideMap.get(record.PCODE)
    if (!status || status === record.STATUS) return record
    stats.sheetBOverrides += 1
    return { ...record, STATUS: status }
  })
}

export function createStatusStats(): StatusStats {
  return {
    defaultStatusApplied: 0,
    statusUpgradedFromPending: 0,
    statusFixedNull: 0,
    sheetBOverrides: 0,
  }
}
