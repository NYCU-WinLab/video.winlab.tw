import { auth } from "@/auth";

// Next.js 16 renamed the middleware convention to proxy.ts; the behaviour is
// unchanged, but it now runs on the Node.js runtime.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (!req.auth) {
    if (pathname.startsWith("/api")) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.redirect(new URL("/login", req.nextUrl));
  }
  if (pathname.startsWith("/admin") && !req.auth.user?.isAdmin) {
    return Response.redirect(new URL("/", req.nextUrl));
  }
});

// POST /api/videos (the upload) is not matched: the proxy would buffer the
// whole body before it runs. That route checks the session itself before it
// reads the body.
export const config = {
  matcher: [
    "/((?!api/auth|api/health|api/videos$|login|manual|\\.well-known|_next/static|_next/image|icon\\.png$|apple-icon\\.png$).*)",
  ],
};
