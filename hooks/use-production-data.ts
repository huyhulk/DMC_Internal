'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { getInitData, searchOrderByPcode, recordProductionAction, revalidateNormsAction } from '@/lib/actions/data'
import { calcRealNorm, getUserWorkspaces, getTodayLocal, workshopCode } from '@/lib/utils'
import type { InitData, Order, NormItem, SessionUser, ProductLine, PcodeStatus } from '@/types'

export interface ProductionState {
  loading: boolean
  initData: InitData | null
  selectedDate: string
  selectedWorkshop: string
  selectedPcode: string
  pcodeStatuses: Record<string, PcodeStatus>
  pcodeUnlocked: boolean
  dateLocked: boolean
  lines: ProductLine[]
  unlockLog: string[]
  orderInfo: Order | null
}

const INITIAL_LINE: ProductLine = {
  product: '',
  pdate: '',
  starttime: '',
  endtime: '',
  workforce: 0,
  poutput: 0,
  eoutput: 0,
  routput: 0,
  realnorm: 0,
}

const MAX_LINES = 5
const INITIAL_LINES = 2

function makeInitialLines(today: string): ProductLine[] {
  return Array.from({ length: MAX_LINES }, () => ({ ...INITIAL_LINE, pdate: today }))
}

export function useProductionData(user: SessionUser) {
  const today = getTodayLocal()  // Local date (not UTC) — correct at midnight in VN
  const userWorkspaces = getUserWorkspaces(user.workspace)

  const [state, setState] = useState<ProductionState>({
    loading: false,
    initData: null,
    selectedDate: today,
    selectedWorkshop: '',
    selectedPcode: '',
    pcodeStatuses: {},
    pcodeUnlocked: false,
    dateLocked: true,
    lines: makeInitialLines(today),
    unlockLog: [],
    orderInfo: null,
  })

  const [visibleRows, setVisibleRows] = useState(INITIAL_LINES)

  const loadData = useCallback(
    async (date: string) => {
      setState((s) => ({ ...s, loading: true, selectedWorkshop: '', selectedPcode: '', orderInfo: null }))
      const result = await getInitData(date)
      if (!result.success || !result.data) {
        toast.error(result.error ?? 'Lỗi tải dữ liệu')
        setState((s) => ({ ...s, loading: false }))
        return
      }
      setState((s) => ({
        ...s,
        loading: false,
        initData: result.data!,
        selectedDate: date,
        pcodeUnlocked: false,
        unlockLog: [],
      }))
    },
    []
  )

  const selectWorkshop = useCallback(
    (ws: string) => {
      if (!state.initData) return

      const isOther = ws.startsWith('Việc khác')
      const orders = state.initData.orders.filter((o) => o.workshop === ws)
      const submitted = state.initData.submittedPcodes

      const statuses: Record<string, PcodeStatus> = {}
      if (isOther) {
        const otherTasks = ['5S', 'Đào tạo', 'Hỗ trợ PX khác']
        otherTasks.forEach((t) => {
          statuses[t] = { pcode: t, locked: false, reason: '' }
        })
      } else {
        orders.forEach((o) => {
          const isSubmitted = submitted.includes(o.pcode)
          const isDelivered = o.status.trim().toLowerCase() === 'đã giao'
          const locked = isSubmitted || isDelivered
          const reason = isDelivered ? 'delivered' : isSubmitted ? 'submitted' : ''
          const key = locked ? `${o.pcode} ${isDelivered ? '🔒📦' : '🔒'}` : o.pcode
          statuses[key] = { pcode: o.pcode, locked, reason: reason as PcodeStatus['reason'] }
        })
      }

      setState((s) => ({
        ...s,
        selectedWorkshop: ws,
        selectedPcode: '',
        orderInfo: null,
        pcodeStatuses: statuses,
        pcodeUnlocked: false,
        lines: makeInitialLines(s.selectedDate),
      }))
      setVisibleRows(INITIAL_LINES)
    },
    [state.initData]
  )

  const selectPcode = useCallback(
    (displayPcode: string) => {
      if (!state.initData) return

      const status = state.pcodeStatuses[displayPcode]
      if (!status) return

      if (status.locked && !state.pcodeUnlocked) {
        if (status.reason === 'delivered') {
          toast.error('Mã LSX này đã giao hàng. Không thể nhập thêm.')
        } else {
          toast.warning('Mã LSX này đã nhập. Cần mở khóa để nhập lại.')
        }
        return
      }

      const actualPcode = status.pcode
      const isOther = state.selectedWorkshop.startsWith('Việc khác')

      let orderInfo: Order | null = null
      if (!isOther) {
        orderInfo = state.initData.orders.find((o) => o.pcode === actualPcode) ?? null
      }

      setState((s) => ({
        ...s,
        selectedPcode: displayPcode,
        orderInfo,
        pcodeUnlocked: false,
      }))
    },
    [state.initData, state.pcodeStatuses, state.pcodeUnlocked, state.selectedWorkshop]
  )

  const unlockDate = useCallback(
    (password: string): boolean => {
      setState((s) => ({
        ...s,
        dateLocked: false,
        unlockLog: [...s.unlockLog, `Mở khóa ngày (${new Date().toTimeString().slice(0, 8)})`],
      }))
      return true
    },
    []
  )

  const unlockPcode = useCallback(
    (password: string): boolean => {
      const now = new Date().toTimeString().slice(0, 8)
      const newStatuses: Record<string, PcodeStatus> = {}
      Object.entries(state.pcodeStatuses).forEach(([key, val]) => {
        newStatuses[key] = { ...val, locked: false }
      })
      setState((s) => ({
        ...s,
        pcodeUnlocked: true,
        pcodeStatuses: newStatuses,
        unlockLog: [...s.unlockLog, `Mở khóa LSX (${now})`],
      }))
      return true
    },
    [state.pcodeStatuses]
  )

  const updateLine = useCallback(
    (idx: number, field: keyof ProductLine, value: string | number) => {
      setState((s) => {
        const lines = [...s.lines]
        lines[idx] = { ...lines[idx], [field]: value }

        const orderQty = Math.round(parseFloat(s.orderInfo?.quantity ?? '0') || 0)

        if (field === 'product' && value && !String(value).startsWith('--')) {
          const ws = s.selectedWorkshop
          const norm = s.initData?.norms.find(
            (n) => n.products === value && workshopCode(n.workshop) === workshopCode(ws)
          )
          if (norm) {
            lines[idx].workforce = norm.nwforce
          }

          // Auto-fill poutput: remaining = orderQty - sum of previous lines
          if (orderQty > 0) {
            const usedQty = lines.slice(0, idx).reduce((sum, l) => sum + (Number(l.poutput) || 0), 0)
            lines[idx].poutput = Math.max(0, orderQty - usedQty)
          }

          if (norm) {
            // Recalculate realnorm immediately so selecting product last (after
            // poutput/starttime/endtime are already filled) doesn't leave realnorm = 0.
            lines[idx].realnorm = calcRealNorm({
              nwforce: norm.nwforce,
              workforce: norm.nwforce,
              poutput: lines[idx].poutput,
              starttime: lines[idx].starttime,
              endtime: lines[idx].endtime,
            })
          }

          if (idx >= visibleRows - 1 && visibleRows < MAX_LINES) {
            setVisibleRows((r) => r + 1)
          }
        }

        if (['poutput', 'starttime', 'endtime', 'workforce'].includes(field)) {
          const line = lines[idx]
          const norm = s.initData?.norms.find(
            (n) => n.products === line.product && workshopCode(n.workshop) === workshopCode(s.selectedWorkshop)
          )
          if (norm) {
            lines[idx].realnorm = calcRealNorm({
              nwforce: norm.nwforce,
              workforce: line.workforce,
              poutput: line.poutput,
              starttime: line.starttime,
              endtime: line.endtime,
            })
          }

          // When poutput changes, cascade default poutput to subsequent visible lines that have a product
          if (field === 'poutput' && orderQty > 0) {
            for (let j = idx + 1; j < visibleRows; j++) {
              if (lines[j].product && !lines[j].product.startsWith('--')) {
                const usedQty = lines.slice(0, j).reduce((sum, l) => sum + (Number(l.poutput) || 0), 0)
                lines[j].poutput = Math.max(0, orderQty - usedQty)
                const jNorm = s.initData?.norms.find(
                  (n) => n.products === lines[j].product && workshopCode(n.workshop) === workshopCode(s.selectedWorkshop)
                )
                if (jNorm) {
                  lines[j].realnorm = calcRealNorm({
                    nwforce: jNorm.nwforce,
                    workforce: lines[j].workforce,
                    poutput: lines[j].poutput,
                    starttime: lines[j].starttime,
                    endtime: lines[j].endtime,
                  })
                }
              }
            }
          }
        }

        return { ...s, lines }
      })
    },
    [visibleRows]
  )

  const searchByPcode = useCallback(async (query: string) => {
    setState((s) => ({ ...s, loading: true }))
    const result = await searchOrderByPcode(query)
    setState((s) => ({ ...s, loading: false }))

    if (!result.success || !result.order) {
      toast.error(result.message ?? 'Không tìm thấy')
      return null
    }

    toast.success(
      `Tìm thấy: ${result.order.pcode} | KH: ${result.order.customer} | SL: ${result.order.quantity}`,
      { duration: 4000 }
    )
    return result.order
  }, [])

  const submitProduction = useCallback(async () => {
    const { initData, selectedDate, selectedWorkshop, selectedPcode, pcodeStatuses, lines, unlockLog } = state
    const status = pcodeStatuses[selectedPcode]
    const actualPcode = status?.pcode ?? selectedPcode
    const isOther = selectedWorkshop.startsWith('Việc khác')

    if (isOther && (!lines[0].starttime || !lines[0].endtime)) {
      toast.warning('Vui lòng nhập giờ bắt đầu và kết thúc')
      return false
    }

    const rowsToSave = isOther
      ? [{
          pdate: selectedDate,
          totalem: '',
          pcode: actualPcode,
          products: '',
          material: '',
          poutput: 0,
          eoutput: 0,
          routput: 0,
          workforce: lines[0].workforce,
          starttime: lines[0].starttime,
          endtime: lines[0].endtime,
          realnorm: 0,
          log: unlockLog.join(' | '),
        }]
      : lines.slice(0, visibleRows)
          .filter((l) => l.product && !l.product.startsWith('--'))
          .map((l) => ({
            pdate: l.pdate || selectedDate,
            totalem: '',
            pcode: actualPcode,
            products: l.product,
            material: '',
            poutput: l.poutput,
            eoutput: l.eoutput,
            routput: l.routput,
            workforce: l.workforce,
            starttime: l.starttime,
            endtime: l.endtime,
            realnorm: l.realnorm,
            log: unlockLog.join(' | '),
          }))

    if (rowsToSave.length === 0) {
      toast.warning('Vui lòng chọn ít nhất 1 sản phẩm')
      return false
    }

    if (!isOther && rowsToSave.some((r) => !r.starttime || !r.endtime)) {
      toast.warning('Vui lòng nhập giờ bắt đầu và kết thúc cho tất cả dòng sản xuất')
      return false
    }

    setState((s) => ({ ...s, loading: true }))
    const result = await recordProductionAction(rowsToSave)
    setState((s) => ({ ...s, loading: false }))

    if (result.success) {
      toast.success(result.message, { duration: 4000 })
      await loadData(selectedDate)
      return true
    } else {
      toast.error(result.message)
      return false
    }
  }, [state, visibleRows, loadData])

  const getWorkshopOptions = useCallback(() => {
    if (!state.initData) return []
    const wsSet = new Set(state.initData.orders.map((o) => o.workshop).filter(Boolean))
    const wsList = [...wsSet].sort()

    const otherWsList =
      user.role === 'ADMIN'
        ? wsList.map((ws) => `Việc khác - ${ws}`)
        : userWorkspaces.length > 0
        ? userWorkspaces.map((ws) => `Việc khác - ${ws}`)
        : wsList.map((ws) => `Việc khác - ${ws}`)

    return [...wsList, ...otherWsList]
  }, [state.initData, user.role, userWorkspaces])

  const getProductOptions = useCallback(
    (workshop: string) => {
      if (!state.initData) return []
      const code = workshopCode(workshop)
      const prodSet = new Set(
        state.initData.norms
          .filter((n) => workshopCode(n.workshop) === code)
          .map((n) => n.products)
      )
      return [...prodSet]
    },
    [state.initData]
  )

  const getPcodeOptions = useCallback(() => {
    return Object.keys(state.pcodeStatuses)
  }, [state.pcodeStatuses])

  const getNormHint = useCallback(
    (product: string) => {
      if (!state.initData || !product) return null
      const code = workshopCode(state.selectedWorkshop)
      return (
        state.initData.norms.find(
          (n) => n.products === product && workshopCode(n.workshop) === code
        ) ?? null
      )
    },
    [state.initData, state.selectedWorkshop]
  )

  // Bust the Norm/Material cache then reload — call after updating Norm table in Supabase.
  const refreshNorms = useCallback(async () => {
    await revalidateNormsAction()
    await loadData(state.selectedDate)
  }, [state.selectedDate, loadData])

  return {
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
    refreshNorms,
  }
}
