'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle, Clock, Plus, RefreshCw, Send, Trash2, XCircle } from 'lucide-react'
import { cn, formatDate, getTodayLocal } from '@/lib/utils'
import { getMaintenanceWorkshopOptions } from '@/lib/maintenance/workflow'
import { canApproveRequests } from '@/lib/approval/workflow'
import {
  OVERTIME_CATEGORIES,
  OVERTIME_CATEGORY_LABELS,
  OVERTIME_REASONS,
  OVERTIME_REASON_LABELS,
  type OvertimeRequestCreateInput,
} from '@/lib/validations/overtime'
import {
  createOvertimeRequestAction,
  listIncompleteOvertimeOrdersAction,
  listOvertimeEmployeesByWorkshopAction,
  listOvertimeRequestsAction,
  reviewOvertimeRequestAction,
  type OvertimeProductionOrderOption,
  type OvertimeRequestRow,
} from '@/lib/actions/overtime'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import type { SessionUser } from '@/types'
import type { OvertimeEmployeeOption } from '@/lib/overtime/workflow'

type ParticipantDraft = { human_resource_id: string; employee_name: string; hours: string }
type OvertimeView = 'request' | 'approvals' | 'history'

const inputCls = 'w-full h-9 px-2.5 rounded-lg text-[12px] font-medium text-[#1d1d1f] placeholder:text-[#aeaeb2] bg-white border border-[#d2d2d7] focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 transition-all'
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73] mb-1'

const STATUS_LABELS = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
} as const

function statusVariant(status: OvertimeRequestRow['approval_status']) {
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'danger'
  return 'warning'
}

interface Props {
  user: SessionUser
}

export function OvertimeTab({ user }: Props) {
  const searchParams = useSearchParams()
  const today = getTodayLocal()
  const approver = canApproveRequests(user.role)
  const allowedWorkshops = getMaintenanceWorkshopOptions(user.role, user.workspace, true)
  const requestWorkshopOptions = allowedWorkshops.filter((workshop) => workshop !== 'ALL')
  const defaultWorkshop = requestWorkshopOptions[0] ?? 'DMC1'

  const [rows, setRows] = useState<OvertimeRequestRow[]>([])
  const [orderOptions, setOrderOptions] = useState<OvertimeProductionOrderOption[]>([])
  const [employeeOptions, setEmployeeOptions] = useState<OvertimeEmployeeOption[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [filter, setFilter] = useState({
    workshop: allowedWorkshops[0] ?? defaultWorkshop,
    status: 'pending',
    from: '',
    to: '',
  })
  const [form, setForm] = useState({
    ot_date: today,
    customer: '',
    pcode: '',
    workshop: defaultWorkshop,
    ot_category: 'PRODUCTION' as (typeof OVERTIME_CATEGORIES)[number],
    required_output: '',
    planned_hours: '',
    notes: '',
  })
  const [reasons, setReasons] = useState<Record<string, boolean>>({})
  const [participants, setParticipants] = useState<ParticipantDraft[]>([
    { human_resource_id: '', employee_name: '', hours: '2' },
  ])
  const requestedView = searchParams.get('view')
  const activeView: OvertimeView = requestedView === 'approvals' && approver
    ? 'approvals'
    : requestedView === 'history'
      ? 'history'
      : 'request'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listOvertimeRequestsAction({
        workshop: filter.workshop !== 'ALL' ? filter.workshop : undefined,
        status: filter.status !== 'ALL' ? filter.status as 'pending' | 'approved' | 'rejected' : 'ALL',
        from: filter.from || undefined,
        to: filter.to || undefined,
      })
      if (res.success) setRows(res.data ?? [])
      else {
        setRows([])
        toast.error(res.message)
      }
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (activeView === 'approvals') {
      setFilter((prev) => ({ ...prev, status: 'pending' }))
    }
    if (activeView === 'history') {
      setFilter((prev) => ({ ...prev, status: 'ALL' }))
    }
  }, [activeView])

  useEffect(() => {
    if (requestWorkshopOptions.length === 0) {
      setOrderOptions([])
      setForm((prev) => ({ ...prev, pcode: '', customer: '' }))
      return
    }

    let cancelled = false

    async function loadOrderOptions() {
      setOrdersLoading(true)
      try {
        const res = await listIncompleteOvertimeOrdersAction(form.workshop, form.ot_date)
        if (cancelled) return

        if (res.success) {
          const options = res.data ?? []
          setOrderOptions(options)
          setForm((prev) => {
            if (!prev.pcode) return prev

            const selected = options.find((option) => option.pcode === prev.pcode)
            return selected
              ? { ...prev, customer: selected.customer }
              : { ...prev, pcode: '', customer: '' }
          })
        } else {
          setOrderOptions([])
          setForm((prev) => ({ ...prev, pcode: '', customer: '' }))
          toast.error(res.message)
        }
      } finally {
        if (!cancelled) setOrdersLoading(false)
      }
    }

    void loadOrderOptions()

    return () => {
      cancelled = true
    }
  }, [form.workshop, form.ot_date, requestWorkshopOptions.length])

  useEffect(() => {
    if (requestWorkshopOptions.length === 0) {
      setEmployeeOptions([])
      setParticipants([{ human_resource_id: '', employee_name: '', hours: '2' }])
      return
    }

    let cancelled = false

    async function loadEmployeeOptions() {
      setEmployeesLoading(true)
      try {
        const res = await listOvertimeEmployeesByWorkshopAction(form.workshop)
        if (cancelled) return

        if (res.success) {
          const options = res.data ?? []
          setEmployeeOptions(options)
          setParticipants((prev) => prev.map((participant) => {
            if (!participant.human_resource_id) return { ...participant, employee_name: '' }

            const selected = options.find((option) => String(option.id) === participant.human_resource_id)
            return selected
              ? { ...participant, employee_name: selected.name }
              : { ...participant, human_resource_id: '', employee_name: '' }
          }))
        } else {
          setEmployeeOptions([])
          setParticipants([{ human_resource_id: '', employee_name: '', hours: '2' }])
          toast.error(res.message)
        }
      } finally {
        if (!cancelled) setEmployeesLoading(false)
      }
    }

    void loadEmployeeOptions()

    return () => {
      cancelled = true
    }
  }, [form.workshop, requestWorkshopOptions.length])

  const totals = useMemo(() => {
    const valid = participants
      .map((participant) => ({
        employee_name: participant.employee_name.trim(),
        hours: Number(participant.hours),
      }))
      .filter((participant) => participant.employee_name && Number.isFinite(participant.hours) && participant.hours > 0)

    return {
      total_employees: valid.length,
      total_hours: valid.reduce((sum, participant) => sum + participant.hours, 0),
    }
  }, [participants])

  function updateForm<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateOvertimeDate(value: string) {
    setForm((prev) => ({ ...prev, ot_date: value, pcode: '', customer: '' }))
  }

  function updateWorkshop(value: string) {
    setForm((prev) => ({ ...prev, workshop: value, pcode: '', customer: '' }))
    setParticipants([{ human_resource_id: '', employee_name: '', hours: '2' }])
    setEmployeeOptions([])
  }

  function updatePcode(value: string) {
    const selected = orderOptions.find((option) => option.pcode === value)
    setForm((prev) => ({
      ...prev,
      pcode: selected?.pcode ?? '',
      customer: selected?.customer ?? '',
    }))
  }

  function updateParticipant(index: number, field: keyof ParticipantDraft, value: string) {
    setParticipants((prev) => prev.map((participant, i) =>
      i === index ? { ...participant, [field]: value } : participant
    ))
  }

  function updateParticipantEmployee(index: number, humanResourceId: string) {
    const selected = employeeOptions.find((option) => String(option.id) === humanResourceId)
    setParticipants((prev) => prev.map((participant, i) =>
      i === index
        ? {
            ...participant,
            human_resource_id: humanResourceId,
            employee_name: selected?.name ?? '',
          }
        : participant
    ))
  }

  function addParticipant() {
    setParticipants((prev) => [...prev, { human_resource_id: '', employee_name: '', hours: '2' }])
  }

  function removeParticipant(index: number) {
    setParticipants((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== index))
  }

  function resetForm() {
    setForm({
      ot_date: today,
      customer: '',
      pcode: '',
      workshop: defaultWorkshop,
      ot_category: 'PRODUCTION',
      required_output: '',
      planned_hours: '',
      notes: '',
    })
    setReasons({})
    setParticipants([{ human_resource_id: '', employee_name: '', hours: '2' }])
  }

  async function submitRequest() {
    if (requestWorkshopOptions.length === 0) {
      toast.error('Tài khoản chưa được gán xưởng để tạo yêu cầu tăng ca')
      return
    }

    const payload: OvertimeRequestCreateInput = {
      ot_date: form.ot_date,
      customer: form.customer,
      pcode: form.pcode,
      workshop: form.workshop as OvertimeRequestCreateInput['workshop'],
      ot_category: form.ot_category,
      reasons,
      required_output: form.required_output ? Number(form.required_output) : null,
      planned_hours: form.planned_hours ? Number(form.planned_hours) : null,
      notes: form.notes,
      participants: participants
        .map((participant) => ({
          employee_name: participant.employee_name.trim(),
          hours: Number(participant.hours),
        }))
        .filter((participant) => participant.employee_name),
    }

    setSubmitting(true)
    try {
      const res = await createOvertimeRequestAction(payload)
      if (res.success) {
        toast.success(res.message)
        resetForm()
        void load()
      } else {
        toast.error(res.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function review(id: string, decision: 'approved' | 'rejected') {
    setReviewingId(id)
    try {
      const res = await reviewOvertimeRequestAction(id, decision)
      if (res.success) {
        toast.success(res.message)
        void load()
      } else {
        toast.error(res.message)
      }
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">Yêu cầu tăng ca</h1>
          <p className="text-[13px] text-[#6e6e73] mt-0.5">
            Gửi yêu cầu tăng ca và chỉ ghi nhận KPI sau khi Manager/Admin duyệt
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[#6e6e73]">
          <Clock size={14} />
          <span>{totals.total_employees} người · {totals.total_hours.toFixed(1)} giờ</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-2xl border border-[#d2d2d7]/60 bg-white p-2 sm:grid-cols-3">
        <a
          href="/dashboard/administration?sub=overtime&view=request"
          className={cn(
            'rounded-xl px-3 py-2.5 text-center text-[13px] font-semibold transition-colors',
            activeView === 'request' ? 'bg-dmc-primary text-white shadow-sm' : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
          )}
        >
          Xin tăng ca
        </a>
        <a
          href="/dashboard/administration?sub=overtime&view=approvals"
          className={cn(
            'rounded-xl px-3 py-2.5 text-center text-[13px] font-semibold transition-colors',
            activeView === 'approvals' ? 'bg-dmc-primary text-white shadow-sm' : 'text-[#1d1d1f] hover:bg-[#f5f5f7]',
            !approver && 'pointer-events-none opacity-40'
          )}
        >
          Phê duyệt tăng ca
        </a>
        <a
          href="/dashboard/administration?sub=overtime&view=history"
          className={cn(
            'rounded-xl px-3 py-2.5 text-center text-[13px] font-semibold transition-colors',
            activeView === 'history' ? 'bg-dmc-primary text-white shadow-sm' : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
          )}
        >
          Lịch sử
        </a>
      </div>

      <div className={cn('grid grid-cols-1 gap-4', activeView === 'request' && 'xl:grid-cols-[420px_minmax(0,1fr)]')}>
        {activeView === 'request' && (
        <section className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-[#1d1d1f]">Tạo request</h2>
            <Badge variant={requestWorkshopOptions.length > 0 ? 'neutral' : 'danger'}>
              {requestWorkshopOptions.length > 0 ? 'Nháp' : 'Chưa gán xưởng'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Ngày OT *</label>
              <input type="date" value={form.ot_date} onChange={(e) => updateOvertimeDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Xưởng *</label>
              <select value={form.workshop} onChange={(e) => updateWorkshop(e.target.value)} className={inputCls}>
                {requestWorkshopOptions.map((workshop) => <option key={workshop} value={workshop}>{workshop}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Loại OT *</label>
              <select value={form.ot_category} onChange={(e) => updateForm('ot_category', e.target.value as typeof form.ot_category)} className={inputCls}>
                {OVERTIME_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{OVERTIME_CATEGORY_LABELS[category]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>LSX</label>
              <select
                value={form.pcode}
                onChange={(e) => updatePcode(e.target.value)}
                disabled={ordersLoading || orderOptions.length === 0}
                className={inputCls}
              >
                <option value="">
                  {ordersLoading
                    ? 'Đang tải LSX...'
                    : orderOptions.length > 0
                      ? 'Chọn LSX chưa hoàn thành'
                      : 'Không có LSX chưa hoàn thành'}
                </option>
                {orderOptions.map((option) => (
                  <option key={option.pcode} value={option.pcode}>
                    {option.pcode}{option.customer ? ` — ${option.customer}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Khách hàng</label>
              <input value={form.customer} readOnly className={cn(inputCls, 'bg-[#f5f5f7]')} placeholder="Tự hiển thị theo LSX" />
            </div>
            <div>
              <label className={labelCls}>Giờ kế hoạch</label>
              <input type="number" min="0" step="0.5" value={form.planned_hours} onChange={(e) => updateForm('planned_hours', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Sản lượng cần</label>
              <input type="number" min="0" step="1" value={form.required_output} onChange={(e) => updateForm('required_output', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Lý do</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OVERTIME_REASONS.map((reason) => (
                <label key={reason} className="flex items-center gap-2 rounded-lg border border-[#d2d2d7]/70 px-2.5 py-2 text-[12px] text-[#1d1d1f]">
                  <input
                    type="checkbox"
                    checked={Boolean(reasons[reason])}
                    onChange={(e) => setReasons((prev) => ({ ...prev, [reason]: e.target.checked }))}
                    className="h-3.5 w-3.5 accent-dmc-primary"
                  />
                  <span>{OVERTIME_REASON_LABELS[reason]}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Nhân viên tham gia *</label>
              <button type="button" onClick={addParticipant} className="inline-flex items-center gap-1 text-[12px] font-medium text-dmc-primary">
                <Plus size={13} /> Thêm người
              </button>
            </div>
            <div className="space-y-2">
              {participants.map((participant, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_82px_28px] gap-2">
                  <select
                    value={participant.human_resource_id}
                    onChange={(e) => updateParticipantEmployee(index, e.target.value)}
                    disabled={employeesLoading || employeeOptions.length === 0}
                    className={inputCls}
                  >
                    <option value="">
                      {employeesLoading
                        ? 'Đang tải nhân viên...'
                        : employeeOptions.length > 0
                          ? 'Chọn nhân viên'
                          : 'Chưa có nhân viên trong xưởng này'}
                    </option>
                    {employeeOptions.map((employee) => (
                      <option key={employee.id} value={String(employee.id)}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.5"
                    max="16"
                    step="0.5"
                    value={participant.hours}
                    onChange={(e) => updateParticipant(index, 'hours', e.target.value)}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => removeParticipant(index)}
                    disabled={participants.length === 1}
                    className="h-9 rounded-lg border border-[#d2d2d7] text-[#ff3b30] hover:bg-[#ff3b30]/5 disabled:opacity-30"
                    title="Xóa dòng"
                  >
                    <Trash2 size={13} className="mx-auto" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Ghi chú</label>
            <textarea value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} rows={3} className={cn(inputCls, 'h-auto resize-none')} />
          </div>

          <button
            type="button"
            onClick={submitRequest}
            disabled={submitting || requestWorkshopOptions.length === 0}
            className="w-full h-10 rounded-xl bg-dmc-primary text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={14} />
            {submitting ? 'Đang gửi...' : 'Gửi yêu cầu duyệt'}
          </button>
        </section>
        )}

        <section className="space-y-3">
          <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-[15px] font-bold text-[#1d1d1f]">
                  {activeView === 'approvals' ? 'Phê duyệt tăng ca' : activeView === 'history' ? 'Lịch sử tăng ca' : 'Yêu cầu tăng ca gần đây'}
                </h2>
                <p className="text-[12px] text-[#6e6e73]">
                  {activeView === 'approvals'
                    ? 'Danh sách request đang chờ duyệt, bấm nút xanh để duyệt hoặc đỏ để từ chối.'
                    : activeView === 'history'
                      ? 'Theo dõi các request đã duyệt, từ chối hoặc đang chờ.'
                      : 'Theo dõi request vừa tạo và trạng thái duyệt.'}
                </p>
              </div>
              {activeView === 'approvals' && (
                <Badge variant="warning">{rows.length} chờ duyệt</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Xưởng</label>
                <select value={filter.workshop} onChange={(e) => setFilter((prev) => ({ ...prev, workshop: e.target.value }))} className={cn(inputCls, 'w-28')}>
                  {allowedWorkshops.map((workshop) => <option key={workshop} value={workshop}>{workshop}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Trạng thái</label>
                <select value={filter.status} onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value }))} className={cn(inputCls, 'w-32')}>
                  <option value="pending">Chờ duyệt</option>
                  <option value="approved">Đã duyệt</option>
                  <option value="rejected">Từ chối</option>
                  <option value="ALL">Tất cả</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Từ ngày</label>
                <input type="date" value={filter.from} onChange={(e) => setFilter((prev) => ({ ...prev, from: e.target.value }))} className={cn(inputCls, 'w-36')} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Đến ngày</label>
                <input type="date" value={filter.to} onChange={(e) => setFilter((prev) => ({ ...prev, to: e.target.value }))} className={cn(inputCls, 'w-36')} />
              </div>
              <div className="flex items-end">
                <button onClick={() => void load()} className="flex items-center gap-1 px-3 py-2 text-[12px] rounded-xl border border-[#d2d2d7] hover:bg-[#f2f2f7]">
                  <RefreshCw size={12} className={cn(loading && 'animate-spin')} /> Làm mới
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 overflow-hidden">
            {loading ? <TableSkeleton rows={5} cols={8} /> : rows.length === 0 ? (
              <EmptyState icon="⏱" title="Chưa có yêu cầu tăng ca" subtitle="Tạo request mới hoặc đổi bộ lọc" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-[#f5f5f7] text-[11px] uppercase text-[#6e6e73]">
                    <tr>
                      <th className="p-3 text-left">Ngày</th>
                      <th className="p-3 text-left">Xưởng</th>
                      <th className="p-3 text-left">LSX / KH</th>
                      <th className="p-3 text-left">Loại</th>
                      <th className="p-3 text-right">Người</th>
                      <th className="p-3 text-right">Giờ</th>
                      <th className="p-3 text-center">Duyệt</th>
                      <th className="p-3 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-[#d2d2d7]/40 hover:bg-[#fafafa]">
                        <td className="p-3 font-medium">{formatDate(row.ot_date)}</td>
                        <td className="p-3"><Badge variant="neutral">{row.workshop}</Badge></td>
                        <td className="p-3">
                          <p className="font-semibold text-[#1d1d1f]">{row.pcode || '—'}</p>
                          <p className="text-[11px] text-[#6e6e73]">{row.customer || '—'}</p>
                        </td>
                        <td className="p-3 text-[12px]">{OVERTIME_CATEGORY_LABELS[row.ot_category as keyof typeof OVERTIME_CATEGORY_LABELS] ?? row.ot_category}</td>
                        <td className="p-3 text-right">{row.total_employees}</td>
                        <td className="p-3 text-right">{Number(row.total_hours).toFixed(1)}</td>
                        <td className="p-3 text-center">
                          <Badge variant={statusVariant(row.approval_status)}>{STATUS_LABELS[row.approval_status]}</Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            {approver && row.approval_status === 'pending' ? (
                              <>
                                <button
                                  onClick={() => review(row.id, 'approved')}
                                  disabled={reviewingId === row.id}
                                  title="Duyệt"
                                  className="text-emerald-600 hover:text-emerald-700 disabled:opacity-40"
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button
                                  onClick={() => review(row.id, 'rejected')}
                                  disabled={reviewingId === row.id}
                                  title="Từ chối"
                                  className="text-red-500 hover:text-red-600 disabled:opacity-40"
                                >
                                  <XCircle size={16} />
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-[#aeaeb2]">—</span>
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
        </section>
      </div>
    </div>
  )
}
