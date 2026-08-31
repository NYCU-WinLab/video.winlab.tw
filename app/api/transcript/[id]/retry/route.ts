import { eq } from "drizzle-orm";
import { after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { videos } from "@/lib/schema";
import { submitTranscription } from "@/lib/transcribe";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const [video] = await db.select().from(videos).where(eq(videos.id, id));
  if (!video) return Response.json({ error: "not found" }, { status: 404 });

  await db
    .update(videos)
    .set({ transcriptStatus: "pending", transcriptError: null })
    .where(eq(videos.id, id));
  after(() => submitTranscription({ ...video }));

  return Response.json({ ok: true, status: "pending" });
}
