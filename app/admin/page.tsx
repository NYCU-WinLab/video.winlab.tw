import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { UploadDialog } from "@/components/upload-dialog";
import { Badge } from "@/components/ui/badge";
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
    .select({
      video: videos,
      viewers: count(watchProgress.userEmail),
    })
    .from(videos)
    .leftJoin(watchProgress, eq(watchProgress.videoId, videos.id))
    .groupBy(videos.id)
    .orderBy(desc(videos.createdAt));

  return (
    <>
      <SiteHeader crumb="Admin" />
      <main className="w-full flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Videos</h1>
          <UploadDialog />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Transcript</TableHead>
              <TableHead>Viewers</TableHead>
              <TableHead>Uploaded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videoRows.map(({ video, viewers }) => (
              <TableRow key={video.id}>
                <TableCell>
                  <Link
                    href={`/admin/videos/${video.id}`}
                    className="font-medium hover:underline"
                  >
                    {video.title}
                  </Link>
                </TableCell>
                <TableCell>{formatBytes(video.size)}</TableCell>
                <TableCell>
                  {video.duration ? formatDuration(video.duration) : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      video.transcriptStatus === "error"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {video.transcriptStatus}
                  </Badge>
                </TableCell>
                <TableCell>{viewers}</TableCell>
                <TableCell>{formatDate(video.createdAt)}</TableCell>
              </TableRow>
            ))}
            {videoRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No videos yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </main>
    </>
  );
}
