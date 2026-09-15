import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { normalizeEmail } from "@/lib/access";
import { db } from "@/lib/db";
import { passkeys } from "@/lib/schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Both handlers scope the row to the signed-in user, so one account cannot
 * touch another account's passkeys by guessing an id. */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth();
  const email = session?.user.email;
  if (!email) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return Response.json({ error: "a name is required" }, { status: 400 });

  const [row] = await db
    .update(passkeys)
    .set({ name })
    .where(and(eq(passkeys.id, id), eq(passkeys.userEmail, normalizeEmail(email))))
    .returning();
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true, name });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  const email = session?.user.email;
  if (!email) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const [row] = await db
    .delete(passkeys)
    .where(and(eq(passkeys.id, id), eq(passkeys.userEmail, normalizeEmail(email))))
    .returning();
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
