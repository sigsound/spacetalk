import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude large image files from serverless function bundles.
  // Images are now fetched via HTTP from the CDN, not read with fs.
  outputFileTracingExcludes: {
    "/api/chat": ["./public/data/spaces/*/images/**"],
    "/api/spaces": ["./public/data/spaces/*/images/**"],
  },
};

export default nextConfig;
