/**
 * EmbeddingPipeline — 自动嵌入管线
 *
 * 在关键数据变更时自动触发向量嵌入：
 * - 设定条目确认/更新 → setting_item 嵌入
 * - 章节提交 → chapter_chunk 嵌入
 * - 记忆事件提取 → memory_event 嵌入
 * - 章节摘要生成 → event_summary 嵌入
 *
 * 单例模式，由 server 层初始化。
 */

import { eq, and } from "drizzle-orm";
import { db } from "./index";
import { settingItems, chapters } from "./schema";
import { VectorService } from "./vector-service";
import type { EmbeddingSourceType, VectorSearchResult } from "./embedding-types";

export class EmbeddingPipeline {
  private static instance: EmbeddingPipeline | null = null;
  private vectorService: VectorService;

  constructor(vectorService: VectorService) {
    this.vectorService = vectorService;
  }

  static initialize(vectorService: VectorService) {
    if (!EmbeddingPipeline.instance) {
      EmbeddingPipeline.instance = new EmbeddingPipeline(vectorService);
      console.log("[EmbeddingPipeline] Initialized");
    }
  }

  static getInstance(): EmbeddingPipeline | null {
    return EmbeddingPipeline.instance;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 设定条目嵌入
  // ═══════════════════════════════════════════════════════════════════════════

  async embedSettingItem(projectId: string, itemId: string): Promise<string[]> {
    try {
      const [item] = await db
        .select({ name: settingItems.name, summary: settingItems.summary, content: settingItems.content })
        .from(settingItems)
        .where(and(eq(settingItems.id, itemId), eq(settingItems.projectId, projectId)));

      if (!item) {
        console.warn(`[EmbeddingPipeline] Setting item ${itemId} not found`);
        return [];
      }

      // 构建文本：名称 + 概述 + 内容摘要
      const contentText = item.content ? JSON.stringify(item.content) : "";
      const text = `${item.name}\n${item.summary}\n${contentText}`.substring(0, 8000);

      // 清理旧嵌入
      await this.vectorService.deleteBySource(itemId);

      // 生成并存储新嵌入
      const ids = await this.vectorService.embedAndStore(
        projectId,
        "setting_item",
        itemId,
        text,
        { name: item.name, summary: item.summary }
      );

      console.log(`[EmbeddingPipeline] Setting item ${itemId} embedded: ${ids.length} chunks`);
      return ids;
    } catch (err: any) {
      console.error(`[EmbeddingPipeline] Failed to embed setting item ${itemId}:`, err.message);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 章节嵌入
  // ═══════════════════════════════════════════════════════════════════════════

  async embedChapter(projectId: string, chapterId: string, chapterContent?: string): Promise<string[]> {
    try {
      const [chapter] = await db
        .select({
          title: chapters.title,
          summary: chapters.summary,
          contentSummary: chapters.contentSummary,
          contentPath: chapters.contentPath,
          chapterNumber: chapters.chapterNumber,
        })
        .from(chapters)
        .where(and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId)));

      if (!chapter) {
        console.warn(`[EmbeddingPipeline] Chapter ${chapterId} not found`);
        return [];
      }

      // 构建文本：标题 + 摘要 + 内容摘要 + 正文（优先用 contentPath 传入的内容，避免再次读取文件）
      const text = [
        chapter.title,
        chapter.summary || "",
        chapter.contentSummary || "",
        chapterContent || chapter.contentPath || "",
      ]
        .filter(Boolean)
        .join("\n\n")
        .substring(0, 15000);

      if (!text.trim()) {
        console.warn(`[EmbeddingPipeline] Chapter ${chapterId} has no content to embed`);
        return [];
      }

      // 清理旧嵌入
      await this.vectorService.deleteBySource(chapterId);

      // 生成并存储新嵌入
      const ids = await this.vectorService.embedAndStore(
        projectId,
        "chapter_chunk",
        chapterId,
        text,
        { chapterNumber: chapter.chapterNumber, title: chapter.title }
      );

      console.log(`[EmbeddingPipeline] Chapter ${chapterId} embedded: ${ids.length} chunks`);
      return ids;
    } catch (err: any) {
      console.error(`[EmbeddingPipeline] Failed to embed chapter ${chapterId}:`, err.message);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 记忆事件嵌入
  // ═══════════════════════════════════════════════════════════════════════════

  async embedMemoryEvent(
    projectId: string,
    eventId: string,
    eventText: string,
    meta?: Record<string, unknown>
  ): Promise<string[]> {
    try {
      if (!eventText.trim()) return [];

      // 清理旧嵌入
      await this.vectorService.deleteBySource(eventId);

      const ids = await this.vectorService.embedAndStore(
        projectId,
        "memory_event",
        eventId,
        eventText,
        meta
      );

      console.log(`[EmbeddingPipeline] Memory event ${eventId} embedded: ${ids.length} chunks`);
      return ids;
    } catch (err: any) {
      console.error(`[EmbeddingPipeline] Failed to embed memory event ${eventId}:`, err.message);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 章节摘要嵌入（content_summary 字段更新时）
  // ═══════════════════════════════════════════════════════════════════════════

  async embedChapterSummary(projectId: string, chapterId: string, summary: string): Promise<string[]> {
    try {
      if (!summary.trim()) return [];

      await this.vectorService.deleteBySource(`${chapterId}:summary`);

      const ids = await this.vectorService.embedAndStore(
        projectId,
        "event_summary",
        `${chapterId}:summary`,
        summary,
        { chapterId, type: "chapter_summary" }
      );

      console.log(`[EmbeddingPipeline] Chapter summary ${chapterId} embedded: ${ids.length} chunks`);
      return ids;
    } catch (err: any) {
      console.error(`[EmbeddingPipeline] Failed to embed chapter summary ${chapterId}:`, err.message);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RAG 检索 — Companion 和写作引擎使用
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 为 Companion Agent 检索相关上下文。
   * 返回混合结果：设定条目 + 章节摘要 + 记忆事件。
   */
  async searchForCompanion(
    projectId: string,
    query: string,
    limit = 8
  ): Promise<VectorSearchResult[]> {
    try {
      return await this.vectorService.searchByText(projectId, query, {
        similarityThreshold: 0.6,
        limit,
      });
    } catch (err: any) {
      console.error(`[EmbeddingPipeline] Companion search failed:`, err.message);
      return [];
    }
  }

  /**
   * 为写作引擎检索相关记忆和设定。
   * 返回按相似度排序的结果，可过滤 sourceType。
   */
  async searchForWriter(
    projectId: string,
    query: string,
    sourceTypes?: EmbeddingSourceType[],
    limit = 10
  ): Promise<VectorSearchResult[]> {
    try {
      const [queryEmbedding] = await this.vectorService.generateEmbeddings([query]);

      if (sourceTypes && sourceTypes.length > 0) {
        // 分类型查询后合并排序
        const allResults: VectorSearchResult[] = [];
        for (const st of sourceTypes) {
          const results = await this.vectorService.similaritySearch({
            projectId,
            queryEmbedding,
            sourceType: st,
            similarityThreshold: 0.6,
            limit: Math.ceil(limit / sourceTypes.length),
          });
          allResults.push(...results);
        }
        return allResults
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);
      }

      return await this.vectorService.similaritySearch({
        projectId,
        queryEmbedding,
        similarityThreshold: 0.6,
        limit,
      });
    } catch (err: any) {
      console.error(`[EmbeddingPipeline] Writer search failed:`, err.message);
      return [];
    }
  }

  /**
   * 语义去重：检查新文本是否与已有嵌入重复或高度相似。
   * 用于 memory-extractor 的去重。
   */
  async checkDuplicate(
    projectId: string,
    text: string,
    sourceType?: EmbeddingSourceType,
    threshold = 0.92
  ): Promise<{ isDuplicate: boolean; similar: VectorSearchResult[] }> {
    try {
      const [queryEmbedding] = await this.vectorService.generateEmbeddings([text]);
      const results = await this.vectorService.similaritySearch({
        projectId,
        queryEmbedding,
        sourceType,
        similarityThreshold: threshold,
        limit: 3,
      });
      return { isDuplicate: results.length > 0, similar: results };
    } catch (err: any) {
      console.error(`[EmbeddingPipeline] Duplicate check failed:`, err.message);
      return { isDuplicate: false, similar: [] };
    }
  }
}
