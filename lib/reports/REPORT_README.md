# Báo cáo sản xuất — Tài liệu kỹ thuật

## Cấu trúc thư mục

```
lib/reports/
  report-types.ts          — Tất cả TypeScript types dùng chung
  oee-calculator.ts        — Các hàm tính toán OEE (pure functions, testable)
  report-queries.ts        — Truy vấn Supabase cho 5 loại báo cáo
  __tests__/
    oee-calculator.test.ts — 30 unit tests cho các công thức OEE

app/api/reports/
  _shared.ts               — Auth helper + parse params chung
  production-progress/route.ts
  production-output/route.ts
  quality-result/route.ts
  oee/route.ts
  workshops/ranking/route.ts

components/report/
  report-dashboard.tsx     — Main component: 2 chế độ xem
  charts/
    oee-chart.tsx          — ECharts: gauge (detail) + radar + heatmap (comparison)
  sections/
    progress-section.tsx   — Tiến độ sản xuất
    output-section.tsx     — Kết quả sản xuất
    quality-section.tsx    — Chất lượng
    oee-section.tsx        — OEE
```

## API Endpoints

| Endpoint | Method | Params |
|----------|--------|--------|
| `/api/reports/production-progress` | GET | `mode`, `workshopId`*, `from`, `to`, `groupBy` |
| `/api/reports/production-output`   | GET | idem |
| `/api/reports/quality-result`      | GET | idem |
| `/api/reports/oee`                 | GET | idem |
| `/api/reports/workshops/ranking`   | GET | `metric`, `from`, `to` |

`*` `workshopId` bắt buộc khi `mode=detail`, bỏ qua khi `mode=comparison`.

**Giá trị hợp lệ:**
- `mode`: `detail` | `comparison`
- `workshopId`: `DMC1` | `DMC3` | `DMC4` | `DMC5`
- `groupBy`: `shift` | `day` | `week` | `month` | `year`
- `metric`: `oee` | `quality` | `output` | `progress`

## Công thức nghiệp vụ

### OEE = A × P × Q

```
A (Khả năng hoạt động) = (poutput / pspeed) / (endtime − starttime)
  - pspeed: tốc độ chuẩn (sản phẩm/giờ) từ bảng Norm
  - duration: tính từ starttime, endtime (định dạng HH:mm)
  - Giới hạn tối đa = 1.0

P (Hiệu suất thiết bị) = realnorm / norm
  - realnorm: định mức thực tế đã lưu trong bảng Production
  - norm: định mức chuẩn từ bảng Norm
  - Giới hạn tối đa = 1.0

Q (Tỷ lệ chất lượng) = (poutput − eoutput − routput) / poutput
  - eoutput: sản phẩm lỗi, routput: sản phẩm tái chế
  - Giới hạn [0, 1]
```

### Roll-up OEE từ dòng sản xuất → xưởng

Dùng **trung bình có trọng số theo sản lượng** (poutput), KHÔNG dùng trung bình cộng:

```
A_xưởng = Σ(A_i × poutput_i) / Σ(poutput_i)
P_xưởng = Σ(P_i × poutput_i) / Σ(poutput_i)
Q_xưởng = Σ(Q_i × poutput_i) / Σ(poutput_i)
OEE_xưởng = A_xưởng × P_xưởng × Q_xưởng
```

### Tỷ lệ lỗi (chất lượng)

```
Tỷ lệ lỗi (%) = (eoutput + routput) / poutput × 100
Ngưỡng cảnh báo mặc định: 5%
```

### Tiến độ sản xuất

```
Tiến độ (%) = Số LSX có bản ghi Production / Tổng số LSX × 100
Trạng thái lệnh:
  completed  → LSX đã có bản ghi Production
  overdue    → DEADLINEDATE < now, chưa có Production
  due_soon   → DEADLINEDATE trong vòng 24h, chưa có Production
  in_progress → còn hạn, chưa có Production
```

## Phân loại ca sản xuất (starttime)

| Ca | Khung giờ |
|----|-----------|
| Ca sáng 1 | 07:30 – 09:30 |
| Ca sáng 2 | 09:30 – 11:30 |
| Ca chiều 1 | 12:30 – 14:30 |
| Ca chiều 2 | 14:30 – 16:30 |
| Ngoài ca | Ngoài các khung trên |

> **Giả định:** starttime trong bảng Production là tùy ý người nhập — không đảm bảo khớp đúng khung ca.

## Giả định và giới hạn hiện tại

1. **Dòng sản xuất = cột `products`** trong bảng Production. Không có bảng production_lines riêng.
2. **Workshop của Production record** được xác định bằng JOIN: `Production.pcode → data.PCODE → data.WORKSHOP`.
3. **4 xưởng báo cáo:** DMC1, DMC3, DMC4, DMC5. Phân xưởng 1 và Phân xưởng 2 đều map về DMC1.
4. **starttime/endtime** là TEXT "HH:mm" — có thể rỗng nếu người dùng không nhập.
5. **A = 0** nếu pspeed = 0 hoặc duration = 0 (edge case: không có norm hoặc không nhập giờ).

## Mở rộng khi thêm dòng sản xuất mới

1. Thêm row vào bảng **Norm** với `products` = tên sản phẩm mới, `workshop` = DMC code, `norm`, `pspeed`.
2. Không cần thay đổi code — queries tự động pick up sản phẩm mới thông qua `GROUP BY products`.

## Mở rộng khi thêm xưởng mới

1. Thêm xưởng mới vào `WORKSHOP_CODES` trong `lib/reports/report-types.ts`.
2. Cập nhật `WORKSHOP_COLORS` và `WORKSHOP_LABEL`.
3. Cập nhật `WORKSHOP_MAP` trong `lib/utils.ts` để map tên đầy đủ → DMC code.

## Chạy tests

```bash
npm test
# → 30 unit tests cho oee-calculator.ts
```
