import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { loadConfigFile, pickActiveConfig } from '@/modules/config/runtime'
import { ProductionOrderVisibilityPolicySchema } from '@/modules/config/schemas'
import type { ConfigPack } from '@/modules/config/types'

describe('config runtime', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dmc-config-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('loads and validates JSON config packs', async () => {
    const file = join(dir, 'policy.json')
    writeFileSync(file, JSON.stringify({
      id: 'policy-json',
      kind: 'production.order.visibility',
      schemaVersion: 1,
      version: 1,
      status: 'active',
      scope: {},
      updatedAt: '2026-05-17T00:00:00+07:00',
      payload: {
        requireNormMatchWhenNormsExist: true,
        showAllWhenNormsMissing: false,
        excludedWorkshopCodes: ['DMC5'],
      },
    }), 'utf8')

    const loaded = await loadConfigFile(file, ProductionOrderVisibilityPolicySchema)

    expect(loaded.format).toBe('json')
    expect(loaded.pack.payload.showAllWhenNormsMissing).toBe(false)
    expect(loaded.pack.payload.excludedWorkshopCodes).toEqual(['DMC5'])
  })

  it('loads and validates YAML config packs', async () => {
    const file = join(dir, 'policy.yaml')
    writeFileSync(file, `
id: policy-yaml
kind: production.order.visibility
schemaVersion: 1
version: 2
status: active
scope:
  factory: DMC1
updatedAt: "2026-05-17T00:00:00+07:00"
payload:
  requireNormMatchWhenNormsExist: false
  showAllWhenNormsMissing: true
  excludedWorkshopCodes: []
`, 'utf8')

    const loaded = await loadConfigFile(file, ProductionOrderVisibilityPolicySchema)

    expect(loaded.format).toBe('yaml')
    expect(loaded.pack.scope.factory).toBe('DMC1')
    expect(loaded.pack.payload.requireNormMatchWhenNormsExist).toBe(false)
  })

  it('picks the most specific active config for a requested scope', () => {
    const globalPack: ConfigPack<{ label: string }> = {
      id: 'global',
      kind: 'demo',
      schemaVersion: 1,
      version: 1,
      status: 'active',
      scope: {},
      updatedAt: '2026-05-17T00:00:00+07:00',
      payload: { label: 'global' },
    }
    const factoryPack: ConfigPack<{ label: string }> = {
      ...globalPack,
      id: 'factory',
      version: 2,
      scope: { factory: 'DMC1' },
      payload: { label: 'factory' },
    }

    expect(pickActiveConfig([globalPack, factoryPack], 'demo', { factory: 'DMC1' })?.payload.label).toBe('factory')
    expect(pickActiveConfig([globalPack, factoryPack], 'demo', { factory: 'DMC3' })?.payload.label).toBe('global')
  })
})

