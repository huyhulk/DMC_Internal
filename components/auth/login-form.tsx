'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { loginAction } from '@/lib/actions/auth'

export function LoginForm() {
  const [loading, setLoading] = useState(false)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  async function onSubmit(values: LoginInput) {
    setLoading(true)
    const fd = new FormData()
    fd.append('username', values.username)
    fd.append('password', values.password)

    const result = await loginAction(fd)
    if (result?.error) {
      toast.error(result.error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-dmc-text-secondary uppercase tracking-wide">
          Tên đăng nhập
        </label>
        <input
          {...form.register('username')}
          type="text"
          autoComplete="username"
          placeholder="Nhập tên đăng nhập..."
          className="w-full h-11 px-4 rounded-lg bg-dmc-bg-input border border-dmc-border text-dmc-text-primary placeholder:text-dmc-text-muted focus:outline-none focus:ring-2 focus:ring-dmc-primary/50 focus:border-dmc-primary transition-all text-sm"
        />
        {form.formState.errors.username && (
          <p className="text-xs text-red-400">{form.formState.errors.username.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-dmc-text-secondary uppercase tracking-wide">
          Mật khẩu
        </label>
        <input
          {...form.register('password')}
          type="password"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu..."
          className="w-full h-11 px-4 rounded-lg bg-dmc-bg-input border border-dmc-border text-dmc-text-primary placeholder:text-dmc-text-muted focus:outline-none focus:ring-2 focus:ring-dmc-primary/50 focus:border-dmc-primary transition-all text-sm"
        />
        {form.formState.errors.password && (
          <p className="text-xs text-red-400">{form.formState.errors.password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 rounded-lg bg-dmc-primary hover:bg-dmc-primary-dark text-white font-semibold text-sm transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Đang đăng nhập...
          </>
        ) : (
          '🔑 Đăng nhập'
        )}
      </button>
    </form>
  )
}
