'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { loginSchema, changePasswordSchema } from '@/lib/validations/auth'
import { getUserWorkspaces } from '@/lib/utils'
import logger from '@/lib/logger'
import type { SessionUser } from '@/types'

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

  const supabase = await createClient()
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
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profileData } = await supabase
    .from('profiles')
    .select('username, role, workspace')
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

  const { newPassword } = parsed.data

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) {
    logger.error({ error: error.message }, 'Change password failed')
    return { error: 'Không thể đổi mật khẩu. Vui lòng thử lại.' }
  }

  return { success: true }
}

export async function createUserAction(params: {
  username: string
  password: string
  role: 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'USER'
  workspace: string
}) {
  const { username, password, role, workspace } = params
  const email = `${username.toLowerCase()}@dmc.local`

  const supabase = await createServiceClient()
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, role, workspace },
  })

  if (error) {
    logger.error({ error: error.message }, 'Create user failed')
    return { error: error.message }
  }

  return { success: true, userId: data.user.id }
}
