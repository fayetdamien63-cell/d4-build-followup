import type { Build, Variant } from './types.ts'
import { masterworkKey } from './progress.ts'

export type Category = 'skills' | 'paragon' | 'gear'

export interface KeyInfo {
  label: string
  /** Contexte (étape, plateau, emplacement) pour regrouper l'affichage. */
  context: string
  category: Category
  variant: number
  /** Jalon marquant (objet unique/mythique obtenu, plateau terminé…) */
  milestone?: boolean
}

/** Libellé lisible pour chaque clé cochable d'une variante. */
export function describeVariant(build: Pick<Build, 'paragonGrids'>, variant: Variant): Map<string, KeyInfo> {
  const map = new Map<string, KeyInfo>()
  const v = variant.index
  for (const step of variant.skillSteps) {
    for (const n of step.nodes) {
      const rank = n.kind !== 'upgrade' && n.rank > 1 ? ` (rang ${n.rank})` : ''
      map.set(n.key, { label: `${n.parent ? `${n.parent} › ` : ''}${n.name}${rank}`, context: step.name, category: 'skills', variant: v })
    }
  }
  for (const step of variant.paragonSteps) {
    for (const b of step.boards) {
      const context = `Plateau ${b.name}`
      if (!b.isStart) map.set(b.key, { label: `Plateau ${b.name} débloqué`, context, category: 'paragon', variant: v, milestone: true })
      if (b.glyph) {
        const level = b.glyph.level !== null ? ` niv. ${b.glyph.level}` : ''
        map.set(b.glyph.key, { label: `Glyphe ${b.glyph.name}${level}`, context, category: 'paragon', variant: v })
      }
      const cells = build.paragonGrids[b.gridId]?.cells ?? []
      for (const pos of b.allocated) {
        const cell = cells[pos]
        if (cell) {
          map.set(b.keyPrefix + cell.src, {
            label: cell.name,
            context,
            category: 'paragon',
            variant: v,
            milestone: cell.rarity === 'legendary',
          })
        }
      }
    }
  }
  for (const slot of variant.gear) {
    const context = slot.slotLabel
    const gear = (label: string, key: string, milestone = false) => map.set(key, { label, context, category: 'gear', variant: v, milestone })
    gear(slot.name, slot.key, slot.rarity === 'unique' || slot.rarity === 'mythic')
    if (slot.aspect) gear(slot.aspect.text, slot.aspect.key)
    for (const a of slot.affixes) gear(a.greater ? `${a.text} (GA)` : a.text, a.key)
    for (const a of slot.tempered) gear(`Trempe : ${a.text}`, a.key)
    for (const s of slot.sockets) gear(s.name, s.key)
    gear(`Masterwork ${slot.name}`, masterworkKey(slot))
  }
  return map
}

export function describeBuild(build: Build): Map<string, KeyInfo> {
  const map = new Map<string, KeyInfo>()
  for (const v of build.variants) for (const [k, info] of describeVariant(build, v)) map.set(k, info)
  return map
}

// ---- Différences entre deux versions d'un build ----

export interface DiffEntry {
  key: string
  category: Category
  context: string
  label: string
  /** Libellé précédent, pour les éléments modifiés. */
  before?: string
  /** L'élément était déjà validé dans ta progression. */
  wasDone?: boolean
}

export interface VariantDiff {
  variant: number
  name: string
  added: DiffEntry[]
  removed: DiffEntry[]
  changed: DiffEntry[]
}

export interface BuildDiff {
  variants: VariantDiff[]
  /** Variantes apparues ou disparues. */
  variantsAdded: string[]
  variantsRemoved: string[]
  total: number
}

export function diffBuilds(before: Build, after: Build, progress: Record<string, string> = {}): BuildDiff {
  const variants: VariantDiff[] = []
  const count = Math.min(before.variants.length, after.variants.length)
  for (let i = 0; i < count; i++) {
    const a = describeVariant(before, before.variants[i])
    const b = describeVariant(after, after.variants[i])
    const entry = (key: string, info: KeyInfo, extra: Partial<DiffEntry> = {}): DiffEntry => ({
      key,
      category: info.category,
      context: info.context,
      label: info.label,
      ...(progress[key] ? { wasDone: true } : {}),
      ...extra,
    })
    const diff: VariantDiff = { variant: i, name: after.variants[i].name, added: [], removed: [], changed: [] }
    for (const [key, info] of b) {
      const old = a.get(key)
      if (!old) diff.added.push(entry(key, info))
      else if (old.label !== info.label) diff.changed.push(entry(key, info, { before: old.label }))
    }
    for (const [key, info] of a) if (!b.has(key)) diff.removed.push(entry(key, info))
    if (diff.added.length + diff.removed.length + diff.changed.length > 0) variants.push(diff)
  }
  const variantsAdded = after.variants.slice(count).map((v) => v.name)
  const variantsRemoved = before.variants.slice(count).map((v) => v.name)
  const total =
    variants.reduce((n, v) => n + v.added.length + v.removed.length + v.changed.length, 0) + variantsAdded.length + variantsRemoved.length
  return { variants, variantsAdded, variantsRemoved, total }
}
