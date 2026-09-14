import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { userTags, videoTags } from "@/lib/schema";

/** Bootstrap admins from the environment. Everyone else becomes an admin by
 * getting `role = 'admin'` in the users table. */
export const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isBootstrapAdmin(email: string | null | undefined) {
  return adminEmails.includes((email ?? "").trim().toLowerCase());
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Tags the viewer carries. Kept out of the JWT on purpose: an admin change
 * has to take effect on the next request, not on the next sign-in. */
export async function tagsOfUser(email: string) {
  if (!email) return [];
  const rows = await db
    .select({ tagId: userTags.tagId })
    .from(userTags)
    .where(eq(userTags.userEmail, normalizeEmail(email)));
  return rows.map((r) => r.tagId);
}

/**
 * A video is visible when the viewer is an admin, when the video is locked to
 * no tag at all, or when viewer and video share at least one tag.
 */
export async function canView(
  userEmail: string | null | undefined,
  isAdmin: boolean,
  videoId: string,
) {
  if (isAdmin) return true;
  const locks = await db
    .select({ tagId: videoTags.tagId })
    .from(videoTags)
    .where(eq(videoTags.videoId, videoId));
  if (locks.length === 0) return true;
  if (!userEmail) return false;
  const mine = new Set(await tagsOfUser(userEmail));
  return locks.some((l) => mine.has(l.tagId));
}

/** Batch variant for lists: returns the subset of `videoIds` the viewer may see. */
export async function viewableVideoIds(
  userEmail: string | null | undefined,
  isAdmin: boolean,
  videoIds: string[],
) {
  if (isAdmin) return new Set(videoIds);
  if (videoIds.length === 0) return new Set<string>();
  const locks = await db
    .select({ videoId: videoTags.videoId, tagId: videoTags.tagId })
    .from(videoTags)
    .where(inArray(videoTags.videoId, videoIds));
  const mine = new Set(userEmail ? await tagsOfUser(userEmail) : []);
  const lockedTo = new Map<string, string[]>();
  for (const lock of locks) {
    lockedTo.set(lock.videoId, [...(lockedTo.get(lock.videoId) ?? []), lock.tagId]);
  }
  return new Set(
    videoIds.filter((id) => {
      const required = lockedTo.get(id);
      return !required || required.some((tagId) => mine.has(tagId));
    }),
  );
}
