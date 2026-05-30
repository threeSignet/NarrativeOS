import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage, buildProjectNarrativeSection, buildGeographyBindingSection } from "../../context";

/**
 * PowerSystemEngine — 力量体系架构师（多 pass 自适应版）
 *
 * 支持两种运行模式：
 * 1. 初始模式（无 refinement）→ 分析项目上下文，产出世界级力量体系顶层架构
 * 2. 细化模式（有 refinement）→ 为指定父条目在更细地理尺度生成子条目（区域力量变体、势力专属功法体系）
 *
 * 尺度链（从粗到细）：
 *   universe → galaxy → star_system → planet → continent → region → city → district → scene
 *
 * 初始 pass 定位于 planet/continent 级（世界级力量体系），
 * 细化 pass 对应 region 级（区域级力量变体、地域特色传承）。
 */
export class PowerSystemEngine extends Engine {
  constructor() { super("power-system"); }
  protected getModelTier(): "lightweight" | "pro" { return "pro"; }
  protected getContextEngines(): string[] { return ["tone", "geography"]; }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    // 细化模式：为指定父条目生成子层级
    if (ctx.refinement) {
      return this.buildRefinementPrompt(ctx, genre);
    }

    // 初始模式：产出世界级力量体系
    return this.buildInitialPrompt(ctx, genre);
  }

  /**
   * 构建初始 pass 的系统提示 — 产出世界级力量体系顶层架构
   */
  private buildInitialPrompt(_ctx: EngineContext, genre: string): string {
    return `你是长篇小说创作系统的【力量体系架构师】。

${buildProjectNarrativeSection()}

## 任务
为一部 ${genre} 题材的长篇小说设计力量体系顶层架构。请提供 2-3 个风格迥异的方案。

${buildContextReferenceSection(["tone", "geography"])}

${buildGeographyBindingSection()}

## 重要：尺度定位
本次是初始 pass，定位于 **planet（世界级）** 尺度。你需要设计的是涵盖整个世界的通用力量体系框架：
- 力量体系的根基（力量来源、核心规则）
- 境界层次的完整金字塔
- 不同地域的力量资源分布概述

后续的细化 pass 会为具体区域设计地域特色的力量变体。

## 输出格式（Multi-Item）
必须输出纯 JSON，不要 Markdown 代码块：
{
  "proposals": [{
    "type": "power_system",
    "title": "简洁概括方案核心特征的标题",
    "content": {
      "reasoning": "力量体系的设计理念、力量来源的合理性、境界体系的内在逻辑...",
      "payload": {
        "name": "力量体系名称",
        "items": [
          {
            "subtype": "power_system",
            "name": "体系名",
            "summary": "一句话概括体系核心",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "type": "体系类型（如：灵气修仙/斗气魔法/基因进化/精神力/符文科技等）",
              "source": "力量来源（必须与地理环境有联系：某区域灵气浓郁/某矿产是力量催化剂/某种星空现象周期性增强力量）",
              "source_regions": ["力量来源的地理区域（必须引用已确认的地理区域名）"],
              "dominant_regions": ["此力量体系占主导的地理区域（必须引用已确认的地理区域名）"],
              "progression": "晋升路径的整体描述",
              "limitations": "整体限制与必须付出的代价",
              "geographic_bindings": [
                { "location_name": "已确认的地理条目名称", "binding_type": "active_area", "description": "该力量体系的主要分布区域" }
              ]
            }
          },
          {
            "subtype": "realm",
            "name": "境界名",
            "summary": "一句话概括此境界的特征",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "level": 1,
              "abilities": ["获得的核心能力1", "能力2"],
              "breakthrough_condition": "突破到此境界的具体条件（不只是修炼，还要说什么特殊条件：丹药？顿悟？战斗？）",
              "lifespan_extension": "寿命变化",
              "combat_power_benchmark": "战斗力参考（如：可单挑百人军队/可毁灭一座小镇/可影响气候）"
            }
          },
          {
            "subtype": "rule",
            "name": "规则名",
            "summary": "一句话概括此规则",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "rule_type": "规则类型（通用法则/地域限制/时间限制/因果律等）",
              "description": "规则详细描述",
              "exceptions": ["例外情况（必须有，绝对规则没有故事空间）"],
              "exploitation": "主角可能如何利用/绕过此规则"
            }
          }
        ],
        "relations": [
          { "sourceName": "境界A", "targetName": "境界B", "relationType": "hierarchy", "label": "晋升至" }
        ]
      }
    }
  }]
}

## 设计原则
- 力量来源不能是"玄学"——需要物质基础或清晰的超自然逻辑。修仙用灵气（地理分布不均）、魔法用魔力（某些地点魔力充沛）、超能力用基因/变异（可遗传/可改造）
- 境界体系要"金字塔"分布——底层境界的人最多，顶层屈指可数。如果满大街都是最高境界，那境界就没有意义
- 每个境界的突破条件必须"可叙事化"——"打坐修炼100年"写不出故事，"必须在生死战斗中找到顿悟"才能写
- 规则要有"可被利用的漏洞"——主角的聪明才智就体现在发现和利用规则的漏洞上
- 力量体系的地理维度——不同区域的力量传承不同，某个区域可能因为特殊地理条件而盛产某种强者

## 铁律
- 提供 2-3 个核心机制不同的方案（不同力量来源、不同境界结构）
- 境界数量适中（一般5-10个），每个境界的区分要清晰
- **source_regions 和 dominant_regions 必须引用已确认的地理区域名**
- 至少设计 1 条可以被主角创造性利用的规则漏洞
- 力量来源要与地理环境建立联系，不能孤立存在
- **每一个 item 必须有 scale 和 needs_refinement: true 字段**
- scale 字段使用 "planet"（世界级）

## 反面示例（绝对不要这样做）
- 境界名只是换皮（练气→筑基→金丹 vs 学徒→法师→大法师）而不解释本质差异
- 突破条件只是"需要更多灵气"——每个境界应该有独特的突破方式
- 规则绝对化（"绝对不能XX"）——绝对规则让故事没有操作空间
- 战斗力的跃升没有代价（从一拳打碎石头到一拳毁灭星球，但身体和寿命没变化）
- 力量来源"说不清楚反正就是有"——这会让后续的功法/丹药设计失去根基`;
  }

  /**
   * 构建细化 pass 的系统提示 — 为指定父条目在更细尺度生成子条目
   * 父条目通常是 world-level 力量体系，细化 targetScale 为 region
   */
  private buildRefinementPrompt(ctx: EngineContext, genre: string): string {
    const ref = ctx.refinement!;
    const targetScale = ref.targetScale;
    const targetLabel = this.getScaleLabel(targetScale);

    return `你是长篇小说创作系统的【力量体系架构师】。

## 任务
为已确认的力量体系条目「${ref.parentName}」在更细的 **${targetLabel}（${targetScale}）** 尺度设计地域特色力量变体。

父条目层级：${ref.parentScale}  目标细化层级：${targetScale}

${buildContextReferenceSection(["tone", "geography"])}

${buildGeographyBindingSection()}

## 细化策略
请使用 \`query_world_setting\` 工具查询以下数据：
1. 父条目「${ref.parentName}」的详细设定（力量类型、境界体系、核心规则）
2. ${targetScale} 级别的地理条目（已确认的区域/城市等）
3. 已确认的势力分布

为这些更细的地理区域设计**地域特色的力量变体**：
- 某区域因为特殊地理条件而盛产某种类型的修行者
- 某区域的灵气/魔力浓度异常导致当地修行体系与主流不同
- 某势力独占的功法传承路线

## 输出格式
{
  "proposals": [{
    "type": "power_system",
    "title": "「${ref.parentName}」的${targetLabel}级力量变体",
    "content": {
      "reasoning": "细化逻辑、各地域力量差异的成因...",
      "payload": {
        "name": "${ref.parentName}·${targetLabel}级力量分布",
        "items": [
          {
            "subtype": "power_system",
            "name": "区域力量变体名",
            "summary": "该区域力量体系的核心特色",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "type": "力量体系类型（与父体系的关系：分支/变种/增强/削弱）",
              "geographic_focus": "关联的${targetScale}级地理条目（已确认的名称）",
              "regional_features": "该区域力量的特殊属性",
              "source": "区域力量来源（与当地地理特征的关系）",
              "geographic_bindings": [
                { "location_name": "已确认的${targetScale}级地理条目名称", "binding_type": "active_area", "description": "该变体的分布区域" }
              ]
            }
          },
          {
            "subtype": "realm",
            "name": "区域特殊境界",
            "summary": "该区域特有的境界或境界变体",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "level": 1,
              "abilities": ["该境界在本地域的特殊能力"],
              "breakthrough_condition": "突破条件（与当地环境相关）",
              "lifespan_extension": "寿命变化",
              "combat_power_benchmark": "战斗力参考"
            }
          },
          {
            "subtype": "rule",
            "name": "区域力量规则",
            "summary": "该区域的特殊力量规则",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "rule_type": "地域限制",
              "description": "规则描述",
              "geographic_condition": "触发的地理条件",
              "exploitation": "可能的利用方式"
            }
          }
        ],
        "relations": [
          { "sourceName": "区域变体A", "targetName": "${ref.parentName}", "relationType": "hierarchy", "label": "是XX力量体系的分支" },
          { "sourceName": "区域变体A", "targetName": "地理条目", "relationType": "geographic", "label": "主要分布区域" }
        ]
      }
    }
  }]
}

## 铁律
- 提供 2-3 个细化方案
- **每一个 item 必须有 scale="${targetScale}" 和 needs_refinement: true**
- **parent_name 必须设为 "${ref.parentName}"**
- 地域特色力量变体要与父体系有明显差异但逻辑兼容`;
  }


  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      const ref = ctx.refinement;
      return `请基于已确认的力量体系「${ref.parentName}」（${ref.parentScale}级），
在更细的 ${ref.targetScale} 尺度设计地域特色的力量变体。
请先用 query_world_setting 工具查询父体系详情和对应地理/势力条目。`;
    }

    return buildEngineUserMessage("power-system", ["tone", "geography"], genre);
  }

  parseOutput(raw: string): Proposal[] {
    const proposals = this.parseJsonProposals(raw, "力量体系设计", 3);

    this.injectRefinementParentId(proposals);
    return proposals;
  }

}
