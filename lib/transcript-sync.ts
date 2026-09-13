import { eq } from "drizzle-orm";
import { db } from "./db";
import { videos } from "./schema";
import { syncPending } from "./transcribe";

export const INTERVAL_MS = 5 * 60_000;
const FIRST_RUN_MS = 15_000;

import { syncState as state } from "./sync-state";

/** Poll transcribe for every pending video so transcripts land without
 * anyone opening the admin page. Runs in-process, once per server. */
export function startTranscriptSync() {
  if (state.started) return;
  state.started = true;
  console.log("transcript sync: started");
  setTimeout(tick, FIRST_RUN_MS).unref();
  setInterval(tick, INTERVAL_MS).unref();
}

export async function tick() {
  if (state.running) return;
  state.running = true;
  try {
    const pending = await db
      .select()
      .from(videos)
      .where(eq(videos.transcriptStatus, "pending"));
    if (pending.length > 0) await syncPending(pending);
    state.lastSyncAt = Date.now();
  } catch (err) {
    console.error("transcript sync failed:", err);
  } finally {
    state.running = false;
  }
}
