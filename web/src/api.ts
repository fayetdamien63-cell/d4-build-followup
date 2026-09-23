import type { BuildSummary, BuildWithProgress, HistoryEvent, LanInfo, UpdateCheck } from '../../shared/types.ts'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Erreur HTTP ${res.status}`)
  return body as T
}

export const api = {
  listBuilds: () => request<BuildSummary[]>('/api/builds'),
  importBuild: (input: string) =>
    request<{ id: number; existed: boolean }>('/api/builds', { method: 'POST', body: JSON.stringify({ input }) }),
  getBuild: (id: number) => request<BuildWithProgress>(`/api/builds/${id}`),
  refreshBuild: (id: number) => request<BuildWithProgress>(`/api/builds/${id}/refresh`, { method: 'POST' }),
  deleteBuild: (id: number) => request<void>(`/api/builds/${id}`, { method: 'DELETE' }),
  setActiveVariant: (id: number, activeVariant: number) =>
    request<{ ok: true }>(`/api/builds/${id}`, { method: 'PATCH', body: JSON.stringify({ activeVariant }) }),
  history: (id: number) => request<HistoryEvent[]>(`/api/builds/${id}/history`),
  checkUpdates: (id: number, force = false) => request<UpdateCheck>(`/api/builds/${id}/updates${force ? '?force=1' : ''}`),
  lan: () => request<LanInfo>('/api/lan'),
  setProgress: (id: number, keys: string[], done: boolean) =>
    request<{ progress: Record<string, string> }>(`/api/builds/${id}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ keys, done }),
    }),
}
