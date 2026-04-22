import { LoginForm } from '@/components/auth/login-form'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Đăng nhập | DMC Production Manager',
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f5f5f7] px-4">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2
                        w-[500px] h-[300px] rounded-full
                        bg-dmc-primary/6 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[380px] animate-in">

        {/* Brand mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center
                          w-[72px] h-[72px] rounded-[18px]
                          bg-white border border-[#d2d2d7]/60
                          shadow-apple-md mb-5 overflow-hidden">
            <Image
              src="/dmc-logo.png"
              alt="DMC"
              width={72}
              height={72}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <h1 className="text-[22px] font-semibold text-[#1d1d1f] tracking-[-0.02em]">
            DMC Production
          </h1>
          <p className="text-[13px] text-[#6e6e73] mt-1">
            Hệ thống quản lý sản xuất
          </p>
        </div>

        {/* Login card */}
        <div className="bg-white border border-[#d2d2d7]/60
                        rounded-[20px] px-6 py-7 shadow-apple-md">
          <LoginForm />
        </div>

        <p className="text-center text-[#aeaeb2] text-[11px] mt-6">
          DMC Production Manager &copy; {new Date().getFullYear()}
        </p>
      </div>
    </main>
  )
}
