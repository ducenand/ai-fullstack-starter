import { Redis } from "bullmq";

export function createRedisConnection(): Redis {
  const url = process.env["REDIS_URL"];
  if (!url) throw new Error("REDIS_URL env var is required");
  return new Redis(url, { maxRetriesPerRequest: null });
}
