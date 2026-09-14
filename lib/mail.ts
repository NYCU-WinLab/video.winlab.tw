import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT ?? 587);
const user = process.env.SMTP_USER ?? "";
const pass = process.env.SMTP_PASS ?? "";
const from = process.env.MAIL_FROM ?? `video.winlab.tw <${user}>`;

export const SUBJECT = "Your video.winlab.tw sign-in code";

export class MailNotConfigured extends Error {
  constructor() {
    super("mail not configured");
  }
}

function body(code: string) {
  const text = [
    `Your sign-in code for video.winlab.tw is ${code}.`,
    "",
    "The code expires in 10 minutes and can only be used once.",
    "If you did not ask for it, ignore this message.",
  ].join("\n");
  const html = [
    `<p>Your sign-in code for <strong>video.winlab.tw</strong> is</p>`,
    `<p style="font-size:28px;letter-spacing:6px;font-weight:600">${code}</p>`,
    `<p>The code expires in 10 minutes and can only be used once.`,
    ` If you did not ask for it, ignore this message.</p>`,
  ].join("");
  return { text, html };
}

/**
 * Sends the one-time code. Without SMTP credentials the code is printed to the
 * server log so a dev instance stays usable; in production that would silently
 * hand out codes to nobody, so it fails loudly instead.
 */
export async function sendPinEmail(email: string, code: string) {
  if (!user || !pass) {
    if (process.env.NODE_ENV === "production") throw new MailNotConfigured();
    console.log(`[mail] SMTP not configured, sign-in code for ${email}: ${code}`);
    return { sent: false, dev: true };
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  const { text, html } = body(code);
  await transport.sendMail({ from, to: email, subject: SUBJECT, text, html });
  return { sent: true, dev: false };
}
