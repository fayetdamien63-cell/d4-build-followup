import { useMemo, useState } from 'react'
import { GearView } from '../components/GearView.tsx'
import { NextSteps } from '../components/NextSteps.tsx'
import { ParagonView } from '../components/ParagonView.tsx'
import { SkillsView } from '../components/SkillsView.tsx'
import { useToast } from '../components/Toasts.tsx'
import { ProgressBar, ProgressRing } from '../components/ui.tsx'
import { formatDate } from '../format.ts'
import { allGearKeys, paragonKeys, pct, skillKeys, stat } from '../stats.ts'
import { useBuild } from '../useBuild.ts'

export type Tab = 'next' | 'gear' | 'skills' | 'paragon'

const TABS: { id: Tab; label: string }[] = [
  { id: 'next', label: 'Prochaines étapes' },
  { id: 'gear', label: 'Équipement' },
  { id: 'skills', label: 'Compétences' },
  { id: 'paragon', label: 'Parangon' },
]

export function BuildPage({ id }: { id: number }) {
  const toast = useToast()
  const onError = (m: string) => toast(m, 'error')
  const state = useBuild(id, onError)
  const { data, error } = state
  const [tab, setTab] = useState<Tab>('next')
  const [paragonStep, setParagonStep] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const variant = data ? (data.build.variants[data.activeVariant] ?? data.build.variants[0]) : null

  const stats = useMemo(() => {
    if (!data || !variant) return null
    const p = data.progress
    const skills = stat(skillKeys(variant), p)
    const paragon = stat(paragonKeys(data.build, variant), p)
    const gear = stat(allGearKeys(variant), p)
    const total = { done: skills.done + paragon.done + gear.done, total: skills.total + paragon.total + gear.total }
    return { skills, paragon, gear, total }
  }, [data, variant])

  if (error) {
    return (
      <div className="page-error">
        <p>{error}</p>
        <a className="btn" href="#/">← Retour aux builds</a>
      </div>
    )
  }
  if (!data || !variant || !stats) return <div className="loading"><span className="spinner" /> Chargement du build…</div>

  const { build } = data

  async function onRefresh() {
    setRefreshing(true)
    try {
      await state.refresh()
      toast('Build mis à jour depuis Maxroll, ta progression est conservée.')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const goTo = (t: Tab, step?: number) => {
    if (step !== undefined) setParagonStep(step)
    setTab(t)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="build-page">
      <a className="back" href="#/">← Mes builds</a>

      <header className="build-header">
        <div className="build-header-main">
          <span className={`class-sigil class-sigil-lg class-${build.className.toLowerCase()}`}>{build.className.slice(0, 2)}</span>
          <div>
            <h1>{build.name}</h1>
            <div className="build-meta">
              <span>{build.className}</span>
              {build.season && <span>Saison {build.season}</span>}
              <span>Guide mis à jour {formatDate(build.sourceDate)}</span>
            </div>
            {(build.strengths.length > 0 || build.weaknesses.length > 0) && (
              <div className="traits">
                {build.strengths.map((s) => (
                  <span key={s} className="trait trait-good">+ {s}</span>
                ))}
                {build.weaknesses.map((s) => (
                  <span key={s} className="trait trait-bad">− {s}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="build-actions">
          <a className="btn btn-ghost" href={build.sourceUrl} target="_blank" rel="noreferrer">Maxroll ↗</a>
          <button className="btn btn-ghost" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <span className="spinner" /> : '↻'} Mettre à jour
          </button>
        </div>
      </header>

      <nav className="variants" aria-label="Variantes du build">
        {build.variants.map((v) => (
          <button
            key={v.index}
            className={`variant ${v.index === variant.index ? 'is-active' : ''} ${v.hidden ? 'is-hidden' : ''}`}
            onClick={() => {
              state.setVariant(v.index)
              setParagonStep(null)
            }}
            title={v.hidden ? 'Variante masquée dans le planner Maxroll' : undefined}
          >
            {v.name}
          </button>
        ))}
      </nav>

      <section className="overview">
        <ProgressRing stat={stats.total} label={variant.name} />
        <div className="overview-bars">
          {([
            ['skills', 'Compétences', stats.skills],
            ['paragon', 'Parangon', stats.paragon],
            ['gear', 'Équipement', stats.gear],
          ] as const).map(([t, label, s]) => (
            <button key={t} className="overview-row" onClick={() => goTo(t)}>
              <span className="overview-label">{label}</span>
              <ProgressBar stat={s} />
              <span className="overview-count">
                {s.done}/{s.total} <em>{pct(s)}%</em>
              </span>
            </button>
          ))}
        </div>
        <div className="overview-facts">
          {variant.level !== null && <div><span>Niveau</span><strong>{variant.level}</strong></div>}
          {variant.worldTierName && <div><span>Difficulté</span><strong>{variant.worldTierName}</strong></div>}
          <div><span>Objets</span><strong>{variant.gear.length}</strong></div>
        </div>
      </section>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="tab-panel" role="tabpanel">
        {tab === 'next' && <NextSteps build={build} variant={variant} state={state} goTo={goTo} />}
        {tab === 'gear' && <GearView variant={variant} state={state} />}
        {tab === 'skills' && <SkillsView variant={variant} state={state} />}
        {tab === 'paragon' && <ParagonView build={build} variant={variant} state={state} step={paragonStep} onStepChange={setParagonStep} />}
      </div>
    </div>
  )
}
