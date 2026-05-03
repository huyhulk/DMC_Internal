const mockSignOut = jest.fn()
const mockCreateSSRClient = jest.fn()
const mockRevalidatePath = jest.fn()
const mockLoggerWarn = jest.fn()

jest.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

jest.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateSSRClient,
}))

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: mockLoggerWarn,
  },
}))

import { logoutAction } from '@/lib/actions/auth'

describe('auth actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSignOut.mockResolvedValue({ error: null })
    mockCreateSSRClient.mockResolvedValue({
      auth: {
        signOut: mockSignOut,
      },
    })
  })

  it('logs out by clearing the local session and returning to the client', async () => {
    await expect(logoutAction()).resolves.toEqual({ success: true })

    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('does not block logout navigation when Supabase signOut reports an error', async () => {
    mockSignOut.mockResolvedValueOnce({ error: { message: 'network timeout' } })

    await expect(logoutAction()).resolves.toEqual({ success: true })

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      { supabaseError: 'network timeout' },
      'Logout signOut reported an error'
    )
    expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout')
  })
})
