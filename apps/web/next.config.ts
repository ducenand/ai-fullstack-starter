import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@starter/ai-agent", "@starter/logger", "@starter/queue"],
  serverExternalPackages: ["@prisma/client"],
};

export default config;
