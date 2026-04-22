export default function ReportLoading() {
  return (
    <div className="h-full p-4 space-y-4 animate-pulse bg-[#f5f5f7] overflow-auto">
      {/* KPI cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white border border-[#d2d2d7]/60
                                  shadow-[0_1px_3px_rgba(0,0,0,0.06)]" />
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex gap-3">
        <div className="h-10 w-36 rounded-xl bg-white border border-[#d2d2d7]/60" />
        <div className="h-10 w-36 rounded-xl bg-white border border-[#d2d2d7]/60" />
        <div className="h-10 w-24 rounded-xl bg-[#e5e5ea]" />
      </div>

      {/* Chart placeholder */}
      <div className="h-64 rounded-2xl bg-white border border-[#d2d2d7]/60
                      shadow-[0_1px_3px_rgba(0,0,0,0.06)]" />

      {/* Table placeholder */}
      <div className="rounded-2xl bg-white border border-[#d2d2d7]/60 overflow-hidden
                      shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="h-10 bg-[#f2f2f7] border-b border-[#d2d2d7]/50" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 border-b border-[#d2d2d7]/40 last:border-0 px-4 flex items-center gap-3">
            <div className="h-3 w-20 rounded-full bg-[#e5e5ea]" />
            <div className="h-3 w-32 rounded-full bg-[#e5e5ea]" />
            <div className="h-3 w-16 rounded-full bg-[#e5e5ea]" />
          </div>
        ))}
      </div>
    </div>
  )
}
