import type { GoogleSheetColumnMap, GoogleSheetSyncConfig } from './sync-config'

export type DataRecord = {
  PCODE: string
  INITIALDATE: string | null
  CUSTOMER: string | null
  WORKSHOP: string | null
  DESCRIPTION: string | null
  QUANTITY: number | null
  DEADLINEDATE: string | null
  STATUS?: string | null
  source_name?: string | null
  source_last_seen_at?: string | null
  source_deleted_at?: string | null
  source_deleted_reason?: string | null
}

export type TransformIssue = {
  rowNumber: number
  pcode?: string
  reason: string
}

export type SheetTransformResult = {
  records: DataRecord[]
  pcodes: Set<string>
  issues: TransformIssue[]
  rawCount: number
}

const TIMEZONE_OFFSET = '+07:00'

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text ? text : null
}

export function normalizePcode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase()
}

function excelSerialToDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569)
  const utcValue = utcDays * 86400
  const dateInfo = new Date(utcValue * 1000)
  const fractionalDay = serial - Math.floor(serial)
  const totalSeconds = Math.round(86400 * fractionalDay)
  dateInfo.setSeconds(totalSeconds)
  return dateInfo
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDateParts(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function normalizeDate(value: unknown): string | null {
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDateParts(value)
  if (typeof value === 'number' && Number.isFinite(value)) return formatDateParts(excelSerialToDate(value))

  const text = String(value).trim()
  if (!text) return null

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) return `${isoMatch[1]}-${pad(Number(isoMatch[2]))}-${pad(Number(isoMatch[3]))}`

  const vnMatch = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)
  if (vnMatch) {
    const year = Number(vnMatch[3].length === 2 ? `20${vnMatch[3]}` : vnMatch[3])
    return `${year}-${pad(Number(vnMatch[2]))}-${pad(Number(vnMatch[1]))}`
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : formatDateParts(parsed)
}

function normalizeDateTime(value: unknown): string | null {
  const date = normalizeDate(value)
  if (!date) return null
  if (typeof value === 'string') {
    const timeMatch = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
    if (timeMatch) {
      return `${date}T${pad(Number(timeMatch[1]))}:${timeMatch[2]}:${timeMatch[3] ?? '00'}${TIMEZONE_OFFSET}`
    }
  }
  return `${date}T00:00:00${TIMEZONE_OFFSET}`
}

function normalizeNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value

  const raw = String(value).trim()
  if (!raw) return null

  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/,/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function mapHeaders(headers: unknown[], columnMap: GoogleSheetColumnMap[]): Map<string, number> {
  const headerIndex = new Map<string, number>()
  headers.forEach((header, index) => {
    const key = normalizeHeader(header)
    if (key) headerIndex.set(key, index)
  })

  const result = new Map<string, number>()
  columnMap.forEach((column) => {
    const index = headerIndex.get(normalizeHeader(column.src))
    if (index != null) result.set(column.dest, index)
  })
  return result
}

function normalizeCell(value: unknown, column: GoogleSheetColumnMap): string | number | null {
  switch (column.type) {
    case 'number':
      return normalizeNumber(value)
    case 'date':
      return normalizeDate(value)
    case 'datetime':
      return normalizeDateTime(value)
    default:
      return normalizeText(value)
  }
}

function isBeforeCutoff(record: DataRecord, cutoffDate: string | null | undefined): boolean {
  return Boolean(cutoffDate && record.INITIALDATE && record.INITIALDATE < cutoffDate)
}

export function transformSheetValues(
  values: unknown[][],
  config: GoogleSheetSyncConfig,
  columnMap: GoogleSheetColumnMap[] = config.column_map
): SheetTransformResult {
  const [headers = [], ...rows] = values
  const mappedHeaders = mapHeaders(headers, columnMap)
  const issues: TransformIssue[] = []
  const records: DataRecord[] = []
  const seen = new Set<string>()

  for (const column of columnMap) {
    if (column.required && !mappedHeaders.has(column.dest)) {
      issues.push({ rowNumber: 1, reason: `Thiếu cột bắt buộc: ${column.src}` })
    }
  }

  rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2
    const record: Partial<DataRecord> = {
      CUSTOMER: null,
      WORKSHOP: null,
      DESCRIPTION: null,
      QUANTITY: null,
      DEADLINEDATE: null,
    }

    for (const column of columnMap) {
      const index = mappedHeaders.get(column.dest)
      const value = index == null ? null : row[index]
      const normalized = normalizeCell(value, column)
      ;(record as Record<string, unknown>)[column.dest] = normalized
    }

    record.PCODE = normalizePcode(record.PCODE)
    record.INITIALDATE = record.INITIALDATE ?? null

    const missingRequired = columnMap.some((column) => {
      if (!column.required) return false
      const value = (record as Record<string, unknown>)[column.dest]
      return value == null || value === ''
    })

    if (!record.PCODE && !Object.values(record).some(Boolean)) return
    if (missingRequired || !record.PCODE) {
      issues.push({ rowNumber, pcode: record.PCODE, reason: 'Thiếu dữ liệu bắt buộc' })
      return
    }
    if (isBeforeCutoff(record as DataRecord, config.cutoff_date)) return
    if (seen.has(record.PCODE)) {
      issues.push({ rowNumber, pcode: record.PCODE, reason: 'Trùng PCODE, giữ dòng xuất hiện sau cùng' })
      const existingIndex = records.findIndex((item) => item.PCODE === record.PCODE)
      if (existingIndex >= 0) records.splice(existingIndex, 1)
    }

    seen.add(record.PCODE)
    records.push(record as DataRecord)
  })

  return {
    records,
    pcodes: new Set(records.map((record) => record.PCODE)),
    issues,
    rawCount: rows.length,
  }
}

export function withSourceMetadata(record: DataRecord, config: GoogleSheetSyncConfig, seenAt: string): DataRecord {
  return {
    ...record,
    source_name: config.source_name,
    source_last_seen_at: seenAt,
    source_deleted_at: null,
    source_deleted_reason: null,
  }
}

export function mergeByPcode(records: DataRecord[]): DataRecord[] {
  return Array.from(new Map(records.map((record) => [record.PCODE, record])).values())
}
