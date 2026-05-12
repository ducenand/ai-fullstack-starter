# ai-fullstack-starter — Claude orientation

## 一句话

pnpm + Turborepo monorepo，AI 全栈开发底座。核心 AI 逻辑在 `packages/ai-agent`，Web 在 `apps/web`，异步任务在 `apps/worker`。

## 包结构

| 包 | 职责 |
|----|------|
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

每次会话结束自动运行（`.claude/settings.json`）：
1. `turbo typecheck` — 全包 TypeScript 检查
2. `pnpm --filter @starter/ai-agent test` — ai-agent 单元测试

## 测试体系

运行单包测试：`pnpm --filter @starter/ai-agent test`

- **直接导入** — 有公开 API 的函数，如 `runText`、`runStream`
- **内联复制** — 私有函数的逻辑测试，顶部注释来源

## 常见任务入口

- 改 AI 提示词逻辑：`packages/ai-agent/src/pipeline.ts`
- 加新 worker job：`apps/worker/src/processors/` + 在 `index.ts` 注册
- 改 DB schema：`apps/web/prisma/schema.prisma` + `pnpm db:migrate`
- 加新 API route：`apps/web/src/app/api/`

## 上下文防腐

- memory 只存协作偏好、决策原因、外部资源位置
- 不存函数签名（代码会改）、不存测试列表（直接读文件）
