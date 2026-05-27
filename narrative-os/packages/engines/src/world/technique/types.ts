/**
 * 功法/技能体系 — 类型定义
 *
 * 覆盖具体功法/技能、修炼法门、丹药配方、阵法
 * 是力量体系（power-system）的细化和具象化
 * 为角色的能力成长提供具体的路径和选择
 */
export type TechniqueSubtype = "technique" | "cultivation_method" | "pill" | "formation";

export interface TechniqueItem {
  subtype: TechniqueSubtype;
  name: string;
  summary: string;
  content: {
    // ── technique（具体功法/技能/法术）──
    /** 功法类型：attack/defense/support/healing/movement/craft/mental/seal */
    technique_type?: "attack" | "defense" | "support" | "healing" | "movement" | "craft" | "mental" | "seal";
    /** 修炼所需的最低境界（必须使用力量体系中已确认的境界名） */
    required_realm?: string;
    /** 元素/属性 */
    element?: string;
    /** 具体效果描述 */
    effects?: string[];
    /** 使用代价/副作用 */
    cost?: string;
    /** 功法起源（谁创造的，必须使用已确认的势力名/角色名） */
    origin?: string;
    /** 前置功法（学习此功法前必须先掌握的技能名） */
    prerequisite_techniques?: string[];
    /** 传授势力（哪些势力会传授此功法，必须使用已确认的势力名） */
    taught_by?: string[];
    /** 功法等级/品阶 */
    grade?: string;

    // ── cultivation_method（修炼法门）──
    /** 法门类型：meditation/body_refining/soul_cultivation/dual_cultivation/bloodline/artifact_based */
    method_type?: "meditation" | "body_refining" | "soul_cultivation" | "dual_cultivation" | "bloodline" | "artifact_based";
    /** 适合的体质/天赋要求 */
    requirements?: string;
    /** 修炼速度描述 */
    cultivation_speed?: string;
    /** 上限境界（修炼到顶能达到的最高境界名） */
    max_realm?: string;
    /** 修炼风险/走火入魔的可能性 */
    risks?: string;
    /** 传承势力（必须使用已确认的势力名） */
    inherited_by?: string[];

    // ── pill（丹药）──
    /** 丹药类型：breakthrough/healing/poison/enhancement/longevity/cultivation_boost */
    pill_type?: "breakthrough" | "healing" | "poison" | "enhancement" | "longevity" | "cultivation_boost";
    /** 主要材料（必须使用种族引擎中已确认的妖兽材料名或地理引擎中的资源名） */
    ingredients?: string[];
    /** 炼制难度 */
    refinement_difficulty?: string;
    /** 使用限制/副作用 */
    side_effects?: string;
    /** 能炼制此丹的势力/人物 */
    refinable_by?: string[];

    // ── formation（阵法）──
    /** 阵法类型：defense/attack/teleportation/concealment/gathering/sealing */
    formation_type?: "defense" | "attack" | "teleportation" | "concealment" | "gathering" | "sealing";
    /** 布阵需要的材料 */
    required_materials?: string[];
    /** 阵法规模：personal/small/medium/large/city_scale */
    formation_scale?: "personal" | "small" | "medium" | "large" | "city_scale";
    /** 阵法持续时间 */
    duration?: string;
    /** 已知的布阵地点（必须使用已确认的地点名） */
    known_locations?: string[];
  };
}

export interface TechniqueRelation {
  sourceName: string;
  targetName: string;
  relationType: "hierarchy" | "dependency" | "reference" | "affiliation" | "opposition";
  label: string;
}

export interface TechniquePayload {
  name: string;
  items: TechniqueItem[];
  relations: TechniqueRelation[];
}
