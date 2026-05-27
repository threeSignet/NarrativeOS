import { Hono } from "hono";
import { stream } from "hono/streaming";
import { getEngine } from "@narrative-os/engines";
import { db, projects, sessions, aiProposals, outlines, volumes, chapters } from "@narrative-os/database";
import { eq, and, asc, sql } from "drizzle-orm";
import { wsBus } from "../ws-bus";
import { orchestrator } from "./hatch";

const app = new Hono();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ──────────────────────────────────────────────────────────────
// 大纲（Outline）CRUD + 生成
// ──────────────────────────────────────────────────────────────

/**
 * GET /:projectId/outline
 * 查询项目的全局大纲
 */
app.get("/:projectId/outline", async (c) => {
  const projectId = c.req.param("projectId");

  const list = await db
    .select()
    .from(outlines)
    .where(eq(outlines.projectId, projectId))
    .orderBy(asc(outlines.version));

  return c.json({ outlines: list });
});

/**
 * POST /:projectId/outline/generate/stream
 * SSE 流式生成全局大纲
 */
app.post("/:projectId/outline/generate/stream", async (c) => {
  const projectId = c.req.param("projectId");

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project not found" }, 404);

  return stream(c, async (s) => {
    const node = getEngine("outline-generator");

    const [session] = await db
      .insert(sessions)
      .values({
        projectId,
        type: "outline-generator",
        title: `大纲生成：${project.title}`,
      })
      .returning({ id: sessions.id });

    s.write(`event: session\ndata: ${JSON.stringify({ sessionId: session.id })}\n\n`);

    let result: any;
    try {
      for await (const event of node.streamRun({
        projectId,
        sessionId: session.id,
        caller: `genre=${project.genre}, title=${project.title}`,
      })) {
        if (event.type === "chunk") {
          s.write(`event: chunk\ndata: ${JSON.stringify({ text: event.text })}\n\n`);
        } else if (event.type === "model") {
          s.write(`event: model\ndata: ${JSON.stringify(event.info)}\n\n`);
          wsBus.push(projectId, { type: "engine_model", payload: { engine: "outline-generator", ...event.info } });
        } else if (event.type === "usage") {
          s.write(`event: usage\ndata: ${JSON.stringify(event.usage)}\n\n`);
          wsBus.push(projectId, { type: "engine_usage", payload: { engine: "outline-generator", ...event.usage } });
        } else if (event.type === "error") {
          s.write(`event: error\ndata: ${JSON.stringify({ message: event.message, fallbackTier: event.fallbackTier })}\n\n`);
        } else if (event.type === "done") {
          result = event.result;
        }
      }

      if (!result) {
        s.write(`event: error\ndata: ${JSON.stringify({ message: "Engine returned no result" })}\n\n`);
        return;
      }

      const proposalIds = await orchestrator.stageProposals(projectId, session.id, result, "outline-generator");
      s.write(`event: staged\ndata: ${JSON.stringify({ proposalCount: proposalIds.length })}\n\n`);

      const proposals = await db
        .select()
        .from(aiProposals)
        .where(eq(aiProposals.projectId, projectId))
        .orderBy(aiProposals.createdAt);

      s.write(`event: done\ndata: ${JSON.stringify({
        success: true,
        sessionId: session.id,
        proposalCount: proposalIds.length,
        proposals: proposals.map((p) => ({
          id: p.id,
          type: p.type,
          title: p.title,
          status: p.status,
          reasoning: (p.content as any)?.reasoning,
        })),
      })}\n\n`);
    } catch (err: any) {
      s.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// 卷纲（Volume Outline）CRUD + 生成
// ──────────────────────────────────────────────────────────────

/**
 * GET /:projectId/volumes
 * 查询项目所有卷
 */
app.get("/:projectId/volumes", async (c) => {
  const projectId = c.req.param("projectId");

  const list = await db
    .select()
    .from(volumes)
    .where(eq(volumes.projectId, projectId))
    .orderBy(asc(volumes.volumeNumber));

  return c.json({ volumes: list });
});

/**
 * POST /:projectId/volumes/generate/stream
 * SSE 流式生成卷纲
 */
app.post("/:projectId/volumes/generate/stream", async (c) => {
  const projectId = c.req.param("projectId");

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project not found" }, 404);

  return stream(c, async (s) => {
    const node = getEngine("volume-outline");

    const [session] = await db
      .insert(sessions)
      .values({
        projectId,
        type: "volume-outline",
        title: `卷纲生成：${project.title}`,
      })
      .returning({ id: sessions.id });

    s.write(`event: session\ndata: ${JSON.stringify({ sessionId: session.id })}\n\n`);

    let result: any;
    try {
      for await (const event of node.streamRun({
        projectId,
        sessionId: session.id,
        caller: `genre=${project.genre}, title=${project.title}`,
      })) {
        if (event.type === "chunk") {
          s.write(`event: chunk\ndata: ${JSON.stringify({ text: event.text })}\n\n`);
        } else if (event.type === "model") {
          s.write(`event: model\ndata: ${JSON.stringify(event.info)}\n\n`);
          wsBus.push(projectId, { type: "engine_model", payload: { engine: "volume-outline", ...event.info } });
        } else if (event.type === "usage") {
          s.write(`event: usage\ndata: ${JSON.stringify(event.usage)}\n\n`);
          wsBus.push(projectId, { type: "engine_usage", payload: { engine: "volume-outline", ...event.usage } });
        } else if (event.type === "error") {
          s.write(`event: error\ndata: ${JSON.stringify({ message: event.message, fallbackTier: event.fallbackTier })}\n\n`);
        } else if (event.type === "done") {
          result = event.result;
        }
      }

      if (!result) {
        s.write(`event: error\ndata: ${JSON.stringify({ message: "Node returned no result" })}\n\n`);
        return;
      }

      const proposalIds = await orchestrator.stageProposals(projectId, session.id, result, "volume-outline");
      s.write(`event: staged\ndata: ${JSON.stringify({ proposalCount: proposalIds.length })}\n\n`);

      s.write(`event: done\ndata: ${JSON.stringify({
        success: true,
        sessionId: session.id,
        proposalCount: proposalIds.length,
        proposals: proposalIds.map((id) => ({ id, status: "pending" })),
      })}\n\n`);
    } catch (err: any) {
      s.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    }
  });
});

/**
 * POST /:projectId/volumes
 * 手动创建卷
 */
app.post("/:projectId/volumes", async (c) => {
  const projectId = c.req.param("projectId");
  let body: any = {};
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid body" }, 400); }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Get next volume number
  const existing = await db
    .select({ volumeNumber: volumes.volumeNumber })
    .from(volumes)
    .where(eq(volumes.projectId, projectId))
    .orderBy(asc(volumes.volumeNumber));

  const nextNumber = body.volumeNumber || (existing.length > 0 ? Math.max(...existing.map((v) => v.volumeNumber)) + 1 : 1);

  const [inserted] = await db
    .insert(volumes)
    .values({
      projectId,
      volumeNumber: nextNumber,
      title: body.title || `第${nextNumber}卷`,
      summary: body.summary || "",
      outline: body.outline || null,
      status: "draft",
      wordCountTarget: body.wordCountTarget || null,
    })
    .returning();

  // 更新项目统计
  await db
    .update(projects)
    .set({
      totalVolumes: sql`${projects.totalVolumes} + 1`,
      latestVolumeId: inserted.id,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  return c.json({ success: true, volume: inserted });
});

// ──────────────────────────────────────────────────────────────
// 章纲（Chapter Outline）CRUD + 生成
// ──────────────────────────────────────────────────────────────

/**
 * GET /:projectId/volumes/:volumeId/chapters
 * 查询某卷下所有章节
 */
app.get("/:projectId/volumes/:volumeId/chapters", async (c) => {
  const projectId = c.req.param("projectId");
  const volumeId = c.req.param("volumeId");

  const list = await db
    .select()
    .from(chapters)
    .where(
      and(
        eq(chapters.projectId, projectId),
        eq(chapters.volumeId, volumeId)
      )
    )
    .orderBy(asc(chapters.chapterNumber));

  return c.json({ chapters: list });
});

/**
 * POST /:projectId/volumes/:volumeId/chapters/generate/stream
 * SSE 流式生成章纲（批量为该卷的所有章节）
 */
app.post("/:projectId/volumes/:volumeId/chapters/generate/stream", async (c) => {
  const projectId = c.req.param("projectId");
  const volumeId = c.req.param("volumeId");

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project not found" }, 404);

  const [volume] = await db.select().from(volumes).where(and(eq(volumes.id, volumeId), eq(volumes.projectId, projectId)));
  if (!volume) return c.json({ error: "Volume not found" }, 404);

  return stream(c, async (s) => {
    const node = getEngine("chapter-outline");

    const [session] = await db
      .insert(sessions)
      .values({
        projectId,
        type: "chapter-outline",
        title: `章纲生成：${volume.title}`,
      })
      .returning({ id: sessions.id });

    s.write(`event: session\ndata: ${JSON.stringify({ sessionId: session.id })}\n\n`);

    let result: any;
    try {
      for await (const event of node.streamRun({
        projectId,
        sessionId: session.id,
        caller: `genre=${project.genre}, title=${project.title}, volume=${volume.volumeNumber}`,
      })) {
        if (event.type === "chunk") {
          s.write(`event: chunk\ndata: ${JSON.stringify({ text: event.text })}\n\n`);
        } else if (event.type === "model") {
          s.write(`event: model\ndata: ${JSON.stringify(event.info)}\n\n`);
          wsBus.push(projectId, { type: "engine_model", payload: { engine: "chapter-outline", ...event.info } });
        } else if (event.type === "usage") {
          s.write(`event: usage\ndata: ${JSON.stringify(event.usage)}\n\n`);
          wsBus.push(projectId, { type: "engine_usage", payload: { engine: "chapter-outline", ...event.usage } });
        } else if (event.type === "error") {
          s.write(`event: error\ndata: ${JSON.stringify({ message: event.message, fallbackTier: event.fallbackTier })}\n\n`);
        } else if (event.type === "done") {
          result = event.result;
        }
      }

      if (!result) {
        s.write(`event: error\ndata: ${JSON.stringify({ message: "Node returned no result" })}\n\n`);
        return;
      }

      const proposalIds = await orchestrator.stageProposals(projectId, session.id, result, "chapter-outline");
      s.write(`event: staged\ndata: ${JSON.stringify({ proposalCount: proposalIds.length })}\n\n`);

      s.write(`event: done\ndata: ${JSON.stringify({
        success: true,
        sessionId: session.id,
        proposalCount: proposalIds.length,
        proposals: proposalIds.map((id) => ({ id, status: "pending" })),
      })}\n\n`);
    } catch (err: any) {
      s.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    }
  });
});

/**
 * POST /:projectId/volumes/:volumeId/chapters
 * 手动创建章节
 */
app.post("/:projectId/volumes/:volumeId/chapters", async (c) => {
  const projectId = c.req.param("projectId");
  const volumeId = c.req.param("volumeId");
  let body: any = {};
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid body" }, 400); }

  const [volume] = await db.select().from(volumes).where(and(eq(volumes.id, volumeId), eq(volumes.projectId, projectId)));
  if (!volume) return c.json({ error: "Volume not found" }, 404);

  // Get next chapter number
  const existing = await db
    .select({ chapterNumber: chapters.chapterNumber })
    .from(chapters)
    .where(eq(chapters.volumeId, volumeId))
    .orderBy(asc(chapters.chapterNumber));

  const nextNumber = body.chapterNumber || (existing.length > 0 ? Math.max(...existing.map((ch) => ch.chapterNumber)) + 1 : 1);

  const [inserted] = await db
    .insert(chapters)
    .values({
      projectId,
      volumeId,
      chapterNumber: nextNumber,
      title: body.title || `第${nextNumber}章`,
      summary: body.summary || "",
      outline: body.outline || null,
      status: "draft",
      wordCountTarget: body.wordCountTarget || null,
    })
    .returning();

  // 更新项目统计
  await db
    .update(projects)
    .set({
      totalChapters: sql`${projects.totalChapters} + 1`,
      latestChapterId: inserted.id,
      latestChapterNumber: inserted.chapterNumber,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  // 更新卷的章节数
  await db
    .update(volumes)
    .set({
      totalChapters: sql`${volumes.totalChapters} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(volumes.id, volumeId));

  return c.json({ success: true, chapter: inserted });
});

// ──────────────────────────────────────────────────────────────
// 章节正文内容读写
// ──────────────────────────────────────────────────────────────

/**
 * GET /chapters/:chapterId/content
 * 获取章节正文内容
 */
app.get("/chapters/:chapterId/content", async (c) => {
  const chapterId = c.req.param("chapterId");
  if (!UUID_RE.test(chapterId)) return c.json({ error: "Invalid chapter ID" }, 400);

  const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId));
  if (!chapter) return c.json({ error: "Chapter not found" }, 404);

  return c.json({
    id: chapter.id,
    title: chapter.title,
    content: chapter.contentPath || null,
    status: chapter.status,
    actualWords: chapter.actualWords,
  });
});

/**
 * POST /chapters/:chapterId/content
 * 保存章节正文内容
 */
app.post("/chapters/:chapterId/content", async (c) => {
  const chapterId = c.req.param("chapterId");
  if (!UUID_RE.test(chapterId)) return c.json({ error: "Invalid chapter ID" }, 400);

  let body: any = {};
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid body" }, 400); }

  const content = body.content || "";
  const charCount = content.replace(/<[^>]*>/g, "").length;

  await db
    .update(chapters)
    .set({
      contentPath: content,
      actualWords: charCount,
      status: "draft",
      updatedAt: new Date(),
    })
    .where(eq(chapters.id, chapterId));

  return c.json({ success: true, charCount });
});

export default app;
