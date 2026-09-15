import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const videos = sqliteTable("videos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mime_type").notNull(),
  duration: real("duration"),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
  transcriptStatus: text("transcript_status").notNull().default("none"),
  transcriptJobId: text("transcript_job_id"),
  transcriptToken: text("transcript_token"),
  transcriptError: text("transcript_error"),
});

export const transcriptSegments = sqliteTable(
  "transcript_segments",
  {
    videoId: text("video_id").notNull(),
    idx: integer("idx").notNull(),
    start: real("start").notNull(),
    end: real("end").notNull(),
    text: text("text").notNull(),
    speaker: text("speaker"),
  },
  (t) => [primaryKey({ columns: [t.videoId, t.idx] })],
);

export const watchProgress = sqliteTable(
  "watch_progress",
  {
    videoId: text("video_id").notNull(),
    userEmail: text("user_email").notNull(),
    userName: text("user_name").notNull(),
    position: real("position").notNull().default(0),
    watchedSeconds: real("watched_seconds").notNull().default(0),
    createdAt: integer("created_at").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.videoId, t.userEmail] })],
);

export const users = sqliteTable("users", {
  email: text("email").primaryKey(),
  name: text("name"),
  role: text("role").notNull().default("member"),
  /** scrypt$N$r$p$salt$hash, or null while the user has no password yet. */
  passwordHash: text("password_hash"),
  createdAt: integer("created_at").notNull().default(0),
});

/** One row per failed password attempt, counted inside the lockout window. */
export const loginAttempts = sqliteTable("login_attempts", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const passkeys = sqliteTable("passkeys", {
  /** base64url credential id */
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: text("transports"),
  deviceType: text("device_type"),
  backedUp: integer("backed_up").notNull().default(0),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
  lastUsedAt: integer("last_used_at"),
});

/** WebAuthn challenges live server-side; the browser only carries the row id. */
export const webauthnChallenges = sqliteTable("webauthn_challenges", {
  id: text("id").primaryKey(),
  challenge: text("challenge").notNull(),
  email: text("email"),
  kind: text("kind").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** One-time handoff between a verified passkey assertion and the Auth.js
 * credentials provider, so the provider cannot be called on its own. */
export const signinTickets = sqliteTable("signin_tickets", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  method: text("method").notNull(),
  expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at"),
  createdAt: integer("created_at").notNull(),
});

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at").notNull().default(0),
});

export const userTags = sqliteTable(
  "user_tags",
  {
    userEmail: text("user_email").notNull(),
    tagId: text("tag_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userEmail, t.tagId] })],
);

export const videoTags = sqliteTable(
  "video_tags",
  {
    videoId: text("video_id").notNull(),
    tagId: text("tag_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.videoId, t.tagId] })],
);

export const loginCodes = sqliteTable("login_codes", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  usedAt: integer("used_at"),
  createdAt: integer("created_at").notNull(),
});

export type Video = typeof videos.$inferSelect;
export type WatchProgress = typeof watchProgress.$inferSelect;
export type User = typeof users.$inferSelect;
export type Passkey = typeof passkeys.$inferSelect;
export type Tag = typeof tags.$inferSelect;
