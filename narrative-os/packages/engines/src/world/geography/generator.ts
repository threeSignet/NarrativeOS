import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage, buildProjectNarrativeSection, loadProjectScales } from "../../context";
import type { MapScale } from "./types";
import { db, settingItems } from "@narrative-os/database";
import { eq, and } from "drizzle-orm";

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
/** 细化上下文：辅助查询结果，供 buildRefinementPrompt 使用 */
interface RefinementContext {
  /** 完整尺度链表格文本 */
  scaleTable: string;
  /** 父条目的同级兄弟名称列表 */
  siblingNames: string[];
  /** 父条目的完整 content */
  parentContent: Record<string, unknown> | null;
}

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
  private scaleChain: { key: string; label: string; parentKey: string | null; description: string | null }[] = [];

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
        description: s.description ?? null,
      }));
    }
  }

  /** 获取指定尺度的下一级子尺度 */
  private getChildScale(scale: string): { key: string; label: string } | null {
    const child = this.scaleChain.find((s) => s.parentKey === scale);
    if (!child) return null;
    return { key: child.key, label: child.label };
  }

  /**
   * 加载父条目的同级兄弟条目名称（相同 parentItemId 的其他条目）
   */
  private async loadSiblings(projectId: string, parentItemId: string): Promise<string[]> {
    // 先获取父条目自身的 parentItemId
    const [parent] = await db
      .select({ parentItemId: settingItems.parentItemId })
      .from(settingItems)
      .where(
        and(
          eq(settingItems.id, parentItemId),
          eq(settingItems.projectId, projectId),
          eq(settingItems.status, "confirmed"),
        )
      );
    if (!parent) return [];

    // parentItemId 为 null 的条目没有同级兄弟（它们是根条目）
    if (!parent.parentItemId) return [];

    // 查询相同 parentItemId 的所有条目（排除自身）
    const siblings = await db
      .select({ name: settingItems.name })
      .from(settingItems)
      .where(
        and(
          eq(settingItems.projectId, projectId),
          eq(settingItems.status, "confirmed"),
          eq(settingItems.parentItemId, parent.parentItemId),
        )
      );
    return siblings.map(s => s.name);
  }

  /**
   * 加载父条目的完整内容
   */
  private async loadParentContent(projectId: string, parentItemId: string): Promise<Record<string, unknown> | null> {
    const [parent] = await db
      .select({ content: settingItems.content })
      .from(settingItems)
      .where(
        and(
          eq(settingItems.id, parentItemId),
          eq(settingItems.projectId, projectId),
          eq(settingItems.status, "confirmed"),
        )
      );
    return (parent?.content as Record<string, unknown>) ?? null;
  }

  /**
   * 将已加载的尺度链格式化为 markdown 表格
   */
  private buildScaleTable(): string {
    if (this.scaleChain.length === 0) return "（未加载到尺度链定义）";

    const header = "| 层级 | key | 中文标签 | 粒度定义 |";
    const sep =    "|------|-----|---------|---------|";
    const rows = this.scaleChain.map((s, i) => {
      const desc = s.description || "（未定义）";
      return `| ${i + 1} | \`${s.key}\` | ${s.label} | ${desc} |`;
    });
    return [header, sep, ...rows].join("\n");
  }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      // 细化模式：加载已确认的尺度链
      await this.loadApprovedScales(ctx.projectId);

      // 加载细化辅助数据
      const scaleTable = this.buildScaleTable();
      const siblingNames = await this.loadSiblings(ctx.projectId, ctx.refinement.parentItemId);
      const parentContent = await this.loadParentContent(ctx.projectId, ctx.refinement.parentItemId);

      return this.buildRefinementPrompt(ctx, genre, {
        scaleTable,
        siblingNames,
        parentContent,
      });
    }

    // 初始模式：大模型自主设计尺度链 + 顶层空间域
    return this.buildInitialPrompt(ctx, genre);
  }

  /**
   * 构建初始 pass 的系统提示 — 大模型自主设计尺度链 + 顶层空间域
   *
   * 铁律：最少 4 级、最多 7 级、首级必须是全局世界框架、末级必须是 scene；
   * 命名必须是纯地名；尺度 description 必须是正式粒度定义。
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

根据项目的【类型】、【简介】、【核心创意】和已确认的【世界观基调】，自主确定这个世界的空间层级体系。

### 参考尺度名称（仅供参考，不强约束）
你可以全部使用、部分使用，也可以自定义完全不同的尺度名称：
${refScaleList}

### 尺度链铁律（必须遵守）
- **最少 4 级，最多 7 级**
- **第 1 级必须是"全局世界框架"**——包含这个世界观所有可能存在的空间类型，不只是小说简介中直接提到的部分
  - 不要只从小说描述的内容出发，要考虑这个世界观的完整空间架构
  - 例如：都市灵异故事不是只有"阳间+地府"，而是"冥阳世界体系"→下面才有阳间、地府、天庭、混沌等所有可能的位面
- **最后 1 级必须是 \`scene\`（场景）**——所有空间最终细化到角色可活动的具体场景
- 每级必须有**精确的粒度定义**，包含：空间单元的典型规模、与上/下级的关系（上级通常包含几个本级、本级通常包含几个下级）

### 模板参考（仅参考，不是约束）
- 都市灵异：冥阳世界体系 → 维度界域 → 大行政区 → 城市 → 片区 → scene
- 修仙/玄幻：诸天万界 → 大千世界 → 洲域 → 宗门领地 → 城镇 → scene
- 西方奇幻：创世之柱 → 大陆 → 王国 → 领地 → 城堡/城镇 → scene
- 太空歌剧：已知宇宙 → 星域 → 星系 → 行星 → 大陆/空间站 → scene
- 无限流：主神空间架构 → 副本世界 → 区域 → 区段 → scene

## 第二步：设计顶层空间域

在**尺度链的第一级（最宏观层级）**，设计顶层空间域。
- 考虑这个世界观可能存在的所有空间类型，不只是小说简介中提到的
- 如果是多世界/多位面故事，每个世界/位面作为一个顶层空间域
- 如果是单世界故事，按大地理单元划分，不按游戏功能划分

## 地理命名规范（必须遵守）
- 空间域名必须是**纯地名**，像真实世界中的正式地名
- **禁止**加前缀标签：❌ 阳间·临江都市圈、❌ 阴间·酆都行政大区
- **禁止**加功能描述前缀：❌ 水阴汇聚地·清溪河沿岸、❌ 炽阳高地区·主教学楼群
- **禁止**游戏化命名：❌ 至阴禁区·旧殡仪馆遗址
- 正确示例：临江都市圈、酆都城、轮回走廊、旧殡仪馆遗址、清溪河、主教学楼群
- 宏观层级用正式名称（冥阳世界体系、九天灵界），微观层级用具体场所名（孟婆汤窗口）
- 世界观特殊属性（阴阳属性、灵气浓度、区域功能等）放在 content 字段内描述，**不放在名称中**

## 尺度链定义正式化
每级的 \`description\` 必须是精确的粒度定义，包含：
- 空间单元的典型规模（相当于现实中的什么级别）
- 与上级的关系（上级通常包含几个本级）
- 与下级的关系（本级通常包含几个下级）

❌ 模糊说明：每个维度下的大地理/行政分区...
✅ 正式定义：世界内的一级地理/行政分区。空间规模相当于现实中的省级/大区级行政单位。典型单元：一个省份、一个大都市圈。与上级（realm）的关系：一个位面通常包含 3-8 个 territory。与下级（city）的关系：每个 territory 通常包含 2-6 个核心聚落。

## 输出格式
**绝对禁止在 JSON 之外输出任何文字。所有描述、分析、解释都必须放在 content.reasoning 字段中。**
**直接输出一个完整的 JSON 对象，以 { 开头，以 } 结尾。**

{
  "proposals": [{
    "type": "geography",
    "title": "简洁概括方案核心特征的标题",
    "content": {
      "reasoning": "必须包含以下论证：\\n1. 为什么第 1 级是全局世界框架？这个世界观还有哪些可能的空间类型没在简介中出现但应该存在？\\n2. 每一级的粒度边界是什么？举例说明这一级的典型空间单元有多大\\n3. 顶层空间域的命名为什么是纯地名而非标签组合？\\n4. 整体尺度链如何为故事留足空间纵深？至少 200 字。",
      "payload": {
        "name": "世界地理名称",
        "scales": [
          {
            "key": "scale_key",
            "label": "中文标签",
            "parentKey": null,
            "sortOrder": 0,
            "description": "正式粒度定义：空间规模、典型单元、与上下级关系"
          },
          {
            "key": "next_scale",
            "label": "中文标签",
            "parentKey": "scale_key",
            "sortOrder": 1,
            "description": "正式粒度定义"
          },
          {
            "key": "scene",
            "label": "场景",
            "parentKey": "pre_last",
            "sortOrder": 2,
            "description": "具体场景：角色可活动的具体场所，如广场、密室、修炼室"
          }
        ],
        "items": [
          {
            "subtype": "region",
            "name": "纯地名（不加前缀）",
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

## 铁律
- 提供 **3 个**尺度链+空间结构不同的方案
- 每个方案包含：
  - scales 数组：定义完整尺度链（4-7 级，最后一级是 scene）
  - items 数组：顶层空间域（1-5 个）
  - relations 数组：空间域之间的关系
- **每一个 item 必须有 scale（使用第一级尺度的 key）、coordinates**
- **空间域名必须是纯地名，禁止前缀标签**
- **每个 scale 的 description 必须是正式粒度定义**`;
  }

  /**
   * 构建细化 pass 的系统提示 — 注入完整尺度链、同级兄弟、父条目内容
   */
  private buildRefinementPrompt(
    ctx: EngineContext,
    genre: string,
    refinementCtx: RefinementContext,
  ): string {
    const ref = ctx.refinement!;
    const targetScale = ref.targetScale;
    const child = this.getChildScale(targetScale);
    const targetLabel = this.getScaleLabel(targetScale);
    const childLabelForHint = child ? child.label : "更细节";
    const targetDescription = this.scaleChain.find(s => s.key === targetScale)?.description || "";

    // 构建父条目完整信息（排除内部管理字段）
    const parentContentSection = refinementCtx.parentContent
      ? Object.entries(refinementCtx.parentContent)
          .filter(([k]) => !["scale", "coordinates", "needs_refinement"].includes(k))
          .map(([k, v]) => `- ${k}：${v}`)
          .join("\n")
      : "（无详细信息）";

    const siblingSection = refinementCtx.siblingNames.length > 0
      ? `「${ref.parentName}」的同级空间域有：${refinementCtx.siblingNames.join("、")}
请确保你产出的子条目与同级条目的子条目之间有清晰的差异，避免重叠。`
      : "";

    return `你是长篇小说创作系统的【地理环境架构师】。

## 任务
为已确认的空间域「${ref.parentName}」细化内部结构。
本次细化目标尺度：**${targetLabel}（${targetScale}）**

${buildContextReferenceSection(["tone"])}

## 项目尺度链（已确认，必须遵守）
${refinementCtx.scaleTable}

你正在产出的是 **${targetLabel}（${targetScale}）** 级别的子条目，请严格对齐这一级的粒度定义。

## 父条目信息
你正在细化的空间域是：**${ref.parentName}**（尺度：${ref.parentScale}）
请使用 \`query_world_setting\` 工具查询该项目已确认的地理设定和基调设定。

父条目详细属性：
${parentContentSection}

## 父条目的同级空间域
${siblingSection}

## 粒度对齐（必须遵守）
你正在为「${ref.parentName}」产出「${targetLabel}」级别的子条目。
「${targetLabel}」的粒度定义：${targetDescription || `（无精确定义，请根据尺度链上下文推断）`}

粒度判断：
- **太大**：如果子条目的大小接近父条目本身，说明粒度偏大，应该拆分
- **太小**：如果子条目只相当于下一级「${childLabelForHint}」的大小，说明粒度偏小，应该合并
- **合适**：子条目是父条目的合理细分，每个子条目内部还有进一步细化的空间

## 地理命名规范（必须遵守）
- 空间域名必须是**纯地名**，像真实世界中的正式地名
- **禁止**加前缀标签：❌ 炽阳高地区·主教学楼群、❌ 至阴禁区·旧殡仪馆遗址
- **禁止**加功能描述前缀：❌ 水阴汇聚地·清溪河沿岸
- 正确示例：主教学楼群、清溪河沿岸、旧殡仪馆遗址
- 宏观层级用正式名称，微观层级用具体场所名
- 世界观特殊属性放在 content 字段内描述，不放在名称中

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
      "reasoning": "为什么这样划分「${ref.parentName}」的内部结构？各区域的核心差异？粒度是否对齐「${targetLabel}」的定义？命名为什么是纯地名？",
      "payload": {
        "name": "${ref.parentName}·${targetLabel}划分",
        "items": [
          {
            "subtype": "region",
            "name": "纯地名（不加前缀）",
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

## 子条目数量指导
每个方案包含 2-8 个子条目：
- 父条目粒度较小（如城镇级别）→ 3-5 个
- 父条目粒度很大（如大区级别）→ 5-8 个

## 铁律
- 提供 **3 个**划分方案
- 每个方案包含 2-8 个子区域
- **每一个 item 必须有 scale="${targetScale}"、coordinates、parentName="${ref.parentName}"**
- **子区域名称必须是纯地名，禁止前缀标签**
- 子区域的名称要独特且能体现其特征`;
  }

  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    if (ctx.refinement) {
      const ref = ctx.refinement;
      const targetLabel = this.getScaleLabel(ref.targetScale);
      return `请基于已确认的「${ref.parentName}」（${this.getScaleLabel(ref.parentScale)}尺度），
为这部 ${genre} 题材的小说细化其内部结构。
目标尺度：${targetLabel}（${ref.targetScale}）。
请确保子条目的粒度对齐「${targetLabel}」的定义，命名使用纯地名。
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
