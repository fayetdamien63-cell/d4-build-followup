// Transforme un profil brut du planner Maxroll en `Build` normalisé et lisible.
import type { Affix, Build, GearSlot, ParagonBoardStep, ParagonCell, ParagonGrid, ParagonStep, Rarity, SkillNode, SkillStep, Socket, Variant } from '../../../shared/types.ts'
import type { RawProfileResponse } from './client.ts'
import type { GameData } from './gameData.ts'
import { evalExpr, prettifyId, renderTemplate, type TemplateVars } from './text.ts'

// ---- Format brut du planner -------------------------------------------------

interface RawAffixValue {
  nid: number
  values?: number[]
  greater?: boolean
  upgrade?: number
}

interface RawItem {
  id: string
  name?: string
  power?: number
  mythic?: boolean
  implicits?: RawAffixValue[]
  explicits?: RawAffixValue[]
  tempered?: RawAffixValue[]
  aspects?: RawAffixValue[]
  sockets?: string[]
}

interface RawParagonBoard {
  id: string
  nodes: Record<string, number>
  rotation?: number
  glyph?: string
  glyphLevel?: number
}

interface RawProfile {
  name: string
  class: number
  level?: number
  worldTier?: number
  hidden?: boolean
  items?: Record<string, number>
  skillBar?: string[]
  skillTree?: { steps?: { name: string; data: Record<string, number> }[] }
  paragon?: { steps?: { name: string; data: RawParagonBoard[] }[] }
}

interface RawPlannerData {
  profiles: RawProfile[]
  items: Record<string, RawItem>
  activeProfile?: number | string
  strAndWeak?: { strengths?: string[]; weaknesses?: string[] }
}

// ---- Emplacements d'équipement ---------------------------------------------

const SLOT_LABELS: Record<string, string> = {
  '4': 'Casque',
  '5': 'Torse',
  '13': 'Gants',
  '14': 'Jambières',
  '15': 'Bottes',
  '16': 'Anneau 1',
  '17': 'Anneau 2',
  '18': 'Amulette',
  '20': 'Sceau horadrique',
}
const OFFHAND_TYPES = ['Shield', 'Focus', 'OffHandTotem', 'Totem']

function slotLabel(slot: string, itemType: string | null): string {
  if (SLOT_LABELS[slot]) return SLOT_LABELS[slot]
  const n = Number(slot)
  if (n >= 21 && n <= 30) return `Charme ${n - 20}`
  if (itemType && OFFHAND_TYPES.includes(itemType)) return 'Main gauche'
  return 'Arme'
}

// ---- Normalisation ----------------------------------------------------------

const MAX_LEGENDARY_RANK = 30
const RESISTANCES = ['Physical', 'Fire', 'Lightning', 'Cold', 'Poison', 'Shadow']

export class Normalizer {
  private grids: Record<string, ParagonGrid> = {}

  constructor(private readonly game: GameData) {}

  normalize(raw: RawProfileResponse, sourceUrl: string): { build: Omit<Build, 'id' | 'importedAt'>; activeVariant: number } {
    const data = JSON.parse(raw.data) as RawPlannerData
    this.grids = {}
    const variants = data.profiles.map((p, i) => this.variant(p, i, data.items))
    const active = Number(data.activeProfile ?? 0)
    return {
      build: {
        source: 'maxroll',
        sourceId: raw.id,
        sourceUrl,
        name: raw.name,
        className: raw.class,
        season: raw.season ?? null,
        sourceDate: raw.date ?? null,
        gameVersion: this.game.version,
        strengths: data.strAndWeak?.strengths ?? [],
        weaknesses: data.strAndWeak?.weaknesses ?? [],
        variants,
        paragonGrids: this.grids,
      },
      activeVariant: Number.isInteger(active) && active >= 0 && active < variants.length ? active : 0,
    }
  }

  private variant(p: RawProfile, index: number, items: Record<string, RawItem>): Variant {
    const prefix = `v${index}`
    const className = this.game.classes[String(p.class)]?.nameMale ?? ''
    return {
      index,
      name: p.name,
      level: p.level ?? null,
      worldTier: p.worldTier ?? null,
      worldTierName: p.worldTier !== undefined ? (this.game.worldTiers?.[p.worldTier]?.name ?? null) : null,
      hidden: Boolean(p.hidden),
      skillBar: (p.skillBar ?? []).filter(Boolean).map((id) => ({ id, name: this.game.skills[id]?.name ?? prettifyId(id) })),
      skillSteps: this.skillSteps(prefix, className, p.skillTree?.steps ?? []),
      paragonSteps: this.paragonSteps(prefix, p.paragon?.steps ?? []),
      gear: Object.entries(p.items ?? {})
        .map(([slot, ref]) => (items[String(ref)] ? this.gearSlot(prefix, slot, items[String(ref)]) : null))
        .filter((g): g is GearSlot => g !== null),
    }
  }

  // -- Compétences --

  private skillSteps(prefix: string, className: string, steps: { name: string; data: Record<string, number> }[]): SkillStep[] {
    const treeKey = Object.keys(this.game.skillTrees).find((k) => k === className) ??
      Object.keys(this.game.skillTrees).find((k) => k.startsWith(className))
    const nodes = new Map((treeKey ? this.game.skillTrees[treeKey].nodes : []).map((n) => [n.id, n]))
    let previous: Record<string, number> = {}
    return steps.map((step) => {
      const added: SkillNode[] = []
      for (const [nodeId, rank] of Object.entries(step.data ?? {})) {
        if (rank > 0 && (previous[nodeId] ?? 0) < rank) added.push(this.skillNode(prefix, Number(nodeId), rank, nodes.get(Number(nodeId))?.rewardId))
      }
      previous = step.data ?? {}
      return { name: step.name, nodes: added }
    })
  }

  private skillNode(prefix: string, nodeId: number, rank: number, rewardId: string | undefined): SkillNode {
    const reward = rewardId ? this.game.skillTreeRewards[rewardId] : undefined
    const skill = reward?.power ? this.game.skills[reward.power] : undefined
    const base = { key: `${prefix}:skill:${nodeId}@${rank}`, nodeId, rank, maxRank: reward?.ranks ?? null }
    if (reward?.type === 1 && skill) {
      const mod = skill.mods?.find((m) => m.id === reward.mod)
      return { ...base, kind: 'upgrade', name: mod?.name ?? 'Amélioration', parent: skill.name }
    }
    const kind = reward?.type === 0 ? (rewardId?.includes('Passive') ? 'passive' : 'skill') : reward ? 'passive' : 'other'
    return { ...base, kind, name: skill?.name ?? prettifyId(rewardId ?? `Nœud ${nodeId}`), parent: null }
  }

  // -- Parangon --

  private paragonSteps(prefix: string, steps: { name: string; data: RawParagonBoard[] }[]): ParagonStep[] {
    const previous = new Map<string, Set<number>>()
    return steps.map((step) => ({
      name: step.name,
      boards: (step.data ?? []).map((raw, order) => {
        const board = this.paragonBoard(prefix, raw, order, previous.get(raw.id) ?? new Set())
        previous.set(raw.id, new Set(board.allocated))
        return board
      }),
    }))
  }

  private paragonBoard(prefix: string, raw: RawParagonBoard, order: number, before: Set<number>): ParagonBoardStep {
    const def = this.game.paragonBoards[raw.id]
    const rotation = ((raw.rotation ?? 0) % 4 + 4) % 4
    const width = def?.width ?? 21
    const gridId = `${raw.id}@${rotation}`
    const grid = (this.grids[gridId] ??= this.paragonGrid(def, width, rotation))
    const allocated = Object.entries(raw.nodes ?? {})
      .filter(([, v]) => v > 0)
      .map(([i]) => rotateIndex(Number(i), width, rotation))
      .filter((pos) => grid.cells[pos])
      .sort((a, b) => a - b)
    const glyph = raw.glyph
      ? {
          key: `${prefix}:glyph:${raw.id}:${raw.glyph}@${raw.glyphLevel ?? 0}`,
          id: raw.glyph,
          name: this.game.paragonGlyphs[raw.glyph]?.name ?? prettifyId(raw.glyph),
          level: raw.glyphLevel ?? null,
        }
      : null
    return {
      key: `${prefix}:board:${raw.id}`,
      boardId: raw.id,
      name: def?.name ?? prettifyId(raw.id),
      order,
      isStart: raw.id.endsWith('_00') || def?.name === 'Start',
      rotation,
      glyph,
      gridId,
      keyPrefix: `${prefix}:para:${raw.id}:`,
      allocated,
      added: allocated.filter((pos) => !before.has(pos)),
    }
  }

  private paragonGrid(def: { nodes: (string | null)[] } | undefined, width: number, rotation: number): ParagonGrid {
    const source = def?.nodes ?? []
    const cells: (ParagonCell | null)[] = new Array(Math.max(source.length, width * width)).fill(null)
    source.forEach((nodeName, i) => {
      if (nodeName) cells[rotateIndex(i, width, rotation)] = this.paragonCell(i, nodeName)
    })
    return { width, cells }
  }

  private paragonCell(src: number, nodeName: string): ParagonCell {
    const node = this.game.paragonNodes[nodeName]
    if (nodeName.includes('Gate')) return { src, name: 'Portail', rarity: 'gate' }
    if (nodeName.includes('Socket')) return { src, name: 'Emplacement de glyphe', rarity: 'socket' }
    if (nodeName.includes('Start')) return { src, name: 'Départ', rarity: 'start' }
    const rarity: ParagonCell['rarity'] = node?.rarity === 4 ? 'legendary' : node?.rarity === 3 ? 'rare' : (node?.rarity ?? 0) >= 1 ? 'magic' : 'normal'
    return { src, name: node?.name ?? genericNodeName(nodeName), rarity }
  }

  // -- Équipement --

  private gearSlot(prefix: string, slot: string, item: RawItem): GearSlot {
    const key = `${prefix}:gear:${slot}`
    const def = this.game.items[item.id]
    const itemType = def?.type ?? null
    const rarity = itemRarity(item)
    const aspectRaw = item.aspects?.[0]
    const aspect = aspectRaw ? this.affix(`${key}:aspect`, aspectRaw, true) : null
    const aspectName = aspectRaw ? this.game.affixById.get(aspectRaw.nid)?.affix.prefix : undefined
    let name: string
    if (rarity === 'unique' || rarity === 'mythic') name = def?.name ?? item.name ?? prettifyId(item.id)
    else if (aspectName) name = `Aspect ${aspectName}`
    else name = item.name ?? def?.name ?? prettifyId(item.id)
    if (aspect && aspectName) aspect.text = `${aspectName} : ${aspect.text}`

    return {
      key,
      slot,
      slotLabel: slotLabel(slot, itemType),
      itemId: item.id,
      name,
      baseType: rarity === 'unique' || rarity === 'mythic' ? null : (def?.name ?? (itemType ? this.game.itemTypes[itemType]?.name ?? itemType : null)),
      rarity,
      power: item.power ?? null,
      aspect,
      implicits: (item.implicits ?? []).map((a, i) => this.affix(`${key}:implicit:${i}`, a)),
      affixes: (item.explicits ?? []).map((a, i) => this.affix(`${key}:affix:${i}`, a)),
      tempered: (item.tempered ?? []).map((a, i) => this.affix(`${key}:temper:${i}`, a)),
      sockets: (item.sockets ?? []).map((id, i) => this.socket(`${key}:socket:${i}`, id)),
    }
  }

  private socket(key: string, id: string): Socket {
    const def = this.game.items[id]
    const kind: Socket['kind'] = def?.type === 'Gem' ? 'gem' : def?.type?.endsWith('Rune') ? 'rune' : 'other'
    const name = def?.name ? (kind === 'rune' ? `Rune ${def.name}` : def.name) : prettifyId(id)
    return { key, id, name, kind }
  }

  affix(key: string, raw: RawAffixValue, isAspect = false): Affix {
    const collected: number[] = []
    return {
      key,
      id: String(raw.nid),
      text: this.affixText(raw.nid, raw.values ?? [], isAspect, collected),
      greater: Boolean(raw.greater),
      masterwork: raw.upgrade === 1,
      target: collected[0] ?? null,
    }
  }

  /**
   * Pour les aspects, Maxroll stocke le rang légendaire (et non la valeur) : on réévalue
   * la formule de l'attribut, ex. "80+(CurrentLegendaryRank()-1)*2".
   */
  affixText(nid: number, values: number[], isAspect = false, collect?: number[]): string {
    const entry = this.game.affixById.get(nid)
    if (!entry) return `Affixe inconnu (${nid})`
    const { key, affix } = entry
    const vars: TemplateVars = {}
    values.forEach((v, i) => (vars[`Affix_Value_${i + 1}`] = v))
    if (isAspect) {
      ;(affix.attributes ?? []).forEach((attr, i) => {
        if (typeof attr.value !== 'string' || !attr.value.includes('CurrentLegendaryRank()')) return
        const raw = values[i] ?? values[0]
        const atRank = (r: number) => evalExpr((attr.value as string).replaceAll('CurrentLegendaryRank()', String(r)), {})
        const [lo, hi] = [atRank(1), atRank(MAX_LEGENDARY_RANK)]
        if (raw === undefined || typeof lo !== 'number' || typeof hi !== 'number') return
        // La valeur stockée est tantôt la valeur réelle, tantôt le rang : on tranche selon la plage de la formule.
        const isValue = raw >= Math.min(lo, hi) && raw <= Math.max(lo, hi)
        if (isValue || !Number.isInteger(raw) || raw < 1 || raw > MAX_LEGENDARY_RANK) return
        const v = atRank(raw)
        if (typeof v === 'number') vars[`Affix_Value_${i + 1}`] = v
      })
    }
    if (affix.desc) return renderTemplate(affix.desc, vars, collect)

    const parts = (affix.attributes ?? []).map((attr, i) => {
      const attrName = this.game.attributes[String(attr.id)]?.name
      if (!attrName) return null
      const paramName = attrName === 'Resistance' ? RESISTANCES[attr.param ?? 0] : undefined
      const template = this.game.attributeDescriptions[attrName]
      if (!template) return null
      const value = values[i] ?? values[0] ?? (typeof attr.value === 'number' ? attr.value : undefined)
      return renderTemplate(template, { value, value1: paramName ?? '', value2: value }, collect)
    })
    const text = parts.filter(Boolean).join(', ')
    return text || prettifyId(key)
  }
}

function itemRarity(item: RawItem): Rarity {
  if (item.mythic) return 'mythic'
  if (/_Unique_/i.test(item.id)) return 'unique'
  if (/Legendary/i.test(item.id) || item.aspects?.length) return 'legendary'
  if (/_Rare_/i.test(item.id)) return 'rare'
  if (/_Magic_/i.test(item.id)) return 'magic'
  return 'legendary'
}

const STAT_NAMES: Record<string, string> = { Str: 'Strength', Int: 'Intelligence', Dex: 'Dexterity', Will: 'Willpower' }

/** "Generic_Normal_Str" -> "+Strength", "Generic_Magic_HexDamage" -> "Hex Damage" */
export function genericNodeName(nodeName: string): string {
  const m = nodeName.match(/^Generic_(Normal|Magic)_(.+)$/)
  if (!m) return prettifyId(nodeName)
  const stat = STAT_NAMES[m[2]]
  if (stat) return m[1] === 'Normal' ? `+${stat}` : `+${stat} (magique)`
  return m[2].replace(/([a-z])([A-Z])/g, '$1 $2').replace(/Percent$/, ' %')
}

/** Rotation d'une case d'un plateau carré, par quarts de tour horaires. */
export function rotateIndex(index: number, width: number, quarterTurns: number): number {
  let x = index % width
  let y = Math.floor(index / width)
  for (let r = 0; r < quarterTurns; r++) [x, y] = [width - 1 - y, x]
  return y * width + x
}
