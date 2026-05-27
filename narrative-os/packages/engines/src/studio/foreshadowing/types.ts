/**
 * 伏笔追踪引擎 — 类型定义
 *
 * 伏笔是长篇创作的"隐形骨架"——提前埋设线索、后续回收、
 * 让读者产生"原来如此"的满足感。
 *
 * 这是设计文档第4.1.3节定义的"工作室引擎8个子系统"之一。
 *
 * 核心功能：
 * 1. plant（埋设伏笔）：在特定章节预先放置线索
 * 2. payoff（回收伏笔）：在后续章节揭示伏笔的真相
 * 3. red_herring（烟雾弹）：故意误导读者的虚假线索
 *
 * 数据关联（深度集成）：
 * - story-blueprint: 伏笔锚定到蓝图的主线弧和转折点
 * - character: 伏笔可能关于角色的真实身份/隐藏动机/未来转变
 * - item-system: 伏笔可能关于物品的真实作用/隐藏能力
 * - conflict: 伏笔可能关于矛盾的真正根源
 * - history: 伏笔可能关于被遗忘的历史真相
 * - causality: 伏笔的回收往往是因果链中的关键节点
 */
export type ForeshadowingSubtype = "plant" | "payoff" | "red_herring";

export interface ForeshadowingItem {
  subtype: ForeshadowingSubtype;
  name: string;
  summary: string;
  content: {
    // ═══════════════════════════════════════════════
    // 所有 subtype 的公共字段
    // ═══════════════════════════════════════════════
    /** 伏笔的内容描述——埋下的是什么线索（具体的一句话/一个场景/一个物品/一段对话） */
    foreshadowing_content?: string;
    /** 伏笔类型：character（人物伏笔）/ event（事件伏笔）/ item（物品伏笔）/ information（信息伏笔）/ relationship（关系伏笔） */
    foreshadowing_type?: "character" | "event" | "item" | "information" | "relationship";
    /** 伏笔的核心"谜题"——读者会产生什么疑问？ */
    mystery_question?: string;
    /** 伏笔的真相——回收时揭示的答案 */
    truth?: string;
    /** 伏笔的隐晦程度：obvious（大多数读者会注意到）/ subtle（细心读者会注意到）/ hidden（几乎不会被注意到，回收时才恍然大悟） */
    subtlety?: "obvious" | "subtle" | "hidden";

    // ═══════════════════════════════════════════════
    // plant（埋设）— 伏笔的埋设点
    // ═══════════════════════════════════════════════
    /** 预计埋设的卷号（从1开始） */
    plant_volume?: number;
    /** 预计埋设的章号范围（如：第3-5章之间） */
    plant_chapter_range?: string;
    /** 埋设方式：dialogue（对话中透露）/ description（环境描写中暗示）/ action（角色行为中流露）/ narration（旁白中提示）/ item_appearance（物品出现） */
    plant_method?: "dialogue" | "description" | "action" | "narration" | "item_appearance";
    /** 埋设时角色的反应/对话/行为的具体建议 */
    plant_suggestion?: string;
    /** 关联的设定条目（必须使用已确认的角色名/物品名/事件名等） */
    related_entity?: string;

    // ═══════════════════════════════════════════════
    // payoff（回收）— 伏笔的回收点
    // ═══════════════════════════════════════════════
    /** 预计回收的卷号（从1开始） */
    payoff_volume?: number;
    /** 预计回收的章号范围 */
    payoff_chapter_range?: string;
    /** 回收方式：revelation（直接揭示）/ twist（反转）/ gradual（逐渐明朗）/ callback（呼应前文）/ combination（与其他伏笔合并回收） */
    payoff_method?: "revelation" | "twist" | "gradual" | "callback" | "combination";
    /** 回收时的建议写法 */
    payoff_suggestion?: string;
    /** 回收时读者应该感受到的情绪：surprise（惊讶）/ satisfaction（满足）/ shock（震撼）/ sadness（悲伤）/ enlightenment（恍然大悟） */
    payoff_emotion?: "surprise" | "satisfaction" | "shock" | "sadness" | "enlightenment";
    /** 与此伏笔组合回收的其他伏笔名（多个伏笔共同揭示一个真相） */
    combined_with?: string[];

    // ═══════════════════════════════════════════════
    // red_herring（烟雾弹）— 故意误导
    // ═══════════════════════════════════════════════
    /** 烟雾弹指向的错误结论 */
    false_lead?: string;
    /** 为什么这个错误结论看起来合理 */
    why_plausible?: string;
    /** 真正的真相是什么（用来保护的真实信息） */
    protected_truth?: string;
    /** 烟雾弹何时被揭穿 */
    reveal_timing?: string;

    // ═══════════════════════════════════════════════
    // 状态追踪
    // ═══════════════════════════════════════════════
    /** 当前状态：planned（已规划）/ planted（已埋设）/ partially_revealed（部分揭示）/ paid_off（已回收）/ abandoned（已废弃——故事改向不需要这个伏笔了） */
    status?: "planned" | "planted" | "partially_revealed" | "paid_off" | "abandoned";
    /** 重要性评级：critical（核心伏笔，不回收故事不完整）/ major（重要伏笔，显著提升阅读体验）/ minor（锦上添花） */
    importance?: "critical" | "major" | "minor";
    /** 如果 status=abandoned，废弃原因是什么 */
    abandon_reason?: string;
  };
}

export interface ForeshadowingRelation {
  sourceName: string;
  targetName: string;
  relationType: "dependency" | "reference" | "hierarchy" | "opposition";
  label: string;
}

export interface ForeshadowingPayload {
  name: string;
  items: ForeshadowingItem[];
  relations: ForeshadowingRelation[];
}
