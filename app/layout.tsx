import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { EnvironmentBanner } from '@/components/shared/environment-banner'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DMC Production Manager',
  description: 'Hệ thống quản lý sản xuất DMC',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="dark">
      <body className={inter.className}>
        <EnvironmentBanner />
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          theme="dark"
          toastOptions={{
            style: {
              background: 'hsl(240 14% 11%)',
              border: '1px solid hsl(240 14% 20%)',
              color: 'hsl(240 10% 92%)',
            },
          }}
        />
      </body>
    </html>
  )
}
