import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { ToastProvider } from './components/Toasts.tsx'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)

// PWA : le service worker n'est actif que sur la version compilée (npm start), pas en développement.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Contexte non sécurisé (http://IP-locale) : l'app fonctionne, simplement sans cache hors ligne.
    })
  })
}
