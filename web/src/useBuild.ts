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
  /** Valeur obtenue sur un affixe (null pour l'effacer) ; une valeur valide aussi l'affixe. */
  setRoll: (key: string, value: number | null) => void
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

  const setRoll = useCallback(
    (key: string, value: number | null) => {
      const current = dataRef.current
      if (!current) return
      const rolls = { ...(current.rolls ?? {}) }
      if (value === null) delete rolls[key]
      else rolls[key] = value
      const progress = value === null || current.progress[key] ? current.progress : { ...current.progress, [key]: new Date().toISOString() }
      setData({ ...current, rolls, progress })
      api.setRoll(id, key, value).then(
        (res) => setData((d) => (d ? { ...d, rolls: res.rolls, progress: res.progress } : d)),
        (err: Error) => {
          setData((d) => (d ? { ...d, rolls: current.rolls, progress: current.progress } : d))
          onError(`Sauvegarde impossible : ${err.message}`)
        },
      )
    },
    [id, onError],
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

  return { data, error, isDone, setDone, setVariant, setRoll, refresh }
}
