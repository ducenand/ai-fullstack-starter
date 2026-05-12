import { auth } from "@/lib/auth";
import { runStream } from "@starter/ai-agent";
import { createLogger } from "@starter/logger";
import { z } from "zod";

const logger = createLogger("web");

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
});

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 422 });
  }

  const { messages } = parsed.data;
  const requestId = crypto.randomUUID();
  logger.info("chat_request", { userId: session.user.id, requestId, turns: messages.length });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of runStream(messages, {
          systemPrompt: "You are a helpful AI assistant. Be concise and clear.",
          cache: true,
        })) {
          if (chunk.type === "text" && chunk.text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.text })}\n\n`));
          } else if (chunk.type === "done" && chunk.result) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ done: true, usage: {
                input: chunk.result.inputTokens,
                output: chunk.result.outputTokens,
                cacheRead: chunk.result.cacheReadTokens,
              }})}\n\n`),
            );
            logger.info("chat_done", {
              userId: session.user.id,
              requestId,
              inputTokens: chunk.result.inputTokens,
              outputTokens: chunk.result.outputTokens,
            });
          }
        }
      } catch (err) {
        logger.error("chat_error", { requestId, error: String(err) });
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
