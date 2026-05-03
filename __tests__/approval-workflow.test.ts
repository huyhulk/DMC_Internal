import {
  canApproveRequests,
  canApproveWorkspace,
  canAccessWorkspace,
  getAdministrationTabs,
  getMaintenanceScheduleFilter,
  getWorkspaceScopedFilter,
  normalizeWorkspaceToken,
  summarizeOvertimeParticipants,
} from '@/lib/approval/workflow'

describe('approval workflow helpers', () => {
  it('allows only admin and manager to approve requests', () => {
    expect(canApproveRequests('ADMIN')).toBe(true)
    expect(canApproveRequests('MANAGER')).toBe(true)
    expect(canApproveRequests('SUPERVISOR')).toBe(false)
    expect(canApproveRequests('USER')).toBe(false)
  })

  it('scopes workspace access without treating empty workspace as unrestricted', () => {
    expect(canAccessWorkspace('ADMIN', '', 'DMC1')).toBe(true)
    expect(canAccessWorkspace('MANAGER', 'ALL', 'DMC4')).toBe(true)
    expect(canAccessWorkspace('SUPERVISOR', 'DMC1,DMC5', 'DMC5')).toBe(true)
    expect(canAccessWorkspace('USER', '', 'DMC1')).toBe(false)
    expect(canAccessWorkspace('SUPERVISOR', null, 'DMC3')).toBe(false)
    expect(canAccessWorkspace('USER', 'DMC1', 'DMC3')).toBe(false)
  })

  it('requires approvers to have workspace access to the target request', () => {
    expect(canApproveWorkspace('ADMIN', '', 'DMC5')).toBe(true)
    expect(canApproveWorkspace('MANAGER', 'ALL', 'DMC4')).toBe(true)
    expect(canApproveWorkspace('MANAGER', 'DMC1,DMC3', 'DMC3')).toBe(true)
    expect(canApproveWorkspace('MANAGER', 'DMC1', 'DMC5')).toBe(false)
    expect(canApproveWorkspace('MANAGER', '', 'DMC1')).toBe(false)
    expect(canApproveWorkspace('SUPERVISOR', 'DMC1', 'DMC1')).toBe(false)
  })

  it('returns a DB filter for scoped workspaces without making managers global', () => {
    expect(getWorkspaceScopedFilter('ADMIN', '')).toEqual({ unrestricted: true, workspaces: [] })
    expect(getWorkspaceScopedFilter('MANAGER', 'ALL')).toEqual({ unrestricted: true, workspaces: [] })
    expect(getWorkspaceScopedFilter('MANAGER', 'DMC1,DMC3')).toEqual({ unrestricted: false, workspaces: ['DMC1', 'DMC3'] })
    expect(getWorkspaceScopedFilter('USER', '')).toEqual({ unrestricted: false, workspaces: [] })
  })

  it('defines the Administration and HR workspace as a top-level tab group', () => {
    expect(getAdministrationTabs()).toEqual([
      { key: 'overtime', label: 'Tăng ca' },
      { key: 'hr', label: 'Nhân sự' },
      { key: 'findings5s', label: '5S' },
      { key: 'iso', label: 'Quy trình ISO' },
    ])
  })

  it('normalizes factory and department workspace tokens', () => {
    expect(normalizeWorkspaceToken(' dmc3 ')).toBe('DMC3')
    expect(normalizeWorkspaceToken('pkt_sx')).toBe('PKT-SX')
    expect(normalizeWorkspaceToken('phòng điều phối')).toBe('Phòng điều phối')
    expect(normalizeWorkspaceToken('PHONG HC-NS')).toBe('Phòng HC-NS')
    expect(normalizeWorkspaceToken('phong kinh doanh')).toBe('Phòng Kinh Doanh')
  })

  it('summarizes overtime participants for approved records', () => {
    const summary = summarizeOvertimeParticipants([
      { employee_name: 'Nguyen Van A', hours: 2.5 },
      { employee_name: 'Tran Thi B', hours: 3 },
      { employee_name: '  ', hours: 4 },
    ])

    expect(summary).toEqual({ total_employees: 2, total_hours: 5.5 })
  })

  it('filters maintenance execution to approved schedules only', () => {
    expect(getMaintenanceScheduleFilter('execute')).toEqual({
      completion_status: 'pending',
      approval_status: 'approved',
    })
    expect(getMaintenanceScheduleFilter('plan')).toEqual({ approval_status: 'ALL' })
  })
})
