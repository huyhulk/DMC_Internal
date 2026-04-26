'use client'

export function EnvironmentBanner() {
  if (process.env.NEXT_PUBLIC_ENV !== 'staging') return null

  return (
    <div className="sticky top-0 z-50 w-full bg-yellow-400 px-4 py-1.5 text-center text-sm font-semibold text-yellow-900">
      ⚠️ STAGING ENVIRONMENT — Đây là môi trường test, dữ liệu KHÔNG dùng trong sản xuất
    </div>
  )
}
