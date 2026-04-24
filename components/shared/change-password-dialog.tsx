'use client'

import { useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  /** Returns error string on failure, null on success */
  onSubmit: (oldPass: string, newPass: string) => Promise<string | null>
}

export function ChangePasswordDialog({ open, onClose, onSubmit }: Props) {
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  function reset() {
    setOldPass('')
    setNewPass('')
    setConfirmPass('')
    setError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPass !== confirmPass) {
      setError('Mật khẩu mới không khớp')
      return
    }
    if (newPass.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự')
      return
    }

    setLoading(true)
    const err = await onSubmit(oldPass, newPass)
    setLoading(false)

    if (err) {
      setError(err)
    } else {
      reset()
      // parent will close the dialog on success
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-md bg-dmc-bg-card border border-dmc-border rounded-2xl p-6 shadow-2xl animate-in">
        <h2 className="text-lg font-semibold text-dmc-text-primary mb-5">🔑 Đổi mật khẩu</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Mật khẩu cũ', value: oldPass, onChange: setOldPass },
            { label: 'Mật khẩu mới (tối thiểu 6 ký tự)', value: newPass, onChange: setNewPass },
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

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
              <span className="text-red-400 text-sm leading-5">⚠️ {error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
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
