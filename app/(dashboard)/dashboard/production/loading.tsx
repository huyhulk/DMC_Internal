export default function ProductionLoading() {
  return (
    <div className="h-full p-4 space-y-4 animate-pulse">
      {/* Date + search bar skeleton */}
      <div className="flex gap-3">
        <div className="h-10 w-40 rounded-lg bg-[#1a1a2e]" />
        <div className="h-10 flex-1 rounded-lg bg-[#1a1a2e]" />
        <div className="h-10 w-28 rounded-lg bg-[#1a1a2e]" />
      </div>

      {/* Workshop / pcode selector skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <div className="h-10 rounded-lg bg-[#1a1a2e]" />
        <div className="h-10 rounded-lg bg-[#1a1a2e]" />
      </div>

      {/* Order info card skeleton */}
      <div className="rounded-xl border border-white/5 bg-[#1a1a2e] p-4 space-y-3">
        <div className="h-4 w-32 rounded bg-[#16213e]" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-[#16213e]" />
          ))}
        </div>
      </div>

      {/* Product line cards skeleton */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-white/5 bg-[#1a1a2e] p-4 space-y-3">
          <div className="h-4 w-24 rounded bg-[#16213e]" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-9 rounded bg-[#16213e]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
