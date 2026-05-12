# AI Fullstack Starter

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
cp .env.example apps/web/.env.local
cp .env.example apps/worker/.env
# Edit: set ANTHROPIC_API_KEY + AUTH_SECRET

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

## Quality gates

The `.claude/settings.json` configures Stop hooks for Claude Code:
1. `turbo typecheck` — TypeScript check across all packages
2. `pnpm --filter @starter/ai-agent test` — ai-agent unit tests

## License

MIT
