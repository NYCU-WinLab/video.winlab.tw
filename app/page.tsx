import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { VideoLibrary, type LibraryItem } from "@/components/video-library";
import { db } from "@/lib/db";
import { pins, videos, watchProgress } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  const email = session?.user.email ?? "";

  const rows = await db
    .select({ video: videos, progress: watchProgress, pin: pins })
    .from(videos)
    .leftJoin(
      watchProgress,
      and(
        eq(watchProgress.videoId, videos.id),
        eq(watchProgress.userEmail, email),
      ),
    )
    .leftJoin(
      pins,
      and(eq(pins.videoId, videos.id), eq(pins.userEmail, email)),
    );

  const items: LibraryItem[] = rows.map(({ video, progress, pin }) => ({
    id: video.id,
    title: video.title,
    createdAt: video.createdAt,
    duration: video.duration,
    position: progress?.position ?? null,
    lastWatchedAt: progress?.updatedAt ?? null,
    pinned: pin !== null,
  }));

  return (
    <>
      <SiteHeader />
      <main className="w-full flex-1 p-6">
        <VideoLibrary items={items} />
      </main>
    </>
  );
}
