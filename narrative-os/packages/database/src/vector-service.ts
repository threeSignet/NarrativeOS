/**
 * VectorService — 向量嵌入服务
 *
 * 提供文本分块、向量生成、存储、语义相似度检索的完整能力。
 * 使用 OpenAI text-embedding-3-small 模型（1536 维）。
 *
 * 设计文档第 2.5.3.13 节 VectorSearchService 的实现。
 *
 * 使用方式：
 *   const vs = new VectorService(db, openaiClient);
 *   const chunks = vs.chunkText(longText);
 *   const embeddings = await vs.generateEmbeddings(chunks);
 *   await vs.storeEmbeddings(projectId, sourceType, sourceId, chunks, embeddings);
 *   const results = await vs.similaritySearch({ projectId, queryEmbedding });
 */

import type { EmbeddingSourceType, InsertEmbedding, TextChunk, ChunkParams, VectorSearchParams, VectorSearchResult } from "./embedding-types";

/** 嵌入模型常量 */
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

/**
 * 文本分块：将长文本按语义边界拆分为适合嵌入的短块。
 *
 * 策略：
 * 1. 优先按段落边界（\n\n）切分
 * 2. 如果单个段落超过 maxChunkSize，按句子边界（。！？）切分
 * 3. 块之间保留 overlapSize 的重叠，确保上下文连贯
 */
export function chunkText(
  text: string,
  params: ChunkParams = {}
): TextChunk[] {
  const {
    maxChunkSize = 500,
    overlapSize = 50,
    preferParagraphBoundary = true,
  } = params;

  if (!text || text.trim().length === 0) return [];

  const chunks: TextChunk[] = [];

  // 第一步：按段落切分
  const paragraphs = preferParagraphBoundary
    ? text.split(/\n\n+/).filter((p) => p.trim().length > 0)
    : [text];

  let globalIndex = 0;
  let charOffset = 0;

  for (const para of paragraphs) {
    if (para.length <= maxChunkSize) {
      // 段落适合作为单个分块
      chunks.push({
        index: globalIndex++,
        text: para.trim(),
        charStart: charOffset,
        charEnd: charOffset + para.length,
      });
      charOffset += para.length + (preferParagraphBoundary ? 2 : 0); // 加回段落分隔符
    } else {
      // 段落太长，按句子边界切分
      const sentences = para.split(/(?<=[。！？；\n])(?=\s*)/);
      let currentChunk = "";
      let chunkCharStart = charOffset;

      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
          chunks.push({
            index: globalIndex++,
            text: currentChunk.trim(),
            charStart: chunkCharStart,
            charEnd: chunkCharStart + currentChunk.length,
          });

          // 重叠：保留当前块的末尾部分作为下一块的起始上下文
          const overlapText = overlapSize > 0
            ? currentChunk.slice(-overlapSize)
            : "";
          currentChunk = overlapText + sentence;
          chunkCharStart = chunkCharStart + currentChunk.length - sentence.length;
        } else {
          currentChunk += sentence;
        }
      }

      // 最后一块
      if (currentChunk.trim().length > 0) {
        chunks.push({
          index: globalIndex++,
          text: currentChunk.trim(),
          charStart: chunkCharStart,
          charEnd: chunkCharStart + currentChunk.length,
        });
      }

      charOffset += para.length + (preferParagraphBoundary ? 2 : 0);
    }
  }

  return chunks;
}

/**
 * 向量服务接口 — 解耦具体的 LLM 客户端实现。
 * 使用者需要提供一个 embedMany 实现（调用 OpenAI / 其他嵌入 API）。
 */
export interface EmbeddingProvider {
  /**
   * 批量生成嵌入向量。
   * @param texts 待嵌入的文本数组
   * @returns 等长的向量数组（每个向量 1536 维）
   */
  embedMany(texts: string[]): Promise<number[][]>;
}

/**
 * 向量服务类。
 *
 * 注意：数据库操作（INSERT / SELECT）通过 raw SQL 执行，
 * 因为 Drizzle ORM 不原生支持 pgvector 类型。
 * db 参数接受任意支持 `sql` 模板标签的执行器。
 */
export class VectorService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any; // Drizzle 数据库实例（任意类型，支持 sql`` 模板）
  private embedder: EmbeddingProvider;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(db: any, embedder: EmbeddingProvider) {
    this.db = db;
    this.embedder = embedder;
  }

  /** 嵌入模型信息 */
  getModelInfo() {
    return { model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS };
  }

  /**
   * 为项目创建专用分区（首次使用时调用）。
   */
  async ensurePartition(projectId: string): Promise<void> {
    await this.db.execute(
      `SELECT create_embeddings_partition('${projectId}')`
    );
  }

  /**
   * 批量生成嵌入向量。
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return this.embedder.embedMany(texts);
  }

  /**
   * 批量存储嵌入向量。
   */
  async storeEmbeddings(
    projectId: string,
    sourceType: EmbeddingSourceType,
    sourceId: string,
    chunks: TextChunk[],
    embeddings: number[][],
    meta?: Record<string, unknown>
  ): Promise<string[]> {
    if (chunks.length !== embeddings.length) {
      throw new Error(
        `chunks.length (${chunks.length}) must match embeddings.length (${embeddings.length})`
      );
    }

    // 确保分区存在
    await this.ensurePartition(projectId);

    const ids: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const emb = embeddings[i];
      // 将 float 数组格式化为 pgvector 可接受的字符串
      const vectorStr = `[${emb.join(",")}]`;
      const metaJson = JSON.stringify({
        ...meta,
        chunk_index: chunks[i].index,
        char_start: chunks[i].charStart,
        char_end: chunks[i].charEnd,
      });

      const result = await this.db.execute(
        `INSERT INTO embeddings (project_id, source_type, source_id, chunk_index, chunk_text, chunk_length, embedding, meta_jsonb)
         VALUES ('${projectId}', '${sourceType}', '${sourceId}', ${chunks[i].index}, '${this.escapeSql(chunks[i].text)}', ${chunks[i].text.length}, '${vectorStr}', '${metaJson}')
         RETURNING embedding_id`
      );

      if (result?.rows?.[0]?.embedding_id) {
        ids.push(result.rows[0].embedding_id);
      }
    }

    return ids;
  }

  /**
   * 语义相似度检索。
   * 使用余弦距离（<=>）算子，索引友好（支持 HNSW/IVFFlat）。
   */
  async similaritySearch(params: VectorSearchParams): Promise<VectorSearchResult[]> {
    const {
      projectId,
      queryEmbedding,
      sourceType,
      similarityThreshold = 0.65,
      limit = 10,
    } = params;

    const vectorStr = `[${queryEmbedding.join(",")}]`;
    const sourceFilter = sourceType
      ? `AND source_type = '${sourceType}'`
      : "";

    const result = await this.db.execute(
      `SELECT
         embedding_id,
         chunk_text,
         source_type::TEXT,
         source_id,
         chunk_index,
         meta_jsonb,
         (1 - (embedding <=> '${vectorStr}'))::REAL AS similarity
       FROM embeddings
       WHERE project_id = '${projectId}'
         ${sourceFilter}
         AND (1 - (embedding <=> '${vectorStr}')) > ${similarityThreshold}
       ORDER BY embedding <=> '${vectorStr}'
       LIMIT ${limit}`
    );

    return (result?.rows || []).map((row: Record<string, unknown>) => ({
      embeddingId: row.embedding_id as string,
      chunkText: row.chunk_text as string,
      sourceType: row.source_type as string,
      sourceId: row.source_id as string,
      chunkIndex: (row.chunk_index as number) || 0,
      metaJsonb: (row.meta_jsonb as Record<string, unknown>) || {},
      similarity: row.similarity as number,
    }));
  }

  /**
   * 删除指定来源的所有嵌入（用于重新向量化时清理旧数据）。
   */
  async deleteBySource(sourceId: string): Promise<number> {
    const result = await this.db.execute(
      `DELETE FROM embeddings WHERE source_id = '${sourceId}'`
    );
    return result?.rowCount || 0;
  }

  /**
   * 获取项目的嵌入统计信息。
   */
  async getStats(projectId: string): Promise<{
    totalChunks: number;
    totalCharacters: number;
    bySourceType: Record<string, number>;
  }> {
    const result = await this.db.execute(
      `SELECT
         COUNT(*) as total_chunks,
         COALESCE(SUM(chunk_length), 0) as total_chars,
         source_type,
         COUNT(*) as cnt
       FROM embeddings
       WHERE project_id = '${projectId}'
       GROUP BY source_type`
    );

    const bySourceType: Record<string, number> = {};
    let totalChunks = 0;
    let totalCharacters = 0;

    for (const row of result?.rows || []) {
      const st = row.source_type as string;
      const cnt = Number(row.cnt) || 0;
      bySourceType[st] = cnt;
      totalChunks += cnt;
      totalCharacters += Number(row.total_chars) || 0;
    }

    return { totalChunks, totalCharacters, bySourceType };
  }

  /** SQL 字符串转义（防止注入） */
  private escapeSql(str: string): string {
    return str
      .replace(/'/g, "''")
      .replace(/\\/g, "\\\\");
  }
}
