'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  machineCreateSchema, type MachineCreateInput,
  KPI_WORKSHOPS, MACHINE_STATUSES, MACHINE_STATUS_LABELS,
} from '@/lib/validations/maintenance'
import {
  listMachinesAction, createMachineAction, updateMachineAction, deleteMachineAction,
  type MachineRow,
} from '@/lib/actions/maintenance'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import type { SessionUser } from '@/types'

const inputCls = 'w-full h-9 px-2.5 rounded-lg text-[12px] font-medium text-[#1d1d1f] placeholder:text-[#aeaeb2] bg-white border border-[#d2d2d7] focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 transition-all'
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73] mb-1'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active:      'success',
  maintenance: 'warning',
  broken:      'danger',
  inactive:    'neutral',
}

interface Props {
  user: SessionUser
  canEdit: boolean
}

export function MachinesTab({ user, canEdit }: Props) {
  const [rows, setRows]             = useState<MachineRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editRow, setEditRow]       = useState<MachineRow | null>(null)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [filterLoc, setFilterLoc]   = useState<string>('ALL')

  const canWrite = canEdit && (user.role === 'ADMIN' || user.role === 'MANAGER')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listMachinesAction(filterLoc !== 'ALL' ? filterLoc : undefined)
    if (res.success) setRows(res.data ?? [])
    setLoading(false)
  }, [filterLoc])

  useEffect(() => { void load() }, [load])

  const form = useForm<MachineCreateInput>({
    resolver: zodResolver(machineCreateSchema),
    defaultValues: { machine_location: 'DMC1', machine_status: 'active' },
  })

  function openCreate() {
    form.reset({ machine_location: 'DMC1', machine_status: 'active' })
    setShowCreate(true)
  }

  function openEdit(row: MachineRow) {
    form.reset({
      machine_name:     row.machine_name,
      machine_code:     row.machine_code ?? '',
      machine_location: row.machine_location as typeof KPI_WORKSHOPS[number],
      machine_status:   row.machine_status as typeof MACHINE_STATUSES[number],
      machine_capacity: row.machine_capacity ?? '',
    })
    setEditRow(row)
  }

  async function onSubmit(values: MachineCreateInput) {
    setSubmitting(true)
    const res = editRow
      ? await updateMachineAction(editRow.id, values)
      : await createMachineAction(values)
    if (res.success) {
      toast.success(res.message)
      setShowCreate(false)
      setEditRow(null)
      form.reset()
      void load()
    } else toast.error(res.message)
    setSubmitting(false)
  }

  async function onDelete() {
    if (!deleteId) return
    setSubmitting(true)
    const res = await deleteMachineAction(deleteId)
    if (res.success) { toast.success(res.message); setDeleteId(null); void load() }
    else toast.error(res.message)
    setSubmitting(false)
  }

  const isOpen = showCreate || !!editRow

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">Danh mục thiết bị</h1>
          <p className="text-[13px] text-[#6e6e73] mt-0.5">Quản lý máy móc — nguồn dữ liệu cho droplist nhập liệu</p>
        </div>
        {canWrite && (
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium bg-dmc-primary text-white rounded-xl hover:opacity-90">
            <Plus size={14} /> Thêm thiết bị
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Xưởng</label>
          <select value={filterLoc} onChange={(e) => setFilterLoc(e.target.value)} className={cn(inputCls, 'w-32')}>
            <option value="ALL">Tất cả</option>
            {KPI_WORKSHOPS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <button onClick={() => void load()} className="flex items-center gap-1 px-3 py-2 text-[12px] rounded-xl border border-[#d2d2d7] hover:bg-[#f2f2f7]">
          <RefreshCw size={12} className={cn(loading && 'animate-spin')} /> Làm mới
        </button>
        <span className="text-[12px] text-[#6e6e73] ml-auto self-center">{rows.length} thiết bị</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 overflow-hidden">
        {loading ? <TableSkeleton rows={6} cols={6} /> : rows.length === 0 ? (
          <EmptyState icon="⚙️" title="Chưa có thiết bị nào" subtitle="Nhấn 'Thêm thiết bị' để bắt đầu" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#f5f5f7] text-[11px] uppercase text-[#6e6e73]">
                <tr>
                  <th className="p-3 text-left">Mã TB</th>
                  <th className="p-3 text-left">Tên thiết bị</th>
                  <th className="p-3 text-left">Xưởng</th>
                  <th className="p-3 text-left">Năng suất</th>
                  <th className="p-3 text-center">Trạng thái</th>
                  {canWrite && <th className="p-3 text-center">Hành động</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#d2d2d7]/40 hover:bg-[#fafafa]">
                    <td className="p-3 font-mono text-[12px] font-semibold text-dmc-primary">
                      {row.machine_code ?? <span className="text-[#aeaeb2]">—</span>}
                    </td>
                    <td className="p-3 font-medium">{row.machine_name}</td>
                    <td className="p-3">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f2f2f7] text-[#6e6e73]">
                        {row.machine_location}
                      </span>
                    </td>
                    <td className="p-3 text-[12px] text-[#6e6e73]">{row.machine_capacity ?? '—'}</td>
                    <td className="p-3 text-center">
                      <Badge variant={STATUS_VARIANT[row.machine_status] ?? 'neutral'}>
                        {MACHINE_STATUS_LABELS[row.machine_status as keyof typeof MACHINE_STATUS_LABELS] ?? row.machine_status}
                      </Badge>
                    </td>
                    {canWrite && (
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit(row)} title="Sửa" className="text-[#6e6e73] hover:text-dmc-primary">
                            <Pencil size={14} />
                          </button>
                          {user.role === 'ADMIN' && (
                            <button onClick={() => setDeleteId(row.id)} title="Xóa" className="text-red-400 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isOpen} onClose={() => { setShowCreate(false); setEditRow(null) }}
        title={editRow ? 'Sửa thiết bị' : 'Thêm thiết bị mới'} size="md">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className={labelCls}>Tên thiết bị *</label>
            <input {...form.register('machine_name')} className={inputCls} placeholder="Máy cán tôn 5S" />
            {form.formState.errors.machine_name && (
              <p className="text-[11px] text-red-500 mt-0.5">{form.formState.errors.machine_name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mã thiết bị</label>
              <input {...form.register('machine_code')} className={inputCls} placeholder="CT5S" />
            </div>
            <div>
              <label className={labelCls}>Xưởng *</label>
              <select {...form.register('machine_location')} className={inputCls}>
                {KPI_WORKSHOPS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Trạng thái</label>
              <select {...form.register('machine_status')} className={inputCls}>
                {MACHINE_STATUSES.map((s) => (
                  <option key={s} value={s}>{MACHINE_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Năng suất</label>
              <input {...form.register('machine_capacity')} className={inputCls} placeholder="18 m/phút" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => { setShowCreate(false); setEditRow(null) }}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7] text-[13px] text-[#6e6e73] hover:bg-[#f2f2f7]">
              Hủy
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-dmc-primary text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Đang lưu…' : editRow ? 'Cập nhật' : 'Thêm thiết bị'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Xác nhận xóa" size="sm">
        <p className="text-[13px] mb-4">Bạn có chắc muốn xóa thiết bị này?</p>
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
