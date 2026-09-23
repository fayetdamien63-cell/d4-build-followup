// Table de loot des boss : page "Boss Loot Table Cheat Sheet" de Maxroll, analysée et mise en cache.
// Chaque section (h2) = une source ; les objets y sont embarqués via data-d4-id (ID numérique du jeu).
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { LootSource } from '../../../shared/types.ts'
import { USER_AGENT } from './client.ts'

export const LOOT_URL = 'https://maxroll.gg/d4/resources/boss-loot-table-cheat-sheet'
const MAX_AGE_MS = 3 * 24 * 3600 * 1000

export interface LootTable {
  sourceUrl: string
  updatedAt: string | null
  sources: LootSource[]
}

const decode = (s: string) =>
  s
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
const text = (html: string) => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Sections purement informatives, sans intérêt pour le farm. */
const IGNORED = /^(summary|changelog|new season \d+ uniques)$/i

export function parseLootTable(html: string): LootTable {
  const updated = text(html.match(/Last Updated:?[\s\S]{0,200}?(?=<\/)/i)?.[0] ?? '').replace(/^Last Updated:?\s*/i, '')
  const sections = html.split(/<h2[^>]*>/).slice(1)
  const sources: LootSource[] = []
  for (const section of sections) {
    const name = text(section.split('</h2>')[0])
    if (!name || IGNORED.test(name)) continue

    // Champs "<strong>Libellé</strong>: valeur" du bloc Basic Information
    const fields: Record<string, string> = {}
    for (const li of section.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
      const m = li[1].match(/^([\s\S]*?<\/strong>[\s\S]*?)(?:<\/span>)?\s*:\s*([\s\S]*)$/)
      if (!m || !/<strong/.test(m[1])) continue
      const label = text(m[1])
      if (label) fields[label.toLowerCase()] = text(m[2])
    }
    const requirement = section.match(/<li[^>]*>[\s\S]*?(Requires[\s\S]*?)<\/li>/)?.[1]
    const location = section.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/)?.[1]
    const description = section.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1]

    const items: LootSource['items'] = []
    const seen = new Set<number>()
    for (const m of section.matchAll(/data-d4-id="(\d+)"[^>]*>([^<]*)</g)) {
      const id = Number(m[1])
      if (seen.has(id)) continue
      seen.add(id)
      items.push({ id, name: decode(m[2]).trim() })
    }
    if (items.length === 0) continue

    const key = fields['boss lair key']
    const kind: LootSource['kind'] = key
      ? 'boss'
      : /mythic/i.test(name)
        ? 'mythic'
        : /general unique pool/i.test(name)
          ? 'pool'
          : /rune/i.test(name)
            ? 'runes'
            : /trophies/i.test(name)
              ? 'trophy'
              : 'world'
    sources.push({
      id: slug(name),
      name,
      kind,
      key: key ?? null,
      activity: fields['activity required'] ?? fields['activity recommended'] ?? null,
      element: fields['element type'] ?? null,
      requirement: requirement ? text(requirement) : null,
      location: location ? text(location) : null,
      description: kind === 'boss' || !description ? null : text(description),
      items,
    })
  }
  return { sourceUrl: LOOT_URL, updatedAt: updated || null, sources }
}

let cached: { at: number; table: Promise<LootTable> } | null = null

export function getLootTable(cacheDir: string): Promise<LootTable> {
  if (!cached || Date.now() - cached.at > MAX_AGE_MS) {
    const table = loadLootTable(cacheDir).catch((err: unknown) => {
      cached = null
      throw err
    })
    cached = { at: Date.now(), table }
  }
  return cached.table
}

async function loadLootTable(cacheDir: string): Promise<LootTable> {
  const file = path.join(cacheDir, 'boss-loot.html')
  const age = await stat(file).then((s) => Date.now() - s.mtimeMs).catch(() => Infinity)
  if (age < MAX_AGE_MS) return parseLootTable(await readFile(file, 'utf8'))
  try {
    const res = await fetch(LOOT_URL, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    await mkdir(cacheDir, { recursive: true })
    await writeFile(file, html)
    return parseLootTable(html)
  } catch (err) {
    if (age !== Infinity) return parseLootTable(await readFile(file, 'utf8'))
    throw new Error(`Table de loot Maxroll inaccessible (${(err as Error).message})`)
  }
}
