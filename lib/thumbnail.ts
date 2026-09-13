import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { davAuthHeader, davUrl } from "@/lib/nextcloud";

const run = promisify(execFile);

const dbPath = process.env.DATABASE_PATH ?? "./data/app.db";
export const thumbDir =
  process.env.THUMB_DIR ?? path.join(path.dirname(dbPath), "thumbs");

/** How long a failed generation is remembered before we try again. */
const FAILURE_TTL_MS = 24 * 60 * 60 * 1000;

const inflight = new Map<string, Promise<string | null>>();

export function thumbPath(id: string) {
  return path.join(thumbDir, `${id}.jpg`);
}

function failedPath(id: string) {
  return path.join(thumbDir, `${id}.failed`);
}

function recentlyFailed(id: string) {
  try {
    return Date.now() - fs.statSync(failedPath(id)).mtimeMs < FAILURE_TTL_MS;
  } catch {
    return false;
  }
}

/** Escape one ffconcat argument: spaces, quotes and backslashes are special. */
function ffconcatEscape(value: string) {
  return value.replace(/[\\ '"]/g, (c) => `\\${c}`);
}

/**
 * Keep the WebDAV credential out of argv (`ps` would show it). Two different
 * mechanisms because the ffmpeg CLI does not accept `-/headers`:
 * - ffmpeg: a 0600 ffconcat list whose `option headers` line carries the
 *   Authorization header, read with `-f concat -safe 0`.
 * - ffprobe: `-/headers file` loads the option value from a 0600 file.
 * Both temp files live in a private mkdtemp directory removed afterwards.
 */
async function withCredentialFiles<T>(
  filename: string,
  fn: (files: { concatList: string; headerFile: string }) => Promise<T>,
) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "video-cred-"));
  const header = `Authorization: ${davAuthHeader()}`;
  const concatList = path.join(dir, "input.ffconcat");
  const headerFile = path.join(dir, "headers");
  await fs.promises.writeFile(
    concatList,
    `ffconcat version 1.0\nfile ${ffconcatEscape(davUrl(filename))}\noption headers ${ffconcatEscape(header)}\n`,
    { mode: 0o600 },
  );
  await fs.promises.writeFile(headerFile, `${header}\r\n`, { mode: 0o600 });
  try {
    return await fn({ concatList, headerFile });
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

const CONCAT_INPUT_ARGS = [
  "-safe",
  "0",
  "-protocol_whitelist",
  "file,http,https,tcp,tls",
  "-f",
  "concat",
];

/**
 * Return the on-disk path of the thumbnail for a video, generating it with
 * ffmpeg on first use. Resolves to null when generation fails; the failure is
 * remembered for FAILURE_TTL_MS so a broken file does not respawn ffmpeg on
 * every grid render.
 */
export function ensureThumbnail(
  id: string,
  filename: string,
  duration: number | null,
): Promise<string | null> {
  const out = thumbPath(id);
  if (fs.existsSync(out)) return Promise.resolve(out);
  if (recentlyFailed(id)) return Promise.resolve(null);
  const pending = inflight.get(id);
  if (pending) return pending;

  const job = generate(id, out, filename, duration).finally(() =>
    inflight.delete(id),
  );
  inflight.set(id, job);
  return job;
}

async function generate(
  id: string,
  out: string,
  filename: string,
  duration: number | null,
): Promise<string | null> {
  fs.mkdirSync(thumbDir, { recursive: true });
  const tmp = `${out}.tmp`;
  // Grab a frame a little way in so we skip black intro frames.
  const seek = duration && duration > 20 ? Math.min(duration * 0.1, 60) : 3;
  try {
    await withCredentialFiles(filename, ({ concatList }) =>
      run(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          ...CONCAT_INPUT_ARGS,
          "-ss",
          seek.toFixed(1),
          "-i",
          concatList,
          "-frames:v",
          "1",
          "-vf",
          "scale=640:-2",
          "-q:v",
          "4",
          "-f",
          "image2",
          "-y",
          tmp,
        ],
        { timeout: 120_000 },
      ),
    );
    fs.renameSync(tmp, out);
    fs.rmSync(failedPath(id), { force: true });
    return out;
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    fs.writeFileSync(failedPath(id), "");
    console.error(`thumbnail failed for ${filename}:`, err);
    return null;
  }
}

/** Duration in seconds via ffprobe over WebDAV, or null when it fails. */
export async function probeDuration(filename: string): Promise<number | null> {
  try {
    const { stdout } = await withCredentialFiles(filename, ({ headerFile }) =>
      run(
        "ffprobe",
        [
          "-v",
          "error",
          "-/headers",
          headerFile,
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          davUrl(filename),
        ],
        { timeout: 60_000 },
      ),
    );
    const seconds = Number.parseFloat(stdout.trim());
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch (err) {
    console.error(`ffprobe failed for ${filename}:`, err);
    return null;
  }
}

/** Thumbnail directory is writable (used by /api/health). */
export async function thumbDirWritable() {
  try {
    await fs.promises.mkdir(thumbDir, { recursive: true });
    await fs.promises.access(thumbDir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
