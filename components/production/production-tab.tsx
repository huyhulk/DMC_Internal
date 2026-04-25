'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Lock, Unlock, Search, Save,
  ChevronRight, ChevronDown, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { useProductionData } from '@/hooks/use-production-data'
import { OrderInfoCard } from './order-info-card'
import { ProductLineCard } from './product-line-card'
import { UnlockDialog } from './unlock-dialog'
import { cn, getTodayLocal } from '@/lib/utils'
import type { SessionUser, FactoryKey } from '@/types'
import { WORKSHOP_LABELS } from '@/types'

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
    loadData, selectWorkshop, selectPcode,
    unlockDate, unlockPcode, updateLine,
    searchByPcode, submitProduction,
    getWorkshopOptions, getProductOptions,
    getPcodeOptions, getNormHint,
    refreshNorms,
  } = useProductionData(user)

  const [searchQuery,     setSearchQuery]     = useState('')
  const [unlockDateOpen,  setUnlockDateOpen]  = useState(false)
  const [unlockPcodeOpen, setUnlockPcodeOpen] = useState(false)
  const [confirmOpen,     setConfirmOpen]     = useState(false)
  const [submitting,      setSubmitting]      = useState(false)
  const [refreshing,      setRefreshing]      = useState(false)
  const [ss1Collapsed,    setSs1Collapsed]    = useState(false)

  useEffect(() => { loadData(today) }, [today, loadData])

  // Auto-collapse SS1 on mobile when PCODE is selected; re-expand when cleared
  useEffect(() => {
    if (state.selectedPcode && typeof window !== 'undefined' && window.innerWidth < 640) {
      setSs1Collapsed(true)
    } else if (!state.selectedPcode) {
      setSs1Collapsed(false)
    }
  }, [state.selectedPcode])

  const wsOptions     = getWorkshopOptions()
  const pcodeOptions  = getPcodeOptions()
  const isOther       = state.selectedWorkshop.startsWith('Việc khác')
  const productOptions = isOther ? [] : getProductOptions(state.selectedWorkshop)
  const hasLockedPcodes = Object.values(state.pcodeStatuses).some((s) => s.locked)
  const canSubmit     = Boolean(state.selectedPcode && !state.loading)

  async function handleSearch() {
    if (!searchQuery.trim()) return
    const order = await searchByPcode(searchQuery.trim())
    if (order) await loadData(order.initialdate)
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
    if (ok) setConfirmOpen(false)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#f5f5f7]">

      {/* ── SECTION 1: Header controls ── */}
      {ss1Collapsed ? (
        <button
          type="button"
          onClick={() => setSs1Collapsed(false)}
          className="shrink-0 w-full px-4 py-2.5 border-b border-[#d2d2d7]/60
                     bg-white/80 backdrop-blur-sm text-left
                     flex items-center gap-3
                     active:bg-[#f5f5f7] transition-colors duration-100"
        >
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <span className="text-[12px] text-[#6e6e73] shrink-0">{state.selectedDate}</span>
            {state.selectedWorkshop && (
              <>
                <span className="text-[#c7c7cc] shrink-0">·</span>
                <span className="text-[12px] text-[#1d1d1f] font-medium truncate">
                  {state.selectedWorkshop.startsWith('Việc khác')
                    ? state.selectedWorkshop
                    : (WORKSHOP_LABELS[state.selectedWorkshop as FactoryKey] ?? state.selectedWorkshop)}
                </span>
              </>
            )}
            {state.selectedPcode && (
              <>
                <span className="text-[#c7c7cc] shrink-0">·</span>
                <span className="text-[12px] text-dmc-primary font-semibold truncate">{state.selectedPcode}</span>
              </>
            )}
          </div>
          <span className="shrink-0 flex items-center gap-1 text-[11px] text-[#aeaeb2]">
            Sửa <ChevronDown size={11} />
          </span>
        </button>
      ) : (
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[#d2d2d7]/60 space-y-3
                        bg-white/80 backdrop-blur-sm">

          <SectionLabel action={
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshNorms}
                disabled={refreshing || state.loading}
                title="Làm mới danh mục sản phẩm từ bảng Norm"
                className="h-7 px-2.5 rounded-lg border border-[#d2d2d7]/70
                           text-[11px] font-medium text-[#6e6e73] bg-[#f2f2f7]
                           hover:bg-[#e5e5ea] active:scale-95
                           disabled:opacity-40 disabled:cursor-not-allowed
                           flex items-center gap-1.5 transition-all duration-150"
              >
                <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Đang tải…' : 'Làm mới danh mục'}
              </button>
              {state.selectedPcode && (
                <button
                  type="button"
                  onClick={() => setSs1Collapsed(true)}
                  title="Thu gọn"
                  className="h-7 w-7 rounded-lg border border-[#d2d2d7]/70
                             text-[#6e6e73] bg-[#f2f2f7]
                             hover:bg-[#e5e5ea] active:scale-95
                             flex items-center justify-center transition-all duration-150"
                >
                  <ChevronDown size={12} className="rotate-180" />
                </button>
              )}
            </div>
          }>Thông tin lệnh sản xuất</SectionLabel>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

            {/* Date */}
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

            {/* Search */}
            <FieldGroup label="Tìm mã LSX">
              <div className="flex gap-2">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Nhập mã LSX…"
                  className={cn(inputCls, 'flex-1 min-w-0')}
                />
                <button
                  onClick={handleSearch}
                  className="h-10 px-3.5 rounded-xl bg-dmc-primary hover:bg-dmc-primary-dark
                             text-white shrink-0 active:scale-95 transition-all duration-150
                             flex items-center justify-center shadow-sm"
                >
                  <Search size={15} strokeWidth={2.5} />
                </button>
              </div>
            </FieldGroup>

            {/* Workshop */}
            <FieldGroup label="Xưởng">
              <select
                value={state.selectedWorkshop}
                onChange={(e) => selectWorkshop(e.target.value)}
                disabled={state.loading || wsOptions.length === 0}
                className={cn(inputCls, 'cursor-pointer')}
              >
                <option value="">— Chọn xưởng —</option>
                {wsOptions.map((ws) => (
                  <option key={ws} value={ws}>
                    {ws.startsWith('Việc khác')
                      ? ws
                      : (WORKSHOP_LABELS[ws as FactoryKey] ?? ws)}
                  </option>
                ))}
              </select>
            </FieldGroup>

            {/* PCODE */}
            <FieldGroup
              label="Mã LSX"
              extra={hasLockedPcodes
                ? <LockChip locked={!state.pcodeUnlocked} onClick={() => setUnlockPcodeOpen(true)} />
                : undefined}
            >
              <select
                value={state.selectedPcode}
                onChange={(e) => selectPcode(e.target.value)}
                disabled={state.loading || pcodeOptions.length === 0}
                className={cn(inputCls, 'cursor-pointer')}
              >
                <option value="">— Chọn mã LSX —</option>
                {pcodeOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </FieldGroup>
          </div>

          {state.orderInfo && <OrderInfoCard order={state.orderInfo} />}
        </div>
      )}

      {/* ── SECTION 2: Product lines (scrollable) ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {state.selectedWorkshop ? (
          Array.from({ length: visibleRows }).map((_, i) => (
            <ProductLineCard
              key={i}
              index={i}
              line={state.lines[i]}
              products={isOther ? [] : productOptions}
              normHint={getNormHint(state.lines[i].product)}
              disabled={!state.selectedPcode}
              onChange={(field, value) => updateLine(i, field, value)}
            />
          ))
        ) : (
          <EmptyState />
        )}

        {state.loading && (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-dmc-primary/30 border-t-dmc-primary rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* ── SECTION 3: Footer submit ── */}
      <div className="shrink-0 border-t border-[#d2d2d7]/60 bg-white/90 backdrop-blur-sm
                      px-4 py-3 flex items-center justify-between gap-3">
        {state.unlockLog.length > 0 && (
          <p className="text-[12px] text-[#b37700] hidden sm:flex items-center gap-1.5">
            <AlertTriangle size={12} />
            {state.unlockLog.join(' · ')}
          </p>
        )}
        <div className="ml-auto">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!canSubmit}
            className="h-10 px-6 rounded-xl bg-dmc-success hover:opacity-90
                       text-white text-[13px] font-semibold
                       active:scale-[0.98] transition-all duration-150
                       disabled:opacity-35 disabled:cursor-not-allowed
                       flex items-center gap-2 shadow-md shadow-[#34c759]/20"
          >
            <Save size={14} strokeWidth={2.5} />
            Lưu dữ liệu
          </button>
        </div>
      </div>

      {/* ── DIALOGS ── */}
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

      {/* Confirm submit modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setConfirmOpen(false)}
          />
          <div className="relative w-full max-w-sm
                          bg-white border border-[#d2d2d7]/60
                          rounded-[20px] p-6 shadow-apple-lg scale-in">
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
                className="flex-1 h-10 rounded-xl border border-[#d2d2d7]/70
                           text-[#6e6e73] text-[13px] font-medium
                           hover:bg-[#f2f2f7] active:scale-[0.98]
                           transition-all duration-150"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 h-10 rounded-xl bg-dmc-success
                           text-white text-[13px] font-semibold
                           active:scale-[0.98] transition-all duration-150
                           disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Save size={13} strokeWidth={2.5} />}
                {submitting ? 'Đang lưu…' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ─────────────────────────────── */

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
    <div className="flex items-center justify-between py-1.5
                    border-b border-[#d2d2d7]/50 last:border-0">
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-[#aeaeb2] gap-3">
      <div className="w-12 h-12 rounded-2xl bg-[#f2f2f7] flex items-center justify-center
                      border border-[#d2d2d7]/50">
        <ChevronRight size={20} className="text-[#aeaeb2]" />
      </div>
      <p className="text-[13px]">Chọn ngày và xưởng để bắt đầu nhập dữ liệu</p>
    </div>
  )
}
