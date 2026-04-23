# Database Schema — DMC Production Manager

> **Source of truth:** Supabase project `hzuyucyxyohppxfwresq` (production)
> **Snapshot updated:** 2026-04-23
> **Migration cuối cùng:** `006_add_overtime_shift.sql`

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
| `"WORKSHOP"` | TEXT | UPPER | - | Xưởng sản xuất (DMC1/DMC3/...) |
| `"DESCRIPTION"` | TEXT | UPPER | - | Diễn giải |
| `"QUANTITY"` | NUMERIC | UPPER | - | Số lượng |
| `"DEADLINEDATE"` | TIMESTAMPTZ | UPPER | - | Deadline với +07:00 |
| `"STATUS"` | TEXT | UPPER | - | Tình trạng |
| `created_at` | TIMESTAMPTZ | lower | ✅ | Auto |
| `updated_at` | TIMESTAMPTZ | lower | - | Trigger handle_updated_at |

### 2. `Production` — Kết quả sản xuất thực tế
**Table name có quotes:** `"Production"`
**Column: lowercase**

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
- `starttime/endtime` là TEXT → parse bằng `fn_classify_shift` hoặc `classifyShift()`

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

## 🔌 RPC Functions

### `fn_classify_shift(starttime TEXT)` → TEXT
**Purpose:** Phân loại ca từ giờ bắt đầu
**Input:** TEXT format "HH:mm" hoặc "H:mm" hoặc NULL
**Output:** `ca_sang_1` | `ca_sang_2` | `ca_chieu_1` | `ca_chieu_2` | `ca_tang_ca` | `khac`

**Migration 006** đã thêm `ca_tang_ca` (16:30–22:00) cho ca tăng ca.

```sql
SELECT fn_classify_shift('07:30');  -- 'ca_sang_1'
SELECT fn_classify_shift('18:00');  -- 'ca_tang_ca'
SELECT fn_classify_shift(NULL);     -- 'khac'
```

### `rpc_fetch_prod_rows(p_from DATE, p_to DATE, p_workshop TEXT)` → TABLE
**Purpose:** JOIN `Production` + `data` + `Norm` trong 1 query, tránh N+1
**Input:**
- `p_from`, `p_to`: khoảng ngày
- `p_workshop`: `NULL` = all, hoặc mã xưởng cụ thể (DMC1/DMC3/DMC4/DMC5)

**Output columns:** pcode, pdate, workshop, product, poutput, eoutput, routput, workforce, starttime, endtime, realnorm, norm, pspeed

### `check_production_insert_permission(p_pcode TEXT)` → BOOLEAN
**Purpose:** RLS helper check user có quyền insert vào workshop nào
**Logic (migration 004):**
```
IF user.role = 'ADMIN' THEN TRUE
IF user.workspace = 'ALL' THEN TRUE
IF user.workspace IS NULL OR '' THEN FALSE (non-ADMIN)
ELSE check workshop of pcode in data table against user.workspace
```

### `handle_updated_at()` TRIGGER
Auto update `updated_at` khi UPDATE row.

### `handle_new_user()` TRIGGER
Auto tạo row trong `profiles` khi có user mới sign up.

---

## 🔒 RLS Policies (migration 004)

### Tổng quan
- Mọi table đều bật RLS
- ADMIN bypass tất cả policy (qua `check_production_insert_permission`)
- MANAGER/SUPERVISOR/USER check workspace

### `profiles`
- SELECT: user đọc profile của chính mình (`auth.uid() = id`)
- UPDATE: user update profile của chính mình

### `data`
- SELECT: authenticated users
- INSERT: authenticated users (Apps Script service_role bypass)
- UPDATE: authenticated users ⚠️ (xem DB-002 trong known-issues.md)

### `Norm`, `Material`
- SELECT: authenticated users

### `Production`
- SELECT: authenticated users
- INSERT: `check_production_insert_permission(pcode)` = TRUE

---

## 📜 Migration History

| File | Nội dung | Trạng thái |
|------|----------|------------|
| `001_initial_schema.sql` | CREATE tất cả tables (data, Production, Norm, Material, profiles) + indexes + RLS cơ bản + triggers | ✅ Applied |
| `002_normalize_workshop_codes.sql` | Normalize `Norm.workshop` → DMC codes | ✅ Applied |
| `003_production_rls_strict.sql` | Tạo `check_production_insert_permission()` v1 (MANAGER = unrestricted) | ✅ Applied |
| `004_fix_empty_workspace_rls.sql` | Fix RLS: chỉ ADMIN unrestricted, MANAGER cũng bị workspace-scoped | ✅ Applied |
| `005_report_rpcs.sql` | Tạo `rpc_fetch_prod_rows` + `fn_classify_shift` v1 | ✅ Applied |
| `006_add_overtime_shift.sql` | Update `fn_classify_shift` thêm `ca_tang_ca` (16:30–22:00) | ✅ Applied |

---

## 📊 Indexes đã có (từ migration 001 + 005)

| Index | Table | Column | Mục đích |
|-------|-------|--------|----------|
| (UNIQUE) | `data` | `"PCODE"` | Business key uniqueness |
| `idx_data_pcode` | `data` | `"PCODE"` | Query lookup |
| `idx_data_initialdate` | `data` | `"INITIALDATE"` | Date range filter |
| `idx_data_workshop` | `data` | `"WORKSHOP"` | Workshop filter |
| `idx_norm_products` | `Norm` | `products` | JOIN với Production |
| `idx_norm_workshop` | `Norm` | `workshop` | Workshop filter |
| `idx_material_product` | `Material` | `product` | Lookup |
| `idx_production_pdate` | `Production` | `pdate` | Date range |
| `idx_production_pcode` | `Production` | `pcode` | JOIN với data |
| `idx_production_pcode_pdate` | `Production` | `(pcode, pdate)` | Composite từ migration 005 |

---

## ⚠️ Known data quality issues

### 1. Duplicate PCODE
- Google Sheet có thể có PCODE trùng (user copy-paste)
- Apps Script handle bằng `dedupeRecords()` giữ dòng cuối
- DB enforce UNIQUE constraint → upsert conflict handled

### 2. INITIALDATE rác
- Có record `INITIALDATE = "0003942"` → không phải date hợp lệ
- Apps Script skip những record này ở bước cast

### 3. Apps Script sync state
- Pointer `LAST_SYNCED_ROW` = row number trong Google Sheet
- KHÔNG lưu trong DB, chỉ trong Script Properties
- Nếu Apps Script bị reset → full resync

---

## 🔄 Drift Detection Checklist

Mỗi khi phiên bắt đầu, so sánh:

- [ ] Số migration file trong repo vs số migration trong DB
- [ ] Column list của mỗi table vs mô tả trong file này
- [ ] Danh sách RPC function vs liệt kê ở trên
- [ ] RLS policies còn match không

SQL check drift:
```sql
-- 1. Columns của data table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'data'
ORDER BY ordinal_position;

-- 2. Danh sách RPC
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

-- 3. RLS policies
SELECT schemaname, tablename, policyname, permissive, cmd, qual
FROM pg_policies WHERE schemaname = 'public';
```
