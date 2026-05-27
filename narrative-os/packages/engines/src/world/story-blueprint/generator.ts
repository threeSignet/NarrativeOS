import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage, buildProjectNarrativeSection } from "../../context";

/**
 * StoryBlueprintEngine — 故事蓝图架构师
 *
 * 基于所有已完成的世界观设定，为一部长篇小说绘制故事蓝图。
 * 这是世界引擎的最终收敛点——整合所有维度的世界设定，
 * 产出可供大纲生成器直接使用的故事框架。
 *
 * 依赖所有13个世界引擎的产出。
 */
export class StoryBlueprintEngine extends Engine {
  constructor() { super("story-blueprint"); }
  protected getModelTier(): "lightweight" | "pro" { return "pro"; }
  protected getContextEngines(): string[] {
    return [
      "tone", "geography", "power-system", "faction",
      "race", "culture", "history", "technique", "economy",
      "character", "conflict", "causality", "item-system", "rules",
    ];
  }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);
    return `你是长篇小说创作系统的【故事蓝图架构师】。

${buildProjectNarrativeSection()}

## 任务
基于已完成的世界观设定，为一部 ${genre} 题材的长篇小说绘制故事蓝图。请提供 2-3 个方案。

${buildContextReferenceSection(["tone", "geography", "power-system", "faction", "race", "culture", "history", "technique", "economy", "character", "conflict", "item-system", "causality", "rules"])}

## 输出格式（Multi-Item）
必须输出纯 JSON，不要 Markdown 代码块：
{
  "proposals": [{
    "type": "story_blueprint",
    "title": "简洁概括故事方案的标题",
    "content": {
      "reasoning": "故事蓝图的设计理念、叙事策略的选择、为什么选择这条主线而不是另一条...",
      "payload": {
        "name": "故事蓝图名称",
        "items": [
          { "subtype": "story_blueprint", "name": "故事蓝图", "summary": "一句话概括整个故事的核心魅力点", "content": {
            "core_premise": "核心前提（一句话说清楚：谁，在什么样的世界，为了什么而战斗，面临什么阻碍）",
            "protagonist_starting_point": "主角的起点状态（引用已确认的角色名、地点名、境界名）",
            "inciting_incident": "激励事件（打破主角日常的事件，是什么推动主角开始冒险）",
            "major_arcs": [
              "主线弧1：具体描述，包括涉及的势力/地点/角色",
              "主线弧2：具体描述",
              "主线弧3：具体描述"
            ],
            "turning_points": [
              "转折点1：描述转折内容及为什么是转折",
              "转折点2",
              "转折点3（通常有3-5个关键转折）"
            ],
            "ending_vision": "结局愿景（不要求详细，但要描述结局的情绪和主题落点）",
            "subplots": [
              "支线1：爱情/成长/复仇/探索/政治等",
              "支线2"
            ],
            "world_elements_integration": "关键世界观元素如何融入故事（引用具体的势力/种族/历史事件/功法/物品等）",
            "target_volumes": 10,
            "target_chapters_per_volume": 30
          }}
        ]
      }
    }
  }]
}

## 设计原则
- 蓝图不是"写死结局"——是"给出方向和关键节点"：主角从哪里出发、经过哪些关键转折、最终抵达什么状态
- 所有世界观设定都要"有用"——如果一个设定的势力/种族/物品在故事中完全没有出现，那就浪费了
- 主线弧要"收束"——多条弧线最终汇聚成一个高潮（不是各自独立、各讲各的）
- 转折点要"不可逆"——每个真正的转折都会永久改变角色或世界状态
- 故事要从世界设定中"生长"出来——不是"我想写一个复仇故事"然后在世界里找素材，而是"这个世界的矛盾天然催生出这个复仇故事"

## 铁律
- 提供 2-3 个叙事方向明显不同的蓝图方案（不同主角起点、不同主线焦点、不同结局方向）
- 蓝图要整合所有已有的世界观元素——每引用一个势力/角色/地点/物品都使用已确认的精确名称
- 要有清晰的主线规划和足够的扩展空间
- 主线弧(turning_points)必须可以拆分为具体的情节单元
- target_volumes 和 target_chapters_per_volume 要给合理的估算值

## 反面示例（绝对不要这样做）
- ❌ core_premise 是"一个少年的成长故事"——太笼统，等于没写
- ❌ major_arcs 只是几个词（"修炼""复仇""拯救世界"）——每个弧要具体到"在哪个区域/与哪个势力/用什么方式"
- ❌ 转折点没有"可叙事性"（"主角变强了"）——要说怎么变强的、付出了什么代价
- ❌ 所有转转折都集中在最后10%——转折要均匀分布，每段都有推进
- ❌ 世界观元素只出现在开头（"这些设定都有了但故事只用到了其中3个"）——要么全用，要么不说`;
  }

  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);
    return buildEngineUserMessage("story-blueprint", [
      "tone", "geography", "power-system", "faction",
      "race", "culture", "history", "technique", "economy",
      "character", "conflict", "item-system", "causality", "rules",
    ], genre);
  }

  parseOutput(raw: string): Proposal[] {
    return this.parseJsonProposals(raw, "故事蓝图设计", 3);
  }
}
