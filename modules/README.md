# Modules

This directory is the canonical home for domain and application logic.

Use `@/modules/<domain>/...` for:

- server actions
- business workflows
- validation schemas
- report and KPI query services
- domain-specific types and constants
- module-level configuration policies

Use `@/lib/...` only for shared infrastructure such as Supabase clients, logging, database cache helpers, and cross-domain utilities.

