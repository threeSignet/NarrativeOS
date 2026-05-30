import { db, settingItems, settingItemRelations, projects, projectScales } from "@narrative-os/database";
import { eq, and, asc, sql } from "drizzle-orm";
import type { Message } from "@narrative-os/llm-client";

export interface WorldContextOpts {
  includeEngines?: string[];
  detailLevel?: "summary" | "structured";
}

// Human-readable labels for each engine
const ENGINE_LABELS: Record<string, string> = {
  tone: "世界观基调",
  geography: "地理环境",
  "power-system": "力量体系",
  faction: "势力分布",
  race: "种族生物",
  culture: "文化体系",
  history: "历史年表",
  technique: "功法技能",
  economy: "经济体系",
  rules: "规则引擎",
  character: "角色体系",
  conflict: "核心矛盾",
  causality: "因果引擎",
  "item-system": "物品体系",
  "story-blueprint": "故事蓝图",
  foreshadowing: "伏笔追踪",
};

/**
 * Build a "## 上下文引用" section for engine system prompts.
 * Tells the LLM which dependency settings to reference.
 */
export function buildContextReferenceSection(dependsOn: string[]): string {
  if (dependsOn.length === 0) return "";
  const labels = dependsOn.map((e) => `【${ENGINE_LABELS[e] || e}】`).join("、");
  return `
## 上下文引用
你可以使用 \`query_world_setting\` 工具查询已确认的${labels}设定。
**在生成提案前，请主动使用该工具获取最新数据**，而不是推测或编造。
如果某依赖引擎尚无已确认数据，请在 reasoning 中说明，并根据项目信息合理推演（标注为"待确认"）。`;
}

/**
 * 生成"项目叙事理解"段落——让 LLM 在设计前先理解项目全貌。
 * 解决引擎"聚焦关键词而非整体理解"的根因。
 */
export function buildProjectNarrativeSection(): string {
  return `
## 项目叙事理解（必读）

系统提示最前面已提供了完整的【项目信息】——书名、类型、风格、目标读者、简介、核心创意、核心概念、标签、写作目标、AI写作配置。

**你的所有设计必须深度绑定这些项目信息**。你不是在为泛泛的"XX题材"设计模板——你是在为一个有具体故事、具体主角、具体核心创意的项目做设计。

在 reasoning 中请体现以下思考：
1. 你的设计如何服务于这个项目的核心创意和故事走向？
2. 你产出的条目中，哪些是主角可能直接接触/使用的？为主角的活动路径预留了怎样的空间？
3. 你的设计与项目简介中的关键场景/冲突是如何关联的？

**如果项目信息与你的常识模板有冲突，优先遵循项目信息。**`;
}

/**
 * Build a rich user message (trigger prompt) for engine invocation.
 * Used by engines that override buildUserMessage().
 */
export function buildEngineUserMessage(
  engineName: string,
  dependsOn: string[],
  genre: string,
  title?: string
): string {
  const label = ENGINE_LABELS[engineName] || engineName;
  const titlePart = title ? `《${title}》` : "小说";
  const genrePart = genre ? `（${genre}题材）` : "";

  const projectInfoHint = "\n\n注意：系统提示中包含完整的【项目信息】（书名、类型、风格、目标读者、简介、核心创意、写作目标、AI写作配置等），请务必基于这些信息进行设计。";

  if (dependsOn.length === 0) {
    return `请为${titlePart}${genrePart}设计${label}。${projectInfoHint}`;
  }

  const depLabels = dependsOn.map((e) => `【${ENGINE_LABELS[e] || e}】`).join("、");
  return `请基于已确认的${depLabels}设定，为${titlePart}${genrePart}设计${label}。
要求：确保设计内容与上述已确认设定协调一致，不能产生矛盾。${projectInfoHint}`;
}

/**
 * Build structured world context for LLM consumption.
 * Reads confirmed setting_items and their relations, grouped by engineSource.
 */
export async function buildWorldContext(
  projectId: string,
  opts: WorldContextOpts = {}
): Promise<Message[]> {
  const { includeEngines, detailLevel = "structured" } = opts;

  const allItems = await db
    .select()
    .from(settingItems)
    .where(
      and(
        eq(settingItems.projectId, projectId),
        eq(settingItems.status, "confirmed")
      )
    )
    .limit(500); // 防止大型项目内存溢出，500 条设定已覆盖绝大多数项目

  if (allItems.length >= 500) {
    console.warn(`[buildWorldContext] 项目 ${projectId} 的已确认设定超过 500 条，仅返回前 500 条`);
  }

  const items = allItems;
  const filtered = includeEngines
    ? items.filter((i) => i.engineSource && includeEngines.includes(i.engineSource))
    : items;

  if (filtered.length === 0) return [];

  const itemIds = filtered.map((i) => i.id);
  const relations = itemIds.length > 0
    ? await db
        .select()
        .from(settingItemRelations)
        .where(eq(settingItemRelations.projectId, projectId))
    : [];

  const nameMap = new Map(filtered.map((i) => [i.id, i.name]));

  const parts: string[] = [];

  if (detailLevel === "structured") {
    const byEngine = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const key = item.engineSource || item.type;
      if (!byEngine.has(key)) byEngine.set(key, []);
      byEngine.get(key)!.push(item);
    }

    for (const [engine, engineItems] of byEngine) {
      parts.push(`## ${engine}`);

      // 构建多层级树形结构（递归，不只2层）
      const idToItem = new Map(engineItems.map((i) => [i.id, i]));
      const childrenMap = new Map<string | null, typeof engineItems>();
      for (const item of engineItems) {
        const parentKey = item.parentItemId || null;
        if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
        childrenMap.get(parentKey)!.push(item);
      }

      // 递归渲染树
      const renderTree = (parentId: string | null, indent: number) => {
        const children = childrenMap.get(parentId) || [];
        for (const child of children) {
          const prefix = "  ".repeat(indent) + "- ";
          const content = (child.content || {}) as Record<string, unknown>;

          // 地理类条目附加坐标和尺度信息，供下游引擎精确定位
          let geoMeta = "";
          if (child.type === "geography" || child.engineSource === "geography") {
            const scale = content.scale as string | undefined;
            const coords = content.coordinates as { x: number; y: number } | undefined;
            if (scale || coords) {
              const scaleStr = scale ? `scale=${scale}` : "";
              const coordStr = coords ? `(${coords.x},${coords.y})` : "";
              geoMeta = ` [${[scaleStr, coordStr].filter(Boolean).join(", ")}]`;
            }
          }

          // 力量体系类条目附加等级信息
          let powerMeta = "";
          if (child.type === "power_system" || child.engineSource === "power-system") {
            const level = content.level as number | undefined;
            const realmType = content.type as string | undefined;
            if (level !== undefined) powerMeta += ` Lv${level}`;
            if (realmType) powerMeta += ` (${realmType})`;
            if (powerMeta) powerMeta = ` [${powerMeta.trim()}]`;
          }

          parts.push(`${prefix}${child.name}: ${child.summary || ""}${geoMeta}${powerMeta}`);
          renderTree(child.id, indent + 1);
        }
      };

      renderTree(null, 0);
    }
  } else {
    parts.push(filtered.map((i) => `[${i.type}] ${i.name}: ${i.summary}`).join("\n"));
  }

  // Append relations
  const relevantRelations = relations.filter(
    (r) => itemIds.includes(r.sourceItemId) || itemIds.includes(r.targetItemId)
  );
  if (relevantRelations.length > 0) {
    parts.push("\n## Relations");
    for (const r of relevantRelations) {
      parts.push(
        `- ${nameMap.get(r.sourceItemId) || "?"} ${r.relationType} ${nameMap.get(r.targetItemId) || "?"} (${r.label || ""})`
      );
    }
  }

  return [{ role: "system", content: parts.join("\n") }];
}

/**
 * 构建依赖引擎的名称注册表（紧凑格式）。
 *
 * 与 buildWorldContext 的区别：
 * - buildWorldContext 返回完整结构化上下文（含 summary），数据量大
 * - buildDependencyNameRegistry 只返回名称 + 关键元数据，极致紧凑
 *
 * 用途：在工具模式（streamRunWithTools）下，LLM 需要精确引用已确认条目的名称。
 * 此注册表确保 LLM 知道所有已确认条目的精确名称、层级关系和关键坐标，
 * 避免 LLM 编造不存在的名称或使用缩写。
 *
 * 格式示例：
 * ```
 * ## 已确认设定的名称注册表
 * **重要：以下名称必须精确使用，不得修改、缩写或编造。**
 *
 * ### 地理环境 (geography)
 * - 千界·九重叠渊 [continent, (500,500)]
 *   - 第一层·深渊天井 [region, (500,100)]
 *     - 深渊天井·中央枢纽 [city, (500,100)]
 * ```
 */
export async function buildDependencyNameRegistry(
  projectId: string,
  dependsOn: string[]
): Promise<string> {
  if (dependsOn.length === 0) return "";

  const items = await db
    .select()
    .from(settingItems)
    .where(
      and(
        eq(settingItems.projectId, projectId),
        eq(settingItems.status, "confirmed")
      )
    );

  // 只保留依赖引擎的条目
  const depItems = items.filter(
    (i) => i.engineSource && dependsOn.includes(i.engineSource)
  );

  if (depItems.length === 0) return "";

  // 按引擎分组
  const byEngine = new Map<string, typeof depItems>();
  for (const item of depItems) {
    const key = item.engineSource || item.type;
    if (!byEngine.has(key)) byEngine.set(key, []);
    byEngine.get(key)!.push(item);
  }

  const parts: string[] = [];
  parts.push("## 已确认设定的名称注册表\n");
  parts.push("**重要：以下条目名称必须精确使用，不得修改、缩写或编造。引用时必须使用完整的原始名称。**\n");

  for (const [engine, engineItems] of byEngine) {
    const label = ENGINE_LABELS[engine] || engine;
    parts.push(`### ${label} (${engine})`);

    // 构建父子关系树
    const childrenMap = new Map<string | null, typeof engineItems>();
    for (const item of engineItems) {
      const parentKey = item.parentItemId || null;
      if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
      childrenMap.get(parentKey)!.push(item);
    }

    // 递归渲染树
    const renderTree = (parentId: string | null, indent: number) => {
      const children = childrenMap.get(parentId) || [];
      for (const child of children) {
        const prefix = "  ".repeat(indent) + "- ";
        const content = (child.content || {}) as Record<string, unknown>;

        // 构建元数据标注（坐标/尺度/等级等关键定位信息）
        let meta = "";
        if (child.type === "geography" || child.engineSource === "geography") {
          const scale = content.scale as string | undefined;
          const coords = content.coordinates as { x: number; y: number } | undefined;
          const metaParts: string[] = [];
          if (scale) metaParts.push(`scale=${scale}`);
          if (coords) metaParts.push(`(${coords.x},${coords.y})`);
          if (metaParts.length > 0) meta = ` [${metaParts.join(", ")}]`;
        } else if (child.type === "power_system" || child.engineSource === "power-system") {
          const level = content.level as number | undefined;
          const realmType = content.type as string | undefined;
          const metaParts: string[] = [];
          if (level !== undefined) metaParts.push(`Lv${level}`);
          if (realmType) metaParts.push(realmType);
          if (metaParts.length > 0) meta = ` [${metaParts.join(", ")}]`;
        }

        // 追加摘要：让 LLM 不仅知道名称，还理解条目的叙事意义
        const summary = (child.summary || "") as string;
        const summarySuffix = summary ? ` — ${summary}` : "";

        parts.push(`${prefix}${child.name}${meta}${summarySuffix}`);
        renderTree(child.id, indent + 1);
      }
    };

    renderTree(null, 0);
    parts.push(""); // 引擎间空行
  }

  return parts.join("\n");
}

/**
 * Build project metadata context from the projects table.
 */
export async function buildProjectMetaContext(projectId: string): Promise<string> {
  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) return "";

    const parts: string[] = [];

    if (project.title) parts.push(`书名：${project.title}`);
    if (project.genre) parts.push(`类型：${project.genre}`);
    if (project.novelType) parts.push(`子类型：${project.novelType}`);
    if (project.style) parts.push(`风格：${project.style}`);
    if (project.targetAudience) parts.push(`目标读者：${project.targetAudience}`);
    if (project.synopsis) parts.push(`简介：${project.synopsis}`);
    if (project.coreCreativity) parts.push(`核心创意：${project.coreCreativity}`);
    if (project.coreConcept) parts.push(`核心概念：${project.coreConcept}`);
    if (project.tags && Array.isArray(project.tags) && project.tags.length > 0) {
      parts.push(`标签：${project.tags.join("、")}`);
    }

    const goals: string[] = [];
    if (project.targetWords) goals.push(`总字数约 ${project.targetWords.toLocaleString()} 字`);
    if (project.targetChapterCount) goals.push(`共 ${project.targetChapterCount} 章`);
    if (project.targetVolumeCount) goals.push(`分 ${project.targetVolumeCount} 卷`);
    if (project.targetChapterWords) goals.push(`每章约 ${project.targetChapterWords} 字`);
    if (goals.length > 0) parts.push(`写作目标：${goals.join("，")}`);

    const aiConfig: string[] = [];
    if (project.defaultWritingStyle) aiConfig.push(`写作风格="${project.defaultWritingStyle}"`);
    if (project.defaultPace) aiConfig.push(`叙事节奏="${project.defaultPace}"`);
    if (aiConfig.length > 0) parts.push(`AI 写作配置：${aiConfig.join("，")}`);

    if (parts.length === 0) return "";
    return `\n\n【项目信息】\n${parts.join("\n")}`;
  } catch {
    return "";
  }
}

/**
 * Detect genre from project database or caller string.
 */
export async function detectGenre(projectId: string, caller: string): Promise<string> {
  if (projectId) {
    try {
      const [project] = await db
        .select({ novelType: projects.novelType, genre: projects.genre })
        .from(projects)
        .where(eq(projects.id, projectId));
      if (project?.novelType) return project.novelType;
      if (project?.genre) return project.genre;
    } catch { /* fall through */ }
  }

  const genreMap: Record<string, string> = {
    "修仙": "修仙", "xianxia": "修仙",
    "科幻": "科幻", "scifi": "科幻",
    "玄幻": "玄幻", "fantasy": "玄幻",
    "都市": "都市", "urban": "都市",
    "历史": "历史", "history": "历史",
    "武侠": "武侠", "wuxia": "武侠",
    "悬疑": "悬疑", "suspense": "悬疑",
    "军事": "军事", "military": "军事",
    "游戏": "游戏", "game": "游戏",
    "言情": "言情", "romance": "言情",
  };
  for (const [key, val] of Object.entries(genreMap)) {
    if (caller.includes(key)) return val;
  }
  return "通用";
}

// ── 动态尺度体系 ──

/** 项目尺度条目（从 project_scales 表读取） */
export interface ProjectScale {
  key: string;
  label: string;
  parentKey: string | null;
  sortOrder: number;
  description: string | null;
  worldItemId?: string | null;
}

/**
 * 加载项目的自定义尺度树。
 * 如果项目没有自定义尺度（尚未运行 scale-designer），回退到默认 SCALE_CHAIN。
 */
export async function loadProjectScales(
  projectId: string,
  worldItemId?: string | null
): Promise<ProjectScale[]> {
  try {
    const rows = await db
      .select()
      .from(projectScales)
      .where(
        and(
          eq(projectScales.projectId, projectId),
          worldItemId ? eq(projectScales.worldItemId, worldItemId) : sql`${projectScales.worldItemId} IS NULL`
        )
      )
      .orderBy(asc(projectScales.sortOrder));

    if (rows.length > 0) {
      return rows.map((r) => ({
        key: r.key,
        label: r.label,
        parentKey: r.parentKey ?? null,
        sortOrder: r.sortOrder,
        description: r.description ?? null,
        worldItemId: r.worldItemId ?? null,
      }));
    }

    // 回退：无自定义尺度时使用默认 SCALE_CHAIN
    const { SCALE_CHAIN, getScaleLabel } = await import("./types");
    return SCALE_CHAIN.map((key, i) => ({
      key,
      label: getScaleLabel(key),
      parentKey: i === 0 ? null : SCALE_CHAIN[i - 1],
      sortOrder: i,
      description: null,
    }));
  } catch {
    return [];
  }
}

/** 获取某尺度在项目尺度链中的下一级 */
export async function getProjectChildScale(
  projectId: string,
  currentScale: string,
  worldItemId?: string | null
): Promise<ProjectScale | null> {
  const scales = await loadProjectScales(projectId, worldItemId);
  const current = scales.find((s) => s.key === currentScale);
  if (!current) return null;
  return scales.find((s) => s.parentKey === current.key) ?? null;
}

/**
 * 生成地理绑定约束的标准 prompt 段落。
 *
 * 要求 LLM 在每个 item 的 content 中输出 geographic_bindings 字段，
 * 以统一格式关联已确认的地理条目名称。
 * 这使得系统能跨引擎回答"这个实体在哪个地理位置"类查询。
 */
export function buildGeographyBindingSection(): string {
  return `
## 地理位置绑定（必须）
每个 item 的 content 中**必须**包含 \`geographic_bindings\` 字段，格式如下：
\`\`\`json
"geographic_bindings": [
  { "location_name": "已确认的地理条目名称", "binding_type": "绑定类型", "description": "简述该实体与此地点的关系" }
]
\`\`\`
- \`location_name\` 必须使用 \`query_world_setting\` 工具查询已确认的地理条目精确名称，不得自行编造
- \`binding_type\` 可选值：\`headquarters\`（总部/驻扎地）、\`territory\`（势力范围）、\`origin\`（发源地/出生地）、\`active_area\`（活动区域）、\`influence_zone\`（影响范围）、\`habitat\`（栖息地）、\`resource_source\`（资源产地）
- 至少为每个 item 指定 1 个地理绑定，优先使用精确的城市/地点级别名称
- 如果某个 item 的内容中已有 headquarters / territory / location / habitat 等字段，\`geographic_bindings\` 应与之一致并作为标准化的补充`;
}

/** 生成注入引擎 prompt 的尺度描述文本 */
export async function buildScaleContext(projectId: string): Promise<string> {
  const scales = await loadProjectScales(projectId);
  if (scales.length === 0) return "";

  const chainStr = scales.map((s) => s.label).join(" → ");
  const detailLines = scales.map((s) =>
    `- **${s.label}** (\`${s.key}\`)${s.description ? `：${s.description}` : ""}`
  );

  return `
## 项目空间尺度体系
尺度链：${chainStr}
${detailLines.join("\n")}

**你的所有空间引用必须对齐上述尺度体系。生成新条目时，scale 字段必须使用上述 key 值。**`;
}
