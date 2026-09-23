// Modèle normalisé d'un build, indépendant de la source (Maxroll aujourd'hui).
// Chaque élément cochable porte une `key` stable, utilisée pour stocker la progression.

export type Rarity = 'normal' | 'magic' | 'rare' | 'legendary' | 'unique' | 'mythic'

export interface Build {
  id: number
  source: 'maxroll'
  sourceId: string
  sourceUrl: string
  name: string
  className: string
  season: string | null
  /** Date de dernière mise à jour du build côté source. */
  sourceDate: string | null
  importedAt: string
  gameVersion: string
  strengths: string[]
  weaknesses: string[]
  variants: Variant[]
  /** Grilles de parangon partagées entre étapes et variantes, par `gridId` (plateau + rotation). */
  paragonGrids: Record<string, ParagonGrid>
}

export interface ParagonGrid {
  width: number
  /** Cases du plateau déjà tournées (null = vide). */
  cells: (ParagonCell | null)[]
}

export interface Variant {
  index: number
  name: string
  level: number | null
  worldTier: number | null
  worldTierName: string | null
  /** Variante marquée comme masquée dans le planner (souvent le leveling). */
  hidden: boolean
  skillBar: SkillRef[]
  skillSteps: SkillStep[]
  paragonSteps: ParagonStep[]
  gear: GearSlot[]
}

export interface SkillRef {
  id: string
  name: string
}

export interface SkillStep {
  name: string
  /** Uniquement les nœuds nouveaux ou montés de rang par rapport à l'étape précédente. */
  nodes: SkillNode[]
}

export interface SkillNode {
  key: string
  nodeId: number
  name: string
  /** Nom de la compétence parente pour les modificateurs (upgrades). */
  parent: string | null
  kind: 'skill' | 'upgrade' | 'passive' | 'other'
  rank: number
  maxRank: number | null
}

export interface ParagonStep {
  name: string
  boards: ParagonBoardStep[]
}

export interface ParagonBoardStep {
  key: string
  boardId: string
  name: string
  /** Position dans l'ordre du plateau (0 = plateau de départ). */
  order: number
  /** Plateau de départ : toujours débloqué, sa clé de plateau n'est pas à cocher. */
  isStart: boolean
  rotation: number
  glyph: { key: string; id: string; name: string; level: number | null } | null
  gridId: string
  /** Préfixe des clés de nœuds : clé = keyPrefix + cell.src */
  keyPrefix: string
  /** Positions (dans la grille) des nœuds alloués à cette étape, cumulés. */
  allocated: number[]
  /** Indices nouvellement alloués à cette étape. */
  added: number[]
}

export interface ParagonCell {
  /** Index d'origine (non tourné) dans le plateau Maxroll : sert à la clé de progression. */
  src: number
  name: string
  rarity: 'normal' | 'magic' | 'rare' | 'legendary' | 'gate' | 'socket' | 'start'
}

export interface GearSlot {
  key: string
  slot: string
  slotLabel: string
  itemId: string
  name: string
  baseType: string | null
  rarity: Rarity
  power: number | null
  aspect: Affix | null
  affixes: Affix[]
  implicits: Affix[]
  tempered: Affix[]
  sockets: Socket[]
}

export interface Affix {
  key: string
  id: string
  text: string
  greater: boolean
  /** Affixe ciblé par les crits de masterwork. */
  masterwork: boolean
}

export interface Socket {
  key: string
  id: string
  name: string
  kind: 'gem' | 'rune' | 'other'
}

export interface BuildSummary {
  id: number
  name: string
  className: string
  season: string | null
  sourceUrl: string
  sourceDate: string | null
  importedAt: string
  activeVariant: number
  variantName: string
  done: number
  total: number
}

export interface BuildWithProgress {
  build: Build
  activeVariant: number
  /** key -> date ISO de complétion */
  progress: Record<string, string>
}

export interface HistoryEvent {
  id: number
  at: string
  done: boolean
  keys: string[]
}

export interface UpdateCheck {
  status: 'up-to-date' | 'update-available'
  checkedAt: string
  localDate: string | null
  remoteDate: string | null
  /** Présent si une mise à jour est disponible. */
  diff?: import('./labels.ts').BuildDiff
}

export interface LanInfo {
  enabled: boolean
  urls: string[]
}
