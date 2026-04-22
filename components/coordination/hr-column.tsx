'use client'

import { useRef, useEffect, useState } from 'react'
import { ChevronDown, Save, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HumanResource, FactoryKey } from '@/types'
import { WORKSHOP_LABELS } from '@/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  factory: FactoryKey
  employees: HumanResource[]
  totalem: number | ''
  absentIds: number[]
  saving: boolean
  readOnly?: boolean
  onTotalemChange: (v: number | '') => void
  onAbsentToggle: (id: number) => void
  onSave: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function HRColumn({
  factory,
  employees,
  totalem,
  absentIds,
  saving,
  readOnly = false,
  onTotalemChange,
  onAbsentToggle,
  onSave,
}: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const absentEmployees = employees.filter((emp) => absentIds.includes(emp.id))

  const triggerLabel =
    absentIds.length === 0
      ? 'Không có vắng mặt'
      : `${absentIds.length} người vắng`

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
          {WORKSHOP_LABELS[factory]}
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

      {/* ── 2. Totalem field ── */}
      <div className="space-y-1.5">
        <label className="block text-[11px] text-[#6e6e73] uppercase tracking-[0.06em] font-medium">
          Tổng nhân sự trong ngày
        </label>
        <input
          type="number"
          min={0}
          value={totalem}
          disabled={readOnly}
          onChange={(e) => {
            if (readOnly) return
            const raw = e.target.value
            if (raw === '') {
              onTotalemChange('')
            } else {
              const num = parseInt(raw, 10)
              if (!isNaN(num) && num >= 0) onTotalemChange(num)
            }
          }}
          placeholder="0"
          className={cn(
            'w-full h-10 px-3 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/70',
            'text-[15px] font-semibold text-[#1d1d1f]',
            'focus:outline-none focus:ring-1 focus:ring-[#3b5bdb]/40 transition-all duration-150',
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none',
            '[&::-webkit-inner-spin-button]:appearance-none',
            readOnly && 'opacity-50 cursor-not-allowed'
          )}
        />
      </div>

      {/* ── 3. Absent dropdown ── */}
      <div className="space-y-1.5">
        <label className="block text-[11px] text-[#6e6e73] uppercase tracking-[0.06em] font-medium">
          Nhân sự vắng mặt
        </label>

        <div ref={dropdownRef} className="relative">
          {/* Trigger */}
          <button
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && setDropdownOpen((prev) => !prev)}
            className={cn(
              'w-full h-10 px-3 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/70',
              'text-[13px] text-left flex items-center justify-between',
              'focus:outline-none focus:ring-1 focus:ring-[#3b5bdb]/40 transition-all duration-150',
              absentIds.length > 0 ? 'text-[#1d1d1f] font-medium' : 'text-[#aeaeb2]',
              readOnly && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronDown
              size={14}
              strokeWidth={2.5}
              className={cn(
                'shrink-0 text-[#aeaeb2] transition-transform duration-150',
                dropdownOpen && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown list */}
          {dropdownOpen && (
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

      {/* ── 4. Selected employee info cards ── */}
      {absentEmployees.length > 0 && (
        <div className="space-y-2">
          {absentEmployees.map((emp) => (
            <EmployeeInfoCard key={emp.id} employee={emp} />
          ))}
        </div>
      )}

      {/* ── 5. Save button ── */}
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

function EmployeeInfoCard({ employee }: { employee: HumanResource }) {
  return (
    <div className="bg-[#f5f5f7] rounded-xl p-3 space-y-1 border border-[#d2d2d7]/50">
      <p className="text-[13px] font-semibold text-[#1d1d1f] leading-tight">
        {employee.name}
      </p>
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
