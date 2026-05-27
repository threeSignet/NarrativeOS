import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage, buildProjectNarrativeSection } from "../../context";

/**
 * ItemSystemEngine — 物品/道具/装备体系架构师（多 pass 自适应版）
 *
 * 支持两种运行模式：
 * 1. 初始模式（无 refinement）→ 产出世界级重要物品体系
 * 2. 细化模式（有 refinement）→ 为指定区域/市场生成地方物品和道具
 *
 * 尺度链（从粗到细）：
 *   universe → galaxy → star_system → planet → continent → region → city → district → scene
 *
 * 初始 pass 定位于 continent/planet 级（世界级神器/重要物品），
 * 细化 pass 对应 region/city 级（区域物品、地方市场特有道具）。
 *
 * 依赖关系：物品承载世界所有维度的信息
 * - power-system：物品的力量来源和品阶体系
 * - character：谁制造、谁持有
 * - geography：物品的精确产地位置（含坐标）
 * - faction：哪些势力控制物品的制造和流通
 * - economy：物品的经济价值和稀缺性
 * - technique：物品与功法/丹药/阵法的关联
 * - history：历史遗物和传承物品
 * - causality：物品的因果链（为什么出现/导致什么后果）
 * - rules：物品受哪些世界规则约束
 */
export class ItemSystemEngine extends Engine {
  constructor() { super("item-system"); }
  protected getModelTier(): "lightweight" | "pro" { return "pro"; }
  protected getContextEngines(): string[] {
    return ["power-system", "character", "geography", "faction", "economy", "technique", "history", "causality", "rules"];
  }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      return this.buildRefinementPrompt(ctx, genre);
    }
    return this.buildInitialPrompt(ctx, genre);
  }

  private buildInitialPrompt(_ctx: EngineContext, genre: string): string {
    return `你是长篇小说创作系统的【物品体系架构师】。

${buildProjectNarrativeSection()}

## 任务
为一部 ${genre} 题材的长篇小说设计物品/道具/装备体系的**顶层架构**。请提供 2-3 个方案。

${buildContextReferenceSection(["power-system", "character", "geography", "faction", "economy", "technique", "history", "causality", "rules"])}

## 重要：如何阅读地理上下文
你将在对话中看到已确认的【地理环境】设定，其中每个地点都标注了：
- scale=（大陆continent/区域region/城市city/地点location/地标landmark）
- (x, y)=精确坐标，范围0-1000
请确保：
- 物品的 location（当前所在地）精确到已确认的城市/地点级别
- 物品的 source/material 的产地引用已确认的资源产地/区域名
- 物品的 market_value 与已确认的经济体系一致

## 重要：尺度定位
本次是初始 pass，定位于 **continent（大陆级）** 尺度。你需要设计的是：
- 世界级的神器（对世界格局有重大影响）
- 跨大陆流通的重要物品
- 有深厚历史背景的传承物品

后续的细化 pass 会为具体区域/城市设计地方特色物品和常见道具。

## 输出格式（Multi-Item）
必须输出纯 JSON，不要 Markdown 代码块：
{
  "proposals": [{
    "type": "item_system",
    "title": "简洁概括方案核心特征的标题",
    "content": {
      "reasoning": "物品体系的设计理念、重要物品的剧情功能、与其他世界系统的关联...",
      "payload": {
        "name": "物品体系名称",
        "items": [
          {
            "subtype": "artifact",
            "name": "神器/重要道具名",
            "summary": "一句话概括该物品的核心功能与剧情意义",
            "content": {
              "scale": "continent",
              "needs_refinement": true,
              "origin": "来源/创造者（必须使用已确认的势力名/历史人物名/事件名）",
              "abilities": ["核心能力1", "核心能力2"],
              "limitations": "使用限制/代价（必须有代价）",
              "current_owner": "当前持有者（必须使用已确认的角色名或势力名）",
              "location": "当前所在位置（必须使用已确认的城市/地点名，并附带坐标）",
              "location_coordinates": { "x": 480, "y": 120 },
              "history": "物品的传承历史（经历了哪些重要持有者/事件）",
              "required_realm": "使用所需的最低境界（如有，必须使用已确认的境界名）",
              "material": "制作材料（必须使用已确认的资源名或妖兽材料名）",
              "material_origin": "材料产地（必须使用已确认的地理区域名）",
              "market_value": "经济价值描述（参考已确认的经济体系）",
              "story_role": "在故事中的功能定位（MacGuffin/Chekhov's Gun/成长道具/身份信物等）",
              "rule_constraints": "受哪些已确认规则的约束（如：使用此物品违反某条世界法则、需要遵守某条规则才能激活）"
            }
          },
          {
            "subtype": "common_item",
            "name": "常见物品/道具名",
            "summary": "一句话概括",
            "content": {
              "scale": "continent",
              "needs_refinement": true,
              "item_type": "物品类型（装备/消耗品/材料/信物/书籍/工具）",
              "rarity": "稀有度（common/uncommon/rare/unique）",
              "effect": "使用效果",
              "source": "获取来源（必须使用已确认的地点名/市场名/势力名）",
              "source_coordinates": { "x": 500, "y": 300 },
              "price_range": "价格区间（参考已确认的经济体系）",
              "related_technique": "关联的功法/丹药（如有，必须使用已确认的名称）"
            }
          }
        ],
        "relations": [
          { "sourceName": "神器A", "targetName": "角色B", "relationType": "dependency", "label": "当前持有" },
          { "sourceName": "势力C", "targetName": "神器A", "relationType": "dependency", "label": "掌控/觊觎" },
          { "sourceName": "神器A", "targetName": "冰风城", "relationType": "geographic", "label": "当前所在地" },
          { "sourceName": "神器A", "targetName": "历史事件D", "relationType": "reference", "label": "曾在其中扮演关键角色" },
          { "sourceName": "神器A", "targetName": "功法E", "relationType": "dependency", "label": "需要此功法才能激活" },
          { "sourceName": "常见物品F", "targetName": "市场G", "relationType": "reference", "label": "主要交易于此" },
          { "sourceName": "常见物品F", "targetName": "北境冰原", "relationType": "geographic", "label": "原材料产地" }
        ]
      }
    }
  }]
}

## 设计原则
- 物品不是独立存在——每件重要物品都要回答：谁造的？用什么材料？材料从哪来？现在在谁手里？谁想要它？
- 神器要有"重量"——不仅仅是能力强，更要有历史故事和使用代价。最强大的神器往往是最危险的
- 物品的经济维度：稀有材料的产地被谁控制？谁会为了垄断某种物品的供应而发动战争？
- 物品是时间胶囊——一件传承千年的神器，本身就是一个微型历史故事
- 常见物品也要有世界特色——同样的"疗伤药"，不同势力/文化可能有完全不同的形式和用法
- 物品关系网：物品连接到功法、丹药、历史
- **物品是空间的连接器**——一件物品从A地产出、在B城交易、被C角色持有、最终在D地发挥作用

## 铁律
- 提供 2-3 个物品体系不同的方案
- 重要物品（artifact）至少 3-5 件，每件都要有来历、代价和剧情功能
- **重要物品的 current_owner 字段必须使用角色体系中已确认的精确角色名**
- **location 字段必须使用地理环境中已确认的精确城市/地点名，并附带 location_coordinates**
- **material 字段必须使用已确认的资源名或妖兽材料名，material_origin 必须使用已确认的地理区域名**
- 物品的经济价值必须参考已确认的经济体系，不能自相矛盾
- 至少 1 件物品能直接驱动主线剧情（不是"顺便用到的道具"而是"没有它就讲不下去"）
- **每一个 item 必须有 scale 和 needs_refinement: true 字段**
- scale 字段使用 "continent"（大陆级）

## 反面示例（绝对不要这样做）
- 神器只是"很厉害的武器"——没有历史、没有代价、没有持有者之间的争夺故事
- 物品的 current_owner 和 location 凭空编造——必须引用已确认的角色名和地名
- 物品的材料来源不明确——"天上掉下来的陨铁"用一两次可以，但不能所有神器都靠天降
- 物品定价脱离经济体系——如果灵石矿被某个势力垄断，灵石相关的物品价格应该反映这种垄断
- 物品只是"主角的装备列表"——重要物品应该有独立的剧情线，有多个势力/角色在争夺
- 物品的 location 不精确——"在北境某处"不够，要具体到"冰风城的猎人公会地下密室"`;
  }

  private buildRefinementPrompt(ctx: EngineContext, genre: string): string {
    const ref = ctx.refinement!;
    const targetScale = ref.targetScale;
    const targetLabel = this.getScaleLabel(targetScale);

    return `你是长篇小说创作系统的【物品体系架构师】。

## 任务
为已确认的物品/区域条目「${ref.parentName}」在更细的 **${targetLabel}（${targetScale}）** 尺度设计区域物品和地方道具。

父条目层级：${ref.parentScale}  目标细化层级：${targetScale}

${buildContextReferenceSection(["power-system", "character", "geography", "faction", "economy", "technique", "history", "causality", "rules"])}

## 细化策略
请使用 \`query_world_setting\` 工具查询以下数据：
1. 父条目「${ref.parentName}」的详细设定（如果是区域/城市，了解其地理经济；如果是物品，了解其传承链）
2. ${targetScale} 级别的已确认地理条目、地方市场和资源产地
3. 该区域的势力分布和经济控制格局

为更细地理区域设计**地方物品**：
- 如果父条目是神器→设计其仿制品/残片/关联物品的详细分布
- 如果父条目是区域/城市→设计该地的特色物产、地方市场专属道具
- 区域内常见的消耗品和装备（符合当地经济和资源特性）

## 输出格式
{
  "proposals": [{
    "type": "item_system",
    "title": "「${ref.parentName}」的${targetLabel}级物品细化",
    "content": {
      "reasoning": "细化逻辑、区域物品的特色...",
      "payload": {
        "name": "${ref.parentName}·${targetLabel}级物品",
        "items": [
          {
            "subtype": "artifact",
            "name": "区域重要物品",
            "summary": "该物品在区域中的重要性",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "origin": "来源",
              "abilities": ["能力"],
              "limitations": "使用限制",
              "current_owner": "当前持有者",
              "location": "当前所在地（${targetScale} 级已确认地名）",
              "location_coordinates": { "x": 480, "y": 120 },
              "relationship_to_parent": "与父级物品/区域的关系",
              "regional_significance": "在本地域的特殊意义"
            }
          },
          {
            "subtype": "common_item",
            "name": "地域特色物品",
            "summary": "该区域特有的常见物品",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "item_type": "物品类型",
              "rarity": "稀有度",
              "effect": "效果",
              "source": "获取来源（${targetScale} 级已确认地名）",
              "source_coordinates": { "x": 500, "y": 300 },
              "price_range": "价格区间",
              "local_production": "为什么此地盛产此物品",
              "related_local_market": "关联的地方市场"
            }
          }
        ],
        "relations": [
          { "sourceName": "区域物品A", "targetName": "${ref.parentName}", "relationType": "hierarchy", "label": "是XX神器的仿制品/关联品" },
          { "sourceName": "地域特色品B", "targetName": "地方市场", "relationType": "reference", "label": "主产于此的交易" }
        ]
      }
    }
  }]
}

## 铁律
- 提供 2-3 个细化方案
- **每一个 item 必须有 scale="${targetScale}" 和 needs_refinement: true**
- **parent_name 必须设为 "${ref.parentName}"**
- 区域物品必须与上级物品体系逻辑一致，location 和 material_origin 必须引用已确认地名`;
  }


  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      const ref = ctx.refinement;
      return `请基于已确认的物品/区域条目「${ref.parentName}」（${ref.parentScale}级），
在更细的 ${ref.targetScale} 尺度设计区域物品和地方特色道具。
请先用 query_world_setting 工具查询父条目详情和对应区域/市场条目。`;
    }

    return buildEngineUserMessage("item-system", ["power-system", "character", "geography", "faction", "economy", "technique", "history", "causality", "rules"], genre);
  }

  parseOutput(raw: string): Proposal[] {
    const proposals = this.parseJsonProposals(raw, "物品体系设计", 3);

    this.injectRefinementParentId(proposals);
    return proposals;
  }

}
