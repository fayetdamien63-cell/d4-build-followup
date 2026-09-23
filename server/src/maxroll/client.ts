// Accès aux endpoints publics (non documentés) de Maxroll.
export const USER_AGENT = 'Mozilla/5.0 (d4-build-followup; usage personnel)'
const PROFILE_URL = 'https://planners.maxroll.gg/profiles/d4/'

export interface PlannerRef {
  plannerId: string
  /** Variante mise en avant par l'URL (ex: planner/abc#2), si fournie. */
  variantHint: number | null
}

export interface RawProfileResponse {
  id: string
  name: string
  class: string
  date?: string
  season?: string
  data: string
}

const ID_RE = /^[a-z0-9]{6,12}$/i

/** Analyse ce que l'utilisateur a collé, sans réseau. `guideUrl` si une page de guide doit être lue. */
export function parseInput(input: string): PlannerRef | { guideUrl: string } {
  const value = input.trim()
  if (ID_RE.test(value)) return { plannerId: value, variantHint: null }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Entrée non reconnue : colle une URL Maxroll (guide ou planner) ou un ID de planner.')
  }
  if (!/(^|\.)maxroll\.gg$/.test(url.hostname)) throw new Error('Seuls les liens maxroll.gg sont supportés pour le moment.')

  const planner = url.pathname.match(/\/d4\/planner\/([a-z0-9]+)/i) ?? url.pathname.match(/\/profiles\/d4\/([a-z0-9]+)/i)
  if (planner) {
    return { plannerId: planner[1], variantHint: hashToVariant(url.hash.replace('#', '')) }
  }
  if (url.pathname.startsWith('/d4/')) return { guideUrl: url.toString() }
  throw new Error("Ce lien Maxroll ne ressemble ni à un guide D4 ni à un planner.")
}

/** Trouve les planners référencés par une page de guide (widgets data-d4-profile ou liens /d4/planner/). */
export function extractPlannerRefs(html: string): PlannerRef[] {
  const refs: PlannerRef[] = []
  for (const m of html.matchAll(/data-d4-profile="([a-z0-9]+)"/gi)) refs.push({ plannerId: m[1], variantHint: null })
  for (const m of html.matchAll(/maxroll\.gg\\?\/d4\\?\/planner\\?\/([a-z0-9]{6,12})(?:#(\d+))?/gi)) {
    refs.push({ plannerId: m[1], variantHint: hashToVariant(m[2]) })
  }
  // Un même planner peut apparaître plusieurs fois : on garde la première occurrence avec un indice de variante.
  const byId = new Map<string, PlannerRef>()
  for (const ref of refs) {
    const known = byId.get(ref.plannerId)
    if (!known || (known.variantHint === null && ref.variantHint !== null)) byId.set(ref.plannerId, ref)
  }
  return [...byId.values()]
}

/** Le hash des liens planner (#1, #2…) est 1-indexé. */
function hashToVariant(hash: string | undefined): number | null {
  const n = Number.parseInt(hash ?? '', 10)
  return Number.isNaN(n) || n < 1 ? null : n - 1
}

export async function resolvePlanner(input: string): Promise<PlannerRef> {
  const parsed = parseInput(input)
  if ('plannerId' in parsed) return parsed
  const res = await fetch(parsed.guideUrl, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Guide inaccessible (HTTP ${res.status})`)
  const refs = extractPlannerRefs(await res.text())
  if (refs.length === 0) throw new Error('Aucun planner trouvé dans cette page de guide.')
  return refs[0]
}

export async function fetchProfile(plannerId: string): Promise<RawProfileResponse> {
  const res = await fetch(PROFILE_URL + encodeURIComponent(plannerId), { headers: { 'User-Agent': USER_AGENT } })
  if (res.status === 404) throw new Error(`Planner "${plannerId}" introuvable sur Maxroll.`)
  if (!res.ok) throw new Error(`Maxroll a répondu HTTP ${res.status}`)
  return (await res.json()) as RawProfileResponse
}
