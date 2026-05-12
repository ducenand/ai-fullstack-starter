/**
 * pipeline.test.ts
 * 直接导入模式：runText / runAgentLoop 接受可选 _client 参数，
 * 测试时注入 mock，无需 ANTHROPIC_API_KEY。
 */
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { runText, runAgentLoop } from "../pipeline.js";
import type { PipelineConfig } from "../types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fakeResponse(text: string, stopReason = "end_turn") {
  return {
    content: [{ type: "text", text }],
    stop_reason: stopReason,
    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  };
}

function fakeToolResponse(toolName: string, toolId = "t1") {
  return {
    content: [{ type: "tool_use", id: toolId, name: toolName, input: { q: "test" } }],
    stop_reason: "tool_use",
    usage: { input_tokens: 8, output_tokens: 3, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  };
}

function makeClient(createFn: ReturnType<typeof mock.fn>) {
  return { messages: { create: createFn } } as unknown as Parameters<typeof runText>[2];
}

const CONFIG: PipelineConfig = { systemPrompt: "You are helpful.", maxTokens: 256 };

// ── runText ───────────────────────────────────────────────────────────────────

describe("runText", () => {
  it("返回 API 响应的文本和 token 计数", async () => {
    const create = mock.fn(async () => fakeResponse("Hello!"));
    const result = await runText([{ role: "user", content: "Hi" }], CONFIG, makeClient(create));

    assert.equal(result.text, "Hello!");
    assert.equal(result.inputTokens, 10);
    assert.equal(result.outputTokens, 5);
    assert.equal(result.stopReason, "end_turn");
  });

  it("合并多个 text block", async () => {
    const create = mock.fn(async () => ({
      ...fakeResponse(""),
      content: [{ type: "text", text: "Foo" }, { type: "text", text: "Bar" }],
    }));
    const result = await runText([{ role: "user", content: "Hi" }], CONFIG, makeClient(create));
    assert.equal(result.text, "FooBar");
  });

  it("cache=true 时 system 为带 cache_control 的数组", async () => {
    const create = mock.fn(async (_: unknown) => fakeResponse("ok"));
    await runText([{ role: "user", content: "Hi" }], { ...CONFIG, cache: true }, makeClient(create));

    const body = create.mock.calls[0]!.arguments[0] as Record<string, unknown>;
    const system = body["system"] as Array<{ cache_control?: unknown }>;
    assert.ok(Array.isArray(system));
    assert.deepEqual(system[0]!.cache_control, { type: "ephemeral" });
  });

  it("tools 为 undefined 时不传 tools 字段", async () => {
    const create = mock.fn(async (_: unknown) => fakeResponse("ok"));
    await runText([{ role: "user", content: "Hi" }], CONFIG, makeClient(create));

    const body = create.mock.calls[0]!.arguments[0] as Record<string, unknown>;
    assert.equal("tools" in body, false);
  });
});

// ── runAgentLoop ──────────────────────────────────────────────────────────────

describe("runAgentLoop", () => {
  it("stop_reason=end_turn 时单轮返回", async () => {
    const create = mock.fn(async () => fakeResponse("Done!"));
    const result = await runAgentLoop(
      [{ role: "user", content: "Go" }],
      CONFIG,
      {},
      10,
      makeClient(create),
    );

    assert.equal(result.text, "Done!");
    assert.equal(create.mock.calls.length, 1);
  });

  it("调用 tool executor 后继续循环", async () => {
    const responses = [fakeToolResponse("search"), fakeResponse("Search result: foo")];
    let callIdx = 0;
    const create = mock.fn(async () => responses[callIdx++]);

    const searchTool = mock.fn(async () => ({ results: ["foo"] }));

    const result = await runAgentLoop(
      [{ role: "user", content: "Search something" }],
      CONFIG,
      { search: searchTool },
      10,
      makeClient(create),
    );

    assert.equal(create.mock.calls.length, 2);
    assert.equal(searchTool.mock.calls.length, 1);
    assert.equal(result.text, "Search result: foo");
  });

  it("超过 maxTurns 时抛出错误", async () => {
    const create = mock.fn(async () => fakeToolResponse("loop_tool"));

    await assert.rejects(
      () => runAgentLoop(
        [{ role: "user", content: "Loop" }],
        CONFIG,
        { loop_tool: async () => "ok" },
        2,
        makeClient(create),
      ),
      /maxTurns/,
    );
  });

  it("累加多轮 token 计数", async () => {
    const responses = [fakeToolResponse("tool_a"), fakeResponse("final")];
    let callIdx = 0;
    const create = mock.fn(async () => responses[callIdx++]);

    const result = await runAgentLoop(
      [{ role: "user", content: "Go" }],
      CONFIG,
      { tool_a: async () => null },
      10,
      makeClient(create),
    );

    assert.equal(result.inputTokens, 18);  // 8 + 10
    assert.equal(result.outputTokens, 8);  // 3 + 5
  });
});
