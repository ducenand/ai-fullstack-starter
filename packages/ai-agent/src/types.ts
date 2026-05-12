import type Anthropic from "@anthropic-ai/sdk";

export type Message = Anthropic.MessageParam;
export type Tool = Anthropic.Messages.ToolUnion;
export type ContentBlock = Anthropic.ContentBlock;
export type TextBlock = Anthropic.TextDelta;

export interface PipelineConfig {
  model?: string;
  systemPrompt: string;
  tools?: Tool[];
  maxTokens?: number;
  /** Enable prompt caching for system prompt (requires claude-3-5+ models) */
  cache?: boolean;
}

export interface RunResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  stopReason: string;
}

export interface StreamChunk {
  type: "text" | "done";
  text?: string;
  result?: RunResult;
}
