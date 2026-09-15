import { generateRegistrationOptions } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { allowListRow } from "@/lib/access";
import {
  CHALLENGE_COOKIE,
  CHALLENGE_TTL_MS,
  createChallenge,
  listPasskeys,
  relyingParty,
  RP_NAME,
} from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  const email = session?.user.email;
  if (!email) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await allowListRow(email, session.user.name);
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });

  const { rpID } = relyingParty();
  const existing = await listPasskeys(email);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: email,
    userDisplayName: user.name ?? email,
    // Discoverable credentials are what makes the passkey usable without
    // typing an email first.
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    excludeCredentials: existing.map((p) => ({
      id: p.id,
      transports: p.transports ? (JSON.parse(p.transports) as string[]) : undefined,
    })),
  });

  const id = await createChallenge(options.challenge, "register", email);
  (await cookies()).set(CHALLENGE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CHALLENGE_TTL_MS / 1000,
  });
  return Response.json(options);
}
