'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function InstallAppPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as NavigatorWithStandalone).standalone === true

    setIsInstalled(standalone)
    setDismissed(window.localStorage.getItem('dmc-pwa-install-dismissed') === '1')

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    function handleAppInstalled() {
      setIsInstalled(true)
      setInstallPrompt(null)
      window.localStorage.setItem('dmc-pwa-install-dismissed', '1')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  if (isInstalled || dismissed || !installPrompt) return null

  async function handleInstall() {
    if (!installPrompt) return

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setInstallPrompt(null)
  }

  function handleDismiss() {
    setDismissed(true)
    window.localStorage.setItem('dmc-pwa-install-dismissed', '1')
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-[#d2d2d7]/70 bg-white/95 p-4 text-[#1d1d1f] shadow-apple-lg backdrop-blur-xl animate-slide-in-right">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-full p-1 text-[#6e6e73] transition-colors hover:bg-[#f2f2f7] hover:text-[#1d1d1f]"
        aria-label="Ẩn gợi ý cài đặt"
      >
        <X size={14} strokeWidth={2.2} />
      </button>

      <div className="flex gap-3 pr-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-dmc-primary/10 text-dmc-primary">
          <Download size={20} strokeWidth={2.4} />
        </div>
        <div className="space-y-1">
          <h2 className="text-[14px] font-semibold tracking-[-0.02em]">Cài đặt DMC Production</h2>
          <p className="text-[12px] leading-5 text-[#6e6e73]">
            Mở nhanh như ứng dụng riêng, hỗ trợ cache để truy cập ổn định hơn khi mạng yếu.
          </p>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-xl px-3 py-2 text-[13px] font-medium text-[#6e6e73] transition-colors hover:bg-[#f2f2f7] hover:text-[#1d1d1f]"
        >
          Để sau
        </button>
        <button
          type="button"
          onClick={handleInstall}
          className="rounded-xl bg-dmc-primary px-3 py-2 text-[13px] font-semibold text-white shadow-apple-sm transition-all hover:bg-dmc-primary-dark active:scale-[0.98]"
        >
          Cài đặt ứng dụng
        </button>
      </div>
    </div>
  )
}
