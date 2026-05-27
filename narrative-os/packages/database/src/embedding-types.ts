/**
 * 向量嵌入表 — TypeScript 类型定义
 *
 * 对应数据库表: embeddings (按 project_id 分区)
 * 向量维度: 1536 (OpenAI text-embedding-3-small)
 *
 * 设计文档第 4.3.9 节完整 DDL 参考
 */

/** 嵌入来源类型枚举 */
export type EmbeddingSourceType =
  | "chapter_chunk"       // 章节文本分块
  | "setting_item"        // 世界观设定条目
  | "character_profile"   // 角色档案
  | "event_summary"       // 事件摘要
  | "foreshadowing_item"  // 伏笔条目
  | "memory_event";       // 记忆提取事件

/** 嵌入行（数据库返回的完整行） */
export interface EmbeddingRow {
  embeddingId: string;
  projectId: string;
  sourceType: EmbeddingSourceType;
  sourceId: string;
  chunkIndex: number;
  chunkText: string;
  chunkLength: number;
  /** 1536 维 float 数组 */
  embedding: number[];
  metaJsonb: Record<string, unknown>;
  createdAt: Date;
}

/** 插入嵌入的参数 */
export interface InsertEmbedding {
  projectId: string;
  sourceType: EmbeddingSourceType;
  sourceId: string;
  chunkIndex?: number;
  chunkText: string;
  chunkLength: number;
  embedding: number[];
  metaJsonb?: Record<string, unknown>;
}

/** 向量相似度检索参数 */
export interface VectorSearchParams {
  projectId: string;
  /** 查询向量（1536维） */
  queryEmbedding: number[];
  /** 按来源类型过滤（可选） */
  sourceType?: EmbeddingSourceType;
  /** 相似度阈值（0-1），默认 0.65 */
  similarityThreshold?: number;
  /** 返回条数上限，默认 10 */
  limit?: number;
}

/** 向量相似度检索结果 */
export interface VectorSearchResult {
  embeddingId: string;
  chunkText: string;
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  metaJsonb: Record<string, unknown>;
  /** 余弦相似度 (0-1) */
  similarity: number;
}

/** 文本分块参数 */
export interface ChunkParams {
  /** 每块最大字符数，默认 500 */
  maxChunkSize?: number;
  /** 块之间的重叠字符数，默认 50 */
  overlapSize?: number;
  /** 是否优先按段落边界切分，默认 true */
  preferParagraphBoundary?: boolean;
}

/** 文本分块结果 */
export interface TextChunk {
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
}
