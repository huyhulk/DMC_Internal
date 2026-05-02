# Codex Work Log

Purpose: keep enough state for another session to continue accurately after context loss, errors, or interruption.

Current status:
- Active continuation requested by user.
- Working tree on branch `staging` has existing uncommitted work from before this Codex session:
  - Modified: `.claude/work-log.md`, `lib/kpi/queries.ts`, `types/database.ts`
  - Deleted: old KPI component files under `components/kpi/kpi-*.tsx`
  - Untracked: `.claude/PLAN_DATA_ENTRY_DEFECTS.md`, `.claude/README.md`, `.claude/SNIPPETS_DEFECTS.md`, `.claude/launch.json`, `scripts/copy-production-to-staging.mjs`, `supabase/migrations/019_cleanup_overtime_hr.sql`

Working rules:
- Before code changes: note the goal, relevant files, and intended edits.
- During work: record important commands, findings, decisions, blockers, and test results.
- After work: record changed files, verification performed, remaining risks, and next steps.
- Do not record secrets from `.env.local` or other private files.

Latest entry:
- 2026-05-02: Created this work log.
- 2026-05-02: User asked to continue the current unfinished work. Inspected `git status`, `.claude/work-log.md`, `.claude/PLAN_DATA_ENTRY_DEFECTS.md`, `.claude/SNIPPETS_DEFECTS.md`, and diffs. Inferred active work is KPI/HR cleanup, not the older defects-entry plan:
  - `lib/kpi/queries.ts`: adds real SX-04/SX-05 calculations from `material_usage` and `findings_5s`; fixes SX-06 to sum `poutput` instead of `eoutput`.
  - `supabase/migrations/019_cleanup_overtime_hr.sql`: replaces `rpc_overtime_summary`, tightens `hr_daily` write policy, restores updated_at triggers, adds factory validation constraints as `NOT VALID`.
  - `types/database.ts`: changes `hr_daily.id` type from `number` to `string`.
  - Old KPI component files are deleted while newer PascalCase/nested KPI components exist.
  - `scripts/copy-production-to-staging.mjs` copies `data`, `Norm`, and `Production` from prod to staging using a prod service key from env and staging key from `.env.local`; do not run unless explicitly needed because it writes staging data.
  - Validation performed:
    - `npm run type-check` passed.
    - `npm run lint` passed.
    - First `npm test` and `npm run build` failed due stale/locked generated `.next` cache, not code.
    - Verified `.next` resolved to `C:\Users\trump\OneDrive\Desktop\DMCSOFTWARE\dmc-nextjs\.next`, no `node` process was running, removed generated `.next`.
    - Re-ran `npm test`: 4 suites / 83 tests passed.
    - Re-ran `npm run build`: Next.js production build passed.
  - Not done yet:
    - Did not apply `supabase/migrations/019_cleanup_overtime_hr.sql` to staging.
    - Did not run `scripts/copy-production-to-staging.mjs` because it writes staging data and needs explicit intent/credentials.
    - Did not stage/commit/push the existing working tree.
  - Next step: decide commit scope. Likely include `lib/kpi/queries.ts`, `types/database.ts`, `supabase/migrations/019_cleanup_overtime_hr.sql`, KPI component deletions if intentionally replaced, and work logs. Leave old `.claude` plan/snippet files and staging copy script uncommitted unless user wants them.
- 2026-05-02: User asked to continue. Current plan:
  - Review `lib/kpi/queries.ts`, migration 019, and KPI component deletions one more time.
  - Keep untracked old `.claude` plan/snippet files and `scripts/copy-production-to-staging.mjs` out of commit unless needed.
  - Stage only verified KPI/HR cleanup files and logs.
  - Commit locally, then decide push/apply migration based on available remote/workflow state.
- 2026-05-02: Staged selected files only:
  - `.claude/work-log.md`, `CODEX_WORKLOG.md`, `lib/kpi/queries.ts`, `types/database.ts`, `supabase/migrations/019_cleanup_overtime_hr.sql`
  - deleted old KPI files: `components/kpi/kpi-card.tsx`, `components/kpi/kpi-department-dashboard.tsx`, `components/kpi/kpi-matrix-table.tsx`, `components/kpi/kpi-radar-chart.tsx`
  - left untracked old plan/snippet/script files out of scope.
  - staged secret scan only matched the word `secrets` inside this work-log rule; no credential-like value found.
- 2026-05-02: Committed and pushed cleanup:
  - Commit `b855c64 fix(kpi): complete production KPI and HR cleanup`.
  - Pushed `staging` to `origin/staging`.
  - GitHub Actions `Staging CI` run `25253092701` passed:
    - Type Check, Lint & Build passed.
    - Apply Migrations to Staging DB passed, so migration 019 was applied through CI.
  - Remaining untracked/out-of-scope files: `.claude/PLAN_DATA_ENTRY_DEFECTS.md`, `.claude/README.md`, `.claude/SNIPPETS_DEFECTS.md`, `.claude/launch.json`, `scripts/copy-production-to-staging.mjs`.
  - Next useful check: smoke test staging KPI/overtime endpoints or UI.
- 2026-05-02: Post-push DB smoke on staging using `.env.local` service key without printing secrets:
  - Project host prefix: `vfzjweyzwjczrxphnvaa`.
  - `rpc_overtime_summary('monthly', '2026-05-02', NULL)` returned successfully with 0 rows.
  - `material_usage`, `findings_5s`, and `hr_daily` count queries succeeded; all currently have 0 rows.
  - This confirms schema/RPC availability, but not real KPI numbers because staging has no rows in these KPI/HR tables.
