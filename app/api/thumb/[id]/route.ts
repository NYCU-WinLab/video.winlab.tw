import fs from "node:fs";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { canView } from "@/lib/access";
import { db } from "@/lib/db";
import { videos } from "@/lib/schema";
import { ensureThumbnail } from "@/lib/thumbnail";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const [video] = await db.select().from(videos).where(eq(videos.id, id));
  if (!video) return Response.json({ error: "not found" }, { status: 404 });
  if (!(await canView(session.user.email, session.user.isAdmin, id))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const file = await ensureThumbnail(video.id, video.filename, video.duration);
  if (!file) {
    return new Response(null, {
      status: 404,
      headers: { "cache-control": "private, max-age=3600" },
    });
  }

  const body = new Uint8Array(await fs.promises.readFile(file));
  return new Response(body, {
    headers: {
      "content-type": "image/jpeg",
      "content-length": String(body.byteLength),
      "cache-control": "private, max-age=86400",
    },
  });
}
