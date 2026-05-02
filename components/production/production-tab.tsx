'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ChevronRight,
  Lock,
  RefreshCw,
  Save,
  Search,
  Unlock,
  X,
} from 'lucide-react'
import { useProductionData } from '@/hooks/use-production-data'
import { OrderInfoCard } from './order-info-card'
import { ProductLineCard } from './product-line-card'
import { UnlockDialog } from './unlock-dialog'
import {
  filterProductionOrdersByPcode,
  getProductionOrderStatusRank,
  sortProductionOrdersForEntry,
} from '@/lib/production/workflow'
import { cn, getTodayLocal } from '@/lib/utils'
import type { NormItem, Order, ProductLine, SessionUser } from '@/types'

interface Props { user: SessionUser }

const inputCls =
  'w-full h-10 px-3 rounded-xl text-[13px] font-medium ' +
  'text-dmc-text-primary placeholder:text-dmc-text-muted ' +
  'bg-white border border-dmc-border ' +
  'focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 ' +
  'shadow-[0_1px_2px_rgba(0,0,0,0.05)]'

export function ProductionTab({ user }: Props) {
  const today = getTodayLocal()
  const {
    state, visibleRows,
    loadData, selectOrder,
    unlockDate, unlockPcode, updateLine,
    searchByPcode, submitProduction,
    getProductOptions, getNormHint,
    refreshNorms,
  } = useProductionData(user)

  const [searchQuery,     setSearchQuery]     = useState('')
  const [entryOpen,       setEntryOpen]       = useState(false)
  const [unlockDateOpen,  setUnlockDateOpen]  = useState(false)
  const [unlockPcodeOpen, setUnlockPcodeOpen] = useState(false)
  const [confirmOpen,     setConfirmOpen]     = useState(false)
  const [submitting,      setSubmitting]      = useState(false)
  const [refreshing,      setRefreshing]      = useState(false)

  useEffect(() => { loadData(today) }, [today, loadData])

  const allOrders = useMemo(() => state.initData?.orders ?? [], [state.initData?.orders])
  const submittedPcodes = state.initData?.submittedPcodes ?? []
  const orderCatalog = useMemo(
    () => sortProductionOrdersForEntry(filterProductionOrdersByPcode(allOrders, searchQuery)),
    [allOrders, searchQuery]
  )
  const hasSubmittedOrders = submittedPcodes.length > 0
  const isOther = state.selectedWorkshop.startsWith('Việc khác')
  const productOptions = isOther ? [] : getProductOptions(state.selectedWorkshop)
  const canSubmit = Boolean(state.selectedPcode && !state.loading)

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
      await loadData(order.initialdate)
    }
  }

  function handleOrderSelect(order: Order) {
    const alreadySubmitted = submittedPcodes.includes(order.pcode)
    const delivered = getProductionOrderStatusRank(order.status) === 3
    if (alreadySubmitted && !delivered && !state.pcodeUnlocked) {
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
    setSubmitting(true)
    const ok = await submitProduction()
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
          Nhập liệu sản xuất
        </SectionLabel>

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(180px,220px)_minmax(220px,1fr)] gap-3">
          <FieldGroup
            label="Ngày lập phiếu"
            extra={state.dateLocked
              ? <LockChip locked onClick={() => setUnlockDateOpen(true)} />
              : <LockChip locked={false} />}
          >
            <input
              type="date"
              value={state.selectedDate}
              disabled={state.dateLocked}
              onChange={(e) => loadData(e.target.value)}
              className={inputCls}
            />
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
        canSubmit={canSubmit}
        submitting={submitting}
        getNormHint={getNormHint}
        onLineChange={updateLine}
        onRequestSave={() => setConfirmOpen(true)}
        onClose={() => {
          setEntryOpen(false)
          setConfirmOpen(false)
        }}
      />

      <UnlockDialog
        open={unlockDateOpen}
        title="Mở khóa ngày"
        description="Nhập mật khẩu để mở khóa ngày lập phiếu:"
        onConfirm={unlockDate}
        onClose={() => setUnlockDateOpen(false)}
      />
      <UnlockDialog
        open={unlockPcodeOpen}
        title="Mở khóa LSX"
        description="Nhập mật khẩu để mở khóa mã LSX đã nhập:"
        onConfirm={unlockPcode}
        onClose={() => setUnlockPcodeOpen(false)}
      />

      {confirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setConfirmOpen(false)}
          />
          <div className="relative w-full max-w-sm bg-white border border-[#d2d2d7]/60 rounded-[20px] p-6 shadow-apple-lg scale-in">
            <h3 className="text-[16px] font-semibold text-[#1d1d1f] mb-4 tracking-[-0.01em]">
              Xác nhận lưu dữ liệu
            </h3>

            <div className="space-y-2 mb-5">
              <Row label="Mã LSX" value={
                state.pcodeStatuses[state.selectedPcode]?.pcode ?? state.selectedPcode
              } accent />
              <Row label="Xưởng" value={state.selectedWorkshop} />
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 h-10 rounded-xl border border-[#d2d2d7]/70 text-[#6e6e73] text-[13px] font-medium hover:bg-[#f2f2f7] active:scale-[0.98] transition-all duration-150"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmit}
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
      )}
    </div>
  )
}

function OrderCatalog({
  orders,
  loading,
  selectedPcode,
  submittedPcodes,
  onSelect,
}: {
  orders: Order[]
  loading: boolean
  selectedPcode: string
  submittedPcodes: string[]
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
      <div className="hidden md:grid grid-cols-[minmax(150px,0.9fr)_minmax(160px,1fr)_minmax(220px,1.7fr)_100px_120px] gap-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">
        <span>Lệnh sản xuất</span>
        <span>Khách hàng</span>
        <span>Diễn giải</span>
        <span className="text-right">Số lượng</span>
        <span className="text-center">Tình trạng</span>
      </div>

      {orders.map((order) => (
        <OrderRow
          key={`${order.initialdate}-${order.pcode}`}
          order={order}
          selected={selectedPcode === order.pcode}
          submitted={submittedPcodes.includes(order.pcode)}
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
  onClick,
}: {
  order: Order
  selected: boolean
  submitted: boolean
  onClick: () => void
}) {
  const rank = getProductionOrderStatusRank(order.status)
  const blocked = rank === 3

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-2xl border bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
        'transition-all duration-150 active:scale-[0.995] focus-visible:outline-none',
        'hover:border-[#34c759]/65 hover:bg-[#f0fff4] hover:shadow-[0_0_0_1px_rgba(52,199,89,0.24),0_10px_28px_rgba(52,199,89,0.16)]',
        'focus-visible:border-[#34c759]/70 focus-visible:ring-2 focus-visible:ring-[#34c759]/30',
        blocked ? 'opacity-75 hover:opacity-100' : '',
        selected
          ? 'border-[#34c759]/70 bg-[#f0fff4] ring-1 ring-[#34c759]/35'
          : 'border-[#d2d2d7]/60'
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-[minmax(150px,0.9fr)_minmax(160px,1fr)_minmax(220px,1.7fr)_100px_120px] gap-2 md:gap-3 md:items-center">
        <div className="min-w-0">
          <MobileLabel>Lệnh sản xuất</MobileLabel>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-[14px] text-dmc-primary truncate">{order.pcode}</span>
            {submitted && (
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
          <MobileLabel>Số lượng</MobileLabel>
          <p className="text-[13px] font-semibold text-[#1d1d1f] md:text-right">{order.quantity || '—'}</p>
        </div>

        <div className="flex md:justify-center">
          <StatusBadge status={order.status} />
        </div>
      </div>
    </button>
  )
}

function ProductionEntryDialog({
  open,
  order,
  selectedWorkshop,
  unlockLog,
  visibleRows,
  lines,
  products,
  canSubmit,
  submitting,
  getNormHint,
  onLineChange,
  onRequestSave,
  onClose,
}: {
  open: boolean
  order: Order | null
  selectedWorkshop: string
  unlockLog: string[]
  visibleRows: number
  lines: ProductLine[]
  products: string[]
  canSubmit: boolean
  submitting: boolean
  getNormHint: (product: string) => NormItem | null
  onLineChange: (idx: number, field: keyof ProductLine, value: string | number) => void
  onRequestSave: () => void
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
              disabled={!order}
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
          </div>
        </div>
      </div>
    </div>
  )
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
