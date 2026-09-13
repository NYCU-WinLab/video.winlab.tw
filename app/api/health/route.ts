import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { lastSyncAt } from "@/lib/transcript-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Unauthenticated liveness check for uptime monitors. */
export async function GET() {
  try {
    await db.run(sql`select 1`);
  } catch (err) {
    return Response.json(
      { ok: false, db: "error", error: String(err) },
      { status: 503 },
    );
  }
  return Response.json({
    ok: true,
    db: "ok",
    transcriptSyncAt: lastSyncAt ? new Date(lastSyncAt).toISOString() : null,
    uptime: Math.round(process.uptime()),
  });
}
