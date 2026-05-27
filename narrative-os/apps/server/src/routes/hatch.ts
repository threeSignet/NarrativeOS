import { Hono } from "hono";
import { stream } from "hono/streaming";
import { getEngine, listEngines, getEngineDef, type EngineResult } from "@narrative-os/engines";
import { Orchestrator, EngineScheduler, bus } from "@narrative-os/pipeline";
import { db, projects, sessions, aiProposals, settingItems, projectSettings, mouStates, notifications, notificationReads, chapters, settingItemRelations, projectScales } from "@narrative-os/database";
import { eq, and, ne } from "drizzle-orm";
import { wsBus } from "../ws-bus";
import {
  validateUUID,
  queryEngineStates,
} from "../services/hatch-service";

const app = new Hono();

// API 安全白名单
const ALLOWED_PHASES = new Set(["geography", "power-system", "faction", "race", "culture", "history", "technique", "economy", "rules", "character", "conflict", "causality", "item-system", "outline-generator", "volume-outline", "chapter-outline"]);
const ALLOWED_CREATE_ENGINES = new Set([...ALLOWED_PHASES, "tone", "story-blueprint"]);

// 共享的 Orchestrator 实例（导出给 outline 路由使用）
// onProposalsStaged 不再发送 WS 通知 — 改由 SSE done 事件统一驱动前端状态变更
export const orchestrator = new Orchestrator();

// Scheduler reference — set by injectScheduler() from index.ts
let scheduler: EngineScheduler | null = null;

// 项目级并发锁：防止两个 /advance 请求同时为同一项目运行引擎
const advanceLocks = new Set<string>();

export function injectScheduler(s: EngineScheduler) {
  scheduler = s;
}

// ──────────────────────────────────────────────────────────────
// 项目设定集孵化流程（Hatching Pipeline）
// ──────────────────────────────────────────────────────────────

interface SSEStream {
  write(data: string): void;
}

/**
 * 共享的引擎 SSE 流执行器 — 消除两个 SSE 端点的重复代码
 */
async function executeEngineSSEStream(
  s: SSEStream,
  projectId: string,
  engineName: string,
  project: { genre: string; title: string },
  opts?: { refinement?: import("@narrative-os/engines").RefinementContext },
) {
  const safeWrite = (data: string): boolean => {
    try { s.write(data); return true; }
    catch (err: any) {
      if (!err.message?.includes('aborted') && !err.message?.includes('closed')) {
        console.error(`[sse] ${engineName} write error:`, err.message);
      }
      return false;
    }
  };

  const node = getEngine(engineName);
  const { refinement } = opts || {};

  // 立即通知前端当前运行的引擎名（解决 P0-1: advanceHatching 不设 currentEngine）
  safeWrite(`event: engine_name\ndata: ${JSON.stringify({ engine: engineName })}\n\n`);
  wsBus.push(projectId, { type: "engine_started", payload: { node: engineName } });

  const [session] = await db
    .insert(sessions)
    .values({
      projectId,
      type: refinement ? `${engineName}:refine` : engineName,
      title: refinement
        ? `Refine: ${engineName} → ${refinement.parentName} (${refinement.targetScale})`
        : `${engineName}: ${project.title}`,
    })
    .returning({ id: sessions.id });

  if (!safeWrite(`event: session\ndata: ${JSON.stringify({ sessionId: session.id })}\n\n`)) return;

  if (refinement) {
    wsBus.push(projectId, {
      type: "engine_started",
      payload: { node: `${engineName}:refine`, refinement },
    });
  }

  let result: any;
  try {
    for await (const event of node.streamRun({
      projectId,
      sessionId: session.id,
      caller: `genre=${project.genre}, title=${project.title}`,
      refinement,
    })) {
      if (event.type === "chunk") {
        if (!safeWrite(`event: chunk\ndata: ${JSON.stringify({ text: event.text })}\n\n`)) return;
        // chunk 仅通过 SSE 投递，不推送 WS（避免双写导致前端内容翻倍 + 日志刷屏）
      } else if (event.type === "model") {
        safeWrite(`event: model\ndata: ${JSON.stringify(event.info)}\n\n`);
        wsBus.push(projectId, { type: "engine_model", payload: { engine: engineName, ...event.info } });
      } else if (event.type === "usage") {
        safeWrite(`event: usage\ndata: ${JSON.stringify(event.usage)}\n\n`);
        wsBus.push(projectId, { type: "engine_usage", payload: { engine: engineName, ...event.usage } });
      } else if (event.type === "error") {
        safeWrite(`event: error\ndata: ${JSON.stringify({ message: event.message, fallbackTier: event.fallbackTier })}\n\n`);
        wsBus.push(projectId, { type: "engine_error", payload: { engine: engineName, message: event.message } });
      } else if (event.type === "tool_call") {
        // 工具调用事件 — 转发给前端显示 LLM 正在查询数据
        // 解决"流式未结束就弹出 MOU"的误判：让前端能区分"LLM 在思考调工具"和"LLM 在生成最终内容"
        safeWrite(`event: tool_call\ndata: ${JSON.stringify({ toolCallId: event.toolCallId, toolName: event.toolName, args: event.args })}\n\n`);
        wsBus.push(projectId, { type: "engine_tool_call", payload: { engine: engineName, toolCallId: event.toolCallId, toolName: event.toolName } });
      } else if (event.type === "tool_result") {
        // 工具结果事件 — LLM 已获取到查询数据，前端可更新状态
        safeWrite(`event: tool_result\ndata: ${JSON.stringify({ toolCallId: event.toolCallId, summary: event.summary })}\n\n`);
        wsBus.push(projectId, { type: "engine_tool_result", payload: { engine: engineName, toolCallId: event.toolCallId } });
      } else if ((event as any).type === "generation") {
        // 生成开始事件 — LLM 工具查询完毕，开始实际撰写提案内容
        safeWrite(`event: generation\ndata: ${JSON.stringify({ start: true })}\n\n`);
        wsBus.push(projectId, { type: "engine_generation_start", payload: { engine: engineName } });
      } else if (event.type === "done") {
        result = event.result;
      }
    }

    if (!result) {
      const msg = "Node returned no result";
      safeWrite(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`);
      wsBus.push(projectId, { type: "engine_error", payload: { engine: engineName, message: msg } });
      return;
    }

    const proposalIds = await orchestrator.stageProposals(projectId, session.id, result, engineName);
    safeWrite(`event: staged\ndata: ${JSON.stringify({ proposalCount: proposalIds.length })}\n\n`);

    const proposals = await db
      .select()
      .from(aiProposals)
      .where(eq(aiProposals.projectId, projectId))
      .orderBy(aiProposals.createdAt);

    const donePayload = {
      success: true,
      sessionId: session.id,
      engine: engineName,
      proposalCount: proposalIds.length,
      proposals: proposals.map((p) => ({
        id: p.id,
        type: p.type,
        title: p.title,
        status: p.status,
        reasoning: (p.content as any)?.reasoning,
      })),
    };
    safeWrite(`event: done\ndata: ${JSON.stringify(donePayload)}\n\n`);
    // SSE done 已发送 → 现在通过 WS 通知其他 tab/窗口（本 SSE 连接的前端由 done 事件驱动）
    wsBus.push(projectId, { type: "engine_done", payload: donePayload as Record<string, unknown> });
    if (proposalIds.length > 0) {
      wsBus.push(projectId, { type: "new_proposals", payload: { proposalIds, count: proposalIds.length } });
    }
  } catch (err: any) {
    console.error(`[sse] ${engineName} stream error:`, err.message);
    safeWrite(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    wsBus.push(projectId, { type: "engine_error", payload: { engine: engineName, message: err.message } });
  }
}

/**
 * POST /hatch/:id/stream
 * 已弃用 — 由 /hatch/:id/advance 统一管理。
 * 保留用于向后兼容，直接转发到 advance。
 */
app.post("/hatch/:id/stream", async (c) => {
  const projectId = c.req.param("id");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);
  return c.redirect(`/hatch/${projectId}/advance`, 307);
});

/**
 * POST /hatch/:id/advance
 * 孵化阶段推进的唯一入口。所有响应均为 SSE 格式（包括等待/完成状态），
 * 前端无需区分 JSON/SSE，统一通过 _executeEngineSSE 处理。
 *
 * 行为：
 * - 待审批 → SSE event: phase (waiting_approval)
 * - 待细化 → SSE 流式运行细化引擎
 * - 待运行引擎 → SSE 流式运行引擎
 * - 已完成 → SSE event: phase (complete)
 *
 * 前端流程：调用 /advance → 接收 SSE → 展示 MOU → 用户审批 → 再次调用
 * 后端职责：所有阶段判定、引擎执行、提案入库
 */
app.post("/hatch/:id/advance", async (c) => {
  const projectId = c.req.param("id");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);
  if (!scheduler) return c.json({ error: "Scheduler not initialized" }, 500);

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project not found" }, 404);

  // 获取当前阶段
  const phaseInfo = await scheduler.getNextPhase(projectId);

  // ── 所有响应统一为 SSE 格式 ──
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  c.header("X-Accel-Buffering", "no");

  // 非引擎运行的阶段（waiting_approval / complete）不需要并发锁
  const needsLock = phaseInfo.phase === "engine_ready" || phaseInfo.phase === "waiting_revision";
  if (needsLock && advanceLocks.has(projectId)) {
    // 已有引擎在运行 → 返回 waiting 状态，前端会重试
    return stream(c, async (s) => {
      s.write(`event: phase\ndata: ${JSON.stringify({ phase: "waiting_approval", pendingCount: 0 })}\n\n`);
      s.write(`event: done\ndata: ${JSON.stringify({ success: true })}\n\n`);
    });
  }
  if (needsLock) advanceLocks.add(projectId);

  return stream(c, async (s) => {
    const safeWrite = (data: string): boolean => {
      try { s.write(data); return true; }
      catch { return false; }
    };

    // 确保流结束时释放并发锁
    const releaseLock = () => advanceLocks.delete(projectId);

    // ── 有待审批提案 → SSE event: phase ──
    if (phaseInfo.phase === "waiting_approval") {
      safeWrite(`event: phase\ndata: ${JSON.stringify({
        phase: "waiting_approval",
        pendingCount: phaseInfo.pendingCount,
      })}\n\n`);
      safeWrite(`event: done\ndata: ${JSON.stringify({ success: true })}\n\n`);
      releaseLock();
      return;
    }

    // ── 修订请求 → 清除旧记录（含 mou_states），运行引擎 ──
    if (phaseInfo.phase === "waiting_revision" && phaseInfo.engine) {
      // 更新 ai_proposals 状态为 superseded
      const oldProposals = await db
        .update(aiProposals)
        .set({ status: "superseded" })
        .where(
          and(
            eq(aiProposals.projectId, projectId),
            eq(aiProposals.sourceNode, phaseInfo.engine),
            eq(aiProposals.status, "revision_requested"),
          ),
        ).returning({ id: aiProposals.id });
      // 同步更新对应的 mou_states，防止 maybeLockProject 被残留记录阻塞
      for (const old of oldProposals) {
        await db
          .update(mouStates)
          .set({ status: "superseded", decidedAt: new Date() })
          .where(eq(mouStates.proposalId, old.id));
      }
      await executeEngineSSEStream(s as any, projectId, phaseInfo.engine!, project);
      releaseLock();
      return;
    }

    // ── 待运行引擎 → SSE 流式 ──
    if (phaseInfo.phase === "engine_ready" && phaseInfo.engine) {
      // 工作室引擎（大纲/卷纲/章纲/写作）：有专门的 SSE 端点和前端路由
      // 发送 handoff 事件让前端用 outline store 接管
      const { ENGINE_REGISTRY } = await import("@narrative-os/engines");
      const engineDef = ENGINE_REGISTRY.find((e) => e.name === phaseInfo.engine);
      if (engineDef?.engineGroup === "studio") {
        safeWrite(`event: phase\ndata: ${JSON.stringify({
          phase: "studio_engine",
          engine: phaseInfo.engine,
        })}\n\n`);
        safeWrite(`event: done\ndata: ${JSON.stringify({ success: true })}\n\n`);
        releaseLock();
        return;
      }
      await executeEngineSSEStream(s as any, projectId, phaseInfo.engine!, project);
      releaseLock();
      return;
    }

    // ── 等待用户操作（有待细化条目，需手动触发）──
    if (phaseInfo.phase === "waiting_user_action" && phaseInfo.refinement) {
      safeWrite(`event: phase\ndata: ${JSON.stringify({
        phase: "waiting_user_action",
        refinableCount: phaseInfo.refinableCount,
        nextRefinable: {
          name: phaseInfo.refinement.parentName,
          scale: phaseInfo.refinement.parentScale,
          targetScale: phaseInfo.refinement.targetScale,
        },
        message: `有 ${phaseInfo.refinableCount} 个条目待细化，请在地图视图中点击「细化此区域」手动触发`,
      })}\n\n`);
      safeWrite(`event: done\ndata: ${JSON.stringify({ success: true })}\n\n`);
      releaseLock();
      return;
    }

    // ── 等待阶段确认（geography 有产出但未确认完成）──
    if (phaseInfo.phase === "waiting_phase_confirmation") {
      safeWrite(`event: phase\ndata: ${JSON.stringify({
        phase: "waiting_phase_confirmation",
        currentPhase: "geography",
        message: "地理环境阶段已有产出，请确认阶段完成后推进到后续引擎",
      })}\n\n`);
      safeWrite(`event: done\ndata: ${JSON.stringify({ success: true })}\n\n`);
      releaseLock();
      return;
    }

    // ── 已完成 ──
    safeWrite(`event: phase\ndata: ${JSON.stringify({ phase: "complete" })}\n\n`);
    safeWrite(`event: done\ndata: ${JSON.stringify({ success: true })}\n\n`);
    releaseLock();
  });
});

/**
 * GET /hatch/:id/proposals
 * 查看当前项目的所有提案（含 pending/approved/rejected）
 */
app.get("/hatch/:id/proposals", async (c) => {
  const projectId = c.req.param("id");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);
  const list = await db
    .select()
    .from(aiProposals)
    .where(eq(aiProposals.projectId, projectId))
    .orderBy(aiProposals.createdAt);

  return c.json(list);
});

/**
 * GET /hatch/:id/engines
 * 查询所有子引擎状态（哪些已有数据、哪些没有）
 */
app.get("/hatch/:id/engines", async (c) => {
  const projectId = c.req.param("id");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);
  const engineStates = await queryEngineStates(projectId);
  return c.json(engineStates);
});

// POST /hatch/:id/engine/:engine/stream 已移除（由 /hatch/:id/advance 统一管理）

// ──────────────────────────────────────────────────────────────
// 世界查询（World Query）— 结构化读取设定集
// ──────────────────────────────────────────────────────────────

/**
 * GET /world/query/:projectId
 * 查询项目的结构化世界上下文（按引擎分组，含关系网络）
 */
app.get("/world/query/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project not found" }, 404);

  const items = await db
    .select()
    .from(settingItems)
    .where(
      and(
        eq(settingItems.projectId, projectId),
        eq(settingItems.status, "confirmed")
      )
    );

  const itemIds = items.map((i) => i.id);
  const relations = itemIds.length > 0
    ? await db
        .select()
        .from(settingItemRelations)
        .where(eq(settingItemRelations.projectId, projectId))
    : [];

  // Build structured response
  const byEngine = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.engineSource || item.type;
    if (!byEngine.has(key)) byEngine.set(key, []);
    byEngine.get(key)!.push(item);
  }

  const nameMap = new Map(items.map((i) => [i.id, i.name]));

  const engines: Record<string, any> = {};
  for (const [engine, engineItems] of byEngine) {
    const parents = engineItems.filter((i) => !i.parentItemId);
    const children = engineItems.filter((i) => i.parentItemId);

    engines[engine] = {
      count: engineItems.length,
      items: parents.map((p) => ({
        id: p.id,
        name: p.name,
        summary: p.summary,
        subtype: p.itemSubtype,
        content: p.content,
        children: children
          .filter((c) => c.parentItemId === p.id)
          .map((c) => ({
            id: c.id,
            name: c.name,
            summary: c.summary,
            subtype: c.itemSubtype,
          })),
      })),
    };
  }

  return c.json({
    projectId,
    projectTitle: project.title,
    genre: project.genre,
    totalItems: items.length,
    totalRelations: relations.length,
    engines,
    relations: relations.map((r) => ({
      id: r.id,
      source: nameMap.get(r.sourceItemId) || "?",
      target: nameMap.get(r.targetItemId) || "?",
      type: r.relationType,
      label: r.label,
    })),
  });
});

// ──────────────────────────────────────────────────────────────
// 记忆查询（Memory Query）— 灵活检索设定条目
// ──────────────────────────────────────────────────────────────

/**
 * GET /memory/query/:projectId
 * 灵活查询设定条目（支持按类型、名称、标签过滤）
 */
app.get("/memory/query/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);

  const { type, name, status = "confirmed", engine_source, limit = "50" } = c.req.query();

  let query = db
    .select()
    .from(settingItems)
    .where(eq(settingItems.projectId, projectId));

  // Apply filters in memory (Drizzle ORM dynamic conditions are verbose)
  let results = await query;

  if (type) {
    results = results.filter((i) => i.type === type);
  }
  if (engine_source) {
    results = results.filter((i) => i.engineSource === engine_source);
  }
  if (status) {
    results = results.filter((i) => i.status === status);
  }
  if (name) {
    results = results.filter((i) =>
      i.name.toLowerCase().includes(name.toLowerCase()) ||
      i.summary.toLowerCase().includes(name.toLowerCase())
    );
  }

  const limited = results.slice(0, parseInt(limit));

  return c.json({
    projectId,
    filters: { type, name, status, engine_source },
    total: results.length,
    items: limited.map((i) => ({
      id: i.id,
      type: i.type,
      name: i.name,
      summary: i.summary,
      status: i.status,
      engineSource: i.engineSource,
      itemSubtype: i.itemSubtype,
      parentItemId: i.parentItemId,
      tags: i.tags,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    })),
  });
});

/**
 * POST /memory/query/:projectId
 * 高级记忆查询（支持关系网络、上下文追溯）
 */
app.post("/memory/query/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);

  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore */ }

  const { itemId, includeRelations = false, includeSiblings = false } = body;

  if (!itemId) {
    return c.json({ error: "itemId is required" }, 400);
  }

  const [item] = await db
    .select()
    .from(settingItems)
    .where(and(eq(settingItems.id, itemId), eq(settingItems.projectId, projectId)));

  if (!item) {
    return c.json({ error: "Setting item not found" }, 404);
  }

  const result: Record<string, any> = { item };

  if (includeRelations) {
    // Query both outgoing and incoming relations
    const [outgoing, incoming] = await Promise.all([
      db.select().from(settingItemRelations).where(
        and(eq(settingItemRelations.projectId, projectId), eq(settingItemRelations.sourceItemId, itemId))
      ),
      db.select().from(settingItemRelations).where(
        and(eq(settingItemRelations.projectId, projectId), eq(settingItemRelations.targetItemId, itemId))
      ),
    ]);
    const relations = [...outgoing, ...incoming];

    const targetIds = [...new Set(relations.map((r) => r.targetItemId).concat(relations.map((r) => r.sourceItemId)).filter(id => id !== itemId))];
    const targets = targetIds.length > 0
      ? await db
          .select()
          .from(settingItems)
          .where(eq(settingItems.projectId, projectId))
      : [];

    const targetMap = new Map(targets.map((t) => [t.id, t]));

    result.relations = relations.map((r) => ({
      ...r,
      targetItem: targetMap.get(r.targetItemId),
    }));
  }

  if (includeSiblings && item.parentItemId) {
    const siblings = await db
      .select()
      .from(settingItems)
      .where(
        and(
          eq(settingItems.projectId, projectId),
          eq(settingItems.parentItemId, item.parentItemId),
          ne(settingItems.id, itemId)
        )
      );
    result.siblings = siblings;
  }

  return c.json(result);
});

// ──────────────────────────────────────────────────────────────
// 设定查询（锁定后）
// ──────────────────────────────────────────────────────────────

/**
 * GET /settings/:id
 * 查询已锁定的设定集
 */
app.get("/settings/:id", async (c) => {
  const projectId = c.req.param("id");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);

  const [settings] = await db
    .select()
    .from(projectSettings)
    .where(eq(projectSettings.projectId, projectId));

  const items = await db
    .select()
    .from(settingItems)
    .where(
      and(
        eq(settingItems.projectId, projectId),
        eq(settingItems.status, "confirmed")
      )
    );

  // 查询关系网络
  const itemIds = items.map((i) => i.id);
  const relations = itemIds.length > 0
    ? await db
        .select()
        .from(settingItemRelations)
        .where(eq(settingItemRelations.projectId, projectId))
    : [];

  return c.json({
    locked: !!settings?.lockedAt,
    lockedAt: settings?.lockedAt,
    worldBible: settings?.worldBible,
    hatchSummary: settings?.hatchSummary,
    items: items.map((i) => ({
      id: i.id,
      type: i.type,
      name: i.name,
      summary: i.summary,
      content: i.content,
      tags: i.tags,
      proposalId: i.proposalId,
      status: i.status,
      parentItemId: i.parentItemId,
      engineSource: i.engineSource,
      itemSubtype: i.itemSubtype,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    })),
    relations: relations.map((r) => ({
      id: r.id,
      sourceItemId: r.sourceItemId,
      targetItemId: r.targetItemId,
      relationType: r.relationType,
      label: r.label,
    })),
  });
});

/**
 * PATCH /settings/items/:id
 * 更新设定条目（名称、摘要、内容）
 */
app.patch("/settings/items/:id", async (c) => {
  const itemId = c.req.param("id");
  if (!validateUUID(itemId)) return c.json({ error: "Invalid item ID" }, 400);
  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore */ }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.summary !== undefined) updates.summary = body.summary;
  if (body.content !== undefined) updates.content = body.content;

  if (Object.keys(updates).length <= 1) {
    return c.json({ error: "No fields to update" }, 400);
  }

  const [updated] = await db
    .update(settingItems)
    .set(updates)
    .where(eq(settingItems.id, itemId))
    .returning({
      id: settingItems.id,
      type: settingItems.type,
      name: settingItems.name,
      summary: settingItems.summary,
      content: settingItems.content,
      tags: settingItems.tags,
      status: settingItems.status,
      updatedAt: settingItems.updatedAt,
    });

  if (!updated) return c.json({ error: "Setting item not found" }, 404);

  return c.json({ success: true, item: updated });
});

// ──────────────────────────────────────────────────────────────
// 提案 MOU（拍板 / 拒绝 / 修改）
// ──────────────────────────────────────────────────────────────

/**
 * POST /proposals/bulk/approve
 * 批量拍板（必须放在 /:id 路由之前，否则 Hono 会把 bulk 当 ID）
 */
app.post("/proposals/bulk/approve", async (c) => {
  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore */ }

  const ids: string[] = body?.ids || [];
  const decision = body?.decision || "作者批量确认";

  // 过滤无效的 proposalId，防止 DB 错误
  const validIds = ids.filter((id) => validateUUID(id));

  let executed = 0;
  let projectId: string | null = null;
  for (const proposalId of validIds) {
    try {
      const result = await orchestrator.approveProposal(proposalId, decision);
      if (result.executed) {
        executed++;
        if (!projectId) {
          const [p] = await db.select({ projectId: aiProposals.projectId }).from(aiProposals).where(eq(aiProposals.id, proposalId));
          projectId = p?.projectId || null;
        }
      }
    } catch (err: any) {
      console.error(`[bulk approve] ${proposalId} failed:`, err.message);
    }
  }

  // Trigger next engine via scheduler after bulk approval
  // NOTE: Frontend drives the hatching chain now, but keep this for
  // edge cases (e.g. bulk approve from proposal list window)
  if (projectId && scheduler) {
    scheduler.onProposalsResolved(projectId).catch(() => {});
  }

  return c.json({
    success: true,
    total: ids.length,
    executed,
  });
});

/**
 * POST /proposals/:id/approve
 * 审批提案 — 只做 DB 写入（更新状态 + 执行 handler 创建 setting_items）
 * 编排决策由前端调用 /advance 时由后端 getNextPhase 统一判断
 */
app.post("/proposals/:id/approve", async (c) => {
  const proposalId = c.req.param("id");
  if (!validateUUID(proposalId)) return c.json({ error: "Invalid proposal ID" }, 400);
  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore */ }

  try {
    const result = await orchestrator.approveProposal(proposalId, body?.decision);

    // 审批成功后，后端自动推进下一阶段（细化/下一引擎/完成）
    // 前端无需调用 advanceHatching，所有编排逻辑在后端
    if (result.executed) {
      const [proposal] = await db
        .select({ projectId: aiProposals.projectId, type: aiProposals.type, sourceNode: aiProposals.sourceNode, title: aiProposals.title })
        .from(aiProposals)
        .where(eq(aiProposals.id, proposalId));

      // 审批世界观基调提案时，同步更新项目标题
      if (proposal?.projectId && (proposal.type === 'tone' || proposal.sourceNode === 'tone') && proposal.title) {
        await db.update(projects)
          .set({ title: proposal.title, updatedAt: new Date() })
          .where(eq(projects.id, proposal.projectId));
      }

      if (proposal?.projectId && scheduler) {
        scheduler.onProposalsResolved(proposal.projectId).catch((err: Error) => {
          console.error(`[approve] auto-advance failed for ${proposal.projectId}:`, err.message);
        });
      }
    }

    return c.json({
      success: result.executed,
      proposalId,
      settingItemsCreated: result.settingItemsCreated,
    });
  } catch (err: any) {
    console.error(`[approve] 审批提案 ${proposalId} 失败:`, err.message);
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /proposals/:id/reject
 * 作者拒绝
 */
app.post("/proposals/:id/reject", async (c) => {
  const proposalId = c.req.param("id");
  if (!validateUUID(proposalId)) return c.json({ error: "Invalid proposal ID" }, 400);
  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore */ }

  try {
    await orchestrator.rejectProposal(proposalId, body?.reason || "作者拒绝");

    return c.json({ success: true, proposalId, status: "rejected" });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

/**
 * POST /proposals/:id/revise
 * 作者要求修改：标记 revision_requested，记录修改意见
 */
app.post("/proposals/:id/revise", async (c) => {
  const proposalId = c.req.param("id");
  if (!validateUUID(proposalId)) return c.json({ error: "Invalid proposal ID" }, 400);
  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore */ }

  const result = await orchestrator.reviseProposal(proposalId, body?.notes || "作者要求修改");

  return c.json({
    success: result.success,
    proposalId,
    projectId: result.projectId,
    status: "revision_requested",
  });
});

// ──────────────────────────────────────────────────────────────
// 通知中心（弹窗分级 P0-P4）
// ──────────────────────────────────────────────────────────────

/**
 * GET /notifications/:projectId
 * 查询项目通知列表
 */
app.get("/notifications/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);
  const { unreadOnly, priority, limit = "50" } = c.req.query();

  let conditions = [eq(notifications.projectId, projectId)];
  if (unreadOnly === "true") {
    conditions.push(eq(notifications.status, "unread"));
  }
  if (priority) {
    conditions.push(eq(notifications.priority, priority as any));
  }

  const list = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(notifications.createdAt)
    .limit(parseInt(limit));

  return c.json({
    total: list.length,
    unread: list.filter((n) => n.status === "unread").length,
    byPriority: {
      p0: list.filter((n) => n.priority === "p0").length,
      p1: list.filter((n) => n.priority === "p1").length,
      p2: list.filter((n) => n.priority === "p2").length,
      p3: list.filter((n) => n.priority === "p3").length,
      p4: list.filter((n) => n.priority === "p4").length,
    },
    notifications: list,
  });
});

/**
 * POST /notifications/:id/:action
 * 标记通知已读/已处理/已忽略
 */
app.post("/notifications/:id/:action", async (c) => {
  const notificationId = c.req.param("id");
  if (!validateUUID(notificationId)) return c.json({ error: "Invalid notification ID" }, 400);
  const action = c.req.param("action");

  if (!["read", "dismissed", "acted"].includes(action)) {
    return c.json({ error: "Invalid action" }, 400);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(notifications)
      .set({ status: action as any })
      .where(eq(notifications.id, notificationId));

    await tx.insert(notificationReads).values({
      notificationId,
      action: action as "read" | "dismissed" | "acted",
      actor: "author",
    });
  });

  return c.json({ success: true, notificationId, action });
});

// ──────────────────────────────────────────────────────────────
// 设定更新提案（MOU 流程：修改已确认设定必须走提案审批）
// ──────────────────────────────────────────────────────────────

/**
 * POST /settings/items/:id/propose-update
 * 通过 MOU 流程修改已确认的设定条目
 * 创建一个 update 类型的 ai_proposal，等待审批后才执行修改
 */
app.post("/settings/items/:id/propose-update", async (c) => {
  const itemId = c.req.param("id");
  if (!validateUUID(itemId)) return c.json({ error: "Invalid item ID" }, 400);
  let body: any = {};
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid body" }, 400); }

  // 查找原始设定
  const [original] = await db
    .select()
    .from(settingItems)
    .where(eq(settingItems.id, itemId));

  if (!original) return c.json({ error: "Setting item not found" }, 404);

  const updates: Record<string, any> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.summary !== undefined) updates.summary = body.summary;
  if (body.content !== undefined) updates.content = body.content;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  // 创建会话
  const [session] = await db
    .insert(sessions)
    .values({
      projectId: original.projectId,
      type: "setting-update",
      title: `设定修改提案：${body.name || original.name}`,
    })
    .returning({ id: sessions.id });

  // 通过 Orchestrator 统一流程创建提案
  const result: EngineResult = {
    proposals: [{
      type: `${original.type}_update`,
      title: `修改设定：${body.name || original.name}`,
      content: {
        reasoning: body.reasoning || "作者手动修改",
        payload: { originalItemId: original.id, originalItemName: original.name, updates },
      },
      targetTable: "setting_items",
      targetAction: "update",
      targetId: original.id,
    }],
  };

  const proposalIds = await orchestrator.stageProposals(original.projectId, session.id, result, "author-edit");

  return c.json({
    success: true,
    proposalIds,
    message: "更新提案已创建，请通过 MOU 审批流程确认修改",
  });
});

/**
 * POST /settings/items/:id/propose-delete
 * 通过 MOU 流程删除设定条目
 * 自动分析删除影响：关联条目、已定稿章节引用等
 */
app.post("/settings/items/:id/propose-delete", async (c) => {
  const itemId = c.req.param("id");
  if (!validateUUID(itemId)) return c.json({ error: "Invalid item ID" }, 400);

  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore */ }

  // 查找原始设定
  const [original] = await db
    .select()
    .from(settingItems)
    .where(eq(settingItems.id, itemId));

  if (!original) return c.json({ error: "Setting item not found" }, 404);

  // 查找关联关系
  const [outgoing, incoming] = await Promise.all([
    db.select().from(settingItemRelations).where(eq(settingItemRelations.sourceItemId, itemId)),
    db.select().from(settingItemRelations).where(eq(settingItemRelations.targetItemId, itemId)),
  ]);
  const allRelations = [...outgoing, ...incoming];

  // 获取关联条目的名称
  const relatedIds = [...new Set(allRelations.flatMap((r) => [r.sourceItemId, r.targetItemId]).filter((id) => id !== itemId))];
  const relatedItems = relatedIds.length > 0
    ? await db.select({ id: settingItems.id, name: settingItems.name, type: settingItems.type }).from(settingItems).where(eq(settingItems.projectId, original.projectId))
    : [];
  const relatedNameMap = new Map(relatedItems.map((i) => [i.id, i.name]));

  // 检查已定稿章节是否引用此条目
  const confirmedChapters = await db
    .select({ id: chapters.id, chapterNumber: chapters.chapterNumber, title: chapters.title, volumeId: chapters.volumeId })
    .from(chapters)
    .where(and(eq(chapters.projectId, original.projectId), eq(chapters.status, "confirmed")));

  // 简单检查章节内容/大纲是否引用了该条目名称
  const affectedChapters = confirmedChapters.filter((ch) => {
    const searchIn = JSON.stringify([ch.title]).toLowerCase();
    return searchIn.includes(original.name.toLowerCase());
  }).slice(0, 5);

  // 构建影响分析
  const impactAnalysis = {
    item: { id: original.id, name: original.name, type: original.type },
    relatedItems: allRelations.map((r) => ({
      relationType: r.relationType,
      label: r.label,
      relatedName: r.sourceItemId === itemId
        ? relatedNameMap.get(r.targetItemId) || "unknown"
        : relatedNameMap.get(r.sourceItemId) || "unknown",
    })),
    affectedChapters: affectedChapters.map((ch) => ({
      chapterNumber: ch.chapterNumber,
      title: ch.title,
    })),
    warning: affectedChapters.length > 0
      ? `此条目被 ${affectedChapters.length} 个已定稿章节引用，删除后这些章节的引用将失去依据。建议同步调整后续章节。`
      : "此条目未被已定稿章节引用，删除较为安全。",
  };

  // 创建会话
  const [session] = await db
    .insert(sessions)
    .values({
      projectId: original.projectId,
      type: "setting-delete",
      title: `设定删除提案：${original.name}`,
    })
    .returning({ id: sessions.id });

  // 创建提案
  const result: EngineResult = {
    proposals: [{
      type: `${original.type}_delete`,
      title: `删除设定：${original.name}`,
      content: {
        reasoning: body.reasoning || `作者请求删除设定"${original.name}"。\n\n## 影响分析\n${impactAnalysis.warning}\n\n关联条目：${impactAnalysis.relatedItems.map((r) => `${r.relationType}: ${r.relatedName}`).join("、") || "无"}\n已定稿章节引用：${affectedChapters.map((ch) => `第${ch.chapterNumber}章 ${ch.title}`).join("、") || "无"}`,
        payload: {
          action: "delete",
          itemId: original.id,
          itemName: original.name,
          itemType: original.type,
          impactAnalysis,
        },
      },
      targetTable: "setting_items",
      targetAction: "delete",
      targetId: original.id,
    }],
  };

  const proposalIds = await orchestrator.stageProposals(original.projectId, session.id, result, "author-delete");

  return c.json({
    success: true,
    proposalIds,
    impactAnalysis,
    message: "删除提案已创建，请通过 MOU 审批流程确认删除",
  });
});

/**
 * POST /hatch/:projectId/engine/:engine/create-item
 * 通过 MOU 流程新增设定条目
 * 接收用户的想法描述，由引擎生成具体的设定提案
 */
app.post("/hatch/:id/engine/:engine/create-item", async (c) => {
  const projectId = c.req.param("id");
  const engineName = c.req.param("engine");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);
  if (!ALLOWED_CREATE_ENGINES.has(engineName)) return c.json({ error: "Invalid or unsupported engine" }, 400);

  let body: any = {};
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid body" }, 400); }

  const userInput = body.userInput;
  if (!userInput || userInput.trim().length < 3) {
    return c.json({ error: "userInput is required (min 3 chars)" }, 400);
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project not found" }, 404);

  let node;
  try {
    node = getEngine(engineName);
  } catch (err: any) {
    return c.json({ error: err.message, available: listEngines() }, 400);
  }

  const [session] = await db
    .insert(sessions)
    .values({
      projectId,
      type: engineName,
      title: `手动创建：${engineName} - ${userInput.substring(0, 50)}`,
    })
    .returning({ id: sessions.id });

  let result: any;
  try {
    result = await node.run({
      projectId,
      sessionId: session.id,
      caller: `genre=${project.genre}, title=${project.title}, userInput=${userInput}`,
    });
  } catch (err: any) {
    console.error(`[hatch] create-item ${engineName} failed:`, err.message);
    return c.json({ error: `Engine ${engineName} failed: ${err.message}` }, 500);
  }

  const proposalIds = await orchestrator.stageProposals(projectId, session.id, result, engineName);

  const proposals = await db
    .select()
    .from(aiProposals)
    .where(eq(aiProposals.projectId, projectId))
    .orderBy(aiProposals.createdAt);

  return c.json({
    success: true,
    engine: engineName,
    sessionId: session.id,
    proposalCount: proposalIds.length,
    proposals: proposals.filter((p) => proposalIds.includes(p.id)).map((p) => ({
      id: p.id,
      type: p.type,
      title: p.title,
      status: p.status,
      reasoning: (p.content as any)?.reasoning,
    })),
  });
});

// ──────────────────────────────────────────────────────────────
// 章节快照 + 章节提交
// ──────────────────────────────────────────────────────────────

/**
 * POST /geography/refine/:parentItemId
 * 通用细化 API — 为任何已确认条目生成下一层级的子条目。
 * 自动根据条目的 engineSource 调用对应引擎。
 */
app.post("/geography/refine/:parentItemId", async (c) => {
  const parentItemId = c.req.param("parentItemId");
  if (!validateUUID(parentItemId)) return c.json({ error: "Invalid parent item ID" }, 400);

  if (!scheduler) return c.json({ error: "Scheduler not initialized" }, 500);

  // 查找父条目
  const [parentItem] = await db
    .select({ projectId: settingItems.projectId, name: settingItems.name, engineSource: settingItems.engineSource })
    .from(settingItems)
    .where(eq(settingItems.id, parentItemId));

  if (!parentItem) return c.json({ error: "Parent item not found" }, 404);

  try {
    const proposalIds = await scheduler.refineItem(parentItem.projectId, parentItemId);
    return c.json({ success: true, parentItemId, proposalIds });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * GET /geography/refinable/:projectId
 * 通用 refinable API — 获取项目中所有需要细化的条目（任何引擎）
 */
app.get("/geography/refinable/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);

  if (!scheduler) return c.json({ error: "Scheduler not initialized" }, 500);

  const items = await scheduler.getItemsNeedingRefinement(projectId);
  return c.json({ items });
});

/**
 * POST /chapters/:id/snapshot
 * 创建/更新章节世界快照 — 在首稿写完后冻结当前世界状态
 *
 * 调用时机：作者批准章节写作提案后（首稿确认）
 * 用途：修订/润色/重写本章时使用此快照，保证世界状态一致性
 *
 * 设计决策：
 * - 写新章 → 用实时数据（不需要快照），看到最新世界观
 * - 写完后 → 调用此端点创建快照，冻结当前世界状态
 * - 修订/润色/重写 → 用快照数据，不受后续世界变更干扰
 */
app.post("/chapters/:id/snapshot", async (c) => {
  const chapterId = c.req.param("id");
  if (!validateUUID(chapterId)) return c.json({ error: "Invalid chapter ID" }, 400);

  const [chapter] = await db
    .select({ id: chapters.id, projectId: chapters.projectId, worldSnapshot: chapters.worldSnapshot })
    .from(chapters)
    .where(eq(chapters.id, chapterId));

  if (!chapter) return c.json({ error: "Chapter not found" }, 404);

  const wasExisting = !!chapter.worldSnapshot;

  // 查询所有已确认的世界设定（当前最新状态）
  const items = await db
    .select({
      id: settingItems.id,
      type: settingItems.type,
      name: settingItems.name,
      summary: settingItems.summary,
      content: settingItems.content,
      tags: settingItems.tags,
      engineSource: settingItems.engineSource,
      itemSubtype: settingItems.itemSubtype,
      parentItemId: settingItems.parentItemId,
      createdAt: settingItems.createdAt,
    })
    .from(settingItems)
    .where(
      and(
        eq(settingItems.projectId, chapter.projectId),
        eq(settingItems.status, "confirmed")
      )
    );

  // 查询所有关系
  const relations = await db
    .select({
      sourceItemId: settingItemRelations.sourceItemId,
      targetItemId: settingItemRelations.targetItemId,
      relationType: settingItemRelations.relationType,
      label: settingItemRelations.label,
    })
    .from(settingItemRelations)
    .where(eq(settingItemRelations.projectId, chapter.projectId));

  // 构建名称查找表
  const nameMap = new Map(items.map((i) => [i.id, i.name]));

  // 打包快照
  const snapshot = {
    items: items.map((item) => ({
      id: item.id,
      type: item.type,
      name: item.name,
      summary: item.summary || "",
      content: (item.content || {}) as Record<string, unknown>,
      tags: item.tags as string[] | null,
      engineSource: item.engineSource,
      itemSubtype: item.itemSubtype,
      parentItemId: item.parentItemId,
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt || ""),
    })),
    relations: relations.map((r) => ({
      sourceItemId: r.sourceItemId,
      targetItemId: r.targetItemId,
      sourceName: nameMap.get(r.sourceItemId) || "?",
      targetName: nameMap.get(r.targetItemId) || "?",
      relationType: r.relationType,
      label: r.label || "",
    })),
    takenAt: new Date().toISOString(),
  };

  // 写入/覆盖章节快照
  await db
    .update(chapters)
    .set({
      worldSnapshot: snapshot,
      snapshotTakenAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(chapters.id, chapterId));

  console.log(`[snapshot] Chapter ${chapterId}: snapshot ${wasExisting ? "updated" : "created"} with ${snapshot.items.length} items and ${snapshot.relations.length} relations`);

  return c.json({
    success: true,
    snapshotExists: wasExisting,
    message: wasExisting
      ? `章节世界快照已更新：${snapshot.items.length} 个设定条目，${snapshot.relations.length} 条关系`
      : `章节世界快照已创建：${snapshot.items.length} 个设定条目，${snapshot.relations.length} 条关系`,
    chapterId,
    stats: {
      itemsCount: snapshot.items.length,
      relationsCount: snapshot.relations.length,
    },
  });
});

/**
 * POST /chapters/:id/commit
 * 作者确认章节完成（frozen/committed），触发 proactive 引擎
 */
app.post("/chapters/:id/commit", async (c) => {
  const chapterId = c.req.param("id");
  if (!validateUUID(chapterId)) return c.json({ error: "Invalid chapter ID" }, 400);

  const [chapter] = await db
    .select()
    .from(chapters)
    .where(eq(chapters.id, chapterId));

  if (!chapter) return c.json({ error: "Chapter not found" }, 404);

  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore optional body */ }

  // 更新章节状态为 confirmed（即设计中的 frozen/committed）
  await db
    .update(chapters)
    .set({
      status: "confirmed",
      contentSummary: body.content || null,
      frozenAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(chapters.id, chapterId));

  // Emit chapter.committed 事件，触发 proactive 引擎
  bus.emit({
    type: "chapter.committed",
    projectId: chapter.projectId,
    chapterId,
  });

  // Also push via WebSocket
  wsBus.push(chapter.projectId, {
    type: "chapter_committed",
    payload: { chapterId, chapterNumber: chapter.chapterNumber, title: chapter.title },
  });

  return c.json({
    success: true,
    chapterId,
    status: "committed",
    message: "章节已确认完成，已触发 proactive 引擎",
  });
});

/**
 * POST /hatch/:id/complete-phase/:phase
 * 用户手动确认某个孵化阶段完成，推进到下一阶段
 */
app.post("/hatch/:id/complete-phase/:phase", async (c) => {
  const projectId = c.req.param("id");
  const phase = c.req.param("phase");
  if (!validateUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);
  if (!phase || !ALLOWED_PHASES.has(phase)) return c.json({ error: "Invalid or unsupported phase" }, 400);

  const [settings] = await db
    .select({ hatchSummary: projectSettings.hatchSummary })
    .from(projectSettings)
    .where(eq(projectSettings.projectId, projectId));

  const hatchSummary = (settings?.hatchSummary || {}) as Record<string, unknown>;
  const phaseStatus = (hatchSummary.phaseStatus || {}) as Record<string, string>;
  phaseStatus[phase] = "completed";

  await db
    .update(projectSettings)
    .set({
      hatchSummary: { ...hatchSummary, phaseStatus },
      updatedAt: new Date(),
    })
    .where(eq(projectSettings.projectId, projectId));

  console.log(`[hatch] Project ${projectId} phase "${phase}" marked as completed`);

  return c.json({
    success: true,
    projectId,
    phase,
    phaseStatus,
    message: `阶段 "${phase}" 已标记为完成`,
  });
});

/**
 * POST /settings/items/:id/complete-refinement
 * 手动标记某条设定细化已完成，不再自动展开
 */
app.post("/settings/items/:id/complete-refinement", async (c) => {
  const itemId = c.req.param("id");
  if (!validateUUID(itemId)) return c.json({ error: "Invalid item ID" }, 400);

  const [item] = await db
    .select({ id: settingItems.id, content: settingItems.content })
    .from(settingItems)
    .where(eq(settingItems.id, itemId));

  if (!item) return c.json({ error: "Item not found" }, 404);

  const content = { ...(item.content as Record<string, unknown> || {}), needs_refinement: false };

  await db
    .update(settingItems)
    .set({ content, updatedAt: new Date() })
    .where(eq(settingItems.id, itemId));

  return c.json({ success: true, itemId, message: "已标记为细化完成" });
});

export default app;
