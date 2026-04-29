# PLAN TRIỂN KHAI KPI 2026 - DMC PRODUCTION MANAGER
## Phase 3: KPI Tracking & Reporting System

> **Mục tiêu**: Mở rộng dự án hiện tại để nhập liệu, theo dõi và xuất báo cáo KPI cho 3 bộ phận (Sản Xuất, Kỹ Thuật, Kế Hoạch) và module Tăng Ca theo file Mục_Tiêu_Bộ_Phận_KTSX_2026.xlsx và TĂNG_CA__-_Tăng_ca_04_2026.csv.
>
> **Áp dụng cho**: Claude CLI / Claude Code (terminal-based agent)
>
> **Project hiện tại**: Next.js 16 + Supabase + 4 phân xưởng (DMC1, DMC3, DMC4, DMC5)

---

## 0. TÓM TẮT KPI CẦN THEO DÕI (Trích từ file mục tiêu)

### 0.1. Bộ phận SẢN XUẤT (theo Quý)
| ID | Chỉ số | Mục tiêu | Công thức |
|----|--------|----------|-----------|
| SX-01 | Tỷ lệ lỗi thành phẩm | ≤ 0.1% | Σ KL lỗi / Σ KL sản xuất |
| SX-02 | Đúng tiến độ đơn hàng | ≥ 99.5% | SL đơn hoàn thành / Tổng SL đơn |
| SX-03 | Hiệu suất sản xuất (OEE) | ≥ 90% | (đã có sẵn trong project) |
| SX-04 | Chi phí NVL trong định mức | ≥ 99.5% | Tiêu hao thực / Tiêu hao định mức |
| SX-05 | Tỷ lệ hoàn thành 5S | ≥ 90% | Hình 5S khắc phục đúng hạn / Tổng hình phát hiện |
| SX-06 | Tiến độ thi công công trình | ≥ 95% | Tổng thời gian KH / Tổng thời gian thực tế |

### 0.2. Bộ phận KỸ THUẬT - BẢO TRÌ (theo Tháng)
| ID | Chỉ số | Mục tiêu | Công thức |
|----|--------|----------|-----------|
| KT-01 | Thời gian dừng máy ngoài KH | < 4h/ngày | Σ thời gian dừng / số ngày trong tháng |
| KT-02 | MTTR - Thời gian sửa chữa TB | ≤ 60 phút/lần | Σ thời gian sửa / Σ số lần hỏng |
| KT-03 | MTBF - Thời gian giữa 2 lỗi | ≥ 160 giờ | Σ thời gian hoạt động / Σ số lần hỏng |
| KT-04 | Tỷ lệ bảo trì đúng KH | 100% | SL bảo trì thực hiện / SL bảo trì theo lịch |
| KT-05 | Độ chính xác bản vẽ/bóc tách | ≥ 99% | Bản vẽ chính xác / Tổng bản vẽ ban hành |
| KT-06 | Thời gian hoàn thành bản vẽ | ≥ 99% | BV đúng tiến độ / Tổng BV cần hoàn thành |
| KT-07 | Độ chính xác khảo sát công trình | ≥ 95% | (Tổng - Số lỗi) / Tổng số thông tin khảo sát |

### 0.3. Bộ phận KẾ HOẠCH - PHỐI HỢP (theo Tháng)
| ID | Chỉ số | Mục tiêu | Công thức |
|----|--------|----------|-----------|
| KH-02 | Tỷ lệ hư hỏng/mất mát vận chuyển | ≤ 0.1% | KL hư hỏng / Tổng KL vận chuyển |
| KH-03 | Chi phí giao hàng | ≤ 90% so 2025 | Chi phí/tấn năm nay / Chi phí/tấn 2025 |
| KH-04 | Tỷ lệ hoàn thành 5S BP | ≥ 90% | (giống SX-05 nhưng cho BP KH) |
| KH-05 | Số liệu thống kê báo cáo | 100% | Báo cáo đúng hạn / Tổng báo cáo |
| KH-06 | Xây dựng quy trình ISO | ≥ 90% | QT hoàn thành / Tổng QT theo KH |
| KH-07 | Tỷ lệ giao hàng đúng hạn | ≥ 99% | Đơn giao đúng hạn / Tổng đơn |

### 0.4. Module TĂNG CA (theo Tháng - từ Google Sheet)
**Input fields** (từ file CSV mẫu):
- NGÀY, KHÁCH HÀNG, LỆNH SẢN XUẤT (PCODE), PHÂN XƯỞNG
- Phân loại tăng ca (3): `Sản xuất`, `Giao nhận hàng`, `Nội bộ`
- Lý do (10 cột boolean): KH đặt trễ-YC gấp / Đơn hàng nhiều SX không kịp / Nội bộ / Xe vào trễ / Đơn hàng SX SLL / Giao hàng SLL / Không đủ nhân sự SX-GH / ...
- Số lượng nhân sự, Danh sách nhân viên, Tổng số giờ
- Sản lượng cần SX (m), Thời gian theo kế hoạch (h), Ghi chú

**Aggregation cần xuất**:
- Số lần tăng ca theo phân xưởng (DMC1, DMC3, DMC4, DMC5, PKT-SX)
- Số nhân công tăng ca theo PX
- Số giờ tăng ca theo PX
- % phân bổ lý do tăng ca
- Top nhân viên tăng ca nhiều nhất

### 0.5. ⚠️ MAPPING PHÂN XƯỞNG (CRITICAL - đã confirm)

File CSV tăng ca dùng **`DM1, DM2, DM3, DM4, PKT-SX`** nhưng hệ thống hiện tại dùng **`DMC1, DMC3, DMC4, DMC5`**. Mapping CHÍNH THỨC:

| CSV (file gốc) | DB chuẩn hóa (system) | Ghi chú |
|----------------|----------------------|---------|
| DM1 | **DMC1** | DM1 thuộc DMC1 |
| DM2 | **DMC1** | **DM2 thuộc DMC1** (cùng phân xưởng vật lý) |
| DM3 | **DMC3** | |
| DM4 | **DMC4** | |
| DM5 | **DMC5** | (nếu xuất hiện trong tương lai) |
| PKT-SX | **PKT-SX** | Phòng KT-SX, không thuộc xưởng nào |

**Quan trọng**: Trong import CSV, phải convert `DM1`/`DM2` → `DMC1` trước khi insert vào DB, đồng thời lưu nguyên bản trong cột `original_workshop` để audit. Có thể có nhiều OT records cùng DMC1 trong 1 ngày từ DM1 và DM2 — coi như 2 record riêng (KHÔNG merge).

### 0.6. KỲ BÁO CÁO (Reporting Period)

**Tất cả 19 KPI đều phải báo cáo được theo 4 kỳ**:
- 📅 **Tuần** (ISO 8601, Thứ 2 đầu tuần)
- 📆 **Tháng** (1-12)
- 📊 **Quý** (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)
- 📈 **Năm**

→ Mục tiêu trong DB là `target_value` chuẩn hóa theo "1 kỳ chuẩn" (đã có cột `period_type`), nhưng UI **luôn cho phép chọn period bất kỳ**. Khi user chọn period khác `period_type` mặc định, hệ thống vẫn tính toán + so sánh với target (chú thích "Mục tiêu chuẩn theo {period_type}").

---

## 1. KIẾN TRÚC TỔNG QUAN (Architecture)

### 1.1. Cấu trúc tab UI mới

```
app/(dashboard)/dashboard/
├── production/          [hiện tại - giữ nguyên, bổ sung KPI inputs]
│   ├── page.tsx                    [hiện tại]
│   ├── defect/page.tsx             [MỚI: nhập tỷ lệ lỗi - SX-01]
│   ├── ontime/page.tsx             [MỚI: tracking đúng tiến độ - SX-02]
│   ├── material-cost/page.tsx      [MỚI: chi phí NVL - SX-04]
│   ├── 5s/page.tsx                 [MỚI: nhập 5S findings - SX-05/KH-04]
│   └── site-progress/page.tsx      [MỚI: tiến độ công trình - SX-06]
├── maintenance/         [hiện tại - giữ nguyên, bổ sung]
│   ├── page.tsx                    [hiện tại]
│   ├── downtime/page.tsx           [MỚI: nhập sự cố máy - KT-01/02/03]
│   ├── schedule/page.tsx           [MỚI: lịch bảo trì - KT-04]
│   ├── drawing/page.tsx            [MỚI: tracking bản vẽ - KT-05/06]
│   └── survey/page.tsx             [MỚI: khảo sát công trình - KT-07]
├── coordination/        [hiện tại - mở rộng]
│   ├── page.tsx                    [hiện tại - HR tab]
│   ├── delivery/page.tsx           [MỚI: giao hàng - KH-02/03/07]
│   ├── overtime/page.tsx           [MỚI: nhập tăng ca thay GG Sheet]
│   ├── reports/page.tsx            [MỚI: báo cáo thống kê - KH-05]
│   └── iso/page.tsx                [MỚI: quy trình ISO - KH-06]
├── hr/                  [MỚI - tách riêng từ coordination]
│   ├── page.tsx                    [Quản lý nhân viên]
│   ├── employees/page.tsx          [CRUD employees]
│   └── overtime-summary/page.tsx   [Báo cáo tăng ca theo NV]
├── report/              [hiện tại - mở rộng MẠNH]
│   ├── page.tsx                    [hiện tại - dashboard tổng]
│   ├── kpi/page.tsx                [MỚI: KPI dashboard - 3 bộ phận]
│   ├── kpi/[department]/page.tsx   [MỚI: drill-down theo bộ phận]
│   ├── overtime/page.tsx           [MỚI: dashboard tăng ca]
│   ├── export/page.tsx             [MỚI: xuất Excel/PDF]
│   └── trends/page.tsx             [MỚI: xu hướng KPI]
└── admin/
    └── kpi-targets/page.tsx        [MỚI: cấu hình mục tiêu KPI]
```

### 1.2. Cấu trúc API mới

```
app/api/
├── kpi/
│   ├── targets/                    [GET/POST/PUT - cấu hình mục tiêu]
│   ├── production/                 [GET - aggregation 6 KPI SX]
│   ├── maintenance/                [GET - aggregation 7 KPI KT]
│   ├── coordination/               [GET - aggregation 6 KPI KH]
│   └── summary/                    [GET - tổng hợp dashboard]
├── production/
│   ├── defects/                    [POST/GET - nhập lỗi]
│   ├── ontime-orders/              [POST/GET - đơn đúng hạn]
│   ├── material-usage/             [POST/GET - tiêu hao NVL]
│   ├── 5s-findings/                [POST/GET - 5S]
│   └── site-progress/              [POST/GET - thi công]
├── maintenance/
│   ├── breakdowns/                 [POST/GET - sự cố máy]
│   ├── schedule/                   [POST/GET - lịch BT]
│   ├── drawings/                   [POST/GET - bản vẽ]
│   └── surveys/                    [POST/GET - khảo sát]
├── coordination/
│   ├── deliveries/                 [POST/GET - giao hàng]
│   ├── overtime/                   [POST/GET - tăng ca]
│   ├── overtime-import/            [POST - import từ GG Sheet]
│   ├── statistical-reports/        [POST/GET - báo cáo TK]
│   └── iso-procedures/             [POST/GET - ISO]
├── hr/
│   ├── employees/                  [CRUD nhân viên]
│   └── overtime-summary/           [GET - tổng hợp tăng ca]
└── exports/
    ├── kpi-report/                 [GET - xuất file Excel/PDF]
    └── overtime-report/            [GET - xuất tăng ca]
```

---

## 1.3. ⭐ BÁO CÁO HIỆN TẠI ĐƯỢC GIỮ NGUYÊN + SO SÁNH XƯỞNG (CHI TIẾT)

> **Cam kết quan trọng**: Plan này CHỈ THÊM, KHÔNG XÓA hay SỬA bất kỳ trang báo cáo nào hiện tại. Toàn bộ workflow user đang dùng vẫn hoạt động bình thường. Section này mô tả CHI TIẾT về (a) trang nào giữ nguyên, (b) trang nào mới, (c) cách 2 nhóm phối hợp.

### 1.3.1. Danh sách báo cáo HIỆN TẠI - Giữ nguyên 100%

Theo Project Summary, các báo cáo hiện có vẫn nguyên vẹn:

| Trang/API hiện tại | File path | Mục đích | Trạng thái |
|--------------------|-----------|----------|------------|
| Dashboard tổng | `app/(dashboard)/dashboard/report/page.tsx` | 4 sections: Progress, Output, Quality, OEE | ✅ KHÔNG SỬA |
| Production progress API | `app/api/reports/production-progress/` | Tiến độ SX theo deadline/initialdate | ✅ KHÔNG SỬA |
| Production output API | `app/api/reports/production-output/` | Sản lượng theo ca/giờ/ngày | ✅ KHÔNG SỬA |
| Quality result API | `app/api/reports/quality-result/` | Kết quả chất lượng | ✅ KHÔNG SỬA |
| OEE API | `app/api/reports/oee/` | OEE = A × P × Q, weighted avg | ✅ KHÔNG SỬA |
| Workshops ranking API | `app/api/reports/workshops/ranking/` | Xếp hạng 4 xưởng theo OEE/sản lượng | ✅ KHÔNG SỬA |

**User đang dùng quen các báo cáo này → vẫn dùng được, không cần training lại.**

### 1.3.2. So sánh trước/sau triển khai - Tab Báo Cáo

**TRƯỚC (hiện tại)**:
```
Sidebar:
└─ Báo cáo
    ├─ Dashboard tổng (progress + output + quality + OEE)
    └─ (Chỉ có vậy)
```

**SAU triển khai (giữ nguyên cũ + thêm mới)**:
```
Sidebar:
└─ Báo cáo
    ├─ 📊 Dashboard tổng              [GIỮ NGUYÊN - production-progress, output, quality, OEE]
    ├─ 🏆 Xếp hạng phân xưởng         [GIỮ NGUYÊN - workshops/ranking]
    │
    ├─ ─────── Báo cáo KPI 2026 ─────── (separator)
    │
    ├─ 🎯 KPI Dashboard tổng          [MỚI - 19 KPI 3 bộ phận]
    ├─ 🏭 KPI Sản Xuất               [MỚI - 6 KPI + so sánh xưởng]
    ├─ 🔧 KPI Bảo Trì                 [MỚI - 7 KPI]
    ├─ 🤝 KPI Phối Hợp               [MỚI - 6 KPI]
    │
    ├─ ─────── Báo cáo khác ─────── (separator)
    │
    ├─ ⏰ Báo cáo Tăng Ca             [MỚI]
    ├─ 📈 Xu hướng KPI                [MỚI - trend chart]
    └─ 📥 Xuất báo cáo                [MỚI - Excel/PDF]
```

User vẫn vào "Dashboard tổng" như mọi khi → không thay đổi gì. Khi muốn xem KPI 2026 → click vào nhóm mới.

### 1.3.3. ⭐ KPI Sản Xuất với 3 VIEW MODE so sánh xưởng

Đây là điểm khác biệt lớn so với Workshops Ranking hiện tại. Dashboard KPI Sản Xuất có **3 view mode** chuyển đổi qua tab/toggle:

#### **View 1: Tổng hợp toàn nhà máy** (mặc định)

Trả lời câu: "Tổng thể toàn nhà máy đạt được gì?"

```
┌──────────────────────────────────────────────────────────────┐
│  KPI Sản Xuất - Quý 2/2026 (Apr-Jun) - Toàn Nhà Máy         │
│  [Period: Quý ▼] [Anchor: Q2/2026 ▼] [Workshop: ALL ▼]      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │  SX-01   │  │  SX-02   │  │  SX-03   │                   │
│  │ Tỷ lệ lỗi│  │Đúng tiến độ│ │   OEE    │                   │
│  │  0.08%   │  │  99.7%   │  │   91%    │                   │
│  │  ✅ Đạt  │  │  ✅ Đạt  │  │  ✅ Đạt  │                   │
│  │ Mục tiêu │  │ Mục tiêu │  │ Mục tiêu │                   │
│  │  ≤0.1%   │  │  ≥99.5%  │  │  ≥90%    │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │  SX-04   │  │  SX-05   │  │  SX-06   │                   │
│  │ NVL      │  │  5S      │  │ Thi công │                   │
│  │  99.8%   │  │  88%     │  │  96%     │                   │
│  │  ✅ Đạt  │  │  ❌ Chưa │  │  ✅ Đạt  │                   │
│  │  ≥99.5%  │  │  ≥90%    │  │  ≥95%    │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
│                                                              │
│  Tổng: 5/6 KPI đạt mục tiêu (83%)                           │
└──────────────────────────────────────────────────────────────┘
```

#### **View 2: Theo từng xưởng cụ thể**

Trả lời câu: "Xưởng DMC1 đang đạt được gì?"

```
┌──────────────────────────────────────────────────────────────┐
│  KPI Sản Xuất - Quý 2/2026 - Phân xưởng: [DMC1 ▼]           │
│  ⚠️  DMC1 bao gồm cả DM1 và DM2 (đã chuẩn hóa)              │
├──────────────────────────────────────────────────────────────┤
│  Hiển thị 6 KPI cards (giống View 1) nhưng                   │
│  filter dữ liệu chỉ của DMC1                                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Trend 12 quý gần nhất - DMC1                        │   │
│  │  [Multi-line chart: 6 KPI overlay]                   │   │
│  │                                                      │   │
│  │  100%┤    ___                                        │   │
│  │   90%┤___/   \___/\___                              │   │
│  │   80%┤                                               │   │
│  │      └─────────────────────                          │   │
│  │       Q1'25 ... Q2'26                                │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

#### **View 3: Ma trận so sánh xưởng** ⭐⭐⭐ (CRITICAL - MỚI HOÀN TOÀN)

Trả lời câu: "Xưởng nào đạt KPI tốt nhất? Xưởng nào cần focus cải thiện?"

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  So sánh KPI 4 phân xưởng - Quý 2/2026                                      │
│  [Period: Quý ▼] [Anchor: Q2/2026 ▼] [View: Matrix ▼]                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────┬─────────┬─────────┬─────────┬─────────┐        │
│  │ KPI                     │  DMC1   │  DMC3   │  DMC4   │  DMC5   │        │
│  ├─────────────────────────┼─────────┼─────────┼─────────┼─────────┤        │
│  │ SX-01 Tỷ lệ lỗi (≤0.1%) │ 0.08% ✅│ 0.12% ❌│ 0.05% ✅│ 0.09% ✅│        │
│  │ SX-02 Đúng hạn (≥99.5%) │ 99.7% ✅│ 99.2% ❌│ 100% ✅ │ 99.6% ✅│        │
│  │ SX-03 OEE (≥90%)        │ 91% ✅  │ 88% ❌  │ 92% ✅  │ 90% ✅  │        │
│  │ SX-04 NVL (≥99.5%)      │ 99.8% ✅│ 99.6% ✅│ 99.4% ❌│ 99.7% ✅│        │
│  │ SX-05 5S (≥90%)         │ 88% ❌  │ 92% ✅  │ 95% ✅  │ 89% ❌  │        │
│  │ SX-06 Thi công (≥95%)   │ 96% ✅  │ 94% ❌  │ 97% ✅  │ 95% ✅  │        │
│  ├─────────────────────────┼─────────┼─────────┼─────────┼─────────┤        │
│  │ 🏆 Tổng đạt              │  5/6    │  2/6    │  5/6    │  4/6    │        │
│  │ 📊 Xếp hạng              │   #1    │   #4    │   #1    │   #3    │        │
│  └─────────────────────────┴─────────┴─────────┴─────────┴─────────┘        │
│                                                                              │
│  Hint:                                                                       │
│  ✅ Xanh = đạt mục tiêu                                                     │
│  ❌ Đỏ = chưa đạt                                                           │
│  Click 1 ô để drill-down vào chi tiết KPI x Xưởng                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Bên dưới matrix có thêm 3 chart phụ trợ**:

```
┌──────────────────────────────────────────────────────────────┐
│  📊 Radar Chart - 4 xưởng overlap 6 trục KPI                │
│                                                              │
│              SX-01                                           │
│              ╱│╲                                             │
│        SX-06 │ SX-02                                         │
│           \  │  /                                            │
│            \ │ /                                             │
│             \│/                                              │
│        SX-05 │ SX-03                                         │
│              ╲│╱                                             │
│              SX-04                                           │
│                                                              │
│  Legend: ━━ DMC1  ━━ DMC3  ━━ DMC4  ━━ DMC5                 │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  📊 Bar Chart Group - % Achievement theo xưởng              │
│                                                              │
│  100%┤■■■■■  ■■■■■  ■■■■■  ■■■■■                          │
│   80%┤■■■    ■■■■■  ■■■■■  ■■■■                            │
│   60%┤■■■    ■■■■   ■■■■■  ■■■                             │
│      └────── ────── ────── ──────                            │
│       SX-01  SX-02  SX-03  SX-04 ...                         │
│                                                              │
│  ■ DMC1  ■ DMC3  ■ DMC4  ■ DMC5                             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  📈 Heatmap - 6 KPI × 4 xưởng                               │
│                                                              │
│         DMC1  DMC3  DMC4  DMC5                              │
│  SX-01  🟢    🔴    🟢    🟢                                │
│  SX-02  🟢    🔴    🟢    🟢                                │
│  SX-03  🟢    🔴    🟢    🟢                                │
│  SX-04  🟢    🟢    🔴    🟢                                │
│  SX-05  🔴    🟢    🟢    🔴                                │
│  SX-06  🟢    🔴    🟢    🟢                                │
│                                                              │
│  💡 Insight: DMC3 cần focus 4 KPI: SX-01, 02, 03, 06        │
└──────────────────────────────────────────────────────────────┘
```

### 1.3.4. ⭐ Khác biệt giữa "Workshops Ranking" cũ vs "KPI Comparison" mới

| Tiêu chí | Workshops Ranking (cũ) | KPI Comparison (mới) |
|----------|------------------------|----------------------|
| Mục đích | So sánh hiệu quả vận hành | So sánh đạt mục tiêu 2026 |
| Trục so sánh | OEE, sản lượng, chất lượng | 6 KPI Sản Xuất theo target |
| Tham chiếu | So sánh tương đối giữa xưởng | So sánh tuyệt đối với target |
| Output | Top 1, 2, 3, 4 | "5/6 KPI đạt", "Cần focus X" |
| Tần suất | Liên tục (theo ca) | Theo kỳ KPI (tháng/quý) |
| Người dùng | Trưởng PX, Manager vận hành | Manager, Ban Giám đốc, ISO |

**Tổng kết**: 2 báo cáo này KHÔNG thay thế nhau, chúng BỔ TRỢ:
- Trưởng PX hàng ngày vẫn xem **Workshops Ranking** để điều chỉnh sản xuất real-time
- Manager cuối tháng/quý xem **KPI Comparison** để báo cáo Ban Giám đốc, đánh giá xưởng

### 1.3.5. Workflow user (3 persona)

#### Persona A: Trưởng phân xưởng DMC1

**Nhu cầu**: Theo dõi sản xuất real-time, biết ngay khi có vấn đề
**Workflow hàng ngày**:
1. Login → Mặc định mở "Dashboard tổng" (như hiện tại) ✅ KHÔNG ĐỔI
2. Xem progress đơn hàng đang chạy, OEE ca hiện tại
3. Nếu thấy lỗi nhiều → vào "KPI Sản Xuất → View 2: DMC1" để xem trend
4. Cuối ca → vào tab `production/defect/` nhập lỗi (nếu có)
5. Cuối ngày → check "Xếp hạng PX" xem mình so với xưởng khác (như cũ)

**Trang dùng nhiều**: Dashboard tổng (cũ) > Workshops Ranking (cũ) > Production input (mới)

#### Persona B: Manager Sản Xuất

**Nhu cầu**: Biết bộ phận đạt KPI 2026 không, xưởng nào cần can thiệp
**Workflow hàng tuần/tháng**:
1. Login → vào "KPI Sản Xuất → View 1: Toàn nhà máy" (mới)
2. Xem 6 KPI cards: bao nhiêu đạt, bao nhiêu fail
3. Click KPI fail (vd SX-05 5S) → drill-down xem xưởng nào tệ nhất
4. Switch sang "View 3: Matrix" → so sánh 4 xưởng cùng lúc
5. Nếu thấy DMC3 fail nhiều → vào "View 2: DMC3" xem trend lịch sử
6. Cuối tháng → "Xuất báo cáo" → Excel gửi Ban Giám đốc

**Trang dùng nhiều**: KPI Dashboard (mới) > KPI Comparison (mới) > Export (mới)

#### Persona C: Ban Giám đốc / ISO Audit

**Nhu cầu**: Báo cáo định kỳ, audit chất lượng theo ISO 9001
**Workflow hàng quý**:
1. Login → "KPI Dashboard tổng" (master view 19 KPI)
2. Xem 3 cards: PRODUCTION 5/6, MAINTENANCE 6/7, COORDINATION 4/6
3. Tab "Xu hướng KPI" → so sánh 4 quý gần nhất
4. "Xuất báo cáo" → file Excel 5 sheets cho ISO audit
5. Verify từng action plan trong KPI targets (admin panel)

**Trang dùng nhiều**: Master KPI (mới) > Trends (mới) > Export (mới)

### 1.3.6. API hỗ trợ View 3 (Matrix so sánh xưởng)

API mới thêm vào để hỗ trợ View 3:

```typescript
// app/api/kpi/comparison/route.ts
// GET /api/kpi/comparison?department=PRODUCTION&period=quarterly&anchor=2026-04-15

interface KpiComparisonResponse {
  period: { type: 'quarterly', anchor: '2026-04-15', label: '2026-Q2', start: '2026-04-01', end: '2026-06-30' };
  department: 'PRODUCTION';
  workshops: ['DMC1', 'DMC3', 'DMC4', 'DMC5'];
  matrix: {
    [kpiCode: string]: {
      kpi_name: string;
      target_value: number;
      target_operator: 'lte' | 'gte' | 'lt' | 'gt';
      unit: string;
      values: {
        [workshop: string]: {
          actual_value: number;
          is_achieved: boolean;
          achievement_pct: number;
          data_count: number;
        }
      }
    }
  };
  rankings: {
    [workshop: string]: { achieved_count: number; total_count: number; rank: number };
  };
  insights: string[];  // ['DMC3 cần focus 4 KPI: SX-01, SX-02, SX-03, SX-06']
}
```

RPC support:
```sql
-- supabase/migrations/013_kpi_rpc_functions.sql (mở rộng)

-- ⭐ RPC mới: matrix so sánh KPI x Workshop
CREATE OR REPLACE FUNCTION public.rpc_kpi_workshop_matrix(
  p_department TEXT,
  p_period_type TEXT,
  p_anchor_date DATE
)
RETURNS TABLE (
  kpi_code TEXT,
  kpi_name TEXT,
  workshop TEXT,
  target_value NUMERIC,
  target_operator TEXT,
  actual_value NUMERIC,
  is_achieved BOOLEAN,
  achievement_pct NUMERIC,
  data_count INTEGER
) AS $$
DECLARE
  ws TEXT;
  ws_list TEXT[] := ARRAY['DMC1','DMC3','DMC4','DMC5'];  -- tự động lấy từ DB nếu cần
BEGIN
  -- Loop 4 xưởng × 6/7 KPI
  FOREACH ws IN ARRAY ws_list LOOP
    RETURN QUERY
    SELECT
      r.kpi_code, r.kpi_name, ws,
      r.target_value, r.target_operator,
      r.actual_value, r.is_achieved, r.achievement_pct, r.data_count
    FROM public.rpc_calculate_kpi(p_department, p_period_type, p_anchor_date, ws) r;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_kpi_workshop_matrix TO authenticated;
```

### 1.3.7. Components mới cho View 3

```
components/kpi/comparison/
├── KpiMatrixTable.tsx           [Bảng 6×4 cell với conditional color]
├── KpiRadarCompare.tsx          [Radar 4 xưởng overlap, ECharts]
├── KpiBarGroupCompare.tsx       [Bar group 4 xưởng × 6 KPI, Recharts]
├── KpiHeatmapCompare.tsx        [Heatmap 6×4 với drill-down click]
├── KpiInsightCard.tsx           [Auto-generate insight text]
└── KpiViewModeToggle.tsx        [Toggle View 1/2/3]
```

### 1.3.8. Cấu trúc routing chi tiết tab Báo Cáo

```
app/(dashboard)/dashboard/report/
├── page.tsx                                  [GIỮ NGUYÊN - dashboard tổng cũ]
├── workshops-ranking/
│   └── page.tsx                              [⭐ MỚI - tách ra từ /report cũ thành route riêng]
│                                              [Hoặc: link sidebar trỏ về section trong page.tsx#ranking]
│
├── kpi/
│   ├── page.tsx                              [Master KPI dashboard - 3 bộ phận]
│   ├── production/
│   │   ├── page.tsx                          [⭐ TRANG CHÍNH View 1, 2, 3 toggle]
│   │   ├── compare/page.tsx                  [Optional: tách View 3 thành route riêng]
│   │   └── [workshop]/page.tsx               [Drill-down 1 xưởng - View 2]
│   ├── maintenance/page.tsx                  [Tương tự production]
│   └── coordination/page.tsx                 [Tương tự production]
│
├── overtime/page.tsx                         [Dashboard tăng ca]
├── trends/page.tsx                           [Trend chart 12 tháng cho từng KPI]
└── export/page.tsx                           [Excel/PDF download]
```

### 1.3.9. Acceptance Criteria mở rộng cho View 3

Trong Phase 3.2 (Sản Xuất), thêm các acceptance:

- [ ] **AC-VIEW3-1**: Toggle 3 view mode (V1/V2/V3) hoạt động không reload trang
- [ ] **AC-VIEW3-2**: View 3 matrix render đầy đủ 6 KPI × 4 xưởng = 24 cells với màu đúng
- [ ] **AC-VIEW3-3**: Click 1 cell trong matrix → modal hiện chi tiết (vd "DMC3 - SX-01: 12 records, top 3 lỗi: ...")
- [ ] **AC-VIEW3-4**: Radar chart 4 xưởng overlap đọc được rõ (legend + tooltip)
- [ ] **AC-VIEW3-5**: Auto insight: nếu xưởng X có ≥3 KPI fail → hiển thị "DMC{X} cần focus N KPI: ..."
- [ ] **AC-VIEW3-6**: Period selector (Tuần/Tháng/Quý/Năm) đồng bộ giữa 3 view mode
- [ ] **AC-VIEW3-7**: Performance: render 24 cells + 3 charts < 1.5s với 1 quý dữ liệu
- [ ] **AC-VIEW3-8**: Export view 3 thành PNG/PDF cho slide presentation

### 1.3.10. Migration path cho user (training plan)

**Tuần 1 sau go-live**: Email thông báo
> "Tab Báo Cáo có thêm nhóm 'Báo cáo KPI 2026' với các trang mới. Tất cả báo cáo cũ (Dashboard tổng, Xếp hạng phân xưởng) vẫn truy cập như bình thường."

**Tuần 2**: Training 30 phút online cho 3 persona
- Trưởng PX: 10 phút (chỉ cần biết View 1 + tab nhập liệu mới)
- Manager: 15 phút (focus View 3 - matrix so sánh)
- Ban Giám đốc: 5 phút (focus Master KPI + Export)

**Tuần 3-4**: Side-by-side dùng cả cũ và mới, thu feedback
**Tuần 5+**: Deprecate báo cáo cũ nếu tất cả user đã quen mới (TÙY CHỌN, không bắt buộc)

---

## 2. SCHEMA DATABASE (Migration 007 → 015)

### 2.1. Migration 007: Thu hẹp RLS UPDATE policy (BACKLOG)

```sql
-- supabase/migrations/007_tighten_rls_data_update.sql
DROP POLICY IF EXISTS "data_update_all" ON public.data;

CREATE POLICY "data_update_admin_manager"
  ON public.data
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('ADMIN', 'MANAGER')
    )
  );

CREATE POLICY "data_update_supervisor_own_workshop"
  ON public.data
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'SUPERVISOR'
      AND p.workspace = data."WORKSHOP"
    )
  );
```

### 2.2. Migration 008: Bảng cấu hình KPI Targets (multi-period)

```sql
-- supabase/migrations/008_kpi_targets.sql
CREATE TABLE IF NOT EXISTS public.kpi_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_code TEXT NOT NULL UNIQUE,            -- 'SX-01', 'KT-01', 'KH-02'...
  department TEXT NOT NULL CHECK (department IN ('PRODUCTION','MAINTENANCE','COORDINATION')),
  name TEXT NOT NULL,                        -- 'Tỷ lệ lỗi thành phẩm'
  description TEXT,                          -- giải thích chi tiết
  unit TEXT NOT NULL,                        -- '%', 'h', 'phút/lần'
  target_value NUMERIC NOT NULL,             -- giá trị mục tiêu chuẩn (theo default_period)
  target_operator TEXT NOT NULL CHECK (target_operator IN ('lte','gte','lt','gt','eq')),
  default_period TEXT NOT NULL CHECK (default_period IN ('weekly','monthly','quarterly','yearly')),
  -- ⭐ MỚI: cho phép override target theo từng period (admin có thể đặt riêng)
  target_weekly NUMERIC,                     -- target khi xem theo tuần (NULL = dùng target_value)
  target_monthly NUMERIC,                    -- target khi xem theo tháng
  target_quarterly NUMERIC,                  -- target khi xem theo quý
  target_yearly NUMERIC,                     -- target khi xem theo năm
  formula TEXT,                              -- mô tả công thức
  action_plan TEXT,                          -- kế hoạch hành động
  is_active BOOLEAN DEFAULT true,
  year INTEGER NOT NULL DEFAULT 2026,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed 19 KPI với default_period
INSERT INTO public.kpi_targets (kpi_code, department, name, unit, target_value, target_operator, default_period, formula) VALUES
  ('SX-01','PRODUCTION','Tỷ lệ lỗi thành phẩm','%',0.1,'lte','quarterly','Σ KL lỗi / Σ KL sản xuất'),
  ('SX-02','PRODUCTION','Đúng tiến độ đơn hàng','%',99.5,'gte','quarterly','SL đơn hoàn thành / Tổng SL đơn'),
  ('SX-03','PRODUCTION','Hiệu suất sản xuất (OEE)','%',90,'gte','monthly','OEE = A × P × Q'),
  ('SX-04','PRODUCTION','Chi phí NVL trong định mức','%',99.5,'gte','quarterly','Tiêu hao thực / Tiêu hao định mức'),
  ('SX-05','PRODUCTION','Tỷ lệ hoàn thành 5S','%',90,'gte','monthly','Hình 5S khắc phục đúng hạn / Tổng hình phát hiện'),
  ('SX-06','PRODUCTION','Tiến độ thi công công trình','%',95,'gte','monthly','Σ thời gian KH / Σ thời gian thực tế'),
  ('KT-01','MAINTENANCE','Thời gian dừng máy ngoài KH','h/ngày',4,'lt','monthly','Σ thời gian dừng / số ngày'),
  ('KT-02','MAINTENANCE','Thời gian sửa chữa TB (MTTR)','phút/lần',60,'lte','monthly','Σ thời gian sửa / Σ số lần hỏng'),
  ('KT-03','MAINTENANCE','Thời gian giữa 2 lỗi (MTBF)','giờ',160,'gte','quarterly','Σ thời gian hoạt động / Σ số lần hỏng'),
  ('KT-04','MAINTENANCE','Tỷ lệ bảo trì đúng KH','%',100,'gte','monthly','SL BT thực hiện / SL BT theo lịch'),
  ('KT-05','MAINTENANCE','Độ chính xác bản vẽ','%',99,'gte','monthly','BV chính xác / Tổng BV ban hành'),
  ('KT-06','MAINTENANCE','Thời gian hoàn thành bản vẽ','%',99,'gte','monthly','BV đúng tiến độ / Tổng BV'),
  ('KT-07','MAINTENANCE','Độ chính xác khảo sát CT','%',95,'gte','monthly','(Tổng - Lỗi) / Tổng thông tin khảo sát'),
  ('KH-02','COORDINATION','Tỷ lệ hư hỏng vận chuyển','%',0.1,'lte','monthly','KL hư hỏng / Tổng KL vận chuyển'),
  ('KH-03','COORDINATION','Chi phí giao hàng (vs baseline)','%',90,'lte','monthly','Chi phí/tấn năm nay / Chi phí/tấn baseline'),
  ('KH-04','COORDINATION','Tỷ lệ 5S Bộ phận','%',90,'gte','monthly','Hình 5S khắc phục / Tổng hình phát hiện'),
  ('KH-05','COORDINATION','Số liệu thống kê báo cáo','%',100,'gte','monthly','Báo cáo đúng hạn / Tổng báo cáo'),
  ('KH-06','COORDINATION','Xây dựng quy trình ISO','%',90,'gte','quarterly','QT hoàn thành / Tổng QT theo KH'),
  ('KH-07','COORDINATION','Tỷ lệ giao hàng đúng hạn','%',99,'gte','monthly','Đơn giao đúng hạn / Tổng đơn');

-- ⭐ Bảng baseline có thể chỉnh sửa bởi admin (cho KH-03 và các so sánh khác)
CREATE TABLE IF NOT EXISTS public.kpi_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_key TEXT NOT NULL UNIQUE,         -- 'delivery_cost_per_ton_2025', 'fuel_cost_baseline_2025'...
  description TEXT NOT NULL,                 -- 'Chi phí giao hàng/tấn năm 2025'
  value NUMERIC NOT NULL,                    -- giá trị baseline
  unit TEXT NOT NULL,                        -- 'VND/tấn', '%'...
  effective_year INTEGER NOT NULL,
  effective_month INTEGER,                   -- NULL = trung bình cả năm
  notes TEXT,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed baselines (admin sẽ update giá trị thực tế qua UI)
INSERT INTO public.kpi_baselines (baseline_key, description, value, unit, effective_year) VALUES
  ('delivery_cost_per_ton_2025', 'Chi phí giao hàng/tấn TB năm 2025 (dùng cho KH-03)', 0, 'VND/tấn', 2025),
  ('material_norm_cost_2025', 'Chi phí NVL theo định mức 2025 (tham chiếu cho SX-04)', 0, 'VND', 2025)
ON CONFLICT (baseline_key) DO NOTHING;

-- ⭐ Helper function: lấy target theo period
CREATE OR REPLACE FUNCTION public.get_kpi_target(
  p_kpi_code TEXT,
  p_period TEXT
) RETURNS NUMERIC AS $$
  SELECT COALESCE(
    CASE p_period
      WHEN 'weekly' THEN target_weekly
      WHEN 'monthly' THEN target_monthly
      WHEN 'quarterly' THEN target_quarterly
      WHEN 'yearly' THEN target_yearly
    END,
    target_value
  )
  FROM public.kpi_targets
  WHERE kpi_code = p_kpi_code AND is_active = true;
$$ LANGUAGE sql STABLE;

-- RLS
ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_targets_select_all" ON public.kpi_targets FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "kpi_targets_modify_admin" ON public.kpi_targets FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY "kpi_baselines_select_all" ON public.kpi_baselines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "kpi_baselines_modify_admin" ON public.kpi_baselines FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE INDEX idx_kpi_targets_dept ON public.kpi_targets(department, is_active);
CREATE INDEX idx_kpi_baselines_key ON public.kpi_baselines(baseline_key);

GRANT EXECUTE ON FUNCTION public.get_kpi_target TO authenticated;
```

### 2.3. Migration 009: Production KPIs Tables

```sql
-- supabase/migrations/009_production_kpi_tables.sql

-- SX-01: Lỗi thành phẩm
CREATE TABLE IF NOT EXISTS public.production_defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  workshop TEXT NOT NULL,
  pcode TEXT,                                -- liên kết với data.PCODE
  product_name TEXT,
  total_qty NUMERIC NOT NULL,                -- tổng KL sản xuất (m, kg, cái)
  defect_qty NUMERIC NOT NULL DEFAULT 0,     -- KL lỗi
  defect_type TEXT,                          -- loại lỗi
  defect_cause TEXT,                         -- nguyên nhân
  unit TEXT DEFAULT 'm',
  shift TEXT,                                -- ca_sang_1, ca_chieu_1...
  reported_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_defects_date_ws ON public.production_defects(report_date, workshop);

-- SX-02: Đơn hàng đúng tiến độ (extend từ data table)
CREATE TABLE IF NOT EXISTS public.order_completion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pcode TEXT NOT NULL,
  workshop TEXT NOT NULL,
  customer TEXT,
  planned_date DATE NOT NULL,                -- deadline kế hoạch
  actual_date DATE,                          -- ngày thực tế hoàn thành
  is_on_time BOOLEAN GENERATED ALWAYS AS (actual_date IS NOT NULL AND actual_date <= planned_date) STORED,
  delay_days INTEGER GENERATED ALWAYS AS (
    CASE WHEN actual_date IS NULL THEN NULL
         ELSE GREATEST(0, (actual_date - planned_date)) END
  ) STORED,
  delay_reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled','delayed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_order_completion_pcode ON public.order_completion(pcode);
CREATE INDEX idx_order_completion_date ON public.order_completion(planned_date, workshop);

-- SX-04: Tiêu hao NVL
CREATE TABLE IF NOT EXISTS public.material_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  workshop TEXT NOT NULL,
  pcode TEXT,
  material_code TEXT NOT NULL,
  material_name TEXT,
  norm_qty NUMERIC NOT NULL,                 -- định mức
  actual_qty NUMERIC NOT NULL,               -- thực tế tiêu hao
  variance_pct NUMERIC GENERATED ALWAYS AS (
    CASE WHEN norm_qty = 0 THEN 0 ELSE (actual_qty - norm_qty) / norm_qty * 100 END
  ) STORED,
  unit TEXT DEFAULT 'kg',
  cost_per_unit NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_material_usage_date ON public.material_usage(report_date, workshop);

-- SX-05/KH-04: 5S Findings
CREATE TABLE IF NOT EXISTS public.findings_5s (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_date DATE NOT NULL,
  workshop TEXT NOT NULL,
  department TEXT CHECK (department IN ('PRODUCTION','COORDINATION','MAINTENANCE','ALL')),
  area TEXT,                                 -- khu vực phát hiện
  category TEXT CHECK (category IN ('Sàng lọc','Sắp xếp','Sạch sẽ','Săn sóc','Sẵn sàng')),
  description TEXT NOT NULL,
  photo_url TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  due_date DATE NOT NULL,
  resolved_date DATE,
  is_resolved BOOLEAN GENERATED ALWAYS AS (resolved_date IS NOT NULL) STORED,
  is_on_time BOOLEAN GENERATED ALWAYS AS (
    resolved_date IS NOT NULL AND resolved_date <= due_date
  ) STORED,
  responsible_person TEXT,
  resolution_notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_5s_date_ws ON public.findings_5s(finding_date, workshop);

-- SX-06: Tiến độ thi công công trình
CREATE TABLE IF NOT EXISTS public.site_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT NOT NULL,
  project_name TEXT NOT NULL,
  customer TEXT,
  start_date DATE NOT NULL,
  planned_end_date DATE NOT NULL,
  actual_end_date DATE,
  planned_hours NUMERIC NOT NULL,            -- tổng giờ kế hoạch
  actual_hours NUMERIC,                      -- tổng giờ thực tế
  progress_pct NUMERIC DEFAULT 0,            -- % tiến độ hiện tại
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('planned','in_progress','completed','delayed','cancelled')),
  delay_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_site_progress_status ON public.site_progress(status, start_date);

-- RLS cho tất cả 5 bảng
ALTER TABLE public.production_defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_completion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings_5s ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_progress ENABLE ROW LEVEL SECURITY;

-- Policy template (lặp lại cho từng bảng):
-- ADMIN/MANAGER: full access
-- SUPERVISOR: own workshop only
-- USER: read + insert (no update/delete sau insert)
CREATE POLICY "defects_select" ON public.production_defects FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER'))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPERVISOR' AND workspace = workshop)
    OR auth.role() = 'authenticated'
  );
CREATE POLICY "defects_insert" ON public.production_defects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "defects_update_admin" ON public.production_defects FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));
-- Áp dụng pattern tương tự cho 4 bảng còn lại
```

### 2.4. Migration 010: Maintenance KPIs Tables

```sql
-- supabase/migrations/010_maintenance_kpi_tables.sql

-- KT-01/02/03: Sự cố máy (downtime)
CREATE TABLE IF NOT EXISTS public.machine_breakdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop TEXT NOT NULL,
  machine_code TEXT NOT NULL,
  machine_name TEXT,
  breakdown_start TIMESTAMPTZ NOT NULL,
  breakdown_end TIMESTAMPTZ,
  downtime_minutes NUMERIC GENERATED ALWAYS AS (
    CASE WHEN breakdown_end IS NULL THEN NULL
         ELSE EXTRACT(EPOCH FROM (breakdown_end - breakdown_start))/60 END
  ) STORED,
  failure_type TEXT,                         -- cơ khí, điện, điều khiển...
  root_cause TEXT,
  is_planned BOOLEAN DEFAULT false,          -- bảo trì có KH hay sự cố ngoài KH
  repair_action TEXT,
  parts_replaced TEXT,
  technician TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_breakdowns_machine ON public.machine_breakdowns(machine_code, breakdown_start);
CREATE INDEX idx_breakdowns_ws ON public.machine_breakdowns(workshop, breakdown_start);

-- KT-04: Lịch bảo trì
CREATE TABLE IF NOT EXISTS public.maintenance_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop TEXT NOT NULL,
  machine_code TEXT NOT NULL,
  machine_name TEXT,
  maintenance_type TEXT CHECK (maintenance_type IN ('daily','weekly','monthly','quarterly','annually')),
  scheduled_date DATE NOT NULL,
  actual_date DATE,
  is_completed BOOLEAN GENERATED ALWAYS AS (actual_date IS NOT NULL) STORED,
  is_on_time BOOLEAN GENERATED ALWAYS AS (
    actual_date IS NOT NULL AND actual_date <= scheduled_date
  ) STORED,
  checklist_items JSONB,                     -- [{name, checked, notes}]
  technician TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_maint_sched_date ON public.maintenance_schedule(scheduled_date, workshop);

-- KT-05/06: Bản vẽ kỹ thuật
CREATE TABLE IF NOT EXISTS public.technical_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_code TEXT NOT NULL UNIQUE,
  drawing_name TEXT NOT NULL,
  customer TEXT,
  project_code TEXT,
  request_date DATE NOT NULL,
  due_date DATE NOT NULL,
  delivered_date DATE,
  is_on_time BOOLEAN GENERATED ALWAYS AS (
    delivered_date IS NOT NULL AND delivered_date <= due_date
  ) STORED,
  has_errors BOOLEAN DEFAULT false,
  error_count INTEGER DEFAULT 0,
  error_details TEXT,
  reviewer TEXT,                             -- người check chéo
  drafter TEXT,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','reviewing','approved','revised','released')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_drawings_due ON public.technical_drawings(due_date);

-- KT-07: Khảo sát công trình
CREATE TABLE IF NOT EXISTS public.site_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_code TEXT NOT NULL,
  project_code TEXT,
  customer TEXT,
  survey_date DATE NOT NULL,
  surveyor TEXT,
  total_items INTEGER NOT NULL,              -- tổng số thông tin khảo sát
  error_items INTEGER DEFAULT 0,             -- số lỗi phát hiện sau khi thi công
  accuracy_pct NUMERIC GENERATED ALWAYS AS (
    CASE WHEN total_items = 0 THEN 0
         ELSE (total_items - error_items)::NUMERIC / total_items * 100 END
  ) STORED,
  error_details JSONB,                       -- [{item, expected, actual, impact}]
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_surveys_date ON public.site_surveys(survey_date);

-- RLS (pattern tương tự migration 009)
ALTER TABLE public.machine_breakdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_surveys ENABLE ROW LEVEL SECURITY;
```

### 2.5. Migration 011: Coordination KPIs Tables

```sql
-- supabase/migrations/011_coordination_kpi_tables.sql

-- KH-02/03/07: Giao hàng
CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_code TEXT NOT NULL UNIQUE,
  pcode TEXT,
  customer TEXT NOT NULL,
  delivery_address TEXT,
  planned_date DATE NOT NULL,
  actual_date DATE,
  is_on_time BOOLEAN GENERATED ALWAYS AS (
    actual_date IS NOT NULL AND actual_date <= planned_date
  ) STORED,
  total_weight_tons NUMERIC NOT NULL,        -- KL hàng (tấn)
  damaged_weight_tons NUMERIC DEFAULT 0,     -- KL hư hỏng/mất
  damage_pct NUMERIC GENERATED ALWAYS AS (
    CASE WHEN total_weight_tons = 0 THEN 0
         ELSE damaged_weight_tons / total_weight_tons * 100 END
  ) STORED,
  damage_reason TEXT,
  vehicle_code TEXT,
  driver TEXT,
  delivery_cost NUMERIC,                     -- chi phí giao hàng (VND)
  cost_per_ton NUMERIC GENERATED ALWAYS AS (
    CASE WHEN total_weight_tons = 0 THEN 0
         ELSE delivery_cost / total_weight_tons END
  ) STORED,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned','in_transit','delivered','damaged','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_deliveries_date ON public.deliveries(planned_date);

-- Bảng baseline chi phí 2025 (dùng cho KH-03)
CREATE TABLE IF NOT EXISTS public.delivery_cost_baseline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER,                             -- NULL = trung bình cả năm
  avg_cost_per_ton NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, month)
);
INSERT INTO public.delivery_cost_baseline (year, month, avg_cost_per_ton) VALUES
  (2025, NULL, 0)  -- TODO: nhập số thực tế từ user
ON CONFLICT DO NOTHING;

-- KH-05: Báo cáo thống kê
CREATE TABLE IF NOT EXISTS public.statistical_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name TEXT NOT NULL,
  report_type TEXT,                          -- daily, weekly, monthly...
  due_date DATE NOT NULL,
  submitted_date DATE,
  is_on_time BOOLEAN GENERATED ALWAYS AS (
    submitted_date IS NOT NULL AND submitted_date <= due_date
  ) STORED,
  recipient TEXT,                            -- người/ban nhận báo cáo
  responsible_person TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','submitted','overdue')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_stat_reports_due ON public.statistical_reports(due_date);

-- KH-06: Quy trình ISO
CREATE TABLE IF NOT EXISTS public.iso_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_code TEXT NOT NULL UNIQUE,
  procedure_name TEXT NOT NULL,
  category TEXT,                             -- ISO 9001, 14001, 45001...
  planned_completion_date DATE NOT NULL,
  actual_completion_date DATE,
  is_on_time BOOLEAN GENERATED ALWAYS AS (
    actual_completion_date IS NOT NULL AND actual_completion_date <= planned_completion_date
  ) STORED,
  progress_pct NUMERIC DEFAULT 0,
  responsible_person TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','reviewing','approved','released','revised')),
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_iso_status ON public.iso_procedures(status, planned_completion_date);

-- RLS
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_cost_baseline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statistical_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iso_procedures ENABLE ROW LEVEL SECURITY;
```

### 2.6. Migration 012: HR + Overtime Tables (CRITICAL)

```sql
-- supabase/migrations/012_hr_overtime_tables.sql

-- ⭐ Helper function: chuẩn hóa workshop từ tên file CSV về DB chuẩn
CREATE OR REPLACE FUNCTION public.normalize_workshop(p_raw TEXT)
RETURNS TEXT AS $$
  SELECT UPPER(TRIM(
    CASE UPPER(TRIM(p_raw))
      WHEN 'DM1' THEN 'DMC1'
      WHEN 'DM2' THEN 'DMC1'   -- DM2 thuộc DMC1
      WHEN 'DM3' THEN 'DMC3'
      WHEN 'DM4' THEN 'DMC4'
      WHEN 'DM5' THEN 'DMC5'
      WHEN 'DMC1' THEN 'DMC1'
      WHEN 'DMC3' THEN 'DMC3'
      WHEN 'DMC4' THEN 'DMC4'
      WHEN 'DMC5' THEN 'DMC5'
      WHEN 'PKT-SX' THEN 'PKT-SX'
      WHEN 'PKT_SX' THEN 'PKT-SX'
      ELSE p_raw  -- giữ nguyên nếu không match (sẽ flag warning ở UI)
    END
  ));
$$ LANGUAGE sql IMMUTABLE;

GRANT EXECUTE ON FUNCTION public.normalize_workshop TO authenticated;

-- Bảng nhân viên
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  workshop TEXT,                             -- DMC1, DMC3, DMC4, DMC5, PKT-SX
  position TEXT,
  team TEXT,
  hire_date DATE,
  is_active BOOLEAN DEFAULT true,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_employees_ws ON public.employees(workshop, is_active);
CREATE INDEX idx_employees_name ON public.employees(full_name);

-- ⭐ Bảng tăng ca (master record) - có cột original_workshop để audit
CREATE TABLE IF NOT EXISTS public.overtime_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ot_date DATE NOT NULL,
  customer TEXT,
  pcode TEXT,
  workshop TEXT NOT NULL,                    -- ⭐ chuẩn hóa: DMC1, DMC3, DMC4, DMC5, PKT-SX
  original_workshop TEXT,                    -- ⭐ nguyên bản từ source: DM1, DM2... (để audit)

  ot_category TEXT NOT NULL CHECK (ot_category IN ('PRODUCTION','DELIVERY','INTERNAL')),

  reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Schema: {kh_dat_tre, don_hang_nhieu, noi_bo_sx, xe_vao_tre, don_hang_sll, giao_hang_sll, khong_du_nhan_su}

  total_employees INTEGER NOT NULL,
  total_hours NUMERIC NOT NULL,

  required_output NUMERIC,
  planned_hours NUMERIC,

  notes TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual','csv_import','google_sheet')),
  source_ref TEXT,                           -- link/sheet name nếu import
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ot_date_ws ON public.overtime_records(ot_date, workshop);
CREATE INDEX idx_ot_month ON public.overtime_records(date_trunc('month', ot_date));
CREATE INDEX idx_ot_pcode ON public.overtime_records(pcode);
CREATE INDEX idx_ot_orig_ws ON public.overtime_records(original_workshop);

-- ⭐ Trigger: auto-normalize workshop khi insert/update
CREATE OR REPLACE FUNCTION public.trg_normalize_ot_workshop()
RETURNS TRIGGER AS $$
BEGIN
  -- Lưu nguyên bản nếu chưa có
  IF NEW.original_workshop IS NULL THEN
    NEW.original_workshop := NEW.workshop;
  END IF;
  -- Chuẩn hóa workshop
  NEW.workshop := public.normalize_workshop(NEW.workshop);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_normalize_ot_workshop_biu
  BEFORE INSERT OR UPDATE OF workshop ON public.overtime_records
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_ot_workshop();

-- Bảng quan hệ N-N: nhân viên tham gia tăng ca
CREATE TABLE IF NOT EXISTS public.overtime_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overtime_id UUID NOT NULL REFERENCES public.overtime_records(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id),
  employee_name TEXT NOT NULL,
  hours NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(overtime_id, employee_name)
);
CREATE INDEX idx_ot_part_emp ON public.overtime_participants(employee_id);
CREATE INDEX idx_ot_part_name ON public.overtime_participants(employee_name);

-- Bảng cấu hình import
CREATE TABLE IF NOT EXISTS public.overtime_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT,
  sheet_name TEXT,
  import_month TEXT,
  rows_imported INTEGER,
  rows_skipped INTEGER,
  errors JSONB,
  status TEXT CHECK (status IN ('pending','running','success','failed','partial')),
  imported_by UUID REFERENCES public.profiles(id),
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_select_all" ON public.employees FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "employees_modify_admin" ON public.employees FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));

CREATE POLICY "ot_select_all" ON public.overtime_records FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ot_insert" ON public.overtime_records FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "ot_update_admin" ON public.overtime_records FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));
CREATE POLICY "ot_delete_admin" ON public.overtime_records FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

CREATE POLICY "ot_part_select_all" ON public.overtime_participants FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ot_part_modify" ON public.overtime_participants FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','MANAGER')));
```

### 2.7. Migration 013: RPC Functions cho KPI Aggregation (Multi-period)

```sql
-- supabase/migrations/013_kpi_rpc_functions.sql

-- ⭐ Helper: trả về metadata kỳ báo cáo
CREATE OR REPLACE FUNCTION public.get_period_range(
  p_period_type TEXT,        -- 'weekly','monthly','quarterly','yearly'
  p_anchor_date DATE          -- ngày nằm trong period (vd 2026-04-15 → tháng 4/2026)
) RETURNS TABLE (period_start DATE, period_end DATE, period_label TEXT) AS $$
BEGIN
  IF p_period_type = 'weekly' THEN
    RETURN QUERY SELECT
      date_trunc('week', p_anchor_date)::DATE,
      (date_trunc('week', p_anchor_date) + INTERVAL '6 days')::DATE,
      to_char(p_anchor_date, 'IYYY-"W"IW');
  ELSIF p_period_type = 'monthly' THEN
    RETURN QUERY SELECT
      date_trunc('month', p_anchor_date)::DATE,
      (date_trunc('month', p_anchor_date) + INTERVAL '1 month - 1 day')::DATE,
      to_char(p_anchor_date, 'YYYY-MM');
  ELSIF p_period_type = 'quarterly' THEN
    RETURN QUERY SELECT
      date_trunc('quarter', p_anchor_date)::DATE,
      (date_trunc('quarter', p_anchor_date) + INTERVAL '3 months - 1 day')::DATE,
      to_char(p_anchor_date, 'YYYY-"Q"Q');
  ELSIF p_period_type = 'yearly' THEN
    RETURN QUERY SELECT
      date_trunc('year', p_anchor_date)::DATE,
      (date_trunc('year', p_anchor_date) + INTERVAL '1 year - 1 day')::DATE,
      to_char(p_anchor_date, 'YYYY');
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ⭐ RPC chính: tính KPI cho 1 bộ phận, 1 period kỳ bất kỳ
CREATE OR REPLACE FUNCTION public.rpc_calculate_kpi(
  p_department TEXT,
  p_period_type TEXT,                 -- ⭐ 'weekly','monthly','quarterly','yearly'
  p_anchor_date DATE,                 -- ngày nằm trong period
  p_workshop TEXT DEFAULT NULL
)
RETURNS TABLE (
  kpi_code TEXT,
  kpi_name TEXT,
  target_value NUMERIC,               -- target cho period đã chọn (lấy từ get_kpi_target)
  target_operator TEXT,
  actual_value NUMERIC,
  unit TEXT,
  is_achieved BOOLEAN,
  achievement_pct NUMERIC,
  data_count INTEGER,
  period_start DATE,                  -- ⭐ thêm metadata
  period_end DATE,
  period_label TEXT,
  default_period TEXT,                -- ⭐ period chuẩn của KPI - để UI cảnh báo nếu khác
  is_period_match BOOLEAN             -- ⭐ true nếu p_period_type = default_period
) AS $$
DECLARE
  v_from DATE;
  v_to DATE;
  v_label TEXT;
BEGIN
  -- Tính range từ period_type và anchor
  SELECT period_start, period_end, period_label INTO v_from, v_to, v_label
  FROM public.get_period_range(p_period_type, p_anchor_date);

  -- ⭐ Workshop normalization (DM1, DM2 → DMC1)
  IF p_workshop IS NOT NULL THEN
    p_workshop := CASE p_workshop
      WHEN 'DM1' THEN 'DMC1'
      WHEN 'DM2' THEN 'DMC1'
      WHEN 'DM3' THEN 'DMC3'
      WHEN 'DM4' THEN 'DMC4'
      WHEN 'DM5' THEN 'DMC5'
      ELSE p_workshop
    END;
  END IF;

  -- ============== PRODUCTION ==============
  IF p_department = 'PRODUCTION' THEN
    -- SX-01: Tỷ lệ lỗi
    RETURN QUERY
    SELECT
      'SX-01'::TEXT,
      'Tỷ lệ lỗi thành phẩm'::TEXT,
      public.get_kpi_target('SX-01', p_period_type),
      'lte'::TEXT,
      COALESCE(SUM(d.defect_qty) / NULLIF(SUM(d.total_qty), 0) * 100, 0),
      '%'::TEXT,
      COALESCE(SUM(d.defect_qty) / NULLIF(SUM(d.total_qty), 0) * 100, 0) <= public.get_kpi_target('SX-01', p_period_type),
      CASE WHEN SUM(d.total_qty) = 0 THEN 100
           ELSE LEAST(100, public.get_kpi_target('SX-01', p_period_type) /
                NULLIF(SUM(d.defect_qty) / NULLIF(SUM(d.total_qty), 0) * 100, 0) * 100) END,
      COUNT(*)::INTEGER,
      v_from, v_to, v_label,
      'quarterly'::TEXT,
      (p_period_type = 'quarterly')
    FROM public.production_defects d
    WHERE d.report_date BETWEEN v_from AND v_to
      AND (p_workshop IS NULL OR d.workshop = p_workshop);

    -- SX-02: Đúng tiến độ đơn hàng
    RETURN QUERY
    SELECT
      'SX-02'::TEXT,
      'Đúng tiến độ đơn hàng'::TEXT,
      public.get_kpi_target('SX-02', p_period_type),
      'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE o.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
      '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE o.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('SX-02', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE o.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0)
            / NULLIF(public.get_kpi_target('SX-02', p_period_type), 0) * 100),
      COUNT(*)::INTEGER,
      v_from, v_to, v_label, 'quarterly'::TEXT, (p_period_type = 'quarterly')
    FROM public.order_completion o
    WHERE o.planned_date BETWEEN v_from AND v_to
      AND o.status = 'completed'
      AND (p_workshop IS NULL OR o.workshop = p_workshop);

    -- SX-04: Chi phí NVL
    RETURN QUERY
    SELECT
      'SX-04'::TEXT,
      'Chi phí NVL trong định mức'::TEXT,
      public.get_kpi_target('SX-04', p_period_type),
      'gte'::TEXT,
      COALESCE(SUM(m.norm_qty) / NULLIF(SUM(m.actual_qty), 0) * 100, 0),
      '%'::TEXT,
      COALESCE(SUM(m.norm_qty) / NULLIF(SUM(m.actual_qty), 0) * 100, 0) >= public.get_kpi_target('SX-04', p_period_type),
      LEAST(100, COALESCE(SUM(m.norm_qty) / NULLIF(SUM(m.actual_qty), 0) * 100, 0) / NULLIF(public.get_kpi_target('SX-04', p_period_type), 0) * 100),
      COUNT(*)::INTEGER,
      v_from, v_to, v_label, 'quarterly'::TEXT, (p_period_type = 'quarterly')
    FROM public.material_usage m
    WHERE m.report_date BETWEEN v_from AND v_to
      AND (p_workshop IS NULL OR m.workshop = p_workshop);

    -- SX-05: 5S
    RETURN QUERY
    SELECT
      'SX-05'::TEXT,
      'Tỷ lệ hoàn thành 5S'::TEXT,
      public.get_kpi_target('SX-05', p_period_type),
      'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE f.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
      '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE f.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('SX-05', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE f.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) / NULLIF(public.get_kpi_target('SX-05', p_period_type), 0) * 100),
      COUNT(*)::INTEGER,
      v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.findings_5s f
    WHERE f.finding_date BETWEEN v_from AND v_to
      AND f.department IN ('PRODUCTION','ALL')
      AND (p_workshop IS NULL OR f.workshop = p_workshop);

    -- SX-06: Tiến độ thi công
    RETURN QUERY
    SELECT
      'SX-06'::TEXT,
      'Tiến độ thi công công trình'::TEXT,
      public.get_kpi_target('SX-06', p_period_type),
      'gte'::TEXT,
      COALESCE(SUM(s.planned_hours) / NULLIF(SUM(s.actual_hours), 0) * 100, 0),
      '%'::TEXT,
      COALESCE(SUM(s.planned_hours) / NULLIF(SUM(s.actual_hours), 0) * 100, 0) >= public.get_kpi_target('SX-06', p_period_type),
      LEAST(100, COALESCE(SUM(s.planned_hours) / NULLIF(SUM(s.actual_hours), 0) * 100, 0) / NULLIF(public.get_kpi_target('SX-06', p_period_type), 0) * 100),
      COUNT(*)::INTEGER,
      v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.site_progress s
    WHERE s.start_date BETWEEN v_from AND v_to
      AND s.status = 'completed';

    -- TODO: SX-03 (OEE) - gọi từ rpc_fetch_prod_rows hiện có, lấy weighted average
  END IF;

  -- ============== MAINTENANCE ==============
  IF p_department = 'MAINTENANCE' THEN
    -- KT-01: Downtime / ngày trong period
    RETURN QUERY
    SELECT
      'KT-01'::TEXT,
      'Thời gian dừng máy ngoài KH'::TEXT,
      public.get_kpi_target('KT-01', p_period_type),
      'lt'::TEXT,
      COALESCE(SUM(b.downtime_minutes) / 60.0 / NULLIF((v_to - v_from + 1), 0), 0),
      'h/ngày'::TEXT,
      COALESCE(SUM(b.downtime_minutes) / 60.0 / NULLIF((v_to - v_from + 1), 0), 0) < public.get_kpi_target('KT-01', p_period_type),
      LEAST(100, public.get_kpi_target('KT-01', p_period_type) / NULLIF(COALESCE(SUM(b.downtime_minutes) / 60.0 / NULLIF((v_to - v_from + 1), 0), 0), 0) * 100),
      COUNT(*)::INTEGER,
      v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.machine_breakdowns b
    WHERE b.breakdown_start::DATE BETWEEN v_from AND v_to
      AND b.is_planned = false
      AND (p_workshop IS NULL OR b.workshop = p_workshop);

    -- KT-02: MTTR
    RETURN QUERY
    SELECT
      'KT-02'::TEXT,
      'Thời gian sửa chữa TB (MTTR)'::TEXT,
      public.get_kpi_target('KT-02', p_period_type),
      'lte'::TEXT,
      COALESCE(AVG(b.downtime_minutes), 0),
      'phút/lần'::TEXT,
      COALESCE(AVG(b.downtime_minutes), 0) <= public.get_kpi_target('KT-02', p_period_type),
      LEAST(100, public.get_kpi_target('KT-02', p_period_type) / NULLIF(COALESCE(AVG(b.downtime_minutes), 0), 0) * 100),
      COUNT(*)::INTEGER,
      v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.machine_breakdowns b
    WHERE b.breakdown_start::DATE BETWEEN v_from AND v_to
      AND b.breakdown_end IS NOT NULL
      AND (p_workshop IS NULL OR b.workshop = p_workshop);

    -- KT-03: MTBF
    RETURN QUERY
    SELECT
      'KT-03'::TEXT,
      'Thời gian giữa 2 lỗi (MTBF)'::TEXT,
      public.get_kpi_target('KT-03', p_period_type),
      'gte'::TEXT,
      CASE WHEN COUNT(*) FILTER (WHERE b.is_planned = false) = 0 THEN 0
           ELSE ((v_to - v_from + 1) * 24 - COALESCE(SUM(b.downtime_minutes)/60, 0))
                / COUNT(*) FILTER (WHERE b.is_planned = false) END,
      'giờ'::TEXT,
      CASE WHEN COUNT(*) FILTER (WHERE b.is_planned = false) = 0 THEN true
           ELSE ((v_to - v_from + 1) * 24 - COALESCE(SUM(b.downtime_minutes)/60, 0))
                / COUNT(*) FILTER (WHERE b.is_planned = false) >= public.get_kpi_target('KT-03', p_period_type) END,
      100::NUMERIC,
      COUNT(*) FILTER (WHERE b.is_planned = false)::INTEGER,
      v_from, v_to, v_label, 'quarterly'::TEXT, (p_period_type = 'quarterly')
    FROM public.machine_breakdowns b
    WHERE b.breakdown_start::DATE BETWEEN v_from AND v_to
      AND (p_workshop IS NULL OR b.workshop = p_workshop);

    -- KT-04, KT-05, KT-06, KT-07: tương tự pattern
    -- (rút gọn cho ngắn - implementation đầy đủ giống KT-01)

    RETURN QUERY
    SELECT
      'KT-04'::TEXT,
      'Tỷ lệ bảo trì đúng KH'::TEXT,
      public.get_kpi_target('KT-04', p_period_type),
      'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE m.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
      '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE m.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('KT-04', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE m.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0)),
      COUNT(*)::INTEGER,
      v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.maintenance_schedule m
    WHERE m.scheduled_date BETWEEN v_from AND v_to
      AND (p_workshop IS NULL OR m.workshop = p_workshop);

    RETURN QUERY
    SELECT
      'KT-05'::TEXT,
      'Độ chính xác bản vẽ'::TEXT,
      public.get_kpi_target('KT-05', p_period_type),
      'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE NOT t.has_errors)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
      '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE NOT t.has_errors)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('KT-05', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE NOT t.has_errors)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) / NULLIF(public.get_kpi_target('KT-05', p_period_type), 0) * 100),
      COUNT(*)::INTEGER,
      v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.technical_drawings t
    WHERE t.delivered_date BETWEEN v_from AND v_to
      AND t.status IN ('approved','released');

    RETURN QUERY
    SELECT
      'KT-06'::TEXT,
      'Thời gian hoàn thành bản vẽ'::TEXT,
      public.get_kpi_target('KT-06', p_period_type),
      'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE t.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
      '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE t.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('KT-06', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE t.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) / NULLIF(public.get_kpi_target('KT-06', p_period_type), 0) * 100),
      COUNT(*)::INTEGER,
      v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.technical_drawings t
    WHERE t.due_date BETWEEN v_from AND v_to;

    RETURN QUERY
    SELECT
      'KT-07'::TEXT,
      'Độ chính xác khảo sát CT'::TEXT,
      public.get_kpi_target('KT-07', p_period_type),
      'gte'::TEXT,
      COALESCE(AVG(s.accuracy_pct), 0),
      '%'::TEXT,
      COALESCE(AVG(s.accuracy_pct), 0) >= public.get_kpi_target('KT-07', p_period_type),
      LEAST(100, COALESCE(AVG(s.accuracy_pct), 0) / NULLIF(public.get_kpi_target('KT-07', p_period_type), 0) * 100),
      COUNT(*)::INTEGER,
      v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.site_surveys s
    WHERE s.survey_date BETWEEN v_from AND v_to;
  END IF;

  -- ============== COORDINATION ==============
  IF p_department = 'COORDINATION' THEN
    -- KH-02: Hư hỏng VC
    RETURN QUERY
    SELECT
      'KH-02'::TEXT,
      'Tỷ lệ hư hỏng vận chuyển'::TEXT,
      public.get_kpi_target('KH-02', p_period_type),
      'lte'::TEXT,
      COALESCE(SUM(d.damaged_weight_tons) / NULLIF(SUM(d.total_weight_tons), 0) * 100, 0),
      '%'::TEXT,
      COALESCE(SUM(d.damaged_weight_tons) / NULLIF(SUM(d.total_weight_tons), 0) * 100, 0) <= public.get_kpi_target('KH-02', p_period_type),
      CASE WHEN SUM(d.total_weight_tons) = 0 THEN 100
           ELSE LEAST(100, public.get_kpi_target('KH-02', p_period_type) / NULLIF(SUM(d.damaged_weight_tons) / NULLIF(SUM(d.total_weight_tons), 0) * 100, 0) * 100) END,
      COUNT(*)::INTEGER,
      v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.deliveries d
    WHERE d.actual_date BETWEEN v_from AND v_to;

    -- ⭐ KH-03: Chi phí giao hàng vs baseline (admin có thể chỉnh baseline)
    RETURN QUERY
    WITH baseline AS (
      SELECT value FROM public.kpi_baselines
      WHERE baseline_key = 'delivery_cost_per_ton_2025' LIMIT 1
    ),
    current_period AS (
      SELECT AVG(d.cost_per_ton) AS avg_cost FROM public.deliveries d
      WHERE d.actual_date BETWEEN v_from AND v_to AND d.total_weight_tons > 0
    )
    SELECT
      'KH-03'::TEXT,
      'Chi phí giao hàng (vs baseline)'::TEXT,
      public.get_kpi_target('KH-03', p_period_type),
      'lte'::TEXT,
      CASE WHEN COALESCE((SELECT value FROM baseline), 0) > 0
           THEN COALESCE((SELECT avg_cost FROM current_period), 0) / (SELECT value FROM baseline) * 100
           ELSE 0 END,
      '%'::TEXT,
      CASE WHEN COALESCE((SELECT value FROM baseline), 0) > 0
           THEN COALESCE((SELECT avg_cost FROM current_period), 0) / (SELECT value FROM baseline) * 100 <= public.get_kpi_target('KH-03', p_period_type)
           ELSE false END,
      0::NUMERIC,
      (SELECT COUNT(*)::INTEGER FROM public.deliveries WHERE actual_date BETWEEN v_from AND v_to),
      v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly');

    -- KH-04: 5S BP KH
    RETURN QUERY
    SELECT
      'KH-04'::TEXT,
      'Tỷ lệ 5S Bộ phận KH'::TEXT,
      public.get_kpi_target('KH-04', p_period_type),
      'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE f.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
      '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE f.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('KH-04', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE f.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) / NULLIF(public.get_kpi_target('KH-04', p_period_type), 0) * 100),
      COUNT(*)::INTEGER,
      v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.findings_5s f
    WHERE f.finding_date BETWEEN v_from AND v_to
      AND f.department IN ('COORDINATION','ALL');

    -- KH-05: Báo cáo TK
    RETURN QUERY
    SELECT
      'KH-05'::TEXT,
      'Số liệu thống kê báo cáo'::TEXT,
      public.get_kpi_target('KH-05', p_period_type),
      'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE r.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
      '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE r.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('KH-05', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE r.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0)),
      COUNT(*)::INTEGER,
      v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.statistical_reports r
    WHERE r.due_date BETWEEN v_from AND v_to AND r.status = 'submitted';

    -- KH-06: ISO
    RETURN QUERY
    SELECT
      'KH-06'::TEXT,
      'Xây dựng quy trình ISO'::TEXT,
      public.get_kpi_target('KH-06', p_period_type),
      'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE i.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
      '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE i.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('KH-06', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE i.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) / NULLIF(public.get_kpi_target('KH-06', p_period_type), 0) * 100),
      COUNT(*)::INTEGER,
      v_from, v_to, v_label, 'quarterly'::TEXT, (p_period_type = 'quarterly')
    FROM public.iso_procedures i
    WHERE i.planned_completion_date BETWEEN v_from AND v_to;

    -- KH-07: Giao hàng đúng hạn
    RETURN QUERY
    SELECT
      'KH-07'::TEXT,
      'Tỷ lệ giao hàng đúng hạn'::TEXT,
      public.get_kpi_target('KH-07', p_period_type),
      'gte'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE d.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
      '%'::TEXT,
      COALESCE(COUNT(*) FILTER (WHERE d.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) >= public.get_kpi_target('KH-07', p_period_type),
      LEAST(100, COALESCE(COUNT(*) FILTER (WHERE d.is_on_time)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0) / NULLIF(public.get_kpi_target('KH-07', p_period_type), 0) * 100),
      COUNT(*)::INTEGER,
      v_from, v_to, v_label, 'monthly'::TEXT, (p_period_type = 'monthly')
    FROM public.deliveries d
    WHERE d.planned_date BETWEEN v_from AND v_to AND d.status = 'delivered';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_calculate_kpi TO authenticated;

-- ⭐ RPC: Lịch sử KPI theo time series (cho trend chart)
-- Trả về N kỳ liên tiếp (N tuần / N tháng / N quý) trước anchor_date
CREATE OR REPLACE FUNCTION public.rpc_kpi_trend(
  p_kpi_code TEXT,
  p_period_type TEXT,
  p_anchor_date DATE,
  p_count INTEGER DEFAULT 12,
  p_workshop TEXT DEFAULT NULL
)
RETURNS TABLE (
  period_label TEXT,
  period_start DATE,
  period_end DATE,
  actual_value NUMERIC,
  target_value NUMERIC,
  is_achieved BOOLEAN
) AS $$
DECLARE
  v_dept TEXT;
  v_offset_unit TEXT;
  i INTEGER;
  v_anchor DATE;
BEGIN
  -- Lookup department từ kpi_code
  SELECT department INTO v_dept FROM public.kpi_targets WHERE kpi_code = p_kpi_code;
  IF v_dept IS NULL THEN
    RETURN;
  END IF;

  -- Loop N kỳ
  FOR i IN REVERSE p_count-1..0 LOOP
    v_anchor := CASE p_period_type
      WHEN 'weekly' THEN p_anchor_date - (i * INTERVAL '1 week')
      WHEN 'monthly' THEN p_anchor_date - (i * INTERVAL '1 month')
      WHEN 'quarterly' THEN p_anchor_date - (i * INTERVAL '3 months')
      WHEN 'yearly' THEN p_anchor_date - (i * INTERVAL '1 year')
    END;

    RETURN QUERY
    SELECT
      r.period_label,
      r.period_start,
      r.period_end,
      r.actual_value,
      r.target_value,
      r.is_achieved
    FROM public.rpc_calculate_kpi(v_dept, p_period_type, v_anchor, p_workshop) r
    WHERE r.kpi_code = p_kpi_code;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_kpi_trend TO authenticated;

-- RPC: Aggregate tăng ca theo PX (multi-period)
CREATE OR REPLACE FUNCTION public.rpc_overtime_summary(
  p_period_type TEXT,
  p_anchor_date DATE,
  p_workshop TEXT DEFAULT NULL
)
RETURNS TABLE (
  workshop TEXT,
  ot_count INTEGER,
  total_employees INTEGER,
  unique_employees INTEGER,
  total_hours NUMERIC,
  by_category JSONB,
  by_reason JSONB,
  period_start DATE,
  period_end DATE,
  period_label TEXT
) AS $$
DECLARE
  v_from DATE; v_to DATE; v_label TEXT;
BEGIN
  SELECT period_start, period_end, period_label INTO v_from, v_to, v_label
  FROM public.get_period_range(p_period_type, p_anchor_date);

  -- Workshop normalization
  IF p_workshop IS NOT NULL THEN
    p_workshop := CASE p_workshop
      WHEN 'DM1' THEN 'DMC1' WHEN 'DM2' THEN 'DMC1'
      WHEN 'DM3' THEN 'DMC3' WHEN 'DM4' THEN 'DMC4' WHEN 'DM5' THEN 'DMC5'
      ELSE p_workshop END;
  END IF;

  RETURN QUERY
  WITH ot AS (
    SELECT * FROM public.overtime_records
    WHERE ot_date BETWEEN v_from AND v_to
      AND (p_workshop IS NULL OR workshop = p_workshop)
  ),
  base AS (
    SELECT o.workshop, COUNT(*)::INTEGER AS ot_count,
      SUM(o.total_employees)::INTEGER AS total_employees,
      SUM(o.total_hours) AS total_hours
    FROM ot o GROUP BY o.workshop
  ),
  unique_emp AS (
    SELECT o.workshop, COUNT(DISTINCT p.employee_name)::INTEGER AS unique_employees
    FROM ot o JOIN public.overtime_participants p ON p.overtime_id = o.id
    GROUP BY o.workshop
  ),
  cat AS (
    SELECT o.workshop, jsonb_object_agg(o.ot_category, o.total_hours_sum) AS by_category
    FROM (
      SELECT workshop, ot_category, SUM(total_hours) AS total_hours_sum
      FROM ot GROUP BY workshop, ot_category
    ) o GROUP BY o.workshop
  ),
  reasons AS (
    SELECT o.workshop,
      jsonb_build_object(
        'kh_dat_tre', SUM(CASE WHEN (reasons->>'kh_dat_tre')::boolean THEN 1 ELSE 0 END),
        'don_hang_nhieu', SUM(CASE WHEN (reasons->>'don_hang_nhieu')::boolean THEN 1 ELSE 0 END),
        'noi_bo_sx', SUM(CASE WHEN (reasons->>'noi_bo_sx')::boolean THEN 1 ELSE 0 END),
        'xe_vao_tre', SUM(CASE WHEN (reasons->>'xe_vao_tre')::boolean THEN 1 ELSE 0 END),
        'don_hang_sll', SUM(CASE WHEN (reasons->>'don_hang_sll')::boolean THEN 1 ELSE 0 END),
        'giao_hang_sll', SUM(CASE WHEN (reasons->>'giao_hang_sll')::boolean THEN 1 ELSE 0 END),
        'khong_du_nhan_su', SUM(CASE WHEN (reasons->>'khong_du_nhan_su')::boolean THEN 1 ELSE 0 END)
      ) AS by_reason
    FROM ot GROUP BY workshop
  )
  SELECT b.workshop, b.ot_count, b.total_employees,
    COALESCE(u.unique_employees, 0), b.total_hours,
    COALESCE(c.by_category, '{}'::jsonb), COALESCE(r.by_reason, '{}'::jsonb),
    v_from, v_to, v_label
  FROM base b
  LEFT JOIN unique_emp u ON u.workshop = b.workshop
  LEFT JOIN cat c ON c.workshop = b.workshop
  LEFT JOIN reasons r ON r.workshop = b.workshop
  ORDER BY b.workshop;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_overtime_summary TO authenticated;

-- RPC: Top employees có giờ tăng ca cao nhất (multi-period)
CREATE OR REPLACE FUNCTION public.rpc_top_overtime_employees(
  p_period_type TEXT,
  p_anchor_date DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  employee_name TEXT,
  workshop TEXT,
  ot_count INTEGER,
  total_hours NUMERIC
) AS $$
DECLARE
  v_from DATE; v_to DATE;
BEGIN
  SELECT period_start, period_end INTO v_from, v_to
  FROM public.get_period_range(p_period_type, p_anchor_date);

  RETURN QUERY
  SELECT
    p.employee_name,
    MAX(o.workshop) AS workshop,
    COUNT(*)::INTEGER AS ot_count,
    SUM(COALESCE(p.hours, o.total_hours::NUMERIC / NULLIF(o.total_employees, 0))) AS total_hours
  FROM public.overtime_participants p
  JOIN public.overtime_records o ON o.id = p.overtime_id
  WHERE o.ot_date BETWEEN v_from AND v_to
  GROUP BY p.employee_name
  ORDER BY total_hours DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_top_overtime_employees TO authenticated;
```

### 2.8. Migration 014: Fix DB-001 (column case)

```sql
-- supabase/migrations/014_normalize_data_columns.sql
-- TÙY CHỌN: nếu muốn fix DB-001, có thể tạo VIEW thay vì rename column (an toàn hơn)
CREATE OR REPLACE VIEW public.v_data AS
SELECT
  id,
  "PCODE" AS pcode,
  "WORKSHOP" AS workshop,
  "PRODUCT" AS product,
  "CUSTOMER" AS customer,
  "QUANTITY" AS quantity,
  "DEADLINE" AS deadline,
  "INITIALDATE" AS initial_date,
  -- ... các cột khác
  created_at, updated_at
FROM public.data;

GRANT SELECT ON public.v_data TO authenticated;
```

### 2.9. Migration 015: Audit log cho thay đổi nhạy cảm

```sql
-- supabase/migrations/015_audit_log.sql
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES public.profiles(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);
CREATE INDEX idx_audit_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX idx_audit_user ON public.audit_log(changed_by, changed_at);

-- Trigger function
CREATE OR REPLACE FUNCTION public.log_table_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.audit_log(table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.audit_log(table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.audit_log(table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Áp dụng cho các bảng quan trọng
CREATE TRIGGER trg_audit_kpi_targets
  AFTER INSERT OR UPDATE OR DELETE ON public.kpi_targets
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();
-- Áp dụng tương tự cho overtime_records, employees, deliveries
```

---

## 3. PLAN TRIỂN KHAI THEO PHASE (Sprint Plan)

### **Phase 3.1 - Foundation (Tuần 1-2)** — Ưu tiên CRITICAL

#### Sprint 3.1.1: Migrations & RLS (3 ngày)
- [ ] **Task 1.1**: Tạo migrations 007 (RLS data), 008 (kpi_targets) — fix backlog
- [ ] **Task 1.2**: Test RLS với 4 role (ADMIN/MANAGER/SUPERVISOR/USER) bằng SQL trong Supabase Studio
- [ ] **Task 1.3**: Tạo migrations 009 (production), 010 (maintenance), 011 (coordination), 012 (HR+OT)
- [ ] **Task 1.4**: Run RPC migration 013 và test trong Supabase SQL editor:
  ```sql
  SELECT * FROM rpc_calculate_kpi('PRODUCTION', '2026-04-01', '2026-04-30', NULL);
  SELECT * FROM rpc_overtime_summary('2026-04-01', '2026-04-30', NULL);
  ```
- [ ] **Task 1.5**: Migration 015 audit log (chỉ áp dụng cho bảng nhạy cảm)
- [ ] **Acceptance**: Tất cả migrations chạy không lỗi, RLS test pass, RPC trả về đúng schema

#### Sprint 3.1.2: TypeScript Types & Constants (1 ngày)
- [ ] **Task 1.6**: Tạo `lib/types/kpi.ts` — type definitions cho 19 KPI
- [ ] **Task 1.7**: Tạo `lib/types/overtime.ts` — types cho OT records
- [ ] **Task 1.8**: Tạo `lib/constants/kpi-targets.ts` — danh sách 19 KPI codes + meta
- [ ] **Task 1.9**: Tạo `lib/constants/overtime-reasons.ts` — 10 lý do OT với label tiếng Việt
- [ ] **Task 1.10**: Tạo `lib/utils/kpi-calculator.ts` — helper tính achievement %, badge color
- [ ] **Task 1.11**: Update `lib/database.types.ts` — chạy `supabase gen types`

#### Sprint 3.1.3: Shared UI Components (2 ngày)
- [ ] **Task 1.12**: `components/kpi/KpiCard.tsx` — card hiển thị 1 KPI (giá trị thực tế / mục tiêu / % achievement / badge)
- [ ] **Task 1.13**: `components/kpi/KpiGauge.tsx` — ECharts gauge cho 1 KPI
- [ ] **Task 1.14**: `components/kpi/KpiTrendChart.tsx` — Recharts line chart 12 tháng
- [ ] **Task 1.15**: `components/kpi/KpiTargetBadge.tsx` — badge ✅/❌/⚠️ với tooltip giải thích
- [ ] **Task 1.16**: `components/forms/PeriodSelector.tsx` — ⭐ component CHÍNH cho mọi báo cáo
  - 2 phần:
    - Tab/Toggle: **Tuần / Tháng / Quý / Năm** (PeriodType)
    - Anchor selector tương ứng:
      - Weekly: `WeekPicker` (chọn tuần trong năm, format `YYYY-Www`)
      - Monthly: `MonthPicker` (chọn tháng/năm, format `YYYY-MM`)
      - Quarterly: `QuarterPicker` (Q1/Q2/Q3/Q4 + năm)
      - Yearly: `YearPicker` (chọn năm)
  - Output: `{ periodType, anchorDate }` cho API call
  - Props: `value`, `onChange`, `defaultPeriodType`
- [ ] **Task 1.17**: `components/forms/WorkshopSelect.tsx` — dropdown 5 phân xưởng
  - Options: **All / DMC1 / DMC3 / DMC4 / DMC5 / PKT-SX**
  - Không cần show DM1, DM2 (đã chuẩn hóa khi import)
  - Tooltip giải thích "DMC1 bao gồm cả DM1 và DM2"

---

### **Phase 3.2 - Tab Sản Xuất (Tuần 3-4)** — KPI SX-01 đến SX-06

#### Sprint 3.2.1: Form nhập liệu Defects + Material (2 ngày)
- [ ] **Task 2.1**: `app/(dashboard)/dashboard/production/defect/page.tsx`
  - Form react-hook-form: ngày, phân xưởng, PCODE (autocomplete từ data table), KL tổng, KL lỗi, loại lỗi, ca, ghi chú
  - Validation Zod: defect_qty <= total_qty, dates không tương lai
  - List 30 records gần nhất với pagination
- [ ] **Task 2.2**: `app/api/production/defects/route.ts` (GET/POST) + `[id]/route.ts` (PUT/DELETE)
- [ ] **Task 2.3**: `app/(dashboard)/dashboard/production/material-cost/page.tsx`
  - Form: ngày, PX, PCODE, mã NVL (autocomplete từ Material table), định mức, thực tế, đơn vị
  - Auto calc variance %
- [ ] **Task 2.4**: `app/api/production/material-usage/route.ts`

#### Sprint 3.2.2: Form Order Completion + 5S (2 ngày)
- [ ] **Task 2.5**: `app/(dashboard)/dashboard/production/ontime/page.tsx`
  - Inherit data từ `data` table (PCODE, deadline)
  - Form đánh dấu hoàn thành: actual_date, delay_reason
  - Bulk update: chọn nhiều PCODE → mark completed
- [ ] **Task 2.6**: `app/api/production/ontime-orders/route.ts`
- [ ] **Task 2.7**: `app/(dashboard)/dashboard/production/5s/page.tsx`
  - Form: ngày phát hiện, PX, khu vực, category 5S, mô tả, photo upload (Supabase Storage), severity, due_date
  - Tab "Chưa khắc phục" / "Đã khắc phục" / "Quá hạn"
  - Action: đánh dấu resolved + ghi resolution_notes
- [ ] **Task 2.8**: `app/api/production/5s-findings/route.ts` + Supabase Storage bucket `5s-photos`

#### Sprint 3.2.3: Site Progress (1 ngày)
- [ ] **Task 2.9**: `app/(dashboard)/dashboard/production/site-progress/page.tsx`
  - List projects với progress bar
  - Form CRUD: project_code, customer, dates, planned_hours, actual_hours
  - Update progress_pct realtime
- [ ] **Task 2.10**: `app/api/production/site-progress/route.ts`

#### Sprint 3.2.4: Production KPI Dashboard với 3 View Mode (3 ngày)
- [ ] **Task 2.11**: `app/(dashboard)/dashboard/report/kpi/production/page.tsx` — TRANG CHÍNH
  - **View 1: Tổng hợp toàn nhà máy** (mặc định)
    - 6 KPI Cards SX-01 → SX-06
    - 6 Gauge charts ECharts
    - Bảng chi tiết: KPI / Mục tiêu / Thực tế / Achievement % / Status
  - **View 2: Theo từng xưởng**
    - WorkshopSelect dropdown chọn xưởng
    - 6 KPI cards filter theo xưởng đã chọn
    - Trend chart 12 kỳ gần nhất - 6 KPI overlay
  - **View 3: Ma trận so sánh 4 xưởng** ⭐
    - Bảng 6×4 với conditional color (xanh đạt / đỏ chưa)
    - Click cell → modal drill-down chi tiết
    - Bên dưới: 3 charts phụ trợ (Radar, Bar group, Heatmap)
    - Auto insights: "DMC{X} cần focus N KPI"
  - Toggle 3 view mode bằng tab UI (không reload)
  - Period selector chung cho cả 3 view
- [ ] **Task 2.12**: `app/api/kpi/production/route.ts` — gọi `rpc_calculate_kpi('PRODUCTION', ...)`
- [ ] **Task 2.13** ⭐: `app/api/kpi/comparison/route.ts` — gọi `rpc_kpi_workshop_matrix('PRODUCTION', ...)`
- [ ] **Task 2.14** ⭐: 6 components comparison trong `components/kpi/comparison/`:
  - `KpiMatrixTable.tsx` — bảng 6×4 với cell click + color
  - `KpiRadarCompare.tsx` — radar 4 xưởng (ECharts)
  - `KpiBarGroupCompare.tsx` — bar group (Recharts)
  - `KpiHeatmapCompare.tsx` — heatmap với drill-down
  - `KpiInsightCard.tsx` — auto-generate insight text
  - `KpiViewModeToggle.tsx` — toggle View 1/2/3
- [ ] **Task 2.15**: Mở rộng migration 013 với RPC `rpc_kpi_workshop_matrix`

---

### **Phase 3.3 - Tab Bảo Trì (Tuần 5-6)** — KPI KT-01 đến KT-07

#### Sprint 3.3.1: Machine Breakdowns (2 ngày)
- [ ] **Task 3.1**: `app/(dashboard)/dashboard/maintenance/downtime/page.tsx`
  - Form: PX, mã máy, thời gian bắt đầu/kết thúc, loại lỗi (cơ/điện/điều khiển), nguyên nhân gốc, hành động sửa, phụ tùng, kỹ thuật viên
  - Auto-calc downtime_minutes
  - Toggle "có kế hoạch" hay "ngoài kế hoạch"
  - List với filter: open / in_progress / resolved
- [ ] **Task 3.2**: `app/api/maintenance/breakdowns/route.ts`
- [ ] **Task 3.3**: Chart MTTR/MTBF theo mã máy (Recharts bar)

#### Sprint 3.3.2: Maintenance Schedule (1.5 ngày)
- [ ] **Task 3.4**: `app/(dashboard)/dashboard/maintenance/schedule/page.tsx`
  - Calendar view các bảo trì sắp đến hạn
  - Form: PX, mã máy, loại BT (daily/weekly/monthly), ngày KH, checklist (JSONB)
  - Action: mark completed → record actual_date
  - Auto-create lịch định kỳ (recurring)
- [ ] **Task 3.5**: `app/api/maintenance/schedule/route.ts`

#### Sprint 3.3.3: Drawings + Surveys (2 ngày)
- [ ] **Task 3.6**: `app/(dashboard)/dashboard/maintenance/drawing/page.tsx`
  - Form: mã BV, tên, KH, project, ngày yêu cầu, hạn, ngày giao, có lỗi không, chi tiết lỗi, người check chéo, người vẽ
  - Workflow status: in_progress → reviewing → approved → released
- [ ] **Task 3.7**: `app/api/maintenance/drawings/route.ts`
- [ ] **Task 3.8**: `app/(dashboard)/dashboard/maintenance/survey/page.tsx`
  - Form: mã khảo sát, project, ngày, người khảo sát, tổng số mục, số lỗi (cập nhật sau thi công)
  - JSONB error_details: dynamic add row
- [ ] **Task 3.9**: `app/api/maintenance/surveys/route.ts`

#### Sprint 3.3.4: Maintenance KPI Dashboard (1.5 ngày)
- [ ] **Task 3.10**: `app/(dashboard)/dashboard/report/kpi/maintenance/page.tsx`
  - 7 KPI Cards (KT-01 → KT-07)
  - Heatmap downtime theo máy/ngày (ECharts)
  - Pareto chart top failure types (ECharts)
  - MTBF/MTTR trend 12 tháng
- [ ] **Task 3.11**: `app/api/kpi/maintenance/route.ts`

---

### **Phase 3.4 - Tab Phối Hợp & Nhân Sự (Tuần 7-8)** — KPI KH + Overtime

#### Sprint 3.4.1: HR Module (1.5 ngày)
- [ ] **Task 4.1**: `app/(dashboard)/dashboard/hr/employees/page.tsx`
  - CRUD employees: mã NV, họ tên, PX, vị trí, tổ, ngày vào, SĐT
  - Search + filter theo PX, position
  - Bulk import từ CSV (template mẫu)
- [ ] **Task 4.2**: `app/api/hr/employees/route.ts` + `[id]/route.ts`
- [ ] **Task 4.3**: Seed employees từ file CSV tăng ca:
  ```sql
  -- script seed_employees.sql
  -- Extract unique names từ overtime_participants → insert vào employees
  ```

#### Sprint 4.4.2: Overtime Form (CRITICAL - 2 ngày)
- [ ] **Task 4.4**: `app/(dashboard)/dashboard/coordination/overtime/page.tsx`
  - Form mirror cấu trúc CSV:
    - Ngày, KH, PCODE, PX (DM1-5, PKT-SX)
    - Phân loại: 3 radio button (Sản xuất / Giao nhận / Nội bộ) → ot_category
    - Lý do: 7-10 checkbox → reasons JSONB
    - Số lượng NS (auto-count từ multi-select employees)
    - Multi-select employees (Combobox với search)
    - Tổng số giờ
    - Sản lượng cần SX, Thời gian KH (chỉ hiện khi ot_category=PRODUCTION)
    - Ghi chú
  - Validation: total_employees = số NV chọn
- [ ] **Task 4.5**: `app/api/coordination/overtime/route.ts` — POST tạo record + bulk insert participants

#### Sprint 4.4.3: Overtime Import từ Google Sheet (2 ngày)
- [ ] **Task 4.6**: `app/(dashboard)/dashboard/coordination/overtime/import/page.tsx`
  - Upload CSV (giống file mẫu) HOẶC paste link Google Sheet
  - Preview: parse 10 dòng đầu, hiển thị mapping
  - Mapping config: cột CSV → cột DB
  - Validation: report số dòng OK / lỗi
  - Action "Import" → chạy bulk insert
- [ ] **Task 4.7**: `app/api/coordination/overtime-import/route.ts`
  - Parse CSV (papaparse)
  - Mỗi dòng: tạo `overtime_records` + tách danh sách NV → bulk insert `overtime_participants`
  - Auto-match employee_name → employee_id (fuzzy match)
  - Log vào `overtime_imports`
  - Trả response: { rows_imported, rows_skipped, errors }
- [ ] **Task 4.8**: Apps Script optional: bổ sung endpoint `/api/coordination/overtime-import` để Apps Script gọi giống `data` sync

#### Sprint 3.4.4: Deliveries (1 ngày)
- [ ] **Task 4.9**: `app/(dashboard)/dashboard/coordination/delivery/page.tsx`
  - Form: mã DH, PCODE, KH, ngày KH/thực tế, KL (tấn), KL hư hỏng, lý do, mã xe, lái xe, chi phí
  - Auto-calc damage_pct, cost_per_ton, is_on_time
- [ ] **Task 4.10**: `app/api/coordination/deliveries/route.ts`

#### Sprint 3.4.5: Reports + ISO (1.5 ngày)
- [ ] **Task 4.11**: `app/(dashboard)/dashboard/coordination/reports/page.tsx`
  - List báo cáo định kỳ: tên, loại, hạn, ngày nộp, người chịu trách nhiệm
  - Action: mark submitted
- [ ] **Task 4.12**: `app/api/coordination/statistical-reports/route.ts`
- [ ] **Task 4.13**: `app/(dashboard)/dashboard/coordination/iso/page.tsx`
  - Kanban view: draft / reviewing / approved / released / revised
  - Drag-drop để chuyển status
- [ ] **Task 4.14**: `app/api/coordination/iso-procedures/route.ts`

#### Sprint 3.4.6: Coordination KPI Dashboard (1.5 ngày)
- [ ] **Task 4.15**: `app/(dashboard)/dashboard/report/kpi/coordination/page.tsx`
  - 6 KPI Cards (KH-02 → KH-07)
  - Pie chart phân bổ chi phí giao hàng theo PX
  - Comparison bar: chi phí 2025 vs 2026
  - Funnel chart đơn hàng: nhận → SX → giao → đúng hạn
- [ ] **Task 4.16**: `app/api/kpi/coordination/route.ts`

---

### **Phase 3.5 - Báo cáo Tăng Ca (Tuần 9)** — Overtime Reports

#### Sprint 3.5.1: Overtime Dashboard (2 ngày)
- [ ] **Task 5.1**: `app/(dashboard)/dashboard/report/overtime/page.tsx`
  - Header KPI cards (4 cái):
    - Tổng số lần tăng ca
    - Tổng số giờ tăng ca
    - Số nhân viên tham gia
    - TB giờ/người
  - Bar chart: Số giờ TC theo phân xưởng (DM1, DM2, DM3, DM4, PKT-SX)
  - Pie chart: Phân bổ % theo lý do tăng ca (10 categories)
  - Heatmap: Calendar heatmap theo ngày trong tháng
  - Stacked bar: TC theo tuần × phân loại (SX/Giao nhận/Nội bộ)
- [ ] **Task 5.2**: `app/api/kpi/overtime/route.ts` — gọi `rpc_overtime_summary`
- [ ] **Task 5.3**: Top 10 nhân viên tăng ca nhiều nhất (table) — gọi `rpc_top_overtime_employees`

#### Sprint 3.5.2: HR Overtime Detail (1 ngày)
- [ ] **Task 5.4**: `app/(dashboard)/dashboard/hr/overtime-summary/page.tsx`
  - Bảng chi tiết theo nhân viên: tên, PX, số lần TC, tổng giờ
  - Drill-down: click NV → xem từng record TC
  - Filter: tháng, PX, range giờ

---

### **Phase 3.6 - Master KPI Dashboard & Export (Tuần 10)**

#### Sprint 3.6.1: Master KPI Dashboard (2 ngày)
- [ ] **Task 6.1**: `app/(dashboard)/dashboard/report/kpi/page.tsx`
  - **Section A**: Tóm tắt 3 bộ phận
    - 3 cards lớn: PRODUCTION / MAINTENANCE / COORDINATION
    - Mỗi card: % KPI đạt mục tiêu / tổng KPI (vd "5/6 KPI đạt")
  - **Section B**: Radar chart so sánh
    - 1 radar chung 3 bộ phận, mỗi axis = 1 KPI (max 7-8 trục)
  - **Section C**: Bảng tổng hợp 19 KPI
    - Cột: KPI Code / Tên / Bộ phận / Mục tiêu / Thực tế / % / Status / Trend (mini-line)
    - Sort/filter
  - **Section D**: Trend chart 12 tháng
    - Multi-line: 1 line/KPI, dropdown chọn tối đa 5 KPI
- [ ] **Task 6.2**: `app/api/kpi/summary/route.ts`

#### Sprint 3.6.2: Export Excel/PDF (1.5 ngày)
- [ ] **Task 6.3**: `app/(dashboard)/dashboard/report/export/page.tsx`
  - Form: chọn loại báo cáo (KPI / Overtime / Production / etc)
  - Chọn khoảng thời gian, phân xưởng
  - Format: Excel (.xlsx) hoặc PDF
  - Button "Tải xuống" → call API
- [ ] **Task 6.4**: `app/api/exports/kpi-report/route.ts`
  - Dùng `exceljs` để build file Excel multi-sheet:
    - Sheet 1: Tổng quan (3 dept summary)
    - Sheet 2: Sản Xuất (6 KPI + raw data)
    - Sheet 3: Bảo Trì (7 KPI)
    - Sheet 4: Phối Hợp (6 KPI)
    - Sheet 5: Tăng Ca (overtime summary)
  - Format: bold header, conditional formatting (green/red theo achievement)
- [ ] **Task 6.5**: `app/api/exports/overtime-report/route.ts`
  - Excel mirror cấu trúc CSV gốc + thêm sheet aggregation
- [ ] **Task 6.6** (optional): PDF export dùng `@react-pdf/renderer` hoặc `puppeteer`

#### Sprint 3.6.3: KPI Targets + Baselines Management (1.5 ngày)
- [ ] **Task 6.7**: `app/(dashboard)/dashboard/admin/kpi-targets/page.tsx`
  - Bảng 19 KPI từ DB
  - Edit inline: target_value, target_operator, action_plan
  - ⭐ Cột mới: target theo từng period (target_weekly, target_monthly, target_quarterly, target_yearly) - cho phép admin override khi xem theo period khác mặc định
  - Toggle is_active
  - Audit log link
- [ ] **Task 6.8**: `app/api/kpi/targets/route.ts`
- [ ] **Task 6.9** ⭐: `app/(dashboard)/dashboard/admin/kpi-baselines/page.tsx` — CRUD baselines
  - Form chỉnh: `delivery_cost_per_ton_2025` (VND/tấn), `material_norm_cost_2025`
  - Có thể thêm baseline mới: baseline_key, description, value, unit, year, month
  - History: xem các lần update baseline (audit log)
  - Hint UI: nếu baseline = 0 thì KPI KH-03 sẽ không tính được, hiển thị warning trên dashboard
- [ ] **Task 6.10**: `app/api/kpi/baselines/route.ts`

---

### **Phase 3.7 - Polish & Hardening (Tuần 11-12)**

#### Sprint 3.7.1: Testing (3 ngày)
- [ ] **Task 7.1**: Jest unit tests cho `lib/utils/kpi-calculator.ts` (achievement %, target check)
- [ ] **Task 7.2**: API route tests cho 4 RPC chính (defects, OT records, KPI summary)
- [ ] **Task 7.3**: Playwright E2E (NTH-001):
  - Flow 1: Login → nhập 1 defect → check KPI dashboard cập nhật
  - Flow 2: Import OT CSV → check overtime dashboard
  - Flow 3: Export KPI Excel → verify file structure
- [ ] **Task 7.4**: Seed script test data 3 tháng cho demo

#### Sprint 3.7.2: Performance & UX (2 ngày)
- [ ] **Task 7.5**: Add indexes cho query chậm (`EXPLAIN ANALYZE` trên RPC)
- [ ] **Task 7.6**: SWR/React Query cho client cache (giảm refetch)
- [ ] **Task 7.7**: Loading skeleton cho tất cả KPI cards
- [ ] **Task 7.8**: Error boundary + toast (sonner) cho UX
- [ ] **Task 7.9**: Mobile responsive: tất cả form + dashboard

#### Sprint 3.7.3: Documentation (1 ngày)
- [ ] **Task 7.10**: `docs/KPI_2026.md` — mô tả 19 KPI
- [ ] **Task 7.11**: `docs/OVERTIME_IMPORT.md` — hướng dẫn import từ GG Sheet
- [ ] **Task 7.12**: User manual với screenshot (cho operator nhập liệu)
- [ ] **Task 7.13**: Update `README.md` chính

---

## 4. PROMPT TEMPLATES CHO CLAUDE CLI

Đây là các prompt sẵn dùng để paste vào terminal Claude CLI. Mỗi prompt = 1 sprint.

### 4.1. Prompt Sprint 3.1.1 (Migrations)

```
Tôi cần tạo các Supabase migrations sau cho dự án DMC Production Manager:

1. Đọc file PLAN_KPI_2026.md trong root project (mục 2.1 → 2.9)
2. Tạo lần lượt 9 migrations từ 007 → 015 trong supabase/migrations/
3. Sau mỗi migration, chạy: `supabase db push` (nếu có Supabase CLI) hoặc copy nội dung để tôi paste vào Supabase Studio
4. Kiểm tra schema: `\d+ kpi_targets` trong psql hoặc Supabase Table Editor
5. Test các RPC bằng query mẫu trong migration 013
6. Báo cáo: số bảng tạo / số RPC / lỗi nếu có

Lưu ý:
- Backup DB trước khi chạy (Supabase tự backup hàng ngày, nhưng vẫn snapshot manual)
- Migration 014 (column case) tạm SKIP nếu rủi ro cao - chỉ tạo VIEW
- RLS policy phải test bằng cách switch role ADMIN/MANAGER/SUPERVISOR/USER
```

### 4.2. Prompt Sprint 3.2 (Tab Sản Xuất)

```
Triển khai Sprint 3.2 trong PLAN_KPI_2026.md - Tab Sản Xuất với 6 KPI (SX-01 → SX-06).

Trình tự:
1. Tạo 5 trang nhập liệu trong app/(dashboard)/dashboard/production/:
   - defect/page.tsx (Task 2.1)
   - ontime/page.tsx (Task 2.5)
   - material-cost/page.tsx (Task 2.3)
   - 5s/page.tsx (Task 2.7)
   - site-progress/page.tsx (Task 2.9)
2. Tạo 5 API routes tương ứng trong app/api/production/

3. ⭐ KPI Dashboard với 3 VIEW MODE (đọc kỹ section 1.3 trong PLAN):
   - app/(dashboard)/dashboard/report/kpi/production/page.tsx
   - View 1: Tổng hợp toàn nhà máy (6 KPI cards, 6 gauge, bảng)
   - View 2: Theo từng xưởng (chọn DMC1/DMC3/DMC4/DMC5 + trend 12 kỳ)
   - View 3: Matrix so sánh 4 xưởng (6×4 bảng + Radar + Bar group + Heatmap + insights)
   - Toggle bằng tab UI, không reload
   - Period selector dùng chung component PeriodSelector từ Phase 3.1

4. ⭐ 6 components comparison trong components/kpi/comparison/:
   - KpiMatrixTable.tsx, KpiRadarCompare.tsx, KpiBarGroupCompare.tsx,
   - KpiHeatmapCompare.tsx, KpiInsightCard.tsx, KpiViewModeToggle.tsx

5. ⭐ API routes:
   - app/api/kpi/production/route.ts (single dept aggregation)
   - app/api/kpi/comparison/route.ts (matrix 6 KPI × 4 workshops)

6. Mở rộng migration 013 thêm rpc_kpi_workshop_matrix() function

7. CẬP NHẬT SIDEBAR (KHÔNG XÓA item cũ):
   - Giữ nguyên: "Dashboard tổng" (link đến /dashboard/report)
   - Giữ nguyên: "Xếp hạng phân xưởng" (link đến /dashboard/report#workshops-ranking)
   - Thêm separator + group "Báo cáo KPI 2026"
   - Thêm: "KPI Dashboard tổng", "KPI Sản Xuất", "KPI Bảo Trì", "KPI Phối Hợp"

Yêu cầu kỹ thuật:
- Form: react-hook-form + Zod, components shadcn
- API: zod validate input, RLS-aware
- Charts: ECharts cho Radar/Heatmap/Gauge, Recharts cho Bar group/Line
- Style: nhất quán với pattern hiện tại
- Mobile-first responsive
- View 3 phải auto-generate insight text dạng "DMC{X} cần focus N KPI: SX-Y, SX-Z"

Test cases:
- AC-VIEW3-1: Toggle 3 view không reload trang
- AC-VIEW3-2: Matrix render đúng 24 cells (6 KPI × 4 xưởng)
- AC-VIEW3-3: Click cell → modal drill-down hiển thị
- AC-VIEW3-4: Radar 4 xưởng đọc được rõ
- AC-VIEW3-5: Auto insight chính xác
- AC-VIEW3-7: Render < 1.5s với 1 quý data

Run: npm run type-check && npm run lint && npm run build

Sau khi xong, commit:
"feat: add Sprint 3.2 production KPI tracking with 3-view comparison (SX-01 to SX-06)"

QUAN TRỌNG: Tuyệt đối KHÔNG sửa hay xóa các trang/API hiện tại:
- /dashboard/report/page.tsx (giữ nguyên)
- /api/reports/production-progress, output, quality, oee, workshops/ranking (giữ nguyên)
```

### 4.3. Prompt Sprint 3.4 (Tab Phối Hợp + Tăng Ca - QUAN TRỌNG NHẤT)

```
Triển khai Sprint 3.4 trong PLAN_KPI_2026.md - Tab Phối Hợp & Nhân Sự + Module Tăng Ca.

CRITICAL: Module Tăng Ca phải mirror đúng cấu trúc file CSV gốc.

Trình tự:
1. HR Module (Task 4.1-4.3):
   - Tạo app/(dashboard)/dashboard/hr/employees/page.tsx
   - CRUD nhân viên với bulk import CSV
   - Seed employees từ tên trong overtime_participants

2. Overtime Form (Task 4.4-4.5) - QUAN TRỌNG:
   - File: app/(dashboard)/dashboard/coordination/overtime/page.tsx
   - Form fields phải khớp 100% với CSV TĂNG_CA__-_Tăng_ca_04_2026.csv:
     * NGÀY (date picker)
     * KHÁCH HÀNG (text)
     * LỆNH SẢN XUẤT / PCODE (autocomplete từ data table)
     * PHÂN XƯỞNG (select: DM1, DM2, DM3, DM4, PKT-SX)
     * TĂNG CA (3 radio: Sản xuất / Giao, nhận hàng / NỘI BỘ) → ot_category
     * LÍ DO (7 checkbox):
       - KH đặt trễ, YC gấp → kh_dat_tre
       - Đơn hàng nhiều SX không kịp → don_hang_nhieu
       - NỘI BỘ → noi_bo_dt
       - Xe vào trễ → xe_vao_tre
       - ĐƠN HÀNG SX SLL → don_hang_sll
       - GIAO HÀNG SLL → giao_hang_sll
       - KHÔNG ĐỦ NHÂN SỰ SX, GH → khong_du_nhan_su
     * SỐ LƯỢNG NHÂN SỰ (number)
     * NHÂN VIÊN (multi-select Combobox từ employees, search)
     * Tổng số giờ (number)
     * Sản lượng cần SX (m) (number, conditional show khi ot_category=PRODUCTION)
     * Thời gian theo kế hoạch (h) (number)
     * GHI CHÚ (textarea)
   - Validation Zod: total_employees match số NV chọn

3. Import từ Google Sheet (Task 4.6-4.8):
   - Trang: app/(dashboard)/dashboard/coordination/overtime/import/page.tsx
   - Upload CSV → parse với papaparse
   - Mapping CSV columns → DB columns (theo file mẫu):
     * Col 0 NGÀY → ot_date (parse dd/MM/yyyy)
     * Col 1 KHÁCH HÀNG → customer
     * Col 2 LỆNH SẢN XUẤT → pcode
     * Col 3 PHÂN XƯỞNG → workshop
     * Col 4-6 (Sản xuất/Giao nhận/Nội bộ) TRUE/FALSE → ot_category
     * Col 7-13 (lý do) → reasons JSONB
     * Col 14 → total_employees
     * Col 15 (multi-line names) → split by \n → bulk insert overtime_participants
     * Col 16 → total_hours
     * Col 17 → required_output
     * Col 18 → planned_hours
     * Col 19 → notes
   - Skip rows: nếu Col 0 không match dd/MM/yyyy
   - Skip header rows 0, 1
   - Skip aggregation rows (col 21+ chứa % hoặc số tổng hợp)
   - API: POST app/api/coordination/overtime-import/route.ts
   - Sau import: log vào overtime_imports table

4. Deliveries (Task 4.9-4.10):
   - Form đầy đủ + auto-calc damage_pct, cost_per_ton

5. Statistical Reports + ISO (Task 4.11-4.14)

6. Coordination KPI Dashboard (Task 4.15-4.16):
   - 6 KPI cards (KH-02 → KH-07)
   - Charts theo specs trong PLAN

Test cases:
1. Import file CSV mẫu (TĂNG_CA__-_Tăng_ca_04_2026.csv): expect 32 records, 4 workshop chuẩn hóa
2. Verify rpc_overtime_summary trả đúng (sau khi normalize DM1+DM2 → DMC1):
   - DMC1: 19 records (DM1: 15 + DM2: 4), **214.5h** (207 + 7.5)
   - DMC3: 3 records, 50.5h
   - DMC4: 1 record, 18h
   - PKT-SX: 8 records, 139h
   - Tổng: 422h (giữ nguyên)
3. Verify cột original_workshop lưu đúng giá trị raw (DM1, DM2, DM3...)
4. KPI dashboard hiển thị 6 KPI KH với multi-period selector (tuần/tháng/quý/năm)
5. Test rpc_calculate_kpi('COORDINATION', 'monthly', '2026-04-15', NULL) → KH-02 đến KH-07 đầy đủ

Run: npm run type-check && npm run lint && npm run build

Commit: "feat: add Sprint 3.4 coordination + HR + overtime tracking"
```

### 4.4. Prompt Sprint 3.6 (Master Dashboard + Export)

```
Triển khai Sprint 3.6 trong PLAN_KPI_2026.md - Master KPI Dashboard và Export Excel/PDF.

1. Master Dashboard (Task 6.1-6.2):
   - Trang: app/(dashboard)/dashboard/report/kpi/page.tsx
   - 4 sections theo PLAN
   - API summary: app/api/kpi/summary/route.ts
   - Cache 5 phút (Next.js revalidate)

2. Export Excel (Task 6.4-6.5):
   - Cài: npm i exceljs
   - File: app/api/exports/kpi-report/route.ts
   - Generate xlsx multi-sheet:
     * Sheet "Tổng quan": tóm tắt 19 KPI
     * Sheet "SX Chi tiết": raw data defects, material, 5S, etc
     * Sheet "KT Chi tiết"
     * Sheet "KH Chi tiết"
     * Sheet "Tăng Ca": full overtime data + summary
   - Format:
     * Header bold, background xanh đậm, white text
     * Conditional formatting: green nếu đạt mục tiêu, red nếu không
     * Số định dạng theo unit (%, h, phút)
     * Auto-fit column width
   - Filename: KPI_Report_{YYYY-MM-DD_to_YYYY-MM-DD}.xlsx
   - Set response headers: Content-Type, Content-Disposition

3. KPI Targets Admin (Task 6.7-6.8):
   - Trang admin chỉnh mục tiêu

Test:
- Export file → mở bằng Excel verify đủ 5 sheets, format đúng
- KPI tracking: thay đổi target trong admin → dashboard update

Commit: "feat: add Sprint 3.6 master KPI dashboard and Excel export"
```

---

## 5. KPI ACCEPTANCE CRITERIA (Cho từng module sau khi xong)

### 5.1. Production (sau Phase 3.2)
- ✅ Nhập được defect, material usage, order completion, 5S finding, site progress
- ✅ KPI dashboard hiển thị 6 KPI với % achievement
- ✅ Filter theo quý, phân xưởng hoạt động
- ✅ Trend chart 12 tháng smooth
- ✅ Mobile responsive
- ✅ RLS: USER không sửa được record của user khác

### 5.2. Maintenance (sau Phase 3.3)
- ✅ MTTR/MTBF tự động tính khi log breakdown
- ✅ Heatmap downtime hiển thị màu sắc theo cường độ
- ✅ Pareto chart top 5 failure types
- ✅ Calendar bảo trì có visual cho overdue (red)
- ✅ Workflow drawing status: in_progress → released

### 5.3. Coordination (sau Phase 3.4)
- ✅ Import CSV file mẫu (TĂNG_CA__-_Tăng_ca_04_2026.csv) thành công, expect 32 rows
- ✅ rpc_overtime_summary trả về 5 phân xưởng với tổng giờ chính xác (DM1: 207h, DM2: 7.5h, DM3: 50.5h, DM4: 18h, PKT-SX: 139h)
- ✅ Top 10 employees hiển thị đúng
- ✅ Pie chart 7 reasons có số liệu
- ✅ KH-03 (chi phí giao hàng) so sánh được với baseline 2025

### 5.4. Master Dashboard (sau Phase 3.6)
- ✅ Hiển thị tóm tắt 19 KPI trong 1 page
- ✅ Radar chart 3 bộ phận
- ✅ Export Excel có đủ 5 sheets, mở được bằng MS Excel + Google Sheets
- ✅ Export thời gian < 5 giây cho 1 quý dữ liệu
- ✅ Print-friendly CSS cho dashboard

---

## 6. RỦI RO & GIẢM THIỂU

| Rủi ro | Tác động | Giảm thiểu |
|--------|----------|------------|
| Migration 014 rename column → vỡ Apps Script | CRITICAL - mất sync GG Sheet | SKIP rename, chỉ tạo VIEW v_data |
| Import OT CSV format thay đổi | HIGH - mất dữ liệu | Validation strict + show preview trước import + log vào overtime_imports |
| RLS policy quá chặt → user không insert được | MEDIUM | Test với 4 role trước khi deploy |
| Số KPI quá nhiều → dashboard chậm | MEDIUM | Materialized view cho RPC + cache 5-15 phút |
| Employee name fuzzy match sai | MEDIUM | Show preview cho user confirm trước khi link |
| Vẫn không có staging | CRITICAL (SYS-001) | **Trước Phase 3.6**: clone DB sang Supabase project mới làm staging — bắt buộc cho phase này |
| File Excel export size lớn > 10MB | LOW | Chunked streaming + warning UI |

---

## 7. CHECKLIST PRE-DEPLOY (sau khi hoàn thành tất cả phase)

### 7.1. Database
- [ ] Tất cả 9 migrations chạy thành công
- [ ] Test 19 KPI với data mẫu 1 tháng → verify số liệu
- [ ] RLS test với 4 role
- [ ] Backup DB trước go-live
- [ ] Index check: `EXPLAIN ANALYZE` cho 5 query chậm nhất

### 7.2. Application
- [ ] `npm run type-check` pass
- [ ] `npm run lint` no warning
- [ ] `npm run build` thành công (< 2 phút)
- [ ] All E2E tests pass
- [ ] Bundle size < 500KB per route
- [ ] Lighthouse score > 85 (Performance, Accessibility, Best Practices)

### 7.3. Documentation
- [ ] User manual với 19 KPI explained
- [ ] Video hướng dẫn nhập tăng ca (5 phút)
- [ ] API documentation (OpenAPI/Swagger nếu có thể)
- [ ] Migration rollback scripts

### 7.4. Training
- [ ] Train trưởng PX nhập liệu (3 buổi)
- [ ] Train manager xem báo cáo (1 buổi)
- [ ] Train admin cấu hình KPI targets (1 buổi)

---

## 8. ESTIMATE TỔNG

| Phase | Sprint | Ngày công | Mô tả |
|-------|--------|-----------|-------|
| 3.1 | Foundation | 6 ngày | Migrations + types + UI components |
| 3.2 | Sản Xuất | **8 ngày** | 6 KPI + dashboard 3 view mode (View 3 matrix +1 ngày) |
| 3.3 | Bảo Trì | 7 ngày | 7 KPI + dashboard (có thể reuse pattern View 3) |
| 3.4 | Phối Hợp + HR + OT | 9 ngày | 6 KPI + import OT + HR |
| 3.5 | OT Reports | 3 ngày | Dashboard tăng ca |
| 3.6 | Master + Export | 4.5 ngày | Tổng hợp + Excel export |
| 3.7 | Polish | 6 ngày | Test + perf + docs |
| **Tổng** | | **~43.5 ngày** | **~9 tuần với 1 dev full-time** |

Với Claude CLI hỗ trợ: có thể giảm còn **5-6 tuần** nếu prompt rõ ràng.

> Lưu ý: Sau khi build xong View 3 cho Sản Xuất ở Sprint 3.2, pattern này sẽ được reuse cho Sprint 3.3 (Bảo Trì) và 3.4 (Phối Hợp), tiết kiệm thời gian build comparison.

---

## 9. PHỤ LỤC: Mapping CSV → DB cho Overtime Import

| CSV Column Index | CSV Header | DB Column | Type | Note |
|-------|-----------|-----------|------|------|
| 0 | NGÀY | overtime_records.ot_date | DATE | Parse `d/M/yyyy` |
| 1 | KHÁCH HÀNG | customer | TEXT | Trim + uppercase |
| 2 | LỆNH SẢN XUẤT | pcode | TEXT | Optional |
| 3 | PHÂN XƯỞNG | workshop + original_workshop | TEXT | **Normalize: DM1→DMC1, DM2→DMC1, DM3→DMC3, DM4→DMC4, DM5→DMC5, PKT-SX giữ nguyên** |
| 4 | TĂNG CA / Sản xuất | ot_category | TEXT | TRUE → 'PRODUCTION' |
| 5 | TĂNG CA / Giao nhận | ot_category | TEXT | TRUE → 'DELIVERY' |
| 6 | TĂNG CA / NỘI BỘ | ot_category | TEXT | TRUE → 'INTERNAL' |
| 7 | LÍ DO / KH đặt trễ | reasons.kh_dat_tre | BOOL | |
| 8 | LÍ DO / Đơn hàng nhiều | reasons.don_hang_nhieu | BOOL | |
| 9 | LÍ DO / NỘI BỘ | reasons.noi_bo_dt | BOOL | |
| 10 | LÍ DO / Xe vào trễ | reasons.xe_vao_tre | BOOL | |
| 11 | LÍ DO / Đơn SLL | reasons.don_hang_sll | BOOL | |
| 12 | LÍ DO / Giao SLL | reasons.giao_hang_sll | BOOL | |
| 13 | LÍ DO / Không đủ NS | reasons.khong_du_nhan_su | BOOL | |
| 14 | SỐ LƯỢNG NS | total_employees | INT | |
| 15 | NHÂN VIÊN | overtime_participants[] | TEXT[] | Split by `\n` → bulk insert |
| 16 | Tổng số giờ | total_hours | NUMERIC | |
| 17 | Sản lượng cần SX | required_output | NUMERIC | Chỉ cho PRODUCTION |
| 18 | Thời gian KH | planned_hours | NUMERIC | |
| 19 | GHI CHÚ | notes | TEXT | |
| 21-30 | (aggregation rows) | SKIP | - | Không import |

**LƯU Ý IMPORTANT (đã confirm)**: 
- File CSV dùng `DM1, DM2, DM3, DM4, PKT-SX`. Trong đó **DM1 và DM2 đều là phân xưởng vật lý DMC1**.
- Trước khi insert vào `overtime_records`, code import phải:
  1. Đọc giá trị raw → lưu vào cột mới `original_workshop` (TEXT, để tracking)
  2. Convert sang chuẩn DB → lưu vào cột `workshop`
  3. Mapping: `DM1`/`DM2` → `DMC1`, `DM3` → `DMC3`, `DM4` → `DMC4`, `DM5` → `DMC5`, `PKT-SX` giữ nguyên
- DB đã có function `normalize_workshop()` (xem migration 012 mở rộng) để dùng nhất quán mọi nơi.

**Test verification sau import file CSV mẫu (TĂNG_CA__-_Tăng_ca_04_2026.csv tháng 4/2026)**:
- Tổng records: **32**
- Theo workshop chuẩn hóa:
  - **DMC1**: 19 records (DM1: 15 + DM2: 4), **214.5 giờ** (207 + 7.5)
  - **DMC3**: 3 records, 50.5 giờ
  - **DMC4**: 1 record, 18 giờ
  - **PKT-SX**: 8 records, 139 giờ
- `original_workshop` group:
  - DM1: 15 records, DM2: 4 records, DM3: 3, DM4: 1, PKT-SX: 8

---

**Hết PLAN. Sẵn sàng đưa cho Claude CLI thực thi.**


---

# 📌 LƯU Ý QUAN TRỌNG TRƯỚC KHI TRIỂN KHAI

⚠️ **Phải hoàn thành Staging Environment TRƯỚC khi chạy Phase 3.1**

Đọc file riêng: **`STAGING_SETUP_GUIDE.md`**

Lý do: Plan này chạy 9 migrations + 13 bảng mới + 5 RPC + sửa RLS. Chạy thẳng production = rủi ro cao. Phải có staging để test trước.

Quy trình tổng thể:
```
Bước 1 (3-4h):   Setup staging theo STAGING_SETUP_GUIDE.md
                 ├─ Bạn: tạo Supabase/Vercel project, lấy keys
                 └─ Claude CLI: viết workflows + components

Bước 2 (30p):    Bạn verify staging hoạt động (checklist trong guide)

Bước 3 (~9 tuần): Claude CLI thực hiện Phase 3.1 → 3.7 trên branch `staging`
                  theo PLAN này (file PLAN_KPI_2026.md)

Bước 4 (1 tuần): Promote staging → production sau khi UAT OK
```

**KHÔNG ĐƯA file PLAN_KPI_2026.md cho Claude CLI khi chưa setup xong staging.**

---

## SUMMARY THỨ TỰ TRIỂN KHAI

```
🟢 BƯỚC 0 (1 tuần):  Setup Staging Environment ⭐ TRƯỚC TIÊN
                     → Xem file STAGING_SETUP_GUIDE.md

🟡 BƯỚC 1 (2 tuần):  Phase 3.1 Foundation trên STAGING
                     ├─ Run migrations 007-015
                     ├─ Test RPC + RLS với test users
                     └─ Build shared components

🟡 BƯỚC 2 (2 tuần):  Phase 3.2 Tab Sản Xuất (6 KPI + 3 view mode)
🟡 BƯỚC 3 (2 tuần):  Phase 3.3 Tab Bảo Trì (7 KPI)
🟡 BƯỚC 4 (2 tuần):  Phase 3.4 Phối Hợp + HR + OT (CRITICAL)
🟡 BƯỚC 5 (1 tuần):  Phase 3.5 OT Reports
🟡 BƯỚC 6 (1 tuần):  Phase 3.6 Master Dashboard + Export
🟡 BƯỚC 7 (1 tuần):  Phase 3.7 Polish + Testing

🔴 BƯỚC 8 (1 tuần):  Promote staging → production
```

**Tổng thời gian**: ~12-13 tuần (3 tháng) với 1 dev full-time + Claude CLI hỗ trợ.
