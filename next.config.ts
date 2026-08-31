import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Uploads stream through middleware to /api/videos; default cap is 10MB.
  experimental: {
    middlewareClientMaxBodySize: "4gb",
  },
};

export default nextConfig;
