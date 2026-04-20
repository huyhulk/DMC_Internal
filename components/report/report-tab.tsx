'use client'

import { useState } from 'react'
import { ProductionReport } from './production-report'

const MENUS = [
  { code: 'production',   label: '📈 Sản Xuất' },
  { code: 'maintenance',  label: '🔧 Bảo Trì' },
  { code: 'coordination', label: '🤝 Điều Phối' },
  { code: 'hr_hse',       label: '👷 Nhân Sự - An Toàn' },
] as const

type MenuCode = typeof MENUS[number]['code']

export function ReportTab() {
  const [active, setActive] = useState<MenuCode>('production')

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-48 lg:w-56 shrink-0 bg-dmc-bg-card border-r border-dmc-border flex flex-col">
        <div className="p-4 border-b border-dmc-border">
          <h2 className="text-sm font-bold text-dmc-primary">📊 BÁO CÁO</h2>
        </div>
        <nav className="p-2 space-y-1">
          {MENUS.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => setActive(code)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active === code
                  ? 'bg-dmc-primary text-white'
                  : 'text-dmc-text-primary hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden">
        {active === 'production' && <ProductionReport />}
        {active !== 'production' && <PlaceholderReport label={MENUS.find(m => m.code === active)!.label} />}
      </div>
    </div>
  )
}

function PlaceholderReport({ label }: { label: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-dmc-text-muted">
      <span className="text-5xl mb-4">🚧</span>
      <p className="text-base font-medium">{label}</p>
      <p className="text-sm mt-1">Đang được phát triển...</p>
    </div>
  )
}
