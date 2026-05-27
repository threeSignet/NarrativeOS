/**
 * 规则引擎 — 类型定义
 *
 * 规则引擎定义世界的"法律体系"——什么可能、什么不可能、什么有条件地可能。
 * 规则是因果链的约束条件，也是角色创意突破的目标。
 *
 * 与 tone.unique_rules 的区别：
 * - tone.unique_rules 是世界观基调层面的"大体感觉"（如"魔法有代价"）
 * - rules 是精细化的具体规则（如"复活术的代价是被复活者剩余寿命的一半
 *   转移给施法者，且每次复活后成功率减半"）
 *
 * 核心功能：
 * 1. world_law（世界法则）：物理/魔法/因果层面的根本法则
 * 2. regional_rule（地域规则）：特定地理区域的特殊规则
 * 3. social_rule（社会规则）：法律、习俗、权力规则
 * 4. power_rule（力量规则）：力量体系的具体约束和边界条件
 *
 * 数据关联（深度集成）：
 * - tone: 规则必须与世界基调一致
 * - geography: 地域规则绑定到具体区域/地点
 * - power-system: 力量规则直接约束境界和能力
 * - culture: 社会规则是文化的制度化表达
 * - history: 某些规则是历史事件的直接后果
 */
export type RulesSubtype = "world_law" | "regional_rule" | "social_rule" | "power_rule";

export interface RulesItem {
  subtype: RulesSubtype;
  name: string;
  summary: string;
  content: {
    // ═══════════════════════════════════════════════
    // 所有 subtype 的公共字段
    // ═══════════════════════════════════════════════
    /** 规则的精确表述（一句话说清楚规则是什么） */
    rule_statement?: string;
    /** 规则的存在理由——为什么会有这条规则（物理必然/神祇设定/历史遗留/社会契约） */
    rationale?: string;
    /** 规则是否有例外？例外是什么？ */
    exceptions?: string[];
    /** 违反规则的后果（具体可量化的惩罚/反噬） */
    violation_consequence?: string;
    /** 谁/什么执行这条规则（自然法则自动执行/势力执行/神祇执行/社会舆论执行） */
    enforced_by?: string;
    /** 是否可以被角色利用/绕过？利用方式是什么？ */
    exploitability?: string;
    /** 规则的适用范围（宇宙全局/星系级/大陆级/区域级/势力内部/个人） */
    scope?: "universal" | "galactic" | "continental" | "regional" | "faction" | "personal";

    // ═══════════════════════════════════════════════
    // world_law（世界法则）— 物理/魔法/因果的根本法则
    // ═══════════════════════════════════════════════
    /** 法则类型：physical（物理法则）/ magical（魔法法则）/ causal（因果法则）/ metaphysical（形而上学法则） */
    law_type?: "physical" | "magical" | "causal" | "metaphysical";
    /** 这条法则是否可以被局部/临时改变 */
    mutability?: "absolute" | "locally_modifiable" | "temporarily_suspendable" | "negotiable";
    /** 与力量体系的关联规则（必须使用已确认的境界名/规则名/体系名） */
    power_system_implications?: string[];

    // ═══════════════════════════════════════════════
    // regional_rule（地域规则）— 特定区域特有的规则
    // ═══════════════════════════════════════════════
    /** 适用此规则的区域（必须使用已确认的区域名/地点名） */
    applicable_regions?: string[];
    /** 规则生效的时间周期（如：仅在月圆之夜/每年冬至/永久生效） */
    temporal_condition?: string;
    /** 进入该区域时是否需要特殊手段来规避此规则 */
    countermeasure?: string;
    /** 该规则的来源事件（必须使用history引擎中已确认的事件名） */
    origin_event?: string;

    // ═══════════════════════════════════════════════
    // social_rule（社会规则）— 法律/习俗/权力规则
    // ═══════════════════════════════════════════════
    /** 规则适用的人群/种族/阶层（必须使用已确认的名称） */
    applicable_to?: string[];
    /** 制定/推行此规则的势力（必须使用已确认的势力名） */
    established_by?: string[];
    /** 社会规则的处罚体系（具体处罚措施） */
    punishment_system?: string;
    /** 不同阶层是否受到不同对待 */
    class_differential?: string;
    /** 与此规则关联的文化习俗（必须使用已确认的文化条目名） */
    related_customs?: string[];

    // ═══════════════════════════════════════════════
    // power_rule（力量规则）— 力量体系的边界和约束
    // ═══════════════════════════════════════════════
    /** 约束的力量体系/境界（必须使用已确认的体系名/境界名） */
    constrains_power?: string[];
    /** 规则类型：limitation（限制）/ cost（代价）/ condition（条件）/ prohibition（禁止） */
    power_rule_type?: "limitation" | "cost" | "condition" | "prohibition";
    /** 如果强行突破此规则会发生什么 */
    breakthrough_consequence?: string;
    /** 已知的突破/绕过此规则的案例（必须使用已确认的角色名/事件名） */
    known_breaches?: string[];
  };
}

export interface RulesRelation {
  sourceName: string;
  targetName: string;
  relationType: "hierarchy" | "dependency" | "reference" | "opposition" | "affiliation";
  label: string;
}

export interface RulesPayload {
  name: string;
  items: RulesItem[];
  relations: RulesRelation[];
}
