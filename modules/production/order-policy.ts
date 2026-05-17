import path from 'node:path'
import { tryLoadConfigFile } from '@/modules/config/runtime'
import { ProductionOrderVisibilityPolicySchema, type ProductionOrderVisibilityPolicy } from '@/modules/config/schemas'
import type { ConfigPack } from '@/modules/config/types'
import { isWorkspaceAllowed, normalizeWorkshop, workshopCode } from '@/lib/utils'

const VISIBILITY_KIND = 'production.order.visibility'
const VISIBILITY_CONFIG_PATH = path.join(process.cwd(), 'modules/config/packs/production.order-visibility.json')

const DEFAULT_VISIBILITY_POLICY: ConfigPack<ProductionOrderVisibilityPolicy> = {
  id: 'production.order-visibility.fallback',
  kind: VISIBILITY_KIND,
  schemaVersion: 1,
  version: 1,
  status: 'active',
  scope: {},
  updatedAt: '2026-05-17T00:00:00+07:00',
  updatedBy: 'system',
  payload: {
    requireNormMatchWhenNormsExist: true,
    showAllWhenNormsMissing: true,
    excludedWorkshopCodes: [],
  },
}

export async function getProductionOrderVisibilityPolicy(): Promise<ProductionOrderVisibilityPolicy> {
  const pack = await tryLoadConfigFile(
    VISIBILITY_CONFIG_PATH,
    ProductionOrderVisibilityPolicySchema,
    DEFAULT_VISIBILITY_POLICY
  )
  return pack.payload
}

export function shouldIncludeProductionOrderRow(params: {
  rawWorkshop: string | null | undefined
  role: string
  userWorkspaces: string[]
  validWorkshopCodes: Set<string>
  hasNormData: boolean
  policy: ProductionOrderVisibilityPolicy
}): boolean {
  const workshop = normalizeWorkshop(params.rawWorkshop ?? '')
  const code = workshopCode(workshop)
  if (!isWorkspaceAllowed(workshop, params.role, params.userWorkspaces)) return false
  if (params.policy.excludedWorkshopCodes.includes(code)) return false
  if (!params.hasNormData) return params.policy.showAllWhenNormsMissing
  return params.policy.requireNormMatchWhenNormsExist ? params.validWorkshopCodes.has(code) : true
}

