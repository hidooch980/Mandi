import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node:sqlite"],
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const existing = config.externals;
      const sqliteExternal = { "node:sqlite": "commonjs node:sqlite" };
      if (Array.isArray(existing)) {
        config.externals = [...existing, sqliteExternal];
      } else if (existing) {
        config.externals = [existing, sqliteExternal];
      } else {
        config.externals = [sqliteExternal];
      }
    }
    return config;
  },
};

export default nextConfig;
