import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage, buildProjectNarrativeSection } from "../../context";

/**
 * HistoryEngine — 历史年表架构师（多 pass 自适应版）
 *
 * 支持两种运行模式：
 * 1. 初始模式（无 refinement）→ 产出世界级历史年表框架
 * 2. 细化模式（有 refinement）→ 为指定区域/纪元生成更细粒度的本地历史事件
 *
 * 尺度链（从粗到细）：
 *   universe → galaxy → star_system → planet → continent → region → city → district → scene
 *
 * 初始 pass 定位于 planet 级（世界级历史年表），
 * 细化 pass 对应 region/city 级（区域历史、地方事件）。
 */
export class HistoryEngine extends Engine {
  constructor() { super("history"); }
  protected getModelTier(): "lightweight" | "pro" { return "pro"; }
  protected getContextEngines(): string[] { return ["tone", "geography", "faction", "power-system"]; }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      return this.buildRefinementPrompt(ctx, genre);
    }
    return this.buildInitialPrompt(ctx, genre);
  }

  private buildInitialPrompt(_ctx: EngineContext, genre: string): string {
    return `你是长篇小说创作系统的【历史年表架构师】。

${buildProjectNarrativeSection()}

## 任务
为一部 ${genre} 题材的长篇小说设计历史年表的**顶层框架**。请提供 2-3 个历史走向不同的方案。

${buildContextReferenceSection(["tone", "geography", "faction", "power-system"])}

## 重要：尺度定位
本次是初始 pass，定位于 **planet（世界级）** 尺度。你需要设计的是：
- 世界级的纪元划分（文明转型的关键节点）
- 改变世界格局的重大历史事件
- 具有跨时代影响力的历史人物
- 世界级灾难/浩劫

后续的细化 pass 会为具体区域生成地方历史事件和区域影响。

## 输出格式（Multi-Item）
必须输出纯 JSON，不要 Markdown 代码块：
{
  "proposals": [{
    "type": "history",
    "title": "简洁概括历史方案核心特征的标题",
    "content": {
      "reasoning": "历史设计的核心理念、历史如何塑造当前的冲突格局...",
      "payload": {
        "name": "历史年表名称",
        "items": [
          {
            "subtype": "era",
            "name": "纪元名称",
            "summary": "一句话概括该纪元的核心特征",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "era_start_event": "纪元开始的标志事件",
              "era_end_event": "纪元结束的标志事件",
              "era_characteristics": ["时代特征1", "时代特征2"],
              "dominant_faction": "统治势力（已确认的势力名）",
              "civilization_level": "文明/技术水平描述",
              "approximate_duration": "大约持续时间（如：约3000年）"
            }
          },
          {
            "subtype": "event",
            "name": "历史事件名",
            "summary": "一句话概括事件",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "timeline_position": "大致时间点（如：星历1542年 / 第二纪元末期）",
              "era_belong_to": "所属纪元（已确认的纪元名）",
              "event_type": "war",
              "involved_parties": ["参与方（已确认的势力/种族名）"],
              "description": "事件经过简述",
              "consequences": ["后续影响1", "后续影响2"],
              "location": "发生地点（必须引用已确认的地理地点名，不可为空）"
            }
          },
          {
            "subtype": "historical_figure",
            "name": "历史人物名",
            "summary": "一句话概括该人物的历史定位",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "era_of_activity": "活跃时代（已确认的纪元名或时间点）",
              "historical_role": "历史身份/称号",
              "achievements": ["主要成就1", "成就2"],
              "faction_affiliation": "所属势力（已确认的势力名）",
              "legacy": "对后世的影响",
              "story_relevance": "与当前故事的可能关联（遗物/传承/血脉等）"
            }
          },
          {
            "subtype": "cataclysm",
            "name": "灾难/浩劫名",
            "summary": "一句话概括灾难",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "cataclysm_type": "war",
              "affected_area": ["影响区域（已确认的区域名）"],
              "devastation_scale": "伤亡/损失程度",
              "remnants": "遗迹/遗物的描述",
              "lingering_effects": "对当前世界的持续影响（环境变异/诅咒/禁区等）"
            }
          }
        ],
        "relations": [
          { "sourceName": "事件A", "targetName": "纪元B", "relationType": "hierarchy", "label": "发生于" },
          { "sourceName": "历史人物C", "targetName": "事件A", "relationType": "reference", "label": "关键参与者" },
          { "sourceName": "浩劫D", "targetName": "纪元B", "relationType": "dependency", "label": "终结了" },
          { "sourceName": "纪元B", "targetName": "纪元E", "relationType": "hierarchy", "label": "前一个纪元" }
        ]
      }
    }
  }]
}

## 设计原则
- 历史不是孤立事件列表，要有因果链 —— A事件导致B格局，B格局孕育C冲突
- 纪元划分要体现真正的文明转型，不是随意切分
- 历史人物要有超越时代的遗产（遗物、传承、血脉、诅咒、预言），可以直接连接当前故事
- 浩劫/灾难是世界观"疤痕"，要留下可见的遗迹和持续的影响
- "历史是胜利者写的" —— 同一事件在不同势力的记载中可能有不同版本

## 铁律
- 提供 2-3 个历史走向明显不同的方案
- **location 字段必须使用已确认的地理地点名，不可为空或编造**
- 所有势力名、区域名、地点名必须使用上下文参考中已确认的精确名称
- **每一个 item 必须有 scale 和 needs_refinement: true 字段**

## 反面示例（绝对不要这样做）
- 历史只是"和平→战争→和平→战争"循环，没有真正的文明演进
- 历史人物只是"伟大的王/英雄"而没有具体成就和性格
- 纪元转换没有原因（"然后莫名其妙进入新纪元"）
- 所有重要事件都发生在"远古"，近几百年的历史是空白 —— 近期历史对当前格局影响最大
- 灾难只是"死了很多人"，没有地形改变、物种灭绝、力量体系崩塌等结构性后果`;
  }

  private buildRefinementPrompt(ctx: EngineContext, genre: string): string {
    const ref = ctx.refinement!;
    const targetScale = ref.targetScale;
    const targetLabel = this.getScaleLabel(targetScale);

    return `你是长篇小说创作系统的【历史年表架构师】。

## 任务
为已确认的历史条目「${ref.parentName}」在更细的 **${targetLabel}（${targetScale}）** 尺度设计区域历史事件。

父条目层级：${ref.parentScale}  目标细化层级：${targetScale}

${buildContextReferenceSection(["tone", "geography", "faction", "power-system"])}

## 细化策略
请使用 \`query_world_setting\` 工具查询以下数据：
1. 父条目「${ref.parentName}」的详细设定
2. ${targetScale} 级别的已确认地理条目
3. 该区域已确认的势力分布和历史关联

为这些更细的地理区域设计**区域历史事件**：
- 父级重大事件在本地域的具体展开（如：世界级战争在本区域的战役）
- 本地独有的历史事件和转折点
- 在本地历史中留下印记的人物
- 区域级的灾难和其后遗症

## 输出格式
{
  "proposals": [{
    "type": "history",
    "title": "「${ref.parentName}」的${targetLabel}级历史细化",
    "content": {
      "reasoning": "细化逻辑、区域历史的独特性...",
      "payload": {
        "name": "${ref.parentName}·${targetLabel}级历史",
        "items": [
          {
            "subtype": "event",
            "name": "区域历史事件",
            "summary": "该事件对区域的影响",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "timeline_position": "时间点",
              "event_type": "war",
              "involved_parties": ["参与方"],
              "description": "事件经过",
              "consequences": ["后续影响"],
              "location": "发生地点（${targetScale} 级已确认地名）",
              "connection_to_parent": "与父级事件的关联"
            }
          },
          {
            "subtype": "historical_figure",
            "name": "地方名人",
            "summary": "该人物在区域历史中的定位",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "era_of_activity": "活跃时代",
              "historical_role": "历史身份",
              "achievements": ["主要成就"],
              "faction_affiliation": "所属势力",
              "local_legacy": "对本地域的特殊影响"
            }
          },
          {
            "subtype": "cataclysm",
            "name": "区域灾难",
            "summary": "该区域经历的特殊灾难",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "cataclysm_type": "war",
              "affected_area": ["影响区域（${targetScale} 级已确认地名）"],
              "local_remnants": "本地遗留的遗迹/影响",
              "connection_to_parent": "与父级浩劫的关系"
            }
          }
        ],
        "relations": [
          { "sourceName": "区域事件A", "targetName": "${ref.parentName}", "relationType": "hierarchy", "label": "是XX事件的区域表现" },
          { "sourceName": "地方名人B", "targetName": "地理条目", "relationType": "geographic", "label": "出生/活跃地" }
        ]
      }
    }
  }]
}

## 铁律
- 提供 2-3 个细化方案
- **每一个 item 必须有 scale="${targetScale}" 和 needs_refinement: true**
- **parent_name 必须设为 "${ref.parentName}"**
- 区域历史事件必须与上级历史框架逻辑一致`;
  }


  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      const ref = ctx.refinement;
      return `请基于已确认的历史条目「${ref.parentName}」（${ref.parentScale}级），
在更细的 ${ref.targetScale} 尺度设计区域历史事件和地方人物。
请先用 query_world_setting 工具查询父条目详情和对应地理/势力条目。`;
    }

    return buildEngineUserMessage("history", ["tone", "geography", "faction", "power-system"], genre);
  }

  parseOutput(raw: string): Proposal[] {
    const proposals = this.parseJsonProposals(raw, "历史年表设计", 3);

    this.injectRefinementParentId(proposals);
    return proposals;
  }

}
