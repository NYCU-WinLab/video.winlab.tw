"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isBootstrapAdmin, normalizeEmail } from "@/lib/access";
import { db } from "@/lib/db";
import { loginCodes, tags, userTags, users, videoTags } from "@/lib/schema";

export type ActionResult = { ok: true } | { error: string };

/** Every action re-checks the session on the server; the admin UI is only a
 * convenience, never the guard. */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user.isAdmin) throw new Error("forbidden");
  return session;
}

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/tags");
}

export async function addUser(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "member") === "admin" ? "admin" : "member";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "A valid email is required" };
  }
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) return { error: "That email is already on the list" };

  await db.insert(users).values({
    email,
    name: name || null,
    role,
    createdAt: Date.now(),
  });
  refresh();
  return { ok: true };
}

export async function setUserRole(
  email: string,
  role: "admin" | "member",
): Promise<ActionResult> {
  await requireAdmin();
  const address = normalizeEmail(email);
  if (role === "member" && isBootstrapAdmin(address)) {
    return { error: "This admin comes from ADMIN_EMAILS and cannot be demoted here" };
  }
  await db.update(users).set({ role }).where(eq(users.email, address));
  refresh();
  return { ok: true };
}

export async function deleteUser(email: string): Promise<ActionResult> {
  await requireAdmin();
  const address = normalizeEmail(email);
  // ADMIN_EMAILS is the bootstrap source of admins: deleting such a row only
  // takes effect until their next sign-in, so refuse instead of pretending.
  if (isBootstrapAdmin(address)) {
    return { error: "This admin comes from ADMIN_EMAILS and cannot be removed here" };
  }
  await db.delete(userTags).where(eq(userTags.userEmail, address));
  await db.delete(loginCodes).where(eq(loginCodes.email, address));
  await db.delete(users).where(eq(users.email, address));
  refresh();
  return { ok: true };
}

export async function setUserTags(
  email: string,
  tagIds: string[],
): Promise<ActionResult> {
  await requireAdmin();
  const address = normalizeEmail(email);
  const known = tagIds.length
    ? await db.select({ id: tags.id }).from(tags).where(inArray(tags.id, tagIds))
    : [];
  await db.delete(userTags).where(eq(userTags.userEmail, address));
  if (known.length) {
    await db
      .insert(userTags)
      .values(known.map((t) => ({ userEmail: address, tagId: t.id })));
  }
  refresh();
  return { ok: true };
}

export async function addTag(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "A tag name is required" };
  const [existing] = await db.select().from(tags).where(eq(tags.name, name));
  if (existing) return { error: "That tag already exists" };

  await db
    .insert(tags)
    .values({ id: crypto.randomUUID(), name, createdAt: Date.now() });
  refresh();
  return { ok: true };
}

export async function renameTag(id: string, name: string): Promise<ActionResult> {
  await requireAdmin();
  const next = name.trim();
  if (!next) return { error: "A tag name is required" };
  const [clash] = await db.select().from(tags).where(eq(tags.name, next));
  if (clash && clash.id !== id) return { error: "That tag already exists" };

  await db.update(tags).set({ name: next }).where(eq(tags.id, id));
  refresh();
  return { ok: true };
}

export async function deleteTag(id: string): Promise<ActionResult> {
  await requireAdmin();
  await db.delete(userTags).where(eq(userTags.tagId, id));
  await db.delete(videoTags).where(eq(videoTags.tagId, id));
  await db.delete(tags).where(eq(tags.id, id));
  refresh();
  return { ok: true };
}

/** Empty list means the video is open to everyone. */
export async function setVideoTags(
  videoId: string,
  tagIds: string[],
): Promise<ActionResult> {
  await requireAdmin();
  const known = tagIds.length
    ? await db.select({ id: tags.id }).from(tags).where(inArray(tags.id, tagIds))
    : [];
  await db.delete(videoTags).where(eq(videoTags.videoId, videoId));
  if (known.length) {
    await db
      .insert(videoTags)
      .values(known.map((t) => ({ videoId, tagId: t.id })));
  }
  refresh();
  revalidatePath(`/admin/videos/${videoId}`);
  return { ok: true };
}
