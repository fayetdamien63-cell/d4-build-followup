import { useEffect, useState } from 'react'
import { PhoneModal } from './components/PhoneModal.tsx'
import { BuildPage } from './pages/BuildPage.tsx'
import { Home } from './pages/Home.tsx'

/** Routage minimal par hash : #/ (accueil) et #/build/:id */
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

export const navigate = (path: string) => {
  window.location.hash = path
  window.scrollTo({ top: 0 })
}

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

export function App() {
  const hash = useHashRoute()
  const buildMatch = hash.match(/^#\/build\/(\d+)/)
  const online = useOnline()
  const [phoneOpen, setPhoneOpen] = useState(false)

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden>
            <path d="M16 2 L28 16 L16 30 L4 16 Z" />
            <path d="M16 9 L22 16 L16 23 L10 16 Z" />
          </svg>
          <span className="brand-name">Build Tracker</span>
          <span className="brand-sub">Diablo IV</span>
        </a>
        <button className="btn btn-ghost btn-small topbar-action" onClick={() => setPhoneOpen(true)} title="Ouvrir l'app sur ton téléphone">
          <svg viewBox="0 0 16 16" aria-hidden>
            <rect x="4.5" y="1.5" width="7" height="13" rx="1.5" />
            <path d="M7 12.5h2" />
          </svg>
          <span>Téléphone</span>
        </button>
      </header>
      {!online && <div className="offline-banner">Hors ligne : affichage de la dernière version connue, les modifications ne sont pas enregistrées.</div>}
      {phoneOpen && <PhoneModal onClose={() => setPhoneOpen(false)} />}
      <main className="page">{buildMatch ? <BuildPage id={Number(buildMatch[1])} /> : <Home />}</main>
    </div>
  )
}
