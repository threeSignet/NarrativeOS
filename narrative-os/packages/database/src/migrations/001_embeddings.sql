-- ============================================================================
-- 向量嵌入表 — 语义检索基础设施
-- PostgreSQL 16 + pgvector 0.7
-- 设计文档第 4.3.9 节
-- ============================================================================

-- 1. 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 嵌入来源类型枚举
DO $$ BEGIN
  CREATE TYPE embedding_source_type AS ENUM (
    'chapter_chunk',     -- 章节文本分块
    'setting_item',      -- 世界观设定条目
    'character_profile', -- 角色档案
    'event_summary',     -- 事件摘要
    'foreshadowing_item',-- 伏笔条目
    'memory_event'       -- 记忆提取事件
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. 主表：embeddings
CREATE TABLE IF NOT EXISTS embeddings (
    embedding_id    UUID DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL,

    -- 来源元数据
    source_type     embedding_source_type NOT NULL,
    source_id       UUID NOT NULL,              -- 对应 source_type 的具体表记录 ID
    chunk_index     INTEGER DEFAULT 0,          -- 同一来源的多个分块序号

    -- 文本块
    chunk_text      TEXT NOT NULL,              -- 原始文本（冗余存储避免 JOIN）
    chunk_length    INTEGER NOT NULL DEFAULT 0, -- 文本字符数

    -- 向量嵌入（BAAI/bge-m3 via SiliconFlow: 1024维）
    embedding       vector(1024),

    -- 过滤元数据
    meta_jsonb      JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 时间戳
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 约束
    PRIMARY KEY (embedding_id, project_id),
    CONSTRAINT chk_embeddings_chunk_length_positive CHECK (chunk_length >= 0),
    CONSTRAINT chk_embeddings_chunk_non_empty CHECK (LENGTH(chunk_text) > 0)
) PARTITION BY LIST (project_id);

-- 4. 默认分区（没有独立分区的项目数据落在这里）
CREATE TABLE IF NOT EXISTS embeddings_default PARTITION OF embeddings DEFAULT;

-- 5. 基础索引
CREATE INDEX IF NOT EXISTS idx_embeddings_source
    ON embeddings_default (project_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_embeddings_project_chunk
    ON embeddings_default (project_id, chunk_index);

-- 6. 项目专用分区创建函数
CREATE OR REPLACE FUNCTION create_embeddings_partition(target_project_id UUID)
RETURNS TEXT AS $$
DECLARE
    partition_name TEXT;
    partition_sql TEXT;
BEGIN
    partition_name := 'embeddings_p_' || REPLACE(target_project_id::TEXT, '-', '_');

    -- 检查分区是否已存在
    IF EXISTS (
        SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
        RETURN 'Partition ' || partition_name || ' already exists';
    END IF;

    partition_sql := FORMAT(
        'CREATE TABLE %I PARTITION OF embeddings FOR VALUES IN (%L)',
        partition_name, target_project_id
    );
    EXECUTE partition_sql;

    -- 在新分区上创建索引
    EXECUTE FORMAT('CREATE INDEX IF NOT EXISTS %I ON %I (project_id, source_type, source_id)',
        'idx_' || partition_name || '_source', partition_name);

    RETURN 'Created partition: ' || partition_name;
END;
$$ LANGUAGE plpgsql;

-- 7. HNSW 向量索引（需要先有数据再建索引才能达到最佳效果）
-- 在建索引前需要收集足够的向量数据（建议 1000+ 条）
-- 索引参数说明：
--   m=16: 每个节点的最大连接数（HNSW 图结构）
--   ef_construction=200: 索引构建时的搜索范围（越大越精确但构建越慢）
-- CREATE INDEX idx_embeddings_embedding_hnsw ON embeddings_default
--     USING hnsw (embedding vector_cosine_ops)
--     WITH (m = 16, ef_construction = 200);

-- 8. IVFFlat 向量索引（备选方案，适用于更稳定的数据集）
-- 注意：IVFFlat 需要先有足够数据（建议 1000+ 条）且需要定期重建
-- CREATE INDEX idx_embeddings_embedding_ivfflat ON embeddings_default
--     USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 100);

-- 9. 向量相似度检索函数
CREATE OR REPLACE FUNCTION search_similar_embeddings(
    query_project_id UUID,
    query_embedding vector(1024),
    query_source_type embedding_source_type DEFAULT NULL,
    similarity_threshold REAL DEFAULT 0.65,
    result_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    embedding_id UUID,
    chunk_text TEXT,
    source_type TEXT,
    source_id UUID,
    chunk_index INTEGER,
    meta_jsonb JSONB,
    similarity REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.embedding_id,
        e.chunk_text,
        e.source_type::TEXT,
        e.source_id,
        e.chunk_index,
        e.meta_jsonb,
        (1 - (e.embedding <=> query_embedding))::REAL AS similarity
    FROM embeddings e
    WHERE e.project_id = query_project_id
        AND (query_source_type IS NULL OR e.source_type = query_source_type)
        AND (1 - (e.embedding <=> query_embedding)) > similarity_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 10. 注释
COMMENT ON TABLE embeddings IS '向量嵌入表：按 project_id 分区的 1024 维向量存储，用于语义相似度检索。';
COMMENT ON COLUMN embeddings.embedding IS 'BAAI/bge-m3 模型生成的 1024 维向量。';
COMMENT ON COLUMN embeddings.source_type IS '嵌入来源类型，用于检索时的上下文类型过滤。';
COMMENT ON COLUMN embeddings.chunk_text IS '原始文本块内容（冗余存储以减少 JOIN，提升检索速度）。';
COMMENT ON COLUMN embeddings.meta_jsonb IS '可扩展的过滤元数据：如章节号、角色ID、段落位置等。';
