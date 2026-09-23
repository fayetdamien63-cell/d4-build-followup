import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { variantKeys, withImpliedKeys } from '../../shared/progress.ts'
import type { BuildWithProgress } from '../../shared/types.ts'
import { api } from './api.ts'

export interface BuildState {
  data: BuildWithProgress | null
  error: string | null
  isDone: (key: string) => boolean
  /** Coche/décoche (mise à jour optimiste, annulée si le serveur refuse). */
  setDone: (keys: string[], done: boolean) => void
  setVariant: (index: number) => void
  refresh: () => Promise<void>
}

export function useBuild(id: number, onError: (message: string) => void): BuildState {
  const [data, setData] = useState<BuildWithProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    setData(null)
    setError(null)
    api.getBuild(id).then(setData, (err: Error) => setError(err.message))
  }, [id])

  const allKeys = useMemo(
    () => (data ? variantKeys(data.build, data.build.variants[data.activeVariant] ?? data.build.variants[0]) : []),
    [data?.build, data?.activeVariant],
  )

  const setDone = useCallback(
    (keys: string[], done: boolean) => {
      const current = dataRef.current
      if (!current || keys.length === 0) return
      const expanded = withImpliedKeys(allKeys, keys, done)
      const previous = current.progress
      const next = { ...previous }
      const now = new Date().toISOString()
      for (const k of expanded) {
        if (done) next[k] ??= now
        else delete next[k]
      }
      setData({ ...current, progress: next })
      api.setProgress(id, expanded, done).catch((err: Error) => {
        setData((d) => (d ? { ...d, progress: previous } : d))
        onError(`Sauvegarde impossible : ${err.message}`)
      })
    },
    [id, allKeys, onError],
  )

  const setVariant = useCallback(
    (index: number) => {
      setData((d) => (d ? { ...d, activeVariant: index } : d))
      api.setActiveVariant(id, index).catch((err: Error) => onError(err.message))
    },
    [id, onError],
  )

  const refresh = useCallback(async () => {
    const fresh = await api.refreshBuild(id)
    setData(fresh)
  }, [id])

  const isDone = useCallback((key: string) => Boolean(data?.progress[key]), [data?.progress])

  return { data, error, isDone, setDone, setVariant, refresh }
}
