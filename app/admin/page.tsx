import { asc, count, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LinkRow } from "@/components/link-row";
import { SiteHeader } from "@/components/site-header";
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
import { formatBytes, formatDate } from "@/lib/format";
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
    .orderBy(asc(sql`lower(${videos.title})`));

  return (
    <>
      <SiteHeader crumb="Admin" />
      <main className="w-full flex-1 space-y-6 p-6">
        <div className="flex justify-end">
          <UploadDialog />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Viewers</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videoRows.map(({ video, viewers }) => (
              <LinkRow key={video.id} href={`/admin/videos/${video.id}`}>
                <TableCell>{video.title}</TableCell>
                <TableCell>{viewers}</TableCell>
                <TableCell>{formatBytes(video.size)}</TableCell>
                <TableCell>{formatDate(video.createdAt)}</TableCell>
              </LinkRow>
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
      </main>
    </>
  );
}
