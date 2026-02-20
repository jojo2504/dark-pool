import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  experimental: {
    // Pre-compile all routes at startup instead of lazily on first visit
    preloadEntriesOnStart: true,
    // Turbopack-specific config (mirrors webpack externals + resolve fallback)
    turbo: {
      resolveAlias: {
        fs: "./empty-module.js",
        net: "./empty-module.js",
        tls: "./empty-module.js",
      },
    },
  },
  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  eslint: {
    ignoreDuringBuilds: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  webpack: config => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  // Server-side external packages (used by both webpack and turbopack)
  serverExternalPackages: [
    "pino-pretty",
    "lokijs",
    "encoding",
    "@0glabs/0g-serving-broker",
    "@prisma/adapter-pg",
    "pg",
  ],
};

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = {
    unoptimized: true,
  };
}

module.exports = nextConfig;
