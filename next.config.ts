import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_BUILD_ID: process.env.NEXT_PUBLIC_APP_BUILD_ID || `0.2.1-${process.env.VERCEL_GIT_COMMIT_SHA || "local"}-${Date.now()}` },
};

export default nextConfig;
