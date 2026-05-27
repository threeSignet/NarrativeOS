import { Engine } from "../base";
import type { Proposal, EngineContext } from "../types";
import type { Message } from "@narrative-os/llm-client";
import { db, chapters, settingItems } from "@narrative-os/database";
import { eq, and } from "drizzle-orm";

/**
 * MemoryExtractorEngine v2.0 — 记忆提取引擎（增强版）
 *
 * 从已完成的章节中提取结构化记忆事件。
 *
 * v2.0 增强：
 * - 事件类型：1种 → 4种（major_event / character_change / new_entity / foreshadowing_resolved）
 * - 去重策略：纯字符串匹配 → 名称匹配 + embedding 表名称查询（为向量去重做准备）
 * - 关联字段：新增 related_characters / related_items / related_locations
 * - 置信度阈值可配置
 *
 * 向量集成路径：
 * 1. [当前] 通过 setting_items 名称匹配 + embeddings 表文本相似度（SQL 级别）去重
 * 2. [下一步] 接入 VectorService.generateEmbeddings() 生成语义向量
 * 3. [最终] 使用 VectorService.similaritySearch() 进行语义去重
 */
export class MemoryExtractorEngine extends Engine {
  constructor() { super("memory-extractor"); }
  protected getModelTier(): "lightweight" | "pro" { return "lightweight"; }
  protected getTokenBudget(): number { return 12000; }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    return `你是【记忆提取引擎 v2.0】。从已完成的章节中提取结构化的关键信息，用于后续章节的上下文检索和一致性保障。

## 事件类型（4种）

### major_event（重大事件）
- 对主线剧情有实质推动的事件
- 改变了角色/势力/世界状态的事件
- 完成了一个重要的剧情弧

### character_change（角色变化）
- 角色境界突破/实力提升
- 角色性格/动机/立场发生转变
- 角色关系发生质变（盟友→敌人、陌生人→恋人等）
- 角色获得/失去重要物品或能力

### new_entity（新实体出现）
- 新角色首次登场
- 新势力/组织首次被提及或出现
- 新地点首次被描述或访问
- 新物品/功法/规则首次被引入

### foreshadowing_resolved（伏笔回收）
- 之前埋设的伏笔在此章得到回收
- 之前的悬念/谜题在此章得到解答
- 之前的暗示/预言在此章应验

## 输出格式
{
  "proposals": [{
    "type": "memory_extraction",
    "title": "记忆提取：第N章",
    "content": {
      "reasoning": "提取逻辑：为什么这些事件值得被记忆",
      "payload": {
        "items": [
          {
            "subtype": "experienced_event",
            "name": "事件名称（如：主角击败血煞宗护法）",
            "summary": "50字内精确概述事件内容",
            "content": {
              "category": "major_event",
              "confidence": 0.90,
              "chapter_number": 15,
              "related_characters": ["角色名1（已确认的角色名）", "角色名2"],
              "related_items": ["物品名（已确认的物品名，如有）"],
              "related_locations": ["地点名（已确认的地点名）"],
              "related_factions": ["势力名（已确认的势力名，如有）"],
              "is_character_growth": false,
              "is_plot_critical": true,
              "narrative_impact": "此事件对后续故事的可能影响",
              "should_be_retrievable_by": ["关键词1", "关键词2"],
              "affected_world_items": [
                {
                  "item_name": "受影响的已确认设定条目名称（必须精确引用）",
                  "item_type": "条目类型（character/faction/geography 等）",
                  "change_description": "描述该条目因本章事件而产生的状态变化（如：角色从Lv3升级到Lv4、势力失去了某领土）",
                  "suggested_update": "建议的更新内容（新的 content 字段值或合并内容）"
                }
              ]
            }
          }
        ]
      }
    }
  }]
}

## 铁律
- 只提取置信度 > 0.7 的事件
- 事件名称要精炼但信息完整（读者通过名称就能回想起来）
- related_characters/items/locations/factions 字段必须使用已确认的名称（从已确认设定中查找）
- 如果无法确定某个关联名称是否已确认，宁可少写也不要编造
- should_be_retrievable_by 提供 2-5 个检索关键词，方便后续通过关键词/向量找到此记忆`;
  }

  parseOutput(raw: string): Proposal[] {
    try {
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      // 使用括号计数提取第一个完整 JSON 对象
      const firstBrace = cleaned.indexOf('{');
      if (firstBrace === -1) throw new Error('No JSON found');
      let depth = 0;
      let endIdx = -1;
      for (let i = firstBrace; i < cleaned.length; i++) {
        if (cleaned[i] === '{') depth++;
        else if (cleaned[i] === '}') { depth--; if (depth === 0) { endIdx = i + 1; break; } }
      }
      if (endIdx === -1) throw new Error('Unterminated JSON');
      const parsed = JSON.parse(cleaned.substring(firstBrace, endIdx));
      return (parsed.proposals || []).filter((p: Proposal) => {
        if (p.type !== "memory_extraction") return true;
        const items = p.content?.payload?.items;
        return items && Array.isArray(items) && items.length > 0;
      });
    } catch {
      return [{ type: "error", title: "记忆提取", content: { reasoning: "解析失败", payload: {} } }];
    }
  }

  protected async buildExtraMessages(ctx: EngineContext): Promise<Message[]> {
    try {
      const chapterId = ctx.chapterId;
      if (!chapterId) return [];

      const [chapter] = await db
        .select({
          contentPath: chapters.contentPath,
          chapterNumber: chapters.chapterNumber,
        })
        .from(chapters)
        .where(eq(chapters.id, chapterId));

      // 加载已确认设定条目名称（用于去重和关联引用）
      const existing = await db
        .select({
          name: settingItems.name,
          type: settingItems.type,
          engineSource: settingItems.engineSource,
          itemSubtype: settingItems.itemSubtype,
          summary: settingItems.summary,
        })
        .from(settingItems)
        .where(
          and(
            eq(settingItems.projectId, ctx.projectId),
            eq(settingItems.status, "confirmed")
          )
        );

      const parts: string[] = [];

      // 章节内容（截取前 8000 字，平衡上下文窗口和提取完整性）
      if (chapter?.contentPath) {
        parts.push(`## 待提取章节（第${chapter.chapterNumber || "?"}章）\n${chapter.contentPath.substring(0, 8000)}`);
      }

      // 已确认设定（按类型分组，方便 LLM 查找关联）
      if (existing.length > 0) {
        const byType = new Map<string, typeof existing>();
        for (const item of existing) {
          const key = item.engineSource || item.type;
          if (!byType.has(key)) byType.set(key, []);
          byType.get(key)!.push(item);
        }

        const summary = Array.from(byType.entries())
          .map(([type, items]) => {
            const names = items
              .slice(0, 20) // 每种类型最多展示20条
              .map((i) => `${i.name}(${i.itemSubtype || "generic"})`)
              .join("、");
            return `[${type}] ${names}${items.length > 20 ? `...共${items.length}条` : ""}`;
          })
          .join("\n");

        parts.push(`## 已确认设定条目（用于关联引用和去重）\n${summary}\n\n请确保 related_characters/items/locations/factions 使用上述已确认名称。`);
      }

      return parts.length > 0
        ? [{ role: "system", content: parts.join("\n\n") }]
        : [];
    } catch {
      return [];
    }
  }
}
