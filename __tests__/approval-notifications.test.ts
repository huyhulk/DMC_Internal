import { buildApprovalNotificationFeed } from '@/lib/approval/notifications'

describe('approval notification feed', () => {
  it('builds grouped notifications for pending overtime and maintenance approvals', () => {
    const feed = buildApprovalNotificationFeed({
      overtime: [
        {
          id: 'ot-1',
          workshop: 'DMC3',
          pcode: 'LSX03/26-01125',
          customer: 'Minh Long',
          total_employees: 4,
          total_hours: 12,
          ot_date: '2026-05-03',
          created_at: '2026-05-03T08:00:00+07:00',
        },
      ],
      schedules: [
        {
          id: 'schedule-1',
          workshop: 'DMC1',
          machine_code: 'M-02',
          machine_name: 'Máy cán tôn',
          maintenance_type: 'weekly',
          scheduled_date: '2026-05-04',
          created_at: '2026-05-03T07:30:00+07:00',
        },
      ],
    })

    expect(feed.totalCount).toBe(2)
    expect(feed.sections.map((section) => ({
      key: section.key,
      label: section.label,
      count: section.count,
      href: section.href,
    }))).toEqual([
      {
        key: 'overtime',
        label: 'Tăng ca chờ duyệt',
        count: 1,
        href: '/dashboard/administration?sub=overtime&view=approvals',
      },
      {
        key: 'maintenance',
        label: 'Bảo trì chờ duyệt',
        count: 1,
        href: '/dashboard/maintenance?sub=schedule',
      },
    ])
    expect(feed.sections[0].items[0]).toMatchObject({
      id: 'overtime:ot-1',
      source: 'overtime',
      iconLabel: 'OT',
      title: 'DMC3 gửi yêu cầu tăng ca',
      description: 'LSX03/26-01125 · Minh Long · 4 người · 12.0 giờ',
      href: '/dashboard/administration?sub=overtime&view=approvals',
      accent: 'blue',
    })
    expect(feed.sections[1].items[0]).toMatchObject({
      id: 'maintenance:schedule-1',
      source: 'maintenance',
      iconLabel: 'BT',
      title: 'Lịch bảo trì Máy cán tôn',
      description: 'DMC1 · M-02 · weekly',
      href: '/dashboard/maintenance?sub=schedule',
      accent: 'amber',
    })
  })

  it('keeps total count while limiting visible items per section', () => {
    const feed = buildApprovalNotificationFeed({
      itemLimit: 1,
      overtime: [
        {
          id: 'ot-1',
          workshop: 'DMC1',
          pcode: null,
          customer: null,
          total_employees: 2,
          total_hours: 5,
          ot_date: '2026-05-03',
          created_at: '2026-05-03T08:00:00+07:00',
        },
        {
          id: 'ot-2',
          workshop: 'DMC3',
          pcode: null,
          customer: null,
          total_employees: 1,
          total_hours: 2,
          ot_date: '2026-05-03',
          created_at: '2026-05-03T08:05:00+07:00',
        },
      ],
      schedules: [],
    })

    expect(feed.totalCount).toBe(2)
    expect(feed.sections[0].count).toBe(2)
    expect(feed.sections[0].items).toHaveLength(1)
  })

  it('uses explicit total counts when the query returns a limited sample', () => {
    const feed = buildApprovalNotificationFeed({
      overtimeTotal: 12,
      scheduleTotal: 3,
      overtime: [
        {
          id: 'ot-1',
          workshop: 'DMC1',
          pcode: null,
          customer: null,
          total_employees: 2,
          total_hours: 5,
          ot_date: '2026-05-03',
          created_at: '2026-05-03T08:00:00+07:00',
        },
      ],
      schedules: [],
    })

    expect(feed.totalCount).toBe(15)
    expect(feed.sections[0].count).toBe(12)
    expect(feed.sections[1].count).toBe(3)
  })
})
