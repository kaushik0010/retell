import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent worker mkdir race conditions on Windows
  experimental: {
    cpus: 1,
  },
};

export default nextConfig;
