import { Hono } from "hono";
import { db } from "@narrative-os/database";
import { EmbeddingPipeline } from "@narrative-os/database";
import { eq, and, desc } from "drizzle-orm";

const app = new Hono();

/**
 * POST /vector/search
 * 语义向量搜索
 * Body: { projectId, query, sourceType?, limit?, threshold? }
 */
app.post("/search", async (c) => {
  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore */ }

  const { projectId, query, sourceType, limit = 10, threshold = 0.6 } = body;

  if (!projectId || !query) {
    return c.json({ error: "projectId and query are required" }, 400);
  }

  const pipeline = EmbeddingPipeline.getInstance();
  if (!pipeline) {
    return c.json({ error: "Embedding pipeline not initialized" }, 503);
  }

  try {
    const results = await pipeline.searchForCompanion(projectId, query, limit);
    // 按 sourceType 过滤
    const filtered = sourceType
      ? results.filter((r) => r.sourceType === sourceType)
      : results;
    const final = filtered.filter((r) => r.similarity >= threshold);

    return c.json({
      projectId,
      query,
      total: final.length,
      results: final.map((r) => ({
        embeddingId: r.embeddingId,
        chunkText: r.chunkText,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        similarity: r.similarity,
        meta: r.metaJsonb,
      })),
    });
  } catch (err: any) {
    console.error("[vector/search] error:", err.message);
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /vector/embed
 * 手动触发嵌入（用于管理后台或调试）
 * Body: { projectId, sourceType, sourceId, text? }
 */
app.post("/embed", async (c) => {
  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore */ }

  const { projectId, sourceType, sourceId, text } = body;

  if (!projectId || !sourceType || !sourceId) {
    return c.json({ error: "projectId, sourceType, sourceId are required" }, 400);
  }

  const pipeline = EmbeddingPipeline.getInstance();
  if (!pipeline) {
    return c.json({ error: "Embedding pipeline not initialized" }, 503);
  }

  try {
    let ids: string[] = [];
    switch (sourceType) {
      case "setting_item":
        ids = await pipeline.embedSettingItem(projectId, sourceId);
        break;
      case "chapter_chunk":
        ids = await pipeline.embedChapter(projectId, sourceId, text);
        break;
      case "memory_event":
        ids = await pipeline.embedMemoryEvent(projectId, sourceId, text || "");
        break;
      default:
        return c.json({ error: `Unsupported sourceType: ${sourceType}` }, 400);
    }

    return c.json({ success: true, embeddedChunks: ids.length, embeddingIds: ids });
  } catch (err: any) {
    console.error("[vector/embed] error:", err.message);
    return c.json({ error: err.message }, 500);
  }
});

/**
 * GET /vector/stats/:projectId
 * 获取项目的向量统计
 */
app.get("/stats/:projectId", async (c) => {
  const projectId = c.req.param("projectId");

  const pipeline = EmbeddingPipeline.getInstance();
  if (!pipeline) {
    return c.json({ error: "Embedding pipeline not initialized" }, 503);
  }

  try {
    // 通过 VectorService 获取统计
    const vs = (pipeline as any).vectorService;
    const stats = await vs.getStats(projectId);
    return c.json({ projectId, ...stats });
  } catch (err: any) {
    console.error("[vector/stats] error:", err.message);
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /vector/dedup-check
 * 语义去重检查
 * Body: { projectId, text, sourceType?, threshold? }
 */
app.post("/dedup-check", async (c) => {
  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore */ }

  const { projectId, text, sourceType, threshold = 0.92 } = body;

  if (!projectId || !text) {
    return c.json({ error: "projectId and text are required" }, 400);
  }

  const pipeline = EmbeddingPipeline.getInstance();
  if (!pipeline) {
    return c.json({ error: "Embedding pipeline not initialized" }, 503);
  }

  try {
    const result = await pipeline.checkDuplicate(projectId, text, sourceType, threshold);
    return c.json({
      projectId,
      isDuplicate: result.isDuplicate,
      similarCount: result.similar.length,
      similar: result.similar.map((s) => ({
        embeddingId: s.embeddingId,
        chunkText: s.chunkText.substring(0, 200),
        sourceType: s.sourceType,
        similarity: s.similarity,
      })),
    });
  } catch (err: any) {
    console.error("[vector/dedup-check] error:", err.message);
    return c.json({ error: err.message }, 500);
  }
});

export default app;
