import type { SkillNode, SkillStep, Variant } from '../../../shared/types.ts'
import { stat } from '../stats.ts'
import type { BuildState } from '../useBuild.ts'
import { Check, Counter, Empty } from './ui.tsx'

export function SkillsView({ variant, state }: { variant: Variant; state: BuildState }) {
  return (
    <div className="skills">
      {variant.skillBar.length > 0 && (
        <section className="skillbar">
          <div className="affix-title">Barre de compétences</div>
          <div className="skillbar-slots">
            {variant.skillBar.map((s, i) => (
              <div key={`${s.id}-${i}`} className="skill-slot">
                <kbd>{i + 1}</kbd>
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {variant.skillSteps.length === 0 && <Empty>Aucun arbre de compétences pour cette variante.</Empty>}
      <ol className="timeline">
        {variant.skillSteps.map((step, i) => (
          <SkillStepCard key={`${step.name}-${i}`} step={step} index={i} state={state} />
        ))}
      </ol>
    </div>
  )
}

export function SkillStepCard({ step, index, state }: { step: SkillStep; index: number; state: BuildState }) {
  const keys = step.nodes.map((n) => n.key)
  const s = stat(keys, state.data?.progress ?? {})
  const complete = s.total > 0 && s.done === s.total

  return (
    <li className={`step ${complete ? 'is-complete' : ''}`}>
      <div className="step-dot">{complete ? '✓' : index + 1}</div>
      <div className="step-card">
        <header className="step-head">
          <h3>{step.name}</h3>
          <Counter stat={s} />
          {!complete && s.total > 0 && (
            <button className="link-btn" onClick={() => state.setDone(keys, true)}>
              Tout valider
            </button>
          )}
        </header>
        {step.nodes.length === 0 ? (
          <p className="muted small">Pas de changement à cette étape.</p>
        ) : (
          <div className="node-list">
            {step.nodes.map((n) => (
              <SkillNodeCheck key={n.key} node={n} state={state} />
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

const KIND_LABEL: Record<SkillNode['kind'], string> = { skill: 'Compétence', upgrade: 'Amélioration', passive: 'Passif', other: 'Nœud' }

function SkillNodeCheck({ node, state }: { node: SkillNode; state: BuildState }) {
  return (
    <Check checked={state.isDone(node.key)} onChange={(v) => state.setDone([node.key], v)} className={`line node node-${node.kind}`}>
      <span className={`line-tag tag-${node.kind}`}>{KIND_LABEL[node.kind]}</span>
      {node.parent && <span className="node-parent">{node.parent} ›</span>}
      <span className="node-name">{node.name}</span>
      {node.kind !== 'upgrade' && (node.rank > 1 || (node.maxRank ?? 0) > 1) && <span className="node-rank">rang {node.rank}</span>}
    </Check>
  )
}
