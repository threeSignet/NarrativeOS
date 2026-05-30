import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage, buildProjectNarrativeSection, buildGeographyBindingSection } from "../../context";

/**
 * TechniqueEngine — 功法/技能体系架构师（多 pass 自适应版）
 *
 * 支持两种运行模式：
 * 1. 初始模式（无 refinement）→ 产出核心功法体系顶层架构
 * 2. 细化模式（有 refinement）→ 为指定区域/势力生成专属功法技能
 *
 * 尺度链（从粗到细）：
 *   universe → galaxy → star_system → planet → continent → region → city → district → scene
 *
 * 初始 pass 定位于 planet（星球/世界级）尺度，
 * 细化 pass 对应 region 级（区域/势力专属传承）。
 *
 * 这是力量体系的"血肉"——power-system 定义了境界框架，
 * technique 填充具体的招式、技巧、修炼方法和战斗风格。
 */
export class TechniqueEngine extends Engine {
  constructor() { super("technique"); }
  protected getModelTier(): "lightweight" | "pro" { return "pro"; }
  protected getContextEngines(): string[] { return ["tone", "geography", "power-system", "faction"]; }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      return this.buildRefinementPrompt(ctx, genre);
    }
    return this.buildInitialPrompt(ctx, genre);
  }

  private buildInitialPrompt(_ctx: EngineContext, genre: string): string {
    return `你是长篇小说创作系统的【功法/技能体系架构师】。

${buildProjectNarrativeSection()}

## 任务
为一部 ${genre} 题材的长篇小说设计功法技能体系的**顶层架构**。请提供 2-3 个风格迥异的方案。

${buildContextReferenceSection(["tone", "geography", "power-system", "faction"])}

${buildGeographyBindingSection()}

## 重要：尺度定位
本次是初始 pass，定位于 **planet（星球/世界级）** 尺度。你需要设计的是：
- 各势力/传承体系的核心功法
- 各境界对应的修炼法门
- 跨势力流通的丹药配方
- 战略级阵法

后续的细化 pass 会为具体区域/势力生成专属的分支功法和本地化技能。

## 输出格式（Multi-Item）
必须输出纯 JSON，不要 Markdown 代码块：
{
  "proposals": [{
    "type": "technique",
    "title": "简洁概括功法方案核心特征的标题",
    "content": {
      "reasoning": "功法体系的设计理念、与力量体系的衔接、不同势力功法的差异化...",
      "payload": {
        "name": "功法体系名称",
        "items": [
          {
            "subtype": "technique",
            "name": "功法/技能名",
            "summary": "一句话概括功法的核心效果",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "technique_type": "attack",
              "required_realm": "所需最低境界（已确认的境界名）",
              "element": "元素/属性",
              "effects": ["效果1", "效果2"],
              "cost": "使用代价/副作用",
              "origin": "功法起源（谁/哪个势力创造，已确认的名称）",
              "prerequisite_techniques": ["前置功法名"],
              "taught_by": ["传授此功法的势力（已确认的势力名）"],
              "grade": "功法品阶（如：黄阶/玄阶/地阶/天阶，或自定义体系）",
              "practiced_in": ["修炼此功法的区域（必须引用已确认的地理区域名）"],
              "geographic_bindings": [
                { "location_name": "已确认的地理区域名", "binding_type": "active_area", "description": "功法主要修炼区域" }
              ]
            }
          },
          {
            "subtype": "cultivation_method",
            "name": "修炼法门名",
            "summary": "一句话概括此法门的修炼方式",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "method_type": "meditation",
              "requirements": "修炼资质/体质要求",
              "cultivation_speed": "修炼速度（如：快于常规但根基不稳）",
              "max_realm": "修炼此法门能达到的最高境界（已确认的境界名）",
              "risks": "修炼风险/走火入魔的可能",
              "inherited_by": ["传承此法的势力（已确认的势力名）"],
              "practiced_in": ["此法门的主要修炼区域（必须引用已确认的地理区域名）"]
            }
          },
          {
            "subtype": "pill",
            "name": "丹药名",
            "summary": "一句话概括丹药效果",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "pill_type": "breakthrough",
              "ingredients": ["主材料1（可使用已确认的妖兽/资源名）", "材料2"],
              "ingredient_origins": ["材料产地（必须引用已确认的地理区域名）"],
              "refinement_difficulty": "炼制难度",
              "side_effects": "副作用/使用限制",
              "refinable_by": ["能炼制此丹的势力/人物（已确认的名称）"]
            }
          },
          {
            "subtype": "formation",
            "name": "阵法名",
            "summary": "一句话概括阵法用途",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "formation_type": "defense",
              "required_materials": ["布阵材料1", "材料2"],
              "formation_scale": "large",
              "duration": "持续时间/维持条件",
              "known_locations": ["已知布阵地（已确认的地点名）"]
            }
          }
        ],
        "relations": [
          { "sourceName": "功法A", "targetName": "势力B", "relationType": "affiliation", "label": "不外传的镇派绝学" },
          { "sourceName": "法门C", "targetName": "势力B", "relationType": "affiliation", "label": "核心传承" },
          { "sourceName": "丹药D", "targetName": "功法A", "relationType": "dependency", "label": "修炼所需" },
          { "sourceName": "阵法E", "targetName": "势力B", "relationType": "reference", "label": "守护大阵" },
          { "sourceName": "功法A", "targetName": "境界F", "relationType": "dependency", "label": "需要此境界方可修炼" },
          { "sourceName": "功法G", "targetName": "功法A", "relationType": "hierarchy", "label": "前置功法" }
        ]
      }
    }
  }]
}

## 设计原则
- 功法要有品阶/等级体系，不同势力掌握不同层次的功法（这不只是"谁更强"，而是权力结构的一部分）
- 修炼法门要有取舍：快但根基不稳 vs 稳但速度慢 vs 需要特殊体质 vs 需要珍贵资源
- 丹药不是万能的——每种丹药都要有副作用或使用限制，这样才能产生"是否服药"的戏剧张力
- 阵法要有战略意义：一个大型守护阵法可以改变势力之间的攻防平衡
- 功法和势力之间要有合理的掌控关系——镇派绝学不应该人人都会
- 功法起源要有故事感——最强功法往往来自历史事件或传奇人物

## 铁律
- 提供 2-3 个功法格局不同的方案
- required_realm 和 max_realm 字段必须使用力量体系中已确认的精确境界名
- **practiced_in、ingredient_origins、known_locations 必须引用已确认的地理区域/地点名**
- 势力名称必须使用上下文参考中已确认的精确名称
- 至少设计 3-5 个有特色的核心功法

## 反面示例（绝对不要这样做）
- 所有功法的效果都是"增强攻击力"——不同功法要有不同的战术价值和风格
- 丹药没有副作用——无代价的强化会让力量体系失去平衡
- 最厉害的功法散落在"秘境中等待被发现"——强大功法的传承本身就是势力博弈的结果
- 阵法只是"布一个阵"——要说明阵眼、材料消耗、维持条件、破解方法`;
  }

  private buildRefinementPrompt(ctx: EngineContext, genre: string): string {
    const ref = ctx.refinement!;
    const targetScale = ref.targetScale;
    const targetLabel = this.getScaleLabel(targetScale);

    return `你是长篇小说创作系统的【功法/技能体系架构师】。

## 任务
为已确认的功法条目「${ref.parentName}」在更细的 **${targetLabel}（${targetScale}）** 尺度设计区域/势力专属分支功法。

父条目层级：${ref.parentScale}  目标细化层级：${targetScale}

${buildContextReferenceSection(["tone", "geography", "power-system", "faction"])}

${buildGeographyBindingSection()}

## 细化策略
请使用 \`query_world_setting\` 工具查询以下数据：
1. 父条目「${ref.parentName}」的详细设定
2. ${targetScale} 级别的已确认地理条目和势力分布
3. 该区域的力量体系特性

为这些更细的区域/势力设计**本地化功法技能**：
- 父级功法的区域变体/分支（如：核心功法的本地化改良版）
- 特定势力独有的演化版功法
- 区域特有的丹药配方（利用本地材料）
- 势力/区域的防御/辅助阵法

## 输出格式
{
  "proposals": [{
    "type": "technique",
    "title": "「${ref.parentName}」的${targetLabel}级功法细化",
    "content": {
      "reasoning": "细化逻辑、区域功法的特殊性...",
      "payload": {
        "name": "${ref.parentName}·${targetLabel}级技能体系",
        "items": [
          {
            "subtype": "technique",
            "name": "区域/势力专属功法",
            "summary": "该功法在本地域的变体",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "technique_type": "attack",
              "required_realm": "所需最低境界",
              "element": "元素/属性",
              "effects": ["效果"],
              "cost": "使用代价",
              "variation_from_parent": "与父功法的具体差异",
              "local_reason": "本地化改良的原因",
              "practiced_in": ["修炼此功法的区域（必须引用已确认的地理区域名）"],
              "taught_by": ["传授势力"]
            }
          },
          {
            "subtype": "cultivation_method",
            "name": "本地修炼法门",
            "summary": "利用本地环境特色的修炼方式",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "method_type": "meditation",
              "local_conditions": "所需本地环境条件",
              "practiced_in": ["修炼此法门的区域（必须引用已确认的地理区域名）"],
              "cultivation_speed": "修炼速度",
              "risks": "风险",
              "inherited_by": ["传承势力"]
            }
          },
          {
            "subtype": "pill",
            "name": "本地丹药",
            "summary": "利用本地材料炼制的丹药",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "pill_type": "breakthrough",
              "local_ingredients": ["本地特有材料"],
              "ingredient_origins": ["材料产地（必须引用已确认的地理区域名）"],
              "refinement_difficulty": "炼制难度",
              "side_effects": "副作用",
              "refinable_by": ["能炼制此丹的势力"]
            }
          }
        ],
        "relations": [
          { "sourceName": "区域功法A", "targetName": "${ref.parentName}", "relationType": "hierarchy", "label": "是XX功法的分支" },
          { "sourceName": "区域功法A", "targetName": "势力名", "relationType": "affiliation", "label": "独占传承" }
        ]
      }
    }
  }]
}

## 铁律
- 提供 2-3 个细化方案
- **每一个 item 必须有 scale="${targetScale}" 和 needs_refinement: true**
- **parent_name 必须设为 "${ref.parentName}"**
- 区域功法必须与父功法核心逻辑兼容，差异要有合理的地域/势力解释
- **practiced_in、ingredient_origins 必须引用已确认的地理区域名**，不得编造或留空`;
  }


  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      const ref = ctx.refinement;
      return `请基于已确认的功法条目「${ref.parentName}」（${ref.parentScale}级），
在更细的 ${ref.targetScale} 尺度设计区域/势力专属的分支功法技能。
请先用 query_world_setting 工具查询父功法详情和对应区域/势力条目。`;
    }

    return buildEngineUserMessage("technique", ["power-system", "faction"], genre);
  }

  parseOutput(raw: string): Proposal[] {
    const proposals = this.parseJsonProposals(raw, "功法技能体系设计", 3);

    this.injectRefinementParentId(proposals);
    return proposals;
  }

}
