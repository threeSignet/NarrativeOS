import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage, buildProjectNarrativeSection } from "../../context";

/**
 * FactionEngine — 势力分布架构师（多 pass 自适应版）
 *
 * 支持两种运行模式：
 * 1. 初始模式（无 refinement）→ 分析项目上下文 + 已确认地理，确定政治尺度，产出顶层势力格局
 * 2. 细化模式（有 refinement）→ 为指定已确认势力条目在更细地理尺度生成子势力/分支
 *
 * 政治尺度跟随地理尺度链：
 *   universe → galaxy → star_system → planet → continent → region → city → district → scene
 *
 * 每次细化时，势力自动锚定到同层级的地理条目上：
 *   planet 级势力 → 锚定到 planet 级地理（如：千界、现实世界）
 *   continent 级势力 → 锚定到 continent 级地理（如：光穹三界、虚空深渊三界）
 *   region 级势力 → 锚定到 region 级地理（如：第一层·墟光平原）
 */
export class FactionEngine extends Engine {
  constructor() { super("faction"); }
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
    return `你是长篇小说创作系统的【势力分布架构师】。

${buildProjectNarrativeSection()}

## 任务
为一部 ${genre} 题材的长篇小说设计势力分布的**顶层格局**。

${buildContextReferenceSection(["tone", "geography", "power-system"])}

## 重要：如何对齐地理层级
你将在对话中看到已确认的【地理环境】设定。每个条目标注了 scale 和坐标。
请使用 \`query_world_setting\` 工具查询地理数据，了解当前地理的顶层结构（如：有哪些 planet/continent 级条目）。
根据地理层级决定本次势力设计的范围：

- 如果地理有 planet 级条目 → 设计**跨世界势力**（如：统御多个世界的组织）
- 如果地理有 continent 级条目 → 设计**大陆级势力**（如：统治一个大陆的帝国）
- 后续的细化 pass 会为每个地理区域生成更具体的子势力

## 输出格式（Multi-Item）
必须输出纯 JSON，不要 Markdown 代码块：
{
  "proposals": [{
    "type": "faction",
    "title": "简洁概括势力格局核心特征的标题",
    "content": {
      "reasoning": "势力格局的逻辑、权力结构、主要冲突根源...",
      "payload": {
        "name": "势力格局名称",
        "items": [
          {
            "subtype": "faction_layout",
            "name": "势力格局",
            "summary": "一句话概括整体格局",
            "content": {
              "power_structure": "权力结构的详细描述",
              "major_conflicts": ["当前主要冲突及根源"],
              "geographic_overview": "各势力在顶层空间域中的分布概述",
              "needs_refinement": true
            }
          },
          {
            "subtype": "faction_member",
            "name": "势力名",
            "summary": "该势力的核心定位（一句话）",
            "content": {
              "type": "势力类型（帝国/宗门/家族/商会/教廷/企业等）",
              "scale": "势力规模（世界级/大陆级，必须与当前地理层级对应）",
              "leader": "首领名称与头衔",
              "goal": "核心目标（短期+长期）",
              "headquarters": "总部所在地（必须使用地理引擎中已确认的精确城市/地点名）",
              "headquarters_coordinates": { "x": 480, "y": 120 },
              "territory": ["势力范围（已确认的区域名）"],
              "allies": ["盟（已确认的势力名）"],
              "enemies": ["敌人（已确认的势力名）"],
              "power_level": "整体实力评级（引用已确认的力量体系境界）",
              "internal_factions": "内部派系",
              "culture": "组织文化/行事风格",
              "geographic_strategy": "为什么选择这个总部位置？控制这些领土的战略目的是什么？",
              "needs_refinement": true
            }
          }
        ],
        "relations": [
          { "sourceName": "势力A", "targetName": "势力B", "relationType": "opposition", "label": "全面对抗" },
          { "sourceName": "势力A", "targetName": "冰风城", "relationType": "geographic", "label": "总部所在地" }
        ]
      }
    }
  }]
}

## 铁律
- 提供 2-3 个势力结构不同的方案
- **headquarters、territory 必须使用地理引擎中已确认的精确名称，用 query_world_setting 先查再写**
- **每个 item 都必须有 needs_refinement: true — 这表示后续会为它在更细地理层级生成子势力**
- allies/enemies 中引用的势力名如果存在则精确引用，不存在则说明是新势力（首次创建）`;
  }

  private buildRefinementPrompt(ctx: EngineContext, genre: string): string {
    const ref = ctx.refinement!;

    return `你是长篇小说创作系统的【势力分布架构师】。

## 任务
为已确认的势力条目「${ref.parentName}」（${ref.parentScale} 级）在更细的地理层级设计子势力/分支。

父条目层级：${ref.parentScale}  目标细化层级：${ref.targetScale}
当前细化深度：${ref.depth}

${buildContextReferenceSection(["tone", "geography", "power-system"])}

## 细化策略
请使用 \`query_world_setting\` 工具查询以下数据：
1. 父条目「${ref.parentName}」的详细设定
2. 父条目的 headquarters 和 territory 对应哪些地理条目
3. 这些地理条目的**子层级条目**（scale=${ref.targetScale}）— 这些就是你本次可以分配子势力的地理空间

为这些更细的地理区域设计对应的势力分布：
- 如果父势力是一个大陆级帝国，本次设计它下属的区域级分支/诸侯/代理人
- 如果父势力是一个世界级组织，本次设计它在各大陆/区域的分部
- 每个子势力必须锚定到一个具体的 ${ref.targetScale} 级地理条目

## 输出格式
{
  "proposals": [{
    "type": "faction",
    "title": "「${ref.parentName}」的${ref.targetScale}级势力细化",
    "content": {
      "reasoning": "细化逻辑...",
      "payload": {
        "name": "${ref.parentName}·子势力分布",
        "items": [
          {
            "subtype": "faction_member",
            "name": "子势力名",
            "summary": "该子势力在父势力体系中的定位",
            "content": {
              "type": "分支/附属/联盟成员",
              "scale": "${ref.targetScale}级",
              "leader": "首领名称",
              "goal": "目标",
              "headquarters": "总部所在地（必须是 ${ref.targetScale} 级已确认地理条目）",
              "headquarters_coordinates": { "x": 480, "y": 120 },
              "territory": ["领地（${ref.targetScale} 级已确认地理条目）"],
              "parent_faction": "${ref.parentName}",
              "allies": ["盟友"],
              "enemies": ["敌人"],
              "power_level": "实力评级",
              "culture": "行事风格",
              "geographic_strategy": "地理战略",
              "needs_refinement": true
            }
          }
        ],
        "relations": [
          { "sourceName": "子势力A", "targetName": "${ref.parentName}", "relationType": "hierarchy", "label": "隶属于" },
          { "sourceName": "子势力A", "targetName": "地理条目", "relationType": "geographic", "label": "总部所在地" }
        ]
      }
    }
  }]
}

## 铁律
- 提供 2-3 个细化方案
- 每个方案包含 2-8 个子势力
- **headquarters、territory 必须使用 ${ref.targetScale} 级已确认地理条目的精确名称**
- **parent_faction 必须设为 "${ref.parentName}"**
- 关系标注子势力与父势力的 hierarchy 关系`;
  }

  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      const ref = ctx.refinement;
      return `请基于已确认的势力「${ref.parentName}」（${ref.parentScale}级），
在更细的 ${ref.targetScale} 地理层级设计其子势力/分支结构。
请先用 query_world_setting 工具查询父势力详情和对应地理条目。`;
    }

    return buildEngineUserMessage("faction", ["tone", "geography", "power-system"], genre);
  }

  parseOutput(raw: string): Proposal[] {
    const proposals = this.parseJsonProposals(raw, "势力分布设计", 3);

    this.injectRefinementParentId(proposals);
    return proposals;
  }

}
