import { Readable } from "node:stream";
import { lastSyncAt } from "./sync-state";
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
      const text = await res.text();
      throw new Error(`transcribe submit failed: ${res.status} ${text}`);
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

export type JobLive = {
  stage: string;
  progress: number;
  queuePosition: number | null;
};

/** Job ids are only valid when the submit response actually carried one;
 * an older API version left the literal string "undefined" behind. */
export function hasJob(video: Pick<Video, "transcriptJobId" | "transcriptToken">) {
  return (
    !!video.transcriptJobId &&
    video.transcriptJobId !== "undefined" &&
    !!video.transcriptToken
  );
}

/** Job page on transcribe.winlab.tw. Only readable in a browser that holds
 * the owner token, but handy for the admin who submitted it. */
export function transcribeJobUrl(video: Video) {
  return hasJob(video) ? `${baseUrl()}/jobs/${video.transcriptJobId}` : null;
}

const importing = new Map<string, Promise<JobLive | null>>();

/** Poll the transcribe job for a pending video; on done, ingest segments.
 * Returns the live upstream status when it was reachable. Concurrent calls
 * for the same video (admin page, watch-page poll, background tick) share
 * one in-flight refresh so the import never runs twice at once. */
export function refreshTranscription(video: Video): Promise<JobLive | null> {
  if (video.transcriptStatus !== "pending") return Promise.resolve(null);
  const pending = importing.get(video.id);
  if (pending) return pending;
  const job = refreshOnce(video)
    .catch((err) => {
      console.error(`transcript refresh failed for ${video.id}:`, err);
      return null;
    })
    .finally(() => importing.delete(video.id));
  importing.set(video.id, job);
  return job;
}

async function refreshOnce(video: Video): Promise<JobLive | null> {
  if (!hasJob(video)) {
    await db
      .update(videos)
      .set({
        transcriptStatus: "error",
        transcriptError: "submit returned no job id; retry",
      })
      .where(eq(videos.id, video.id));
    return null;
  }
  const qs = `owner_token=${encodeURIComponent(video.transcriptToken!)}`;
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/api/jobs/${video.transcriptJobId}?${qs}`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return null; // transcribe unreachable; try again next poll
  }
  if (res.status === 404) {
    await res.body?.cancel();
    await db
      .update(videos)
      .set({ transcriptStatus: "error", transcriptError: "job not found" })
      .where(eq(videos.id, video.id));
    return null;
  }
  if (!res.ok) {
    await res.body?.cancel();
    return null; // transient; try again next poll
  }
  const status = (await res.json()) as JobStatus & {
    queue_position?: number | null;
  };
  const live: JobLive = {
    stage: status.stage,
    progress: status.progress,
    queuePosition: status.queue_position ?? null,
  };

  if (status.stage === "error") {
    await db
      .update(videos)
      .set({
        transcriptStatus: "error",
        transcriptError: status.error_message ?? "transcription failed",
      })
      .where(eq(videos.id, video.id));
    return live;
  }
  if (status.stage !== "done") return live;

  let trRes: Response;
  try {
    trRes = await fetch(
      `${baseUrl()}/api/jobs/${video.transcriptJobId}/transcript.json?${qs}`,
      { signal: AbortSignal.timeout(30_000) },
    );
  } catch {
    return live;
  }
  if (!trRes.ok) {
    await trRes.body?.cancel();
    return live;
  }
  const transcript = (await trRes.json()) as Transcript;

  const rows = transcript.segments.map((s, idx) => ({
    videoId: video.id,
    idx,
    start: s.start,
    end: s.end,
    text: s.text,
    speaker: s.speaker ?? null,
  }));
  // better-sqlite3 transactions are synchronous: everything inside runs
  // atomically, so a crash mid-import can never leave a half-written set.
  db.transaction((tx) => {
    tx.delete(transcriptSegments)
      .where(eq(transcriptSegments.videoId, video.id))
      .run();
    for (let i = 0; i < rows.length; i += 500) {
      tx.insert(transcriptSegments).values(rows.slice(i, i + 500)).run();
    }
    tx.update(videos)
      .set({ transcriptStatus: "done", transcriptError: null })
      .where(eq(videos.id, video.id))
      .run();
  });
  return live;
}

/** Sync every pending video against transcribe and return the live status
 * per video id, so admin pages can show what is actually running. */
export async function syncPending(rows: Video[], concurrency = 4) {
  const live = new Map<string, JobLive | null>();
  const queue = rows.filter((v) => v.transcriptStatus === "pending");
  const workers = Array.from({ length: concurrency }, async () => {
    for (let v = queue.shift(); v; v = queue.shift()) {
      live.set(v.id, await refreshTranscription(v));
    }
  });
  await Promise.all(workers);
  return live;
}

/** True when the background poller ran recently enough that page loads can
 * skip their own upstream round-trips. */
export function recentlySynced(maxAgeMs = 60_000) {
  const at = lastSyncAt();
  return at !== null && Date.now() - at < maxAgeMs;
}

export function describeJob(status: string, live: JobLive | null | undefined) {
  if (status !== "pending") return status;
  if (live === undefined) return "pending";
  if (live === null) return "pending · transcribe unreachable";
  if (live.stage === "queued")
    return live.queuePosition !== null
      ? `queued · #${live.queuePosition}`
      : "queued";
  if (live.stage === "done") return "done · importing";
  return `${live.stage} · ${Math.round(live.progress * 100)}%`;
}

/** Reachability check for /api/health: any HTTP answer counts as up. */
export async function transcribePing(timeoutMs = 5000) {
  try {
    const res = await fetch(`${baseUrl()}/api/jobs`, {
      method: "OPTIONS",
      signal: AbortSignal.timeout(timeoutMs),
    });
    await res.body?.cancel();
    return res.status < 500;
  } catch {
    return false;
  }
}
