import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage, buildProjectNarrativeSection, buildGeographyBindingSection } from "../../context";

/**
 * RaceEngine — 种族/生物体系架构师（多 pass 自适应版）
 *
 * 支持两种运行模式：
 * 1. 初始模式（无 refinement）→ 产出世界/大陆级种族分布框架
 * 2. 细化模式（有 refinement）→ 为指定种族/区域在更细尺度设计本地栖息地和子种群
 *
 * 尺度链（从粗到细）：
 *   universe → galaxy → star_system → planet → continent → region → city → district → scene
 *
 * 初始 pass 定位于 planet/continent 级（世界级种族分布），
 * 细化 pass 对应 region 级（区域栖息地、本地种群）。
 */
export class RaceEngine extends Engine {
  constructor() { super("race"); }
  protected getModelTier(): "lightweight" | "pro" { return "pro"; }
  protected getContextEngines(): string[] { return ["tone", "geography", "power-system"]; }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      return this.buildRefinementPrompt(ctx, genre);
    }
    return this.buildInitialPrompt(ctx, genre);
  }

  private buildInitialPrompt(_ctx: EngineContext, genre: string): string {
    return `你是长篇小说创作系统的【种族/生物体系架构师】。

${buildProjectNarrativeSection()}

## 任务
为一部 ${genre} 题材的长篇小说设计种族和生物体系的**顶层框架**。请提供 2-3 个风格迥异的方案。

${buildContextReferenceSection(["tone", "geography", "power-system"])}

${buildGeographyBindingSection()}

## 重要：尺度定位
本次是初始 pass，定位于 **continent（大陆级）** 尺度。你需要设计的是：
- 世界级智能种族的宏观分布
- 各大种族的核心特征和能力
- 跨大陆的稀有妖兽/魔物
- 种族之间的宏观关系格局

后续的细化 pass 会为具体区域生成区域栖息地、本地种群、地域特有的妖兽。

## 输出格式（Multi-Item）
必须输出纯 JSON，不要 Markdown 代码块：
{
  "proposals": [{
    "type": "race",
    "title": "简洁概括方案核心特征的标题",
    "content": {
      "reasoning": "设计理念、种族分布逻辑及与其他方案的差异...",
      "payload": {
        "name": "种族体系名称",
        "items": [
          {
            "subtype": "race",
            "name": "种族名",
            "summary": "一句话概括该种族的核心特征",
            "content": {
              "scale": "continent",
              "needs_refinement": true,
              "appearance": "外观特征（肤色、体型、标志性特征）",
              "traits": ["种族天赋1", "种族天赋2"],
              "lifespan": "平均寿命（如：200年）",
              "population": "大致规模（如：约占世界总人口15%）",
              "distribution": ["主要分布区域名（必须是地理引擎中已确认的区域名）"],
              "affinity": "元素/能量亲和性（必须与力量体系协调）",
              "social_structure": "社会结构（如：部落制/帝国制/城邦联盟）",
              "inter_race_relations": "与其他种族的关系简述",
              "racial_history": "种族历史简述",
              "geographic_bindings": [
                { "location_name": "已确认的区域名", "binding_type": "habitat", "description": "主要栖息地" }
              ]
            }
          },
          {
            "subtype": "beast",
            "name": "妖兽/魔物名",
            "summary": "一句话概括",
            "content": {
              "scale": "continent",
              "needs_refinement": true,
              "habitat": ["栖息地（必须是地理引擎中已确认的地点名）"],
              "abilities": ["特殊能力1", "特殊能力2"],
              "threat_level": "high",
              "rarity": "rare",
              "materials": ["可采集材料1", "材料2"],
              "size": "体型描述",
              "behavior": "习性描述",
              "geographic_bindings": [
                { "location_name": "已确认的地点名", "binding_type": "habitat", "description": "出没区域" }
              ]
            }
          },
          {
            "subtype": "subrace",
            "name": "亚种/变体名",
            "summary": "与主种族的差异概括",
            "content": {
              "scale": "continent",
              "needs_refinement": true,
              "parent_race": "父种族名（必须是本引擎中已创建的种族名）",
              "differences": "具体差异描述",
              "mutation_cause": "变异原因（环境/魔法/进化等）"
            }
          }
        ],
        "relations": [
          { "sourceName": "种族A", "targetName": "区域B", "relationType": "geographic", "label": "主要栖息于" },
          { "sourceName": "妖兽C", "targetName": "区域D", "relationType": "geographic", "label": "出没于" },
          { "sourceName": "种族A", "targetName": "种族B", "relationType": "opposition", "label": "世仇" },
          { "sourceName": "亚种X", "targetName": "种族A", "relationType": "hierarchy", "label": "分支自" }
        ]
      }
    }
  }]
}

## 设计原则
- 每个种族要有独特的生态位，避免同质化
- 种族能力必须与力量体系协调，不能出现矛盾的设定
- 种族分布必须与地理环境匹配（沙漠地区不该有水生种族）
- 种族之间要有真实的互动关系（联盟/敌对/共生/捕食）
- 妖兽/魔物要有明确的价值（材料/试炼/威胁），服务于剧情
- 亚种变体要有合理的变异原因，不是随意设定

## 铁律
- 提供 2-3 个种族构成明显不同的方案（不同种族数量、不同优势种族、不同种族关系格局）
- distribution 和 habitat 字段必须使用地理引擎中已确认的精确地名，不得自行编造
- affinity 字段必须与力量体系中已确认的力量来源协调一致
- 种族数量适中（一般3-8个智能种族），每个都要有完整的设定
- 至少包含1-2个对主线剧情有重要影响的种族设定
- **每一个 item 必须有 scale 和 needs_refinement: true 字段**
- scale 字段使用 "continent"（大陆级）

## 反面示例（绝对不要这样做）
- 所有种族都是"人类变体"（精灵=长耳人类、矮人=矮小人类）—— 要有真正的生物差异
- 种族能力直接照搬力量体系境界 —— 种族天赋是先天基础，境界是后天修炼，两者不同
- 妖兽只是"会打架的野兽" —— 每只妖兽都要有独特生态价值和利用方式
- 分布区域写"世界各地" —— 必须指定具体区域名`;
  }

  private buildRefinementPrompt(ctx: EngineContext, genre: string): string {
    const ref = ctx.refinement!;
    const targetScale = ref.targetScale;
    const targetLabel = this.getScaleLabel(targetScale);

    return `你是长篇小说创作系统的【种族/生物体系架构师】。

## 任务
为已确认的种族/生物条目「${ref.parentName}」在更细的 **${targetLabel}（${targetScale}）** 尺度设计区域栖息地和本地种群。

父条目层级：${ref.parentScale}  目标细化层级：${targetScale}

${buildContextReferenceSection(["tone", "geography", "power-system"])}

${buildGeographyBindingSection()}

## 细化策略
请使用 \`query_world_setting\` 工具查询以下数据：
1. 父条目「${ref.parentName}」的详细设定
2. ${targetScale} 级别的已确认地理条目
3. 该区域的力量体系特性

为这些更细的地理区域设计**区域种族/生物要素**：
- 父种族在具体区域的本土化种群特征
- 该区域特有的亚种/变体
- 区域独有的妖兽/魔物及其生态

## 输出格式
{
  "proposals": [{
    "type": "race",
    "title": "「${ref.parentName}」的${targetLabel}级栖息地细化",
    "content": {
      "reasoning": "细化逻辑、区域生态差异的成因...",
      "payload": {
        "name": "${ref.parentName}·${targetLabel}级种群分布",
        "items": [
          {
            "subtype": "race",
            "name": "区域种群名",
            "summary": "该区域种族群体的特征",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "local_habitat": "在本区域的栖息地（${targetScale} 级已确认地名）",
              "local_traits": ["地域适应的特殊特征"],
              "local_population": "本区域大致数量",
              "local_social_structure": "区域内的社会结构特色",
              "interaction_with_parent": "与父族群的关系"
            }
          },
          {
            "subtype": "subrace",
            "name": "地域亚种",
            "summary": "该区域特有的变体",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "differences": "与主种族的差异",
              "mutation_cause": "变异原因（与本地环境相关）"
            }
          },
          {
            "subtype": "beast",
            "name": "区域妖兽",
            "summary": "该区域特有的妖兽",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "habitat": ["栖息地（${targetScale} 级已确认地名）"],
              "abilities": ["能力"],
              "threat_level": "high",
              "ecological_role": "在本地生态系统中的角色"
            }
          }
        ],
        "relations": [
          { "sourceName": "区域种群A", "targetName": "${ref.parentName}", "relationType": "hierarchy", "label": "是XX种族的分支" },
          { "sourceName": "地域亚种B", "targetName": "地理条目", "relationType": "geographic", "label": "变异区域" }
        ]
      }
    }
  }]
}

## 铁律
- 提供 2-3 个细化方案
- **每一个 item 必须有 scale="${targetScale}" 和 needs_refinement: true**
- **parent_name 必须设为 "${ref.parentName}"**
- 区域种群特征必须与上级种族框架兼容且体现地域环境的影响`;
  }


  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      const ref = ctx.refinement;
      return `请基于已确认的种族/生物条目「${ref.parentName}」（${ref.parentScale}级），
在更细的 ${ref.targetScale} 尺度设计区域栖息地和本地种群。
请先用 query_world_setting 工具查询父条目详情和对应地理条目。`;
    }

    return buildEngineUserMessage("race", ["tone", "geography", "power-system"], genre);
  }

  parseOutput(raw: string): Proposal[] {
    const proposals = this.parseJsonProposals(raw, "种族生物体系设计", 3);

    this.injectRefinementParentId(proposals);
    return proposals;
  }

}
