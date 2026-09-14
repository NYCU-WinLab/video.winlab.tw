import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { findUser, normalizeEmail } from "@/lib/access";
import { loginCodes } from "@/lib/schema";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
/** Requests per email per hour. */
export const MAX_REQUESTS_PER_HOUR = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RETENTION_MS = 24 * 60 * 60 * 1000;

export const NOT_ALLOWED = "This email is not on the allow list, ask an admin.";

function hash(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

/** Constant-time comparison of two hex sha256 digests. */
function sameHash(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Issues a code, or reports the rate limit. Callers must check the allow list
 * first: this helper does not decide who is allowed to sign in. */
export async function issueLoginCode(
  email: string,
): Promise<{ ok: true; code: string } | { ok: false; reason: "rate_limited" }> {
  const address = normalizeEmail(email);
  const now = Date.now();

  await db.delete(loginCodes).where(lt(loginCodes.createdAt, now - RETENTION_MS));

  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)` })
    .from(loginCodes)
    .where(
      and(
        eq(loginCodes.email, address),
        gt(loginCodes.createdAt, now - RATE_WINDOW_MS),
      ),
    );
  if (recent >= MAX_REQUESTS_PER_HOUR) return { ok: false, reason: "rate_limited" };

  // Only the newest code is live. Retiring the older ones keeps a stale code
  // from a previous email out of the verification path entirely.
  await db
    .update(loginCodes)
    .set({ usedAt: now })
    .where(and(eq(loginCodes.email, address), isNull(loginCodes.usedAt)));

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(loginCodes).values({
    id: crypto.randomUUID(),
    email: address,
    codeHash: hash(code),
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    usedAt: null,
    createdAt: now,
  });
  return { ok: true, code };
}

/**
 * Verifies the live code for an email. Guessing burns an attempt on the live
 * code and the fifth wrong guess invalidates it, so a leaked inbox preview
 * cannot be brute forced. A code that was already superseded, used or expired
 * is rejected without touching the live code's budget: retyping the code from
 * an older email must not lock the account out.
 */
export async function verifyLoginCode(email: string, code: string) {
  const address = normalizeEmail(email);
  if (!/^\d{6}$/.test(code)) return null;
  const now = Date.now();
  const digest = hash(code);

  const rows = await db
    .select()
    .from(loginCodes)
    .where(eq(loginCodes.email, address))
    .orderBy(desc(loginCodes.createdAt));
  const live = rows.find((r) => r.usedAt === null && r.expiresAt > now);

  const matchesLive = live !== undefined && sameHash(digest, live.codeHash);
  if (!matchesLive && rows.some((r) => sameHash(digest, r.codeHash))) return null;
  if (!live) return null;

  // One statement decides the attempt: the row only moves while it is unused
  // and under the cap, so parallel guesses cannot push it past MAX_ATTEMPTS or
  // race on a stale counter.
  const [attempted] = await db
    .update(loginCodes)
    .set({ attempts: sql`${loginCodes.attempts} + 1` })
    .where(
      and(
        eq(loginCodes.id, live.id),
        isNull(loginCodes.usedAt),
        lt(loginCodes.attempts, MAX_ATTEMPTS),
        gt(loginCodes.expiresAt, now),
      ),
    )
    .returning();
  if (!attempted) return null;

  if (!sameHash(digest, attempted.codeHash)) {
    if (attempted.attempts >= MAX_ATTEMPTS) {
      await db
        .update(loginCodes)
        .set({ usedAt: now })
        .where(eq(loginCodes.id, attempted.id));
    }
    return null;
  }

  // Burning the code is also a conditional update, so two requests carrying the
  // same correct code cannot both succeed.
  const [consumed] = await db
    .update(loginCodes)
    .set({ usedAt: now })
    .where(and(eq(loginCodes.id, attempted.id), isNull(loginCodes.usedAt)))
    .returning();
  if (!consumed) return null;

  // The allow list is checked again here: the row may have been removed while
  // the code was in flight.
  const user = await findUser(address);
  if (!user) return null;
  return { email: user.email, name: user.name };
}
