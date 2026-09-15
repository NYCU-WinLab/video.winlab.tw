export const runtime = "nodejs";

/** Password managers look here to find the change-password screen.
 * https://w3c.github.io/webappsec-change-password-url/ */
export function GET(req: Request) {
  return new Response(null, {
    status: 302,
    headers: { location: new URL("/account", req.url).toString() },
  });
}
