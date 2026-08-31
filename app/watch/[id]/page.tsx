import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { WatchView } from "@/components/watch-view";
import { db } from "@/lib/db";
import { transcriptSegments, videos, watchProgress } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user.email ?? "";

  const [video] = await db.select().from(videos).where(eq(videos.id, id));
  if (!video) notFound();

  const [progress] = await db
    .select()
    .from(watchProgress)
    .where(
      and(eq(watchProgress.videoId, id), eq(watchProgress.userEmail, email)),
    );

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

  return (
    <>
      <SiteHeader crumb={video.title} />
      <main className="flex w-full flex-1 flex-col p-6">
        <WatchView
          videoId={video.id}
          src={`/api/stream/${video.id}`}
          initialPosition={progress?.position ?? 0}
          isAdmin={session?.user.isAdmin ?? false}
          transcriptStatus={video.transcriptStatus}
          transcriptError={video.transcriptError}
          segments={segments}
        />
      </main>
    </>
  );
}
