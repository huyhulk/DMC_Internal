'use client'

import { useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (oldPass: string, newPass: string) => Promise<void>
}

export function ChangePasswordDialog({ open, onClose, onSubmit }: Props) {
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPass !== confirmPass) {
      setError('Mật khẩu mới không khớp')
      return
    }
    if (newPass.length < 3) {
      setError('Mật khẩu mới phải có ít nhất 3 ký tự')
      return
    }
    setLoading(true)
    try {
      await onSubmit(oldPass, newPass)
      setOldPass('')
      setNewPass('')
      setConfirmPass('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-dmc-bg-card border border-dmc-border rounded-2xl p-6 shadow-2xl animate-in">
        <h2 className="text-lg font-semibold text-dmc-text-primary mb-5">🔑 Đổi mật khẩu</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Mật khẩu cũ', value: oldPass, onChange: setOldPass },
            { label: 'Mật khẩu mới', value: newPass, onChange: setNewPass },
            { label: 'Xác nhận mật khẩu mới', value: confirmPass, onChange: setConfirmPass },
          ].map(({ label, value, onChange }) => (
            <div key={label} className="space-y-1">
              <label className="text-xs font-semibold text-dmc-text-secondary">{label}</label>
              <input
                type="password"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-lg bg-dmc-bg-input border border-dmc-border text-dmc-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-dmc-primary/50 focus:border-dmc-primary transition-all"
              />
            </div>
          ))}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-lg border border-dmc-border text-dmc-text-muted hover:text-dmc-text-primary text-sm transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 rounded-lg bg-dmc-primary hover:bg-dmc-primary-dark text-white font-semibold text-sm transition-all disabled:opacity-60"
            >
              {loading ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
