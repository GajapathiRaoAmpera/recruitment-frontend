import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Resume fetching from Drive can run a minute or more; the dev/prod proxy default is 30 s.
  experimental: { proxyTimeout: 300_000 },
  output: "standalone", // self-contained server for the Docker image
  // Browser calls /api/v1 on its own origin, so FastAPI needs no CORS. API_URL is read at build time.
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/:path*` }];
  },
};

export default nextConfig;
