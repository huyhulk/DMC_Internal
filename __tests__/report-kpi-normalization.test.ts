import { wsNormalize, productionCompletionTimestamp } from '@/lib/kpi/queries'
import { getOrderProductionDate, resolveReportWorkshop } from '@/lib/reports/report-queries'

describe('report workshop normalization', () => {
  it('does not count empty or unknown workshops as DMC1', () => {
    expect(resolveReportWorkshop('')).toBeNull()
    expect(resolveReportWorkshop('Kho vật tư')).toBeNull()
  })

  it('keeps current production workshop grouping', () => {
    expect(resolveReportWorkshop('Phân xưởng 1 - Tôn & Phụ kiện')).toBe('DMC1')
    expect(resolveReportWorkshop('Phân xưởng 2 - Tôn Pu & Phụ kiện')).toBe('DMC1')
    expect(resolveReportWorkshop('Phân xưởng 3 - Cửa')).toBe('DMC3')
    expect(resolveReportWorkshop('Phân xưởng 4')).toBe('DMC4')
    expect(resolveReportWorkshop('Phân xưởng 5')).toBe('DMC5')
  })
  it('uses actual Production.pdate for progress Ngày SX', () => {
    expect(getOrderProductionDate([
      { pdate: '2026-05-05', poutput: 0 },
      { pdate: '2026-05-06', poutput: 10 },
      { pdate: '2026-05-07', poutput: 5 },
    ])).toBe('2026-05-07')
  })
})

describe('production KPI normalization', () => {
  it('uses the shared workshop mapping instead of digit guessing', () => {
    expect(wsNormalize('Phân xưởng 2 - Tôn Pu & Phụ kiện')).toBe('DMC1')
    expect(wsNormalize('Kho 5')).toBe('')
  })

  it('builds completion timestamps with end time when available', () => {
    expect(productionCompletionTimestamp({
      pcode: 'A',
      poutput: 1,
      eoutput: 0,
      routput: 0,
      pdate: '2026-05-06',
      endtime: '15:31:00',
    })).toBe('2026-05-06T15:31:00')
  })

  it('falls back to end of production date when end time is missing', () => {
    expect(productionCompletionTimestamp({
      pcode: 'A',
      poutput: 1,
      eoutput: 0,
      routput: 0,
      pdate: '2026-05-06',
      endtime: null,
    })).toBe('2026-05-06T23:59:59')
  })
})
