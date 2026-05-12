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
cp .env.example apps/web/.env          # Prisma CLI 读取（migrate/generate）
cp .env.example apps/web/.env.local    # Next.js 运行时读取
cp .env.example apps/worker/.env
# 编辑以上三个文件，填写 ANTHROPIC_API_KEY + AUTH_SECRET

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

## 质量门控（Claude Code Harness）

`.claude/settings.json` 配置了三道 Stop hooks，Claude Code 每次会话结束后自动运行：

| Hook | 命令 | 失败行为 |
|------|------|---------|
| TypeCheck | `pnpm -r run typecheck` | `asyncRewake` — Claude 被唤回修复错误 |
| 单元测试 | `pnpm --filter @starter/ai-agent test` | `asyncRewake` — Claude 被唤回修复失败用例 |

这意味着 **Claude 无法悄悄破坏构建** — 错误输出会被传回，Claude 必须修复后才能结束会话。

## 测试体系

测试文件位于 `packages/ai-agent/src/__tests__/`，运行：

```bash
pnpm --filter @starter/ai-agent test
```

### 客户端注入（无需 API Key）

三个 pipeline 函数均接受可选的 `_client` 参数，测试时注入 mock，不发起真实网络请求：

```typescript
import { runText, runAgentLoop } from "@starter/ai-agent";
import { mock } from "node:test";

const create = mock.fn(async () => ({
  content: [{ type: "text", text: "你好！" }],
  stop_reason: "end_turn",
  usage: { input_tokens: 10, output_tokens: 5, ... },
}));

const fakeClient = { messages: { create } } as any;
const result = await runText(messages, config, fakeClient);
```

### 多次返回值（Node.js 原生 mock）

Node.js 的 `mock.fn()` 没有 `mockImplementationOnce`（那是 Jest API），用闭包数组代替：

```typescript
// ✓ 正确 — 闭包数组
const responses = [toolResponse, finalResponse];
let i = 0;
const create = mock.fn(async () => responses[i++]);

// ✗ 错误 — Jest API，Node.js test runner 不支持
create.mock.mockImplementationOnce(...);
```

### 测试覆盖要点

| 场景 | 断言目标 |
|------|---------|
| `runText` 正常返回 | `result.text`、`result.inputTokens` |
| 多个 text block | 文本块正确拼接 |
| `cache: true` | `system` 为含 `cache_control` 的数组 |
| `tools` 未定义 | API 调用体中不含 `tools` 字段 |
| `runAgentLoop` end_turn | 单轮调用，文本正确返回 |
| `runAgentLoop` 工具调用 | executor 被调用、循环继续、token 累加 |
| `runAgentLoop` 超出 maxTurns | 抛出含 `/maxTurns/` 的错误 |

## 许可证

MIT
