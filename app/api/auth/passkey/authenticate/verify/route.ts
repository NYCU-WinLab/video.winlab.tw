import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { findUser } from "@/lib/access";
import { db } from "@/lib/db";
import { passkeys } from "@/lib/schema";
import {
  CHALLENGE_COOKIE,
  consumeChallenge,
  findPasskey,
  issueSigninTicket,
  relyingParty,
} from "@/lib/webauthn";

export const runtime = "nodejs";

const FAILED = "That passkey did not work.";

/** Verifies the assertion and hands back a one-time ticket that the Auth.js
 * "passkey" provider exchanges for a session. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    response?: AuthenticationResponseJSON;
  } | null;
  if (!body?.response) {
    return Response.json({ error: FAILED }, { status: 400 });
  }

  const jar = await cookies();
  const stored = await consumeChallenge(jar.get(CHALLENGE_COOKIE)?.value, "authenticate");
  jar.delete(CHALLENGE_COOKIE);
  if (!stored) {
    return Response.json({ error: "this sign-in expired, try again" }, { status: 400 });
  }

  const passkey = await findPasskey(body.response.id);
  if (!passkey) return Response.json({ error: FAILED }, { status: 400 });

  // Registering a passkey does not outlive the allow list.
  const user = await findUser(passkey.userEmail);
  if (!user) {
    return Response.json(
      { error: "This account is no longer on the allow list, ask an admin." },
      { status: 403 },
    );
  }

  const { rpID, origin } = relyingParty();
  const verification = await verifyAuthenticationResponse({
    response: body.response,
    expectedChallenge: stored.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
    credential: {
      id: passkey.id,
      publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64url")),
      counter: passkey.counter,
      transports: passkey.transports
        ? (JSON.parse(passkey.transports) as string[])
        : undefined,
    },
  }).catch(() => null);
  if (!verification?.verified) {
    return Response.json({ error: FAILED }, { status: 400 });
  }

  await db
    .update(passkeys)
    .set({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: Date.now(),
    })
    .where(eq(passkeys.id, passkey.id));

  const ticket = await issueSigninTicket(user.email, "passkey");
  return Response.json({ ok: true, ticket, email: user.email });
}
