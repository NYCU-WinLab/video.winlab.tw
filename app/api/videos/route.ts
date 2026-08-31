import { after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { davPut } from "@/lib/nextcloud";
import { videos } from "@/lib/schema";
import { submitTranscription } from "@/lib/transcribe";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const rows = await db.select().from(videos);
  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const title = form.get("title");
  if (!(file instanceof File) || typeof title !== "string" || !title.trim()) {
    return Response.json({ error: "file and title are required" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const filename = `${id}-${safeName}`;
  await davPut(filename, file.stream());

  const row = {
    id,
    title: title.trim(),
    filename,
    size: file.size,
    mimeType: file.type || "video/mp4",
    duration: null,
    createdBy: session.user.email ?? "unknown",
    createdAt: Date.now(),
    transcriptStatus: "pending",
    transcriptJobId: null,
    transcriptToken: null,
    transcriptError: null,
  };
  await db.insert(videos).values(row);
  after(() => submitTranscription(row));
  return Response.json(row, { status: 201 });
}
