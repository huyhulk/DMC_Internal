import { getReportPeriodRange } from '@/lib/reports/report-period'

describe('getReportPeriodRange', () => {
  it('keeps custom range for day grouping', () => {
    expect(getReportPeriodRange('day', '2026-05-13', '2026-05-01', '2026-05-03')).toEqual({
      from: '2026-05-01',
      to: '2026-05-03',
    })
  })

  it('keeps custom range for hour grouping', () => {
    expect(getReportPeriodRange('hour', '2026-05-13', '2026-05-01', '2026-05-03')).toEqual({
      from: '2026-05-01',
      to: '2026-05-03',
    })
  })

  it('returns Friday to Thursday for week grouping', () => {
    expect(getReportPeriodRange('week', '2026-05-13', '2026-05-01', '2026-05-03')).toEqual({
      from: '2026-05-08',
      to: '2026-05-14',
    })
  })

  it('keeps Thursday in the Friday-based report week', () => {
    expect(getReportPeriodRange('week', '2026-05-14', '2026-05-01', '2026-05-03')).toEqual({
      from: '2026-05-08',
      to: '2026-05-14',
    })
  })

  it('starts a new report week on Friday', () => {
    expect(getReportPeriodRange('week', '2026-05-15', '2026-05-01', '2026-05-03')).toEqual({
      from: '2026-05-15',
      to: '2026-05-21',
    })
  })

  it('returns month start and end for month grouping', () => {
    expect(getReportPeriodRange('month', '2026-05-13', '2026-05-01', '2026-05-03')).toEqual({
      from: '2026-05-01',
      to: '2026-05-31',
    })
  })

  it('handles leap-year February for month grouping', () => {
    expect(getReportPeriodRange('month', '2024-02-10', '2026-05-01', '2026-05-03')).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    })
  })

  it('returns year start and end for year grouping', () => {
    expect(getReportPeriodRange('year', '2026-05-13', '2026-05-01', '2026-05-03')).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    })
  })
})
