import { ReportTab } from '@/components/report/report-tab'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Báo Cáo | DMC Production' }

export default function ReportPage() {
  return (
    <div className="h-full overflow-hidden">
      <ReportTab />
    </div>
  )
}
