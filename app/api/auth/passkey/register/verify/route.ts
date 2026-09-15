import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { normalizeEmail } from "@/lib/access";
import { db } from "@/lib/db";
import { passkeys } from "@/lib/schema";
import {
  CHALLENGE_COOKIE,
  consumeChallenge,
  defaultPasskeyName,
  relyingParty,
} from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user.email;
  if (!email) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    response?: RegistrationResponseJSON;
    name?: unknown;
  } | null;
  if (!body?.response) {
    return Response.json({ error: "missing registration response" }, { status: 400 });
  }

  const jar = await cookies();
  const stored = await consumeChallenge(jar.get(CHALLENGE_COOKIE)?.value, "register");
  jar.delete(CHALLENGE_COOKIE);
  if (!stored || stored.email !== normalizeEmail(email)) {
    return Response.json({ error: "this registration expired, start again" }, { status: 400 });
  }

  const { rpID, origin } = relyingParty();
  const verification = await verifyRegistrationResponse({
    response: body.response,
    expectedChallenge: stored.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  }).catch(() => null);
  if (!verification?.verified || !verification.registrationInfo) {
    return Response.json({ error: "could not verify this device" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 60)
      : defaultPasskeyName(credentialDeviceType, req.headers.get("user-agent") ?? "");

  await db
    .insert(passkeys)
    .values({
      id: credential.id,
      userEmail: normalizeEmail(email),
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ? JSON.stringify(credential.transports) : null,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp ? 1 : 0,
      name,
      createdAt: Date.now(),
      lastUsedAt: null,
    })
    .onConflictDoNothing();

  return Response.json({ ok: true, id: credential.id, name });
}
