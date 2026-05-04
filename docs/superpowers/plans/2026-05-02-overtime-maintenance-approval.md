# Overtime Maintenance Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add request-and-approval workflows for overtime and maintenance schedules so KPI calculations only use approved/fixed data.

**Architecture:** Overtime requests are staged in `overtime_requests` and copied into existing `overtime_records` only when an admin or manager approves. Maintenance schedules keep using `maintenance_schedule`, with `approval_status` controlling whether a plan can be executed. Workspace scope remains on `profiles.workspace`, expanded to factory and department tokens.

**Tech Stack:** Next.js App Router, Server Actions, Supabase PostgreSQL/RLS/RPC, React Hook Form, Jest, TypeScript.

---

### Task 1: Approval Helpers And Admin Workspace Selection

**Files:**
- Create: `lib/approval/workflow.ts`
- Modify: `lib/actions/admin.ts`
- Modify: `components/admin/user-management.tsx`
- Test: `__tests__/approval-workflow.test.ts`

- [x] **Step 1: Write helper tests**

Run: `npm test -- --runTestsByPath __tests__/approval-workflow.test.ts`
Expected while incomplete: missing helper/module failures.

- [x] **Step 2: Implement helper functions**

Add workspace normalization, approval-role checks, overtime participant summary, and maintenance schedule filter helpers.

- [x] **Step 3: Wire admin workspace UI**

Use fixed checkbox options for `ALL`, four factories, and four departments. Normalize/validate workspace values in admin actions before saving.

### Task 2: Database Approval Migration

**Files:**
- Create: `supabase/migrations/020_overtime_requests_maintenance_approval.sql`
- Modify: `types/database.ts`

- [x] **Step 1: Create request tables**

Add `overtime_requests` and `overtime_request_participants`, indexes, RLS, and update triggers.

- [x] **Step 2: Add maintenance approval status**

Add `approval_status`, approval metadata, and backfill existing schedules as approved.

- [x] **Step 3: Add review RPC**

Create `rpc_review_overtime_request` to atomically approve/reject and copy approved requests into `overtime_records` plus `overtime_participants`.

### Task 3: Overtime Actions And UI

**Files:**
- Create: `lib/validations/overtime.ts`
- Create: `lib/actions/overtime.ts`
- Create: `components/administration/administration-shell.tsx`
- Create: `components/administration/overtime-tab.tsx`
- Create: `app/(dashboard)/dashboard/administration/page.tsx`
- Modify: `components/layout/dashboard-shell.tsx`
- Modify: `types/index.ts`

- [x] **Step 1: Keep type-check red until navigation is wired**

Run: `npm run type-check`
Expected while incomplete: `administration` missing from `TAB_CONFIG`.

- [x] **Step 2: Add Administration route and nav**

Add top-level route `/dashboard/administration`, shell tabs, and dashboard nav item.

- [x] **Step 3: Add overtime request UI**

Add request form, filters, list, approval/rejection controls, and role-based button visibility.

### Task 4: Maintenance Approval Integration

**Files:**
- Modify: `lib/actions/maintenance.ts`
- Modify: `components/maintenance/schedule-tab.tsx`
- Modify: `lib/validations/maintenance.ts` if status types need expansion

- [x] **Step 1: Make new schedules pending**

Set `requested_by` and leave default `approval_status = pending` for single and bulk create.

- [x] **Step 2: Add review action**

Add admin/manager action to approve or reject schedule plans.

- [x] **Step 3: Filter execution to approved schedules**

Use `getMaintenanceScheduleFilter('execute')` so completion only sees approved pending schedules.

### Task 5: Verification

**Files:**
- Modify: `CODEX_WORKLOG.md`
- Modify: `.claude/work-log.md`

- [x] **Step 1: Run focused tests**

Run: `npm test -- --runTestsByPath __tests__/approval-workflow.test.ts __tests__/maintenance-workflow.test.ts`
Expected: all listed tests pass.

- [x] **Step 2: Run full local verification**

Run: `npm run type-check`, `npm run lint`, `npm test`, and `npm run build`.
Expected: all commands exit 0.

- [x] **Step 3: Update work logs**

Record changed files, verification results, blockers, and next steps without secrets.
