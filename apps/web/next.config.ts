import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@ainotes/core",
    "@ainotes/ui",
    "@ainotes/db",
    "@ainotes/api",
  ],
  reactStrictMode: true,
};

export default nextConfig;
