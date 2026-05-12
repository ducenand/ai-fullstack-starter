import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY env var is required");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export const DEFAULT_MODEL = "claude-sonnet-4-6";
