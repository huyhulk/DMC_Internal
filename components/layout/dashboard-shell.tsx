'use client'

import { useState, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Factory, Wrench, Users2, BarChart3,
  KeyRound, LogOut, ChevronDown,
  TrendingUp, ShieldCheck,
  Settings, Target, Clock, UserCog, SlidersHorizontal,
  Truck, ListChecks, FileText, BookCheck,
  AlertTriangle, CalendarClock, FileImage, Ruler, ClipboardList,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logoutAction, changePasswordAction } from '@/lib/actions/auth'
import { ROLE_LABELS, type SessionUser, type TabId } from '@/types'
import type { PermissionKey } from '@/lib/permissions/tabs'
import { ChangePasswordDialog } from '@/components/shared/change-password-dialog'
import { ApprovalNotificationBell } from '@/components/layout/approval-notification-bell'
import {
  getAdministrationTabs,
  getCoordinationTabs,
  getMaintenanceTabs,
  resolveAdministrationSub,
  resolveCoordinationSub,
  resolveMaintenanceSub,
  type AdministrationTabKey,
  type CoordinationTabKey,
  type MaintenanceTabKey,
} from '@/lib/navigation/dashboard'

const TAB_CONFIG = {
  production:   { label: 'Sản Xuất',  icon: Factory,   href: '/dashboard/production' },
  maintenance:  { label: 'Bảo Trì',   icon: Wrench,    href: '/dashboard/maintenance' },
  coordination: { label: 'Điều Phối',  icon: Users2,    href: '/dashboard/coordination' },
  administration: { label: 'Hành Chính NS', icon: ClipboardList, href: '/dashboard/administration' },
  report:       { label: 'Báo Cáo',   icon: BarChart3, href: '/dashboard/report' },
  admin:        { label: 'Hệ Thống',  icon: Settings,  href: '/dashboard/admin' },
} as const

const REPORT_ITEMS = [
  { code: 'production',   label: 'Sản Xuất',           icon: TrendingUp,  href: '/dashboard/report?sub=production' },
  { code: 'maintenance',  label: 'Bảo Trì',            icon: Wrench,      href: '/dashboard/report?sub=maintenance' },
  { code: 'coordination', label: 'Điều Phối',          icon: Users2,      href: '/dashboard/report?sub=coordination' },
  { code: 'hr_hse',       label: 'Nhân Sự & An Toàn',  icon: ShieldCheck, href: '/dashboard/report?sub=hr_hse' },
  { code: 'kpi',          label: 'KPI',                 icon: Target,      href: '/dashboard/report/kpi' },
  { code: 'overtime',     label: 'Tăng Ca',             icon: Clock,       href: '/dashboard/report/overtime' },
] as const

const COORDINATION_ICONS: Record<CoordinationTabKey, LucideIcon> = {
  delivery:   Truck,
  findings5s: ListChecks,
  reports:    FileText,
}

const COORDINATION_ITEMS = getCoordinationTabs().map((item) => ({
  ...item,
  code: item.key,
  icon: COORDINATION_ICONS[item.key],
}))

const MAINTENANCE_ICONS: Record<MaintenanceTabKey, LucideIcon> = {
  breakdowns: AlertTriangle,
  schedule:   CalendarClock,
  drawings:   FileImage,
  surveys:    Ruler,
  machines:   Wrench,
}

const MAINTENANCE_ITEMS = getMaintenanceTabs().map((item) => ({
  ...item,
  code: item.key,
  icon: MAINTENANCE_ICONS[item.key],
}))

const ADMINISTRATION_ICONS: Record<AdministrationTabKey, LucideIcon> = {
  overtime:   Clock,
  hr:         Users2,
  findings5s: ListChecks,
  iso:        BookCheck,
}

const ADMINISTRATION_ITEMS = getAdministrationTabs().map((item) => ({
  ...item,
  code: item.key,
  icon: ADMINISTRATION_ICONS[item.key],
}))

const ADMIN_ITEMS = [
  { code: 'users',        label: 'Quản lý người dùng', icon: UserCog,           href: '/dashboard/admin', permissionKey: 'admin.users' as PermissionKey },
  { code: 'permissions',  label: 'Phân quyền tab',     icon: ShieldCheck,       href: '/dashboard/admin?sub=permissions', permissionKey: undefined },
  { code: 'kpi-settings', label: 'Cài đặt KPI',         icon: SlidersHorizontal, href: '/dashboard/admin/kpi-settings', permissionKey: 'admin.kpi-settings' as PermissionKey },
] as const

const ROLE_COLOR: Record<string, string> = {
  ADMIN: 'text-[#3b5bdb] bg-[#3b5bdb]/10 border-[#3b5bdb]/25',
  MANAGER: 'text-[#2f9e44] bg-[#2f9e44]/10 border-[#2f9e44]/25',
  WORKSHOP_MANAGER: 'text-[#0b7285] bg-[#0b7285]/10 border-[#0b7285]/25',
  TEAM_LEADER: 'text-[#d4870c] bg-[#d4870c]/10 border-[#d4870c]/25',
  MAINTENANCE: 'text-[#7048e8] bg-[#7048e8]/10 border-[#7048e8]/25',
  COORDINATION: 'text-[#0c8599] bg-[#0c8599]/10 border-[#0c8599]/25',
  SALES: 'text-[#c2255c] bg-[#c2255c]/10 border-[#c2255c]/25',
  HR: 'text-[#5c7cfa] bg-[#5c7cfa]/10 border-[#5c7cfa]/25',
}

interface Props {
  user: SessionUser
  visibleTabs: TabId[]
  visiblePermissionKeys: PermissionKey[]
  children: React.ReactNode
}

export function DashboardShell({ user, visibleTabs, visiblePermissionKeys, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showChangePass, setShowChangePass]   = useState(false)
  const [loggingOut, setLoggingOut]           = useState(false)
  const [reportOpen, setReportOpen]           = useState(false)
  const [coordOpen, setCoordOpen]             = useState(false)
  const [administrationOpen, setAdministrationOpen] = useState(false)
  const [adminOpen, setAdminOpen]             = useState(false)
  const [maintOpen, setMaintOpen]             = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const coordTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const administrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const adminTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const allowedTabs = visibleTabs
  const requestedSub = searchParams.get('sub')
  const activeCoordinationSub = resolveCoordinationSub(requestedSub)
  const activeMaintenanceSub = resolveMaintenanceSub(requestedSub)
  const activeAdministrationSub = resolveAdministrationSub(requestedSub)
  const visiblePermissionSet = new Set(visiblePermissionKeys)
  const maintenanceItems = MAINTENANCE_ITEMS.filter((item) => visiblePermissionSet.has(`maintenance.${item.code}` as PermissionKey))
  const coordinationItems = COORDINATION_ITEMS.filter((item) => visiblePermissionSet.has(`coordination.${item.code}` as PermissionKey))
  const administrationItems = ADMINISTRATION_ITEMS.filter((item) => visiblePermissionSet.has(`administration.${item.code}` as PermissionKey))
  const adminItems = ADMIN_ITEMS.filter((item) => item.permissionKey ? visiblePermissionSet.has(item.permissionKey) : user.role === 'ADMIN' && visiblePermissionSet.has('admin'))

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

  function openAdministrationDropdown() {
    if (administrationTimer.current) clearTimeout(administrationTimer.current)
    setAdministrationOpen(true)
  }

  function scheduleCloseAdministration() {
    administrationTimer.current = setTimeout(() => setAdministrationOpen(false), 180)
  }

  function openAdminDropdown() {
    if (adminTimer.current) clearTimeout(adminTimer.current)
    setAdminOpen(true)
  }

  function scheduleCloseAdmin() {
    adminTimer.current = setTimeout(() => setAdminOpen(false), 180)
  }

  function openMaintDropdown() {
    if (maintTimer.current) clearTimeout(maintTimer.current)
    setMaintOpen(true)
  }

  function scheduleCloseMaint() {
    maintTimer.current = setTimeout(() => setMaintOpen(false), 180)
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logoutAction()
      router.replace('/login')
      router.refresh()
    } catch {
      toast.error('Không thể đăng xuất. Vui lòng thử lại.')
      setLoggingOut(false)
    }
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

              /* Maintenance tab — dropdown trigger */
              if (tabKey === 'maintenance') {
                return (
                  <div
                    key="maintenance"
                    className="relative"
                    onMouseEnter={openMaintDropdown}
                    onMouseLeave={scheduleCloseMaint}
                  >
                    <Link
                      href="/dashboard/maintenance"
                      onClick={() => setMaintOpen(false)}
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
                      <span>Bảo Trì</span>
                      <ChevronDown
                        size={10}
                        strokeWidth={2.5}
                        className={cn(
                          'transition-transform duration-200 shrink-0',
                          maintOpen ? 'rotate-180' : 'rotate-0'
                        )}
                      />
                    </Link>
                    {maintOpen && (
                      <div className="hidden absolute left-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-2xl border border-[#d2d2d7]/70 bg-white/95 py-1.5 shadow-apple-lg backdrop-blur-xl">
                        {maintenanceItems.map(({ code, label, icon: ItemIcon, href }) => {
                          const isActiveSub = pathname.startsWith('/dashboard/maintenance') && activeMaintenanceSub === code
                          return (
                            <Link key={code} href={href} onClick={() => setMaintOpen(false)} className={cn('mx-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-100', isActiveSub ? 'bg-dmc-primary/8 text-dmc-primary' : 'text-[#1d1d1f] hover:bg-[#f2f2f7]')}>
                              <ItemIcon size={14} strokeWidth={isActiveSub ? 2.5 : 2} className="shrink-0 text-[#6e6e73]" />
                              <span>{label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              /* Coordination tab — dropdown trigger */
              if (tabKey === 'coordination') {
                return (
                  <div
                    key="coordination"
                    className="relative"
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
                      <span>{cfg.label}</span>
                      <ChevronDown
                        size={10}
                        strokeWidth={2.5}
                        className={cn(
                          'transition-transform duration-200 shrink-0',
                          coordOpen ? 'rotate-180' : 'rotate-0'
                        )}
                      />
                    </Link>
                    {coordOpen && (
                      <div className="hidden absolute left-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-2xl border border-[#d2d2d7]/70 bg-white/95 py-1.5 shadow-apple-lg backdrop-blur-xl">
                        {coordinationItems.map(({ code, label, icon: ItemIcon, href }) => {
                          const isActiveSub = pathname.startsWith('/dashboard/coordination') && activeCoordinationSub === code
                          return (
                            <Link key={code} href={href} onClick={() => setCoordOpen(false)} className={cn('mx-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-100', isActiveSub ? 'bg-dmc-primary/8 text-dmc-primary' : 'text-[#1d1d1f] hover:bg-[#f2f2f7]')}>
                              <ItemIcon size={14} strokeWidth={isActiveSub ? 2.5 : 2} className="shrink-0 text-[#6e6e73]" />
                              <span>{label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              /* Administration/HR tab — dropdown trigger */
              if (tabKey === 'administration') {
                return (
                  <div
                    key="administration"
                    className="relative"
                    onMouseEnter={openAdministrationDropdown}
                    onMouseLeave={scheduleCloseAdministration}
                  >
                    <Link
                      href="/dashboard/administration"
                      onClick={() => setAdministrationOpen(false)}
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
                      <ChevronDown
                        size={10}
                        strokeWidth={2.5}
                        className={cn(
                          'transition-transform duration-200 shrink-0',
                          administrationOpen ? 'rotate-180' : 'rotate-0'
                        )}
                      />
                    </Link>
                    {administrationOpen && (
                      <div className="hidden absolute left-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-2xl border border-[#d2d2d7]/70 bg-white/95 py-1.5 shadow-apple-lg backdrop-blur-xl">
                        {administrationItems.map(({ code, label, icon: ItemIcon, href }) => {
                          const isActiveSub = pathname.startsWith('/dashboard/administration') && activeAdministrationSub === code
                          return (
                            <Link key={code} href={href} onClick={() => setAdministrationOpen(false)} className={cn('mx-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-100', isActiveSub ? 'bg-dmc-primary/8 text-dmc-primary' : 'text-[#1d1d1f] hover:bg-[#f2f2f7]')}>
                              <ItemIcon size={14} strokeWidth={isActiveSub ? 2.5 : 2} className="shrink-0 text-[#6e6e73]" />
                              <span>{label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              /* Admin tab — dropdown trigger */
              if (tabKey === 'admin') {
                return (
                  <div
                    key="admin"
                    className="relative"
                    onMouseEnter={openAdminDropdown}
                    onMouseLeave={scheduleCloseAdmin}
                  >
                    <Link
                      href="/dashboard/admin"
                      onClick={() => setAdminOpen(false)}
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
                      <span>Hệ Thống</span>
                      <ChevronDown
                        size={10}
                        strokeWidth={2.5}
                        className={cn(
                          'transition-transform duration-200 shrink-0',
                          adminOpen ? 'rotate-180' : 'rotate-0'
                        )}
                      />
                    </Link>
                    {adminOpen && (
                      <div className="hidden absolute left-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-2xl border border-[#d2d2d7]/70 bg-white/95 py-1.5 shadow-apple-lg backdrop-blur-xl">
                        {adminItems.map(({ code, label, icon: ItemIcon, href }) => {
                          const isActiveSub = pathname.startsWith(href)
                          return (
                            <Link key={code} href={href} onClick={() => setAdminOpen(false)} className={cn('mx-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-100', isActiveSub ? 'bg-dmc-primary/8 text-dmc-primary' : 'text-[#1d1d1f] hover:bg-[#f2f2f7]')}>
                              <ItemIcon size={14} strokeWidth={isActiveSub ? 2.5 : 2} className="shrink-0 text-[#6e6e73]" />
                              <span>{label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              /* Report tab — dropdown trigger */
              if (tabKey === 'report') {
                return (
                  <div
                    key="report"
                    className="relative"
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
                    {reportOpen && (
                      <div className="hidden absolute left-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-2xl border border-[#d2d2d7]/70 bg-white/95 py-1.5 shadow-apple-lg backdrop-blur-xl">
                        {REPORT_ITEMS.map(({ code, label, icon: ItemIcon, href }) => {
                          const isActiveSub = pathname.startsWith('/dashboard/report') &&
                            (code === 'production' ? !pathname.includes('?') || href.includes('production') : href.includes(code))
                          return (
                            <Link key={code} href={href} onClick={() => setReportOpen(false)} className={cn('mx-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-100', isActiveSub ? 'bg-dmc-primary/8 text-dmc-primary' : 'text-[#1d1d1f] hover:bg-[#f2f2f7]')}>
                              <ItemIcon size={14} strokeWidth={isActiveSub ? 2.5 : 2} className="shrink-0 text-[#6e6e73]" />
                              <span>{label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
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

          {/* ── Maintenance dropdown — anchored to center column bottom ── */}
          {allowedTabs.includes('maintenance') && (
            <div
              onMouseEnter={openMaintDropdown}
              onMouseLeave={scheduleCloseMaint}
              className={cn(
                'absolute top-full mt-1.5 z-50',
                'left-1/2 -translate-x-1/2',
                'w-52',
                'bg-white/95 backdrop-blur-xl',
                'border border-[#d2d2d7]/70',
                'rounded-2xl shadow-apple-lg',
                'py-1.5 overflow-hidden',
                'transition-all duration-150 origin-top',
                maintOpen
                  ? 'opacity-100 scale-100 pointer-events-auto translate-y-0'
                  : 'opacity-0 scale-[0.97] pointer-events-none -translate-y-1'
              )}
            >
              <div className="px-3 pb-1.5 pt-1 border-b border-[#d2d2d7]/50 mb-1">
                <span className="text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.07em]">
                  Bảo trì
                </span>
              </div>

              {maintenanceItems.map(({ code, label, icon: ItemIcon, href }) => {
                const isActiveSub = pathname.startsWith('/dashboard/maintenance') && activeMaintenanceSub === code
                return (
                  <Link
                    key={code}
                    href={href}
                    onClick={() => setMaintOpen(false)}
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
                  Điều phối
                </span>
              </div>

              {coordinationItems.map(({ code, label, icon: ItemIcon, href }) => {
                const isActiveSub = pathname.startsWith('/dashboard/coordination') && activeCoordinationSub === code
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

          {/* ── Administration/HR dropdown — anchored to center column bottom ── */}
          {allowedTabs.includes('administration') && (
            <div
              onMouseEnter={openAdministrationDropdown}
              onMouseLeave={scheduleCloseAdministration}
              className={cn(
                'absolute top-full mt-1.5 z-50',
                'left-1/2 -translate-x-1/2',
                'w-56',
                'bg-white/95 backdrop-blur-xl',
                'border border-[#d2d2d7]/70',
                'rounded-2xl shadow-apple-lg',
                'py-1.5 overflow-hidden',
                'transition-all duration-150 origin-top',
                administrationOpen
                  ? 'opacity-100 scale-100 pointer-events-auto translate-y-0'
                  : 'opacity-0 scale-[0.97] pointer-events-none -translate-y-1'
              )}
            >
              <div className="px-3 pb-1.5 pt-1 border-b border-[#d2d2d7]/50 mb-1">
                <span className="text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.07em]">
                  Hành chính nhân sự
                </span>
              </div>

              {administrationItems.map(({ code, label, icon: ItemIcon, href }) => {
                const isActiveSub = pathname.startsWith('/dashboard/administration') && activeAdministrationSub === code
                return (
                  <Link
                    key={code}
                    href={href}
                    onClick={() => setAdministrationOpen(false)}
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

          {/* ── Admin dropdown — anchored to center column bottom ── */}
          {allowedTabs.includes('admin') && (
            <div
              onMouseEnter={openAdminDropdown}
              onMouseLeave={scheduleCloseAdmin}
              className={cn(
                'absolute top-full mt-1.5 z-50',
                'left-1/2 -translate-x-1/2',
                'w-52',
                'bg-white/95 backdrop-blur-xl',
                'border border-[#d2d2d7]/70',
                'rounded-2xl shadow-apple-lg',
                'py-1.5 overflow-hidden',
                'transition-all duration-150 origin-top',
                adminOpen
                  ? 'opacity-100 scale-100 pointer-events-auto translate-y-0'
                  : 'opacity-0 scale-[0.97] pointer-events-none -translate-y-1'
              )}
            >
              <div className="px-3 pb-1.5 pt-1 border-b border-[#d2d2d7]/50 mb-1">
                <span className="text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.07em]">
                  Hệ thống
                </span>
              </div>

              {adminItems.map(({ code, label, icon: ItemIcon, href }) => {
                const isActiveSub = pathname.startsWith(href)
                return (
                  <Link
                    key={code}
                    href={href}
                    onClick={() => setAdminOpen(false)}
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
            ROLE_COLOR[user.role] ?? ROLE_COLOR.MANAGER
          )}>
            {ROLE_LABELS[user.role] ?? user.role}
          </span>

          <span className="text-[13px] text-[#6e6e73] hidden md:block px-1">
            {user.username}
          </span>

          <ApprovalNotificationBell user={user} />

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
