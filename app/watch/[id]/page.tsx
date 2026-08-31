import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { VideoPlayer } from "@/components/video-player";
import { SiteHeader } from "@/components/site-header";
import { db } from "@/lib/db";
import { videos, watchProgress } from "@/lib/schema";

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

  return (
    <>
      <SiteHeader crumb={video.title} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center p-6">
        <VideoPlayer
          videoId={video.id}
          src={`/api/stream/${video.id}`}
          initialPosition={progress?.position ?? 0}
        />
      </main>
    </>
  );
}
