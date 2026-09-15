import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { PageContainer } from "@/components/ui/page-container";
import { WatchView } from "@/components/watch-view";
import { canView } from "@/lib/access";
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
  if (!(await canView(email, session?.user.isAdmin ?? false, id))) notFound();

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
      <PageContainer className="flex flex-col">
        <WatchView
          videoId={video.id}
          src={`/api/stream/${video.id}`}
          initialPosition={progress?.position ?? 0}
          isAdmin={session?.user.isAdmin ?? false}
          transcriptStatus={video.transcriptStatus}
          transcriptError={video.transcriptError}
          segments={segments}
        />
      </PageContainer>
    </>
  );
}
