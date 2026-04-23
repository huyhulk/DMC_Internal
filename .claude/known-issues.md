# Known Issues & Technical Debt — DMC Production Manager

> **Cập nhật:** 2026-04-23
> **Format:** Priority + ID + Title + Description + Status

---

## 🔴 CRITICAL — Cần fix trước khi production-ready

### SYS-001: Không có staging environment
- **Description:** Chỉ có 1 Supabase project (production `hzuyucyxyohppxfwresq`). Mọi migration test phải chạy thẳng production → risk rất cao.
- **Impact:** Không thể test migration, RLS change, RPC change an toàn
- **Proposed solution:**
  1. Tạo Supabase project mới `dmc-staging`
  2. Copy schema + seed data (không copy production data thật)
  3. Thêm env var `NEXT_PUBLIC_SUPABASE_URL_STAGING`
  4. Vercel preview deploy → trỏ sang staging
  5. Production deploy (main branch) → trỏ sang production
- **Status:** ❌ Not started
- **Priority:** CRITICAL

### SYS-002: Apps Script sync code không nằm trong repo
- **Description:** Logic sync Google Sheet → Supabase là Apps Script, không có version control trong GitHub
- **Impact:**
  - Bug fix không có git history
  - Không thể review qua PR
  - Nếu Apps Script bị xóa → mất hoàn toàn
- **Proposed solution:**
  1. Setup `clasp` (Google Apps Script CLI) hoặc
  2. Lưu code Apps Script trong `scripts/apps-script/` của repo
  3. Document quy trình update Apps Script trong `deployment.md`
- **Status:** ❌ Not started
- **Priority:** HIGH

---

## 🟡 IMPORTANT — Ảnh hưởng độ chính xác

### DB-001: Schema column case mix
- **Description:** Table `data` có `id` lowercase nhưng các column khác UPPERCASE có quotes. Dễ gây confusion và bug khi viết SQL mới.
- **Impact:** Developer mới dễ viết SAI: `SELECT pcode FROM data` → lỗi runtime
- **Proposed solution:**
  - Option A: Giữ nguyên, document rõ trong `database-schema.md` (đã làm)
  - Option B: Migration rename về all lowercase (breaking change, cần plan kỹ)
- **Status:** 🟡 Option A áp dụng (documented)
- **Priority:** MEDIUM

### DB-002: RLS policy UPDATE quá rộng
- **Description:** Migration 001 cho authenticated users UPDATE table `data` → có thể user role USER cũng update được
- **Impact:** Security risk — user bình thường có thể sửa lệnh sản xuất
- **Proposed solution:** Thu hẹp policy UPDATE → chỉ ADMIN + MANAGER hoặc service_role (Apps Script)
- **Status:** ⚠️ Cần verify + fix
- **Priority:** HIGH

---

## 🔵 TECH DEBT — Nên xử lý khi có cơ hội

### TD-001: 2 chart library song song (ECharts + Recharts)
- **Description:** Dùng cả ECharts 6.0 và Recharts 2.15
- **Impact:** Bundle size lớn hơn, 2 API khác nhau developer phải học
- **Decision:** **Giữ cả 2** (đã confirm)
  - Recharts cho chart cơ bản + Tremor integration
  - ECharts cho radar/heatmap/gauge phức tạp
- **Status:** ✅ Keep as-is
- **Priority:** N/A (decided)

### TD-002: Không có Supabase CLI config
- **Description:** Không có `supabase/config.toml` → không thể `supabase start` local
- **Impact:** Developer mới khó local test DB
- **Proposed solution:** `supabase init` tạo config, test local với Docker
- **Status:** ❌ Not started
- **Priority:** LOW

### TD-003: Migration history không document ngày tạo
- **Description:** Các file migration dùng tên `001-006_*` không có timestamp
- **Proposed solution:** Migration tiếp theo dùng format `YYYYMMDDHHmmss_description.sql`
- **Status:** Guideline for next migration
- **Priority:** LOW

---

## 🟢 NICE TO HAVE

### NTH-001: E2E test với Playwright
- **Description:** Chưa có E2E test cho critical flows (login, nhập liệu, báo cáo)
- **Status:** 📋 Backlog

### NTH-002: Storybook cho component library
- **Description:** Radix + shadcn components chưa có visual catalog
- **Status:** 📋 Backlog

### NTH-003: Supabase realtime cho dashboard
- **Description:** Dashboard hiện poll data, có thể dùng Supabase Realtime để live update
- **Status:** 📋 Backlog

---

## ✅ RECENTLY RESOLVED

### RPT-001: OEE không có trend theo thời gian ✅
- **Resolved:** 2026-04-23
- **Fix:** Phase 2 — OEE trend chart với groupBy period, commit `1862011`
- **PR:** feature/phase2-oee-trend-overtime-shift → develop

### RPT-002: Tiến độ SX filter theo INITIALDATE ✅
- **Resolved:** 2026-04-23
- **Fix:** Phase 2 — thêm param `filterBy=deadline|initialdate`, commit `adc1533`
- **PR:** feature/phase2-filterby-groupby-hour → develop

### ISS-001: Tuần ISO 8601 vs lịch Mỹ ✅
- **Resolved:** 2026-04-23
- **Fix:** Dùng PostgreSQL `TO_CHAR(date, 'IYYY-"W"IW')` + JS fallback, commit `1862011`

### SYNC-001: Apps Script HTTP 500 duplicate PCODE ✅
- **Resolved:** 2026-04-23
- **Fix:** Thêm `dedupeRecords()` giữ dòng cuối

### SYNC-002: Apps Script rate limit ✅
- **Resolved:** 2026-04-23
- **Fix:** Giảm batch 200 + sleep 500ms + exponential backoff retry

### SYNC-003: Datetime timezone lệch 7h ✅
- **Resolved:** 2026-04-23
- **Fix:** Luôn append `+07:00` vào datetime string

---

## 📝 Template khi add issue mới

```markdown
### [PREFIX]-XXX: Title ngắn gọn
- **Description:** Mô tả vấn đề
- **Impact:** Ai bị ảnh hưởng, ảnh hưởng thế nào
- **Proposed solution:** Plan giải quyết
- **Status:** ❌ Not started / 🟡 In progress / ✅ Done / 📋 Planned
- **Priority:** CRITICAL / HIGH / MEDIUM / LOW
- **Reference:** Link file/commit/PR liên quan
```

**Prefix convention:**
- `SYS-`: System/infrastructure
- `DB-`: Database schema/RLS
- `RPT-`: Report/business logic
- `UI-`: Frontend/UI
- `SYNC-`: Google Sheet sync
- `AUTH-`: Authentication/authorization
- `TD-`: Technical debt
- `NTH-`: Nice to have
