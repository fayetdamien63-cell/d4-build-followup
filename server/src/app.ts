import { existsSync } from 'node:fs'
import path from 'node:path'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyReply } from 'fastify'
import { countDone, variantKeys } from '../../shared/progress.ts'
import type { BuildSummary, BuildWithProgress } from '../../shared/types.ts'
import type { Store } from './db.ts'
import { fetchProfile, resolvePlanner, type RawProfileResponse } from './maxroll/client.ts'
import { getGameData, type GameData } from './maxroll/gameData.ts'
import { Normalizer } from './maxroll/normalize.ts'

export interface AppDeps {
  store: Store
  loadGameData: () => Promise<GameData>
  fetchProfile?: (plannerId: string) => Promise<RawProfileResponse>
  resolvePlanner?: typeof resolvePlanner
  webDist?: string
  logger?: boolean
}

export function defaultDeps(dataDir: string, store: Store): AppDeps {
  return { store, loadGameData: () => getGameData(path.join(dataDir, 'cache')) }
}

export function buildApp(deps: AppDeps) {
  const { store } = deps
  const fetchP = deps.fetchProfile ?? fetchProfile
  const resolveP = deps.resolvePlanner ?? resolvePlanner
  const app = Fastify({ logger: deps.logger ?? false })

  const withProgress = (id: number): BuildWithProgress | null => {
    const found = store.getBuild(id)
    return found ? { ...found, progress: store.getProgress(id) } : null
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

  app.get<{ Params: { id: string } }>('/api/builds/:id', async (req, reply) => withProgress(parseId(req.params.id)) ?? notFound(reply))

  /** Re-télécharge le build depuis Maxroll ; la progression est conservée (clés stables). */
  app.post<{ Params: { id: string } }>('/api/builds/:id/refresh', async (req, reply) => {
    const id = parseId(req.params.id)
    const found = store.getBuild(id)
    if (!found) return notFound(reply)
    const [raw, game] = await Promise.all([fetchP(found.build.sourceId), deps.loadGameData()])
    const { build } = new Normalizer(game).normalize(raw, found.build.sourceUrl)
    store.updateBuildData(id, build, raw)
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

  app.delete<{ Params: { id: string } }>('/api/builds/:id', async (req, reply) => {
    const id = parseId(req.params.id)
    if (!store.getBuild(id)) return notFound(reply)
    store.deleteBuild(id)
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
