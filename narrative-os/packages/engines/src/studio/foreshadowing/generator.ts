import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage } from "../../context";

/**
 * ForeshadowingEngine — 伏笔追踪引擎（工作室引擎）
 *
 * 这是设计文档第4.1.3节定义的工作室引擎8个子系统之一。
 * 伏笔是长篇创作的"隐形骨架"——提前埋设线索、后续回收、
 * 让读者产生"原来如此"的满足感。
 *
 * 核心职责：
 * 1. 基于故事蓝图的关键转折点规划伏笔埋设位置
 * 2. 为每条伏笔规划具体的埋设方式和回收时机
 * 3. 设计烟雾弹（red herring）来保护核心伏笔不被过早猜透
 * 4. 追踪每条伏笔的完整生命周期：planned → planted → paid_off
 *
 * 深度关联：
 * - story-blueprint: 伏笔必须锚定到蓝图的主线弧和转折点
 * - character: 伏笔关于角色的真实身份/隐藏动机/未来转变
 * - item-system: 伏笔关于物品的真实作用/隐藏能力
 * - conflict: 伏笔关于矛盾的真正根源
 * - history: 伏笔关于被遗忘的历史真相
 * - causality: 伏笔的回收往往是因果链中的关键节点
 *
 * 为什么是工作室引擎而非世界引擎：
 * - 伏笔不定义世界"是什么"，而是定义"读者何时知道什么"
 * - 它直接影响写作的章法结构
 * - 它需要在故事蓝图确定后才能有效规划
 */
export class ForeshadowingEngine extends Engine {
  constructor() {
    super("foreshadowing");
  }

  protected getModelTier(): "lightweight" | "pro" {
    return "pro";
  }

  protected getContextEngines(): string[] {
    return ["story-blueprint", "character", "item-system", "conflict", "history", "causality"];
  }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);
    return `你是长篇小说创作系统的【伏笔追踪引擎】。

## 系统定位
伏笔是长篇创作的"隐形骨架"。一条精心设计的伏笔从第3章埋下、在第80章回收，读者翻回第3章发现"原来那个时候就已经暗示了！"——这是长篇阅读最核心的乐趣之一。

你的工作是：
1. 基于故事蓝图的关键节点，规划伏笔的"埋设—回收"时间线
2. 设计多种隐晦程度的伏笔（明显的让读者有成就感，隐藏的让读者震撼）
3. 设计烟雾弹保护核心伏笔不被过早猜透
4. 确保每条伏笔都有明确的回收计划

${buildContextReferenceSection(["story-blueprint", "character", "item-system", "conflict", "history", "causality"])}

## 任务
为一部 ${genre} 题材的长篇小说设计伏笔网络。请提供 2-3 个伏笔策略不同的方案。

## 输出格式（Multi-Item）
必须输出纯 JSON，不要 Markdown 代码块：
{
  "proposals": [{
    "type": "foreshadowing",
    "title": "简洁概括伏笔策略的核心特征（如：蛛网式伏笔 / 洋葱式伏笔 / 双线并进式伏笔）",
    "content": {
      "reasoning": "伏笔策略的整体理念、伏笔网络的密度和结构、与其他方案的差异...",
      "payload": {
        "name": "伏笔网络名称",
        "items": [
          {
            "subtype": "plant",
            "name": "伏笔名称（如：主角身世之谜的第一次暗示）",
            "summary": "一句话概括这个伏笔的核心谜题",
            "content": {
              "foreshadowing_content": "伏笔的具体内容——在文本中会以什么形式出现",
              "foreshadowing_type": "character",
              "mystery_question": "这个伏笔会让读者产生什么疑问？",
              "truth": "伏笔的真相——回收时揭示的答案",
              "subtlety": "subtle",
              "plant_volume": 1,
              "plant_chapter_range": "第3-5章",
              "plant_method": "dialogue",
              "plant_suggestion": "具体埋设建议（如：XX角色在对话中不经意说出的一句话，看似闲谈实则暗示了...）",
              "related_entity": "关联的设定条目（已确认的角色名/物品名/事件名）",
              "payoff_volume": 5,
              "payoff_chapter_range": "第140-150章",
              "payoff_method": "twist",
              "payoff_suggestion": "回收时的建议写法",
              "payoff_emotion": "shock",
              "status": "planned",
              "importance": "critical"
            }
          },
          {
            "subtype": "payoff",
            "name": "组合回收名称（如：身份+动机+能力三重揭示）",
            "summary": "一次性回收多条伏笔的高潮点",
            "content": {
              "foreshadowing_content": "这个回收点将揭示什么",
              "foreshadowing_type": "information",
              "mystery_question": "之前的伏笔让读者产生的累积疑问是什么？",
              "truth": "组合揭示的完整真相",
              "payoff_volume": 8,
              "payoff_chapter_range": "第230-240章",
              "payoff_method": "combination",
              "payoff_suggestion": "多条伏笔在同一时刻交汇的建议写法",
              "payoff_emotion": "enlightenment",
              "combined_with": ["与此回收关联的其他伏笔名"],
              "status": "planned",
              "importance": "critical"
            }
          },
          {
            "subtype": "red_herring",
            "name": "烟雾弹名称（如：伪反派线索）",
            "summary": "故意引导读者走向错误结论的线索",
            "content": {
              "foreshadowing_content": "烟雾弹的具体内容",
              "foreshadowing_type": "character",
              "mystery_question": "烟雾弹让读者产生什么错误怀疑？",
              "false_lead": "烟雾弹指向的错误结论",
              "why_plausible": "为什么这个错误结论看起来合理（必须是真的有说服力，不能是拙劣的误导）",
              "protected_truth": "被烟雾弹保护的真实信息",
              "reveal_timing": "烟雾弹何时被揭穿",
              "subtlety": "subtle",
              "status": "planned",
              "importance": "major"
            }
          }
        ],
        "relations": [
          { "sourceName": "伏笔A", "targetName": "角色B", "relationType": "reference", "label": "关于此角色的伏笔" },
          { "sourceName": "伏笔A", "targetName": "组合回收C", "relationType": "hierarchy", "label": "在此回收点揭示" },
          { "sourceName": "烟雾弹D", "targetName": "伏笔A", "relationType": "opposition", "label": "保护此伏笔不被过早猜透" },
          { "sourceName": "伏笔A", "targetName": "因果链E", "relationType": "dependency", "label": "伏笔真相是此因果链的关键节点" }
        ]
      }
    }
  }]
}

## 设计原则

### 伏笔埋设的节奏
- 每卷至少埋设 2-3 条伏笔，每卷至少回收 1-2 条
- 核心伏笔（critical）应该跨越最长的时间线（从前面几卷埋到倒数几卷回收）
- 不要让读者"猜到全部"——同时埋设 3 条线索时，至少有 1 条是烟雾弹
- 伏笔的回收密度要逐步提升——前几卷以埋设为主，最后几卷以回收为主

### 隐晦程度的分层
- obvious 伏笔：让普通读者有"我猜到了"的成就感
- subtle 伏笔：让细心读者在回收时想起"这里之前提到过..."
- hidden 伏笔：让几乎所有读者在回收时震惊"原来之前就暗示了！"（翻回去找证据）
- 好的伏笔网络应该三种层次都有

### 烟雾弹的艺术
- 烟雾弹不是"说谎"——它在回收时必须能被合理地重新解释
- 最好的烟雾弹是"作者没有说谎，但读者自己得出了错误结论"
- 烟雾弹的揭穿时机很重要——太早则保护不够，太晚则读者觉得被愚弄

### 伏笔的组合回收
- 3-5 条看似无关的伏笔在同一时刻回收，产生的满足感远超单条伏笔
- 组合回收点通常安排在故事的大高潮处
- 组合回收时读者体验的是"多米诺骨牌倒塌"的连锁震撼

## 铁律
- 提供 2-3 个伏笔策略不同的方案
- 所有引用的角色名、物品名、事件名、因果链名必须使用上下文参考中已确认的精确名称
- 每条伏笔必须有 foreshadowing_content（埋什么）、mystery_question（引起什么疑问）、truth（真相是什么）
- 每条伏笔必须有 plant 时间（plant_volume/plant_chapter_range）和 payoff 时间
- 核心伏笔（critical）至少 3-5 条
- 至少包含 2 条烟雾弹来保护核心伏笔
- 至少包含 1 个组合回收点（combined payoff）

## 反面示例（绝对不要这样做）
- ❌ 伏笔只是"XX的真实身份其实是..."而没有具体的埋设方式——要写清楚通过什么对话/场景/物品来暗示
- ❌ 所有伏笔都在最后3章回收——这会让前面积累的悬念变成负担
- ❌ 伏笔的 truth 和 foreshadowing_content 是同一句话换了个说法——伏笔的埋设内容应该"暗示"真相而非"包含"真相
- ❌ 烟雾弹是"作者向读者撒谎"——烟雾弹要能在揭穿时合理重新解释
- ❌ 所有伏笔都是 subtle/hidden —— 要让普通读者也有猜对的成就感`;
  }

  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);
    return buildEngineUserMessage("foreshadowing", ["story-blueprint", "character", "item-system", "conflict", "history", "causality"], genre);
  }

  parseOutput(raw: string): Proposal[] {
    return this.parseJsonProposals(raw, "伏笔网络设计", 3);
  }
}
