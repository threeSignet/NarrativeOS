/**
 * Agent Communication Layer — Tracker
 *
 * 追踪系统职责：
 * 1. 自动记录 chapter_setting_references（章节对设定的引用）
 * 2. 记录 setting_item_versions（设定变更版本历史）
 * 3. 提供影响分析：某设定变更会影响哪些章节
 * 4. 提供版本对比
 */

import {
  db,
  chapters,
  settingItems,
  chapterSettingReferences,
  settingItemVersions,
  settingItemRelations,
} from "@narrative-os/database";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import type { QueryResultItem } from "@narrative-os/engines";
import type { TrackerEvent, ImpactAnalysisResult } from "./types";

// ── 章节设定引用追踪 ──

/**
 * 记录章节对设定条目的引用关系。
 * 当 StudioAgent 完成一章写作时调用，自动建立追踪记录。
 */
export async function recordChapterSettingReference(
  chapterId: string,
  settingItemId: string,
  opts?: {
    referenceType?: "direct" | "mentioned" | "background";
    contextQuote?: string;
  }
): Promise<void> {
  const referenceType = opts?.referenceType || "direct";
  const contextQuote = opts?.contextQuote;

  // 幂等：如果已存在相同引用则跳过
  const existing = await db
    .select({ id: chapterSettingReferences.id })
    .from(chapterSettingReferences)
    .where(
      and(
        eq(chapterSettingReferences.chapterId, chapterId),
        eq(chapterSettingReferences.settingItemId, settingItemId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  await db.insert(chapterSettingReferences).values({
    chapterId,
    settingItemId,
    referenceType,
    contextQuote: contextQuote || null,
  });
}

/**
 * 批量记录章节引用（用于章节完成后一次性上报）。
 */
export async function recordChapterSettingReferences(
  chapterId: string,
  references: Array<{
    settingItemId: string;
    referenceType?: "direct" | "mentioned" | "background";
    contextQuote?: string;
  }>
): Promise<void> {
  if (references.length === 0) return;

  // 查询已有引用，去重
  const existing = await db
    .select({ settingItemId: chapterSettingReferences.settingItemId })
    .from(chapterSettingReferences)
    .where(eq(chapterSettingReferences.chapterId, chapterId));

  const existingIds = new Set(existing.map((r) => r.settingItemId));
  const newRefs = references.filter((r) => !existingIds.has(r.settingItemId));

  if (newRefs.length === 0) return;

  await db.insert(chapterSettingReferences).values(
    newRefs.map((ref) => ({
      chapterId,
      settingItemId: ref.settingItemId,
      referenceType: ref.referenceType || "direct",
      contextQuote: ref.contextQuote || null,
    }))
  );
}

/**
 * 从章节内容中自动提取可能的设定引用（启发式匹配）。
 * 辅助 StudioAgent 发现应记录的引用关系。
 */
export async function extractSettingReferencesFromContent(
  projectId: string,
  _chapterId: string,
  content: string
): Promise<Array<{ settingItemId: string; name: string; confidence: number }>> {
  // 获取项目所有已确认设定条目的名称
  const items = await db
    .select({ id: settingItems.id, name: settingItems.name })
    .from(settingItems)
    .where(
      and(
        eq(settingItems.projectId, projectId),
        eq(settingItems.status, "confirmed")
      )
    );

  const results: Array<{ settingItemId: string; name: string; confidence: number }> = [];

  for (const item of items) {
    if (!item.name || item.name.length < 2) continue;
    // 简单启发式：名称在内容中出现
    // 更复杂的匹配可引入向量相似度或分词匹配
    const nameVariants = [item.name, item.name.replace(/[·\.\s]/g, "")];
    for (const variant of nameVariants) {
      if (content.includes(variant)) {
        // 置信度：完整匹配 > 部分匹配
        const confidence = content.includes(`「${variant}」`) || content.includes(`"${variant}"`) ? 0.9 : 0.7;
        results.push({ settingItemId: item.id, name: item.name, confidence });
        break;
      }
    }
  }

  // 按置信度降序
  return results.sort((a, b) => b.confidence - a.confidence);
}

// ── 设定版本追踪 ──

/**
 * 记录设定条目的版本快照。
 * 在 WorldAgent 处理 update 请求时自动调用。
 */
export async function recordSettingVersion(
  settingItemId: string,
  opts?: {
    changedBy?: string;
    changeReason?: string;
  }
): Promise<number> {
  // 获取当前最新版本号
  const latest = await db
    .select({ version: settingItemVersions.version })
    .from(settingItemVersions)
    .where(eq(settingItemVersions.settingItemId, settingItemId))
    .orderBy(desc(settingItemVersions.version))
    .limit(1);

  const nextVersion = (latest[0]?.version ?? 0) + 1;

  // 获取当前 setting_item 的 content
  const [item] = await db
    .select({ content: settingItems.content })
    .from(settingItems)
    .where(eq(settingItems.id, settingItemId));

  if (!item) {
    throw new Error(`Setting item ${settingItemId} not found`);
  }

  await db.insert(settingItemVersions).values({
    settingItemId,
    version: nextVersion,
    content: item.content || {},
    changedBy: opts?.changedBy || "world-agent",
    changeReason: opts?.changeReason || "",
  });

  return nextVersion;
}

/**
 * 获取某设定条目的版本历史。
 */
export async function getSettingVersionHistory(
  settingItemId: string,
  limit = 20
): Promise<
  Array<{
    version: number;
    changedBy: string | null;
    changeReason: string | null;
    createdAt: Date;
  }>
> {
  const rows = await db
    .select({
      version: settingItemVersions.version,
      changedBy: settingItemVersions.changedBy,
      changeReason: settingItemVersions.changeReason,
      createdAt: settingItemVersions.createdAt,
    })
    .from(settingItemVersions)
    .where(eq(settingItemVersions.settingItemId, settingItemId))
    .orderBy(desc(settingItemVersions.version))
    .limit(limit);

  return rows;
}

/**
 * 对比两个版本的设定内容差异。
 * 返回变更的字段路径和前后值。
 */
export async function compareSettingVersions(
  settingItemId: string,
  versionA: number,
  versionB: number
): Promise<
  Array<{
    path: string;
    oldValue: unknown;
    newValue: unknown;
  }>
> {
  const [rowA] = await db
    .select({ content: settingItemVersions.content })
    .from(settingItemVersions)
    .where(
      and(
        eq(settingItemVersions.settingItemId, settingItemId),
        eq(settingItemVersions.version, versionA)
      )
    );

  const [rowB] = await db
    .select({ content: settingItemVersions.content })
    .from(settingItemVersions)
    .where(
      and(
        eq(settingItemVersions.settingItemId, settingItemId),
        eq(settingItemVersions.version, versionB)
      )
    );

  if (!rowA || !rowB) {
    throw new Error(`Version ${versionA} or ${versionB} not found for item ${settingItemId}`);
  }

  const contentA = (rowA.content || {}) as Record<string, unknown>;
  const contentB = (rowB.content || {}) as Record<string, unknown>;

  return diffObjects(contentA, contentB);
}

// ── 影响分析 ──

/**
 * 分析某设定条目变更会影响哪些章节和引擎产出。
 * 这是 retcon（ retroactive continuity ）系统的核心功能。
 */
export async function analyzeSettingImpact(
  projectId: string,
  settingItemId: string
): Promise<ImpactAnalysisResult> {
  // 1. 获取设定条目基本信息
  const [item] = await db
    .select({ id: settingItems.id, name: settingItems.name })
    .from(settingItems)
    .where(
      and(
        eq(settingItems.id, settingItemId),
        eq(settingItems.projectId, projectId)
      )
    );

  if (!item) {
    return {
      settingItemId,
      settingName: "?",
      directReferences: [],
      indirectReferences: [],
      affectedEngineOutputs: [],
    };
  }

  // 2. 直接引用此设定的章节
  const directRefs = await db
    .select({ chapterId: chapterSettingReferences.chapterId })
    .from(chapterSettingReferences)
    .where(eq(chapterSettingReferences.settingItemId, settingItemId));

  const directChapterIds = directRefs.map((r) => r.chapterId);

  // 3. 间接引用：通过关系链关联的设定所被引用的章节
  const relations = await db
    .select({
      sourceItemId: settingItemRelations.sourceItemId,
      targetItemId: settingItemRelations.targetItemId,
    })
    .from(settingItemRelations)
    .where(
      and(
        eq(settingItemRelations.projectId, projectId),
        sql`(${eq(settingItemRelations.sourceItemId, settingItemId)} OR ${eq(settingItemRelations.targetItemId, settingItemId)})`
      )
    );

  const relatedItemIds = new Set<string>();
  for (const r of relations) {
    if (r.sourceItemId !== settingItemId) relatedItemIds.add(r.sourceItemId);
    if (r.targetItemId !== settingItemId) relatedItemIds.add(r.targetItemId);
  }

  let indirectChapterIds: string[] = [];
  if (relatedItemIds.size > 0) {
    const indirectRefs = await db
      .select({ chapterId: chapterSettingReferences.chapterId })
      .from(chapterSettingReferences)
      .where(inArray(chapterSettingReferences.settingItemId, Array.from(relatedItemIds)));

    indirectChapterIds = [...new Set(indirectRefs.map((r) => r.chapterId))].filter(
      (id) => !directChapterIds.includes(id)
    );
  }

  // 4. 可能受影响的引擎产出（相同 engineSource 的其他条目）
  const [itemDetail] = await db
    .select({ engineSource: settingItems.engineSource })
    .from(settingItems)
    .where(eq(settingItems.id, settingItemId));

  let affectedEngineOutputs: ImpactAnalysisResult["affectedEngineOutputs"] = [];
  if (itemDetail?.engineSource) {
    const relatedOutputs = await db
      .select({
        id: settingItems.id,
        name: settingItems.name,
        engineSource: settingItems.engineSource,
      })
      .from(settingItems)
      .where(
        and(
          eq(settingItems.projectId, projectId),
          eq(settingItems.engineSource, itemDetail.engineSource),
          sql`${settingItems.id} != ${settingItemId}`
        )
      )
      .limit(50);

    affectedEngineOutputs = relatedOutputs.map((o) => ({
      engineSource: o.engineSource || "unknown",
      itemId: o.id,
      itemName: o.name,
    }));
  }

  return {
    settingItemId,
    settingName: item.name,
    directReferences: directChapterIds,
    indirectReferences: indirectChapterIds,
    affectedEngineOutputs,
  };
}

/**
 * 获取所有引用了给定设定条目的章节详情。
 */
export async function getReferencingChapters(
  settingItemId: string
): Promise<
  Array<{
    chapterId: string;
    chapterNumber: number | null;
    title: string | null;
    referenceType: string;
    contextQuote: string | null;
  }>
> {
  const rows = await db
    .select({
      chapterId: chapterSettingReferences.chapterId,
      chapterNumber: chapters.chapterNumber,
      title: chapters.title,
      referenceType: chapterSettingReferences.referenceType,
      contextQuote: chapterSettingReferences.contextQuote,
    })
    .from(chapterSettingReferences)
    .innerJoin(chapters, eq(chapterSettingReferences.chapterId, chapters.id))
    .where(eq(chapterSettingReferences.settingItemId, settingItemId))
    .orderBy(chapters.chapterNumber);

  return rows;
}

// ── 辅助函数 ──

function diffObjects(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  prefix = ""
): Array<{ path: string; oldValue: unknown; newValue: unknown }> {
  const diffs: Array<{ path: string; oldValue: unknown; newValue: unknown }> = [];
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const valA = a[key];
    const valB = b[key];

    if (typeof valA === "object" && valA !== null && typeof valB === "object" && valB !== null) {
      diffs.push(...diffObjects(valA as Record<string, unknown>, valB as Record<string, unknown>, path));
    } else if (JSON.stringify(valA) !== JSON.stringify(valB)) {
      diffs.push({ path, oldValue: valA, newValue: valB });
    }
  }

  return diffs;
}

// ── Event emitter（可选，供外部监听追踪事件） ──

export class TrackerEventBus {
  private listeners: Array<(event: TrackerEvent) => void> = [];

  on(fn: (event: TrackerEvent) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  emit(event: TrackerEvent): void {
    for (const fn of this.listeners) {
      try {
        fn(event);
      } catch {
        // 忽略监听器错误，防止级联故障
      }
    }
  }
}

export const trackerBus = new TrackerEventBus();
