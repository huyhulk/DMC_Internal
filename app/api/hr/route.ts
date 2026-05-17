import { NextRequest, NextResponse } from 'next/server'
import { ensureDefaultHRDailyRows, getHRData } from '@/modules/hr/actions'
import { getSessionUser } from '@/modules/auth/actions'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date') ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }
  try {
    await ensureDefaultHRDailyRows(date, user)
    const data = await getHRData(date, user)
    return NextResponse.json({
      success: true,
      employees: data.employees,
      dailyData: data.dailyData,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
