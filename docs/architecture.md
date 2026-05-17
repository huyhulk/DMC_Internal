# DMC Modular Monolith Architecture

This project is organized as a modular monolith. Next.js routes stay in `app/`, UI stays in `components/`, and domain/application logic lives behind module contracts in `modules/`.

## Folder Strategy

```txt
app/                    Next.js routes and route handlers
components/             UI components; import domain behavior from modules
hooks/                  Client hooks, kept as thin adapters
lib/                    Infrastructure only: db, logger, supabase, shared utilities
modules/                Domain and application module boundary
  admin/                Admin user-management and KPI settings actions
  approval/             Approval workflow, scoped workspace rules, notifications
  auth/                 Auth actions and auth validation
  config/               Dynamic configuration runtime, schemas, versioned config packs
  coordination/         Coordination actions, daily reports, validation
  core/                 Module registry and cross-module metadata
  defects/              Defect actions and validation
  hr/                   HR actions and workflow calculations
  kpi/                  KPI queries, types, constants, formatting
  maintenance/          Maintenance actions, validation, workflow helpers
  navigation/           Dashboard navigation contracts
  overtime/             Overtime actions, validation, workflow helpers
  permissions/          Tab permissions and permission server helpers
  production/           Production actions, policies, status, workflow, validation
  reports/              Report query services, report types, OEE calculator
supabase/               Database migrations and local Supabase config
types/                  Shared TypeScript data contracts
```

## Module Rule

New domain logic must be added under `modules/<domain>/...`. `lib/` is reserved for shared infrastructure that is not owned by a business domain:

- `lib/db`
- `lib/logger`
- `lib/supabase`
- `lib/shifts.ts`
- `lib/utils.ts`

Do not add new business workflow, validation, server action, report query, KPI logic, production logic, maintenance logic, HR logic, or coordination logic under `lib/`.

## Config Spine

Config packs live in `modules/config/packs`. They use a versioned envelope:

```json
{
  "id": "production.order-visibility.global",
  "kind": "production.order.visibility",
  "schemaVersion": 1,
  "version": 1,
  "status": "active",
  "scope": {},
  "updatedAt": "2026-05-17T00:00:00+07:00",
  "payload": {}
}
```

Runtime config is loaded and validated by `modules/config/runtime.ts`. JSON and YAML are supported. Production order visibility is now controlled by `modules/config/packs/production.order-visibility.json` and consumed by `modules/production/order-policy.ts`.

## Import Rule

Application code should import domain behavior from `@/modules/...`. Import from `@/lib/...` only for infrastructure concerns such as Supabase clients, logging, shared date/math utilities, and database cache helpers.
