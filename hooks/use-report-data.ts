'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { subDays, format } from 'date-fns'
import { getProductionReportData } from '@/lib/actions/data'
import type { ProductionReportRow } from '@/types'

export interface ReportState {
  loading: boolean
  data: ProductionReportRow[]
  startDate: string
  endDate: string
}

export function useReportData() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const defaultStart = format(subDays(new Date(), 29), 'yyyy-MM-dd')

  const [state, setState] = useState<ReportState>({
    loading: false,
    data: [],
    startDate: defaultStart,
    endDate: today,
  })

  const loadReport = useCallback(async (start: string, end: string) => {
    setState((s) => ({ ...s, loading: true }))
    const result = await getProductionReportData(start, end)
    if (!result.success) {
      toast.error(result.error ?? 'Lỗi tải báo cáo')
      setState((s) => ({ ...s, loading: false }))
      return
    }
    setState({ loading: false, data: result.data ?? [], startDate: start, endDate: end })
  }, [])

  const kpis = useCallback(() => {
    const { data } = state
    const totalOutput = data.reduce((s, r) => s + r.poutput, 0)
    const totalError = data.reduce((s, r) => s + r.eoutput, 0)
    const totalRecycle = data.reduce((s, r) => s + r.routput, 0)
    const errorRate = totalOutput > 0 ? ((totalError / totalOutput) * 100).toFixed(1) : '0'
    const avgNorm = data.length > 0
      ? (data.reduce((s, r) => s + r.realnorm, 0) / data.length).toFixed(2)
      : '0'
    return { totalOutput, totalError, totalRecycle, errorRate, avgNorm, totalRows: data.length }
  }, [state])

  const chartByDate = useCallback(() => {
    const map = new Map<string, { output: number; error: number; recycle: number }>()
    state.data.forEach((r) => {
      const prev = map.get(r.pdate) ?? { output: 0, error: 0, recycle: 0 }
      map.set(r.pdate, {
        output: prev.output + r.poutput,
        error: prev.error + r.eoutput,
        recycle: prev.recycle + r.routput,
      })
    })
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }))
  }, [state])

  const chartByProduct = useCallback(() => {
    const map = new Map<string, { output: number; error: number }>()
    state.data.forEach((r) => {
      const prev = map.get(r.product) ?? { output: 0, error: 0 }
      map.set(r.product, {
        output: prev.output + r.poutput,
        error: prev.error + r.eoutput,
      })
    })
    return [...map.entries()]
      .sort(([, a], [, b]) => b.output - a.output)
      .slice(0, 10)
      .map(([product, v]) => ({ product, ...v }))
  }, [state])

  const chartByWorkshop = useCallback(() => {
    const map = new Map<string, number>()
    state.data.forEach((r) => {
      map.set(r.workshop, (map.get(r.workshop) ?? 0) + r.poutput)
    })
    return [...map.entries()].map(([workshop, value]) => ({ workshop, value }))
  }, [state])

  const normComparisonData = useCallback(() => {
    const map = new Map<string, { product: string; norm: number; realnorm: number; count: number }>()
    state.data.forEach((r) => {
      if (!r.product) return
      const prev = map.get(r.product) ?? { product: r.product, norm: r.norm, realnorm: 0, count: 0 }
      map.set(r.product, {
        product: r.product,
        norm: r.norm,
        realnorm: prev.realnorm + r.realnorm,
        count: prev.count + 1,
      })
    })
    return [...map.values()].map((d) => ({
      product: d.product,
      'Định mức': d.norm,
      'Thực tế': d.count > 0 ? Math.round((d.realnorm / d.count) * 100) / 100 : 0,
    }))
  }, [state])

  return { state, loadReport, kpis, chartByDate, chartByProduct, chartByWorkshop, normComparisonData }
}
