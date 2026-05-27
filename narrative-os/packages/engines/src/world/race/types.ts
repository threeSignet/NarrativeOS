/**
 * 种族/生物体系 — 类型定义
 *
 * 覆盖智能种族（人类/精灵/兽人等）、妖兽/魔物、亚种/变体
 * 为角色创建提供种族归属，为地理环境填充生态
 */
export type RaceSubtype = "race" | "beast" | "subrace";

export interface RaceItem {
  subtype: RaceSubtype;
  name: string;
  summary: string;
  content: {
    // ── race（智能种族）──
    /** 外观特征描述 */
    appearance?: string;
    /** 种族天赋/特质 */
    traits?: string[];
    /** 平均寿命 */
    lifespan?: string;
    /** 大致人口规模 */
    population?: string;
    /** 主要分布区域（必须使用地理引擎中已确认的区域名） */
    distribution?: string[];
    /** 元素/能量亲和性 */
    affinity?: string;
    /** 社会结构描述 */
    social_structure?: string;
    /** 与其他种族的关系简述 */
    inter_race_relations?: string;
    /** 种族历史简述 */
    racial_history?: string;

    // ── beast（妖兽/魔物）──
    /** 栖息地（必须使用地理引擎中已确认的地点名） */
    habitat?: string[];
    /** 特殊能力 */
    abilities?: string[];
    /** 威胁等级：low/medium/high/catastrophic */
    threat_level?: "low" | "medium" | "high" | "catastrophic";
    /** 稀有度：common/uncommon/rare/legendary/unique */
    rarity?: "common" | "uncommon" | "rare" | "legendary" | "unique";
    /** 可采集的材料/掉落物 */
    materials?: string[];
    /** 体型描述 */
    size?: string;
    /** 习性描述 */
    behavior?: string;

    // ── subrace（亚种/变体）──
    /** 父种族名称（必须使用本引擎中已创建的种族名） */
    parent_race?: string;
    /** 与主种族的差异 */
    differences?: string;
    /** 变异原因 */
    mutation_cause?: string;
  };
}

export interface RaceRelation {
  sourceName: string;
  targetName: string;
  relationType: "affiliation" | "opposition" | "hierarchy" | "geographic" | "dependency" | "reference";
  label: string;
}

export interface RacePayload {
  name: string;
  items: RaceItem[];
  relations: RaceRelation[];
}
