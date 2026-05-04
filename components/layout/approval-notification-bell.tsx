'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, CalendarClock, Clock, Inbox, RefreshCw } from 'lucide-react'
import { canApproveRequests } from '@/lib/approval/workflow'
import { listApprovalNotificationsAction } from '@/lib/actions/approval-notifications'
import { cn, formatDate } from '@/lib/utils'
import type {
  ApprovalNotificationFeed,
  ApprovalNotificationItem,
} from '@/lib/approval/notifications'
import type { SessionUser } from '@/types'

const EMPTY_FEED: ApprovalNotificationFeed = {
  totalCount: 0,
  sections: [
    {
      key: 'overtime',
      label: 'Tăng ca chờ duyệt',
      count: 0,
      href: '/dashboard/administration?sub=overtime',
      items: [],
    },
    {
      key: 'maintenance',
      label: 'Bảo trì chờ duyệt',
      count: 0,
      href: '/dashboard/maintenance?sub=schedule',
      items: [],
    },
  ],
}

const ACCENT_CLASSES: Record<ApprovalNotificationItem['accent'], {
  icon: string
  border: string
  bg: string
}> = {
  blue: {
    icon: 'bg-[#0a66c2] text-white',
    border: 'border-l-[#0a66c2]',
    bg: 'bg-[#eef6ff]',
  },
  amber: {
    icon: 'bg-[#d4870c] text-white',
    border: 'border-l-[#d4870c]',
    bg: 'bg-[#fff7e8]',
  },
}

interface Props {
  user: SessionUser
}

function formatBadgeCount(count: number): string {
  if (count > 99) return '99+'
  return String(count)
}

function NotificationIcon({ item }: { item: ApprovalNotificationItem }) {
  const Icon = item.source === 'overtime' ? Clock : CalendarClock
  const accent = ACCENT_CLASSES[item.accent]

  return (
    <span className={cn(
      'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
      accent.icon
    )}>
      <Icon size={15} strokeWidth={2.3} />
      <span className="absolute -bottom-0.5 -right-0.5 rounded-[5px] bg-white px-1 text-[8px] font-black leading-3 text-[#1d1d1f] shadow-sm">
        {item.iconLabel}
      </span>
    </span>
  )
}

function NotificationRow({ item, onNavigate }: {
  item: ApprovalNotificationItem
  onNavigate: () => void
}) {
  const accent = ACCENT_CLASSES[item.accent]

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'grid grid-cols-[36px_minmax(0,1fr)] gap-2.5 border-l-[3px] px-3 py-2.5 transition-colors',
        'hover:bg-[#f5f5f7] active:bg-[#ededf1]',
        accent.border,
        accent.bg
      )}
    >
      <NotificationIcon item={item} />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold leading-4 text-[#1d1d1f]">
          {item.title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] font-medium text-[#6e6e73]">
          {item.description}
        </span>
        <span className="mt-1 block text-[10px] font-semibold text-[#0a66c2]">
          Mở cửa sổ phê duyệt · {formatDate(item.targetDate)}
        </span>
      </span>
    </Link>
  )
}

export function ApprovalNotificationBell({ user }: Props) {
  const enabled = canApproveRequests(user.role)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const requestSeq = useRef(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feed, setFeed] = useState<ApprovalNotificationFeed>(EMPTY_FEED)

  const visibleSections = useMemo(
    () => feed.sections.filter((section) => section.count > 0 || section.items.length > 0),
    [feed.sections]
  )

  const load = useCallback(async () => {
    if (!enabled) return
    const seq = requestSeq.current + 1
    requestSeq.current = seq
    setLoading(true)
    setError(null)

    const result = await listApprovalNotificationsAction()
    if (requestSeq.current !== seq) return

    if (result.success && result.data) {
      setFeed(result.data)
    } else {
      setFeed(EMPTY_FEED)
      setError(result.message || 'Không tải được thông báo phê duyệt')
    }
    setLoading(false)
  }, [enabled])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!enabled) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value)
          if (!open) void load()
        }}
        title="Thông báo phê duyệt"
        aria-label="Thông báo phê duyệt"
        aria-expanded={open}
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-[8px]',
          'text-[#6e6e73] transition-all duration-150 hover:bg-[#f2f2f7] hover:text-[#1d1d1f] active:scale-95',
          open && 'bg-[#f2f2f7] text-[#1d1d1f]'
        )}
      >
        <Bell size={15} strokeWidth={2} />
        {feed.totalCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-white bg-[#ff3b30] px-1 text-[9px] font-black leading-none text-white">
            {formatBadgeCount(feed.totalCount)}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-[#d2d2d7]/80 bg-white/95 shadow-apple-lg backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-[#d2d2d7]/60 px-3 py-2.5">
            <div>
              <p className="text-[14px] font-bold text-[#1d1d1f]">Thông báo phê duyệt</p>
              <p className="text-[11px] font-medium text-[#6e6e73]">
                {feed.totalCount > 0 ? `${feed.totalCount} mục đang chờ` : 'Không có mục chờ duyệt'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              title="Làm mới"
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#6e6e73] hover:bg-[#f2f2f7] disabled:opacity-50"
            >
              <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
            </button>
          </div>

          {error && (
            <div className="border-b border-red-100 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="max-h-[420px] overflow-y-auto py-1">
            {loading && visibleSections.length === 0 ? (
              <div className="space-y-2 px-3 py-3">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="flex items-center gap-2.5">
                    <span className="h-9 w-9 animate-pulse rounded-full bg-[#e5e5ea]" />
                    <span className="min-w-0 flex-1 space-y-1.5">
                      <span className="block h-3 w-4/5 animate-pulse rounded bg-[#e5e5ea]" />
                      <span className="block h-2.5 w-3/5 animate-pulse rounded bg-[#ededf1]" />
                    </span>
                  </div>
                ))}
              </div>
            ) : visibleSections.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-5 py-8 text-center">
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#f2f2f7] text-[#6e6e73]">
                  <Inbox size={18} />
                </span>
                <p className="text-[13px] font-semibold text-[#1d1d1f]">Không có phê duyệt mới</p>
                <p className="mt-1 text-[11px] text-[#6e6e73]">Các request mới sẽ xuất hiện tại đây.</p>
              </div>
            ) : (
              visibleSections.map((section) => (
                <section key={section.key} className="py-1">
                  <div className="flex items-center justify-between px-3 pb-1 pt-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#6e6e73]">
                      {section.label}
                    </span>
                    <Link
                      href={section.href}
                      onClick={() => setOpen(false)}
                      className="text-[11px] font-semibold text-[#0a66c2] hover:underline"
                    >
                      {section.count} mục
                    </Link>
                  </div>

                  {section.items.map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </section>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
