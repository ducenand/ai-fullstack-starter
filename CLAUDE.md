# ai-fullstack-starter — Claude orientation

## 一句话

pnpm + Turborepo monorepo，AI 全栈开发底座。核心 AI 逻辑在 `packages/ai-agent`，Web 在 `apps/web`，异步任务在 `apps/worker`。

## 包结构

| 包 | 职责 |
| -- | ---- |
| `packages/ai-agent` | Claude API 封装：单轮、流式、agentic loop |
| `packages/logger` | 结构化 JSON 日志 |
| `packages/queue` | BullMQ 通用 Queue/Worker 工厂 |
| `apps/web` | Next.js 15 + Prisma + Auth.js，SSE 流式对话 |
| `apps/worker` | BullMQ worker 进程，处理 AiTask 异步任务 |

## 快速启动

```bash
# 1. 安装依赖
pnpm install

# 2. 复制并填写环境变量
cp .env.example apps/web/.env          # Prisma CLI（migrate/generate）读取
cp .env.example apps/web/.env.local    # Next.js 运行时读取
cp .env.example apps/worker/.env

# 3. 启动 PostgreSQL + Redis
docker compose up -d

# 4. 初始化数据库
pnpm db:migrate

# 5. 启动所有服务（Turborepo 并行）
pnpm dev
```

## 质量门（Stop hooks）

每次会话结束自动串行运行（`.claude/settings.json`）：

| # | 门禁 | 失败行为 |
|---|------|---------|
| 1 | `pnpm -r run typecheck` — 全包 TS 检查 | asyncRewake — Claude 必须修 |
| 2 | `pnpm --filter @starter/ai-agent test` — 单元测试 | asyncRewake — Claude 必须修 |
| 3 | 源码-测试漂移检测 — pipeline.ts 改了但 test 没改 | asyncRewake — Claude 补测试 |
| 4 | `git add -A && git commit` — 自动提交 | asyncRewake: false（静默，不阻断） |

**流程语义**：1-3 任意一关失败 → Claude 被唤回修复 → 重新触发所有门禁 → 直到全部通过 → 第 4 关自动提交。

## 测试体系

运行单包测试：`pnpm --filter @starter/ai-agent test`

**两种测试模式：**

1. **直接导入**（exported 函数）

   ```ts
   import { runText } from "../pipeline.js";
   ```

2. **内联复制**（private 函数）— 顶部注释标注来源，改源码时须手动同步

**客户端注入模式（核心规则）：**

`runText`、`runStream`、`runAgentLoop` 均接受可选 `_client` 参数。
测试时注入 mock，**无需 `ANTHROPIC_API_KEY`，无网络请求**：

```ts
const create = mock.fn(async () => fakeResponse("ok"));
const fakeClient = { messages: { create } } as any;
await runText(messages, config, fakeClient);
```

**Node.js 原生 mock 规则：**

```ts
// ✓ 多次返回值 — 闭包数组
const responses = [toolResp, finalResp];
let i = 0;
const create = mock.fn(async () => responses[i++]);

// ✗ 不要用 mockImplementationOnce — 那是 Jest API
create.mock.mockImplementationOnce(...); // TypeError
```

## 常见任务入口

- 改 AI 提示词逻辑：`packages/ai-agent/src/pipeline.ts`
- 加新 worker job：`apps/worker/src/processors/` + 在 `index.ts` 注册
- 改 DB schema：`apps/web/prisma/schema.prisma` + `pnpm db:migrate`
- 加新 API route：`apps/web/src/app/api/`

## 上下文防腐

- memory 只存协作偏好、决策原因、外部资源位置
- 不存函数签名（代码会改）、不存测试列表（直接读文件）
