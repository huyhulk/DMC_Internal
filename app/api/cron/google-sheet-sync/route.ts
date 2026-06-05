import { NextRequest, NextResponse } from 'next/server'

import {
  executeConfiguredGoogleSheetSyncRun,
  getLatestGoogleSheetSyncConfig,
} from '@/lib/actions/google-sheet-sync'
import { configFromDatabaseRow, normalizeConfigInput } from '@/lib/google-sheets/sync-config'
import { createServiceClient } from '@/lib/supabase/server'

const WINDOW_MINUTES = 5
const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh'

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status })
}

function getTimePartsInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  })

  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

function parseTimeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function isInsideSyncWindow(nowMinutes: number, targetMinutes: number): boolean {
  const diff = (nowMinutes - targetMinutes + 24 * 60) % (24 * 60)
  return diff >= 0 && diff < WINDOW_MINUTES
}

function scheduledWindowStartIso(localDate: string, time: string, timezone: string): string {
  const offset = timezone === DEFAULT_TIMEZONE ? '+07:00' : ''
  return offset ? new Date(`${localDate}T${time}:00${offset}`).toISOString() : new Date(`${localDate}T${time}:00`).toISOString()
}

async function hasScheduledRunToday(configId: string, windowStartIso: string): Promise<boolean> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('google_sheet_sync_runs')
    .select('id')
    .eq('config_id', configId)
    .eq('mode', 'run')
    .is('initiated_by', null)
    .gte('started_at', windowStartIso)
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

    const timezone = config.auto_sync_timezone || DEFAULT_TIMEZONE
    const now = getTimePartsInTimezone(new Date(), timezone)
    const targetMinutes = parseTimeToMinutes(config.auto_sync_time)
    const nowMinutes = now.hour * 60 + now.minute

    if (!isInsideSyncWindow(nowMinutes, targetMinutes)) {
      return json({ ok: true, skipped: true, reason: 'outside_window', now: `${now.hour}:${now.minute}`, target: config.auto_sync_time, timezone })
    }

    const windowStartIso = scheduledWindowStartIso(now.date, config.auto_sync_time, timezone)
    if (await hasScheduledRunToday(row.id, windowStartIso)) {
      return json({ ok: true, skipped: true, reason: 'already_ran_today' })
    }

    const summary = await executeConfiguredGoogleSheetSyncRun({ initiatedBy: null, requireAutoSyncEnabled: true })
    return json({ ok: true, skipped: false, summary })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Lỗi auto sync Google Sheet' }, 500)
  }
}
