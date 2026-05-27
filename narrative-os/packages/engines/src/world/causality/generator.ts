import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage, buildProjectNarrativeSection } from "../../context";

/**
 * CausalityEngine — 因果引擎（世界观引擎群的"连接组织"，多 pass 自适应版）
 *
 * 支持两种运行模式：
 * 1. 初始模式（无 refinement）→ 产出世界级因果体系顶层架构
 * 2. 细化模式（有 refinement）→ 为指定事件/区域生成细粒度的因果链和涟漪效应
 *
 * 尺度链（从粗到细）：
 *   universe → galaxy → star_system → planet → continent → region → city → district → scene
 *
 * 初始 pass 定位于 planet 级（世界级因果链），
 * 细化 pass 对应 region 级（区域涟漪效应、局部因果链）。
 *
 * 因果引擎不产生新的实体设定，而是揭示已有实体之间的因果联系。
 *
 * 核心职责：
 * 1. 建立事件之间的因果链（A→B→C）
 * 2. 分析重大事件的涟漪效应（向多个领域的扩散）
 * 3. 识别改变世界走向的关键转折点及其替代路径
 */
export class CausalityEngine extends Engine {
  constructor() { super("causality"); }
  protected getModelTier(): "lightweight" | "pro" { return "pro"; }
  protected getContextEngines(): string[] { return ["history", "faction", "character", "conflict", "economy", "geography", "power-system", "rules"]; }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      return this.buildRefinementPrompt(ctx, genre);
    }
    return this.buildInitialPrompt(ctx, genre);
  }

  private buildInitialPrompt(_ctx: EngineContext, genre: string): string {
    return `你是长篇小说创作系统的【因果引擎架构师】。

${buildProjectNarrativeSection()}

## 系统定位
因果引擎是世界观引擎群的"连接组织"——你不创造新的实体，而是揭示已有实体之间的因果联系。你的工作成果将成为故事蓝图和大纲生成的基础骨架。

${buildContextReferenceSection(["history", "faction", "character", "conflict", "economy", "geography", "power-system", "rules"])}

## 任务
为一部 ${genre} 题材的长篇小说构建因果体系的**顶层框架**。请提供 2-3 个因果解读不同的方案。

## 重要：尺度定位
本次是初始 pass，定位于 **planet（世界级）** 尺度。你需要设计的是：
- 跨越多个纪元/大陆的全局因果链
- 世界级事件的涟漪效应（向政/经/文/军/社多维扩散）
- 改变整个世界走向的关键转折点

后续的细化 pass 会为具体区域生成区域涟漪效应和局部因果链。

## 输出格式（Multi-Item）
必须输出纯 JSON，不要 Markdown 代码块：
{
  "proposals": [{
    "type": "causality",
    "title": "简洁概括这个因果解读方案的核心视角（如：经济决定论视角 / 伟人史观视角 / 阶级斗争视角）",
    "content": {
      "reasoning": "为什么选择这个因果解读角度？这个角度如何解释世界的运行逻辑？与其他方案的核心区别是什么？",
      "payload": {
        "name": "因果体系名称",
        "items": [
          {
            "subtype": "causal_chain",
            "name": "因果链名称（如：灵石枯竭→宗门战争→凡人起义链）",
            "summary": "一句话概括这条因果链的核心逻辑",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "trigger_event": "起点事件（必须使用history引擎中已确认的精确事件名）",
              "intermediate_events": ["中间事件1（已确认的事件名）", "中间事件2"],
              "final_effect": "最终结果事件（已确认的事件名）",
              "involved_factions": ["涉及势力（已确认的势力名）"],
              "involved_characters": ["关键角色（已确认的角色名）"],
              "time_span": "跨越的时间段（如：从第二纪元中期到第三纪元初，约800年）",
              "inevitability": "contingent",
              "alternative_paths": ["如果在事件X时势力A选择了Y而不是Z，结果可能是..."],
              "current_stage": "ongoing",
              "unresolved_tensions": ["尚未解决的张力：势力A和势力B的仇恨仍未化解"],
              "locations_involved": ["涉及的地点（已确认的地点名）"]
            }
          },
          {
            "subtype": "ripple_effect",
            "name": "涟漪效应名称（如：灵石矿枯竭的涟漪）",
            "summary": "一句话概括这个涟漪效应的扩散路径",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "source_event": "源头事件（已确认的事件名）",
              "affected_domains": [
                { "domain": "economic", "impact": "灵石价格上涨500%，普通散修无法修炼", "severity": "severe" },
                { "domain": "political", "impact": "灵石矿控制权成为势力间争夺的核心", "severity": "transformative" },
                { "domain": "social", "impact": "无法修炼的凡人开始质疑修仙者的统治合法性", "severity": "moderate" }
              ],
              "propagation_path": ["受影响区域1（已确认的区域名）", "区域2"],
              "intensity_decay": "涟漪强度随时间/距离的衰减描述",
              "unexpected_consequences": ["完全出乎意料的连锁反应"],
              "lingering_effects": ["至今未消散的持续影响"]
            }
          },
          {
            "subtype": "turning_point",
            "name": "关键转折名称（如：XX决策——改变世界走向的瞬间）",
            "summary": "一句话概括这个转折的历史意义",
            "content": {
              "scale": "planet",
              "needs_refinement": true,
              "before_state": "转折前的状态描述",
              "after_state": "转折后的状态描述",
              "decision_maker": "做出关键决策的角色/势力（已确认的名称）",
              "decision_motive": "决策者的核心动机是什么",
              "alternatives": ["当时可行的替代选择1", "替代选择2"],
              "why_this_path": "为什么选择了这条路（外部限制/信息不对称/个人野心/道德约束等）",
              "irreversible_changes": ["不可逆的改变1", "不可逆的改变2"],
              "related_conflicts": ["关联的矛盾（已确认的矛盾名）"],
              "retrospective": "后世/旁观者视角的评价——如果有第二次机会，决策者会做不同的选择吗？"
            }
          }
        ],
        "relations": [
          { "sourceName": "因果链A", "targetName": "事件B", "relationType": "reference", "label": "核心驱动事件" },
          { "sourceName": "涟漪效应C", "targetName": "因果链A", "relationType": "dependency", "label": "涟漪由此因果链产生" },
          { "sourceName": "关键转折D", "targetName": "因果链A", "relationType": "hierarchy", "label": "因果链中的关键节点" },
          { "sourceName": "关键转折D", "targetName": "角色E", "relationType": "reference", "label": "转折的决策者" },
          { "sourceName": "因果链A", "targetName": "矛盾F", "relationType": "dependency", "label": "驱动了这个矛盾" }
        ]
      }
    }
  }]
}

## 设计原则

### 因果链的设计
- 因果链不是"事件A发生→事件B发生"的简单排列，而是"为什么A必然/偶然导致B"的逻辑论证
- 每条因果链要有3个以上的节点——太少没有深度，太多失去焦点
- 因果链必须"落地"——每个节点都要引用已确认的具体事件名、势力名、角色名
- inevitability 字段要诚实：大多数历史事件是 contingent（偶然的），少数是 overdetermined（多因决定的），极少是 truly inevitable
- alternative_paths 是因果链最有价值的字段——它展示了"不同的选择会带来不同的世界"

### 涟漪效应的设计
- 涟漪效应是因果链的"横向展开"——同一个事件如何向政治/经济/文化/军事/社会等多个领域扩散
- affected_domains 至少要涵盖 3 个领域，才能体现涟漪的多维性
- 涟漪的传播路径要有地理维度——不同区域受到的影响强度不同
- unexpected_consequences 是涟漪效应最有戏剧价值的部分

### 关键转折的设计
- 关键转折是因果链中"不可逆"的节点——一旦跨过，世界永远不一样了
- 每个转折的 decision_maker 必须是一个具体的角色/势力（不能是抽象力量）
- alternatives 要真实可行

## 铁律
- 提供 2-3 个因果解读视角明显不同的方案
- 所有事件名、势力名、角色名、矛盾名、地点名必须使用上下文参考中已确认的精确名称，不得自行编造或改写
- 每条因果链至少关联 3 个已确认的事件
- 每个涟漪效应至少覆盖 3 个 affected_domains
- 每个关键转折必须有至少 2 个真实的 alternatives
- 因果链、涟漪效应、关键转折之间必须有交叉引用关系（relations 字段）
- **每一个 item 必须有 scale 和 needs_refinement: true 字段**
- scale 字段使用 "planet"（世界级）

## 反面示例（绝对不要这样做）
- 因果链是"发生了A，然后发生了B"——这是时间线，不是因果链。因果链要解释"为什么A导致B"
- 所有因果链都追溯到"创世之初"——近期事件的因果链对当前故事最重要
- 关键转折的 decision_maker 是"历史潮流"——必须有具体的人/势力做决策
- 涟漪效应只影响一个领域（"战争只影响军事"）——重大事件必然跨领域扩散
- alternative_paths 写"没有其他选择，这是唯一的出路"——如果只有一条路，那就不需要决策者
- 因果链之间没有交叉引用——独立的因果链是孤岛，互相交织的因果链才是世界`;
  }

  private buildRefinementPrompt(ctx: EngineContext, genre: string): string {
    const ref = ctx.refinement!;
    const targetScale = ref.targetScale;
    const targetLabel = this.getScaleLabel(targetScale);

    return `你是长篇小说创作系统的【因果引擎架构师】。

## 任务
为已确认的因果链/事件条目「${ref.parentName}」在更细的 **${targetLabel}（${targetScale}）** 尺度设计区域涟漪效应和局部因果链。

父条目层级：${ref.parentScale}  目标细化层级：${targetScale}

${buildContextReferenceSection(["history", "faction", "character", "conflict", "economy", "geography", "power-system", "rules"])}

## 细化策略
请使用 \`query_world_setting\` 工具查询以下数据：
1. 父条目「${ref.parentName}」的详细设定
2. ${targetScale} 级别的已确认地理条目
3. 该区域已确认的历史事件、势力分布和矛盾

为更细地理区域设计**局部因果分析**：
- 父级因果链在特定区域的表现（如：灵石枯竭在某个具体产区的直接影响）
- 父级涟漪效应在特定区域的传播路径和衰减模式
- 区域级别的局部因果链（本地事件之间的因果关系）
- 区域转折点（本地决策如何影响更大格局）

## 输出格式
{
  "proposals": [{
    "type": "causality",
    "title": "「${ref.parentName}」的${targetLabel}级因果细化",
    "content": {
      "reasoning": "细化逻辑、区域因果的特殊性...",
      "payload": {
        "name": "${ref.parentName}·${targetLabel}级因果",
        "items": [
          {
            "subtype": "causal_chain",
            "name": "区域因果链",
            "summary": "该因果链在本地域的逻辑",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "trigger_event": "起点事件",
              "intermediate_events": ["中间事件"],
              "final_effect": "最终结果",
              "connection_to_parent": "与父级因果链的衔接点",
              "involved_factions": ["涉及势力"],
              "locations_involved": ["涉及地点（${targetScale} 级已确认地名）"]
            }
          },
          {
            "subtype": "ripple_effect",
            "name": "区域涟漪效应",
            "summary": "涟漪在该区域的具体传播",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "source_event": "源头事件",
              "affected_domains": [
                { "domain": "economic", "impact": "在该区域的具体影响", "severity": "moderate" }
              ],
              "propagation_path": ["在该区域的传播路径"],
              "local_unexpected_consequences": ["本地特有的意外后果"],
              "relationship_to_parent_ripple": "与父级涟漪效应的幅度/衰减差异"
            }
          },
          {
            "subtype": "turning_point",
            "name": "区域转折点",
            "summary": "本地决策的关键时刻",
            "content": {
              "scale": "${targetScale}",
              "needs_refinement": true,
              "parent_name": "${ref.parentName}",
              "before_state": "转折前状态",
              "after_state": "转折后状态",
              "decision_maker": "决策者",
              "alternatives": ["替代选择"],
              "local_irreversible_changes": ["本地不可逆改变"]
            }
          }
        ],
        "relations": [
          { "sourceName": "区域因果链A", "targetName": "${ref.parentName}", "relationType": "hierarchy", "label": "是XX因果链的区域分支" },
          { "sourceName": "区域涟漪B", "targetName": "地理条目", "relationType": "geographic", "label": "涟漪主要影响区域" }
        ]
      }
    }
  }]
}

## 铁律
- 提供 2-3 个细化方案
- **每一个 item 必须有 scale="${targetScale}" 和 needs_refinement: true**
- **parent_name 必须设为 "${ref.parentName}"**
- 区域因果必须与上级因果框架有清晰的逻辑连接`;
  }


  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      const ref = ctx.refinement;
      return `请基于已确认的因果链/事件条目「${ref.parentName}」（${ref.parentScale}级），
在更细的 ${ref.targetScale} 尺度设计区域涟漪效应和局部因果链。
请先用 query_world_setting 工具查询父条目详情和对应区域/事件条目。`;
    }

    return buildEngineUserMessage("causality", ["history", "faction", "character", "conflict", "economy", "geography", "power-system", "rules"], genre);
  }

  parseOutput(raw: string): Proposal[] {
    const proposals = this.parseJsonProposals(raw, "因果体系设计", 3);

    this.injectRefinementParentId(proposals);
    return proposals;
  }

}
