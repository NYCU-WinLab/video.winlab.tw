import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

const baseUrl = () => process.env.NEXTCLOUD_URL!.replace(/\/$/, "");
const user = () => process.env.NEXTCLOUD_USER!;

export function davAuthHeader() {
  return (
    "Basic " +
    Buffer.from(`${user()}:${process.env.NEXTCLOUD_APP_PASSWORD}`).toString(
      "base64",
    )
  );
}

export function davUrl(filename: string) {
  return `${baseUrl()}/remote.php/dav/files/${user()}/videos/${encodeURIComponent(filename)}`;
}

const PUT_IDLE_MS = 120_000;

/**
 * Streams `body` (exactly `length` bytes) to Nextcloud. This uses node:http
 * rather than fetch: undici's fetch keeps reading a streamed request body
 * faster than it sends it, so a fast client's upload ended up in memory.
 * pipeline() waits for the socket to drain before it reads more.
 */
export async function davPut(
  filename: string,
  body: ReadableStream<Uint8Array>,
  length: number,
) {
  const url = new URL(davUrl(filename));
  const out = (url.protocol === "https:" ? https : http).request(url, {
    method: "PUT",
    headers: { Authorization: davAuthHeader(), "Content-Length": length },
  });
  // A stalled Nextcloud or client fails the upload instead of holding it open.
  out.setTimeout(PUT_IDLE_MS, () =>
    out.destroy(new Error("WebDAV PUT timed out")),
  );
  const response = new Promise<void>((resolve, reject) => {
    out.on("error", reject);
    out.on("response", (res) => {
      const status = res.statusCode ?? 0;
      res.resume();
      if (status >= 200 && status < 300) return resolve();
      // Nextcloud may answer before it has read the body; stop sending.
      reject(new Error(`WebDAV PUT failed: ${status}`));
      out.destroy();
    });
  });
  await Promise.all([
    pipeline(Readable.fromWeb(body as NodeReadableStream<Uint8Array>), out),
    response,
  ]);
}

export async function davGet(filename: string, range?: string | null) {
  return fetch(davUrl(filename), {
    headers: {
      Authorization: davAuthHeader(),
      ...(range ? { Range: range } : {}),
    },
  });
}

export async function davDelete(filename: string) {
  const res = await fetch(davUrl(filename), {
    method: "DELETE",
    headers: { Authorization: davAuthHeader() },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`WebDAV DELETE failed: ${res.status}`);
  }
}

/** Cheap reachability check against the videos collection. */
export async function davPing(timeoutMs = 5000) {
  try {
    const res = await fetch(
      `${baseUrl()}/remote.php/dav/files/${user()}/videos/`,
      {
        method: "PROPFIND",
        headers: { Authorization: davAuthHeader(), Depth: "0" },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    await res.body?.cancel();
    return res.ok || res.status === 207;
  } catch {
    return false;
  }
}
