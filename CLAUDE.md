# Claude Context Entry Point — DMC Production Manager

**Cập nhật lần cuối:** 2026-04-23
**Phiên bản context:** 1.0.0

---

## 🎯 Hướng dẫn cho Claude

Khi phiên làm việc bắt đầu, Claude BẮT BUỘC thực hiện các bước sau:

### Bước 1: Đọc state bền vững (theo thứ tự)
1. `.claude/guardrails.md` — **BẮT BUỘC đọc đầu tiên**, không được vi phạm
2. `.claude/project-context.md` — bối cảnh dự án, business domain
3. `.claude/architecture.md` — kiến trúc, luồng dữ liệu
4. `.claude/database-schema.md` — schema Supabase hiện tại
5. `.claude/known-issues.md` — bug đã biết, technical debt
6. `.claude/deployment.md` — quy trình deploy, env vars
7. `.claude/work-log.md` — 5 entry gần nhất (`tail -200`)

### Bước 2: Verify state vs code thực tế
- `git branch --show-current`
- `git log --oneline -10`
- `git status`
- So sánh migration files trong `supabase/migrations/` với timestamp cuối trong `database-schema.md`
- Nếu drift → báo user

### Bước 3: Báo cáo theo format chuẩn
```
📋 PROJECT CONTEXT LOADED
━━━━━━━━━━━━━━━━━━━━━━━━
Project: DMC Production Manager
Stack: Next.js 16.2 / Supabase / Vercel
Branch: [current]
Last commit: [hash] [message]

📊 CURRENT STATE
- Tables: 5 (data, Production, Norm, Material, profiles)
- RPC: 2 (rpc_fetch_prod_rows, fn_classify_shift)
- API routes: 7
- Open critical issues: [count]

🔄 RECENT WORK
[3 entries gần nhất từ work-log.md]

⚠️ DRIFT DETECTED (nếu có)
[...]

✅ READY. Tôi đang ở phiên mới.
Bạn muốn làm gì hôm nay?
```

### Bước 4: CHỜ user chỉ đạo
- KHÔNG tự ý đoán task
- KHÔNG code trước khi user confirm plan
- KHÔNG sửa .claude/*.md trừ khi user yêu cầu

---

## 🛑 Nguyên tắc cao nhất (TUYỆT ĐỐI)

1. **KHÔNG** chạy migration trực tiếp lên production Supabase
2. **KHÔNG** commit secrets/API keys vào git
3. **KHÔNG** force push branch `main`
4. **KHÔNG** sửa migration đã merge trong `supabase/migrations/`
5. **KHÔNG** tự ý `npm install` package mới (phải hỏi)
6. **KHÔNG** sửa code khi chưa đọc context liên quan

---

## 📁 Cấu trúc quản lý context

```
.claude/
├── guardrails.md          ← Rule bắt buộc
├── project-context.md     ← Bối cảnh dự án
├── architecture.md        ← Kiến trúc
├── database-schema.md     ← Schema + drift log
├── known-issues.md        ← Bugs + tech debt
├── deployment.md          ← Deploy flow
├── work-log.md           ← Nhật ký phiên (Claude append)
└── session/
    └── current.md         ← State tạm (.gitignored)
```

---

## 🚨 KHI CÓ SỰ CỐ

### Nếu pipeline sync Google Sheet → Supabase bị lỗi:
→ Đọc `known-issues.md` mục SYNC-*
→ Google Apps Script nằm trong file riêng, KHÔNG trong repo
→ Data integrity check: `SELECT COUNT(*) FROM data;`

### Nếu migration production bị lỗi:
→ KHÔNG tự rollback. Hỏi user ngay.
→ Check `deployment.md` mục Rollback

### Nếu RLS policy chặn query:
→ Check `database-schema.md` mục RLS Policies
→ Verify user role trong bảng `profiles`

---

## 📞 Liên hệ nội bộ

- **Supabase project:** `hzuyucyxyohppxfwresq`
- **Repo:** GitHub (branch chính: `main`, develop: `develop`)
- **Deploy:** Vercel auto-deploy từ `main`
