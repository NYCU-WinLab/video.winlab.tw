import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/access";
import { loginCodes, users } from "@/lib/schema";

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

export async function findUser(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)));
  return user ?? null;
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
 * Verifies the newest live code for an email. Every call burns an attempt, and
 * the fifth wrong guess invalidates the code so a stolen inbox preview cannot
 * be brute forced.
 */
export async function verifyLoginCode(email: string, code: string) {
  const address = normalizeEmail(email);
  if (!/^\d{6}$/.test(code)) return null;
  const now = Date.now();

  const [row] = await db
    .select()
    .from(loginCodes)
    .where(
      and(
        eq(loginCodes.email, address),
        isNull(loginCodes.usedAt),
        gt(loginCodes.expiresAt, now),
      ),
    )
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);
  if (!row) return null;

  const attempts = row.attempts + 1;
  await db
    .update(loginCodes)
    .set({ attempts })
    .where(eq(loginCodes.id, row.id));

  const given = Buffer.from(hash(code), "hex");
  const stored = Buffer.from(row.codeHash, "hex");
  const match = given.length === stored.length && timingSafeEqual(given, stored);
  if (!match) {
    if (attempts >= MAX_ATTEMPTS) {
      await db
        .update(loginCodes)
        .set({ usedAt: now })
        .where(eq(loginCodes.id, row.id));
    }
    return null;
  }

  await db.update(loginCodes).set({ usedAt: now }).where(eq(loginCodes.id, row.id));

  // The allow list is checked again here: the row may have been removed while
  // the code was in flight.
  const user = await findUser(address);
  if (!user) return null;
  return { email: user.email, name: user.name };
}
