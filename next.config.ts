import type { NextConfig } from "next";

// shortcut: clickable prototype on in-memory mock data (src/mock). Add the /api rewrite to FastAPI when the backend lands.
const nextConfig: NextConfig = {
  reactCompiler: true,
};

export default nextConfig;
