// Mini jeu de données, calqué sur le format réel de Maxroll, pour les tests hors ligne.
import type { RawProfileResponse } from './maxroll/client.ts'
import { indexGameData, type RawGameData } from './maxroll/gameData.ts'

export const gameData = indexGameData({
  version: 'test',
  affixes: {
    S04_Life: { id: 1, attributes: [{ id: 134, formula: 'GearAffix_Life' }] },
    S04_Resistance_Single_Cold: { id: 2, attributes: [{ id: 74, param: 3 }] },
    legendary_test_aspect: {
      id: 3,
      prefix: 'Overwhelming',
      desc: 'Deals {c_random}[Affix_Value_1|x%|]{/c} increased damage.',
      attributes: [{ id: 1173, value: '80+(CurrentLegendaryRank()-1)*2' }],
    },
    Helm_Unique_Test: { id: 4, desc: '{if:IsMythic}{c_mythic}{/if}Skills deal [Affix_Value_1*100|%x|] damage.' },
  },
  items: {
    Helm_Unique_Test_001: { id: 10, type: 'Helm', name: 'Crown of Tests' },
    Pants_Legendary_Generic_001: { id: 11, type: 'Legs', name: 'Runic Leggings' },
    Gem_Ruby_07: { id: 12, type: 'Gem', name: 'Grand Ruby' },
    Rune_Condition_Test: { id: 13, type: 'ConditionRune', name: 'Igni' },
  },
  classes: { '7': { nameMale: 'Warlock' } },
  skills: {
    Warlock_Bolt: { name: 'Bolt', mods: [{ id: 99, name: 'Chain' }] },
  },
  skillTrees: { Warlock: { nodes: [{ id: 1, rewardId: 'Unlock_Bolt' }, { id: 2, rewardId: 'Bolt_Mod' }] } },
  skillTreeRewards: {
    Unlock_Bolt: { type: 0, power: 'Warlock_Bolt', ranks: 15 },
    Bolt_Mod: { type: 1, power: 'Warlock_Bolt', mod: 99 },
  },
  paragonBoards: {
    // Plateau 3x3 : départ en bas au centre, un rare au centre, un normal en haut.
    Board_A: { width: 3, name: 'Start', nodes: [null, 'Generic_Normal_Str', null, null, 'Warlock_Rare_001', null, null, 'Generic_Start', null] },
  },
  paragonNodes: { Warlock_Rare_001: { name: 'Dark Sign', rarity: 3 }, Generic_Normal_Str: { rarity: 0 } },
  paragonGlyphs: { Glyph_A: { name: 'Unbound' } },
  attributes: { '74': { name: 'Resistance' }, '134': { name: 'Max_Life' }, '1173': { name: 'Affix_Value_1' } },
  attributeDescriptions: { Max_Life: '+[{value}||] Maximum Life', Resistance: '+[{value2}||] {value1} Resistance' },
  itemTypes: { Legs: { name: 'Pants' } },
} satisfies RawGameData)

export const profile: RawProfileResponse = {
  id: 'test1234',
  name: 'Test Warlock',
  class: 'Warlock',
  date: '2026-09-22 10:00:00',
  season: '15',
  data: JSON.stringify({
    activeProfile: 1,
    strAndWeak: { strengths: ['Fun'], weaknesses: ['Slow'] },
    items: {
      '1': { id: 'Helm_Unique_Test_001', power: 900, mythic: false, explicits: [{ nid: 4, values: [0.5] }, { nid: 1, values: [2000], greater: true, upgrade: 1 }], sockets: ['Gem_Ruby_07'] },
      '2': { id: 'Pants_Legendary_Generic_001', name: 'Random Name', explicits: [{ nid: 2, values: [3750] }], aspects: [{ nid: 3, values: [7] }], tempered: [{ nid: 1, values: [500] }], sockets: ['Rune_Condition_Test'] },
    },
    profiles: [
      {
        name: 'Leveling',
        class: 7,
        hidden: true,
        items: { '14': 2 },
        skillBar: ['Warlock_Bolt'],
        skillTree: { steps: [{ name: 'lvl 2', data: { '1': 1, '2': 0 } }, { name: 'lvl 10', data: { '1': 5, '2': 1 } }] },
        paragon: { steps: [] },
      },
      {
        name: 'Endgame',
        class: 7,
        items: { '4': 1, '14': 2 },
        skillTree: { steps: [{ name: 'Endgame', data: { '1': 15, '2': 1 } }] },
        paragon: {
          steps: [
            { name: 'Step 1', data: [{ id: 'Board_A', nodes: { '7': 1, '4': 1 }, rotation: 0 }] },
            { name: 'Step 2', data: [{ id: 'Board_A', nodes: { '7': 1, '4': 1, '1': 1 }, rotation: 0, glyph: 'Glyph_A', glyphLevel: 21 }] },
          ],
        },
      },
    ],
  }),
}

/** Extrait au format de la page "Boss Loot Table Cheat Sheet" de Maxroll. */
export const lootHtml = `
<p>Last Updated: <span>September 22, 2026</span></p>
<h2 class="x"><span>General Unique Pool</span></h2>
<p>These Uniques can drop from any boss.</p>
<ul><li><span class="d4-item" data-d4-id="10">Crown of Tests</span></li></ul>
<h2>Lord Test</h2>
<h3>Basic Information</h3><ul>
<li><span><strong><mark>Requires <a href="#">Torment 1</a> or higher.</mark></strong></span></li>
<li class="wp-block"><span class="c"><strong class="s"><mark class="m">Activity Required</mark></strong></span>: Complete <span><a href="#">Helltide</a></span></li>
<li><span><strong><mark>Boss Lair Key</mark></strong></span>: 1x <span><span data-d4-id="99">Lair Key</span></span></li>
<li><span><strong><mark>Element Type</mark></strong></span>: <span><mark>Fire</mark></span></li></ul>
<figure><figcaption>The <mark>Test Lair</mark> is located near &#x27;Kyovashad&#x27;</figcaption></figure>
<p><strong><mark>Warlock<strong>:</strong></mark></strong></p>
<ul><li><span data-d4-id="10">Crown of Tests</span></li></ul>
<h2>Rune Drops</h2><p>Runes drop everywhere.</p><ul><li><span data-d4-id="555">Igni</span></li></ul>
<h2>Summary</h2><ul><li><span data-d4-id="10">Crown of Tests</span></li></ul>
`
