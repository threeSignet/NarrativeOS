import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage, buildProjectNarrativeSection } from "../../context";

/**
 * CharacterEngine — 角色体系架构师（多 pass 自适应版）
 *
 * 支持两种运行模式：
 * 1. 初始模式（无 refinement）→ 产出主要角色体系（主角+核心配角）
 * 2. 细化模式（有 refinement）→ 为指定区域/势力生成本地角色和次要角色
 *
 * 尺度链（从粗到细）：
 *   universe → galaxy → star_system → planet → continent → region → city → district → scene
 *
 * 初始 pass 定位于 continent/region 级（核心角色分布），
 * 细化 pass 对应 city/region 级（本地角色、地方配角）。
 */
export class CharacterEngine extends Engine {
  constructor() { super("character"); }
  protected getModelTier(): "lightweight" | "pro" { return "pro"; }
  protected getContextEngines(): string[] { return ["tone", "faction", "power-system", "geography", "race", "rules"]; }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      return this.buildRefinementPrompt(ctx, genre);
    }
    return this.buildInitialPrompt(ctx, genre);
  }

  private buildInitialPrompt(_ctx: EngineContext, genre: string): string {
    return `你是长篇小说创作系统的【角色体系架构师】。

${buildProjectNarrativeSection()}

## 任务
为一部 ${genre} 题材的长篇小说设计核心角色体系**顶层架构**。请提供 2-3 个方案（不同主角设定、不同角色关系网）。

${buildContextReferenceSection(["tone", "faction", "power-system", "geography", "race", "rules"])}

## 重要：如何阅读地理上下文
你将在对话中看到已确认的【地理环境】设定，其中每个地点都标注了：
- scale=（大陆continent/区域region/城市city/地点location/地标landmark）
- (x, y)=精确坐标，范围0-1000
请为每个角色选择合适的地理位置，确保角色的 location 精确到已确认的城市或地点级别。

## 重要：尺度定位
本次是初始 pass，定位于 **continent（大陆级）** 尺度。你需要设计的是：
- 主角（1位）+ 核心配角（3-8位），分布在不同大陆/主要区域
- 有世界级/大陆级影响力的重要NPC
- 角色在宏观空间上的分布

后续的细化 pass 会为具体区域/城市生成本地角色和次要配角。

## 输出格式（Multi-Item）
必须输出纯 JSON，不要 Markdown 代码块：
{
  "proposals": [{
    "type": "character",
    "title": "简洁概括角色方案核心特征的标题",
    "content": {
      "reasoning": "角色设计的核心理念、角色关系网的戏剧张力、角色弧线的规划...",
      "payload": {
        "name": "角色体系名称",
        "items": [
          {
            "subtype": "protagonist",
            "name": "主角姓名",
            "summary": "一句话概括主角的核心魅力",
            "content": {
              "scale": "continent",
              "needs_refinement": true,
              "age": "年龄",
              "identity": "身份/职业/社会地位",
              "race": "种族（必须使用已确认的种族名，如为人类则写'人类-XX文化圈'）",
              "personality": "性格（不只是形容词，要说明性格如何在行动中体现）",
              "motivation": "核心动机（最开始想要什么？最终真正需要什么？）",
              "flaw": "致命弱点/性格缺陷（必须是真的会阻碍他的缺陷，不是'太善良'）",
              "power_level": "当前实力（必须使用已确认的境界名）",
              "background": "出身背景（要具体到出生地点/家庭/关键经历，地点必须使用已确认的地名）",
              "faction": "所属势力（必须使用已确认的势力名）",
              "location": "当前所在位置（必须使用已确认的城市/地点名，不是区域名，要精确到具体城市）",
              "location_coordinates": { "x": 480, "y": 120 },
              "growth_arc": "成长弧线简述（从什么状态→经历什么→成长为什么状态）",
              "rule_constraints": "受哪些已确认规则的约束/影响（如：修为上限被某规则限制、行为受某社会规则约束）"
            }
          },
          {
            "subtype": "character",
            "name": "配角名",
            "summary": "一句话概括该角色在故事中的功能",
            "content": {
              "scale": "continent",
              "needs_refinement": true,
              "age": "年龄",
              "identity": "身份",
              "race": "种族（已确认的种族名）",
              "role": "在故事中的定位（导师/对手/盟友/爱慕对象/喜剧调剂/悲剧警示等）",
              "personality": "性格",
              "relationship_to_mc": "与主角的关系及关系演变方向",
              "faction": "所属势力（已确认的势力名）",
              "location": "所在位置（必须使用已确认的城市/地点名）",
              "location_coordinates": { "x": 500, "y": 200 },
              "power_level": "当前实力（已确认的境界名）",
              "personal_goal": "个人目标（独立于主角的、属于自己的动机）",
              "conflict_with_mc": "与主角可能产生的矛盾点"
            }
          }
        ],
        "relations": [
          { "sourceName": "主角", "targetName": "配角A", "relationType": "affiliation", "label": "同门师兄弟" },
          { "sourceName": "主角", "targetName": "配角B", "relationType": "opposition", "label": "亦敌亦友的竞争关系" },
          { "sourceName": "配角A", "targetName": "势力C", "relationType": "affiliation", "label": "核心成员" },
          { "sourceName": "主角", "targetName": "冰风城", "relationType": "geographic", "label": "当前所在地" }
        ]
      }
    }
  }]
}

## 设计原则
- 主角要有"可操作性"——缺陷必须是真正能推动剧情的（傲慢导致盟友背离、恐惧导致错失良机），不是装饰性的
- 配角不是主角的"附属品"——每个配角要有独立于主角的个人目标，这会让他们的选择更真实、更难预测
- 角色团要"功能互补"——智者/战士/说客/技术专家/道德标尺/喜剧调剂，同一功能不要重复
- 角色关系是动态的——"初始是敌人→中间被迫合作→最后成为挚友"比"一直是敌人"有故事
- 每个角色的实力定位要清晰——与力量体系的境界对应，不同境界的角色不能随意打平手
- 种族归属影响角色——不同种族有不同的寿命观、价值观、社会地位
- **角色的地理位置是故事空间锚点**——不同地点的角色才有机会发生"相遇"和"冲突"

## 铁律
- 提供 2-3 个角色配置明显不同的方案（不同主角出身、不同配角组合、不同关系网）
- 每个角色要有独特的性格、动机和弱点
- 角色之间要有真实的关系动态，不是简单的盟友/敌人二分
- **faction、location、race、power_level 字段必须使用上下文参考中已确认的精确名称，不得自行编造或改写**
- **location 必须精确到已确认的城市/地点级别（不是区域级别），并且填写 location_coordinates**
- **不同角色的 location 应该分布在不同地点**——让角色在空间上有距离感
- 主角的成长弧线要清晰：起点→转折→终点
- **每一个 item 必须有 scale 和 needs_refinement: true 字段**
- scale 字段使用 "continent"（大陆级）

## 反面示例（绝对不要这样做）
- 主角的 flaw 写"太善良"或"太重感情"——这不是缺陷，这是美德
- 配角只为主角服务（"A是主角的好友，总是支持主角"）——配角要有自己的议程
- 角色名自己编造、势力名对不上——必须严格引用已确认的名称
- 所有角色实力相同（"都差不多"）——实力差异是角色之间权力关系的基础
- 种族身份写"人类"但没有具体文化背景——要说明是什么文化/区域出身的人类
- 所有角色的 location 填同一个地名——角色应该有空间分布
- location 填区域名（如"北境"）而不是具体城市名（如"冰风城"）——要精确到城市级别`;
  }

  private buildRefinementPrompt(ctx: EngineContext, genre: string): string {
    const ref = ctx.refinement!;
    const targetScale = ref.targetScale;
    const targetLabel = this.getScaleLabel(targetScale);

    return `你是长篇小说创作系统的【角色体系架构师】。

## 任务
为已确认的角色/区域条目「${ref.parentName}」在更细的 **${targetLabel}（${targetScale}）** 尺度设计本地角色。

父条目层级：${ref.parentScale}  目标细化层级：${targetScale}

${buildContextReferenceSection(["tone", "faction", "power-system", "geography", "race", "rules"])}

## 细化策略
请使用 \`query_world_setting\` 工具查询以下数据：
1. 父条目「${ref.parentName}」的详细设定（如果是区域/城市，了解其地理和势力；如果是角色，了解其社交圈）
2. ${targetScale} 级别的已确认地理条目
3. 该区域已确认的势力分布和种族构成

为更细地理区域设计**本地角色**：
- 如果父条目是区域→设计该区域的本地重要人物（城主/族长/地头蛇/隐世高手等）
- 如果父条目是城市→设计该城市的居住者和活跃角色
- 如果父条目是角色→设计该角色的下属、追随者、学徒等关联人物
- 次要角色，对主线有辅助作用但不占据核心位置

## 输出格式
{
  "proposals": [{
    "type": "character",
    "title": "「${ref.parentName}」的${targetLabel}级角色细化",
    "content": {
      "reasoning": "细化逻辑、本地角色的功能...",
      "payload": {
        "name": "${ref.parentName}·${targetLabel}级角色",
        "items": [
          {
            "subtype": "character",
            "name": "本地角色名",
            "summary": "该角色在本地故事中的功能",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "age": "年龄",
              "identity": "身份",
              "race": "种族（已确认的种族名）",
              "role": "在故事中的定位",
              "personality": "性格",
              "relationship_to_parent": "与父条目的关系（如：该城城主/XX角色的下属/该区域有名的冒险者）",
              "faction": "所属势力",
              "location": "所在位置（${targetScale} 级已确认地名）",
              "location_coordinates": { "x": 500, "y": 300 },
              "power_level": "当前实力",
              "personal_goal": "个人目标",
              "regional_significance": "在本地域的重要性"
            }
          }
        ],
        "relations": [
          { "sourceName": "本地角色A", "targetName": "${ref.parentName}", "relationType": "geographic", "label": "居住于/活动于" },
          { "sourceName": "本地角色A", "targetName": "势力名", "relationType": "affiliation", "label": "隶属于" }
        ]
      }
    }
  }]
}

## 铁律
- 提供 2-3 个细化方案
- **每一个 item 必须有 scale="${targetScale}" 和 needs_refinement: true**
- **parent_name 必须设为 "${ref.parentName}"**
- 本地角色必须有清晰的功能定位，不能是"路人甲"
- 所有势力名、种族名、地名必须引用已确认的精确名称`;
  }


  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      const ref = ctx.refinement;
      return `请基于已确认的角色/区域条目「${ref.parentName}」（${ref.parentScale}级），
在更细的 ${ref.targetScale} 尺度设计本地角色和次要配角。
请先用 query_world_setting 工具查询父条目详情和对应地理/势力条目。`;
    }

    return buildEngineUserMessage("character", ["tone", "faction", "power-system", "geography", "race", "rules"], genre);
  }

  parseOutput(raw: string): Proposal[] {
    const proposals = this.parseJsonProposals(raw, "角色体系设计", 3);

    this.injectRefinementParentId(proposals);
    return proposals;
  }

}
