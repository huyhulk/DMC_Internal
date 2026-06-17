# Claude Context Entry Point — DMC Production Manager

**Cập nhật lần cuối:** 2026-06-17
**Phiên bản context:** 1.1.0

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

### Quy trình bắt buộc khi sửa bug / sửa tính năng
Áp dụng cho toàn bộ dự án từ 2026-05-01 trở đi:

1. **Kiểm tra hiện trạng**: đọc context liên quan, kiểm tra branch, git status, log gần nhất, script test/build, và khu vực code bị ảnh hưởng.
2. **Tìm root cause**: tái hiện lỗi hoặc chỉ ra bằng chứng trong code/log/test; không sửa theo phỏng đoán.
3. **Lên plan sửa**: liệt kê bug, nguyên nhân, phạm vi file sẽ sửa, test sẽ chạy; chờ user confirm nếu thay đổi có rủi ro hoặc theo yêu cầu guardrails.
4. **Sửa chữa**: sửa đúng root cause, phạm vi hẹp, không refactor ngoài task, không revert thay đổi của user.
5. **Test mẫu trên local server**: chạy `type-check`, `lint`, test liên quan, và mở local dev server để smoke test UI/flow khi task có giao diện.
6. **Hỏi trước khi push GitHub**: sau khi local pass, báo kết quả và hỏi user có muốn commit/push/tạo PR không. Không tự push khi chưa được phép.

**Branch mặc định:** toàn bộ dự án hiện làm trên `staging`. Khi tạo branch mới, tạo từ `staging` trừ khi user chỉ định khác. Không push/merge vào `main` khi chưa có yêu cầu rõ ràng.

---

## 🤝 Phân vai Opus ↔ Sonnet (từ 2026-06-17)

**Opus** lo phần "đầu não", luôn chạy ở effort **high**:
- Lập **plan**, chia **task**, dựng **bức tranh tổng thể** (kiến trúc, luồng dữ liệu, phạm vi file/thay đổi).
- **Tìm / điều tra bug**, phân tích root cause.
- Tự **code phần khó, logic phức tạp** — KHÔNG giao cho Sonnet.

**Sonnet** lo phần **viết code** (lớn hay nhỏ đều được), chạy ở effort **high**:
- Chỉ code khi Opus đã dựng **đủ bức tranh** (plan rõ ràng: file nào, sửa gì, test gì).
- Opus **chỉ định** Sonnet thực thi qua Agent/subagent (`model: sonnet`, `effort: high`) theo đúng plan.
- Code xong, Sonnet **báo cáo lại Opus** (tóm tắt việc đã làm, file đã sửa, kết quả type-check/lint/test) để Opus rà soát & tích hợp.

Quy tắc luồng: **Opus quyết định "làm gì & làm thế nào" → Sonnet code theo plan → báo cáo về Opus → Opus rà soát**. Việc khó/logic khó thì Opus tự code. Mọi guardrail và "Quy trình bắt buộc khi sửa bug / sửa tính năng" ở trên vẫn áp dụng cho cả hai.

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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **DMC_Internal** (2889 symbols, 6015 relationships, 244 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/DMC_Internal/context` | Codebase overview, check index freshness |
| `gitnexus://repo/DMC_Internal/clusters` | All functional areas |
| `gitnexus://repo/DMC_Internal/processes` | All execution flows |
| `gitnexus://repo/DMC_Internal/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
