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
}

export const ENGINE_REGISTRY: EngineDef[] = [
  // ═══════════ 世界引擎 ═══════════
  // 第0层：根基引擎（无依赖，可立即执行）
  { name: "tone", label: "世界观基调", engineGroup: "world", settingType: "tone", dependsOn: [], producesSubtypes: ["tone"] },

  // 第1层：空间基础 — 地理引擎（依赖tone，自动完成尺度设计 + 顶层空间域生成）
  // scale-designer 已合入 geography，不再作为独立引擎
  { name: "geography", label: "地理环境", engineGroup: "world", settingType: "geography", dependsOn: ["tone"], producesSubtypes: ["region", "location", "landmark"] },

  // 第1层：力量体系（依赖tone+geography，为race/faction/technique提供基础）
  { name: "power-system", label: "力量体系", engineGroup: "world", settingType: "power_system", dependsOn: ["tone", "geography"], producesSubtypes: ["power_system", "realm", "rule"] },

  // 第3层：势力分布（依赖tone+geography+power-system，为后续大多数引擎提供基础）
  { name: "faction", label: "势力分布", engineGroup: "world", settingType: "faction", dependsOn: ["tone", "geography", "power-system"], producesSubtypes: ["faction_layout", "faction_member"] },

  // 第4层：并行引擎组（依赖tone/geography/power-system/faction的不同子集，可并行执行）
  // race：种族/生物体系，需要知道世界的物理法则和力量来源
  { name: "race", label: "种族生物", engineGroup: "world", settingType: "race", dependsOn: ["tone", "geography", "power-system"], producesSubtypes: ["race", "beast", "subrace"] },
  // culture：文化体系，需要地理环境和势力作为载体
  { name: "culture", label: "文化体系", engineGroup: "world", settingType: "culture", dependsOn: ["tone", "geography", "power-system", "faction", "race"], producesSubtypes: ["language", "religion", "festival", "art_form", "custom", "taboo"] },
  // history：历史年表，需要地理和势力作为舞台
  { name: "history", label: "历史年表", engineGroup: "world", settingType: "history", dependsOn: ["tone", "geography", "faction", "power-system"], producesSubtypes: ["era", "event", "historical_figure", "cataclysm"] },
  // technique：功法/技能，需要力量体系和势力
  { name: "technique", label: "功法技能", engineGroup: "world", settingType: "technique", dependsOn: ["tone", "geography", "power-system", "faction"], producesSubtypes: ["technique", "cultivation_method", "pill", "formation"] },
  // economy：经济体系，需要地理和势力
  { name: "economy", label: "经济体系", engineGroup: "world", settingType: "economy", dependsOn: ["tone", "geography", "power-system", "faction"], producesSubtypes: ["resource", "currency", "trade_route", "market", "guild"] },
  // rules：规则引擎（世界法则/地域规则/社会规则/力量规则），需要世界观基调、地理、力量体系、文化、历史、势力
  { name: "rules", label: "规则引擎", engineGroup: "world", settingType: "rules", dependsOn: ["tone", "geography", "power-system", "culture", "history", "faction"], producesSubtypes: ["world_law", "regional_rule", "social_rule", "power_rule"] },

  // 第5层：角色体系（依赖多个并行引擎的产出）
  { name: "character", label: "角色体系", engineGroup: "world", settingType: "character", dependsOn: ["tone", "faction", "power-system", "geography", "race", "rules"], producesSubtypes: ["protagonist", "character", "relationship"] },

  // 第6层：核心矛盾（依赖角色+势力+历史+力量+经济+规则）
  { name: "conflict", label: "核心矛盾", engineGroup: "world", settingType: "conflict", dependsOn: ["tone", "geography", "faction", "character", "power-system", "history", "economy", "rules"], producesSubtypes: ["conflict", "stake", "escalation"] },

  // 第7层：因果引擎（连接所有事件/势力/角色/矛盾/经济/规则，构建因果网络）
  // 这是设计文档中世界引擎最核心的子系统——不创造新实体，揭示实体之间的因果联系
  { name: "causality", label: "因果引擎", engineGroup: "world", settingType: "causality", dependsOn: ["history", "faction", "character", "conflict", "economy", "geography", "power-system", "rules"], producesSubtypes: ["causal_chain", "ripple_effect", "turning_point"] },

  // 第8层：物品体系
  { name: "item-system", label: "物品体系", engineGroup: "world", settingType: "item_system", dependsOn: ["power-system", "character", "geography", "faction", "economy", "technique", "history", "causality", "rules"], producesSubtypes: ["artifact", "common_item"] },

  // 第9层：故事蓝图
  { name: "story-blueprint", label: "故事蓝图", engineGroup: "world", settingType: "story_blueprint", dependsOn: ["tone", "geography", "power-system", "faction", "character", "conflict", "item-system", "race", "culture", "history", "technique", "economy", "causality", "rules"], producesSubtypes: ["story_blueprint"] },

  // ═══════════ 工作室引擎 ═══════════
  // foreshadowing：伏笔追踪，在卷纲确定后规划伏笔埋设/回收时间线
  { name: "foreshadowing", label: "伏笔追踪", engineGroup: "studio", settingType: "foreshadowing", dependsOn: ["story-blueprint", "volume-outline"], producesSubtypes: ["plant", "payoff", "red_herring"] },
  { name: "outline-generator", label: "全局大纲", engineGroup: "studio", settingType: "outline", dependsOn: ["story-blueprint"], producesSubtypes: ["outline"] },
  { name: "volume-outline", label: "卷纲", engineGroup: "studio", settingType: "volume_outline", dependsOn: ["outline-generator"], producesSubtypes: ["volume_outline"] },
  { name: "chapter-outline", label: "章纲", engineGroup: "studio", settingType: "chapter_outline", dependsOn: ["volume-outline", "foreshadowing"], producesSubtypes: ["chapter_outline"] },
  // chapter-writer：章节写作，在章纲确定后生成正文场景
  { name: "chapter-writer", label: "章节写作", engineGroup: "studio", settingType: "chapter_writing", dependsOn: ["chapter-outline", "foreshadowing"], producesSubtypes: ["chapter_draft", "scene_draft", "revision_note"] },

  // ═══════════ 主动引擎 ═══════════
  { name: "memory-extractor", label: "记忆提取", engineGroup: "proactive", settingType: "memory", dependsOn: [], producesSubtypes: [] },
  { name: "censor-checker", label: "谏官检查", engineGroup: "proactive", settingType: "censor", dependsOn: [], producesSubtypes: [] },
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
