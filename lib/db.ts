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
  sqlite.pragma("foreign_keys = ON");
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
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      created_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS user_tags (
      user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (user_email, tag_id)
    );
    CREATE TABLE IF NOT EXISTS video_tags (
      video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (video_id, tag_id)
    );
    CREATE TABLE IF NOT EXISTS login_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      used_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS login_codes_email_idx ON login_codes (email);
    CREATE TABLE IF NOT EXISTS login_attempts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS login_attempts_email_idx ON login_attempts (email);
    CREATE TABLE IF NOT EXISTS passkeys (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      transports TEXT,
      device_type TEXT,
      backed_up INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS passkeys_user_idx ON passkeys (user_email);
    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      id TEXT PRIMARY KEY,
      challenge TEXT NOT NULL,
      email TEXT,
      kind TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS signin_tickets (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      method TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL
    );
  `);
  const userCols = (
    sqlite.prepare("PRAGMA table_info(users)").all() as { name: string }[]
  ).map((c) => c.name);
  if (!userCols.includes("password_hash")) {
    sqlite.exec("ALTER TABLE users ADD COLUMN password_hash TEXT;");
  }
  seedUsers(sqlite);
  return drizzle(sqlite, { schema });
}

/** The allow list starts as everyone who already exists in the database plus
 * ADMIN_EMAILS, so turning the whitelist on does not lock the lab out. It runs
 * whenever the table is empty, not once: clearing the allow list completely
 * brings this seed back on the next start. Removing individual users is safe,
 * because a single remaining row keeps the seed from running again. */
function seedUsers(sqlite: Database.Database) {
  const { total } = sqlite.prepare("SELECT count(*) AS total FROM users").get() as {
    total: number;
  };
  if (total > 0) return;

  const admins = new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const known = new Map<string, string | null>();
  for (const admin of admins) known.set(admin, null);
  const rows = sqlite
    .prepare(
      `SELECT lower(user_email) AS email, user_name AS name FROM watch_progress
       UNION ALL
       SELECT lower(created_by) AS email, NULL AS name FROM videos`,
    )
    .all() as { email: string; name: string | null }[];
  for (const row of rows) {
    if (!row.email) continue;
    known.set(row.email, known.get(row.email) ?? row.name ?? null);
  }
  if (known.size === 0) return;

  const now = Date.now();
  const insert = sqlite.prepare(
    "INSERT OR IGNORE INTO users (email, name, role, created_at) VALUES (?, ?, ?, ?)",
  );
  sqlite.transaction(() => {
    for (const [email, name] of known) {
      insert.run(email, name, admins.has(email) ? "admin" : "member", now);
    }
  })();
  console.log(`[db] seeded ${known.size} users into the allow list`);
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
