/**
 * Agent Communication Layer — WorldAgent
 *
 * 世界设定守护者：
 * - 维护所有 world engine 产出（setting_items + project_scales）的全局视图
 * - 接收来自 StudioAgent 的结构化查询
 * - 路由查询到适当的子引擎或直接查询数据库
 * - 返回数据 + 可能性（不只是固定数据）
 * - 处理来自 StudioAgent 的更新（如"第15章改变了角色X的等级"）
 */

import {
  db,
  settingItems,
  projectScales,
  chapters,
} from "@narrative-os/database";
import { eq, and, sql, ilike, inArray } from "drizzle-orm";
import {
  queryWorldSetting,
  type QueryWorldSettingParams,
  type QueryResultItem,
} from "@narrative-os/engines";
import { EngineScheduler } from "@narrative-os/pipeline";
import type {
  WorldAgentRequest,
  WorldAgentResponse,
  WorldAgentQuery,
  WorldAgentUpdate,
  WorldAgentRefine,
  ImpactAnalysisResult,
} from "./types";
import {
  recordSettingVersion,
  analyzeSettingImpact,
  trackerBus,
} from "./tracker";
import { buildWorldAgentSystemPrompt } from "./prompts";

export class WorldAgent {
  private scheduler?: EngineScheduler;
  private systemPrompt?: string;

  constructor(opts?: { scheduler?: EngineScheduler }) {
    this.scheduler = opts?.scheduler;
  }

  /**
   * 主入口：处理来自 StudioAgent 的请求
   */
  async handle(request: WorldAgentRequest): Promise<WorldAgentResponse> {
    try {
      switch (request.type) {
        case "query":
          return await this.handleQuery(request.projectId, request.query);
        case "update":
          return await this.handleUpdate(request.projectId, request.update);
        case "refine":
          return await this.handleRefine(request.projectId, request.refine);
        case "get_possibilities":
          return await this.handleGetPossibilities(request.projectId, request.query);
        default:
          return { type: "error", error: `Unknown request type: ${(request as any).type}` };
      }
    } catch (err: any) {
      console.error(`[WorldAgent] Error handling ${request.type}:`, err.message);
      return { type: "error", error: err.message };
    }
  }

  // ── Query Handling ──

  private async handleQuery(
    projectId: string,
    query?: WorldAgentQuery
  ): Promise<WorldAgentResponse> {
    if (!query) {
      return { type: "error", error: "Query parameters required" };
    }

    // 优先使用结构化筛选
    const params = this.buildQueryParams(query);
    const result = await queryWorldSetting(projectId, params);

    // 如果查询包含章节上下文，且章节有 world_snapshot，同时查询快照
    if (query.context?.chapterId) {
      const chapter = await db
        .select({ worldSnapshot: chapters.worldSnapshot })
        .from(chapters)
        .where(and(eq(chapters.id, query.context.chapterId), eq(chapters.projectId, projectId)));

      if (chapter[0]?.worldSnapshot) {
        const snapshotResult = await queryWorldSetting(projectId, {
          ...params,
          snapshotChapterId: query.context.chapterId,
        });
        // 合并结果：优先使用实时数据，快照作为补充
        const liveIds = new Set(result.items.map((i) => i.id));
        const mergedItems = [
          ...result.items,
          ...snapshotResult.items.filter((i) => !liveIds.has(i.id)),
        ];
        return { type: "data", data: mergedItems };
      }
    }

    return { type: "data", data: result.items };
  }

  /**
   * 将 WorldAgentQuery 转换为底层 queryWorldSetting 参数
   */
  private buildQueryParams(query: WorldAgentQuery): QueryWorldSettingParams {
    const params: QueryWorldSettingParams = {
      limit: 50,
      includeRelations: true,
    };

    if (query.filters) {
      if (query.filters.engine) params.engine = query.filters.engine;
      if (query.filters.type) params.type = query.filters.type;
      if (query.filters.subtype) params.subtype = query.filters.subtype;
      if (query.filters.name) params.name = query.filters.name;
      if (query.filters.keyword) params.keyword = query.filters.keyword;
      if (query.filters.ids) params.ids = query.filters.ids;
    }

    // 自然语言意图解析兜底：从 query.what 中提取关键词
    if (query.what && !params.keyword) {
      // 简单启发式：如果 what 较短，当作 name 搜索
      if (query.what.length <= 20) {
        params.name = query.what;
      } else {
        params.keyword = query.what;
      }
    }

    return params;
  }

  // ── Update Handling ──

  private async handleUpdate(
    projectId: string,
    update?: WorldAgentUpdate
  ): Promise<WorldAgentResponse> {
    if (!update) {
      return { type: "error", error: "Update parameters required" };
    }

    // 1. 验证 setting_item 存在且属于该项目
    const [item] = await db
      .select({ id: settingItems.id, name: settingItems.name, content: settingItems.content })
      .from(settingItems)
      .where(
        and(
          eq(settingItems.id, update.settingItemId),
          eq(settingItems.projectId, projectId)
        )
      );

    if (!item) {
      return { type: "error", error: `Setting item ${update.settingItemId} not found in project ${projectId}` };
    }

    // 2. 记录版本快照（变更前）
    await recordSettingVersion(update.settingItemId, {
      changedBy: update.sourceChapterId ? `chapter:${update.sourceChapterId}` : "studio-agent",
      changeReason: update.reason,
    });

    // 3. 应用变更（深度合并 content）
    const currentContent = (item.content || {}) as Record<string, unknown>;
    const mergedContent = { ...currentContent, ...update.changes };

    await db
      .update(settingItems)
      .set({
        content: mergedContent,
        updatedAt: new Date(),
      })
      .where(eq(settingItems.id, update.settingItemId));

    // 4. 影响分析
    const impact = await analyzeSettingImpact(projectId, update.settingItemId);

    // 5. 发布追踪事件
    trackerBus.emit({
      type: "impact_detected",
      projectId,
      settingItemId: update.settingItemId,
      affectedChapters: impact.directReferences,
    });

    return {
      type: "ack",
      affectedChapters: impact.directReferences,
    };
  }

  // ── Refine Handling ──

  private async handleRefine(
    projectId: string,
    refine?: WorldAgentRefine
  ): Promise<WorldAgentResponse> {
    if (!refine) {
      return { type: "error", error: "Refine parameters required" };
    }

    // 使用 scheduler 的 refineItem 方法触发细化
    if (!this.scheduler) {
      // 无 scheduler 时创建临时实例（仅用于细化）
      this.scheduler = new EngineScheduler();
    }

    const proposalIds = await this.scheduler.refineItem(projectId, refine.parentItemId);

    if (proposalIds.length === 0) {
      return {
        type: "ack",
        error: "No proposals generated for refinement. Item may already be at finest scale.",
      };
    }

    return {
      type: "ack",
      // 细化产生的是待审批提案，不直接返回 affectedChapters
      affectedChapters: [],
    };
  }

  // ── Possibilities Handling ──

  private async handleGetPossibilities(
    projectId: string,
    query?: WorldAgentQuery
  ): Promise<WorldAgentResponse> {
    if (!query) {
      return { type: "error", error: "Query parameters required" };
    }

    // 1. 先获取基础数据
    const baseResult = await this.handleQuery(projectId, query);
    if (baseResult.type === "error" || !baseResult.data) {
      return baseResult;
    }

    const baseItems = baseResult.data;

    // 2. 基于基础数据生成可能性
    // 当前实现：基于查询条件和已有数据，生成结构化的可能性列表
    // 未来可接入 LLM 进行更智能的可能性探索
    const possibilities = await this.generatePossibilities(projectId, query, baseItems);

    return {
      type: "possibilities",
      data: baseItems,
      possibilities,
    };
  }

  private async generatePossibilities(
    projectId: string,
    query: WorldAgentQuery,
    baseItems: QueryResultItem[]
  ): Promise<Array<{ item: QueryResultItem; confidence: number; reason: string }>> {
    const possibilities: Array<{ item: QueryResultItem; confidence: number; reason: string }> = [];

    // 策略1：如果查询的是角色，提供该角色在不同势力/等级下的可能性
    if (query.filters?.engine === "character" || query.filters?.type === "character") {
      for (const item of baseItems.slice(0, 3)) {
        const content = item.content || {};
        const faction = content.faction as string | undefined;
        const level = content.level as number | undefined;

        // 可能性：等级提升后的状态
        if (level !== undefined) {
          const leveledUp: QueryResultItem = {
            ...item,
            content: {
              ...content,
              level: level + 1,
              status: `${content.status || "正常"}（晋升后）`,
            },
          };
          possibilities.push({
            item: leveledUp,
            confidence: 0.6,
            reason: `基于当前等级 ${level}，晋升一级后的合理推演`,
          });
        }

        // 可能性：加入对立势力
        if (faction) {
          const rivalFaction = await this.findRivalFaction(projectId, faction);
          if (rivalFaction) {
            const switched: QueryResultItem = {
              ...item,
              content: {
                ...content,
                faction: rivalFaction,
                allegiance: "叛变/卧底",
              },
            };
            possibilities.push({
              item: switched,
              confidence: 0.3,
              reason: `叙事冲突需要：角色转投对立势力 ${rivalFaction} 的可能性`,
            });
          }
        }
      }
    }

    // 策略2：如果查询的是地点，提供子尺度细化后的可能性
    if (query.filters?.engine === "geography" || query.filters?.type === "geography") {
      for (const item of baseItems.slice(0, 2)) {
        const content = item.content || {};
        const scale = content.scale as string | undefined;

        if (scale) {
          const childScales = await db
            .select({ key: projectScales.key, label: projectScales.label })
            .from(projectScales)
            .where(
              and(
                eq(projectScales.projectId, projectId),
                eq(projectScales.parentKey, scale)
              )
            );

          for (const child of childScales.slice(0, 2)) {
            const refined: QueryResultItem = {
              ...item,
              id: `${item.id}::possibility::${child.key}`,
              name: `${item.name}·${child.label}层级`,
              summary: `${item.summary}（${child.label}尺度下的细化可能性）`,
              content: {
                ...content,
                scale: child.key,
                _possibilityNote: `这是 ${child.label} 尺度下的推演数据，非已确认设定`,
              },
            };
            possibilities.push({
              item: refined,
              confidence: 0.5,
              reason: `基于项目尺度体系，${scale} → ${child.key} 的细化方向`,
            });
          }
        }
      }
    }

    // 策略3：通用 —— 基于关系网络的关联可能性
    if (possibilities.length === 0 && baseItems.length > 0) {
      const itemIds = baseItems.map((i) => i.id);
      const related = await db
        .select({
          sourceItemId: settingItems.id,
          sourceName: settingItems.name,
          targetItemId: settingItems.id,
          targetName: settingItems.name,
        })
        .from(settingItems)
        .where(
          and(
            eq(settingItems.projectId, projectId),
            sql`${settingItems.parentItemId} = ANY(${sql`ARRAY[${sql.join(itemIds.map((id) => sql`${id}`), sql`, `)}]`})`
          )
        );

      // 简化：返回一个"存在关联子条目"的提示性可能性
      if (related.length > 0) {
        possibilities.push({
          item: {
            ...baseItems[0],
            id: `${baseItems[0].id}::related`,
            name: `${baseItems[0].name}（含关联数据）`,
            summary: `存在 ${related.length} 个关联子条目，可能提供额外上下文`,
            content: {
              ...baseItems[0].content,
              _relatedCount: related.length,
            },
          },
          confidence: 0.8,
          reason: `数据库中存在直接关联的子条目，建议进一步查询`,
        });
      }
    }

    return possibilities;
  }

  private async findRivalFaction(
    projectId: string,
    factionName: string
  ): Promise<string | null> {
    const factions = await db
      .select({ name: settingItems.name })
      .from(settingItems)
      .where(
        and(
          eq(settingItems.projectId, projectId),
          eq(settingItems.engineSource, "faction"),
          eq(settingItems.status, "confirmed"),
          sql`${settingItems.name} != ${factionName}`
        )
      )
      .limit(5);

    return factions[0]?.name || null;
  }

  // ── 辅助 API ──

  /**
   * 获取项目当前的所有已确认设定条目概况（用于初始化系统提示）
   */
  async getProjectSettingOverview(projectId: string): Promise<{
    totalItems: number;
    byEngine: Record<string, number>;
    scales: Array<{ key: string; label: string }>;
  }> {
    const items = await db
      .select({ engineSource: settingItems.engineSource })
      .from(settingItems)
      .where(
        and(
          eq(settingItems.projectId, projectId),
          eq(settingItems.status, "confirmed")
        )
      );

    const byEngine: Record<string, number> = {};
    for (const item of items) {
      const key = item.engineSource || "unknown";
      byEngine[key] = (byEngine[key] || 0) + 1;
    }

    const scales = await db
      .select({ key: projectScales.key, label: projectScales.label })
      .from(projectScales)
      .where(eq(projectScales.projectId, projectId))
      .orderBy(projectScales.sortOrder);

    return {
      totalItems: items.length,
      byEngine,
      scales: scales.length > 0 ? scales : [],
    };
  }

  /**
   * 获取某设定条目的完整上下文（含父级、子级、关系）
   */
  async getItemFullContext(
    projectId: string,
    itemId: string
  ): Promise<{
    item: QueryResultItem | null;
    parent: QueryResultItem | null;
    children: QueryResultItem[];
    relations: Array<{ targetName: string; relationType: string; label: string }>;
  }> {
    const [item] = await db
      .select()
      .from(settingItems)
      .where(
        and(
          eq(settingItems.id, itemId),
          eq(settingItems.projectId, projectId)
        )
      );

    if (!item) {
      return { item: null, parent: null, children: [], relations: [] };
    }

    const formattedItem: QueryResultItem = {
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
    };

    // 父级
    let parent: QueryResultItem | null = null;
    if (item.parentItemId) {
      const [parentRow] = await db
        .select()
        .from(settingItems)
        .where(eq(settingItems.id, item.parentItemId));
      if (parentRow) {
        parent = {
          id: parentRow.id,
          type: parentRow.type,
          name: parentRow.name,
          summary: parentRow.summary || "",
          content: (parentRow.content || {}) as Record<string, unknown>,
          tags: parentRow.tags as string[] | null,
          engineSource: parentRow.engineSource,
          itemSubtype: parentRow.itemSubtype,
          parentItemId: parentRow.parentItemId,
          createdAt: parentRow.createdAt instanceof Date ? parentRow.createdAt.toISOString() : String(parentRow.createdAt || ""),
        };
      }
    }

    // 子级
    const childrenRows = await db
      .select()
      .from(settingItems)
      .where(
        and(
          eq(settingItems.projectId, projectId),
          eq(settingItems.parentItemId, itemId),
          eq(settingItems.status, "confirmed")
        )
      );

    const children: QueryResultItem[] = childrenRows.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      summary: c.summary || "",
      content: (c.content || {}) as Record<string, unknown>,
      tags: c.tags as string[] | null,
      engineSource: c.engineSource,
      itemSubtype: c.itemSubtype,
      parentItemId: c.parentItemId,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt || ""),
    }));

    // 关系
    const { settingItemRelations } = await import("@narrative-os/database");
    const relRows = await db
      .select()
      .from(settingItemRelations)
      .where(
        and(
          eq(settingItemRelations.projectId, projectId),
          sql`(${eq(settingItemRelations.sourceItemId, itemId)} OR ${eq(settingItemRelations.targetItemId, itemId)})`
        )
      );

    const relationTargetIds = relRows
      .map((r) => (r.sourceItemId === itemId ? r.targetItemId : r.sourceItemId))
      .filter((id): id is string => !!id);

    const targetNames = await db
      .select({ id: settingItems.id, name: settingItems.name })
      .from(settingItems)
      .where(inArray(settingItems.id, relationTargetIds));

    const nameMap = new Map(targetNames.map((t) => [t.id, t.name]));

    const relations = relRows.map((r) => ({
      targetName: nameMap.get(r.sourceItemId === itemId ? r.targetItemId : r.sourceItemId) || "?",
      relationType: r.relationType,
      label: r.label || "",
    }));

    return { item: formattedItem, parent, children, relations };
  }

  /**
   * 批量更新多个设定条目（用于 StudioAgent 的章节完成反馈）
   */
  async batchUpdate(
    projectId: string,
    updates: Array<{
      settingItemId: string;
      changes: Record<string, unknown>;
      reason: string;
      sourceChapterId?: string;
    }>
  ): Promise<WorldAgentResponse> {
    const allAffectedChapters = new Set<string>();

    for (const update of updates) {
      const res = await this.handleUpdate(projectId, update);
      if (res.affectedChapters) {
        for (const ch of res.affectedChapters) {
          allAffectedChapters.add(ch);
        }
      }
    }

    return {
      type: "ack",
      affectedChapters: Array.from(allAffectedChapters),
    };
  }

  /**
   * 获取系统提示（供 LLM 驱动的扩展功能使用）
   */
  async getSystemPrompt(projectId: string): Promise<string> {
    if (this.systemPrompt) return this.systemPrompt;

    const overview = await this.getProjectSettingOverview(projectId);
    this.systemPrompt = buildWorldAgentSystemPrompt({
      engineCount: overview.totalItems,
    });

    return this.systemPrompt;
  }

  /**
   * 清除缓存（设定数据发生较大变化时调用）
   */
  invalidateCache(): void {
    this.systemPrompt = undefined;
  }
}
