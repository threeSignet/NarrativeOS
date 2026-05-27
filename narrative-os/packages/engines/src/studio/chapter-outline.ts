import { Engine } from "../base";
import type { Proposal, EngineContext } from "../types";
import { detectGenre } from "../context";
import { db, projectSettings, outlines, volumes, chapters, projects } from "@narrative-os/database";
import { eq, and, asc } from "drizzle-orm";

/**
 * 章纲生成器 — 每次调用只为一个章节生成章纲（2-3 个备选方案）。
 * 自动检测下一个未生成章纲的卷和章节号。
 */
export class ChapterOutlineEngine extends Engine {
  constructor() { super("chapter-outline"); }
  protected getModelTier(): "lightweight" | "pro" { return "pro"; }
  protected getTokenBudget(): number { return 32000; }
  protected getContextEngines(): string[] {
    return ["tone", "geography", "power-system", "faction", "character", "conflict", "item-system", "story-blueprint"];
  }

  async buildSystemPrompt(ctx: EngineContext): Promise<string> {
    const genre = await detectGenre(ctx.projectId, ctx.caller);

    // 读取项目写作目标
    const [proj] = await db
      .select({ targetChapterWords: projects.targetChapterWords })
      .from(projects).where(eq(projects.id, ctx.projectId));
    const chapterWordTarget = proj?.targetChapterWords || 10_000;

    // 自动检测目标卷号：优先从 caller 解析，否则找第一个已确认的卷
    const volMatch = ctx.caller.match(/volume=(\d+)/);
    let targetVolumeNumber = volMatch ? parseInt(volMatch[1]) : 0;

    const [settings] = await db.select({ worldBible: projectSettings.worldBible }).from(projectSettings).where(eq(projectSettings.projectId, ctx.projectId));
    const [globalOutline] = await db.select().from(outlines).where(and(eq(outlines.projectId, ctx.projectId), eq(outlines.status, "confirmed")));

    // 若未指定卷号，自动查找第一个已确认且还有剩余章节的卷
    if (!targetVolumeNumber) {
      const confirmedVolumes = await db
        .select()
        .from(volumes)
        .where(and(eq(volumes.projectId, ctx.projectId), eq(volumes.status, "confirmed")))
        .orderBy(asc(volumes.volumeNumber));

      for (const vol of confirmedVolumes) {
        const existingCount = (await db
          .select()
          .from(chapters)
          .where(and(eq(chapters.projectId, ctx.projectId), eq(chapters.volumeId, vol.id), eq(chapters.status, "confirmed")))
        ).length;
        const targetCount = vol.totalChapters || 30;
        if (existingCount < targetCount) {
          targetVolumeNumber = vol.volumeNumber;
          break;
        }
      }
      if (!targetVolumeNumber) {
        throw new Error("所有已确认卷的章纲已全部生成完毕。");
      }
    }

    const [targetVolume] = await db
      .select()
      .from(volumes)
      .where(and(eq(volumes.projectId, ctx.projectId), eq(volumes.volumeNumber, targetVolumeNumber), eq(volumes.status, "confirmed")));

    if (!targetVolume) throw new Error(`第 ${targetVolumeNumber} 卷未找到或未确认。`);

    const existingChapters = await db
      .select()
      .from(chapters)
      .where(and(eq(chapters.projectId, ctx.projectId), eq(chapters.volumeId, targetVolume.id), eq(chapters.status, "confirmed")));
    const existingNumbers = existingChapters.map(c => c.chapterNumber);
    const nextChapterNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

    if (targetVolume.totalChapters && nextChapterNumber > targetVolume.totalChapters) {
      throw new Error(`第 ${targetVolumeNumber} 卷全部 ${targetVolume.totalChapters} 章已生成完毕。`);
    }

    const revisionNotes = await this.loadRevisionNotes(ctx.projectId);

    const worldBibleContext = settings?.worldBible ? JSON.stringify(settings.worldBible, null, 2) : "暂无";
    const outlineContext = globalOutline ? JSON.stringify(globalOutline.content, null, 2) : "暂无";
    const volumeOutlineContext = targetVolume.outline ? JSON.stringify(targetVolume.outline, null, 2) : "暂无卷纲";
    const existingChaptersContext = existingChapters.length > 0
      ? existingChapters.map(c => `第${c.chapterNumber}章 ${c.title}：${c.summary || ""}`).join("\n")
      : "（这是本卷第一章）";

    return `你是长篇小说创作系统的【章纲架构师】。

## 任务
为一部 ${genre} 题材的长篇小说生成**第 ${targetVolumeNumber} 卷第 ${nextChapterNumber} 章**的详细章纲。请提供 2-3 个方案。

## 全局大纲
${outlineContext}

## 当前卷：第 ${targetVolumeNumber} 卷「${targetVolume.title}」
${volumeOutlineContext}

## 本卷已有章节
${existingChaptersContext}

## 世界观圣经
${worldBibleContext}

## 输出格式
{
  "proposals": [{
    "type": "chapter_outline",
    "title": "第${targetVolumeNumber}卷第${nextChapterNumber}章：简洁概括方案核心特征的标题",
    "content": {
      "reasoning": "与其他方案的差异...",
      "payload": {
        "volumeNumber": ${targetVolumeNumber}, "chapterNumber": ${nextChapterNumber},
        "title": "章节标题", "summary": "章节概要",
        "scenes": [{ "location": "地点", "characters": ["角色"], "action": "事件", "dialogue": "关键对话", "internalState": "内心状态" }],
        "pov": "视角角色", "emotionalArc": "情绪弧线", "wordCountTarget": ${chapterWordTarget},
        "cliffhanger": "章末悬念", "foreshadowingPlanted": [], "foreshadowingResolved": [],
        "connectionsToPrevious": [], "connectionsToFuture": []
      }
    }
  }]
}

## 铁律
- 提供 2-3 个风格迥异的章纲方案
- 承接已有章节的剧情发展，保持连贯
- 章末必须有钩子驱动继续阅读${revisionNotes}`;
  }

  parseOutput(raw: string): Proposal[] {
    return this.parseJsonProposals(raw, "章纲生成");
  }
}
