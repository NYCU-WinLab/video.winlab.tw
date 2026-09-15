import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { findUser, normalizeEmail } from "@/lib/access";
import { db } from "@/lib/db";
import { loginAttempts, users } from "@/lib/schema";

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
/** Failed sign-ins tolerated per email inside LOCKOUT_WINDOW_MS. */
export const MAX_FAILED_LOGINS = 10;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

// scrypt parameters. N = 2^15 keeps a single hash around 100 ms on the VM,
// which is the point: it is the work an attacker has to repeat per guess.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAXMEM = 160 * 1024 * 1024;

export function passwordProblem(password: string, email: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (password.trim().toLowerCase() === normalizeEmail(email)) {
    return "Do not use your email address as the password.";
  }
  return null;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  });
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "base64");
  const derived = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** Burned when the email is unknown or has no password, so a missing account
 * costs an attacker the same wall-clock time as a wrong password. */
const DUMMY_HASH =
  "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  "cGxhY2Vob2xkZXJwbGFjZWhvbGRlcnBsYWNlaG9sZGVyMDA=";

export async function burnDummyHash(password: string) {
  await verifyPassword(password, DUMMY_HASH).catch(() => false);
}

export async function isLockedOut(email: string) {
  const address = normalizeEmail(email);
  const now = Date.now();
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, now - LOCKOUT_WINDOW_MS));
  const [{ failures }] = await db
    .select({ failures: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.email, address),
        gt(loginAttempts.createdAt, now - LOCKOUT_WINDOW_MS),
      ),
    );
  return failures >= MAX_FAILED_LOGINS;
}

export async function recordFailedLogin(email: string) {
  await db.insert(loginAttempts).values({
    id: randomUUID(),
    email: normalizeEmail(email),
    createdAt: Date.now(),
  });
}

export async function clearFailedLogins(email: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.email, normalizeEmail(email)));
}

export async function setPassword(email: string, password: string) {
  const address = normalizeEmail(email);
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.email, address));
  await clearFailedLogins(address);
}

/**
 * The whole password check in one place: lockout first, then the hash, then
 * the allow list. Returns the user only when all three agree.
 */
export async function checkPassword(email: string, password: string) {
  const address = normalizeEmail(email);
  if (await isLockedOut(address)) return { ok: false as const, reason: "locked" as const };

  const user = await findUser(address);
  if (!user?.passwordHash) {
    await burnDummyHash(password);
    await recordFailedLogin(address);
    return { ok: false as const, reason: "invalid" as const };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    await recordFailedLogin(address);
    return { ok: false as const, reason: "invalid" as const };
  }
  await clearFailedLogins(address);
  return { ok: true as const, user };
}
