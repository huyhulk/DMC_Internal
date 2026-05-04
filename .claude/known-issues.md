# Known Issues & Technical Debt — DMC Production Manager

> **Cập nhật:** 2026-04-29
> **Format:** Priority + ID + Title + Description + Status

---

## 🔴 CRITICAL — Cần fix trước khi production-ready

### SEC-001: Workspace/RLS hardening staging chưa promote production
- **Description:** Phiên 2026-05-03 đã thêm migration `022_staging_security_scope_hardening.sql` để khóa self-escalation profile và siết workspace cho HR/overtime/maintenance trên staging.
- **Impact:** Nếu chưa apply/promote migration 022, DB vẫn có nguy cơ policy cũ quá rộng.
- **Proposed solution:** Apply migration 022 qua staging CI, smoke test role/workspace, sau đó mới xin approve promote production.
- **Status:** 🟡 Code ready, cần apply staging
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
  - Option A: Giữ nguyên, document rõ trong `database-schema.md` ✅ (đã làm)
  - Option B: Migration rename về all lowercase (breaking change, cần plan kỹ)
  - View `v_data` (migration 014) cung cấp alias lowercase nếu cần
- **Status:** 🟡 Option A áp dụng + v_data view (documented)
- **Priority:** MEDIUM

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

### TD-003: Migration history không document ngày tạo
- **Description:** Các file migration dùng tên `001-015_*` không có timestamp
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

### SYS-001: Không có staging environment ✅
- **Resolved:** 2026-04-26 → 2026-04-28 (phiên #6, #7, #8)
- **Fix:**
  - Supabase staging project: `vfzjweyzwjczrxphnvaa` (tạo riêng, KHÔNG phải production)
  - `.github/workflows/staging-ci.yml` — CI riêng cho branch staging
  - `.github/workflows/promote-to-prod.yml` — promote workflow với confirm gate
  - `components/shared/environment-banner.tsx` — banner vàng khi NEXT_PUBLIC_ENV=staging
  - Staging DB đã apply migration 001-015
  - staging-ci.yml đơn giản hóa phiên #9: chỉ `supabase db push`, không cần pre-registration
- **Còn cần (GitHub Settings — không làm được từ code):**
  - Tạo GitHub Environment `production` với required reviewers (cho promote-to-prod.yml)
  - Verify `STAGING_DB_URL` secret = direct URL port 5432

### DB-002: RLS policy UPDATE quá rộng ✅
- **Resolved:** 2026-04-28 (migration 007)
- **Fix:** `007_tighten_rls_data_update.sql` — ADMIN/MANAGER unrestricted, SUPERVISOR chỉ update workshop của mình, USER không update được
- **Branch:** staging (chưa merge main)

### TD-002: Không có Supabase CLI config ✅
- **Resolved:** 2026-04-26 (phiên #6)
- **Fix:** `supabase/config.toml` tạo qua `supabase init`; `supabase/seed.sql` tạo để local dev

### RPT-001: OEE không có trend theo thời gian ✅
- **Resolved:** 2026-04-23
- **Fix:** Phase 2 — OEE trend chart với groupBy period, commit `1862011`

### RPT-002: Tiến độ SX filter theo INITIALDATE ✅
- **Resolved:** 2026-04-23
- **Fix:** Phase 2 — thêm param `filterBy=deadline|initialdate`, commit `adc1533`

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
