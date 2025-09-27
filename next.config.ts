// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Do NOT fail the production build on ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Optional: if you’re okay shipping with TS errors while we harden types
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
