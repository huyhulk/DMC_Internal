# Work Log — DMC Production Manager

> **Claude tự append entry mỗi cuối phiên. User không sửa tay file này.**
> **Format:** Entry mới nhất ở trên cùng, ngày lùi dần.

---

## Template entry (Claude dùng khi append)

```markdown
## YYYY-MM-DD (Phiên #N)
**Branch:** [branch-name]
**Claude model:** [Opus 4.7 / Sonnet 4.6 / ...]
**Duration:** [X phút/giờ]
**Task:** [mô tả ngắn task chính]

### Đã làm
- [bullet points liệt kê]

### Quyết định kỹ thuật
- [các decision quan trọng + lý do]

### Issues phát hiện
- [bug mới phát hiện → đã log vào known-issues.md chưa]

### Files thay đổi
- [list files, KHÔNG include .claude/]

### Context files updated
- [list .claude/*.md đã update trong phiên]

### Status cuối phiên
- [ ] Code committed? [Y/N + commit hash]
- [ ] PR created? [Y/N + PR link]
- [ ] Tests passing? [Y/N]
- [ ] Documentation updated? [Y/N]

### Next time resume
[Ghi chú để phiên sau biết tiếp tục từ đâu]

---
```

---

## 📜 Entries

## 2026-04-23 (Phiên #2 — Context setup)
**Branch:** main
**Claude model:** Sonnet 4.6
**Task:** Khởi tạo context management system + sync với Phase 2 đã hoàn thành

### Đã làm
- Copy và install bộ file `.claude/*.md` từ context bundle
- Điều chỉnh các file không khớp với code thực tế:
  - `architecture.md`: sửa `next.config.ts` → `.mjs`, components/lib structure thực tế, react 18.3.1
  - `database-schema.md`: sửa migration history (001 tạo ALL tables, không phải split), confirm indexes
  - `known-issues.md`: mark RPT-001, RPT-002, ISS-001 là RESOLVED (Phase 2 đã merge)
  - `work-log.md`: thêm entry Phase 2
- Thêm `.claude/session/` vào `.gitignore`

### Quyết định kỹ thuật
- Đặt `CLAUDE.md` + `.claude/` trong `dmc-nextjs/` (project root) không phải workspace root
- Giữ nguyên behavioral `CLAUDE.md` tại DMCSOFTWARE root (khác file)

### Issues phát hiện
- Không phát hiện issue mới
- Confirmed: `hr_daily` table không tồn tại (đã ghi trong database-schema.md)

### Context files updated
- Tất cả files mới tạo lần đầu

### Status cuối phiên
- [x] Code committed? Y
- [ ] PR created? N (setup chore, push thẳng main)
- [x] Tests passing? N/A
- [x] Documentation updated? Y

### Next time resume
**Open items:**
1. DB-002: Thu hẹp RLS UPDATE policy trên table `data` (security)
2. SYS-001: Tạo staging Supabase project (CRITICAL — không có staging)
3. SYS-002: Đưa Apps Script vào repo (version control)
4. Verify groupBy=hour hoạt động đúng cho production-output và quality-result

---

## 2026-04-23 (Phase 2 — OEE trend + filterBy + groupBy=hour)
**Branch:** feature/phase2-oee-trend-overtime-shift → develop; feature/phase2-filterby-groupby-hour → develop
**Task:** Phase 2 refactor: OEE trend, overtime shift, ISO week fix, filterBy progress, groupBy=hour

### Đã làm
- Thêm ca_tang_ca (16:30–22:00) vào `fn_classify_shift` → migration 006
- ISO week fix: dùng `TO_CHAR(date, 'IYYY-"W"IW')` trong SQL, fallback JS
- OEE trend chart theo period (groupBy week/month)
- `filterBy=deadline|initialdate` cho production-progress API
- `groupBy=hour` cho production-output + quality-result API

### Issues resolved
- RPT-001: OEE trend ✅
- RPT-002: filterBy param ✅
- ISS-001: ISO week fix ✅

### Status cuối phiên
- [x] Code committed? Y (1862011, adc1533)
- [x] PR created? Y → merged vào develop
- [ ] Tests passing? Partially (unit tests, chưa có integration)

---

## 2026-04-22 (Phase 1 — Report dashboard + Admin + HR)
**Branch:** main
**Task:** Build production report dashboard, admin panel, HR coordination, CI workflow

### Đã làm
- Report dashboard 4 sections (progress, output, quality, OEE) + 2 view modes
- Admin panel user management
- HR coordination tab
- Supabase migrations 001-005
- GitHub Actions CI workflow (type-check + lint + build)
- Supabase SSR auth middleware

### Status cuối phiên
- [x] Code committed? Y (2c560ae, 8e1fb07)

---

## 2026-04-20 ~ 2026-04-21 (Foundation)
**Branch:** main
**Task:** Initial Next.js setup, downgrade React, fix SQL migration, stable version

### Đã làm
- Initial Next.js 16 + Supabase setup
- Downgrade React 19 → 18.3.1 (Tremor compatibility)
- Fix SQL migration column 'products' error
- Production data handling, date format, xưởng display

### Status cuối phiên
- [x] Code committed? Y (f3d0e55, 762cf23, bee436a, 8caf742)

<!-- Entries cũ hơn sẽ thêm bên dưới khi có -->
