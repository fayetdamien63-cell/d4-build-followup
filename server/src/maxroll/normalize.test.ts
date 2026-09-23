import { describe, expect, it } from 'vitest'
import { variantKeys } from '../../../shared/progress.ts'
import { gameData, profile } from '../testFixtures.ts'
import { genericNodeName, Normalizer, rotateIndex } from './normalize.ts'

const { build, activeVariant } = new Normalizer(gameData).normalize(profile, 'https://maxroll.gg/d4/planner/test1234')
const [leveling, endgame] = build.variants

describe('Normalizer', () => {
  it('reprend les métadonnées et la variante active', () => {
    expect(build).toMatchObject({ name: 'Test Warlock', className: 'Warlock', season: '15', strengths: ['Fun'], weaknesses: ['Slow'] })
    expect(activeVariant).toBe(1)
    expect(leveling.hidden).toBe(true)
    expect(leveling.skillBar).toEqual([{ id: 'Warlock_Bolt', name: 'Bolt' }])
  })

  it('ne liste que les nouveautés à chaque étape de compétences', () => {
    const [step1, step2] = leveling.skillSteps
    expect(step1.nodes.map((n) => [n.name, n.rank])).toEqual([['Bolt', 1]])
    expect(step2.nodes.map((n) => [n.parent, n.name, n.rank, n.kind])).toEqual([
      [null, 'Bolt', 5, 'skill'],
      ['Bolt', 'Chain', 1, 'upgrade'],
    ])
  })

  it('rend les objets lisibles (unique, aspect, affixes, gemmes)', () => {
    const [helm, pants] = endgame.gear
    expect(helm).toMatchObject({ slotLabel: 'Casque', name: 'Crown of Tests', rarity: 'unique' })
    expect(helm.affixes.map((a) => a.text)).toEqual(['Skills deal 50%[x] damage.', '+2,000 Maximum Life'])
    expect(helm.affixes[1]).toMatchObject({ greater: true, masterwork: true })
    expect(helm.sockets).toEqual([{ key: 'v1:gear:4:socket:0', id: 'Gem_Ruby_07', name: 'Grand Ruby', kind: 'gem' }])

    expect(pants).toMatchObject({ slotLabel: 'Jambières', name: 'Aspect Overwhelming', baseType: 'Runic Leggings', rarity: 'legendary' })
    // Rang 7 stocké par Maxroll -> 80 + 6*2
    expect(pants.aspect?.text).toBe('Overwhelming : Deals 92%[x] increased damage.')
    expect(pants.affixes[0].text).toBe('+3,750 Cold Resistance')
    expect(pants.tempered[0].text).toBe('+500 Maximum Life')
  })

  it('reconnaît les pièces de set (nom fixe et nom du set)', () => {
    const charm = endgame.gear.find((g) => g.slot === '21')!
    expect(charm).toMatchObject({ slotLabel: 'Charme 1', name: 'Fer of the Nameless', baseType: 'Rite of the Nameless', rarity: 'set' })
  })

  it('calcule les nœuds de parangon ajoutés par étape', () => {
    const [s1, s2] = endgame.paragonSteps
    const grid = build.paragonGrids[s1.boards[0].gridId]
    expect(s1.boards[0].allocated).toEqual([4, 7])
    expect(s2.boards[0].added).toEqual([1])
    expect(s2.boards[0].glyph).toMatchObject({ name: 'Unbound', level: 21 })
    expect(grid.cells[4]).toMatchObject({ name: 'Dark Sign', rarity: 'rare' })
    expect(grid.cells[1]).toMatchObject({ name: '+Strength', rarity: 'normal' })
    expect(grid.cells[7]).toMatchObject({ rarity: 'start' })
  })

  it('produit des clés uniques et préfixées par variante', () => {
    const keys = variantKeys(build, endgame)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.every((k) => k.startsWith('v1:'))).toBe(true)
    expect(keys).toContain('v1:para:Board_A:4')
    expect(keys).toContain('v1:gear:14:aspect')
  })
})

describe('helpers', () => {
  it('rotateIndex tourne une grille carrée par quarts de tour', () => {
    // Grille 3x3 : la case (0,0) passe en (2,0) après un quart de tour horaire.
    expect(rotateIndex(0, 3, 1)).toBe(2)
    expect(rotateIndex(0, 3, 4)).toBe(0)
  })
  it('genericNodeName', () => {
    expect(genericNodeName('Generic_Normal_Int')).toBe('+Intelligence')
    expect(genericNodeName('Generic_Magic_HexDamage')).toBe('Hex Damage')
  })
})

describe('withImpliedKeys', () => {
  it('propage les rangs vers le bas en validant, vers le haut en invalidant', async () => {
    const { withImpliedKeys } = await import('../../../shared/progress.ts')
    const all = ['v0:skill:1@1', 'v0:skill:1@5', 'v0:skill:1@15', 'v0:skill:2@1']
    expect(withImpliedKeys(all, ['v0:skill:1@5'], true).sort()).toEqual(['v0:skill:1@1', 'v0:skill:1@5'])
    expect(withImpliedKeys(all, ['v0:skill:1@5'], false).sort()).toEqual(['v0:skill:1@15', 'v0:skill:1@5'])
  })
})

describe('describeVariant', () => {
  it('donne un libellé lisible à chaque clé', async () => {
    const { describeVariant } = await import('../../../shared/labels.ts')
    const labels = describeVariant(build, endgame)
    expect(labels.get('v1:gear:4')).toMatchObject({ label: 'Crown of Tests', category: 'gear', milestone: true })
    expect(labels.get('v1:gear:14:aspect')?.label).toMatch(/^Overwhelming/)
    expect(labels.get('v1:para:Board_A:4')).toMatchObject({ label: 'Dark Sign', context: 'Plateau Start' })
    // Le plateau de départ n'a pas de clé "débloqué".
    expect(labels.has('v1:board:Board_A')).toBe(false)
    expect([...labels.keys()].sort()).toEqual(variantKeys(build, endgame).sort())
  })
})
