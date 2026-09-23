import { useState } from 'react'
import type { Category, DiffEntry, VariantDiff } from '../../../shared/labels.ts'
import type { UpdateCheck } from '../../../shared/types.ts'
import { formatDate } from '../format.ts'
import { Modal } from './Modal.tsx'

const CATEGORY_LABEL: Record<Category, string> = { skills: 'Compétences', paragon: 'Parangon', gear: 'Équipement' }

export function UpdateBanner({ check, onApply, applying }: { check: UpdateCheck; onApply: () => void; applying: boolean }) {
  const [open, setOpen] = useState(false)
  const diff = check.diff
  if (check.status !== 'update-available' || !diff) return null
  const touchedDone = diff.variants.reduce((n, v) => n + [...v.removed, ...v.changed].filter((e) => e.wasDone).length, 0)

  return (
    <>
      <div className="update-banner" role="status">
        <span className="update-dot" aria-hidden />
        <div className="update-text">
          <strong>Le guide a été mis à jour sur Maxroll {formatDate(check.remoteDate)}</strong>
          <span>
            {diff.total} changement{diff.total > 1 ? 's' : ''}
            {touchedDone > 0 && ` · ${touchedDone} concernant des éléments déjà validés`}
          </span>
        </div>
        <button className="btn btn-small btn-ghost" onClick={() => setOpen(true)}>
          Voir les changements
        </button>
        <button className="btn btn-small btn-primary" onClick={onApply} disabled={applying}>
          {applying && <span className="spinner" />} Appliquer
        </button>
      </div>
      {open && (
        <Modal
          title="Changements du guide"
          onClose={() => setOpen(false)}
          footer={
            <>
              <span className="muted small">Ta progression est conservée pour tous les éléments inchangés.</span>
              <button
                className="btn btn-primary"
                disabled={applying}
                onClick={() => {
                  setOpen(false)
                  onApply()
                }}
              >
                Appliquer la mise à jour
              </button>
            </>
          }
        >
          <p className="muted small diff-dates">
            Version suivie : {formatDate(check.localDate)} → Maxroll : {formatDate(check.remoteDate)}
          </p>
          {diff.variantsAdded.length > 0 && <p className="diff-note">Nouvelles variantes : {diff.variantsAdded.join(', ')}</p>}
          {diff.variantsRemoved.length > 0 && <p className="diff-note diff-note-bad">Variantes retirées : {diff.variantsRemoved.join(', ')}</p>}
          {diff.variants.map((v) => (
            <VariantDiffView key={v.variant} diff={v} />
          ))}
        </Modal>
      )}
    </>
  )
}

function VariantDiffView({ diff }: { diff: VariantDiff }) {
  const categories = (['gear', 'skills', 'paragon'] as Category[]).filter((c) =>
    [...diff.added, ...diff.removed, ...diff.changed].some((e) => e.category === c),
  )
  return (
    <section className="diff-variant">
      <h3>{diff.name}</h3>
      {categories.map((c) => (
        <div key={c} className="diff-category">
          <div className="affix-title">{CATEGORY_LABEL[c]}</div>
          <DiffLines entries={diff.changed.filter((e) => e.category === c)} kind="changed" />
          <DiffLines entries={diff.added.filter((e) => e.category === c)} kind="added" />
          <DiffLines entries={diff.removed.filter((e) => e.category === c)} kind="removed" />
        </div>
      ))}
    </section>
  )
}

const DIFF_LIMIT = 12

function DiffLines({ entries, kind }: { entries: DiffEntry[]; kind: 'added' | 'removed' | 'changed' }) {
  const [expanded, setExpanded] = useState(false)
  if (entries.length === 0) return null
  const shown = expanded ? entries : entries.slice(0, DIFF_LIMIT)
  const sign = kind === 'added' ? '+' : kind === 'removed' ? '−' : '~'
  return (
    <ul className={`diff-list diff-${kind}`}>
      {shown.map((e) => (
        <li key={e.key}>
          <span className="diff-sign">{sign}</span>
          <span className="diff-label">
            {e.before && <del>{e.before}</del>}
            {e.before && ' → '}
            {e.label}
            <span className="diff-context"> · {e.context}</span>
            {e.wasDone && <span className="badge badge-done">déjà validé</span>}
          </span>
        </li>
      ))}
      {entries.length > DIFF_LIMIT && (
        <li>
          <button className="link-btn" onClick={() => setExpanded((x) => !x)}>
            {expanded ? 'Réduire' : `+ ${entries.length - DIFF_LIMIT} autres`}
          </button>
        </li>
      )}
    </ul>
  )
}
