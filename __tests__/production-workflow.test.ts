import type { Order } from '@/types'
import {
  filterProductionOrdersByPcode,
  getProductionRowsValidationError,
  getProductionOrderStatusRank,
  isProductionTimeRangeValid,
  sortProductionOrdersForEntry,
} from '@/lib/production/workflow'

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
    expect(getProductionOrderStatusRank('Dang san xuat')).toBe(0)
    expect(getProductionOrderStatusRank('Chua san xuat')).toBe(1)
    expect(getProductionOrderStatusRank('Da SX')).toBe(2)
    expect(getProductionOrderStatusRank('Da giao')).toBe(3)
  })

  it('sorts order catalog by status priority then pcode', () => {
    const sorted = sortProductionOrdersForEntry([
      order('LSX-004', 'Da giao'),
      order('LSX-003', 'Da SX'),
      order('LSX-002', 'Chua san xuat'),
      order('LSX-001', 'Dang san xuat'),
      order('LSX-000', 'Dang san xuat'),
    ])

    expect(sorted.map((o) => o.pcode)).toEqual(['LSX-000', 'LSX-001', 'LSX-002', 'LSX-003', 'LSX-004'])
  })

  it('filters order catalog by production code case-insensitively', () => {
    const filtered = filterProductionOrdersByPcode([
      order('DMC-ABC-001', 'Dang san xuat'),
      order('DMC-XYZ-002', 'Chua san xuat'),
    ], 'abc')

    expect(filtered.map((o) => o.pcode)).toEqual(['DMC-ABC-001'])
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
