import { asc, count, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminNav } from "@/components/admin-nav";
import { LinkRow } from "@/components/link-row";
import { SiteHeader } from "@/components/site-header";
import { PageContainer } from "@/components/ui/page-container";
import { UploadDialog } from "@/components/upload-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/data-table";
import { db } from "@/lib/db";
import { formatBytes, formatCount, formatDate } from "@/lib/format";
import { tags, videoTags, videos, watchProgress } from "@/lib/schema";
import { describeJob, recentlySynced, syncPending } from "@/lib/transcribe";
import { Badge } from "@/components/ui/badge";

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

  const locks = await db
    .select({ videoId: videoTags.videoId, name: tags.name })
    .from(videoTags)
    .innerJoin(tags, eq(tags.id, videoTags.tagId));
  const lockedTo = new Map<string, string[]>();
  for (const lock of locks) {
    lockedTo.set(lock.videoId, [...(lockedTo.get(lock.videoId) ?? []), lock.name]);
  }

  // Pull live status from transcribe for anything still pending; this also
  // imports finished transcripts nobody has opened yet.
  const live = recentlySynced()
    ? new Map()
    : await syncPending(videoRows.map((r) => r.video));
  const fresh = await db.select().from(videos);
  const statusOf = new Map(fresh.map((v) => [v.id, v.transcriptStatus]));

  return (
    <>
      <SiteHeader crumb="Admin" />
      <PageContainer className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <AdminNav current="/admin" />
          <UploadDialog />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Viewers</TableHead>
              <TableHead>Transcript</TableHead>
              <TableHead>Visible to</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videoRows.map(({ video, viewers }) => {
              const status = statusOf.get(video.id) ?? video.transcriptStatus;
              return (
                <LinkRow key={video.id} href={`/admin/videos/${video.id}`}>
                  <TableCell>
                    <Link
                      href={`/admin/videos/${video.id}`}
                      className="hover:underline"
                    >
                      {video.title}
                    </Link>
                  </TableCell>
                  <TableCell label="Viewers" className="font-mono">
                    {formatCount(viewers)}
                  </TableCell>
                  <TableCell label="Transcript">
                    <Badge
                      variant={status === "error" ? "destructive" : "secondary"}
                    >
                      {describeJob(status, live.get(video.id))}
                    </Badge>
                  </TableCell>
                  <TableCell label="Visible to" className="text-muted-foreground">
                    {lockedTo.get(video.id)?.join(", ") ?? "Everyone"}
                  </TableCell>
                  <TableCell label="Size" className="font-mono">
                    {formatBytes(video.size)}
                  </TableCell>
                  <TableCell label="Uploaded" className="font-mono">
                    {formatDate(video.createdAt)}
                  </TableCell>
                </LinkRow>
              );
            })}
            {videoRows.length === 0 && (
              <TableEmpty colSpan={6}>No videos yet.</TableEmpty>
            )}
          </TableBody>
        </Table>
      </PageContainer>
    </>
  );
}
