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

`.claude/settings.json` 配置了七道 Stop hooks，Claude Code 每次会话结束后自动串行运行：

| # | 门禁 | 失败行为 |
|---|------|---------|
| 1 | `pnpm -r run typecheck` — 全包 TS 检查 | asyncRewake — Claude 修复错误 |
| 2 | `pnpm --filter @starter/ai-agent test` — 单元测试 | asyncRewake — Claude 修复失败用例 |
| 3 | 源码-测试漂移 — `pipeline.ts` 改了但 test 未同步 | asyncRewake — Claude 补测试 |
| 4 | `pnpm --filter @starter/web lint` — 前端质量检查（仅 `apps/web/src/` 有改动时触发） | asyncRewake — Claude 修复 lint 错误 |
| 5 | 前端漂移 — 组件改动超 15 行但测试未更新 | asyncRewake — Claude 更新测试 |
| 6 | `git add -A && git commit` — 自动提交 | 静默 |
| 7 | patch 版本自动 bump + `git tag` + `git push` | 静默 |

**Claude 无法悄悄破坏构建** — 错误输出会被传回，Claude 必须修复后才能结束会话。

### 前端质量规则（`apps/web/eslint.config.mjs`）

| 规则 | 级别 | 说明 |
|------|------|------|
| `complexity ≤ 10` | error | 圈复杂度超限必须拆分函数 |
| `max-lines ≤ 600` | error | 单文件行数（不含空行/注释）不超过 600 |
| `max-depth ≤ 4` | error | 嵌套层数超限须提取函数或组件 |
| `max-params ≤ 4` | warn | 参数过多时改用 options 对象 |
| `no-magic-numbers` | warn | 魔法数字提取为具名常量 |

## 测试体系

### AI agent 单元测试

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

### 前端 E2E 测试（Playwright）

E2E 测试文件位于 `apps/web/e2e/`，运行：

```bash
# 首次使用：安装浏览器二进制
pnpm --filter @starter/web exec playwright install chromium

# 运行所有 E2E 测试（自动在 3001 端口启动 Next.js）
pnpm --filter @starter/web test:e2e
```

测试服务器固定使用 **3001 端口**并注入 `PLAYWRIGHT_TEST_MODE=1`，不会与已运行在 3000 端口的开发服务器冲突。

`/e2e-chat-test` 是仅在测试模式下可访问的页面，直接渲染 `<Chat />` 而无需登录。用 `page.route()` mock SSE 响应即可测试完整的对话交互：

```typescript
await page.route("/api/chat", (route) =>
  route.fulfill({
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
    body: 'data: {"text":"你好！"}\n\ndata: {"done":true}\n\n',
  }),
);
await page.goto("/e2e-chat-test");
```

## 许可证

MIT
