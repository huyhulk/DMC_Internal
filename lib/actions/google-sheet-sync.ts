'use server'

import { revalidatePath } from 'next/cache'

import { executeGoogleSheetSync, testConfiguredGoogleSheet, type GoogleSheetSyncSummary } from '@/lib/google-sheets/sync'
import { configFromDatabaseRow, normalizeConfigInput, type GoogleSheetSyncConfigInput } from '@/lib/google-sheets/sync-config'
import { requireTabEdit, requireTabView } from '@/lib/permissions/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type SyncConfigRow = Database['public']['Tables']['google_sheet_sync_configs']['Row']
export type GoogleSheetSyncConfigRow = SyncConfigRow
export type GoogleSheetSyncRunRow = Database['public']['Tables']['google_sheet_sync_runs']['Row']

export type GoogleSheetSyncHistoryPage = {
  rows: GoogleSheetSyncRunRow[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const GOOGLE_SHEET_SYNC_HISTORY_PAGE_SIZE = 10

type ActionResult<T> = {
  data?: T
  error?: string
}

type SaveConfigInput = GoogleSheetSyncConfigInput & { id?: string }

async function requireAdminEdit(): Promise<{ id: string } | null> {
  const editor = await requireTabEdit('admin.google-sheet-sync')
  if (!editor) return null
  if (editor.role !== 'ADMIN') return null
  return { id: editor.id }
}

async function requireAdminView(): Promise<{ id: string } | null> {
  const viewer = await requireTabView('admin.google-sheet-sync')
  if (!viewer) return null
  if (viewer.role !== 'ADMIN') return null
  return { id: viewer.id }
}

function normalizeHistoryPage(page = 1): number {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

async function fetchGoogleSheetSyncHistory(page = 1, pageSize = GOOGLE_SHEET_SYNC_HISTORY_PAGE_SIZE): Promise<GoogleSheetSyncHistoryPage> {
  const normalizedPage = normalizeHistoryPage(page)
  const normalizedPageSize = Math.max(1, Math.min(50, Math.floor(pageSize)))
  const from = (normalizedPage - 1) * normalizedPageSize
  const to = from + normalizedPageSize - 1
  const supabase = await createClient()
  const { data, error, count } = await supabase
    .from('google_sheet_sync_runs')
    .select('*', { count: 'exact' })
    .order('started_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)

  const total = count ?? 0
  return {
    rows: (data ?? []) as GoogleSheetSyncRunRow[],
    page: normalizedPage,
    pageSize: normalizedPageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / normalizedPageSize)),
  }
}

export async function getGoogleSheetSyncHistoryAction(page = 1): Promise<ActionResult<GoogleSheetSyncHistoryPage>> {
  const viewer = await requireAdminView()
  if (!viewer) return { error: 'Bạn không có quyền xem lịch sử đồng bộ Google Sheet.' }

  try {
    return { data: await fetchGoogleSheetSyncHistory(page) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Không tải được lịch sử đồng bộ Google Sheet.' }
  }
}

export async function getGoogleSheetSyncSetupAction(): Promise<ActionResult<{ config: GoogleSheetSyncConfigInput; history: GoogleSheetSyncHistoryPage }>> {
  const viewer = await requireAdminView()
  if (!viewer) return { error: 'Bạn không có quyền xem cấu hình đồng bộ Google Sheet.' }

  const supabase = await createClient()
  const configResult = await supabase
    .from('google_sheet_sync_configs')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (configResult.error) return { error: configResult.error.message }

  try {
    return {
      data: {
        config: configFromDatabaseRow(configResult.data as SyncConfigRow | null),
        history: await fetchGoogleSheetSyncHistory(1),
      },
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Không tải được lịch sử đồng bộ Google Sheet.' }
  }
}

export async function saveGoogleSheetSyncConfigAction(input: SaveConfigInput): Promise<ActionResult<SyncConfigRow>> {
  const editor = await requireAdminEdit()
  if (!editor) return { error: 'Chỉ ADMIN có quyền chỉnh cấu hình đồng bộ Google Sheet.' }

  try {
    const parsed = normalizeConfigInput(input)
    const supabase = await createServiceClient()
    const payload = {
      name: parsed.name,
      enabled: parsed.enabled,
      sheet_a_file_id: parsed.sheet_a_file_id,
      sheet_a_tab_name: parsed.sheet_a_tab_name,
      sheet_c_file_id: parsed.sheet_c_file_id,
      sheet_c_tab_name: parsed.sheet_c_tab_name,
      sheet_b_file_id: parsed.sheet_b_file_id,
      sheet_b_tab_name: parsed.sheet_b_tab_name,
      sheet_b_pcode_col: parsed.sheet_b_pcode_col,
      sheet_b_status_col: parsed.sheet_b_status_col,
      sheet_b_override_statuses: parsed.sheet_b_override_statuses,
      cutoff_date: parsed.cutoff_date,
      default_status: parsed.default_status,
      sheet_c_status: parsed.sheet_c_status,
      source_name: parsed.source_name,
      soft_delete_missing: parsed.soft_delete_missing,
      soft_delete_reason: parsed.soft_delete_reason,
      max_soft_delete_ratio: parsed.max_soft_delete_ratio,
      auto_sync_enabled: parsed.auto_sync_enabled,
      auto_sync_time: parsed.auto_sync_time,
      auto_sync_timezone: parsed.auto_sync_timezone,
      auto_sync_interval_minutes: parsed.auto_sync_interval_minutes,
      column_map: parsed.column_map,
      sheet_c_column_map: parsed.sheet_c_column_map,
      updated_by: editor.id,
    }

    const query = input.id
      ? supabase.from('google_sheet_sync_configs').update(payload).eq('id', input.id).select('*').single()
      : supabase
          .from('google_sheet_sync_configs')
          .insert({ ...payload, created_by: editor.id })
          .select('*')
          .single()

    const { data, error } = await query
    if (error) return { error: error.message }

    revalidatePath('/dashboard/admin/google-sheet-sync')
    return { data: data as SyncConfigRow }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Lỗi lưu cấu hình' }
  }
}

export async function getLatestGoogleSheetSyncConfig(): Promise<SyncConfigRow> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('google_sheet_sync_configs')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Chưa có cấu hình Google Sheet sync')
  return data as SyncConfigRow
}

async function createRun(mode: 'test' | 'preview' | 'run', userId: string | null, configId: string): Promise<string> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('google_sheet_sync_runs')
    .insert({ mode, status: 'running', config_id: configId, initiated_by: userId })
    .select('id')
    .single()

  if (error) {
    if (mode === 'run' && error.message.toLowerCase().includes('duplicate')) {
      throw new Error('Đang có sync khác chạy, vui lòng chờ hoàn tất')
    }
    throw new Error(error.message)
  }
  return data.id as string
}

async function finishRun(runId: string, summary: Partial<GoogleSheetSyncSummary>, errorMessage?: string): Promise<void> {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('google_sheet_sync_runs')
    .update({
      status: errorMessage ? 'failed' : 'success',
      finished_at: new Date().toISOString(),
      sheet_rows_read: summary.sheetRowsRead ?? 0,
      valid_rows: summary.validRows ?? 0,
      skipped_rows: summary.skippedRows ?? 0,
      inserted_rows: summary.insertedRows ?? 0,
      updated_rows: summary.updatedRows ?? 0,
      unchanged_rows: summary.unchangedRows ?? 0,
      soft_deleted_rows: summary.softDeletedRows ?? 0,
      status_overrides: summary.statusOverrides ?? 0,
      default_status_applied: summary.defaultStatusApplied ?? 0,
      error_count: summary.errorCount ?? (errorMessage ? 1 : 0),
      summary,
      error_message: errorMessage ?? null,
    })
    .eq('id', runId)

  if (error) throw new Error(`Lỗi cập nhật lịch sử sync: ${error.message}`)
}

export async function testGoogleSheetSyncConnectionAction(): Promise<ActionResult<{ rows: number; columns: number }>> {
  const editor = await requireAdminEdit()
  if (!editor) return { error: 'Chỉ ADMIN có quyền test kết nối Google Sheet.' }

  let runId: string | null = null
  try {
    const row = await getLatestGoogleSheetSyncConfig()
    const config = normalizeConfigInput(configFromDatabaseRow(row))
    runId = await createRun('test', editor.id, row.id)
    const result = await testConfiguredGoogleSheet(config)
    await finishRun(runId, {
      mode: 'test',
      sheetRowsRead: result.rows,
      validRows: result.rows,
      skippedRows: 0,
      insertedRows: 0,
      updatedRows: 0,
      unchangedRows: 0,
      softDeletedRows: 0,
      statusOverrides: 0,
      defaultStatusApplied: 0,
      errorCount: 0,
      issues: [],
      samples: { inserts: [], updates: [], softDeletes: [] },
    })
    revalidatePath('/dashboard/admin/google-sheet-sync')
    return { data: result }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi test Google Sheet'
    if (runId) await finishRun(runId, {}, message)
    return { error: message }
  }
}

export async function previewGoogleSheetSyncAction(): Promise<ActionResult<GoogleSheetSyncSummary>> {
  const editor = await requireAdminEdit()
  if (!editor) return { error: 'Chỉ ADMIN có quyền preview đồng bộ.' }

  let runId: string | null = null
  try {
    const row = await getLatestGoogleSheetSyncConfig()
    const config = normalizeConfigInput(configFromDatabaseRow(row))
    runId = await createRun('preview', editor.id, row.id)
    const supabase = await createServiceClient()
    const summary = await executeGoogleSheetSync(supabase, config, 'preview')
    await finishRun(runId, summary)
    revalidatePath('/dashboard/admin/google-sheet-sync')
    return { data: summary }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi preview đồng bộ'
    if (runId) await finishRun(runId, {}, message)
    return { error: message }
  }
}

type ExecuteConfiguredGoogleSheetSyncRunOptions = {
  initiatedBy: string | null
  requireAutoSyncEnabled?: boolean
}

export async function executeConfiguredGoogleSheetSyncRun({
  initiatedBy,
  requireAutoSyncEnabled = false,
}: ExecuteConfiguredGoogleSheetSyncRunOptions): Promise<GoogleSheetSyncSummary> {
  let runId: string | null = null
  try {
    const row = await getLatestGoogleSheetSyncConfig()
    const config = normalizeConfigInput(configFromDatabaseRow(row))
    if (!config.enabled) throw new Error('Cấu hình đang tắt, không thể chạy sync')
    if (requireAutoSyncEnabled && !config.auto_sync_enabled) throw new Error('Auto sync đang tắt')

    runId = await createRun('run', initiatedBy, row.id)
    const supabase = await createServiceClient()
    const summary = await executeGoogleSheetSync(supabase, config, 'run')
    await finishRun(runId, summary)
    revalidatePath('/dashboard/admin/google-sheet-sync')
    return summary
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi chạy đồng bộ'
    if (runId) await finishRun(runId, {}, message)
    throw new Error(message)
  }
}

export async function runGoogleSheetSyncAction(): Promise<ActionResult<GoogleSheetSyncSummary>> {
  const editor = await requireAdminEdit()
  if (!editor) return { error: 'Chỉ ADMIN có quyền chạy đồng bộ.' }

  try {
    return { data: await executeConfiguredGoogleSheetSyncRun({ initiatedBy: editor.id }) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Lỗi chạy đồng bộ' }
  }
}
