import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { davAuthHeader, davUrl } from "@/lib/nextcloud";

const run = promisify(execFile);

const dbPath = process.env.DATABASE_PATH ?? "./data/app.db";
const thumbDir =
  process.env.THUMB_DIR ?? path.join(path.dirname(dbPath), "thumbs");

const inflight = new Map<string, Promise<string | null>>();

export function thumbPath(id: string) {
  return path.join(thumbDir, `${id}.jpg`);
}

/**
 * Return the on-disk path of the thumbnail for a video, generating it with
 * ffmpeg on first use. Resolves to null when generation fails so callers can
 * fall back to a placeholder without retry storms.
 */
export function ensureThumbnail(
  id: string,
  filename: string,
  duration: number | null,
): Promise<string | null> {
  const out = thumbPath(id);
  if (fs.existsSync(out)) return Promise.resolve(out);
  const pending = inflight.get(id);
  if (pending) return pending;

  const job = generate(out, filename, duration).finally(() =>
    inflight.delete(id),
  );
  inflight.set(id, job);
  return job;
}

async function generate(
  out: string,
  filename: string,
  duration: number | null,
): Promise<string | null> {
  fs.mkdirSync(thumbDir, { recursive: true });
  const tmp = `${out}.tmp.jpg`;
  // Grab a frame a little way in so we skip black intro frames.
  const seek = duration && duration > 20 ? Math.min(duration * 0.1, 60) : 3;
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-headers",
    `Authorization: ${davAuthHeader()}\r\n`,
    "-ss",
    seek.toFixed(1),
    "-i",
    davUrl(filename),
    "-frames:v",
    "1",
    "-vf",
    "scale=640:-2",
    "-q:v",
    "4",
    "-y",
    tmp,
  ];
  try {
    await run("ffmpeg", args, { timeout: 120_000 });
    fs.renameSync(tmp, out);
    return out;
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    console.error(`thumbnail failed for ${filename}:`, err);
    return null;
  }
}
