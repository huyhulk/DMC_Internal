'use client'

import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ChevronRight,
  Download,
  Eye,
  History,
  Lock,
  RefreshCw,
  Save,
  Search,
  Unlock,
  X,
} from 'lucide-react'
import { listProductionInputHistoryAction } from '@/lib/actions/data'
import { useProductionData } from '@/hooks/use-production-data'
import { OrderInfoCard } from './order-info-card'
import { ProductLineCard } from './product-line-card'
import { UnlockDialog } from './unlock-dialog'
import {
  filterProductionOrdersByPcode,
  getProductionOrderStatusRank,
  sortProductionOrdersForEntry,
} from '@/lib/production/workflow'
import { VietnameseDatePicker } from '@/components/ui/vietnamese-date-picker'
import { cn, formatDate, formatDateTimeDisplay, formatLocalDateTimeString, getTodayLocal, workshopCode } from '@/lib/utils'
import type { NormItem, OpenProductionOrder, Order, ProductLine, ProductionInputHistoryRow, SessionUser } from '@/types'

interface Props {
  user: SessionUser
  canEdit: boolean
}

type ProductionStatusFilter = 'ALL' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'

interface OpenOrdersTabProps extends Props {
  refreshSignal: number
}

const deadlineBadgeClasses = {
  none: 'border-[#d2d2d7]/70 bg-[#f2f2f7] text-[#6e6e73]',
  red: 'border-red-200 bg-red-50 text-red-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-700',
  yellow: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
} as const

const inputCls =
  'w-full h-10 px-3 rounded-xl text-[13px] font-medium ' +
  'text-dmc-text-primary placeholder:text-dmc-text-muted ' +
  'bg-white border border-dmc-border ' +
  'focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 ' +
  'shadow-[0_1px_2px_rgba(0,0,0,0.05)]'

export function ProductionTab({ user, canEdit }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<'open-orders' | 'daily-entry'>('open-orders')
  const [showHistory, setShowHistory] = useState(false)
  const [refreshSignal, setRefreshSignal] = useState(0)

  if (showHistory) {
    return <ProductionInputHistoryTab onBack={() => setShowHistory(false)} />
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#f5f5f7]">
      <div className="shrink-0 px-3 sm:px-4 pt-3 bg-white/85 backdrop-blur-sm border-b border-[#d2d2d7]/60 space-y-3">
        {!canEdit && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-700">
            Bạn chỉ có quyền xem tab này.
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pb-3">
          <div className="inline-flex p-1 rounded-2xl bg-[#f2f2f7] border border-[#d2d2d7]/60 w-full sm:w-auto">
            <SubTabButton active={activeSubTab === 'open-orders'} onClick={() => setActiveSubTab('open-orders')}>
              Danh sách lệnh sản xuất
            </SubTabButton>
            <SubTabButton active={activeSubTab === 'daily-entry'} onClick={() => setActiveSubTab('daily-entry')}>
              Theo dõi lệnh theo ngày tạo
            </SubTabButton>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={() => setRefreshSignal((value) => value + 1)}
              disabled={activeSubTab !== 'open-orders'}
              className="h-9 px-3 rounded-xl border border-[#d2d2d7]/70 text-[12px] font-medium text-[#6e6e73] bg-white hover:bg-[#f2f2f7] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-all duration-150"
            >
              <RefreshCw size={12} />
              <span>Làm mới</span>
            </button>
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="h-9 px-3 rounded-xl border border-[#d2d2d7]/70 text-[12px] font-medium text-dmc-primary bg-white hover:bg-[#f2f2f7] active:scale-95 flex items-center justify-center gap-1.5 transition-all duration-150"
            >
              <History size={12} />
              <span>Lịch sử nhập</span>
            </button>
          </div>
        </div>
      </div>

      {activeSubTab === 'open-orders'
        ? <OpenOrdersTab user={user} canEdit={canEdit} refreshSignal={refreshSignal} />
        : <DailyEntryTab user={user} canEdit={canEdit} />}
    </div>
  )
}

function SubTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 sm:flex-none h-8 px-3 rounded-xl text-[12px] font-semibold transition-all duration-150 active:scale-[0.98]',
        active
          ? 'bg-white text-dmc-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
          : 'text-[#6e6e73] hover:text-[#1d1d1f]'
      )}
    >
      {children}
    </button>
  )
}

function OpenOrdersTab({ user, canEdit, refreshSignal }: OpenOrdersTabProps) {
  const {
    state, visibleRows,
    loadOpenOrders, selectOrder,
    unlockPcode, updateLine,
    submitProduction,
    getProductOptions, getNormHint,
  } = useProductionData(user)

  const [searchQuery, setSearchQuery] = useState('')
  const [workshopFilter, setWorkshopFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState<ProductionStatusFilter>('ALL')
  const [entryOpen, setEntryOpen] = useState(false)
  const [unlockPcodeOpen, setUnlockPcodeOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'draft' | 'closed'>('draft')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { loadOpenOrders() }, [loadOpenOrders, refreshSignal])

  const allOrders = useMemo(() => state.initData?.orders as OpenProductionOrder[] ?? [], [state.initData?.orders])
  const workshopOptions = useMemo(() => [...new Set(allOrders.map((order) => workshopCode(order.workshop)).filter(Boolean))].sort(), [allOrders])
  const submittedPcodes = state.initData?.submittedPcodes ?? []
  const closedPcodes = useMemo(() => state.initData?.closedPcodes ?? [], [state.initData?.closedPcodes])
  const baseCatalog = useMemo(() => {
    const byWorkshop = workshopFilter === 'ALL'
      ? allOrders
      : allOrders.filter((order) => workshopCode(order.workshop) === workshopFilter)
    return sortProductionOrdersForEntry(filterProductionOrdersByPcode(byWorkshop, searchQuery)) as OpenProductionOrder[]
  }, [allOrders, searchQuery, workshopFilter])
  const kpiCounts = useMemo(() => ({
    all: baseCatalog.length,
    notStarted: baseCatalog.filter((order) => isNotStartedOrder(order)).length,
    inProgress: baseCatalog.filter((order) => isInProgressOrder(order)).length,
    completed: baseCatalog.filter((order) => closedPcodes.includes(order.pcode)).length,
  }), [baseCatalog, closedPcodes])
  const kpiItems: Array<{
    label: string
    value: number
    filter: ProductionStatusFilter
    color: string
    activeColor: string
  }> = [
    { label: 'Tổng LSX', value: kpiCounts.all, filter: 'ALL', color: 'text-[#1d1d1f]', activeColor: 'bg-[#1d1d1f]/8 border-[#1d1d1f]/20' },
    { label: 'Chưa SX', value: kpiCounts.notStarted, filter: 'NOT_STARTED', color: 'text-[#007aff]', activeColor: 'bg-[#007aff]/10 border-[#007aff]/25' },
    { label: 'Đang SX', value: kpiCounts.inProgress, filter: 'IN_PROGRESS', color: 'text-[#b37700]', activeColor: 'bg-[#ff9500]/10 border-[#ff9500]/30' },
    { label: 'HT', value: kpiCounts.completed, filter: 'COMPLETED', color: 'text-[#2f9e44]', activeColor: 'bg-[#34c759]/15 border-[#2f9e44]/30' },
  ]
  const orderCatalog = useMemo(() => {
    if (statusFilter === 'NOT_STARTED') return baseCatalog.filter((order) => isNotStartedOrder(order))
    if (statusFilter === 'IN_PROGRESS') return baseCatalog.filter((order) => isInProgressOrder(order))
    if (statusFilter === 'COMPLETED') return baseCatalog.filter((order) => closedPcodes.includes(order.pcode))
    return baseCatalog
  }, [baseCatalog, closedPcodes, statusFilter])
  const isOther = state.selectedWorkshop.startsWith('Việc khác')
  const productOptions = isOther ? [] : getProductOptions(state.selectedWorkshop)
  const canSubmit = canEdit && Boolean(state.selectedPcode && !state.loading)

  useEffect(() => {
    if (workshopOptions.length === 1 && workshopFilter !== workshopOptions[0]) {
      setWorkshopFilter(workshopOptions[0])
    } else if (workshopOptions.length !== 1 && workshopFilter !== 'ALL' && !workshopOptions.includes(workshopFilter)) {
      setWorkshopFilter('ALL')
    }
  }, [workshopFilter, workshopOptions])

  function handleSearch() {
    const query = searchQuery.trim()
    if (!query) return
    const localMatch = allOrders.find((order) => order.pcode.toLowerCase() === query.toLowerCase())
    if (localMatch) handleOrderSelect(localMatch)
  }

  function handleOrderSelect(order: Order) {
    const alreadySubmitted = submittedPcodes.includes(order.pcode)
    const alreadyClosed = closedPcodes.includes(order.pcode)
    if (alreadyClosed) {
      toast.warning('Mã LSX này đã đóng, không thể nhập thêm.')
      return
    }

    if (alreadySubmitted && !state.pcodeUnlocked) {
      setUnlockPcodeOpen(true)
      return
    }

    const selected = selectOrder(order)
    if (selected) {
      setEntryOpen(true)
      setConfirmOpen(false)
    }
  }

  async function handleSubmit() {
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }

    setSubmitting(true)
    const ok = await submitProduction(saveStatus, loadOpenOrders)
    setSubmitting(false)
    if (ok) {
      setConfirmOpen(false)
      setEntryOpen(false)
    } else {
      setConfirmOpen(false)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#f5f5f7]">
      <div className="shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-3 border-b border-[#d2d2d7]/60 space-y-3 bg-white/85 backdrop-blur-sm">
        <SectionLabel>
          Danh sách lệnh sản xuất tháng hiện hành
        </SectionLabel>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(150px,190px)_minmax(220px,300px)_minmax(420px,1fr)] gap-3 lg:items-end">
          <FieldGroup label="Xưởng">
            <select
              value={workshopFilter}
              onChange={(e) => setWorkshopFilter(e.target.value)}
              className={inputCls}
              disabled={workshopOptions.length <= 1}
            >
              {workshopOptions.length > 1 && <option value="ALL">Tất cả xưởng</option>}
              {workshopOptions.map((ws) => (
                <option key={ws} value={ws}>{ws}</option>
              ))}
            </select>
          </FieldGroup>

          <FieldGroup label="Tìm mã LSX">
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Nhập mã LSX..."
                className={cn(inputCls, 'flex-1 min-w-0')}
              />
              <button
                onClick={handleSearch}
                className="h-10 px-3.5 rounded-xl bg-dmc-primary hover:bg-dmc-primary-dark text-white shrink-0 active:scale-95 transition-all duration-150 flex items-center justify-center shadow-sm"
              >
                <Search size={15} strokeWidth={2.5} />
              </button>
            </div>
          </FieldGroup>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {kpiItems.map(({ label, value, filter, color, activeColor }) => {
              const isActive = statusFilter === filter
              return (
                <KpiFilterButton
                  key={filter}
                  label={label}
                  count={value}
                  active={isActive}
                  color={color}
                  activeColor={activeColor}
                  onClick={() => setStatusFilter((current) => current === filter && filter !== 'ALL' ? 'ALL' : filter)}
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3">
        <OrderCatalog
          orders={orderCatalog}
          loading={state.loading}
          selectedPcode={state.orderInfo?.pcode ?? ''}
          submittedPcodes={submittedPcodes}
          closedPcodes={closedPcodes}
          onSelect={handleOrderSelect}
        />
      </div>

      <ProductionEntryDialog
        open={entryOpen && Boolean(state.selectedPcode)}
        order={state.orderInfo}
        selectedWorkshop={state.selectedWorkshop}
        unlockLog={state.unlockLog}
        visibleRows={visibleRows}
        lines={state.lines}
        products={productOptions}
        canEdit={canEdit}
        canSubmit={canSubmit}
        submitting={submitting}
        getNormHint={getNormHint}
        onLineChange={updateLine}
        onRequestSave={() => {
          setSaveStatus('draft')
          setConfirmOpen(true)
        }}
        onRequestCloseOrder={() => {
          setSaveStatus('closed')
          setConfirmOpen(true)
        }}
        onClose={() => {
          setEntryOpen(false)
          setConfirmOpen(false)
        }}
      />

      <UnlockDialog
        open={unlockPcodeOpen}
        title="Mở khóa LSX"
        description="Nhập mật khẩu để mở khóa mã LSX đã nhập:"
        onConfirm={unlockPcode}
        onClose={() => setUnlockPcodeOpen(false)}
      />

      {confirmOpen && (
        <ConfirmSaveDialog
          saveStatus={saveStatus}
          submitting={submitting}
          pcode={state.pcodeStatuses[state.selectedPcode]?.pcode ?? state.selectedPcode}
          workshop={state.selectedWorkshop}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleSubmit}
        />
      )}
    </div>
  )
}

function KpiFilterButton({
  label,
  count,
  active,
  color,
  activeColor,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  color: string
  activeColor: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center min-w-[72px] px-3 py-2 rounded-xl border transition-all cursor-pointer select-none active:scale-[0.97]',
        active
          ? cn('shadow-sm', activeColor)
          : 'bg-[#f2f2f7] border-transparent hover:border-[#d2d2d7]'
      )}
    >
      <span className={cn('text-[20px] font-bold leading-none', color)}>{count.toLocaleString('vi-VN')}</span>
      <span className="mt-1 text-[11px] text-[#6e6e73] leading-none">{label}</span>
    </button>
  )
}

function DailyEntryTab({ user, canEdit }: Props) {
  const today = getTodayLocal()
  const {
    state, visibleRows,
    loadData, selectOrder,
    unlockPcode, updateLine,
    searchByPcode, submitProduction,
    getProductOptions, getNormHint,
    refreshNorms,
  } = useProductionData(user)

  const [searchQuery, setSearchQuery] = useState('')
  const [workshopFilter, setWorkshopFilter] = useState('ALL')
  const [entryOpen,       setEntryOpen]       = useState(false)
  const [unlockPcodeOpen, setUnlockPcodeOpen] = useState(false)
  const [confirmOpen,     setConfirmOpen]     = useState(false)
  const [saveStatus,      setSaveStatus]      = useState<'draft' | 'closed'>('draft')
  const [submitting,      setSubmitting]      = useState(false)
  const [refreshing,      setRefreshing]      = useState(false)

  useEffect(() => { loadData(today) }, [today, loadData])

  const allOrders = useMemo(() => state.initData?.orders ?? [], [state.initData?.orders])
  const workshopOptions = useMemo(() => [...new Set(allOrders.map((order) => workshopCode(order.workshop)).filter(Boolean))].sort(), [allOrders])
  const submittedPcodes = state.initData?.submittedPcodes ?? []
  const closedPcodes = state.initData?.closedPcodes ?? []
  const orderCatalog = useMemo(() => {
    const byWorkshop = workshopFilter === 'ALL'
      ? allOrders
      : allOrders.filter((order) => workshopCode(order.workshop) === workshopFilter)
    return sortProductionOrdersForEntry(filterProductionOrdersByPcode(byWorkshop, searchQuery))
  }, [allOrders, searchQuery, workshopFilter])
  const hasSubmittedOrders = submittedPcodes.length > 0
  const isOther = state.selectedWorkshop.startsWith('Việc khác')
  const productOptions = isOther ? [] : getProductOptions(state.selectedWorkshop)
  const canSubmit = canEdit && Boolean(state.selectedPcode && !state.loading)

  useEffect(() => {
    if (workshopOptions.length === 1 && workshopFilter !== workshopOptions[0]) {
      setWorkshopFilter(workshopOptions[0])
    } else if (workshopOptions.length !== 1 && workshopFilter !== 'ALL' && !workshopOptions.includes(workshopFilter)) {
      setWorkshopFilter('ALL')
    }
  }, [workshopFilter, workshopOptions])

  async function handleSearch() {
    const query = searchQuery.trim()
    if (!query) return

    const localMatch = allOrders.find((order) => order.pcode.toLowerCase() === query.toLowerCase())
    if (localMatch) {
      handleOrderSelect(localMatch)
      return
    }

    const order = await searchByPcode(query)
    if (order) {
      setSearchQuery(order.pcode)
      setWorkshopFilter(workshopCode(order.workshop) || 'ALL')
      await loadData(order.initialdate)
    }
  }

  function handleOrderSelect(order: Order) {
    const alreadySubmitted = submittedPcodes.includes(order.pcode)
    const alreadyClosed = closedPcodes.includes(order.pcode)
    if (alreadyClosed) {
      toast.warning('Mã LSX này đã đóng, không thể nhập thêm.')
      return
    }

    if (alreadySubmitted && !state.pcodeUnlocked) {
      setUnlockPcodeOpen(true)
      return
    }

    const selected = selectOrder(order)
    if (selected) {
      setEntryOpen(true)
      setConfirmOpen(false)
    }
  }

  async function handleRefreshNorms() {
    setRefreshing(true)
    await refreshNorms()
    setRefreshing(false)
    toast.success('Đã làm mới danh mục sản phẩm')
  }

  async function handleSubmit() {
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }

    setSubmitting(true)
    const ok = await submitProduction(saveStatus)
    setSubmitting(false)
    if (ok) {
      setConfirmOpen(false)
      setEntryOpen(false)
    } else {
      setConfirmOpen(false)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#f5f5f7]">
      <div className="shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-3 border-b border-[#d2d2d7]/60 space-y-3 bg-white/85 backdrop-blur-sm">
        <SectionLabel action={
          <div className="flex items-center gap-2">
            {hasSubmittedOrders && (
              <LockChip
                locked={!state.pcodeUnlocked}
                onClick={() => setUnlockPcodeOpen(true)}
              />
            )}
            <button
              onClick={handleRefreshNorms}
              disabled={refreshing || state.loading}
              title="Làm mới danh mục sản phẩm từ bảng Norm"
              className="h-8 px-2.5 rounded-lg border border-[#d2d2d7]/70 text-[11px] font-medium text-[#6e6e73] bg-[#f2f2f7] hover:bg-[#e5e5ea] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all duration-150"
            >
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
            </button>
          </div>
        }>
          Theo dõi lệnh theo ngày tạo
        </SectionLabel>

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(150px,190px)_minmax(150px,190px)_minmax(220px,1fr)] gap-3">
          <FieldGroup label="Ngày lập phiếu">
            <VietnameseDatePicker
              value={state.selectedDate}
              onChange={loadData}
              className={inputCls}
            />
          </FieldGroup>

          <FieldGroup label="Xưởng">
            <select
              value={workshopFilter}
              onChange={(e) => setWorkshopFilter(e.target.value)}
              className={inputCls}
              disabled={workshopOptions.length <= 1}
            >
              {workshopOptions.length > 1 && <option value="ALL">Tất cả xưởng</option>}
              {workshopOptions.map((ws) => (
                <option key={ws} value={ws}>{ws}</option>
              ))}
            </select>
          </FieldGroup>

          <FieldGroup label="Tìm mã LSX">
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Nhập mã LSX..."
                className={cn(inputCls, 'flex-1 min-w-0')}
              />
              <button
                onClick={handleSearch}
                className="h-10 px-3.5 rounded-xl bg-dmc-primary hover:bg-dmc-primary-dark text-white shrink-0 active:scale-95 transition-all duration-150 flex items-center justify-center shadow-sm"
              >
                <Search size={15} strokeWidth={2.5} />
              </button>
            </div>
          </FieldGroup>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3">
        <OrderCatalog
          orders={orderCatalog}
          loading={state.loading}
          selectedPcode={state.orderInfo?.pcode ?? ''}
          submittedPcodes={submittedPcodes}
          closedPcodes={closedPcodes}
          onSelect={handleOrderSelect}
        />
      </div>

      <ProductionEntryDialog
        open={entryOpen && Boolean(state.selectedPcode)}
        order={state.orderInfo}
        selectedWorkshop={state.selectedWorkshop}
        unlockLog={state.unlockLog}
        visibleRows={visibleRows}
        lines={state.lines}
        products={productOptions}
        canEdit={canEdit}
        canSubmit={canSubmit}
        submitting={submitting}
        getNormHint={getNormHint}
        onLineChange={updateLine}
        onRequestSave={() => {
          setSaveStatus('draft')
          setConfirmOpen(true)
        }}
        onRequestCloseOrder={() => {
          setSaveStatus('closed')
          setConfirmOpen(true)
        }}
        onClose={() => {
          setEntryOpen(false)
          setConfirmOpen(false)
        }}
      />

      <UnlockDialog
        open={unlockPcodeOpen}
        title="Mở khóa LSX"
        description="Nhập mật khẩu để mở khóa mã LSX đã nhập:"
        onConfirm={unlockPcode}
        onClose={() => setUnlockPcodeOpen(false)}
      />

      {confirmOpen && (
        <ConfirmSaveDialog
          saveStatus={saveStatus}
          submitting={submitting}
          pcode={state.pcodeStatuses[state.selectedPcode]?.pcode ?? state.selectedPcode}
          workshop={state.selectedWorkshop}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleSubmit}
        />
      )}
    </div>
  )
}

function ConfirmSaveDialog({
  saveStatus,
  submitting,
  pcode,
  workshop,
  onCancel,
  onConfirm,
}: {
  saveStatus: 'draft' | 'closed'
  submitting: boolean
  pcode: string
  workshop: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm bg-white border border-[#d2d2d7]/60 rounded-[20px] p-6 shadow-apple-lg scale-in">
        <h3 className="text-[16px] font-semibold text-[#1d1d1f] mb-4 tracking-[-0.01em]">
          {saveStatus === 'closed' ? 'Xác nhận đóng lệnh' : 'Xác nhận lưu dữ liệu'}
        </h3>

        <div className="space-y-2 mb-5">
          <Row label="Mã LSX" value={pcode} accent />
          <Row label="Xưởng" value={workshop} />
          <Row label="Trạng thái" value={saveStatus === 'closed' ? 'Đã đóng' : 'Lưu tạm'} />
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-xl border border-[#d2d2d7]/70 text-[#6e6e73] text-[13px] font-medium hover:bg-[#f2f2f7] active:scale-[0.98] transition-all duration-150"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 h-10 rounded-xl bg-dmc-success text-white text-[13px] font-semibold active:scale-[0.98] transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Save size={13} strokeWidth={2.5} />}
            {submitting ? 'Đang lưu...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  )
}

function OrderCatalog({
  orders,
  loading,
  selectedPcode,
  submittedPcodes,
  closedPcodes,
  onSelect,
}: {
  orders: Order[]
  loading: boolean
  selectedPcode: string
  submittedPcodes: string[]
  closedPcodes: string[]
  onSelect: (order: Order) => void
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-7 h-7 border-2 border-dmc-primary/30 border-t-dmc-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (orders.length === 0) return <EmptyState />

  return (
    <div className="space-y-2">
      <div className="hidden md:grid grid-cols-[minmax(150px,0.9fr)_minmax(150px,0.9fr)_minmax(200px,1.4fr)_minmax(115px,0.75fr)_90px_120px] gap-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">
        <span>Lệnh sản xuất</span>
        <span>Khách hàng</span>
        <span>Diễn giải</span>
        <span>Deadline</span>
        <span className="text-right">Số lượng</span>
        <span>Tiến độ</span>
      </div>

      {orders.map((order) => (
        <OrderRow
          key={`${order.initialdate}-${order.pcode}`}
          order={order}
          selected={selectedPcode === order.pcode}
          submitted={submittedPcodes.includes(order.pcode)}
          closed={closedPcodes.includes(order.pcode)}
          onClick={() => onSelect(order)}
        />
      ))}
    </div>
  )
}

function OrderRow({
  order,
  selected,
  submitted,
  closed,
  onClick,
}: {
  order: Order
  selected: boolean
  submitted: boolean
  closed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-2xl border bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
        'transition-all duration-150 active:scale-[0.995] focus-visible:outline-none',
        'hover:border-[#34c759]/65 hover:bg-[#f0fff4] hover:shadow-[0_0_0_1px_rgba(52,199,89,0.24),0_10px_28px_rgba(52,199,89,0.16)]',
        'focus-visible:border-[#34c759]/70 focus-visible:ring-2 focus-visible:ring-[#34c759]/30',
        selected
          ? 'border-[#34c759]/70 bg-[#f0fff4] ring-1 ring-[#34c759]/35'
          : 'border-[#d2d2d7]/60'
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-[minmax(150px,0.9fr)_minmax(150px,0.9fr)_minmax(200px,1.4fr)_minmax(115px,0.75fr)_90px_120px] gap-2 md:gap-3 md:items-center">
        <div className="min-w-0">
          <MobileLabel>Lệnh sản xuất</MobileLabel>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-[14px] text-dmc-primary truncate">{order.pcode}</span>
            {closed ? (
              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-[#2f9e44] bg-[#2f9e44]/10">
                <Lock size={9} /> Đã đóng
              </span>
            ) : submitted && (
              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-[#b37700] bg-[#ff9500]/10">
                <Lock size={9} /> Đã nhập
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <MobileLabel>Khách hàng</MobileLabel>
          <p className="text-[13px] font-medium text-[#1d1d1f] truncate">{order.customer || '—'}</p>
        </div>

        <div className="min-w-0">
          <MobileLabel>Diễn giải</MobileLabel>
          <p className="text-[12px] text-[#6e6e73] md:truncate leading-relaxed">{order.description || '—'}</p>
        </div>

        <div>
          <MobileLabel>Deadline</MobileLabel>
          <DeadlineBadge order={order} />
        </div>

        <div>
          <MobileLabel>Số lượng</MobileLabel>
          <p className="text-[13px] font-semibold text-[#1d1d1f] md:text-right">{order.quantity || '—'}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <MobileLabel>Tiến độ</MobileLabel>
            <StatusBadge status={order.status} />
          </div>
          {isOpenProductionOrderRow(order) && (
            <div className="space-y-1">
              <div className="h-1.5 rounded-full bg-[#e5e5ea] overflow-hidden">
                <div
                  className="h-full rounded-full bg-dmc-success"
                  style={{ width: `${order.completionPct}%` }}
                />
              </div>
              <p className="text-[11px] font-medium text-[#6e6e73]">
                {order.producedQuantity.toLocaleString('vi-VN')} / {order.quantity || '0'} · còn {order.remainingQuantity.toLocaleString('vi-VN')}
              </p>
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

function isOpenProductionOrderRow(order: Order): order is OpenProductionOrder {
  return 'completionPct' in order && 'producedQuantity' in order && 'remainingQuantity' in order
}

function getOrderStatusKey(order: OpenProductionOrder): ProductionStatusFilter {
  const rank = getProductionOrderStatusRank(order.status)
  if (rank === 0) return 'NOT_STARTED'
  if (rank === 1 || order.completionPct >= 100) return 'COMPLETED'
  return 'IN_PROGRESS'
}

function isNotStartedOrder(order: OpenProductionOrder): boolean {
  return getOrderStatusKey(order) === 'NOT_STARTED'
}

function isInProgressOrder(order: OpenProductionOrder): boolean {
  return getOrderStatusKey(order) === 'IN_PROGRESS'
}

function isCompletedOrder(order: OpenProductionOrder): boolean {
  return getOrderStatusKey(order) === 'COMPLETED'
}

function DeadlineBadge({ order }: { order: Order }) {
  const label = formatDateTimeDisplay(order.deadlinedate, order.deadlinetime) || '—'
  const color = getDeadlineColor(order.deadlinedate, order.deadlinetime)

  return (
    <span className={cn(
      'inline-flex min-h-6 items-center rounded-lg border px-2 py-1 text-[11px] font-semibold leading-tight',
      deadlineBadgeClasses[color]
    )}>
      {label}
    </span>
  )
}

function getDeadlineColor(date: string | null | undefined, time?: string | null): keyof typeof deadlineBadgeClasses {
  const deadline = parseDeadlineDate(date, time)
  if (!deadline) return 'none'

  const hoursRemaining = (deadline.getTime() - Date.now()) / 3_600_000
  if (hoursRemaining < 1) return 'red'
  if (hoursRemaining < 2) return 'orange'
  if (hoursRemaining < 4) return 'yellow'
  return 'green'
}

function parseDeadlineDate(date: string | null | undefined, time?: string | null): Date | null {
  if (!date) return null

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim())
  if (!dateMatch) return null

  const timeValue = time?.trim()
  if (!timeValue) return null

  const timeMatch = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(timeValue)
  if (!timeMatch) return null

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const hours = Number(timeMatch[1])
  const minutes = Number(timeMatch[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  const parsed = new Date(year, month - 1, day, hours, minutes)
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hours ||
    parsed.getMinutes() !== minutes
  ) return null

  return parsed
}

function ProductionEntryDialog({
  open,
  order,
  selectedWorkshop,
  unlockLog,
  visibleRows,
  lines,
  products,
  canEdit,
  canSubmit,
  submitting,
  getNormHint,
  onLineChange,
  onRequestSave,
  onRequestCloseOrder,
  onClose,
}: {
  open: boolean
  order: Order | null
  selectedWorkshop: string
  unlockLog: string[]
  visibleRows: number
  lines: ProductLine[]
  products: string[]
  canEdit: boolean
  canSubmit: boolean
  submitting: boolean
  getNormHint: (product: string) => NormItem | null
  onLineChange: (idx: number, field: keyof ProductLine, value: string | number | boolean) => void
  onRequestSave: () => void
  onRequestCloseOrder: () => void
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-5xl h-[94vh] sm:h-auto sm:max-h-[90vh] bg-[#f5f5f7] border border-[#d2d2d7]/60 rounded-t-[22px] sm:rounded-[22px] shadow-apple-lg flex flex-col overflow-hidden scale-in">
        <div className="shrink-0 px-4 py-3 bg-white/95 border-b border-[#d2d2d7]/60 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">Nhập liệu sản xuất</p>
            <h2 className="text-[16px] sm:text-[18px] font-semibold text-[#1d1d1f] truncate">
              {order?.pcode ?? '—'}
            </h2>
            <p className="text-[12px] text-[#6e6e73] truncate">
              {order?.customer ?? ''} {selectedWorkshop ? `· ${selectedWorkshop}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-full bg-[#f2f2f7] text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#e5e5ea] flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3">
          {order && <OrderInfoCard order={order} />}

          {Array.from({ length: visibleRows }).map((_, i) => (
            <ProductLineCard
              key={i}
              index={i}
              line={lines[i]}
              products={products}
              normHint={getNormHint(lines[i].product)}
              disabled={!canEdit || !order}
              onChange={(field, value) => onLineChange(i, field, value)}
            />
          ))}
        </div>

        <div className="shrink-0 border-t border-[#d2d2d7]/60 bg-white/95 px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
          {unlockLog.length > 0 && (
            <p className="text-[12px] text-[#b37700] flex items-center gap-1.5 sm:flex-1">
              <AlertTriangle size={12} />
              <span className="truncate">{unlockLog.join(' · ')}</span>
            </p>
          )}
          <div className="flex gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none h-10 px-4 rounded-xl border border-[#d2d2d7]/70 text-[#6e6e73] text-[13px] font-medium hover:bg-[#f2f2f7] active:scale-[0.98] transition-all"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={onRequestSave}
              disabled={!canSubmit || submitting}
              className="flex-1 sm:flex-none h-10 px-5 rounded-xl bg-dmc-success hover:opacity-90 text-white text-[13px] font-semibold active:scale-[0.98] transition-all disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-[#34c759]/20"
            >
              <Save size={14} strokeWidth={2.5} />
              Lưu dữ liệu
            </button>
            <button
              type="button"
              onClick={onRequestCloseOrder}
              disabled={!canSubmit || submitting}
              className="flex-1 sm:flex-none h-10 px-5 rounded-xl bg-[#1d1d1f] hover:opacity-90 text-white text-[13px] font-semibold active:scale-[0.98] transition-all disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-black/10"
            >
              <Lock size={14} strokeWidth={2.5} />
              Đóng lệnh
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductionInputHistoryTab({ onBack }: { onBack: () => void }) {
  const today = getTodayLocal()
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<ProductionInputHistoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRow, setSelectedRow] = useState<ProductionInputHistoryRow | null>(null)

  async function loadHistory() {
    setLoading(true)
    const result = await listProductionInputHistoryAction({ fromDate, toDate, query: query.trim() })
    setLoading(false)
    if (!result.success) {
      toast.error(result.error ?? 'Không tải được lịch sử nhập')
      return
    }
    setRows(result.data ?? [])
  }

  useEffect(() => {
    async function loadInitialHistory() {
      setLoading(true)
      const result = await listProductionInputHistoryAction({ fromDate: today, toDate: today, query: '' })
      setLoading(false)
      if (!result.success) {
        toast.error(result.error ?? 'Không tải được lịch sử nhập')
        return
      }
      setRows(result.data ?? [])
    }

    loadInitialHistory()
  }, [today])

  function exportExcel() {
    if (rows.length === 0) {
      toast.warning('Không có dữ liệu để xuất Excel')
      return
    }
    const sheetRows = rows.map((row) => ({
      'Mã LSX': row.pcode,
      'Thời gian lưu': formatDateTime(row.created_at),
      'Đơn vị nhập': workshopCode(row.workshop) || row.workshop,
      'Trạng thái': formatSaveStatus(row.save_status),
      'Sản phẩm': row.product,
      'SL nhập': row.poutput,
      'SL lỗi': row.eoutput,
      'SL sửa': row.routput,
      'Nhân lực': row.workforce,
      'Định mức thực tế': row.realnorm,
      'Ghi chú': row.log,
    }))
    const ws = XLSX.utils.json_to_sheet(sheetRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'LichSuNhap')
    XLSX.writeFile(wb, `LichSuNhap_${fromDate}_${toDate}.xlsx`)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#f5f5f7]">
      <div className="shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-3 border-b border-[#d2d2d7]/60 space-y-3 bg-white/85 backdrop-blur-sm">
        <SectionLabel action={
          <button
            type="button"
            onClick={onBack}
            className="h-8 px-2.5 rounded-lg border border-[#d2d2d7]/70 text-[11px] font-medium text-[#6e6e73] bg-[#f2f2f7] hover:bg-[#e5e5ea] active:scale-95 transition-all"
          >
            Quay lại nhập liệu
          </button>
        }>
          Lịch sử nhập
        </SectionLabel>

        <div className="grid grid-cols-1 sm:grid-cols-[150px_150px_minmax(220px,1fr)_auto_auto] gap-2">
          <FieldGroup label="Từ ngày">
            <VietnameseDatePicker value={fromDate} onChange={setFromDate} className={inputCls} />
          </FieldGroup>
          <FieldGroup label="Đến ngày">
            <VietnameseDatePicker value={toDate} onChange={setToDate} className={inputCls} />
          </FieldGroup>
          <FieldGroup label="Tìm kiếm">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadHistory()}
              placeholder="Mã LSX, sản phẩm, đơn vị nhập, trạng thái, ghi chú..."
              className={inputCls}
            />
          </FieldGroup>
          <div className="flex items-end">
            <button
              type="button"
              onClick={loadHistory}
              disabled={loading}
              className="h-10 w-full sm:w-auto px-4 rounded-xl bg-dmc-primary text-white text-[13px] font-semibold active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Search size={14} />
              Lọc
            </button>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={exportExcel}
              className="h-10 w-full sm:w-auto px-4 rounded-xl border border-dmc-primary/30 bg-white text-dmc-primary text-[13px] font-semibold active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Download size={14} />
              Xuất Excel
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 sm:px-4 py-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-dmc-primary/30 border-t-dmc-primary rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#d2d2d7]/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[130px_150px_110px_110px_minmax(180px,1fr)_90px_minmax(160px,1fr)_70px] gap-3 px-3 py-2 bg-[#f2f2f7] text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">
                <span>Mã LSX</span>
                <span>Thời gian lưu</span>
                <span>Đơn vị nhập</span>
                <span>Trạng thái</span>
                <span>Sản phẩm</span>
                <span className="text-right">SL nhập</span>
                <span>Ghi chú</span>
                <span></span>
              </div>
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedRow(row)}
                  className="w-full grid grid-cols-[130px_150px_110px_110px_minmax(180px,1fr)_90px_minmax(160px,1fr)_70px] gap-3 px-3 py-2.5 border-t border-[#d2d2d7]/50 text-left text-[12px] hover:bg-[#f5f5f7] transition-colors"
                >
                  <span className="font-semibold text-dmc-primary truncate">{row.pcode}</span>
                  <span className="text-[#1d1d1f]">{formatDateTime(row.created_at)}</span>
                  <span className="text-[#6e6e73] truncate">{workshopCode(row.workshop) || row.workshop || '—'}</span>
                  <SaveStatusBadge status={row.save_status} />
                  <span className="text-[#1d1d1f] truncate">{row.product || '—'}</span>
                  <span className="text-right font-semibold text-[#1d1d1f]">{row.poutput}</span>
                  <span className="text-[#6e6e73] truncate">{row.log || '—'}</span>
                  <span className="text-dmc-primary inline-flex items-center gap-1 justify-end"><Eye size={13} /> Xem</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedRow && <HistoryDetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />}
    </div>
  )
}

function HistoryDetailModal({ row, onClose }: { row: ProductionInputHistoryRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white border border-[#d2d2d7]/60 rounded-[20px] p-5 shadow-apple-lg scale-in">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">Chi tiết lịch sử nhập</p>
            <h3 className="text-[17px] font-semibold text-[#1d1d1f] truncate">{row.pcode}</h3>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-[#f2f2f7] text-[#6e6e73] hover:text-[#1d1d1f] flex items-center justify-center">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          <Row label="Thời gian lưu" value={formatDateTime(row.created_at)} />
          <Row label="Trạng thái" value={formatSaveStatus(row.save_status)} />
          <Row label="Đơn vị nhập" value={row.workshop || '—'} />
          <Row label="Khách hàng" value={row.customer || '—'} />
          <Row label="Sản phẩm" value={row.product || '—'} />
          <Row label="Ngày sản xuất" value={formatDate(row.pdate) || '—'} />
          <Row label="Giờ bắt đầu" value={row.starttime || '—'} />
          <Row label="Giờ kết thúc" value={row.endtime || '—'} />
          <Row label="SL nhập" value={String(row.poutput)} />
          <Row label="SL lỗi" value={String(row.eoutput)} />
          <Row label="SL sửa" value={String(row.routput)} />
          <Row label="Nhân lực" value={String(row.workforce)} />
          <Row label="Định mức thực tế" value={String(row.realnorm)} />
          <Row label="Ghi chú" value={row.log || '—'} />
        </div>
        <div className="mt-4 rounded-xl bg-[#f5f5f7] border border-[#d2d2d7]/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73] mb-1">Diễn giải lệnh</p>
          <p className="text-[13px] text-[#1d1d1f] leading-relaxed">{row.orderDescription || '—'}</p>
        </div>
      </div>
    </div>
  )
}

function SaveStatusBadge({ status }: { status: 'draft' | 'closed' }) {
  const closed = status === 'closed'
  return (
    <span className={cn(
      'inline-flex items-center justify-center text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap',
      closed
        ? 'text-[#2f9e44] bg-[#2f9e44]/10 border-[#2f9e44]/20'
        : 'text-[#b37700] bg-[#ff9500]/10 border-[#ff9500]/20'
    )}>
      {formatSaveStatus(status)}
    </span>
  )
}

function formatSaveStatus(status: 'draft' | 'closed'): string {
  return status === 'closed' ? 'Đã đóng' : 'Lưu tạm'
}

function formatDateTime(value: string): string {
  if (!value) return '—'
  return formatLocalDateTimeString(value, 'HH:mm dd/MM/yyyy') || '—'
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.07em]">
        {children}
      </span>
      <div className="flex-1 h-px bg-[#d2d2d7]/50" />
      {action}
    </div>
  )
}

function FieldGroup({
  label, children, extra,
}: {
  label: string
  children: React.ReactNode
  extra?: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-medium text-[#6e6e73] tracking-[0.02em]">
          {label}
        </label>
        {extra}
      </div>
      {children}
    </div>
  )
}

function LockChip({ locked, onClick }: { locked: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold',
        'transition-all duration-150 active:scale-95',
        locked
          ? 'text-[#b37700] bg-[#ff9500]/10 hover:bg-[#ff9500]/20'
          : 'text-[#2f9e44] bg-[#34c759]/10'
      )}
    >
      {locked
        ? <><Lock size={9} strokeWidth={2.5} /> Khóa</>
        : <><Unlock size={9} strokeWidth={2.5} /> Mở</>}
    </button>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#d2d2d7]/50 last:border-0">
      <span className="text-[12px] text-[#6e6e73]">{label}</span>
      <span className={cn(
        'text-[13px] font-semibold',
        accent ? 'text-dmc-primary' : 'text-[#1d1d1f]'
      )}>
        {value}
      </span>
    </div>
  )
}

function MobileLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="md:hidden text-[10px] font-semibold uppercase tracking-wide text-[#aeaeb2] mb-0.5">
      {children}
    </p>
  )
}

function StatusBadge({ status }: { status: string }) {
  const rank = getProductionOrderStatusRank(status)
  const cls = [
    'text-[#b37700] bg-[#ff9500]/10 border-[#ff9500]/20',
    'text-[#6e6e73] bg-[#f2f2f7] border-[#d2d2d7]/70',
    'text-[#1971c2] bg-[#1971c2]/10 border-[#1971c2]/20',
    'text-[#2f9e44] bg-[#2f9e44]/10 border-[#2f9e44]/20',
    'text-[#6e6e73] bg-[#f2f2f7] border-[#d2d2d7]/70',
  ][rank] ?? 'text-[#6e6e73] bg-[#f2f2f7] border-[#d2d2d7]/70'

  return (
    <span className={cn(
      'inline-flex items-center justify-center text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap',
      cls
    )}>
      {status || 'Chưa sản xuất'}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-[#aeaeb2] gap-3">
      <div className="w-12 h-12 rounded-2xl bg-[#f2f2f7] flex items-center justify-center border border-[#d2d2d7]/50">
        <ChevronRight size={20} className="text-[#aeaeb2]" />
      </div>
      <p className="text-[13px] text-center">Không có lệnh sản xuất phù hợp</p>
    </div>
  )
}
