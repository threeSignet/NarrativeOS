/**
 * CrossEngineValidator — 跨引擎一致性校验器
 *
 * 在提案写入（stageProposals）之前自动检查：
 * 1. 提案中引用的角色名是否在角色引擎的 confirmed 条目中存在
 * 2. 提案中引用的势力名是否在势力引擎的 confirmed 条目中存在
 * 3. 提案中引用的地点名是否在地理引擎的 confirmed 条目中存在
 * 4. ... 所有跨引擎引用
 *
 * 防止 LLM 编造不存在的名称写入数据库。
 *
 * 设计原则：
 * - 校验失败 = WARNING（日志 + 标记），不阻塞提案写入
 *   （因为有些引用指向尚未确认的引擎输出，属于合法情况）
 * - 每个引擎定义自己的"跨引擎引用字段"映射
 * - 校验在 stageProposals 中自动执行
 */

import { db, settingItems } from "@narrative-os/database";
import { eq, and } from "drizzle-orm";
import type { Proposal, ItemBlueprint, RelationBlueprint } from "@narrative-os/engines";
import { ENGINE_REGISTRY } from "@narrative-os/engines";
import { fuzzyMatchInCandidates } from "../shared";

/** 跨引擎引用字段定义：哪些引擎的哪些字段引用了哪些目标引擎的名称 */
interface CrossRefField {
  /** 包含此引用字段的 proposal type */
  sourceType: string;
  /** 字段路径（如 "faction"、"location"、"headquarters"） */
  fieldPath: string;
  /** 字段是单值还是数组 */
  isArray: boolean;
  /** 期望的目标引擎名称（如 "faction"、"geography"），用于更精确的校验 */
  expectedTargetEngine?: string;
}

/**
 * 跨引擎引用字段映射表。
 *
 * 每个条目定义了：当 proposal.type === sourceType 时，
 * items[].content[fieldPath] 中的名称必须存在于目标引擎的 confirmed 条目中。
 *
 * 维护方式：
 * 1. 手动条目在此定义（覆盖所有引擎的跨引擎引用字段）
 * 2. buildCrossRefFields() 会将手动条目与 ENGINE_REGISTRY.outputFields 自动合并
 * 3. 新增引擎的跨引擎引用字段应同时在 ENGINE_REGISTRY.outputFields 和此表中注册
 */
const MANUAL_CROSS_REF_FIELDS: CrossRefField[] = [
  // ── character → faction / geography / race / power-system ──
  { sourceType: "character", fieldPath: "faction", isArray: false, expectedTargetEngine: "faction" },
  { sourceType: "character", fieldPath: "location", isArray: false, expectedTargetEngine: "geography" },
  { sourceType: "character", fieldPath: "race", isArray: false, expectedTargetEngine: "race" },
  { sourceType: "character", fieldPath: "power_level", isArray: false, expectedTargetEngine: "power-system" },

  // ── faction → geography ──
  { sourceType: "faction", fieldPath: "headquarters", isArray: false, expectedTargetEngine: "geography" },
  { sourceType: "faction", fieldPath: "territory", isArray: true, expectedTargetEngine: "geography" },
  { sourceType: "faction", fieldPath: "allies", isArray: true },
  { sourceType: "faction", fieldPath: "enemies", isArray: true },

  // ── item-system → character / geography / faction ──
  { sourceType: "item_system", fieldPath: "current_owner", isArray: false, expectedTargetEngine: "character" },
  { sourceType: "item_system", fieldPath: "location", isArray: false, expectedTargetEngine: "geography" },

  // ── conflict → faction / character ──
  { sourceType: "conflict", fieldPath: "parties", isArray: true },
  { sourceType: "conflict", fieldPath: "affected_parties", isArray: true },

  // ── history → faction / geography ──
  { sourceType: "history", fieldPath: "dominant_faction", isArray: false, expectedTargetEngine: "faction" },
  { sourceType: "history", fieldPath: "involved_parties", isArray: true },
  { sourceType: "history", fieldPath: "location", isArray: false, expectedTargetEngine: "geography" },
  { sourceType: "history", fieldPath: "affected_area", isArray: true, expectedTargetEngine: "geography" },
  { sourceType: "history", fieldPath: "faction_affiliation", isArray: false, expectedTargetEngine: "faction" },

  // ── race → geography ──
  { sourceType: "race", fieldPath: "distribution", isArray: true, expectedTargetEngine: "geography" },
  { sourceType: "race", fieldPath: "habitat", isArray: true, expectedTargetEngine: "geography" },

  // ── culture → geography / faction / race ──
  { sourceType: "culture", fieldPath: "spoken_in", isArray: true, expectedTargetEngine: "geography" },
  { sourceType: "culture", fieldPath: "used_by", isArray: true },
  { sourceType: "culture", fieldPath: "followers", isArray: true },
  { sourceType: "culture", fieldPath: "holy_sites", isArray: true, expectedTargetEngine: "geography" },
  { sourceType: "culture", fieldPath: "celebrated_by", isArray: true },
  { sourceType: "culture", fieldPath: "popular_in", isArray: true, expectedTargetEngine: "geography" },
  { sourceType: "culture", fieldPath: "enforced_by", isArray: false },

  // ── technique → power-system / faction / geography ──
  { sourceType: "technique", fieldPath: "required_realm", isArray: false, expectedTargetEngine: "power-system" },
  { sourceType: "technique", fieldPath: "taught_by", isArray: true, expectedTargetEngine: "faction" },
  { sourceType: "technique", fieldPath: "max_realm", isArray: false, expectedTargetEngine: "power-system" },
  { sourceType: "technique", fieldPath: "inherited_by", isArray: true, expectedTargetEngine: "faction" },
  { sourceType: "technique", fieldPath: "practiced_in", isArray: true, expectedTargetEngine: "geography" },
  { sourceType: "technique", fieldPath: "ingredient_origins", isArray: true, expectedTargetEngine: "geography" },

  // ── power-system → geography ──
  { sourceType: "power_system", fieldPath: "source_regions", isArray: true, expectedTargetEngine: "geography" },
  { sourceType: "power_system", fieldPath: "dominant_regions", isArray: true, expectedTargetEngine: "geography" },

  // ── economy → geography / faction ──
  { sourceType: "economy", fieldPath: "source_regions", isArray: true, expectedTargetEngine: "geography" },
  { sourceType: "economy", fieldPath: "controlled_by", isArray: true, expectedTargetEngine: "faction" },
  { sourceType: "economy", fieldPath: "issued_by", isArray: false, expectedTargetEngine: "faction" },
  { sourceType: "economy", fieldPath: "origin_point", isArray: false, expectedTargetEngine: "geography" },
  { sourceType: "economy", fieldPath: "route_points", isArray: true, expectedTargetEngine: "geography" },
  { sourceType: "economy", fieldPath: "location", isArray: false, expectedTargetEngine: "geography" },
  { sourceType: "economy", fieldPath: "operated_by", isArray: false, expectedTargetEngine: "faction" },
  { sourceType: "economy", fieldPath: "headquarters", isArray: false, expectedTargetEngine: "geography" },
  { sourceType: "economy", fieldPath: "route_controlled_by", isArray: true, expectedTargetEngine: "faction" },

  // ── causality → history / faction / character / geography / conflict ──
  { sourceType: "causality", fieldPath: "trigger_event", isArray: false, expectedTargetEngine: "history" },
  { sourceType: "causality", fieldPath: "intermediate_events", isArray: true, expectedTargetEngine: "history" },
  { sourceType: "causality", fieldPath: "final_effect", isArray: false, expectedTargetEngine: "history" },
  { sourceType: "causality", fieldPath: "involved_factions", isArray: true, expectedTargetEngine: "faction" },
  { sourceType: "causality", fieldPath: "involved_characters", isArray: true, expectedTargetEngine: "character" },
  { sourceType: "causality", fieldPath: "source_event", isArray: false, expectedTargetEngine: "history" },
  { sourceType: "causality", fieldPath: "propagation_path", isArray: true, expectedTargetEngine: "geography" },
  { sourceType: "causality", fieldPath: "decision_maker", isArray: false },
  { sourceType: "causality", fieldPath: "related_conflicts", isArray: true, expectedTargetEngine: "conflict" },
  { sourceType: "causality", fieldPath: "locations_involved", isArray: true, expectedTargetEngine: "geography" },

  // ── rules → geography / faction / power-system / culture / history ──
  { sourceType: "rules", fieldPath: "applicable_regions", isArray: true, expectedTargetEngine: "geography" },
  { sourceType: "rules", fieldPath: "established_by", isArray: true, expectedTargetEngine: "faction" },
  { sourceType: "rules", fieldPath: "constrains_power", isArray: true, expectedTargetEngine: "power-system" },
  { sourceType: "rules", fieldPath: "related_customs", isArray: true, expectedTargetEngine: "culture" },
  { sourceType: "rules", fieldPath: "origin_event", isArray: false, expectedTargetEngine: "history" },

  // ── geography → tone（地理环境受世界观基调影响） ──
  { sourceType: "geography", fieldPath: "prevailing_mood", isArray: false, expectedTargetEngine: "tone" },
  { sourceType: "geography", fieldPath: "tone_influence", isArray: false, expectedTargetEngine: "tone" },
  { sourceType: "geography", fieldPath: "atmospheric_tone", isArray: false, expectedTargetEngine: "tone" },

  // ── story-blueprint → (引用几乎所有东西) ──
  { sourceType: "story_blueprint", fieldPath: "world_elements_integration", isArray: false },

  // ── foreshadowing → story-blueprint / character / item-system / history / causality ──
  { sourceType: "foreshadowing", fieldPath: "related_entity", isArray: false },
  { sourceType: "foreshadowing", fieldPath: "combined_with", isArray: true },
];

/**
 * 构建最终的跨引擎引用字段映射表。
 * 合并手动维护的条目 + 从 ENGINE_REGISTRY.outputFields 自动生成的条目。
 * 会自动检查哪些引擎缺少跨引擎引用定义并发出警告。
 */
function buildCrossRefFields(): CrossRefField[] {
  const fields = [...MANUAL_CROSS_REF_FIELDS];

  // 从 ENGINE_REGISTRY.outputFields 自动合并跨引擎引用字段
  for (const def of ENGINE_REGISTRY) {
    if (!def.outputFields) continue;
    for (const [targetEngine, fieldDefs] of Object.entries(def.outputFields)) {
      for (const fd of fieldDefs) {
        // 检查是否已存在（去重）
        const exists = fields.some(
          (f) => f.sourceType === def.settingType && f.fieldPath === fd.field
        );
        if (!exists) {
          fields.push({
            sourceType: def.settingType,
            fieldPath: fd.field,
            isArray: fd.type.endsWith("[]"),
            expectedTargetEngine: targetEngine,
          });
        }
      }
    }
  }

  // 开发时检查：警告缺少跨引擎引用配置的引擎
  if (process.env.NODE_ENV !== "production") {
    const coveredTypes = new Set(fields.map((f) => f.sourceType));
    for (const def of ENGINE_REGISTRY) {
      if (def.engineGroup !== "world") continue;
      if (!coveredTypes.has(def.settingType) && def.dependsOn.length > 0) {
        console.warn(
          `[cross-engine-validator] 世界引擎 "${def.name}" (type=${def.settingType}) ` +
          `依赖 ${def.dependsOn.join(", ")}，但 CROSS_REF_FIELDS 中无对应条目。` +
          `请添加跨引擎引用字段定义，或在 engine-config 的 outputFields 中声明。`
        );
      }
    }
  }

  return fields;
}

/** 跨引擎引用字段映射表（延迟初始化） */
let _crossRefFields: CrossRefField[] | null = null;
function getCrossRefFields(): CrossRefField[] {
  if (!_crossRefFields) _crossRefFields = buildCrossRefFields();
  return _crossRefFields;
}

/** 校验结果 */
export interface CrossRefValidationResult {
  /** 提案 ID（暂存时为 temporory，实际为 proposal ID） */
  proposalTitle: string;
  /** 来源引擎 */
  sourceNode: string;
  /** 校验通过 */
  valid: boolean;
  /** 无法解析的引用列表 */
  brokenRefs: BrokenReference[];
}

export interface BrokenReference {
  /** 包含引用的条目名 */
  itemName: string;
  /** 字段路径 */
  fieldPath: string;
  /** 无法解析的名称 */
  unresolvedName: string;
  /** 期望的目标引擎（如有） */
  expectedTargetEngine?: string;
  /** 当前已确认的候选名称（最相似的 3 个） */
  suggestions: string[];
  /** 最佳修正名称（置信度 >= 2 的前缀匹配建议，或置信度 = 1 的包含匹配兜底） */
  fixName: string | null;
  /** 修正置信度：3=前缀完全匹配 2=目标名称以前缀开头 1=包含匹配 0=无建议 */
  fixConfidence: number;
}

/**
 * NameRegistry — 项目已确认名称的全量索引
 *
 * 从 setting_items 中加载所有 confirmed 条目的名称，
 * 按 engineSource 和 type 分组以供快速 lookup。
 */
class NameRegistry {
  /** 全部名称集合（小写归一化） */
  private allNames = new Set<string>();
  /** 原始名称 → 归一化名称 */
  private normalizedMap = new Map<string, string>();
  /** 按引擎分组的名称 */
  private byEngine = new Map<string, Set<string>>();

  add(name: string, engineSource: string | null) {
    if (!name || name.trim().length === 0) return;
    const normalized = name.trim().toLowerCase();
    this.allNames.add(normalized);
    this.normalizedMap.set(normalized, name.trim());

    const engine = engineSource || "unknown";
    if (!this.byEngine.has(engine)) {
      this.byEngine.set(engine, new Set());
    }
    this.byEngine.get(engine)!.add(normalized);
  }

  /** 检查名称是否存在（大小写不敏感） */
  exists(name: string): boolean {
    return this.allNames.has(name.trim().toLowerCase());
  }

  /** 在指定引擎范围内检查是否存在 */
  existsInEngine(name: string, engine: string): boolean {
    const engineNames = this.byEngine.get(engine);
    if (!engineNames) return false;
    return engineNames.has(name.trim().toLowerCase());
  }

  /** 获取相似名称（用于纠错，返回带评分的结果） */
  getSuggestions(name: string, engine?: string, limit = 3): { name: string; score: number }[] {
    const target = name.trim().toLowerCase();
    const pool = engine
      ? Array.from(this.byEngine.get(engine) || [])
      : Array.from(this.allNames);

    // 简单相似度：前缀匹配 > 包含匹配
    const scored = pool
      .filter((n) => n !== target)
      .map((n) => {
        let score = 0;
        if (n.startsWith(target)) score = 3;
        else if (target.startsWith(n)) score = 2;
        else if (n.includes(target) || target.includes(n)) score = 1;
        return { name: this.normalizedMap.get(n) || n, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  }

  /** 获取最佳修正建议 */
  getBestFix(name: string, engine?: string): { name: string; confidence: number } | null {
    const suggestions = this.getSuggestions(name, engine, 1);
    if (suggestions.length === 0) return null;
    return { name: suggestions[0].name, confidence: suggestions[0].score };
  }

  get size(): number {
    return this.allNames.size;
  }
}

/**
 * 在候选名称集合中做模糊匹配。
 * 用于同提案内条目名称的纠错 — LLM 生成的 relation 引用的名称
 * 可能与 items[].name 不完全一致（如多了后缀、少了前缀等）。
 *
 * 置信度规则（与 shared.ts 中的 fuzzyMatchInCandidates 一致）：
 * - 3: 候选名以目标名开头（目标名是候选名的前缀）
 * - 2: 目标名以候选名开头（候选名是目标名的前缀）
 * - 1: 候选名与目标名互相包含
 */

/**
 * 从数据库中加载项目的完整名称注册表。
 * 从数据库中加载项目的完整名称注册表。
 */
async function buildNameRegistry(projectId: string): Promise<NameRegistry> {
  const registry = new NameRegistry();

  const items = await db
    .select({
      name: settingItems.name,
      engineSource: settingItems.engineSource,
    })
    .from(settingItems)
    .where(
      and(
        eq(settingItems.projectId, projectId),
        eq(settingItems.status, "confirmed")
      )
    );

  for (const item of items) {
    registry.add(item.name, item.engineSource);
  }

  return registry;
}

/**
 * 对一批提案执行跨引擎一致性校验。
 *
 * @returns 校验结果列表（每个 proposal 一个结果）
 */
export async function validateCrossReferences(
  projectId: string,
  proposals: Proposal[],
  sourceNode: string
): Promise<CrossRefValidationResult[]> {
  const registry = await buildNameRegistry(projectId);

  // 如果没有已确认的条目，跳过校验（第一个引擎运行时没有参考数据）
  if (registry.size === 0) return [];

  const results: CrossRefValidationResult[] = [];

  for (const proposal of proposals) {
    if (proposal.type === "error") continue;

    const brokenRefs: BrokenReference[] = [];
    const payload = (proposal.content?.payload || {}) as Record<string, unknown>;
    const items = (payload?.items || []) as ItemBlueprint[];
    const relations = (payload?.relations || []) as RelationBlueprint[];

    // 1. 校验 items[].content 中的跨引擎引用字段
    const refFields = getCrossRefFields().filter((f) => f.sourceType === proposal.type);

    for (const item of items) {
      const content = item.content as Record<string, unknown> | undefined;
      if (!content) continue;

      for (const refField of refFields) {
        const rawValue = content[refField.fieldPath];
        if (rawValue == null || rawValue === "") continue;

        const values = refField.isArray
          ? (Array.isArray(rawValue) ? rawValue : [rawValue]).map(String)
          : [String(rawValue)];

        for (let val of values) {
          if (!val || val.trim().length === 0) continue;

          // 剥离括号描述："名称（描述）" 或 "名称(描述)" → "名称"
          // 同时处理全角和半角括号，保留原始值用于错误报告
          const originalVal = val;
          val = val.replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "").trim();
          if (!val || val.trim().length === 0) continue;

          // 检查名称是否存在（先尝试完整值，再尝试剥离后的值）
          const exists = refField.expectedTargetEngine
            ? registry.existsInEngine(originalVal, refField.expectedTargetEngine) || registry.existsInEngine(val, refField.expectedTargetEngine)
            : registry.exists(originalVal) || registry.exists(val);

          if (!exists) {
            const bestFix = registry.getBestFix(val, refField.expectedTargetEngine);
            brokenRefs.push({
              itemName: item.name,
              fieldPath: refField.fieldPath,
              unresolvedName: val,
              expectedTargetEngine: refField.expectedTargetEngine,
              suggestions: registry.getSuggestions(val, refField.expectedTargetEngine).map((s) => s.name),
              fixName: bestFix?.name || null,
              fixConfidence: bestFix?.confidence || 0,
            });
          }
        }
      }
    }

    // 2. 校验 relations 中的 sourceName 和 targetName
    // 三层匹配策略：同提案精确匹配 → DB精确匹配 → 同提案模糊匹配 → DB模糊匹配
    const currentItemNames = new Set(items.map((i) => i.name));
    const currentItemList = items.map((i) => i.name);
    for (const rel of relations) {
      // —— sourceName 校验 ——
      if (!currentItemNames.has(rel.sourceName) && !registry.exists(rel.sourceName)) {
        // 先尝试同提案内模糊匹配（LLM 经常在 relation 中写缩写或变体）
        const localFix = fuzzyMatchInCandidates(rel.sourceName, currentItemList);
        if (localFix && localFix.confidence >= 1) {
          brokenRefs.push({
            itemName: `relation(${rel.label})`,
            fieldPath: "sourceName",
            unresolvedName: rel.sourceName,
            suggestions: [localFix.name],
            fixName: localFix.name,
            fixConfidence: localFix.confidence,
          });
        } else {
          // DB 模糊匹配兜底
          const bestFix = registry.getBestFix(rel.sourceName);
          brokenRefs.push({
            itemName: `relation(${rel.label})`,
            fieldPath: "sourceName",
            unresolvedName: rel.sourceName,
            suggestions: registry.getSuggestions(rel.sourceName).map((s) => s.name),
            fixName: bestFix?.name || null,
            fixConfidence: bestFix?.confidence || 0,
          });
        }
      }
      // —— targetName 校验 ——
      if (!currentItemNames.has(rel.targetName) && !registry.exists(rel.targetName)) {
        const localFix = fuzzyMatchInCandidates(rel.targetName, currentItemList);
        if (localFix && localFix.confidence >= 1) {
          brokenRefs.push({
            itemName: `relation(${rel.label})`,
            fieldPath: "targetName",
            unresolvedName: rel.targetName,
            suggestions: [localFix.name],
            fixName: localFix.name,
            fixConfidence: localFix.confidence,
          });
        } else {
          const bestFix = registry.getBestFix(rel.targetName);
          brokenRefs.push({
            itemName: `relation(${rel.label})`,
            fieldPath: "targetName",
            unresolvedName: rel.targetName,
            suggestions: registry.getSuggestions(rel.targetName).map((s) => s.name),
            fixName: bestFix?.name || null,
            fixConfidence: bestFix?.confidence || 0,
          });
        }
      }
    }

    results.push({
      proposalTitle: proposal.title,
      sourceNode,
      valid: brokenRefs.length === 0,
      brokenRefs,
    });
  }

  return results;
}
