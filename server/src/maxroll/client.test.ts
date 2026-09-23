import { describe, expect, it } from 'vitest'
import { extractPlannerRefs, parseInput } from './client.ts'

describe('parseInput', () => {
  it('accepte un ID brut', () => {
    expect(parseInput('7vu83u0t')).toEqual({ plannerId: '7vu83u0t', variantHint: null })
  })
  it('lit une URL de planner et son indice de variante (1-indexé)', () => {
    expect(parseInput('https://maxroll.gg/d4/planner/7vu83u0t#5')).toEqual({ plannerId: '7vu83u0t', variantHint: 4 })
  })
  it('renvoie l’URL d’un guide à télécharger', () => {
    expect(parseInput('https://maxroll.gg/d4/build-guides/apocalypse-warlock-guide')).toEqual({
      guideUrl: 'https://maxroll.gg/d4/build-guides/apocalypse-warlock-guide',
    })
  })
  it('refuse les autres sites', () => {
    expect(() => parseInput('https://mobalytics.gg/diablo-4/builds/x')).toThrow(/maxroll/)
    expect(() => parseInput('pas une url !')).toThrow()
  })
})

describe('extractPlannerRefs', () => {
  it('trouve les widgets et les liens de planner, sans doublons', () => {
    const html = `
      <div data-d4-profile="abc123xy" data-d4-type="equipment"></div>
      {"link":"https:\\/\\/maxroll.gg\\/d4\\/planner\\/abc123xy#3"}
      <a href="https://maxroll.gg/d4/planner/zzz999aa">x</a>`
    expect(extractPlannerRefs(html)).toEqual([
      { plannerId: 'abc123xy', variantHint: 2 },
      { plannerId: 'zzz999aa', variantHint: null },
    ])
  })
})
