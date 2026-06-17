'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { useProductionData } from '@/hooks/use-production-data'
import {
  buildDeadlineProductionPlan,
  PRODUCTION_OVERVIEW_WORKSHOPS,
} from '@/lib/production/workflow'
import {
  buildProductionCapacityTimeline,
  capacityColor,
} from '@/lib/production/capacity'
import type { CapacitySession, CapacitySessionOrder, WorkshopCapacityRow } from '@/lib/production/capacity'
import { WORKSHOP_COLORS, type WorkshopCode } from '@/lib/reports/report-types'
import { cn, workshopCode } from '@/lib/utils'
import { Dialog } from '@/components/ui/dialog'
import type { NormItem, SessionUser } from '@/types'

// ─── Local helpers (mirrored from production-tab.tsx) ────────────────────────

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

const inputCls =
  'w-full h-10 px-3 rounded-xl text-[13px] font-medium ' +
  'text-dmc-text-primary placeholder:text-dmc-text-muted ' +
  'bg-white border border-dmc-border ' +
  'focus:outline-none focus:ring-1 focus:ring-dmc-primary/40 focus:border-dmc-primary/50 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 ' +
  'shadow-[0_1px_2px_rgba(0,0,0,0.05)]'

function getWorkshopColor(workshop: string): string {
  const code = workshopCode(workshop) as WorkshopCode
  return WORKSHOP_COLORS[code] ?? '#6e6e73'
}

// Nhãn hiển thị cho mã xưởng (giữ mã làm khóa gom, chỉ làm đẹp khi hiện).
function workshopLabel(workshop: string): string {
  return workshop === 'CONG_TRINH' ? 'Công trình' : workshop
}

// ─── Color mapping for capacity cells ────────────────────────────────────────

const CELL_CLS: Record<string, string> = {
  empty:  'bg-[#f2f2f7] text-[#c7c7cc]',
  green:  'bg-[#34c759] text-white',
  yellow: 'bg-[#ffcc00] text-[#1d1d1f]',
  red:    'bg-[#ff3b30] text-white',
  purple: 'bg-[#af52de] text-white',
}

// ─── Cell detail dialog ───────────────────────────────────────────────────────

function OrderDetailRow({ order }: { order: CapacitySessionOrder }) {
  return (
    <div className="py-2.5 flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-[#1d1d1f]">{order.pcode}</span>
          {order.overtime && (
            <span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
              Tăng ca
            </span>
          )}
          {order.overloaded && (
            <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
              <AlertTriangle size={11} strokeWidth={2.5} className="fill-[#facc15] text-red-600" />
              Không kịp deadline
            </span>
          )}
        </div>
        {order.products && (
          <p className="text-[12px] text-[#6e6e73] truncate">{order.products}</p>
        )}
        {order.customer && (
          <p className="text-[12px] text-[#aeaeb2] truncate">{order.customer}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-0.5 text-[11px]">
          <span className="text-[#6e6e73]">
            SL cần SX:{' '}
            <span className="font-semibold text-[#1d1d1f]">
              {order.remainingQuantity.toLocaleString('vi-VN')}
            </span>
          </span>
          {order.norm != null ? (
            <span className="text-[#6e6e73]">
              Định mức:{' '}
              <span className="font-semibold text-[#1d1d1f]">
                {order.norm.toLocaleString('vi-VN')}/h
              </span>
            </span>
          ) : (
            <span className="font-semibold text-red-600">Thiếu định mức</span>
          )}
        </div>
      </div>
      <span className="shrink-0 text-[13px] font-medium text-[#1d1d1f] whitespace-nowrap">
        {order.hours.toFixed(2)} h
      </span>
    </div>
  )
}

function CellDetailDialog({
  workshop,
  session,
  onClose,
}: {
  workshop: string
  session: CapacitySession
  onClose: () => void
}) {
  const periodLabel = session.period === 'sang' ? 'sáng' : 'chiều'
  const title = `${workshopLabel(workshop)} · ${session.label} · Ca ${periodLabel}`

  return (
    <Dialog open onClose={onClose} title={title} size="md">
      <div className="space-y-3">
        {/* Summary */}
        <div className="rounded-xl border border-[#d2d2d7]/60 bg-[#f5f5f7] px-3 py-2 text-[13px] text-[#1d1d1f]">
          <span className="font-semibold">{session.orderCount}</span> đơn
          {' · '}
          <span className="font-semibold">{Math.round(session.pct)}%</span>
          {' · '}
          <span className="font-semibold">{session.filledHours.toFixed(2)}h</span>
          {' / 4h'}
        </div>

        {/* Order list */}
        {session.orders.length === 0 ? (
          <p className="text-[13px] text-[#aeaeb2] text-center py-4">Không có đơn trong ca này</p>
        ) : (
          <div className="divide-y divide-[#d2d2d7]/50">
            {session.orders.map((order, idx) => (
              <OrderDetailRow key={`${order.pcode}-${idx}`} order={order} />
            ))}
          </div>
        )}

        {/* Tăng ca Chủ nhật (chỉ ô chiều Thứ 7) */}
        {session.sundayOrders.length > 0 && (
          <div className="space-y-1.5 rounded-xl border border-indigo-200 bg-indigo-50/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                CN
              </span>
              <span className="text-[12px] font-semibold text-[#1d1d1f]">
                Tăng ca Chủ nhật · +{session.sundayOvertimeHours.toFixed(1)}h
              </span>
            </div>
            <div className="divide-y divide-indigo-200/60">
              {session.sundayOrders.map((order, idx) => (
                <OrderDetailRow key={`sun-${order.pcode}-${idx}`} order={order} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}

// ─── Calculator dialog ────────────────────────────────────────────────────────

function CalculatorDialog({
  workshop,
  norms,
  onClose,
}: {
  workshop: string
  norms: NormItem[]
  onClose: () => void
}) {
  const baseCode = workshopCode(workshop)

  // Filter norms whose base workshop code matches this sub-shop's base.
  const relevantNorms = useMemo(() => {
    const seen = new Set<string>()
    return norms
      .filter((n) => workshopCode(n.workshop) === baseCode)
      .filter((n) => {
        if (seen.has(n.products)) return false
        seen.add(n.products)
        return true
      })
      .sort((a, b) => a.products.localeCompare(b.products, 'vi', { sensitivity: 'base' }))
  }, [norms, baseCode])

  const [selectedProducts, setSelectedProducts] = useState('')
  const [quantity, setQuantity] = useState('')
  const [result, setResult] = useState<{ hours: number; sessions: number; normValue: number } | null>(null)

  // Reset when workshop changes (dialog remounted, so this handles reopening for different workshop).
  useEffect(() => {
    setSelectedProducts('')
    setQuantity('')
    setResult(null)
  }, [workshop])

  function handleCalc() {
    const norm = relevantNorms.find((n) => n.products === selectedProducts)
    const qty = parseFloat(quantity)
    if (!norm || isNaN(qty) || qty <= 0) return
    const hours = qty / norm.norm
    setResult({ hours, sessions: hours / 4, normValue: norm.norm })
  }

  const canCalc = selectedProducts !== '' && parseFloat(quantity) > 0

  return (
    <Dialog open onClose={onClose} title={`Tính thời gian SX · ${workshopLabel(workshop)}`} size="md">
      <div className="space-y-4">
        <FieldGroup label="Dòng sản phẩm">
          <select
            value={selectedProducts}
            onChange={(e) => {
              setSelectedProducts(e.target.value)
              setResult(null)
            }}
            className={inputCls}
          >
            <option value="">— Chọn dòng sản phẩm —</option>
            {relevantNorms.map((n) => (
              <option key={n.products} value={n.products}>
                {n.products}
              </option>
            ))}
          </select>
          {relevantNorms.length === 0 && (
            <p className="text-[12px] text-[#aeaeb2]">Không có định mức cho xưởng này.</p>
          )}
        </FieldGroup>

        <FieldGroup label="Số lượng">
          <input
            type="number"
            min={0}
            step="any"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value)
              setResult(null)
            }}
            placeholder="Nhập số lượng…"
            className={inputCls}
          />
        </FieldGroup>

        <button
          type="button"
          disabled={!canCalc}
          onClick={handleCalc}
          className={cn(
            'w-full h-10 rounded-xl text-[13px] font-semibold transition-all duration-150 active:scale-[0.98]',
            canCalc
              ? 'bg-dmc-primary text-white hover:opacity-90'
              : 'bg-[#f2f2f7] text-[#aeaeb2] cursor-not-allowed'
          )}
        >
          Tính
        </button>

        {!canCalc && (selectedProducts === '' || quantity === '') && (
          <p className="text-[12px] text-[#aeaeb2] text-center">
            Chọn dòng sản phẩm và nhập số lượng để tính.
          </p>
        )}

        {result && (
          <div className="rounded-xl border border-dmc-primary/20 bg-dmc-primary/5 px-4 py-3 space-y-1.5">
            <p className="text-[22px] font-bold text-dmc-primary leading-none">
              ≈ {result.hours.toFixed(2)} giờ
            </p>
            <p className="text-[13px] text-[#6e6e73]">
              ({result.sessions.toFixed(2)} ca · 4h/ca)
            </p>
            <p className="text-[12px] text-[#aeaeb2] pt-0.5">
              Định mức: {result.normValue}/h
            </p>
          </div>
        )}
      </div>
    </Dialog>
  )
}

// ─── Capacity heatmap grid ────────────────────────────────────────────────────

function CapacityGrid({
  timeline,
  onCellClick,
  onWorkshopClick,
}: {
  timeline: WorkshopCapacityRow[]
  onCellClick: (workshop: string, session: CapacitySession) => void
  onWorkshopClick: (workshop: string) => void
}) {
  if (timeline.length === 0) return null

  // All rows share the same 12-session window; derive headers from row 0.
  const sessions = timeline[0].sessions

  // Build day header groups: pairs of sessions grouped by date.
  type DayGroup = { label: string; date: string }
  const dayGroups: DayGroup[] = []
  for (let i = 0; i < sessions.length; i += 2) {
    dayGroups.push({ label: sessions[i].label, date: sessions[i].date })
  }

  return (
    <div className="overflow-x-auto px-2 py-3">
      <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-0">
        <colgroup>
          <col className="w-[120px]" />
          {sessions.map((session) => (
            <col key={`col-${session.date}-${session.period}`} />
          ))}
        </colgroup>
        <thead>
          {/* Tier 1: day labels — each spans 2 session columns */}
          <tr>
            {/* Sticky workshop-name column header */}
            <th
              className="sticky left-0 z-20 bg-white border-b border-r border-[#d2d2d7]/60 px-3 py-2 text-left text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.07em]"
            >
              Xưởng
            </th>
            {dayGroups.map((day) => (
              <th
                key={day.date}
                colSpan={2}
                className="border-b border-r border-[#d2d2d7]/60 px-2 py-2 text-center text-[13px] font-bold text-[#1d1d1f] last:border-r-0"
              >
                {day.label}
              </th>
            ))}
          </tr>
          {/* Tier 2: Sáng / Chiều labels */}
          <tr>
            <th className="sticky left-0 z-20 bg-white border-b border-r border-[#d2d2d7]/60" />
            {sessions.map((session, idx) => (
              <th
                key={`${session.date}-${session.period}`}
                className={cn(
                  'border-b border-[#d2d2d7]/60 px-1 py-1.5 text-center text-[11px] font-medium text-[#6e6e73]',
                  idx % 2 === 0 ? 'border-r-0' : 'border-r border-[#d2d2d7]/60',
                  idx === sessions.length - 1 && 'border-r-0'
                )}
              >
                {session.period === 'sang' ? 'Sáng' : 'Chiều'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeline.map((row, rowIdx) => {
            const workshopColor = getWorkshopColor(row.workshop)
            const zebra = rowIdx % 2 === 1
            return (
              <tr
                key={row.workshop}
                className={cn('group/row transition-colors', zebra ? 'bg-[#f4f5f9]' : 'bg-white', 'hover:bg-[#e9eefb]')}
              >
                {/* Workshop name cell */}
                <td
                  className={cn(
                    'sticky left-0 z-10 px-1 py-1.5 transition-colors',
                    zebra ? 'bg-[#f4f5f9]' : 'bg-white',
                    'group-hover/row:bg-[#e9eefb]',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onWorkshopClick(row.workshop)}
                    title={`Mở máy tính thời gian SX cho ${workshopLabel(row.workshop)}`}
                    className="w-full h-12 flex items-center px-2.5 rounded-lg border-l-4 bg-white text-[12px] font-bold text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:text-dmc-primary group-hover/row:text-dmc-primary transition-all duration-150"
                    style={{ borderLeftColor: workshopColor }}
                  >
                    <span className="truncate">{workshopLabel(row.workshop)}</span>
                  </button>
                </td>

                {/* Session cells */}
                {row.sessions.map((session) => {
                  const color = capacityColor(session.pct)
                  const isEmpty = session.orderCount === 0
                  const hasSunday = session.sundayOvertimeHours > 0
                  const clickable = !isEmpty || hasSunday
                  const cellCls = CELL_CLS[color]

                  return (
                    <td key={`${session.date}-${session.period}`} className="px-1 py-1.5">
                      <div className="relative group">
                        <button
                          type="button"
                          onClick={() => clickable && onCellClick(row.workshop, session)}
                          title={`${session.orderCount} đơn · ${Math.round(session.pct)}%`}
                          className={cn(
                            'w-full h-12 rounded-lg relative z-0 text-[13px] font-bold transition-all duration-150',
                            cellCls,
                            clickable
                              ? 'cursor-pointer hover:scale-110 hover:z-20 hover:shadow-[0_8px_20px_rgba(0,0,0,0.25)]'
                              : 'cursor-default hover:scale-105 hover:z-10'
                          )}
                        >
                          {isEmpty ? '' : `${Math.round(session.pct)}%`}
                        </button>

                        {/* Bong bóng tăng ca Chủ nhật trên ô chiều Thứ 7 */}
                        {hasSunday && (
                          <span
                            className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
                            title={`Tăng ca Chủ nhật: ${session.sundayOvertimeHours.toFixed(1)}h`}
                          >
                            CN +{session.sundayOvertimeHours.toFixed(session.sundayOvertimeHours % 1 ? 1 : 0)}h
                          </span>
                        )}

                        {/* Cảnh báo: ô deadline của đơn không kịp dù đã tăng ca */}
                        {session.deadlineOverflow && (
                          <span
                            className="pointer-events-none absolute -top-1.5 -right-1.5 z-30 animate-pulse"
                            title="Có LSX không kịp deadline dù đã tăng ca tối đa"
                          >
                            <AlertTriangle
                              size={16}
                              strokeWidth={2.5}
                              className="fill-[#facc15] text-red-600 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                            />
                          </span>
                        )}

                        {/* Hover tooltip — số đơn & giờ chi tiết */}
                        {!isEmpty && (
                          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <div className="bg-[#1d1d1f] text-white rounded-lg px-2.5 py-1.5 text-[11px] whitespace-nowrap shadow-lg">
                              <p className="font-semibold">{session.orderCount} đơn</p>
                              <p>{Math.round(session.pct)}% · {session.filledHours.toFixed(1)}h</p>
                            </div>
                            {/* Tooltip arrow */}
                            <div className="w-2 h-2 bg-[#1d1d1f] rotate-45 mx-auto -mt-1" />
                          </div>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Color legend ─────────────────────────────────────────────────────────────

function CapacityLegend() {
  const items: Array<{ cls: string; label: string }> = [
    { cls: 'bg-[#34c759]', label: 'Xanh < 50%' },
    { cls: 'bg-[#ffcc00]', label: 'Vàng 50–75%' },
    { cls: 'bg-[#ff3b30]', label: 'Đỏ 75–100%' },
    { cls: 'bg-[#af52de]', label: 'Tím > 100% tăng ca' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] text-[#6e6e73]">
          <span className={cn('w-2.5 h-2.5 rounded-sm', item.cls)} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

// ─── Main tab component ───────────────────────────────────────────────────────

export function ProductionCapacityOverviewTab({
  user,
  canEdit: _canEdit,
  refreshSignal,
}: {
  user: SessionUser
  canEdit: boolean
  refreshSignal: number
}) {
  const { state, loadOpenOrders } = useProductionData(user)

  useEffect(() => { loadOpenOrders() }, [loadOpenOrders, refreshSignal])

  const allOrders = useMemo(
    () => (state.initData?.orders ?? []) as Parameters<typeof buildDeadlineProductionPlan>[0],
    [state.initData?.orders]
  )
  const norms = useMemo<NormItem[]>(() => state.initData?.norms ?? [], [state.initData?.norms])
  const normOverrides = useMemo(
    () => state.initData?.normOverrides ?? [],
    [state.initData?.normOverrides]
  )

  const plan = useMemo(
    () => buildDeadlineProductionPlan(allOrders, norms, normOverrides),
    [allOrders, norms, normOverrides]
  )

  const timeline = useMemo(
    () => buildProductionCapacityTimeline(plan.rows, new Date(), PRODUCTION_OVERVIEW_WORKSHOPS),
    [plan.rows]
  )

  // Dialog state
  const [detail, setDetail] = useState<{ workshop: string; session: CapacitySession } | null>(null)
  const [calcWorkshop, setCalcWorkshop] = useState<string | null>(null)

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#f5f5f7]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-3 border-b border-[#d2d2d7]/60 space-y-3 bg-white/85 backdrop-blur-sm">
        <SectionLabel>Tổng quan sản xuất</SectionLabel>
        <CapacityLegend />
        <p className="text-[11px] text-[#aeaeb2]">
          % = mức tải mỗi ca (giờ SX còn lại / 4h). Rê chuột vào ô để xem số đơn, bấm ô để xem chi tiết, bấm tên xưởng để mở máy tính thời gian. Bong bóng &quot;CN +Xh&quot; trên ô chiều Thứ 7 = giờ tăng ca Chủ nhật.
        </p>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3">
        {state.loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-dmc-primary/30 border-t-dmc-primary rounded-full animate-spin" />
          </div>
        ) : timeline.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
            <CapacityGrid
              timeline={timeline}
              onCellClick={(workshop, session) => setDetail({ workshop, session })}
              onWorkshopClick={(workshop) => setCalcWorkshop(workshop)}
            />
          </div>
        )}
      </div>

      {/* ── Dialogs ────────────────────────────────────────────────────── */}
      {detail && (
        <CellDetailDialog
          workshop={detail.workshop}
          session={detail.session}
          onClose={() => setDetail(null)}
        />
      )}

      {calcWorkshop && (
        <CalculatorDialog
          workshop={calcWorkshop}
          norms={norms}
          onClose={() => setCalcWorkshop(null)}
        />
      )}
    </div>
  )
}
