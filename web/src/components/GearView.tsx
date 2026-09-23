import { ancestralKey, gearKeys, masterworkKey } from '../../../shared/progress.ts'
import { slotQuality } from '../../../shared/rolls.ts'
import type { Affix, GearSlot, Variant } from '../../../shared/types.ts'
import { stat } from '../stats.ts'
import type { BuildState } from '../useBuild.ts'
import { formatDate } from '../format.ts'
import { formatRoll, QualityBadge, RollControl } from './Roll.tsx'
import { Check, Counter, Empty, ProgressBar } from './ui.tsx'

const RARITY_LABEL: Record<GearSlot['rarity'], string> = {
  normal: 'Normal',
  magic: 'Magique',
  rare: 'Rare',
  legendary: 'Légendaire',
  set: 'Set',
  unique: 'Unique',
  mythic: 'Mythique',
}

export function GearView({ variant, state }: { variant: Variant; state: BuildState }) {
  if (variant.gear.length === 0) return <Empty>Aucun équipement défini pour cette variante.</Empty>
  return (
    <>
      <UpgradePriorities variant={variant} state={state} />
      <div className="gear-grid">
        {variant.gear.map((slot) => (
          <GearCard key={slot.key} slot={slot} state={state} />
        ))}
      </div>
    </>
  )
}

const PRIORITY_LIMIT = 5

/** Objets dont les valeurs saisies sont les plus loin des cibles du guide. */
function UpgradePriorities({ variant, state }: { variant: Variant; state: BuildState }) {
  const rolls = state.data?.rolls ?? {}
  const rated = variant.gear
    .map((slot) => ({ slot, quality: slotQuality(slot, rolls) }))
    .filter((x): x is { slot: GearSlot; quality: NonNullable<typeof x.quality> } => x.quality !== null)

  if (rated.length === 0) {
    return (
      <p className="roll-hint">
        Astuce : clique sur <span className="roll-add roll-add-static">+ valeur</span> à côté d'un affixe pour saisir ce que tu as
        obtenu en jeu. L'app le compare au guide et te dit quoi améliorer en priorité.
      </p>
    )
  }
  const toImprove = rated.filter((r) => r.quality.weakest.length > 0).sort((a, b) => a.quality.score - b.quality.score)
  return (
    <section className="priorities">
      <header className="priorities-head">
        <h2>À améliorer en priorité</h2>
        <span className="muted small">
          {rated.length} objet{rated.length > 1 ? 's' : ''} évalué{rated.length > 1 ? 's' : ''} sur {variant.gear.length}
        </span>
      </header>
      {toImprove.length === 0 ? (
        <p className="done-note">✓ Toutes les valeurs saisies atteignent les cibles du guide.</p>
      ) : (
        <ol className="priority-list">
          {toImprove.slice(0, PRIORITY_LIMIT).map(({ slot, quality }) => {
            const w = quality.weakest[0]
            return (
              <li key={slot.key} className={`rarity-${slot.rarity}`}>
                <QualityBadge score={quality.score} />
                <div className="priority-body">
                  <span className="priority-slot">
                    {slot.slotLabel} · <span className="priority-item">{slot.name}</span>
                  </span>
                  <span className="priority-affix">
                    <strong>{formatRoll(w.actual)}</strong> / {formatRoll(w.target)} ({Math.round(w.ratio * 100)} %)
                    <span className="priority-affix-text" title={w.affix.text}>· {w.affix.text}</span>
                  </span>
                  {quality.weakest.length > 1 && (
                    <span className="muted small">
                      +{quality.weakest.length - 1} autre{quality.weakest.length > 2 ? 's' : ''} affixe{quality.weakest.length > 2 ? 's' : ''} sous la cible
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

export function GearCard({ slot, state }: { slot: GearSlot; state: BuildState }) {
  const { isDone, setDone, data } = state
  const keys = gearKeys(slot)
  const s = stat(keys, data?.progress ?? {})
  const complete = s.done === s.total
  const obtained = isDone(slot.key)
  const obtainedAt = data?.progress[slot.key]
  const quality = slotQuality(slot, data?.rolls ?? {})
  const ancestral = ancestralKey(slot)

  return (
    <article className={`gear-card rarity-${slot.rarity} ${obtained ? 'is-obtained' : ''} ${complete ? 'is-complete' : ''}`}>
      <header className="gear-head">
        <div className="gear-slot">
          <span>{slot.slotLabel}</span>
          <span className="gear-slot-right">
            {quality && <QualityBadge score={quality.score} />}
            <Counter stat={s} />
          </span>
        </div>
        <Check checked={obtained} onChange={(v) => setDone([slot.key], v)} className="gear-obtain" title="Objet obtenu">
          <span className="gear-name">{slot.name}</span>
          <span className="gear-sub">
            {RARITY_LABEL[slot.rarity]}
            {slot.baseType && ` · ${slot.baseType}`}
          </span>
          {obtainedAt && <span className="gear-date">Obtenu {formatDate(obtainedAt)}</span>}
        </Check>
        {ancestral && (
          <Check
            checked={isDone(ancestral)}
            onChange={(v) => setDone([ancestral], v)}
            className="chip-check chip-ancestral"
            title="Version primordiale (Ancestral en anglais) : puissance maximale et Greater Affixes possibles"
          >
            Primordial
          </Check>
        )}
        <ProgressBar stat={s} size="sm" />
      </header>

      <div className="gear-body">
        {slot.implicits.length > 0 && (
          <ul className="implicits">
            {slot.implicits.map((a) => (
              <li key={a.key}>{a.text}</li>
            ))}
          </ul>
        )}

        {slot.aspect && (
          <div className="affix-row aspect-line">
            <Check checked={isDone(slot.aspect.key)} onChange={(v) => setDone([slot.aspect!.key], v)} className="line">
              <span className="line-tag tag-aspect">Aspect</span>
              {slot.aspect.text}
            </Check>
            <RollControl affix={slot.aspect} state={state} />
          </div>
        )}

        {slot.affixes.length > 0 && <AffixList title="Affixes" affixes={slot.affixes} state={state} />}
        {slot.tempered.length > 0 && <AffixList title="Trempe" affixes={slot.tempered} state={state} />}

        <div className="gear-extras">
          {slot.sockets.map((s) => (
            <Check key={s.key} checked={isDone(s.key)} onChange={(v) => setDone([s.key], v)} className={`chip-check socket-${s.kind}`}>
              {s.name}
            </Check>
          ))}
          <Check checked={isDone(masterworkKey(slot))} onChange={(v) => setDone([masterworkKey(slot)], v)} className="chip-check chip-mw">
            Masterwork
          </Check>
        </div>

        {!complete && (
          <button className="link-btn" onClick={() => setDone(keys, true)}>
            Tout valider
          </button>
        )}
      </div>
    </article>
  )
}

function AffixList({ title, affixes, state }: { title: string; affixes: Affix[]; state: BuildState }) {
  return (
    <div className="affix-group">
      <div className="affix-title">{title}</div>
      {affixes.map((a) => (
        <div key={a.key} className="affix-row">
          <Check checked={state.isDone(a.key)} onChange={(v) => state.setDone([a.key], v)} className="line">
            {a.text}
            {a.greater && <span className="badge badge-ga" title="Greater Affix recherché">★ GA</span>}
            {a.masterwork && <span className="badge badge-mw" title="Cible des crits de masterwork">MW</span>}
          </Check>
          <RollControl affix={a} state={state} />
        </div>
      ))}
    </div>
  )
}
