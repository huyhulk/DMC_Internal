'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { logoutAction, changePasswordAction } from '@/lib/actions/auth'
import { ROLE_TABS, type SessionUser } from '@/types'
import { ChangePasswordDialog } from '@/components/shared/change-password-dialog'

const TAB_CONFIG = {
  production:   { label: '🏭 Sản Xuất',   href: '/dashboard/production' },
  maintenance:  { label: '🔧 Bảo Trì',    href: '/dashboard/maintenance' },
  coordination: { label: '🤝 Phối Hợp',   href: '/dashboard/coordination' },
  report:       { label: '📊 Báo Cáo',    href: '/dashboard/report' },
} as const

interface Props {
  user: SessionUser
  children: React.ReactNode
}

export function DashboardShell({ user, children }: Props) {
  const pathname = usePathname()
  const [showChangePass, setShowChangePass] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const allowedTabs = ROLE_TABS[user.role]

  async function handleLogout() {
    setLoggingOut(true)
    await logoutAction()
  }

  async function handleChangePassword(oldPass: string, newPass: string) {
    const fd = new FormData()
    fd.append('oldPassword', oldPass)
    fd.append('newPassword', newPass)
    fd.append('confirmPassword', newPass)
    const result = await changePasswordAction(fd)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Đổi mật khẩu thành công!')
      setShowChangePass(false)
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-dmc-bg-dark">
      {/* ── NAVBAR ── */}
      <nav className="h-14 bg-dmc-bg-card border-b border-dmc-border flex items-center px-4 shrink-0 z-10">
        {/* Brand */}
        <div className="flex items-center gap-3 mr-auto">
          <div className="w-9 h-9 rounded-xl bg-dmc-primary flex items-center justify-center text-lg shadow-lg shadow-dmc-primary/20 shrink-0">
            🏭
          </div>
          <span className="font-bold text-dmc-text-primary hidden sm:block">DMC Production</span>
        </div>

        {/* User controls */}
        <div className="flex items-center gap-2">
          <span
            className="hidden sm:inline-flex text-xs font-medium px-2.5 py-1 rounded-full border"
            style={{
              background: '#252545',
              borderColor: '#3b5bdb44',
              color: '#748ffc',
            }}
          >
            {user.role}
          </span>
          <span className="text-sm text-dmc-text-secondary hidden sm:block">
            👤 {user.username}
          </span>

          <button
            onClick={() => setShowChangePass(true)}
            title="Đổi mật khẩu"
            className="w-9 h-9 rounded-lg border border-dmc-border text-dmc-text-muted hover:text-dmc-text-primary hover:border-dmc-text-muted transition-all text-sm"
          >
            🔑
          </button>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Đăng xuất"
            className="w-9 h-9 rounded-lg border border-red-800/50 text-red-400 hover:bg-red-900/20 transition-all text-sm disabled:opacity-60"
          >
            🚪
          </button>
        </div>
      </nav>

      {/* ── TAB BAR ── */}
      <div className="bg-dmc-bg-card border-b border-dmc-border flex overflow-x-auto shrink-0">
        {allowedTabs.map((tabKey) => {
          const cfg = TAB_CONFIG[tabKey]
          const active = pathname.startsWith(cfg.href)
          return (
            <Link
              key={tabKey}
              href={cfg.href}
              className={cn(
                'flex items-center gap-1.5 px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all duration-150',
                active
                  ? 'border-dmc-primary text-white bg-dmc-primary/10'
                  : 'border-transparent text-dmc-text-muted hover:text-dmc-text-primary hover:bg-white/5'
              )}
            >
              {cfg.label}
            </Link>
          )
        })}
      </div>

      {/* ── CONTENT ── */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={showChangePass}
        onClose={() => setShowChangePass(false)}
        onSubmit={handleChangePassword}
      />
    </div>
  )
}
