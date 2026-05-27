import { Engine } from "../../base";
import type { Proposal, EngineContext } from "../../types";
import { detectGenre, buildContextReferenceSection, buildEngineUserMessage } from "../../context";

/**
 * ChapterWriterEngine — 章节写作引擎（工作室引擎核心）
 *
 * 这是设计文档第4.1.3节定义的工作室引擎最核心的子系统。
 * 基于章纲、伏笔计划、世界设定，生成场景级的正文草稿。
 *
 * 核心职责：
 * 1. 将章纲拆解为3-7个场景
 * 2. 为每个场景生成300-800字的正文草稿
 * 3. 自动埋设/回收伏笔
 * 4. 自动引用已确认的世界设定
 * 5. 生成自我审查建议（revision_note）
 *
 * 深度关联：
 * - chapter-outline: 章纲定义本章的内容框架
 * - foreshadowing: 本章的伏笔埋设/回收计划
 * - story-blueprint: 章节在故事线中的位置
 * - character: 出场的角色
 * - geography: 场景地点
 * - power-system/technique: 力量展示
 * - rules: 世界规则的遵守/突破
 * - items: 关键物品的出场
 */
export class ChapterWriterEngine extends Engine {
  constructor() {
    super("chapter-writer");
  }

  protected getModelTier(): "lightweight" | "pro" {
    return "pro";
  }

  // settingType 是 "chapter_writing" 而非默认的 "chapter_writer"
  protected getProposalType(): string { return "chapter_writing"; }

  /** 重写：章节写作时自动从章节快照查询世界数据（冻结状态，不受后续变更影响） */
  protected getSnapshotChapterId(ctx: EngineContext): string | undefined {
    return ctx.chapterId;
  }

  /**
   * 自动快照：章节写作开始前，如果该章节尚无世界快照，则自动创建一份。
   * 快照冻结当前所有已确认的世界设定，保证写作期间数据一致性。
   */
  public async *streamRun(ctx: EngineContext): AsyncGenerator<any> {
    if (ctx.chapterId) {
      try {
        const { db, chapters, settingItems, settingItemRelations } = await import("@narrative-os/database");
        const { eq, and } = await import("drizzle-orm");

        const [chapter] = await db
          .select({ worldSnapshot: chapters.worldSnapshot, projectId: chapters.projectId })
          .from(chapters)
          .where(eq(chapters.id, ctx.chapterId));

        // 仅当快照不存在时自动创建
        if (chapter && !chapter.worldSnapshot) {
          const items = await db
            .select({
              id: settingItems.id, type: settingItems.type, name: settingItems.name,
              summary: settingItems.summary, content: settingItems.content,
              tags: settingItems.tags, engineSource: settingItems.engineSource,
              itemSubtype: settingItems.itemSubtype, parentItemId: settingItems.parentItemId,
              createdAt: settingItems.createdAt,
            })
            .from(settingItems)
            .where(and(eq(settingItems.projectId, chapter.projectId), eq(settingItems.status, "confirmed")));

          const rels = await db
            .select({ sourceItemId: settingItemRelations.sourceItemId, targetItemId: settingItemRelations.targetItemId, relationType: settingItemRelations.relationType, label: settingItemRelations.label })
            .from(settingItemRelations)
            .where(eq(settingItemRelations.projectId, chapter.projectId));

          const nameMap = new Map(items.map((i: any) => [i.id, i.name]));
          const snapshot = {
            items: items.map((item: any) => ({
              id: item.id, type: item.type, name: item.name, summary: item.summary || "",
              content: (item.content || {}) as Record<string, unknown>, tags: item.tags,
              engineSource: item.engineSource, itemSubtype: item.itemSubtype,
              parentItemId: item.parentItemId, createdAt: String(item.createdAt || ""),
            })),
            relations: rels.map((r: any) => ({
              sourceName: nameMap.get(r.sourceItemId) || "?", targetName: nameMap.get(r.targetItemId) || "?",
              relationType: r.relationType, label: r.label || "",
            })),
            takenAt: new Date().toISOString(),
          };

          await db.update(chapters)
            .set({ worldSnapshot: snapshot, snapshotTakenAt: new Date() })
            .where(eq(chapters.id, ctx.chapterId));

          console.log(`[chapter-writer] Auto-snapshot created for chapter ${ctx.chapterId}: ${snapshot.items.length} items`);
        }
      } catch (err: any) {
        console.warn(`[chapter-writer] Auto-snapshot failed (non-fatal): ${err.message}`);
      }
    }

    yield* super.streamRun(ctx);
  }

  /** 正文引擎需要看所有已确认的世界数据，生成5-10个场景需要大量上下文 */
  protected getTokenBudget(): number {
    return 48000;
  }

  protected getContextEngines(): string[] {
    return ["chapter-outline", "foreshadowing", "story-blueprint", "character", "geography", "power-system", "technique", "rules", "item-system"];
  }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);
    return `你是长篇小说创作系统的【章节写作引擎】。

## 系统定位
你是工作室引擎的核心——将章纲转化为具体的正文场景。
你不写"大纲"，你写的是读者会逐字阅读的正文文本。

## 写作前必须查询世界数据
**在写任何场景之前，你必须使用 query_world_setting 工具查询本章涉及的所有世界设定。**
- 查询本章发生的**地理地点**的完整信息（用 name 参数查地名）
- 查询本章出场的**角色**信息（用 engine="character" 查所有角色，找出本章角色）
- 查询本章涉及的**势力**（用 engine="faction"）
- 查询本章涉及的**功法/物品**（用 engine="technique" 和 engine="item-system"）
- 查询本章涉及的**规则**（用 engine="rules"）
不要凭记忆写作——已确认的世界设定是唯一的权威来源。工具会自动查询本章的世界快照（冻结状态）。

${buildContextReferenceSection(["chapter-outline", "foreshadowing", "story-blueprint", "character", "geography", "power-system", "technique", "rules", "item-system"])}

## 任务
为一部 ${genre} 题材的长篇小说的一个具体章纲生成章节正文草稿。请提供 2-3 个写作角度/节奏不同的方案。

## 输出格式（Multi-Item）
必须输出纯 JSON，不要 Markdown 代码块：
{
  "proposals": [{
    "type": "chapter_writing",
    "title": "简洁概括这个写作方案的特色（如：冷峻旁观视角 / 内心独白为主 / 快节奏动作场景优先）",
    "content": {
      "reasoning": "写作方案的理念、为什么选择这种叙事节奏、与其他方案的差异..."
    }
  }]
}

实际上完整的输出格式如下：

{
  "proposals": [{
    "type": "chapter_writing",
    "title": "方案标题",
    "content": {
      "reasoning": "写作方案说明",
      "payload": {
        "name": "第X卷第Y章：章节标题",
        "items": [
          {
            "subtype": "chapter_draft",
            "name": "第X卷第Y章完整草稿",
            "summary": "本章的一句话概要",
            "content": {
              "chapter_number": "第3卷第15章",
              "chapter_title": "章节标题",
              "target_word_count": 3000
            }
          },
          {
            "subtype": "scene_draft",
            "name": "场景1：场景标题",
            "summary": "本场景的一句话概要",
            "content": {
              "scene_number": 1,
              "scene_type": "opening",
              "scene_title": "场景标题",
              "prose": "这里是实际的正文文本...（300-800字的中文段落，包含对话、描写、动作、内心独白等）",
              "word_count": 450,
              "pov_character": "主角名（已确认的角色名）",
              "scene_location": "场景地点（已确认的地点名）",
              "characters_present": ["出场角色1（已确认的角色名）", "角色2"],
              "world_references": ["引用的世界设定条目（已确认的名称）"],
              "foreshadowing_planted": ["本场景埋设的伏笔（已确认的伏笔名）"],
              "foreshadowing_paid_off": ["本场景回收的伏笔（已确认的伏笔名）"],
              "power_displays": ["力量展示（引用已确认的境界名/功法名）"],
              "callbacks": ["与前文的呼应描述"],
              "emotional_tone": "场景的情感基调（如：紧张中带着一丝黑色幽默）",
              "scene_goal": "本场景的叙事目标（推动哪条情节线/揭示什么信息/展示什么角色特征）"
            }
          },
          {
            "subtype": "revision_note",
            "name": "自我审查：关于场景X的修改建议",
            "summary": "一句话概括建议",
            "content": {
              "target_scene": 1,
              "suggestion_type": "tighten",
              "suggestion": "具体修改建议（如：第3段的人物对话稍显冗长，建议把5轮对话压缩为3轮，保留最关键的2句信息）",
              "priority": "should_fix"
            }
          }
        ],
        "relations": [
          { "sourceName": "场景1", "targetName": "场景2", "relationType": "hierarchy", "label": "场景序列" },
          { "sourceName": "场景1", "targetName": "伏笔A", "relationType": "reference", "label": "在此埋设" },
          { "sourceName": "场景2", "targetName": "角色B", "relationType": "reference", "label": "核心出场角色" }
        ]
      }
    }
  }]
}

## 场景写作规范

### 每个场景必须包含
- prose 字段：实际的正文文本，300-800字
- scene_goal 字段：本场景的叙事目标（不能只是为了"过渡"而存在）
- emotional_tone 字段：读者应该感受到的情绪

### 伏笔的自动处理
- 如果本章章纲落在 foreshadowing 引擎规划的"埋设区间"内，必须在对应场景中埋设伏笔
- 如果本章章纲落在 foreshadowing 引擎规划的"回收区间"内，必须在对应场景中回收伏笔
- 埋设伏笔的方式要符合 plant_method 的建议（对话/描写/动作/旁白/物品出现）
- 伏笔的 subtlety 要符合规划（obvious/subtle/hidden）

### 世界设定的自动引用
- 每个场景涉及的地点必须使用已确认的 geography 地名
- 出场的角色必须使用已确认的 character 角色名
- 涉及力量展示时必须引用已确认的境界名和功法名
- 涉及重要物品时必须引用已确认的 items 物品名

### 写作风格要求
- 每场景 300-800 字，整章 5-10 个场景，总字数 2000-5000 字
- 场景之间要有明确的节奏变化——紧张场景之后接缓和场景，对话场景之后接动作场景
- 每个场景的 prose 要包含：环境描写、人物对话（如有）、动作描写、适当的内心独白/旁白
- 对话要有"潜台词"——角色说的和角色想的/感受的不一定一致
- 环境和动作描写要有具体的感官细节（不只是视觉，要有声音、气味、触感）

## 铁律
- 提供 2-3 个写作方案（不同写作视角/节奏/风格偏好）
- 本章通常包含 5-10 个场景，每场景 300-800 字
- 所有引用的角色名、地点名、伏笔名、功法名必须使用上下文参考中已确认的精确名称
- 如果 foreshadowing 引擎规划了本章的伏笔埋设/回收，必须在对应场景中执行
- 至少包含 1 条 revision_note 进行自我审查
- prose 必须是真实可读的中文文本，不能是占位符或概括性描述

## 反面示例（绝对不要这样做）
- ❌ prose 写"此处主角与XX角色有一场精彩的对话"——这是章纲，不是正文
- ❌ 所有场景的 prose 都是概括性描述而没有具体文本——读者不能读概要
- ❌ 场景只有对话没有描写——读者想象不出场景的样子
- ❌ 引用虚构的角色名/地点名——必须严格使用已确认的名称
- ❌ foreshadowing 应该埋设/回收的伏笔被忽略——这是伏笔废弃的最常见原因`;
  }

  async buildUserMessage(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);
    return buildEngineUserMessage("chapter-writer", ["chapter-outline", "foreshadowing", "story-blueprint", "character", "geography", "power-system", "technique", "rules", "item-system"], genre);
  }

  parseOutput(raw: string): Proposal[] {
    return this.parseJsonProposals(raw, "章节写作", 1);
  }
}
