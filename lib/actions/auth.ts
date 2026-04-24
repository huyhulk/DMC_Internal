'use server'

import { cache } from 'react'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { createClient as createSSRClient } from '@/lib/supabase/server'
import { loginSchema, changePasswordSchema } from '@/lib/validations/auth'
import logger from '@/lib/logger'
import type { SessionUser } from '@/types'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Deduplicate session fetch within the same request (layout + page both call this)
const fetchSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profileData } = await supabase
    .from('profiles')
    .select('username,role,workspace')
    .eq('id', user.id)
    .single()

  if (!profileData) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = profileData as any as { username: string; role: 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'USER'; workspace: string }

  return {
    id: user.id,
    username: profile.username,
    role: profile.role,
    workspace: profile.workspace ?? '',
    email: user.email ?? '',
  }
})

export async function loginAction(formData: FormData) {
  const raw = {
    username: formData.get('username') as string,
    password: formData.get('password') as string,
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  const { username, password } = parsed.data
  const email = `${username.toLowerCase()}@dmc.local`

  const supabase = await createSSRClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    logger.warn({ username }, 'Login failed')
    return { error: 'Sai tên đăng nhập hoặc mật khẩu!' }
  }

  logger.info({ username, userId: data.user.id }, 'Login success')
  revalidatePath('/', 'layout')
  redirect('/dashboard/production')
}

export async function logoutAction() {
  const supabase = await createSSRClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function getSessionUser(): Promise<SessionUser | null> {
  return fetchSessionUser()
}

export async function changePasswordAction(formData: FormData) {
  const raw = {
    oldPassword: formData.get('oldPassword') as string,
    newPassword: formData.get('newPassword') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  }

  const parsed = changePasswordSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  const { oldPassword, newPassword } = parsed.data

  const supabase = await createSSRClient()

  // Get current user from session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Phiên đăng nhập hết hạn' }

  // Verify old password — signInWithPassword returns error if credentials are wrong
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: oldPassword,
  })
  if (verifyErr) return { error: 'Mật khẩu cũ không đúng!' }

  // Use admin API to update password — avoids AuthSessionMissingError that occurs
  // when calling auth.updateUser() after signInWithPassword() in the same Server Action
  const { error } = await getAdminClient().auth.admin.updateUserById(user.id, {
    password: newPassword,
  })

  if (error) {
    logger.error({ error: error.message }, 'Change password failed')
    return { error: 'Không thể đổi mật khẩu. Vui lòng thử lại.' }
  }

  return { success: true }
}

