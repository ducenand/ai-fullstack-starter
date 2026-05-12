# AI Fullstack Starter

[中文文档](README.zh-CN.md)

Production-ready monorepo template for building AI applications with Claude.

```bash
npx create-claude-fullstack my-app
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router, Server Components) |
| AI | Claude API via `@anthropic-ai/sdk` (streaming + tool use + caching) |
| Auth | Auth.js v5 (GitHub + Google OAuth, Prisma adapter) |
| Database | PostgreSQL + Prisma |
| Async jobs | BullMQ + Redis |
| Logging | Structured JSON (`@starter/logger`) |
| Monorepo | pnpm + Turborepo |
| Language | TypeScript strict mode throughout |

## Monorepo structure

```
ai-fullstack-starter/
├── apps/
│   ├── web/          # Next.js 15 — chat UI + REST API
│   └── worker/       # BullMQ worker — async AI tasks
├── packages/
│   ├── ai-agent/     # Claude API: streaming, tool use, agentic loop
│   ├── queue/        # Generic BullMQ Queue/Worker factory
│   └── logger/       # Structured JSON logging
├── docker-compose.yml
├── .env.example
└── CLAUDE.md
```

## Quick start

```bash
# 1. Scaffold
npx create-claude-fullstack my-app
cd my-app

# 2. Environment
cp .env.example apps/web/.env          # Prisma CLI reads this
cp .env.example apps/web/.env.local    # Next.js runtime reads this
cp .env.example apps/worker/.env
# Edit all three: set ANTHROPIC_API_KEY + AUTH_SECRET

# 3. Infra
docker compose up -d       # PostgreSQL + Redis
pnpm db:migrate            # Create tables

# 4. Develop
pnpm dev                   # All apps in parallel via Turborepo
```

Open [http://localhost:3000](http://localhost:3000).

## packages/ai-agent

```typescript
import { runText, runStream, runAgentLoop } from "@starter/ai-agent";

// Single-turn
const result = await runText(messages, {
  systemPrompt: "You are helpful.",
  cache: true,              // enables prompt caching
});

// Streaming (SSE)
for await (const chunk of runStream(messages, { systemPrompt: "..." })) {
  if (chunk.type === "text") process.stdout.write(chunk.text!);
}

// Agentic loop with tool use
const result = await runAgentLoop(messages, { systemPrompt: "...", tools }, {
  search: async (input) => fetchSearchResults(input),
  calculator: async (input) => evaluate(input),
});
```

## CLI options

```
$ npx create-claude-fullstack
✔ Project name … my-app
✔ AI provider › Claude (Anthropic)
✔ Database › PostgreSQL
✔ Include async worker (BullMQ + Redis)? › yes
✔ Run pnpm install after scaffolding? › yes
```

Options:
- **AI provider**: Claude (Anthropic) or OpenAI-compatible (OpenAI, Groq, Together, etc.)
- **Database**: PostgreSQL (production) or SQLite (zero-config local dev)
- **Worker**: optional BullMQ + Redis for async tasks

## Deploy

The `apps/web` directory is a standard Next.js app. Deploy to Vercel, Railway, Fly.io, or any Node.js host.

The `apps/worker` is a Node.js process. Run it alongside your web app (`node dist/index.js`).

## Quality gates (Claude Code harness)

`.claude/settings.json` wires three Stop hooks that run automatically when Claude Code finishes a session:

| Hook | Command | Failure action |
|------|---------|---------------|
| TypeCheck | `pnpm -r run typecheck` | `asyncRewake` — Claude is pulled back to fix errors |
| Unit tests | `pnpm --filter @starter/ai-agent test` | `asyncRewake` — Claude is pulled back to fix failures |

This means **Claude cannot silently break the build** — it gets re-woken with the error output and must fix it before the session ends.

## Testing patterns

Tests live in `packages/ai-agent/src/__tests__/`. Run them:

```bash
pnpm --filter @starter/ai-agent test
```

### Client injection (no API key needed)

All three pipeline functions accept an optional `_client` parameter. Inject a mock in tests — no `ANTHROPIC_API_KEY` required, no network calls:

```typescript
import { runText, runAgentLoop } from "@starter/ai-agent";
import { mock } from "node:test";

const create = mock.fn(async () => ({
  content: [{ type: "text", text: "Hello!" }],
  stop_reason: "end_turn",
  usage: { input_tokens: 10, output_tokens: 5, ... },
}));

const fakeClient = { messages: { create } } as any;

const result = await runText(messages, config, fakeClient);
// assert result.text === "Hello!"
```

### Multiple return values (Node.js native mock)

Node.js `mock.fn()` has no `mockImplementationOnce`. Use a closure array instead:

```typescript
// ✓ correct — closure array
const responses = [toolResponse, finalResponse];
let i = 0;
const create = mock.fn(async () => responses[i++]);

// ✗ wrong — jest API, not available in Node.js test runner
create.mock.mockImplementationOnce(...);
```

### What to test

| Scenario | What to assert |
|----------|---------------|
| `runText` happy path | `result.text`, `result.inputTokens` |
| multi-block response | text blocks are concatenated |
| `cache: true` | `system` is an array with `cache_control: { type: "ephemeral" }` |
| `tools: undefined` | `tools` key is absent from the API call body |
| `runAgentLoop` end_turn | single API call, correct text returned |
| `runAgentLoop` tool use | executor called, loop continues, tokens accumulated |
| `runAgentLoop` maxTurns | throws `/maxTurns/` error |

## License

MIT
