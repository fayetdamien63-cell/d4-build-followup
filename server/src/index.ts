import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildApp, defaultDeps } from './app.ts'
import { Store } from './db.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dataDir = process.env.D4_DATA_DIR ?? path.join(root, 'data')
const port = Number(process.env.PORT ?? 5174)
// --serve-web : le serveur sert aussi le front compilé (web/dist), sur un seul port.
const production = process.argv.includes('--serve-web')

const store = new Store(path.join(dataDir, 'tracker.db'))
const deps = defaultDeps(dataDir, store)
const app = buildApp({ ...deps, logger: true, webDist: production ? path.join(root, 'web/dist') : undefined })

// Préchargement des données de jeu en arrière-plan : le premier import sera plus rapide.
deps.loadGameData().catch((err: Error) => app.log.warn(`Données de jeu non préchargées : ${err.message}`))

await app.listen({ port, host: '127.0.0.1' })
if (production) console.log(`\n  ➜ Build Tracker prêt : http://localhost:${port}\n`)
