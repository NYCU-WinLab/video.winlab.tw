import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { LibraryProvider, LibraryToolbar } from "@/components/library-toolbar";
import { SiteHeader } from "@/components/site-header";
import { VideoLibrary, type LibraryItem } from "@/components/video-library";
import { db } from "@/lib/db";
import { videos, watchProgress } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  const email = session?.user.email ?? "";

  const rows = await db
    .select({ video: videos, progress: watchProgress })
    .from(videos)
    .leftJoin(
      watchProgress,
      and(
        eq(watchProgress.videoId, videos.id),
        eq(watchProgress.userEmail, email),
      ),
    );

  const items: LibraryItem[] = rows.map(({ video, progress }) => ({
    id: video.id,
    title: video.title,
    createdAt: video.createdAt,
    duration: video.duration,
    position: progress?.position ?? null,
  }));

  return (
    <LibraryProvider>
      <SiteHeader>
        <LibraryToolbar />
      </SiteHeader>
      <main className="w-full flex-1 p-6">
        <VideoLibrary items={items} />
      </main>
    </LibraryProvider>
  );
}
