/**
 * Agent Communication Layer — StudioAgent
 *
 * 写作工作室协调者：
 * - 维护当前写作进度（大纲、卷、章、场景）
 * - 向 WorldAgent 查询所需的世界设定数据
 * - 从 WorldAgent 返回的可能性中做选择决策
 * - 将写作结果反馈给 WorldAgent
 * - 检查写作内容与世界设定之间的一致性
 */

import {
  db,
  chapters,
  outlines,
  volumes,
  outlineItems,
  projects,
  settingItems,
} from "@narrative-os/database";
import { eq, and, asc, sql } from "drizzle-orm";
import type { QueryResultItem } from "@narrative-os/engines";
import type {
  WorldAgentRequest,
  WorldAgentResponse,
  StudioAgentState,
  StudioWorldQuery,
  ConsistencyCheckResult,
  WritingProgress,
} from "./types";
import {
  recordChapterSettingReference,
  recordChapterSettingReferences,
  extractSettingReferencesFromContent,
} from "./tracker";
import { buildStudioAgentSystemPrompt, buildConsistencyCheckPrompt } from "./prompts";
import { WorldAgent } from "./world-agent";

export class StudioAgent {
  private worldAgent: WorldAgent;
  private stateCache = new Map<string, StudioAgentState>();

  constructor(worldAgent: WorldAgent) {
    this.worldAgent = worldAgent;
  }

  // ── 状态管理 ──

  /**
   * 获取或初始化项目的 StudioAgent 状态
   */
  async getState(projectId: string): Promise<StudioAgentState> {
    if (this.stateCache.has(projectId)) {
      return this.stateCache.get(projectId)!;
    }

    const state = await this.loadStateFromDb(projectId);
    this.stateCache.set(projectId, state);
    return state;
  }

  /**
   * 设置当前写作焦点（当前卷/章）
   */
  async setFocus(
    projectId: string,
    focus: { outlineId?: string; volumeId?: string; chapterId?: string }
  ): Promise<void> {
    const state = await this.getState(projectId);
    if (focus.outlineId) state.currentOutlineId = focus.outlineId;
    if (focus.volumeId) state.currentVolumeId = focus.volumeId;
    if (focus.chapterId) state.currentChapterId = focus.chapterId;
    this.stateCache.set(projectId, state);
  }

  private async loadStateFromDb(projectId: string): Promise<StudioAgentState> {
    const [project] = await db
      .select({
        totalWords: projects.totalWords,
        totalChapters: projects.totalChapters,
        targetWords: projects.targetWords,
        targetChapterCount: projects.targetChapterCount,
        latestChapterId: projects.latestChapterId,
        latestVolumeId: projects.latestVolumeId,
      })
      .from(projects)
      .where(eq(projects.id, projectId));

    // 查找当前激活的大纲
    const [currentOutline] = await db
      .select({ id: outlines.id })
      .from(outlines)
      .where(
        and(
          eq(outlines.projectId, projectId),
          eq(outlines.isCurrent, true)
        )
      )
      .limit(1);

    // 查找最新卷
    const [latestVolume] = await db
      .select({ id: volumes.id })
      .from(volumes)
      .where(eq(volumes.projectId, projectId))
      .orderBy(asc(volumes.volumeNumber))
      .limit(1);

    // 查找最新章节
    const [latestChapter] = await db
      .select({ id: chapters.id })
      .from(chapters)
      .where(eq(chapters.projectId, projectId))
      .orderBy(asc(chapters.chapterNumber))
      .limit(1);

    return {
      projectId,
      currentOutlineId: currentOutline?.id,
      currentVolumeId: latestVolume?.id || project?.latestVolumeId || undefined,
      currentChapterId: latestChapter?.id || project?.latestChapterId || undefined,
      writingProgress: {
        totalChapters: project?.totalChapters || 0,
        completedChapters: project?.totalChapters || 0, // 简化：已创建的章节视为已完成
        currentVolume: latestVolume ? await this.getVolumeNumber(latestVolume.id) : 1,
        currentChapterNumber: latestChapter?.id
          ? await this.getChapterNumber(latestChapter.id)
          : 0,
        wordsWritten: project?.totalWords || 0,
        wordsTarget: project?.targetWords || 0,
      },
    };
  }

  private async getVolumeNumber(volumeId: string): Promise<number> {
    const [vol] = await db
      .select({ volumeNumber: volumes.volumeNumber })
      .from(volumes)
      .where(eq(volumes.id, volumeId));
    return vol?.volumeNumber || 1;
  }

  private async getChapterNumber(chapterId: string): Promise<number> {
    const [ch] = await db
      .select({ chapterNumber: chapters.chapterNumber })
      .from(chapters)
      .where(eq(chapters.id, chapterId));
    return ch?.chapterNumber || 0;
  }

  // ── WorldAgent 查询接口 ──

  /**
   * StudioAgent 向 WorldAgent 发起查询
   */
  async queryWorld(
    projectId: string,
    query: StudioWorldQuery
  ): Promise<WorldAgentResponse> {
    const state = await this.getState(projectId);

    const request: WorldAgentRequest = {
      type: "query",
      projectId,
      query: {
        what: query.target || query.intent,
        context: {
          chapterId: query.context?.chapterId || state.currentChapterId,
          scene: query.context?.scene,
        },
        filters: this.inferFiltersFromIntent(query.intent, query.target),
      },
    };

    return this.worldAgent.handle(request);
  }

  /**
   * 获取角色详情（便捷方法）
   */
  async getCharacterDetail(
    projectId: string,
    characterNameOrId: string,
    chapterId?: string
  ): Promise<QueryResultItem[]> {
    const res = await this.queryWorld(projectId, {
      intent: "character_detail",
      target: characterNameOrId,
      context: { chapterId },
    });
    return res.data || [];
  }

  /**
   * 获取地点详情（便捷方法）
   */
  async getLocationDetail(
    projectId: string,
    locationNameOrId: string,
    chapterId?: string
  ): Promise<QueryResultItem[]> {
    const res = await this.queryWorld(projectId, {
      intent: "location_detail",
      target: locationNameOrId,
      context: { chapterId },
    });
    return res.data || [];
  }

  /**
   * 检查力量体系一致性（便捷方法）
   */
  async checkPowerSystem(
    projectId: string,
    characterId: string,
    expectedLevel?: number
  ): Promise<WorldAgentResponse> {
    const res = await this.queryWorld(projectId, {
      intent: "power_system_check",
      target: characterId,
    });

    if (!res.data || res.data.length === 0) {
      return { type: "data", data: [] };
    }

    // 如果提供了 expectedLevel，进行简单的一致性校验
    if (expectedLevel !== undefined) {
      const character = res.data[0];
      const currentLevel = (character.content?.level as number) ?? 0;
      if (currentLevel !== expectedLevel) {
        return {
          type: "data",
          data: res.data,
          error: `Power level mismatch: expected ${expectedLevel}, actual ${currentLevel}`,
        };
      }
    }

    return res;
  }

  /**
   * 获取可能性列表（用于决策支持）
   */
  async getPossibilities(
    projectId: string,
    query: StudioWorldQuery
  ): Promise<WorldAgentResponse> {
    const state = await this.getState(projectId);

    const request: WorldAgentRequest = {
      type: "get_possibilities",
      projectId,
      query: {
        what: query.target || query.intent,
        context: {
          chapterId: query.context?.chapterId || state.currentChapterId,
          scene: query.context?.scene,
        },
        filters: this.inferFiltersFromIntent(query.intent, query.target),
      },
    };

    return this.worldAgent.handle(request);
  }

  // ── 选择决策 ──

  /**
   * 从 WorldAgent 返回的可能性中做选择。
   * 当前实现基于简单规则；未来可接入 LLM 进行更智能的决策。
   */
  async selectFromPossibilities(
    _projectId: string,
    possibilities: Array<{ item: QueryResultItem; confidence: number; reason: string }>,
    criteria?: {
      preferHigherConfidence?: boolean;
      targetName?: string;
      maxResults?: number;
    }
  ): Promise<QueryResultItem[]> {
    let scored = possibilities.map((p) => ({
      ...p,
      score: p.confidence,
    }));

    // 按置信度排序（默认）
    if (criteria?.preferHigherConfidence !== false) {
      scored = scored.sort((a, b) => b.score - a.score);
    }

    // 名称匹配加分
    if (criteria?.targetName) {
      const target = criteria.targetName.toLowerCase();
      scored = scored.map((s) => ({
        ...s,
        score: s.score + (s.item.name.toLowerCase().includes(target) ? 0.2 : 0),
      }));
      scored = scored.sort((a, b) => b.score - a.score);
    }

    const maxResults = criteria?.maxResults || 3;
    return scored.slice(0, maxResults).map((s) => s.item);
  }

  // ── 写作结果反馈 ──

  /**
   * 章节完成后，将写作结果反馈给 WorldAgent。
   * 包括：设定引用记录、设定变更上报。
   */
  async onChapterCompleted(
    projectId: string,
    chapterId: string,
    opts?: {
      content?: string;
      settingChanges?: Array<{
        settingItemId: string;
        changes: Record<string, unknown>;
        reason: string;
      }>;
    }
  ): Promise<{
    referencesRecorded: number;
    updatesApplied: number;
    affectedChapters: string[];
  }> {
    let referencesRecorded = 0;
    let updatesApplied = 0;
    const allAffectedChapters = new Set<string>();

    // 1. 自动提取并记录设定引用
    if (opts?.content) {
      const extracted = await extractSettingReferencesFromContent(
        projectId,
        chapterId,
        opts.content
      );

      const refs = extracted.map((e) => ({
        settingItemId: e.settingItemId,
        referenceType: "direct" as const,
      }));

      await recordChapterSettingReferences(chapterId, refs);
      referencesRecorded = refs.length;
    }

    // 2. 应用设定变更
    if (opts?.settingChanges && opts.settingChanges.length > 0) {
      for (const change of opts.settingChanges) {
        const res = await this.worldAgent.handle({
          type: "update",
          projectId,
          update: {
            settingItemId: change.settingItemId,
            changes: change.changes,
            reason: change.reason,
            sourceChapterId: chapterId,
          },
        });

        if (res.type === "ack") {
          updatesApplied++;
          if (res.affectedChapters) {
            for (const ch of res.affectedChapters) {
              allAffectedChapters.add(ch);
            }
          }
        }
      }
    }

    // 3. 更新项目统计
    await this.refreshProjectStats(projectId);

    return {
      referencesRecorded,
      updatesApplied,
      affectedChapters: Array.from(allAffectedChapters),
    };
  }

  /**
   * 手动上报章节引用的设定（当自动提取不够精确时使用）
   */
  async reportChapterReferences(
    chapterId: string,
    references: Array<{
      settingItemId: string;
      referenceType?: "direct" | "mentioned" | "background";
      contextQuote?: string;
    }>
  ): Promise<void> {
    await recordChapterSettingReferences(chapterId, references);
  }

  // ── 一致性检查 ──

  /**
   * 检查写作内容与世界设定的一致性。
   * 返回发现的冲突列表。
   */
  async checkConsistency(
    projectId: string,
    content: string,
    opts?: {
      chapterId?: string;
      checkCharacters?: boolean;
      checkLocations?: boolean;
      checkPowerSystem?: boolean;
    }
  ): Promise<ConsistencyCheckResult> {
    const conflicts: ConsistencyCheckResult["conflicts"] = [];

    // 1. 自动提取内容中引用的设定
    const chapterId = opts?.chapterId;
    const extracted = await extractSettingReferencesFromContent(
      projectId,
      chapterId || "",
      content
    );

    for (const ref of extracted) {
      const [item] = await db
        .select({ id: settingItems.id, name: settingItems.name, content: settingItems.content })
        .from(settingItems)
        .where(eq(settingItems.id, ref.settingItemId));

      if (!item) continue;

      const itemContent = (item.content || {}) as Record<string, unknown>;

      // 检查角色能力/等级一致性
      if (opts?.checkCharacters !== false && (itemContent.level !== undefined || itemContent.power !== undefined)) {
        const level = itemContent.level as number | undefined;
        const power = itemContent.power as string | undefined;

        // 简单启发式：检查内容中是否包含与设定不符的等级描述
        // 更复杂的检查可接入 LLM
        if (level !== undefined) {
          const levelPattern = new RegExp(`(?:境界|等级|修为).{0,5}(?!${level})\\d+`);
          if (levelPattern.test(content)) {
            conflicts.push({
              severity: "warning",
              settingItemId: item.id,
              settingName: item.name,
              message: `内容中可能包含与设定不符的等级描述（设定等级：${level}）`,
              suggestion: `请确认角色 ${item.name} 的当前等级仍为 ${level}，或向 WorldAgent 申请更新设定`,
            });
          }
        }
      }

      // 检查地点一致性
      if (opts?.checkLocations !== false && itemContent.coordinates) {
        const coords = itemContent.coordinates as { x: number; y: number };
        // 启发式：如果内容中提到了坐标相关描述，可进一步检查
        if (content.includes("坐标") || content.includes("方位")) {
          conflicts.push({
            severity: "info",
            settingItemId: item.id,
            settingName: item.name,
            message: `内容涉及地点 ${item.name} 的方位/坐标描述，请确认与设定坐标 (${coords.x}, ${coords.y}) 一致`,
          });
        }
      }
    }

    // 2. 如果提供了 chapterId，检查章节的 world_snapshot 是否与当前设定有差异
    if (chapterId) {
      const [chapter] = await db
        .select({ worldSnapshot: chapters.worldSnapshot })
        .from(chapters)
        .where(and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId)));

      if (chapter?.worldSnapshot) {
        const snapshot = chapter.worldSnapshot as {
          items?: Array<{ id: string; name: string; content?: Record<string, unknown> }>;
          takenAt?: string;
        };

        if (snapshot.items) {
          for (const snapItem of snapshot.items.slice(0, 20)) {
            const [current] = await db
              .select({ content: settingItems.content })
              .from(settingItems)
              .where(eq(settingItems.id, snapItem.id));

            if (current) {
              const currentContent = JSON.stringify(current.content || {});
              const snapContent = JSON.stringify(snapItem.content || {});
              if (currentContent !== snapContent) {
                conflicts.push({
                  severity: "warning",
                  settingItemId: snapItem.id,
                  settingName: snapItem.name,
                  message: `该章节的 world_snapshot 中 ${snapItem.name} 的数据与当前设定不一致（可能在章节写作期间设定被更新）`,
                  suggestion: "考虑申请 retcon 或在章节中解释设定变化的原因",
                });
              }
            }
          }
        }
      }
    }

    return {
      passed: conflicts.filter((c) => c.severity === "error").length === 0,
      conflicts,
    };
  }

  // ── 大纲/卷/章 辅助 API ──

  /**
   * 获取当前大纲的完整结构
   */
  async getOutlineStructure(projectId: string): Promise<{
    outline: typeof outlines.$inferSelect | null;
    volumes: Array<typeof volumes.$inferSelect>;
    outlineItems: Array<typeof outlineItems.$inferSelect>;
  }> {
    const [outline] = await db
      .select()
      .from(outlines)
      .where(
        and(
          eq(outlines.projectId, projectId),
          eq(outlines.isCurrent, true)
        )
      )
      .limit(1);

    if (!outline) {
      return { outline: null, volumes: [], outlineItems: [] };
    }

    const vols = await db
      .select()
      .from(volumes)
      .where(eq(volumes.projectId, projectId))
      .orderBy(asc(volumes.volumeNumber));

    const items = await db
      .select()
      .from(outlineItems)
      .where(eq(outlineItems.outlineId, outline.id))
      .orderBy(asc(outlineItems.sortOrder));

    return { outline, volumes: vols, outlineItems: items };
  }

  /**
   * 获取章节的完整上下文（含前后章、所属卷、大纲条目）
   */
  async getChapterContext(projectId: string, chapterId: string): Promise<{
    chapter: typeof chapters.$inferSelect | null;
    volume: typeof volumes.$inferSelect | null;
    outlineItem: typeof outlineItems.$inferSelect | null;
    prevChapter: typeof chapters.$inferSelect | null;
    nextChapter: typeof chapters.$inferSelect | null;
  }> {
    const [chapter] = await db
      .select()
      .from(chapters)
      .where(and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId)));

    if (!chapter) {
      return {
        chapter: null,
        volume: null,
        outlineItem: null,
        prevChapter: null,
        nextChapter: null,
      };
    }

    const [volume] = chapter.volumeId
      ? await db
          .select()
          .from(volumes)
          .where(eq(volumes.id, chapter.volumeId))
      : [null];

    const [outlineItem] = await db
      .select()
      .from(outlineItems)
      .where(eq(outlineItems.linkedChapterId, chapterId))
      .limit(1);

    const [prevChapter] = await db
      .select()
      .from(chapters)
      .where(
        and(
          eq(chapters.projectId, projectId),
          sql`${chapters.chapterNumber} = ${(chapter.chapterNumber || 1) - 1}`
        )
      )
      .limit(1);

    const [nextChapter] = await db
      .select()
      .from(chapters)
      .where(
        and(
          eq(chapters.projectId, projectId),
          sql`${chapters.chapterNumber} = ${(chapter.chapterNumber || 0) + 1}`
        )
      )
      .limit(1);

    return { chapter, volume, outlineItem, prevChapter, nextChapter };
  }

  // ── 系统提示 ──

  async getSystemPrompt(projectId: string): Promise<string> {
    const state = await this.getState(projectId);
    const [project] = await db
      .select({ title: projects.title, genre: projects.genre })
      .from(projects)
      .where(eq(projects.id, projectId));

    return buildStudioAgentSystemPrompt({
      projectTitle: project?.title || undefined,
      genre: project?.genre || undefined,
      currentVolume: state.writingProgress.currentVolume,
      currentChapter: state.writingProgress.currentChapterNumber,
    });
  }

  // ── 内部辅助 ──

  private inferFiltersFromIntent(
    intent: StudioWorldQuery["intent"],
    target?: string
  ): NonNullable<WorldAgentRequest["query"]>["filters"] {
    const filters: NonNullable<WorldAgentRequest["query"]>["filters"] = {};

    switch (intent) {
      case "character_detail":
        filters.engine = "character";
        filters.type = "character";
        if (target) filters.name = target;
        break;
      case "location_detail":
        filters.engine = "geography";
        filters.type = "geography";
        if (target) filters.name = target;
        break;
      case "power_system_check":
        filters.engine = "power-system";
        filters.type = "power_system";
        if (target) filters.name = target;
        break;
      case "faction_status":
        filters.engine = "faction";
        filters.type = "faction";
        if (target) filters.name = target;
        break;
      case "item_lookup":
        filters.engine = "item-system";
        filters.type = "item_system";
        if (target) filters.name = target;
        break;
      case "relationship_map":
        filters.engine = "character";
        filters.type = "character";
        break;
      case "timeline_query":
        filters.engine = "history";
        filters.type = "history";
        break;
      case "consistency_check":
        // consistency_check 不过滤特定引擎，需要多引擎数据
        break;
      case "custom":
      default:
        if (target) filters.keyword = target;
        break;
    }

    return filters;
  }

  private async refreshProjectStats(projectId: string): Promise<void> {
    // 重新计算项目统计
    const chapterStats = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalWords: sql<number>`coalesce(sum(${chapters.actualWords}), 0)::int`,
        maxNumber: sql<number>`coalesce(max(${chapters.chapterNumber}), 0)::int`,
      })
      .from(chapters)
      .where(eq(chapters.projectId, projectId));

    const stats = chapterStats[0];
    if (!stats) return;

    await db
      .update(projects)
      .set({
        totalChapters: stats.count,
        totalWords: stats.totalWords,
        latestChapterNumber: stats.maxNumber,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));
  }

  /**
   * 清除状态缓存（设定或大纲发生较大变化时调用）
   */
  invalidateCache(projectId?: string): void {
    if (projectId) {
      this.stateCache.delete(projectId);
    } else {
      this.stateCache.clear();
    }
    this.worldAgent.invalidateCache();
  }
}
