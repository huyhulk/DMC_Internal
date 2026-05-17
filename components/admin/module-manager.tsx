// components/admin/module-manager.tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { updateModuleConfig, updateSubtabConfig } from '@/modules/config/module-config-actions'
import type { ModuleNavConfig, SubtabNavConfig } from '@/modules/config/module-config'

interface Props {
  initialConfigs: ModuleNavConfig[]
}

export function ModuleManager({ initialConfigs }: Props) {
  const [configs, setConfigs] = useState<ModuleNavConfig[]>(initialConfigs)
  const [selectedKey, setSelectedKey] = useState<string>(initialConfigs[0]?.module_key ?? '')
  const [isPending, startTransition] = useTransition()

  const selected = configs.find((c) => c.module_key === selectedKey) ?? null

  function patchModule(moduleKey: string, patch: Partial<ModuleNavConfig>) {
    setConfigs((prev) =>
      prev.map((c) => (c.module_key === moduleKey ? { ...c, ...patch } : c))
    )
  }

  function patchSubtab(moduleKey: string, subtabKey: string, patch: Partial<SubtabNavConfig>) {
    setConfigs((prev) =>
      prev.map((c) => {
        if (c.module_key !== moduleKey) return c
        return {
          ...c,
          subtabs: c.subtabs.map((s) =>
            s.subtab_key === subtabKey ? { ...s, ...patch } : s
          ),
        }
      })
    )
  }

  function handleSaveModule() {
    if (!selected) return
    startTransition(async () => {
      const result = await updateModuleConfig({
        module_key:    selected.module_key,
        label:         selected.label,
        is_enabled:    selected.is_enabled,
        display_order: selected.display_order,
      })
      if (result.error) toast.error(result.error)
      else toast.success('Đã lưu cấu hình module')
    })
  }

  function handleSaveSubtab(subtab: SubtabNavConfig) {
    if (!selected) return
    startTransition(async () => {
      const result = await updateSubtabConfig({
        module_key:    selected.module_key,
        subtab_key:    subtab.subtab_key,
        label:         subtab.label,
        is_enabled:    subtab.is_enabled,
        display_order: subtab.display_order,
      })
      if (result.error) toast.error(result.error)
      else toast.success(`Đã lưu sub-tab "${subtab.label}"`)
    })
  }

  return (
    <div className="flex gap-4">

      {/* ── Left panel: module list ── */}
      <div className="w-52 shrink-0 rounded-2xl border border-[#d2d2d7]/70 bg-white overflow-hidden self-start">
        <div className="px-3 pt-3 pb-2 border-b border-[#d2d2d7]/50">
          <span className="text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.07em]">
            Modules
          </span>
        </div>
        <div className="py-1.5">
          {configs.map((cfg) => (
            <button
              key={cfg.module_key}
              onClick={() => setSelectedKey(cfg.module_key)}
              className={cn(
                'w-[calc(100%-8px)] mx-1 flex items-center justify-between gap-2',
                'px-3 py-2.5 rounded-xl text-left',
                'text-[13px] font-medium transition-colors',
                selectedKey === cfg.module_key
                  ? 'bg-[#3b5bdb]/8 text-[#3b5bdb]'
                  : 'text-[#1d1d1f] hover:bg-[#f2f2f7]'
              )}
            >
              <span className="truncate">{cfg.label}</span>
              <span className={cn(
                'shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                cfg.is_enabled
                  ? 'bg-[#2f9e44]/10 text-[#2f9e44]'
                  : 'bg-[#868e96]/10 text-[#868e96]'
              )}>
                {cfg.is_enabled ? 'ON' : 'OFF'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right panel: settings ── */}
      {selected && (
        <div className="flex-1 min-w-0 space-y-4">

          {/* Module top-level settings */}
          <div className="rounded-2xl border border-[#d2d2d7]/70 bg-white p-5">
            <h2 className="text-[14px] font-semibold text-[#1d1d1f] mb-4">
              Module: <span className="text-[#3b5bdb]">{selected.module_key}</span>
            </h2>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="w-28 text-[12px] text-[#6e6e73] shrink-0">Tên hiển thị</label>
                <input
                  type="text"
                  value={selected.label}
                  onChange={(e) => patchModule(selected.module_key, { label: e.target.value })}
                  className="flex-1 px-3 py-1.5 text-[13px] rounded-xl border border-[#d2d2d7]
                             focus:outline-none focus:ring-2 focus:ring-[#3b5bdb]/30 bg-white"
                  maxLength={50}
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="w-28 text-[12px] text-[#6e6e73] shrink-0">Trạng thái</span>
                <button
                  onClick={() => {
                    if (selected.module_key === 'admin') {
                      toast.error('Không thể tắt module Hệ Thống')
                      return
                    }
                    patchModule(selected.module_key, { is_enabled: !selected.is_enabled })
                  }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-medium border transition-colors',
                    selected.is_enabled
                      ? 'bg-[#2f9e44]/10 text-[#2f9e44] border-[#2f9e44]/30 hover:bg-[#2f9e44]/15'
                      : 'bg-[#868e96]/10 text-[#868e96] border-[#868e96]/30 hover:bg-[#868e96]/15'
                  )}
                >
                  <span className={cn(
                    'w-2 h-2 rounded-full',
                    selected.is_enabled ? 'bg-[#2f9e44]' : 'bg-[#868e96]'
                  )} />
                  {selected.is_enabled ? 'Đang bật' : 'Đang tắt'}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <label className="w-28 text-[12px] text-[#6e6e73] shrink-0">Thứ tự</label>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={selected.display_order}
                  onChange={(e) => patchModule(selected.module_key, { display_order: Number(e.target.value) })}
                  className="w-20 px-3 py-1.5 text-[13px] rounded-xl border border-[#d2d2d7]
                             focus:outline-none focus:ring-2 focus:ring-[#3b5bdb]/30 bg-white"
                />
              </div>
            </div>

            <button
              onClick={handleSaveModule}
              disabled={isPending}
              className="mt-4 px-4 py-2 rounded-xl bg-[#3b5bdb] text-white text-[13px]
                         font-medium hover:bg-[#3351c5] active:scale-[0.98]
                         transition-all disabled:opacity-50"
            >
              {isPending ? 'Đang lưu…' : 'Lưu module'}
            </button>
          </div>

          {/* Sub-tab settings */}
          {selected.subtabs.length > 0 && (
            <div className="rounded-2xl border border-[#d2d2d7]/70 bg-white p-5">
              <h2 className="text-[14px] font-semibold text-[#1d1d1f] mb-4">Sub-tabs</h2>
              <div className="space-y-2">
                {selected.subtabs.map((subtab) => (
                  <div key={subtab.subtab_key} className="flex items-center gap-3 p-3 rounded-xl bg-[#f5f5f7]">
                    <button
                      onClick={() => patchSubtab(selected.module_key, subtab.subtab_key, { is_enabled: !subtab.is_enabled })}
                      title={subtab.is_enabled ? 'Tắt sub-tab này' : 'Bật sub-tab này'}
                      className={cn(
                        'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold border transition-colors',
                        subtab.is_enabled
                          ? 'bg-[#2f9e44]/10 text-[#2f9e44] border-[#2f9e44]/30'
                          : 'bg-[#868e96]/10 text-[#868e96] border-[#868e96]/30'
                      )}
                    >
                      {subtab.is_enabled ? '✓' : '✕'}
                    </button>
                    <input
                      type="text"
                      value={subtab.label}
                      onChange={(e) => patchSubtab(selected.module_key, subtab.subtab_key, { label: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 text-[12px] rounded-lg border border-[#d2d2d7]
                                 focus:outline-none focus:ring-2 focus:ring-[#3b5bdb]/30 bg-white"
                      maxLength={50}
                    />
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={subtab.display_order}
                      onChange={(e) => patchSubtab(selected.module_key, subtab.subtab_key, { display_order: Number(e.target.value) })}
                      className="w-14 px-2 py-1.5 text-[12px] rounded-lg border border-[#d2d2d7]
                                 focus:outline-none focus:ring-2 focus:ring-[#3b5bdb]/30 bg-white text-center"
                    />
                    <button
                      onClick={() => handleSaveSubtab(subtab)}
                      disabled={isPending}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-[#3b5bdb]/10 text-[#3b5bdb]
                                 text-[11px] font-medium hover:bg-[#3b5bdb]/20 transition-colors disabled:opacity-50"
                    >
                      Lưu
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
