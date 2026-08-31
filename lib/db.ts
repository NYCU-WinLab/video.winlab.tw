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
  `);
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
