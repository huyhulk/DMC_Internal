import { unstable_cache } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { normalizeWorkshop, workshopCode } from '@/lib/utils'
import type { NormItem } from '@/types'
import type { Database } from '@/types/database'

type NormRow = Database['public']['Tables']['Norm']['Row']
type MaterialRow = Database['public']['Tables']['Material']['Row']

// Direct admin client (no cookies) used only for cached, public read-only data
function getAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Norm data: changes rarely → cache 5 minutes, tag for manual revalidation
export const getCachedNorms = unstable_cache(
  async (): Promise<NormItem[]> => {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('Norm')
      .select('products,norm,nwforce,workshop,pspeed')
    return ((data ?? []) as Pick<NormRow, 'products' | 'norm' | 'nwforce' | 'workshop' | 'pspeed'>[]).map((n) => ({
      products: n.products,
      norm: n.norm ?? 0,
      nwforce: n.nwforce ?? 0,
      workshop: normalizeWorkshop(n.workshop ?? ''),
      pspeed: n.pspeed ?? 0,
    }))
  },
  ['norms-v1'],
  { revalidate: 300, tags: ['norms'] }
)

// Material data: changes rarely → cache 5 minutes
export const getCachedMaterials = unstable_cache(
  async (): Promise<Array<{ product: string; material: string }>> => {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('Material')
      .select('product,material')
    return ((data ?? []) as Pick<MaterialRow, 'product' | 'material'>[]).map((m) => ({
      product: m.product,
      material: m.material,
    }))
  },
  ['materials-v1'],
  { revalidate: 300, tags: ['materials'] }
)

// Norm lookup map: product+workshop → norm info (derived from cached norms)
export const getCachedNormMap = unstable_cache(
  async (): Promise<Map<string, { norm: number; pspeed: number }>> => {
    const norms = await getCachedNorms()
    return new Map(
      norms.map((n) => [`${n.products}|||${workshopCode(n.workshop)}`, { norm: n.norm, pspeed: n.pspeed }])
    )
  },
  ['norm-map-v1'],
  { revalidate: 300, tags: ['norms'] }
)
