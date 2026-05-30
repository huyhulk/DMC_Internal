'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, Play, Search } from 'lucide-react'
import { toast } from 'sonner'
import { getOpenProductionOrdersAction, recordProductionAction, recordSemiFinishedProductionAction } from '@/lib/actions/data'
import { getProductionEntryBaseWorkshop } from '@/lib/production/workflow'
import { calcRealNorm, cn, formatDate, getTodayLocal, parseDecimalInput, workshopCode } from '@/lib/utils'
import type { NormItem, OpenProductionOrder, OpenProductionOrdersData, SessionUser } from '@/types'

type Screen = 'home' | 'orders' | 'entry'
type ProductType = 'finished' | 'semi_finished'

type MobileEntryDraft = {
  productType: ProductType
  product: string
  pdate: string
  starttime: string
  endtime: string
  workforce: string
  poutput: string
  eoutput: string
  routput: string
}

interface Props {
  user: SessionUser
  canEdit: boolean
}

const PRODUCT_TYPE_OPTIONS: Array<{ value: ProductType; label: string; hint: string }> = [
  { value: 'finished', label: 'Thành phẩm', hint: 'Ghi vào bảng Production' },
  { value: 'semi_finished', label: 'Bán thành phẩm', hint: 'Ghi vào bảng riêng' },
]

function makeDraft(): MobileEntryDraft {
  return {
    productType: 'finished',
    product: '',
    pdate: getTodayLocal(),
    starttime: '',
    endtime: '',
    workforce: '',
    poutput: '',
    eoutput: '0',
    routput: '0',
  }
}

export function MobileProductionEntry({ user, canEdit }: Props) {
  const [screen, setScreen] = useState<Screen>('home')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [data, setData] = useState<OpenProductionOrdersData | null>(null)
  const [selectedPcodes, setSelectedPcodes] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [drafts, setDrafts] = useState<Record<string, MobileEntryDraft>>({})

  const orders = useMemo(() => data?.orders ?? [], [data?.orders])
  const selectedOrders = useMemo(
    () => selectedPcodes
      .map((pcode) => orders.find((order) => order.pcode === pcode))
      .filter(Boolean) as OpenProductionOrder[],
    [orders, selectedPcodes],
  )
  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return orders
    return orders.filter((order) => {
      return [order.pcode, order.customer, order.description, order.workshop]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    })
  }, [orders, query])

  async function loadOrders() {
    setLoading(true)
    const result = await getOpenProductionOrdersAction()
    setLoading(false)

    if (!result.success || !result.data) {
      toast.error(result.error ?? 'Không tải được danh sách lệnh sản xuất')
      return
    }

    setData(result.data)
    setScreen('orders')
  }

  function toggleOrder(pcode: string) {
    setSelectedPcodes((current) => {
      if (current.includes(pcode)) return current.filter((item) => item !== pcode)
      return [...current, pcode]
    })
  }

  function startEntry() {
    if (selectedPcodes.length === 0) {
      toast.warning('Vui lòng chọn ít nhất 1 lệnh sản xuất')
      return
    }

    setDrafts((current) => {
      const next = { ...current }
      for (const pcode of selectedPcodes) {
        if (!next[pcode]) next[pcode] = makeDraft()
      }
      return next
    })
    setScreen('entry')
  }

  async function submitEntries() {
    if (!canEdit || submitting) return

    const finishedRows = []
    const semiFinishedRows = []

    for (const order of selectedOrders) {
      const draft = drafts[order.pcode] ?? makeDraft()
      const output = parseDecimalInput(draft.poutput)
      const defectOutput = parseDecimalInput(draft.eoutput)
      const recycleOutput = parseDecimalInput(draft.routput)
      const workforce = parseDecimalInput(draft.workforce)
      const realnorm = getDraftRealNorm(order, data?.norms ?? [], draft)
      const baseRow = {
        pdate: draft.pdate || getTodayLocal(),
        pcode: order.pcode,
        products: draft.product,
        material: '',
        workforce,
        starttime: draft.starttime,
        endtime: draft.endtime,
        realnorm,
        log: 'Nhập từ giao diện mobile Tổ trưởng',
      }

      if (draft.productType === 'finished') {
        finishedRows.push({
          ...baseRow,
          totalem: '',
          poutput: output,
          eoutput: defectOutput,
          routput: recycleOutput,
          save_status: 'draft' as const,
        })
      } else {
        semiFinishedRows.push({
          ...baseRow,
          workshop: getProductionEntryBaseWorkshop(order.workshop),
          quantity: output,
          defect_quantity: defectOutput,
          recycle_quantity: recycleOutput,
        })
      }
    }

    if (finishedRows.length === 0 && semiFinishedRows.length === 0) {
      toast.warning('Vui lòng chọn ít nhất 1 lệnh sản xuất')
      return
    }

    setSubmitting(true)

    const results = []
    if (finishedRows.length > 0) results.push(await recordProductionAction(finishedRows))
    if (semiFinishedRows.length > 0) results.push(await recordSemiFinishedProductionAction(semiFinishedRows))

    setSubmitting(false)

    const failed = results.find((result) => !result.success)
    if (failed) {
      toast.error(failed.message)
      return
    }

    toast.success(results.map((result) => result.message).join(' '), { duration: 5000 })
    setSelectedPcodes([])
    setDrafts({})
    await loadOrders()
  }

  function updateDraft(pcode: string, patch: Partial<MobileEntryDraft>) {
    setDrafts((current) => ({
      ...current,
      [pcode]: { ...(current[pcode] ?? makeDraft()), ...patch },
    }))
  }

  return (
    <main className="min-h-dvh bg-[#f5f5f7] text-[#1d1d1f]">
      {screen === 'home' && (
        <HomeScreen user={user} canEdit={canEdit} loading={loading} onStart={loadOrders} />
      )}

      {screen === 'orders' && (
        <OrdersScreen
          loading={loading}
          orders={filteredOrders}
          totalOrders={orders.length}
          query={query}
          selectedPcodes={selectedPcodes}
          onQueryChange={setQuery}
          onBack={() => setScreen('home')}
          onRefresh={loadOrders}
          onToggle={toggleOrder}
          onStart={startEntry}
        />
      )}

      {screen === 'entry' && (
        <EntryScreen
          orders={selectedOrders}
          norms={data?.norms ?? []}
          drafts={drafts}
          canEdit={canEdit}
          submitting={submitting}
          onSubmit={submitEntries}
          onBack={() => setScreen('orders')}
          onUpdateDraft={updateDraft}
        />
      )}
    </main>
  )
}

function HomeScreen({
  user,
  canEdit,
  loading,
  onStart,
}: {
  user: SessionUser
  canEdit: boolean
  loading: boolean
  onStart: () => void
}) {
  return (
    <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5 py-8 text-center">
      <div className="w-full rounded-[2rem] bg-white p-6 shadow-sm">
        <p className="mx-auto mb-4 w-fit rounded-full bg-[#d4870c]/10 px-4 py-1.5 text-sm font-semibold text-[#d4870c]">
          Tổ trưởng · {user.workspace || 'Chưa gán xưởng'}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Nhập kết quả sản xuất</h1>
        <p className="mt-3 text-base leading-7 text-[#6e6e73]">
          Chọn lệnh sản xuất đang mở, sau đó nhập kết quả Thành phẩm hoặc Bán thành phẩm trên màn hình cảm ứng.
        </p>

        {!canEdit && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-medium text-amber-700">
            Tài khoản hiện chỉ có quyền xem, chưa có quyền nhập sản xuất.
          </div>
        )}

        <button
          type="button"
          onClick={onStart}
          disabled={loading || !canEdit}
          className="mt-10 flex min-h-20 w-full items-center justify-center gap-3 rounded-3xl bg-[#3b5bdb] px-6 text-xl font-bold text-white shadow-lg shadow-[#3b5bdb]/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Play className="h-7 w-7 fill-white" />}
          Thực hiện sản xuất
        </button>
      </div>
    </section>
  )
}

function OrdersScreen({
  loading,
  orders,
  totalOrders,
  query,
  selectedPcodes,
  onQueryChange,
  onBack,
  onRefresh,
  onToggle,
  onStart,
}: {
  loading: boolean
  orders: OpenProductionOrder[]
  totalOrders: number
  query: string
  selectedPcodes: string[]
  onQueryChange: (value: string) => void
  onBack: () => void
  onRefresh: () => void
  onToggle: (pcode: string) => void
  onStart: () => void
}) {
  return (
    <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col pb-28">
      <div className="sticky top-0 z-20 border-b border-[#d2d2d7]/70 bg-white/95 px-4 pb-4 pt-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full bg-[#f2f2f7] text-[#1d1d1f] active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 text-left">
            <h1 className="truncate text-xl font-bold">Chọn lệnh sản xuất</h1>
            <p className="text-sm text-[#6e6e73]">{selectedPcodes.length}/{totalOrders} lệnh đã chọn</p>
          </div>
          <button type="button" onClick={onRefresh} disabled={loading} className="h-11 rounded-full px-4 text-sm font-semibold text-[#3b5bdb] disabled:opacity-50">
            {loading ? 'Đang tải' : 'Làm mới'}
          </button>
        </div>

        <label className="mt-4 flex h-12 items-center gap-2 rounded-2xl bg-[#f2f2f7] px-4 text-[#6e6e73]">
          <Search className="h-5 w-5" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tìm mã LSX, khách hàng, mô tả..."
            className="h-full min-w-0 flex-1 bg-transparent text-base font-medium text-[#1d1d1f] outline-none placeholder:text-[#86868b]"
          />
        </label>
      </div>

      <div className="space-y-3 px-4 py-4">
        {orders.length === 0 && (
          <div className="rounded-3xl bg-white p-6 text-center text-sm font-medium text-[#6e6e73] shadow-sm">
            Không có lệnh sản xuất phù hợp.
          </div>
        )}

        {orders.map((order) => {
          const checked = selectedPcodes.includes(order.pcode)
          return (
            <button
              key={order.pcode}
              type="button"
              onClick={() => onToggle(order.pcode)}
              className={cn(
                'w-full rounded-3xl border bg-white p-4 text-left shadow-sm transition active:scale-[0.99]',
                checked ? 'border-[#3b5bdb] ring-2 ring-[#3b5bdb]/15' : 'border-transparent',
              )}
            >
              <div className="flex items-start gap-3">
                <span className={cn(
                  'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2',
                  checked ? 'border-[#3b5bdb] bg-[#3b5bdb] text-white' : 'border-[#d2d2d7] text-transparent',
                )}>
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-lg font-bold text-[#1d1d1f]">{order.pcode}</p>
                    <span className="shrink-0 rounded-full bg-[#f2f2f7] px-2.5 py-1 text-xs font-bold text-[#6e6e73]">{order.workshop}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm font-medium text-[#6e6e73]">{order.description || order.customer || 'Không có mô tả'}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
                    <InfoPill label="SL" value={order.quantity || '-'} />
                    <InfoPill label="Còn" value={formatNumber(order.remainingQuantity)} />
                    <InfoPill label="Hạn" value={order.deadlinedate ? formatDate(order.deadlinedate) : '-'} />
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-[#d2d2d7]/70 bg-white/95 p-4 backdrop-blur">
        <button
          type="button"
          onClick={onStart}
          disabled={selectedPcodes.length === 0}
          className="min-h-16 w-full rounded-3xl bg-[#3b5bdb] text-xl font-bold text-white shadow-lg shadow-[#3b5bdb]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Bắt đầu ({selectedPcodes.length})
        </button>
      </div>
    </section>
  )
}

function EntryScreen({
  orders,
  norms,
  drafts,
  canEdit,
  submitting,
  onSubmit,
  onBack,
  onUpdateDraft,
}: {
  orders: OpenProductionOrder[]
  norms: NormItem[]
  drafts: Record<string, MobileEntryDraft>
  canEdit: boolean
  submitting: boolean
  onSubmit: () => void
  onBack: () => void
  onUpdateDraft: (pcode: string, patch: Partial<MobileEntryDraft>) => void
}) {
  return (
    <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col pb-28">
      <div className="sticky top-0 z-20 border-b border-[#d2d2d7]/70 bg-white/95 px-4 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full bg-[#f2f2f7] text-[#1d1d1f] active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Nhập kết quả</h1>
            <p className="text-sm text-[#6e6e73]">{orders.length} lệnh sản xuất đã chọn</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {orders.map((order, index) => {
          const draft = drafts[order.pcode] ?? makeDraft()
          const productOptions = getProductOptions(order, norms)

          return (
            <article key={order.pcode} className="rounded-[1.75rem] bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#3b5bdb]">Lệnh {index + 1}</p>
                  <h2 className="truncate text-xl font-bold">{order.pcode}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-[#6e6e73]">{order.description || order.customer}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#f2f2f7] px-3 py-1 text-xs font-bold text-[#6e6e73]">{order.workshop}</span>
              </div>

              <div className="space-y-4">
                <div>
                  <FieldLabel>Loại sản phẩm</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {PRODUCT_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onUpdateDraft(order.pcode, { productType: option.value })}
                        className={cn(
                          'min-h-20 rounded-2xl border px-3 py-2 text-left transition active:scale-[0.98]',
                          draft.productType === option.value
                            ? 'border-[#3b5bdb] bg-[#3b5bdb]/8 text-[#1d1d1f] ring-2 ring-[#3b5bdb]/10'
                            : 'border-[#d2d2d7] bg-white text-[#6e6e73]',
                        )}
                      >
                        <span className="block text-base font-bold">{option.label}</span>
                        <span className="mt-1 block text-xs font-medium">{option.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <MobileField label="Ngày sản xuất">
                  <input className={mobileInputCls} type="date" value={draft.pdate} onChange={(event) => onUpdateDraft(order.pcode, { pdate: event.target.value })} />
                </MobileField>

                <MobileField label="Sản phẩm">
                  <select className={mobileInputCls} value={draft.product} onChange={(event) => onUpdateDraft(order.pcode, { product: event.target.value })}>
                    <option value="">Chọn sản phẩm</option>
                    {productOptions.map((product) => <option key={product} value={product}>{product}</option>)}
                  </select>
                </MobileField>

                <div className="grid grid-cols-2 gap-3">
                  <MobileField label="Bắt đầu">
                    <input className={mobileInputCls} type="time" value={draft.starttime} onChange={(event) => onUpdateDraft(order.pcode, { starttime: event.target.value })} />
                  </MobileField>
                  <MobileField label="Kết thúc">
                    <input className={mobileInputCls} type="time" value={draft.endtime} onChange={(event) => onUpdateDraft(order.pcode, { endtime: event.target.value })} />
                  </MobileField>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MobileField label="Nhân công">
                    <input className={mobileInputCls} inputMode="decimal" value={draft.workforce} onChange={(event) => onUpdateDraft(order.pcode, { workforce: event.target.value })} placeholder="0" />
                  </MobileField>
                  <MobileField label={draft.productType === 'finished' ? 'SL thành phẩm' : 'SL bán TP'}>
                    <input className={mobileInputCls} inputMode="decimal" value={draft.poutput} onChange={(event) => onUpdateDraft(order.pcode, { poutput: event.target.value })} placeholder="0" />
                  </MobileField>
                  <MobileField label="SL lỗi">
                    <input className={mobileInputCls} inputMode="decimal" value={draft.eoutput} onChange={(event) => onUpdateDraft(order.pcode, { eoutput: event.target.value })} placeholder="0" />
                  </MobileField>
                  <MobileField label="SL tái chế">
                    <input className={mobileInputCls} inputMode="decimal" value={draft.routput} onChange={(event) => onUpdateDraft(order.pcode, { routput: event.target.value })} placeholder="0" />
                  </MobileField>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-[#d2d2d7]/70 bg-white/95 p-4 backdrop-blur">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canEdit || submitting}
          className="flex min-h-16 w-full items-center justify-center gap-2 rounded-3xl bg-[#3b5bdb] text-lg font-bold text-white shadow-lg shadow-[#3b5bdb]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
          {!canEdit ? 'Bạn chỉ có quyền xem' : submitting ? 'Đang gửi...' : 'Gửi kết quả'}
        </button>
      </div>
    </section>
  )
}

const mobileInputCls = 'h-13 w-full rounded-2xl border border-[#d2d2d7] bg-white px-4 text-base font-semibold text-[#1d1d1f] outline-none focus:border-[#3b5bdb] focus:ring-2 focus:ring-[#3b5bdb]/15'

function MobileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </label>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-sm font-bold text-[#6e6e73]">{children}</span>
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f2f2f7] px-2 py-2">
      <p className="text-[11px] text-[#86868b]">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold text-[#1d1d1f]">{value}</p>
    </div>
  )
}

function getProductOptions(order: OpenProductionOrder, norms: NormItem[]): string[] {
  const baseWorkshop = workshopCode(getProductionEntryBaseWorkshop(order.workshop))
  return [...new Set(
    norms
      .filter((norm) => workshopCode(norm.workshop) === baseWorkshop)
      .map((norm) => norm.products)
      .filter(Boolean),
  )].sort()
}

function getDraftRealNorm(order: OpenProductionOrder, norms: NormItem[], draft: MobileEntryDraft): number {
  const baseWorkshop = workshopCode(getProductionEntryBaseWorkshop(order.workshop))
  const norm = norms.find((item) => item.products === draft.product && workshopCode(item.workshop) === baseWorkshop)
  if (!norm) return 0

  return calcRealNorm({
    nwforce: norm.nwforce,
    workforce: parseDecimalInput(draft.workforce),
    poutput: parseDecimalInput(draft.poutput),
    starttime: draft.starttime,
    endtime: draft.endtime,
  })
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)
}
