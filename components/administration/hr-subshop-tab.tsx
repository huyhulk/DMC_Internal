'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTodayLocal } from '@/lib/utils'
import { VietnameseDatePicker } from '@/components/ui/vietnamese-date-picker'
import { Dialog } from '@/components/ui/dialog'
import { HRAdminModal } from '@/components/coordination/hr-admin-modal'
import { getHRSubshopBoard, setHREmployeeStatus } from '@/lib/actions/hr-subshop'
import { HR_GROUPS, getHRGroupLabel } from '@/lib/hr/groups'
import type { HRSubshopGroup, HRMember, HRStatus } from '@/lib/hr/subshop'
import type { SessionUser } from '@/types'

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_DOT: Record<HRStatus, { color: string; label: string }> = {
  working:    { color: '#34c759', label: 'Đang làm việc' },
  transferred: { color: '#ffcc00', label: 'Điều chuyển xưởng khác' },
  absent:     { color: '#ff3b30', label: 'Nghỉ' },
}

// ─── Group card ────────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: HRSubshopGroup
  editable: boolean
  onMemberClick: (member: HRMember) => void
}

function GroupCard({ group, editable, onMemberClick }: GroupCardProps) {
  const typeTag = group.isProduction ? (
    <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#3b5bdb]/10 text-[#3b5bdb] border border-[#3b5bdb]/20">
      SX
    </span>
  ) : (
    <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#f2f2f7] text-[#6e6e73] border border-[#d2d2d7]/70">
      BP
    </span>
  )

  const isEmpty = group.planHeadcount === 0 && group.transferredIn.length === 0

  return (
    <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex flex-col">
      {/* Card header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-[#d2d2d7]/50">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-[14px] font-semibold text-[#1d1d1f] truncate">{group.label}</span>
          {typeTag}
        </div>
        {/* Mini stats */}
        <div className="flex items-center gap-3">
          <MiniStat label="Định biên" value={group.planHeadcount} />
          <div className="w-px h-3 bg-[#d2d2d7]/60" />
          <MiniStat label="Thực tế" value={group.actualHeadcount} accent />
          <div className="w-px h-3 bg-[#d2d2d7]/60" />
          <MiniStat label="Giờ NC (S/C)" value={`${group.laborHoursMorning}/${group.laborHoursAfternoon}h`} />
        </div>
      </div>

      {/* Member list */}
      <div className="flex-1 px-3 py-2 space-y-0.5">
        {isEmpty ? (
          <p className="py-3 text-center text-[12px] text-[#aeaeb2]">Chưa có nhân sự</p>
        ) : (
          <>
            {group.members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                editable={editable}
                onClick={() => editable && onMemberClick(member)}
              />
            ))}

            {group.transferredIn.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[#d2d2d7]/40">
                <p className="mb-1 text-[10px] font-semibold text-[#6e6e73] uppercase tracking-[0.06em]">
                  Điều chuyển đến
                </p>
                {group.transferredIn.map((member) => (
                  <div key={member.id} className="flex items-center gap-2 py-1 px-1 rounded-lg">
                    <span
                      className="shrink-0 w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: '#6366f1' }}
                    />
                    <span className="text-[13px] font-medium text-[#1d1d1f] truncate">{member.name}</span>
                    <span className="shrink-0 text-[11px] text-[#6366f1] ml-auto whitespace-nowrap">
                      {member.transferStart ? `${member.transferStart} · ` : ''}{member.morningHours + member.afternoonHours}h · từ {getHRGroupLabel(member.homeGroup)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function MiniStat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-[10px] text-[#aeaeb2] uppercase tracking-[0.05em] font-medium">{label}</span>
      <span className={cn(
        'text-[14px] font-semibold',
        accent ? 'text-[#3b5bdb]' : 'text-[#1d1d1f]'
      )}>
        {value}
      </span>
    </div>
  )
}

interface MemberRowProps {
  member: HRMember
  editable: boolean
  onClick: () => void
}

function MemberRow({ member, editable, onClick }: MemberRowProps) {
  const { color } = STATUS_DOT[member.status]
  const isAbsent = member.status === 'absent'
  const isTransferred = member.status === 'transferred'

  return (
    <button
      type="button"
      disabled={!editable}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left transition-colors duration-100',
        editable
          ? 'hover:bg-[#f5f5f7] cursor-pointer active:bg-[#e5e5ea]'
          : 'cursor-default'
      )}
    >
      {/* Status dot */}
      <span
        className="shrink-0 w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
        title={STATUS_DOT[member.status].label}
      />

      {/* Name + position */}
      <div className="flex-1 min-w-0">
        <span className={cn(
          'block text-[13px] font-medium truncate',
          isAbsent ? 'text-[#aeaeb2] line-through' : 'text-[#1d1d1f]'
        )}>
          {member.name}
        </span>
        {member.position && (
          <span className="block text-[11px] text-[#aeaeb2] truncate">{member.position}</span>
        )}
      </div>

      {/* Transfer destination + mốc giờ */}
      {isTransferred && member.transferToLabel && (
        <span className="shrink-0 text-[11px] font-medium text-amber-600 whitespace-nowrap">
          → {member.transferToLabel}{member.transferStart ? ` · ${member.transferStart}` : ''}
        </span>
      )}
    </button>
  )
}

// ─── Status popup ──────────────────────────────────────────────────────────────

interface StatusPopupProps {
  open: boolean
  member: HRMember
  date: string
  onClose: () => void
  onSuccess: () => void
}

function vnNowHHMM(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '07'
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '30'
  return `${hh}:${mm}`
}

function StatusPopup({ open, member, date, onClose, onSuccess }: StatusPopupProps) {
  const [status, setStatus] = useState<HRStatus>(member.status)
  const [toGroup, setToGroup] = useState<string>(member.transferTo ?? '')
  const [fromTime, setFromTime] = useState<string>(member.transferStart ?? vnNowHHMM())
  const [saving, setSaving] = useState(false)

  // Sync state when member changes
  useEffect(() => {
    setStatus(member.status)
    setToGroup(member.transferTo ?? '')
    setFromTime(member.transferStart ?? vnNowHHMM())
  }, [member])

  const destGroups = HR_GROUPS.filter((g) => g !== member.homeGroup)

  async function handleSave() {
    if (status === 'transferred' && !toGroup) {
      toast.error('Vui lòng chọn xưởng điều chuyển đến.')
      return
    }
    setSaving(true)
    try {
      const result = await setHREmployeeStatus({
        date,
        employeeId: member.id,
        status,
        toGroup: status === 'transferred' ? toGroup : undefined,
        startTime: status === 'transferred' ? fromTime : undefined,
      })
      if (result.success) {
        toast.success('Đã cập nhật trạng thái nhân sự')
        onSuccess()
        onClose()
      } else {
        toast.error(result.error ?? 'Lưu thất bại')
      }
    } catch {
      toast.error('Lỗi kết nối, vui lòng thử lại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={member.name} size="sm">
      <div className="space-y-4">
        {/* Status radios */}
        <div className="space-y-2">
          {(
            [
              { value: 'working' as const, dotColor: '#34c759', label: 'Đang làm việc' },
              { value: 'transferred' as const, dotColor: '#ffcc00', label: 'Điều chuyển xưởng khác' },
              { value: 'absent' as const, dotColor: '#ff3b30', label: 'Nghỉ' },
            ] as const
          ).map(({ value, dotColor, label }) => (
            <label
              key={value}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all duration-100',
                status === value
                  ? 'border-[#3b5bdb]/40 bg-[#3b5bdb]/5'
                  : 'border-[#d2d2d7]/60 hover:bg-[#f5f5f7]'
              )}
            >
              <input
                type="radio"
                name="hr-status"
                value={value}
                checked={status === value}
                onChange={() => {
                  setStatus(value)
                  if (value !== 'transferred') setToGroup('')
                }}
                className="sr-only"
              />
              <span
                className="shrink-0 w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: dotColor }}
              />
              <span className="text-[13px] font-medium text-[#1d1d1f]">{label}</span>
              {status === value && (
                <span className="ml-auto w-4 h-4 rounded-full bg-[#3b5bdb] flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                </span>
              )}
            </label>
          ))}
        </div>

        {/* Destination select (when transferred) */}
        {status === 'transferred' && (
          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-[#6e6e73] tracking-[0.02em]">
              Xưởng điều chuyển đến <span className="text-[#ff3b30]">*</span>
            </label>
            <select
              value={toGroup}
              onChange={(e) => setToGroup(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/70
                         text-[13px] text-[#1d1d1f]
                         focus:outline-none focus:ring-1 focus:ring-[#3b5bdb]/40
                         transition-all duration-150 cursor-pointer"
            >
              <option value="">— Chọn xưởng đến —</option>
              {destGroups.map((g) => (
                <option key={g} value={g}>{getHRGroupLabel(g)}</option>
              ))}
            </select>

            <label className="block text-[11px] font-medium text-[#6e6e73] tracking-[0.02em] pt-1">
              Điều chuyển từ giờ
            </label>
            <input
              type="time"
              value={fromTime}
              min="07:30"
              max="16:30"
              onChange={(e) => setFromTime(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/70
                         text-[13px] text-[#1d1d1f]
                         focus:outline-none focus:ring-1 focus:ring-[#3b5bdb]/40
                         transition-all duration-150"
            />
            <p className="text-[11px] text-[#aeaeb2]">
              Tính giờ nhân công cho xưởng đến từ mốc này đến hết ngày (16:30, trừ nghỉ trưa).
            </p>
          </div>
        )}

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full h-10 rounded-[10px] bg-[#3b5bdb] hover:bg-[#2f4ac4]
                     text-white text-[13px] font-semibold
                     active:scale-[0.98] transition-all duration-150
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2 shadow-sm"
        >
          {saving && (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {saving ? 'Đang lưu…' : 'Lưu'}
        </button>
      </div>
    </Dialog>
  )
}

// ─── Main tab ──────────────────────────────────────────────────────────────────

interface Props {
  user: SessionUser
  canEdit: boolean
}

export function HRSubshopTab({ user, canEdit }: Props) {
  const [date, setDate] = useState<string>(getTodayLocal())
  const [board, setBoard] = useState<HRSubshopGroup[]>([])
  const [editableGroups, setEditableGroups] = useState<string[]>([])
  const [canEditStatus, setCanEditStatus] = useState(false)
  const [loading, setLoading] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  // Popup state
  const [popupMember, setPopupMember] = useState<HRMember | null>(null)

  const loadBoard = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const result = await getHRSubshopBoard(d)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setBoard(result.board)
      setEditableGroups(result.editableGroups)
      setCanEditStatus(result.canEditStatus)
    } catch (err) {
      toast.error(`Lỗi tải nhân sự: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadBoard(date) }, [date, loadBoard])

  function handleRefresh() {
    loadBoard(date)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#f5f5f7]">
      {/* Top bar */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[#d2d2d7]/60 bg-white">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Date picker */}
          <div className="space-y-1 min-w-[140px]">
            <label className="text-[11px] font-medium text-[#6e6e73] tracking-[0.02em]">Ngày</label>
            <VietnameseDatePicker value={date} onChange={setDate} className="w-[160px]" />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Refresh button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="h-10 px-3 rounded-[10px] border border-[#d2d2d7]/70 bg-white
                         text-[13px] font-medium text-[#6e6e73]
                         hover:bg-[#f5f5f7] active:scale-[0.98] transition-all duration-150
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center gap-2"
            >
              <RefreshCw size={13} strokeWidth={2.5} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>

            {/* Admin button */}
            {canEdit && user.role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => setAdminOpen(true)}
                className="h-10 px-4 rounded-[10px] bg-[#3b5bdb] hover:bg-[#2f4ac4]
                           text-white text-[13px] font-semibold
                           active:scale-[0.98] transition-all duration-150
                           flex items-center gap-2 shadow-sm"
              >
                <Settings2 size={14} strokeWidth={2.5} />
                Điều chỉnh thông tin nhân sự
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section label */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.07em]">
            Nhân sự theo xưởng nhỏ
          </span>
          <div className="flex-1 h-px bg-[#d2d2d7]/50" />
          {!canEditStatus && (
            <span className="shrink-0 text-[11px] text-[#aeaeb2] font-medium">Chỉ xem</span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-[#3b5bdb]/30 border-t-[#3b5bdb] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {board.map((group) => (
              <GroupCard
                key={group.group}
                group={group}
                editable={editableGroups.includes(group.group)}
                onMemberClick={setPopupMember}
              />
            ))}
          </div>
        )}
      </div>

      {/* Status popup */}
      {popupMember && (
        <StatusPopup
          open={true}
          member={popupMember}
          date={date}
          onClose={() => setPopupMember(null)}
          onSuccess={() => loadBoard(date)}
        />
      )}

      {/* Admin modal */}
      <HRAdminModal
        open={adminOpen}
        canEdit={canEdit}
        onClose={() => setAdminOpen(false)}
        onRefresh={handleRefresh}
      />
    </div>
  )
}
