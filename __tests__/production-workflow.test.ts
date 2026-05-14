import type { Order } from '@/types'
import { compareLocalDateTimeStrings, normalizeLocalDateTimeString } from '@/lib/utils'
import {
  getActiveProductionPcodes,
  isProductionDateProgressFilter,
  isProgressReportCompleted,
  normalizeProgressFilterBy,
} from '@/lib/reports/report-queries'
import {
  buildProductionDeadlineCutoff,
  calculateProductionCompletion,
  calculateProductionCompletionTime,
  filterProductionOrdersByPcode,
  getOpenOrdersSearchState,
  getOpenProductionOrdersQueryWindow,
  getOtherProductionEntryBaseWorkshop,
  getProductionEntryBaseWorkshop,
  getProductionEntryWorkshop,
  getProductionOrderStatusRank,
  getProductionRowsValidationError,
  isOpenProductionOrder,
  isOtherProductionEntryTask,
  isProductionEntryWorkspaceAllowed,
  isProductionOrderCreatedOnOrAfter,
  isProductionOrderDeadlineExpired,
  isProductionTimeRangeValid,
  shouldAutoCloseProductionOrder,
  shouldKeepNotStartedOrderVisible,
  sortProductionOrdersForEntry,
} from '@/lib/production/workflow'

import {
  isEffectiveClosedProductionStatus,
  isEffectiveCompletedProductionStatus,
  isProductionOrderInternalStatus,
  resolveOpenProductionOrderStatus,
  resolveProductionOrderStatus,
  shouldShowOpenProductionOrder,
} from '@/lib/production/status'
import {
  applyEffectiveStatusToOrder,
  buildProductionStatusMapFromRows,
} from '@/lib/production/status-server'

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
  it('splits DMC1 PU production-entry orders by description case-insensitively', () => {
    expect(getProductionEntryWorkshop('DMC1', 'pu foam')).toBe('DMC1-PU')
    expect(getProductionEntryWorkshop('DMC1', 'PU foam')).toBe('DMC1-PU')
    expect(getProductionEntryWorkshop('DMC1', 'Pu foam')).toBe('DMC1-PU')
  })

  it('splits DMC1 phụ kiện and PK production-entry orders by description case-insensitively', () => {
    expect(getProductionEntryWorkshop('DMC1', 'Tôn phụ kiện')).toBe('DMC1-PK')
    expect(getProductionEntryWorkshop('DMC1', 'Tôn PK')).toBe('DMC1-PK')
    expect(getProductionEntryWorkshop('DMC1', 'Tôn Pk')).toBe('DMC1-PK')
    expect(getProductionEntryWorkshop('DMC1', 'Tôn pk')).toBe('DMC1-PK')
  })

  it('classifies normal DMC1 production-entry orders as CT', () => {
    expect(getProductionEntryWorkshop('DMC1', 'Tôn cán thường')).toBe('DMC1-CT')
    expect(getProductionEntryWorkshop('Phân xưởng 1 - Tôn', null)).toBe('DMC1-CT')
  })

  it('keeps non-DMC1 production-entry workshops normalized without splitting', () => {
    expect(getProductionEntryWorkshop('DMC3', 'pu foam')).toBe('DMC3')
    expect(getProductionEntryWorkshop('Phân xưởng 4 - Tôn', 'phụ kiện')).toBe('DMC4 - Tôn')
  })

  it('prioritizes PU over PK when both DMC1 split markers appear', () => {
    expect(getProductionEntryWorkshop('DMC1', 'PU phụ kiện PK')).toBe('DMC1-PU')
  })

  it('maps DMC1 production-entry subgroups back to base DMC1', () => {
    expect(getProductionEntryBaseWorkshop('DMC1-CT')).toBe('DMC1')
    expect(getProductionEntryBaseWorkshop('DMC1-PK')).toBe('DMC1')
    expect(getProductionEntryBaseWorkshop('DMC1-PU')).toBe('DMC1')
    expect(getProductionEntryBaseWorkshop('Phân xưởng 3 - Tôn')).toBe('DMC3')
  })

  it('allows DMC1 aggregate workspace to access all production-entry subgroups', () => {
    expect(isProductionEntryWorkspaceAllowed('DMC1', 'USER', ['DMC1'])).toBe(true)
    expect(isProductionEntryWorkspaceAllowed('DMC1-CT', 'USER', ['DMC1'])).toBe(true)
    expect(isProductionEntryWorkspaceAllowed('DMC1-PK', 'USER', ['DMC1'])).toBe(true)
    expect(isProductionEntryWorkspaceAllowed('DMC1-PU', 'USER', ['DMC1'])).toBe(true)
  })

  it('limits DMC1 subgroup workspaces to exact production-entry subgroup matches', () => {
    expect(isProductionEntryWorkspaceAllowed('DMC1-PK', 'USER', ['DMC1-PK'])).toBe(true)
    expect(isProductionEntryWorkspaceAllowed('DMC1-PU', 'USER', ['DMC1-PK'])).toBe(false)
    expect(isProductionEntryWorkspaceAllowed('DMC1-CT', 'USER', ['DMC1-PK'])).toBe(false)
  })

  it('allows ADMIN and explicit ALL production-entry workspaces to access all workshops', () => {
    expect(isProductionEntryWorkspaceAllowed('DMC1-PU', 'ADMIN', ['DMC3'])).toBe(true)
    expect(isProductionEntryWorkspaceAllowed('DMC1-PU', 'USER', [], 'ALL')).toBe(true)
    expect(isProductionEntryWorkspaceAllowed('DMC3', 'USER', [], 'ALL')).toBe(true)
  })

  it('denies blank production-entry workspaces for non-admin users', () => {
    expect(isProductionEntryWorkspaceAllowed('DMC1-PU', 'USER', [], '')).toBe(false)
    expect(isProductionEntryWorkspaceAllowed('DMC3', 'USER', [], null)).toBe(false)
  })

  it('maps other production-entry labels to base workshops', () => {
    expect(getOtherProductionEntryBaseWorkshop('Việc khác - DMC1')).toBe('DMC1')
    expect(getOtherProductionEntryBaseWorkshop('Việc khác - DMC1-PU')).toBe('DMC1')
    expect(getOtherProductionEntryBaseWorkshop('Việc khác - DMC1-PK')).toBe('DMC1')
    expect(getOtherProductionEntryBaseWorkshop('Việc khác - DMC1-CT')).toBe('DMC1')
    expect(getOtherProductionEntryBaseWorkshop('Việc khác - DMC3')).toBe('DMC3')
  })

  it('identifies only whitelisted other production-entry tasks', () => {
    expect(isOtherProductionEntryTask('5S')).toBe(true)
    expect(isOtherProductionEntryTask('Đào tạo')).toBe(true)
    expect(isOtherProductionEntryTask('Hỗ trợ PX khác')).toBe(true)
    expect(isOtherProductionEntryTask('5S-extra')).toBe(false)
  })

  it('ranks production statuses in data-entry priority order', () => {
    expect(getProductionOrderStatusRank('Chua san xuat')).toBe(0)
    expect(getProductionOrderStatusRank('Dang san xuat')).toBe(1)
    expect(getProductionOrderStatusRank('Dang kiem')).toBe(2)
    expect(getProductionOrderStatusRank('Da SX')).toBe(3)
    expect(getProductionOrderStatusRank('Da giao')).toBe(4)
  })

  it('accepts internal production status labels regardless of accent casing', () => {
    expect(isProductionOrderInternalStatus('Đang kiểm')).toBe(true)
    expect(isProductionOrderInternalStatus('Đang Kiểm')).toBe(true)
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

  it('can treat recently delivered orders as internal production statuses for open orders', () => {
    const now = new Date('2026-05-09T09:00:00+07:00')

    expect(resolveOpenProductionOrderStatus({
      sourceStatus: 'Đã giao',
      produced: 0,
      quantity: 100,
      closed: false,
      deadlinedate: '2026-05-08',
      deadlinetime: '10:00',
      now,
    })).toBe('Chưa SX')

    expect(resolveOpenProductionOrderStatus({
      sourceStatus: 'Đã giao',
      produced: 40,
      quantity: 100,
      closed: false,
      deadlinedate: '2026-05-08',
      deadlinetime: '10:00',
      now,
    })).toBe('Đang SX')

    expect(resolveOpenProductionOrderStatus({
      sourceStatus: 'Đã giao',
      produced: 100,
      quantity: 100,
      closed: false,
      deadlinedate: '2026-05-08',
      deadlinetime: '10:00',
      now,
    })).toBe('Đã SX')

    expect(resolveOpenProductionOrderStatus({
      sourceStatus: 'Đã giao',
      produced: 0,
      quantity: 100,
      closed: false,
      deadlinedate: '2026-05-05',
      deadlinetime: '08:59',
      now,
    })).toBe('Đã giao')

    expect(resolveOpenProductionOrderStatus({
      sourceStatus: 'Đã giao',
      produced: 0,
      quantity: 100,
      closed: false,
      deadlinedate: '2026-05-10',
      deadlinetime: '08:59',
      now,
    })).toBe('Chưa SX')

    expect(resolveOpenProductionOrderStatus({
      sourceStatus: 'Đã giao',
      produced: 40,
      quantity: 100,
      closed: false,
      deadlinedate: '2026-05-10',
      deadlinetime: '08:59',
      now,
    })).toBe('Đang SX')
  })

  it('uses fresh production output instead of stale persisted produced quantity for effective order status', () => {
    const statusMap = buildProductionStatusMapFromRows({
      pcodes: ['LSX-FRESH'],
      statusRows: [{
        pcode: 'LSX-FRESH',
        status: 'Đang SX',
        produced_quantity: 20,
        quantity: 100,
        completion_pct: 20,
      }],
      productionRows: [
        { pcode: 'LSX-FRESH', poutput: 60, save_status: 'draft' },
        { pcode: 'LSX-FRESH', poutput: 40, save_status: 'draft' },
      ],
      quantityByPcode: new Map([['LSX-FRESH', 100]]),
    })

    const info = statusMap.get('LSX-FRESH')
    expect(info).toMatchObject({
      producedQuantity: 100,
      quantity: 100,
      completionPct: 100,
      closed: false,
    })

    expect(applyEffectiveStatusToOrder({
      ...baseOrder,
      pcode: 'LSX-FRESH',
      status: 'Chua san xuat',
      quantity: '100',
    }, statusMap)).toMatchObject({
      status: 'Đã SX',
      internalStatus: 'Đã SX',
    })
  })

  it('does not let stale shared inspection status override explicit raw not-started status', () => {
    expect(resolveProductionOrderStatus({
      sourceStatus: 'Chưa sản xuất',
      internalStatus: 'Đang Kiểm',
      produced: 0,
      quantity: 100,
      closed: false,
    })) .toBe('Chưa SX')
  })

  it('resolves to inspection status when data source carries Đang kiểm even without an explicit internalStatus', () => {
    // Core case: sourceStatus from data table = 'Đang kiểm', no internalStatus row
    expect(resolveProductionOrderStatus({
      sourceStatus: 'Đang kiểm',
      produced: 0,
      quantity: 100,
      closed: false,
    })) .toBe('Đang kiểm')

    // Accent variant from Google Sheet
    expect(resolveProductionOrderStatus({
      sourceStatus: 'Đang kiểm',
      produced: 0,
      quantity: 100,
      closed: false,
    })) .toBe('Đang kiểm')

    // Auto-computed internalStatus 'Chưa SX' must NOT override sourceStatus 'Đang kiểm'
    expect(resolveProductionOrderStatus({
      sourceStatus: 'Đang kiểm',
      internalStatus: 'Chưa SX',
      produced: 0,
      quantity: 100,
      closed: false,
    })) .toBe('Đang kiểm')
  })

  it('normalizes old completed-date progress filter to production date', () => {
    expect(normalizeProgressFilterBy('completed_date')).toBe('production_date')
    expect(normalizeProgressFilterBy('production_date')).toBe('production_date')
    expect(isProductionDateProgressFilter('completed_date')).toBe(true)
    expect(isProductionDateProgressFilter('production_date')).toBe(true)
    expect(isProductionDateProgressFilter('initialdate')).toBe(false)
  })

  it('collects active production pcodes from all production save statuses', () => {
    expect(getActiveProductionPcodes([
      { pcode: 'LSX-001', save_status: 'draft' },
      { pcode: 'LSX-002', save_status: 'closed' },
      { pcode: 'LSX-001', save_status: 'closed' },
      { pcode: null, save_status: 'draft' },
    ])).toEqual(['LSX-001', 'LSX-002'])
  })

  it('requires progress report completion to come from production quantity', () => {
    expect(isProgressReportCompleted(calculateProductionCompletion(100, 0).completionPct)).toBe(false)
    expect(isProgressReportCompleted(calculateProductionCompletion(100, 99).completionPct)).toBe(false)
    expect(isProgressReportCompleted(calculateProductionCompletion(100, 100).completionPct)).toBe(true)
  })

  it('keeps completed and delivered production orders visible while deadline is within 72 hours', () => {
    expect(shouldShowOpenProductionOrder({
      status: 'Đã SX',
      closed: false,
      completion: calculateProductionCompletion(100, 100),
      deadlinedate: '2026-05-08',
      deadlinetime: '10:00',
      now: new Date('2026-05-11T09:59:59+07:00'), // 71h59m59s from deadline → still visible
    })).toBe(true)
    expect(shouldShowOpenProductionOrder({
      status: 'Đã SX',
      closed: false,
      completion: calculateProductionCompletion(100, 100),
      deadlinedate: '2026-05-08',
      deadlinetime: '10:00',
      now: new Date('2026-05-11T10:00:01+07:00'), // 72h0m1s from deadline → hidden
    })).toBe(false)
    expect(shouldShowOpenProductionOrder({
      status: 'Đã giao',
      closed: false,
      completion: calculateProductionCompletion(100, 40),
      deadlinedate: '2026-05-08',
      deadlinetime: '10:00',
      now: new Date('2026-05-11T09:59:59+07:00'),
    })).toBe(true)
  })

  it('keeps completed production orders visible for up to one day after completion even when the deadline is older', () => {
    expect(shouldShowOpenProductionOrder({
      status: 'Đã SX',
      closed: false,
      completion: calculateProductionCompletion(100, 100),
      completedAt: '2026-05-08T10:00:00',
      deadlinedate: '2026-05-01',
      deadlinetime: '10:00',
      now: new Date('2026-05-09T09:59:59+07:00'),
    })).toBe(true)
    expect(shouldShowOpenProductionOrder({
      status: 'Đã SX',
      closed: false,
      completion: calculateProductionCompletion(100, 100),
      completedAt: '2026-05-08T10:00:00',
      deadlinedate: '2026-05-01',
      deadlinetime: '10:00',
      now: new Date('2026-05-09T10:00:01+07:00'),
    })).toBe(false)
  })

  it('keeps newly closed production orders visible for up to one day after the latest status update when completion time is unavailable', () => {
    expect(shouldShowOpenProductionOrder({
      status: 'Đã SX',
      closed: false,
      completion: calculateProductionCompletion(100, 40),
      deadlinedate: '2026-05-01',
      deadlinetime: '10:00',
      statusUpdatedAt: '2026-05-09T08:30:00+07:00',
      now: new Date('2026-05-09T17:29:59+07:00'),
    })).toBe(true)
    expect(shouldShowOpenProductionOrder({
      status: 'Đã SX',
      closed: false,
      completion: calculateProductionCompletion(100, 40),
      deadlinedate: '2026-05-01',
      deadlinetime: '10:00',
      statusUpdatedAt: '2026-05-09T08:30:00+07:00',
      now: new Date('2026-05-10T08:30:01+07:00'),
    })).toBe(false)
  })

  it('keeps not-started orders from the 2026-04-01 baseline and excludes older ones', () => {
    expect(isProductionOrderCreatedOnOrAfter('2026-04-01', '2026-04-01')).toBe(true)
    expect(isProductionOrderCreatedOnOrAfter('2026-04-02', '2026-04-01')).toBe(true)
    expect(isProductionOrderCreatedOnOrAfter('2026-03-31', '2026-04-01')).toBe(false)
  })

  it('keeps not-started orders visible based on initial date even if deadline is older than 72 hours', () => {
    expect(shouldKeepNotStartedOrderVisible({
      initialdate: '2026-05-08',
      baselineDate: '2026-04-01',
    })).toBe(true)
    expect(isProductionOrderDeadlineExpired(
      '2026-05-09',
      '08:30',
      new Date('2026-05-12T09:00:00+07:00'),
      72 * 60 * 60 * 1000,
    )).toBe(true)
  })

  it('builds the open-orders query window from the Vietnam calendar date even before 07:00 UTC+7', () => {
    expect(getOpenProductionOrdersQueryWindow(new Date('2026-05-08T18:30:00.000Z'))).toEqual({
      today: '2026-05-09',
      fromDate: '2026-04-01',
      deadlineFrom: '2026-05-07',
    })
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
      status: 'Đang kiểm',
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
    })).toBe(false)
    expect(shouldShowOpenProductionOrder({
      status: 'Đang SX',
      closed: true,
      completion: calculateProductionCompletion(100, 40),
    })).toBe(false)
  })

  it('keeps searched open orders visible even when the current status filter would otherwise hide them', () => {
    const orders = [
      { ...order('LSX-001', 'Chưa SX'), quantity: '100', producedQuantity: 0, remainingQuantity: 100, completionPct: 0 },
      { ...order('LSX-002', 'Đang kiểm'), quantity: '100', producedQuantity: 0, remainingQuantity: 100, completionPct: 0 },
    ]

    expect(getOpenOrdersSearchState(orders, 'NOT_STARTED', 'LSX-002')).toEqual({
      query: 'LSX-002',
      statusFilter: 'ALL',
    })
  })

  it('sorts order catalog by status priority then pcode', () => {
    const sorted = sortProductionOrdersForEntry([
      order('LSX-004', 'Da giao'),
      order('LSX-003', 'Da SX'),
      order('LSX-002', 'Chua san xuat'),
      order('LSX-001', 'Dang san xuat'),
      order('LSX-000', 'Dang san xuat'),
    ])

    expect(sorted.map((o) => o.pcode)).toEqual(['LSX-002', 'LSX-000', 'LSX-001', 'LSX-003', 'LSX-004'])
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

  it('builds production deadline cutoff at 16:30 on the deadline date', () => {
    expect(buildProductionDeadlineCutoff('2026-05-07T14:00:00')).toBe('2026-05-07T16:30:00')
    expect(buildProductionDeadlineCutoff('2026-05-07 14:00:00')).toBe('2026-05-07T16:30:00')
    expect(buildProductionDeadlineCutoff(null)).toBeNull()
    expect(buildProductionDeadlineCutoff('invalid')).toBeNull()
    expect(buildProductionDeadlineCutoff('2026-02-31T14:00:00')).toBeNull()
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

    const nowVN = new Date('2026-05-02T10:00:00+07:00')
    expect(getProductionRowsValidationError([validRow], nowVN)).toBeNull()
    expect(getProductionRowsValidationError([]))
      .toBe('Vui lòng chọn ít nhất 1 sản phẩm.')
    expect(getProductionRowsValidationError([{ ...validRow, pdate: '' }]))
      .toBe('Dòng 1: vui lòng chọn ngày sản xuất.')
    expect(getProductionRowsValidationError([{ ...validRow, pcode: '' }]))
      .toBe('Dòng 1: vui lòng chọn mã LSX.')
    expect(getProductionRowsValidationError([{ ...validRow, starttime: '' }]))
      .toBe('Dòng 1: vui lòng nhập giờ bắt đầu và kết thúc.')
    expect(getProductionRowsValidationError([{ ...validRow, endtime: '07:59' }], nowVN))
      .toBe('Dòng 1: giờ kết thúc phải lớn hơn giờ bắt đầu.')
    expect(getProductionRowsValidationError([{ ...validRow, poutput: -1 }], nowVN))
      .toBe('Dòng 1: số lượng và nhân sự không được âm.')
  })

  it('rejects production end time after current local time', () => {
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
    // Neo absolute time về Asia/Ho_Chi_Minh để test không phụ thuộc TZ của runner.
    const now = new Date('2026-05-02T10:00:00+07:00')

    expect(getProductionRowsValidationError([validRow], now)).toBeNull()
    expect(getProductionRowsValidationError([{ ...validRow, endtime: '11:00' }], now))
      .toBe('Dòng 1: giờ kết thúc không được lớn hơn thời gian hiện tại theo ngày sản xuất.')
    expect(getProductionRowsValidationError([{ ...validRow, pdate: '2026-05-03' }], now))
      .toBe('Dòng 1: giờ kết thúc không được lớn hơn thời gian hiện tại theo ngày sản xuất.')
    expect(getProductionRowsValidationError([{ ...validRow, endtime: '07:59' }], now))
      .toBe('Dòng 1: giờ kết thúc phải lớn hơn giờ bắt đầu.')
  })

  it('hides open orders whose deadline expired more than 36 hours ago', () => {
    // Deadline 2026-05-07T11:00 +07:00 = 2026-05-07T04:00Z
    const deadline = { deadlinedate: '2026-05-07', deadlinetime: '11:00' }
    const exactly36h  = new Date('2026-05-08T23:00:00+07:00') // elapsed = 36h exactly → NOT expired
    const over36h     = new Date('2026-05-08T23:00:01+07:00') // elapsed > 36h → expired
    const before      = new Date('2026-05-07T10:59:00+07:00') // deadline not yet passed
    expect(isProductionOrderDeadlineExpired(deadline.deadlinedate, deadline.deadlinetime, exactly36h)).toBe(false)
    expect(isProductionOrderDeadlineExpired(deadline.deadlinedate, deadline.deadlinetime, over36h)).toBe(true)
    expect(isProductionOrderDeadlineExpired(deadline.deadlinedate, deadline.deadlinetime, before)).toBe(false)
  })

  it('does not hide orders with no deadline set', () => {
    const now = new Date('2026-05-09T08:00:00+07:00')
    expect(isProductionOrderDeadlineExpired(null, null, now)).toBe(false)
    expect(isProductionOrderDeadlineExpired('', '', now)).toBe(false)
    expect(isProductionOrderDeadlineExpired(undefined, undefined, now)).toBe(false)
  })

  it('treats deadline with no time as end of day (23:59 +07:00)', () => {
    // deadline 2026-05-08 no time → treated as 23:59 → expires after 2026-05-08T23:59+36h = 2026-05-10T11:59
    const nowJustOver  = new Date('2026-05-10T11:59:01+07:00') // 1s after 36h grace → expired
    const nowJustUnder = new Date('2026-05-10T11:58:00+07:00') // within 36h grace → NOT expired
    expect(isProductionOrderDeadlineExpired('2026-05-08', '', nowJustOver)).toBe(true)
    expect(isProductionOrderDeadlineExpired('2026-05-08', '', nowJustUnder)).toBe(false)
  })

  it('classifies Đã giao as higher rank than Đang SX and Đang kiểm', () => {
    // rank 4 = Đã giao / Giao hàng (must be > IN_PROGRESS and INSPECTION ranks)
    expect(getProductionOrderStatusRank('Đã giao')).toBe(4)
    expect(getProductionOrderStatusRank('Giao hàng')).toBe(4)
    expect(getProductionOrderStatusRank('Đã giao')).toBeGreaterThan(getProductionOrderStatusRank('Đang SX'))
    expect(getProductionOrderStatusRank('Đã giao')).toBeGreaterThan(getProductionOrderStatusRank('Đang kiểm'))
  })

  // Reproducer cho bug TZ trên Vercel UTC: user nhập giờ VN, server validate phải hiểu là +07:00.
  it('treats production end time as Asia/Ho_Chi_Minh regardless of runtime timezone', () => {
    const validRow = {
      pdate: '2026-05-08',
      pcode: 'LSX-001',
      products: 'Product A',
      poutput: 1,
      eoutput: 0,
      routput: 0,
      workforce: 2,
      starttime: '08:00',
      endtime: '14:00',
    }
    // Bây giờ là 15:00 VN = 08:00Z. endtime 14:00 VN = 07:00Z → phải PASS.
    const nowVN15 = new Date('2026-05-08T15:00:00+07:00')
    expect(getProductionRowsValidationError([validRow], nowVN15)).toBeNull()

    // Edge: endtime 14:01 VN, now 14:00 VN → 1 phút trong tương lai → phải reject.
    const nowVN14 = new Date('2026-05-08T14:00:00+07:00')
    expect(getProductionRowsValidationError([{ ...validRow, endtime: '14:01' }], nowVN14))
      .toBe('Dòng 1: giờ kết thúc không được lớn hơn thời gian hiện tại theo ngày sản xuất.')
  })
})


