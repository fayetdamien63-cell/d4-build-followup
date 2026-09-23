// Service worker du Build Tracker : l'app reste consultable hors ligne (dernière version connue).
// - /api/*    : réseau d'abord, puis cache (lecture seule hors ligne)
// - /assets/* : cache d'abord (fichiers versionnés par Vite)
// - pages     : réseau d'abord, repli sur l'app en cache
const VERSION = 'v1'
const SHELL = `shell-${VERSION}`
const API = `api-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== API).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(fallbackUrl ?? request, response.clone())
    return response
  } catch {
    const cached = await cache.match(fallbackUrl ?? request)
    if (cached) return cached
    if (cacheName === API) {
      return new Response(JSON.stringify({ error: 'Hors ligne' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
    }
    throw new Error('offline')
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) (await caches.open(SHELL)).put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  // Pas de cache pour la vérification Maxroll : elle n'a de sens qu'en ligne.
  if (url.pathname.endsWith('/updates')) return

  if (url.pathname.startsWith('/api/')) event.respondWith(networkFirst(request, API))
  else if (url.pathname.startsWith('/assets/')) event.respondWith(cacheFirst(request))
  else if (request.mode === 'navigate') event.respondWith(networkFirst(request, SHELL, '/'))
  else event.respondWith(cacheFirst(request))
})
