import { allowListRow, normalizeEmail } from "@/lib/access";
import {
  issueLoginCode,
  MAX_REQUESTS_PER_HOUR,
  NOT_ALLOWED,
} from "@/lib/login-codes";
import { MailNotConfigured, sendPinEmail } from "@/lib/mail";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "a valid email is required" }, { status: 400 });
  }

  // Same allow list as the Google path, so an ADMIN_EMAILS address that has no
  // row yet gets one here instead of a 403. Loki's call to say plainly that an
  // address is not on the list rather than pretend a code was sent.
  if (!(await allowListRow(email))) {
    return Response.json({ error: NOT_ALLOWED }, { status: 403 });
  }

  const issued = await issueLoginCode(email);
  if (!issued.ok) {
    if (issued.reason === "cooldown") {
      return Response.json(
        {
          error: `a code was just sent, try again in ${issued.retryAfterSeconds} seconds`,
          retryAfterSeconds: issued.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "retry-after": String(issued.retryAfterSeconds) },
        },
      );
    }
    return Response.json(
      {
        error: `too many codes requested, try again later (limit ${MAX_REQUESTS_PER_HOUR} per hour)`,
      },
      { status: 429, headers: { "retry-after": "3600" } },
    );
  }

  try {
    const result = await sendPinEmail(email, issued.code);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof MailNotConfigured) {
      return Response.json({ error: "mail not configured" }, { status: 500 });
    }
    console.error("[pin] failed to send code", err);
    return Response.json({ error: "could not send the code" }, { status: 502 });
  }
}
