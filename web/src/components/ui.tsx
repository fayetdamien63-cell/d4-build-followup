import type { ReactNode } from 'react'
import { pct, type Stat } from '../stats.ts'

export function Check({
  checked,
  onChange,
  children,
  className = '',
  title,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children?: ReactNode
  className?: string
  title?: string
}) {
  return (
    <label className={`check ${checked ? 'is-checked' : ''} ${className}`} title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="check-box" aria-hidden>
        <svg viewBox="0 0 16 16">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
      {children !== undefined && <span className="check-label">{children}</span>}
    </label>
  )
}

export function ProgressBar({ stat, size = 'md' }: { stat: Stat; size?: 'sm' | 'md' }) {
  const p = pct(stat)
  return (
    <div className={`bar bar-${size} ${p === 100 ? 'is-full' : ''}`} role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <div className="bar-fill" style={{ width: `${p}%` }} />
    </div>
  )
}

export function ProgressRing({ stat, size = 112, label }: { stat: Stat; size?: number; label?: string }) {
  const p = pct(stat)
  const r = size / 2 - 7
  const c = 2 * Math.PI * r
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">
        <strong>{p}%</strong>
        {label && <span>{label}</span>}
      </div>
    </div>
  )
}

export function Counter({ stat }: { stat: Stat }) {
  return (
    <span className={`counter ${stat.total > 0 && stat.done === stat.total ? 'is-complete' : ''}`}>
      {stat.done}/{stat.total}
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}
