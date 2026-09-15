export const runtime = "nodejs";

/** Password managers look here to find the change-password screen.
 * https://w3c.github.io/webappsec-change-password-url/
 * The location is relative on purpose: behind the reverse proxy req.url is
 * the internal origin (localhost:3000), not the public one. */
export function GET() {
  return new Response(null, {
    status: 302,
    headers: { location: "/account" },
  });
}
