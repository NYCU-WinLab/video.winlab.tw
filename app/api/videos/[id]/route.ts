import fs from "node:fs";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { davDelete } from "@/lib/nextcloud";
import { transcriptSegments, videos, watchProgress } from "@/lib/schema";
import { thumbPath } from "@/lib/thumbnail";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { title?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return Response.json({ error: "title is required" }, { status: 400 });

  const [video] = await db.select().from(videos).where(eq(videos.id, id));
  if (!video) return Response.json({ error: "not found" }, { status: 404 });

  await db.update(videos).set({ title }).where(eq(videos.id, id));
  return Response.json({ ...video, title });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const [video] = await db.select().from(videos).where(eq(videos.id, id));
  if (!video) return Response.json({ error: "not found" }, { status: 404 });

  await davDelete(video.filename);
  fs.rmSync(thumbPath(id), { force: true });
  await db.delete(transcriptSegments).where(eq(transcriptSegments.videoId, id));
  await db.delete(watchProgress).where(eq(watchProgress.videoId, id));
  await db.delete(videos).where(eq(videos.id, id));
  return new Response(null, { status: 204 });
}
