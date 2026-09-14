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

export const config = {
  matcher: ["/((?!api/auth|api/health|login|_next/static|_next/image|favicon.ico).*)"],
};
