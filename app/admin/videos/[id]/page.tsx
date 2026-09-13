import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { VideoAdminActions } from "@/components/video-admin-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const viewers = await db
    .select()
    .from(watchProgress)
    .where(eq(watchProgress.videoId, id))
    .orderBy(desc(watchProgress.updatedAt));

  return (
    <>
      <SiteHeader crumb={`Admin / ${video.title}`} />
      <main className="w-full flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge
            variant={
              video.transcriptStatus === "error" ? "destructive" : "secondary"
            }
          >
            {describeJob(video.transcriptStatus, live)}
          </Badge>
          <span>{formatBytes(video.size)}</span>
          <span>
            {video.duration ? formatDuration(video.duration) : "unknown length"}
          </span>
          <span>uploaded {formatDate(video.createdAt)}</span>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/watch/${video.id}`}>Watch</Link>
            </Button>
            <VideoAdminActions id={video.id} title={video.title} />
          </div>
        </div>

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
          <h2 className="mb-3 text-lg">Viewers</h2>
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
                    <TableCell>{formatDate(v.createdAt)}</TableCell>
                    <TableCell>{formatDate(v.updatedAt)}</TableCell>
                    <TableCell>{formatDuration(v.watchedSeconds)}</TableCell>
                    <TableCell>
                      {formatDuration(v.position)}
                      {percent !== null && ` (${percent}%)`}
                    </TableCell>
                  </TableRow>
                );
              })}
              {viewers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Nobody has watched this yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
      </main>
    </>
  );
}
