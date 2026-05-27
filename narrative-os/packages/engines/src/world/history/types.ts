/**
 * 历史年表 — 类型定义
 *
 * 覆盖纪元划分、重大历史事件、历史人物、灾难/浩劫
 * 为世界观提供时间纵深，为冲突提供历史根源
 */
export type HistorySubtype = "era" | "event" | "historical_figure" | "cataclysm";

export interface HistoryItem {
  subtype: HistorySubtype;
  name: string;
  summary: string;
  content: {
    // ── era（纪元/时代）──
    /** 纪元起始标志事件 */
    era_start_event?: string;
    /** 纪元结束标志事件 */
    era_end_event?: string;
    /** 该纪元的时代特征 */
    era_characteristics?: string[];
    /** 统治势力（必须使用已确认的势力名） */
    dominant_faction?: string;
    /** 科技/文明水平 */
    civilization_level?: string;
    /** 纪元大约持续时长（如：约3000年） */
    approximate_duration?: string;

    // ── event（历史事件）──
    /** 事件发生的大致时间点（如：星历1542年 / 约3000年前） */
    timeline_position?: string;
    /** 事件所属纪元（必须使用本引擎中已确认的纪元名） */
    era_belong_to?: string;
    /** 事件类型：war/discovery/foundation/collapse/treaty/rebellion/migration/diplomatic/natural */
    event_type?: "war" | "discovery" | "foundation" | "collapse" | "treaty" | "rebellion" | "migration" | "diplomatic" | "natural";
    /** 参与方（必须使用已确认的势力名/角色名/种族名） */
    involved_parties?: string[];
    /** 事件经过简述 */
    description?: string;
    /** 事件造成的后续影响 */
    consequences?: string[];
    /** 发生地点（必须使用地理引擎中已确认的地点名） */
    location?: string;

    // ── historical_figure（历史人物）──
    /** 活跃时代（必须使用本引擎中已确认的纪元名或大致时间点） */
    era_of_activity?: string;
    /** 历史身份/称号 */
    historical_role?: string;
    /** 主要成就 */
    achievements?: string[];
    /** 所属势力（必须使用已确认的势力名） */
    faction_affiliation?: string;
    /** 对后世的影响 */
    legacy?: string;
    /** 与当前故事的可能关联 */
    story_relevance?: string;

    // ── cataclysm（灾难/浩劫）──
    /** 灾难类型：war/natural/magical/plague/cosmic/divine */
    cataclysm_type?: "war" | "natural" | "magical" | "plague" | "cosmic" | "divine";
    /** 影响范围（必须使用已确认的区域名） */
    affected_area?: string[];
    /** 伤亡/损失程度 */
    devastation_scale?: string;
    /** 是否留下遗迹/遗物 */
    remnants?: string;
    /** 对当前世界的持续影响 */
    lingering_effects?: string;
  };
}

export interface HistoryRelation {
  sourceName: string;
  targetName: string;
  relationType: "hierarchy" | "dependency" | "reference" | "opposition" | "affiliation";
  label: string;
}

export interface HistoryPayload {
  name: string;
  items: HistoryItem[];
  relations: HistoryRelation[];
}
