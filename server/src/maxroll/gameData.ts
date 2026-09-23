// Données de jeu Maxroll (noms des objets, affixes, compétences, parangon…).
// Le fichier fait ~12 Mo : téléchargé une fois, gardé en cache disque et rafraîchi chaque semaine.
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { USER_AGENT } from './client.ts'

export const GAME_DATA_URL = 'https://assets-ng.maxroll.gg/d4-tools/game/data.min.json'
const MAX_AGE_MS = 7 * 24 * 3600 * 1000

export interface RawAffix {
  id: number
  desc?: string
  power?: string
  prefix?: string
  attributes?: { id: number; param?: number; value?: number | string; formula?: string }[]
}

export interface RawGameData {
  version: string
  affixes: Record<string, RawAffix>
  items: Record<string, { id: number; type?: string; name?: string; magicType?: number }>
  classes: Record<string, { nameMale: string }>
  skills: Record<string, { name: string; mods?: { id: number; name: string }[] }>
  skillTrees: Record<string, { nodes: { id: number; rewardId: string }[] }>
  skillTreeRewards: Record<string, { type: number; power?: string; ranks?: number; mod?: number }>
  paragonBoards: Record<string, { width: number; name?: string; nodes: (string | null)[] }>
  paragonNodes: Record<string, { name?: string; rarity?: number }>
  paragonGlyphs: Record<string, { name: string }>
  attributes: Record<string, { name: string }>
  attributeDescriptions: Record<string, string>
  itemTypes: Record<string, { name: string }>
  worldTiers?: { name: string }[]
}

export interface GameData extends RawGameData {
  affixById: Map<number, { key: string; affix: RawAffix }>
}

export function indexGameData(raw: RawGameData): GameData {
  const affixById = new Map<number, { key: string; affix: RawAffix }>()
  for (const [key, affix] of Object.entries(raw.affixes)) affixById.set(affix.id, { key, affix })
  return { ...raw, affixById }
}

let cached: Promise<GameData> | null = null

export function getGameData(cacheDir: string, { refresh = false } = {}): Promise<GameData> {
  if (!cached || refresh) {
    cached = loadGameData(cacheDir, refresh).catch((err: unknown) => {
      cached = null
      throw err
    })
  }
  return cached
}

async function loadGameData(cacheDir: string, refresh: boolean): Promise<GameData> {
  const file = path.join(cacheDir, 'game-data.json')
  const age = await stat(file).then((s) => Date.now() - s.mtimeMs).catch(() => Infinity)
  if (!refresh && age < MAX_AGE_MS) {
    return indexGameData(JSON.parse(await readFile(file, 'utf8')) as RawGameData)
  }
  try {
    const res = await fetch(GAME_DATA_URL, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    await mkdir(cacheDir, { recursive: true })
    await writeFile(file, text)
    return indexGameData(JSON.parse(text) as RawGameData)
  } catch (err) {
    // Hors ligne : on retombe sur le cache, même périmé.
    if (age !== Infinity) return indexGameData(JSON.parse(await readFile(file, 'utf8')) as RawGameData)
    throw new Error(`Impossible de télécharger les données de jeu Maxroll (${(err as Error).message})`)
  }
}
