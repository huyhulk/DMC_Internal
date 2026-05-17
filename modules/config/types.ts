import type { z } from 'zod'

export type ConfigStatus = 'draft' | 'pending' | 'active' | 'archived'
export type ConfigFormat = 'json' | 'yaml'
export type ConfigKind = string & {}

export interface ConfigScope {
  tenant?: string
  factory?: string
  workshop?: string
  role?: string
  userId?: string
}

export interface ConfigPack<TPayload = unknown> {
  id: string
  kind: ConfigKind
  schemaVersion: number
  version: number
  status: ConfigStatus
  scope: ConfigScope
  updatedAt: string
  updatedBy?: string
  changelog?: string
  payload: TPayload
}

export interface ConfigDefinition<TPayload> {
  kind: ConfigKind
  schemaVersion: number
  description: string
  schema: z.ZodType<TPayload>
}

export interface LoadedConfigPack<TPayload = unknown> {
  filePath: string
  format: ConfigFormat
  pack: ConfigPack<TPayload>
}

