/**
 * 因果引擎 — 类型定义
 *
 * 因果引擎是世界观引擎群的"连接组织"——它不产生新的实体设定，
 * 而是揭示已有实体之间的因果联系、涟漪效应和关键转折点。
 *
 * 核心功能：
 * 1. causal_chain（因果链）：事件A→事件B→...→事件N 的因果序列
 * 2. ripple_effect（涟漪效应）：单一事件向多个领域的扩散传播
 * 3. turning_point（关键转折）：改变世界走向的不可逆决策节点
 *
 * 数据关联（深度集成）：
 * - history.event → 提供因果链的事件节点
 * - faction → 谁是推手、谁是受益者、谁是受害者
 * - character → 关键决策者及其动机
 * - conflict → 因果链驱动/化解的矛盾
 * - economy → 经济原因（资源争夺）和经济后果（贸易中断）
 * - geography → 事件发生的空间锚点
 */
export type CausalitySubtype = "causal_chain" | "ripple_effect" | "turning_point";

export interface CausalityItem {
  subtype: CausalitySubtype;
  name: string;
  summary: string;
  content: {
    // ═══════════════════════════════════════════════
    // causal_chain（因果链）
    // ═══════════════════════════════════════════════
    /** 因果链的起点事件（必须使用history引擎中已确认的事件名） */
    trigger_event?: string;
    /** 因果链中的中间事件序列（按时间顺序，必须使用已确认的事件名） */
    intermediate_events?: string[];
    /** 因果链的最终结果事件（必须使用已确认的事件名） */
    final_effect?: string;
    /** 涉及的势力（必须使用已确认的势力名） */
    involved_factions?: string[];
    /** 涉及的关键角色（必须使用已确认的角色名） */
    involved_characters?: string[];
    /** 因果链横跨的大致时间（如：跨越3个纪元 / 约500年） */
    time_span?: string;
    /** 因果链的必然性评估：inevitable（必然发生）/ contingent（偶然发生）/ overdetermined（多重决定） */
    inevitability?: "inevitable" | "contingent" | "overdetermined";
    /** 可能的分叉路径——如果在某个节点做了不同选择，历史可能如何不同 */
    alternative_paths?: string[];
    /** 因果链当前所处的阶段：ongoing（仍在发展中）/ climax（高潮）/ resolved（已解决）/ dormant（潜伏中） */
    current_stage?: "ongoing" | "climax" | "resolved" | "dormant";
    /** 尚未解决的张力/未引爆的后果 */
    unresolved_tensions?: string[];
    /** 这条因果链涉及的地理位置（必须使用已确认的区域名/地点名） */
    locations_involved?: string[];

    // ═══════════════════════════════════════════════
    // ripple_effect（涟漪效应）
    // ═══════════════════════════════════════════════
    /** 涟漪的源头事件（必须使用已确认的事件名） */
    source_event?: string;
    /** 受影响的具体领域及影响方式 */
    affected_domains?: Array<{
      domain: "political" | "economic" | "cultural" | "military" | "social" | "power_balance" | "geographic" | "religious";
      impact: string;
      severity: "mild" | "moderate" | "severe" | "transformative";
    }>;
    /** 涟漪在地理上的传播路径（必须使用已确认的区域名） */
    propagation_path?: string[];
    /** 涟漪随距离/时间的强度衰减描述 */
    intensity_decay?: string;
    /** 意料之外的连锁反应 */
    unexpected_consequences?: string[];
    /** 至今仍未消散的涟漪影响 */
    lingering_effects?: string[];

    // ═══════════════════════════════════════════════
    // turning_point（关键转折）
    // ═══════════════════════════════════════════════
    /** 转折前的世界/势力/角色状态 */
    before_state?: string;
    /** 转折后的世界/势力/角色状态 */
    after_state?: string;
    /** 做出关键决策的角色/势力（必须使用已确认的名称） */
    decision_maker?: string;
    /** 决策者的核心动机 */
    decision_motive?: string;
    /** 当时可用的其他选择 */
    alternatives?: string[];
    /** 为什么这条路径被选中（外部限制/内部动机/信息不对称/偶然因素） */
    why_this_path?: string;
    /** 不可逆的改变——此转折后永远无法回到之前的状态 */
    irreversible_changes?: string[];
    /** 与此转折关联的矛盾（必须使用已确认的矛盾名） */
    related_conflicts?: string[];
    /** 如果有第二次机会，可能会做不同的选择吗？ */
    retrospective?: string;
  };
}

export interface CausalityRelation {
  sourceName: string;
  targetName: string;
  relationType: "dependency" | "hierarchy" | "reference" | "opposition" | "affiliation";
  label: string;
}

export interface CausalityPayload {
  name: string;
  items: CausalityItem[];
  relations: CausalityRelation[];
}
