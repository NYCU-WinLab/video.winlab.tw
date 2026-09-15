import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { WideContainer } from "@/components/ui/wide-container";
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

  // On desktop the page is exactly one viewport tall: header on top, then the
  // player row fills the rest with no page scroll and spans the full window
  // width (no max-width, so wide monitors get no side margins). Narrow screens keep the
  // normal stacked flow (video, then transcript) and scroll as usual.
  return (
    <div className="flex flex-1 flex-col lg:h-dvh">
      <SiteHeader crumb={video.title} />
      <WideContainer className="flex min-h-0 max-w-none flex-col lg:py-4">
        <WatchView
          videoId={video.id}
          src={`/api/stream/${video.id}`}
          initialPosition={progress?.position ?? 0}
          isAdmin={session?.user.isAdmin ?? false}
          transcriptStatus={video.transcriptStatus}
          transcriptError={video.transcriptError}
          segments={segments}
        />
      </WideContainer>
    </div>
  );
}
