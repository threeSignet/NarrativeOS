/**
 * 引擎注册表 — 纯数据定义 + 依赖图
 *
 * 三大引擎组：world / studio / proactive
 *
 * 命名约定：
 * - `name`: 引擎注册名，使用连字符 (kebab-case)，如 "power-system"
 *   → 用于 getEngine()、registry、sourceNode、engineSource
 * - `settingType`: 产出数据的 type，使用下划线 (snake_case)，如 "power_system"
 *   → 用于 settingItems.type、engines API 的 type 字段
 * - 这两个必须不同但对应，避免混淆
 *
 * 依赖图设计原则：
 * - 最小化线性串行等待，最大化可并行执行的引擎
 * - 只声明真正有数据依赖的前置引擎
 * - 同一层级的引擎可以在前置满足后并行执行
 *
 * 优化后的并行拓扑：
 *   tone (根)
 *   ├── geography
 *   │   └── power-system
 *   │           ├── race ─────────────────────────────┐
 *   │           ├── technique ────────────────────────┤
 *   │           └── faction ─┬── culture ─────────────┤
 *   │                        ├── history ─────────────┤
 *   │                        ├── economy ─────────────┤
 *   │                        └── character ───────────┤
 *   │                            └── conflict ────────┤
 *   │                                └── item-system ─┤
 *   │                                    └── story-blueprint (全部汇聚)
 */
export interface EngineDef {
  name: string;
  label: string;
  engineGroup: "world" | "studio" | "proactive";
  settingType: string;
  dependsOn: string[];
  producesSubtypes: string[];
  /** 可选：产出的关键数据字段描述（用于引擎地图，未来补充） */
  outputFields?: Record<string, { field: string; type: string; description: string }[]>;
  /** v4.0: 引擎默认协作模式 */
  defaultCollaborationMode: "plan" | "auto" | "full_auto";
}

export const ENGINE_REGISTRY: EngineDef[] = [
  // ═══════════ 世界引擎 ═══════════
  { name: "tone", label: "世界观基调", engineGroup: "world", settingType: "tone", dependsOn: [], producesSubtypes: ["tone"], defaultCollaborationMode: "plan" },
  { name: "geography", label: "地理环境", engineGroup: "world", settingType: "geography", dependsOn: ["tone"], producesSubtypes: ["region", "location", "landmark"], defaultCollaborationMode: "plan" },
  { name: "power-system", label: "力量体系", engineGroup: "world", settingType: "power_system", dependsOn: ["tone", "geography"], producesSubtypes: ["power_system", "realm", "rule"], defaultCollaborationMode: "plan" },
  { name: "faction", label: "势力分布", engineGroup: "world", settingType: "faction", dependsOn: ["tone", "geography", "power-system"], producesSubtypes: ["faction_layout", "faction_member"], defaultCollaborationMode: "auto" },
  { name: "race", label: "种族生物", engineGroup: "world", settingType: "race", dependsOn: ["tone", "geography", "power-system"], producesSubtypes: ["race", "beast", "subrace"], defaultCollaborationMode: "auto" },
  { name: "culture", label: "文化体系", engineGroup: "world", settingType: "culture", dependsOn: ["tone", "geography", "power-system", "faction", "race"], producesSubtypes: ["language", "religion", "festival", "art_form", "custom", "taboo"], defaultCollaborationMode: "auto" },
  { name: "history", label: "历史年表", engineGroup: "world", settingType: "history", dependsOn: ["tone", "geography", "faction", "power-system"], producesSubtypes: ["era", "event", "historical_figure", "cataclysm"], defaultCollaborationMode: "auto" },
  { name: "technique", label: "功法技能", engineGroup: "world", settingType: "technique", dependsOn: ["tone", "geography", "power-system", "faction"], producesSubtypes: ["technique", "cultivation_method", "pill", "formation"], defaultCollaborationMode: "auto" },
  { name: "economy", label: "经济体系", engineGroup: "world", settingType: "economy", dependsOn: ["tone", "geography", "power-system", "faction"], producesSubtypes: ["resource", "currency", "trade_route", "market", "guild"], defaultCollaborationMode: "auto" },
  { name: "rules", label: "规则引擎", engineGroup: "world", settingType: "rules", dependsOn: ["tone", "geography", "power-system", "culture", "history", "faction"], producesSubtypes: ["world_law", "regional_rule", "social_rule", "power_rule"], defaultCollaborationMode: "auto" },
  { name: "character", label: "角色体系", engineGroup: "world", settingType: "character", dependsOn: ["tone", "faction", "power-system", "geography", "race", "rules"], producesSubtypes: ["protagonist", "character", "relationship"], defaultCollaborationMode: "plan" },
  { name: "conflict", label: "核心矛盾", engineGroup: "world", settingType: "conflict", dependsOn: ["tone", "geography", "faction", "character", "power-system", "history", "economy", "rules"], producesSubtypes: ["conflict", "stake", "escalation"], defaultCollaborationMode: "plan" },
  { name: "causality", label: "因果引擎", engineGroup: "world", settingType: "causality", dependsOn: ["history", "faction", "character", "conflict", "economy", "geography", "power-system", "rules"], producesSubtypes: ["causal_chain", "ripple_effect", "turning_point"], defaultCollaborationMode: "auto" },
  { name: "item-system", label: "物品体系", engineGroup: "world", settingType: "item_system", dependsOn: ["power-system", "character", "geography", "faction", "economy", "technique", "history", "causality", "rules"], producesSubtypes: ["artifact", "common_item"], defaultCollaborationMode: "auto" },
  { name: "story-blueprint", label: "故事蓝图", engineGroup: "world", settingType: "story_blueprint", dependsOn: ["tone", "geography", "power-system", "faction", "character", "conflict", "item-system", "race", "culture", "history", "technique", "economy", "causality", "rules"], producesSubtypes: ["story_blueprint"], defaultCollaborationMode: "plan" },

  // ═══════════ 工作室引擎 ═══════════
  { name: "foreshadowing", label: "伏笔追踪", engineGroup: "studio", settingType: "foreshadowing", dependsOn: ["story-blueprint", "volume-outline"], producesSubtypes: ["plant", "payoff", "red_herring"], defaultCollaborationMode: "auto" },
  { name: "outline-generator", label: "全局大纲", engineGroup: "studio", settingType: "outline", dependsOn: ["story-blueprint"], producesSubtypes: ["outline"], defaultCollaborationMode: "plan" },
  { name: "volume-outline", label: "卷纲", engineGroup: "studio", settingType: "volume_outline", dependsOn: ["outline-generator"], producesSubtypes: ["volume_outline"], defaultCollaborationMode: "plan" },
  { name: "chapter-outline", label: "章纲", engineGroup: "studio", settingType: "chapter_outline", dependsOn: ["volume-outline", "foreshadowing"], producesSubtypes: ["chapter_outline"], defaultCollaborationMode: "plan" },
  { name: "chapter-writer", label: "章节写作", engineGroup: "studio", settingType: "chapter_writing", dependsOn: ["chapter-outline", "foreshadowing"], producesSubtypes: ["chapter_draft", "scene_draft", "revision_note"], defaultCollaborationMode: "plan" },

  // ═══════════ 主动引擎 ═══════════
  { name: "memory-extractor", label: "记忆提取", engineGroup: "proactive", settingType: "memory", dependsOn: [], producesSubtypes: [], defaultCollaborationMode: "auto" },
  { name: "censor-checker", label: "谏官检查", engineGroup: "proactive", settingType: "censor", dependsOn: [], producesSubtypes: [], defaultCollaborationMode: "auto" },
];

export const WORLD_ENGINES = ENGINE_REGISTRY.filter(e => e.engineGroup === "world");
export const STUDIO_ENGINES = ENGINE_REGISTRY.filter(e => e.engineGroup === "studio");
export const PROACTIVE_ENGINES = ENGINE_REGISTRY.filter(e => e.engineGroup === "proactive");
export const HATCH_ENGINES = ENGINE_REGISTRY.filter(e => e.engineGroup === "world" || e.engineGroup === "studio");

export function getEngineDef(name: string): EngineDef | undefined {
  return ENGINE_REGISTRY.find(e => e.name === name);
}

export function areDepsSatisfied(name: string, confirmedSources: Set<string>): boolean {
  const engine = getEngineDef(name);
  if (!engine) return false;
  return engine.dependsOn.every(dep => confirmedSources.has(dep));
}

/**
 * 获取所有前置依赖已满足且尚未执行的引擎。
 * 返回的引擎列表可能包含多个可并行执行的引擎。
 */
export function getRunnableEngines(confirmedSources: Set<string>, pendingSources: Set<string>, filterGroup?: "world" | "studio" | "proactive"): EngineDef[] {
  return ENGINE_REGISTRY.filter(engine => {
    if (filterGroup && engine.engineGroup !== filterGroup) return false;
    return areDepsSatisfied(engine.name, confirmedSources) && !pendingSources.has(engine.name) && !confirmedSources.has(engine.name);
  });
}

export const TYPE_TO_ENGINE: Record<string, string> = Object.fromEntries(ENGINE_REGISTRY.map(e => [e.settingType, e.name]));
