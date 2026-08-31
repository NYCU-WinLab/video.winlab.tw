import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { pins } from "@/lib/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.email) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { videoId?: string; pinned?: boolean };
  if (typeof body.videoId !== "string" || typeof body.pinned !== "boolean") {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const where = and(
    eq(pins.videoId, body.videoId),
    eq(pins.userEmail, session.user.email),
  );
  if (body.pinned) {
    await db
      .insert(pins)
      .values({
        videoId: body.videoId,
        userEmail: session.user.email,
        createdAt: Date.now(),
      })
      .onConflictDoNothing();
  } else {
    await db.delete(pins).where(where);
  }
  return Response.json({ ok: true });
}
