import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage, buildProjectNarrativeSection } from "../../context";

/**
 * ConflictEngine — 核心矛盾架构师（多 pass 自适应版）
 *
 * 支持两种运行模式：
 * 1. 初始模式（无 refinement）→ 产出世界级矛盾体系顶层架构
 * 2. 细化模式（有 refinement）→ 为指定区域/势力生成更细粒度的本地冲突
 *
 * 尺度链（从粗到细）：
 *   universe → galaxy → star_system → planet → continent → region → city → district → scene
 *
 * 初始 pass 定位于 planet/continent 级（世界级矛盾），
 * 细化 pass 对应 region 级（区域矛盾、势力间局部冲突）。
 */
export class ConflictEngine extends Engine {
  constructor() { super("conflict"); }
  protected getModelTier(): "lightweight" | "pro" { return "pro"; }
  protected getContextEngines(): string[] { return ["tone", "geography", "faction", "character", "power-system", "history", "economy", "rules"]; }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      return this.buildRefinementPrompt(ctx, genre);
    }
    return this.buildInitialPrompt(ctx, genre);
  }

  private buildInitialPrompt(_ctx: EngineContext, genre: string): string {
    return `你是长篇小说创作系统的【核心矛盾架构师】。

${buildProjectNarrativeSection()}

## 任务
为一部 ${genre} 题材的长篇小说设计核心矛盾体系的**顶层架构**。请提供 2-3 个矛盾结构不同的方案。

${buildContextReferenceSection(["tone", "geography", "faction", "character", "power-system", "history", "economy", "rules"])}

## 重要：尺度定位
本次是初始 pass，定位于 **continent（大陆级）** 尺度。你需要设计的是：
- 世界级/大陆级的核心矛盾（改变世界格局的冲突）
- 跨势力/跨大陆的大规模利害关系
- 全局性的矛盾升级路径

后续的细化 pass 会为具体区域设计本地矛盾和势力间局部摩擦。

## 输出格式（Multi-Item）
必须输出纯 JSON，不要 Markdown 代码块：
{
  "proposals": [{
    "type": "conflict",
    "title": "简洁概括矛盾方案的标题",
    "content": {
      "reasoning": "矛盾设计的逻辑、冲突的层次结构、不同矛盾之间的关联...",
      "payload": {
        "name": "矛盾体系名称",
        "items": [
          {
            "subtype": "conflict",
            "name": "核心矛盾名称",
            "summary": "一句话概括矛盾本质",
            "content": {
              "scale": "continent",
              "needs_refinement": true,
              "type": "矛盾类型（价值观冲突/资源争夺/权力斗争/种族对立/意识形态/生存威胁/历史恩怨）",
              "parties": ["参与方1（已确认的势力名/角色名/种族名）", "参与方2"],
              "stakes": "利害关系（赢了获得什么？输了失去什么？为什么双方都无法退让？）",
              "origin": "矛盾起源（必须关联已确认的历史事件，说明矛盾的历史根源）",
              "current_state": "当前状态（冷战/热战/谈判中/潜伏中/一触即发）",
              "geographic_focus": "矛盾的地理焦点（在哪个区域/城市展开？必须引用已确认的地名）",
              "economic_dimension": "矛盾的经济维度（争夺什么资源？已确认的资源名/贸易路线名）",
              "rule_dimension": "矛盾的规则维度（涉及哪些已确认的世界规则/社会规则？哪一方在利用规则漏洞？）"
            }
          },
          {
            "subtype": "stake",
            "name": "利害点名称",
            "summary": "一句话概括利害关系",
            "content": {
              "scale": "continent",
              "needs_refinement": true,
              "affected_parties": ["受影响方（已确认的名称）"],
              "affected_locations": ["受影响的地理位置（已确认的地名）"],
              "consequence": "如果矛盾爆发/升级会带来什么具体后果",
              "bystander_impact": "对旁观者/平民的影响（战争不是只发生在战场上）"
            }
          },
          {
            "subtype": "escalation",
            "name": "升级节点名称",
            "summary": "触发矛盾升级的关键事件",
            "content": {
              "scale": "continent",
              "needs_refinement": true,
              "trigger": "触发条件（具体的可叙事事件，不是抽象的机会）",
              "trigger_location": "触发事件的发生地点（已确认的城市/地点名）",
              "stages": ["阶段1：冷战/摩擦", "阶段2：局部冲突/代理人战争", "阶段3：全面对抗/末日级冲突"],
              "resolution": "可能的解决方式（真正解决/暂时压制/同归于尽/第三方介入/外敌威胁促使和解）",
              "who_benefits": "谁从矛盾升级中获益？（没有永恒的朋友，只有永恒的利益）"
            }
          }
        ],
        "relations": [
          { "sourceName": "矛盾A", "targetName": "势力B", "relationType": "dependency", "label": "以该势力为主要推动方" },
          { "sourceName": "矛盾A", "targetName": "历史事件C", "relationType": "reference", "label": "源于" },
          { "sourceName": "矛盾A", "targetName": "角色D", "relationType": "dependency", "label": "关键人物的个人恩怨加剧了矛盾" },
          { "sourceName": "矛盾A", "targetName": "冰风城", "relationType": "geographic", "label": "矛盾的地理焦点" },
          { "sourceName": "升级点E", "targetName": "矛盾A", "relationType": "hierarchy", "label": "升级路径" }
        ]
      }
    }
  }]
}

## 设计原则
- 矛盾要有"多层结构"——表层冲突（争夺领土）下面要有深层冲突（文化认同/历史仇恨/生存恐惧）
- 核心矛盾要能"分布式展开"——主角的个人成长、势力对抗、更大的世界危机，三层矛盾互相嵌套
- 利害关系要有"无法退让"的设计——如果双方都有退路，那冲突就不够强烈
- 矛盾升级不是线性的——有突然激化（暗杀/背叛/天灾）也有暂时缓和（和亲/停战协议/共同敌人）
- 所有重大矛盾都应该是"可以赢也可以输"的——读者不能确定谁会赢
- 矛盾的经济根源：大多数"意识形态冲突"背后都有经济利益的影子
- **矛盾要有"空间维度"**——冲突在哪个地理区域展开？为什么是这里而不是别处？地形如何影响冲突的形式？

## 铁律
- 提供 2-3 个矛盾结构不同的方案（不同核心冲突类型）
- 核心矛盾要有深度，不能是简单的善恶对立
- 矛盾的起源必须与已确认的历史事件关联，不能凭空出现
- 矛盾要能驱动整个故事的主线发展
- 参与方必须使用已确认的势力名/角色名/种族名
- **geographic_focus 必须引用已确认的精确地名（城市/区域级别）**
- **矛盾的经济维度必须引用已确认的资源名/贸易路线名**
- **矛盾的规则维度必须引用已确认的世界规则/社会规则**
- **每一个 item 必须有 scale 和 needs_refinement: true 字段**
- scale 字段使用 "continent"（大陆级）

## 反面示例（绝对不要这样做）
- 核心矛盾是"正义 vs 邪恶"——除非每一方都认为自己是正义的
- 矛盾没有历史根源（"不知道为什么就打起来了"）——没有历史深度的冲突经不起读者推敲
- 矛盾不需要经济维度（"他们打架纯粹是为了荣誉"）——在长篇中，什么都需要资源支撑
- 所有矛盾同时激烈爆发——要有主次、有先后、有伏笔
- 矛盾没有地理焦点——"全大陆都在打仗"不如"三大势力围绕天脊山脉的控制权展开争夺"`;
  }

  private buildRefinementPrompt(ctx: EngineContext, genre: string): string {
    const ref = ctx.refinement!;
    const targetScale = ref.targetScale;
    const targetLabel = this.getScaleLabel(targetScale);

    return `你是长篇小说创作系统的【核心矛盾架构师】。

## 任务
为已确认的矛盾条目「${ref.parentName}」在更细的 **${targetLabel}（${targetScale}）** 尺度设计区域矛盾和局部摩擦。

父条目层级：${ref.parentScale}  目标细化层级：${targetScale}

${buildContextReferenceSection(["tone", "geography", "faction", "character", "power-system", "history", "economy", "rules"])}

## 细化策略
请使用 \`query_world_setting\` 工具查询以下数据：
1. 父条目「${ref.parentName}」的详细设定
2. ${targetScale} 级别的已确认地理条目
3. 该区域已确认的势力分布、经济布局和历史事件

为更细地理区域设计**局部矛盾**：
- 父级核心矛盾在特定区域的具体表现（如：世界级神战在本区域的阵营对立）
- 区域内势力之间的独立矛盾和摩擦
- 区域特有的利害冲突点

## 输出格式
{
  "proposals": [{
    "type": "conflict",
    "title": "「${ref.parentName}」的${targetLabel}级矛盾细化",
    "content": {
      "reasoning": "细化逻辑、区域矛盾的特殊性...",
      "payload": {
        "name": "${ref.parentName}·${targetLabel}级冲突",
        "items": [
          {
            "subtype": "conflict",
            "name": "区域矛盾",
            "summary": "该矛盾在本地域的表现",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "type": "矛盾类型",
              "parties": ["参与方"],
              "stakes": "利害关系",
              "connection_to_parent": "与父级矛盾的关系（直接延伸/间接影响/独立摩擦）",
              "geographic_focus": "本地矛盾的地理焦点（${targetScale} 级已确认地名）",
              "current_state": "当前状态"
            }
          },
          {
            "subtype": "stake",
            "name": "区域利害点",
            "summary": "该区域特有的利害关系",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "affected_parties": ["受影响方"],
              "affected_locations": ["受影响地点（${targetScale} 级已确认地名）"],
              "consequence": "后果",
              "local_bystander_impact": "对本地平民的影响"
            }
          },
          {
            "subtype": "escalation",
            "name": "区域升级节点",
            "summary": "本地矛盾的引爆点",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "trigger": "触发条件",
              "trigger_location": "触发地点",
              "stages": ["阶段1", "阶段2"],
              "relationship_to_parent_escalation": "与父级升级路径的衔接关系"
            }
          }
        ],
        "relations": [
          { "sourceName": "区域矛盾A", "targetName": "${ref.parentName}", "relationType": "hierarchy", "label": "是XX矛盾的区域表现" },
          { "sourceName": "区域矛盾A", "targetName": "地理条目", "relationType": "geographic", "label": "矛盾的地理焦点" }
        ]
      }
    }
  }]
}

## 铁律
- 提供 2-3 个细化方案
- **每一个 item 必须有 scale="${targetScale}" 和 needs_refinement: true**
- **parent_name 必须设为 "${ref.parentName}"**
- 区域矛盾必须与上级矛盾框架有清晰的逻辑关联`;
  }


  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      const ref = ctx.refinement;
      return `请基于已确认的矛盾条目「${ref.parentName}」（${ref.parentScale}级），
在更细的 ${ref.targetScale} 尺度设计区域矛盾和局部摩擦。
请先用 query_world_setting 工具查询父矛盾详情和对应区域/势力条目。`;
    }

    return buildEngineUserMessage("conflict", ["tone", "faction", "character", "power-system", "history", "economy", "rules"], genre);
  }

  parseOutput(raw: string): Proposal[] {
    const proposals = this.parseJsonProposals(raw, "核心矛盾设计", 3);

    this.injectRefinementParentId(proposals);
    return proposals;
  }

}
