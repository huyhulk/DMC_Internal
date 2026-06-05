'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Database, Play, RotateCw, Save, SearchCheck } from 'lucide-react'
import { toast } from 'sonner'

import {
  previewGoogleSheetSyncAction,
  runGoogleSheetSyncAction,
  saveGoogleSheetSyncConfigAction,
  testGoogleSheetSyncConnectionAction,
  type GoogleSheetSyncConfigRow,
  type GoogleSheetSyncRunRow,
} from '@/lib/actions/google-sheet-sync'
import type { GoogleSheetSyncSummary } from '@/lib/google-sheets/sync'
import {
  DEFAULT_GOOGLE_SHEET_COLUMN_MAP,
  type GoogleSheetColumnMap,
  type GoogleSheetColumnType,
  type GoogleSheetSyncConfigInput,
} from '@/lib/google-sheets/sync-config'
import { cn } from '@/lib/utils'

type Props = {
  initialConfig: GoogleSheetSyncConfigInput
  history: GoogleSheetSyncRunRow[]
  canEdit: boolean
}

type FormValues = {
  id?: string
  name: string
  enabled: boolean
  sheet_a_file_id: string
  sheet_a_tab_name: string
  sheet_c_file_id: string
  sheet_c_tab_name: string
  sheet_b_file_id: string
  sheet_b_tab_name: string
  sheet_b_pcode_col: string
  sheet_b_status_col: string
  sheet_b_override_statuses: string
  cutoff_date: string
  default_status: string
  sheet_c_status: string
  source_name: string
  soft_delete_missing: boolean
  soft_delete_reason: string
  max_soft_delete_ratio: number
  auto_sync_enabled: boolean
  auto_sync_time: string
  auto_sync_timezone: string
}

const inputCls =
  'h-9 w-full rounded-lg border border-dmc-border bg-white px-3 text-sm text-dmc-text-primary ' +
  'focus:border-dmc-primary/50 focus:outline-none focus:ring-1 focus:ring-dmc-primary/30 disabled:opacity-50'

const DEST_LABELS: Record<GoogleSheetColumnMap['dest'], string> = {
  PCODE: 'PCODE',
  INITIALDATE: 'Ngày lập',
  CUSTOMER: 'Khách hàng',
  WORKSHOP: 'Xưởng',
  DESCRIPTION: 'Diễn giải',
  QUANTITY: 'Số lượng',
  DEADLINEDATE: 'Deadline',
}

const COLUMN_TYPES: GoogleSheetColumnType[] = ['text', 'date', 'datetime', 'number']

function cloneColumnMap(columnMap: GoogleSheetSyncConfigInput['column_map']): GoogleSheetColumnMap[] {
  return (Array.isArray(columnMap) && columnMap.length > 0 ? columnMap : DEFAULT_GOOGLE_SHEET_COLUMN_MAP).map((column) => ({
    ...column,
  })) as GoogleSheetColumnMap[]
}

function toFormValues(config: GoogleSheetSyncConfigInput): FormValues {
  return {
    id: config.id,
    name: config.name ?? 'Google Sheet sản xuất',
    enabled: config.enabled ?? true,
    sheet_a_file_id: config.sheet_a_file_id ?? '',
    sheet_a_tab_name: config.sheet_a_tab_name ?? 'Tổng hợp 2026',
    sheet_c_file_id: config.sheet_c_file_id ?? '',
    sheet_c_tab_name: config.sheet_c_tab_name ?? 'STEP3',
    sheet_b_file_id: config.sheet_b_file_id ?? '',
    sheet_b_tab_name: config.sheet_b_tab_name ?? 'OnlyView',
    sheet_b_pcode_col: config.sheet_b_pcode_col ?? 'số YCSX',
    sheet_b_status_col: config.sheet_b_status_col ?? 'Tình trạng',
    sheet_b_override_statuses: (config.sheet_b_override_statuses ?? ['Đã giao', 'Đang SX']).join(', '),
    cutoff_date: config.cutoff_date ?? '',
    default_status: config.default_status ?? 'Chưa SX',
    sheet_c_status: config.sheet_c_status ?? 'Đang kiểm',
    source_name: config.source_name ?? 'google_sheet',
    soft_delete_missing: config.soft_delete_missing ?? true,
    soft_delete_reason: config.soft_delete_reason ?? 'missing_from_google_sheet_reconcile',
    max_soft_delete_ratio: config.max_soft_delete_ratio ?? 0.2,
    auto_sync_enabled: config.auto_sync_enabled ?? false,
    auto_sync_time: normalizeTimeInput(config.auto_sync_time),
    auto_sync_timezone: config.auto_sync_timezone ?? 'Asia/Ho_Chi_Minh',
  }
}

function normalizeTimeInput(value: unknown): string {
  const text = String(value ?? '07:00').trim()
  const match = text.match(/^(\d{2}:\d{2})(?::\d{2})?$/)
  return match ? match[1] : '07:00'
}

function toActionInput(
  values: FormValues,
  initialConfig: GoogleSheetSyncConfigInput,
  sheetAColumnMap: GoogleSheetColumnMap[],
  sheetCColumnMap: GoogleSheetColumnMap[]
): GoogleSheetSyncConfigInput {
  return {
    ...initialConfig,
    id: values.id,
    name: values.name,
    enabled: values.enabled,
    sheet_a_file_id: values.sheet_a_file_id,
    sheet_a_tab_name: values.sheet_a_tab_name,
    sheet_c_file_id: values.sheet_c_file_id || null,
    sheet_c_tab_name: values.sheet_c_tab_name,
    sheet_b_file_id: values.sheet_b_file_id || null,
    sheet_b_tab_name: values.sheet_b_tab_name,
    sheet_b_pcode_col: values.sheet_b_pcode_col,
    sheet_b_status_col: values.sheet_b_status_col,
    sheet_b_override_statuses: values.sheet_b_override_statuses
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    cutoff_date: values.cutoff_date || null,
    default_status: values.default_status,
    sheet_c_status: values.sheet_c_status,
    source_name: values.source_name,
    soft_delete_missing: values.soft_delete_missing,
    soft_delete_reason: values.soft_delete_reason,
    max_soft_delete_ratio: Number(values.max_soft_delete_ratio),
    auto_sync_enabled: values.auto_sync_enabled,
    auto_sync_time: normalizeTimeInput(values.auto_sync_time),
    auto_sync_timezone: values.auto_sync_timezone || 'Asia/Ho_Chi_Minh',
    column_map: sheetAColumnMap,
    sheet_c_column_map: sheetCColumnMap,
  }
}

function configRowToInput(row: GoogleSheetSyncConfigRow): GoogleSheetSyncConfigInput {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    sheet_a_file_id: row.sheet_a_file_id,
    sheet_a_tab_name: row.sheet_a_tab_name,
    sheet_c_file_id: row.sheet_c_file_id,
    sheet_c_tab_name: row.sheet_c_tab_name,
    sheet_b_file_id: row.sheet_b_file_id,
    sheet_b_tab_name: row.sheet_b_tab_name,
    sheet_b_pcode_col: row.sheet_b_pcode_col,
    sheet_b_status_col: row.sheet_b_status_col,
    sheet_b_override_statuses: row.sheet_b_override_statuses,
    cutoff_date: row.cutoff_date,
    default_status: row.default_status,
    sheet_c_status: row.sheet_c_status,
    source_name: row.source_name,
    soft_delete_missing: row.soft_delete_missing,
    soft_delete_reason: row.soft_delete_reason,
    max_soft_delete_ratio: row.max_soft_delete_ratio,
    auto_sync_enabled: row.auto_sync_enabled,
    auto_sync_time: normalizeTimeInput(row.auto_sync_time),
    auto_sync_timezone: row.auto_sync_timezone,
    column_map: initialConfigColumnMap(row.column_map),
    sheet_c_column_map: initialConfigColumnMap(row.sheet_c_column_map) ?? initialConfigColumnMap(row.column_map),
  }
}

function initialConfigColumnMap(columnMap: unknown): GoogleSheetSyncConfigInput['column_map'] {
  return Array.isArray(columnMap) ? (columnMap as GoogleSheetSyncConfigInput['column_map']) : undefined
}

function ColumnMapEditor({
  title,
  description,
  value,
  onChange,
  disabled,
}: {
  title: string
  description: string
  value: GoogleSheetColumnMap[]
  onChange: (value: GoogleSheetColumnMap[]) => void
  disabled: boolean
}) {
  function updateColumn(index: number, patch: Partial<GoogleSheetColumnMap>) {
    onChange(value.map((column, columnIndex) => (columnIndex === index ? { ...column, ...patch } : column)))
  }

  return (
    <div className="rounded-2xl border border-dmc-border bg-[#f8fafc] p-4">
      <div>
        <h2 className="text-sm font-semibold text-dmc-text-primary">{title}</h2>
        <p className="mt-0.5 text-xs text-dmc-text-muted">{description}</p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-dmc-text-muted">
            <tr>
              <th className="px-2 py-2 text-left">Trường data</th>
              <th className="px-2 py-2 text-left">Tên cột trên Google Sheet</th>
              <th className="px-2 py-2 text-left">Kiểu</th>
              <th className="px-2 py-2 text-left">Bắt buộc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dmc-border">
            {value.map((column, index) => (
              <tr key={column.dest}>
                <td className="px-2 py-2 font-medium text-dmc-text-primary">{DEST_LABELS[column.dest]}</td>
                <td className="px-2 py-2">
                  <input
                    value={column.src}
                    onChange={(event) => updateColumn(index, { src: event.target.value })}
                    disabled={disabled}
                    className={inputCls}
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    value={column.type}
                    onChange={(event) => updateColumn(index, { type: event.target.value as GoogleSheetColumnType })}
                    disabled={disabled}
                    className={inputCls}
                  >
                    {COLUMN_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <label className="inline-flex items-center gap-2 text-xs text-dmc-text-muted">
                    <input
                      type="checkbox"
                      checked={column.required}
                      onChange={(event) => updateColumn(index, { required: event.target.checked })}
                      disabled={disabled}
                    />
                    required
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SummaryCard({ summary }: { summary: GoogleSheetSyncSummary | null }) {
  if (!summary) return null
  return (
    <div className="rounded-2xl border border-dmc-border bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-dmc-text-primary">Kết quả {summary.mode === 'run' ? 'Run' : 'Preview'}</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Dòng đọc', summary.sheetRowsRead],
          ['Hợp lệ', summary.validRows],
          ['Insert', summary.insertedRows],
          ['Update', summary.updatedRows],
          ['Không đổi', summary.unchangedRows],
          ['Soft-delete', summary.softDeletedRows],
          ['Override STATUS', summary.statusOverrides],
          ['Lỗi/skip', summary.errorCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-[#f5f5f7] px-3 py-2">
            <div className="text-[11px] text-dmc-text-muted">{label}</div>
            <div className="text-lg font-semibold text-dmc-text-primary">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 text-xs text-dmc-text-muted md:grid-cols-3">
        <div>Insert mẫu: {summary.samples.inserts.join(', ') || '—'}</div>
        <div>Update mẫu: {summary.samples.updates.join(', ') || '—'}</div>
        <div>Soft-delete mẫu: {summary.samples.softDeletes.join(', ') || '—'}</div>
      </div>
    </div>
  )
}

function HistoryTable({ rows }: { rows: GoogleSheetSyncRunRow[] }) {
  return (
    <div className="rounded-2xl border border-dmc-border bg-white shadow-sm">
      <div className="border-b border-dmc-border px-5 py-3">
        <h2 className="text-base font-semibold text-dmc-text-primary">Lịch sử đồng bộ</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f5f5f7] text-[11px] uppercase tracking-wide text-dmc-text-muted">
            <tr>
              <th className="px-4 py-2 text-left">Thời gian</th>
              <th className="px-4 py-2 text-left">Mode</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right">Rows</th>
              <th className="px-4 py-2 text-right">Insert</th>
              <th className="px-4 py-2 text-right">Update</th>
              <th className="px-4 py-2 text-right">Soft-delete</th>
              <th className="px-4 py-2 text-left">Lỗi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dmc-border">
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-dmc-text-muted">Chưa có lịch sử</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2 text-xs text-dmc-text-muted">{new Date(row.started_at).toLocaleString('vi-VN')}</td>
                <td className="px-4 py-2">{row.mode}</td>
                <td className="px-4 py-2">
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    row.status === 'success' ? 'bg-emerald-50 text-emerald-700' : row.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
                  )}>{row.status}</span>
                </td>
                <td className="px-4 py-2 text-right">{row.valid_rows}</td>
                <td className="px-4 py-2 text-right">{row.inserted_rows}</td>
                <td className="px-4 py-2 text-right">{row.updated_rows}</td>
                <td className="px-4 py-2 text-right">{row.soft_deleted_rows}</td>
                <td className="max-w-64 truncate px-4 py-2 text-xs text-red-500">{row.error_message ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function GoogleSheetSyncTab({ initialConfig, history, canEdit }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [summary, setSummary] = useState<GoogleSheetSyncSummary | null>(null)
  const [sheetAColumnMap, setSheetAColumnMap] = useState(() => cloneColumnMap(initialConfig.column_map))
  const [sheetCColumnMap, setSheetCColumnMap] = useState(() => cloneColumnMap(initialConfig.sheet_c_column_map ?? initialConfig.column_map))
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: toFormValues(initialConfig),
  })

  async function onSave(values: FormValues) {
    if (!canEdit) return toast.error('Bạn chỉ có quyền xem tab này.')
    setBusy('save')
    try {
      const result = await saveGoogleSheetSyncConfigAction(toActionInput(values, initialConfig, sheetAColumnMap, sheetCColumnMap))
      if (result.error) toast.error(result.error)
      else if (result.data) {
        const savedConfig = configRowToInput(result.data)
        toast.success('Đã lưu cấu hình Google Sheet sync')
        reset(toFormValues(savedConfig))
        setSheetAColumnMap(cloneColumnMap(savedConfig.column_map))
        setSheetCColumnMap(cloneColumnMap(savedConfig.sheet_c_column_map ?? savedConfig.column_map))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi lưu cấu hình Google Sheet sync')
    } finally {
      setBusy(null)
    }
  }

  async function runAction(kind: 'test' | 'preview' | 'run') {
    if (!canEdit) return toast.error('Bạn chỉ có quyền xem tab này.')
    setBusy(kind)
    try {
      if (kind === 'test') {
        const result = await testGoogleSheetSyncConnectionAction()
        if (result.error) toast.error(result.error)
        else toast.success(`Kết nối OK: ${result.data?.rows ?? 0} dòng`)
        return
      }

      const result = kind === 'preview'
        ? await previewGoogleSheetSyncAction()
        : await runGoogleSheetSyncAction()

      if (result.error) toast.error(result.error)
      else {
        setSummary(result.data ?? null)
        toast.success(kind === 'run' ? 'Đã chạy đồng bộ' : 'Preview hoàn tất')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi xử lý Google Sheet sync')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <form onSubmit={handleSubmit(onSave)} className="rounded-2xl border border-dmc-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-dmc-text-primary">Đồng bộ Google Sheet</h1>
            <p className="mt-0.5 text-sm text-dmc-text-muted">
              Web app đọc Google Sheet bằng service account, preview và ghi vào bảng data bằng PCODE reconcile.
            </p>
          </div>
          <button type="submit" disabled={!canEdit || busy === 'save'} className="flex items-center gap-1.5 rounded-xl bg-dmc-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
            <Save size={14} /> {busy === 'save' ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">Tên cấu hình<input {...register('name')} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">Cutoff date<input type="date" {...register('cutoff_date')} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">Sheet A file ID<input {...register('sheet_a_file_id')} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">Sheet A tab<input {...register('sheet_a_tab_name')} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">Sheet C file ID (trống = cùng file A)<input {...register('sheet_c_file_id')} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">Sheet C tab<input {...register('sheet_c_tab_name')} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">Sheet B file ID (optional)<input {...register('sheet_b_file_id')} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">Sheet B tab<input {...register('sheet_b_tab_name')} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">Sheet B cột PCODE<input {...register('sheet_b_pcode_col')} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">Sheet B cột STATUS<input {...register('sheet_b_status_col')} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">STATUS override (phân cách dấu phẩy)<input {...register('sheet_b_override_statuses')} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">STATUS mặc định Sheet A<input {...register('default_status')} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">STATUS Sheet C<input {...register('sheet_c_status')} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">source_name<input {...register('source_name')} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">Soft-delete reason<input {...register('soft_delete_reason')} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">Ngưỡng soft-delete<input type="number" step="0.01" min="0" max="1" {...register('max_soft_delete_ratio', { valueAsNumber: true })} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">Giờ tự động sync<input type="time" {...register('auto_sync_time')} disabled={!canEdit} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-dmc-text-muted">Timezone tự động sync<input {...register('auto_sync_timezone')} disabled={!canEdit} className={inputCls} /></label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-dmc-text-muted">
          <label className="flex items-center gap-2"><input type="checkbox" {...register('enabled')} disabled={!canEdit} /> Bật cấu hình</label>
          <label className="flex items-center gap-2"><input type="checkbox" {...register('soft_delete_missing')} disabled={!canEdit} /> Soft-delete PCODE mất khỏi nguồn</label>
          <label className="flex items-center gap-2"><input type="checkbox" {...register('auto_sync_enabled')} disabled={!canEdit} /> Tự động chạy sync mỗi ngày</label>
        </div>
        <p className="mt-2 text-xs text-dmc-text-muted">
          Vercel Cron kiểm tra mỗi 5 phút và chỉ chạy thật quanh giờ đã cấu hình theo Asia/Ho_Chi_Minh. Cần cấu hình CRON_SECRET trên Vercel staging.
        </p>

        <div className="mt-5 grid gap-4">
          <ColumnMapEditor
            title="Mapping cột Sheet A"
            description="Dùng cho sheet lệnh sản xuất đã duyệt. Tên cột phải khớp header trên Google Sheet."
            value={sheetAColumnMap}
            onChange={setSheetAColumnMap}
            disabled={!canEdit}
          />
          <ColumnMapEditor
            title="Mapping cột Sheet C"
            description="Dùng cho sheet lệnh đang kiểm. Có thể khác hoàn toàn header Sheet A."
            value={sheetCColumnMap}
            onChange={setSheetCColumnMap}
            disabled={!canEdit}
          />
        </div>
      </form>

      <div className="flex flex-wrap gap-3">
        <button onClick={() => runAction('test')} disabled={!canEdit || busy != null} className="flex items-center gap-2 rounded-xl border border-dmc-border bg-white px-4 py-2 text-sm font-medium disabled:opacity-40"><SearchCheck size={15} /> Test connection</button>
        <button onClick={() => runAction('preview')} disabled={!canEdit || busy != null} className="flex items-center gap-2 rounded-xl border border-dmc-border bg-white px-4 py-2 text-sm font-medium disabled:opacity-40"><Database size={15} /> Preview sync</button>
        <button onClick={() => runAction('run')} disabled={!canEdit || busy != null} className="flex items-center gap-2 rounded-xl bg-dmc-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40"><Play size={15} /> Run sync</button>
        {busy && <span className="flex items-center gap-2 text-sm text-dmc-text-muted"><RotateCw size={14} className="animate-spin" /> Đang xử lý {busy}...</span>}
      </div>

      <SummaryCard summary={summary} />
      <HistoryTable rows={history} />
    </div>
  )
}
