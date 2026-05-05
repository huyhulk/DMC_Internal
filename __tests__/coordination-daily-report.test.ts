import {
  calculateCompletion,
  calculateEfficiencyPct,
  groupDailyRows,
  makeDailyReportTitles,
  resolveDailyReportWorkshop,
  type DailyPlanReportRow,
  type DailyReportWorkshop,
  type DailyResultReportRow,
} from '@/lib/coordination/daily-report'

describe('coordination daily report helpers', () => {
  it('maps production workshops using current DMC grouping', () => {
    expect(resolveDailyReportWorkshop('Phân xưởng 1 - Tôn & Phụ kiện')).toBe('DMC1')
    expect(resolveDailyReportWorkshop('Phân xưởng 2 - Tôn Pu & Phụ kiện')).toBe('DMC1')
    expect(resolveDailyReportWorkshop('Phân xưởng 3 - Cửa')).toBe('DMC3')
    expect(resolveDailyReportWorkshop('Phân xưởng 4')).toBe('DMC4')
    expect(resolveDailyReportWorkshop('Phân xưởng 5')).toBe('DMC5')
  })

  it('calculates remaining quantity and completion percentage', () => {
    expect(calculateCompletion(100, 40)).toEqual({ remaining: 60, completionPct: 40 })
    expect(calculateCompletion(100, 140)).toEqual({ remaining: 0, completionPct: 100 })
  })

  it('calculates production efficiency from realnorm over norm', () => {
    expect(calculateEfficiencyPct(80, 100)).toBe(80)
    expect(calculateEfficiencyPct(91.25, 100)).toBe(91.3)
    expect(calculateEfficiencyPct(50, 0)).toBe(0)
  })

  it('groups rows and summarizes totals by workshop', () => {
    const rows = new Map<DailyReportWorkshop, DailyPlanReportRow[]>([
      ['DMC1', [
        { stt: 1, pcode: 'A', initialDate: '', customer: '', description: '', quantity: 10, deadline: '', completionPct: 0, productionPlan: '' },
        { stt: 2, pcode: 'B', initialDate: '', customer: '', description: '', quantity: 20, deadline: '', completionPct: 0, productionPlan: '' },
      ]],
      ['DMC3', []],
      ['DMC4', []],
      ['DMC5', []],
    ])

    const sections = groupDailyRows(rows)
    expect(sections[0].workshop).toBe('DMC1')
    expect(sections[0].summary).toEqual({ orderCount: 2, failedCount: 0, totalQuantity: 30 })
  })

  it('summarizes result rows with failed progress count', () => {
    const rows = new Map<DailyReportWorkshop, DailyResultReportRow[]>([
      ['DMC1', [
        { stt: 1, pcode: 'A', customer: '', description: '', quantity: 10, completionTime: '', efficiencyPct: 80, progress: 'ĐẠT' },
        { stt: 2, pcode: 'B', customer: '', description: '', quantity: 5, completionTime: '', efficiencyPct: 60, progress: 'KHÔNG ĐẠT' },
      ]],
      ['DMC3', []],
      ['DMC4', []],
      ['DMC5', []],
    ])

    const sections = groupDailyRows(rows)
    expect(sections[0].summary).toEqual({ orderCount: 2, failedCount: 1, totalQuantity: 15 })
  })

  it('builds plan title from the next day and result title from report date', () => {
    expect(makeDailyReportTitles('2026-05-05')).toEqual({
      planDate: '2026-05-06',
      planTitle: 'KẾ HOẠCH SẢN XUẤT NGÀY: 06/05/2026',
      resultTitle: 'KẾT QUẢ SẢN XUẤT NGÀY 05/05/2026',
    })
  })
})
