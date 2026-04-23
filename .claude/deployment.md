# Deployment — DMC Production Manager

## 🌐 Environments

| Env | Branch | URL | Supabase Project |
|-----|--------|-----|------------------|
| **Production** | `main` | TBD | `hzuyucyxyohppxfwresq` |
| **Staging** | ❌ Chưa có | - | - |
| **Preview** | any PR | Vercel preview URL | → production (risk cao, xem SYS-001) |

## 🔑 Environment Variables

### Required (production)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://hzuyucyxyohppxfwresq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...   # Public, safe for client
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...        # Server-only, NEVER in client code

# App metadata
NEXT_PUBLIC_APP_NAME=DMC Production Manager
NEXT_PUBLIC_APP_URL=https://...
```

### Where set
- **Local dev:** `.env.local` (gitignored)
- **Vercel:** Project Settings → Environment Variables
- **GitHub Actions:** Secrets (cho CI tests)

### ⚠️ Rules
1. `SUPABASE_SERVICE_ROLE_KEY` KHÔNG BAO GIỜ xuất hiện trong `NEXT_PUBLIC_*` var
2. `SUPABASE_SERVICE_ROLE_KEY` chỉ dùng trong:
   - Server Actions
   - API routes
   - Server Components (có thể)
   - Admin scripts (migration, seed)
3. Rotate keys mỗi 6 tháng
4. Nếu leak → rotate NGAY trong Supabase Dashboard → Project Settings → API

---

## 🚀 Deploy Flow

### Feature deployment
```
1. Tạo branch từ main
   git checkout main && git pull
   git checkout -b feat/ten-feature

2. Code + test local
   npm run dev
   npm run type-check
   npm run lint
   npm test

3. Push
   git push -u origin feat/ten-feature

4. Auto Vercel preview deploy
   → Preview URL xuất hiện trong PR comment

5. Create PR → main
   → CI chạy: type-check + lint + build

6. User review + approve → merge

7. Vercel auto-deploy production từ main
```

### Database migration deployment

**⚠️ CRITICAL:** Hiện tại chưa có staging → quy trình tạm thời có risk:

```
1. Local test migration
   supabase db reset  (nếu có local DB Docker)

2. Tạo migration file
   supabase migration new ten_migration
   # Edit file trong supabase/migrations/

3. Review kỹ migration SQL
   - Check syntax
   - Check backward compatibility
   - Check side effects (DROP, ALTER type...)

4. Test DRY RUN trên Supabase SQL Editor (copy-paste SQL)
   - Chạy trong transaction: BEGIN; ... ROLLBACK;

5. User approve

6. Apply production:
   supabase db push --project-ref hzuyucyxyohppxfwresq
   # HOẶC qua Supabase Dashboard → SQL Editor

7. Verify post-migration:
   - Check column exists
   - Run RPC
   - Query sample data
   - Check app không bị break

8. Commit migration file + update database-schema.md + push

9. Append entry vào work-log.md
```

**⚠️ Rule tối thượng:** KHÔNG EDIT migration file đã apply production.
Muốn sửa → tạo migration mới override.

---

## 📦 CI/CD (GitHub Actions)

### File: `.github/workflows/ci.yml`

Trigger:
- Push to `main` / `develop`
- PR to `main`

Jobs:
- ✅ type-check (`tsc --noEmit`)
- ✅ lint (`eslint`)
- ✅ build (`next build`)
- ❌ unit test (chưa có — cần thêm)
- ❌ E2E test (chưa có)

### Thêm test vào CI (khi có)
```yaml
- name: Run unit tests
  run: npm test
- name: Run E2E tests
  run: npm run test:e2e
```

---

## 🔄 Rollback

### App rollback (Vercel)
1. Vercel Dashboard → Deployments
2. Tìm deployment previous hoạt động OK
3. Click "..." → "Promote to Production"
4. Kiểm tra app

**Note:** Rollback app KHÔNG rollback DB schema. Nếu migration mới gây lỗi, cần rollback cả DB.

### Database rollback

**KHÔNG sửa migration cũ.** Luôn tạo migration mới đảo ngược:

```sql
-- Ví dụ: Nếu migration 007 thêm column bị lỗi
-- Tạo migration 008_revert_column.sql:

BEGIN;

ALTER TABLE "data" DROP COLUMN IF EXISTS "NEW_COLUMN";

COMMIT;
```

Nếu cần rollback data (không chỉ schema):
- Supabase có PITR (Point-In-Time Recovery) nếu enabled
- Hoặc restore từ daily backup
- **Hỏi user trước khi restore** — có thể mất data mới

---

## 🗄️ Google Apps Script Deployment

Apps Script KHÔNG trong repo (xem SYS-002). Quy trình update hiện tại:

```
1. Mở Apps Script editor (script.google.com)
2. Edit code
3. Test bằng menu "🧪 Test insert 1 dòng mẫu"
4. Nếu OK → deploy:
   - Ctrl+S save
   - Trigger tự chạy 5 phút/lần
5. Monitor Executions tab xem log
```

**Cần làm (SYS-002):**
- Setup `clasp` để version control
- Commit code Apps Script vào `scripts/apps-script/`
- Deploy qua `clasp push`

---

## 📊 Monitoring

### Vercel
- Dashboard → Analytics → Errors + Performance
- Log streaming cho runtime errors

### Supabase
- Dashboard → Logs → API Logs (query slow/error)
- Dashboard → Database → Database Logs
- Dashboard → Auth → Log

### Apps Script
- script.google.com → Executions tab
- Filter by: failure, date range

### Lưu ý
- ❌ Chưa có Sentry/error tracking
- ❌ Chưa có uptime monitoring (UptimeRobot, Pingdom)
- ❌ Chưa có alert khi DB down / Apps Script fail

---

## 🔐 Secrets Management

### Local
```bash
# .env.local (gitignored)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Vercel
Settings → Environment Variables → add per env (Production/Preview/Development)

### GitHub Actions
Settings → Secrets → Actions → add secret

### Apps Script
```
PropertiesService.getScriptProperties()
  .setProperty("SUPABASE_URL", "...");
```

**Menu `⚙️ Cài đặt Supabase` trong Apps Script đã set sẵn** → không cần hardcode.

---

## ✅ Pre-deploy checklist

Trước khi merge vào `main`:

- [ ] Code review passed
- [ ] CI green (type-check + lint + build)
- [ ] Test local OK
- [ ] Đã update `.claude/*.md` nếu có thay đổi schema/architecture
- [ ] Commit message rõ ràng theo convention
- [ ] Không có secret leak (`git diff | grep -iE "(key|secret|token)="`)
- [ ] Database migration (nếu có) đã test trên SQL Editor
- [ ] Breaking change đã document trong CHANGELOG.md (nếu có)
- [ ] User approve PR

---

## 📞 Emergency Contacts

Khi có sự cố production:
1. **Kiểm tra Vercel Status:** https://www.vercel-status.com/
2. **Kiểm tra Supabase Status:** https://status.supabase.com/
3. **Rollback ngay nếu cần** (Vercel → Promote previous deployment)
4. **Thông báo team + user** qua channel nội bộ
5. **Post-mortem** — document vào `known-issues.md`
