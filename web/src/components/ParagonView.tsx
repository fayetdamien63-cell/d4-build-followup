import { boardKeys, boardNodeKeys, cellKey } from '../../../shared/progress.ts'
import type { Build, ParagonBoardStep, ParagonCell, Variant } from '../../../shared/types.ts'
import { stat } from '../stats.ts'
import type { BuildState } from '../useBuild.ts'
import { Check, Counter, Empty, ProgressBar } from './ui.tsx'

/** Première étape contenant encore des éléments à valider (sinon la dernière). */
export function currentParagonStep(build: Build, variant: Variant, isDone: (k: string) => boolean): number {
  const i = variant.paragonSteps.findIndex((s) => s.boards.some((b) => boardKeys(build, b).some((k) => !isDone(k))))
  return i === -1 ? Math.max(0, variant.paragonSteps.length - 1) : i
}

export function ParagonView({
  build,
  variant,
  state,
  step,
  onStepChange,
}: {
  build: Build
  variant: Variant
  state: BuildState
  step: number | null
  onStepChange: (i: number) => void
}) {
  if (variant.paragonSteps.length === 0) return <Empty>Aucun parangon défini pour cette variante.</Empty>
  const progress = state.data?.progress ?? {}
  const active = Math.min(step ?? currentParagonStep(build, variant, state.isDone), variant.paragonSteps.length - 1)
  const current = variant.paragonSteps[active]

  return (
    <div className="paragon">
      <nav className="step-pills" aria-label="Étapes du parangon">
        {variant.paragonSteps.map((s, i) => {
          const st = stat([...new Set(s.boards.flatMap((b) => boardKeys(build, b)))], progress)
          return (
            <button key={i} className={`step-pill ${i === active ? 'is-active' : ''} ${st.done === st.total ? 'is-complete' : ''}`} onClick={() => onStepChange(i)}>
              <span className="step-pill-name">{s.name}</span>
              <Counter stat={st} />
            </button>
          )
        })}
      </nav>
      <div className="board-list">
        {current.boards.map((b) => (
          <BoardCard key={b.key} build={build} board={b} state={state} />
        ))}
      </div>
    </div>
  )
}

const RARITY_LABEL: Record<ParagonCell['rarity'], string> = {
  normal: 'Normal',
  magic: 'Magique',
  rare: 'Rare',
  legendary: 'Légendaire',
  gate: 'Portail',
  socket: 'Glyphe',
  start: 'Départ',
}

export function BoardCard({ build, board, state }: { build: Build; board: ParagonBoardStep; state: BuildState }) {
  const grid = build.paragonGrids[board.gridId]
  const { isDone, setDone } = state
  const progress = state.data?.progress ?? {}
  const keys = boardKeys(build, board)
  const s = stat(keys, progress)
  const addedKeys = boardNodeKeys(build, board, board.added)
  const addedStat = stat(addedKeys, progress)
  const allocated = new Set(board.allocated)
  // Le marquage "nouveau" n'a de sens que si l'étape complète un plateau déjà entamé.
  const added = new Set(board.added.length === board.allocated.length ? [] : board.added)
  const notable = board.allocated
    .map((pos) => grid?.cells[pos])
    .filter((c): c is ParagonCell => Boolean(c) && (c!.rarity === 'rare' || c!.rarity === 'legendary'))

  // Recadrage sur la zone utile du plateau.
  const width = grid?.width ?? 21
  const used = (grid?.cells ?? []).map((c, i) => (c ? i : -1)).filter((i) => i >= 0)
  const xs = used.map((i) => i % width)
  const ys = used.map((i) => Math.floor(i / width))
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]

  return (
    <article className={`board-card ${s.done === s.total ? 'is-complete' : ''}`}>
      <header className="board-head">
        <div className="board-title">
          <span className="board-order">{board.order + 1}</span>
          <div>
            <h3>{board.name}</h3>
            <span className="muted small">
              {board.allocated.length} nœuds{board.added.length > 0 && board.added.length !== board.allocated.length && ` · +${board.added.length} à cette étape`}
            </span>
          </div>
        </div>
        <Counter stat={s} />
      </header>
      <ProgressBar stat={s} size="sm" />

      <div className="board-body">
        {grid && (
          <div
            className="board-grid"
            style={{ gridTemplateColumns: `repeat(${maxX - minX + 1}, var(--cell))` }}
            role="group"
            aria-label={`Plateau ${board.name}`}
          >
            {Array.from({ length: (maxY - minY + 1) * (maxX - minX + 1) }, (_, k) => {
              const x = minX + (k % (maxX - minX + 1))
              const y = minY + Math.floor(k / (maxX - minX + 1))
              const pos = y * width + x
              const cell = grid.cells[pos]
              if (!cell) return <span key={pos} className="cell cell-empty" />
              if (!allocated.has(pos)) return <span key={pos} className={`cell cell-off r-${cell.rarity}`} title={cell.name} />
              const key = cellKey(board, cell)
              const done = isDone(key)
              return (
                <button
                  key={pos}
                  className={`cell cell-on r-${cell.rarity} ${done ? 'is-done' : ''} ${added.has(pos) ? 'is-new' : ''}`}
                  title={`${cell.name} (${RARITY_LABEL[cell.rarity]})${done ? ' — validé' : ''}`}
                  onClick={() => setDone([key], !done)}
                />
              )
            })}
          </div>
        )}

        <div className="board-side">
          <Check checked={isDone(board.key)} onChange={(v) => setDone([board.key], v)} className="line">
            <span className="line-tag tag-board">Plateau</span>Débloqué et placé
          </Check>
          {board.glyph && (
            <Check checked={isDone(board.glyph.key)} onChange={(v) => setDone([board.glyph!.key], v)} className="line">
              <span className="line-tag tag-glyph">Glyphe</span>
              {board.glyph.name}
              {board.glyph.level !== null && <span className="node-rank">niv. {board.glyph.level}</span>}
            </Check>
          )}
          {notable.length > 0 && (
            <div className="affix-group">
              <div className="affix-title">Nœuds clés</div>
              {notable.map((c) => {
                const key = cellKey(board, c)
                return (
                  <Check key={key} checked={isDone(key)} onChange={(v) => setDone([key], v)} className={`line notable r-${c.rarity}`}>
                    {c.name}
                  </Check>
                )
              })}
            </div>
          )}
          <div className="board-actions">
            {addedStat.done < addedStat.total && board.added.length !== board.allocated.length && (
              <button className="btn btn-small" onClick={() => setDone(addedKeys, true)}>
                Valider les +{addedStat.total - addedStat.done} de l'étape
              </button>
            )}
            {s.done < s.total && (
              <button className="btn btn-small btn-ghost" onClick={() => setDone(keys, true)}>
                Tout valider
              </button>
            )}
          </div>
          <Legend />
        </div>
      </div>
    </article>
  )
}

function Legend() {
  return (
    <div className="legend">
      <span><i className="cell cell-on r-normal" /> à faire</span>
      <span><i className="cell cell-on r-normal is-done" /> validé</span>
      <span><i className="cell cell-on r-rare" /> rare</span>
      <span><i className="cell cell-on r-legendary" /> légendaire</span>
      <span><i className="cell cell-on r-normal is-new" /> nouveau</span>
    </div>
  )
}
