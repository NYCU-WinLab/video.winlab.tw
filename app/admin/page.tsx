import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UploadDialog } from "@/components/upload-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";
import { videos, watchProgress } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user.isAdmin) redirect("/");

  const videoRows = await db
    .select()
    .from(videos)
    .orderBy(desc(videos.createdAt));
  const progressRows = await db
    .select({ progress: watchProgress, video: videos })
    .from(watchProgress)
    .innerJoin(videos, eq(videos.id, watchProgress.videoId))
    .orderBy(desc(watchProgress.updatedAt));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <UploadDialog />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium">Videos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Uploaded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videoRows.map((v) => (
              <TableRow key={v.id}>
                <TableCell>{v.title}</TableCell>
                <TableCell>{formatBytes(v.size)}</TableCell>
                <TableCell>
                  {v.duration ? formatDuration(v.duration) : "—"}
                </TableCell>
                <TableCell>{formatDate(v.createdAt)}</TableCell>
              </TableRow>
            ))}
            {videoRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No videos yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Watch activity</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Viewer</TableHead>
              <TableHead>Video</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Watched</TableHead>
              <TableHead>Last active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {progressRows.map(({ progress, video }) => {
              const percent = video.duration
                ? Math.min(100, Math.round((progress.position / video.duration) * 100))
                : null;
              return (
                <TableRow key={`${progress.videoId}-${progress.userEmail}`}>
                  <TableCell>
                    {progress.userName}
                    <span className="block text-xs text-muted-foreground">
                      {progress.userEmail}
                    </span>
                  </TableCell>
                  <TableCell>{video.title}</TableCell>
                  <TableCell>
                    {formatDuration(progress.position)}
                    {percent !== null && ` (${percent}%)`}
                  </TableCell>
                  <TableCell>{formatDuration(progress.watchedSeconds)}</TableCell>
                  <TableCell>{formatDate(progress.updatedAt)}</TableCell>
                </TableRow>
              );
            })}
            {progressRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No activity yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}
