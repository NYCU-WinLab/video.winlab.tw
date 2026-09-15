import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { setVideoTags } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin-nav";
import { TagPicker } from "@/components/tag-picker";
import { SiteHeader } from "@/components/site-header";
import { PageContainer } from "@/components/ui/page-container";
import { VideoAdminActions } from "@/components/video-admin-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatBytes, formatDate, formatDuration } from "@/lib/format";
import { tags, videoTags, videos, watchProgress } from "@/lib/schema";
import {
  describeJob,
  refreshTranscription,
  transcribeJobUrl,
} from "@/lib/transcribe";
import { TranscriptActions } from "@/components/transcript-actions";

export const dynamic = "force-dynamic";

export default async function AdminVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.isAdmin) redirect("/");

  const { id } = await params;
  let [video] = await db.select().from(videos).where(eq(videos.id, id));
  if (!video) notFound();
  const live = await refreshTranscription(video);
  [video] = await db.select().from(videos).where(eq(videos.id, id));
  const jobUrl = transcribeJobUrl(video);

  const [tagRows, lockRows] = await Promise.all([
    db.select().from(tags).orderBy(asc(sql`lower(${tags.name})`)),
    db.select().from(videoTags).where(eq(videoTags.videoId, id)),
  ]);

  const viewers = await db
    .select()
    .from(watchProgress)
    .where(eq(watchProgress.videoId, id))
    .orderBy(desc(watchProgress.updatedAt));

  return (
    <>
      <SiteHeader crumb={`Admin / ${video.title}`} />
      <PageContainer className="space-y-6">
        {/* Header: nav on the left, the page's primary action (Watch) on the
            right with rename/delete tucked into the overflow menu beside it. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AdminNav current="/admin" />
          <div className="flex items-center gap-2">
            <VideoAdminActions id={video.id} title={video.title} />
            <Button asChild>
              <Link href={`/watch/${video.id}`}>Watch</Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge
            variant={
              video.transcriptStatus === "error" ? "destructive" : "secondary"
            }
          >
            {describeJob(video.transcriptStatus, live)}
          </Badge>
          <span className="font-mono">{formatBytes(video.size)}</span>
          <span className="font-mono">
            {video.duration ? formatDuration(video.duration) : "unknown length"}
          </span>
          <span>
            uploaded{" "}
            <span className="font-mono">{formatDate(video.createdAt)}</span>
          </span>
        </div>

        <section className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">Locked to tags</span>
          <TagPicker
            tags={tagRows}
            selected={lockRows.map((l) => l.tagId)}
            emptyLabel="Everyone"
            label="Only these tags may watch"
            onSave={setVideoTags.bind(null, video.id)}
          />
        </section>

        <section className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">Transcript</span>
          <span>{describeJob(video.transcriptStatus, live)}</span>
          {video.transcriptError && (
            <span className="text-destructive">{video.transcriptError}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {jobUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={jobUrl} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  Open in Transcribe
                </a>
              </Button>
            )}
            <TranscriptActions id={video.id} status={video.transcriptStatus} />
          </div>
        </section>

        <section>
          <h2 className="type-section mb-3">Viewers</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Viewer</TableHead>
                <TableHead>First watched</TableHead>
                <TableHead>Last watched</TableHead>
                <TableHead>Watched</TableHead>
                <TableHead>Position</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viewers.map((v) => {
                const percent = video.duration
                  ? Math.min(100, Math.round((v.position / video.duration) * 100))
                  : null;
                return (
                  <TableRow key={v.userEmail}>
                    <TableCell>
                      {v.userName}
                      <span className="block text-xs text-muted-foreground">
                        {v.userEmail}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatDate(v.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatDate(v.updatedAt)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatDuration(v.watchedSeconds)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatDuration(v.position)}
                      {percent !== null && ` (${percent}%)`}
                    </TableCell>
                  </TableRow>
                );
              })}
              {viewers.length === 0 && (
                <TableEmpty colSpan={5}>Nobody has watched this yet.</TableEmpty>
              )}
            </TableBody>
          </Table>
        </section>
      </PageContainer>
    </>
  );
}
