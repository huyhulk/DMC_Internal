'use client'

import { useState } from 'react'
import { Unlock } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  description: string
  onConfirm: (password: string) => boolean
  onClose: () => void
}

export function UnlockDialog({ open, title, description, onConfirm, onClose }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ok = onConfirm(password)
    if (ok) {
      setPassword('')
      setError('')
      onClose()
    } else {
      setError('Mật khẩu không chính xác!')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white border border-[#ff9500]/30
                      rounded-2xl p-6 shadow-apple-lg animate-in">
        <div className="flex items-center gap-2 mb-1">
          <Unlock size={16} className="text-[#b37700]" strokeWidth={2.5} />
          <h3 className="text-[15px] font-semibold text-[#b37700]">{title}</h3>
        </div>
        <p className="text-[13px] text-[#6e6e73] mb-4">{description}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu..."
            autoFocus
            className="w-full h-10 px-3 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]
                       text-[#1d1d1f] text-[13px]
                       focus:outline-none focus:ring-2 focus:ring-[#ff9500]/30 focus:border-[#ff9500]
                       transition-all"
          />
          {error && <p className="text-[12px] text-dmc-danger">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-[#d2d2d7]/70
                         text-[#6e6e73] text-[13px] font-medium
                         hover:bg-[#f2f2f7] transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 h-10 rounded-xl bg-[#ff9500] hover:bg-[#e67700]
                         text-white font-semibold text-[13px] transition-all"
            >
              Mở khóa
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
