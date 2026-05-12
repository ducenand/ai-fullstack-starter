#!/usr/bin/env node
import * as p from "@clack/prompts";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import kleur from "kleur";

const GITHUB_REPO = "16679192/ai-fullstack-starter";
const TEMPLATE_REF = "main";

interface Options {
  projectName: string;
  aiProvider: "claude" | "openai-compat";
  database: "postgresql" | "sqlite";
  includeWorker: boolean;
  runInstall: boolean;
}

async function main() {
  console.log();
  p.intro(kleur.bgCyan().black(" create-claude-fullstack "));

  const projectArg = process.argv[2];

  const opts = await p.group(
    {
      projectName: () =>
        p.text({
          message: "Project name",
          placeholder: "my-ai-app",
          initialValue: projectArg ?? "my-ai-app",
          validate: (v) => {
            if (!v) return "Required";
            if (!/^[a-z0-9-_]+$/i.test(v)) return "Use letters, numbers, hyphens, underscores only";
            if (existsSync(resolve(process.cwd(), v))) return `Directory "${v}" already exists`;
          },
        }),

      aiProvider: () =>
        p.select({
          message: "AI provider",
          options: [
            { value: "claude", label: "Claude (Anthropic)", hint: "recommended" },
            { value: "openai-compat", label: "OpenAI-compatible (OpenAI, Groq, etc.)" },
          ],
        }) as Promise<"claude" | "openai-compat">,

      database: () =>
        p.select({
          message: "Database",
          options: [
            { value: "postgresql", label: "PostgreSQL", hint: "production-ready, requires Docker locally" },
            { value: "sqlite", label: "SQLite", hint: "zero-config local dev" },
          ],
        }) as Promise<"postgresql" | "sqlite">,

      includeWorker: () =>
        p.confirm({
          message: "Include async worker (BullMQ + Redis)?",
          initialValue: true,
        }),

      runInstall: () =>
        p.confirm({
          message: "Run pnpm install after scaffolding?",
          initialValue: true,
        }),
    },
    {
      onCancel: () => {
        p.cancel("Cancelled.");
        process.exit(0);
      },
    },
  ) as Options;

  const targetDir = resolve(process.cwd(), opts.projectName);
  const s = p.spinner();

  // 1. Download template
  s.start("Downloading template from GitHub...");
  try {
    const degit = (await import("degit")).default;
    const emitter = degit(`${GITHUB_REPO}#${TEMPLATE_REF}`, { force: true });
    await emitter.clone(targetDir);
    s.stop("Template downloaded");
  } catch (err) {
    s.stop(kleur.red("Failed to download template"));
    p.log.error(`Could not fetch ${GITHUB_REPO}. Check your internet connection.\n${String(err)}`);
    process.exit(1);
  }

  // 2. Apply options
  s.start("Configuring project...");
  applyOptions(targetDir, opts);
  s.stop("Project configured");

  // 3. Install dependencies
  if (opts.runInstall) {
    s.start("Installing dependencies with pnpm...");
    try {
      execSync("pnpm install", { cwd: targetDir, stdio: "pipe" });
      s.stop("Dependencies installed");
    } catch {
      s.stop(kleur.yellow("pnpm install failed — run it manually"));
    }
  }

  // Done
  p.outro(kleur.green("Project ready!"));

  const rel = opts.projectName;
  console.log(
    [
      "",
      `  ${kleur.bold("Next steps:")}`,
      `  ${kleur.cyan("cd")} ${rel}`,
      `  ${kleur.cyan("cp")} .env.example apps/web/.env.local`,
      `  ${kleur.cyan("cp")} .env.example apps/worker/.env`,
      `  ${kleur.dim("# Fill in ANTHROPIC_API_KEY and AUTH_SECRET")}`,
      `  ${kleur.cyan("docker compose up -d")}`,
      `  ${kleur.cyan("pnpm db:migrate")}`,
      `  ${kleur.cyan("pnpm dev")}`,
      "",
    ].join("\n"),
  );
}

function applyOptions(dir: string, opts: Options) {
  // Replace project name placeholders
  replaceInDir(dir, "ai-fullstack-starter", opts.projectName);
  replaceInDir(dir, "@starter/", `@${opts.projectName}/`);

  // SQLite: swap Prisma provider
  if (opts.database === "sqlite") {
    const schemaPath = join(dir, "apps/web/prisma/schema.prisma");
    if (existsSync(schemaPath)) {
      let schema = readFileSync(schemaPath, "utf8");
      schema = schema
        .replace('provider = "postgresql"', 'provider = "sqlite"')
        .replace('url      = env("DATABASE_URL")', 'url      = env("DATABASE_URL")')
        // Remove @db.Text annotations (not supported by SQLite)
        .replace(/@db\.Text/g, "");
      writeFileSync(schemaPath, schema);
    }

    // Update .env.example for SQLite
    const envPath = join(dir, ".env.example");
    if (existsSync(envPath)) {
      let env = readFileSync(envPath, "utf8");
      env = env.replace(
        /^DATABASE_URL=.*/m,
        "DATABASE_URL=file:./dev.db",
      );
      writeFileSync(envPath, env);
    }
  }

  // OpenAI-compat: swap SDK in ai-agent
  if (opts.aiProvider === "openai-compat") {
    const clientPath = join(dir, "packages/ai-agent/src/client.ts");
    if (existsSync(clientPath)) {
      writeFileSync(clientPath, OPENAI_COMPAT_CLIENT);
    }
    const pkgPath = join(dir, "packages/ai-agent/package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        dependencies: Record<string, string>;
      };
      delete pkg.dependencies["@anthropic-ai/sdk"];
      pkg.dependencies["openai"] = "^4.87.0";
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    }
  }

  // Remove worker if not wanted
  if (!opts.includeWorker) {
    removeDir(join(dir, "apps/worker"));
    // Remove worker from turbo.json and root package.json is handled by replaceInDir
  }
}

function replaceInDir(dir: string, from: string, to: string) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (["node_modules", ".git", "dist", ".next", ".turbo"].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      replaceInDir(full, from, to);
    } else if (/\.(ts|tsx|json|md|yaml|yml|prisma|env\.example)$/.test(entry)) {
      try {
        const content = readFileSync(full, "utf8");
        if (content.includes(from)) {
          writeFileSync(full, content.replaceAll(from, to));
        }
      } catch {
        // skip binary files
      }
    }
  }
}

function removeDir(dir: string) {
  if (!existsSync(dir)) return;
  execSync(`rm -rf "${dir}"`);
}

const OPENAI_COMPAT_CLIENT = `import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("OPENAI_API_KEY env var is required");
    _client = new OpenAI({ apiKey, baseURL: process.env["OPENAI_BASE_URL"] });
  }
  return _client;
}

export const DEFAULT_MODEL = process.env["OPENAI_MODEL"] ?? "gpt-4o";
`;

main().catch((err) => {
  console.error(kleur.red("Error:"), err);
  process.exit(1);
});
