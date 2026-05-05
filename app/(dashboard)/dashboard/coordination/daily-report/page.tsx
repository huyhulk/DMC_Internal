import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/actions/auth'
import { getDailyProductionReportData, isValidReportDate, type DailyPlanReportRow, type DailyResultReportRow, type DailyReportType } from '@/lib/coordination/daily-report'
import { requireTabView } from '@/lib/permissions/server'
import { getTodayLocal } from '@/lib/utils'
import { PrintButton } from './print-button'

export const metadata: Metadata = { title: 'Báo cáo ngày | DMC Production' }

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value)
}

function typeParam(value: string | undefined): DailyReportType {
  return value === 'plan' || value === 'result' || value === 'both' ? value : 'both'
}

function EmptyRows({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="border border-slate-300 px-3 py-6 text-center text-slate-500">
        Không có dữ liệu cho ngày đã chọn
      </td>
    </tr>
  )
}

function PlanReport({ data }: { data: Awaited<ReturnType<typeof getDailyProductionReportData>> }) {
  return (
    <section className="report-section">
      <h1>{data.planTitle}</h1>
      {data.planSections.map((section) => (
        <div key={section.workshop} className="workshop-block">
          <h2>{section.workshop}</h2>
          <table>
            <thead>
              <tr>
                <th>STT</th>
                <th>LỆNH SẢN XUẤT</th>
                <th>NGÀY TẠO PHIẾU</th>
                <th>KHÁCH HÀNG</th>
                <th>DIỄN GIẢI</th>
                <th>SẢN LƯỢNG</th>
                <th>NVKD</th>
                <th>DỰ KIẾN HT</th>
                <th>% HT</th>
                <th>KẾ HOẠCH SẢN XUẤT</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.length === 0 ? <EmptyRows colSpan={10} /> : section.rows.map((row: DailyPlanReportRow) => (
                <tr key={`${section.workshop}-${row.pcode}-${row.stt}`}>
                  <td className="center">{row.stt}</td>
                  <td className="nowrap">{row.pcode}</td>
                  <td className="center nowrap">{row.initialDate}</td>
                  <td>{row.customer}</td>
                  <td>{row.description}</td>
                  <td className="number">{formatNumber(row.quantity)}</td>
                  <td>{row.salesperson}</td>
                  <td className="center nowrap">{row.deadline}</td>
                  <td className="number">{formatNumber(row.completionPct)}%</td>
                  <td>{row.productionPlan}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={5}>TỔNG CỘNG {section.workshop}</td>
                <td className="number">{formatNumber(section.summary.totalQuantity)}</td>
                <td colSpan={4}>Tổng đơn: {section.summary.orderCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
      <div className="grand-total">TỔNG TOÀN BỘ KHSX: {formatNumber(data.planTotal.totalQuantity)} | Tổng đơn: {data.planTotal.orderCount}</div>
    </section>
  )
}

function ResultReport({ data }: { data: Awaited<ReturnType<typeof getDailyProductionReportData>> }) {
  return (
    <section className="report-section page-break">
      <h1>{data.resultTitle}</h1>
      {data.resultSections.map((section) => (
        <div key={section.workshop} className="workshop-block">
          <h2>{section.workshop}</h2>
          <table>
            <thead>
              <tr>
                <th>STT</th>
                <th>LỆNH SẢN XUẤT</th>
                <th>KHÁCH HÀNG</th>
                <th>DIỄN GIẢI</th>
                <th>SẢN LƯỢNG</th>
                <th>THỜI GIAN HOÀN THÀNH</th>
                <th>HIỆU SUẤT SẢN XUẤT</th>
                <th>ĐÁNH GIÁ TIẾN ĐỘ</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.length === 0 ? <EmptyRows colSpan={8} /> : section.rows.map((row: DailyResultReportRow) => (
                <tr key={`${section.workshop}-${row.pcode}-${row.stt}`}>
                  <td className="center">{row.stt}</td>
                  <td className="nowrap">{row.pcode}</td>
                  <td>{row.customer}</td>
                  <td>{row.description}</td>
                  <td className="number">{formatNumber(row.quantity)}</td>
                  <td className="center nowrap">{row.completionTime}</td>
                  <td className="number">{formatNumber(row.efficiencyPct)}%</td>
                  <td className="center">
                    <span className={row.progress === 'ĐẠT' ? 'badge pass' : 'badge fail'}>{row.progress}</span>
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={4}>TỔNG {section.workshop}</td>
                <td className="number">{formatNumber(section.summary.totalQuantity)}</td>
                <td colSpan={3}>Tổng đơn: {section.summary.orderCount} | Không đạt: {section.summary.failedCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
      <div className="grand-total">
        TỔNG TOÀN BỘ KQSX: {formatNumber(data.resultTotal.totalQuantity)} | Tổng đơn: {data.resultTotal.orderCount} | Không đạt: {data.resultTotal.failedCount}
      </div>
    </section>
  )
}

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; type?: string }>
}) {
  const [user, params] = await Promise.all([requireTabView('coordination.reports'), searchParams])
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }

  const date = params.date && isValidReportDate(params.date) ? params.date : getTodayLocal()
  const type = typeParam(params.type)
  const data = await getDailyProductionReportData(date)

  return (
    <main>
      <div className="toolbar no-print">
        <Link href="/dashboard/coordination?sub=reports">← Quay lại Báo cáo thống kê</Link>
        <div className="toolbar-actions">
          <span>Ngày báo cáo: {date}</span>
          <PrintButton />
        </div>
      </div>

      {(type === 'both' || type === 'plan') && <PlanReport data={data} />}
      {(type === 'both' || type === 'result') && <ResultReport data={data} />}

      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; }
        body { background: #f8fafc; }
        main { font-family: "Noto Sans", Roboto, Arial, sans-serif; color: #0f172a; padding: 16px; }
        .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; padding: 12px 16px; background: white; border: 1px solid #dbe3ef; border-radius: 14px; }
        .toolbar a { color: #0f766e; font-weight: 700; text-decoration: none; }
        .toolbar-actions { display: flex; align-items: center; gap: 12px; color: #475569; font-size: 13px; }
        button { border: 0; border-radius: 10px; background: #0f766e; color: white; padding: 9px 14px; font-weight: 700; cursor: pointer; }
        .report-section { background: white; border: 1px solid #dbe3ef; border-radius: 18px; padding: 18px; margin-bottom: 18px; }
        h1 { text-align: center; font-size: 22px; margin: 0 0 18px; font-weight: 800; letter-spacing: .01em; }
        h2 { font-size: 15px; margin: 18px 0 8px; padding: 8px 10px; border-left: 5px solid #0f766e; background: #ecfdf5; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }
        th, td { border: 1px solid #94a3b8; padding: 6px 7px; vertical-align: middle; }
        th { background: #dbeafe; text-align: center; font-weight: 800; color: #0f172a; }
        td { line-height: 1.35; }
        .center { text-align: center; }
        .number { text-align: right; white-space: nowrap; }
        .nowrap { white-space: nowrap; }
        .total-row td { background: #fef3c7; font-weight: 800; }
        .grand-total { margin-top: 12px; padding: 10px 12px; background: #e0f2fe; border: 1px solid #7dd3fc; border-radius: 10px; font-weight: 800; text-align: right; }
        .badge { display: inline-block; min-width: 72px; padding: 3px 7px; border-radius: 999px; font-weight: 800; font-size: 10px; }
        .badge.pass { background: #dcfce7; color: #166534; }
        .badge.fail { background: #fee2e2; color: #991b1b; }
        @media print {
          body { background: white; }
          main { padding: 0; }
          .no-print { display: none; }
          .report-section { border: 0; padding: 0; margin: 0 0 12px; }
          .page-break { break-before: page; }
          h1 { font-size: 18px; }
          h2 { break-after: avoid; }
          table { break-inside: auto; }
          tr { break-inside: avoid; break-after: auto; }
        }
      `}</style>
    </main>
  )
}
