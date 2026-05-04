# PLAN — Module BẢO TRÌ & ĐIỀU PHỐI (data entry + plan→actual workflows)

> **Đối tượng đọc:** Sonnet (sẽ implement). Plan này tự đầy đủ — không cần hỏi user lại.
> **Bối cảnh nghiệp vụ:** Công ty cán tôn sóng / panel cách nhiệt / xà gồ Z-C.
> **Trạng thái hiện tại:**
> - Tables đã có sẵn ở migrations `009` (`findings_5s`), `010` (maintenance), `011` (coordination). KHÔNG cần migration mới.
> - `app/(dashboard)/dashboard/maintenance/page.tsx` = placeholder.
> - `app/(dashboard)/dashboard/coordination/page.tsx` = đã có HR sub-tab, các sub khác placeholder.
> - KPI calculation engine: `rpc_calculate_kpi` đã đọc từ các bảng này — chỉ cần có dữ liệu.
> - Reference pattern (cấu trúc form/list 1 file đã hoạt động): `components/production/defects-tab.tsx` + `lib/actions/defects.ts` + `lib/validations/defects.ts`.

---

## 0. Nguyên tắc thiết kế

| # | Nguyên tắc | Ghi chú |
|---|---|---|
| 1 | **Plan trước → Actual sau** | Mọi KPI có "đúng tiến độ/đúng KH" PHẢI có bước tạo kế hoạch, sau đó update khi hoàn thành. KHÔNG nhập trực tiếp `actual_date` cho 1 bản ghi mới. |
| 2 | **Nhập ít nhất có thể** | Mỗi field phải có lý do (KPI dùng tới hoặc cần audit). Field không bắt buộc → để optional, có default sensible. Tránh thêm field "đề phòng". |
| 3 | **Autocomplete > nhập tay** | `machine_code`, `customer`, `pcode`, `vehicle_code` — fetch distinct values từ rows hiện có làm gợi ý. Có thể tạo mới khi gõ giá trị chưa tồn tại. |
| 4 | **Generated columns không hiển thị input** | `is_on_time`, `downtime_minutes`, `accuracy_pct`, `damage_pct`, `cost_per_ton` được DB tự tính — frontend KHÔNG nhập, chỉ hiển thị. |
| 5 | **Workshop scoping** | SUPERVISOR/USER: workshop = `profiles.workspace`. ADMIN/MANAGER: chọn từ DMC1/3/4/5. Bảo vệ ở server action (đã có RLS hỗ trợ). |
| 6 | **Reuse pattern** | List + filter bar + "Thêm mới" button + modal form. Modal có Dialog (Radix) + react-hook-form + zodResolver. Toast (sonner) cho feedback. |
| 7 | **Row action: "Cập nhật thực hiện"** | Cho mọi pending plan. Mở modal nhỏ chỉ chứa actual_* fields, không cho sửa plan fields. |
| 8 | **Color coding nhất quán** | `pending`→amber, `in_progress`→blue, `on_time`→emerald, `late`→red, `cancelled`→gray. Dùng class Tailwind `bg-amber-50 text-amber-700 border-amber-200` v.v. |
| 9 | **Vietnamese labels** | UI hoàn toàn tiếng Việt. Action verbs ngắn: "Thêm", "Sửa", "Xóa", "Hoàn thành", "Hủy", "Chi tiết". |
| 10 | **Lint zero-warning** | `npm run lint` phải 0 problems mỗi lần commit. |

---

## 1. Industry context (cán tôn / panel / xà gồ)

### Common machines (bootstrap default machine list — seed vào `maintenance_schedule` form autocomplete)
| Mã gợi ý | Tên | Loại |
|---|---|---|
| MCT-01..05 | Máy cán tôn sóng vuông / sóng tròn / ngói | cán tôn |
| MXG-Z-01..03 | Máy cán xà gồ Z (Z100/120/150/200) | cán xà gồ |
| MXG-C-01..03 | Máy cán xà gồ C (C80/100/150) | cán xà gồ |
| MPN-01..02 | Máy ép panel cách nhiệt EPS/PU | panel line |
| MCC-01..02 | Máy cắt CNC plasma / cắt cuộn | cắt |
| MDU-01..02 | Máy đột lỗ | đột |
| MDC-01..04 | Decoiler / xả cuộn (5T / 10T) | xả cuộn |
| MUO-01..02 | Máy uốn / chấn | uốn |
| CTR-01..02 | Cẩu trục / cầu trục | nâng hạ |

### Failure types thường gặp (dropdown gợi ý cho `machine_breakdowns.failure_type`)
- `mechanical` — Cơ khí (lăn mòn, ổ bi, dây xích, nhông)
- `hydraulic` — Thủy lực (dò dầu, áp suất, bơm yếu, xy-lanh)
- `electrical` — Điện (chập, contactor, biến tần, cảm biến)
- `pneumatic` — Khí nén (van, xy-lanh, dò khí)
- `tooling` — Khuôn / dao (mòn, mẻ, lệch tâm)
- `software` — PLC / HMI / cảm biến lỗi đọc
- `operator` — Lỗi vận hành
- `material` — Phôi / cuộn lỗi

### Drawing types (cho `technical_drawings`)
- `tôn` — Shop drawing tôn lợp
- `xà-gồ` — Shop drawing xà gồ
- `panel` — Shop drawing panel
- `kết-cấu` — Bản vẽ kết cấu khung
- `khuôn-cán` — Khuôn / dao cán
- `lắp-đặt` — Bản vẽ lắp đặt công trình

### Vehicle types (cho `deliveries`)
- `xe-tải-2t`, `xe-tải-3.5t`, `xe-tải-5t`, `xe-tải-8t`, `xe-tải-15t`
- `container-20`, `container-40`
- `xe-rơ-mooc-tôn-dài` (xe chuyên dụng chở tôn dài 6-12m)
- `xe-cẩu`

### Reference industry apps (UX patterns đã chuẩn hóa, có thể học)
- **Fiix CMMS** / **UpKeep** / **Limble** — pattern Work Order: state machine open → in_progress → resolved, có timer khi đang sửa, comment + photo upload.
- **MaintainX** — mobile-first, ảnh sự cố là core.
- **SAP TM** / **Cargobase** — TMS: order → planned → in_transit → delivered → POD.
- **Asana / Monday.com** — pattern checklist cho `maintenance_schedule.checklist_items` (jsonb đã có).

---

## 2. MODULE BẢO TRÌ

### 2.0. Layout chung
- `app/(dashboard)/dashboard/maintenance/page.tsx`:
  - Server component: lấy `user`, redirect login nếu chưa auth.
  - Render `<MaintenanceShell user={user} activeSub={searchParams.sub ?? 'breakdowns'} />`.
- `components/maintenance/maintenance-shell.tsx` (client):
  - Sub-nav ngang: Sự cố | Lịch BT | Bản vẽ | Khảo sát.
  - Đổi sub bằng `?sub=breakdowns|schedule|drawings|surveys` (dùng `useSearchParams` + `<Link>` để giữ URL state).
  - Render `<BreakdownsTab/>`, `<ScheduleTab/>`, `<DrawingsTab/>`, `<SurveysTab/>`.

### 2.1. Tab "Sự cố máy" (KT-01 / KT-02 / KT-03)
**File:** `components/maintenance/breakdowns-tab.tsx`
**Bảng:** `machine_breakdowns`
**KPI dùng:**
- KT-01: SUM(downtime_minutes) / 60 / số_ngày, chỉ với `is_planned = false`
- KT-02: AVG(downtime_minutes) cho rows có `breakdown_end IS NOT NULL`
- KT-03: tổng giờ uptime / số sự cố unplanned

#### Filter bar
- Workshop dropdown (chỉ workshop được phép)
- Khoảng thời gian: từ/đến (mặc định: 30 ngày gần nhất)
- Trạng thái: Tất cả / Đang xử lý / Đã xong
- Loại sự cố: Tất cả / `failure_type` đã chọn

#### Table columns
| Cột | Nguồn | Format |
|---|---|---|
| Ngày bắt đầu | breakdown_start | dd/MM HH:mm |
| Máy | machine_code (+name nếu có) | mã đậm + tên xám |
| Xưởng | workshop | badge màu xưởng |
| Loại lỗi | failure_type | label tiếng Việt |
| Downtime | downtime_minutes | "1g 23p" hoặc "—" nếu chưa kết thúc |
| Trạng thái | status | badge color |
| Hành động | — | Cập nhật / Đánh dấu xong / Xóa (admin) |

#### Form modal — "Báo cáo sự cố"
| Field | Type | Required | Note |
|---|---|---|---|
| workshop | select | ✅ | scoped theo role |
| machine_code | combobox (autocomplete + tạo mới) | ✅ | gợi ý từ rows hiện có |
| machine_name | text | optional | auto-fill nếu machine_code đã có ở rows trước |
| breakdown_start | datetime-local | ✅ | mặc định now |
| breakdown_end | datetime-local | optional | nếu không nhập → status='in_progress' |
| is_planned | toggle | ✅ | mặc định false (sự cố đột xuất) |
| failure_type | select | ✅ | từ list ở mục 1 |
| root_cause | textarea | optional | mô tả nguyên nhân gốc |
| repair_action | textarea | optional | hành động đã làm |
| parts_replaced | text | optional | "ổ bi 6204, dầu thủy lực 5L" |
| technician | text | optional | tên thợ |
| notes | textarea | optional |

**Submit logic:**
- Nếu `breakdown_end` rỗng → `status = 'in_progress'`
- Nếu có `breakdown_end` → `status = 'resolved'`
- Server action validate `breakdown_end > breakdown_start`

#### Row action "Cập nhật thực hiện" (cho row có status != 'resolved')
Modal nhỏ:
- breakdown_end (now button)
- repair_action
- parts_replaced
- technician
- → set status = 'resolved'

---

### 2.2. Tab "Lịch bảo trì" (KT-04)
**File:** `components/maintenance/schedule-tab.tsx`
**Bảng:** `maintenance_schedule`
**KPI:** KT-04 = COUNT(is_on_time=true) / COUNT(*) cho rows có `scheduled_date BETWEEN from AND to`.

#### Hai mode UI tách biệt — toggle "Kế hoạch" / "Thực hiện"

##### Mode A — "Kế hoạch" (manager+ tạo lịch)
- Filter: workshop, tháng/quý.
- Table view: lịch dạng list (KHÔNG calendar — quá phức tạp). Cột: scheduled_date | máy | loại BT | trạng thái (chưa/đã/quá hạn) | hành động (Hoàn thành / Sửa / Xóa).
- Action "Thêm lịch": modal:
  | Field | Type | Required |
  |---|---|---|
  | workshop | select | ✅ |
  | machine_code | combobox | ✅ |
  | machine_name | text | optional |
  | maintenance_type | select (daily/weekly/monthly/quarterly/annually) | ✅ |
  | scheduled_date | date | ✅ |
  | checklist_items | dynamic list (text[]) | optional | "Kiểm tra ổ bi", "Bôi mỡ", ... |
  | technician | text | optional |
  | notes | textarea | optional |
- Action "Tạo lịch định kỳ" (bonus): modal cho phép tạo nhiều bản ghi cùng lúc theo chu kỳ:
  | Field | Mô tả |
  |---|---|
  | start_date | ngày đầu chu kỳ |
  | end_date | ngày cuối |
  | frequency | weekly/monthly/quarterly |
  | + các field như form tạo đơn |
  → Server action loop generate `scheduled_date` mỗi chu kỳ + insert batch.

##### Mode B — "Thực hiện" (technician đánh dấu hoàn thành)
- List filter mặc định: scheduled_date <= hôm nay AND actual_date IS NULL ("đến hạn / quá hạn").
- Mỗi row có button "Đánh dấu hoàn thành" → modal:
  - actual_date (default: today)
  - technician (default: current user)
  - notes (text về kết quả)
  - checklist_items: hiển thị list items; mỗi item có toggle "Đạt"/"Không đạt"; lưu lại vào jsonb với format `[{ item, ok, note }]`.

---

### 2.3. Tab "Bản vẽ kỹ thuật" (KT-05 / KT-06)
**File:** `components/maintenance/drawings-tab.tsx`
**Bảng:** `technical_drawings`
**KPI:**
- KT-05: COUNT(NOT has_errors) / COUNT(*) cho rows `delivered_date BETWEEN from AND to`
- KT-06: COUNT(is_on_time) / COUNT(*) cho rows `due_date BETWEEN from AND to`

#### Hai mode UI

##### Mode A — "Đăng ký yêu cầu"
- Action "Thêm yêu cầu": modal:
  | Field | Type | Required |
  |---|---|---|
  | drawing_code | text (unique check) | ✅ | format: BV-YYYYMMDD-NNN auto-generate, có thể sửa |
  | drawing_name | text | ✅ |
  | drawing_type | select (xem mục 1) | ✅ |
  | customer | combobox (autocomplete từ data."CUSTOMER") | optional |
  | project_code | text | optional |
  | request_date | date | ✅ | default today |
  | due_date | date | ✅ | default today + 7 ngày |
  | drafter | text | optional | tên người vẽ |
  | notes | textarea | optional |

##### Mode B — "Bàn giao / Hoàn thành"
- Filter mặc định: status != 'released'.
- Row action "Bàn giao" → modal:
  - delivered_date (default today)
  - has_errors (toggle)
  - error_count (number, hiện khi has_errors=true)
  - error_details (textarea, hiện khi has_errors=true)
  - reviewer (text, người duyệt)
  - status → cho chọn `approved`/`released`/`revised`

#### Table cột
| Cột | Nguồn |
|---|---|
| Mã BV | drawing_code |
| Tên / Loại | drawing_name + badge drawing_type |
| Khách hàng | customer |
| Yêu cầu / Hạn | request_date — due_date |
| Bàn giao | delivered_date hoặc "—" |
| Đúng hạn? | is_on_time → ✓/✗ badge |
| Lỗi | has_errors → "Có (N)" / "Không" |
| Trạng thái | status |
| Hành động | Bàn giao / Sửa / Xóa |

---

### 2.4. Tab "Khảo sát công trình" (KT-07)
**File:** `components/maintenance/surveys-tab.tsx`
**Bảng:** `site_surveys`
**KPI:** KT-07 = AVG(accuracy_pct) cho rows `survey_date BETWEEN from AND to`.

KHÔNG cần plan→actual (mỗi khảo sát là 1 lần đo và 1 kết quả ngay).

#### Form (1 mode duy nhất — "Nhập kết quả khảo sát")
| Field | Type | Required |
|---|---|---|
| survey_code | text | ✅ | format: KS-YYYYMMDD-NNN auto |
| survey_date | date | ✅ |
| project_code | text | optional |
| customer | combobox | optional |
| surveyor | text | optional |
| total_items | number | ✅ | tổng số mục đo (kích thước, độ vuông, độ cao, …) |
| error_items | number | ✅ | số mục sai/cần điều chỉnh, default 0 |
| error_details | dynamic JSON list | optional | `[{ item, expected, actual, note }]` — một bảng nhỏ trong modal |
| notes | textarea | optional |

#### Table
| Cột | |
|---|---|
| Mã KS | survey_code |
| Ngày | survey_date |
| Công trình | project_code + customer |
| Người KS | surveyor |
| Mục đo | total_items |
| Mục lỗi | error_items |
| Độ chính xác | accuracy_pct (%) — color: ≥95 emerald, 90-95 amber, <90 red |
| Hành động | Chi tiết / Sửa / Xóa |

---

## 3. MODULE ĐIỀU PHỐI (mở rộng từ CoordinationTab hiện có)

### 3.0. Layout chung
- Sửa `app/(dashboard)/dashboard/coordination/page.tsx` để truyền nhiều `activeSub` hơn.
- Sửa `components/coordination/coordination-tab.tsx`:
  ```tsx
  if (sub === 'hr') return <HRTab/>
  if (sub === 'delivery') return <DeliveryTab/>
  if (sub === 'findings5s') return <Findings5sTab dept="COORDINATION"/>
  if (sub === 'reports') return <ReportsTab/>
  if (sub === 'iso') return <IsoTab/>
  if (sub === 'kho') return <Placeholder/>      // giữ nguyên
  if (sub === 'hse') return <Placeholder/>      // giữ nguyên
  ```
- Sửa nav trong `components/layout/dashboard-shell.tsx`:
  ```tsx
  const COORDINATION_ITEMS = [
    { code: 'hr',         label: 'Nhân Sự',        icon: Users2,   href: '/dashboard/coordination?sub=hr' },
    { code: 'delivery',   label: 'Giao Hàng',      icon: Truck,    href: '/dashboard/coordination?sub=delivery' },
    { code: 'findings5s', label: '5S',             icon: ListChecks, href: '/dashboard/coordination?sub=findings5s' },
    { code: 'reports',    label: 'Báo Cáo TK',     icon: FileText, href: '/dashboard/coordination?sub=reports' },
    { code: 'iso',        label: 'Quy Trình ISO',  icon: BookCheck, href: '/dashboard/coordination?sub=iso' },
    { code: 'kho',        label: 'Kho',            icon: Package2, href: '/dashboard/coordination?sub=kho' },
    { code: 'hse',        label: 'An Toàn',        icon: ShieldAlert, href: '/dashboard/coordination?sub=hse' },
  ]
  ```

---

### 3.1. Tab "Giao hàng" (KH-02 / KH-03 / KH-07)
**File:** `components/coordination/delivery-tab.tsx`
**Bảng:** `deliveries`
**KPI:**
- KH-02: SUM(damaged_weight_tons) / SUM(total_weight_tons) cho rows có `actual_date` trong kỳ
- KH-03: AVG(cost_per_ton) hiện tại / baseline 2025 × 100
- KH-07: COUNT(is_on_time) / COUNT(*) cho rows status='delivered' với `planned_date` trong kỳ

KHÔNG cần 2 mode tách biệt — 1 form duy nhất, các trường actual chỉ enable khi status > planned.

#### Form modal — "Giao hàng" (vừa tạo lịch vừa update)
| Field | Type | Required khi status | Note |
|---|---|---|---|
| delivery_code | text | ✅ | auto: GH-YYMMDD-NNN |
| pcode | combobox (autocomplete từ `data.PCODE`) | optional | nếu có → auto-fill customer |
| customer | text | ✅ | bắt buộc (KH-02/07 cần) |
| delivery_address | textarea | optional |
| planned_date | date | ✅ |
| total_weight_tons | number (3 chữ số thập phân) | ✅ |
| vehicle_code | text | optional | "51C-12345" |
| vehicle_type | select (xem mục 1) | optional |
| driver | text | optional |
| **Sau khi giao** (chỉ enable khi click "Cập nhật giao hàng" trên row planned/in_transit): |
| actual_date | date | ✅ khi status=delivered |
| damaged_weight_tons | number | optional, default 0 |
| damage_reason | textarea | required khi damaged > 0 |
| delivery_cost | number (VND) | optional | dùng cho KH-03 |
| status | select (planned/in_transit/delivered/damaged/cancelled) | ✅ |
| notes | textarea | optional |

#### Hành động trên row
- Status `planned` → action "Bắt đầu giao" (set status='in_transit') / "Hủy" / "Sửa"
- Status `in_transit` → action "Hoàn thành giao" (mở modal nhập actual)
- Status `delivered` → action "Chi tiết" / "Sửa" (chỉ admin)

#### Table
| Cột | |
|---|---|
| Mã GH | delivery_code |
| Khách hàng | customer + pcode (nhỏ, xám) |
| Kế hoạch | planned_date |
| Thực hiện | actual_date / "—" |
| Khối lượng | total_weight_tons (T) |
| Hư hỏng | damage_pct (%) — red nếu >0 |
| CP / Tấn | cost_per_ton — currency VND |
| Đúng hạn | is_on_time ✓/✗ |
| Trạng thái | status badge |
| Hành động | per status |

#### Sub-section "Baseline chi phí 2025" (admin only — quản lý `delivery_cost_baseline`)
- Form đơn giản: year + month (optional) + avg_cost_per_ton.
- 1 row baseline 2025 (NULL month = cả năm) là cần thiết cho KH-03.

---

### 3.2. Tab "5S Bộ phận KH" (KH-04)
**File:** `components/coordination/findings-5s-tab.tsx`
**Bảng:** `findings_5s` với `department='COORDINATION'`
**KPI:** KH-04 = COUNT(is_on_time) / COUNT(*) cho `finding_date` trong kỳ AND department IN ('COORDINATION','ALL').

> Lưu ý: cùng component có thể tái dùng cho SX-05 (department='PRODUCTION'). Đặt prop `dept` để filter.

#### Form modal — "Phát hiện 5S"
| Field | Type | Required |
|---|---|---|
| finding_date | date | ✅ | default today |
| workshop | select (DMC1/3/4/5 hoặc "Văn phòng") | ✅ |
| department | hidden (auto từ prop) | ✅ |
| area | text | optional | "Khu thành phẩm", "Kho NVL", "Văn phòng KH" |
| category | select (5 mục) | ✅ | Sàng lọc / Sắp xếp / Sạch sẽ / Săn sóc / Sẵn sàng |
| description | textarea | ✅ | mô tả vấn đề |
| severity | select (low/medium/high) | ✅ | default medium |
| due_date | date | ✅ | hạn xử lý |
| responsible_person | text | optional |
| photo_url | text (URL) | optional | tạm thời chỉ URL, future: upload Supabase Storage |

#### Row action "Đánh dấu xử lý"
- resolved_date (default today)
- resolution_notes (textarea)

#### Table
| Cột | |
|---|---|
| Ngày | finding_date |
| Khu vực | workshop + area |
| Loại 5S | category badge |
| Mô tả | description (truncate 2 dòng) |
| Hạn xử lý | due_date — color: hôm nay+ red, sắp tới amber |
| Đã xử lý | resolved_date / "—" |
| Đúng hạn | is_on_time ✓/✗/— |
| Mức độ | severity badge |
| Hành động | Xử lý / Sửa / Xóa |

---

### 3.3. Tab "Báo cáo thống kê" (KH-05)
**File:** `components/coordination/reports-tab.tsx`
**Bảng:** `statistical_reports`
**KPI:** KH-05 = COUNT(is_on_time) / COUNT(*) cho rows `due_date` trong kỳ AND status='submitted'.

#### Hai mode

##### Mode A — "Lịch báo cáo định kỳ"
Mặc định view: filter `status IN ('pending','overdue')`.
Action "Thêm báo cáo":
| Field | Type | Required |
|---|---|---|
| report_name | text | ✅ | "Báo cáo doanh thu T4/2026" |
| report_type | select (weekly/monthly/quarterly/yearly/adhoc) | ✅ |
| due_date | date | ✅ |
| recipient | text | optional | "BGĐ", "Sở Công Thương", … |
| responsible_person | text | optional |
| notes | textarea | optional |

Action "Tạo lịch định kỳ" (bonus, giống schedule-tab):
- Cho phép generate nhiều due_date theo chu kỳ.

##### Mode B — "Nộp báo cáo"
- Row action "Nộp" → modal:
  - submitted_date (default today)
  - notes (textarea — link drive, file, ghi chú)
  - status → 'submitted'

#### Table
| Cột | |
|---|---|
| Tên báo cáo | report_name + type badge |
| Người chịu trách nhiệm | responsible_person |
| Hạn nộp | due_date |
| Đã nộp | submitted_date / "—" |
| Đúng hạn | is_on_time |
| Trạng thái | status (pending/submitted/overdue) — auto recompute từ DB? Cron OPTIONAL — phase 1 set thủ công |
| Hành động | Nộp / Sửa / Xóa |

---

### 3.4. Tab "Quy trình ISO" (KH-06)
**File:** `components/coordination/iso-tab.tsx`
**Bảng:** `iso_procedures`
**KPI:** KH-06 = COUNT(is_on_time) / COUNT(*) cho rows `planned_completion_date` trong kỳ.

#### Hai mode

##### Mode A — "Kế hoạch xây dựng"
Action "Thêm quy trình":
| Field | Type | Required |
|---|---|---|
| procedure_code | text (unique) | ✅ | format: ISO-YYYY-NNN |
| procedure_name | text | ✅ |
| category | select (quality/safety/HR/finance/production) | optional |
| planned_completion_date | date | ✅ |
| responsible_person | text | optional |
| notes | textarea | optional |

##### Mode B — "Cập nhật tiến độ"
- Mỗi row có:
  - Slider/number 0-100 → `progress_pct`
  - Action "Hoàn thành" → modal nhỏ: actual_completion_date, document_url, status → 'released'

#### Table
| Cột | |
|---|---|
| Mã | procedure_code |
| Tên / Loại | procedure_name + category badge |
| Người phụ trách | responsible_person |
| Hạn KH | planned_completion_date |
| Hoàn thành | actual_completion_date |
| Tiến độ | progress bar progress_pct |
| Trạng thái | status (draft/reviewing/approved/released/revised) |
| Hành động | Cập nhật / Hoàn thành / Sửa |

---

## 4. CẤU TRÚC FILE — checklist Sonnet phải tạo

### 4.1. Validations (Zod schemas)
**`lib/validations/maintenance.ts`** — export:
- `breakdownCreateSchema`, `breakdownUpdateSchema`, `BreakdownInput` type
- `scheduleCreateSchema`, `scheduleBulkCreateSchema`, `scheduleCompleteSchema`
- `drawingCreateSchema`, `drawingCompleteSchema`
- `surveyCreateSchema`
- Constants: `FAILURE_TYPES`, `FAILURE_TYPE_LABELS`, `MAINTENANCE_TYPES`, `MAINTENANCE_TYPE_LABELS`, `DRAWING_TYPES`, `DRAWING_TYPE_LABELS`, `BREAKDOWN_STATUSES`, `DRAWING_STATUSES`

**`lib/validations/coordination.ts`** — export:
- `deliveryCreateSchema`, `deliveryCompleteSchema`, `deliveryBaselineSchema`
- `finding5sCreateSchema`, `finding5sResolveSchema`
- `statReportCreateSchema`, `statReportSubmitSchema`, `statReportBulkSchema`
- `isoCreateSchema`, `isoUpdateProgressSchema`, `isoCompleteSchema`
- Constants: `VEHICLE_TYPES`, `DELIVERY_STATUSES`, `FIVE_S_CATEGORIES` (5 cái tiếng Việt), `SEVERITIES`, `REPORT_TYPES`, `ISO_CATEGORIES`, `ISO_STATUSES`

**Validation rules quan trọng:**
- Datetime: `breakdown_end > breakdown_start`
- Date order: `due_date >= request_date`, `planned_date >= today` (cảnh báo nhưng không chặn nếu admin)
- `damaged_weight_tons <= total_weight_tons`
- `error_items <= total_items`
- `progress_pct: 0..100`
- `delivery_code`, `procedure_code`, `drawing_code`: `/^[A-Z0-9-]+$/i`, length 5-30
- Vietnamese error messages (theo style đã có ở `defects.ts`).

### 4.2. Server actions
**`lib/actions/maintenance.ts`** — export:

```ts
// Breakdowns
export async function createBreakdownAction(input: BreakdownCreateInput): Promise<{success, message, id?}>
export async function updateBreakdownAction(id, input): Promise<{success, message}>
export async function resolveBreakdownAction(id, input: { breakdown_end, repair_action?, parts_replaced?, technician? }): Promise<{success, message}>
export async function deleteBreakdownAction(id): Promise<{success, message}>     // ADMIN only
export async function listBreakdownsAction(filter): Promise<{success, data?: BreakdownRow[]}>

// Schedule
export async function createScheduleAction(input): Promise<...>
export async function bulkCreateScheduleAction(input): Promise<{success, count, message}>  // generate by frequency
export async function updateScheduleAction(id, input): Promise<...>
export async function completeScheduleAction(id, input: { actual_date, technician?, notes?, checklist_items? }): Promise<...>
export async function deleteScheduleAction(id): Promise<...>      // ADMIN
export async function listScheduleAction(filter): Promise<...>

// Drawings
export async function createDrawingAction(input): Promise<{success, message, id?}>
export async function updateDrawingAction(id, input): Promise<...>
export async function completeDrawingAction(id, input: { delivered_date, has_errors, error_count?, error_details?, reviewer?, status }): Promise<...>
export async function deleteDrawingAction(id): Promise<...>       // ADMIN
export async function listDrawingsAction(filter): Promise<...>

// Surveys
export async function createSurveyAction(input): Promise<...>
export async function updateSurveyAction(id, input): Promise<...>
export async function deleteSurveyAction(id): Promise<...>        // ADMIN
export async function listSurveysAction(filter): Promise<...>

// Helpers (autocomplete)
export async function listMachineCodesAction(workshop?: string): Promise<{ machine_code, machine_name? }[]>
```

**`lib/actions/coordination.ts`** — export (đặt tên file mới để không clash với `hr.ts`):

```ts
// Deliveries
export async function createDeliveryAction(input): Promise<{success, message, id?}>
export async function updateDeliveryAction(id, input): Promise<...>
export async function completeDeliveryAction(id, input: { actual_date, damaged_weight_tons?, damage_reason?, delivery_cost?, status }): Promise<...>
export async function cancelDeliveryAction(id, reason): Promise<...>
export async function deleteDeliveryAction(id): Promise<...>       // ADMIN
export async function listDeliveriesAction(filter): Promise<...>

// Baseline
export async function upsertCostBaselineAction(input: { year, month?, avg_cost_per_ton }): Promise<...>  // ADMIN
export async function listCostBaselinesAction(): Promise<...>

// Findings 5S
export async function createFinding5sAction(input): Promise<...>
export async function resolveFinding5sAction(id, input: { resolved_date, resolution_notes? }): Promise<...>
export async function updateFinding5sAction(id, input): Promise<...>
export async function deleteFinding5sAction(id): Promise<...>      // ADMIN
export async function listFindings5sAction(filter: { dept: 'PRODUCTION'|'COORDINATION'|'MAINTENANCE'|'ALL', ... }): Promise<...>

// Statistical reports
export async function createStatReportAction(input): Promise<...>
export async function bulkCreateStatReportAction(input): Promise<{success, count}>
export async function submitStatReportAction(id, input: { submitted_date, notes? }): Promise<...>
export async function updateStatReportAction(id, input): Promise<...>
export async function deleteStatReportAction(id): Promise<...>     // ADMIN
export async function listStatReportsAction(filter): Promise<...>

// ISO
export async function createIsoAction(input): Promise<...>
export async function updateIsoProgressAction(id, progress_pct): Promise<...>
export async function completeIsoAction(id, input: { actual_completion_date, document_url?, status }): Promise<...>
export async function updateIsoAction(id, input): Promise<...>
export async function deleteIsoAction(id): Promise<...>            // ADMIN
export async function listIsoAction(filter): Promise<...>

// Helpers
export async function listCustomersAction(): Promise<string[]>     // distinct from data."CUSTOMER"
export async function listVehicleCodesAction(): Promise<string[]>
```

**Common patterns trong server actions (theo `defects.ts`):**
1. `'use server'` ở đầu file
2. `requireAuth()` đầu mỗi action — return error nếu không login
3. `revalidatePath('/dashboard/maintenance')` (hoặc coordination) sau mỗi mutation
4. `revalidatePath('/dashboard/report/kpi')` để KPI cập nhật ngay
5. Validate bằng schema → return error message sang client
6. Try/catch toàn function, log lỗi qua `logger.error(...)` (`@/lib/logger`)
7. Return shape: `{ success: boolean; message: string; data?: T; id?: string }`

### 4.3. Components
```
components/maintenance/
├── maintenance-shell.tsx                ← tab navigator
├── breakdowns-tab.tsx                   ← KT-01/02/03
├── schedule-tab.tsx                     ← KT-04 plan+actual
├── drawings-tab.tsx                     ← KT-05/06 plan+actual
├── surveys-tab.tsx                      ← KT-07
├── _shared/
│   ├── machine-combobox.tsx             ← autocomplete machine_code
│   ├── workshop-select.tsx              ← reuse component (có thể đã có)
│   ├── filter-bar.tsx                   ← from/to/workshop/status
│   └── status-badge.tsx                 ← shared color logic
└── _modals/
    ├── breakdown-form-dialog.tsx
    ├── breakdown-resolve-dialog.tsx
    ├── schedule-create-dialog.tsx
    ├── schedule-bulk-create-dialog.tsx
    ├── schedule-complete-dialog.tsx
    ├── drawing-create-dialog.tsx
    ├── drawing-complete-dialog.tsx
    └── survey-form-dialog.tsx

components/coordination/
├── (existing files giữ nguyên)
├── delivery-tab.tsx                     ← KH-02/03/07
├── findings-5s-tab.tsx                  ← KH-04 (reusable)
├── reports-tab.tsx                      ← KH-05
├── iso-tab.tsx                          ← KH-06
├── _shared/
│   ├── customer-combobox.tsx
│   └── pcode-combobox.tsx
└── _modals/
    ├── delivery-form-dialog.tsx
    ├── delivery-complete-dialog.tsx
    ├── delivery-baseline-dialog.tsx
    ├── finding-5s-form-dialog.tsx
    ├── finding-5s-resolve-dialog.tsx
    ├── stat-report-form-dialog.tsx
    ├── stat-report-bulk-dialog.tsx
    ├── stat-report-submit-dialog.tsx
    ├── iso-form-dialog.tsx
    └── iso-complete-dialog.tsx
```

### 4.4. Pages (server components)
- `app/(dashboard)/dashboard/maintenance/page.tsx`:
  ```tsx
  export default async function MaintenancePage({ searchParams }) {
    const [user, params] = await Promise.all([getSessionUser(), searchParams])
    if (!user) redirect('/login')
    const sub = (params.sub ?? 'breakdowns') as MaintenanceSub
    return <MaintenanceShell user={user} activeSub={sub} />
  }
  ```
- `app/(dashboard)/dashboard/coordination/page.tsx`: thêm các sub mới vào CoordinationTab routing.

### 4.5. Nav update
Cập nhật `components/layout/dashboard-shell.tsx`:
- Thêm `MAINTENANCE_ITEMS` array (dropdown giống REPORT/COORDINATION) — 4 sub maintenance.
- Mở rộng `COORDINATION_ITEMS` thêm 4 sub mới.

---

## 5. UI primitives & dependencies

### Đã có (kiểm tra qua imports trong codebase)
- `lucide-react` — icons
- `react-hook-form` + `@hookform/resolvers/zod` + `zod`
- `sonner` — toast
- Radix Dialog (qua `components/ui/dialog.tsx` nếu có sẵn — nếu chưa thì tạo)
- Tailwind + class merger `cn` từ `@/lib/utils`

### Component dùng chung — nếu chưa có, tạo trong `components/ui/`:
- `<Combobox>` — autocomplete với option tạo mới
- `<DateInput>` — date picker đơn giản (HTML5 `type=date`, label đẹp)
- `<DateTimeInput>` — `type=datetime-local`
- `<NumberInput>` — số có format VN
- `<Dialog>` — modal wrapper
- `<Select>` — wrapper cho `<select>` native styled
- `<Badge>` — pill với variant (success/warning/danger/info/neutral)
- `<EmptyState>` — placeholder khi list rỗng (icon + title + subtitle + CTA)
- `<TableSkeleton>` — loading state

**KHÔNG dùng** thư viện UI mới (TanStack Table, Mantine v.v.) — keep stack hiện tại.

---

## 6. KPI integration & smoke tests

### 6.1. Sau khi build xong, test bằng cách nhập sample data
**Maintenance:**
- 5 sự cố (3 unplanned, 2 planned), mỗi cái 30-180 phút downtime, đủ 4 xưởng
- 10 lịch BT trong tháng hiện tại, 7 đã hoàn thành (5 đúng hạn, 2 trễ)
- 8 bản vẽ trong tháng: 5 đã giao (4 không lỗi đúng hạn, 1 có lỗi trễ), 3 chưa giao
- 4 khảo sát công trình, accuracy 92-98%

**Coordination:**
- 1 baseline 2025: 800,000 VND/tấn
- 12 deliveries trong tháng: 10 delivered (8 on-time, 1 damaged 5%, 1 late), 2 in_transit
- 6 findings 5S COORDINATION: 4 resolved (3 đúng hạn), 2 pending
- 5 stat reports: 4 submitted (3 đúng hạn), 1 overdue
- 3 ISO procedures: 1 released đúng hạn, 1 in progress (60%), 1 draft

### 6.2. Verify KPI report
Mở `/dashboard/report/kpi`, period=monthly, anchor=hôm nay:
- KT-01: ~ tổng phút unplanned / 60 / số ngày
- KT-02: ~ avg phút resolved
- KT-04: 5/7 = 71.4%
- KT-05: 4/5 = 80%
- KT-06: ~ % drawings có due_date trong tháng và is_on_time
- KT-07: ~ avg accuracy_pct
- KH-02: ~ damage_pct (tons)
- KH-03: ~ avg cost_per_ton / 800000 × 100
- KH-04: 3/4 (resolved) = 75%
- KH-05: 3/4 = 75%
- KH-06: ~ released on-time %
- KH-07: 8/10 = 80%

### 6.3. Acceptance criteria
- ✅ Mỗi tab load < 1s với 100 rows
- ✅ Form validate đầy đủ — không cho submit invalid
- ✅ Toast hiện khi success/error
- ✅ Sau mutate: list reload, KPI report `/dashboard/report/kpi` cập nhật ngay (revalidatePath)
- ✅ Workshop scoping respected: SUPERVISOR DMC1 chỉ thấy data DMC1
- ✅ ADMIN-only delete có check ở server, không chỉ ẩn nút
- ✅ `npm run lint` 0 problems, `npm run type-check` clean
- ✅ Generated columns không xuất hiện trong form input

---

## 7. Thứ tự implement đề xuất

| Phase | Việc | Output |
|---|---|---|
| 1 | Validations (`maintenance.ts`, `coordination.ts`) — toàn bộ schemas + constants | 2 files |
| 2 | Server actions maintenance (breakdowns + schedule + drawings + surveys) | 1 file |
| 3 | Server actions coordination (deliveries + 5s + reports + iso) | 1 file |
| 4 | UI primitives nếu thiếu (`Dialog`, `Combobox`, `Badge`, `EmptyState`) | components/ui/ |
| 5 | Maintenance shell + 4 tabs + modals | components/maintenance/* |
| 6 | Coordination 4 tabs mới + modals | components/coordination/* |
| 7 | Nav update (`dashboard-shell.tsx`) — thêm dropdown maintenance + extend coordination | 1 file |
| 8 | Pages: `maintenance/page.tsx` (refactor placeholder), `coordination/page.tsx` (extend routing) | 2 files |
| 9 | Manual smoke test: enter sample data → verify KPI report | — |
| 10 | Lint + type-check + commit + push branch + PR vào `staging` | — |

**Branch name đề xuất:** `feat/maintenance-coordination-data-entry`

**Khi PR:** không tự merge — hỏi user trước (theo memory rule).

---

## 8. Câu hỏi user nên trả lời SAU khi UI có thật

Để tránh over-engineer, để các quyết định sau test:
- Cần upload ảnh (Supabase Storage) cho 5S và breakdowns? (phase 2)
- Cần SMS/email alert khi có sự cố nghiêm trọng? (phase 2)
- Cần PDF export cho báo cáo bảo trì tháng? (phase 3)
- Mobile-friendly (PWA cho thợ máy)? (phase 3)

---

## 9. Quy chiếu code đã có

Khi cần xem pattern, đọc các file sau:
- **List + form trong 1 tab:** `components/production/defects-tab.tsx`
- **Server action w/ validation + revalidate:** `lib/actions/defects.ts`
- **Zod schema + Vietnamese errors + constants:** `lib/validations/defects.ts`
- **Tab navigator pattern:** `components/coordination/coordination-tab.tsx` (HR đang dùng)
- **Admin tab w/ table + edit form (đơn giản hơn):** `components/admin/kpi-settings-tab.tsx`
- **Dropdown sub-nav:** `components/layout/dashboard-shell.tsx` (REPORT_ITEMS / COORDINATION_ITEMS)

---

## 10. Ghi chú giả định & lựa chọn cố ý

- **KHÔNG dùng calendar view** — list view với filter từ/đến đủ dùng và đơn giản hơn nhiều.
- **KHÔNG tạo machines master table** — TEXT machine_code + autocomplete distinct là đủ, không cần thêm bảng/RLS/CRUD cho master nhỏ.
- **KHÔNG tự generate due_date theo cron** cho stat_reports — admin tạo bằng "Tạo lịch định kỳ" 1 lần/quý là đủ. Cron auto-generate là phase sau.
- **KHÔNG dùng workflow engine** — state machine đơn giản qua `status` enum + button "Cập nhật" trên row là đủ cho scope hiện tại.
- **KHÔNG enforce quá strict ngày tháng ở client** (vd: planned_date >= today). Cảnh báo (warning text màu vàng) thay vì block — vì có thể cần backdate khi nhập lại dữ liệu cũ.
- **Photo upload:** phase 2. Ban đầu dùng URL text field cho `photo_url`/`document_url` — admin paste link Drive/SharePoint.
- **Audit log:** đã có trigger `log_table_change` cho một số bảng. Không thêm gì mới — DB tự log.
- **i18n:** không hỗ trợ — toàn bộ tiếng Việt cứng.

---

**Hết plan. Sonnet bắt đầu Phase 1.**
