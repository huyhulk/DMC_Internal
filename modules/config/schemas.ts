import { z } from 'zod'

export const ConfigScopeSchema = z.object({
  tenant: z.string().optional(),
  factory: z.string().optional(),
  workshop: z.string().optional(),
  role: z.string().optional(),
  userId: z.string().optional(),
}).default({})

export const ConfigPackEnvelopeSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  version: z.number().int().positive(),
  status: z.enum(['draft', 'pending', 'active', 'archived']),
  scope: ConfigScopeSchema,
  updatedAt: z.string().min(1),
  updatedBy: z.string().optional(),
  changelog: z.string().optional(),
  payload: z.unknown(),
})

export const ProductionOrderVisibilityPolicySchema = z.object({
  requireNormMatchWhenNormsExist: z.boolean().default(true),
  showAllWhenNormsMissing: z.boolean().default(true),
  excludedWorkshopCodes: z.array(z.string().min(1)).default([]),
})

export const ConfigFilterOperatorSchema = z.enum([
  'eq',
  'neq',
  'in',
  'notIn',
  'between',
  'gte',
  'lte',
  'contains',
  'inUserWorkspaces',
])

export const ConfigFilterSchema = z.object({
  field: z.string().min(1),
  op: ConfigFilterOperatorSchema,
  value: z.unknown().optional(),
  valueFrom: z.string().optional(),
  valueTo: z.string().optional(),
  valueSource: z.string().optional(),
})

export const ProductionOrderViewSchema = z.object({
  entity: z.literal('production.order'),
  key: z.string().min(1),
  title: z.string().min(1),
  columns: z.array(z.string().min(1)).min(1),
  filters: z.array(ConfigFilterSchema).default([]),
  sort: z.array(z.object({
    field: z.string().min(1),
    dir: z.enum(['asc', 'desc']),
  })).default([]),
  ui: z.object({
    showQuickSearch: z.boolean().default(true),
    showWorkshopFilter: z.boolean().default(true),
  }).default({}),
})

export type ProductionOrderVisibilityPolicy = z.infer<typeof ProductionOrderVisibilityPolicySchema>
export type ProductionOrderViewConfig = z.infer<typeof ProductionOrderViewSchema>

