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
    expect(canApproveRequests('TEAM_LEADER')).toBe(false)
    expect(canApproveRequests('TEAM_LEADER')).toBe(false)
  })

  it('scopes workspace access without treating empty workspace as unrestricted', () => {
    expect(canAccessWorkspace('ADMIN', '', 'DMC1')).toBe(true)
    expect(canAccessWorkspace('MANAGER', 'ALL', 'DMC4')).toBe(true)
    expect(canAccessWorkspace('TEAM_LEADER', 'DMC1,DMC5', 'DMC5')).toBe(true)
    expect(canAccessWorkspace('TEAM_LEADER', '', 'DMC1')).toBe(false)
    expect(canAccessWorkspace('TEAM_LEADER', null, 'DMC3')).toBe(false)
    expect(canAccessWorkspace('TEAM_LEADER', 'DMC1', 'DMC3')).toBe(false)
  })

  it('requires approvers to have workspace access to the target request', () => {
    expect(canApproveWorkspace('ADMIN', '', 'DMC5')).toBe(true)
    expect(canApproveWorkspace('MANAGER', 'ALL', 'DMC4')).toBe(true)
    expect(canApproveWorkspace('MANAGER', 'DMC1,DMC3', 'DMC3')).toBe(true)
    expect(canApproveWorkspace('MANAGER', 'DMC1', 'DMC5')).toBe(false)
    expect(canApproveWorkspace('MANAGER', '', 'DMC1')).toBe(false)
    expect(canApproveWorkspace('TEAM_LEADER', 'DMC1', 'DMC1')).toBe(false)
  })

  it('returns a DB filter for scoped workspaces without making managers global', () => {
    expect(getWorkspaceScopedFilter('ADMIN', '')).toEqual({ unrestricted: true, workspaces: [] })
    expect(getWorkspaceScopedFilter('MANAGER', 'ALL')).toEqual({ unrestricted: true, workspaces: [] })
    expect(getWorkspaceScopedFilter('MANAGER', 'DMC1,DMC3')).toEqual({ unrestricted: false, workspaces: ['DMC1', 'DMC3'] })
    expect(getWorkspaceScopedFilter('TEAM_LEADER', '')).toEqual({ unrestricted: false, workspaces: [] })
  })

  it('defines the Administration and HR workspace as a top-level tab group', () => {
    expect(getAdministrationTabs()).toEqual([
      { key: 'overtime', label: 'Tăng ca' },
      { key: 'hr', label: 'Nhân sự' },
      { key: 'hr-performance', label: 'Hiệu suất NS' },
      { key: 'findings5s', label: '5S' },
      { key: 'iso', label: 'Quy trình ISO' },
    ])
  })

  it('normalizes factory and department workspace tokens', () => {
    expect(normalizeWorkspaceToken(' dmc3 ')).toBe('DMC3')
    expect(normalizeWorkspaceToken('dmc1_pk')).toBe('DMC1-PK')
    expect(normalizeWorkspaceToken('dmc1 pu')).toBe('DMC1-PU')
    expect(normalizeWorkspaceToken('pkt_sx')).toBe('PKT-SX')
    expect(normalizeWorkspaceToken('phòng điều phối')).toBe('DIEU-PHOI')
    expect(normalizeWorkspaceToken('dieu phoi')).toBe('DIEU-PHOI')
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
