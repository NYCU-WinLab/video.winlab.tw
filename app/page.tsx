import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { db } from "@/lib/db";
import { formatDate, formatDuration } from "@/lib/format";
import { videos, watchProgress } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  const email = session?.user.email ?? "";

  const rows = await db
    .select({
      video: videos,
      progress: watchProgress,
    })
    .from(videos)
    .leftJoin(
      watchProgress,
      and(
        eq(watchProgress.videoId, videos.id),
        eq(watchProgress.userEmail, email),
      ),
    );

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-6">
      <h1 className="mb-6 text-2xl font-semibold">Videos</h1>
      {rows.length === 0 && (
        <p className="text-muted-foreground">No videos yet.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ video, progress }) => {
          const percent =
            progress && video.duration
              ? Math.min(100, (progress.position / video.duration) * 100)
              : 0;
          return (
            <Link key={video.id} href={`/watch/${video.id}`}>
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardHeader>
                  <CardTitle className="line-clamp-2 text-base">
                    {video.title}
                  </CardTitle>
                  <CardDescription>
                    {video.duration ? formatDuration(video.duration) : "—"} ·{" "}
                    {formatDate(video.createdAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Progress value={percent} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {progress
                      ? `Resume at ${formatDuration(progress.position)}`
                      : "Not started"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
