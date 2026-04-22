import { Package2, ShieldAlert, Construction, type LucideIcon } from 'lucide-react'

interface Props {
  sub: string
}

const SUB_META: Record<string, { label: string; Icon: LucideIcon }> = {
  warehouse: { label: 'Kho',      Icon: Package2    },
  kho:       { label: 'Kho',      Icon: Package2    },
  hse:       { label: 'An Toàn',  Icon: ShieldAlert },
}

export function CoordinationPlaceholder({ sub }: Props) {
  const meta = SUB_META[sub.toLowerCase()] ?? { label: sub, Icon: Construction }
  const { label, Icon } = meta

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-[#aeaeb2]
                    bg-[#f5f5f7]">
      <div
        className="w-16 h-16 rounded-[20px] bg-white border border-[#d2d2d7]/60
                   flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
      >
        <Icon size={28} className="text-[#d2d2d7]" strokeWidth={1.5} />
      </div>

      <div className="text-center space-y-1">
        <p className="text-[15px] font-semibold text-[#1d1d1f]">{label}</p>
        <p className="text-[13px] text-[#6e6e73]">Đang được phát triển</p>
      </div>
    </div>
  )
}
