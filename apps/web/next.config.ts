import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@starter/ai-agent", "@starter/logger", "@starter/queue"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};

export default config;
