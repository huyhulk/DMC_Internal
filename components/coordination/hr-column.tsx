'use client'

import { useRef, useEffect, useState } from 'react'
import { ChevronDown, Save, Lock, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { calculateActualHeadcount } from '@/modules/hr/workflow'
import type { HumanResource, HRDailyGroupKey, HRTransferRecord } from '@/types'
import { HR_DAILY_GROUP_LABELS, HR_DAILY_GROUPS } from '@/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  factory: HRDailyGroupKey
  employees: HumanResource[]
  totalem: number
  absentIds: number[]
  transferredIds: number[]
  transferRecords: HRTransferRecord[]
  saving: boolean
  readOnly?: boolean
  onAbsentToggle: (id: number) => void
  onTransferredToggle: (id: number) => void
  onTransferChange: (id: number, field: 'toFactory' | 'startTime' | 'endTime', value: string) => void
  onSave: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function HRColumn({
  factory,
  employees,
  totalem,
  absentIds,
  transferredIds,
  transferRecords,
  saving,
  readOnly = false,
  onAbsentToggle,
  onTransferredToggle,
  onTransferChange,
  onSave,
}: Props) {
  const [absentDropdownOpen, setAbsentDropdownOpen] = useState(false)
  const [transferredDropdownOpen, setTransferredDropdownOpen] = useState(false)
  const absentDropdownRef = useRef<HTMLDivElement>(null)
  const transferredDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (absentDropdownRef.current && !absentDropdownRef.current.contains(e.target as Node)) {
        setAbsentDropdownOpen(false)
      }
      if (transferredDropdownRef.current && !transferredDropdownRef.current.contains(e.target as Node)) {
        setTransferredDropdownOpen(false)
      }
    }
    if (absentDropdownOpen || transferredDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [absentDropdownOpen, transferredDropdownOpen])

  const absentEmployees = employees.filter((emp) => absentIds.includes(emp.id))
  const actualHeadcount = calculateActualHeadcount(totalem, absentIds, transferredIds)
  const destinationOptions = HR_DAILY_GROUPS.filter((group) => group !== factory)

  const absentTriggerLabel =
    absentIds.length === 0
      ? 'Không có vắng mặt'
      : `${absentIds.length} người vắng`
  const transferredTriggerLabel =
    transferredIds.length === 0
      ? 'Không có điều chuyển'
      : `${transferredIds.length} người điều chuyển`

  return (
    <div
      className="rounded-2xl border border-[#d2d2d7]/60 bg-white
                 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 flex flex-col gap-4"
    >
      {/* ── 1. Header badge ── */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center bg-[#3b5bdb]/10 text-[#3b5bdb]
                     border border-[#3b5bdb]/20 rounded-full px-2.5 py-0.5
                     text-[11px] font-semibold"
        >
          {HR_DAILY_GROUP_LABELS[factory]}
        </span>
        {readOnly && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                           bg-[#aeaeb2]/10 border border-[#aeaeb2]/30
                           text-[10px] font-semibold text-[#aeaeb2]">
            <Lock size={9} strokeWidth={2.5} />
            Chỉ xem
          </span>
        )}
      </div>

      {/* ── 2. Headcount summary ── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/70 px-3 py-2">
          <div className="text-[10px] text-[#6e6e73] uppercase tracking-[0.06em] font-medium">
            Tổng nhân sự
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[18px] font-semibold text-[#1d1d1f]">
            <Users size={15} strokeWidth={2.5} />
            {totalem}
          </div>
          <div className="mt-1 text-[10px] text-[#6e6e73]">Theo danh sách nhân sự</div>
        </div>
        <div className="rounded-xl bg-[#34c759]/10 border border-[#34c759]/20 px-3 py-2">
          <div className="text-[10px] text-[#248a3d] uppercase tracking-[0.06em] font-medium">
            Thực tế tại bộ phận
          </div>
          <div className="mt-1 text-[18px] font-semibold text-[#248a3d]">{actualHeadcount}</div>
          <div className="mt-1 text-[10px] text-[#248a3d]">Trừ nghỉ/điều chuyển đi</div>
        </div>
      </div>

      {/* ── 3. Absent dropdown ── */}
      <div className="space-y-1.5">
        <label className="block text-[11px] text-[#6e6e73] uppercase tracking-[0.06em] font-medium">
          Nhân sự vắng mặt
        </label>

        <div ref={absentDropdownRef} className="relative">
          {/* Trigger */}
          <button
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && setAbsentDropdownOpen((prev) => !prev)}
            className={cn(
              'w-full h-10 px-3 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/70',
              'text-[13px] text-left flex items-center justify-between',
              'focus:outline-none focus:ring-1 focus:ring-[#3b5bdb]/40 transition-all duration-150',
              absentIds.length > 0 ? 'text-[#1d1d1f] font-medium' : 'text-[#aeaeb2]',
              readOnly && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className="truncate">{absentTriggerLabel}</span>
            <ChevronDown
              size={14}
              strokeWidth={2.5}
              className={cn(
                'shrink-0 text-[#aeaeb2] transition-transform duration-150',
                absentDropdownOpen && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown list */}
          {absentDropdownOpen && (
            <div
              className="absolute top-full mt-1 left-0 right-0 z-20
                         bg-white border border-[#d2d2d7]/70 rounded-xl
                         shadow-[0_4px_16px_rgba(0,0,0,0.10),0_1px_4px_rgba(0,0,0,0.06)]
                         max-h-48 overflow-y-auto"
            >
              {employees.length === 0 ? (
                <div className="px-3 py-3 text-[12px] text-[#aeaeb2] text-center">
                  Chưa có nhân sự trong tổ
                </div>
              ) : (
                employees.map((emp) => {
                  const checked = absentIds.includes(emp.id)
                  return (
                    <label
                      key={emp.id}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 cursor-pointer',
                        'hover:bg-[#f5f5f7] transition-colors duration-100',
                        checked && 'bg-[#ff3b30]/5'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={readOnly}
                        onChange={() => !readOnly && onAbsentToggle(emp.id)}
                        className={cn(
                          'w-3.5 h-3.5 rounded accent-[#ff3b30]',
                          readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                        )}
                      />
                      <span className={cn(
                        'text-[13px] leading-tight',
                        checked ? 'text-[#ff3b30] font-medium' : 'text-[#1d1d1f]'
                      )}>
                        {emp.name}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Transfer dropdown ── */}
      <div className="space-y-1.5">
        <label className="block text-[11px] text-[#6e6e73] uppercase tracking-[0.06em] font-medium">
          Điều chuyển / không làm tại bộ phận
        </label>

        <div ref={transferredDropdownRef} className="relative">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && setTransferredDropdownOpen((prev) => !prev)}
            className={cn(
              'w-full h-10 px-3 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/70',
              'text-[13px] text-left flex items-center justify-between',
              'focus:outline-none focus:ring-1 focus:ring-[#3b5bdb]/40 transition-all duration-150',
              transferredIds.length > 0 ? 'text-[#1d1d1f] font-medium' : 'text-[#aeaeb2]',
              readOnly && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className="truncate">{transferredTriggerLabel}</span>
            <ChevronDown
              size={14}
              strokeWidth={2.5}
              className={cn(
                'shrink-0 text-[#aeaeb2] transition-transform duration-150',
                transferredDropdownOpen && 'rotate-180'
              )}
            />
          </button>

          {transferredDropdownOpen && (
            <div
              className="absolute top-full mt-1 left-0 right-0 z-20
                         bg-white border border-[#d2d2d7]/70 rounded-xl
                         shadow-[0_4px_16px_rgba(0,0,0,0.10),0_1px_4px_rgba(0,0,0,0.06)]
                         max-h-48 overflow-y-auto"
            >
              {employees.length === 0 ? (
                <div className="px-3 py-3 text-[12px] text-[#aeaeb2] text-center">
                  Chưa có nhân sự trong tổ
                </div>
              ) : (
                employees.map((emp) => {
                  const checked = transferredIds.includes(emp.id)
                  const disabledByAbsent = absentIds.includes(emp.id)
                  return (
                    <label
                      key={emp.id}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 cursor-pointer',
                        'hover:bg-[#f5f5f7] transition-colors duration-100',
                        checked && 'bg-[#ff9500]/5',
                        disabledByAbsent && 'opacity-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={readOnly || disabledByAbsent}
                        onChange={() => !readOnly && !disabledByAbsent && onTransferredToggle(emp.id)}
                        className={cn(
                          'w-3.5 h-3.5 rounded accent-[#ff9500]',
                          readOnly || disabledByAbsent ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                        )}
                      />
                      <span className={cn(
                        'text-[13px] leading-tight',
                        checked ? 'text-[#bf6a02] font-medium' : 'text-[#1d1d1f]'
                      )}>
                        {emp.name}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Transfer details ── */}
      {transferRecords.length > 0 && (
        <div className="space-y-2">
          {transferRecords.map((record) => {
            const employee = employees.find((emp) => emp.id === record.employeeId)
            const missing = !record.toFactory || !record.startTime || !record.endTime
            return (
              <div key={record.employeeId} className="rounded-xl border border-[#ff9500]/25 bg-[#ff9500]/5 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-[#1d1d1f] leading-tight">
                      {employee?.name ?? `#${record.employeeId}`}
                    </p>
                    {missing && <p className="mt-0.5 text-[10px] text-[#bf6a02]">Nhập xưởng đến và thời gian điều chuyển</p>}
                  </div>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => !readOnly && onTransferredToggle(record.employeeId)}
                    className="rounded-full p-1 text-[#bf6a02] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Bỏ điều chuyển"
                  >
                    <X size={13} strokeWidth={2.5} />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#6e6e73]">Đến xưởng</span>
                    <select
                      value={record.toFactory}
                      disabled={readOnly}
                      onChange={(e) => onTransferChange(record.employeeId, 'toFactory', e.target.value)}
                      className="h-9 w-full rounded-lg border border-[#d2d2d7]/70 bg-white px-2 text-[12px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#ff9500]/40 disabled:opacity-50"
                    >
                      {destinationOptions.map((group) => (
                        <option key={group} value={group}>{HR_DAILY_GROUP_LABELS[group]}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#6e6e73]">Từ</span>
                      <input
                        type="time"
                        value={record.startTime}
                        disabled={readOnly}
                        onChange={(e) => onTransferChange(record.employeeId, 'startTime', e.target.value)}
                        className="h-9 w-full rounded-lg border border-[#d2d2d7]/70 bg-white px-2 text-[12px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#ff9500]/40 disabled:opacity-50"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#6e6e73]">Đến</span>
                      <input
                        type="time"
                        value={record.endTime}
                        disabled={readOnly}
                        onChange={(e) => onTransferChange(record.employeeId, 'endTime', e.target.value)}
                        className="h-9 w-full rounded-lg border border-[#d2d2d7]/70 bg-white px-2 text-[12px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#ff9500]/40 disabled:opacity-50"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 6. Selected employee info cards ── */}
      {absentEmployees.length > 0 && (
        <div className="space-y-2">
          {absentEmployees.map((emp) => (
            <EmployeeInfoCard key={`absent-${emp.id}`} employee={emp} tag="Vắng" />
          ))}
        </div>
      )}

      {/* ── 7. Save button ── */}
      {readOnly ? (
        <div className="mt-auto w-full h-10 rounded-[10px] bg-[#f2f2f7] border border-[#d2d2d7]/60
                        flex items-center justify-center gap-1.5
                        text-[12px] font-medium text-[#aeaeb2]">
          <Lock size={11} strokeWidth={2.5} />
          Không có quyền chỉnh sửa
        </div>
      ) : (
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="mt-auto w-full h-10 rounded-[10px] bg-[#34c759] hover:opacity-90
                     text-white text-[13px] font-semibold
                     active:scale-[0.98] transition-all duration-150
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2 shadow-sm shadow-[#34c759]/20"
        >
          {saving ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={13} strokeWidth={2.5} />
          )}
          {saving ? 'Đang lưu…' : 'Lưu nhân sự'}
        </button>
      )}
    </div>
  )
}

// ─── Employee info card ───────────────────────────────────────────────────────

function EmployeeInfoCard({ employee, tag }: { employee: HumanResource; tag: string }) {
  return (
    <div className="bg-[#f5f5f7] rounded-xl p-3 space-y-1 border border-[#d2d2d7]/50">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-[#1d1d1f] leading-tight">
          {employee.name}
        </p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#6e6e73] border border-[#d2d2d7]/70">
          {tag}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        <DetailItem label="Tổ" value={employee.factory} />
        <DetailItem label="Máy" value={employee.machine} />
        <DetailItem label="Chức vụ" value={employee.position} />
        {employee.phone && (
          <DetailItem label="SĐT" value={employee.phone} />
        )}
      </div>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="text-[11px] text-[#6e6e73]">
      {label}: <span className="text-[#1d1d1f]">{value ?? '—'}</span>
    </span>
  )
}
