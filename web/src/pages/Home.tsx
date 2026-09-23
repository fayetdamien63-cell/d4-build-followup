import { useEffect, useState, type FormEvent } from 'react'
import type { BuildSummary } from '../../../shared/types.ts'
import { api } from '../api.ts'
import { navigate } from '../App.tsx'
import { ProgressBar } from '../components/ui.tsx'
import { useToast } from '../components/Toasts.tsx'
import { pct } from '../stats.ts'
import { formatDate } from '../format.ts'

export function Home() {
  const toast = useToast()
  const [builds, setBuilds] = useState<BuildSummary[] | null>(null)
  const [input, setInput] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listBuilds().then(setBuilds, (err: Error) => setError(`Serveur injoignable : ${err.message}`))
  }, [])

  async function onImport(e: FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setImporting(true)
    setError(null)
    try {
      const { id, existed } = await api.importBuild(input)
      if (existed) toast('Ce build est déjà suivi, on y retourne.')
      navigate(`/build/${id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setImporting(false)
    }
  }

  async function onDelete(build: BuildSummary) {
    if (!confirm(`Supprimer « ${build.name} » et toute sa progression ?`)) return
    try {
      await api.deleteBuild(build.id)
      setBuilds((b) => b?.filter((x) => x.id !== build.id) ?? null)
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  return (
    <div className="home">
      <section className="hero">
        <h1>Suis ton build, étape par étape</h1>
        <p className="hero-sub">
          Colle le lien d'un guide ou d'un planner <strong>Maxroll</strong> : compétences, parangon et équipement deviennent une checklist.
        </p>
        <form className="import" onSubmit={onImport}>
          <input
            className="import-input"
            type="text"
            placeholder="https://maxroll.gg/d4/build-guides/…  ou  https://maxroll.gg/d4/planner/…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={importing}
            autoFocus
            aria-label="URL Maxroll"
          />
          <button className="btn btn-primary" disabled={importing || !input.trim()}>
            {importing ? <span className="spinner" /> : null}
            {importing ? 'Import…' : 'Importer'}
          </button>
        </form>
        {importing && <p className="hint">Le premier import télécharge aussi les données du jeu (~12 Mo), ça peut prendre quelques secondes.</p>}
        {error && <p className="error-text">{error}</p>}
      </section>

      <section>
        <div className="section-head">
          <h2>Mes builds</h2>
          {builds && builds.length > 0 && <span className="muted">{builds.length} suivi{builds.length > 1 ? 's' : ''}</span>}
        </div>
        {builds === null && !error && <div className="skeleton-grid"><div className="skeleton" /><div className="skeleton" /></div>}
        {builds?.length === 0 && (
          <div className="empty-state">
            <svg viewBox="0 0 64 64" aria-hidden>
              <path d="M32 6 L54 32 L32 58 L10 32 Z" />
              <path d="M32 20 L42 32 L32 44 L22 32 Z" />
            </svg>
            <p>Aucun build pour l'instant.</p>
            <p className="muted">Commence par importer le guide de ta saison ci-dessus.</p>
          </div>
        )}
        <div className="build-grid">
          {builds?.map((b) => (
            <article key={b.id} className="build-card" onClick={() => navigate(`/build/${b.id}`)}>
              <div className="build-card-top">
                <span className={`class-sigil class-${b.className.toLowerCase()}`}>{b.className.slice(0, 2)}</span>
                <div className="build-card-title">
                  <h3>{b.name}</h3>
                  <span className="muted">
                    {b.className}
                    {b.season && ` · Saison ${b.season}`}
                  </span>
                </div>
                <button
                  className="icon-btn"
                  title="Supprimer"
                  onClick={(e) => {
                    e.stopPropagation()
                    void onDelete(b)
                  }}
                >
                  <svg viewBox="0 0 16 16" aria-hidden>
                    <path d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.7 9.5h5.6l.7-9.5" />
                  </svg>
                </button>
              </div>
              <div className="build-card-progress">
                <div className="build-card-meta">
                  <span className="pill">{b.variantName}</span>
                  <strong>{pct(b)}%</strong>
                </div>
                <ProgressBar stat={b} />
              </div>
              <div className="build-card-foot muted">Guide mis à jour {formatDate(b.sourceDate)}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
