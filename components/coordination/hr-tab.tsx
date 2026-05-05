'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { Settings2 } from 'lucide-react'
import { format, parse, isValid } from 'date-fns'
import { HRColumn } from './hr-column'
import { HRAdminModal } from './hr-admin-modal'
import { saveHRDaily } from '@/lib/actions/hr'
import { getTodayLocal, getUserWorkspaces } from '@/lib/utils'
import { HR_DAILY_GROUPS, type SessionUser, type HumanResource, type HRDayData, type HRDailyGroupKey, type HRTransferRecord } from '@/types'

type FactoryState = Record<HRDailyGroupKey, { totalem: number; absentIds: number[]; transferRecords: HRTransferRecord[] }>

function buildDefaultState(): FactoryState {
  const base: Partial<FactoryState> = {}
  for (const f of HR_DAILY_GROUPS) {
    base[f] = { totalem: 0, absentIds: [], transferRecords: [] }
  }
  return base as FactoryState
}

interface Props {
  user: SessionUser
  canEdit: boolean
}

export function HRTab({ user, canEdit }: Props) {
  const today = getTodayLocal()

  const visibleFactories = useMemo((): readonly HRDailyGroupKey[] => {
    if (user.role === 'ADMIN') return HR_DAILY_GROUPS
    const ws = getUserWorkspaces(user.workspace)
    if (ws.length === 0) return HR_DAILY_GROUPS
    return HR_DAILY_GROUPS.filter((f) => ws.includes(f))
  }, [user.role, user.workspace])

  // ADMIN can edit all. Others can only edit their assigned factories.
  // Empty/ALL workspace → no restriction (edit all visible).
  const editableFactories = useMemo((): Set<HRDailyGroupKey> => {
    if (!canEdit) return new Set()
    if (user.role === 'ADMIN') return new Set(HR_DAILY_GROUPS)
    const ws = getUserWorkspaces(user.workspace)
    if (ws.length === 0) return new Set(HR_DAILY_GROUPS)
    return new Set(ws.filter((w): w is HRDailyGroupKey => (HR_DAILY_GROUPS as readonly string[]).includes(w)))
  }, [canEdit, user.role, user.workspace])

  const [date, setDate]               = useState<string>(today)
  const [employees, setEmployees]     = useState<HumanResource[]>([])
  const [factoryState, setFactoryState] = useState<FactoryState>(() => buildDefaultState())
  const [saving, setSaving]           = useState<Record<HRDailyGroupKey, boolean>>({
    DMC1: false, DMC3: false, DMC4: false, DMC5: false, 'PKT-SX': false, 'DIEU-PHOI': false,
  })
  const [loading, setLoading] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  const loadData = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/hr?date=${d}`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`HTTP ${res.status}: ${body}`)
      }
      const json = await res.json() as { employees: HumanResource[]; dailyData: HRDayData[] }

      setEmployees(json.employees)

      const next = buildDefaultState()
      for (const row of json.dailyData) {
        const key = row.factory
        if (key in next) {
          next[key] = { totalem: row.totalem, absentIds: row.absentIds, transferRecords: row.transferRecords }
        }
      }
      setFactoryState(next)
    } catch (err) {
      toast.error(`Lỗi tải nhân sự: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData(date) }, [date, loadData])

  const toggleAbsent = useCallback((factory: HRDailyGroupKey, empId: number) => {
    setFactoryState((prev) => {
      const current = prev[factory].absentIds
      const nextAbsent = current.includes(empId)
        ? current.filter((id) => id !== empId)
        : [...current, empId]
      const nextTransferRecords = prev[factory].transferRecords.filter((record) => record.employeeId !== empId)
      return { ...prev, [factory]: { ...prev[factory], absentIds: nextAbsent, transferRecords: nextTransferRecords } }
    })
  }, [])

  const toggleTransferred = useCallback((factory: HRDailyGroupKey, empId: number) => {
    setFactoryState((prev) => {
      const current = prev[factory].transferRecords
      const exists = current.some((record) => record.employeeId === empId)
      const nextTransferRecords = exists
        ? current.filter((record) => record.employeeId !== empId)
        : [...current, {
            employeeId: empId,
            fromFactory: factory,
            toFactory: HR_DAILY_GROUPS.find((group) => group !== factory) ?? factory,
            startTime: '',
            endTime: '',
          }]
      const nextAbsent = prev[factory].absentIds.filter((id) => id !== empId)
      return { ...prev, [factory]: { ...prev[factory], absentIds: nextAbsent, transferRecords: nextTransferRecords } }
    })
  }, [])

  const updateTransferRecord = useCallback((factory: HRDailyGroupKey, empId: number, field: 'toFactory' | 'startTime' | 'endTime', value: string) => {
    setFactoryState((prev) => ({
      ...prev,
      [factory]: {
        ...prev[factory],
        transferRecords: prev[factory].transferRecords.map((record) => (
          record.employeeId === empId ? { ...record, [field]: value } : record
        )),
      },
    }))
  }, [])

  const handleSave = useCallback(async (factory: HRDailyGroupKey) => {
    if (!canEdit) {
      toast.error('Bạn chỉ có quyền xem tab này.')
      return
    }
    const { absentIds, transferRecords } = factoryState[factory]
    setSaving((prev) => ({ ...prev, [factory]: true }))
    try {
      const result = await saveHRDaily(date, factory, absentIds, transferRecords)
      if (result.success) {
        toast.success(`Đã lưu nhân sự ${factory}`)
      } else {
        toast.error(result.error ?? 'Lưu thất bại')
      }
    } catch {
      toast.error('Lỗi kết nối, vui lòng thử lại')
    } finally {
      setSaving((prev) => ({ ...prev, [factory]: false }))
    }
  }, [canEdit, date, factoryState])

  function formatDateLabel(d: string): string {
    try {
      const parsed = parse(d, 'yyyy-MM-dd', new Date())
      return isValid(parsed) ? format(parsed, 'dd/MM/yyyy') : d
    } catch { return d }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#f5f5f7]">

      {/* Top bar */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[#d2d2d7]/60 bg-white">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[#6e6e73] tracking-[0.02em]">Ngày</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 px-3 rounded-xl bg-[#f2f2f7] border border-[#d2d2d7]/70
                         text-[13px] font-medium text-[#1d1d1f]
                         focus:outline-none focus:ring-1 focus:ring-[#3b5bdb]/40 transition-all"
            />
          </div>

          {canEdit && user.role === 'ADMIN' && (
            <button
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

      {/* Section label */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.07em]">
            Nhân sự làm việc trong ngày — {formatDateLabel(date)}
          </span>
          <div className="flex-1 h-px bg-[#d2d2d7]/50" />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-[#3b5bdb]/30 border-t-[#3b5bdb] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {visibleFactories.map((factory) => (
              <HRColumn
                key={factory}
                factory={factory}
                employees={employees.filter((e) => e.factory === factory)}
                totalem={factoryState[factory].totalem}
                absentIds={factoryState[factory].absentIds}
                transferredIds={factoryState[factory].transferRecords.map((record) => record.employeeId)}
                transferRecords={factoryState[factory].transferRecords}
                saving={saving[factory]}
                readOnly={!editableFactories.has(factory)}
                onAbsentToggle={(id) => toggleAbsent(factory, id)}
                onTransferredToggle={(id) => toggleTransferred(factory, id)}
                onTransferChange={(id, field, value) => updateTransferRecord(factory, id, field, value)}
                onSave={() => handleSave(factory)}
              />
            ))}
          </div>
        )}
      </div>

      <HRAdminModal
        open={adminOpen}
        canEdit={canEdit}
        onClose={() => setAdminOpen(false)}
        onRefresh={() => loadData(date)}
      />
    </div>
  )
}
