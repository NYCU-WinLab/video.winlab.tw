import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { VideoPlayer } from "@/components/video-player";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
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
    <main className="mx-auto w-full max-w-5xl flex-1 p-6">
      <VideoPlayer
        videoId={video.id}
        src={`/api/stream/${video.id}`}
        initialPosition={progress?.position ?? 0}
      />
      <h1 className="mt-4 text-xl font-semibold">{video.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Uploaded {formatDate(video.createdAt)} by {video.createdBy}
      </p>
    </main>
  );
}
