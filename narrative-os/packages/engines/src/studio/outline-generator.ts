import { Engine } from "../base";
import type { Proposal, EngineContext } from "../types";
import { detectGenre } from "../context";
import { db, projectSettings, projects } from "@narrative-os/database";
import { eq } from "drizzle-orm";

/**
 * 大纲生成器 — 基于世界观圣经生成全局故事大纲。
 * 产出 2-3 个风格迥异的大纲方案。
 */
export class OutlineGeneratorEngine extends Engine {
  constructor() { super("outline-generator"); }
  protected getModelTier(): "lightweight" | "pro" { return "pro"; }
  protected getTokenBudget(): number { return 32000; }
  protected getProposalType(): string { return "outline"; }
  // 注入全部世界引擎的已确认设定作为上下文
  protected getContextEngines(): string[] {
    return ["tone", "geography", "power-system", "faction", "character", "conflict", "item-system", "story-blueprint"];
  }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    // 读取项目写作目标，用于动态设定大纲参数
    const [proj] = await db
      .select({
        targetWords: projects.targetWords,
        targetVolumeCount: projects.targetVolumeCount,
        targetChapterCount: projects.targetChapterCount,
        targetChapterWords: projects.targetChapterWords,
      })
      .from(projects)
      .where(eq(projects.id, ctx.projectId));

    const [settings] = await db
      .select({ worldBible: projectSettings.worldBible })
      .from(projectSettings)
      .where(eq(projectSettings.projectId, ctx.projectId));

    const revisionNotes = await this.loadRevisionNotes(ctx.projectId);

    const targetVolumes = proj?.targetVolumeCount || 10;
    const targetWords = proj?.targetWords || 3_000_000;
    const targetChapterWords = proj?.targetChapterWords || 10_000;
    const estimatedChaptersPerVolume = proj?.targetChapterCount
      ? Math.ceil(proj.targetChapterCount / targetVolumes)
      : 30;

    const worldBibleContext = settings?.worldBible
      ? JSON.stringify(settings.worldBible, null, 2)
      : "暂无（请基于消息中注入的世界设定进行设计）";

    return `你是长篇小说创作系统的【大纲架构师】。

## 任务
为一部 ${genre} 题材的长篇小说设计全局故事大纲。请提供 2-3 个方案。

## 写作目标
- 目标总字数：${targetWords.toLocaleString()} 字
- 计划卷数：${targetVolumes} 卷
- 每章目标字数：${targetChapterWords.toLocaleString()} 字

## 世界观圣经
${worldBibleContext}

## 输出格式
{
  "proposals": [{
    "type": "outline",
    "title": "全局大纲：简洁概括方案核心特征的标题",
    "content": {
      "reasoning": "核心理念及与其他方案的差异...",
      "payload": {
        "premise": "故事核心前提",
        "theme": "核心主题",
        "targetVolumes": ${targetVolumes},
        "targetWords": ${targetWords},
        "overallArc": "主角从...到...的成长弧线",
        "volumes": [
          { "volumeNumber": 1, "title": "卷标题", "summary": "本卷概述", "roleInArc": "在整体故事中的作用", "keyEvents": ["关键事件"], "estimatedChapters": ${estimatedChaptersPerVolume} }
        ],
        "majorCharacters": [
          { "name": "角色名", "role": "在故事中的定位", "arc": "角色成长弧线" }
        ],
        "foreshadowing": ["伏笔1"]
      }
    }
  }]
}

## 铁律
- 提供 2-3 个风格迥异的大纲方案
- 大纲必须支撑长篇连载
- 每卷要有明确的叙事功能和推进感${revisionNotes}`;
  }

  parseOutput(raw: string): Proposal[] {
    return this.parseJsonProposals(raw, "大纲生成");
  }
}
