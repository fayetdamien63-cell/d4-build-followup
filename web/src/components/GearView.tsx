import { gearKeys, masterworkKey } from '../../../shared/progress.ts'
import type { Affix, GearSlot, Variant } from '../../../shared/types.ts'
import { stat } from '../stats.ts'
import type { BuildState } from '../useBuild.ts'
import { formatDate } from '../format.ts'
import { Check, Counter, Empty, ProgressBar } from './ui.tsx'

const RARITY_LABEL: Record<GearSlot['rarity'], string> = {
  normal: 'Normal',
  magic: 'Magique',
  rare: 'Rare',
  legendary: 'Légendaire',
  unique: 'Unique',
  mythic: 'Mythique',
}

export function GearView({ variant, state }: { variant: Variant; state: BuildState }) {
  if (variant.gear.length === 0) return <Empty>Aucun équipement défini pour cette variante.</Empty>
  return (
    <div className="gear-grid">
      {variant.gear.map((slot) => (
        <GearCard key={slot.key} slot={slot} state={state} />
      ))}
    </div>
  )
}

export function GearCard({ slot, state }: { slot: GearSlot; state: BuildState }) {
  const { isDone, setDone, data } = state
  const keys = gearKeys(slot)
  const s = stat(keys, data?.progress ?? {})
  const complete = s.done === s.total
  const obtained = isDone(slot.key)
  const obtainedAt = data?.progress[slot.key]

  return (
    <article className={`gear-card rarity-${slot.rarity} ${obtained ? 'is-obtained' : ''} ${complete ? 'is-complete' : ''}`}>
      <header className="gear-head">
        <div className="gear-slot">
          <span>{slot.slotLabel}</span>
          <Counter stat={s} />
        </div>
        <Check checked={obtained} onChange={(v) => setDone([slot.key], v)} className="gear-obtain" title="Objet obtenu">
          <span className="gear-name">{slot.name}</span>
          <span className="gear-sub">
            {RARITY_LABEL[slot.rarity]}
            {slot.baseType && ` · ${slot.baseType}`}
          </span>
          {obtainedAt && <span className="gear-date">Obtenu {formatDate(obtainedAt)}</span>}
        </Check>
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
          <Check checked={isDone(slot.aspect.key)} onChange={(v) => setDone([slot.aspect!.key], v)} className="line aspect-line">
            <span className="line-tag tag-aspect">Aspect</span>
            {slot.aspect.text}
          </Check>
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
        <Check key={a.key} checked={state.isDone(a.key)} onChange={(v) => state.setDone([a.key], v)} className="line">
          {a.text}
          {a.greater && <span className="badge badge-ga" title="Greater Affix recherché">★ GA</span>}
          {a.masterwork && <span className="badge badge-mw" title="Cible des crits de masterwork">MW</span>}
        </Check>
      ))}
    </div>
  )
}
