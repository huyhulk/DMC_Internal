'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog } from '@/components/ui/dialog'
import {
  createNormOverrideAction,
  updateNormOverrideAction,
  deleteNormOverrideAction,
  type NormOverrideRow,
  type NormOverrideInput,
} from '@/lib/actions/norm-override'

export type NormProductOption = {
  products: string
  workshop: string
  workshopCode: string
  norm: number
}

const WORKSHOP_SCOPES = ['', 'DMC1', 'DMC3', 'DMC4', 'DMC5', 'CONG_TRINH'] as const

const inputCls =
  'w-full h-9 px-2.5 rounded-lg text-[13px] font-medium text-[#1d1d1f] placeholder:text-[#aeaeb2] ' +
  'bg-white border border-[#d2d2d7] focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 transition-all'
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73] mb-1'

type FormState = {
  keyword: string
  workshop: string
  target_products: string
  requireAnyText: string
  priority: number
  note: string
}

const EMPTY_FORM: FormState = { keyword: '', workshop: '', target_products: '', requireAnyText: '', priority: 0, note: '' }

function rowToForm(row: NormOverrideRow): FormState {
  return {
    keyword: row.keyword,
    workshop: row.workshop ?? '',
    target_products: row.target_products,
    requireAnyText: (row.require_any ?? []).join(', '),
    priority: row.priority,
    note: row.note ?? '',
  }
}

function formToInput(form: FormState): NormOverrideInput {
  return {
    keyword: form.keyword,
    workshop: form.workshop || null,
    target_products: form.target_products,
    require_any: form.requireAnyText.split(',').map((m) => m.trim()).filter(Boolean),
    priority: Number(form.priority) || 0,
    note: form.note || null,
  }
}

export function NormOverrideTab({
  initialRows,
  loadError,
  normOptions,
}: {
  initialRows: NormOverrideRow[]
  loadError?: string
  normOptions: NormProductOption[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<NormOverrideRow | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(row: NormOverrideRow) {
    setEditing(row)
    setForm(rowToForm(row))
    setShowForm(true)
  }

  function onPickNorm(key: string) {
    const opt = normOptions.find((o) => `${o.products}|||${o.workshop}` === key)
    if (!opt) return
    setForm((f) => ({ ...f, target_products: opt.products, workshop: f.workshop || opt.workshopCode }))
  }

  async function onSubmit() {
    const input = formToInput(form)
    if (!input.keyword || !input.target_products) {
      toast.warning('Vui lòng nhập Từ khóa và chọn Định mức đích.')
      return
    }
    setSubmitting(true)
    const res = editing
      ? await updateNormOverrideAction(editing.id, input)
      : await createNormOverrideAction(input)
    setSubmitting(false)
    if (res.success) {
      toast.success(res.message)
      setShowForm(false)
      router.refresh()
    } else {
      toast.error(res.message)
    }
  }

  async function onDelete() {
    if (deleteId == null) return
    setSubmitting(true)
    const res = await deleteNormOverrideAction(deleteId)
    setSubmitting(false)
    if (res.success) {
      toast.success(res.message)
      setDeleteId(null)
      router.refresh()
    } else {
      toast.error(res.message)
    }
  }

  const selectedKey = normOptions.find((o) => o.products === form.target_products)
    ? `${form.target_products}|||${normOptions.find((o) => o.products === form.target_products)!.workshop}`
    : ''

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">Override định mức</h1>
          <p className="mt-0.5 text-[13px] text-[#6e6e73]">
            Ánh xạ thủ công &quot;từ khóa diễn giải → định mức cụ thể&quot; cho tab Tổng quan LSX. Dùng khi heuristic gắn nhầm định mức.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-dmc-primary px-3 py-2 text-[13px] font-medium text-white hover:opacity-90"
        >
          <Plus size={14} /> Thêm override
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-800">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Khi một diễn giải lệnh <b>chứa từ khóa</b> (và đúng xưởng, nếu chọn), hệ thống dùng <b>định mức đích</b> bạn chỉ định,
          bỏ qua suy luận tự động. Ưu tiên cao hơn sẽ thắng khi nhiều dòng cùng khớp. Lưu xong áp dụng trong vòng ~5 phút (hoặc lần tải lại kế tiếp).
        </span>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
          Lỗi tải dữ liệu: {loadError}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#d2d2d7]/60 bg-white">
        {initialRows.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[#aeaeb2]">Chưa có override nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#f5f5f7] text-[11px] uppercase text-[#6e6e73]">
                <tr>
                  <th className="p-3 text-left">Từ khóa</th>
                  <th className="p-3 text-left">Xưởng</th>
                  <th className="p-3 text-left">Định mức đích</th>
                  <th className="p-3 text-left">Marker bắt buộc</th>
                  <th className="p-3 text-right">Ưu tiên</th>
                  <th className="p-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {initialRows.map((row) => (
                  <tr key={row.id} className="border-t border-[#d2d2d7]/40 hover:bg-[#fafafa]">
                    <td className="p-3 font-semibold text-[#1d1d1f]">{row.keyword}</td>
                    <td className="p-3 text-[#6e6e73]">{row.workshop || 'Mọi xưởng'}</td>
                    <td className="p-3 text-[#1d1d1f]">{row.target_products}</td>
                    <td className="p-3 text-[12px] text-[#6e6e73]">{(row.require_any ?? []).join(', ') || '—'}</td>
                    <td className="p-3 text-right font-mono">{row.priority}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(row)} title="Sửa" className="text-blue-600 hover:text-blue-700">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteId(row.id)} title="Xóa" className="text-red-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Sửa override' : 'Thêm override'} size="md">
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Từ khóa (tìm trong diễn giải) *</label>
            <input
              value={form.keyword}
              onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
              placeholder='vd: "PKK - cùm"'
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Định mức đích *</label>
              <select value={selectedKey} onChange={(e) => onPickNorm(e.target.value)} className={inputCls}>
                <option value="">— Chọn định mức —</option>
                {normOptions.map((o) => (
                  <option key={`${o.products}|||${o.workshop}`} value={`${o.products}|||${o.workshop}`}>
                    {o.products} ({o.workshopCode} · {o.norm})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Phạm vi xưởng</label>
              <select
                value={form.workshop}
                onChange={(e) => setForm((f) => ({ ...f, workshop: e.target.value }))}
                className={inputCls}
              >
                {WORKSHOP_SCOPES.map((w) => (
                  <option key={w || 'all'} value={w}>{w || 'Mọi xưởng'}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Marker bắt buộc (cách nhau dấu phẩy)</label>
              <input
                value={form.requireAnyText}
                onChange={(e) => setForm((f) => ({ ...f, requireAnyText: e.target.value }))}
                placeholder="vd: pkk, phụ kiện"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Ưu tiên</label>
              <input
                type="number"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Ghi chú</label>
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]"
            >
              Hủy
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-dmc-primary text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Đang lưu…' : editing ? 'Cập nhật' : 'Thêm'}
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog open={deleteId != null} onClose={() => setDeleteId(null)} title="Xác nhận xóa" size="sm">
        <p className="mb-4 text-[13px]">Bạn có chắc muốn xóa override này?</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteId(null)} className={cn('flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]')}>
            Hủy
          </button>
          <button onClick={onDelete} disabled={submitting} className="flex-1 h-10 rounded-xl bg-red-600 text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
            {submitting ? 'Đang xóa…' : 'Xóa'}
          </button>
        </div>
      </Dialog>
    </div>
  )
}
