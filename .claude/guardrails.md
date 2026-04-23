# Guardrails — DMC Production Manager

**File này định nghĩa các rule BẮT BUỘC khi làm việc trên dự án.**
**Claude KHÔNG ĐƯỢC vi phạm trong bất kỳ hoàn cảnh nào.**

---

## 🚫 RED LINES — Tuyệt đối không

### 1. Database Safety
- **KHÔNG** chạy migration lên production Supabase trực tiếp (`hzuyucyxyohppxfwresq`)
- **KHÔNG** dùng Supabase MCP với `service_role` key trên production
- **KHÔNG** DROP table, DROP column, TRUNCATE
- **KHÔNG** sửa migration file đã merge vào `main` (immutable sau khi deploy)
- **KHÔNG** sửa RLS policy mà không hỏi — có thể ảnh hưởng security

### 2. Git Safety
- **KHÔNG** force push `main` (`git push -f origin main`)
- **KHÔNG** commit `.env`, `.env.local`, hoặc bất kỳ file chứa `SERVICE_ROLE_KEY`
- **KHÔNG** amend commit đã push lên remote
- **KHÔNG** merge PR của mình (phải user approve)

### 3. Data Integrity
- **KHÔNG** sửa data trực tiếp trong bảng `data` qua SQL
  - Nguồn truth là Google Sheet "Tổng hợp 2026"
  - Muốn sửa data → sửa sheet → Apps Script tự sync
- **KHÔNG** xóa record trong bảng `Production` — đây là historical data
- **KHÔNG** tự ý đổi kiểu column (TEXT → NUMERIC...) sau khi có data

### 4. Code Safety
- **KHÔNG** `npm install` package mới mà chưa hỏi user
  - Lý do: bundle size Vercel, security audit, license
- **KHÔNG** thay đổi `next.config`, `tsconfig`, `package.json` major version
- **KHÔNG** bypass TypeScript strict mode (`@ts-ignore`, `any` không lý do)
- **KHÔNG** sửa code ngoài scope task được giao

---

## ⚠️ YELLOW LINES — PHẢI hỏi trước

1. Tạo migration mới (thêm/đổi table, column)
2. Thay đổi env variables
3. Thêm/đổi RLS policy
4. Update package.json major version
5. Thay đổi cấu trúc folder lớn (di chuyển `/app`, `/lib`...)
6. Thêm dependency mới (kể cả dev dependency)
7. Xóa file/component hiện có
8. Thay đổi API endpoint response shape (breaking change)

---

## ✅ GREEN — Được làm tự do

1. Đọc code, đọc schema, đọc logs
2. Chạy test local (`npm test`, `npm run lint`, `npm run type-check`)
3. Tạo branch mới từ `main` hoặc `develop`
4. Tạo file mới trong feature branch (tuân theo pattern hiện có)
5. Fix typo, format code (không đổi logic)
6. Update `.claude/*.md` theo thực tế code
7. Viết test case mới
8. Refactor code trong scope task, giữ nguyên behavior

---

## 📋 Quy trình bắt buộc khi có thay đổi

### Trước khi code
- [ ] Đã đọc `guardrails.md` (file này)
- [ ] Đã đọc context file liên quan (database-schema.md, architecture.md...)
- [ ] Đã tạo branch mới: `git checkout -b [feat|fix|refactor|chore]/ten-task`
- [ ] Đã confirm plan với user

### Khi code
- [ ] Viết test TRƯỚC nếu là business logic (TDD)
- [ ] Comment tiếng Việt cho logic nghiệp vụ phức tạp
- [ ] Tuân thủ pattern code hiện có (xem file tương tự)
- [ ] Không đụng vào code ngoài scope task

### Trước khi commit
- [ ] Chạy `git diff` tự review
- [ ] Check secret leak:
  ```bash
  git diff --cached | grep -iE "(service_role|secret|password|bearer|eyj[a-z0-9])"
  ```
- [ ] Chạy `npm run type-check`
- [ ] Chạy `npm run lint`
- [ ] Update `.claude/*.md` nếu liên quan
- [ ] Commit message theo convention:
  ```
  type(scope): description
  
  Types: feat, fix, refactor, chore, docs, test
  Scope: report, auth, sync, db, ci, ...
  ```

### Sau khi xong task
- [ ] Append entry vào `work-log.md` (format có sẵn trong file)
- [ ] Báo user review
- [ ] Tạo PR nếu cần (KHÔNG tự merge)

---

## 🎯 Business Rules bắt buộc

Các rule nghiệp vụ KHÔNG được vi phạm khi code:

### 1. Timezone
- **LUÔN** dùng `Asia/Ho_Chi_Minh` (UTC+7)
- Datetime format phải có offset `+07:00`
- KHÔNG dùng `new Date()` trực tiếp, dùng helper trong `lib/date-utils.ts`

### 2. Tuần ISO 8601
- Tuần tính theo ISO 8601 (Thứ 2 là đầu tuần)
- KHÔNG dùng lịch Mỹ (Chủ nhật đầu tuần)
- PostgreSQL: `TO_CHAR(date, 'IYYY-"W"IW')`

### 3. OEE Calculation
- OEE = A × P × Q
- Roll-up nhiều dòng/period: **weighted average theo sản lượng**
- KHÔNG dùng trung bình cộng đơn thuần
- Division by zero → trả `NULL`, không phải `0` hay `NaN`

### 4. Khung giờ ca
- ca_sang_1: 7:30–9:30
- ca_sang_2: 9:30–11:30
- ca_chieu_1: 12:30–14:30
- ca_chieu_2: 14:30–16:30
- ca_tang_ca: 16:30–22:00
- khac: ngoài các khung trên

### 5. Schema column case (CRITICAL)
- Table `data`:
  - Column `id`: **lowercase**
  - Các column khác: **UPPERCASE** có quotes trong SQL
    - `"PCODE"`, `"INITIALDATE"`, `"CUSTOMER"`, `"WORKSHOP"`,
      `"DESCRIPTION"`, `"QUANTITY"`, `"DEADLINEDATE"`, `"STATUS"`
- Table `Production`, `Norm`, `Material`, `profiles`:
  - Tên table có quotes (PascalCase)
  - Column lowercase
- Khi viết SQL/RPC: **LUÔN** dùng quotes cho uppercase column

---

## 🔒 File KHÔNG được phép Claude sửa

1. `.claude/guardrails.md` (file này) — chỉ user edit
2. `supabase/migrations/*.sql` (đã merge) — immutable
3. `.env*` — chỉ user quản lý
4. `.github/workflows/*.yml` — chỉ user approve thay đổi CI

---

## 📞 Khi không chắc chắn

**LUÔN** hỏi user khi:
- Không rõ column/table case
- Không rõ business rule
- Thấy code giống như bug nhưng không chắc
- RLS policy phức tạp
- Performance concern với query lớn

**Câu hỏi chuẩn:**
> "Tôi thấy [vấn đề X]. Có 2 hướng: [A] và [B]. Tôi nghiêng về [A] vì [lý do]. Bạn confirm hướng nào?"

---

## 🎓 Lesson learned (không lặp lại)

### L-001: Case-sensitive column với quotes
- Table `data` có `id` lowercase nhưng các column khác UPPERCASE
- Migration 001 dùng lowercase trong CREATE nhưng thực tế DB là uppercase
- → Khi write SQL: **LUÔN** dùng `"PCODE"` không dùng `PCODE`
- → Verify trước khi code bằng `information_schema.columns`

### L-002: Google Apps Script sync rate limit
- Batch > 500 records dễ hit Apps Script bandwidth limit
- → Dùng batch 200 + sleep 500ms + exponential backoff retry

### L-003: Duplicate PCODE trong Google Sheet
- User có thể nhập trùng PCODE → fail upsert
- → Dedupe trước khi push, giữ row cuối

### L-004: ISO week vs US week
- Code cũ tính tuần theo lịch Mỹ → lệch 1-2 ngày
- → Dùng ISO 8601 cho mọi tính toán tuần
