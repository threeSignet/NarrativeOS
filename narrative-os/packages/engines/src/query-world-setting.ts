/**
 * 统一世界设定数据查询 — 引擎/伴侣/写作引擎的唯一数据拉取入口
 *
 * 两个数据源，一个接口：
 * - snapshotChapterId 为空 → 查询 setting_items 表（孵化引擎、伴侣使用，实时数据）
 * - snapshotChapterId 有值 → 查询 chapters.world_snapshot JSONB 字段（写作引擎使用，冻结快照）
 *
 * 设计原则：
 * - 上层统一抽象：所有需要世界观数据的调用方通过此函数查询
 * - 自动扩展：新增引擎无需修改此文件，筛选条件（engine/type/subtype）自动适配
 * - 项目隔离：所有查询强制限定 projectId，无法跨项目访问
 */
import { db, settingItems, settingItemRelations, chapters } from "@narrative-os/database";
import { eq, and, or, ilike, inArray, sql } from "drizzle-orm";

// ── 查询参数 ──

export interface QueryWorldSettingParams {
  /** 按引擎名筛选，如 "character"、"geography" */
  engine?: string;
  /** 按设定类型筛选，如 "character"、"power_system" */
  type?: string;
  /** 按名称搜索（不区分大小写的部分匹配） */
  name?: string;
  /** 在摘要和内容中搜索关键词 */
  keyword?: string;
  /** 按条目子类型筛选，如 "protagonist"、"faction_member" */
  subtype?: string;
  /** SQL LIKE 模糊匹配（给 LLM 更灵活的名称匹配方式） */
  namePattern?: string;
  /** 是否同时返回条目间的关系 */
  includeRelations?: boolean;
  /** 最大返回行数，默认 50，最大 200 */
  limit?: number;
  /**
   * 章节快照 ID — 若提供，从 chapters.world_snapshot 查询
   * 若不提供，从 setting_items 表查询实时数据
   */
  snapshotChapterId?: string;
}

// ── 查询结果 ──

export interface QueryResultItem {
  id: string;
  type: string;
  name: string;
  summary: string;
  /** 完整内容 — LLM 深度探索的关键字段 */
  content: Record<string, unknown>;
  tags: string[] | null;
  engineSource: string | null;
  itemSubtype: string | null;
  parentItemId: string | null;
  createdAt: string;
}

export interface QueryResultRelation {
  sourceName: string;
  targetName: string;
  relationType: string;
  label: string;
}

export interface QueryWorldSettingResult {
  items: QueryResultItem[];
  total: number;
  relations?: QueryResultRelation[];
}

// ── 查询实现 ──

/**
 * 统一的 world setting 查询入口
 * 所有引擎、伴侣、写作引擎都通过此函数获取世界观数据
 */
export async function queryWorldSetting(
  projectId: string,
  params: QueryWorldSettingParams = {}
): Promise<QueryWorldSettingResult> {
  const limit = Math.min(params.limit || 50, 200);

  // 章节快照模式 → 从 JSONB 查询
  if (params.snapshotChapterId) {
    return queryFromSnapshot(projectId, params.snapshotChapterId, params, limit);
  }

  // 实时模式 → 从 setting_items 表查询
  return queryFromLive(projectId, params, limit);
}

/**
 * 从 setting_items 表查询实时数据（孵化引擎、伴侣使用）
 */
async function queryFromLive(
  projectId: string,
  params: QueryWorldSettingParams,
  limit: number
): Promise<QueryWorldSettingResult> {
  // 构建 WHERE 条件
  const conditions: ReturnType<typeof eq>[] = [
    eq(settingItems.projectId, projectId),
    eq(settingItems.status, "confirmed"),
  ];

  // 按引擎名筛选（engineSource 字段）
  if (params.engine) {
    conditions.push(eq(settingItems.engineSource, params.engine));
  }

  // 按设定类型筛选
  if (params.type) {
    conditions.push(eq(settingItems.type, params.type));
  }

  // 按子类型筛选
  if (params.subtype) {
    conditions.push(eq(settingItems.itemSubtype, params.subtype));
  }

  // 按名称搜索
  if (params.name) {
    conditions.push(ilike(settingItems.name, `%${params.name}%`));
  }

  // SQL LIKE 模糊匹配
  if (params.namePattern) {
    conditions.push(ilike(settingItems.name, params.namePattern));
  }

  // 关键词搜索（在名称和摘要中搜索）
  if (params.keyword) {
    const kw = `%${params.keyword}%`;
    // 直接在 SQL 层面进行 OR 搜索
    conditions.push(
      sql`(${ilike(settingItems.name, kw)} OR ${ilike(settingItems.summary, kw)} OR ${ilike(settingItems.content, kw)})`
    );
  }

  // 先获取总数（在 limit 之前，确保 LLM 能正确判断是否还有更多数据）
  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(settingItems)
    .where(and(...conditions));

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
    .where(and(...conditions))
    .limit(limit);

  // 获取总数（limit 之前已通过 count 查询获取，此处仅用于 limit 截断后的 items 数量）
  // total 已在上面通过 count(*) 获取，代表数据库中实际匹配的总数

  // 格式化结果
  const formattedItems: QueryResultItem[] = items.map((item) => ({
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
  }));

  // 获取关系（如果需要）
  let relations: QueryResultRelation[] | undefined;
  if (params.includeRelations && formattedItems.length > 0) {
    relations = await queryLiveRelations(projectId, formattedItems);
  }

  return { items: formattedItems, total, relations };
}

/**
 * 查询实时数据的关系网络
 */
async function queryLiveRelations(
  projectId: string,
  items: QueryResultItem[]
): Promise<QueryResultRelation[]> {
  const itemIds = items.map((i) => i.id);

  // 构建名称查找表
  const nameMap = new Map(items.map((i) => [i.id, i.name]));

  const rels = await db
    .select()
    .from(settingItemRelations)
    .where(
      and(
        eq(settingItemRelations.projectId, projectId),
        // 仅返回与查询结果相关的关系
        sql`(${inArray(settingItemRelations.sourceItemId, itemIds)} OR ${inArray(settingItemRelations.targetItemId, itemIds)})`
      )
    );

  return rels.map((r) => ({
    sourceName: nameMap.get(r.sourceItemId) || "?",
    targetName: nameMap.get(r.targetItemId) || "?",
    relationType: r.relationType,
    label: r.label || "",
  }));
}

/**
 * 从章节快照查询冻结数据（写作引擎使用）
 * 快照是 JSONB，需要在应用层筛选而非 SQL
 */
async function queryFromSnapshot(
  projectId: string,
  chapterId: string,
  params: QueryWorldSettingParams,
  limit: number
): Promise<QueryWorldSettingResult> {
  // 读取章节快照
  const [chapter] = await db
    .select({ worldSnapshot: chapters.worldSnapshot })
    .from(chapters)
    .where(and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId)));

  if (!chapter || !chapter.worldSnapshot) {
    return { items: [], total: 0 };
  }

  const snapshot = chapter.worldSnapshot as {
    items?: QueryResultItem[];
    relations?: QueryResultRelation[];
    takenAt?: string;
  };

  let items = snapshot.items || [];

  // 在内存中应用筛选条件
  if (params.engine) {
    items = items.filter((item) => item.engineSource === params.engine);
  }
  if (params.type) {
    items = items.filter((item) => item.type === params.type);
  }
  if (params.subtype) {
    items = items.filter((item) => item.itemSubtype === params.subtype);
  }
  if (params.name) {
    const nameLower = params.name.toLowerCase();
    items = items.filter((item) => item.name.toLowerCase().includes(nameLower));
  }
  if (params.namePattern) {
    // 将 SQL LIKE 模式转换为 JavaScript 正则匹配
    // % → .* , _ → .
    const escaped = params.namePattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // 先转义正则特殊字符
      .replace(/%/g, ".*")                    // % → 任意字符序列
      .replace(/_/g, ".");                    // _ → 单字符
    const regex = new RegExp(`^${escaped}$`);
    items = items.filter((item) => regex.test(item.name));
  }
  if (params.keyword) {
    const kw = params.keyword.toLowerCase();
    items = items.filter((item) => {
      const contentStr = JSON.stringify(item.content || {}).toLowerCase();
      return (
        item.name.toLowerCase().includes(kw) ||
        (item.summary || "").toLowerCase().includes(kw) ||
        contentStr.includes(kw)
      );
    });
  }

  const total = items.length;
  items = items.slice(0, limit);

  // 筛选关系（如果需要）
  let relations: QueryResultRelation[] | undefined;
  if (params.includeRelations && snapshot.relations) {
    // 快照中 relations 的 sourceName/targetName 是名称，不是 ID
    // 用当前 items 的名称集合来筛选相关关系
    const itemNames = new Set(items.map((i) => i.name));
    relations = snapshot.relations.filter(
      (r) => itemNames.has(r.sourceName) || itemNames.has(r.targetName)
    );
  }

  return { items, total, relations };
}
