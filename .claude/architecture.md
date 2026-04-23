# Architecture — DMC Production Manager

## 🏛️ Sơ đồ tổng quan

```
┌──────────────────┐
│  Google Sheet    │  (nguồn lệnh sản xuất YCSX)
│  "Tổng hợp 2026" │
└────────┬─────────┘
         │ Apps Script (5min trigger)
         │ HTTPS POST → Supabase REST API
         ▼
┌────────────────────────────────────────────────┐
│             Supabase Project                   │
│           hzuyucyxyohppxfwresq                 │
│  ┌────────────┐  ┌──────────┐  ┌───────────┐  │
│  │ PostgreSQL │  │   Auth   │  │  Storage  │  │
│  │            │  │          │  │ (not used)│  │
│  │ Tables:    │  │ JWT      │  └───────────┘  │
│  │ - data     │  │ session  │                 │
│  │ - Production│ │          │  RPC Functions: │
│  │ - Norm     │  │          │  - rpc_fetch_  │
│  │ - Material │  │          │    prod_rows   │
│  │ - profiles │  │          │  - fn_classify_│
│  │            │  │          │    shift       │
│  │ RLS enabled│  │          │                │
│  └────────────┘  └──────────┘                 │
└────────────────────────────┬───────────────────┘
                             │ supabase-js
                             ▼
┌─────────────────────────────────────────────┐
│       Next.js 16 App (deploy Vercel)        │
│  ┌────────────────┐  ┌────────────────────┐ │
│  │ App Router     │  │ API Routes         │ │
│  │                │  │ /api/reports/*     │ │
│  │ /(auth)/login  │  │ /api/hr            │ │
│  │ /(dashboard)/* │  │ /api/admin/*       │ │
│  └────────────────┘  └────────────────────┘ │
│  ┌────────────────┐  ┌────────────────────┐ │
│  │ Server         │  │ Client Components  │ │
│  │ Components     │  │ Charts (ECharts +  │ │
│  │ (data fetch)   │  │  Recharts)         │ │
│  └────────────────┘  └────────────────────┘ │
└──────────────────┬──────────────────────────┘
                   │ HTTPS
                   ▼
              User browser
```

## 📁 Cấu trúc thư mục (`dmc-nextjs/`)

```
dmc-nextjs/
├── app/                              # Next.js App Router
│   ├── (auth)/
│   │   └── login/                    # Trang đăng nhập
│   ├── (dashboard)/
│   │   └── dashboard/
│   │       ├── production/           # Nhập liệu sản xuất
│   │       ├── report/               # Báo cáo tổng hợp
│   │       ├── coordination/         # Điều phối + HR
│   │       ├── maintenance/          # Bảo trì
│   │       └── admin/                # Quản trị user
│   ├── api/
│   │   ├── reports/
│   │   │   ├── production-progress/  # Tiến độ SX
│   │   │   ├── production-output/    # Kết quả SX
│   │   │   ├── quality-result/       # Chất lượng
│   │   │   ├── oee/                  # OEE
│   │   │   └── workshops/ranking/    # Xếp hạng xưởng
│   │   ├── hr/                       # Nhân sự
│   │   └── admin/profiles/           # Quản lý user
│   ├── layout.tsx
│   └── page.tsx                      # Redirect
├── components/                       # React components
│   ├── ui/                           # Radix + shadcn primitives
│   ├── admin/                        # User management
│   ├── auth/                         # Login form
│   ├── coordination/                 # Điều phối + HR
│   ├── layout/                       # Dashboard shell
│   ├── production/                   # Nhập liệu SX
│   ├── report/                       # Charts + sections
│   └── shared/                       # Shared components (e.g. change-password)
├── lib/                              # Utilities
│   ├── supabase/                     # Supabase clients
│   │   ├── client.ts                 # Browser client
│   │   ├── server.ts                 # Server component client
│   │   └── middleware.ts             # Auth middleware
│   ├── actions/                      # Server Actions (auth, data, hr, admin)
│   ├── db/queries.ts                 # Low-level DB queries
│   ├── reports/                      # Report business logic
│   │   ├── oee-calculator.ts         # OEE A×P×Q calculation
│   │   ├── report-queries.ts         # Report data fetching
│   │   └── report-types.ts           # TypeScript types cho reports
│   ├── logger/index.ts               # pino logger
│   ├── shifts.ts                     # classifyShift() — phân loại ca
│   ├── utils.ts                      # Shared utilities (ISO week, timezone, ...)
│   └── validations/                  # Zod schemas (auth, production)
├── hooks/                            # Custom React hooks
│   ├── use-production-data.ts
│   └── use-report-data.ts
├── types/                            # TypeScript types
│   ├── database.ts                   # Supabase generated types
│   └── index.ts
├── supabase/
│   └── migrations/                   # 001-006.sql
├── __tests__/                        # Unit tests
├── public/
├── .github/workflows/                # CI
├── package.json
└── next.config.mjs                   # ⚠️ Đuôi .mjs (không phải .ts)
```

## 🌊 Luồng dữ liệu chính

### 1. Nhập lệnh sản xuất (YCSX)
```
Quản đốc → Google Sheet "Tổng hợp 2026" (sheet mới append)
                ↓ Apps Script mỗi 5 phút
         Push → Supabase table "data" (upsert on PCODE)
                ↓
         User vào /dashboard/production xem danh sách
```
**Note:** Nhập trực tiếp qua web hiện tại KHÔNG phải flow chính. Google Sheet vẫn là source of truth.

### 2. Ghi nhận kết quả sản xuất
```
User /dashboard/production
  → Form (react-hook-form + zod)
  → Server Action (lib/actions/data.ts)
  → Supabase INSERT INTO "Production"
      (RLS check: check_production_insert_permission(totalem))
  → Revalidate → update UI
```

### 3. Báo cáo sản xuất
```
User /dashboard/report
  → API route /api/reports/*
  → Supabase RPC (rpc_fetch_prod_rows) hoặc query trực tiếp
  → Aggregation trong Next.js (lib/reports/)
  → Return JSON
  → Client render chart (ECharts/Recharts)
```

## 🗂️ API Routes — Chi tiết

| Endpoint | Method | Params | Return |
|----------|--------|--------|--------|
| `/api/reports/production-progress` | GET | from, to, filterBy (deadline\|initialdate) | Tiến độ theo lệnh |
| `/api/reports/production-output` | GET | from, to, groupBy (day\|week\|month\|hour), workshopId | Sản lượng theo period/xưởng |
| `/api/reports/quality-result` | GET | from, to, groupBy, workshopId | Tỷ lệ lỗi theo period |
| `/api/reports/oee` | GET | mode, from, to, groupBy | OEE A/P/Q + trend |
| `/api/reports/workshops/ranking` | GET | metric, from, to | Xếp hạng 4 xưởng |
| `/api/hr` | GET, POST | - | CRUD nhân sự |
| `/api/admin/profiles` | GET, POST | - | Quản lý user (ADMIN only) |

## 🔐 Authentication Flow

```
1. User → /login
2. Supabase Auth (email/password)
3. JWT cookie set (via @supabase/ssr)
4. Middleware check session trên mọi route /(dashboard)/*
5. Server Components dùng server.ts client
6. Client Components dùng client.ts client
```

## 🎨 UI/UX Patterns

### Layout
- **Public:** `/login` - centered form
- **Protected:** `/(dashboard)/*` - sidebar + main content
- **Responsive:** desktop first, tablet support

### Chart library selection
| Use case | Library |
|----------|---------|
| KPI cards, dashboard Tremor | Recharts |
| Bar/Line/Pie đơn giản | Recharts |
| Radar (comparison 4 xưởng) | ECharts |
| Heatmap | ECharts |
| Treemap | ECharts |
| Gauge (OEE) | ECharts |
| Drill-down phức tạp | ECharts |

### Color scheme cho 4 phân xưởng
(Định nghĩa 1 lần dùng cho mọi chart so sánh)
- PX1 / DMC1: `#3b82f6` (blue)
- PX3 / DMC3: `#a855f7` (purple)
- PX4 / DMC4: `#ef4444` (red)
- PX5 / DMC5: `#10b981` (green)

## 🔧 Dependencies chính (package.json)

### Production
```
next ^16.2.4
react ^18.3.1         ← đã downgrade từ 19 để compatible Tremor
@supabase/supabase-js ^2.49.4
@supabase/ssr ^0.6.1
echarts ^6.0
echarts-for-react ^3.0
recharts ^2.15
@tremor/react ^3.18
@radix-ui/* (multiple)
tailwindcss ^3.4
react-hook-form ^7.x
zod ^3.24
date-fns ^4.1
pino ^9.6
xlsx ^0.18.5           ← export Excel
```

### Development
```
typescript ^5.x
jest ^30
ts-jest ^29.x
@types/node ^22
@types/react ^18.3.1
eslint
```

## 🔗 External services

| Service | Purpose | Config |
|---------|---------|--------|
| Supabase | DB + Auth | Env vars |
| Vercel | Hosting | Auto-detect |
| GitHub | Repo + CI | Actions workflow |
| Google Apps Script | Sheet sync | Bên ngoài repo (SYS-002) |

## 📊 Performance considerations

- **Server Components** default cho data fetching (giảm JS bundle client)
- **Streaming** cho report pages (dùng Suspense)
- **RPC functions** ở Supabase cho aggregation phức tạp (tránh transfer nhiều data)
- **`optimizePackageImports`** trong `next.config.mjs` cho bundle size
- **Revalidation** strategy:
  - Production data: `revalidate = 60` (1 phút)
  - Báo cáo: `revalidate = 300` (5 phút)
  - Static: `force-static`

## 🧪 Testing strategy

- **Unit test:** Business logic (OEE, classifyShift, date-utils) — Jest
  - `__tests__/shifts.test.ts`
  - `lib/reports/__tests__/oee-calculator.test.ts`
- **Integration test:** API routes — (chưa setup)
- **E2E:** Playwright — (chưa setup, NTH-001)
- **CI:** type-check + lint + build
