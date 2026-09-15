import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import {
  CHALLENGE_COOKIE,
  CHALLENGE_TTL_MS,
  createChallenge,
  relyingParty,
} from "@/lib/webauthn";

export const runtime = "nodejs";

/** Public on purpose: this is the first step of signing in. No credential list
 * is returned, so it tells an unauthenticated caller nothing about who exists. */
export async function POST() {
  const { rpID } = relyingParty();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });

  const id = await createChallenge(options.challenge, "authenticate");
  (await cookies()).set(CHALLENGE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CHALLENGE_TTL_MS / 1000,
  });
  return Response.json(options);
}
