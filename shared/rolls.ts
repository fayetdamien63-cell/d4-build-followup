// Valeurs réellement obtenues ("rolls") comparées aux cibles du guide.
import type { Affix, GearSlot } from './types.ts'

export type RollStatus = 'ok' | 'close' | 'low'

/** Seuil à partir duquel une valeur est jugée "proche" de la cible. */
export const CLOSE_RATIO = 0.9

/** Cible d'un affixe à l'échelle affichée ; repli sur le premier nombre du texte pour les anciens imports. */
export function affixTarget(affix: Affix): number | null {
  if (affix.target !== undefined) return affix.target
  const m = affix.text.match(/\d[\d,]*(?:\.\d+)?/)
  return m ? Number(m[0].replace(/,/g, '')) : null
}

/**
 * Lit une valeur tapée par l'utilisateur, en format anglais (jeu) ou français :
 * "1,900" / "1 900" / "1900" → 1900 ; "9.75" / "9,75" / "9,75 %" → 9.75.
 */
export function parseRollInput(input: string): number | null {
  let s = input.trim().replace(/[%x+\s  ]/gi, '')
  if (!s) return null
  if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '') // 1,812.5
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '') // 1,900 : séparateur de milliers
  else s = s.replace(',', '.') // 9,75 : virgule décimale
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function rollRatio(actual: number, target: number | null): number | null {
  if (target === null || target <= 0) return null
  return actual / target
}

export function rollStatus(ratio: number): RollStatus {
  return ratio >= 1 ? 'ok' : ratio >= CLOSE_RATIO ? 'close' : 'low'
}

export function slotAffixes(slot: GearSlot): Affix[] {
  return [...(slot.aspect ? [slot.aspect] : []), ...slot.affixes, ...slot.tempered]
}

export interface SlotQuality {
  /** Moyenne des ratios (plafonnés à 100 %) des affixes renseignés, entre 0 et 1. */
  score: number
  measured: number
  /** Affixes renseignés sous la cible, du plus faible au moins faible. */
  weakest: { affix: Affix; actual: number; target: number; ratio: number }[]
}

export function slotQuality(slot: GearSlot, rolls: Record<string, number>): SlotQuality | null {
  const measured = slotAffixes(slot)
    .map((affix) => {
      const actual = rolls[affix.key]
      const target = affixTarget(affix)
      const ratio = actual === undefined ? null : rollRatio(actual, target)
      return ratio === null ? null : { affix, actual, target: target!, ratio }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
  if (measured.length === 0) return null
  const score = measured.reduce((n, m) => n + Math.min(m.ratio, 1), 0) / measured.length
  const weakest = measured.filter((m) => m.ratio < 1).sort((a, b) => a.ratio - b.ratio)
  return { score, measured: measured.length, weakest }
}
