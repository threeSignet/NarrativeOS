import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage, buildProjectNarrativeSection, buildGeographyBindingSection } from "../../context";

/**
 * EconomyEngine — 经济体系架构师（多 pass 自适应版）
 *
 * 支持两种运行模式：
 * 1. 初始模式（无 refinement）→ 产出世界级经济体系顶层架构
 * 2. 细化模式（有 refinement）→ 为指定区域在更细尺度设计区域经济和贸易
 *
 * 尺度链（从粗到细）：
 *   universe → galaxy → star_system → planet → continent → region → city → district → scene
 *
 * 初始 pass 定位于 planet 级（世界级经济体系），
 * 细化 pass 对应 region 级（区域经济、地方贸易路线）。
 */
export class EconomyEngine extends Engine {
  constructor() { super("economy"); }
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
    return `你是长篇小说创作系统的【经济体系架构师】。

${buildProjectNarrativeSection()}

## 任务
为一部 ${genre} 题材的长篇小说设计经济体系的**顶层架构**。请提供 2-3 个经济格局不同的方案。

${buildContextReferenceSection(["tone", "geography", "power-system", "faction"])}

${buildGeographyBindingSection()}

## 重要：尺度定位
本次是初始 pass，定位于 **planet（世界级）** 尺度。你需要设计的是：
- 世界级核心资源的分布格局
- 跨大陆/跨世界的宏观货币体系
- 洲际贸易路线的骨架
- 全球性行会/商会组织

后续的细化 pass 会为具体区域设计地方经济和区域贸易。

## 输出格式（Multi-Item）
必须输出纯 JSON，不要 Markdown 代码块：
{
  "proposals": [{
    "type": "economy",
    "title": "简洁概括经济方案核心特征的标题",
    "content": {
      "reasoning": "经济体系的设计理念、资源分配如何驱动冲突、不同方案的经济矛盾点...",
      "payload": {
        "name": "经济体系名称",
        "items": [
          {
            "subtype": "resource",
            "name": "资源名",
            "summary": "一句话概括该资源的战略价值",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "resource_type": "mineral",
              "source_regions": ["主要产地（已确认的区域名）"],
              "scarcity": "rare",
              "uses": ["用途1", "用途2"],
              "controlled_by": ["控制该资源的势力（已确认的势力名）"],
              "extraction_difficulty": "采集/开采难度",
              "renewable": false,
              "geographic_bindings": [
                { "location_name": "已确认的区域名", "binding_type": "resource_source", "description": "资源产地" }
              ]
            }
          },
          {
            "subtype": "currency",
            "name": "货币名",
            "summary": "一句话概括货币体系",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "currency_form": "coin",
              "issued_by": "发行方（已确认的势力名）",
              "circulation_area": ["流通范围（已确认的区域名/势力名）"],
              "exchange_rate": "与其他货币的兑换关系",
              "value_backing": "价值支撑（如：灵石本位/黄金本位/信用）",
              "counterfeiting_issue": "假币问题（如有）"
            }
          },
          {
            "subtype": "trade_route",
            "name": "贸易路线名",
            "summary": "一句话概括路线的重要性",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "transport_method": "caravan",
              "origin_point": "起点（已确认的地点名）",
              "route_points": ["途经点1", "途经点2"],
              "goods_transported": ["主要货物1", "货物2"],
              "hazards": ["路线风险1", "风险2"],
              "route_controlled_by": ["控制势力（已确认的势力名）"],
              "tolls": "通行费用/税收"
            }
          },
          {
            "subtype": "market",
            "name": "市场名",
            "summary": "一句话概括市场特色",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "location": "所在地（已确认的地点名）",
              "market_scale": "regional",
              "specialty_goods": ["特色商品1", "商品2"],
              "operated_by": "经营势力（已确认的势力名）",
              "trade_rules": "特殊交易规则（如有）",
              "geographic_bindings": [
                { "location_name": "已确认的地点名", "binding_type": "headquarters", "description": "市场所在地" }
              ]
            }
          },
          {
            "subtype": "guild",
            "name": "行会/商会名",
            "summary": "一句话概括行会的定位",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "guild_type": "merchant",
              "headquarters": "总部所在地（已确认的地点名）",
              "member_count": "规模（如：核心成员200人/外围数千）",
              "monopoly": "垄断的行业/领域",
              "political_connections": "与势力的关系/政治影响力"
            }
          }
        ],
        "relations": [
          { "sourceName": "资源A", "targetName": "区域B", "relationType": "geographic", "label": "主产地" },
          { "sourceName": "势力C", "targetName": "资源A", "relationType": "dependency", "label": "垄断开采" },
          { "sourceName": "贸易路线D", "targetName": "资源A", "relationType": "dependency", "label": "主要运输货品" },
          { "sourceName": "市场E", "targetName": "贸易路线D", "relationType": "reference", "label": "枢纽节点" },
          { "sourceName": "行会F", "targetName": "市场E", "relationType": "affiliation", "label": "实际控制者" },
          { "sourceName": "货币G", "targetName": "行会F", "relationType": "dependency", "label": "由该行会发行和担保" }
        ]
      }
    }
  }]
}

## 设计原则
- 经济是"无声的权力"——谁控制关键资源，谁就掌握真正的权力
- 稀缺资源是冲突的天然引信——两方争夺一处灵石矿脉比"理念不同"更真实
- 货币体系反映权力结构：统一货币=统一政权，分裂货币=分裂格局
- 贸易路线不仅是地图上的线——每条路线都是风险与收益的博弈，也是情报/文化的通道
- 行会/商会不只是"做生意的"——它们有自己的政治议程和情报网络
- 经济不平等是许多社会矛盾的根源，要设计贫富分化如何影响故事

## 铁律
- 提供 2-3 个经济格局不同的方案（不同核心资源、不同货币体系、不同控制格局）
- 所有区域名、地点名、势力名必须使用上下文参考中已确认的精确名称，不得自行编造
- 至少设计 1 条能成为故事关键情节的贸易路线（主角押镖/遇袭/发现走私等）
- 至少设计 1 种因资源争夺而产生的势力冲突
- **每一个 item 必须有 scale 和 needs_refinement: true 字段**
- scale 字段使用 "planet"（世界级）

## 反面示例（绝对不要这样做）
- 所有资源均匀分布、各国自给自足——资源不均匀才会有贸易和战争
- 货币只是"金币/银币/铜币"的换皮——要根据世界的物质基础设计货币（修仙世界用灵石、魔法世界用法力结晶）
- 贸易路线没有风险——每条路线都应该有至少一个危险（盗匪/妖兽/自然险阻/势力关卡）
- 行会没有政治立场——经济组织必然与政治势力有或明或暗的关系`;
  }

  private buildRefinementPrompt(ctx: EngineContext, genre: string): string {
    const ref = ctx.refinement!;
    const targetScale = ref.targetScale;
    const targetLabel = this.getScaleLabel(targetScale);

    return `你是长篇小说创作系统的【经济体系架构师】。

## 任务
为已确认的经济条目「${ref.parentName}」在更细的 **${targetLabel}（${targetScale}）** 尺度设计区域经济体系。

父条目层级：${ref.parentScale}  目标细化层级：${targetScale}

${buildContextReferenceSection(["tone", "geography", "power-system", "faction"])}

${buildGeographyBindingSection()}

## 细化策略
请使用 \`query_world_setting\` 工具查询以下数据：
1. 父条目「${ref.parentName}」的详细设定
2. ${targetScale} 级别的已确认地理条目
3. 该区域已确认的势力分布和经济控制格局

为这些更细的地理区域设计**区域经济要素**：
- 区域特产和本地资源
- 区域之间的短途贸易路线
- 地方市场和交易中心
- 本地行会/商会分支

## 输出格式
{
  "proposals": [{
    "type": "economy",
    "title": "「${ref.parentName}」的${targetLabel}级经济细化",
    "content": {
      "reasoning": "细化逻辑、区域经济差异的成因...",
      "payload": {
        "name": "${ref.parentName}·${targetLabel}级经济",
        "items": [
          {
            "subtype": "resource",
            "name": "区域特色资源",
            "summary": "该区域特有资源的战略价值",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "resource_type": "mineral",
              "source_regions": ["产地（${targetScale} 级已确认地名）"],
              "scarcity": "rare",
              "controlled_by": ["控制势力"],
              "regional_dependency": "该资源对区域经济的支撑作用"
            }
          },
          {
            "subtype": "trade_route",
            "name": "区域贸易路线",
            "summary": "区域间短途贸易路线",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "transport_method": "caravan",
              "origin_point": "起点（${targetScale} 级已确认地名）",
              "route_points": ["途经点"],
              "goods_transported": ["主要货物"],
              "hazards": ["风险"],
              "connection_to_parent": "与父级贸易路线的衔接关系"
            }
          },
          {
            "subtype": "market",
            "name": "地方市场",
            "summary": "区域本地交易市场",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "location": "所在地（${targetScale} 级已确认地名）",
              "specialty_goods": ["本地特色商品"],
              "operated_by": "经营势力",
              "regional_role": "在区域经济中的枢纽作用"
            }
          }
        ],
        "relations": [
          { "sourceName": "区域资源A", "targetName": "${ref.parentName}", "relationType": "hierarchy", "label": "属于XX资源带" },
          { "sourceName": "地方市场B", "targetName": "地理条目", "relationType": "geographic", "label": "位于" }
        ]
      }
    }
  }]
}

## 铁律
- 提供 2-3 个细化方案
- **每一个 item 必须有 scale="${targetScale}" 和 needs_refinement: true**
- **parent_name 必须设为 "${ref.parentName}"**
- 区域经济要素必须与上级经济体系逻辑一致`;
  }


  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      const ref = ctx.refinement;
      return `请基于已确认的经济条目「${ref.parentName}」（${ref.parentScale}级），
在更细的 ${ref.targetScale} 尺度设计区域经济体系。
请先用 query_world_setting 工具查询父条目详情和对应地理/势力条目。`;
    }

    return buildEngineUserMessage("economy", ["geography", "faction"], genre);
  }

  parseOutput(raw: string): Proposal[] {
    const proposals = this.parseJsonProposals(raw, "经济体系设计", 3);

    this.injectRefinementParentId(proposals);
    return proposals;
  }

}
