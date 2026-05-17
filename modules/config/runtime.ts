import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import type { z } from 'zod'
import { ConfigPackEnvelopeSchema } from '@/modules/config/schemas'
import type { ConfigFormat, ConfigKind, ConfigPack, ConfigScope, LoadedConfigPack } from '@/modules/config/types'

const YAML_EXTENSIONS = new Set(['.yaml', '.yml'])

export function getConfigFormat(filePath: string): ConfigFormat {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.json') return 'json'
  if (YAML_EXTENSIONS.has(ext)) return 'yaml'
  throw new Error(`Unsupported config format: ${filePath}`)
}

export function parseConfigSource(source: string, format: ConfigFormat): unknown {
  return format === 'json' ? JSON.parse(source) : parseYaml(source)
}

export async function loadConfigFile<TSchema extends z.ZodTypeAny>(
  filePath: string,
  payloadSchema: TSchema
): Promise<LoadedConfigPack<z.output<TSchema>>> {
  const format = getConfigFormat(filePath)
  const raw = await fs.readFile(filePath, 'utf8')
  const parsed = parseConfigSource(raw, format)
  const envelope = ConfigPackEnvelopeSchema.parse(parsed)

  return {
    filePath,
    format,
    pack: {
      ...envelope,
      payload: payloadSchema.parse(envelope.payload),
    },
  }
}

export async function tryLoadConfigFile<TSchema extends z.ZodTypeAny>(
  filePath: string,
  payloadSchema: TSchema,
  fallback: ConfigPack<z.output<TSchema>>
): Promise<ConfigPack<z.output<TSchema>>> {
  try {
    const loaded = await loadConfigFile(filePath, payloadSchema)
    return loaded.pack
  } catch {
    return fallback
  }
}

export function scopeSpecificity(scope: ConfigScope): number {
  return Object.values(scope).filter(Boolean).length
}

export function scopeMatches(candidate: ConfigScope, requested: ConfigScope): boolean {
  return Object.entries(candidate).every(([key, value]) => {
    if (!value) return true
    return requested[key as keyof ConfigScope] === value
  })
}

export function pickActiveConfig<TPayload>(
  packs: Array<ConfigPack<TPayload>>,
  kind: ConfigKind,
  requestedScope: ConfigScope = {}
): ConfigPack<TPayload> | null {
  return packs
    .filter((pack) => pack.kind === kind && pack.status === 'active')
    .filter((pack) => scopeMatches(pack.scope, requestedScope))
    .sort((left, right) => {
      const byScope = scopeSpecificity(right.scope) - scopeSpecificity(left.scope)
      if (byScope !== 0) return byScope
      return right.version - left.version
    })[0] ?? null
}
