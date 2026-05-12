import type Anthropic from "@anthropic-ai/sdk";
import { getClient, DEFAULT_MODEL } from "./client.js";
import type { PipelineConfig, RunResult, Message, StreamChunk } from "./types.js";

/**
 * Single-turn text pipeline. Returns full text after completion.
 */
export async function runText(
  messages: Message[],
  config: PipelineConfig,
): Promise<RunResult> {
  const client = getClient();
  const model = config.model ?? DEFAULT_MODEL;

  const systemParam: Anthropic.MessageCreateParams["system"] = config.cache
    ? [{ type: "text", text: config.systemPrompt, cache_control: { type: "ephemeral" } }]
    : config.systemPrompt;

  const response = await client.messages.create({
    model,
    max_tokens: config.maxTokens ?? 4096,
    system: systemParam,
    messages,
    tools: config.tools,
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const usage = response.usage as Anthropic.Usage & {
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };

  return {
    text,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    stopReason: response.stop_reason ?? "end_turn",
  };
}

/**
 * Streaming pipeline. Yields text chunks then a final done chunk.
 */
export async function* runStream(
  messages: Message[],
  config: PipelineConfig,
): AsyncGenerator<StreamChunk> {
  const client = getClient();
  const model = config.model ?? DEFAULT_MODEL;

  const systemParam: Anthropic.MessageCreateParams["system"] = config.cache
    ? [{ type: "text", text: config.systemPrompt, cache_control: { type: "ephemeral" } }]
    : config.systemPrompt;

  const stream = await client.messages.create({
    model,
    max_tokens: config.maxTokens ?? 4096,
    system: systemParam,
    messages,
    stream: true,
  });

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  let stopReason = "end_turn";
  let fullText = "";

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullText += event.delta.text;
      yield { type: "text", text: event.delta.text };
    } else if (event.type === "message_delta") {
      stopReason = event.delta.stop_reason ?? stopReason;
      outputTokens = event.usage.output_tokens;
    } else if (event.type === "message_start") {
      const usage = event.message.usage as Anthropic.Usage & {
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
      inputTokens = usage.input_tokens;
      cacheReadTokens = usage.cache_read_input_tokens ?? 0;
      cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
    }
  }

  yield {
    type: "done",
    result: { text: fullText, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, stopReason },
  };
}

/**
 * Agentic loop: keeps calling the model until no more tool_use blocks.
 * Caller supplies a toolExecutor map: toolName → async handler.
 */
export async function runAgentLoop(
  messages: Message[],
  config: PipelineConfig,
  toolExecutors: Record<string, (input: unknown) => Promise<unknown>>,
  maxTurns = 10,
): Promise<RunResult> {
  const client = getClient();
  const model = config.model ?? DEFAULT_MODEL;
  const history = [...messages];
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheCreate = 0;
  let lastText = "";

  for (let turn = 0; turn < maxTurns; turn++) {
    const systemParam: Anthropic.MessageCreateParams["system"] = config.cache
      ? [{ type: "text", text: config.systemPrompt, cache_control: { type: "ephemeral" } }]
      : config.systemPrompt;

    const response = await client.messages.create({
      model,
      max_tokens: config.maxTokens ?? 4096,
      system: systemParam,
      messages: history,
      tools: config.tools,
    });

    const usage = response.usage as Anthropic.Usage & {
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
    totalInput += usage.input_tokens;
    totalOutput += usage.output_tokens;
    totalCacheRead += usage.cache_read_input_tokens ?? 0;
    totalCacheCreate += usage.cache_creation_input_tokens ?? 0;

    history.push({ role: "assistant", content: response.content });

    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    lastText = textBlocks.map((b) => b.text).join("");

    if (response.stop_reason !== "tool_use") {
      return {
        text: lastText,
        inputTokens: totalInput,
        outputTokens: totalOutput,
        cacheReadTokens: totalCacheRead,
        cacheCreationTokens: totalCacheCreate,
        stopReason: response.stop_reason ?? "end_turn",
      };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const executor = toolExecutors[block.name];
      if (!executor) throw new Error(`No executor for tool: ${block.name}`);
      const output = await executor(block.input);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(output),
      });
    }
    history.push({ role: "user", content: toolResults });
  }

  throw new Error(`Agent loop exceeded maxTurns (${maxTurns})`);
}
