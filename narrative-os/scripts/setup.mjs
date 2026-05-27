#!/usr/bin/env node
/**
 * NarrativeOS+ — 完整本地初始化脚本（Node.js 跨平台版）
 *
 * 用法:
 *   node scripts/setup.mjs              # 首次初始化
 *   node scripts/setup.mjs --reset      # 重置全部数据
 *   node scripts/setup.mjs --help       # 帮助信息
 *
 * 分步:
 *   node scripts/setup.mjs --containers-only   # 只启动 Docker
 *   node scripts/setup.mjs --db-only            # 只跑数据库迁移
 */
import { execSync, spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const RESET = process.argv.includes("--reset");
const FORCE = process.argv.includes("--force") || process.env.CI === "true";
const CONTAINERS_ONLY = process.argv.includes("--containers-only");
const DB_ONLY = process.argv.includes("--db-only");
const HELP = process.argv.includes("--help");
const VERBOSE = process.argv.includes("--verbose");

// ── 从 .env 加载环境变量 ──
function loadEnv() {
  const envPath = resolve(ROOT, ".env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    // 不覆盖已有的环境变量
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
loadEnv();

const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

// ── 工具函数 ──
const log = {
  step: (msg) => console.log(`\n  🚀 ${msg}`),
  ok:   (msg) => console.log(`  ✅ ${msg}`),
  warn: (msg) => console.log(`  ⚠️  ${msg}`),
  err:  (msg) => { console.log(`  ❌ ${msg}`); process.exit(1); },
};

function run(cmd, opts = {}) {
  const { stdio = VERBOSE ? "inherit" : "pipe", ...rest } = opts;
  try {
    const result = execSync(cmd, { cwd: ROOT, stdio, encoding: "utf-8", ...rest });
    return result?.trim() || "";
  } catch (e) {
    if (opts.ignoreError) return "";
    throw e;
  }
}

async function ask(question) {
  if (FORCE) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question + " (y/N) ", (ans) => {
      rl.close();
      resolve(ans.toLowerCase() === "y");
    });
  });
}

function waitFor(seconds) {
  return new Promise((r) => setTimeout(r, seconds * 1000));
}

async function waitForContainer(container, checkCmd, maxRetries, interval) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      execSync(`docker exec ${container} ${checkCmd}`, { stdio: "pipe", encoding: "utf-8" });
      return true;
    } catch {
      process.stdout.write(".");
      await waitFor(interval);
    }
  }
  return false;
}

// ── 帮助 ──
if (HELP) {
  console.log(`
NarrativeOS+ 初始化脚本
=======================
用法:
  node scripts/setup.mjs                       首次初始化
  node scripts/setup.mjs --reset               重置数据卷 + 重建
  node scripts/setup.mjs --reset --force       自动确认重置
  node scripts/setup.mjs --containers-only     只启动 Docker 容器
  node scripts/setup.mjs --db-only             只跑数据库迁移
  node scripts/setup.mjs --help                显示帮助
  node scripts/setup.mjs --verbose             详细输出
`);
  process.exit(0);
}

// ──────────────────────────────────────────────
//  Main
// ──────────────────────────────────────────────
async function main() {
  console.log(`
╔══════════════════════════════════════════════════════╗
║   NarrativeOS+  本地环境初始化                          ║
╚══════════════════════════════════════════════════════╝
`);

  // ── Step 0: 环境检查 ──
  log.step("Step 0/5：环境检查");

  try {
    run("docker --version"); log.ok("Docker 已安装");
  } catch { log.err("Docker 未安装！请先安装 Docker Desktop"); }

  try {
    run("node --version"); log.ok("Node.js 已安装");
  } catch { log.err("Node.js 未安装！"); }

  try {
    run("pnpm --version"); log.ok("pnpm 已安装");
  } catch {
    log.warn("pnpm 未安装，尝试安装…");
    run("npm install -g pnpm");
    log.ok("pnpm 已安装");
  }

  if (!existsSync(resolve(ROOT, ".env"))) {
    log.err(".env 文件不存在！请从 .env.example 复制: cp .env.example .env");
  }
  log.ok(".env 已就绪");

  // ── Step 1: Docker ──
  if (DB_ONLY) {
    log.step("Step 1/5：跳过容器启动（--db-only 模式）");
  } else {
    log.step("Step 1/5：Docker 基础设施");

    if (RESET) {
      if (FORCE || await ask("  确认重置？将删除所有数据卷！")) {
        log.step("  → 停止并清空数据卷…");
        run("docker compose down -v");
        log.ok("数据卷已清空");
      } else {
        log.warn("跳过重置");
      }
    }

    run("docker compose up -d");
    log.ok("容器已启动");

    // 等待 PostgreSQL
    process.stdout.write("  → 等待 PostgreSQL ");
    const pgReady = await waitForContainer(
      "narrativeos-postgres",
      "pg_isready -U narrativeos -d narrativeos",
      30, 2
    );
    console.log(pgReady ? "" : " 超时");
    if (pgReady) log.ok("PostgreSQL 已就绪");
    else log.warn("PostgreSQL 未完全就绪（继续尝试）");

    // 等待 Redis（密码从环境变量读取）
    process.stdout.write("  → 等待 Redis ");
    const redisCheckCmd = REDIS_PASSWORD
      ? `redis-cli -a ${REDIS_PASSWORD} --no-auth-warning PING`
      : "redis-cli PING";
    const redisReady = await waitForContainer(
      "narrativeos-redis",
      redisCheckCmd,
      15, 2
    );
    console.log(redisReady ? "" : " 超时");
    if (redisReady) log.ok("Redis 已就绪");
    else log.warn("Redis 未完全就绪");

    // 等待 MinIO
    process.stdout.write("  → 等待 MinIO ");
    const minioReady = await waitForContainer(
      "narrativeos-minio",
      "curl -sf http://localhost:9000/minio/health/live",
      15, 2
    );
    console.log(minioReady ? "" : " 超时");
    if (minioReady) log.ok("MinIO 已就绪");
    else log.warn("MinIO 健康检查未通过");

    run("docker compose ps");
    log.ok("Docker 基础设施就绪");

    if (CONTAINERS_ONLY) {
      console.log("\n✅ 容器启动完成。运行 node scripts/setup.mjs --db-only 继续数据库初始化。");
      process.exit(0);
    }
  }

  // ── Step 2: 安装依赖 ──
  log.step("Step 2/5：安装依赖");
  run("pnpm install");
  log.ok("依赖安装完成");

  // ── Step 3: 数据库迁移 ──
  log.step("Step 3/5：数据库迁移");

  // 3a. 数据库扩展
  run('docker exec narrativeos-postgres psql -U narrativeos -d narrativeos -c "CREATE EXTENSION IF NOT EXISTS vector;"', { ignoreError: true });
  run('docker exec narrativeos-postgres psql -U narrativeos -d narrativeos -c "CREATE EXTENSION IF NOT EXISTS \\"uuid-ossp\\";"', { ignoreError: true });
  run('docker exec narrativeos-postgres psql -U narrativeos -d narrativeos -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"', { ignoreError: true });
  log.ok("数据库扩展已就绪 (vector + uuid-ossp + pg_trgm)");

  // 3b. Drizzle Kit Push
  log.step("  → Drizzle Kit 同步 schema…");
  run("pnpm db:push");
  log.ok("Schema 同步完成");

  // 3c. 自定义迁移
  log.step("  → 自定义迁移（约束、索引、额外表）…");
  try {
    run("pnpm db:migrate");
    log.ok("自定义迁移完成");
  } catch {
    log.warn("部分表可能已存在，继续执行…");
  }

  // 3d. 向量嵌入
  log.step("  → 向量嵌入基础设施…");
  try {
    run("pnpm db:init-db");
    log.ok("向量嵌入基础设施就绪");
  } catch {
    log.warn("embeddings 表可能已存在");
  }

  // ── Step 4: 验证 ──
  log.step("Step 4/5：验证数据库");

  try {
    const tables = run(
      'docker exec narrativeos-postgres psql -U narrativeos -d narrativeos -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema=\'public\' AND table_type=\'BASE TABLE\' ORDER BY table_name;"'
    );
    tables.split("\n").filter(t => t.trim()).forEach(t => log.ok(`表: ${t.trim()}`));
  } catch { /* skip */ }

  try {
    const extCount = run(
      'docker exec narrativeos-postgres psql -U narrativeos -d narrativeos -t -c "SELECT count(*) FROM pg_extension WHERE extname IN (\'vector\', \'pg_trgm\', \'uuid-ossp\');"'
    );
    log.ok(`扩展数: ${extCount.trim()}/3`);
  } catch { /* skip */ }

  // ── Step 5: 完成 ──
  log.step("Step 5/5：完成");

  console.log(`
╔══════════════════════════════════════════════════════╗
║   ✅ NarrativeOS+ 初始化完成！                          ║
╠══════════════════════════════════════════════════════╣
║  PostgreSQL :5432  (narrativeos)                     ║
║  Redis      :6379  (narrativeos-redis)               ║
║  MinIO      :9000  (console :9001)                    ║
╠══════════════════════════════════════════════════════╣
║  启动开发服务:                                          ║
║    pnpm dev                                            ║
║                                                        ║
║  快速重置 DB 数据（保留表结构）:                          ║
║    pnpm db:reset                                        ║
║                                                        ║
║  完全重置（清空 Docker 卷 + 重建）:                      ║
║    node scripts/setup.mjs --reset                       ║
╚══════════════════════════════════════════════════════════╝
`);
}

main().catch((e) => {
  console.error(`\n  ❌ 初始化失败: ${e.message}`);
  process.exit(1);
});
