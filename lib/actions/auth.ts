'use server'

import { cache } from 'react'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { createClient as createSSRClient } from '@/lib/supabase/server'
import { loginSchema, changePasswordSchema } from '@/lib/validations/auth'
import logger from '@/lib/logger'
import type { SessionUser, UserRole } from '@/types'

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

  const profile = profileData as any as { username: string; role: UserRole; workspace: string }

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
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) {
    logger.warn({ supabaseError: error.message }, 'Logout signOut reported an error')
  }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  return fetchSessionUser()
}

function mapPasswordError(msg: string): string {
  if (msg.includes('same password') || msg.includes('different from the old')) {
    return 'Mật khẩu mới phải khác mật khẩu cũ'
  }
  if (msg.includes('at least') || msg.includes('too short') || msg.includes('characters')) {
    return 'Mật khẩu mới quá ngắn (yêu cầu tối thiểu của hệ thống)'
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Quá nhiều yêu cầu, vui lòng thử lại sau vài phút'
  }
  if (msg.includes('service_role') || msg.includes('invalid key') || msg.includes('JWT')) {
    return 'Lỗi cấu hình server, vui lòng liên hệ admin'
  }
  return `Lỗi hệ thống: ${msg}`
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại' }

  // Verify old password
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: oldPassword,
  })
  if (verifyErr) {
    logger.warn({ userId: user.id, supabaseError: verifyErr.message }, 'changePassword: wrong old password')
    return { error: 'Mật khẩu cũ không đúng!' }
  }

  // Use admin API — avoids AuthSessionMissingError after signInWithPassword in same Server Action
  const { error: updateErr } = await getAdminClient().auth.admin.updateUserById(user.id, {
    password: newPassword,
  })

  if (updateErr) {
    logger.error({ userId: user.id, supabaseError: updateErr.message }, 'changePassword: admin updateUserById failed')
    return { error: mapPasswordError(updateErr.message) }
  }

  logger.info({ userId: user.id }, 'changePassword: success')
  return { success: true }
}
