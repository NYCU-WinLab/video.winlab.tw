import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT ?? 587);
const user = process.env.SMTP_USER ?? "";
const pass = process.env.SMTP_PASS ?? "";
const from = process.env.MAIL_FROM ?? `video.winlab.tw <${user}>`;

export const SUBJECT = "Your video.winlab.tw verification code";

export class MailNotConfigured extends Error {
  constructor() {
    super("mail not configured");
  }
}

// The site theme is a neutral shadcn palette with a 1rem radius and a mono font
// stack (app/globals.css). Mail clients drop stylesheets, so the same values are
// inlined here. Colours stay mid-contrast so a dark-mode client that inverts the
// background still renders readable text.
const INK = "#252525";
const MUTED = "#737373";
const BORDER = "#e5e5e5";
const SURFACE = "#fafafa";
const CARD = "#ffffff";
const FONT =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

function body(code: string) {
  const text = [
    `Your verification code for video.winlab.tw is ${code}.`,
    "",
    "It expires in 10 minutes and can only be used once.",
    "If you did not ask for it, ignore this message.",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:${SURFACE};font-family:${FONT};color:${INK}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0"
                 style="max-width:480px;width:100%;background:${CARD};border:1px solid ${BORDER};border-radius:16px">
            <tr>
              <td style="padding:24px 24px 0 24px;font-size:14px;font-weight:600;letter-spacing:0.02em">
                video.winlab.tw
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 0 24px;font-size:14px;line-height:20px;color:${MUTED}">
                Your verification code
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 0 24px;font-size:32px;line-height:40px;font-weight:600;letter-spacing:8px">
                ${code}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 24px 24px;font-size:13px;line-height:20px;color:${MUTED}">
                It expires in 10 minutes and can only be used once. If you did not
                ask for it, ignore this message.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return { text, html };
}

/**
 * Sends the one-time verification code. Without SMTP credentials the code is printed to the
 * server log so a dev instance stays usable; in production that would silently
 * hand out codes to nobody, so it fails loudly instead.
 */
export async function sendPinEmail(email: string, code: string) {
  if (!user || !pass) {
    if (process.env.NODE_ENV === "production") throw new MailNotConfigured();
    console.log(`[mail] SMTP not configured, verification code for ${email}: ${code}`);
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
