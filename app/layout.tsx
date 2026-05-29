import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { EnvironmentBanner } from '@/components/shared/environment-banner'
import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'DMC Production Manager',
    template: '%s | DMC Production Manager',
  },
  description: 'Hệ thống quản lý sản xuất DMC',
  applicationName: 'DMC Production Manager',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DMC Production',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#f5f5f7',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="dark">
      <body className={inter.className}>
        <EnvironmentBanner />
        <ServiceWorkerRegistration />
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
