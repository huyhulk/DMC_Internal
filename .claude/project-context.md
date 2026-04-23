# Project Context — DMC Production Manager

## 🏢 Tên dự án
**DMC Production Manager** — Hệ thống quản lý nhập liệu và báo cáo sản xuất

## 🎯 Mục tiêu nghiệp vụ

Quản lý toàn bộ vòng đời sản xuất tại nhà máy có **4 phân xưởng** (PX1-PX4, thực tế dùng mã DMC), bao gồm:
- Nhập lệnh sản xuất (YCSX) từ Google Sheet nguồn
- Ghi nhận kết quả sản xuất thực tế theo ca
- Báo cáo tiến độ, chất lượng, hiệu suất (OEE)
- Điều phối và bảo trì thiết bị
- Quản lý nhân sự, phân quyền

## 👥 Người dùng & phân quyền

4 role cố định trong bảng `profiles.role`:

| Role | Quyền | Ví dụ user |
|------|-------|-----------|
| **ADMIN** | Unrestricted mọi thứ, quản lý user | IT, quản lý cấp cao |
| **MANAGER** | Xem toàn bộ báo cáo, quản lý nhiều workspace | Giám đốc sản xuất |
| **SUPERVISOR** | Xem/sửa workspace được giao | Quản đốc phân xưởng |
| **USER** | Nhập liệu trong workspace được giao | Nhân viên vận hành |

**Cơ chế workspace:**
- `profiles.workspace` = mã phân xưởng được giao (VD: "DMC1", "DMC3")
- Giá trị `"ALL"` = access tất cả workspace
- Giá trị rỗng/NULL = DENY (chỉ ADMIN bypass)

## 🏗️ Stack tech

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.4 |
| Runtime | Node.js | ≥22.x |
| Database | Supabase (PostgreSQL) | @supabase/supabase-js ^2.49.4 |
| Auth | Supabase Auth | @supabase/ssr ^0.6.1 |
| UI | Radix UI + Tailwind CSS + shadcn-style | Tailwind 3.4 |
| Charts | ECharts + Recharts (cả 2) | ECharts 6.0, Recharts 2.15 |
| Dashboard | Tremor | 3.18 |
| Form | react-hook-form + zod | 7.x, 3.24 |
| Date util | date-fns | 4.1 |
| Logging | pino | 9.6 |
| Testing | Jest + ts-jest | 30.x |
| CI/CD | GitHub Actions | - |
| Hosting | Vercel | auto-detect |

### Lý do dùng 2 chart library (ECharts + Recharts)
- **Recharts**: Chart đơn giản, tương thích tốt với Tremor, bundle nhỏ
- **ECharts**: Radar chart, heatmap, dashboard phức tạp (comparison 4 xưởng)
- Quyết định: giữ nguyên cả 2, không consolidate

## 🌐 Environment

### Production
- **URL:** (chưa document — cần fill sau)
- **Supabase project:** `hzuyucyxyohppxfwresq`
- **Branch deploy:** `main`

### Staging
- **Chưa có** — đây là **risk cao** (xem known-issues.md SYS-001)
- Mọi thay đổi DB hiện tại đều chạy thẳng production
- Ưu tiên cao: tạo staging Supabase project

## 📥 Nguồn dữ liệu ngoài

### Google Sheet "Tổng hợp 2026"
- **File ID:** `1Ozptnmr-X0XIYti4PXoFzsYXQrMO8dAki4I1h-cgFU8`
- **Sheet name:** `Tổng hợp 2026`
- **Mục đích:** Nguồn chính của bảng `data` (lệnh sản xuất)
- **Sync cơ chế:** Google Apps Script (không trong repo) chạy trigger mỗi 5 phút
- **Pointer:** `LAST_SYNCED_ROW` trong Script Properties
- **Columns map (source → dest):**
  - `số YCSX` → `"PCODE"` (PK, required)
  - `Ngày lập phiếu` → `"INITIALDATE"` (date)
  - `Khách hàng` → `"CUSTOMER"`
  - `Xưởng Sản Xuất` → `"WORKSHOP"`
  - `Diễn giải` → `"DESCRIPTION"` (optional)
  - `Số lượng` → `"QUANTITY"` (number)
  - `Ngày KD` → `"DEADLINEDATE"` (timestamptz với +07:00)
  - `Tình trạng` → `"STATUS"` (optional)

### Data flow
```
Google Sheet "Tổng hợp 2026"
      ↓ (Apps Script, 5min)
  Supabase table "data"
      ↓ (supabase-js)
  Next.js Server Components / API Routes
      ↓
  User browser (React)
```

## 📐 Business Rules bắt buộc

### 1. Timezone
- **LUÔN** dùng `Asia/Ho_Chi_Minh` (UTC+7)
- Mọi datetime phải có offset `+07:00`

### 2. Tuần ISO 8601
- Thứ 2 là ngày đầu tuần
- Format: `2026-W17`
- PostgreSQL: `TO_CHAR(date, 'IYYY-"W"IW')`

### 3. OEE
- Công thức: `OEE = A × P × Q`
- A = Availability = `(sản lượng / pspeed) / (endtime - starttime)` (hour)
- P = Performance = `realnorm / norm`
- Q = Quality = `sản lượng đạt / tổng sản lượng`
- Roll-up: **weighted average theo sản lượng**, KHÔNG dùng trung bình cộng

### 4. Khung giờ ca (migration 006)
| Ca | Khung giờ |
|------|-----------|
| ca_sang_1 | 7:30–9:30 |
| ca_sang_2 | 9:30–11:30 |
| ca_chieu_1 | 12:30–14:30 |
| ca_chieu_2 | 14:30–16:30 |
| ca_tang_ca | 16:30–22:00 |
| khac | ngoài các khung trên |

### 5. Lệnh sản xuất (YCSX)
- Mỗi lệnh có 1 PCODE duy nhất (ví dụ: `LSX01/26-01094`)
- Format: `LSX{xưởng}/26-{stt}`
- Deadline phải sau ngày lập
- Quantity > 0

## 🚫 KHÔNG làm gì

- KHÔNG sửa data bảng `data` qua SQL (phải sửa Google Sheet)
- KHÔNG tạo workspace mới ngoài 4 phân xưởng + "ALL"
- KHÔNG bypass RLS (nên sửa policy thay vì dùng service_role)
- KHÔNG tự ý thêm role mới vào enum
