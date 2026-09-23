// Persistance locale : un fichier SQLite (module natif node:sqlite, aucune dépendance à compiler).
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Build } from '../../shared/types.ts'

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
    `)
  }

  private toBuild(row: BuildRow): Build {
    return { ...(JSON.parse(row.data) as NewBuild), id: row.id, importedAt: row.imported_at }
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

  setProgress(buildId: number, keys: string[], done: boolean): void {
    const now = new Date().toISOString()
    const insert = this.db.prepare('INSERT OR IGNORE INTO progress (build_id, key, done_at) VALUES (?, ?, ?)')
    const remove = this.db.prepare('DELETE FROM progress WHERE build_id = ? AND key = ?')
    this.db.exec('BEGIN')
    try {
      for (const key of keys) done ? insert.run(buildId, key, now) : remove.run(buildId, key)
      this.db.exec('COMMIT')
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }
}
