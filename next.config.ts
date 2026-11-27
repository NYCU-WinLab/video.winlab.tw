import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The image runs .next/standalone (see Dockerfile).
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // No proxyClientMaxBodySize: the proxy buffers every request body it
  // matches up to that size, before it checks the session. Uploads to
  // /api/videos bypass the proxy (see proxy.ts), so the 10 MB default stays.
};

export default nextConfig;
