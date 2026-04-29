# Database Schema — DMC Production Manager

> **Source of truth:** Supabase project `hzuyucyxyohppxfwresq` (production)
> **Snapshot updated:** 2026-04-29
> **Migration cuối cùng:** `015_audit_log.sql` (staging branch, chưa merge main)

## 🚨 QUAN TRỌNG — Column Case

Đây là điểm **dễ gây bug nhất**. Schema hiện tại MIX giữa lowercase và uppercase:

### Table `data` (quan trọng nhất)
```sql
-- Column "id" là LOWERCASE
-- Các column khác là UPPERCASE có quotes

CREATE TABLE data (
    id            BIGSERIAL PRIMARY KEY,        -- lowercase
    "PCODE"       TEXT UNIQUE NOT NULL,          -- UPPERCASE, PK business
    "INITIALDATE" DATE,
    "CUSTOMER"    TEXT,
    "WORKSHOP"    TEXT,
    "DESCRIPTION" TEXT,
    "QUANTITY"    NUMERIC,
    "DEADLINEDATE" TIMESTAMPTZ,
    "STATUS"      TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ
);
```

**Khi query:**
```sql
-- ✅ ĐÚNG
SELECT "PCODE", "INITIALDATE" FROM data WHERE "WORKSHOP" = 'DMC1';

-- ❌ SAI (PostgreSQL sẽ tìm column pcode không tồn tại)
SELECT PCODE, INITIALDATE FROM data;

-- ❌ SAI (table name cũng case-sensitive nếu có quotes)
SELECT * FROM "DATA";  -- không tồn tại, chỉ có "data" lowercase
```

**Trong supabase-js:**
```typescript
// Key phải đúng case
const { data } = await supabase
  .from('data')  // table name lowercase
  .select('id, PCODE, INITIALDATE, WORKSHOP')  // column name uppercase, KHÔNG quote
  .eq('WORKSHOP', 'DMC1');
```

**Shortcut:** Migration 014 tạo view `v_data` với column lowercase nếu cần:
```typescript
supabase.from('v_data').select('pcode, workshop, quantity')
```

---

## 📋 Tables

### 1. `data` — Lệnh sản xuất (YCSX)
**Nguồn:** Google Sheet, sync 5 phút/lần
**Primary key:** `id` (SERIAL)
**Business key:** `"PCODE"` (unique)

| Column | Type | Case | Required | Description |
|--------|------|------|----------|-------------|
| `id` | BIGSERIAL | lower | ✅ | Auto PK |
| `"PCODE"` | TEXT | UPPER | ✅ | Mã YCSX, unique |
| `"INITIALDATE"` | DATE | UPPER | ✅ | Ngày lập phiếu |
| `"CUSTOMER"` | TEXT | UPPER | - | Khách hàng |
| `"WORKSHOP"` | TEXT | UPPER | - | Xưởng sản xuất (DMC1/DMC3/DMC4/DMC5) |
| `"DESCRIPTION"` | TEXT | UPPER | - | Diễn giải |
| `"QUANTITY"` | NUMERIC | UPPER | - | Số lượng |
| `"DEADLINEDATE"` | TIMESTAMPTZ | UPPER | - | Deadline với +07:00 |
| `"STATUS"` | TEXT | UPPER | - | Tình trạng |
| `created_at` | TIMESTAMPTZ | lower | ✅ | Auto |
| `updated_at` | TIMESTAMPTZ | lower | - | Trigger handle_updated_at |

### 2. `Production` — Kết quả sản xuất thực tế
**Table name có quotes:** `"Production"`
**Columns: lowercase**

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | Auto |
| `pdate` | DATE | Ngày sản xuất |
| `totalem` | TEXT | **Mã xưởng** (VD: DMC1) — KHÔNG phải số nhân viên! |
| `pcode` | TEXT | FK lỏng sang `data."PCODE"` |
| `products` | TEXT | Tên sản phẩm (dòng sản xuất) |
| `material` | TEXT | Vật liệu |
| `poutput` | NUMERIC | Sản lượng kế hoạch |
| `eoutput` | NUMERIC | Sản lượng thực tế |
| `routput` | NUMERIC | Sản lượng tái chế |
| `workforce` | NUMERIC | **Số nhân công** (đây mới là số người) |
| `starttime` | TEXT | Giờ bắt đầu ca, format "HH:mm" |
| `endtime` | TEXT | Giờ kết thúc ca |
| `realnorm` | NUMERIC | Năng suất thực tế |

**Quan trọng:**
- `totalem` (TEXT) = mã xưởng, KHÔNG phải số
- `workforce` (NUMERIC) = số nhân công
- `starttime/endtime` là TEXT → parse bằng `fn_classify_shift()` hoặc `classifyShift()`

### 3. `Norm` — Định mức năng suất
**Table name có quotes:** `"Norm"`

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | Auto |
| `products` | TEXT | Tên sản phẩm (join với Production.products) |
| `norm` | NUMERIC | Định mức chuẩn |
| `nwforce` | NUMERIC | Định mức nhân công |
| `workshop` | TEXT | Xưởng áp dụng (DMC1/DMC3/DMC4/DMC5) |
| `pspeed` | NUMERIC | Tốc độ sản xuất (dùng cho A trong OEE) |

### 4. `Material` — Vật liệu
**Table name có quotes:** `"Material"`

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | Auto |
| `product` | TEXT | Sản phẩm |
| `material` | TEXT | Vật liệu tương ứng |

### 5. `profiles` — User profile
**Table name lowercase** (Supabase auth convention)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | Link với auth.users.id |
| `username` | TEXT | Tên hiển thị |
| `role` | TEXT | `ADMIN` / `MANAGER` / `SUPERVISOR` / `USER` |
| `workspace` | TEXT | Mã xưởng được giao, hoặc `"ALL"` |
| `created_at` | TIMESTAMPTZ | Auto |

**Note:** `hr_daily` table **KHÔNG tồn tại** trong bất kỳ migration nào. Không được reference.

---

## 📋 KPI Tables (migrations 008–013)

### 6. `kpi_targets` — Mục tiêu KPI 2026
19 KPI codes: SX-01..06, KT-01..07, KH-02..07 | RLS: SELECT=authenticated, ALL=ADMIN

| Column | Type | Description |
|--------|------|-------------|
| `kpi_code` | TEXT UNIQUE | SX-01, KT-02, KH-07... |
| `department` | TEXT | PRODUCTION / MAINTENANCE / COORDINATION |
| `name` | TEXT | Tên KPI |
| `unit` | TEXT | %, h/ngày, phút/lần, giờ |
| `target_value` | NUMERIC | Giá trị mục tiêu chuẩn |
| `target_operator` | TEXT | lte / gte / lt / gt / eq |
| `default_period` | TEXT | weekly / monthly / quarterly / yearly |
| `target_weekly/monthly/quarterly/yearly` | NUMERIC | Target theo từng kỳ |
| `is_active` | BOOLEAN | Default true |
| `year` | INTEGER | Default 2026 |

### 7. `kpi_baselines` — Baseline tham chiếu (VD: chi phí 2025)

| Column | Type | Description |
|--------|------|-------------|
| `baseline_key` | TEXT UNIQUE | VD: delivery_cost_per_ton_2025 |
| `value` | NUMERIC | Giá trị baseline |
| `effective_year` | INTEGER | Năm áp dụng |

### 8. `production_defects` — SX-01: Lỗi thành phẩm
Columns: `report_date`, `workshop`, `pcode`, `product_name`, `total_qty`, `defect_qty`, `defect_type`, `shift`

### 9. `order_completion` — SX-02: Tiến độ đơn hàng
Columns: `pcode`, `workshop`, `planned_date`, `actual_date`, `is_on_time` (GENERATED), `delay_days` (GENERATED), `status`

### 10. `material_usage` — SX-04: Tiêu hao NVL
Columns: `report_date`, `workshop`, `pcode`, `material_code`, `norm_qty`, `actual_qty`, `variance_pct` (GENERATED)

### 11. `findings_5s` — SX-05/KH-04: Phát hiện 5S
Columns: `finding_date`, `workshop`, `department` (PRODUCTION/COORDINATION/ALL), `category`, `due_date`, `resolved_date`, `is_resolved` (GENERATED), `is_on_time` (GENERATED)

### 12. `site_progress` — SX-06: Tiến độ công trình
Columns: `project_code`, `start_date`, `planned_end_date`, `planned_hours`, `actual_hours`, `status`

### 13. `machine_breakdowns` — KT-01/02/03: Sự cố máy
Columns: `workshop`, `machine_code`, `breakdown_start`, `breakdown_end`, `downtime_minutes` (GENERATED), `is_planned`, `status`

### 14. `maintenance_schedule` — KT-04: Lịch bảo trì
Columns: `workshop`, `machine_code`, `maintenance_type`, `scheduled_date`, `actual_date`, `is_completed` (GENERATED), `is_on_time` (GENERATED)

### 15. `technical_drawings` — KT-05/06: Bản vẽ kỹ thuật
Columns: `drawing_code` (UNIQUE), `request_date`, `due_date`, `delivered_date`, `is_on_time` (GENERATED), `has_errors`, `status`

### 16. `site_surveys` — KT-07: Khảo sát công trình
Columns: `survey_date`, `total_items`, `error_items`, `accuracy_pct` (GENERATED)

### 17. `deliveries` — KH-02/03/07: Giao hàng
Columns: `delivery_code` (UNIQUE), `pcode`, `customer`, `planned_date`, `actual_date`, `is_on_time` (GENERATED), `total_weight_tons`, `damaged_weight_tons`, `damage_pct` (GENERATED), `delivery_cost`, `cost_per_ton` (GENERATED), `status`

### 18. `delivery_cost_baseline` — KH-03: Baseline chi phí 2025
### 19. `statistical_reports` — KH-05: Báo cáo thống kê
### 20. `iso_procedures` — KH-06: Quy trình ISO

---

## 📋 HR & Overtime Tables (migration 012)

### 21. `employees` — Danh sách nhân viên
Columns: `employee_code`, `full_name`, `workshop`, `position`, `team`, `is_active`

### 22. `overtime_records` — Tăng ca (master)
Columns: `ot_date`, `customer`, `pcode`, `workshop`, `original_workshop`, `ot_category` (PRODUCTION/DELIVERY/INTERNAL), `reasons` (JSONB), `total_employees`, `total_hours`

**Trigger:** `trg_normalize_ot_workshop_biu` → auto-normalize workshop code (DM1→DMC1, DM2→DMC1, v.v.), lưu raw trong `original_workshop`

### 23. `overtime_participants` — Nhân viên trong ca tăng ca
Columns: `overtime_id` (FK), `employee_id` (FK nullable), `employee_name`, `hours`

### 24. `overtime_imports` — Lịch sử import CSV tăng ca
Columns: `source_url`, `import_month`, `rows_imported`, `rows_skipped`, `errors` (JSONB), `status`

---

## 📋 Audit (migration 015)

### 25. `audit_log` — Lịch sử thay đổi
Columns: `table_name`, `record_id`, `action` (INSERT/UPDATE/DELETE), `old_data` (JSONB), `new_data` (JSONB), `changed_by` (FK profiles), `changed_at`, `ip_address`

**Triggers hiện có:** kpi_targets, overtime_records, employees, deliveries

---

## 📋 Views (migration 014)

### `v_data` — Alias lowercase cho `data`
```sql
SELECT id, "PCODE" AS pcode, "WORKSHOP" AS workshop, "CUSTOMER" AS customer,
       "DESCRIPTION" AS description, "QUANTITY" AS quantity,
       "DEADLINEDATE" AS deadline_date, "INITIALDATE" AS initial_date,
       "STATUS" AS status, created_at, updated_at
FROM public.data;
```
GRANT SELECT TO authenticated.

---

## 🔌 RPC Functions

### Core (migrations 003–006)
- **`fn_classify_shift(starttime TEXT)`** → TEXT: Phân loại ca (`ca_sang_1`, `ca_sang_2`, `ca_chieu_1`, `ca_chieu_2`, `ca_tang_ca`, `khac`)
- **`rpc_fetch_prod_rows(p_from, p_to, p_workshop)`** → TABLE: JOIN Production+data+Norm
- **`check_production_insert_permission(p_pcode TEXT)`** → BOOLEAN: RLS helper

### KPI (migration 013)
- **`get_kpi_target(p_kpi_code, p_period)`** → NUMERIC: Lấy target theo kỳ
- **`get_period_range(p_period_type, p_anchor_date)`** → TABLE(period_start, period_end, period_label): Tính khoảng ngày của kỳ
- **`rpc_calculate_kpi(p_department, p_period_type, p_anchor_date, p_workshop?)`** → TABLE: Tính actual vs target cho toàn bộ KPI 1 bộ phận
- **`rpc_kpi_trend(p_kpi_code, p_period_type, p_anchor_date, p_count?, p_workshop?)`** → TABLE: Time-series KPI trend
- **`rpc_kpi_workshop_matrix(p_department, p_period_type, p_anchor_date)`** → TABLE: KPI × 4 workshops
- **`rpc_overtime_summary(p_period_type, p_anchor_date, p_workshop?)`** → TABLE: Tổng hợp tăng ca theo workshop
- **`rpc_top_overtime_employees(p_period_type, p_anchor_date, p_limit?)`** → TABLE: Top nhân viên tăng ca

### Helpers
- **`normalize_workshop(p_raw TEXT)`** → TEXT IMMUTABLE: DM1/DM2→DMC1, DM3→DMC3, ...
- **`handle_updated_at()`** TRIGGER: Auto set updated_at
- **`handle_new_user()`** TRIGGER: Auto tạo profiles khi signup
- **`log_table_change()`** TRIGGER: Ghi audit_log
- **`trg_normalize_ot_workshop()`** TRIGGER: Normalize workshop trong overtime_records

---

## 🔒 RLS Policies

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | own row | auto (trigger) | own row | - |
| `data` | authenticated | authenticated | ADMIN/MANAGER/SUPERVISOR(own ws) | - |
| `"Production"` | authenticated | check_permission | - | - |
| `"Norm"` | authenticated | - | - | - |
| `"Material"` | authenticated | - | - | - |
| KPI tables | authenticated | authenticated | ADMIN/MANAGER | ADMIN |
| `employees` | authenticated | ADMIN/MANAGER | ADMIN/MANAGER | ADMIN/MANAGER |
| `overtime_*` | authenticated | authenticated | ADMIN/MANAGER | ADMIN |
| `kpi_targets` | authenticated | ADMIN | ADMIN | ADMIN |
| `audit_log` | - | SECURITY DEFINER trigger | - | - |

**Migration 007** thu hẹp `data` UPDATE: ADMIN/MANAGER unrestricted, SUPERVISOR chỉ update `"WORKSHOP"` = workspace của mình.

---

## 📜 Migration History

| File | Nội dung | Branch | Trạng thái |
|------|----------|--------|------------|
| `001_initial_schema.sql` | Tables: data, Production, Norm, Material, profiles + indexes + RLS + triggers | main | ✅ Production |
| `002_normalize_workshop_codes.sql` | Normalize Norm.workshop → DMC codes | main | ✅ Production |
| `003_production_rls_strict.sql` | check_production_insert_permission() v1 | main | ✅ Production |
| `004_fix_empty_workspace_rls.sql` | Fix RLS workspace logic | main | ✅ Production |
| `005_report_rpcs.sql` | rpc_fetch_prod_rows + fn_classify_shift v1 | main | ✅ Production |
| `006_add_overtime_shift.sql` | fn_classify_shift thêm ca_tang_ca | main | ✅ Production |
| `007_tighten_rls_data_update.sql` | Thu hẹp UPDATE policy trên data | staging | ⏳ Staging only |
| `008_kpi_targets.sql` | kpi_targets, kpi_baselines, get_kpi_target() | staging | ⏳ Staging only |
| `009_production_kpi_tables.sql` | production_defects, order_completion, material_usage, findings_5s, site_progress | staging | ⏳ Staging only |
| `010_maintenance_kpi_tables.sql` | machine_breakdowns, maintenance_schedule, technical_drawings, site_surveys | staging | ⏳ Staging only |
| `011_coordination_kpi_tables.sql` | deliveries, delivery_cost_baseline, statistical_reports, iso_procedures | staging | ⏳ Staging only |
| `012_hr_overtime_tables.sql` | employees, overtime_records, overtime_participants, overtime_imports, normalize_workshop() | staging | ⏳ Staging only |
| `013_kpi_rpc_functions.sql` | rpc_calculate_kpi, rpc_kpi_trend, rpc_overtime_summary, rpc_top_overtime_employees, rpc_kpi_workshop_matrix, get_period_range() | staging | ⏳ Staging only |
| `014_normalize_data_columns.sql` | View v_data (lowercase alias) | staging | ⏳ Staging only |
| `015_audit_log.sql` | audit_log table + log_table_change() trigger | staging | ⏳ Staging only |

**Staging DB:** `vfzjweyzwjczrxphnvaa` — đã apply đủ 001-015
**Production DB:** `hzuyucyxyohppxfwresq` — chỉ có 001-006

---

## ⚠️ Known data quality issues

### 1. Duplicate PCODE
- Google Sheet có thể có PCODE trùng (user copy-paste)
- Apps Script handle bằng `dedupeRecords()` giữ dòng cuối
- DB enforce UNIQUE constraint → upsert conflict handled

### 2. INITIALDATE rác
- Có record `INITIALDATE = "0003942"` → không phải date hợp lệ
- Apps Script skip những record này ở bước cast

### 3. Workshop mapping (tăng ca từ CSV)
- File CSV gốc dùng DM1/DM2/DM3/DM4, DB chuẩn dùng DMC1/DMC3/DMC4/DMC5
- DM1 và DM2 đều map về DMC1 (cùng phân xưởng vật lý)
- Function `normalize_workshop()` handle conversion này
- `overtime_records.original_workshop` giữ giá trị gốc để audit

---

## 🔄 Drift Detection Checklist

Mỗi khi phiên bắt đầu, so sánh:

- [ ] Số migration file trong repo vs số migration trong DB
- [ ] Column list của mỗi table vs mô tả trong file này
- [ ] Danh sách RPC function vs liệt kê ở trên
- [ ] RLS policies còn match không

SQL check drift:
```sql
-- 1. Migration history hiện tại
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;

-- 2. Columns của data table
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'data' ORDER BY ordinal_position;

-- 3. Danh sách RPC
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

-- 4. RLS policies
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
```
