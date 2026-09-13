import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { davPing } from "@/lib/nextcloud";
import { lastSyncAt } from "@/lib/sync-state";
import { thumbDirWritable } from "@/lib/thumbnail";
import { transcribePing } from "@/lib/transcribe";
import { INTERVAL_MS } from "@/lib/transcript-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sync is considered dead after three missed intervals. A fresh process is
 * given one interval of grace before its silence counts against it. */
const SYNC_STALE_MS = 3 * INTERVAL_MS;

type Check = "ok" | "degraded" | "error";

/**
 * Unauthenticated health check for uptime monitors.
 * - `ok` and HTTP 200 only when the database answers and the transcript
 *   poller has run recently; those are the things this process owns.
 * - Nextcloud and transcribe are dependencies: reported, but they flip the
 *   response to `degraded`, not to 503, so a storage blip does not page as a
 *   site outage.
 * Never echoes error text: this endpoint is public.
 */
export async function GET() {
  const checks: Record<string, Check> = {};

  try {
    await db.run(sql`select 1`);
    checks.db = "ok";
  } catch {
    checks.db = "error";
  }

  const syncedAt = lastSyncAt();
  const uptimeMs = process.uptime() * 1000;
  if (syncedAt !== null) {
    checks.transcriptSync = Date.now() - syncedAt < SYNC_STALE_MS ? "ok" : "error";
  } else {
    checks.transcriptSync = uptimeMs < INTERVAL_MS ? "ok" : "error";
  }

  checks.thumbnails = (await thumbDirWritable()) ? "ok" : "error";

  const [nextcloud, transcribe] = await Promise.all([davPing(), transcribePing()]);
  checks.nextcloud = nextcloud ? "ok" : "degraded";
  checks.transcribe = transcribe ? "ok" : "degraded";

  const ok = checks.db === "ok" && checks.transcriptSync === "ok";
  const status = ok
    ? Object.values(checks).every((c) => c === "ok")
      ? "ok"
      : "degraded"
    : "error";

  return Response.json(
    {
      ok,
      status,
      checks,
      transcriptSyncAt: syncedAt ? new Date(syncedAt).toISOString() : null,
      uptime: Math.round(process.uptime()),
    },
    { status: ok ? 200 : 503 },
  );
}
