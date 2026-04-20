'use client'

import { useState } from 'react'

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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-dmc-bg-card border border-yellow-700/50 rounded-2xl p-6 shadow-2xl animate-in">
        <h3 className="text-base font-semibold text-yellow-400 mb-1">🔓 {title}</h3>
        <p className="text-sm text-dmc-text-muted mb-4">{description}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu..."
            autoFocus
            className="w-full h-10 px-3 rounded-lg bg-dmc-bg-input border border-dmc-border text-dmc-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-lg border border-dmc-border text-dmc-text-muted text-sm hover:text-dmc-text-primary transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 h-10 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white font-semibold text-sm transition-all"
            >
              Mở khóa
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
