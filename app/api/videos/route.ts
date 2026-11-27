import { eq } from "drizzle-orm";
import { after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { davDelete, davPut } from "@/lib/nextcloud";
import { videos } from "@/lib/schema";
import { ensureThumbnail, probeDuration } from "@/lib/thumbnail";
import { MAX_TITLE_LENGTH, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/limits";
import { submitTranscription } from "@/lib/transcribe";

export const runtime = "nodejs";

const tooLarge = () =>
  Response.json(
    { error: `file is larger than the ${MAX_UPLOAD_LABEL} upload limit` },
    { status: 413 },
  );

function header(req: Request, name: string) {
  try {
    return decodeURIComponent(req.headers.get(name) ?? "");
  } catch {
    return "";
  }
}

/** Passes the body through and fails it once it carries more than `limit` bytes. */
function capBytes(limit: number) {
  let seen = 0;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > limit) {
        controller.error(new Error("upload body exceeds its declared length"));
        return;
      }
      controller.enqueue(chunk);
    },
  });
  return { counter, seen: () => seen };
}

/**
 * Upload one video. The body is the raw file (not multipart), with the title
 * and file name in the URI-encoded X-Video-Title and X-File-Name headers.
 * The body is streamed to Nextcloud and never held in memory, and this path
 * is kept out of proxy.ts so the proxy does not buffer it either: the session
 * and the declared size are checked before a byte of the body is read.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    await req.body?.cancel().catch(() => {});
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const lengthHeader = req.headers.get("content-length");
  const declared = Number(lengthHeader);
  if (!lengthHeader || !Number.isSafeInteger(declared) || declared < 0) {
    await req.body?.cancel().catch(() => {});
    return Response.json({ error: "content-length is required" }, { status: 411 });
  }
  if (declared > MAX_UPLOAD_BYTES) {
    await req.body?.cancel().catch(() => {});
    return tooLarge();
  }

  const title = header(req, "x-video-title").trim();
  const name = header(req, "x-file-name");
  if (!req.body || declared === 0 || !title || !name) {
    await req.body?.cancel().catch(() => {});
    return Response.json({ error: "file and title are required" }, { status: 400 });
  }
  if (title.length > MAX_TITLE_LENGTH || name.length > 255) {
    await req.body?.cancel().catch(() => {});
    return Response.json(
      { error: `title is longer than ${MAX_TITLE_LENGTH} characters` },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  const safeName = name.replace(/[^\w.-]+/g, "_");
  const filename = `${id}-${safeName}`;
  const { counter, seen } = capBytes(declared);
  try {
    await davPut(filename, req.body.pipeThrough(counter), declared);
  } catch (err) {
    await davDelete(filename).catch(() => {});
    if (seen() > declared) return tooLarge();
    throw err;
  }
  if (seen() !== declared) {
    await davDelete(filename).catch(() => {});
    return Response.json({ error: "upload was cut short" }, { status: 400 });
  }

  const row = {
    id,
    title,
    filename,
    size: declared,
    mimeType: req.headers.get("content-type")?.startsWith("video/")
      ? req.headers.get("content-type")!
      : "video/mp4",
    duration: null,
    createdBy: session.user.email ?? "unknown",
    createdAt: Date.now(),
    transcriptStatus: "pending",
    transcriptJobId: null,
    transcriptToken: null,
    transcriptError: null,
  };
  try {
    await db.insert(videos).values(row);
  } catch (err) {
    await davDelete(filename).catch(() => {});
    throw err;
  }
  after(() => submitTranscription(row));
  after(async () => {
    const duration = await probeDuration(filename);
    if (duration) {
      await db.update(videos).set({ duration }).where(eq(videos.id, id));
    }
    await ensureThumbnail(id, filename, duration);
  });
  return Response.json(row, { status: 201 });
}
