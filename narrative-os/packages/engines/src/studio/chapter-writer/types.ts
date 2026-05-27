/**
 * 章节写作引擎 — 类型定义
 *
 * 这是设计文档第4.1.3节定义的工作室引擎最核心的子系统——正文生成。
 * 基于章纲（chapter-outline）、伏笔计划（foreshadowing）、世界设定，
 * 生成场景级的正文草稿。
 *
 * 核心功能：
 * 1. chapter_draft（整章草稿）：基于章纲生成完整的章正文
 * 2. scene_draft（场景草稿）：逐个场景生成，每场景300-800字
 * 3. revision_note（修改建议）：AI对生成内容的自我审查建议
 *
 * 数据关联（深度集成）：
 * - chapter-outline: 章纲定义本章要写什么
 * - foreshadowing: 本章需要埋设/回收哪些伏笔
 * - story-blueprint: 本章在整条主线弧中的位置
 * - 所有世界引擎: 角色/势力/地点/物品/规则需要在正文中正确引用
 */
export type ChapterWriterSubtype = "chapter_draft" | "scene_draft" | "revision_note";

export interface ChapterWriterItem {
  subtype: ChapterWriterSubtype;
  name: string;
  summary: string;
  content: {
    // ═══════════════════════════════════════════════
    // chapter_draft（整章草稿）
    // ═══════════════════════════════════════════════
    /** 章节编号（如：第3卷第15章） */
    chapter_number?: string;
    /** 本章标题 */
    chapter_title?: string;
    /** 预计全章总字数 */
    target_word_count?: number;

    // ═══════════════════════════════════════════════
    // scene_draft（场景草稿）— 核心产出
    // ═══════════════════════════════════════════════
    /** 场景在本章中的序号（从1开始） */
    scene_number?: number;
    /** 场景类型：opening（开篇）/ action（动作）/ dialogue（对话）/ description（描写）/ transition（过渡）/ climax（高潮）/ ending（收尾） */
    scene_type?: "opening" | "action" | "dialogue" | "description" | "transition" | "climax" | "ending";
    /** 场景标题（如：主角初入禁魔死域） */
    scene_title?: string;
    /** 场景正文——实际的文本内容 */
    prose?: string;
    /** 本场景字数 */
    word_count?: number;
    /** 场景的POV角色（必须使用已确认的角色名） */
    pov_character?: string;
    /** 场景发生的地点（必须使用已确认的地点名） */
    scene_location?: string;
    /** 场景中出现的角色（必须使用已确认的角色名） */
    characters_present?: string[];
    /** 本场景引用的世界设定条目（必须使用已确认的条目名） */
    world_references?: string[];
    /** 本场景埋设的伏笔（必须使用foreshadowing引擎中已确认的伏笔名） */
    foreshadowing_planted?: string[];
    /** 本场景回收的伏笔（必须使用已确认的伏笔名） */
    foreshadowing_paid_off?: string[];
    /** 本场景涉及的力量展示（如有境界突破/战斗/施法等，引用已确认的境界名和功法名） */
    power_displays?: string[];
    /** 与前文的呼应——本场景呼应了前面哪些章节/事件 */
    callbacks?: string[];
    /** 场景的情感基调 */
    emotional_tone?: string;
    /** 场景的目标——推动哪个情节线/揭示什么信息/展示什么角色特征 */
    scene_goal?: string;

    // ═══════════════════════════════════════════════
    // revision_note（自我审查建议）
    // ═══════════════════════════════════════════════
    /** 修改建议针对的场景编号 */
    target_scene?: number;
    /** 建议类型：tighten（精简）/ expand（扩展）/ clarify（澄清）/ foreshadowing_missed（遗漏伏笔）/ character_voice（角色语气不一致）/ pacing（节奏问题）/ setting_contradiction（设定矛盾） */
    suggestion_type?: "tighten" | "expand" | "clarify" | "foreshadowing_missed" | "character_voice" | "pacing" | "setting_contradiction";
    /** 修改建议的具体内容 */
    suggestion?: string;
    /** 建议的优先级：must_fix（必须修改）/ should_fix（应该修改）/ nice_to_have（锦上添花） */
    priority?: "must_fix" | "should_fix" | "nice_to_have";
  };
}

export interface ChapterWriterRelation {
  sourceName: string;
  targetName: string;
  relationType: "reference" | "dependency" | "hierarchy";
  label: string;
}

export interface ChapterWriterPayload {
  name: string;
  items: ChapterWriterItem[];
  relations: ChapterWriterRelation[];
}
