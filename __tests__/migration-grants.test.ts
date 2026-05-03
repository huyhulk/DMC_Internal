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
})
