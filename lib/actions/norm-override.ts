'use server'

import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireTabEdit } from '@/lib/permissions/server'
import logger from '@/lib/logger'

export type NormOverrideRow = {
  id: number
  keyword: string
  workshop: string | null
  target_products: string
  require_any: string[]
  priority: number
  note: string | null
}

export type NormOverrideInput = {
  keyword: string
  workshop: string | null
  target_products: string
  require_any: string[]
  priority: number
  note: string | null
}

async function requireNormOverrideAdmin(): Promise<{ ok: true } | { ok: false; message: string }> {
  const editor = await requireTabEdit('admin.norm-override')
  if (!editor) return { ok: false, message: 'Bạn không có quyền chỉnh sửa override định mức.' }
  if (editor.role !== 'ADMIN') return { ok: false, message: 'Chỉ ADMIN mới được chỉnh sửa override định mức.' }
  return { ok: true }
}

function sanitize(input: NormOverrideInput) {
  return {
    keyword: input.keyword.trim(),
    workshop: input.workshop && input.workshop.trim() ? input.workshop.trim() : null,
    target_products: input.target_products.trim(),
    require_any: (input.require_any ?? []).map((marker) => marker.trim()).filter(Boolean),
    priority: Number.isFinite(input.priority) ? Math.trunc(input.priority) : 0,
    note: input.note && input.note.trim() ? input.note.trim() : null,
  }
}

export async function listNormOverridesAction(): Promise<{ data: NormOverrideRow[]; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: 'Chưa đăng nhập' }

    const { data, error } = await supabase
      .from('norm_override')
      .select('id,keyword,workshop,target_products,require_any,priority,note')
      .order('priority', { ascending: false })
      .order('keyword', { ascending: true })

    if (error) return { data: [], error: error.message }
    return { data: (data ?? []) as NormOverrideRow[] }
  } catch (err) {
    return { data: [], error: String(err) }
  }
}

export async function createNormOverrideAction(input: NormOverrideInput): Promise<{ success: boolean; message: string }> {
  const guard = await requireNormOverrideAdmin()
  if (!guard.ok) return { success: false, message: guard.message }

  const row = sanitize(input)
  if (!row.keyword || !row.target_products) {
    return { success: false, message: 'Từ khóa và Định mức đích là bắt buộc.' }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.from('norm_override').insert(row)
    if (error) return { success: false, message: error.message }
    revalidateTag('norms', {})
    logger.info({ keyword: row.keyword, target: row.target_products }, 'norm_override created')
    return { success: true, message: 'Đã thêm override định mức.' }
  } catch (err) {
    return { success: false, message: String(err) }
  }
}

export async function updateNormOverrideAction(id: number, input: NormOverrideInput): Promise<{ success: boolean; message: string }> {
  const guard = await requireNormOverrideAdmin()
  if (!guard.ok) return { success: false, message: guard.message }

  const row = sanitize(input)
  if (!row.keyword || !row.target_products) {
    return { success: false, message: 'Từ khóa và Định mức đích là bắt buộc.' }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('norm_override')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { success: false, message: error.message }
    revalidateTag('norms', {})
    logger.info({ id, keyword: row.keyword }, 'norm_override updated')
    return { success: true, message: 'Đã cập nhật override định mức.' }
  } catch (err) {
    return { success: false, message: String(err) }
  }
}

export async function deleteNormOverrideAction(id: number): Promise<{ success: boolean; message: string }> {
  const guard = await requireNormOverrideAdmin()
  if (!guard.ok) return { success: false, message: guard.message }

  try {
    const supabase = await createClient()
    const { error } = await supabase.from('norm_override').delete().eq('id', id)
    if (error) return { success: false, message: error.message }
    revalidateTag('norms', {})
    logger.info({ id }, 'norm_override deleted')
    return { success: true, message: 'Đã xóa override định mức.' }
  } catch (err) {
    return { success: false, message: String(err) }
  }
}
