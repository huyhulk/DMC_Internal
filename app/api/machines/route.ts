import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { canAccessWorkspace, getWorkspaceScopedFilter } from '@/lib/approval/workflow'
import { WORKSHOP_CODES } from '@/lib/reports/report-types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const location = req.nextUrl.searchParams.get('location') ?? ''
  const scope = getWorkspaceScopedFilter(user.role, user.workspace)
  if (!scope.unrestricted) {
    if (!location || location === 'ALL') {
      return NextResponse.json({ error: 'Workspace-scoped users must request a specific location' }, { status: 403 })
    }
    if (!canAccessWorkspace(user.role, user.workspace, location)) {
      return NextResponse.json({ error: 'Forbidden location' }, { status: 403 })
    }
  }
  if (location && location !== 'ALL' && !WORKSHOP_CODES.includes(location as typeof WORKSHOP_CODES[number])) {
    return NextResponse.json({ error: 'Invalid location' }, { status: 400 })
  }
  const supabase = await createClient()

  let query = supabase
    .from('machines')
    .select('machine_code, machine_name')
    .eq('machine_status', 'active')
    .not('machine_code', 'is', null)
    .order('machine_name')

  if (location && location !== 'ALL') {
    query = query.eq('machine_location', location)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
