import { describe, expect, it } from 'vitest'
import type { Build } from '../../shared/types.ts'
import { buildFarmPlan } from './farm.ts'
import { parseLootTable } from './maxroll/loot.ts'
import { Normalizer } from './maxroll/normalize.ts'
import { gameData, lootHtml, profile } from './testFixtures.ts'

const loot = parseLootTable(lootHtml)

describe('parseLootTable', () => {
  it('extrait les sources, leurs infos et leurs objets', () => {
    expect(loot.updatedAt).toBe('September 22, 2026')
    expect(loot.sources.map((s) => [s.name, s.kind])).toEqual([
      ['General Unique Pool', 'pool'],
      ['Lord Test', 'boss'],
      ['Rune Drops', 'runes'],
    ])
    const boss = loot.sources[1]
    expect(boss).toMatchObject({
      key: '1x Lair Key',
      activity: 'Complete Helltide',
      element: 'Fire',
      requirement: 'Requires Torment 1 or higher.',
      location: "The Test Lair is located near 'Kyovashad'",
      description: null,
    })
    expect(boss.items).toEqual([
      { id: 99, name: 'Lair Key' },
      { id: 10, name: 'Crown of Tests' },
    ])
    expect(loot.sources[0].description).toBe('These Uniques can drop from any boss.')
  })
})

describe('buildFarmPlan', () => {
  const { build: raw } = new Normalizer(gameData).normalize(profile, 'x')
  const build = { ...raw, id: 1, importedAt: '' } as Build

  it('range chaque objet chez sa source dédiée, avec les alternatives', () => {
    const plan = buildFarmPlan(build, 1, loot, gameData)
    const boss = plan.sources.find((s) => s.name === 'Lord Test')!
    expect(boss.targets).toEqual([
      { key: 'v1:gear:4', name: 'Crown of Tests', slotLabel: 'Casque', rarity: 'unique', alsoIn: ['General Unique Pool'] },
    ])
    // La rune est trouvée par son nom (l'ID de la page diffère de celui des données de jeu).
    expect(plan.sources.find((s) => s.kind === 'runes')?.targets.map((t) => t.name)).toEqual(['Rune Igni'])
    // Le pool général n'est pas une source principale quand un boss dédié existe.
    expect(plan.sources.some((s) => s.kind === 'pool')).toBe(false)
    expect(plan.unmatched).toEqual([])
  })

  it('signale les uniques sans source connue', () => {
    const plan = buildFarmPlan(build, 1, { ...loot, sources: [] }, gameData)
    expect(plan.unmatched.map((t) => t.name)).toEqual(['Crown of Tests', 'Rune Igni'])
  })
})
