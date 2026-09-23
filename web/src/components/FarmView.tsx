import type { FarmPlan, FarmSource, FarmTarget } from '../../../shared/types.ts'
import type { Tab } from '../pages/BuildPage.tsx'
import type { BuildState } from '../useBuild.ts'
import { Check, Empty } from './ui.tsx'

const KIND_LABEL: Record<FarmSource['kind'], string> = {
  boss: 'Boss',
  mythic: 'Mythiques',
  pool: 'Pool général',
  runes: 'Runes',
  trophy: 'Trophées',
  world: 'Monde',
}

/** Sources avec au moins un objet encore manquant. */
export function pendingSources(plan: FarmPlan, isDone: (k: string) => boolean): (FarmSource & { remaining: FarmTarget[] })[] {
  return plan.sources
    .map((s) => ({ ...s, remaining: s.targets.filter((t) => !isDone(t.key)) }))
    .filter((s) => s.remaining.length > 0)
}

/** Index clé d'objet -> source principale, pour afficher "où le trouver" ailleurs dans l'app. */
export function sourceByKey(plan: FarmPlan | null): Map<string, FarmSource> {
  const map = new Map<string, FarmSource>()
  for (const s of plan?.sources ?? []) for (const t of s.targets) map.set(t.key, s)
  return map
}

export function FarmView({ plan, error, state, goTo }: { plan: FarmPlan | null; error: string | null; state: BuildState; goTo: (t: Tab) => void }) {
  if (error) return <Empty>Plan de farm indisponible : {error}</Empty>
  if (!plan) return <div className="loading"><span className="spinner" /> Consultation des tables de loot…</div>

  const { isDone, setDone } = state
  const pending = pendingSources(plan, isDone)
  const done = plan.sources.filter((s) => !pending.some((p) => p.id === s.id))
  const bosses = pending.filter((s) => s.kind === 'boss')
  const best = bosses[0] ?? pending[0]
  const missing = pending.reduce((n, s) => n + s.remaining.length, 0)
  const unmatched = plan.unmatched.filter((t) => !isDone(t.key))

  if (plan.sources.length === 0 && plan.unmatched.length === 0) {
    return <Empty>Ce build n'utilise ni unique, ni mythique, ni rune à farmer : tout se trouve en jouant.</Empty>
  }

  return (
    <div className="farm">
      {best ? (
        <section className="farm-hero">
          <div className="farm-hero-label">Prochaine cible</div>
          <h2>{best.name}</h2>
          <p>
            {best.remaining.length} objet{best.remaining.length > 1 ? 's' : ''} pour ton build :{' '}
            <strong>{best.remaining.map((t) => t.name).join(', ')}</strong>
          </p>
          <SourceFacts source={best} />
          <div className="farm-hero-foot muted small">
            {missing} objet{missing > 1 ? 's' : ''} à farmer au total, chez {pending.length} source{pending.length > 1 ? 's' : ''}
          </div>
        </section>
      ) : (
        <div className="all-done">
          <div className="all-done-mark">✦</div>
          <h2>Tout est farmé</h2>
          <p className="muted">Uniques, mythiques et runes du build sont obtenus. Place au masterwork !</p>
          <button className="link-btn" onClick={() => goTo('gear')}>Voir l'équipement →</button>
        </div>
      )}

      <div className="farm-grid">
        {pending.map((s) => (
          <article key={s.id} className={`farm-card kind-${s.kind} ${s === best ? 'is-best' : ''}`}>
            <header className="farm-card-head">
              <span className="farm-kind">{KIND_LABEL[s.kind]}</span>
              <h3>{s.name}</h3>
            </header>
            <SourceFacts source={s} />
            <div className="farm-targets">
              {s.targets.map((t) => (
                <Check key={t.key} checked={isDone(t.key)} onChange={(v) => setDone([t.key], v)} className={`line farm-target rarity-${t.rarity}`}>
                  <span className="farm-target-name">{t.name}</span>
                  <span className="farm-target-slot">
                    {t.slotLabel}
                    {t.alsoIn.length > 0 && ` · aussi : ${t.alsoIn.join(', ')}`}
                  </span>
                </Check>
              ))}
            </div>
          </article>
        ))}

        {unmatched.length > 0 && (
          <article className="farm-card kind-unknown">
            <header className="farm-card-head">
              <span className="farm-kind">?</span>
              <h3>Source non répertoriée</h3>
            </header>
            <p className="muted small">Absents de la table de loot Maxroll (souvent des objets de saison ou d'activité spéciale).</p>
            <div className="farm-targets">
              {unmatched.map((t) => (
                <Check key={t.key} checked={isDone(t.key)} onChange={(v) => setDone([t.key], v)} className={`line farm-target rarity-${t.rarity}`}>
                  <span className="farm-target-name">{t.name}</span>
                  <span className="farm-target-slot">{t.slotLabel}</span>
                </Check>
              ))}
            </div>
          </article>
        )}
      </div>

      {done.length > 0 && (
        <p className="farm-done muted small">✓ Terminé chez : {done.map((s) => s.name).join(', ')}</p>
      )}
      <p className="farm-credit muted small">
        Tables de loot : <a href={plan.sourceUrl} target="_blank" rel="noreferrer">Maxroll · Boss Loot Table Cheat Sheet</a>
        {plan.updatedAt && ` (mise à jour : ${plan.updatedAt})`}
      </p>
    </div>
  )
}

function SourceFacts({ source }: { source: FarmSource }) {
  const facts = [
    source.key && ['Clé', source.key],
    source.activity && ['Activité', source.activity],
    source.location && ['Lieu', source.location],
    source.element && ['Élément', source.element],
  ].filter(Boolean) as [string, string][]
  if (facts.length === 0 && !source.description) return null
  return (
    <dl className="farm-facts">
      {facts.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
      {facts.length === 0 && source.description && <dd className="farm-desc">{source.description}</dd>}
    </dl>
  )
}
