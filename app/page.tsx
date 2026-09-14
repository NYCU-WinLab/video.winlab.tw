import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { LibraryProvider, LibraryToolbar } from "@/components/library-toolbar";
import { SiteHeader } from "@/components/site-header";
import { VideoLibrary, type LibraryItem } from "@/components/video-library";
import { viewableVideoIds } from "@/lib/access";
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

  // Tag locks are enforced here, not in the UI: a hidden card must also be
  // an unreachable video.
  const visible = await viewableVideoIds(
    email,
    session?.user.isAdmin ?? false,
    rows.map((r) => r.video.id),
  );

  const items: LibraryItem[] = rows
    .filter(({ video }) => visible.has(video.id))
    .map(({ video, progress }) => ({
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
