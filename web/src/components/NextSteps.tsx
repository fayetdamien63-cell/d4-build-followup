import { useState } from 'react'
import { boardKeys } from '../../../shared/progress.ts'
import type { Build, FarmSource, Variant } from '../../../shared/types.ts'
import type { Tab } from '../pages/BuildPage.tsx'
import { gearTodos, stat, tierLabel } from '../stats.ts'
import type { BuildState } from '../useBuild.ts'
import { currentParagonStep } from './ParagonView.tsx'
import { SkillStepCard } from './SkillsView.tsx'
import { Check, Counter, ProgressBar } from './ui.tsx'

const GEAR_TODO_LIMIT = 8

export function NextSteps({
  build,
  variant,
  state,
  goTo,
  farmSources,
}: {
  build: Build
  variant: Variant
  state: BuildState
  goTo: (t: Tab, step?: number) => void
  farmSources: Map<string, FarmSource>
}) {
  const { isDone, setDone } = state
  const progress = state.data?.progress ?? {}
  // Ce qui vient d'être coché ici reste affiché (barré) : la liste ne bouge pas sous le curseur.
  const [sticky, setSticky] = useState<Set<string>>(() => new Set())
  const check = (key: string, done: boolean) => {
    setSticky((s) => new Set(s).add(key))
    setDone([key], done)
  }

  const skillIndex = variant.skillSteps.findIndex((s) => s.nodes.some((n) => !isDone(n.key)))
  const skillStep = skillIndex >= 0 ? variant.skillSteps[skillIndex] : null

  const paragonIndex = currentParagonStep(build, variant, isDone)
  const paragonStep = variant.paragonSteps[paragonIndex]
  const paragonBoards = (paragonStep?.boards ?? [])
    .map((b) => ({ board: b, stat: stat(boardKeys(build, b), progress) }))
    .filter((x) => x.stat.done < x.stat.total)

  const todos = gearTodos(variant, (k) => isDone(k) && !sticky.has(k))
  const shownTodos = todos.slice(0, GEAR_TODO_LIMIT)
  const remaining = todos.filter((t) => !isDone(t.key)).length

  if (!skillStep && paragonBoards.length === 0 && todos.every((t) => isDone(t.key))) {
    return (
      <div className="all-done">
        <div className="all-done-mark">✦</div>
        <h2>Variante « {variant.name} » terminée</h2>
        <p className="muted">Tout est validé. Passe à la variante suivante ou va pousser les Pits !</p>
      </div>
    )
  }

  return (
    <div className="next-grid">
      <section className="next-col">
        <header className="next-head">
          <h2>Compétences</h2>
          <button className="link-btn" onClick={() => goTo('skills')}>Arbre complet →</button>
        </header>
        {skillStep ? (
          <>
            <p className="next-context">
              Étape {skillIndex + 1}/{variant.skillSteps.length}
            </p>
            <ol className="timeline timeline-compact">
              <SkillStepCard step={skillStep} index={skillIndex} state={state} />
            </ol>
          </>
        ) : (
          <p className="done-note">✓ Toutes les compétences sont en place.</p>
        )}
      </section>

      <section className="next-col">
        <header className="next-head">
          <h2>Parangon</h2>
          <button className="link-btn" onClick={() => goTo('paragon', paragonIndex)}>Plateaux →</button>
        </header>
        {paragonBoards.length > 0 ? (
          <>
            <p className="next-context">
              Étape « {paragonStep.name} » · {paragonIndex + 1}/{variant.paragonSteps.length}
            </p>
            <div className="next-boards">
              {paragonBoards.map(({ board, stat: s }) => (
                <button key={board.key} className="next-board" onClick={() => goTo('paragon', paragonIndex)}>
                  <div className="next-board-top">
                    <span className="board-order">{board.order + 1}</span>
                    <span className="next-board-name">{board.name}</span>
                    <Counter stat={s} />
                  </div>
                  <ProgressBar stat={s} size="sm" />
                  <div className="next-board-todo muted small">
                    {!board.isStart && !isDone(board.key) && <span>Débloquer le plateau</span>}
                    {board.glyph && !isDone(board.glyph.key) && (
                      <span>
                        Glyphe {board.glyph.name}
                        {board.glyph.level !== null && ` niv. ${board.glyph.level}`}
                      </span>
                    )}
                    <span>{s.total - s.done} élément{s.total - s.done > 1 ? 's' : ''} restant{s.total - s.done > 1 ? 's' : ''}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="done-note">✓ Parangon complet.</p>
        )}
      </section>

      <section className="next-col">
        <header className="next-head">
          <h2>Équipement</h2>
          <button className="link-btn" onClick={() => goTo('gear')}>Tous les objets →</button>
        </header>
        {todos.some((t) => !isDone(t.key)) ? (
          <>
            <p className="next-context">
              {remaining} objectif{remaining > 1 ? 's' : ''} restant{remaining > 1 ? 's' : ''}, par priorité
            </p>
            <div className="todo-list">
              {shownTodos.map((t) => (
                <Check key={t.key} checked={isDone(t.key)} onChange={(v) => check(t.key, v)} className={`line todo rarity-${t.slot.rarity}`}>
                  <span className="todo-meta">
                    <span className={`line-tag tag-tier-${t.tier}`}>{tierLabel(t.tier)}</span>
                    <span className="todo-slot">{t.slot.slotLabel}</span>
                  </span>
                  <span className={t.tier === 0 ? 'todo-item-name' : ''}>{t.label}</span>
                  {t.detail === 'Greater' && <span className="badge badge-ga">★ GA</span>}
                  {farmSources.has(t.key) && <span className="todo-source">→ {farmSources.get(t.key)!.name}</span>}
                </Check>
              ))}
            </div>
            {todos.length > GEAR_TODO_LIMIT && (
              <button className="link-btn" onClick={() => goTo('gear')}>
                + {todos.length - GEAR_TODO_LIMIT} autres objectifs
              </button>
            )}
          </>
        ) : (
          <p className="done-note">✓ Équipement parfait.</p>
        )}
      </section>
    </div>
  )
}
