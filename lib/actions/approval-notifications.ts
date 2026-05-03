'use server'

import { createClient } from '@/lib/supabase/server'
import logger from '@/lib/logger'
import { canApproveRequests, getWorkspaceScopedFilter } from '@/lib/approval/workflow'
import {
  buildApprovalNotificationFeed,
  type ApprovalNotificationFeed,
  type PendingMaintenanceApprovalRow,
  type PendingOvertimeApprovalRow,
} from '@/lib/approval/notifications'

type ActionResult<T = undefined> = { success: boolean; message: string; data?: T }

const NOTIFICATION_SAMPLE_LIMIT = 5

function emptyFeed(): ApprovalNotificationFeed {
  return buildApprovalNotificationFeed({ overtime: [], schedules: [] })
}

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null, supabase }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role,workspace')
    .eq('id', user.id)
    .single()

  return {
    user,
    profile: profileData as { role: string; workspace: string } | null,
    supabase,
  }
}

export async function listApprovalNotificationsAction(): Promise<ActionResult<ApprovalNotificationFeed>> {
  try {
    const { user, profile, supabase } = await requireAuth()
    if (!user || !profile) return { success: false, message: 'Chưa đăng nhập', data: emptyFeed() }
    if (!canApproveRequests(profile.role)) return { success: true, message: '', data: emptyFeed() }

    const scope = getWorkspaceScopedFilter(profile.role, profile.workspace)
    if (!scope.unrestricted && scope.workspaces.length === 0) {
      return { success: true, message: '', data: emptyFeed() }
    }

    let overtimeQuery = supabase
        .from('overtime_requests')
        .select('id,workshop,pcode,customer,total_employees,total_hours,ot_date,created_at', { count: 'exact' })
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(NOTIFICATION_SAMPLE_LIMIT)
    let scheduleQuery = supabase
        .from('maintenance_schedule')
        .select('id,workshop,machine_code,machine_name,maintenance_type,scheduled_date,created_at', { count: 'exact' })
        .eq('approval_status', 'pending')
        .is('actual_date', null)
        .order('created_at', { ascending: false })
        .limit(NOTIFICATION_SAMPLE_LIMIT)

    if (!scope.unrestricted) {
      overtimeQuery = overtimeQuery.in('workshop', scope.workspaces)
      scheduleQuery = scheduleQuery.in('workshop', scope.workspaces)
    }

    const [overtimeResult, scheduleResult] = await Promise.all([overtimeQuery, scheduleQuery])

    if (overtimeResult.error) {
      logger.error({ error: overtimeResult.error.message }, 'listApprovalNotificationsAction overtime query failed')
      return { success: false, message: overtimeResult.error.message, data: emptyFeed() }
    }
    if (scheduleResult.error) {
      logger.error({ error: scheduleResult.error.message }, 'listApprovalNotificationsAction schedule query failed')
      return { success: false, message: scheduleResult.error.message, data: emptyFeed() }
    }

    return {
      success: true,
      message: '',
      data: buildApprovalNotificationFeed({
        overtime: (overtimeResult.data ?? []) as PendingOvertimeApprovalRow[],
        schedules: (scheduleResult.data ?? []) as PendingMaintenanceApprovalRow[],
        overtimeTotal: overtimeResult.count ?? 0,
        scheduleTotal: scheduleResult.count ?? 0,
        itemLimit: NOTIFICATION_SAMPLE_LIMIT,
      }),
    }
  } catch (err) {
    logger.error({ err }, 'listApprovalNotificationsAction error')
    return { success: false, message: String(err), data: emptyFeed() }
  }
}
