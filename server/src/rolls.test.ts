import { describe, expect, it } from 'vitest'
import { affixTarget, parseRollInput, rollStatus, slotQuality } from '../../shared/rolls.ts'
import type { GearSlot } from '../../shared/types.ts'

describe('parseRollInput', () => {
  it.each([
    ['1900', 1900],
    ['1,900', 1900],
    ['1 900', 1900],
    ['1 900', 1900],
    ['1,812.5', 1812.5],
    ['9.75', 9.75],
    ['9,75', 9.75],
    ['+15%', 15],
    ['x62.5 %', 62.5],
  ])('%s → %d', (input, expected) => expect(parseRollInput(input)).toBe(expected))

  it('refuse les saisies invalides', () => {
    expect(parseRollInput('')).toBeNull()
    expect(parseRollInput('abc')).toBeNull()
    expect(parseRollInput('1.2.3')).toBeNull()
  })
})

const affix = (key: string, text: string, target?: number | null) => ({ key, id: '1', text, greater: false, masterwork: false, target })
const slot = {
  key: 's',
  aspect: affix('s:aspect', 'Gain +45% Life', 45),
  affixes: [affix('s:a0', '+2,175 Maximum Life', 2175), affix('s:a1', '+15% Critical Strike Chance', 15)],
  tempered: [affix('s:t0', '+3,000 Armor')],
} as unknown as GearSlot

describe('qualité des objets', () => {
  it('repli sur le premier nombre du texte pour les anciens imports', () => {
    expect(affixTarget(slot.tempered[0])).toBe(3000)
    expect(affixTarget(affix('k', 'Sans nombre', null))).toBeNull()
  })

  it('classe les valeurs par rapport à la cible', () => {
    expect(rollStatus(1.05)).toBe('ok')
    expect(rollStatus(0.93)).toBe('close')
    expect(rollStatus(0.5)).toBe('low')
  })

  it('note un objet sur les affixes renseignés, plafonnés à 100 %', () => {
    expect(slotQuality(slot, {})).toBeNull()
    const q = slotQuality(slot, { 's:a0': 1740, 's:a1': 18, 's:t0': 3000 })!
    expect(q.measured).toBe(3)
    expect(q.score).toBeCloseTo((0.8 + 1 + 1) / 3)
    expect(q.weakest.map((w) => [w.affix.key, w.ratio])).toEqual([['s:a0', 0.8]])
  })
})
