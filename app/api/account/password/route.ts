import { auth } from "@/auth";
import { findUser } from "@/lib/access";
import {
  clearFailedLogins,
  isLockedOut,
  passwordProblem,
  recordFailedLogin,
  setPassword,
  verifyPassword,
} from "@/lib/password";

export const runtime = "nodejs";

/** Changes the password of the signed-in user. A user who has no password yet
 * (Google or passkey only) sets the first one here without a current password;
 * the session is the proof in that case. */
export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user.email;
  if (!email) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    currentPassword?: unknown;
    newPassword?: unknown;
  } | null;
  const current =
    typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body?.newPassword === "string" ? body.newPassword : "";

  const problem = passwordProblem(next, email);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const user = await findUser(email);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  if (user.passwordHash) {
    if (await isLockedOut(email)) {
      return Response.json(
        { error: "Too many failed attempts, try again later." },
        { status: 429 },
      );
    }
    if (!current || !(await verifyPassword(current, user.passwordHash))) {
      await recordFailedLogin(email);
      return Response.json(
        { error: "The current password is wrong." },
        { status: 400 },
      );
    }
    await clearFailedLogins(email);
  }

  await setPassword(email, next);
  return Response.json({ ok: true });
}
