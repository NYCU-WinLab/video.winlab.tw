import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/access";
import { passkeys, signinTickets, webauthnChallenges } from "@/lib/schema";

export const CHALLENGE_COOKIE = "webauthn-challenge";
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const TICKET_TTL_MS = 2 * 60 * 1000;

export const RP_NAME = "WinLab Video";

/**
 * A passkey is bound to the host it was created on, so the relying party id and
 * the expected origin both come from the deployment URL that Auth.js already
 * needs. localhost keeps working because the browser allows it without TLS.
 */
export function relyingParty() {
  const raw =
    process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const url = new URL(raw);
  return { rpID: url.hostname, origin: url.origin };
}

export async function createChallenge(
  challenge: string,
  kind: "register" | "authenticate",
  email?: string,
) {
  const now = Date.now();
  await db.delete(webauthnChallenges).where(lt(webauthnChallenges.expiresAt, now));
  const id = randomUUID();
  await db.insert(webauthnChallenges).values({
    id,
    challenge,
    email: email ? normalizeEmail(email) : null,
    kind,
    expiresAt: now + CHALLENGE_TTL_MS,
    createdAt: now,
  });
  return id;
}

/** Single use: the row is deleted as it is read, so a replayed response fails. */
export async function consumeChallenge(
  id: string | undefined,
  kind: "register" | "authenticate",
) {
  if (!id) return null;
  const [row] = await db
    .delete(webauthnChallenges)
    .where(and(eq(webauthnChallenges.id, id), eq(webauthnChallenges.kind, kind)))
    .returning();
  if (!row || row.expiresAt < Date.now()) return null;
  return row;
}

export async function listPasskeys(email: string) {
  return db
    .select()
    .from(passkeys)
    .where(eq(passkeys.userEmail, normalizeEmail(email)))
    .orderBy(asc(passkeys.createdAt));
}

export async function findPasskey(id: string) {
  const [row] = await db.select().from(passkeys).where(eq(passkeys.id, id));
  return row ?? null;
}

/** Turns what the authenticator told us into something a person recognises. */
export function defaultPasskeyName(deviceType: string, userAgent: string) {
  if (/iPhone|iPad/i.test(userAgent)) return "iPhone or iPad";
  if (/Macintosh/i.test(userAgent)) return "Mac";
  if (/Android/i.test(userAgent)) return "Android device";
  if (/Windows/i.test(userAgent)) return "Windows device";
  return deviceType === "multiDevice" ? "Synced passkey" : "Security key";
}

export async function issueSigninTicket(email: string, method: string) {
  const now = Date.now();
  await db.delete(signinTickets).where(lt(signinTickets.expiresAt, now));
  const id = randomUUID();
  await db.insert(signinTickets).values({
    id,
    email: normalizeEmail(email),
    method,
    expiresAt: now + TICKET_TTL_MS,
    usedAt: null,
    createdAt: now,
  });
  return id;
}

/** Burns the ticket in one conditional update so it cannot be replayed. */
export async function consumeSigninTicket(id: string, method: string) {
  const now = Date.now();
  const [row] = await db
    .update(signinTickets)
    .set({ usedAt: now })
    .where(
      and(
        eq(signinTickets.id, id),
        eq(signinTickets.method, method),
        isNull(signinTickets.usedAt),
        gt(signinTickets.expiresAt, now),
      ),
    )
    .returning();
  return row ?? null;
}
