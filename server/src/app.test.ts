import { afterAll, describe, expect, it } from 'vitest'
import type { BuildSummary, BuildWithProgress, FarmPlan, HistoryEvent, UpdateCheck } from '../../shared/types.ts'
import type { RawProfileResponse } from './maxroll/client.ts'
import { buildApp } from './app.ts'
import { Store } from './db.ts'
import { parseLootTable } from './maxroll/loot.ts'
import { gameData, lootHtml, profile } from './testFixtures.ts'

let remote: RawProfileResponse = profile
let clock = 0
const app = buildApp({
  store: new Store(':memory:'),
  loadGameData: async () => gameData,
  loadLootTable: async () => parseLootTable(lootHtml),
  fetchProfile: async () => remote,
  now: () => clock,
  resolvePlanner: async (input) => ({ plannerId: input.includes('test1234') ? 'test1234' : 'other', variantHint: null }),
})
afterAll(() => app.close())

describe('API', () => {
  let id: number

  it('importe un build puis le retrouve sans doublon', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/builds', payload: { input: 'https://maxroll.gg/d4/planner/test1234' } })
    expect(res.statusCode).toBe(201)
    id = res.json().id
    const again = await app.inject({ method: 'POST', url: '/api/builds', payload: { input: 'test1234' } })
    expect(again.json()).toEqual({ id, existed: true })
  })

  it('refuse une entrée vide', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/builds', payload: { input: ' ' } })
    expect(res.statusCode).toBe(400)
  })

  it('coche et décoche des éléments, et le résumé suit', async () => {
    const put = (keys: string[], done: boolean) => app.inject({ method: 'PUT', url: `/api/builds/${id}/progress`, payload: { keys, done } })
    await put(['v1:gear:4', 'v1:gear:14'], true)
    await put(['v1:gear:14'], false)

    const detail = (await app.inject({ url: `/api/builds/${id}` })).json() as BuildWithProgress
    expect(Object.keys(detail.progress)).toEqual(['v1:gear:4'])
    expect(detail.activeVariant).toBe(1)

    const [summary] = (await app.inject({ url: '/api/builds' })).json() as BuildSummary[]
    expect(summary).toMatchObject({ id, variantName: 'Endgame', done: 1 })
    expect(summary.total).toBeGreaterThan(10)
  })

  it('journalise les actions, sans doublon pour les clés déjà dans cet état', async () => {
    await app.inject({ method: 'PUT', url: `/api/builds/${id}/progress`, payload: { keys: ['v1:gear:4'], done: true } })
    const history = (await app.inject({ url: `/api/builds/${id}/history` })).json() as HistoryEvent[]
    // 3 actions précédentes (cocher 2, décocher 1) ; la 4e ne change rien donc n'est pas journalisée.
    expect(history.map((e) => [e.done, e.keys])).toEqual([
      [false, ['v1:gear:14']],
      [true, ['v1:gear:4', 'v1:gear:14']],
    ])
  })

  it('détecte une mise à jour du guide et en donne le diff', async () => {
    const upToDate = (await app.inject({ url: `/api/builds/${id}/updates` })).json() as UpdateCheck
    expect(upToDate.status).toBe('up-to-date')

    const data = JSON.parse(profile.data)
    data.items['1'].explicits[1].values = [2500] // l'affixe de vie du casque change
    data.profiles[1].items = { '4': 1 } // les jambières disparaissent de l'Endgame
    remote = { ...profile, date: '2026-09-25 10:00:00', data: JSON.stringify(data) }

    // Résultat en cache tant que le délai n'est pas écoulé…
    expect(((await app.inject({ url: `/api/builds/${id}/updates` })).json() as UpdateCheck).status).toBe('up-to-date')
    // … sauf si on force la vérification.
    const check = (await app.inject({ url: `/api/builds/${id}/updates?force=1` })).json() as UpdateCheck
    expect(check).toMatchObject({ status: 'update-available', remoteDate: '2026-09-25 10:00:00' })
    const endgame = check.diff!.variants.find((v) => v.name === 'Endgame')!
    expect(endgame.changed).toEqual([
      expect.objectContaining({ key: 'v1:gear:4:affix:1', before: '+2,000 Maximum Life (GA)', label: '+2,500 Maximum Life (GA)' }),
    ])
    expect(endgame.removed.map((e) => e.key)).toContain('v1:gear:14:aspect')
    // Ni les jambières (décochées plus haut) ni l'affixe modifié n'étaient validés : pas d'alerte.
    expect(endgame.removed.find((e) => e.key === 'v1:gear:14')?.wasDone).toBeUndefined()
    expect(endgame.changed[0].wasDone).toBeUndefined()
  })

  it('calcule le plan de farm de la variante active', async () => {
    const plan = (await app.inject({ url: `/api/builds/${id}/farm` })).json() as FarmPlan
    expect(plan.variant).toBe(1)
    expect(plan.sources.map((s) => s.name)).toEqual(['Lord Test', 'Rune Drops'])
    expect((await app.inject({ url: `/api/builds/${id}/farm?variant=7` })).statusCode).toBe(400)
  })

  it('change de variante active et valide l’indice', async () => {
    expect((await app.inject({ method: 'PATCH', url: `/api/builds/${id}`, payload: { activeVariant: 0 } })).statusCode).toBe(200)
    expect((await app.inject({ method: 'PATCH', url: `/api/builds/${id}`, payload: { activeVariant: 9 } })).statusCode).toBe(400)
  })

  it('rafraîchit en conservant la progression', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/builds/${id}/refresh` })
    const fresh = res.json() as BuildWithProgress
    expect(fresh.progress).toHaveProperty('v1:gear:4')
    expect(fresh.build.sourceDate).toBe('2026-09-25 10:00:00')
    const check = (await app.inject({ url: `/api/builds/${id}/updates` })).json() as UpdateCheck
    expect(check.status).toBe('up-to-date')
  })

  it('expose l’état du mode réseau local', async () => {
    expect((await app.inject({ url: '/api/lan' })).json()).toEqual({ enabled: false, urls: [] })
  })

  it('supprime le build et sa progression', async () => {
    expect((await app.inject({ method: 'DELETE', url: `/api/builds/${id}` })).statusCode).toBe(204)
    expect((await app.inject({ url: `/api/builds/${id}` })).statusCode).toBe(404)
  })
})
