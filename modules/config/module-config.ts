// modules/config/module-config.ts

export interface SubtabNavConfig {
  subtab_key: string
  label: string
  is_enabled: boolean
  display_order: number
}

export interface ModuleNavConfig {
  module_key: string
  label: string
  is_enabled: boolean
  display_order: number
  subtabs: SubtabNavConfig[]
}

// Static fallback — mirrors current hardcoded values in modules/navigation/dashboard.ts
// Used when DB is empty or unreachable.
export const STATIC_MODULE_NAV_CONFIGS: ModuleNavConfig[] = [
  {
    module_key: 'production',
    label: 'Sản Xuất',
    is_enabled: true,
    display_order: 1,
    subtabs: [],
  },
  {
    module_key: 'maintenance',
    label: 'Bảo Trì',
    is_enabled: true,
    display_order: 2,
    subtabs: [
      { subtab_key: 'breakdowns', label: 'Sự Cố Máy',   is_enabled: true, display_order: 1 },
      { subtab_key: 'schedule',   label: 'Lịch Bảo Trì', is_enabled: true, display_order: 2 },
      { subtab_key: 'drawings',   label: 'Bản Vẽ KT',    is_enabled: true, display_order: 3 },
      { subtab_key: 'surveys',    label: 'Khảo Sát',     is_enabled: true, display_order: 4 },
      { subtab_key: 'machines',   label: 'Thiết Bị',     is_enabled: true, display_order: 5 },
    ],
  },
  {
    module_key: 'coordination',
    label: 'Điều Phối',
    is_enabled: true,
    display_order: 3,
    subtabs: [
      { subtab_key: 'delivery',   label: 'Giao Hàng',           is_enabled: true, display_order: 1 },
      { subtab_key: 'findings5s', label: 'Kho nguyên phụ liệu', is_enabled: true, display_order: 2 },
      { subtab_key: 'reports',    label: 'Báo Cáo TK',          is_enabled: true, display_order: 3 },
    ],
  },
  {
    module_key: 'administration',
    label: 'HC-NS',
    is_enabled: true,
    display_order: 4,
    subtabs: [
      { subtab_key: 'overtime',       label: 'Tăng ca',       is_enabled: true, display_order: 1 },
      { subtab_key: 'hr',             label: 'Nhân sự',       is_enabled: true, display_order: 2 },
      { subtab_key: 'hr-performance', label: 'Hiệu suất NS',  is_enabled: true, display_order: 3 },
      { subtab_key: 'findings5s',     label: '5S',            is_enabled: true, display_order: 4 },
      { subtab_key: 'iso',            label: 'Quy trình ISO', is_enabled: true, display_order: 5 },
    ],
  },
  {
    module_key: 'report',
    label: 'Báo Cáo',
    is_enabled: true,
    display_order: 5,
    subtabs: [],
  },
  {
    module_key: 'admin',
    label: 'Hệ Thống',
    is_enabled: true,
    display_order: 6,
    subtabs: [],
  },
]
