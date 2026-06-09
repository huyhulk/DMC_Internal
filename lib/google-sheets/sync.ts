import type { SupabaseClient } from '@supabase/supabase-js'

import { readGoogleSheetValues, testGoogleSheetConnection } from './client'
import {
  applySheetBOverrides,
  classifySheetARecord,
  classifySheetCRecord,
  createStatusStats,
  parseSheetBStatusRows,
  type ClassifiedRecord,
  type ExistingDataRecord,
} from './status'
import type { GoogleSheetSyncConfig } from './sync-config'
import { mergeByPcode, transformSheetValues, withSourceMetadata, type DataRecord, type TransformIssue } from './transform'

type RunMode = 'test' | 'preview' | 'run'

type ExistingRow = ExistingDataRecord & {
  id?: number
}

type DiffResult = {
  inserts: ClassifiedRecord[]
  updates: ClassifiedRecord[]
  unchanged: ClassifiedRecord[]
}

export type GoogleSheetSyncPhase =
  | 'read_sheet_a'
  | 'read_sheet_c'
  | 'read_sheet_b'
  | 'transform'
  | 'fetch_existing'
  | 'fetch_active_source'
  | 'apply_changes'

export type GoogleSheetSyncPhaseTiming = {
  phase: GoogleSheetSyncPhase
  durationMs: number
}

export type GoogleSheetSyncTelemetry = {
  startedAt: string
  finishedAt: string
  durationMs: number
  deadlineAt?: string
  phases: GoogleSheetSyncPhaseTiming[]
  slowestPhase?: GoogleSheetSyncPhaseTiming
}

export type GoogleSheetSyncOptions = {
  deadlineAt?: number
  googleRequestTimeoutMs?: number
  onPhase?: (phase: GoogleSheetSyncPhase) => Promise<void> | void
}

export type GoogleSheetSyncSummary = {
  mode: RunMode
  sheetRowsRead: number
  validRows: number
  skippedRows: number
  insertedRows: number
  updatedRows: number
  unchangedRows: number
  softDeletedRows: number
  statusOverrides: number
  defaultStatusApplied: number
  errorCount: number
  issues: TransformIssue[]
  samples: {
    inserts: string[]
    updates: string[]
    softDeletes: string[]
  }
  telemetry?: GoogleSheetSyncTelemetry
}

const DATA_COLUMNS = 'id,PCODE,INITIALDATE,CUSTOMER,WORKSHOP,DESCRIPTION,QUANTITY,DEADLINEDATE,STATUS,source_name,source_last_seen_at,source_deleted_at,source_deleted_reason'
const BATCH_SIZE = 500
const DEADLINE_SAFETY_BUFFER_MS = 10 * 1000

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
  return chunks
}

function getSeenAt(): string {
  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000
  const vnDate = new Date(utcMs + 7 * 60 * 60 * 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${vnDate.getUTCFullYear()}-${pad(vnDate.getUTCMonth() + 1)}-${pad(vnDate.getUTCDate())}T${pad(vnDate.getUTCHours())}:${pad(vnDate.getUTCMinutes())}:${pad(vnDate.getUTCSeconds())}+07:00`
}

function comparableValue(value: unknown): string {
  return value == null ? '' : String(value)
}

function diffRecord(record: ClassifiedRecord, existing: ExistingRow | undefined): boolean {
  if (!existing) return true
  const fields: Array<keyof ClassifiedRecord> = [
    'INITIALDATE',
    'CUSTOMER',
    'WORKSHOP',
    'DESCRIPTION',
    'QUANTITY',
    'DEADLINEDATE',
    'STATUS',
    'source_name',
    'source_deleted_at',
    'source_deleted_reason',
  ]
  return fields.some((field) => comparableValue(record[field]) !== comparableValue(existing[field]))
}

function buildDiff(records: ClassifiedRecord[], existingMap: Map<string, ExistingRow>): DiffResult {
  const inserts: ClassifiedRecord[] = []
  const updates: ClassifiedRecord[] = []
  const unchanged: ClassifiedRecord[] = []

  records.forEach((record) => {
    const existing = existingMap.get(record.PCODE)
    if (!existing) inserts.push(record)
    else if (diffRecord(record, existing)) updates.push(record)
    else unchanged.push(record)
  })

  return { inserts, updates, unchanged }
}

function assertWithinDeadline(deadlineAt: number | undefined, phase: string): void {
  if (!deadlineAt) return
  if (Date.now() + DEADLINE_SAFETY_BUFFER_MS >= deadlineAt) {
    throw new Error(`Google Sheet sync quá thời gian trước phase ${phase}`)
  }
}

async function runPhase<T>(phase: GoogleSheetSyncPhase, timings: GoogleSheetSyncPhaseTiming[], options: GoogleSheetSyncOptions | undefined, task: () => Promise<T> | T): Promise<T> {
  assertWithinDeadline(options?.deadlineAt, phase)
  await options?.onPhase?.(phase)
  const startedAt = Date.now()
  try {
    return await task()
  } finally {
    timings.push({ phase, durationMs: Date.now() - startedAt })
    assertWithinDeadline(options?.deadlineAt, phase)
  }
}

function buildTelemetry(startedAtMs: number, deadlineAt: number | undefined, phases: GoogleSheetSyncPhaseTiming[]): GoogleSheetSyncTelemetry {
  const finishedAtMs = Date.now()
  const slowestPhase = phases.reduce<GoogleSheetSyncPhaseTiming | undefined>(
    (slowest, phase) => (!slowest || phase.durationMs > slowest.durationMs ? phase : slowest),
    undefined
  )

  return {
    startedAt: new Date(startedAtMs).toISOString(),
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    deadlineAt: deadlineAt ? new Date(deadlineAt).toISOString() : undefined,
    phases,
    slowestPhase,
  }
}

async function fetchExistingByPcodes(supabase: SupabaseClient, pcodes: string[], options?: GoogleSheetSyncOptions): Promise<Map<string, ExistingRow>> {
  const rows: ExistingRow[] = []
  for (const batch of chunk(pcodes, BATCH_SIZE)) {
    assertWithinDeadline(options?.deadlineAt, 'fetch_existing')
    const { data, error } = await supabase.from('data').select(DATA_COLUMNS).in('PCODE', batch)
    if (error) throw new Error(`Lỗi đọc data theo PCODE: ${error.message}`)
    rows.push(...((data ?? []) as ExistingRow[]))
  }
  return new Map(rows.map((row) => [String(row.PCODE).trim().toUpperCase(), row]))
}

async function fetchActiveSourcePcodes(supabase: SupabaseClient, config: GoogleSheetSyncConfig, options?: GoogleSheetSyncOptions): Promise<string[]> {
  const rows: Array<{ PCODE: string }> = []
  let from = 0

  while (true) {
    assertWithinDeadline(options?.deadlineAt, 'fetch_active_source')
    let query = supabase
      .from('data')
      .select('PCODE')
      .eq('source_name', config.source_name)
      .is('source_deleted_at', null)
      .order('PCODE', { ascending: true })
      .range(from, from + BATCH_SIZE - 1)

    if (config.cutoff_date) query = query.gte('INITIALDATE', config.cutoff_date)

    const { data, error } = await query
    if (error) throw new Error(`Lỗi đọc active source PCODE: ${error.message}`)
    rows.push(...((data ?? []) as Array<{ PCODE: string }>))
    if (!data || data.length < BATCH_SIZE) break
    from += BATCH_SIZE
  }

  return rows.map((row) => String(row.PCODE ?? '').trim().toUpperCase()).filter(Boolean)
}

async function applySyncChanges(
  supabase: SupabaseClient,
  records: ClassifiedRecord[],
  softDeletePcodes: string[],
  config: GoogleSheetSyncConfig,
  deletedAt: string,
  options?: GoogleSheetSyncOptions
): Promise<void> {
  assertWithinDeadline(options?.deadlineAt, 'apply_changes')
  const { error } = await supabase.rpc('rpc_apply_google_sheet_sync', {
    p_records: records,
    p_soft_delete_pcodes: softDeletePcodes,
    p_source_name: config.source_name,
    p_deleted_at: deletedAt,
    p_soft_delete_reason: config.soft_delete_reason,
  })
  if (error) throw new Error(`Lỗi áp dụng Google Sheet sync: ${error.message}`)
}

type SheetBIssue = TransformIssue & {
  source: 'sheet_b'
}

function classifyRecords(
  aRecords: DataRecord[],
  cRecords: DataRecord[],
  existingMap: Map<string, ExistingRow>,
  config: GoogleSheetSyncConfig,
  sheetBValues: unknown[][] | null
): { records: ClassifiedRecord[]; statusOverrides: number; defaultStatusApplied: number; sheetBIssues: SheetBIssue[] } {
  const stats = createStatusStats()
  const aClassified = aRecords.map((record) => classifySheetARecord(record, existingMap.get(record.PCODE), config, stats))
  const aPcodes = new Set(aClassified.map((record) => record.PCODE))
  const cClassified = cRecords
    .filter((record) => !aPcodes.has(record.PCODE))
    .map((record) => classifySheetCRecord(record, existingMap.get(record.PCODE), config, stats))
  const merged = mergeByPcode(aClassified.concat(cClassified)) as ClassifiedRecord[]

  if (!sheetBValues) {
    return {
      records: merged,
      statusOverrides: stats.sheetBOverrides,
      defaultStatusApplied: stats.defaultStatusApplied + stats.statusFixedNull + stats.statusUpgradedFromPending,
      sheetBIssues: [],
    }
  }

  const { rows, issues } = parseSheetBStatusRows(sheetBValues, config)
  const overridden = applySheetBOverrides(merged, rows, stats)
  return {
    records: overridden,
    statusOverrides: stats.sheetBOverrides,
    defaultStatusApplied: stats.defaultStatusApplied + stats.statusFixedNull + stats.statusUpgradedFromPending,
    sheetBIssues: issues.map((issue) => ({ ...issue, source: 'sheet_b' })),
  }
}

export async function testConfiguredGoogleSheet(config: GoogleSheetSyncConfig): Promise<{ rows: number; columns: number }> {
  const sheetA = await testGoogleSheetConnection(config.sheet_a_file_id, config.sheet_a_tab_name)
  const sheetC = config.sheet_c_file_id
    ? await testGoogleSheetConnection(config.sheet_c_file_id, config.sheet_c_tab_name)
    : await testGoogleSheetConnection(config.sheet_a_file_id, config.sheet_c_tab_name)
  const sheetB = config.sheet_b_file_id && config.sheet_b_tab_name
    ? await testGoogleSheetConnection(config.sheet_b_file_id, config.sheet_b_tab_name)
    : { rows: 0, columns: 0 }

  return {
    rows: sheetA.rows + sheetC.rows + sheetB.rows,
    columns: Math.max(sheetA.columns, sheetC.columns, sheetB.columns),
  }
}

function summarizeIssues(issues: TransformIssue[]): string {
  const counts = new Map<string, number>()
  issues.forEach((issue) => {
    const label = `${issue.source ?? 'unknown'} dòng ${issue.rowNumber}: ${issue.reason}`
    counts.set(label, (counts.get(label) ?? 0) + 1)
  })

  return Array.from(counts.entries())
    .slice(0, 3)
    .map(([label, count]) => `${label}${count > 1 ? ` (${count} dòng)` : ''}`)
    .join('; ')
}

export async function executeGoogleSheetSync(
  supabase: SupabaseClient,
  config: GoogleSheetSyncConfig,
  mode: 'preview' | 'run',
  options?: GoogleSheetSyncOptions
): Promise<GoogleSheetSyncSummary> {
  const startedAtMs = Date.now()
  const phases: GoogleSheetSyncPhaseTiming[] = []
  const seenAt = getSeenAt()
  const requestOptions = { requestTimeoutMs: options?.googleRequestTimeoutMs }

  const sheetAValues = await runPhase('read_sheet_a', phases, options, () =>
    readGoogleSheetValues(config.sheet_a_file_id, config.sheet_a_tab_name, requestOptions)
  )
  const sheetCValues = await runPhase('read_sheet_c', phases, options, () =>
    config.sheet_c_file_id
      ? readGoogleSheetValues(config.sheet_c_file_id, config.sheet_c_tab_name, requestOptions)
      : readGoogleSheetValues(config.sheet_a_file_id, config.sheet_c_tab_name, requestOptions)
  )
  const sheetBFileId = config.sheet_b_file_id
  const sheetBTabName = config.sheet_b_tab_name
  const sheetBValues = sheetBFileId && sheetBTabName
    ? await runPhase('read_sheet_b', phases, options, () => readGoogleSheetValues(sheetBFileId, sheetBTabName, requestOptions))
    : null

  const { aResult, cResult, sourceRecords } = await runPhase('transform', phases, options, () => {
    const transformedA = transformSheetValues(sheetAValues, config, config.column_map, 'sheet_a')
    const transformedC = transformSheetValues(sheetCValues, config, config.sheet_c_column_map, 'sheet_c')
    return {
      aResult: transformedA,
      cResult: transformedC,
      sourceRecords: mergeByPcode(
        transformedA.records.concat(transformedC.records).map((record) => withSourceMetadata(record, config, seenAt))
      ),
    }
  })

  const sourcePcodes = sourceRecords.map((record) => record.PCODE)
  const existingMap = await runPhase('fetch_existing', phases, options, () => fetchExistingByPcodes(supabase, sourcePcodes, options))
  const { records, statusOverrides, defaultStatusApplied, sheetBIssues } = classifyRecords(
    aResult.records.map((record) => withSourceMetadata(record, config, seenAt)),
    cResult.records.map((record) => withSourceMetadata(record, config, seenAt)),
    existingMap,
    config,
    sheetBValues
  )
  const diff = buildDiff(records, existingMap)

  const activeSourcePcodes = config.soft_delete_missing
    ? await runPhase('fetch_active_source', phases, options, () => fetchActiveSourcePcodes(supabase, config, options))
    : []
  const sourceSet = new Set(records.map((record) => record.PCODE))
  const softDeletePcodesList = activeSourcePcodes.filter((pcode) => !sourceSet.has(pcode))
  const issues = aResult.issues.concat(cResult.issues, sheetBIssues)
  const activeCount = Math.max(activeSourcePcodes.length, 1)
  const issueSummary = summarizeIssues(issues)
  if (config.soft_delete_missing && softDeletePcodesList.length / activeCount > config.max_soft_delete_ratio) {
    throw new Error(
      `Số dòng soft-delete dự kiến ${softDeletePcodesList.length}/${activeSourcePcodes.length} vượt ngưỡng ${Math.round(config.max_soft_delete_ratio * 100)}%. ` +
        `Debug: Sheet A đọc ${aResult.rawCount} dòng/${aResult.records.length} hợp lệ, Sheet C đọc ${cResult.rawCount} dòng/${cResult.records.length} hợp lệ, ` +
        `source PCODE hợp lệ ${records.length}, lỗi mapping/dữ liệu ${issues.length}. ` +
        `Chi tiết lỗi: ${issueSummary || 'không có lỗi transform'}`
    )
  }

  if (mode === 'run') {
    await runPhase('apply_changes', phases, options, () =>
      applySyncChanges(supabase, diff.inserts.concat(diff.updates), softDeletePcodesList, config, seenAt, options)
    )
  }

  return {
    mode,
    sheetRowsRead: aResult.rawCount + cResult.rawCount,
    validRows: records.length,
    skippedRows: issues.length,
    insertedRows: diff.inserts.length,
    updatedRows: diff.updates.length,
    unchangedRows: diff.unchanged.length,
    softDeletedRows: softDeletePcodesList.length,
    statusOverrides,
    defaultStatusApplied,
    errorCount: issues.length,
    issues: issues.slice(0, 50),
    samples: {
      inserts: diff.inserts.slice(0, 20).map((record) => record.PCODE),
      updates: diff.updates.slice(0, 20).map((record) => record.PCODE),
      softDeletes: softDeletePcodesList.slice(0, 20),
    },
    telemetry: buildTelemetry(startedAtMs, options?.deadlineAt, phases),
  }
}
