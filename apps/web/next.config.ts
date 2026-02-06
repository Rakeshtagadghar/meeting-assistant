import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ainotes/core", "@ainotes/ui"],
  reactStrictMode: true,
};

export default nextConfig;
