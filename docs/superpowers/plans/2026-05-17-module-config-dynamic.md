# Dynamic Module Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép admin bật/tắt, đổi label, điều chỉnh thứ tự và enable/disable sub-tab của từng module (production, maintenance, coordination, administration, report, admin) từ giao diện Hệ Thống, lưu cấu hình vào Supabase, với fallback về hardcode nếu DB chưa có data.

**Architecture:** Tạo 2 table Supabase (`module_configs`, `module_subtab_configs`) để lưu cấu hình; server-side loader `getModuleNavConfigs()` fetch từ DB với static fallback; dashboard layout truyền config xuống `DashboardShell` qua props; admin thêm trang `/dashboard/admin/modules` để CRUD.

**Tech Stack:** Next.js 16.2 App Router, Supabase PostgreSQL, TypeScript, Tailwind CSS, React `cache()`, Zod, Jest/ts-jest, Server Actions.

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `supabase/migrations/023_module_configs.sql` | Tạo tables, RLS policies, seed data mặc định |
| `modules/config/module-config.ts` | Types `ModuleNavConfig`/`SubtabNavConfig`, static fallback, `mergeWithStatic()`, `getModuleNavConfigs()` |
| `modules/config/module-config-actions.ts` | Server Actions: `updateModuleConfig`, `updateSubtabConfig` |
| `__tests__/module-config-merge.test.ts` | Unit tests cho `mergeWithStatic()` — pure function, no DB |
| `app/(dashboard)/dashboard/admin/modules/page.tsx` | Server Component: auth check + fetch + render `<ModuleManager>` |
| `components/admin/module-manager.tsx` | Client Component: 2-panel layout (module list + settings form) |

### Modified files
| File | What changes |
|---|---|
| `modules/permissions/tabs.ts` | Thêm `'admin.modules'` vào `PermissionKey` union, `PERMISSION_KEYS[]`, `PERMISSION_LABELS`, `DEFAULT_ROLE_PERMISSIONS` |
| `app/(dashboard)/dashboard/layout.tsx` | Thêm `getModuleNavConfigs()` vào parallel fetch; filter `visibleTabs` theo `is_enabled`; truyền `moduleNavConfigs` prop |
| `components/layout/dashboard-shell.tsx` | Nhận `moduleNavConfigs` prop; helper `getTabLabel()` + `getEnabledSubtabSet()`; dynamic label + subtab filter |
| `app/(dashboard)/dashboard/admin/page.tsx` | Thêm tab "Cài đặt Module" vào `ADMIN_TABS` |

---

## Task 1: Migration SQL — module_configs + module_subtab_configs

**Files:**
- Create: `supabase/migrations/023_module_configs.sql`

> Chạy migration trên staging Supabase (project `vfzjweyzwjczrxphnvaa`), KHÔNG chạy trên production.

- [ ] **Step 1.1: Tạo migration file**

```sql
-- supabase/migrations/023_module_configs.sql

-- ═══════════════════════════════════════════════
-- MODULE_CONFIGS: cấu hình từng module top-level
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.module_configs (
  module_key    TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  is_enabled    BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID REFERENCES auth.users(id)
);

ALTER TABLE public.module_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "module_configs_select_authenticated"
  ON public.module_configs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "module_configs_all_admin"
  ON public.module_configs FOR ALL
  TO authenticated
  USING   (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

CREATE TRIGGER handle_module_configs_updated_at
  BEFORE UPDATE ON public.module_configs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ═════════════════════════════════════════════════════
-- MODULE_SUBTAB_CONFIGS: cấu hình từng sub-tab theo module
-- ═════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.module_subtab_configs (
  module_key    TEXT NOT NULL REFERENCES public.module_configs(module_key) ON DELETE CASCADE,
  subtab_key    TEXT NOT NULL,
  label         TEXT NOT NULL,
  is_enabled    BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (module_key, subtab_key)
);

ALTER TABLE public.module_subtab_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "module_subtab_configs_select_authenticated"
  ON public.module_subtab_configs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "module_subtab_configs_all_admin"
  ON public.module_subtab_configs FOR ALL
  TO authenticated
  USING   (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- ═══════════════════════════════════════════════
-- SEED DATA — khớp với hardcode hiện tại trong code
-- ═══════════════════════════════════════════════
INSERT INTO public.module_configs (module_key, label, display_order) VALUES
  ('production',     'Sản Xuất',  1),
  ('maintenance',    'Bảo Trì',   2),
  ('coordination',   'Điều Phối', 3),
  ('administration', 'HC-NS',     4),
  ('report',         'Báo Cáo',   5),
  ('admin',          'Hệ Thống',  6)
ON CONFLICT (module_key) DO NOTHING;

INSERT INTO public.module_subtab_configs (module_key, subtab_key, label, display_order) VALUES
  ('maintenance', 'breakdowns', 'Sự Cố Máy',          1),
  ('maintenance', 'schedule',   'Lịch Bảo Trì',        2),
  ('maintenance', 'drawings',   'Bản Vẽ KT',           3),
  ('maintenance', 'surveys',    'Khảo Sát',            4),
  ('maintenance', 'machines',   'Thiết Bị',            5),
  ('coordination', 'delivery',   'Giao Hàng',          1),
  ('coordination', 'findings5s', 'Kho nguyên phụ liệu',2),
  ('coordination', 'reports',    'Báo Cáo TK',         3),
  ('administration', 'overtime',       'Tăng ca',       1),
  ('administration', 'hr',             'Nhân sự',       2),
  ('administration', 'hr-performance', 'Hiệu suất NS',  3),
  ('administration', 'findings5s',     '5S',            4),
  ('administration', 'iso',            'Quy trình ISO', 5)
ON CONFLICT (module_key, subtab_key) DO NOTHING;
```

- [ ] **Step 1.2: Apply migration trên staging**

```bash
# Chạy trong terminal của user (không chạy tự động)
supabase db push --db-url "postgresql://postgres:...@db.vfzjweyzwjczrxphnvaa.supabase.co:5432/postgres"
# Hoặc qua Supabase Dashboard > SQL Editor nếu không có Supabase CLI
```

Expected: 2 tables created, 6 module rows + 13 subtab rows inserted.

- [ ] **Step 1.3: Verify**

```sql
-- Chạy trong Supabase SQL Editor (staging)
SELECT module_key, label, is_enabled, display_order FROM module_configs ORDER BY display_order;
SELECT module_key, subtab_key, label, is_enabled FROM module_subtab_configs ORDER BY module_key, display_order;
```

Expected: 6 rows + 13 rows.

- [ ] **Step 1.4: Commit**

```bash
git add supabase/migrations/023_module_configs.sql
git commit -m "feat(db): add module_configs and module_subtab_configs tables (migration 023)"
```

---

## Task 2: TypeScript types + static fallback constants

**Files:**
- Create: `modules/config/module-config.ts` (chỉ phần types + constants, chưa có loader)

- [ ] **Step 2.1: Tạo file với types và static fallback**

```typescript
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
      { subtab_key: 'delivery',   label: 'Giao Hàng',          is_enabled: true, display_order: 1 },
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
      { subtab_key: 'overtime',        label: 'Tăng ca',       is_enabled: true, display_order: 1 },
      { subtab_key: 'hr',              label: 'Nhân sự',       is_enabled: true, display_order: 2 },
      { subtab_key: 'hr-performance',  label: 'Hiệu suất NS',  is_enabled: true, display_order: 3 },
      { subtab_key: 'findings5s',      label: '5S',            is_enabled: true, display_order: 4 },
      { subtab_key: 'iso',             label: 'Quy trình ISO', is_enabled: true, display_order: 5 },
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
```

- [ ] **Step 2.2: TypeScript check**

```bash
cd "D:/optimize app" && npx tsc --noEmit --project tsconfig.json 2>&1 | head -20
```

Expected: no errors related to `module-config.ts`.

---

## Task 3: `mergeWithStatic()` pure function + unit tests (TDD)

**Files:**
- Modify: `modules/config/module-config.ts` (thêm `mergeWithStatic`)
- Create: `__tests__/module-config-merge.test.ts`

- [ ] **Step 3.1: Viết failing tests trước**

```typescript
// __tests__/module-config-merge.test.ts
import {
  mergeWithStatic,
  STATIC_MODULE_NAV_CONFIGS,
  type ModuleNavConfig,
} from '@/modules/config/module-config'

describe('mergeWithStatic', () => {
  it('returns static defaults when dbConfigs is empty', () => {
    const result = mergeWithStatic([])
    expect(result).toEqual(STATIC_MODULE_NAV_CONFIGS)
  })

  it('overrides top-level label from DB', () => {
    const db: ModuleNavConfig[] = [
      { module_key: 'production', label: 'SX Tùy Chỉnh', is_enabled: true, display_order: 1, subtabs: [] },
    ]
    const result = mergeWithStatic(db)
    expect(result.find((m) => m.module_key === 'production')!.label).toBe('SX Tùy Chỉnh')
  })

  it('sets is_enabled = false from DB', () => {
    const db: ModuleNavConfig[] = [
      { module_key: 'maintenance', label: 'Bảo Trì', is_enabled: false, display_order: 2, subtabs: [] },
    ]
    const result = mergeWithStatic(db)
    expect(result.find((m) => m.module_key === 'maintenance')!.is_enabled).toBe(false)
  })

  it('keeps static subtabs when DB subtabs array is empty', () => {
    const db: ModuleNavConfig[] = [
      { module_key: 'maintenance', label: 'Bảo Trì', is_enabled: false, display_order: 2, subtabs: [] },
    ]
    const result = mergeWithStatic(db)
    expect(result.find((m) => m.module_key === 'maintenance')!.subtabs).toHaveLength(5)
  })

  it('overrides subtab is_enabled from DB', () => {
    const db: ModuleNavConfig[] = [
      {
        module_key: 'maintenance',
        label: 'Bảo Trì',
        is_enabled: true,
        display_order: 2,
        subtabs: [{ subtab_key: 'drawings', label: 'Bản Vẽ', is_enabled: false, display_order: 3 }],
      },
    ]
    const result = mergeWithStatic(db)
    const drawings = result
      .find((m) => m.module_key === 'maintenance')!
      .subtabs.find((s) => s.subtab_key === 'drawings')!
    expect(drawings.is_enabled).toBe(false)
    expect(drawings.label).toBe('Bản Vẽ')
  })

  it('preserves non-overridden subtabs from static', () => {
    const db: ModuleNavConfig[] = [
      {
        module_key: 'maintenance',
        label: 'Bảo Trì',
        is_enabled: true,
        display_order: 2,
        subtabs: [{ subtab_key: 'drawings', label: 'Bản Vẽ', is_enabled: false, display_order: 3 }],
      },
    ]
    const result = mergeWithStatic(db)
    const maint = result.find((m) => m.module_key === 'maintenance')!
    const breakdowns = maint.subtabs.find((s) => s.subtab_key === 'breakdowns')!
    expect(breakdowns.is_enabled).toBe(true)
  })

  it('sorts modules by display_order', () => {
    const db: ModuleNavConfig[] = [
      { module_key: 'maintenance', label: 'Bảo Trì', is_enabled: true, display_order: 99, subtabs: [] },
      { module_key: 'production',  label: 'Sản Xuất', is_enabled: true, display_order: 1, subtabs: [] },
    ]
    const result = mergeWithStatic(db)
    // DB overrides display_order, so production(1) comes before maintenance(99)
    const idx = (key: string) => result.findIndex((m) => m.module_key === key)
    expect(idx('production')).toBeLessThan(idx('maintenance'))
  })

  it('does not add unknown module_keys from DB', () => {
    const db: ModuleNavConfig[] = [
      { module_key: 'nonexistent', label: 'Ghost', is_enabled: true, display_order: 0, subtabs: [] },
    ]
    const result = mergeWithStatic(db)
    expect(result.find((m) => m.module_key === 'nonexistent')).toBeUndefined()
    expect(result).toHaveLength(STATIC_MODULE_NAV_CONFIGS.length)
  })
})
```

- [ ] **Step 3.2: Run tests — verify they FAIL**

```bash
cd "D:/optimize app" && npx jest __tests__/module-config-merge.test.ts --no-coverage 2>&1 | tail -10
```

Expected: `Cannot find module '@/modules/config/module-config'` or `mergeWithStatic is not a function`.

- [ ] **Step 3.3: Implement `mergeWithStatic` trong `modules/config/module-config.ts`**

Append sau phần `STATIC_MODULE_NAV_CONFIGS`:

```typescript
// Merges DB-sourced configs onto static defaults.
// DB can override: label, is_enabled, display_order, individual subtab fields.
// Unknown module_keys in DB are ignored (we only extend known modules).
export function mergeWithStatic(dbConfigs: ModuleNavConfig[]): ModuleNavConfig[] {
  return STATIC_MODULE_NAV_CONFIGS
    .map((staticModule) => {
      const dbModule = dbConfigs.find((d) => d.module_key === staticModule.module_key)
      if (!dbModule) return staticModule

      // Merge subtabs: override known subtab keys, keep the rest from static
      const mergedSubtabs = staticModule.subtabs.map((staticSub) => {
        const dbSub = dbModule.subtabs.find((s) => s.subtab_key === staticSub.subtab_key)
        return dbSub ? { ...staticSub, ...dbSub } : staticSub
      })

      return {
        ...staticModule,
        label: dbModule.label,
        is_enabled: dbModule.is_enabled,
        display_order: dbModule.display_order,
        subtabs: mergedSubtabs.sort((a, b) => a.display_order - b.display_order),
      }
    })
    .sort((a, b) => a.display_order - b.display_order)
}
```

- [ ] **Step 3.4: Run tests — verify they PASS**

```bash
cd "D:/optimize app" && npx jest __tests__/module-config-merge.test.ts --no-coverage 2>&1 | tail -10
```

Expected: `Tests: 8 passed, 8 total`.

- [ ] **Step 3.5: Commit**

```bash
git add modules/config/module-config.ts __tests__/module-config-merge.test.ts
git commit -m "feat(config): add ModuleNavConfig types, static fallback, and mergeWithStatic()"
```

---

## Task 4: `getModuleNavConfigs()` server loader

**Files:**
- Modify: `modules/config/module-config.ts` (append loader)

- [ ] **Step 4.1: Thêm loader vào cuối `modules/config/module-config.ts`**

```typescript
// Thêm import ở đầu file (sau các exports hiện có):
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// Thêm vào cuối file:

interface DbModuleRow {
  module_key: string
  label: string
  is_enabled: boolean
  display_order: number
  module_subtab_configs: Array<{
    subtab_key: string
    label: string
    is_enabled: boolean
    display_order: number
  }>
}

// Server-only: cached per-request via React cache().
// Falls back to STATIC_MODULE_NAV_CONFIGS on DB error or empty result.
export const getModuleNavConfigs = cache(async (): Promise<ModuleNavConfig[]> => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('module_configs')
      .select(`
        module_key, label, is_enabled, display_order,
        module_subtab_configs ( subtab_key, label, is_enabled, display_order )
      `)
      .order('display_order')

    if (error || !data || data.length === 0) return STATIC_MODULE_NAV_CONFIGS

    const dbConfigs: ModuleNavConfig[] = (data as DbModuleRow[]).map((row) => ({
      module_key: row.module_key,
      label: row.label,
      is_enabled: row.is_enabled,
      display_order: row.display_order,
      subtabs: (row.module_subtab_configs ?? []).map((s) => ({
        subtab_key: s.subtab_key,
        label: s.label,
        is_enabled: s.is_enabled,
        display_order: s.display_order,
      })),
    }))

    return mergeWithStatic(dbConfigs)
  } catch {
    return STATIC_MODULE_NAV_CONFIGS
  }
})
```

- [ ] **Step 4.2: Export từ `modules/config/index.ts`**

```typescript
// modules/config/index.ts — thêm dòng này:
export * from '@/modules/config/module-config'
```

- [ ] **Step 4.3: TypeScript check**

```bash
cd "D:/optimize app" && npx tsc --noEmit 2>&1 | grep "module-config" | head -10
```

Expected: no errors on module-config.ts.

- [ ] **Step 4.4: Commit**

```bash
git add modules/config/module-config.ts modules/config/index.ts
git commit -m "feat(config): add getModuleNavConfigs() server loader with DB + static fallback"
```

---

## Task 5: Thêm `admin.modules` permission key

**Files:**
- Modify: `modules/permissions/tabs.ts`

- [ ] **Step 5.1: Sửa `modules/permissions/tabs.ts`**

Thêm `'admin.modules'` vào 4 nơi:

**a) PermissionKey union** (dòng ~22, sau `'admin.kpi-settings'`):
```typescript
// Tìm:
  | 'admin.kpi-settings'

// Thay bằng:
  | 'admin.kpi-settings'
  | 'admin.modules'
```

**b) PERMISSION_KEYS array** (dòng ~55, sau `'admin.kpi-settings'`):
```typescript
// Tìm:
  'admin.kpi-settings',
]

// Thay bằng:
  'admin.kpi-settings',
  'admin.modules',
]
```

**c) PERMISSION_LABELS** (dòng ~79, sau entry kpi-settings):
```typescript
// Tìm:
  'admin.kpi-settings': { label: 'Cài đặt KPI', group: 'Hệ Thống' },

// Thay bằng:
  'admin.kpi-settings': { label: 'Cài đặt KPI',    group: 'Hệ Thống' },
  'admin.modules':      { label: 'Cài đặt Module', group: 'Hệ Thống' },
```

**d) DEFAULT_ROLE_PERMISSIONS.ADMIN** (dòng ~90, ADMIN đang có `Object.fromEntries` cho tất cả keys — không cần sửa vì nó dùng `PERMISSION_KEYS.map` tự động):

Không cần sửa phần ADMIN vì `DEFAULT_ROLE_PERMISSIONS.ADMIN` dùng:
```typescript
ADMIN: matrix(Object.fromEntries(PERMISSION_KEYS.map((key) => [key, 'edit'])) as RolePermissionMatrix),
```
Thêm `'admin.modules'` vào `PERMISSION_KEYS` đã đủ cho ADMIN.

- [ ] **Step 5.2: Verify TypeScript**

```bash
cd "D:/optimize app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 5.3: Commit**

```bash
git add modules/permissions/tabs.ts
git commit -m "feat(permissions): add admin.modules permission key"
```

---

## Task 6: Update Dashboard layout — fetch + filter moduleNavConfigs

**Files:**
- Modify: `app/(dashboard)/dashboard/layout.tsx`

- [ ] **Step 6.1: Sửa `app/(dashboard)/dashboard/layout.tsx`**

```typescript
// app/(dashboard)/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/modules/auth/actions'
import { getVisiblePermissionKeys, getVisibleTopLevelTabs } from '@/modules/permissions/server'
import { getModuleNavConfigs } from '@/modules/config/module-config'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import type { TabId } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [visibleTabsByRole, visiblePermissionKeys, moduleNavConfigs] = await Promise.all([
    getVisibleTopLevelTabs(user.role),
    getVisiblePermissionKeys(user.role),
    getModuleNavConfigs(),
  ])

  // Tab must be permitted by role AND not disabled in module_configs.
  // If module_key has no DB entry (new tab not yet in DB), allow it through.
  const moduleKeySet = new Set(moduleNavConfigs.map((m) => m.module_key))
  const visibleTabs = visibleTabsByRole.filter((tabKey) => {
    const cfg = moduleNavConfigs.find((m) => m.module_key === tabKey)
    if (!cfg) return true        // not in DB → default enabled
    if (tabKey === 'admin') return true  // admin tab cannot be disabled for ADMIN role
    return cfg.is_enabled
  }) as TabId[]

  return (
    <DashboardShell
      user={user}
      visibleTabs={visibleTabs}
      visiblePermissionKeys={visiblePermissionKeys}
      moduleNavConfigs={moduleNavConfigs}
    >
      {children}
    </DashboardShell>
  )
}
```

- [ ] **Step 6.2: TypeScript check — expect error về props `DashboardShell` chưa nhận `moduleNavConfigs`**

```bash
cd "D:/optimize app" && npx tsc --noEmit 2>&1 | grep "moduleNavConfigs" | head -5
```

Expected: 1 error về `moduleNavConfigs` — đây là expected, sẽ fix ở Task 7.

---

## Task 7: Update DashboardShell — dynamic labels + subtab filtering

**Files:**
- Modify: `components/layout/dashboard-shell.tsx`

> File này có 830 dòng. Chỉ thêm/sửa các chỗ cụ thể, không refactor gì khác.

- [ ] **Step 7.1: Thêm import `ModuleNavConfig` vào đầu file**

```typescript
// Tìm dòng:
import { cn } from '@/lib/utils'

// Thêm vào sau:
import type { ModuleNavConfig } from '@/modules/config/module-config'
```

- [ ] **Step 7.2: Thêm `moduleNavConfigs` vào `Props` interface**

```typescript
// Tìm:
interface Props {
  user: SessionUser
  visibleTabs: TabId[]
  visiblePermissionKeys: PermissionKey[]
  children: React.ReactNode
}

// Thay bằng:
interface Props {
  user: SessionUser
  visibleTabs: TabId[]
  visiblePermissionKeys: PermissionKey[]
  moduleNavConfigs: ModuleNavConfig[]
  children: React.ReactNode
}
```

- [ ] **Step 7.3: Cập nhật destructure trong `DashboardShell` function signature**

```typescript
// Tìm:
export function DashboardShell({ user, visibleTabs, visiblePermissionKeys, children }: Props) {

// Thay bằng:
export function DashboardShell({ user, visibleTabs, visiblePermissionKeys, moduleNavConfigs, children }: Props) {
```

- [ ] **Step 7.4: Thêm 2 helper functions ngay sau dòng destructure (trước các useState)**

```typescript
// Thêm ngay sau dòng function signature:
  function getTabLabel(key: string): string {
    return moduleNavConfigs.find((c) => c.module_key === key)?.label
      ?? TAB_CONFIG[key as keyof typeof TAB_CONFIG]?.label
      ?? key
  }

  function getEnabledSubtabSet(moduleKey: string): Set<string> | null {
    const module = moduleNavConfigs.find((c) => c.module_key === moduleKey)
    if (!module || module.subtabs.length === 0) return null  // null = all enabled
    return new Set(module.subtabs.filter((s) => s.is_enabled).map((s) => s.subtab_key))
  }

  function resolveSubtabLabel(moduleKey: string, subtabKey: string, staticLabel: string): string {
    const module = moduleNavConfigs.find((c) => c.module_key === moduleKey)
    return module?.subtabs.find((s) => s.subtab_key === subtabKey)?.label ?? staticLabel
  }
```

- [ ] **Step 7.5: Cập nhật 3 dòng filter maintenanceItems / coordinationItems / administrationItems**

```typescript
// Tìm:
  const maintenanceItems = MAINTENANCE_ITEMS.filter((item) => visiblePermissionSet.has(`maintenance.${item.code}` as PermissionKey))
  const coordinationItems = COORDINATION_ITEMS.filter((item) => visiblePermissionSet.has(`coordination.${item.code}` as PermissionKey))
  const administrationItems = ADMINISTRATION_ITEMS.filter((item) => visiblePermissionSet.has(`administration.${item.code}` as PermissionKey))

// Thay bằng:
  const maintEnabledSubs = getEnabledSubtabSet('maintenance')
  const maintenanceItems = MAINTENANCE_ITEMS
    .filter((item) => visiblePermissionSet.has(`maintenance.${item.code}` as PermissionKey))
    .filter((item) => maintEnabledSubs === null || maintEnabledSubs.has(item.code))
    .map((item) => ({ ...item, label: resolveSubtabLabel('maintenance', item.code, item.label) }))

  const coordEnabledSubs = getEnabledSubtabSet('coordination')
  const coordinationItems = COORDINATION_ITEMS
    .filter((item) => visiblePermissionSet.has(`coordination.${item.code}` as PermissionKey))
    .filter((item) => coordEnabledSubs === null || coordEnabledSubs.has(item.code))
    .map((item) => ({ ...item, label: resolveSubtabLabel('coordination', item.code, item.label) }))

  const adminEnabledSubs = getEnabledSubtabSet('administration')
  const administrationItems = ADMINISTRATION_ITEMS
    .filter((item) => visiblePermissionSet.has(`administration.${item.code}` as PermissionKey))
    .filter((item) => adminEnabledSubs === null || adminEnabledSubs.has(item.code))
    .map((item) => ({ ...item, label: resolveSubtabLabel('administration', item.code, item.label) }))
```

- [ ] **Step 7.6: Thay hardcoded label strings trong phần render tab**

Tìm và thay 3 nơi dùng hardcoded string thay vì `cfg.label`:

```typescript
// Nơi 1 — maintenance tab render (dòng ~285):
// Tìm:  <span>Bảo Trì</span>
// Thay: <span>{getTabLabel('maintenance')}</span>

// Nơi 2 — admin tab render (dòng ~430):
// Tìm:  <span>Hệ Thống</span>
// Thay: <span>{getTabLabel('admin')}</span>

// Nơi 3 — report tab render (dòng ~480):
// Tìm:  <span>Báo Cáo</span>
// Thay: <span>{getTabLabel('report')}</span>
```

Các tab dùng `{cfg.label}` (coordination, administration, production, regular tabs) đã đúng — không cần sửa thêm vì `cfg = TAB_CONFIG[tabKey]` là static. Nếu muốn cũng dynamic, thêm `{getTabLabel(tabKey)}` thay `{cfg.label}` ở phần "Regular tab" (line ~524).

```typescript
// Tìm trong Regular tab section:
                  <span>{cfg.label}</span>

// Thay bằng:
                  <span>{getTabLabel(tabKey)}</span>
```

- [ ] **Step 7.7: TypeScript check — phải 0 errors**

```bash
cd "D:/optimize app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7.8: Smoke test — start dev server**

```bash
cd "D:/optimize app" && npm run dev
```

Mở `http://localhost:3000/dashboard`, verify:
- [ ] Navigation tabs hiển thị bình thường
- [ ] Dropdown menus maintenance/coordination/administration hoạt động
- [ ] Không có JS error trong console

- [ ] **Step 7.9: Commit**

```bash
git add components/layout/dashboard-shell.tsx app/(dashboard)/dashboard/layout.tsx
git commit -m "feat(nav): wire moduleNavConfigs prop — dynamic labels and subtab filtering"
```

---

## Task 8: Server Actions cho module config CRUD

**Files:**
- Create: `modules/config/module-config-actions.ts`

- [ ] **Step 8.1: Viết failing tests trước**

> Test cho server actions cần mock `createClient` và `requireTabEdit`.

```typescript
// __tests__/module-config-actions.test.ts
import { updateModuleConfig, updateSubtabConfig } from '@/modules/config/module-config-actions'

// Mock Supabase
const mockUpsert = jest.fn().mockResolvedValue({ error: null })
const mockFrom = jest.fn().mockReturnValue({ upsert: mockUpsert })

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({ from: mockFrom }),
}))

// Mock requireTabEdit
jest.mock('@/modules/permissions/server', () => ({
  requireTabEdit: jest.fn(),
}))

// Mock revalidatePath
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { requireTabEdit } from '@/modules/permissions/server'
const mockRequireTabEdit = requireTabEdit as jest.MockedFunction<typeof requireTabEdit>

describe('updateModuleConfig', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns error when user is not ADMIN', async () => {
    mockRequireTabEdit.mockResolvedValue(null)
    const result = await updateModuleConfig({
      module_key: 'production', label: 'SX', is_enabled: true, display_order: 1,
    })
    expect(result.error).toBe('Unauthorized')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('prevents disabling admin module', async () => {
    mockRequireTabEdit.mockResolvedValue({ id: 'user-1', role: 'ADMIN', username: 'admin', workspace: 'ALL', email: 'a@b.com' })
    const result = await updateModuleConfig({
      module_key: 'admin', label: 'Hệ Thống', is_enabled: false, display_order: 6,
    })
    expect(result.error).toMatch(/tắt/)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('calls upsert and returns empty on success', async () => {
    mockRequireTabEdit.mockResolvedValue({ id: 'user-1', role: 'ADMIN', username: 'admin', workspace: 'ALL', email: 'a@b.com' })
    const result = await updateModuleConfig({
      module_key: 'production', label: 'Sản Xuất Mới', is_enabled: true, display_order: 1,
    })
    expect(result.error).toBeUndefined()
    expect(mockFrom).toHaveBeenCalledWith('module_configs')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ module_key: 'production', label: 'Sản Xuất Mới' }),
      { onConflict: 'module_key' }
    )
  })

  it('returns DB error message when upsert fails', async () => {
    mockRequireTabEdit.mockResolvedValue({ id: 'user-1', role: 'ADMIN', username: 'admin', workspace: 'ALL', email: 'a@b.com' })
    mockUpsert.mockResolvedValueOnce({ error: { message: 'DB error' } })
    const result = await updateModuleConfig({
      module_key: 'production', label: 'SX', is_enabled: true, display_order: 1,
    })
    expect(result.error).toBe('DB error')
  })
})

describe('updateSubtabConfig', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns error when user is not ADMIN', async () => {
    mockRequireTabEdit.mockResolvedValue(null)
    const result = await updateSubtabConfig({
      module_key: 'maintenance', subtab_key: 'drawings', label: 'Bản Vẽ',
      is_enabled: false, display_order: 3,
    })
    expect(result.error).toBe('Unauthorized')
  })

  it('calls upsert with correct args on success', async () => {
    mockRequireTabEdit.mockResolvedValue({ id: 'user-1', role: 'ADMIN', username: 'admin', workspace: 'ALL', email: 'a@b.com' })
    const result = await updateSubtabConfig({
      module_key: 'maintenance', subtab_key: 'drawings', label: 'Bản Vẽ',
      is_enabled: false, display_order: 3,
    })
    expect(result.error).toBeUndefined()
    expect(mockFrom).toHaveBeenCalledWith('module_subtab_configs')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ module_key: 'maintenance', subtab_key: 'drawings', is_enabled: false }),
      { onConflict: 'module_key,subtab_key' }
    )
  })
})
```

- [ ] **Step 8.2: Run tests — verify they FAIL**

```bash
cd "D:/optimize app" && npx jest __tests__/module-config-actions.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Cannot find module '@/modules/config/module-config-actions'`.

- [ ] **Step 8.3: Implement `modules/config/module-config-actions.ts`**

```typescript
// modules/config/module-config-actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireTabEdit } from '@/modules/permissions/server'

const UpdateModuleConfigSchema = z.object({
  module_key:    z.string().min(1),
  label:         z.string().min(1).max(50),
  is_enabled:    z.boolean(),
  display_order: z.number().int().min(0).max(99),
})

const UpdateSubtabConfigSchema = z.object({
  module_key:    z.string().min(1),
  subtab_key:    z.string().min(1),
  label:         z.string().min(1).max(50),
  is_enabled:    z.boolean(),
  display_order: z.number().int().min(0).max(99),
})

export async function updateModuleConfig(
  input: z.infer<typeof UpdateModuleConfigSchema>
): Promise<{ error?: string }> {
  const user = await requireTabEdit('admin')
  if (!user) return { error: 'Unauthorized' }

  if (input.module_key === 'admin' && !input.is_enabled) {
    return { error: 'Không thể tắt module Hệ Thống' }
  }

  const parsed = UpdateModuleConfigSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('module_configs')
    .upsert(
      {
        module_key:    parsed.data.module_key,
        label:         parsed.data.label,
        is_enabled:    parsed.data.is_enabled,
        display_order: parsed.data.display_order,
        updated_by:    user.id,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: 'module_key' }
    )

  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
  return {}
}

export async function updateSubtabConfig(
  input: z.infer<typeof UpdateSubtabConfigSchema>
): Promise<{ error?: string }> {
  const user = await requireTabEdit('admin')
  if (!user) return { error: 'Unauthorized' }

  const parsed = UpdateSubtabConfigSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('module_subtab_configs')
    .upsert(
      {
        module_key:    parsed.data.module_key,
        subtab_key:    parsed.data.subtab_key,
        label:         parsed.data.label,
        is_enabled:    parsed.data.is_enabled,
        display_order: parsed.data.display_order,
      },
      { onConflict: 'module_key,subtab_key' }
    )

  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
  return {}
}
```

- [ ] **Step 8.4: Run tests — verify they PASS**

```bash
cd "D:/optimize app" && npx jest __tests__/module-config-actions.test.ts --no-coverage 2>&1 | tail -10
```

Expected: `Tests: 6 passed, 6 total`.

- [ ] **Step 8.5: Export từ `modules/config/index.ts`**

```typescript
// modules/config/index.ts — thêm dòng:
export * from '@/modules/config/module-config-actions'
```

- [ ] **Step 8.6: Commit**

```bash
git add modules/config/module-config-actions.ts modules/config/index.ts __tests__/module-config-actions.test.ts
git commit -m "feat(config): add updateModuleConfig and updateSubtabConfig server actions"
```

---

## Task 9: Admin modules page (Server Component)

**Files:**
- Create: `app/(dashboard)/dashboard/admin/modules/page.tsx`
- Modify: `app/(dashboard)/dashboard/admin/page.tsx`

- [ ] **Step 9.1: Tạo `app/(dashboard)/dashboard/admin/modules/page.tsx`**

```typescript
// app/(dashboard)/dashboard/admin/modules/page.tsx
import { redirect } from 'next/navigation'
import { requireTabView } from '@/modules/permissions/server'
import { getSessionUser } from '@/modules/auth/actions'
import { getModuleNavConfigs } from '@/modules/config/module-config'
import { ModuleManager } from '@/components/admin/module-manager'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Cài đặt Module | DMC Production' }

export default async function AdminModulesPage() {
  const user = await requireTabView('admin')
  if (!user) {
    const sessionUser = await getSessionUser()
    redirect(sessionUser ? '/dashboard' : '/login')
  }
  if (user.role !== 'ADMIN') redirect('/dashboard/admin')

  const moduleNavConfigs = await getModuleNavConfigs()

  return (
    <div className="h-full overflow-hidden bg-[#f5f5f7]">
      <div className="h-full overflow-y-auto px-6 py-5">
        <div className="mb-5">
          <h1 className="text-[18px] font-semibold text-[#1d1d1f]">Cài đặt Module</h1>
          <p className="text-[13px] text-[#6e6e73] mt-0.5">
            Bật/tắt module, đổi tên hiển thị, điều chỉnh thứ tự và quản lý sub-tab.
          </p>
        </div>
        <ModuleManager initialConfigs={moduleNavConfigs} />
      </div>
    </div>
  )
}
```

- [ ] **Step 9.2: Thêm tab "Cài đặt Module" vào `app/(dashboard)/dashboard/admin/page.tsx`**

```typescript
// Tìm:
const ADMIN_TABS = [
  { key: 'users', label: 'Người dùng', href: '/dashboard/admin' },
  { key: 'permissions', label: 'Phân quyền tab', href: '/dashboard/admin?sub=permissions' },
  { key: 'kpi-settings', label: 'Cài đặt KPI', href: '/dashboard/admin/kpi-settings' },
] as const

// Thay bằng:
const ADMIN_TABS = [
  { key: 'users',        label: 'Người dùng',      href: '/dashboard/admin' },
  { key: 'permissions',  label: 'Phân quyền tab',   href: '/dashboard/admin?sub=permissions' },
  { key: 'kpi-settings', label: 'Cài đặt KPI',      href: '/dashboard/admin/kpi-settings' },
  { key: 'modules',      label: 'Cài đặt Module',   href: '/dashboard/admin/modules' },
] as const
```

Cũng thêm "modules" vào `ADMIN_ITEMS` trong `components/layout/dashboard-shell.tsx`:

```typescript
// Tìm (cuối array ADMIN_ITEMS):
  { code: 'kpi-settings', label: 'Cài đặt KPI', icon: SlidersHorizontal, href: '/dashboard/admin/kpi-settings', permissionKey: 'admin.kpi-settings' as PermissionKey },
] as const

// Thay bằng:
  { code: 'kpi-settings', label: 'Cài đặt KPI',    icon: SlidersHorizontal, href: '/dashboard/admin/kpi-settings', permissionKey: 'admin.kpi-settings' as PermissionKey },
  { code: 'modules',      label: 'Cài đặt Module', icon: Layers,            href: '/dashboard/admin/modules',      permissionKey: 'admin.modules' as PermissionKey },
] as const
```

Thêm `Layers` vào import từ lucide-react (đầu file `dashboard-shell.tsx`):
```typescript
// Tìm:
import {
  Factory, Wrench, Users2, BarChart3,
  KeyRound, LogOut, ChevronDown,
  TrendingUp, ShieldCheck,
  Settings, Target, Clock, UserCog, SlidersHorizontal,
  Truck, ListChecks, FileText, BookCheck,
  AlertTriangle, CalendarClock, FileImage, Ruler, ClipboardList,
  type LucideIcon,
} from 'lucide-react'

// Thêm Layers vào list:
  ..., Layers,
```

- [ ] **Step 9.3: TypeScript check**

```bash
cd "D:/optimize app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 9.4: Commit**

```bash
git add app/(dashboard)/dashboard/admin/modules/page.tsx \
        app/(dashboard)/dashboard/admin/page.tsx \
        components/layout/dashboard-shell.tsx
git commit -m "feat(admin): add /admin/modules page and nav entry"
```

---

## Task 10: Module Manager client component

**Files:**
- Create: `components/admin/module-manager.tsx`

- [ ] **Step 10.1: Tạo `components/admin/module-manager.tsx`**

```typescript
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
          subtabs: c.subtabs.map((s) => (s.subtab_key === subtabKey ? { ...s, ...patch } : s)),
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
    <div className="flex gap-4 h-full min-h-0">

      {/* ── Left panel: module list ── */}
      <div className="w-52 shrink-0 rounded-2xl border border-[#d2d2d7]/70 bg-white overflow-hidden">
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
                'w-full flex items-center justify-between gap-2',
                'px-3 py-2.5 mx-1 rounded-xl text-left',
                'text-[13px] font-medium transition-colors',
                'w-[calc(100%-8px)]',
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
              {/* Label */}
              <div className="flex items-center gap-3">
                <label className="w-28 text-[12px] text-[#6e6e73] shrink-0">
                  Tên hiển thị
                </label>
                <input
                  type="text"
                  value={selected.label}
                  onChange={(e) => patchModule(selected.module_key, { label: e.target.value })}
                  className="flex-1 px-3 py-1.5 text-[13px] rounded-xl border border-[#d2d2d7]
                             focus:outline-none focus:ring-2 focus:ring-[#3b5bdb]/30 bg-white"
                  maxLength={50}
                />
              </div>

              {/* Enabled toggle */}
              <div className="flex items-center gap-3">
                <span className="w-28 text-[12px] text-[#6e6e73] shrink-0">
                  Trạng thái
                </span>
                <button
                  onClick={() => {
                    if (selected.module_key === 'admin') {
                      toast.error('Không thể tắt module Hệ Thống')
                      return
                    }
                    patchModule(selected.module_key, { is_enabled: !selected.is_enabled })
                  }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-medium',
                    'border transition-colors',
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

              {/* Display order */}
              <div className="flex items-center gap-3">
                <label className="w-28 text-[12px] text-[#6e6e73] shrink-0">
                  Thứ tự
                </label>
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

          {/* Sub-tab settings (only for modules that have subtabs) */}
          {selected.subtabs.length > 0 && (
            <div className="rounded-2xl border border-[#d2d2d7]/70 bg-white p-5">
              <h2 className="text-[14px] font-semibold text-[#1d1d1f] mb-4">Sub-tabs</h2>
              <div className="space-y-2">
                {selected.subtabs.map((subtab) => (
                  <div
                    key={subtab.subtab_key}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#f5f5f7]"
                  >
                    {/* Enable/disable subtab */}
                    <button
                      onClick={() => patchSubtab(selected.module_key, subtab.subtab_key, { is_enabled: !subtab.is_enabled })}
                      className={cn(
                        'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold',
                        'transition-colors border',
                        subtab.is_enabled
                          ? 'bg-[#2f9e44]/10 text-[#2f9e44] border-[#2f9e44]/30'
                          : 'bg-[#868e96]/10 text-[#868e96] border-[#868e96]/30'
                      )}
                      title={subtab.is_enabled ? 'Tắt sub-tab này' : 'Bật sub-tab này'}
                    >
                      {subtab.is_enabled ? '✓' : '✕'}
                    </button>

                    {/* Label input */}
                    <input
                      type="text"
                      value={subtab.label}
                      onChange={(e) => patchSubtab(selected.module_key, subtab.subtab_key, { label: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 text-[12px] rounded-lg border border-[#d2d2d7]
                                 focus:outline-none focus:ring-2 focus:ring-[#3b5bdb]/30 bg-white"
                      maxLength={50}
                    />

                    {/* Order */}
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={subtab.display_order}
                      onChange={(e) => patchSubtab(selected.module_key, subtab.subtab_key, { display_order: Number(e.target.value) })}
                      className="w-14 px-2 py-1.5 text-[12px] rounded-lg border border-[#d2d2d7]
                                 focus:outline-none focus:ring-2 focus:ring-[#3b5bdb]/30 bg-white text-center"
                    />

                    {/* Save subtab button */}
                    <button
                      onClick={() => handleSaveSubtab(subtab)}
                      disabled={isPending}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-[#3b5bdb]/10 text-[#3b5bdb]
                                 text-[11px] font-medium hover:bg-[#3b5bdb]/20
                                 transition-colors disabled:opacity-50"
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
```

- [ ] **Step 10.2: TypeScript check**

```bash
cd "D:/optimize app" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 10.3: Full test suite**

```bash
cd "D:/optimize app" && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all existing tests pass + new tests pass. 0 failures.

- [ ] **Step 10.4: Smoke test UI**

Mở `http://localhost:3000/dashboard/admin/modules` với ADMIN account.

Verify:
- [ ] Left panel hiển thị 6 modules với badge ON/OFF
- [ ] Click vào module → right panel hiển thị label, toggle, order
- [ ] Module có subtabs (maintenance, coordination, administration) → subtab list xuất hiện
- [ ] Đổi label module → click "Lưu module" → toast success
- [ ] Refresh → label mới vẫn hiển thị trên navbar
- [ ] Tắt 1 module (ví dụ: `coordination`) → lưu → logout/login lại → tab không xuất hiện trên navbar
- [ ] Tắt admin module → toast error "Không thể tắt"
- [ ] Tắt 1 sub-tab của maintenance → lưu → logout/login → sub-tab không có trong dropdown

- [ ] **Step 10.5: Commit**

```bash
git add components/admin/module-manager.tsx
git commit -m "feat(admin): add ModuleManager client component for dynamic module config"
```

---

## Self-Review

### Spec Coverage Check

| Requirement | Covered by |
|---|---|
| Module bật/tắt | Task 1 (DB `is_enabled`), Task 7 (filter in layout), Task 10 (UI toggle) |
| Đổi label module | Task 1 (DB `label`), Task 7 (`getTabLabel()`), Task 10 (input) |
| Điều chỉnh thứ tự | Task 1 (DB `display_order`), Task 4 (`ORDER BY`), Task 7 (sort in mergeWithStatic), Task 10 (number input) |
| Sub-tab enable/disable | Task 1 (`module_subtab_configs.is_enabled`), Task 7 (`getEnabledSubtabSet()`), Task 10 (subtab UI) |
| Đổi label sub-tab | Task 1 (`label` column), Task 7 (`resolveSubtabLabel()`), Task 10 (subtab input) |
| Fallback khi DB lỗi | Task 4 (`try/catch` + `STATIC_MODULE_NAV_CONFIGS`) |
| Admin UI CRUD | Task 8 (Server Actions), Task 9 (page), Task 10 (component) |
| ADMIN chỉ được sửa | Task 1 (RLS policy), Task 8 (`requireTabEdit('admin')`) |
| Admin tab không tắt được | Task 6 (layout bypass), Task 8 (action guard), Task 10 (toast guard) |
| Commit thường xuyên | Mỗi task có ít nhất 1 commit |

### Placeholder Scan
- Không có "TBD", "TODO", "fill in details"
- Mọi step đều có code block cụ thể hoặc command
- Types và method names nhất quán: `ModuleNavConfig`, `SubtabNavConfig`, `mergeWithStatic`, `getModuleNavConfigs`, `updateModuleConfig`, `updateSubtabConfig`

### Type Consistency Check
- `ModuleNavConfig.module_key` dùng nhất quán ở tất cả tasks (Task 2, 4, 7, 8, 10)
- `SubtabNavConfig.subtab_key` nhất quán (Task 2, 8, 10)
- `updateModuleConfig` signature: `{ module_key, label, is_enabled, display_order }` — khớp Task 8 test và Task 10 call
- `updateSubtabConfig` signature: `{ module_key, subtab_key, label, is_enabled, display_order }` — khớp Task 8 test và Task 10 call
- `getModuleNavConfigs()` returns `ModuleNavConfig[]` — khớp Task 6 layout và Task 9 page
