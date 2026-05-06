import type { Order } from '@/types'
import { compareLocalDateTimeStrings, normalizeLocalDateTimeString } from '@/lib/utils'
import {
  calculateProductionCompletion,
  calculateProductionCompletionTime,
  filterProductionOrdersByPcode,
  getProductionRowsValidationError,
  getProductionOrderStatusRank,
  isOpenProductionOrder,
  isProductionTimeRangeValid,
  shouldAutoCloseProductionOrder,
  sortProductionOrdersForEntry,
} from '@/lib/production/workflow'

import {
  isEffectiveClosedProductionStatus,
  isEffectiveCompletedProductionStatus,
  resolveProductionOrderStatus,
  shouldShowOpenProductionOrder,
} from '@/lib/production/status'

const baseOrder: Order = {
  pcode: '',
  initialdate: '2026-05-02',
  workshop: 'DMC1',
  customer: 'Customer',
  quantity: '10',
  description: 'Description',
  deadlinedate: '',
  status: '',
}

function order(pcode: string, status: string): Order {
  return { ...baseOrder, pcode, status }
}

describe('production workflow helpers', () => {
  it('ranks production statuses in data-entry priority order', () => {
    expect(getProductionOrderStatusRank('Chua san xuat')).toBe(0)
    expect(getProductionOrderStatusRank('Da SX')).toBe(1)
    expect(getProductionOrderStatusRank('Da giao')).toBe(2)
    expect(getProductionOrderStatusRank('Dang san xuat')).toBe(3)
  })

  it('treats delivered source status as closed but not completed production status', () => {
    expect(isEffectiveCompletedProductionStatus('Đã giao')).toBe(false)
    expect(isEffectiveClosedProductionStatus('Đã giao')).toBe(true)
    expect(isEffectiveClosedProductionStatus('Đã SX')).toBe(true)
  })

  it('resolves effective production order status without mutating source status', () => {
    expect(resolveProductionOrderStatus({ sourceStatus: 'Đã giao', produced: 0, quantity: 100, closed: false })).toBe('Đã giao')
    expect(resolveProductionOrderStatus({ sourceStatus: 'Đã SX', produced: 0, quantity: 100, closed: false })).toBe('Đã SX')
    expect(resolveProductionOrderStatus({ sourceStatus: 'Đang sản xuất', produced: 0, quantity: 100, closed: false })).toBe('Chưa SX')
    expect(resolveProductionOrderStatus({ sourceStatus: 'Chưa sản xuất', produced: 10, quantity: 100, closed: false })).toBe('Đang SX')
    expect(resolveProductionOrderStatus({ sourceStatus: 'Chưa sản xuất', produced: 100, quantity: 100, closed: false })).toBe('Đã SX')
    expect(resolveProductionOrderStatus({ sourceStatus: 'Chưa sản xuất', produced: 10, quantity: 100, closed: true })).toBe('Đã SX')
  })

  it('detects open production orders from effective status and completion metadata', () => {
    expect(shouldShowOpenProductionOrder({
      status: 'Chưa SX',
      closed: false,
      completion: calculateProductionCompletion(100, 0),
    })).toBe(true)
    expect(shouldShowOpenProductionOrder({
      status: 'Đang SX',
      closed: false,
      completion: calculateProductionCompletion(100, 40),
    })).toBe(true)
    expect(shouldShowOpenProductionOrder({
      status: 'Đã SX',
      closed: false,
      completion: calculateProductionCompletion(100, 100),
    })).toBe(false)
    expect(shouldShowOpenProductionOrder({
      status: 'Đã giao',
      closed: false,
      completion: calculateProductionCompletion(100, 40),
    })).toBe(true)
    expect(shouldShowOpenProductionOrder({
      status: 'Đang SX',
      closed: true,
      completion: calculateProductionCompletion(100, 40),
    })).toBe(false)
  })

  it('sorts order catalog by status priority then pcode', () => {
    const sorted = sortProductionOrdersForEntry([
      order('LSX-004', 'Da giao'),
      order('LSX-003', 'Da SX'),
      order('LSX-002', 'Chua san xuat'),
      order('LSX-001', 'Dang san xuat'),
      order('LSX-000', 'Dang san xuat'),
    ])

    expect(sorted.map((o) => o.pcode)).toEqual(['LSX-002', 'LSX-003', 'LSX-004', 'LSX-000', 'LSX-001'])
  })

  it('filters order catalog by production code case-insensitively', () => {
    const filtered = filterProductionOrdersByPcode([
      order('DMC-ABC-001', 'Dang san xuat'),
      order('DMC-XYZ-002', 'Chua san xuat'),
    ], 'abc')

    expect(filtered.map((o) => o.pcode)).toEqual(['DMC-ABC-001'])
  })

  it('normalizes local deadline strings without timezone conversion', () => {
    expect(normalizeLocalDateTimeString('2026-05-06T15:00:00')).toBe('2026-05-06T15:00:00')
    expect(normalizeLocalDateTimeString('2026-05-06 15:00:00')).toBe('2026-05-06T15:00:00')
    expect(normalizeLocalDateTimeString('06/05/2026 15:00')).toBe('2026-05-06T15:00:00')
    expect(normalizeLocalDateTimeString('06/05/2026 15:00:00')).toBe('2026-05-06T15:00:00')
  })

  it('compares equal production completion and deadline as on time', () => {
    expect(compareLocalDateTimeStrings('2026-05-06T15:00:00', '2026-05-06T15:00:00')).toBe(0)
    expect(compareLocalDateTimeStrings('2026-05-06T15:00:00', '06/05/2026 15:00')).toBe(0)
  })

  it('detects production completion after local deadline as late', () => {
    expect(compareLocalDateTimeStrings('2026-05-06T15:01:00', '2026-05-06T15:00:00')).toBeGreaterThan(0)
  })

  it('calculates cumulative production completion', () => {
    expect(calculateProductionCompletion(100, 40)).toEqual({
      producedQuantity: 40,
      remainingQuantity: 60,
      completionPct: 40,
    })
    expect(calculateProductionCompletion(100, 125)).toEqual({
      producedQuantity: 125,
      remainingQuantity: 0,
      completionPct: 100,
    })
    expect(calculateProductionCompletion(0, 5)).toEqual({
      producedQuantity: 5,
      remainingQuantity: 0,
      completionPct: 100,
    })
  })

  it('calculates completion time from production date and end time', () => {
    expect(calculateProductionCompletionTime(100, [
      { pdate: '2026-05-06', endtime: '10:00', poutput: 40 },
      { pdate: '2026-05-06', endtime: '15:00', poutput: 60 },
      { pdate: '2026-05-06', endtime: '16:00', poutput: 20 },
    ])).toBe('2026-05-06T15:00:00')
  })

  it('sorts production rows by actual production timestamp before calculating completion time', () => {
    expect(calculateProductionCompletionTime(100, [
      { pdate: '2026-05-06', endtime: '15:00', poutput: 60 },
      { pdate: '2026-05-06', endtime: '10:00', poutput: 40 },
      { pdate: '2026-05-05', endtime: '16:30', poutput: 30 },
    ])).toBe('2026-05-06T15:00:00')
  })

  it('ignores production rows without a valid production end timestamp', () => {
    expect(calculateProductionCompletionTime(100, [
      { pdate: '2026-05-06', endtime: null, poutput: 70 },
      { pdate: '2026-05-06', endtime: '15:00', poutput: 60 },
      { pdate: '2026-05-06', endtime: '16:00', poutput: 40 },
    ])).toBe('2026-05-06T16:00:00')
  })

  it('returns null when timed production output has not reached quantity', () => {
    expect(calculateProductionCompletionTime(100, [
      { pdate: '2026-05-06', endtime: '10:00', poutput: 40 },
      { pdate: '2026-05-06', endtime: '15:00', poutput: 59 },
    ])).toBeNull()
  })

  it('detects open production orders for the default list', () => {
    expect(isOpenProductionOrder({ quantity: '100', status: 'Dang san xuat' }, 40, false)).toBe(true)
    expect(isOpenProductionOrder({ quantity: '100', status: 'Chua san xuat' }, 0, false)).toBe(true)
    expect(isOpenProductionOrder({ quantity: '100', status: '' }, 99, false)).toBe(true)
    expect(isOpenProductionOrder({ quantity: '100', status: 'Dang san xuat' }, 100, false)).toBe(false)
    expect(isOpenProductionOrder({ quantity: '100', status: 'Dang san xuat' }, 40, true)).toBe(false)
    expect(isOpenProductionOrder({ quantity: '100', status: 'Da giao' }, 40, false)).toBe(true)
  })

  it('detects when completed production orders should be auto-closed', () => {
    expect(shouldAutoCloseProductionOrder(100, 100)).toBe(true)
    expect(shouldAutoCloseProductionOrder(100, 125)).toBe(true)
    expect(shouldAutoCloseProductionOrder(100, 99)).toBe(false)
    expect(shouldAutoCloseProductionOrder(0, 5)).toBe(false)
    expect(shouldAutoCloseProductionOrder(Number.NaN, 5)).toBe(false)
  })

  it('requires production end time to be later than start time', () => {
    expect(isProductionTimeRangeValid('08:00', '09:00')).toBe(true)
    expect(isProductionTimeRangeValid('08:00', '08:00')).toBe(false)
    expect(isProductionTimeRangeValid('09:30', '08:30')).toBe(false)
  })

  it('reports the first invalid production input rule', () => {
    const validRow = {
      pdate: '2026-05-02',
      pcode: 'LSX-001',
      products: 'Product A',
      poutput: 1,
      eoutput: 0,
      routput: 0,
      workforce: 2,
      starttime: '08:00',
      endtime: '09:00',
    }

    expect(getProductionRowsValidationError([validRow])).toBeNull()
    expect(getProductionRowsValidationError([]))
      .toBe('Vui lòng chọn ít nhất 1 sản phẩm.')
    expect(getProductionRowsValidationError([{ ...validRow, pdate: '' }]))
      .toBe('Dòng 1: vui lòng chọn ngày sản xuất.')
    expect(getProductionRowsValidationError([{ ...validRow, pcode: '' }]))
      .toBe('Dòng 1: vui lòng chọn mã LSX.')
    expect(getProductionRowsValidationError([{ ...validRow, starttime: '' }]))
      .toBe('Dòng 1: vui lòng nhập giờ bắt đầu và kết thúc.')
    expect(getProductionRowsValidationError([{ ...validRow, endtime: '07:59' }]))
      .toBe('Dòng 1: giờ kết thúc phải lớn hơn giờ bắt đầu.')
    expect(getProductionRowsValidationError([{ ...validRow, poutput: -1 }]))
      .toBe('Dòng 1: số lượng và nhân sự không được âm.')
  })
})
