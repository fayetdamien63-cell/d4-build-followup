import { useEffect, useState } from 'react'
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

export function App() {
  const hash = useHashRoute()
  const buildMatch = hash.match(/^#\/build\/(\d+)/)

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
      </header>
      <main className="page">{buildMatch ? <BuildPage id={Number(buildMatch[1])} /> : <Home />}</main>
    </div>
  )
}
