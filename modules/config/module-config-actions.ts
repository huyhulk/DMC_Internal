'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireTabEdit } from '@/modules/permissions/server'

const UpdateModuleConfigSchema = z.object({
  module_key:    z.string().min(1),
  label:         z.string().min(1).max(50),
  is_enabled:    z.boolean(),
  display_order: z.number().int().min(0).max(99),
})

const UpdateSubtabConfigSchema = z.object({
  module_key:    z.string().min(1),
  subtab_key:    z.string().min(1),
  label:         z.string().min(1).max(50),
  is_enabled:    z.boolean(),
  display_order: z.number().int().min(0).max(99),
})

export async function updateModuleConfig(
  input: z.infer<typeof UpdateModuleConfigSchema>
): Promise<{ error?: string }> {
  const user = await requireTabEdit('admin')
  if (!user) return { error: 'Unauthorized' }

  if (input.module_key === 'admin' && !input.is_enabled) {
    return { error: 'Không thể tắt module Hệ Thống' }
  }

  const parsed = UpdateModuleConfigSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('module_configs')
    .upsert(
      {
        module_key:    parsed.data.module_key,
        label:         parsed.data.label,
        is_enabled:    parsed.data.is_enabled,
        display_order: parsed.data.display_order,
        updated_by:    user.id,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: 'module_key' }
    )

  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
  return {}
}

export async function updateSubtabConfig(
  input: z.infer<typeof UpdateSubtabConfigSchema>
): Promise<{ error?: string }> {
  const user = await requireTabEdit('admin')
  if (!user) return { error: 'Unauthorized' }

  const parsed = UpdateSubtabConfigSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('module_subtab_configs')
    .upsert(
      {
        module_key:    parsed.data.module_key,
        subtab_key:    parsed.data.subtab_key,
        label:         parsed.data.label,
        is_enabled:    parsed.data.is_enabled,
        display_order: parsed.data.display_order,
      },
      { onConflict: 'module_key,subtab_key' }
    )

  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
  return {}
}
