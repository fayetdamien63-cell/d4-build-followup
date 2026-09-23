import { useState } from 'react'
import { affixTarget, parseRollInput, rollRatio, rollStatus } from '../../../shared/rolls.ts'
import type { Affix } from '../../../shared/types.ts'
import type { BuildState } from '../useBuild.ts'

const num = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })
export const formatRoll = (n: number) => num.format(n)

/** Saisie de la valeur obtenue en jeu pour un affixe, comparée à la cible du guide. */
export function RollControl({ affix, state }: { affix: Affix; state: BuildState }) {
  const actual = state.data?.rolls?.[affix.key]
  const target = affixTarget(affix)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [invalid, setInvalid] = useState(false)

  const start = () => {
    setDraft(actual !== undefined ? formatRoll(actual) : '')
    setInvalid(false)
    setEditing(true)
  }
  const commit = () => {
    if (!draft.trim()) {
      if (actual !== undefined) state.setRoll(affix.key, null)
      setEditing(false)
      return
    }
    const value = parseRollInput(draft)
    if (value === null) return setInvalid(true)
    if (value !== actual) state.setRoll(affix.key, value)
    setEditing(false)
  }

  if (editing) {
    return (
      <span className="roll-edit">
        <input
          className={`roll-input ${invalid ? 'is-invalid' : ''}`}
          inputMode="decimal"
          autoFocus
          value={draft}
          placeholder={target !== null ? formatRoll(target) : 'valeur'}
          aria-label={`Valeur obtenue pour ${affix.text}`}
          onChange={(e) => {
            setDraft(e.target.value)
            setInvalid(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          onBlur={commit}
        />
        {target !== null && <span className="roll-target">/ {formatRoll(target)}</span>}
      </span>
    )
  }

  if (actual === undefined) {
    return (
      <button className="roll-add" onClick={start} title="Saisir la valeur obtenue en jeu">
        + valeur
      </button>
    )
  }

  const ratio = rollRatio(actual, target)
  const status = ratio === null ? 'none' : rollStatus(ratio)
  return (
    <button
      className={`roll-pill roll-${status}`}
      onClick={start}
      title={target !== null ? `Obtenu ${formatRoll(actual)} — cible du guide ${formatRoll(target)}` : 'Modifier la valeur'}
    >
      {formatRoll(actual)}
      {ratio !== null && <span className="roll-ratio">{Math.round(ratio * 100)} %</span>}
    </button>
  )
}

export function QualityBadge({ score }: { score: number }) {
  const status = rollStatus(score)
  return (
    <span className={`quality quality-${status}`} title="Moyenne des valeurs saisies par rapport aux cibles du guide">
      Qualité {Math.round(score * 100)} %
    </span>
  )
}
