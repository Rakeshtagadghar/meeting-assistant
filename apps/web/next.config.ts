import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

// Load env vars from the monorepo root .env so all packages can access them
const rootEnvPath = resolve(__dirname, "../../.env");
try {
  const envContent = readFileSync(rootEnvPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Only set if not already defined (don't override explicit env)
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // Root .env not found — that's fine, env may be set externally
}

const nextConfig: NextConfig = {
  transpilePackages: [
    "@ainotes/core",
    "@ainotes/ui",
    "@ainotes/db",
    "@ainotes/api",
  ],
  reactStrictMode: true,
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],

  // Turbopack is the default bundler in Next.js 16
  turbopack: {},

  // Webpack fallback for explicit --webpack builds:
  // @huggingface/transformers references Node.js modules needing client-side stubs
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
