import { NextRequest, NextResponse } from 'next/server'

import {
  executeConfiguredGoogleSheetSyncRun,
  failStaleRunningRuns,
  getLatestGoogleSheetSyncConfig,
} from '@/lib/actions/google-sheet-sync'
import { configFromDatabaseRow, normalizeConfigInput } from '@/lib/google-sheets/sync-config'
import { createServiceClient } from '@/lib/supabase/server'

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status })
}

async function hasRecentScheduledRun(configId: string, sinceIso: string): Promise<boolean> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('google_sheet_sync_runs')
    .select('id')
    .eq('config_id', configId)
    .eq('mode', 'run')
    .is('initiated_by', null)
    .gte('started_at', sinceIso)
    .in('status', ['running', 'success'])
    .limit(1)

  if (error) throw new Error(`Lỗi kiểm tra lịch sử auto sync: ${error.message}`)
  return (data ?? []).length > 0
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return json({ ok: false, error: 'CRON_SECRET chưa được cấu hình' }, 503)

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) return json({ ok: false, error: 'Unauthorized' }, 401)

  try {
    const row = await getLatestGoogleSheetSyncConfig()
    const config = normalizeConfigInput(configFromDatabaseRow(row))
    if (!config.enabled) return json({ ok: true, skipped: true, reason: 'config_disabled' })
    if (!config.auto_sync_enabled) return json({ ok: true, skipped: true, reason: 'auto_sync_disabled' })

    const intervalMinutes = config.auto_sync_interval_minutes
    await failStaleRunningRuns(row.id)

    const sinceIso = new Date(Date.now() - intervalMinutes * 60 * 1000).toISOString()
    if (await hasRecentScheduledRun(row.id, sinceIso)) {
      return json({ ok: true, skipped: true, reason: 'interval_not_elapsed', intervalMinutes })
    }

    const summary = await executeConfiguredGoogleSheetSyncRun({ initiatedBy: null, requireAutoSyncEnabled: true })
    return json({ ok: true, skipped: false, intervalMinutes, summary })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Lỗi auto sync Google Sheet' }, 500)
  }
}
