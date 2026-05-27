/**
 * 引擎导航地图 — 从 ENGINE_REGISTRY 自动构建，零手动维护
 *
 * 用途：
 * 1. 注入到引擎/伴侣的系统提示中，作为 LLM 的"数据目录"
 * 2. query_world_setting 工具的参数描述由此自动生成
 * 3. 新增引擎只需在 engine-config.ts 的 ENGINE_REGISTRY 数组中加一条，
 *    引擎地图自动更新，无需改任何其他文件
 *
 * 设计原则：
 * - 完全自动生成，不依赖人工维护
 * - 引擎地图是同质化数据查询的上层统一抽象
 * - LLM 只需要看这张地图，就知道有什么数据、怎么查
 */
import { ENGINE_REGISTRY } from "./engine-config";
import type { EngineDef } from "./engine-config";

// ── 引擎地图条目：描述单个引擎的产出 ──

export interface EngineMapEntry {
  /** 引擎注册名，如 "character"、"power-system" */
  name: string;
  /** 中文显示名，如 "角色体系"、"力量体系" */
  label: string;
  /** 引擎分组：世界引擎/工作室引擎/主动引擎 */
  group: "world" | "studio" | "proactive";
  /** 产出的设定类型，对应 settingItems.type，如 "character"、"power_system" */
  settingType: string;
  /** 一句话描述这个引擎产出什么 */
  description: string;
  /** 产出的子类型列表，如 ["protagonist", "character", "relationship"] */
  producesSubtypes: string[];
  /** 依赖的前置引擎名称列表 */
  dependsOn: string[];
}

// ── 完整的引擎地图 ──

export interface EngineMap {
  /** 按引擎名索引 */
  engines: Record<string, EngineMapEntry>;
  /** 按引擎分组索引 */
  byGroup: Record<string, string[]>;
  /** 生成时间 */
  generatedAt: string;
}

// ── 引擎描述（领域知识，补充自动生成的字段） ──

const ENGINE_DESCRIPTIONS: Record<string, string> = {
  tone: "确定故事的整体基调、氛围、社会结构、禁忌和文化特征，是所有世界观设计的基础",
  geography: "设计世界的地理格局、地形分布、区域划分和关键地标，提供空间坐标系",
  "power-system": "定义世界的超凡力量体系，包括修炼等级、境界划分、力量来源和规则",
  faction: "设计世界中的势力分布、组织结构、势力关系和关键成员",
  race: "设计世界中的智慧种族、生物体系和族群特征",
  culture: "设计各区域/势力的文化体系，包括语言、宗教、节日、艺术、习俗和禁忌",
  history: "构建世界的历史年表、重大事件、历史人物和灾难/变革节点",
  technique: "设计具体的功法、技能、丹药、阵法等超凡技术体系",
  economy: "设计世界的经济体系，包括资源分布、货币、贸易路线、市场和行业组织",
  rules: "定义世界法则和规则，包括自然法则、地域规则、社会规则和力量规则",
  character: "设计故事的核心角色体系，包括主角、配角及其关系网络",
  conflict: "设计故事的核心矛盾、冲突升级路径和各方的利益纠缠",
  causality: "揭示实体之间的因果联系，构建因果链、涟漪效应和命运转折点",
  "item-system": "设计世界的物品体系，包括神器法宝和普通物品",
  "story-blueprint": "综合所有世界观元素，构建完整的故事蓝图，包括核心前提、主要弧线和结局愿景",
  foreshadowing: "规划伏笔的埋设和回收时间线，确保前后呼应",
  "outline-generator": "生成小说的全局大纲，包括卷章划分和整体节奏",
  "volume-outline": "为每一卷生成详细大纲，规划卷内章节分布和节奏",
  "chapter-outline": "为每一章生成详细章纲，包括场景分解、节奏调控和伏笔引用",
  "chapter-writer": "根据章纲撰写章节正文，可多方案选择",
  "memory-extractor": "从已完成的章节中提取实体和关系，更新世界观记忆",
  "censor-checker": "检查章节内容是否与已确认的世界观设定一致，发现矛盾和偏差",
};

// ── 缓存：模块加载时构建一次 ──

let _cachedMap: EngineMap | null = null;

/**
 * 构建完整的引擎地图
 * 遍历 ENGINE_REGISTRY，自动生成所有引擎条目的描述信息
 */
export function buildEngineMap(): EngineMap {
  if (_cachedMap) return _cachedMap;

  const engines: Record<string, EngineMapEntry> = {};
  const byGroup: Record<string, string[]> = { world: [], studio: [], proactive: [] };

  for (const def of ENGINE_REGISTRY) {
    const entry: EngineMapEntry = {
      name: def.name,
      label: def.label,
      group: def.engineGroup,
      settingType: def.settingType,
      description: ENGINE_DESCRIPTIONS[def.name] || `${def.label}引擎`,
      producesSubtypes: def.producesSubtypes,
      dependsOn: def.dependsOn,
    };
    engines[def.name] = entry;
    byGroup[def.engineGroup].push(def.name);
  }

  _cachedMap = {
    engines,
    byGroup,
    generatedAt: new Date().toISOString(),
  };

  return _cachedMap;
}

/**
 * 获取引擎地图（使用缓存，避免重复构建）
 */
export function getEngineMap(): EngineMap {
  return buildEngineMap();
}

/**
 * 获取单个引擎的地图条目
 */
export function getEngineMapEntry(name: string): EngineMapEntry | undefined {
  return getEngineMap().engines[name];
}

/**
 * 从 ENGINE_REGISTRY 自动生成依赖图文本（替代硬编码的 ASCII 依赖图）
 * 按分组（world / studio）分别展示拓扑排序后的依赖链
 */
function generateDependencyGraph(): string[] {
  const lines: string[] = [];
  const registry = ENGINE_REGISTRY;

  // 计算每个引擎的"层级"（从无依赖引擎开始的最长路径）
  const layerMap = new Map<string, number>();
  const computeLayer = (name: string, visited: Set<string>): number => {
    if (layerMap.has(name)) return layerMap.get(name)!;
    if (visited.has(name)) return 0; // 循环依赖防护
    visited.add(name);
    const def = registry.find((d) => d.name === name);
    if (!def || def.dependsOn.length === 0) {
      layerMap.set(name, 0);
      return 0;
    }
    const maxDep = Math.max(...def.dependsOn.map((d) => computeLayer(d, new Set(visited))));
    const layer = maxDep + 1;
    layerMap.set(name, layer);
    return layer;
  };
  for (const def of registry) computeLayer(def.name, new Set());

  // 按分组输出
  for (const group of ["world", "studio"] as const) {
    const groupEngines = registry.filter((d) => d.engineGroup === group);
    if (groupEngines.length === 0) continue;

    // 按层级排序
    groupEngines.sort((a, b) => (layerMap.get(a.name) || 0) - (layerMap.get(b.name) || 0));

    // 构建层级到引擎列表的映射
    const byLayer = new Map<number, typeof groupEngines>();
    for (const def of groupEngines) {
      const layer = layerMap.get(def.name) || 0;
      if (!byLayer.has(layer)) byLayer.set(layer, []);
      byLayer.get(layer)!.push(def);
    }

    // 输出依赖链
    const maxLayer = Math.max(...byLayer.keys());
    lines.push(`## ${group === "world" ? "世界引擎" : "工作室引擎"}依赖链`);
    for (let l = 0; l <= maxLayer; l++) {
      const engines = byLayer.get(l) || [];
      if (engines.length === 0) continue;
      const names = engines.map((e) => e.name).join(", ");
      const deps = engines[0]?.dependsOn.length
        ? ` (依赖: ${engines[0].dependsOn.join(", ")})`
        : "";
      lines.push(`  第${l}层: ${names}${deps}`);
    }
    lines.push("");
  }

  return lines;
}

/**
 * 将引擎地图格式化为系统提示用的 Markdown 文本
 * 包含完整的引擎列表、产出子类型和分组信息
 */
export function formatEngineMapForPrompt(): string {
  const map = getEngineMap();

  const lines: string[] = [
    "## 引擎数据导航",
    "",
    "以下是可用的世界观设定引擎及其产出的数据。你可以使用 `query_world_setting` 工具按引擎名、类型、名称或关键词查询任意引擎的已确认数据。",
    "",
    "### 世界引擎（已确认的数据可直接查询）",
    "",
    "| 引擎 | 产出类型 | 子类型 |",
    "|------|---------|--------|",
  ];

  // 世界引擎
  for (const name of map.byGroup.world) {
    const entry = map.engines[name];
    const subtypes = entry.producesSubtypes.length > 0
      ? entry.producesSubtypes.join("、")
      : "—";
    lines.push(`| ${entry.label} (\`${entry.name}\`) | ${entry.settingType} | ${subtypes} |`);
  }

  // 工作室引擎
  lines.push("");
  lines.push("### 工作室引擎");
  lines.push("");
  lines.push("| 引擎 | 产出类型 | 子类型 |");
  lines.push("|------|---------|--------|");

  for (const name of map.byGroup.studio) {
    const entry = map.engines[name];
    const subtypes = entry.producesSubtypes.length > 0
      ? entry.producesSubtypes.join("、")
      : "—";
    lines.push(`| ${entry.label} (\`${entry.name}\`) | ${entry.settingType} | ${subtypes} |`);
  }

  // 主动引擎
  lines.push("");
  lines.push("### 主动引擎");
  lines.push("");
  lines.push("| 引擎 | 描述 |");
  lines.push("|------|------|");

  for (const name of map.byGroup.proactive) {
    const entry = map.engines[name];
    lines.push(`| ${entry.label} (\`${entry.name}\`) | ${entry.description} |`);
  }

  // 依赖图：从 ENGINE_REGISTRY 自动生成（不再硬编码）
  lines.push("");
  lines.push("### 引擎依赖关系");
  lines.push("");
  lines.push("引擎按层级执行，前置引擎确认后才会运行后续引擎：");
  lines.push("");
  lines.push("```");
  const depGraph = generateDependencyGraph();
  lines.push(...depGraph);
  lines.push("```");

  return lines.join("\n");
}

/**
 * 生成工具参数描述中使用的引擎列表（紧凑版）
 * 用于 buildQueryWorldSettingToolDef 的 engine 参数 description
 */
export function formatEngineListForToolDesc(): string {
  const map = getEngineMap();
  const names: string[] = [];
  for (const entry of Object.values(map.engines)) {
    names.push(`"${entry.name}" (${entry.label})`);
  }
  return names.join("、");
}

/**
 * 生成查询示例（基于真实引擎名和子类型）
 */
export function formatQueryExamples(): string {
  const map = getEngineMap();

  // 选几个代表性引擎生成示例
  const examples: string[] = [];

  // 按引擎查询
  const characterEntry = map.engines["character"];
  if (characterEntry) {
    examples.push(`按引擎查询所有角色：{ "engine": "character" }`);
  }

  const geographyEntry = map.engines["geography"];
  if (geographyEntry) {
    examples.push(`按类型查询所有地理区域：{ "type": "geography" }`);
  }

  // 按子类型查询
  const factionEntry = map.engines["faction"];
  if (factionEntry && factionEntry.producesSubtypes.length > 0) {
    examples.push(`查询势力成员：{ "subtype": "${factionEntry.producesSubtypes[1] || factionEntry.producesSubtypes[0]}" }`);
  }

  // 按关键词查询
  examples.push(`关键词搜索：{ "keyword": "修仙" }`);

  // 带关系查询
  examples.push(`带关系查询势力：{ "engine": "faction", "includeRelations": true }`);

  return examples.join("\n");
}
