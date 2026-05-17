// __tests__/module-config-actions.test.ts

// Mock Supabase
const mockUpsert = jest.fn().mockResolvedValue({ error: null })
const mockFrom = jest.fn().mockReturnValue({ upsert: mockUpsert })

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({ from: mockFrom }),
}))

jest.mock('@/modules/permissions/server', () => ({
  requireTabEdit: jest.fn(),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { updateModuleConfig, updateSubtabConfig } from '@/modules/config/module-config-actions'
import { requireTabEdit } from '@/modules/permissions/server'

const mockRequireTabEdit = requireTabEdit as jest.MockedFunction<typeof requireTabEdit>

const ADMIN_USER = { id: 'user-1', role: 'ADMIN' as const, username: 'admin', workspace: 'ALL', email: 'a@b.com' }

describe('updateModuleConfig', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns error when user is not authenticated', async () => {
    mockRequireTabEdit.mockResolvedValue(null)
    const result = await updateModuleConfig({
      module_key: 'production', label: 'SX', is_enabled: true, display_order: 1,
    })
    expect(result.error).toBe('Unauthorized')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('prevents disabling the admin module', async () => {
    mockRequireTabEdit.mockResolvedValue(ADMIN_USER)
    const result = await updateModuleConfig({
      module_key: 'admin', label: 'Hệ Thống', is_enabled: false, display_order: 6,
    })
    expect(result.error).toMatch(/tắt/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('calls upsert with correct data and returns empty object on success', async () => {
    mockRequireTabEdit.mockResolvedValue(ADMIN_USER)
    const result = await updateModuleConfig({
      module_key: 'production', label: 'Sản Xuất Mới', is_enabled: true, display_order: 1,
    })
    expect(result.error).toBeUndefined()
    expect(mockFrom).toHaveBeenCalledWith('module_configs')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ module_key: 'production', label: 'Sản Xuất Mới', is_enabled: true }),
      { onConflict: 'module_key' }
    )
  })

  it('returns DB error message when upsert fails', async () => {
    mockRequireTabEdit.mockResolvedValue(ADMIN_USER)
    mockUpsert.mockResolvedValueOnce({ error: { message: 'unique violation' } })
    const result = await updateModuleConfig({
      module_key: 'production', label: 'SX', is_enabled: true, display_order: 1,
    })
    expect(result.error).toBe('unique violation')
  })
})

describe('updateSubtabConfig', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns error when user is not authenticated', async () => {
    mockRequireTabEdit.mockResolvedValue(null)
    const result = await updateSubtabConfig({
      module_key: 'maintenance', subtab_key: 'drawings',
      label: 'Bản Vẽ', is_enabled: false, display_order: 3,
    })
    expect(result.error).toBe('Unauthorized')
  })

  it('calls upsert with correct args and returns empty on success', async () => {
    mockRequireTabEdit.mockResolvedValue(ADMIN_USER)
    const result = await updateSubtabConfig({
      module_key: 'maintenance', subtab_key: 'drawings',
      label: 'Bản Vẽ Kỹ Thuật', is_enabled: false, display_order: 3,
    })
    expect(result.error).toBeUndefined()
    expect(mockFrom).toHaveBeenCalledWith('module_subtab_configs')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        module_key: 'maintenance',
        subtab_key: 'drawings',
        is_enabled: false,
        label: 'Bản Vẽ Kỹ Thuật',
      }),
      { onConflict: 'module_key,subtab_key' }
    )
  })
})
