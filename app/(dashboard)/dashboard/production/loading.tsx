export default function ProductionLoading() {
  return (
    <div className="h-full p-4 space-y-4 animate-pulse bg-[#f5f5f7]">
      {/* Header controls skeleton */}
      <div className="rounded-2xl bg-white border border-[#d2d2d7]/60 p-4 space-y-3
                      shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="h-3 w-40 rounded-full bg-[#e5e5ea]" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-2.5 w-20 rounded-full bg-[#e5e5ea]" />
              <div className="h-10 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/50" />
            </div>
          ))}
        </div>
      </div>

      {/* Product line cards skeleton */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-white border border-[#d2d2d7]/60 p-4 space-y-3
                                shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between">
            <div className="h-5 w-24 rounded-full bg-[#e5e5ea]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-9 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/50" />
            <div className="h-9 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/50" />
          </div>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-9 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/50" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
