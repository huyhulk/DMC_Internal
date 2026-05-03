export type ApprovalNotificationSource = 'overtime' | 'maintenance'
export type ApprovalNotificationAccent = 'blue' | 'amber'

export type PendingOvertimeApprovalRow = {
  id: string
  workshop: string
  pcode: string | null
  customer: string | null
  total_employees: number
  total_hours: number
  ot_date: string
  created_at: string
}

export type PendingMaintenanceApprovalRow = {
  id: string
  workshop: string
  machine_code: string
  machine_name: string | null
  maintenance_type: string | null
  scheduled_date: string
  created_at: string
}

export type ApprovalNotificationItem = {
  id: string
  source: ApprovalNotificationSource
  iconLabel: string
  title: string
  description: string
  href: string
  accent: ApprovalNotificationAccent
  createdAt: string
  targetDate: string
}

export type ApprovalNotificationSection = {
  key: ApprovalNotificationSource
  label: string
  count: number
  href: string
  items: ApprovalNotificationItem[]
}

export type ApprovalNotificationFeed = {
  totalCount: number
  sections: ApprovalNotificationSection[]
}

const OVERTIME_HREF = '/dashboard/administration?sub=overtime'
const MAINTENANCE_HREF = '/dashboard/maintenance?sub=schedule'

function compact(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim()).filter(Boolean).join(' · ')
}

function formatHours(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : '0.0'
}

function toOvertimeNotification(row: PendingOvertimeApprovalRow): ApprovalNotificationItem {
  return {
    id: `overtime:${row.id}`,
    source: 'overtime',
    iconLabel: 'OT',
    title: `${row.workshop} gửi yêu cầu tăng ca`,
    description: compact([
      row.pcode || 'Không gắn LSX',
      row.customer,
      `${row.total_employees} người`,
      `${formatHours(row.total_hours)} giờ`,
    ]),
    href: OVERTIME_HREF,
    accent: 'blue',
    createdAt: row.created_at,
    targetDate: row.ot_date,
  }
}

function toMaintenanceNotification(row: PendingMaintenanceApprovalRow): ApprovalNotificationItem {
  const machineLabel = row.machine_name?.trim() || row.machine_code

  return {
    id: `maintenance:${row.id}`,
    source: 'maintenance',
    iconLabel: 'BT',
    title: `Lịch bảo trì ${machineLabel}`,
    description: compact([
      row.workshop,
      row.machine_code,
      row.maintenance_type || 'Bảo trì',
    ]),
    href: MAINTENANCE_HREF,
    accent: 'amber',
    createdAt: row.created_at,
    targetDate: row.scheduled_date,
  }
}

export function buildApprovalNotificationFeed(input: {
  overtime: PendingOvertimeApprovalRow[]
  schedules: PendingMaintenanceApprovalRow[]
  overtimeTotal?: number
  scheduleTotal?: number
  itemLimit?: number
}): ApprovalNotificationFeed {
  const itemLimit = input.itemLimit ?? 5
  const overtimeItems = input.overtime.map(toOvertimeNotification)
  const maintenanceItems = input.schedules.map(toMaintenanceNotification)
  const overtimeCount = input.overtimeTotal ?? input.overtime.length
  const scheduleCount = input.scheduleTotal ?? input.schedules.length

  return {
    totalCount: overtimeCount + scheduleCount,
    sections: [
      {
        key: 'overtime',
        label: 'Tăng ca chờ duyệt',
        count: overtimeCount,
        href: OVERTIME_HREF,
        items: overtimeItems.slice(0, itemLimit),
      },
      {
        key: 'maintenance',
        label: 'Bảo trì chờ duyệt',
        count: scheduleCount,
        href: MAINTENANCE_HREF,
        items: maintenanceItems.slice(0, itemLimit),
      },
    ],
  }
}
