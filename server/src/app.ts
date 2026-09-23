import { existsSync } from 'node:fs'
import path from 'node:path'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyReply } from 'fastify'
import { countDone, variantKeys } from '../../shared/progress.ts'
import { diffBuilds } from '../../shared/labels.ts'
import type { Build, BuildSummary, BuildWithProgress, FarmPlan, HistoryEvent, LanInfo, UpdateCheck } from '../../shared/types.ts'
import type { Store } from './db.ts'
import { fetchProfile, resolvePlanner, type RawProfileResponse } from './maxroll/client.ts'
import { getGameData, type GameData } from './maxroll/gameData.ts'
import { Normalizer } from './maxroll/normalize.ts'
import { getLootTable, type LootTable } from './maxroll/loot.ts'
import { buildFarmPlan } from './farm.ts'

export interface AppDeps {
  store: Store
  loadGameData: () => Promise<GameData>
  loadLootTable: () => Promise<LootTable>
  fetchProfile?: (plannerId: string) => Promise<RawProfileResponse>
  resolvePlanner?: typeof resolvePlanner
  webDist?: string
  logger?: boolean
  /** Adresses pour ouvrir l'app depuis un autre appareil du réseau local. */
  lanInfo?: () => LanInfo
  now?: () => number
}

/** Durée pendant laquelle une vérification de mise à jour est réutilisée. */
const UPDATE_CHECK_TTL_MS = 30 * 60 * 1000

export function defaultDeps(dataDir: string, store: Store): AppDeps {
  const cacheDir = path.join(dataDir, 'cache')
  return { store, loadGameData: () => getGameData(cacheDir), loadLootTable: () => getLootTable(cacheDir) }
}

export function buildApp(deps: AppDeps) {
  const { store } = deps
  const fetchP = deps.fetchProfile ?? fetchProfile
  const resolveP = deps.resolvePlanner ?? resolvePlanner
  const app = Fastify({ logger: deps.logger ?? false })
  const now = deps.now ?? Date.now
  const updateChecks = new Map<number, { at: number; result: UpdateCheck }>()

  const withProgress = (id: number): BuildWithProgress | null => {
    const found = store.getBuild(id)
    return found ? { ...found, progress: store.getProgress(id), rolls: store.getRolls(id) } : null
  }
  const notFound = (reply: FastifyReply) => reply.code(404).send({ error: 'Build introuvable' })
  const parseId = (raw: string) => Number.parseInt(raw, 10)

  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 502
    reply.code(status).send({ error: err.message })
  })

  app.get('/api/health', async () => ({ ok: true }))

  app.get('/api/builds', async (): Promise<BuildSummary[]> =>
    store.listBuilds().map(({ build, activeVariant }) => {
      const variant = build.variants[activeVariant] ?? build.variants[0]
      const keys = variant ? variantKeys(build, variant) : []
      return {
        id: build.id,
        name: build.name,
        className: build.className,
        season: build.season,
        sourceUrl: build.sourceUrl,
        sourceDate: build.sourceDate,
        importedAt: build.importedAt,
        activeVariant,
        variantName: variant?.name ?? '',
        done: countDone(keys, store.getProgress(build.id)),
        total: keys.length,
      }
    }),
  )

  app.post<{ Body: { input?: string } }>('/api/builds', async (req, reply) => {
    const input = req.body?.input?.trim()
    if (!input) return reply.code(400).send({ error: 'Colle une URL de guide ou de planner Maxroll.' })
    const ref = await resolveP(input)
    const existing = store.findBySource('maxroll', ref.plannerId)
    if (existing !== null) return reply.code(200).send({ id: existing, existed: true })

    const [raw, game] = await Promise.all([fetchP(ref.plannerId), deps.loadGameData()])
    const sourceUrl = /^https?:/.test(input) ? input : `https://maxroll.gg/d4/planner/${ref.plannerId}`
    const { build, activeVariant } = new Normalizer(game).normalize(raw, sourceUrl)
    const hinted = ref.variantHint !== null && ref.variantHint < build.variants.length ? ref.variantHint : activeVariant
    const id = store.insertBuild(build, raw, hinted)
    return reply.code(201).send({ id, existed: false })
  })

  app.get('/api/lan', async (): Promise<LanInfo> => deps.lanInfo?.() ?? { enabled: false, urls: [] })

  app.get<{ Params: { id: string } }>('/api/builds/:id/history', async (req, reply): Promise<HistoryEvent[] | FastifyReply> => {
    const id = parseId(req.params.id)
    if (!store.getBuild(id)) return notFound(reply)
    return store.getHistory(id)
  })

  /** Où farmer les uniques, mythiques et runes manquants d'une variante. */
  app.get<{ Params: { id: string }; Querystring: { variant?: string } }>('/api/builds/:id/farm', async (req, reply): Promise<FarmPlan | FastifyReply> => {
    const id = parseId(req.params.id)
    const found = store.getBuild(id)
    if (!found) return notFound(reply)
    const variant = req.query.variant !== undefined ? Number(req.query.variant) : found.activeVariant
    if (!found.build.variants[variant]) return reply.code(400).send({ error: 'Variante invalide' })
    const [loot, game] = await Promise.all([deps.loadLootTable(), deps.loadGameData()])
    return buildFarmPlan(found.build, variant, loot, game)
  })

  /** Compare le build local à la version actuelle sur Maxroll, sans rien modifier. */
  app.get<{ Params: { id: string }; Querystring: { force?: string } }>('/api/builds/:id/updates', async (req, reply) => {
    const id = parseId(req.params.id)
    const found = store.getBuild(id)
    if (!found) return notFound(reply)
    const cached = updateChecks.get(id)
    if (cached && !req.query.force && now() - cached.at < UPDATE_CHECK_TTL_MS) return cached.result

    const raw = await fetchP(found.build.sourceId)
    const local = found.build
    let result: UpdateCheck = {
      status: 'up-to-date',
      checkedAt: new Date(now()).toISOString(),
      localDate: local.sourceDate,
      remoteDate: raw.date ?? null,
    }
    if (raw.date !== local.sourceDate) {
      const { build: remote } = new Normalizer(await deps.loadGameData()).normalize(raw, local.sourceUrl)
      const diff = diffBuilds(local, { ...remote, id, importedAt: local.importedAt } as Build, store.getProgress(id))
      // Une date différente sans aucun changement visible (ex: simple réenregistrement) n'est pas une mise à jour.
      if (diff.total > 0) result = { ...result, status: 'update-available', diff }
    }
    updateChecks.set(id, { at: now(), result })
    return result
  })

  app.get<{ Params: { id: string } }>('/api/builds/:id', async (req, reply) => withProgress(parseId(req.params.id)) ?? notFound(reply))

  /** Re-télécharge le build depuis Maxroll ; la progression est conservée (clés stables). */
  app.post<{ Params: { id: string } }>('/api/builds/:id/refresh', async (req, reply) => {
    const id = parseId(req.params.id)
    const found = store.getBuild(id)
    if (!found) return notFound(reply)
    const [raw, game] = await Promise.all([fetchP(found.build.sourceId), deps.loadGameData()])
    const { build } = new Normalizer(game).normalize(raw, found.build.sourceUrl)
    store.updateBuildData(id, build, raw)
    updateChecks.delete(id)
    return withProgress(id)
  })

  app.patch<{ Params: { id: string }; Body: { activeVariant?: number } }>('/api/builds/:id', async (req, reply) => {
    const id = parseId(req.params.id)
    const found = store.getBuild(id)
    if (!found) return notFound(reply)
    const v = req.body?.activeVariant
    if (typeof v !== 'number' || !found.build.variants[v]) return reply.code(400).send({ error: 'Variante invalide' })
    store.setActiveVariant(id, v)
    return { ok: true }
  })

  app.put<{ Params: { id: string }; Body: { keys?: string[]; done?: boolean } }>('/api/builds/:id/progress', async (req, reply) => {
    const id = parseId(req.params.id)
    if (!store.getBuild(id)) return notFound(reply)
    const { keys, done } = req.body ?? {}
    if (!Array.isArray(keys) || typeof done !== 'boolean' || keys.some((k) => typeof k !== 'string')) {
      return reply.code(400).send({ error: 'Format attendu : { keys: string[], done: boolean }' })
    }
    store.setProgress(id, keys, done)
    return { progress: store.getProgress(id) }
  })

  /** Valeur obtenue sur un affixe ; la renseigner valide aussi l'affixe (et l'inscrit au journal). */
  app.put<{ Params: { id: string }; Body: { key?: string; value?: number | null } }>('/api/builds/:id/rolls', async (req, reply) => {
    const id = parseId(req.params.id)
    if (!store.getBuild(id)) return notFound(reply)
    const { key, value } = req.body ?? {}
    const validValue = value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)
    if (typeof key !== 'string' || !key || !validValue) {
      return reply.code(400).send({ error: 'Format attendu : { key: string, value: number >= 0 | null }' })
    }
    store.setRoll(id, key, value ?? null)
    if (value !== null && value !== undefined) store.setProgress(id, [key], true)
    return { rolls: store.getRolls(id), progress: store.getProgress(id) }
  })

  app.delete<{ Params: { id: string } }>('/api/builds/:id', async (req, reply) => {
    const id = parseId(req.params.id)
    if (!store.getBuild(id)) return notFound(reply)
    store.deleteBuild(id)
    updateChecks.delete(id)
    return reply.code(204).send()
  })

  // En production, le serveur sert aussi le front compilé.
  if (deps.webDist && existsSync(deps.webDist)) {
    app.register(fastifyStatic, { root: deps.webDist })
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith('/api/') ? reply.code(404).send({ error: 'Route inconnue' }) : reply.sendFile('index.html'),
    )
  }

  return app
}
