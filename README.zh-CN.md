# AI Fullstack Starter

基于 Claude 构建 AI 应用的生产就绪 Monorepo 模板。

```bash
npx create-claude-fullstack my-app
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 15（App Router、Server Components） |
| AI | Claude API via `@anthropic-ai/sdk`（流式 + 工具调用 + 缓存） |
| 认证 | Auth.js v5（GitHub + Google OAuth，Prisma 适配器） |
| 数据库 | PostgreSQL + Prisma |
| 异步任务 | BullMQ + Redis |
| 日志 | 结构化 JSON（`@starter/logger`） |
| Monorepo | pnpm + Turborepo |
| 语言 | 全栈 TypeScript 严格模式 |

## Monorepo 结构

```
ai-fullstack-starter/
├── apps/
│   ├── web/          # Next.js 15 — 对话 UI + REST API
│   └── worker/       # BullMQ worker — 异步 AI 任务
├── packages/
│   ├── ai-agent/     # Claude API：流式、工具调用、agentic loop
│   ├── queue/        # 通用 BullMQ Queue/Worker 工厂
│   └── logger/       # 结构化 JSON 日志
├── docker-compose.yml
├── .env.example
└── CLAUDE.md
```

## 快速启动

```bash
# 1. 初始化项目
npx create-claude-fullstack my-app
cd my-app

# 2. 配置环境变量
cp .env.example apps/web/.env.local
cp .env.example apps/worker/.env
# 编辑文件，填写 ANTHROPIC_API_KEY + AUTH_SECRET

# 3. 启动基础设施
docker compose up -d       # PostgreSQL + Redis
pnpm db:migrate            # 创建数据库表

# 4. 启动开发服务
pnpm dev                   # 通过 Turborepo 并行启动所有应用
```

访问 [http://localhost:3000](http://localhost:3000)。

## packages/ai-agent

```typescript
import { runText, runStream, runAgentLoop } from "@starter/ai-agent";

// 单轮对话
const result = await runText(messages, {
  systemPrompt: "你是一个有帮助的助手。",
  cache: true,              // 启用提示词缓存
});

// 流式输出（SSE）
for await (const chunk of runStream(messages, { systemPrompt: "..." })) {
  if (chunk.type === "text") process.stdout.write(chunk.text!);
}

// 带工具调用的 Agentic Loop
const result = await runAgentLoop(messages, { systemPrompt: "...", tools }, {
  search: async (input) => fetchSearchResults(input),
  calculator: async (input) => evaluate(input),
});
```

## CLI 选项

```
$ npx create-claude-fullstack
✔ 项目名称 … my-app
✔ AI 提供商 › Claude (Anthropic)
✔ 数据库 › PostgreSQL
✔ 是否包含异步 worker（BullMQ + Redis）？› 是
✔ 脚手架完成后运行 pnpm install？› 是
```

选项说明：
- **AI 提供商**：Claude（Anthropic）或 OpenAI 兼容（OpenAI、Groq、Together 等）
- **数据库**：PostgreSQL（生产环境）或 SQLite（零配置本地开发）
- **Worker**：可选的 BullMQ + Redis 异步任务支持

## 部署

`apps/web` 是标准 Next.js 应用，可部署到 Vercel、Railway、Fly.io 或任意 Node.js 宿主。

`apps/worker` 是独立 Node.js 进程，与 Web 应用并行运行（`node dist/index.js`）。

## 质量门控

`.claude/settings.json` 为 Claude Code 配置了 Stop hooks：
1. `turbo typecheck` — 全包 TypeScript 检查
2. `pnpm --filter @starter/ai-agent test` — ai-agent 单元测试

## 许可证

MIT
