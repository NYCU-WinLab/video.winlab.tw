import { eq } from "drizzle-orm";
import { db } from "./db";
import { videos } from "./schema";
import { syncPending } from "./transcribe";

const INTERVAL_MS = 5 * 60_000;
const FIRST_RUN_MS = 15_000;

let started = false;
let running = false;
export let lastSyncAt: number | null = null;

/** Poll transcribe for every pending video so transcripts land without
 * anyone opening the admin page. Runs in-process, once per server. */
export function startTranscriptSync() {
  if (started) return;
  started = true;
  setTimeout(tick, FIRST_RUN_MS).unref();
  setInterval(tick, INTERVAL_MS).unref();
}

export async function tick() {
  if (running) return;
  running = true;
  try {
    const pending = await db
      .select()
      .from(videos)
      .where(eq(videos.transcriptStatus, "pending"));
    if (pending.length > 0) await syncPending(pending);
    lastSyncAt = Date.now();
  } catch (err) {
    console.error("transcript sync failed:", err);
  } finally {
    running = false;
  }
}
