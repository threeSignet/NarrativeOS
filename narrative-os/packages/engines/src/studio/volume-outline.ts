import { Engine } from "../base";
import type { Proposal, EngineContext } from "../types";
import { detectGenre } from "../context";
import { db, projectSettings, outlines, volumes, projects } from "@narrative-os/database";
import { eq, and } from "drizzle-orm";

export class VolumeOutlineEngine extends Engine {
  constructor() { super("volume-outline"); }
  protected getModelTier(): "lightweight" | "pro" { return "pro"; }
  protected getTokenBudget(): number { return 32000; }
  protected getContextEngines(): string[] {
    return ["tone", "geography", "power-system", "faction", "character", "conflict", "item-system", "story-blueprint"];
  }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    // 读取项目写作目标，动态计算卷级参数
    const [proj] = await db
      .select({ targetChapterWords: projects.targetChapterWords, targetChapterCount: projects.targetChapterCount, targetVolumeCount: projects.targetVolumeCount })
      .from(projects).where(eq(projects.id, ctx.projectId));

    const [settings] = await db.select({ worldBible: projectSettings.worldBible }).from(projectSettings).where(eq(projectSettings.projectId, ctx.projectId));
    const [globalOutline] = await db.select().from(outlines).where(and(eq(outlines.projectId, ctx.projectId), eq(outlines.status, "confirmed")));
    const existingVolumes = await db.select().from(volumes).where(and(eq(volumes.projectId, ctx.projectId), eq(volumes.status, "confirmed")));
    const revisionNotes = await this.loadRevisionNotes(ctx.projectId);

    const totalVolumes = proj?.targetVolumeCount || 10;
    const chapterWords = proj?.targetChapterWords || 10_000;
    const totalChapters = proj?.targetChapterCount || 300;
    const chaptersPerVolume = Math.ceil(totalChapters / totalVolumes);
    const volumeWords = chaptersPerVolume * chapterWords;

    const worldBibleContext = settings?.worldBible ? JSON.stringify(settings.worldBible, null, 2) : "暂无";
    const outlineContext = globalOutline ? JSON.stringify(globalOutline.content, null, 2) : "暂无全局大纲";
    const volumesContext = existingVolumes.length > 0 ? existingVolumes.map(v => `卷${v.volumeNumber}：${v.title}`).join("\n") : "暂无已确认卷纲";

    return `你是长篇小说创作系统的【卷纲架构师】。

## 任务
为一部 ${genre} 题材的长篇小说设计某一卷的详细卷纲。请提供 2-3 个方案。

## 全局大纲
${outlineContext}

## 已确认卷纲
${volumesContext}

## 世界观圣经
${worldBibleContext}

## 输出格式
{
  "proposals": [{
    "type": "volume_outline",
    "title": "第X卷：简洁概括方案核心特征的标题",
    "content": {
      "reasoning": "...",
      "payload": {
        "volumeNumber": 1, "title": "卷名", "summary": "本卷概述",
        "narrativeGoal": "叙事目标", "characterDevelopment": "角色成长",
        "plotStructure": { "opening": "...", "risingAction": [], "climax": "...", "fallingAction": "...", "resolution": "..." },
        "targetChapters": ${chaptersPerVolume}, "targetWords": ${volumeWords},
        "chapters": [
          { "chapterNumber": 1, "title": "章节标题", "summary": "...", "keyEvents": [], "pov": "视角角色", "emotionalBeat": "情绪节拍" }
        ],
        "foreshadowing": [], "callbackTo": []
      }
    }
  }]
}

## 铁律
- 提供 2-3 个风格迥异的卷纲方案
- 卷纲必须紧扣全局大纲的叙事方向
- 每章要有明确的叙事功能和推进感${revisionNotes}`;
  }

  parseOutput(raw: string): Proposal[] {
    return this.parseJsonProposals(raw, "卷纲生成");
  }
}
