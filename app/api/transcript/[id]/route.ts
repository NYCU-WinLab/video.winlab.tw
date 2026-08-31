import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { transcriptSegments, videos } from "@/lib/schema";
import { refreshTranscription } from "@/lib/transcribe";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  let [video] = await db.select().from(videos).where(eq(videos.id, id));
  if (!video) return Response.json({ error: "not found" }, { status: 404 });

  if (video.transcriptStatus === "pending") {
    await refreshTranscription(video);
    [video] = await db.select().from(videos).where(eq(videos.id, id));
  }

  const segments =
    video.transcriptStatus === "done"
      ? await db
          .select({
            start: transcriptSegments.start,
            end: transcriptSegments.end,
            text: transcriptSegments.text,
            speaker: transcriptSegments.speaker,
          })
          .from(transcriptSegments)
          .where(eq(transcriptSegments.videoId, id))
          .orderBy(asc(transcriptSegments.idx))
      : [];

  return Response.json({
    status: video.transcriptStatus,
    error: video.transcriptError,
    segments,
  });
}
