'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useProductionData } from '@/hooks/use-production-data'
import { OrderInfoCard } from './order-info-card'
import { ProductLineCard } from './product-line-card'
import { UnlockDialog } from './unlock-dialog'
import { cn, apiDateToDisplay, parseDisplayDate, getTodayLocal } from '@/lib/utils'
import type { SessionUser } from '@/types'

interface Props {
  user: SessionUser
}

export function ProductionTab({ user }: Props) {
  const today = getTodayLocal()  // Local date (not UTC) — correct at midnight in VN
  const {
    state,
    visibleRows,
    loadData,
    selectWorkshop,
    selectPcode,
    unlockDate,
    unlockPcode,
    updateLine,
    searchByPcode,
    submitProduction,
    getWorkshopOptions,
    getProductOptions,
    getPcodeOptions,
    getNormHint,
  } = useProductionData(user)

  const [searchQuery, setSearchQuery] = useState('')
  const [unlockDateOpen, setUnlockDateOpen] = useState(false)
  const [unlockPcodeOpen, setUnlockPcodeOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData(today)
  }, [today, loadData])

  const wsOptions = getWorkshopOptions()
  const pcodeOptions = getPcodeOptions()
  const isOther = state.selectedWorkshop.startsWith('Việc khác')
  const productOptions = isOther ? [] : getProductOptions(state.selectedWorkshop)
  const hasLockedPcodes = Object.values(state.pcodeStatuses).some((s) => s.locked)
  const status = state.pcodeStatuses[state.selectedPcode]
  const canSubmit = Boolean(state.selectedPcode && !state.loading)

  async function handleSearch() {
    if (!searchQuery.trim()) return
    const order = await searchByPcode(searchQuery.trim())
    if (order) {
      await loadData(order.initialdate)
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    const ok = await submitProduction()
    setSubmitting(false)
    if (ok) setConfirmOpen(false)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── SECTION 1: Fixed header info ── */}
      <div className="shrink-0 px-4 py-3 border-b border-dmc-border space-y-3">
        <SectionTitle>📅 THÔNG TIN LỆNH SẢN XUẤT</SectionTitle>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* PDATE */}
          <FieldGroup label="📋 Ngày lập phiếu" extra={
            state.dateLocked
              ? <LockBtn onClick={() => setUnlockDateOpen(true)} label="🔒" className="text-yellow-400" />
              : <span className="text-xs text-yellow-400">🔓 Đã mở</span>
          }>
            <input
              type="date"
              value={state.selectedDate}
              disabled={state.dateLocked}
              onChange={(e) => loadData(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-dmc-bg-input border border-dmc-border text-dmc-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-dmc-primary/50 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            />
          </FieldGroup>

          {/* Search PCODE */}
          <FieldGroup label="🔍 Tìm mã LSX">
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Nhập mã LSX..."
                className="flex-1 h-10 px-3 rounded-lg bg-dmc-bg-input border border-dmc-border text-dmc-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-dmc-primary/50 min-w-0"
              />
              <button
                onClick={handleSearch}
                className="h-10 px-4 rounded-lg bg-dmc-primary hover:bg-dmc-primary-dark text-white text-sm font-semibold shrink-0 transition-all"
              >
                Tìm
              </button>
            </div>
          </FieldGroup>

          {/* Workshop */}
          <FieldGroup label="🏭 Xưởng">
            <select
              value={state.selectedWorkshop}
              onChange={(e) => selectWorkshop(e.target.value)}
              disabled={state.loading || wsOptions.length === 0}
              className="w-full h-10 px-3 rounded-lg bg-dmc-bg-input border border-dmc-border text-dmc-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-dmc-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- Chọn xưởng --</option>
              {wsOptions.map((ws) => (
                <option key={ws} value={ws}>{ws}</option>
              ))}
            </select>
          </FieldGroup>

          {/* PCODE */}
          <FieldGroup label="📦 Mã LSX" extra={
            hasLockedPcodes
              ? <LockBtn
                  onClick={() => setUnlockPcodeOpen(true)}
                  label={state.pcodeUnlocked ? '🔓' : '🔒'}
                  className={state.pcodeUnlocked ? 'text-yellow-400' : 'text-red-400'}
                />
              : undefined
          }>
            <select
              value={state.selectedPcode}
              onChange={(e) => selectPcode(e.target.value)}
              disabled={state.loading || pcodeOptions.length === 0}
              className="w-full h-10 px-3 rounded-lg bg-dmc-bg-input border border-dmc-border text-dmc-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-dmc-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- Chọn mã LSX --</option>
              {pcodeOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </FieldGroup>
        </div>

        {/* Order Info Card */}
        {state.orderInfo && (
          <OrderInfoCard order={state.orderInfo} />
        )}
      </div>

      {/* ── SECTION 2: Scrollable product lines ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <SectionTitle>📦 SẢN PHẨM & THỜI GIAN SẢN XUẤT</SectionTitle>

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
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-dmc-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* ── SECTION 3: Fixed footer submit ── */}
      <div className="shrink-0 bg-dmc-bg-card border-t border-dmc-border px-4 py-3 flex items-center justify-between">
        {state.unlockLog.length > 0 && (
          <p className="text-xs text-yellow-400 hidden sm:block">
            ⚠️ {state.unlockLog.join(' | ')}
          </p>
        )}
        <div className="ml-auto">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!canSubmit}
            className="h-11 px-8 rounded-xl bg-dmc-success hover:opacity-90 text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            💾 LƯU DỮ LIỆU SẢN XUẤT
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

      {/* Confirm Submit Dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmOpen(false)} />
          <div className="relative w-full max-w-md bg-dmc-bg-card border border-dmc-border rounded-2xl p-6 shadow-2xl animate-in">
            <h3 className="text-base font-semibold text-dmc-text-primary mb-2">✅ Xác nhận lưu dữ liệu</h3>
            <p className="text-sm text-dmc-text-secondary mb-1">
              Mã LSX: <span className="font-bold text-dmc-primary">
                {state.pcodeStatuses[state.selectedPcode]?.pcode ?? state.selectedPcode}
              </span>
            </p>
            <p className="text-sm text-dmc-text-secondary mb-4">Xưởng: {state.selectedWorkshop}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 h-10 rounded-lg border border-dmc-border text-dmc-text-muted text-sm"
              >Hủy</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 h-10 rounded-lg bg-dmc-success text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {submitting ? 'Đang lưu...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold text-dmc-primary">{children}</span>
      <div className="flex-1 h-px bg-dmc-primary/30" />
    </div>
  )
}

function FieldGroup({
  label,
  children,
  extra,
}: {
  label: string
  children: React.ReactNode
  extra?: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-dmc-text-secondary">{label}</label>
        {extra}
      </div>
      {children}
    </div>
  )
}

function LockBtn({ onClick, label, className }: { onClick: () => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('text-xs hover:opacity-80 transition-opacity', className)}
    >
      {label}
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-dmc-text-muted">
      <span className="text-4xl mb-3">🏭</span>
      <p className="text-sm">Chọn ngày và xưởng để bắt đầu nhập dữ liệu</p>
    </div>
  )
}
