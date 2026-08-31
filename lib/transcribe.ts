import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { davGet } from "./nextcloud";
import { transcriptSegments, videos, type Video } from "./schema";

const baseUrl = () =>
  (process.env.TRANSCRIBE_URL ?? "https://transcribe.winlab.tw").replace(
    /\/$/,
    "",
  );

type JobCreate = { job_id: string; owner_token: string };
type JobStatus = {
  stage: string;
  progress: number;
  error_message: string | null;
};
type Transcript = {
  segments: { start: number; end: number; text: string; speaker?: string }[];
};

/** Stream the video out of Nextcloud into a multipart POST to the
 * transcribe service, and mark the video pending/error accordingly. */
export async function submitTranscription(video: Video) {
  try {
    const upstream = await davGet(video.filename);
    if (!upstream.ok || !upstream.body) {
      throw new Error(`WebDAV GET failed: ${upstream.status}`);
    }

    const boundary =
      "----winlabvideo" + crypto.randomUUID().replace(/-/g, "");
    const enc = new TextEncoder();
    const head = enc.encode(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${video.filename}"\r\n` +
        `Content-Type: ${video.mimeType}\r\n\r\n`,
    );
    const tail = enc.encode(`\r\n--${boundary}--\r\n`);
    // Node's web ReadableStream is async-iterable at runtime; TS lib.dom doesn't know.
    const fileBody = upstream.body as unknown as AsyncIterable<Uint8Array>;
    async function* concat() {
      yield head;
      for await (const chunk of fileBody) yield chunk;
      yield tail;
    }

    const res = await fetch(`${baseUrl()}/api/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: Readable.toWeb(Readable.from(concat())) as ReadableStream,
      // @ts-expect-error duplex is required by undici for streaming bodies
      duplex: "half",
    });
    if (!res.ok) {
      throw new Error(`transcribe submit failed: ${res.status} ${await res.text()}`);
    }
    const job = (await res.json()) as JobCreate;
    await db
      .update(videos)
      .set({
        transcriptStatus: "pending",
        transcriptJobId: job.job_id,
        transcriptToken: job.owner_token,
        transcriptError: null,
      })
      .where(eq(videos.id, video.id));
  } catch (err) {
    await db
      .update(videos)
      .set({
        transcriptStatus: "error",
        transcriptError: err instanceof Error ? err.message : String(err),
      })
      .where(eq(videos.id, video.id));
  }
}

/** Poll the transcribe job for a pending video; on done, ingest segments. */
export async function refreshTranscription(video: Video) {
  if (
    video.transcriptStatus !== "pending" ||
    !video.transcriptJobId ||
    !video.transcriptToken
  ) {
    return;
  }
  const qs = `owner_token=${encodeURIComponent(video.transcriptToken)}`;
  const res = await fetch(
    `${baseUrl()}/api/jobs/${video.transcriptJobId}?${qs}`,
  );
  if (res.status === 404) {
    await db
      .update(videos)
      .set({ transcriptStatus: "error", transcriptError: "job not found" })
      .where(eq(videos.id, video.id));
    return;
  }
  if (!res.ok) return; // transient; try again next poll
  const status = (await res.json()) as JobStatus;

  if (status.stage === "error") {
    await db
      .update(videos)
      .set({
        transcriptStatus: "error",
        transcriptError: status.error_message ?? "transcription failed",
      })
      .where(eq(videos.id, video.id));
    return;
  }
  if (status.stage !== "done") return;

  const trRes = await fetch(
    `${baseUrl()}/api/jobs/${video.transcriptJobId}/transcript.json?${qs}`,
  );
  if (!trRes.ok) return;
  const transcript = (await trRes.json()) as Transcript;

  await db
    .delete(transcriptSegments)
    .where(eq(transcriptSegments.videoId, video.id));
  const rows = transcript.segments.map((s, idx) => ({
    videoId: video.id,
    idx,
    start: s.start,
    end: s.end,
    text: s.text,
    speaker: s.speaker ?? null,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(transcriptSegments).values(rows.slice(i, i + 500));
  }
  await db
    .update(videos)
    .set({ transcriptStatus: "done", transcriptError: null })
    .where(eq(videos.id, video.id));
}
