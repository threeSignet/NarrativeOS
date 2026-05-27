import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage, buildProjectNarrativeSection, loadProjectScales } from "../../context";
import type { MapScale } from "./types";

/**
 * GeographyEngine — 地理环境架构师（多 pass 自适应版）
 *
 * 支持两种运行模式：
 * 1. 初始模式（无 refinement）→ 大模型自主确定尺度链 + 顶层空间域
 * 2. 细化模式（有 refinement）→ 为指定的已确认父条目在下一尺度级别生成子条目
 *
 * 核心设计：
 * - 不硬编码任何尺度链。初始 pass 中，大模型根据项目信息自主任由设计尺度体系，
 *   参考一组推荐尺度名称（universe/galaxy/planet/continent/region/city/district/scene），
 *   但可以完全自由地决定层级数量和层级名称。
 * - 初始 pass 的 payload 中同时输出 scales（尺度链定义）和 items（顶层空间域），
 *   审批后 handler 将 scales 写入 project_scales 表，items 写入 setting_items 表。
 * - 细化 pass 从 project_scales 表读取已确认的尺度链，逐级生成子条目。
 *
 * 执行示例（都市奇幻《凡人游戏》）：
 *   Pass 0 (初始): 大模型决定尺度链 [world → domain → region → scene]
 *     world 级产出: [表层现世, 里层诡域, 裂隙夹层]
 *   Pass 1 (细化「表层现世」): → domain 级 → 产出 [老城区, CBD, 地铁网络]
 *   Pass 2 (细化「老城区」): → region 级 → 产出 [胡同区, 拆迁工地, 城中村]
 */
export class GeographyEngine extends Engine {
  constructor() { super("geography"); }
  protected getModelTier(): "lightweight" | "pro" { return "pro"; }
  protected getContextEngines(): string[] { return ["tone"]; }

  /** 推荐的尺度名称（大模型参考使用，不是强约束） */
  private static REFERENCE_SCALE_NAMES: string[] = [
    "universe", "galaxy", "star_system", "planet",
    "continent", "region", "city", "district", "scene",
  ];

  /** 推荐尺度名称的中文标签 */
  private static REFERENCE_SCALE_LABELS: Record<string, string> = {
    universe: "宇宙", galaxy: "星系", star_system: "恒星系", planet: "星球",
    continent: "大陆", region: "区域", city: "城市", district: "街区", scene: "场景",
  };

  /** 细化模式使用的尺度链（从 project_scales 加载） */
  private scaleChain: { key: string; label: string; parentKey: string | null }[] = [];

  protected override getScaleLabel(scale: string): string {
    const found = this.scaleChain.find((s) => s.key === scale);
    if (found) return found.label;
    return GeographyEngine.REFERENCE_SCALE_LABELS[scale] || scale;
  }

  /** 从 project_scales 表加载已确认的尺度链 */
  private async loadApprovedScales(projectId: string): Promise<void> {
    if (this.scaleChain.length > 0) return;
    const scales = await loadProjectScales(projectId);
    if (scales.length > 0) {
      this.scaleChain = scales.map((s) => ({
        key: s.key,
        label: s.label,
        parentKey: s.parentKey ?? null,
      }));
    }
  }

  /** 获取指定尺度的下一级子尺度 */
  private getChildScale(scale: string): { key: string; label: string } | null {
    const child = this.scaleChain.find((s) => s.parentKey === scale);
    if (!child) return null;
    return { key: child.key, label: child.label };
  }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      // 细化模式：加载已确认的尺度链
      await this.loadApprovedScales(ctx.projectId);
      return this.buildRefinementPrompt(ctx, genre);
    }

    // 初始模式：大模型自主设计尺度链 + 顶层空间域
    return this.buildInitialPrompt(ctx, genre);
  }

  /**
   * 构建初始 pass 的系统提示 — 大模型自主设计尺度链 + 顶层空间域
   */
  private buildInitialPrompt(_ctx: EngineContext, genre: string): string {
    const refScaleList = GeographyEngine.REFERENCE_SCALE_NAMES
      .map((k) => `  - \`${k}\`（${GeographyEngine.REFERENCE_SCALE_LABELS[k]}）`)
      .join("\n");

    return `${buildProjectNarrativeSection()}

你是长篇小说创作系统的【地理环境架构师】。

## 任务
为一部 ${genre} 题材的长篇小说设计**空间尺度体系**和**顶层空间域**。

${buildContextReferenceSection(["tone"])}

## 第一步：设计尺度链

根据项目的【类型】、【简介】、【核心创意】和已确认的【世界观基调】，**自主确定**这个世界的空间层级体系。

### 推荐尺度名称参考（仅供参考，不强约束）
你可以全部使用、部分使用，也可以自定义完全不同的尺度名称：
${refScaleList}

### 尺度链设计原则
- 尺度链从**宏观到微观**，从这个世界"最大的有意义的空间单元"开始
- **终点必须是 \`scene\`（场景）**——所有空间最终细化到角色可活动的具体场景
- 尺度数量一般 **3-6 级**，不宜过多
- 每个尺度要有清晰的说明：什么数据会在这一层产生
- **尽可能宏大**：起点应该够大，给故事留下足够的空间纵深。一个都市故事可以从"城市群"甚至"维度域"开始，而不一定从"小区"开始
- 尺度名称要体现这个世界观的特色——西方奇幻就是王国/领地/城堡，修仙就是灵界/洞府/秘境，现代都市就是城市/片区/街区

### 模板参考（仅参考，不是约束）
- 都市/现代：城市群 → 城区 → 片区 → 街区 → scene
- 修仙/玄幻：九天 → 灵界 → 大陆 → 秘境 → 洞府 → scene
- 西方奇幻：世界 → 大陆 → 王国 → 领地 → 城堡 → scene
- 太空歌剧：宇宙 → 星系 → 星球 → 大陆 → 空间站 → scene
- 无限流/游戏：主神空间 → 副本世界 → 区域 → 区段 → scene

## 第二步：设计顶层空间域

在**尺度链的第一级（最宏观层级）**，设计顶层空间域。
- 如果是双世界/多世界故事，每个世界作为一个顶层空间域
- 如果是单世界故事，不要只生成"东大陆""西大陆"，而是根据世界观核心创意划分

## 输出格式
**绝对禁止在 JSON 之外输出任何文字。所有描述、分析、解释都必须放在 content.reasoning 字段中。**
**直接输出一个完整的 JSON 对象，以 { 开头，以 } 结尾。**

{
  "proposals": [{
    "type": "geography",
    "title": "简洁概括方案核心特征的标题",
    "content": {
      "reasoning": "为什么选择这个尺度链？每个尺度在这个世界观中的含义是什么？尺度链的起点为什么是这个层级？顶层空间域为什么要这样划分？至少 150 字。",
      "payload": {
        "name": "世界地理名称",
        "scales": [
          {
            "key": "scale_key",
            "label": "中文标签",
            "parentKey": null,
            "sortOrder": 0,
            "description": "此层级的说明：什么类型的空间在此层级划分"
          },
          {
            "key": "next_scale",
            "label": "中文标签",
            "parentKey": "scale_key",
            "sortOrder": 1,
            "description": "说明"
          },
          {
            "key": "scene",
            "label": "场景",
            "parentKey": "pre_last",
            "sortOrder": 2,
            "description": "具体场景：广场、密室、修炼室、后山"
          }
        ],
        "items": [
          {
            "subtype": "region",
            "name": "顶层空间域名",
            "summary": "一句话概括核心特征和在故事中的定位",
            "content": {
              "scale": "（第一级尺度的 key）",
              "coordinates": { "x": 500, "y": 400 },
              "climate": "整体气候特征",
              "terrain": "整体地形特征",
              "resources": "核心资源",
              "cultural_significance": "在故事中的定位",
              "needs_refinement": true
            }
          }
        ],
        "relations": [
          { "sourceName": "空间域A", "targetName": "空间域B", "relationType": "adjacency", "label": "相邻关系" }
        ]
      }
    }
  }]
}

## 设计原则
- **先粗后细**：本 pass 只设计尺度链和顶层空间域，不深入到内部层级
- 每个顶层空间域应该有明确的**故事功能**（主舞台、冒险目的地、禁区等）
- 不同顶层空间域之间可以有**连接方式**（传送门、裂缝、通道等），用 relation 标注
- 空间域名称必须体现**空间/物理特性**，不要用游戏系统概念命名

## 关键字约束
- scale key 使用英文 snake_case，label 使用中文
- 尺度链最后一个必须是 scene
- 每个 scale 的 description 要说明这一层会产生什么类型的地理数据
- scale 中不使用 ref、rel、adj 等缩写

## 铁律
- 提供 2-3 个尺度链+空间结构不同的方案
- 每个方案包含：
  - scales 数组：定义完整尺度链（3-6 级，最后一级是 scene）
  - items 数组：顶层空间域（1-5 个）
  - relations 数组：空间域之间的关系
- **每一个 item 必须有 scale（使用第一级尺度的 key）、coordinates**
- 尺度链要足够宏大，给后续细化留出充分的空间`;
  }

  /**
   * 构建细化 pass 的系统提示 — 从 project_scales 读取子尺度，生成子条目
   */
  private buildRefinementPrompt(ctx: EngineContext, genre: string): string {
    const ref = ctx.refinement!;
    const targetScale = ref.targetScale;
    const child = this.getChildScale(targetScale);
    const targetLabel = this.getScaleLabel(targetScale);
    const childLabelForHint = child ? child.label : "更细节";

    // 构建完整的尺度链展示文本
    const chainStr = this.scaleChain.length > 0
      ? this.scaleChain.map((s) => `${s.label}（\`${s.key}\`）`).join(" → ")
      : "";

    return `你是长篇小说创作系统的【地理环境架构师】。

## 任务
为已确认的空间域「${ref.parentName}」细化内部结构。
本次细化目标尺度：**${targetLabel}（${targetScale}）**

${buildContextReferenceSection(["tone"])}

## 项目尺度链
${chainStr || "（未发现自定义尺度链，请根据项目上下文合理推断）"}

## 父条目信息
你正在细化的空间域是：**${ref.parentName}**（尺度：${ref.parentScale}）
请使用 \`query_world_setting\` 工具查询该项目已确认的地理设定和基调设定，
了解「${ref.parentName}」的详细信息后再设计其内部结构。

## 坐标系统（相对坐标）
子条目的坐标是**相对于父条目「${ref.parentName}」的独立坐标空间 (0-1000)**。

- 「${ref.parentName}」的中心在 (500, 500)
- 子条目围绕中心分布，坐标范围建议 150-850
- 子条目之间应有合理的空间分布，避免重叠

## 输出格式
{
  "proposals": [{
    "type": "geography",
    "title": "「${ref.parentName}」的${targetLabel}细化方案",
    "content": {
      "reasoning": "为什么这样划分${ref.parentName}的内部结构、各区域的核心差异...",
      "payload": {
        "name": "${ref.parentName}·${targetLabel}划分",
        "items": [
          {
            "subtype": "region",
            "name": "子区域名称",
            "summary": "一句话概括",
            "content": {
              "scale": "${targetScale}",
              "coordinates": { "x": 480, "y": 120 },
              "parentName": "${ref.parentName}",
              "climate": "气候",
              "terrain": "地形",
              "resources": "资源",
              "cultural_significance": "在故事中的定位",
              "needs_refinement": true
            }
          }
        ],
        "relations": [
          { "sourceName": "子区域A", "targetName": "${ref.parentName}", "relationType": "geographic", "label": "位于" },
          { "sourceName": "子区域A", "targetName": "子区域B", "relationType": "adjacency", "label": "相邻" }
        ]
      }
    }
  }]
}

## 设计原则
- 每个子区域都应该有独立的叙事功能
- 子区域之间应有明确差异（气候/地形/资源/势力归属）
- 区域之间可以有地理边界（山脉、河流、能量墙等）

## 铁律
- 提供 2-3 个划分方案
- 每个方案包含 2-8 个子区域
- **每一个 item 必须有 scale="${targetScale}"、coordinates、parentName="${ref.parentName}"**
- 子区域的名称要独特且能体现其特征`;
  }

  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      const ref = ctx.refinement;
      return `请基于已确认的「${ref.parentName}」（${this.getScaleLabel(ref.parentScale)}尺度），
为这部 ${genre} 题材的小说细化其内部结构。
目标尺度：${this.getScaleLabel(ref.targetScale)}（${ref.targetScale}）。
请先用 query_world_setting 工具查询「${ref.parentName}」的详细设定。`;
    }

    return buildEngineUserMessage("geography", ["tone"], genre);
  }

  parseOutput(raw: string): Proposal[] {
    const proposals = this.parseJsonProposals(raw, "地理环境设计", 3);

    this.injectRefinementParentId(proposals);
    return proposals;
  }
}
