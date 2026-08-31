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
});

export const watchProgress = sqliteTable(
  "watch_progress",
  {
    videoId: text("video_id").notNull(),
    userEmail: text("user_email").notNull(),
    userName: text("user_name").notNull(),
    position: real("position").notNull().default(0),
    watchedSeconds: real("watched_seconds").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.videoId, t.userEmail] })],
);

export type Video = typeof videos.$inferSelect;
export type WatchProgress = typeof watchProgress.$inferSelect;
