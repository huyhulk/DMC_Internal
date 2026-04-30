'use client'

interface Props {
  rows?: number
  cols?: number
}

export function TableSkeleton({ rows = 5, cols = 6 }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#d2d2d7]/60">
      <table className="w-full text-sm">
        <thead className="bg-[#f5f5f7]">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="p-3">
                <div className="h-3 bg-[#d2d2d7] rounded animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-t border-[#d2d2d7]/40">
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="p-3">
                  <div className="h-3 bg-[#f2f2f7] rounded animate-pulse" style={{ width: `${60 + (c * 7) % 35}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
