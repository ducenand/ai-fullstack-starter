import type { Job } from "bullmq";
import { runText } from "@starter/ai-agent";
import { createLogger } from "@starter/logger";
import { prisma } from "../prisma.js";

const logger = createLogger("worker");

export interface AiTaskJobData {
  taskId: string;
}

export async function processAiTask(job: Job<AiTaskJobData>): Promise<void> {
  const { taskId } = job.data;
  logger.info("ai_task_start", { taskId, jobId: job.id });

  await prisma.aiTask.update({
    where: { id: taskId },
    data: { status: "RUNNING" },
  });

  try {
    const task = await prisma.aiTask.findUniqueOrThrow({ where: { id: taskId } });

    const result = await runText(
      [{ role: "user", content: task.prompt }],
      { systemPrompt: "You are a helpful AI assistant.", cache: true },
    );

    await prisma.aiTask.update({
      where: { id: taskId },
      data: { status: "DONE", result: result.text },
    });

    logger.info("ai_task_done", {
      taskId,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
  } catch (err) {
    await prisma.aiTask.update({
      where: { id: taskId },
      data: { status: "FAILED" },
    });
    logger.error("ai_task_failed", { taskId, error: String(err) });
    throw err;
  }
}
