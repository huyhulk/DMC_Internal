'use client'

import { useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Factory, Wrench, Users2, BarChart3,
  KeyRound, LogOut, ChevronDown,
  TrendingUp, ShieldCheck, Package2, ShieldAlert,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logoutAction, changePasswordAction } from '@/lib/actions/auth'
import { ROLE_TABS, ROLE_LABELS, type SessionUser } from '@/types'
import { ChangePasswordDialog } from '@/components/shared/change-password-dialog'

const TAB_CONFIG = {
  production:   { label: 'Sản Xuất',  icon: Factory,   href: '/dashboard/production' },
  maintenance:  { label: 'Bảo Trì',   icon: Wrench,    href: '/dashboard/maintenance' },
  coordination: { label: 'Phối Hợp',  icon: Users2,    href: '/dashboard/coordination' },
  report:       { label: 'Báo Cáo',   icon: BarChart3, href: '/dashboard/report' },
  admin:        { label: 'Hệ Thống',  icon: Settings,  href: '/dashboard/admin' },
} as const

const REPORT_ITEMS = [
  { code: 'production',   label: 'Sản Xuất',           icon: TrendingUp,  href: '/dashboard/report?sub=production' },
  { code: 'maintenance',  label: 'Bảo Trì',            icon: Wrench,      href: '/dashboard/report?sub=maintenance' },
  { code: 'coordination', label: 'Điều Phối',          icon: Users2,      href: '/dashboard/report?sub=coordination' },
  { code: 'hr_hse',       label: 'Nhân Sự & An Toàn',  icon: ShieldCheck, href: '/dashboard/report?sub=hr_hse' },
] as const

const COORDINATION_ITEMS = [
  { code: 'hr',  label: 'Nhân Sự',  icon: Users2,      href: '/dashboard/coordination?sub=hr' },
  { code: 'kho', label: 'Kho',      icon: Package2,    href: '/dashboard/coordination?sub=kho' },
  { code: 'hse', label: 'An Toàn',  icon: ShieldAlert, href: '/dashboard/coordination?sub=hse' },
] as const

const ROLE_COLOR: Record<string, string> = {
  ADMIN:      'text-[#3b5bdb] bg-[#3b5bdb]/10 border-[#3b5bdb]/25',
  MANAGER:    'text-[#2f9e44] bg-[#2f9e44]/10 border-[#2f9e44]/25',
  SUPERVISOR: 'text-[#d4870c] bg-[#d4870c]/10 border-[#d4870c]/25',
  USER:       'text-[#6e6e73] bg-[#6e6e73]/10 border-[#6e6e73]/20',
}

interface Props {
  user: SessionUser
  children: React.ReactNode
}

export function DashboardShell({ user, children }: Props) {
  const pathname = usePathname()
  const [showChangePass, setShowChangePass] = useState(false)
  const [loggingOut, setLoggingOut]         = useState(false)
  const [reportOpen, setReportOpen]         = useState(false)
  const [coordOpen, setCoordOpen]           = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const coordTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const allowedTabs = ROLE_TABS[user.role]

  function openDropdown() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setReportOpen(true)
  }

  function scheduleClose() {
    closeTimer.current = setTimeout(() => setReportOpen(false), 180)
  }

  function openCoordDropdown() {
    if (coordTimer.current) clearTimeout(coordTimer.current)
    setCoordOpen(true)
  }

  function scheduleCloseCoord() {
    coordTimer.current = setTimeout(() => setCoordOpen(false), 180)
  }

  async function handleLogout() {
    setLoggingOut(true)
    await logoutAction()
  }

  async function handleChangePassword(oldPass: string, newPass: string): Promise<string | null> {
    const fd = new FormData()
    fd.append('oldPassword', oldPass)
    fd.append('newPassword', newPass)
    fd.append('confirmPassword', newPass)
    const result = await changePasswordAction(fd)
    if (result.error) {
      return result.error
    }
    toast.success('Đổi mật khẩu thành công!')
    setShowChangePass(false)
    return null
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f5f5f7]">

      {/* ══════════════════════════════════════════
          HEADER — 3 columns: Logo | Tabs | User
      ══════════════════════════════════════════ */}
      <header className="h-[60px] shrink-0 sticky top-0 z-30
                         bg-white/90 backdrop-blur-xl
                         border-b border-[#d2d2d7]/60
                         shadow-[0_1px_4px_rgba(0,0,0,0.07)]
                         flex items-center gap-3 px-4">

        {/* ── Left: Logo + App name ── */}
        <div className="shrink-0 flex items-center gap-2.5">
          <div className="w-[36px] h-[36px] rounded-[10px] overflow-hidden
                          border border-[#d2d2d7]/60 shadow-sm shrink-0 bg-white">
            <Image
              src="/dmc-logo.png"
              alt="DMC"
              width={36}
              height={36}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <div className="hidden sm:flex flex-col leading-none gap-0.5">
            <span className="text-[14px] font-bold text-[#1d1d1f] tracking-[-0.02em]">
              DMC Production
            </span>
            <span className="text-[10px] text-[#aeaeb2] tracking-[0.02em] uppercase">
              Quản lý sản xuất
            </span>
          </div>
        </div>

        {/* ── Center: Tabs (relative for dropdown anchor) ── */}
        <div className="flex-1 relative flex items-center justify-center min-w-0">
          <div className="flex items-center gap-[3px]
                          bg-[#f2f2f7] rounded-[13px] p-[3px]
                          max-w-full overflow-x-auto scrollbar-none">
            {allowedTabs.map((tabKey) => {
              const cfg = TAB_CONFIG[tabKey]
              const active = pathname.startsWith(cfg.href)
              const Icon = cfg.icon

              /* Coordination tab — dropdown trigger */
              if (tabKey === 'coordination') {
                return (
                  <div
                    key="coordination"
                    onMouseEnter={openCoordDropdown}
                    onMouseLeave={scheduleCloseCoord}
                  >
                    <Link
                      href="/dashboard/coordination"
                      onClick={() => setCoordOpen(false)}
                      className={cn(
                        'flex items-center gap-[5px] px-3.5 py-[7px]',
                        'rounded-[10px] text-[13px] whitespace-nowrap',
                        'select-none transition-all duration-200 hover:scale-105',
                        active
                          ? 'bg-white text-dmc-primary font-semibold shadow-sm shadow-black/[0.08]'
                          : 'font-medium text-[#6e6e73] hover:text-[#1d1d1f] active:scale-[0.97]'
                      )}
                    >
                      <Icon size={13} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
                      <span>Phối Hợp</span>
                      <ChevronDown
                        size={10}
                        strokeWidth={2.5}
                        className={cn(
                          'transition-transform duration-200 shrink-0',
                          coordOpen ? 'rotate-180' : 'rotate-0'
                        )}
                      />
                    </Link>
                  </div>
                )
              }

              /* Report tab — dropdown trigger */
              if (tabKey === 'report') {
                return (
                  <div
                    key="report"
                    onMouseEnter={openDropdown}
                    onMouseLeave={scheduleClose}
                  >
                    <Link
                      href="/dashboard/report"
                      onClick={() => setReportOpen(false)}
                      className={cn(
                        'flex items-center gap-[5px] px-3.5 py-[7px]',
                        'rounded-[10px] text-[13px] whitespace-nowrap',
                        'select-none transition-all duration-200 hover:scale-105',
                        active
                          ? 'bg-white text-dmc-primary font-semibold shadow-sm shadow-black/[0.08]'
                          : 'font-medium text-[#6e6e73] hover:text-[#1d1d1f] active:scale-[0.97]'
                      )}
                    >
                      <Icon size={13} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
                      <span>Báo Cáo</span>
                      <ChevronDown
                        size={10}
                        strokeWidth={2.5}
                        className={cn(
                          'transition-transform duration-200 shrink-0',
                          reportOpen ? 'rotate-180' : 'rotate-0'
                        )}
                      />
                    </Link>
                  </div>
                )
              }

              /* Regular tab */
              return (
                <Link
                  key={tabKey}
                  href={cfg.href}
                  className={cn(
                    'flex items-center gap-[5px] px-3.5 py-[7px]',
                    'rounded-[10px] text-[13px] whitespace-nowrap',
                    'select-none transition-all duration-200 hover:scale-105',
                    active
                      ? 'bg-white text-dmc-primary font-semibold shadow-sm shadow-black/[0.08]'
                      : 'font-medium text-[#6e6e73] hover:text-[#1d1d1f] active:scale-[0.97]'
                  )}
                >
                  <Icon size={13} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
                  <span>{cfg.label}</span>
                </Link>
              )
            })}
          </div>

          {/* ── Coordination dropdown — anchored to center column bottom ── */}
          {allowedTabs.includes('coordination') && (
            <div
              onMouseEnter={openCoordDropdown}
              onMouseLeave={scheduleCloseCoord}
              className={cn(
                'absolute top-full mt-1.5 z-50',
                'left-1/2 -translate-x-1/2',
                'w-48',
                'bg-white/95 backdrop-blur-xl',
                'border border-[#d2d2d7]/70',
                'rounded-2xl shadow-apple-lg',
                'py-1.5 overflow-hidden',
                'transition-all duration-150 origin-top',
                coordOpen
                  ? 'opacity-100 scale-100 pointer-events-auto translate-y-0'
                  : 'opacity-0 scale-[0.97] pointer-events-none -translate-y-1'
              )}
            >
              <div className="px-3 pb-1.5 pt-1 border-b border-[#d2d2d7]/50 mb-1">
                <span className="text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.07em]">
                  Phối hợp
                </span>
              </div>

              {COORDINATION_ITEMS.map(({ code, label, icon: ItemIcon, href }) => {
                const isActiveSub = pathname.startsWith('/dashboard/coordination') && href.includes(`sub=${code}`)
                return (
                  <Link
                    key={code}
                    href={href}
                    onClick={() => setCoordOpen(false)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 mx-1 rounded-xl',
                      'text-[13px] font-medium transition-all duration-100',
                      isActiveSub
                        ? 'bg-dmc-primary/8 text-dmc-primary'
                        : 'text-[#1d1d1f] hover:bg-[#f2f2f7]'
                    )}
                  >
                    <ItemIcon size={14} strokeWidth={isActiveSub ? 2.5 : 2} className="shrink-0 text-[#6e6e73]" />
                    <span>{label}</span>
                  </Link>
                )
              })}
            </div>
          )}

          {/* ── Report dropdown — anchored to center column bottom ── */}
          {allowedTabs.includes('report') && (
            <div
              onMouseEnter={openDropdown}
              onMouseLeave={scheduleClose}
              className={cn(
                'absolute top-full mt-1.5 z-50',
                'left-1/2 -translate-x-1/2',
                'w-52',
                'bg-white/95 backdrop-blur-xl',
                'border border-[#d2d2d7]/70',
                'rounded-2xl shadow-apple-lg',
                'py-1.5 overflow-hidden',
                'transition-all duration-150 origin-top',
                reportOpen
                  ? 'opacity-100 scale-100 pointer-events-auto translate-y-0'
                  : 'opacity-0 scale-[0.97] pointer-events-none -translate-y-1'
              )}
            >
              {/* Dropdown header label */}
              <div className="px-3 pb-1.5 pt-1 border-b border-[#d2d2d7]/50 mb-1">
                <span className="text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.07em]">
                  Báo cáo
                </span>
              </div>

              {REPORT_ITEMS.map(({ code, label, icon: ItemIcon, href }) => {
                const isActiveSub = pathname.startsWith('/dashboard/report') &&
                  (code === 'production' ? !pathname.includes('?') || href.includes('production') : href.includes(code))
                return (
                  <Link
                    key={code}
                    href={href}
                    onClick={() => setReportOpen(false)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 mx-1 rounded-xl',
                      'text-[13px] font-medium transition-all duration-100',
                      isActiveSub
                        ? 'bg-dmc-primary/8 text-dmc-primary'
                        : 'text-[#1d1d1f] hover:bg-[#f2f2f7]'
                    )}
                  >
                    <ItemIcon size={14} strokeWidth={isActiveSub ? 2.5 : 2} className="shrink-0 text-[#6e6e73]" />
                    <span>{label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Right: User info ── */}
        <div className="shrink-0 flex items-center justify-end gap-1.5">
          <span className={cn(
            'hidden sm:inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full border tracking-wide',
            ROLE_COLOR[user.role] ?? ROLE_COLOR.USER
          )}>
            {ROLE_LABELS[user.role] ?? user.role}
          </span>

          <span className="text-[13px] text-[#6e6e73] hidden md:block px-1">
            {user.username}
          </span>

          <div className="w-px h-4 bg-[#d2d2d7] mx-1 hidden sm:block" />

          <button
            onClick={() => setShowChangePass(true)}
            title="Đổi mật khẩu"
            className="w-8 h-8 rounded-[8px] flex items-center justify-center
                       text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#f2f2f7]
                       active:scale-95 transition-all duration-150"
          >
            <KeyRound size={15} strokeWidth={2} />
          </button>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Đăng xuất"
            className="w-8 h-8 rounded-[8px] flex items-center justify-center
                       text-[#ff3b30] hover:bg-[#ff3b30]/10
                       active:scale-95 transition-all duration-150
                       disabled:opacity-40"
          >
            {loggingOut
              ? <span className="w-3.5 h-3.5 border-2 border-[#ff3b30]/30 border-t-[#ff3b30] rounded-full animate-spin" />
              : <LogOut size={15} strokeWidth={2} />}
          </button>
        </div>
      </header>

      {/* ══════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════ */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      <ChangePasswordDialog
        open={showChangePass}
        onClose={() => setShowChangePass(false)}
        onSubmit={handleChangePassword}
      />
    </div>
  )
}
