import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_PATH ?? "./data/app.db";

function createDb(): BetterSQLite3Database<typeof schema> {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath, { timeout: 5000 });
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      duration REAL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS watch_progress (
      video_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      user_name TEXT NOT NULL,
      position REAL NOT NULL DEFAULT 0,
      watched_seconds REAL NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (video_id, user_email)
    );
    CREATE TABLE IF NOT EXISTS pins (
      video_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (video_id, user_email)
    );
    CREATE TABLE IF NOT EXISTS transcript_segments (
      video_id TEXT NOT NULL,
      idx INTEGER NOT NULL,
      start REAL NOT NULL,
      end REAL NOT NULL,
      text TEXT NOT NULL,
      speaker TEXT,
      PRIMARY KEY (video_id, idx)
    );
  `);
  const videoCols = (
    sqlite.prepare("PRAGMA table_info(videos)").all() as { name: string }[]
  ).map((c) => c.name);
  const progressCols = (
    sqlite.prepare("PRAGMA table_info(watch_progress)").all() as {
      name: string;
    }[]
  ).map((c) => c.name);
  if (!progressCols.includes("created_at")) {
    sqlite.exec(`
      ALTER TABLE watch_progress ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
      UPDATE watch_progress SET created_at = updated_at WHERE created_at = 0;
    `);
  }
  if (!videoCols.includes("transcript_status")) {
    sqlite.exec(`
      ALTER TABLE videos ADD COLUMN transcript_status TEXT NOT NULL DEFAULT 'none';
      ALTER TABLE videos ADD COLUMN transcript_job_id TEXT;
      ALTER TABLE videos ADD COLUMN transcript_token TEXT;
      ALTER TABLE videos ADD COLUMN transcript_error TEXT;
    `);
  }
  return drizzle(sqlite, { schema });
}

const globalForDb = globalThis as unknown as {
  db?: BetterSQLite3Database<typeof schema>;
};

// Lazy so the DB is opened on first query, not at module load; Next.js build
// workers import route modules in parallel and would otherwise race on the file.
export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop) {
    globalForDb.db ??= createDb();
    return Reflect.get(globalForDb.db, prop, globalForDb.db);
  },
});
