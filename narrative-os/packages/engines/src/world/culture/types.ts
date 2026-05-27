/**
 * 文化体系 — 类型定义
 *
 * 覆盖语言、宗教/信仰、节日庆典、艺术形式、风俗习惯、禁忌
 * 为势力增加文化深度，为角色提供行为准则
 */
export type CultureSubtype = "language" | "religion" | "festival" | "art_form" | "custom" | "taboo";

export interface CultureItem {
  subtype: CultureSubtype;
  name: string;
  summary: string;
  content: {
    // ── language（语言）──
    /** 语系归属 */
    language_family?: string;
    /** 使用区域（必须使用地理引擎中已确认的区域名） */
    spoken_in?: string[];
    /** 使用势力/种族（必须使用已确认的势力名或种族名） */
    used_by?: string[];
    /** 文字系统描述 */
    writing_system?: string;
    /** 语言特色（如敬语体系、禁忌词汇等） */
    features?: string;
    /** 是否为通用语 */
    is_common_tongue?: boolean;

    // ── religion（宗教/信仰）──
    /** 信仰类型：monotheism/polytheism/ancestor_worship/animism/philosophy/cult */
    faith_type?: "monotheism" | "polytheism" | "ancestor_worship" | "animism" | "philosophy" | "cult";
    /** 信仰对象/神祇名称 */
    deities?: string[];
    /** 信徒群体（必须使用已确认的势力名或种族名） */
    followers?: string[];
    /** 核心教义 */
    core_doctrines?: string[];
    /** 宗教组织/教会结构 */
    religious_organization?: string;
    /** 圣地（必须使用地理引擎中已确认的地点名） */
    holy_sites?: string[];
    /** 对世俗权力的影响程度 */
    political_influence?: string;

    // ── festival（节日/庆典）──
    /** 节日日期/周期 */
    timing?: string;
    /** 庆祝方式 */
    celebrations?: string[];
    /** 节日起源/纪念意义 */
    origin_meaning?: string;
    /** 庆祝群体（必须使用已确认的名称） */
    celebrated_by?: string[];
    /** 与宗教/历史的关联 */
    religious_connection?: string;

    // ── art_form（艺术形式）──
    /** 艺术类型：music/dance/painting/sculpture/literature/theater/architecture/cuisine */
    art_type?: "music" | "dance" | "painting" | "sculpture" | "literature" | "theater" | "architecture" | "cuisine";
    /** 艺术特色描述 */
    style_description?: string;
    /** 代表性艺术家/流派 */
    notable_examples?: string;
    /** 流行区域（必须使用已确认的区域名） */
    popular_in?: string[];

    // ── custom（风俗/习惯）──
    /** 风俗类型：greeting/marriage/funeral/coming_of_age/daily/seasonal */
    custom_type?: "greeting" | "marriage" | "funeral" | "coming_of_age" | "daily" | "seasonal";
    /** 具体做法 */
    practice?: string;
    /** 风俗含义 */
    meaning?: string;

    // ── taboo（禁忌）──
    /** 违反禁忌的后果 */
    consequence?: string;
    /** 执行者（谁来处罚，必须使用已确认的势力名/角色名） */
    enforced_by?: string;
  };
}

export interface CultureRelation {
  sourceName: string;
  targetName: string;
  relationType: "affiliation" | "reference" | "hierarchy" | "opposition" | "geographic" | "dependency";
  label: string;
}

export interface CulturePayload {
  name: string;
  items: CultureItem[];
  relations: CultureRelation[];
}
