import "dotenv/config";
import { createQueue } from "@starter/queue";
import { createLogger } from "@starter/logger";
import { processAiTask, type AiTaskJobData } from "./processors/ai-task.js";
import { prisma } from "./prisma.js";

const logger = createLogger("worker");
const AI_TASK_QUEUE = "ai-task";

async function main() {
  logger.info("worker_start", { queue: AI_TASK_QUEUE });

  const { createWorker } = createQueue<AiTaskJobData>(AI_TASK_QUEUE);
  const worker = createWorker(processAiTask);

  worker.on("completed", (job) => {
    logger.info("job_completed", { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    logger.error("job_failed", { jobId: job?.id, error: String(err) });
  });

  process.on("SIGTERM", async () => {
    logger.info("worker_shutdown");
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
