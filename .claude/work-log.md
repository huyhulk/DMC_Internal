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

## 2026-04-29 (Phiên #9 — Staging audit & cleanup)
**Branch:** staging
**Claude model:** Sonnet 4.6
**Task:** Kiểm tra toàn bộ staging setup, fix issues, cập nhật context docs

### Đã làm
- **Audit staging**: Đọc toàn bộ 15 migrations, 3 workflow files, env setup, context docs
- **Fix `staging-ci.yml`**: Xóa bước pre-register migrations 001-006 — workaround này không còn cần thiết vì (1) staging DB đã có đủ 001-015 trong history, (2) migration 001 đã được fix đúng schema nên fresh staging DB cũng chạy `supabase db push` trực tiếp được. Workflow giờ chỉ có 1 bước: `supabase db push`.
- **Fix `staging_init.sql`**: Thêm deprecation notice — file này archived, không dùng trong CI nữa
- **Tạo `supabase/seed.sql`**: File empty đúng chuẩn để `config.toml` không báo lỗi khi chạy `supabase start` local
- **Update `database-schema.md`**: Bổ sung đầy đủ 25 tables + views + RPC từ migrations 007-015; cập nhật migration history table; phân biệt "staging only" vs "production applied"
- **Update `known-issues.md`**: SYS-001 → RESOLVED; DB-002 → RESOLVED; TD-002 → RESOLVED; xóa duplicate entries; ghi rõ còn cần tạo GitHub Environment production
- **Commit `PLAN_KPI_2026.md`**: File này untracked từ phiên trước, commit vào staging branch

### Quyết định kỹ thuật
- Pre-registration workaround (001-006) bị xóa khỏi staging-ci.yml — migration 001 đã đúng schema (phiên #8), workaround trở thành dead code và gây confusion
- `supabase db push` là idempotent: nếu staging DB đã có migration trong history thì skip, không chạy lại → safe cho cả fresh và existing DB
- `staging_init.sql` được giữ lại as archive (không xóa) để reference lịch sử setup

### Issues phát hiện
- `supabase/seed.sql` không tồn tại nhưng được reference trong `config.toml` `sql_paths = ["./seed.sql"]` → local `supabase db reset` sẽ fail → đã fix

### Files thay đổi
- `.github/workflows/staging-ci.yml`
- `supabase/staging-setup/staging_init.sql`
- `supabase/seed.sql` (tạo mới)
- `PLAN_KPI_2026.md` (commit lần đầu)

### Context files updated
- `.claude/database-schema.md`
- `.claude/known-issues.md`
- `.claude/work-log.md`

### Status cuối phiên
- [x] Code committed? Y
- [ ] PR created? N
- [x] Tests passing? N/A (no code logic changes)

### Next time resume
1. **GitHub Settings** — tạo Environment `production` với required reviewers (cho promote-to-prod.yml) — phải làm thủ công trên GitHub.com
2. **Verify `STAGING_DB_URL` secret** — đảm bảo là direct connection URL (port 5432, không phải 6543)
3. **Phase 3 KPI** — Bắt đầu build UI theo `PLAN_KPI_2026.md`: API routes + components cho KPI dashboard
4. **Promote staging → main** khi Phase 3 sẵn sàng (dùng promote-to-prod.yml với confirm='PRODUCTION')

---

## 2026-04-28 (Phiên #8 — Fix supabase db push hoàn toàn)
**Branch:** staging → commit `435f220`
**Claude model:** Sonnet 4.6
**Task:** Triệt để fix lỗi `supabase db push` SQLSTATE 42601

### Đã làm
- **Root cause analysis**: Xác định 3 lớp vấn đề liên tiếp:
  1. `staging-ci.yml` dùng long version format (`001_initial_schema`) nhưng CLI đọc filename prefix → version `001` → không match
  2. `supabase db query` dùng extended query protocol → không chạy được multi-statement SQL → `SQLSTATE 42601`
  3. `staging_init.sql` từ phiên #6 đã insert long format vào migration history → `supabase db push` báo "Remote migration versions not found in local migrations directory"
- **Fix staging DB migration history**: Xóa 6 long-format entries, insert lại 6 short-format entries (`001`, `002`, ...) bằng cách chạy từng statement riêng lẻ qua CLI
- **Fix `staging-ci.yml`**: Tách mỗi INSERT thành 1 file SQL riêng, dùng short version format
- **Fix `001_initial_schema.sql`**: Align với production schema thực tế (`data` lowercase + `"PCODE"` UPPERCASE, bỏ `deadlinetime`, đổi `quantity` TEXT → NUMERIC, `deadlinedate` DATE → TIMESTAMPTZ)
- **Test thành công**: `supabase db push` trả `Remote database is up to date.`

### Quyết định kỹ thuật
- Supabase CLI v2.x dùng extended query protocol cho cả `db query` và `db push` → multi-statement SQL luôn fail với SQLSTATE 42601
- Version format đúng: `001` (chỉ numeric prefix từ filename), không phải `001_initial_schema`
- Mỗi INSERT vào migration history phải là 1 statement riêng
- `STAGING_DB_URL` phải dùng direct connection URL (port 5432, host `db.*.supabase.co`)

### Issues phát hiện
- Không phát hiện issue mới

### Files thay đổi
- `.github/workflows/staging-ci.yml`
- `supabase/migrations/001_initial_schema.sql`

### Context files updated
- `.claude/work-log.md`

### Status cuối phiên
- [x] Code committed? Y — `435f220`
- [ ] PR created? N
- [x] Tests passing? `supabase db push` → "Remote database is up to date" ✅

### Next time resume
1. Update GitHub Secret `STAGING_DB_URL` → direct URL: `postgresql://postgres:[NEW_PASS]@db.vfzjweyzwjczrxphnvaa.supabase.co:5432/postgres`
2. Push `435f220` lên origin/staging để trigger CI và verify workflow chạy đúng
3. **DB-002** — Viết migration 007 thu hẹp RLS UPDATE policy trên `data`
4. GitHub Environment `production` — tạo trong Settings với required reviewers

---

## 2026-04-27 (Phiên #7 — CI lint fix, staging auth, migration repair)
**Branch:** staging → commit `048f537`
**Claude model:** Sonnet 4.6
**Task:** Fix GitHub Actions lint 404, fix staging login, fix supabase db push migration history

### Đã làm
- **CI Lint fix**: Phát hiện Next.js 16 đã xóa `next lint` command — CLI treat `lint` như project directory → lỗi "Invalid project directory". Fix: đổi script sang `eslint .` + tạo `eslint.config.mjs` (ESLint 9 flat config, bắt buộc với `eslint ^9.25.1`). Downgrade `react-hooks/set-state-in-effect` + `incompatible-library` sang warn (React Compiler rules không áp dụng cho React 18).
- **Staging login fix**: Debug phát hiện 3 vấn đề — email sai domain (`@test.local` vs `@dmc.local`), username sai (`sup-dmc1` vs `supervisor`), `identities = 0` (INSERT SQL thủ công không tạo `auth.identities`). Fix: xóa 4 users cũ, tạo lại đúng qua `admin.auth.admin.createUser()`. Verify 4/4 login OK.
- **Migration history repair**: `supabase db push` fail vì staging schema được tạo qua `staging_init.sql` (phiên #6) nhưng `supabase_migrations.schema_migrations` rỗng. Fix: insert 6 migration records trực tiếp qua SQL Editor. `supabase db push` local/sandbox vẫn fail DNS cho `db.*` hostname — cần chạy từ máy hoặc CI.

### Quyết định kỹ thuật
- `next lint` bị remove trong Next.js 16 → dùng `eslint .` trực tiếp
- React Compiler ESLint rules (set-state-in-effect) downgrade sang warn vì project dùng React 18, không phải React 19
- Tạo user Supabase Auth bắt buộc dùng `admin.auth.admin.createUser()`, không dùng INSERT SQL thủ công

### Issues phát hiện
- `db.PROJECT_REF.supabase.co` không resolve được từ local (có thể project staging bị paused hoặc Supabase free tier limit). REST API vẫn OK. Cần verify từ CI hoặc sau khi restore project.

### Files thay đổi
- `package.json` — `"lint": "next lint"` → `"lint": "eslint ."`
- `eslint.config.mjs` — tạo mới

### Context files updated
- `.claude/work-log.md`

### Status cuối phiên
- [x] Code committed? Y — `048f537`
- [ ] PR created? N
- [x] Tests passing? lint ✅ (0 errors, 14 warnings), type-check ✅

### Next time resume
1. Verify Vercel staging deploy có banner vàng không (https://dmc-pm-staging.vercel.app)
2. Test login staging trên browser thực tế (admin / Password123!)
3. **DB-002** — Viết migration 007 thu hẹp RLS UPDATE policy trên `data` (chỉ ADMIN/service_role)
4. Verify `supabase db push` sau khi restore staging project (nếu bị paused)
5. GitHub Environment `production` — tạo trong Settings với required reviewers (cho promote-to-prod.yml)

---

## 2026-04-26 (Phiên #6 — Staging environment setup)
**Branch:** staging → commit `442de08`
**Claude model:** Sonnet 4.6
**Task:** Setup staging environment đầy đủ (SYS-001, SYS-002)

### Đã làm
- **M1**: Xác nhận `npx supabase@2.95.3` dùng được (CLI không có trong PATH)
- **W1**: `.env.example` — xóa prod URL hardcoded, thêm `NEXT_PUBLIC_ENV` placeholder
- **W2**: `.gitignore` — xóa 2 dòng duplicate
- **M2a**: `supabase init` → tạo `supabase/config.toml` (project_id = dmc-production-manager)
- **M2b**: `supabase link` staging → BLOCKED (staging project thuộc org khác)
- **M4+M5**: Tạo `components/shared/environment-banner.tsx` + inject vào `app/layout.tsx`
- **M6+M7**: Update `ci.yml` trigger PR→staging; tạo `staging-ci.yml`
- **M8**: Tạo `promote-to-prod.yml` (workflow_dispatch, cần confirm='PRODUCTION')
- **M3**: Phát hiện schema drift (migration 001 tạo "DATA" uppercase nhưng production dùng `data` lowercase + UPPERCASE columns). Tạo `staging_init.sql` sạch dựa trên `database-schema.md`. Apply 40 statements lên staging DB thành công.
- **M9**: Tạo `seed_test.sql`, fix bug `CHAR()` → `CHR()`, apply thành công: 100 data records, 50 Production records

### Quyết định kỹ thuật
- Dùng Python script split SQL + `npx supabase db query -f file --db-url` để apply (CLI không hỗ trợ multi-statement, không có Docker cho db dump)
- Không dùng migration 001–006 cho staging vì schema drift — dùng `staging_init.sql` riêng
- Test users cần tạo qua Supabase Dashboard (auth.users cần service_role, không qua regular DB URL)

### Issues phát hiện
- Migration 001 trong repo có schema sai (drift với production). Cần tạo migration 007 để sync (DB-001 vẫn open)
- M2b (supabase link staging): staging project `vfzjweyzwjczrxphnvaa` thuộc org khác → cần invite account hiện tại

### Files thay đổi
- `.env.example`, `.gitignore`
- `app/layout.tsx`
- `components/shared/environment-banner.tsx`
- `supabase/config.toml`
- `supabase/staging-setup/staging_init.sql`
- `supabase/staging-setup/seed_test.sql`
- `.github/workflows/ci.yml`, `staging-ci.yml`, `promote-to-prod.yml`

### Status cuối phiên
- [x] Code committed? Y — `442de08`
- [x] Push? Y — `origin/staging`
- [ ] PR created? N (staging branch tự deploy Vercel)
- [x] Tests passing? type-check ✅

### Next time resume
1. **Verify Vercel staging deploy** — mở https://dmc-pm-staging.vercel.app xem banner vàng
2. **Tạo test users** — Supabase Dashboard staging → Authentication → Add user (4 users: admin/manager/supervisor/user @test.local, role + workspace set trong profiles table)
3. **M2b fix** — Invite current Supabase account vào org của staging project, rồi `npx supabase link --project-ref vfzjweyzwjczrxphnvaa`
4. **GitHub Environment** — tạo `production` environment trong GitHub Settings với required reviewers (cần cho promote-to-prod.yml)
5. **DB-002** — Thu hẹp RLS UPDATE policy trên `data` (viết migration 007)
6. **SYS-002** — Đưa Apps Script vào repo (apps-script/ folder)

---

## 2026-04-25 (Phiên #5 — UI refactor + bug fix TimePicker24)
**Branch:** main
**Claude model:** Sonnet 4.6 + Opus 4.7
**Task:** Di chuyển nút "Làm mới danh mục" vào header Section 1; fix bug TimePicker24 stale parent

### Đã làm
- **`components/production/production-tab.tsx`**: Chuyển nút "Làm mới danh mục" vào inline với `SectionLabel` của Section 1 qua prop `action` — luôn visible vì Section 1 là `shrink-0`; xóa `<div className="flex justify-end">` wrapper riêng; xóa `<SectionLabel>Sản phẩm & thời gian sản xuất</SectionLabel>` thừa ở Section 2; thêm optional prop `action?: React.ReactNode` vào `SectionLabel` component
- **`components/production/product-line-card.tsx`**: Fix bug `TimePicker24` — khi user chọn placeholder "HH" hoặc "MM" sau khi đã có giá trị, `onChange('')` được gọi để reset parent value; trước đây parent bị stale (vẫn giữ "07:30" trong khi UI hiển thị "HH:30")

### Root cause TimePicker24 bug
`handleH` và `handleM` chỉ gọi `onChange(h + ':' + m)` khi CẢ HAI h và m có giá trị. Nếu user clear về placeholder, `onChange` không được gọi → parent state bị stale → form submit gửi giờ cũ.

### Files thay đổi
- `components/production/production-tab.tsx`
- `components/production/product-line-card.tsx`

### Status cuối phiên
- [ ] Code committed? N
- [ ] PR created? N
- [x] Tests passing? type-check ✅

### Next time resume
- DB-002: Thu hẹp RLS UPDATE policy trên `data` (viết file migration 007, không chạy trực tiếp)
- Verify groupBy=hour cho output/quality API

---

## 2026-04-24 (Phiên #4 — Fix realnorm=0 + cache stale Norm)
**Branch:** main
**Claude model:** Sonnet 4.6
**Task:** Debug realnorm=0 trong Production data; fix cache stale danh sách sản phẩm

### Đã làm
- **`lib/actions/data.ts`**: thêm `revalidateNormsAction()` → gọi `revalidateTag('norms', {})` + `revalidateTag('materials', {})`
- **`hooks/use-production-data.ts`**: fix `updateLine` — khi `field === 'product'`, sau khi set `workforce = norm.nwforce`, nay cũng tính lại `realnorm` ngay nếu `poutput/starttime/endtime` đã có; thêm `refreshNorms()` function expose ra ngoài hook
- **`components/production/production-tab.tsx`**: thêm nút "Làm mới" (RefreshCw icon) cạnh section label "Sản phẩm & thời gian sản xuất"; click → revalidate cache + reload data

### Root cause realnorm = 0
`updateLine` có 2 khối if riêng biệt:
1. Khi `field === 'product'`: set `workforce` nhưng KHÔNG tính `realnorm`
2. Khi `field in ['poutput','starttime','endtime','workforce']`: mới tính `realnorm`

→ Nếu user chọn sản phẩm SAU khi đã nhập poutput/giờ, `realnorm` mãi = 0.
Fix: thêm `calcRealNorm` vào khối 1 ngay sau khi set `workforce`.

### Root cause cache stale
`getCachedNorms()` dùng `unstable_cache` TTL 300s, không có trigger invalidation khi Norm table cập nhật ngoài app.
Fix: thêm action `revalidateNormsAction` + nút "Làm mới" trên UI.

### Files thay đổi
- `lib/actions/data.ts`
- `hooks/use-production-data.ts`
- `components/production/production-tab.tsx`

### Status cuối phiên
- [ ] Code committed? N
- [ ] PR created? N
- [x] Tests passing? type-check ✅

### Next time resume
- DB-002: Thu hẹp RLS UPDATE policy trên `data` (security)
- Verify groupBy=hour cho output/quality API

---

## 2026-04-24 (Phiên #3 — Fix đổi mật khẩu + TimePicker 24h)
**Branch:** main
**Claude model:** Sonnet 4.6
**Task:** Debug & fix chức năng đổi mật khẩu; thay time input 12h → 24h

### Đã làm
- **`lib/actions/auth.ts`**: thêm `mapPasswordError()` map lỗi Supabase → tiếng Việt; thêm log chi tiết `userId` + `supabaseError`; xoá generic error message
- **`lib/validations/auth.ts`**: tăng min password 3 → 6 ký tự
- **`components/shared/change-password-dialog.tsx`**: đổi `onSubmit` từ `Promise<void>` → `Promise<string | null>`; error hiển thị inline trong dialog (không chỉ toast); reset field chỉ khi thành công; label nhắc "tối thiểu 6 ký tự"
- **`components/layout/dashboard-shell.tsx`**: `handleChangePassword` trả về `string | null` thay vì void; lỗi bubble về dialog thay vì toast
- **`components/production/product-line-card.tsx`**: thay `<input type="time">` bằng `TimePicker24` (2 select HH:MM, 24h, không phụ thuộc browser locale)

### Quyết định kỹ thuật
- TimePicker24 dùng 2 select thay vì input[type=time] để tránh 12h AM/PM trên Windows Chrome locale US
- Error password map sang tiếng Việt theo pattern của Supabase error messages
- Error hiển thị trong dialog inline (red box) thay vì chỉ toast ngoài — user thấy lỗi khi form vẫn còn mở

### Root cause của bug đổi mật khẩu
`changePasswordAction` catch đúng error từ Supabase nhưng return generic string "Không thể đổi mật khẩu" → không biết lỗi thật. Thêm vào đó dialog không nhận được error để hiển thị (onSubmit là `Promise<void>`).

### Files thay đổi
- `lib/actions/auth.ts`
- `lib/validations/auth.ts`
- `components/shared/change-password-dialog.tsx`
- `components/layout/dashboard-shell.tsx`
- `components/production/product-line-card.tsx`

### Status cuối phiên
- [ ] Code committed? N
- [ ] PR created? N
- [x] Tests passing? type-check ✅

### Next time resume
- DB-002: Thu hẹp RLS UPDATE policy trên `data` (security)
- SYS-001: Tạo staging Supabase project
- Verify groupBy=hour cho output/quality API hoạt động đúng

---

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
