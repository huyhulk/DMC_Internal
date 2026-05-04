import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

describe('database migration grants', () => {
  it('grants authenticated access to overtime request tables', () => {
    const migrationPath = join(
      process.cwd(),
      'supabase',
      'migrations',
      '021_grant_overtime_request_access.sql'
    )

    expect(existsSync(migrationPath)).toBe(true)

    const sql = readFileSync(migrationPath, 'utf8')
      .replace(/\s+/g, ' ')
      .toLowerCase()

    expect(sql).toContain(
      'grant select, insert, update, delete on table public.overtime_requests to authenticated'
    )
    expect(sql).toContain(
      'grant select, insert on table public.overtime_request_participants to authenticated'
    )
  })

  it('hardens staging profile, HR, overtime, and maintenance policies', () => {
    const migrationPath = join(
      process.cwd(),
      'supabase',
      'migrations',
      '022_staging_security_scope_hardening.sql'
    )

    expect(existsSync(migrationPath)).toBe(true)

    const sql = readFileSync(migrationPath, 'utf8')
      .replace(/\s+/g, ' ')
      .toLowerCase()

    expect(sql).toContain('drop policy if exists "profiles_update_own" on public.profiles')
    expect(sql).toContain('public.normalize_workshop(trim(ws)) = overtime_requests.workshop')
    expect(sql).toContain('public.normalize_workshop(trim(ws)) = maintenance_schedule.workshop')
    expect(sql).toContain('public.normalize_workshop(trim(ws)) = human_resource.factory')
    expect(sql).toContain('public.normalize_workshop(trim(ws)) = hr_daily.factory')
    expect(sql).toContain('reviewer cannot access overtime request workshop')
  })
})
