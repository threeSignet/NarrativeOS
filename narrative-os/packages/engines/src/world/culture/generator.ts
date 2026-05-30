import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage, buildProjectNarrativeSection, buildGeographyBindingSection } from "../../context";

/**
 * CultureEngine — 文化体系架构师（多 pass 自适应版）
 *
 * 支持两种运行模式：
 * 1. 初始模式（无 refinement）→ 产出世界/大陆级文化体系顶层架构
 * 2. 细化模式（有 refinement）→ 为指定区域在更细尺度生成地域特色文化
 *
 * 尺度链（从粗到细）：
 *   universe → galaxy → star_system → planet → continent → region → city → district → scene
 *
 * 初始 pass 定位于 planet/continent 级（泛世界文化框架），
 * 细化 pass 对应 region 级（地域风俗、地方方言、本土信仰）。
 */
export class CultureEngine extends Engine {
  constructor() { super("culture"); }
  protected getModelTier(): "lightweight" | "pro" { return "pro"; }
  protected getContextEngines(): string[] { return ["tone", "geography", "power-system", "faction", "race"]; }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      return this.buildRefinementPrompt(ctx, genre);
    }
    return this.buildInitialPrompt(ctx, genre);
  }

  /**
   * 构建初始 pass 的系统提示 — 产出泛世界文化体系顶层架构
   */
  private buildInitialPrompt(_ctx: EngineContext, genre: string): string {
    return `你是长篇小说创作系统的【文化体系架构师】。

${buildProjectNarrativeSection()}

## 任务
为一部 ${genre} 题材的长篇小说设计文化体系的**顶层架构**。请提供 2-3 个风格迥异的方案。

${buildContextReferenceSection(["tone", "geography", "power-system", "faction", "race"])}

${buildGeographyBindingSection()}

## 重要：尺度定位
本次是初始 pass，定位于 **continent（大陆级）** 尺度。你需要设计的是：
- 不同大陆/世界的宏观文化格局
- 主要宗教体系、语言语系
- 跨地域的文化冲突主线

后续的细化 pass 会为具体区域生成地域特色文化（地方方言、本土节日、区域风俗）。

## 输出格式（Multi-Item）
必须输出纯 JSON，不要 Markdown 代码块：
{
  "proposals": [{
    "type": "culture",
    "title": "简洁概括文化方案核心特征的标题",
    "content": {
      "reasoning": "文化设计的核心理念、文化冲突的戏剧潜力...",
      "payload": {
        "name": "文化体系名称",
        "items": [
          {
            "subtype": "language",
            "name": "语言名",
            "summary": "一句话概括",
            "content": {
              "scale": "continent",
              "needs_refinement": true,
              "language_family": "所属语系",
              "spoken_in": ["使用区域名（已确认的地理区域名）"],
              "used_by": ["使用势力/种族（已确认的名称）"],
              "writing_system": "文字系统描述",
              "features": "语言特色（敬语体系/禁忌词汇/方言分化等）",
              "is_common_tongue": false,
              "geographic_bindings": [
                { "location_name": "已确认的区域名", "binding_type": "influence_zone", "description": "使用区域" }
              ]
            }
          },
          {
            "subtype": "religion",
            "name": "宗教/信仰名",
            "summary": "一句话概括信仰核心",
            "content": {
              "scale": "continent",
              "needs_refinement": true,
              "faith_type": "polytheism",
              "deities": ["神祇名1", "神祇名2"],
              "followers": ["信徒群体（已确认的势力/种族名）"],
              "core_doctrines": ["核心教义1", "核心教义2"],
              "religious_organization": "教会/组织结构的描述",
              "holy_sites": ["圣地（已确认的地点名）"],
              "political_influence": "对世俗权力的影响程度",
              "geographic_bindings": [
                { "location_name": "已确认的地点名", "binding_type": "influence_zone", "description": "主要信仰区域" },
                { "location_name": "已确认的地点名", "binding_type": "headquarters", "description": "圣地/总部" }
              ]
            }
          },
          {
            "subtype": "festival",
            "name": "节日名",
            "summary": "一句话概括节日主题",
            "content": {
              "scale": "continent",
              "needs_refinement": true,
              "timing": "日期/周期（如：每年冬至/每百年一次）",
              "celebrations": ["庆祝活动1", "庆祝活动2"],
              "origin_meaning": "起源与意义",
              "celebrated_by": ["庆祝群体（已确认的名称）"],
              "religious_connection": "与宗教的关联（如有）"
            }
          },
          {
            "subtype": "art_form",
            "name": "艺术形式名",
            "summary": "一句话概括",
            "content": {
              "scale": "continent",
              "needs_refinement": true,
              "art_type": "music",
              "style_description": "艺术风格描述",
              "notable_examples": "代表性作品/艺术家",
              "popular_in": ["流行区域（已确认的区域名）"]
            }
          },
          {
            "subtype": "custom",
            "name": "风俗名",
            "summary": "一句话概括",
            "content": {
              "scale": "continent",
              "needs_refinement": true,
              "custom_type": "marriage",
              "practice": "具体做法描述",
              "meaning": "文化含义/象征意义"
            }
          },
          {
            "subtype": "taboo",
            "name": "禁忌名",
            "summary": "一句话概括禁忌内容",
            "content": {
              "scale": "continent",
              "needs_refinement": true,
              "custom_type": "greeting",
              "practice": "被禁止的行为",
              "consequence": "违反后果（社会惩罚/超自然惩罚等）",
              "meaning": "禁忌的文化根源",
              "enforced_by": "由谁执行（已确认的势力/角色名）"
            }
          }
        ],
        "relations": [
          { "sourceName": "语言A", "targetName": "势力B", "relationType": "affiliation", "label": "官方语言" },
          { "sourceName": "宗教C", "targetName": "圣地D", "relationType": "geographic", "label": "朝圣之地" },
          { "sourceName": "节日E", "targetName": "宗教C", "relationType": "reference", "label": "源于" },
          { "sourceName": "禁忌F", "targetName": "宗教C", "relationType": "dependency", "label": "基于教义" }
        ]
      }
    }
  }]
}

## 设计原则
- 文化必须有人群载体，不能是空中楼阁 —— 每个文化要素必须挂靠到已确认的势力/种族
- 不同势力的文化要有差异和冲突点，这本身就是戏剧素材
- 宗教和政治的关系要复杂多层，不是简单的"教会控制王权"或"王权压制教会"
- 节日要有仪式感，不是简单的"大家放假一天"
- 语言设计要考虑地理隔离和文化交流，相邻区域语言可能有亲缘关系
- 禁忌要有真实的社会功能，不是随意编造的"不能做某事"

## 铁律
- 提供 2-3 个文化格局不同的方案（不同宗教格局、不同文化冲突主线）
- 所有势力名称、区域名称、种族名称必须使用上下文参考中已确认的精确名称，不得自行编造或改写
- 至少包含 1 个能驱动剧情发展的文化冲突（如宗教对立、语言隔阂、禁忌触碰）
- **每一个 item 必须有 scale 和 needs_refinement: true 字段**
- scale 字段使用 "continent"（大陆级）

## 反面示例（绝对不要这样做）
- 所有势力共用一个"万神殿"式的宗教，没有教义分歧 —— 同一神系下不同势力可以有不同解读和侧重点
- 语言设计只是列出名字而不解释特色 —— 要说明语系关系、文字特点、社会语言学特征
- 禁忌只是"不能说脏话"这类泛泛之谈 —— 禁忌应该是特定文化背景下有深刻社会功能的规则
- 节日没有仪式细节 —— 仪式是文化最可见的部分，也是场景描写的素材`;
  }

  /**
   * 构建细化 pass 的系统提示 — 为指定区域生成地域特色文化
   */
  private buildRefinementPrompt(ctx: EngineContext, genre: string): string {
    const ref = ctx.refinement!;
    const targetScale = ref.targetScale;
    const targetLabel = this.getScaleLabel(targetScale);

    return `你是长篇小说创作系统的【文化体系架构师】。

## 任务
为已确认的文化条目「${ref.parentName}」在更细的 **${targetLabel}（${targetScale}）** 尺度设计地域特色文化。

父条目层级：${ref.parentScale}  目标细化层级：${targetScale}

${buildContextReferenceSection(["tone", "geography", "power-system", "faction", "race"])}

${buildGeographyBindingSection()}

## 细化策略
请使用 \`query_world_setting\` 工具查询以下数据：
1. 父条目「${ref.parentName}」的详细设定
2. ${targetScale} 级别的地理条目和势力分布
3. 该区域的种族构成

为这些更细的地理区域设计**地域特色文化要素**：
- 地方方言/分支语言
- 本土化宗教流派/地方信仰
- 地方性节日和庆典
- 区域特有风俗和禁忌

## 输出格式
{
  "proposals": [{
    "type": "culture",
    "title": "「${ref.parentName}」的${targetLabel}级文化细化",
    "content": {
      "reasoning": "细化逻辑、地域文化差异的成因...",
      "payload": {
        "name": "${ref.parentName}·${targetLabel}级文化",
        "items": [
          {
            "subtype": "language",
            "name": "地方方言/语言",
            "summary": "该地方言特色",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "relation_to_parent": "与父语言/文化的关系（方言/分支/演变/独立）",
              "spoken_in": ["使用区域（${targetScale} 级已确认地名）"],
              "regional_features": "地域语言特色"
            }
          },
          {
            "subtype": "religion",
            "name": "地方信仰/流派",
            "summary": "本地化的宗教实践",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "parent_religion": "所属主流宗教（${ref.parentName} 或已确认的宗教名）",
              "local_deities": ["本土特有神祇/圣徒"],
              "local_practices": "本土化的宗教实践差异"
            }
          },
          {
            "subtype": "custom",
            "name": "地域风俗",
            "summary": "该区域特有风俗",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "custom_type": "marriage",
              "practice": "具体做法",
              "geographic_reason": "地理环境对此风俗的塑造",
              "meaning": "文化含义"
            }
          },
          {
            "subtype": "taboo",
            "name": "地域禁忌",
            "summary": "该区域特有禁忌",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "custom_type": "greeting",
              "practice": "被禁止的行为",
              "consequence": "违反后果",
              "local_origin": "禁忌的本地起源故事"
            }
          }
        ],
        "relations": [
          { "sourceName": "地方方言A", "targetName": "${ref.parentName}", "relationType": "hierarchy", "label": "分支自" },
          { "sourceName": "地方信仰B", "targetName": "地理条目", "relationType": "geographic", "label": "主要信仰区域" }
        ]
      }
    }
  }]
}

## 铁律
- 提供 2-3 个细化方案
- **每一个 item 必须有 scale="${targetScale}" 和 needs_refinement: true**
- **parent_name 必须设为 "${ref.parentName}"**
- 地域文化要素必须与当地地理环境、势力分布、种族构成协调`;
  }


  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      const ref = ctx.refinement;
      return `请基于已确认的文化条目「${ref.parentName}」（${ref.parentScale}级），
在更细的 ${ref.targetScale} 尺度设计地域特色文化要素。
请先用 query_world_setting 工具查询父文化详情和对应地理/势力条目。`;
    }

    return buildEngineUserMessage("culture", ["tone", "geography", "faction", "race"], genre);
  }

  parseOutput(raw: string): Proposal[] {
    const proposals = this.parseJsonProposals(raw, "文化体系设计", 3);

    this.injectRefinementParentId(proposals);
    return proposals;
  }

}
