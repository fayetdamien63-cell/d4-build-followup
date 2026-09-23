// Persistance locale : un fichier SQLite (module natif node:sqlite, aucune dépendance à compiler).
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Build, HistoryEvent } from '../../shared/types.ts'

export type NewBuild = Omit<Build, 'id' | 'importedAt'>

interface BuildRow {
  id: number
  data: string
  imported_at: string
  active_variant: number
}

export class Store {
  private db: DatabaseSync

  constructor(file: string) {
    if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true })
    this.db = new DatabaseSync(file)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS builds (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        source         TEXT NOT NULL,
        source_id      TEXT NOT NULL,
        imported_at    TEXT NOT NULL,
        active_variant INTEGER NOT NULL DEFAULT 0,
        data           TEXT NOT NULL,
        raw            TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS progress (
        build_id INTEGER NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
        key      TEXT NOT NULL,
        done_at  TEXT NOT NULL,
        PRIMARY KEY (build_id, key)
      );
      -- Journal : chaque action de l'utilisateur (un clic = un événement, même s'il touche plusieurs clés).
      CREATE TABLE IF NOT EXISTS events (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        build_id INTEGER NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
        at       TEXT NOT NULL,
        done     INTEGER NOT NULL,
        keys     TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_build_at ON events(build_id, at DESC);
    `)
  }

  private toBuild(row: BuildRow): Build {
    const build = { ...(JSON.parse(row.data) as NewBuild), id: row.id, importedAt: row.imported_at }
    // Builds importés avant l'ajout de `isStart` : on le déduit de l'identifiant du plateau.
    for (const v of build.variants) for (const step of v.paragonSteps) for (const b of step.boards) b.isStart ??= b.boardId.endsWith('_00')
    return build
  }

  listBuilds(): { build: Build; activeVariant: number }[] {
    const rows = this.db.prepare('SELECT id, data, imported_at, active_variant FROM builds ORDER BY id DESC').all() as unknown as BuildRow[]
    return rows.map((r) => ({ build: this.toBuild(r), activeVariant: r.active_variant }))
  }

  getBuild(id: number): { build: Build; activeVariant: number } | null {
    const row = this.db.prepare('SELECT id, data, imported_at, active_variant FROM builds WHERE id = ?').get(id) as unknown as BuildRow | undefined
    return row ? { build: this.toBuild(row), activeVariant: row.active_variant } : null
  }

  findBySource(source: string, sourceId: string): number | null {
    const row = this.db.prepare('SELECT id FROM builds WHERE source = ? AND source_id = ?').get(source, sourceId) as { id: number } | undefined
    return row?.id ?? null
  }

  insertBuild(build: NewBuild, raw: unknown, activeVariant: number): number {
    const res = this.db
      .prepare('INSERT INTO builds (source, source_id, imported_at, active_variant, data, raw) VALUES (?, ?, ?, ?, ?, ?)')
      .run(build.source, build.sourceId, new Date().toISOString(), activeVariant, JSON.stringify(build), JSON.stringify(raw))
    return Number(res.lastInsertRowid)
  }

  updateBuildData(id: number, build: NewBuild, raw: unknown): void {
    this.db.prepare('UPDATE builds SET data = ?, raw = ? WHERE id = ?').run(JSON.stringify(build), JSON.stringify(raw), id)
  }

  setActiveVariant(id: number, variant: number): void {
    this.db.prepare('UPDATE builds SET active_variant = ? WHERE id = ?').run(variant, id)
  }

  deleteBuild(id: number): void {
    this.db.prepare('DELETE FROM builds WHERE id = ?').run(id)
  }

  getProgress(buildId: number): Record<string, string> {
    const rows = this.db.prepare('SELECT key, done_at FROM progress WHERE build_id = ?').all(buildId) as { key: string; done_at: string }[]
    return Object.fromEntries(rows.map((r) => [r.key, r.done_at]))
  }

  /** Applique les changements et journalise uniquement les clés dont l'état change réellement. */
  setProgress(buildId: number, keys: string[], done: boolean): string[] {
    const now = new Date().toISOString()
    const insert = this.db.prepare('INSERT OR IGNORE INTO progress (build_id, key, done_at) VALUES (?, ?, ?)')
    const remove = this.db.prepare('DELETE FROM progress WHERE build_id = ? AND key = ?')
    const changed: string[] = []
    this.db.exec('BEGIN')
    try {
      for (const key of new Set(keys)) {
        const res = done ? insert.run(buildId, key, now) : remove.run(buildId, key)
        if (Number(res.changes) > 0) changed.push(key)
      }
      if (changed.length > 0) {
        this.db.prepare('INSERT INTO events (build_id, at, done, keys) VALUES (?, ?, ?, ?)').run(buildId, now, done ? 1 : 0, JSON.stringify(changed))
      }
      this.db.exec('COMMIT')
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
    return changed
  }

  getHistory(buildId: number, limit = 300): HistoryEvent[] {
    const rows = this.db
      .prepare('SELECT id, at, done, keys FROM events WHERE build_id = ? ORDER BY at DESC, id DESC LIMIT ?')
      .all(buildId, limit) as { id: number; at: string; done: number; keys: string }[]
    return rows.map((r) => ({ id: r.id, at: r.at, done: r.done === 1, keys: JSON.parse(r.keys) as string[] }))
  }
}
