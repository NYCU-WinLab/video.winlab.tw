import { allowListRow, normalizeEmail } from "@/lib/access";
import { NOT_ALLOWED, verifyLoginCode } from "@/lib/login-codes";
import { passwordProblem, setPassword } from "@/lib/password";

export const runtime = "nodejs";

/** Sets a password once the mailed code proves the person owns the address.
 * This is the only thing the code can do: it is not a sign-in method. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    email?: unknown;
    code?: unknown;
    password?: unknown;
  } | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !code) {
    return Response.json({ error: "email and code are required" }, { status: 400 });
  }
  if (!(await allowListRow(email))) {
    return Response.json({ error: NOT_ALLOWED }, { status: 403 });
  }

  const problem = passwordProblem(password, email);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const verified = await verifyLoginCode(email, code);
  if (!verified) {
    return Response.json(
      { error: "That code is wrong, already used or expired." },
      { status: 400 },
    );
  }

  await setPassword(email, password);
  return Response.json({ ok: true });
}
