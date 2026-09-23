import { describe, expect, it } from 'vitest'
import { evalExpr, prettifyId, renderTemplate, resolveConditionals } from './text.ts'

describe('renderTemplate', () => {
  it('formate les pourcentages et les signes', () => {
    expect(renderTemplate('+[{value}*100|1%|] Critical Strike Chance', { value: 0.15 })).toBe('+15% Critical Strike Chance')
    expect(renderTemplate('Gain {c_random}[Affix_Value_1|%+|]{/c} Life', { Affix_Value_1: 45 })).toBe('Gain +45% Life')
    expect(renderTemplate('deals [Affix_Value_1|x%|] damage', { Affix_Value_1: 92 })).toBe('deals 92%[x] damage')
  })

  it('substitue les variables hors crochets', () => {
    expect(renderTemplate('+[{value2}||] {value1} Resistance', { value1: 'Cold', value2: 3750 })).toBe('+3,750 Cold Resistance')
  })

  it('garde la branche par défaut des conditions, même imbriquées', () => {
    const tpl = '{if:IsMythic}{c_mythic}{/if}Gain {if:IsMythic}{c_number}{else}{c_random}{/if}[Affix_Value_1|%|]{/c} damage.{if:IsMythic}{/c_mythic}{/if}'
    expect(renderTemplate(tpl, { Affix_Value_1: 10 })).toBe('Gain 10% damage.')
    expect(resolveConditionals('a{if:X}b{if:Y}c{/if}d{else}e{/if}f')).toBe('aef')
    expect(resolveConditionals('a{if:X}b{else}c{/if}', () => true)).toBe('ab')
  })

  it('gère pluriels, icônes et valeurs inconnues', () => {
    expect(renderTemplate('+[{value}||] Maximum Evade |4Charge:Charges;', { value: 3 })).toBe('+3 Maximum Evade Charges')
    expect(renderTemplate('{icon:bullet} +[{missing}||] Damage')).toBe('+# Damage')
  })
})

describe('evalExpr', () => {
  it('évalue des expressions arithmétiques simples', () => {
    expect(evalExpr('Floor(Affix_Value_1)*2', { Affix_Value_1: 4.5 })).toBe(9)
    expect(evalExpr('80+(7-1)*2', {})).toBe(92)
  })
  it('refuse tout ce qui n’est pas arithmétique', () => {
    expect(evalExpr('process.exit()', {})).toBeNull()
  })
})

describe('prettifyId', () => {
  it('rend lisible un identifiant interne', () => {
    expect(prettifyId('Rune_Effect_Druid_EarthenBulwark')).toBe('Druid Earthen Bulwark')
    expect(prettifyId('S15_SoulSplinter_Duriel_04')).toBe('Soul Splinter Duriel')
  })
})
