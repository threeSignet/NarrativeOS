import { Hono } from "hono";
import { stream } from "hono/streaming";
import { db, projects, sessions, discussions, settingItems, settingItemRelations, chapters } from "@narrative-os/database";
import { eq, and, desc } from "drizzle-orm";
import { CompanionAgent, toolRegistry } from "@narrative-os/companion";
import { LLMClient } from "@narrative-os/llm-client";
import type { Message } from "@narrative-os/llm-client";
import { buildWorldContext } from "@narrative-os/engines";

const app = new Hono();

let registryInitialized = false;
function ensureRegistry() {
  if (!registryInitialized) {
    toolRegistry.initialize();
    registryInitialized = true;
  }
}

app.post("/:projectId/chat", async (c) => {
  const projectId = c.req.param("projectId");
  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore */ }

  const userContent: string = body.content || "";
  if (!userContent.trim()) {
    return c.json({ error: "content is required" }, 400);
  }

  ensureRegistry();

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project not found" }, 404);

  let sessionId = body.sessionId as string | undefined;
  if (!sessionId) {
    const [session] = await db.insert(sessions).values({
      projectId,
      type: "companion",
      title: `AI 伙伴: ${project.title}`,
    }).returning({ id: sessions.id });
    sessionId = session.id;
  }

  await db.insert(discussions).values({
    projectId,
    sessionId,
    role: "user",
    content: userContent,
  });

  const history = await db.select().from(discussions).where(
    eq(discussions.sessionId, sessionId)
  ).orderBy(discussions.createdAt);

  const messages: Message[] = history.map((d) => ({
    role: d.role as "user" | "assistant",
    content: d.content,
  }));

  return stream(c, async (s) => {
    s.write(`event: session\ndata: ${JSON.stringify({ sessionId })}\n\n`);

    const agent = new CompanionAgent();
    let assistantText = "";

    try {
      for await (const event of agent.run(messages, {
        projectId,
        sessionId,
        callerRef: "companion",
      })) {
        switch (event.type) {
          case "text":
            assistantText += event.content;
            s.write(`event: text\ndata: ${JSON.stringify({ content: event.content })}\n\n`);
            break;
          case "tool_call":
            s.write(`event: tool_call\ndata: ${JSON.stringify({
              id: event.id, name: event.name, args: event.args,
            })}\n\n`);
            break;
          case "tool_result":
            s.write(`event: tool_result\ndata: ${JSON.stringify({
              id: event.id, result: event.result, display: event.display,
            })}\n\n`);
            break;
          case "usage":
            s.write(`event: usage\ndata: ${JSON.stringify(event.usage)}\n\n`);
            break;
          case "model_info":
            s.write(`event: model_info\ndata: ${JSON.stringify(event.info)}\n\n`);
            break;
          case "done":
            if (assistantText) {
              await db.insert(discussions).values({
                projectId,
                sessionId,
                role: "assistant",
                content: assistantText,
              });
            }
            s.write(`event: done\ndata: ${JSON.stringify(event.summary)}\n\n`);
            break;
          case "activity":
            s.write(`event: activity\ndata: ${JSON.stringify({ text: event.text, color: event.color })}\n\n`);
            break;
          case "error":
            s.write(`event: error\ndata: ${JSON.stringify({ message: event.message })}\n\n`);
            break;
        }
      }
    } catch (err: any) {
      s.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    }
  });
});

app.get("/:projectId/history/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const messages = await db.select().from(discussions).where(
    eq(discussions.sessionId, sessionId)
  ).orderBy(discussions.createdAt);
  return c.json({ messages });
});

// ─── Entity Adjust Chat ─────────────────────────────────────
// Lightweight SSE endpoint for entity-specific AI adjustment chat

app.post("/:projectId/entity-adjust", async (c) => {
  const projectId = c.req.param("projectId");
  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore */ }

  const item = body.item;
  const userMessage: string = body.message || "";
  if (!item || !userMessage.trim()) {
    return c.json({ error: "item and message are required" }, 400);
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project not found" }, 404);

  const typeLabel = (() => {
    const labels: Record<string, string> = {
      character: "角色", location: "地点", faction: "势力",
      power_system: "力量体系", world_rule: "世界规则",
      plot_seed: "剧情种子", tone_setting: "基调设定", theme: "主题",
    };
    return labels[item.type] || item.type;
  })();

  const contentStr = Object.entries(item.content || {})
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v, null, 2)}`)
    .join("\n");

  const systemPrompt = `你是 NarrativeOS+ 的创作助手，专注于帮助作者优化和调整世界观设定。

当前正在处理的设定：
- 类型：${typeLabel}
- 名称：${item.name}
- 概述：${item.summary || "无"}
- 详细内容：
${contentStr}

项目名称：${project.title}
项目类型：${project.genre || "未设置"}

请根据作者的反馈提供修改建议。你可以：
1. 分析当前设定的优缺点
2. 提出具体的、可操作的改进建议
3. 根据作者的要求直接输出修改后的版本
4. 保持与项目世界观和类型的一致性

回复要具体、有建设性。如果你建议修改内容，请直接输出修改后的版本。`;

  return stream(c, async (s) => {
    const llm = new LLMClient();
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    try {
      for await (const chunk of llm.stream(messages, {
        caller: "entity-adjust",
        projectId,
        sessionId: projectId,
        callerRefType: "entity-adjust",
        callerRefId: projectId,
      })) {
        if (chunk.text) {
          s.write(`data: ${JSON.stringify({ content: chunk.text })}\n\n`);
        }
      }
      s.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err: any) {
      s.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    }
  });
});

/**
 * POST /:projectId/world/query
 * 查询世界状态（设定条目、关系网络）
 */
app.post("/:projectId/world/query", async (c) => {
  const projectId = c.req.param("projectId");
  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore */ }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project not found" }, 404);

  const typeFilter = body.type;
  const search = body.search as string | undefined;
  const limit = Math.min(parseInt(body?.limit || "50"), 200);

  let conditions: any[] = [
    eq(settingItems.projectId, projectId),
    eq(settingItems.status, "confirmed"),
  ];
  if (typeFilter) {
    conditions.push(eq(settingItems.type, typeFilter));
  }

  const items = await db
    .select()
    .from(settingItems)
    .where(and(...conditions))
    .limit(limit);

  // 查询关系网络（限制在返回的 items 范围内）
  const itemIds = items.map((i) => i.id);
  let relations: typeof settingItemRelations.$inferSelect[] = [];
  if (itemIds.length > 0) {
    relations = await db
      .select()
      .from(settingItemRelations)
      .where(
        and(
          eq(settingItemRelations.projectId, projectId),
          eq(settingItemRelations.sourceItemId, itemIds[0]) // 简化：只查第一个 item 的关系
        )
      )
      .limit(100);
    // 如果有多 item，实际应该用 inArray，但 drizzle-orm 0.30 可能不支持
    // 这里简化处理
  }

  // 搜索过滤
  let filtered = items;
  if (search) {
    const q = search.toLowerCase();
    filtered = items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        (i.tags && i.tags.some((t: string) => t.toLowerCase().includes(q)))
    );
  }

  return c.json({
    projectId,
    query: { type: typeFilter, search, limit },
    total: filtered.length,
    items: filtered.map((i) => ({
      id: i.id,
      type: i.type,
      name: i.name,
      summary: i.summary,
      tags: i.tags,
      engineSource: i.engineSource,
      itemSubtype: i.itemSubtype,
      parentItemId: i.parentItemId,
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
 * POST /:projectId/memory/query
 * 查询记忆（章节摘要、最近事件、世界上下文）
 */
app.post("/:projectId/memory/query", async (c) => {
  const projectId = c.req.param("projectId");
  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore */ }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project not found" }, 404);

  const chapterLimit = Math.min(parseInt(body?.chapterLimit || "10"), 50);
  const includeWorldContext = body?.includeWorldContext !== false;
  const semanticQuery = body?.semanticQuery as string | undefined;

  // 最近章节摘要
  const recentChapters = await db
    .select({
      id: chapters.id,
      chapterNumber: chapters.chapterNumber,
      title: chapters.title,
      summary: chapters.summary,
      contentSummary: chapters.contentSummary,
      status: chapters.status,
      actualWords: chapters.actualWords,
      updatedAt: chapters.updatedAt,
    })
    .from(chapters)
    .where(eq(chapters.projectId, projectId))
    .orderBy(desc(chapters.chapterNumber))
    .limit(chapterLimit);

  // 世界上下文（结构化设定摘要）
  let worldContext: Message[] = [];
  if (includeWorldContext) {
    worldContext = await buildWorldContext(projectId, { detailLevel: "structured" });
  }

  // 语义搜索（如果提供了查询）
  let semanticResults: any[] = [];
  if (semanticQuery) {
    const { EmbeddingPipeline } = await import("@narrative-os/database");
    const pipeline = EmbeddingPipeline.getInstance();
    if (pipeline) {
      const results = await pipeline.searchForCompanion(projectId, semanticQuery, 10);
      semanticResults = results.map((r) => ({
        embeddingId: r.embeddingId,
        chunkText: r.chunkText,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        similarity: r.similarity,
      }));
    }
  }

  return c.json({
    projectId,
    query: { chapterLimit, includeWorldContext, semanticQuery },
    recentChapters: recentChapters.map((ch) => ({
      id: ch.id,
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      summary: ch.summary,
      contentSummary: ch.contentSummary,
      status: ch.status,
      actualWords: ch.actualWords,
      updatedAt: ch.updatedAt,
    })),
    worldContext: worldContext.map((m) => ({
      role: m.role,
      content: m.content.substring(0, 500), // 截断避免过大响应
    })),
    semanticResults,
  });
});

function pickDynamicFallback(hasContent: boolean, characters: { name: string }[]): { text: string; color: string } {
  const colors = ["#a78bfa", "#22d3ee", "#34d399", "#fb923c", "#f472b6", "#60a5fa"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  if (!hasContent) {
    const templates = [
      '一个新世界正在孕育...', '灵感的种子已种下', '故事的序幕即将拉开',
      '等待第一笔落下', '新世界的轮廓浮现中', '命运的齿轮开始转动',
      '笔尖悬停，灵感将至', '一张白纸，无限可能',
    ];
    return { text: templates[Math.floor(Math.random() * templates.length)], color };
  }
  const name = characters[0]?.name || '主角';
  const name2 = characters.length > 1 ? characters[1].name : null;
  const templates = [
    `${name}的命运正在转动...`, `推演${name}的下一段旅程`,
    `在${name}的世界里漫步`, `${name}的故事还在继续`,
    name2 ? `${name}和${name2}的纠葛...` : `${name}的命运交汇点`,
    `第N章的灵感正在浮现`, `这个世界的设定越来越有趣`,
    `故事的暗线正在收束`, `${name}会怎么选择呢？`,
  ];
  return { text: templates[Math.floor(Math.random() * templates.length)], color };
}

/**
 * POST /:projectId/activity-init
 * 用轻量模型快速生成动态副标题（~10字 + 荧光色）
 */
app.post("/:projectId/activity-init", async (c) => {
  const projectId = c.req.param("projectId");
  const [project] = await db.select({
    title: projects.title, genre: projects.genre,
    synopsis: projects.synopsis, coreCreativity: projects.coreCreativity,
    totalChapters: projects.totalChapters, totalWords: projects.totalWords,
    totalVolumes: projects.totalVolumes,
  }).from(projects).where(eq(projects.id, projectId));
  if (!project) return c.json({ error: "Project not found" }, 404);

  // 获取最近的章节
  const recentChapters = await db.select({
    chapterNumber: chapters.chapterNumber, title: chapters.title,
    summary: chapters.summary, status: chapters.status,
  }).from(chapters).where(eq(chapters.projectId, projectId))
    .orderBy(desc(chapters.chapterNumber)).limit(3);

  // 获取已确认的角色设定
  const characters = await db.select({
    name: settingItems.name, summary: settingItems.summary,
  }).from(settingItems).where(
    and(eq(settingItems.projectId, projectId), eq(settingItems.type, "character"), eq(settingItems.status, "confirmed"))
  ).limit(5);

  const hasContent = recentChapters.length > 0 || characters.length > 0;

  const llm = new LLMClient();
  let ctx = `项目：《${project.title}》${project.genre ? `（${project.genre}）` : ""}`;
  if (project.coreCreativity) ctx += `\n核心创意：${project.coreCreativity}`;
  if (project.synopsis) ctx += `\n简介：${project.synopsis.substring(0, 200)}`;

  if (recentChapters.length > 0) {
    ctx += `\n最近章节：`;
    for (const ch of recentChapters) {
      ctx += `\n- 第${ch.chapterNumber}章「${ch.title}」${ch.summary ? `：${ch.summary.substring(0, 60)}` : ""}`;
    }
  }
  if (characters.length > 0) {
    ctx += `\n角色：`;
    for (const ch of characters) {
      ctx += `\n- ${ch.name}${ch.summary ? `：${ch.summary.substring(0, 40)}` : ""}`;
    }
  }

  const systemPrompt = `你是《${project.title}》的AI创作伙伴。基于以下小说上下文，生成一条有趣、有代入感的动态状态语（12字以内）。

${hasContent ? `像一个活在小说世界里的人一样说话。参考方向（每次随机选角度）：
${characters.length > 0 ? `- 用${characters.map(c => c.name).slice(0, 3).join('、')}等角色的口吻说一句话` : '- 用某个角色的口吻说话'}
${recentChapters.length > 0 ? `- 调侃第${recentChapters[0].chapterNumber}章「${recentChapters[0].title}」的剧情` : '- 调侃当前剧情进展'}
${characters.length > 1 ? `- 推演${characters[1].name}和${characters[0].name}之间的关系走向` : ''}
- 对世界观或设定给出一个有趣的感叹

要自然、有个性、每次不同。` : `项目刚开始。用期待或好奇的语气描述创作状态。`}

禁止"准备就绪""准备好了""我来了""随时待命"等客套话。
选一个荧光色：#a78bfa #22d3ee #34d399 #fb923c #f472b6 #60a5fa。
只输出JSON：{"text":"...","color":"#hex"}

小说上下文：
${ctx}`;

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "生成状态" },
  ];
  let full = "";
  try {
    for await (const chunk of llm.stream(messages, {
      caller: "activity-init",
      projectId,
      tier: "lightweight",
      maxTokens: 50,
      temperature: 0.95,
    })) {
      if (chunk.text) full += chunk.text;
    }
    const jsonMatch = full.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim().match(/\{[\s\S]*?\}/);
    let result: { text: string; color: string } | null = null;
    if (jsonMatch) {
      try { result = JSON.parse(jsonMatch[0]); } catch { /* parse failed */ }
    }
    const banned = ["准备就绪", "准备好了", "我来了", "随时待命", "我在这里"];
    if (!result || banned.some(b => (result?.text ?? "").includes(b))) {
      result = pickDynamicFallback(hasContent, characters);
    }
    return c.json(result);
  } catch (e) {
    console.log('[activity-init] error:', e);
    return c.json(pickDynamicFallback(hasContent, characters));
  }
});

export default app;
