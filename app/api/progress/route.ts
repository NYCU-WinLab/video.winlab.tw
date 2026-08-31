import { and, eq, isNull, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { videos, watchProgress } from "@/lib/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.email) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    videoId?: string;
    position?: number;
    delta?: number;
    duration?: number;
  };
  const { videoId, position, delta, duration } = body;
  if (
    typeof videoId !== "string" ||
    typeof position !== "number" ||
    typeof delta !== "number" ||
    !Number.isFinite(position) ||
    !Number.isFinite(delta)
  ) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const boundedDelta = Math.max(0, Math.min(delta, 120));
  await db
    .insert(watchProgress)
    .values({
      videoId,
      userEmail: session.user.email,
      userName: session.user.name ?? session.user.email,
      position,
      watchedSeconds: boundedDelta,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: [watchProgress.videoId, watchProgress.userEmail],
      set: {
        position,
        watchedSeconds: sql`${watchProgress.watchedSeconds} + ${boundedDelta}`,
        updatedAt: Date.now(),
      },
    });

  if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
    await db
      .update(videos)
      .set({ duration })
      .where(and(eq(videos.id, videoId), isNull(videos.duration)));
  }

  return Response.json({ ok: true });
}
