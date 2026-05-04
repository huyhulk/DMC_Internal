'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus, RefreshCw, Truck, CheckCircle, X, Trash2 } from 'lucide-react'
import { cn, formatDate, getLocalCompactDate, getTodayLocal } from '@/lib/utils'
import {
  deliveryCreateSchema, deliveryCompleteSchema, deliveryBaselineSchema,
  DELIVERY_STATUSES, DELIVERY_STATUS_LABELS,
  type DeliveryCreateInput, type DeliveryCompleteInput, type DeliveryBaselineInput,
} from '@/lib/validations/coordination'
import {
  createDeliveryAction, updateDeliveryAction, completeDeliveryAction,
  startDeliveryAction, cancelDeliveryAction, deleteDeliveryAction,
  listDeliveriesAction, upsertCostBaselineAction, listCostBaselinesAction,
  listCustomersAction, listVehicleCodesAction,
  type DeliveryRow,
} from '@/lib/actions/coordination'
import { listStaffByWorkshopAction } from '@/lib/actions/maintenance'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import { Combobox } from '@/components/ui/combobox'
import type { SessionUser } from '@/types'

const inputCls = 'w-full h-9 px-2.5 rounded-lg text-[12px] font-medium text-[#1d1d1f] placeholder:text-[#aeaeb2] bg-white border border-[#d2d2d7] focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 transition-all'
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73] mb-1'

function genDeliveryCode() {
  const yymmdd = getLocalCompactDate().slice(2)
  const nnn = String(Math.floor(Math.random() * 900) + 100)
  return `GH-${yymmdd}-${nnn}`
}

function statusVariant(s: string): 'warning' | 'info' | 'success' | 'danger' | 'neutral' {
  if (s === 'planned')    return 'warning'
  if (s === 'in_transit') return 'info'
  if (s === 'delivered')  return 'success'
  if (s === 'damaged')    return 'danger'
  return 'neutral'
}

interface Props {
  user: SessionUser
  canEdit: boolean
}

export function DeliveryTab({ user, canEdit }: Props) {
  const [rows, setRows]         = useState<DeliveryRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [showCreate, setShowCreate]   = useState(false)
  const [completeId, setCompleteId]   = useState<string | null>(null)
  const [deleteId, setDeleteId]       = useState<string | null>(null)
  const [showBaseline, setShowBaseline] = useState(false)
  const [customers, setCustomers]       = useState<string[]>([])
  const [vehicleCodes, setVehicleCodes]  = useState<string[]>([])
  const [dieuPhoiStaff, setDieuPhoiStaff] = useState<string[]>([])
  const [submitting, setSubmitting]   = useState(false)

  const [filter, setFilter] = useState({ from: '', to: '', status: 'ALL' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listDeliveriesAction({
      from:   filter.from || undefined,
      to:     filter.to   || undefined,
      status: filter.status !== 'ALL' ? filter.status : undefined,
    })
    if (res.success) setRows(res.data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    listCustomersAction().then(setCustomers)
    listVehicleCodesAction().then(setVehicleCodes)
    listStaffByWorkshopAction('DIEU-PHOI').then((staff) => setDieuPhoiStaff(staff.map((s) => s.name)))
  }, [])

  const createForm = useForm<DeliveryCreateInput>({
    resolver: zodResolver(deliveryCreateSchema),
    defaultValues: { delivery_code: genDeliveryCode(), planned_date: getTodayLocal() },
  })

  const completeForm = useForm<DeliveryCompleteInput>({
    resolver: zodResolver(deliveryCompleteSchema),
    defaultValues: { actual_date: getTodayLocal(), damaged_weight_tons: 0, status: 'delivered' },
  })

  const baselineForm = useForm<DeliveryBaselineInput>({
    resolver: zodResolver(deliveryBaselineSchema),
    defaultValues: { year: 2025, avg_cost_per_ton: 0 },
  })

  const customerField = createForm.watch('customer') ?? ''
  const vehicleField  = createForm.watch('vehicle_code') ?? ''

  async function onCreateSubmit(values: DeliveryCreateInput) {
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    setSubmitting(true)
    const res = await createDeliveryAction(values)
    if (res.success) { toast.success(res.message); setShowCreate(false); createForm.reset({ delivery_code: genDeliveryCode(), planned_date: getTodayLocal() }); void load() }
    else toast.error(res.message)
    setSubmitting(false)
  }

  async function onCompleteSubmit(values: DeliveryCompleteInput) {
    if (!completeId) return
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    setSubmitting(true)
    const res = await completeDeliveryAction(completeId, values)
    if (res.success) { toast.success(res.message); setCompleteId(null); void load() }
    else toast.error(res.message)
    setSubmitting(false)
  }

  async function onBaselineSubmit(values: DeliveryBaselineInput) {
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    setSubmitting(true)
    const res = await upsertCostBaselineAction(values)
    if (res.success) { toast.success(res.message); setShowBaseline(false) }
    else toast.error(res.message)
    setSubmitting(false)
  }

  async function handleStart(id: string) {
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    const res = await startDeliveryAction(id)
    if (res.success) { toast.success(res.message); void load() }
    else toast.error(res.message)
  }

  async function handleCancel(id: string) {
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    const res = await cancelDeliveryAction(id)
    if (res.success) { toast.success(res.message); void load() }
    else toast.error(res.message)
  }

  async function onDelete() {
    if (!deleteId) return
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    setSubmitting(true)
    const res = await deleteDeliveryAction(deleteId)
    if (res.success) { toast.success(res.message); setDeleteId(null); void load() }
    else toast.error(res.message)
    setSubmitting(false)
  }

  const damagedWeight = completeForm.watch('damaged_weight_tons') ?? 0
  const today = getTodayLocal()

  function isOverdue(row: DeliveryRow) {
    return !row.actual_date && (row.status === 'planned' || row.status === 'in_transit') && row.planned_date < today
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">Giao hàng (KH-02/03/07)</h1>
          <p className="text-[13px] text-[#6e6e73] mt-0.5">Quản lý lịch giao, theo dõi tiến độ và chi phí</p>
        </div>
        <div className="flex gap-2">
          {canEdit && user.role === 'ADMIN' && (
            <button onClick={() => setShowBaseline(true)}
              className="px-3 py-2 text-[13px] font-medium border border-[#d2d2d7] text-[#6e6e73] rounded-xl hover:bg-[#f2f2f7]">
              Baseline CP
            </button>
          )}
          {canEdit && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium bg-dmc-primary text-white rounded-xl hover:opacity-90">
              <Plus size={14} /> Thêm lịch giao
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4 flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Trạng thái</label>
          <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))} className={cn(inputCls, 'w-36')}>
            <option value="ALL">Tất cả</option>
            {DELIVERY_STATUSES.map((s) => <option key={s} value={s}>{DELIVERY_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Từ ngày</label>
          <input type="date" value={filter.from} onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))} className={cn(inputCls, 'w-36')} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Đến ngày</label>
          <input type="date" value={filter.to} onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))} className={cn(inputCls, 'w-36')} />
        </div>
        <div className="flex items-end">
          <button onClick={() => void load()} className="flex items-center gap-1 px-3 py-2 text-[12px] rounded-xl border border-[#d2d2d7] hover:bg-[#f2f2f7]">
            <RefreshCw size={12} className={cn(loading && 'animate-spin')} /> Làm mới
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 overflow-hidden">
        {loading ? <TableSkeleton rows={5} cols={8} /> : rows.length === 0 ? (
          <EmptyState icon="🚛" title="Chưa có lịch giao hàng" subtitle="Thêm lịch giao hàng mới" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#f5f5f7] text-[11px] uppercase text-[#6e6e73]">
                <tr>
                  <th className="p-3 text-left">Mã GH</th>
                  <th className="p-3 text-left">Khách hàng</th>
                  <th className="p-3 text-left">Kế hoạch</th>
                  <th className="p-3 text-left">Thực hiện</th>
                  <th className="p-3 text-right">KL (T)</th>
                  <th className="p-3 text-right">Hư hỏng</th>
                  <th className="p-3 text-center">Đúng hạn</th>
                  <th className="p-3 text-center">Trạng thái</th>
                  <th className="p-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#d2d2d7]/40 hover:bg-[#fafafa]">
                    <td className="p-3 font-mono text-[12px] font-semibold">{row.delivery_code}</td>
                    <td className="p-3">
                      <p className="text-[12px] font-medium">{row.customer}</p>
                      {row.pcode && <p className="text-[11px] text-[#6e6e73]">{row.pcode}</p>}
                    </td>
                    <td className="p-3 text-[12px]">{formatDate(row.planned_date)}</td>
                    <td className="p-3 text-[12px]">{row.actual_date ? formatDate(row.actual_date) : '—'}</td>
                    <td className="p-3 text-right font-mono text-[12px]">{Number(row.total_weight_tons).toFixed(3)}</td>
                    <td className={cn('p-3 text-right text-[12px]', Number(row.damage_pct) > 0 && 'text-red-600 font-semibold')}>
                      {Number(row.damage_pct) > 0 ? `${Number(row.damage_pct).toFixed(1)}%` : '—'}
                    </td>
                    <td className="p-3 text-center">
                      {row.actual_date
                        ? <Badge variant={row.is_on_time ? 'success' : 'danger'}>{row.is_on_time ? '✓' : '✗'}</Badge>
                        : <span className="text-[#aeaeb2]">—</span>}
                    </td>
                    <td className="p-3 text-center">
                      {isOverdue(row)
                        ? <Badge variant="danger">Quá hạn</Badge>
                        : <Badge variant={statusVariant(row.status)}>
                            {DELIVERY_STATUS_LABELS[row.status as typeof DELIVERY_STATUSES[number]] ?? row.status}
                          </Badge>
                      }
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {canEdit && row.status === 'planned' && (
                          <>
                            <button onClick={() => handleStart(row.id)} title="Bắt đầu giao" className="text-blue-600 hover:text-blue-700">
                              <Truck size={14} />
                            </button>
                            <button onClick={() => handleCancel(row.id)} title="Hủy" className="text-[#6e6e73] hover:text-red-600">
                              <X size={14} />
                            </button>
                          </>
                        )}
                        {canEdit && row.status === 'in_transit' && (
                          <button onClick={() => { setCompleteId(row.id); completeForm.reset({ actual_date: getTodayLocal(), damaged_weight_tons: 0, status: 'delivered' }) }}
                            title="Hoàn thành giao" className="text-emerald-600 hover:text-emerald-700">
                            <CheckCircle size={15} />
                          </button>
                        )}
                        {canEdit && user.role === 'ADMIN' && (
                          <button onClick={() => setDeleteId(row.id)} title="Xóa" className="text-red-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="Lịch giao hàng mới" size="lg">
        <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mã GH *</label>
              <input {...createForm.register('delivery_code')} className={inputCls} />
              {createForm.formState.errors.delivery_code && (
                <p className="text-[11px] text-red-500 mt-0.5">{createForm.formState.errors.delivery_code.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Khách hàng *</label>
              <Combobox value={customerField} onChange={(v) => createForm.setValue('customer', v)}
                options={customers} placeholder="Tên khách hàng" />
              {createForm.formState.errors.customer && (
                <p className="text-[11px] text-red-500 mt-0.5">{createForm.formState.errors.customer.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>PCODE</label>
              <input {...createForm.register('pcode')} className={inputCls} placeholder="LSX01/26-..." />
            </div>
            <div>
              <label className={labelCls}>Ngày kế hoạch *</label>
              <input type="date" {...createForm.register('planned_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Khối lượng (Tấn) *</label>
              <input type="number" step="0.001" min="0" {...createForm.register('total_weight_tons', { valueAsNumber: true })} className={inputCls} />
              {createForm.formState.errors.total_weight_tons && (
                <p className="text-[11px] text-red-500 mt-0.5">{createForm.formState.errors.total_weight_tons.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Số xe</label>
              <Combobox value={vehicleField} onChange={(v) => createForm.setValue('vehicle_code', v)}
                options={vehicleCodes} placeholder="51C-12345" />
            </div>
            <div>
              <label className={labelCls}>Tài xế</label>
              <select {...createForm.register('driver')} className={inputCls}>
                <option value="">— Chọn —</option>
                {dieuPhoiStaff.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Địa chỉ giao</label>
            <textarea {...createForm.register('delivery_address')} rows={2} className={cn(inputCls, 'h-auto resize-none')} />
          </div>
          <div>
            <label className={labelCls}>Ghi chú</label>
            <textarea {...createForm.register('notes')} rows={2} className={cn(inputCls, 'h-auto resize-none')} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">Hủy</button>
            <button type="submit" disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-dmc-primary text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Đang lưu…' : 'Tạo lịch giao'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={!!completeId} onClose={() => setCompleteId(null)} title="Hoàn thành giao hàng" size="md">
        <form onSubmit={completeForm.handleSubmit(onCompleteSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Ngày giao thực tế *</label>
              <input type="date" {...completeForm.register('actual_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Trạng thái *</label>
              <select {...completeForm.register('status')} className={inputCls}>
                <option value="delivered">Đã giao</option>
                <option value="damaged">Hư hỏng</option>
                <option value="cancelled">Hủy</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>KL hư hỏng (Tấn)</label>
              <input type="number" step="0.001" min="0" {...completeForm.register('damaged_weight_tons', { valueAsNumber: true })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Chi phí vận chuyển (VND)</label>
              <input type="number" min="0" {...completeForm.register('delivery_cost', { valueAsNumber: true })} className={inputCls} />
            </div>
          </div>
          {Number(damagedWeight) > 0 && (
            <div>
              <label className={labelCls}>Lý do hư hỏng *</label>
              <textarea {...completeForm.register('damage_reason')} rows={2} className={cn(inputCls, 'h-auto resize-none')} />
              {completeForm.formState.errors.damage_reason && (
                <p className="text-[11px] text-red-500 mt-0.5">{completeForm.formState.errors.damage_reason.message}</p>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setCompleteId(null)}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">Hủy</button>
            <button type="submit" disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Đang lưu…' : 'Hoàn thành'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Baseline Dialog */}
      <Dialog open={showBaseline} onClose={() => setShowBaseline(false)} title="Baseline chi phí vận chuyển" size="sm">
        <form onSubmit={baselineForm.handleSubmit(onBaselineSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Năm *</label>
              <input type="number" {...baselineForm.register('year', { valueAsNumber: true })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tháng (để trống = cả năm)</label>
              <input type="number" min="1" max="12" {...baselineForm.register('month', { valueAsNumber: true })} className={inputCls} placeholder="1-12" />
            </div>
          </div>
          <div>
            <label className={labelCls}>CP trung bình / Tấn (VND) *</label>
            <input type="number" min="0" {...baselineForm.register('avg_cost_per_ton', { valueAsNumber: true })} className={inputCls} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowBaseline(false)}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">Hủy</button>
            <button type="submit" disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-dmc-primary text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Đang lưu…' : 'Lưu baseline'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Xác nhận xóa" size="sm">
        <p className="text-[13px] mb-4">Bạn có chắc muốn xóa lịch giao hàng này?</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteId(null)} className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">Hủy</button>
          <button onClick={onDelete} disabled={submitting} className="flex-1 h-10 rounded-xl bg-red-600 text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
            {submitting ? 'Đang xóa…' : 'Xóa'}
          </button>
        </div>
      </Dialog>
    </div>
  )
}
