// Plan de farm : pour chaque objet unique/mythique et chaque rune du build, où le trouver.
import type { Build, FarmPlan, FarmSource, FarmTarget, LootSource } from '../../shared/types.ts'
import type { GameData } from './maxroll/gameData.ts'
import type { LootTable } from './maxroll/loot.ts'

/** Préférence quand un objet a plusieurs sources : une source dédiée avant le pool général. */
const KIND_RANK: Record<LootSource['kind'], number> = { boss: 0, mythic: 1, trophy: 2, world: 3, runes: 4, pool: 5 }

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

export function buildFarmPlan(build: Build, variantIndex: number, loot: LootTable, game: GameData): FarmPlan {
  const variant = build.variants[variantIndex]
  const byId = new Map<number, LootSource[]>()
  const byName = new Map<string, LootSource[]>()
  for (const source of loot.sources) {
    for (const item of source.items) {
      byId.set(item.id, [...(byId.get(item.id) ?? []), source])
      if (item.name) byName.set(norm(item.name), [...(byName.get(norm(item.name)) ?? []), source])
    }
  }
  const find = (itemId: string, name: string): LootSource[] => {
    const numeric = game.items[itemId]?.id
    const found = (numeric !== undefined && byId.get(numeric)) || byName.get(norm(name)) || []
    return [...new Set(found)].sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind])
  }

  const assigned = new Map<string, FarmTarget[]>()
  const unmatched: FarmTarget[] = []
  const add = (sources: LootSource[], target: Omit<FarmTarget, 'alsoIn'>) => {
    const [primary, ...others] = sources
    const full = { ...target, alsoIn: others.map((s) => s.name) }
    if (!primary) return unmatched.push(full)
    assigned.set(primary.id, [...(assigned.get(primary.id) ?? []), full])
  }

  for (const slot of variant?.gear ?? []) {
    const unique = slot.rarity === 'unique' || slot.rarity === 'mythic'
    const sources = find(slot.itemId, game.items[slot.itemId]?.name ?? slot.name)
    // Les légendaires classiques se farment partout : seuls les objets à source précise nous intéressent.
    if (unique || sources.length > 0) add(sources, { key: slot.key, name: slot.name, slotLabel: slot.slotLabel, rarity: slot.rarity })
    for (const socket of slot.sockets) {
      if (socket.kind !== 'rune') continue
      const runeName = game.items[socket.id]?.name ?? socket.name
      add(find(socket.id, runeName), { key: socket.key, name: socket.name, slotLabel: slot.slotLabel, rarity: 'rune' })
    }
  }

  const sources: FarmSource[] = loot.sources
    .filter((s) => assigned.has(s.id))
    .map(({ items: _items, ...s }) => ({ ...s, targets: assigned.get(s.id)! }))
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || b.targets.length - a.targets.length)

  return { variant: variantIndex, sourceUrl: loot.sourceUrl, updatedAt: loot.updatedAt, sources, unmatched }
}
