import { LoginForm } from '@/components/auth/login-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Đăng nhập | DMC Production Manager',
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-dmc-bg-dark px-4">
      <div className="w-full max-w-md animate-in">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-dmc-primary mb-4 shadow-lg shadow-dmc-primary/20">
            <span className="text-3xl">🏭</span>
          </div>
          <h1 className="text-2xl font-bold text-dmc-text-primary">DMC Production</h1>
          <p className="text-dmc-text-muted text-sm mt-1">Hệ thống quản lý sản xuất</p>
        </div>

        {/* Login Card */}
        <div className="bg-dmc-bg-card border border-dmc-border rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-dmc-text-primary mb-6">Đăng nhập</h2>
          <LoginForm />
        </div>

        <p className="text-center text-dmc-text-muted text-xs mt-6">
          DMC Production Manager &copy; {new Date().getFullYear()}
        </p>
      </div>
    </main>
  )
}
