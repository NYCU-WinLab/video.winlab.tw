import { and, eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { auth } from "@/auth";
import { canView } from "@/lib/access";
import { db } from "@/lib/db";
import { videos, watchProgress } from "@/lib/schema";
import { probeDuration } from "@/lib/thumbnail";

export const runtime = "nodejs";

/** The player flushes every 10 s, so one report can never legitimately carry
 * more watched time than the wall clock allows (plus a little slack for a
 * delayed flush). Anything above is a replayed or forged heartbeat. */
const MAX_DELTA_SECONDS = 120;
const CLOCK_SLACK_SECONDS = 15;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.email) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    videoId?: unknown;
    position?: unknown;
    delta?: unknown;
  } | null;
  const videoId = body?.videoId;
  const position = body?.position;
  const delta = body?.delta;
  if (
    typeof videoId !== "string" ||
    typeof position !== "number" ||
    typeof delta !== "number" ||
    !Number.isFinite(position) ||
    !Number.isFinite(delta)
  ) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const [video] = await db
    .select({ id: videos.id, duration: videos.duration, filename: videos.filename })
    .from(videos)
    .where(eq(videos.id, videoId));
  if (!video) return Response.json({ error: "not found" }, { status: 404 });

  const email = session.user.email;
  if (!(await canView(email, session.user.isAdmin, videoId))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const now = Date.now();
  const [existing] = await db
    .select({ updatedAt: watchProgress.updatedAt })
    .from(watchProgress)
    .where(
      and(eq(watchProgress.videoId, videoId), eq(watchProgress.userEmail, email)),
    );

  // Server-side bounds: position inside the video, watched time no larger
  // than the time that actually elapsed since the previous heartbeat.
  const maxPosition = video.duration ?? Number.POSITIVE_INFINITY;
  const boundedPosition = Math.max(0, Math.min(position, maxPosition));
  const elapsed = existing
    ? (now - existing.updatedAt) / 1000 + CLOCK_SLACK_SECONDS
    : MAX_DELTA_SECONDS;
  const boundedDelta = Math.max(0, Math.min(delta, MAX_DELTA_SECONDS, elapsed));

  await db
    .insert(watchProgress)
    .values({
      videoId,
      userEmail: email,
      userName: session.user.name ?? email,
      position: boundedPosition,
      watchedSeconds: boundedDelta,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [watchProgress.videoId, watchProgress.userEmail],
      set: {
        position: boundedPosition,
        watchedSeconds: sql`${watchProgress.watchedSeconds} + ${boundedDelta}`,
        updatedAt: now,
      },
    });

  // Duration comes from ffprobe, never from the client. Backfill lazily for
  // videos uploaded before probing existed.
  if (video.duration === null) {
    after(async () => {
      const duration = await probeDuration(video.filename);
      if (duration) {
        await db.update(videos).set({ duration }).where(eq(videos.id, videoId));
      }
    });
  }

  return Response.json({ ok: true });
}
