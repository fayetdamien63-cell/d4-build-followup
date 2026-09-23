import { afterAll, describe, expect, it } from 'vitest'
import type { BuildSummary, BuildWithProgress } from '../../shared/types.ts'
import { buildApp } from './app.ts'
import { Store } from './db.ts'
import { gameData, profile } from './testFixtures.ts'

const app = buildApp({
  store: new Store(':memory:'),
  loadGameData: async () => gameData,
  fetchProfile: async () => profile,
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

  it('change de variante active et valide l’indice', async () => {
    expect((await app.inject({ method: 'PATCH', url: `/api/builds/${id}`, payload: { activeVariant: 0 } })).statusCode).toBe(200)
    expect((await app.inject({ method: 'PATCH', url: `/api/builds/${id}`, payload: { activeVariant: 9 } })).statusCode).toBe(400)
  })

  it('rafraîchit en conservant la progression', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/builds/${id}/refresh` })
    expect((res.json() as BuildWithProgress).progress).toHaveProperty('v1:gear:4')
  })

  it('supprime le build et sa progression', async () => {
    expect((await app.inject({ method: 'DELETE', url: `/api/builds/${id}` })).statusCode).toBe(204)
    expect((await app.inject({ url: `/api/builds/${id}` })).statusCode).toBe(404)
  })
})
