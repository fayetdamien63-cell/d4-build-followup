import { useEffect, useMemo, useState } from 'react'
import { describeBuild, type KeyInfo } from '../../../shared/labels.ts'
import type { Build, HistoryEvent } from '../../../shared/types.ts'
import { api } from '../api.ts'
import type { BuildState } from '../useBuild.ts'
import { Empty } from './ui.tsx'

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

function dayLabel(d: Date): string {
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  if (dayKey(d) === dayKey(today)) return "Aujourd'hui"
  if (dayKey(d) === dayKey(yesterday)) return 'Hier'
  const s = dayFmt.format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const UNKNOWN: KeyInfo = { label: 'Élément retiré du guide', context: '', category: 'gear', variant: -1 }

export function Journal({ build, variantIndex, state }: { build: Build; variantIndex: number; state: BuildState }) {
  const [events, setEvents] = useState<HistoryEvent[] | null>(null)
  const [allVariants, setAllVariants] = useState(false)
  const progress = state.data?.progress

  // Recharge le journal quand la progression change (petit délai pour grouper les clics rapides).
  useEffect(() => {
    const t = setTimeout(() => api.history(build.id).then(setEvents, () => setEvents([])), events ? 400 : 0)
    return () => clearTimeout(t)
  }, [build.id, progress])

  const labels = useMemo(() => describeBuild(build), [build])
  const info = (k: string) => labels.get(k) ?? UNKNOWN
  const variantOf = (k: string) => Number(k.match(/^v(\d+):/)?.[1] ?? -1)

  const filtered = useMemo(() => {
    if (!events) return []
    if (allVariants) return events
    return events
      .map((e) => ({ ...e, keys: e.keys.filter((k) => variantOf(k) === variantIndex) }))
      .filter((e) => e.keys.length > 0)
  }, [events, allVariants, variantIndex])

  // Compteurs basés sur l'état actuel (un élément coché puis décoché ne compte pas).
  const stats = useMemo(() => {
    const current = Object.entries(progress ?? {}).filter(([k]) => labels.has(k) && (allVariants || variantOf(k) === variantIndex))
    const weekAgo = Date.now() - 7 * 86_400_000
    const days = new Set(filtered.filter((e) => e.done).map((e) => dayKey(new Date(e.at))))
    return {
      total: current.length,
      week: current.filter(([, at]) => new Date(at).getTime() > weekAgo).length,
      days: days.size,
      milestones: current.filter(([k]) => info(k).milestone).length,
    }
  }, [filtered, labels, progress, allVariants, variantIndex])

  const groups = useMemo(() => {
    const byDay = new Map<string, { label: string; events: HistoryEvent[] }>()
    for (const e of filtered) {
      const d = new Date(e.at)
      const k = dayKey(d)
      if (!byDay.has(k)) byDay.set(k, { label: dayLabel(d), events: [] })
      byDay.get(k)!.events.push(e)
    }
    return [...byDay.values()]
  }, [filtered])

  if (events === null) return <div className="loading"><span className="spinner" /> Chargement du journal…</div>

  return (
    <div className="journal">
      <div className="journal-top">
        <div className="journal-stats">
          <div><strong>{stats.total}</strong><span>validations</span></div>
          <div><strong>{stats.week}</strong><span>ces 7 jours</span></div>
          <div><strong>{stats.days}</strong><span>jour{stats.days > 1 ? 's' : ''} actif{stats.days > 1 ? 's' : ''}</span></div>
          <div><strong>{stats.milestones}</strong><span>jalons ★</span></div>
        </div>
        <div className="segmented" role="group" aria-label="Portée du journal">
          <button className={!allVariants ? 'is-active' : ''} onClick={() => setAllVariants(false)}>Cette variante</button>
          <button className={allVariants ? 'is-active' : ''} onClick={() => setAllVariants(true)}>Toutes</button>
        </div>
      </div>

      {groups.length === 0 && <Empty>Rien pour l'instant : chaque case cochée apparaîtra ici, datée.</Empty>}

      {groups.map((g) => (
        <section key={g.label} className="journal-day">
          <h3>{g.label}</h3>
          <ol className="journal-events">
            {g.events.map((e) => (
              <JournalEvent key={e.id} event={e} info={info} showVariant={allVariants ? build.variants : null} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

function JournalEvent({
  event,
  info,
  showVariant,
}: {
  event: HistoryEvent
  info: (k: string) => KeyInfo
  showVariant: Build['variants'] | null
}) {
  const [open, setOpen] = useState(false)
  const infos = event.keys.map((k) => ({ key: k, ...info(k) }))
  const milestone = event.done ? infos.find((i) => i.milestone) : undefined
  const variantName = showVariant ? showVariant[infos[0].variant]?.name : null

  // Résumé par contexte : "Plateau Start (33) · Casque (10)"
  const contexts = new Map<string, number>()
  for (const i of infos) contexts.set(i.context, (contexts.get(i.context) ?? 0) + 1)

  const single = infos.length === 1
  return (
    <li className={`jevent ${event.done ? '' : 'is-undo'} ${milestone ? 'is-milestone' : ''} cat-${infos[0].category}`}>
      <time className="jevent-time" dateTime={event.at}>{timeFmt.format(new Date(event.at))}</time>
      <span className="jevent-icon" aria-hidden>{milestone ? '★' : event.done ? '✓' : '↺'}</span>
      <div className="jevent-body">
        {single ? (
          <span>
            {!event.done && <span className="muted">Décoché : </span>}
            <span className="jevent-label">{infos[0].label}</span>
            {infos[0].context && <span className="jevent-context"> · {infos[0].context}</span>}
          </span>
        ) : (
          <>
            <span>
              {milestone && <span className="jevent-label">{milestone.label} · </span>}
              <span className={milestone ? '' : 'jevent-label'}>
                {infos.length} éléments {event.done ? 'validés' : 'décochés'}
              </span>
              <span className="jevent-context">
                {' · '}
                {[...contexts].slice(0, 3).map(([c, n]) => `${c || 'Autre'} (${n})`).join(' · ')}
                {contexts.size > 3 && ` · +${contexts.size - 3}`}
              </span>
            </span>
            <button className="link-btn" onClick={() => setOpen((o) => !o)}>{open ? 'Masquer' : 'Détail'}</button>
            {open && (
              <ul className="jevent-details">
                {infos.map((i) => (
                  <li key={i.key}>{i.label}</li>
                ))}
              </ul>
            )}
          </>
        )}
        {variantName && <span className="pill pill-quiet">{variantName}</span>}
      </div>
    </li>
  )
}
