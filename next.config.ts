import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Uploads pass through the proxy (middleware) to /api/videos; default cap
  // is 10 MB. Keep in sync with MAX_UPLOAD_BYTES in lib/limits.ts.
  experimental: {
    proxyClientMaxBodySize: "2gb",
  },
};

export default nextConfig;
