import type { Build, GearSlot, ParagonBoardStep, ParagonCell, Variant } from './types.ts'

export function gearKeys(slot: GearSlot): string[] {
  return [
    slot.key,
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
 * Les clés suffixées par un niveau (`…@5` : rang de compétence, niveau de glyphe) s'impliquent entre elles :
 * valider le rang 5 valide aussi les rangs inférieurs ; invalider le rang 1 invalide les rangs supérieurs.
 */
export function withImpliedKeys(allKeys: string[], keys: string[], done: boolean): string[] {
  const result = new Set(keys)
  for (const key of keys) {
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
