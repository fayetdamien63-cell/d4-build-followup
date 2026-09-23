import type { Build, GearSlot, ParagonBoardStep, ParagonCell, Variant } from './types.ts'

export const ANCESTRAL_SUFFIX = ':ancestral'

/**
 * Clé "version primordiale" (Ancestral en anglais) d'un emplacement, ou null si sans objet : le sceau et
 * les charmes (emplacements 20+) n'ont pas cette qualité. Les mythiques sont concernés : en saison 15,
 * on les obtient en améliorant au Cube un unique primordial.
 */
export function ancestralKey(slot: GearSlot): string | null {
  if (Number(slot.slot) >= 20) return null
  return `${slot.key}${ANCESTRAL_SUFFIX}`
}

export function gearKeys(slot: GearSlot): string[] {
  const ancestral = ancestralKey(slot)
  return [
    slot.key,
    ...(ancestral ? [ancestral] : []),
    ...(slot.aspect ? [slot.aspect.key] : []),
    ...slot.affixes.map((a) => a.key),
    ...slot.tempered.map((a) => a.key),
    ...slot.sockets.map((s) => s.key),
    masterworkKey(slot),
  ]
}

export const masterworkKey = (slot: GearSlot) => `${slot.key}:masterwork`

/** Seules les grilles de parangon sont nécessaires pour énumérer les clés. */
type WithGrids = Pick<Build, 'paragonGrids'>

export const cellKey = (board: ParagonBoardStep, cell: ParagonCell) => board.keyPrefix + cell.src

export function boardNodeKeys(build: WithGrids, board: ParagonBoardStep, positions: number[] = board.allocated): string[] {
  const cells = build.paragonGrids[board.gridId]?.cells ?? []
  return positions.map((pos) => cells[pos]).filter((c): c is ParagonCell => Boolean(c)).map((c) => cellKey(board, c))
}

export function boardKeys(build: WithGrids, board: ParagonBoardStep): string[] {
  return [...(board.isStart ? [] : [board.key]), ...(board.glyph ? [board.glyph.key] : []), ...boardNodeKeys(build, board)]
}

/** Toutes les clés cochables d'une variante (sans doublons). */
export function variantKeys(build: WithGrids, variant: Variant): string[] {
  const keys = new Set<string>()
  for (const step of variant.skillSteps) for (const n of step.nodes) keys.add(n.key)
  for (const step of variant.paragonSteps) for (const b of step.boards) for (const k of boardKeys(build, b)) keys.add(k)
  for (const slot of variant.gear) for (const k of gearKeys(slot)) keys.add(k)
  return [...keys]
}

export function countDone(keys: string[], progress: Record<string, string>): number {
  return keys.reduce((n, k) => n + (progress[k] ? 1 : 0), 0)
}

/**
 * Implications entre clés :
 * - version primordiale ↔ objet obtenu (voir ancestralKey) ;
 * - les clés suffixées par un niveau (`…@5` : rang de compétence, niveau de glyphe) s'impliquent entre elles :
 * valider le rang 5 valide aussi les rangs inférieurs ; invalider le rang 1 invalide les rangs supérieurs.
 */
export function withImpliedKeys(allKeys: string[], keys: string[], done: boolean): string[] {
  const result = new Set(keys)
  for (const key of keys) {
    // La version primordiale implique l'objet ; retirer l'objet retire sa version primordiale.
    if (done && key.endsWith(ANCESTRAL_SUFFIX)) result.add(key.slice(0, -ANCESTRAL_SUFFIX.length))
    if (!done && allKeys.includes(key + ANCESTRAL_SUFFIX)) result.add(key + ANCESTRAL_SUFFIX)

    const m = key.match(/^(.*)@(\d+)$/)
    if (!m) continue
    const [, base, level] = m
    for (const other of allKeys) {
      const o = other.match(/^(.*)@(\d+)$/)
      if (!o || o[1] !== base) continue
      if (done ? Number(o[2]) < Number(level) : Number(o[2]) > Number(level)) result.add(other)
    }
  }
  return [...result]
}
