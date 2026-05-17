'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { User, Lock, ArrowRight } from 'lucide-react'
import { loginSchema, type LoginInput } from '@/modules/auth/validation'
import { loginAction } from '@/modules/auth/actions'

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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

      {/* Username */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-medium text-[#6e6e73] uppercase tracking-[0.06em]">
          Tên đăng nhập
        </label>
        <div className="relative">
          <User
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aeaeb2] pointer-events-none"
          />
          <input
            {...form.register('username')}
            type="text"
            autoComplete="username"
            placeholder="Nhập tên đăng nhập"
            className="apple-input pl-9"
          />
        </div>
        {form.formState.errors.username && (
          <p className="text-[12px] text-dmc-danger">
            {form.formState.errors.username.message}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-medium text-[#6e6e73] uppercase tracking-[0.06em]">
          Mật khẩu
        </label>
        <div className="relative">
          <Lock
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aeaeb2] pointer-events-none"
          />
          <input
            {...form.register('password')}
            type="password"
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            className="apple-input pl-9"
          />
        </div>
        {form.formState.errors.password && (
          <p className="text-[12px] text-dmc-danger">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 mt-2 rounded-xl
                   bg-dmc-primary hover:bg-dmc-primary-dark
                   text-white text-[14px] font-semibold
                   flex items-center justify-center gap-2
                   shadow-md shadow-dmc-primary/20
                   active:scale-[0.98] transition-all duration-150
                   disabled:opacity-50 disabled:cursor-not-allowed
                   pressable"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Đang đăng nhập…</span>
          </>
        ) : (
          <>
            <span>Đăng nhập</span>
            <ArrowRight size={15} strokeWidth={2.5} />
          </>
        )}
      </button>
    </form>
  )
}
