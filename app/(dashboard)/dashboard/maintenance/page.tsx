import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Bảo Trì | DMC Production' }

export default function MaintenancePage() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-dmc-text-muted">
      <span className="text-5xl mb-4">🔧</span>
      <p className="text-lg font-semibold text-dmc-text-primary">Module Bảo Trì</p>
      <p className="text-sm mt-1">Đang phát triển...</p>
    </div>
  )
}
