import { ancestralKey, boardKeys, countDone, gearKeys, masterworkKey, mythicKey } from '../../shared/progress.ts'
import type { Build, GearSlot, Variant } from '../../shared/types.ts'

export interface Stat {
  done: number
  total: number
}

export const pct = (s: Stat) => (s.total === 0 ? 0 : Math.round((s.done / s.total) * 100))

const unique = (keys: string[]) => [...new Set(keys)]

export function skillKeys(v: Variant) {
  return unique(v.skillSteps.flatMap((s) => s.nodes.map((n) => n.key)))
}
export function paragonKeys(build: Build, v: Variant) {
  return unique(v.paragonSteps.flatMap((s) => s.boards.flatMap((b) => boardKeys(build, b))))
}
export function allGearKeys(v: Variant) {
  return unique(v.gear.flatMap(gearKeys))
}

export function stat(keys: string[], progress: Record<string, string>): Stat {
  return { done: countDone(keys, progress), total: keys.length }
}

// ---- Priorités d'équipement pour "Prochaines étapes" ----

export interface GearTodo {
  key: string
  slot: GearSlot
  tier: number
  label: string
  detail?: string
}

const TIERS = ['Obtenir', 'Aspect', 'Primordial', 'Mythique', 'Affixe', 'Trempe', 'Châsse', 'Masterwork'] as const

export function gearTodos(v: Variant, isDone: (k: string) => boolean): GearTodo[] {
  const todos: GearTodo[] = []
  for (const slot of v.gear) {
    if (!isDone(slot.key)) todos.push({ key: slot.key, slot, tier: 0, label: slot.name, detail: slot.baseType ?? undefined })
    if (slot.aspect && !isDone(slot.aspect.key)) todos.push({ key: slot.aspect.key, slot, tier: 1, label: slot.aspect.text })
    const ancestral = ancestralKey(slot)
    if (ancestral && !isDone(ancestral)) todos.push({ key: ancestral, slot, tier: 2, label: `${slot.name} primordial` })
    const mythic = mythicKey(slot)
    if (mythic && !isDone(mythic)) todos.push({ key: mythic, slot, tier: 3, label: `${slot.name} mythique (Cube)` })
    for (const a of slot.affixes) if (!isDone(a.key)) todos.push({ key: a.key, slot, tier: 4, label: a.text, detail: a.greater ? 'Greater' : undefined })
    for (const a of slot.tempered) if (!isDone(a.key)) todos.push({ key: a.key, slot, tier: 5, label: a.text })
    for (const s of slot.sockets) if (!isDone(s.key)) todos.push({ key: s.key, slot, tier: 6, label: s.name })
    if (!isDone(masterworkKey(slot))) todos.push({ key: masterworkKey(slot), slot, tier: 7, label: 'Masterwork terminé' })
  }
  return todos.sort((a, b) => a.tier - b.tier)
}

export const tierLabel = (tier: number) => TIERS[tier] ?? ''
