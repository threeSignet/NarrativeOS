import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import * as schema from "./schema";

// 同步加载 .env 文件（ESM 中无法在静态 import 前执行 async 操作）
// 搜索路径：从 packages/database/ 向上找到项目根目录的 .env
function loadEnvSync(filepath: string) {
  if (!existsSync(filepath)) return;
  const content = readFileSync(filepath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key) {
      process.env[key] = value;  // .env 文件始终优先
    }
  }
}
const __dirname = fileURLToPath(new URL(".", import.meta.url));
// 从数据库包自身的目录向上搜索 .env
loadEnvSync(resolve(__dirname, "../.env"));         // packages/database/.env
loadEnvSync(resolve(__dirname, "../../.env"));       // 项目根目录 .env
loadEnvSync(resolve(__dirname, "../../../.env"));    // 上级目录（旧项目）

if (!process.env.DATABASE_URL) {
  console.error("[database] DATABASE_URL environment variable is required");
  process.exit(1);
}

// 在连接字符串中注入 timezone 参数，避免用 pool.on("connect") 导致并发查询冲突
const dbUrl = new URL(process.env.DATABASE_URL);
dbUrl.searchParams.set("options", "-c timezone=Asia/Shanghai");

const pool = new Pool({
  connectionString: dbUrl.toString(),
});
pool.on("error", (err) => {
  console.error("[database] Unexpected pool error:", err.message);
});

export const db = drizzle(pool, { schema });

// Async connection check
(async () => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("[database] Connected to PostgreSQL pool (TZ=Asia/Shanghai)");
  } catch (err: any) {
    console.error("[database] Connection failed:", err);
    process.exit(1);
  }
})();

export {
  projects, sessions, discussions, aiProposals, settingItems,
  settingItemRelations, llmLogs, mouStates, notifications,
  notificationReads, projectSettings, outlines, volumes, chapters,
  outlineItems, projectDailyStats, projectScales,
  chapterSettingReferences, settingItemVersions, embeddings,
  geoAnchors, settingItemChanges, worldSnapshots,
} from "./schema";

// 同时导入值以支持 typeof 类型推断
import { settingItems, settingItemRelations, aiProposals, projects, chapterSettingReferences, settingItemVersions, embeddings } from "./schema";
export * from "./validation";

// drizzle-orm 行类型推断（用于外部包的类型导入）
export type SettingItem = typeof settingItems.$inferSelect;
export type SettingItemRelation = typeof settingItemRelations.$inferSelect;
export type AiProposal = typeof aiProposals.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ChapterSettingReference = typeof chapterSettingReferences.$inferSelect;
export type SettingItemVersion = typeof settingItemVersions.$inferSelect;
export type Embedding = typeof embeddings.$inferSelect;

// ── 向量嵌入 ──
export {
  chunkText,
  VectorService,
} from "./vector-service";
export type {
  EmbeddingProvider,
} from "./vector-service";
export type {
  EmbeddingSourceType,
  EmbeddingRow,
  InsertEmbedding,
  VectorSearchParams,
  VectorSearchResult,
  TextChunk,
  ChunkParams,
} from "./embedding-types";
export {
  EmbeddingPipeline,
} from "./embedding-pipeline";
