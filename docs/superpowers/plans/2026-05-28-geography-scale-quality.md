# 地理引擎尺度体系与细化质量提升 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提升地理引擎的尺度链设计质量、命名规范、细化粒度对齐，以及修复提案数量不一致和上下文加载不完整问题。

**Architecture:** Prompt 增强方案——不改变系统架构，通过重写 GeographyEngine 的初始/细化 prompt、修复提前截断阈值、增强上下文加载来解决问题。

**Tech Stack:** TypeScript, Drizzle ORM, LLM prompt engineering

---

## 文件变更清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `packages/engines/src/base.ts` | 修改 | `_hasCompleteProposals` 截断阈值 >= 2 → >= 3 |
| `packages/engines/src/context.ts` | 修改 | `buildDependencyNameRegistry` 增加 summary 注入 |
| `packages/engines/src/world/geography/generator.ts` | 修改 | 重写 `buildInitialPrompt`、`buildRefinementPrompt`；新增细化辅助查询 |

---

### Task 1: 修复 `_hasCompleteProposals` 提前截断阈值

**Files:**
- Modify: `packages/engines/src/base.ts:394` (包裹格式阈值)
- Modify: `packages/engines/src/base.ts:411` (独立 JSON 格式阈值)

- [ ] **Step 1: 修改包裹格式的截断阈值**

将 `base.ts:394` 的 `proposals.length >= 2` 改为 `proposals.length >= 3`：

```typescript
// base.ts _hasCompleteProposals 方法内，约第 394 行
// 改前：
return proposals.length >= 2;
// 改后：
return proposals.length >= 3;
```

- [ ] **Step 2: 修改独立 JSON 格式的截断阈值**

将 `base.ts:411` 的 `count >= 2` 改为 `count >= 3`：

```typescript
// base.ts _hasCompleteProposals 方法内，约第 411 行
// 改前：
return count >= 2;
// 改后：
return count >= 3;
```

- [ ] **Step 3: 同步修改 streamRunWithTools 中的提前截断条件**

`base.ts` 中有两处使用 `_hasCompleteProposals`，分别在 `streamRun` 和 `streamRunWithTools`。确认 `streamRunWithTools` 中的调用也使用相同方法（复用同一逻辑），无需额外改动。

- [ ] **Step 4: 提交**

```bash
git add packages/engines/src/base.ts
git commit -m "fix: 提前截断阈值从 >= 2 改为 >= 3，确保 3 个方案完整输出"
```

---

### Task 2: `buildDependencyNameRegistry` 增加 summary 注入

**Files:**
- Modify: `packages/engines/src/context.ts:231-317` (`buildDependencyNameRegistry`)

- [ ] **Step 1: 修改名称注册表渲染逻辑，追加 summary**

在 `context.ts` 的 `buildDependencyNameRegistry` 函数中，找到 `renderTree` 内部的渲染行（约第 305-306 行）：

```typescript
// 当前代码（约第 305-306 行）：
const summary = (child.summary || "") as string;
const summarySuffix = summary ? ` — ${summary}` : "";
parts.push(`${prefix}${child.name}${meta}${summarySuffix}`);
```

这段代码已经包含了 summary！检查确认是否已生效。如果已生效则无需改动，跳到 Step 3。

- [ ] **Step 2: 确认 summary 数据已注入**

检查 `settingItems` 表中 tone 类条目是否有 summary 字段。如果 tone 引擎生成的条目没有 summary，需要追溯 tone 引擎的 prompt 是否要求输出 summary。如果 tone 条目本身有 summary，则当前 `buildDependencyNameRegistry` 已经会注入。

- [ ] **Step 3: 提交（如有改动）**

```bash
git add packages/engines/src/context.ts
git commit -m "fix: 确认依赖名称注册表已注入条目 summary"
```

---

### Task 3: 细化辅助查询——加载同级兄弟和父条目完整内容

**Files:**
- Modify: `packages/engines/src/world/geography/generator.ts`

- [ ] **Step 1: 新增 `loadSiblings` 辅助方法**

在 `GeographyEngine` 类中新增方法，查询父条目的同级兄弟：

```typescript
/**
 * 加载父条目的同级兄弟条目（相同 parentItemId）
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

  // 查询相同 parentItemId 的所有条目（排除自身）
  const siblings = await db
    .select({ name: settingItems.name })
    .from(settingItems)
    .where(
      and(
        eq(settingItems.projectId, projectId),
        eq(settingItems.status, "confirmed"),
        eq(settingItems.parentItemId, parent.parentItemId ?? ""),
      )
    );
  return siblings.map(s => s.name);
}
```

注意：需要在文件顶部添加 import：
```typescript
import { db, settingItems, projectScales } from "@narrative-os/database";
import { eq, and, asc } from "drizzle-orm";
```

- [ ] **Step 2: 新增 `loadParentContent` 辅助方法**

```typescript
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
```

- [ ] **Step 3: 提交**

```bash
git add packages/engines/src/world/geography/generator.ts
git commit -m "feat: 地理引擎新增 loadSiblings 和 loadParentContent 辅助查询"
```

---

### Task 4: 重写 `buildInitialPrompt`

**Files:**
- Modify: `packages/engines/src/world/geography/generator.ts:89-211` (`buildInitialPrompt`)

- [ ] **Step 1: 重写 `buildInitialPrompt` 方法**

完整替换 `buildInitialPrompt` 方法的返回值。新 prompt 核心变更点：
1. 尺度链铁律（最少 4 级、起点必须是全局世界框架、终点必须是 scene）
2. 地理命名规范（纯地名、禁止前缀标签、正式命名）
3. 尺度链定义正式化（精确粒度定义含上下级关系）
4. reasoning 自检要求
5. 更大视角的模板参考

```typescript
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
```

- [ ] **Step 2: 确认 REFERENCE_SCALE_NAMES 和 REFERENCE_SCALE_LABELS 保持不变**

这两个静态属性作为参考仍然有用，不需要修改。

- [ ] **Step 3: 提交**

```bash
git add packages/engines/src/world/geography/generator.ts
git commit -m "feat: 重写地理引擎初始 prompt——尺度链铁律、命名规范、正式化定义"
```

---

### Task 5: 重写 `buildRefinementPrompt`

**Files:**
- Modify: `packages/engines/src/world/geography/generator.ts:216-296` (`buildRefinementPrompt`)

- [ ] **Step 1: 修改 `buildRefinementPrompt` 签名，接受异步数据加载结果**

将 `buildRefinementPrompt` 改为接受额外的上下文参数。在调用前先加载所需数据：

```typescript
/**
 * 细化上下文：辅助查询结果，供 buildRefinementPrompt 使用
 */
interface RefinementContext {
  /** 完整尺度链定义（含 description） */
  scaleTable: string;
  /** 父条目的同级兄弟名称列表 */
  siblingNames: string[];
  /** 父条目的完整 content */
  parentContent: Record<string, unknown> | null;
}
```

- [ ] **Step 2: 在 `buildSystemPrompt` 中加载细化上下文数据**

修改 `buildSystemPrompt` 方法，在细化分支中加载数据并传给 `buildRefinementPrompt`：

```typescript
async buildSystemPrompt(ctx: EngineContext): Promise<string> {
  const genre = await detectGenre(ctx.projectId, ctx.caller);

  if (ctx.refinement) {
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

  return this.buildInitialPrompt(ctx, genre);
}
```

- [ ] **Step 3: 新增 `buildScaleTable` 辅助方法**

将完整尺度链格式化为表格：

```typescript
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
```

- [ ] **Step 4: 重写 `buildRefinementPrompt` 方法**

完整替换 `buildRefinementPrompt`，新签名接受 `RefinementContext` 参数：

```typescript
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

  // 构建父条目完整信息
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
```

- [ ] **Step 5: 确认 TypeScript 编译通过**

```bash
cd /c/Users/10652/Documents/person/NarrativeOS/narrative-os
npx tsc --noEmit --project packages/engines/tsconfig.json 2>&1 | head -20
```

注意：如果 engines 包没有 tsconfig.json，改用根目录的 tsconfig 检查。

- [ ] **Step 6: 提交**

```bash
git add packages/engines/src/world/geography/generator.ts
git commit -m "feat: 重写地理引擎细化 prompt——完整尺度链、同级兄弟、粒度对齐、命名规范"
```

---

### Task 6: 更新 `buildUserMessage` 中的细化消息

**Files:**
- Modify: `packages/engines/src/world/geography/generator.ts` (`buildUserMessage`)

- [ ] **Step 1: 检查 buildUserMessage 细化分支是否需要更新**

当前 `buildUserMessage` 细化分支（约第 300-307 行）：

```typescript
if (ctx.refinement) {
  const ref = ctx.refinement;
  return `请基于已确认的「${ref.parentName}」（${this.getScaleLabel(ref.parentScale)}尺度），
为这部 ${genre} 题材的小说细化其内部结构。
目标尺度：${this.getScaleLabel(ref.targetScale)}（${ref.targetScale}）。
请先用 query_world_setting 工具查询「${ref.parentName}」的详细设定。`;
}
```

这段消息合理，不需要大改。但可以增加一句粒度提醒：

```typescript
if (ctx.refinement) {
  const ref = ctx.refinement;
  const targetLabel = this.getScaleLabel(ref.targetScale);
  return `请基于已确认的「${ref.parentName}」（${this.getScaleLabel(ref.parentScale)}尺度），
为这部 ${genre} 题材的小说细化其内部结构。
目标尺度：${targetLabel}（${ref.targetScale}）。
请确保子条目的粒度对齐「${targetLabel}」的定义，命名使用纯地名。
请先用 query_world_setting 工具查询「${ref.parentName}」的详细设定。`;
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/engines/src/world/geography/generator.ts
git commit -m "fix: 细化用户消息增加粒度对齐和命名提醒"
```

---

### Task 7: 集成验证

**Files:** 无新增，使用现有项目数据验证

- [ ] **Step 1: 启动开发服务器**

```bash
cd /c/Users/10652/Documents/person/NarrativeOS/narrative-os
pnpm dev
```

- [ ] **Step 2: 清理项目 5102fec2 的地理数据**

通过数据库操作清理（注意：这会删除数据，请先确认）：

```sql
-- 删除地理类 setting_items
DELETE FROM setting_items WHERE project_id = '5102fec2-8a84-458b-9563-9d2abd58da6d' AND engine_source = 'geography';

-- 删除尺度链
DELETE FROM project_scales WHERE project_id = '5102fec2-8a84-458b-9563-9d2abd58da6d';

-- 删除地理类提案
UPDATE ai_proposals SET status = 'superseded' WHERE project_id = '5102fec2-8a84-458b-9563-9d2abd58da6d' AND source_node = 'geography';
```

- [ ] **Step 3: 通过前端重新运行 geography 引擎**

在前端对该项目调用 `/hatch/:id/advance`，触发 geography 引擎重新运行。

- [ ] **Step 4: 验证初始 pass 输出质量**

检查新生成的 3 个方案：
- ✅ 尺度链 >= 4 级
- ✅ 第 1 级是全局世界框架（不只是小说直接描述的内容）
- ✅ 每级 description 是正式粒度定义
- ✅ 空间域名是纯地名，无前缀标签
- ✅ reasoning 包含自检论证

- [ ] **Step 5: 审批一个方案，验证细化质量**

审批后选择一个顶层空间域进行细化，检查：
- ✅ prompt 中注入了完整尺度链表格
- ✅ 子条目粒度对齐目标尺度定义
- ✅ 命名是纯地名
- ✅ 3 个完整方案

- [ ] **Step 6: 最终提交**

```bash
git add -A
git commit -m "feat: 地理引擎尺度体系与细化质量提升完成"
```
