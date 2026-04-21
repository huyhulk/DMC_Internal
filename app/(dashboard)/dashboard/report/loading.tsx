export default function ReportLoading() {
  return (
    <div className="h-full flex animate-pulse">
      {/* Sidebar skeleton */}
      <div className="w-48 shrink-0 border-r border-white/5 bg-[#1a1a2e] p-3 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 rounded-lg bg-[#16213e]" />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {/* KPI cards row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-[#1a1a2e]" />
          ))}
        </div>

        {/* Date filter bar */}
        <div className="flex gap-3">
          <div className="h-10 w-36 rounded-lg bg-[#1a1a2e]" />
          <div className="h-10 w-36 rounded-lg bg-[#1a1a2e]" />
          <div className="h-10 w-24 rounded-lg bg-[#1a1a2e]" />
        </div>

        {/* Chart placeholder */}
        <div className="h-64 rounded-xl bg-[#1a1a2e]" />

        {/* Table placeholder */}
        <div className="rounded-xl bg-[#1a1a2e] overflow-hidden">
          <div className="h-10 bg-[#16213e]" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 border-t border-white/5 px-4 flex items-center gap-3">
              <div className="h-4 w-20 rounded bg-[#16213e]" />
              <div className="h-4 w-32 rounded bg-[#16213e]" />
              <div className="h-4 w-16 rounded bg-[#16213e]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
