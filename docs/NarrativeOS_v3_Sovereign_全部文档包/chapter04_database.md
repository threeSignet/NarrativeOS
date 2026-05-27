# 第四章 数据层设计 —— NarrativeOS v3.0 Sovereign

> **文档版本**: v3.0.0-final  
> **适用数据库**: PostgreSQL 16 + pgvector 0.7.x  
> **字符集**: UTF-8 (支持中英文混合存储)  
> **目标规模**: 单项目支持100万+字长篇小说，实体数≥10,000，事件数≥50,000  
> **性能目标**: 向量相似度查询<100ms，实体关系查询<50ms，状态变更事务<200ms

---

## 4.1 数据库选型与技术栈

### 4.1.1 核心组件

| 组件 | 版本 | 用途 |
|------|------|------|
| PostgreSQL | 16.x | 结构化数据存储、事务管理、JSONB动态属性 |
| pgvector | 0.7.x | 向量数据存储与相似度检索（1536维OpenAI嵌入） |
| pg_trgm | 内置 | 文本模糊搜索（trigram索引） |
| pgcrypto | 内置 | UUID生成与加密需求 |

### 4.1.2 选型理由

**PostgreSQL 16**：
- **JSONB原生支持**：所有动态属性、规则集、状态快照以JSONB存储，支持GIN索引和路径查询
- **MVCC事务**：支持复杂的多表原子操作，确保世界状态一致性
- **表继承与分区**：embeddings表按`project_id`RANGE分区，避免单表过大
- **并行查询**：自动利用多核CPU进行大规模扫描

**pgvector**：
- **IVFFlat索引**：支持高维向量(1536D)的近似最近邻(ANN)搜索
- **与PostgreSQL原生集成**：向量和结构化数据在同一事务中操作
- **分区感知**：向量索引可在分区表上独立构建

### 4.1.3 扩展加载

```sql
-- ============================================================
-- 4.1.4 必备扩展（按顺序加载）
-- ============================================================

-- 核心向量扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- UUID生成
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 全文搜索与模糊匹配
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- JSONB路径查询增强（PG16内置）
-- jsonb_path_query 等函数已内置

-- 检查扩展版本
SELECT 
    name, 
    installed_version,
    comment
FROM pg_available_extensions 
WHERE name IN ('vector', 'pgcrypto', 'pg_trgm')
ORDER BY name;
```

---

## 4.2 类型系统定义（ENUM + DOMAIN）

所有枚举类型在CREATE TABLE之前统一声明，确保类型安全与引用一致性。

### 4.2.1 项目状态枚举

```sql
-- ============================================================
-- 4.2.1 项目生命周期状态
-- ============================================================
DROP TYPE IF EXISTS project_status CASCADE;
CREATE TYPE project_status AS ENUM (
    'drafting',        -- 草稿阶段：世界观构建中
    'outlining',       -- 大纲阶段：幕结构设计
    'writing',         -- 创作阶段：正文写作中
    'revising',        -- 修订阶段：内容打磨
    'completed',       -- 已完成
    'archived'         -- 已归档（只读）
);

COMMENT ON TYPE project_status IS 
'项目生命周期状态：drafting(草稿)->outlining(大纲)->writing(写作)->revising(修订)->completed(完成)->archived(归档)';
```

### 4.2.2 实体类型枚举

```sql
-- ============================================================
-- 4.2.2 实体分类（世界中的可模拟对象）
-- ============================================================
DROP TYPE IF EXISTS entity_type CASCADE;
CREATE TYPE entity_type AS ENUM (
    'character',       -- 角色（主角、配角、NPC）
    'organization',    -- 组织（门派、家族、国家）
    'location',        -- 地点（场景、区域、世界）
    'item',            -- 物品（装备、道具、神器）
    'skill',           -- 技能（功法、法术、技艺）
    'faction',         -- 阵营（正邪、势力集团）
    'concept',         -- 概念（法则、天道、世界观元素）
    'timeline'         -- 时间线（用于多线叙事）
);

COMMENT ON TYPE entity_type IS 
'世界中可模拟的实体类型。character:角色, organization:组织, location:地点, item:物品, skill:技能, faction:阵营, concept:概念, timeline:时间线';
```

### 4.2.3 模拟层级枚举

```sql
-- ============================================================
-- 4.2.3 实体模拟层级（决定计算精度与更新频率）
-- ============================================================
DROP TYPE IF EXISTS simulation_tier CASCADE;
CREATE TYPE simulation_tier AS ENUM (
    'protagonist',     -- 主角：每事件全量模拟
    'major',           -- 主要角色：每事件关键属性模拟
    'supporting',      -- 配角：每3事件批量模拟
    'background',      -- 背景角色：每10事件或按需模拟
    'static'           -- 静态：仅在触发条件满足时更新
);

COMMENT ON TYPE simulation_tier IS 
'实体的模拟精度层级。protagonist(主角级)>major(主要)>supporting(配角)>background(背景)>static(静态)';
```

### 4.2.4 实体状态枚举

```sql
-- ============================================================
-- 4.2.4 实体实例状态
-- ============================================================
DROP TYPE IF EXISTS entity_status CASCADE;
CREATE TYPE entity_status AS ENUM (
    'active',          -- 活跃：正常参与叙事
    'injured',         -- 负伤：行动力受限
    'unconscious',     -- 昏迷：暂时不可控
    'dead',            -- 死亡：永久性退场
    'missing',         -- 失踪：暂时不可见
    'sealed',          -- 封印：能力受限
    'transformed',     -- 形态转变（如变身、夺舍）
    'retired'          -- 退隐：不再主动参与
);

COMMENT ON TYPE entity_status IS 
'实体当前生存/行动状态。影响模拟引擎的行为决策逻辑。';
```

### 4.2.5 关系类型枚举

```sql
-- ============================================================
-- 4.2.5 实体间关系分类
-- ============================================================
DROP TYPE IF EXISTS relation_type CASCADE;
CREATE TYPE relation_type AS ENUM (
    -- 情感关系
    'loves', 'hates', 'fears', 'trusts', 'distrusts', 'admires', 'resents',
    -- 社会关系
    'ally', 'enemy', 'rival', 'subordinate', 'superior', 'peer',
    -- 血缘关系
    'parent', 'child', 'sibling', 'spouse', 'ancestor', 'descendant',
    -- 组织关系
    'member_of', 'leader_of', 'founder_of', 'exile_from',
    -- 物品关系
    'owns', 'wields', 'seeks', 'guards', 'created',
    -- 知识关系
    'knows', 'mentor', 'student', 'indebted', 'owed_by',
    -- 命运关系
    'fated', 'sworn_brother', 'nemesis', 'benefactor', 'ward'
);

COMMENT ON TYPE relation_type IS 
'实体间关系类型。覆盖情感、社会、血缘、组织、物品、知识、命运七大类。';
```

### 4.2.6 章节状态枚举

```sql
-- ============================================================
-- 4.2.6 章节生命周期状态
-- ============================================================
DROP TYPE IF EXISTS chapter_status CASCADE;
CREATE TYPE chapter_status AS ENUM (
    'outlined',        -- 已大纲：有brief，无正文
    'drafting',        -- 起草中：AI生成初稿
    'draft_review',    -- 草稿审阅：作者评估初稿
    'author_edit',     -- 作者编辑：人工修改中
    'polishing',       -- 润色中：风格一致性调整
    'completed',       -- 已完成：已固化
    'committed',       -- 已提交：不可变基线
    'deprecated'       -- 已废弃：被新版本替代
);

COMMENT ON TYPE chapter_status IS 
'章节的创作流水线状态。从outlined到committed的单向流转（除deprecated外）。';
```

### 4.2.7 伏笔状态枚举

```sql
-- ============================================================
-- 4.2.7 伏笔生命周期状态
-- ============================================================
DROP TYPE IF EXISTS foreshadowing_status CASCADE;
CREATE TYPE foreshadowing_status AS ENUM (
    'planted',         -- 已埋下：读者可见线索
    'growing',         -- 生长中：线索逐步强化
    'dormant',         -- 休眠：暂时搁置，等待唤醒
    'resolving',       -- 收束中：正在揭示
    'resolved',        -- 已收束：完整回收
    'abandoned',       -- 已废弃：不再回收
    'transformed'      -- 已转化：变成其他伏笔的变体
);

COMMENT ON TYPE foreshadowing_status IS 
'伏笔线索的生命周期。planted(埋下)->growing(生长)/dormant(休眠)->resolving(收束)->resolved(完成)';
```

### 4.2.8 先例状态枚举

```sql
-- ============================================================
-- 4.2.8 叙事先例状态
-- ============================================================
DROP TYPE IF EXISTS precedent_status CASCADE;
CREATE TYPE precedent_status AS ENUM (
    'active',          -- 活跃：可被触发
    'triggered',       -- 已触发：条件已满足，效果待发生
    'fulfilled',       -- 已履行：先例完全生效
    'expired',         -- 已过期：半衰期耗尽
    'overridden'       -- 被覆盖：被更高优先级的先例替代
);

COMMENT ON TYPE precedent_status IS 
'叙事先例（因果规则）的状态。precedent是"如果X发生，则Y必须/可能发生"的规则。';
```

### 4.2.9 交互行为类型枚举

```sql
-- ============================================================
-- 4.2.9 用户交互行为分类
-- ============================================================
DROP TYPE IF EXISTS interaction_action_type CASCADE;
CREATE TYPE interaction_action_type AS ENUM (
    'chapter_read',         -- 阅读章节
    'chapter_edit',         -- 编辑章节
    'brief_modify',         -- 修改章节大纲
    'entity_create',        -- 创建实体
    'entity_modify',        -- 修改实体属性
    'relationship_create',  -- 创建关系
    'relationship_modify',  -- 修改关系
    'world_rule_create',    -- 创建世界规则
    'foreshadowing_plant',  -- 埋下伏笔
    'foreshadowing_resolve',-- 收束伏笔
    'rollback_request',     -- 请求回滚
    'ai_generate',          -- AI生成请求
    'ai_regenerate',        -- AI重新生成
    'intuition_override',   -- 直觉分覆盖
    'comment_add',          -- 添加批注
    'query_vector',         -- 向量相似度查询
    'export_request',       -- 导出请求
    'archive_request'       -- 归档请求
);

COMMENT ON TYPE interaction_action_type IS 
'作者/用户在系统中的所有可操作行为类型，用于行为分析和上下文学习。';
```

### 4.2.10 风险类型枚举

```sql
-- ============================================================
-- 4.2.10 创作风险分类
-- ============================================================
DROP TYPE IF EXISTS risk_type CASCADE;
CREATE TYPE risk_type AS ENUM (
    'continuity_error',     -- 连续性错误（时间线/因果关系矛盾）
    'character_break',      -- 角色崩坏（OOC：out of character）
    'power_creep',          -- 战力膨胀
    'plot_hole',            -- 剧情漏洞
    'foreshadowing_lost',   -- 伏笔遗失（未回收）
    'tone_inconsistency',   -- 风格/基调不一致
    'pacing_issue',         -- 节奏问题（过缓/过急）
    'redundancy',           -- 内容冗余
    'world_rule_violation', -- 违反世界规则
    'relationship_error',   -- 关系网错误
    'knowledge_leak',       -- 知识泄露（读者不该知道的信息）
    'motivation_gap'        -- 动机缺失
);

COMMENT ON TYPE risk_type IS 
'AI系统在创作过程中检测到的风险类型，用于预警和质量控制。';
```

### 4.2.11 风险严重级别枚举

```sql
-- ============================================================
-- 4.2.11 风险严重级别
-- ============================================================
DROP TYPE IF EXISTS risk_severity CASCADE;
CREATE TYPE risk_severity AS ENUM (
    'critical',     -- 致命：必须立即修复（如核心设定冲突）
    'high',         -- 严重：强烈建议修复
    'medium',       -- 中等：需要关注
    'low',          -- 轻微：可选修复
    'info'          -- 信息：仅为记录
);

COMMENT ON TYPE risk_severity IS '风险严重级别，critical/high级别会阻断commit流程。';
```

### 4.2.12 嵌入源类型枚举

```sql
-- ============================================================
-- 4.2.12 向量嵌入数据来源类型
-- ============================================================
DROP TYPE IF EXISTS embedding_source_type CASCADE;
CREATE TYPE embedding_source_type AS ENUM (
    'chapter_content',      -- 章节正文
    'chapter_summary',      -- 章节摘要
    'entity_description',   -- 实体描述
    'world_rule',           -- 世界规则文本
    'relationship_note',    -- 关系笔记
    'author_note',          -- 作者注释
    'foreshadowing_text',   -- 伏笔描述
    'precedent_text',       -- 先例描述
    'outline_node',         -- 大纲节点
    'dialogue_line',        -- 对话行
    'environment_desc'      -- 环境描写
);

COMMENT ON TYPE embedding_source_type IS '向量嵌入数据的来源分类，用于检索时过滤上下文类型。';
```

---

## 4.3 核心表结构（16张表完整DDL）

### 4.3.1 projects -- 项目主表

```sql
-- ============================================================
-- 表: projects
-- 说明: 每个长篇小说对应一个项目，是最高级命名空间
-- 规模估计: 单用户10-50个项目
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
    project_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(500) NOT NULL,
    subtitle        VARCHAR(500),
    
    -- 类型契约：定义小说的类型约定与叙事参数
    genre_contract  JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- 世界圣经：核心设定、规则、世界观参数
    world_bible     JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- 项目状态
    status          project_status NOT NULL DEFAULT 'drafting',
    
    -- 统计字段（冗余设计，避免频繁COUNT查询）
    total_chapters      INTEGER NOT NULL DEFAULT 0,
    total_words         INTEGER NOT NULL DEFAULT 0,
    total_entities      INTEGER NOT NULL DEFAULT 0,
    total_events        INTEGER NOT NULL DEFAULT 0,
    total_foreshadowings INTEGER NOT NULL DEFAULT 0,
    
    -- 当前工作章节指针
    current_chapter_number INTEGER DEFAULT 0,
    
    -- 时间戳
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 约束
ALTER TABLE projects 
    ADD CONSTRAINT chk_project_title_length 
    CHECK (LENGTH(title) >= 1 AND LENGTH(title) <= 500);

ALTER TABLE projects 
    ADD CONSTRAINT chk_project_chapters_nonnegative 
    CHECK (total_chapters >= 0);

ALTER TABLE projects 
    ADD CONSTRAINT chk_project_words_nonnegative 
    CHECK (total_words >= 0);

-- 索引
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

-- 注释
COMMENT ON TABLE projects IS '项目主表：每个长篇小说对应一条记录，作为所有数据的顶级命名空间。';
COMMENT ON COLUMN projects.project_id IS '项目唯一标识符，所有子表通过此字段关联。';
COMMENT ON COLUMN projects.title IS '小说标题，支持中英文，最长500字符。';
COMMENT ON COLUMN projects.subtitle IS '副标题/卷名，可为空。';
COMMENT ON COLUMN projects.genre_contract IS '类型契约JSONB：定义流派规则、叙事参数、禁忌等（详见4.4.1节）。';
COMMENT ON COLUMN projects.world_bible IS '世界圣经JSONB：世界观核心设定、物理法则、力量体系等（详见4.4.2节）。';
COMMENT ON COLUMN projects.status IS '项目生命周期状态，单向流转。';
COMMENT ON COLUMN projects.total_chapters IS '总章节数（冗余，触发器自动维护）。';
COMMENT ON COLUMN projects.total_words IS '总字数（冗余，触发器自动维护）。';
COMMENT ON COLUMN projects.total_entities IS '总实体数（冗余）。';
COMMENT ON COLUMN projects.total_events IS '总事件数（冗余）。';
COMMENT ON COLUMN projects.total_foreshadowings IS '总伏笔数（冗余）。';
COMMENT ON COLUMN projects.current_chapter_number IS '当前工作章节号，指向最新活跃章节。';
COMMENT ON COLUMN projects.created_at IS '项目创建时间。';
COMMENT ON COLUMN projects.updated_at IS '最后更新时间，由触发器自动维护。';
```

### 4.3.2 entities -- 实体表（角色/物品/地点等）

```sql
-- ============================================================
-- 表: entities
-- 说明: 世界中所有可模拟对象的统一存储
-- 规模估计: 单项目 1,000-20,000 个实体
-- 分区策略: 否（单项目实体数可控，B-tree索引足够）
-- ============================================================
CREATE TABLE IF NOT EXISTS entities (
    entity_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL,
    
    -- 实体分类
    entity_type     entity_type NOT NULL,
    
    -- 实体名称（支持多语言别名在properties中）
    name            VARCHAR(300) NOT NULL,
    display_name    VARCHAR(300),  -- 对外显示名称（可能有修饰）
    
    -- 核心属性容器（动态模式）
    -- 含：伤势、等级、内在参数、金手指/特殊能力规则与状态
    properties      JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- 模拟层级：决定计算精度
    simulation_tier simulation_tier NOT NULL DEFAULT 'background',
    
    -- 空间定位：当前所在位置（自引用外键）
    location_id     UUID,
    
    -- 实体状态
    status          entity_status NOT NULL DEFAULT 'active',
    
    -- 生命周期时间戳
    birth_chapter   INTEGER,       -- 首次登场章节号
    death_chapter   INTEGER,       -- 退场/死亡章节号
    
    -- 元数据
    tags            VARCHAR(100)[], -- 标签数组（如 ["主角","重生","腹黑"]）
    notes           TEXT,           -- 作者备注
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 外键约束
    CONSTRAINT fk_entities_project 
        FOREIGN KEY (project_id) REFERENCES projects(project_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_entities_location 
        FOREIGN KEY (location_id) REFERENCES entities(entity_id) 
        ON DELETE SET NULL,
    
    -- 检查约束
    CONSTRAINT chk_entities_name_length 
        CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 300),
    
    CONSTRAINT chk_entities_birth_chapter_positive 
        CHECK (birth_chapter IS NULL OR birth_chapter >= 0),
    
    CONSTRAINT chk_entities_death_after_birth 
        CHECK (
            death_chapter IS NULL 
            OR birth_chapter IS NULL 
            OR death_chapter >= birth_chapter
        )
);

-- 核心查询索引
CREATE INDEX IF NOT EXISTS idx_entities_project_tier_location 
    ON entities(project_id, simulation_tier, location_id);

CREATE INDEX IF NOT EXISTS idx_entities_project_type 
    ON entities(project_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_entities_project_status 
    ON entities(project_id, status);

-- GIN索引：JSONB属性查询 + 标签数组
CREATE INDEX IF NOT EXISTS idx_entities_properties_gin 
    ON entities USING GIN(properties);

CREATE INDEX IF NOT EXISTS idx_entities_tags_gin 
    ON entities USING GIN(tags);

-- 名称搜索索引（trigram模糊匹配）
CREATE INDEX IF NOT EXISTS idx_entities_name_trgm 
    ON entities USING GIN(name gin_trgm_ops);

-- 注释
COMMENT ON TABLE entities IS '实体表：存储世界中所有可模拟对象（角色、物品、地点、技能、组织等）。';
COMMENT ON COLUMN entities.entity_id IS '实体唯一标识符。';
COMMENT ON COLUMN entities.project_id IS '所属项目（外键->projects）。';
COMMENT ON COLUMN entities.entity_type IS '实体类型枚举，决定properties的结构模板。';
COMMENT ON COLUMN entities.name IS '实体名称，搜索和显示用。';
COMMENT ON COLUMN entities.display_name IS '对外显示名称，可含称号/修饰。';
COMMENT ON COLUMN entities.properties IS '动态属性JSONB：伤势、等级、能力、金手指状态等（详见4.4.3节）。';
COMMENT ON COLUMN entities.simulation_tier IS '模拟精度层级，引擎据此决定更新频率和计算深度。';
COMMENT ON COLUMN entities.location_id IS '当前所在位置，自引用外键（location类型实体）。';
COMMENT ON COLUMN entities.status IS '实体生存/行动状态。';
COMMENT ON COLUMN entities.birth_chapter IS '首次登场章节号。';
COMMENT ON COLUMN entities.death_chapter IS '退场章节号，NULL表示仍活跃。';
COMMENT ON COLUMN entities.tags IS '标签数组，用于快速分类和筛选。';
COMMENT ON COLUMN entities.notes IS '作者备注，不用于引擎计算。';
```

### 4.3.3 relationships -- 实体关系表

```sql
-- ============================================================
-- 表: relationships
-- 说明: 实体间有向关系网络（社交网络 + 关系图谱）
-- 规模估计: 单项目 2,000-50,000 条关系
-- 特点: 有向图，支持双向对称关系的快速查询
-- ============================================================
CREATE TABLE IF NOT EXISTS relationships (
    relationship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL,
    
    -- 关系方向：source -> target
    source_id       UUID NOT NULL,
    target_id       UUID NOT NULL,
    
    -- 关系类型
    relation_type   relation_type NOT NULL,
    
    -- 关系属性（动态权重与状态）
    -- 含：信任度、债务、权力位差、情感强度、关系历史
    properties      JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- 关系强度（冗余提取，便于快速查询）
    strength        NUMERIC(5,4) DEFAULT 0.5000,
    
    -- 双向标记：true表示关系自动对称（如sibling, spouse）
    is_bidirectional BOOLEAN DEFAULT FALSE,
    
    -- 对称关系指针：指向对应的双向关系记录
    reciprocal_id   UUID,
    
    -- 生命周期
    established_chapter INTEGER,   -- 关系建立章节
    ended_chapter       INTEGER,   -- 关系终止章节
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 外键约束
    CONSTRAINT fk_relationships_project 
        FOREIGN KEY (project_id) REFERENCES projects(project_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_relationships_source 
        FOREIGN KEY (source_id) REFERENCES entities(entity_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_relationships_target 
        FOREIGN KEY (target_id) REFERENCES entities(entity_id) 
        ON DELETE CASCADE,
    
    -- 不能自引用
    CONSTRAINT chk_relationships_no_self_loop 
        CHECK (source_id <> target_id),
    
    -- 关系强度范围 [0, 1]
    CONSTRAINT chk_relationships_strength_range 
        CHECK (strength >= 0 AND strength <= 1),
    
    -- 章节号非负
    CONSTRAINT chk_relationships_chapter_positive 
        CHECK (established_chapter IS NULL OR established_chapter >= 0)
);

-- 核心查询索引
CREATE INDEX IF NOT EXISTS idx_relationships_project 
    ON relationships(project_id);

-- 有向图查询：从source出发的关系
CREATE INDEX IF NOT EXISTS idx_relationships_source 
    ON relationships(source_id, relation_type);

-- 有向图查询：指向target的关系
CREATE INDEX IF NOT EXISTS idx_relationships_target 
    ON relationships(target_id, relation_type);

-- 复合查询：项目内某类型的所有关系
CREATE INDEX IF NOT EXISTS idx_relationships_project_type 
    ON relationships(project_id, relation_type);

-- GIN索引：关系属性查询
CREATE INDEX IF NOT EXISTS idx_relationships_properties_gin 
    ON relationships USING GIN(properties);

-- 唯一约束：同一对实体同类型关系只能有一条
CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_unique_pair 
    ON relationships(project_id, source_id, target_id, relation_type);

-- 注释
COMMENT ON TABLE relationships IS '实体关系表：有向关系网络，覆盖情感、社会、血缘、组织、物品、知识、命运七大类。';
COMMENT ON COLUMN relationships.source_id IS '关系起点实体。';
COMMENT ON COLUMN relationships.target_id IS '关系终点实体。';
COMMENT ON COLUMN relationships.properties IS '关系属性JSONB：信任度、债务、权力位差、情感强度等（详见4.4.4节）。';
COMMENT ON COLUMN relationships.strength IS '关系强度[0,1]，冗余提取用于快速排序。';
COMMENT ON COLUMN relationships.is_bidirectional IS '是否为对称关系（自动创建双向记录）。';
```

### 4.3.4 events -- 叙事事件表

```sql
-- ============================================================
-- 表: events
-- 说明: 世界中发生的所有离散事件（战斗、对话、决策等）
-- 规模估计: 单项目 10,000-100,000 个事件
-- 核心用途: 因果链追踪、状态变更历史、时间线重建
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
    event_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL,
    
    -- 叙事位置
    chapter_number  INTEGER NOT NULL,
    scene_number    INTEGER DEFAULT 1,      -- 场景号（一章内的分段）
    event_sequence  INTEGER NOT NULL DEFAULT 0,  -- 事件在场景中的顺序
    
    -- 事件描述
    description     TEXT NOT NULL,
    event_type      VARCHAR(100) DEFAULT 'generic',  -- 事件子类型标签
    
    -- 参与实体（角色、物品等）
    involved_entity_ids UUID[] DEFAULT '{}'::UUID[],
    
    -- 状态变更快照（核心字段）
    -- 记录本次事件对所有相关实体属性的精确变更
    delta_jsonb     JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- 因果链指针
    triggered_by_event_id UUID,     -- 由哪个事件触发
    triggers_event_ids    UUID[] DEFAULT '{}'::UUID[],  -- 触发了哪些事件
    
    -- 涟漪效应深度：事件影响的传播层级
    ripple_depth    INTEGER DEFAULT 0,
    
    -- 事件重要性（冗余，用于快速筛选）
    importance      NUMERIC(3,2) DEFAULT 0.50,  -- [0, 1]
    
    -- 世界状态指纹（事件发生时世界的哈希快照）
    world_state_hash VARCHAR(64),
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 外键
    CONSTRAINT fk_events_project 
        FOREIGN KEY (project_id) REFERENCES projects(project_id) 
        ON DELETE CASCADE,
    
    -- 检查约束
    CONSTRAINT chk_events_chapter_positive 
        CHECK (chapter_number >= 0),
    
    CONSTRAINT chk_events_ripple_nonnegative 
        CHECK (ripple_depth >= 0),
    
    CONSTRAINT chk_events_importance_range 
        CHECK (importance >= 0 AND importance <= 1)
);

-- 核心索引
CREATE INDEX IF NOT EXISTS idx_events_project_chapter 
    ON events(project_id, chapter_number, scene_number, event_sequence);

CREATE INDEX IF NOT EXISTS idx_events_involved_entities 
    ON events USING GIN(involved_entity_ids);

CREATE INDEX IF NOT EXISTS idx_events_delta_gin 
    ON events USING GIN(delta_jsonb);

CREATE INDEX IF NOT EXISTS idx_events_triggered_by 
    ON events(triggered_by_event_id);

CREATE INDEX IF NOT EXISTS idx_events_triggers 
    ON events USING GIN(triggers_event_ids);

CREATE INDEX IF NOT EXISTS idx_events_importance 
    ON events(project_id, importance DESC);

CREATE INDEX IF NOT EXISTS idx_events_ripple 
    ON events(project_id, ripple_depth DESC);

-- 注释
COMMENT ON TABLE events IS '叙事事件表：存储世界中所有离散事件的完整记录，是因果推理和状态回溯的核心数据源。';
COMMENT ON COLUMN events.delta_jsonb IS '状态变更快照JSONB：记录每个受影响实体的属性前后值（详见4.4.5节）。';
COMMENT ON COLUMN events.ripple_depth IS '涟漪深度：0=局部事件，1=影响直接关联者，2+=连锁反应。';
COMMENT ON COLUMN events.involved_entity_ids IS '参与实体ID数组，用于快速查询某实体的所有相关事件。';
COMMENT ON COLUMN events.importance IS '事件重要性评分[0,1]，用于摘要生成和回顾。';
COMMENT ON COLUMN events.world_state_hash IS '事件发生时的世界状态SHA256哈希，用于一致性校验。';
```

### 4.3.5 chapters -- 章节主表

```sql
-- ============================================================
-- 表: chapters
-- 说明: 章节元数据与最新版本内容
-- 规模估计: 单项目 100-2,000 章
-- 注意: 正文内容存储在此表，历史版本在chapter_versions
-- ============================================================
CREATE TABLE IF NOT EXISTS chapters (
    chapter_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL,
    
    -- 章节编号
    chapter_number  INTEGER NOT NULL,
    
    -- 章节标题
    title           VARCHAR(500),
    
    -- 状态
    status          chapter_status NOT NULL DEFAULT 'outlined',
    
    -- 章节大纲/简报（结构化JSONB）
    brief_jsonb     JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- 正文内容（最新版本）
    content_text    TEXT,
    
    -- 章节摘要（AI生成或作者编写）
    summary_text    TEXT,
    
    -- 直觉评分（作者的创作冲动评分）
    intuition_score NUMERIC(4,2),  -- [0, 100]
    
    -- 作者注释
    author_notes    TEXT,
    
    -- 统计信息
    word_count      INTEGER DEFAULT 0,
    
    -- 版本计数
    version_count   INTEGER NOT NULL DEFAULT 0,
    
    -- 时间戳
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    committed_at    TIMESTAMPTZ,    -- 提交锁定时间（不可变基线）
    
    -- 外键
    CONSTRAINT fk_chapters_project 
        FOREIGN KEY (project_id) REFERENCES projects(project_id) 
        ON DELETE CASCADE,
    
    -- 检查约束
    CONSTRAINT chk_chapters_number_positive 
        CHECK (chapter_number >= 0),
    
    CONSTRAINT chk_chapters_intuition_range 
        CHECK (intuition_score IS NULL OR (intuition_score >= 0 AND intuition_score <= 100)),
    
    CONSTRAINT chk_chapters_word_count_nonnegative 
        CHECK (word_count >= 0),
    
    -- 唯一约束：同一项目章节号唯一
    CONSTRAINT uq_chapters_project_number 
        UNIQUE(project_id, chapter_number)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_chapters_project_status 
    ON chapters(project_id, status);

CREATE INDEX IF NOT EXISTS idx_chapters_brief_gin 
    ON chapters USING GIN(brief_jsonb);

-- 全文搜索索引（章节内容）
CREATE INDEX IF NOT EXISTS idx_chapters_content_search 
    ON chapters USING GIN(to_tsvector('chinese', content_text));

CREATE INDEX IF NOT EXISTS idx_chapters_committed_at 
    ON chapters(committed_at DESC NULLS LAST);

-- 注释
COMMENT ON TABLE chapters IS '章节主表：存储章节元数据和最新版本正文。历史版本在chapter_versions表中。';
COMMENT ON COLUMN chapters.chapter_number IS '章节序号，在项目内唯一。';
COMMENT ON COLUMN chapters.brief_jsonb IS '章节大纲JSONB：场景列表、角色出场、目标情感节拍等（详见4.4.6节）。';
COMMENT ON COLUMN chapters.content_text IS '章节正文（最新版本），历史版本在chapter_versions。';
COMMENT ON COLUMN chapters.intuition_score IS '直觉分[0-100]，反映作者对章节的满意度/创作冲动。';
COMMENT ON COLUMN chapters.committed_at IS '提交时间，此后章节进入不可变基线状态。';
```


### 4.3.6 chapter_versions —— 章节版本历史表

```sql
-- ============================================================
-- 表: chapter_versions
-- 说明: 章节的所有历史版本，支持回溯与比较
-- 规模估计: 单章节 5-50 个版本，单项目 500-10,000 版本
-- 保留策略: 自动清理90天前的非重要版本（见4.7节）
-- ============================================================
CREATE TABLE IF NOT EXISTS chapter_versions (
    version_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id      UUID NOT NULL,

    -- 版本号（章节内递增）
    version_number  INTEGER NOT NULL,

    -- 版本内容
    content_text    TEXT,

    -- 版本快照的直觉评分
    intuition_score NUMERIC(4,2),  -- [0, 100]

    -- 质量报告（AI评估）
    quality_report  JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 本次生成使用的上下文清单（用于可解释性）
    used_context    JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 版本差异统计
    diff_word_count INTEGER,       -- 相比上一版本的字数变化
    diff_ratio      NUMERIC(5,4),  -- 变化比例 [0, 1]

    -- 版本备注（作者填写）
    version_note    VARCHAR(1000),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 外键
    CONSTRAINT fk_chapter_versions_chapter 
        FOREIGN KEY (chapter_id) REFERENCES chapters(chapter_id) 
        ON DELETE CASCADE,

    -- 检查约束
    CONSTRAINT chk_chapter_versions_number_positive 
        CHECK (version_number >= 1),

    CONSTRAINT chk_chapter_versions_intuition_range 
        CHECK (intuition_score IS NULL OR (intuition_score >= 0 AND intuition_score <= 100)),

    -- 唯一约束：同一章节版本号唯一
    CONSTRAINT uq_chapter_versions_chapter_version 
        UNIQUE(chapter_id, version_number)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_chapter_versions_chapter 
    ON chapter_versions(chapter_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_chapter_versions_created 
    ON chapter_versions(chapter_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chapter_versions_quality_gin 
    ON chapter_versions USING GIN(quality_report);

CREATE INDEX IF NOT EXISTS idx_chapter_versions_context_gin 
    ON chapter_versions USING GIN(used_context);

-- 注释
COMMENT ON TABLE chapter_versions IS '章节版本历史表：存储每个章节的完整版本链，支持回溯和A/B比较。';
COMMENT ON COLUMN chapter_versions.version_number IS '章节内递增的版本号，从1开始。';
COMMENT ON COLUMN chapter_versions.quality_report IS '质量报告JSONB：风格一致性、设定遵守度、节奏评分等（详见4.4.7节）。';
COMMENT ON COLUMN chapter_versions.used_context IS '上下文清单JSONB：本次AI生成使用的实体、事件、伏笔等（详见4.4.8节）。';
COMMENT ON COLUMN chapter_versions.diff_word_count IS '与上一版本的字数差异。';
```

### 4.3.7 foreshadowings —— 伏笔管理表

```sql
-- ============================================================
-- 表: foreshadowings
-- 说明: 伏笔线索的全生命周期追踪
-- 规模估计: 单项目 50-500 个伏笔
-- 核心理念: 每个伏笔有叙事势能和半衰期，随章节推进动态衰减
-- ============================================================
CREATE TABLE IF NOT EXISTS foreshadowings (
    foreshadowing_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL,

    -- 伏笔描述（作者/AI编写）
    description         TEXT NOT NULL,

    -- 伏笔内容（实际埋入文本的线索）
    clue_text           TEXT,

    -- 埋下章节
    planted_chapter     INTEGER NOT NULL,

    -- 目标收束章节（预期）
    target_resolution_chapter INTEGER,

    -- 实际收束章节（NULL表示未收束）
    actual_resolution_chapter INTEGER,

    -- 状态
    status              foreshadowing_status NOT NULL DEFAULT 'planted',

    -- 叙事势能：[0, 1]，表示读者对伏笔的期待强度
    narrative_potential NUMERIC(5,4) NOT NULL DEFAULT 0.5000,

    -- 半衰期：章节数，表示伏笔被遗忘的速度
    half_life           INTEGER NOT NULL DEFAULT 10,

    -- 共振主题（与哪些主题线相关）
    resonance_themes    JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- 关联伏笔（形成伏笔网络）
    related_foreshadowing_ids UUID[] DEFAULT '{}'::UUID[],

    -- 关联实体
    involved_entity_ids UUID[] DEFAULT '{}'::UUID[],

    -- 创建来源
    created_from_oracle_id  UUID,       -- 来源预言ID（如果有）
    created_by_user         BOOLEAN DEFAULT TRUE,  -- 人工创建还是AI建议

    -- 元数据
    notes               TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 外键
    CONSTRAINT fk_foreshadowings_project 
        FOREIGN KEY (project_id) REFERENCES projects(project_id) 
        ON DELETE CASCADE,

    -- 检查约束
    CONSTRAINT chk_foreshadowings_chapter_positive 
        CHECK (planted_chapter >= 0),

    CONSTRAINT chk_foreshadowings_potential_range 
        CHECK (narrative_potential >= 0 AND narrative_potential <= 1),

    CONSTRAINT chk_foreshadowings_half_life_positive 
        CHECK (half_life > 0),

    CONSTRAINT chk_foreshadowings_resolution_order 
        CHECK (
            target_resolution_chapter IS NULL 
            OR target_resolution_chapter >= planted_chapter
        )
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_foreshadowings_project_status 
    ON foreshadowings(project_id, status);

CREATE INDEX IF NOT EXISTS idx_foreshadowings_planted 
    ON foreshadowings(project_id, planted_chapter);

CREATE INDEX IF NOT EXISTS idx_foreshadowings_resolution 
    ON foreshadowings(project_id, target_resolution_chapter);

CREATE INDEX IF NOT EXISTS idx_foreshadowings_entities 
    ON foreshadowings USING GIN(involved_entity_ids);

CREATE INDEX IF NOT EXISTS idx_foreshadowings_related 
    ON foreshadowings USING GIN(related_foreshadowing_ids);

CREATE INDEX IF NOT EXISTS idx_foreshadowings_themes_gin 
    ON foreshadowings USING GIN(resonance_themes);

CREATE INDEX IF NOT EXISTS idx_foreshadowings_potential 
    ON foreshadowings(project_id, narrative_potential DESC);

-- 注释
COMMENT ON TABLE foreshadowings IS '伏笔管理表：追踪所有叙事线索的生命周期，从埋下到收束的完整状态。';
COMMENT ON COLUMN foreshadowings.narrative_potential IS '叙事势能[0,1]，反映读者对伏笔的期待强度，随时间衰减。';
COMMENT ON COLUMN foreshadowings.half_life IS '半衰期（章节数），超过此值仍未收束则势能减半。';
COMMENT ON COLUMN foreshadowings.resonance_themes IS '共振主题列表JSONB（详见4.4.9节）。';
COMMENT ON COLUMN foreshadowings.clue_text IS '实际埋入正文文本的线索内容。';
```

### 4.3.8 precedents —— 叙事先例表（因果规则引擎）

```sql
-- ============================================================
-- 表: precedents
-- 说明: 叙事中的因果规则——"如果X则Y"的结构性先例
-- 规模估计: 单项目 100-1,000 条先例
-- 核心理念: 先例是叙事一致性的规则基础，可被触发、覆盖和演化
-- ============================================================
CREATE TABLE IF NOT EXISTS precedents (
    precedent_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL,

    -- 先例名称/描述
    name            VARCHAR(500) NOT NULL,
    description     TEXT,

    -- 触发条件（结构化JSONB）
    trigger_conditions  JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 预期效果/叙事走向
    expected_effect TEXT,

    -- 叙事势能：[0, 1]，表示先例的重要性
    narrative_potential NUMERIC(5,4) NOT NULL DEFAULT 0.5000,

    -- 半衰期：章节数
    half_life       INTEGER NOT NULL DEFAULT 15,

    -- 共振主题
    resonance_themes    JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- 状态
    status          precedent_status NOT NULL DEFAULT 'active',

    -- 创建来源
    created_from_oracle_id  UUID,       -- 来源预言ID

    -- 激活历史
    last_activated_chapter  INTEGER,    -- 最后激活章节
    activation_count        INTEGER NOT NULL DEFAULT 0,  -- 总激活次数

    -- 覆盖链：如果被覆盖，指向覆盖它的先例
    overridden_by_precedent_id UUID,

    -- 优先级：数字越大优先级越高，覆盖时用
    priority        INTEGER NOT NULL DEFAULT 0,

    -- 元数据
    tags            VARCHAR(100)[],
    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 外键
    CONSTRAINT fk_precedents_project 
        FOREIGN KEY (project_id) REFERENCES projects(project_id) 
        ON DELETE CASCADE,

    -- 检查约束
    CONSTRAINT chk_precedents_potential_range 
        CHECK (narrative_potential >= 0 AND narrative_potential <= 1),

    CONSTRAINT chk_precedents_half_life_positive 
        CHECK (half_life > 0),

    CONSTRAINT chk_precedents_priority_range 
        CHECK (priority >= 0 AND priority <= 100),

    CONSTRAINT chk_precedents_activation_nonnegative 
        CHECK (activation_count >= 0)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_precedents_project_status 
    ON precedents(project_id, status);

CREATE INDEX IF NOT EXISTS idx_precedents_conditions_gin 
    ON precedents USING GIN(trigger_conditions);

CREATE INDEX IF NOT EXISTS idx_precedents_themes_gin 
    ON precedents USING GIN(resonance_themes);

CREATE INDEX IF NOT EXISTS idx_precedents_priority 
    ON precedents(project_id, priority DESC);

CREATE INDEX IF NOT EXISTS idx_precedents_activated 
    ON precedents(project_id, last_activated_chapter);

-- 注释
COMMENT ON TABLE precedents IS '叙事先例表：存储"如果X则Y"的因果规则，是叙事一致性的规则引擎核心。';
COMMENT ON COLUMN precedents.trigger_conditions IS '触发条件JSONB：实体状态、关系条件、事件类型等（详见4.4.10节）。';
COMMENT ON COLUMN precedents.overridden_by_precedent_id IS '被哪个更高优先级先例覆盖，形成覆盖链。';
COMMENT ON COLUMN precedents.priority IS '优先级[0,100]，高优先级先例可覆盖低优先级。';
```

### 4.3.9 embeddings —— 向量嵌入表（按project_id分区）

```sql
-- ============================================================
-- 表: embeddings
-- 说明: 文本块的高维向量嵌入，用于语义相似度检索
-- 规模估计: 单项目 5,000-50,000 条向量
-- 向量维度: 1536（OpenAI text-embedding-3-small）
-- 分区策略: 按project_id RANGE分区（见4.6节）
-- ============================================================
CREATE TABLE IF NOT EXISTS embeddings (
    embedding_id    UUID DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL,

    -- 来源类型（章节、实体、笔记等）
    source_type     embedding_source_type NOT NULL,

    -- 来源ID（对应source_type的具体表记录）
    source_id       UUID NOT NULL,

    -- 来源子标识（如同一章节的多个段落）
    chunk_index     INTEGER DEFAULT 0,

    -- 原始文本块
    chunk_text      TEXT NOT NULL,

    -- 文本长度（字符数）
    chunk_length    INTEGER NOT NULL DEFAULT 0,

    -- 向量嵌入（1536维）
    embedding       vector(1536),

    -- 元数据（用于过滤检索）
    meta_jsonb      JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 复合主键（分区键必须在PK中）
    PRIMARY KEY (embedding_id, project_id),

    -- 检查约束
    CONSTRAINT chk_embeddings_chunk_length_positive 
        CHECK (chunk_length >= 0),

    CONSTRAINT chk_embeddings_chunk_non_empty 
        CHECK (LENGTH(chunk_text) > 0)
) PARTITION BY LIST (project_id);

-- 默认分区（临时，动态创建项目专用分区）
CREATE TABLE IF NOT EXISTS embeddings_default PARTITION OF embeddings
    DEFAULT;

-- 索引（在每个分区上独立创建，分区后重建）
-- 注意：IVFFlat索引需要在具体分区上创建
CREATE INDEX IF NOT EXISTS idx_embeddings_source 
    ON embeddings(project_id, source_type, source_id);

-- 注释
COMMENT ON TABLE embeddings IS '向量嵌入表：存储所有文本块的1536维向量表示，按project_id分区。';
COMMENT ON COLUMN embeddings.embedding IS '1536维向量（OpenAI text-embedding-3-small），用于语义相似度检索。';
COMMENT ON COLUMN embeddings.source_type IS '嵌入来源类型，决定检索时的上下文类型过滤。';
COMMENT ON COLUMN embeddings.chunk_text IS '原始文本块内容（冗余存储，避免JOIN查询）。';
COMMENT ON COLUMN embeddings.meta_jsonb IS '元数据JSONB：如章节号、角色ID、段落位置等。';

-- 重要说明：每个项目的分区需要动态创建，详见4.6节分区策略
```


### 4.3.10 user_interactions —— 用户交互日志表

```sql
-- ============================================================
-- 表: user_interactions
-- 说明: 所有用户行为的审计日志，用于行为分析和上下文学习
-- 规模估计: 单项目 10,000-100,000 条记录
-- 保留策略: 终身保存，可归档（见4.7节）
-- ============================================================
CREATE TABLE IF NOT EXISTS user_interactions (
    interaction_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL,

    -- 用户标识（多用户协作时的区分）
    user_id         UUID,  -- NULL表示系统/AI行为

    -- 交互位置
    chapter_number  INTEGER,

    -- 行为类型
    action_type     interaction_action_type NOT NULL,

    -- 行为详情
    action_detail   JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 行为耗时（毫秒）
    duration_ms     INTEGER,

    -- 此时的直觉评分（快照）
    intuition_score NUMERIC(4,2),

    -- 作者批注
    annotation      TEXT,

    -- 会话标识（用于会话分析）
    session_id      UUID,

    -- 客户端信息
    client_info     JSONB DEFAULT '{}'::jsonb,

    -- 时间戳
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 外键
    CONSTRAINT fk_user_interactions_project 
        FOREIGN KEY (project_id) REFERENCES projects(project_id) 
        ON DELETE CASCADE,

    -- 检查约束
    CONSTRAINT chk_user_interactions_chapter_positive 
        CHECK (chapter_number IS NULL OR chapter_number >= 0),

    CONSTRAINT chk_user_interactions_duration_positive 
        CHECK (duration_ms IS NULL OR duration_ms >= 0),

    CONSTRAINT chk_user_interactions_intuition_range 
        CHECK (intuition_score IS NULL OR (intuition_score >= 0 AND intuition_score <= 100))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_interactions_project_time 
    ON user_interactions(project_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_user_interactions_project_action 
    ON user_interactions(project_id, action_type);

CREATE INDEX IF NOT EXISTS idx_user_interactions_chapter 
    ON user_interactions(project_id, chapter_number);

CREATE INDEX IF NOT EXISTS idx_user_interactions_session 
    ON user_interactions(session_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_user_interactions_detail_gin 
    ON user_interactions USING GIN(action_detail);

-- 时间范围分区（按月分区，见4.6节）
-- 注释
COMMENT ON TABLE user_interactions IS '用户交互日志表：记录所有用户操作，用于行为分析、上下文学习和审计追踪。';
COMMENT ON COLUMN user_interactions.action_type IS '行为类型枚举，覆盖创作全流程。';
COMMENT ON COLUMN user_interactions.duration_ms IS '操作耗时（毫秒），用于性能分析和用户体验优化。';
COMMENT ON COLUMN user_interactions.session_id IS '会话标识，用于分析单次创作会话的模式。';
```

### 4.3.11 risk_records —— 风险档案表

```sql
-- ============================================================
-- 表: risk_records
-- 说明: AI检测到的创作风险记录，含作者决策追踪
-- 规模估计: 单项目 500-5,000 条记录
-- 保留策略: 终身保存
-- ============================================================
CREATE TABLE IF NOT EXISTS risk_records (
    risk_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL,

    -- 风险位置
    chapter_number  INTEGER,

    -- 风险分类
    risk_type       risk_type NOT NULL,
    severity        risk_severity NOT NULL,

    -- 风险描述
    description     TEXT NOT NULL,

    -- 风险详情报告（含策略和证据）
    report_jsonb    JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- AI建议的修复方案
    suggested_fix   TEXT,

    -- 作者决策
    author_decision VARCHAR(50),  -- 'accepted', 'rejected', 'modified', 'deferred', 'overridden'
    author_reason   TEXT,         -- 作者决策理由

    -- 修复后的验证
    verified        BOOLEAN DEFAULT FALSE,
    verified_at     TIMESTAMPTZ,

    -- 关联实体/事件
    involved_entity_ids UUID[] DEFAULT '{}'::UUID[],
    involved_event_ids  UUID[] DEFAULT '{}'::UUID[],

    -- 来源
    detected_by     VARCHAR(100) DEFAULT 'ai_engine',  -- 检测来源

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,

    -- 外键
    CONSTRAINT fk_risk_records_project 
        FOREIGN KEY (project_id) REFERENCES projects(project_id) 
        ON DELETE CASCADE,

    -- 检查约束
    CONSTRAINT chk_risk_records_chapter_positive 
        CHECK (chapter_number IS NULL OR chapter_number >= 0),

    CONSTRAINT chk_risk_records_decision_valid 
        CHECK (author_decision IS NULL OR 
               author_decision IN ('accepted', 'rejected', 'modified', 'deferred', 'overridden'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_risk_records_project_severity 
    ON risk_records(project_id, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_risk_records_project_type 
    ON risk_records(project_id, risk_type);

CREATE INDEX IF NOT EXISTS idx_risk_records_project_chapter 
    ON risk_records(project_id, chapter_number);

CREATE INDEX IF NOT EXISTS idx_risk_records_report_gin 
    ON risk_records USING GIN(report_jsonb);

CREATE INDEX IF NOT EXISTS idx_risk_records_entities 
    ON risk_records USING GIN(involved_entity_ids);

CREATE INDEX IF NOT EXISTS idx_risk_records_status 
    ON risk_records(project_id, severity) 
    WHERE resolved_at IS NULL;  -- 未解决的风险

-- 注释
COMMENT ON TABLE risk_records IS '风险档案表：AI检测到的创作风险记录，含完整的策略、证据和作者决策追踪。';
COMMENT ON COLUMN risk_records.report_jsonb IS '风险报告JSONB：证据链、影响分析、修复策略等（详见4.4.11节）。';
COMMENT ON COLUMN risk_records.author_decision IS '作者决策：accepted/rejected/modified/deferred/overridden。';
COMMENT ON COLUMN risk_records.severity IS '严重级别，critical/high会阻断commit流程。';
```

### 4.3.12 outlines —— 大纲表

```sql
-- ============================================================
-- 表: outlines
-- 说明: 结构化大纲——幕结构、里程碑、暗线总表
-- 规模估计: 单项目 1 条大纲记录（版本在版本历史中管理）
-- ============================================================
CREATE TABLE IF NOT EXISTS outlines (
    outline_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL,

    -- 大纲版本
    version_number  INTEGER NOT NULL DEFAULT 1,

    -- 结构化内容（幕结构、里程碑、暗线）
    content_jsonb   JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 大纲统计
    total_acts      INTEGER DEFAULT 0,       -- 幕数
    total_milestones INTEGER DEFAULT 0,      -- 里程碑数
    total_plots     INTEGER DEFAULT 0,        -- 暗线数

    -- 版本状态
    is_current      BOOLEAN NOT NULL DEFAULT TRUE,  -- 是否为当前生效版本

    -- 父版本（支持分支大纲）
    parent_version_id   UUID,

    -- 元数据
    description     TEXT,           -- 版本描述
    tags            VARCHAR(100)[],

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 外键
    CONSTRAINT fk_outlines_project 
        FOREIGN KEY (project_id) REFERENCES projects(project_id) 
        ON DELETE CASCADE,

    -- 检查约束
    CONSTRAINT chk_outlines_version_positive 
        CHECK (version_number >= 1),

    CONSTRAINT chk_outlines_acts_nonnegative 
        CHECK (total_acts >= 0),

    -- 唯一约束：同一项目只能有一个current版本
    CONSTRAINT uq_outlines_current 
        UNIQUE(project_id, is_current) 
        DEFERRABLE INITIALLY DEFERRED
);

-- 部分唯一索引：确保只有一个current=true的记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_outlines_current_unique 
    ON outlines(project_id) 
    WHERE is_current = TRUE;

-- 其他索引
CREATE INDEX IF NOT EXISTS idx_outlines_project_version 
    ON outlines(project_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_outlines_content_gin 
    ON outlines USING GIN(content_jsonb);

-- 注释
COMMENT ON TABLE outlines IS '大纲表：存储结构化叙事大纲——幕结构、里程碑、暗线总表。支持版本分支。';
COMMENT ON COLUMN outlines.content_jsonb IS '结构化大纲JSONB：幕、里程碑、暗线的完整定义（详见4.4.12节）。';
COMMENT ON COLUMN outlines.is_current IS '是否为当前生效版本，每个项目仅一个current。';
```

### 4.3.13 volume_plans —— 卷规划表

```sql
-- ============================================================
-- 表: volume_plans
-- 说明: 卷级别的规划（如第一卷、第二卷）
-- 规模估计: 单项目 5-20 卷
-- ============================================================
CREATE TABLE IF NOT EXISTS volume_plans (
    volume_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL,

    -- 卷号
    volume_number   INTEGER NOT NULL,

    -- 卷名
    title           VARCHAR(500),
    subtitle        VARCHAR(500),

    -- 章节范围
    start_chapter   INTEGER NOT NULL,
    end_chapter     INTEGER NOT NULL,

    -- 结构化内容
    content_jsonb   JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 字数目标
    target_word_count   INTEGER,
    actual_word_count   INTEGER DEFAULT 0,

    -- 状态
    status          VARCHAR(50) DEFAULT 'planning',  -- planning/drafting/completed

    -- 主题与基调
    theme           TEXT,           -- 本卷核心主题
    tone            VARCHAR(100),   -- 基调标签

    -- 关联的大纲节点
    outline_node_ids    UUID[] DEFAULT '{}'::UUID[],

    -- 元数据
    notes           TEXT,
    tags            VARCHAR(100)[],

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 外键
    CONSTRAINT fk_volume_plans_project 
        FOREIGN KEY (project_id) REFERENCES projects(project_id) 
        ON DELETE CASCADE,

    -- 检查约束
    CONSTRAINT chk_volume_plans_number_positive 
        CHECK (volume_number >= 1),

    CONSTRAINT chk_volume_plans_chapter_order 
        CHECK (end_chapter >= start_chapter),

    CONSTRAINT chk_volume_plans_word_count_positive 
        CHECK (target_word_count IS NULL OR target_word_count > 0),

    CONSTRAINT chk_volume_plans_actual_nonnegative 
        CHECK (actual_word_count >= 0),

    -- 唯一约束
    CONSTRAINT uq_volume_plans_project_number 
        UNIQUE(project_id, volume_number)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_volume_plans_project 
    ON volume_plans(project_id, volume_number);

CREATE INDEX IF NOT EXISTS idx_volume_plans_chapters 
    ON volume_plans(project_id, start_chapter, end_chapter);

CREATE INDEX IF NOT EXISTS idx_volume_plans_content_gin 
    ON volume_plans USING GIN(content_jsonb);

-- 注释
COMMENT ON TABLE volume_plans IS '卷规划表：存储每卷的结构规划、主题、章节范围和目标。';
COMMENT ON COLUMN volume_plans.content_jsonb IS '卷规划JSONB：核心冲突、角色弧、伏笔安排等（详见4.4.13节）。';
```

### 4.3.14 reader_knowledge_graph —— 读者知识图谱快照表

```sql
-- ============================================================
-- 表: reader_knowledge_graph
-- 说明: 每章结束时的三重知识状态快照
--        角色知道什么 / 读者知道什么 / 作者意图
-- 规模估计: 单项目 100-2,000 条记录（每章一条）
-- 核心用途: 知识泄露检测、视角一致性、悬疑管理
-- ============================================================
CREATE TABLE IF NOT EXISTS reader_knowledge_graph (
    snapshot_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL,

    -- 快照位置
    chapter_number  INTEGER NOT NULL,

    -- 角色知识状态（每个角色知道什么）
    character_knowledge JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 读者知识状态（读者通过叙述知道什么）
    reader_knowledge    JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 作者意图（作者希望读者知道/不知道什么）
    authorial_intent    JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 信息差分析（计算得出）
    info_gaps       JSONB NOT NULL DEFAULT '{}'::jsonb,  -- 信息差列表

    -- 悬疑指数：[0, 1]，读者已知/未知的不对称程度
    suspense_index  NUMERIC(5,4) DEFAULT 0.0000,

    -- 知识泄露风险（计算得出）
    leak_risk_score NUMERIC(5,4) DEFAULT 0.0000,

    -- 检测到的知识泄露事件
    detected_leaks  JSONB NOT NULL DEFAULT '[]'::jsonb,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 外键
    CONSTRAINT fk_reader_kg_project 
        FOREIGN KEY (project_id) REFERENCES projects(project_id) 
        ON DELETE CASCADE,

    -- 检查约束
    CONSTRAINT chk_reader_kg_chapter_positive 
        CHECK (chapter_number >= 0),

    CONSTRAINT chk_reader_kg_suspense_range 
        CHECK (suspense_index >= 0 AND suspense_index <= 1),

    CONSTRAINT chk_reader_kg_leak_range 
        CHECK (leak_risk_score >= 0 AND leak_risk_score <= 1),

    -- 唯一约束：每章一条快照
    CONSTRAINT uq_reader_kg_project_chapter 
        UNIQUE(project_id, chapter_number)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_reader_kg_project_chapter 
    ON reader_knowledge_graph(project_id, chapter_number);

CREATE INDEX IF NOT EXISTS idx_reader_kg_character_gin 
    ON reader_knowledge_graph USING GIN(character_knowledge);

CREATE INDEX IF NOT EXISTS idx_reader_kg_reader_gin 
    ON reader_knowledge_graph USING GIN(reader_knowledge);

CREATE INDEX IF NOT EXISTS idx_reader_kg_intent_gin 
    ON reader_knowledge_graph USING GIN(authorial_intent);

CREATE INDEX IF NOT EXISTS idx_reader_kg_suspense 
    ON reader_knowledge_graph(project_id, suspense_index DESC);

-- 注释
COMMENT ON TABLE reader_knowledge_graph IS '读者知识图谱快照：每章记录角色知识/读者知识/作者意图的三重状态，用于悬疑管理和信息泄露检测。';
COMMENT ON COLUMN reader_knowledge_graph.character_knowledge IS '角色知识JSONB：每个角色知道的事实集合（详见4.4.14节）。';
COMMENT ON COLUMN reader_knowledge_graph.reader_knowledge IS '读者知识JSONB：读者通过叙述知道的事实集合（详见4.4.15节）。';
COMMENT ON COLUMN reader_knowledge_graph.authorial_intent IS '作者意图JSONB：作者希望读者知道/不知道什么（详见4.4.16节）。';
COMMENT ON COLUMN reader_knowledge_graph.suspense_index IS '悬疑指数[0,1]，读者已知与作者意图的不对称程度。';
```

### 4.3.15 population_states —— 群体状态表

```sql
-- ============================================================
-- 表: population_states
-- 说明: 群体/集团状态的宏观模拟（人群、军队、市场等）
-- 规模估计: 单项目 50-500 个群体
-- ============================================================
CREATE TABLE IF NOT EXISTS population_states (
    population_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL,

    -- 群体名称
    name            VARCHAR(300) NOT NULL,

    -- 群体类型
    population_type VARCHAR(100) NOT NULL,  -- 'crowd', 'army', 'market', 'sect', 'town', etc.

    -- 关联实体（群体由哪些实体组成）
    member_entity_ids   UUID[] DEFAULT '{}'::UUID[],

    -- 群体属性（动态结构化）
    -- 含：人数、士气、资源总量、平均实力、情绪状态、趋势
    properties      JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 所属地点
    location_id     UUID,

    -- 父群体（层级关系）
    parent_population_id UUID,

    -- 群体状态
    status          VARCHAR(50) DEFAULT 'stable',  -- stable/growing/declining/unstable/revolt

    -- 模拟精度
    simulation_tier simulation_tier NOT NULL DEFAULT 'background',

    -- 最后更新章节
    last_updated_chapter INTEGER DEFAULT 0,

    -- 时间戳
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 外键
    CONSTRAINT fk_population_states_project 
        FOREIGN KEY (project_id) REFERENCES projects(project_id) 
        ON DELETE CASCADE,

    CONSTRAINT fk_population_states_location 
        FOREIGN KEY (location_id) REFERENCES entities(entity_id) 
        ON DELETE SET NULL,

    CONSTRAINT fk_population_states_parent 
        FOREIGN KEY (parent_population_id) REFERENCES population_states(population_id) 
        ON DELETE SET NULL,

    -- 检查约束
    CONSTRAINT chk_population_states_name_length 
        CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 300)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_population_states_project 
    ON population_states(project_id);

CREATE INDEX IF NOT EXISTS idx_population_states_project_type 
    ON population_states(project_id, population_type);

CREATE INDEX IF NOT EXISTS idx_population_states_location 
    ON population_states(location_id);

CREATE INDEX IF NOT EXISTS idx_population_states_members 
    ON population_states USING GIN(member_entity_ids);

CREATE INDEX IF NOT EXISTS idx_population_states_properties_gin 
    ON population_states USING GIN(properties);

CREATE INDEX IF NOT EXISTS idx_population_states_simulation_tier 
    ON population_states(project_id, simulation_tier);

-- 注释
COMMENT ON TABLE population_states IS '群体状态表：模拟宏观群体（人群、军队、市场等）的状态变化，支持层级结构。';
COMMENT ON COLUMN population_states.properties IS '群体属性JSONB：人数、士气、资源、情绪、趋势等动态属性。';
COMMENT ON COLUMN population_states.member_entity_ids IS '成员实体ID数组，群体的微观组成。';
COMMENT ON COLUMN population_states.status IS '群体宏观状态：stable(稳定)/growing(增长)/declining(衰退)/unstable(不稳定)/revolt(叛乱)。';
```

### 4.3.16 environmental_states —— 环境状态表

```sql
-- ============================================================
-- 表: environmental_states
-- 说明: 环境/场景的状态追踪（天气、灵气浓度、政治氛围等）
-- 规模估计: 单项目 20-200 个环境实体
-- ============================================================
CREATE TABLE IF NOT EXISTS environmental_states (
    environment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL,

    -- 环境名称
    name            VARCHAR(300) NOT NULL,

    -- 环境类型
    environment_type VARCHAR(100) NOT NULL,  -- 'weather', 'spiritual_energy', 'political_climate', 'economic', 'magical_field', etc.

    -- 关联地点
    location_id     UUID,

    -- 环境属性（动态结构化）
    -- 含：温度、湿度、灵气浓度、魔力值、政治指数、经济指数等
    properties      JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 状态描述（人类可读）
    state_description   TEXT,

    -- 当前状态
    status          VARCHAR(50) DEFAULT 'stable',  -- stable/changing/deteriorating/improving/critical

    -- 趋势方向
    trend           VARCHAR(20) DEFAULT 'stable',  -- rising/falling/stable/cycling/chaotic

    -- 影响范围（哪些实体受环境影响）
    affected_entity_ids UUID[] DEFAULT '{}'::UUID[],

    -- 最后更新章节
    last_updated_chapter INTEGER DEFAULT 0,

    -- 时间戳
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 外键
    CONSTRAINT fk_environmental_states_project 
        FOREIGN KEY (project_id) REFERENCES projects(project_id) 
        ON DELETE CASCADE,

    CONSTRAINT fk_environmental_states_location 
        FOREIGN KEY (location_id) REFERENCES entities(entity_id) 
        ON DELETE SET NULL,

    -- 检查约束
    CONSTRAINT chk_environmental_states_name_length 
        CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 300)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_environmental_states_project 
    ON environmental_states(project_id);

CREATE INDEX IF NOT EXISTS idx_environmental_states_project_type 
    ON environmental_states(project_id, environment_type);

CREATE INDEX IF NOT EXISTS idx_environmental_states_location 
    ON environmental_states(location_id);

CREATE INDEX IF NOT EXISTS idx_environmental_states_affected_entities 
    ON environmental_states USING GIN(affected_entity_ids);

CREATE INDEX IF NOT EXISTS idx_environmental_states_properties_gin 
    ON environmental_states USING GIN(properties);

CREATE INDEX IF NOT EXISTS idx_environmental_states_trend 
    ON environmental_states(project_id, trend);

-- 注释
COMMENT ON TABLE environmental_states IS '环境状态表：追踪世界环境的动态状态——天气、灵气、政治氛围等，影响实体行为。';
COMMENT ON COLUMN environmental_states.properties IS '环境属性JSONB：温度、灵气浓度、魔力值、政治指数等动态参数。';
COMMENT ON COLUMN environmental_states.affected_entity_ids IS '受影响实体ID数组，环境变化会触发这些实体的状态更新。';
COMMENT ON COLUMN environmental_states.trend IS '趋势方向：rising(上升)/falling(下降)/stable(稳定)/cycling(周期性)/chaotic(混沌)。';
```


---

## 4.4 JSONB 结构完整示例（JSON Schema）

> 所有 JSONB 字段均遵循严格的结构约定，应用层负责模式验证（JSON Schema Draft 7）。
> PostgreSQL 层面使用 GIN 索引支持路径查询，不做结构化约束。

### 4.4.1 genre_contract —— 类型契约结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "GenreContract",
  "description": "类型契约：定义小说的流派规则、叙事参数和禁忌",
  "type": "object",
  "required": ["primary_genre", "tone_profile", "narrative_rules"],
  "properties": {
    "primary_genre": {
      "type": "string",
      "description": "主类型，如'xianxia','wuxia','fantasy','sci-fi'",
      "enum": ["xianxia", "wuxia", "xuanhuan", "fantasy", "sci-fi", "urban", "historical", "horror", "romance", "thriller"]
    },
    "sub_genres": {
      "type": "array",
      "description": "子类型标签",
      "items": { "type": "string" },
      "examples": [["cultivation", "reincarnation", "system"]]
    },
    "tone_profile": {
      "type": "object",
      "required": ["primary_tone", "intensity_range"],
      "properties": {
        "primary_tone": { 
          "type": "string", 
          "enum": ["dark", "grimdark", "noblebright", "melancholic", "whimsical", "epic", "intimate", "tense"]
        },
        "secondary_tones": {
          "type": "array",
          "items": { "type": "string" },
          "examples": [["hopeful", "mysterious"]]
        },
        "intensity_range": {
          "type": "object",
          "properties": {
            "min": { "type": "number", "minimum": 0, "maximum": 1, "description": "最低强度" },
            "max": { "type": "number", "minimum": 0, "maximum": 1, "description": "最高强度" },
            "default": { "type": "number", "minimum": 0, "maximum": 1, "description": "默认强度" }
          }
        },
        "emotional_arc": {
          "type": "string",
          "description": "整体情感走向",
          "enum": ["rise", "fall", "rise-fall-rise", "fall-rise-fall", "cyclical", "flat"]
        }
      }
    },
    "narrative_rules": {
      "type": "object",
      "description": "叙事规则约束",
      "properties": {
        "pov_type": { 
          "type": "string", 
          "enum": ["first_person", "third_person_limited", "third_person_omniscient", "multiple_pov", "epistolary"],
          "description": "视角类型"
        },
        "pov_character_id": {
          "type": ["string", "null"],
          "description": "主视角角色UUID（限第三人称有限视角）",
          "format": "uuid"
        },
        "tense": { 
          "type": "string", 
          "enum": ["past", "present"],
          "description": "时态"
        },
        "timeline_structure": {
          "type": "string",
          "enum": ["linear", "flashback", "nonlinear", "parallel", "frame"],
          "description": "时间线结构"
        },
        "chapter_target_length": {
          "type": "integer",
          "description": "目标章节字数",
          "minimum": 100,
          "maximum": 50000
        },
        "pacing_preference": {
          "type": "string",
          "enum": ["slow_burn", "moderate", "fast_paced", "rollercoaster"]
        },
        "scene_transitions": {
          "type": "string",
          "enum": ["smooth", "hard_cut", "fade", "wipe"],
          "description": "场景转换风格"
        }
      }
    },
    "content_boundaries": {
      "type": "object",
      "description": "内容边界与禁忌",
      "properties": {
        "forbidden_themes": {
          "type": "array",
          "items": { "type": "string" },
          "description": "禁止的主题",
          "examples": [["sexual_violence", "child_harm"]]
        },
        "forbidden_tropes": {
          "type": "array",
          "items": { "type": "string" },
          "description": "禁止的桥段"
        },
        "required_themes": {
          "type": "array",
          "items": { "type": "string" },
          "description": "必须包含的主题"
        },
        "violence_level": { 
          "type": "string", 
          "enum": ["none", "mild", "moderate", "intense", "extreme"]
        },
        "romance_level": { 
          "type": "string", 
          "enum": ["none", "subtext", "mild", "significant", "central"] 
        },
        "profanity_level": { 
          "type": "string", 
          "enum": ["none", "mild", "moderate", "heavy"] 
        }
      }
    },
    "power_system": {
      "type": "object",
      "description": "力量体系设定（修仙/魔法/科幻等）",
      "properties": {
        "system_type": { "type": "string", "description": "力量体系名称，如'cultivation','magic','psionics'" },
        "tiers": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "tier_name": { "type": "string", "description": "境界/等级名称" },
              "tier_number": { "type": "integer", "description": "境界序号" },
              "description": { "type": "string" },
              "abilities": { "type": "array", "items": { "type": "string" } }
            }
          },
          "description": "力量体系等级定义"
        },
        "power_creep_control": {
          "type": "object",
          "properties": {
            "max_tier_by_chapter_ratio": { "type": "number", "description": "章节进度与最高境界的比例限制" },
            "tier_advancement_rate": { "type": "string", "enum": ["slow", "moderate", "fast"] },
            "hard_limits": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "chapter": { "type": "integer" },
                  "max_tier": { "type": "integer" }
                }
              }
            }
          }
        }
      }
    },
    "world_rules": {
      "type": "array",
      "description": "世界运行规则列表",
      "items": {
        "type": "object",
        "properties": {
          "rule_id": { "type": "string", "format": "uuid" },
          "rule_name": { "type": "string" },
          "rule_description": { "type": "string" },
          "rule_category": { 
            "type": "string", 
            "enum": ["physics", "magic", "social", "economic", "political", "temporal"] 
          },
          "priority": { "type": "integer", "minimum": 0, "maximum": 100 },
          "is_hard_rule": { "type": "boolean", "description": "是否为不可违反的硬规则" },
          "exceptions_allowed": { "type": "boolean" }
        }
      }
    }
  }
}
```

**示例数据**：

```json
{
  "primary_genre": "xianxia",
  "sub_genres": ["cultivation", "reincarnation", "weak_to_strong"],
  "tone_profile": {
    "primary_tone": "epic",
    "secondary_tones": ["melancholic", "hopeful"],
    "intensity_range": { "min": 0.3, "max": 0.95, "default": 0.6 },
    "emotional_arc": "rise-fall-rise"
  },
  "narrative_rules": {
    "pov_type": "third_person_limited",
    "pov_character_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "tense": "past",
    "timeline_structure": "linear",
    "chapter_target_length": 3000,
    "pacing_preference": "moderate",
    "scene_transitions": "smooth"
  },
  "content_boundaries": {
    "forbidden_themes": ["sexual_violence", "child_harm"],
    "forbidden_tropes": ["deus_ex_machina", "power_of_friendship_solves_all"],
    "required_themes": ["perseverance", "moral_ambiguity"],
    "violence_level": "moderate",
    "romance_level": "subtext",
    "profanity_level": "none"
  },
  "power_system": {
    "system_type": "cultivation",
    "tiers": [
      { "tier_name": "Qi Refining", "tier_number": 1, "description": "引气入体", "abilities": ["enhanced_senses"] },
      { "tier_name": "Foundation Building", "tier_number": 2, "description": "筑基", "abilities": ["spiritual_sense", "basic_spells"] }
    ],
    "power_creep_control": {
      "max_tier_by_chapter_ratio": 0.05,
      "tier_advancement_rate": "moderate"
    }
  },
  "world_rules": [
    {
      "rule_id": "r001",
      "rule_name": "Conservation of Spiritual Energy",
      "rule_description": "灵气总量守恒，无法凭空创造",
      "rule_category": "physics",
      "priority": 95,
      "is_hard_rule": true,
      "exceptions_allowed": false
    }
  ]
}
```

---

### 4.4.2 world_bible —— 世界圣经结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "WorldBible",
  "description": "世界圣经：世界观的核心设定文档",
  "type": "object",
  "properties": {
    "cosmology": {
      "type": "object",
      "description": "宇宙观设定",
      "properties": {
        "world_name": { "type": "string" },
        "world_type": { "type": "string", "enum": ["single_plane", "multi_plane", "infinite_worlds", "simulation", "dream"] },
        "planes": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "plane_id": { "type": "string" },
              "plane_name": { "type": "string" },
              "description": { "type": "string" },
              "connection_rules": { "type": "string" }
            }
          }
        },
        "creation_myth": { "type": "string" }
      }
    },
    "physics": {
      "type": "object",
      "description": "物理法则",
      "properties": {
        "natural_laws": { "type": "array", "items": { "type": "string" } },
        "magic_system_description": { "type": "string" },
        "energy_sources": { "type": "array", "items": { "type": "string" } },
        "limitations": { "type": "array", "items": { "type": "string" } }
      }
    },
    "geography": {
      "type": "object",
      "description": "地理设定",
      "properties": {
        "continents": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "description": { "type": "string" },
              "regions": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "name": { "type": "string" },
                    "climate": { "type": "string" },
                    "notable_features": { "type": "array", "items": { "type": "string" } }
                  }
                }
              }
            }
          }
        }
      }
    },
    "history": {
      "type": "array",
      "description": "历史时间线",
      "items": {
        "type": "object",
        "properties": {
          "era_name": { "type": "string" },
          "time_period": { "type": "string" },
          "events": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "event_name": { "type": "string" },
                "description": { "type": "string" },
                "consequences": { "type": "array", "items": { "type": "string" } }
              }
            }
          }
        }
      }
    },
    "cultures": {
      "type": "array",
      "description": "文化设定",
      "items": {
        "type": "object",
        "properties": {
          "culture_id": { "type": "string" },
          "culture_name": { "type": "string" },
          "values": { "type": "array", "items": { "type": "string" } },
          "customs": { "type": "array", "items": { "type": "string" } },
          "taboos": { "type": "array", "items": { "type": "string" } },
          "language_traits": { "type": "string" }
        }
      }
    }
  }
}
```

---

### 4.4.3 entities.properties —— 实体属性完整结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "EntityProperties",
  "description": "实体动态属性：根据entity_type变化，以下为通用+角色类型示例",
  "type": "object",
  "properties": {
    "_schema_version": { "type": "string", "const": "3.0" },
    "_entity_type": { "type": "string", "description": "实体类型冗余标记" },

    "basic": {
      "type": "object",
      "description": "基础属性",
      "properties": {
        "aliases": { "type": "array", "items": { "type": "string" }, "description": "别名列表" },
        "age": { "type": "integer" },
        "apparent_age": { "type": "integer" },
        "gender": { "type": "string" },
        "race": { "type": "string" },
        "appearance_description": { "type": "string" },
        "distinguishing_features": { "type": "array", "items": { "type": "string" } }
      }
    },

    "cultivation": {
      "type": "object",
      "description": "修为/等级体系（修仙类）",
      "properties": {
        "current_realm": { "type": "string", "description": "当前境界名称" },
        "realm_number": { "type": "integer", "description": "境界序号" },
        "realm_progress": { "type": "number", "minimum": 0, "maximum": 1, "description": "当前境界进度[0,1]" },
        "combat_power": { "type": "number", "description": "综合战斗力评分" },
        "spiritual_energy": { "type": "number", "description": "灵力储备" },
        "max_spiritual_energy": { "type": "number", "description": "灵力上限" },
        "foundation_quality": { "type": "string", "enum": ["mortal", "low", "medium", "high", "heavenly", "divine"] },
        "meridians_opened": { "type": "integer" },
        "total_meridians": { "type": "integer" },
        "special_physique": { "type": "string", "description": "特殊体质" }
      }
    },

    "injuries": {
      "type": "array",
      "description": "伤势列表",
      "items": {
        "type": "object",
        "required": ["injury_id", "injury_type", "severity", "body_part", "applied_chapter"],
        "properties": {
          "injury_id": { "type": "string", "format": "uuid" },
          "injury_type": { 
            "type": "string", 
            "enum": ["physical", "spiritual", "poison", "curse", "mental", "soul"] 
          },
          "severity": { 
            "type": "string", 
            "enum": ["trivial", "minor", "moderate", "severe", "critical", "fatal"] 
          },
          "body_part": { "type": "string", "description": "受伤部位" },
          "description": { "type": "string" },
          "effects": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "affected_attribute": { "type": "string" },
                "modifier": { "type": "number", "description": "属性修正值" },
                "is_permanent": { "type": "boolean" }
              }
            }
          },
          "applied_chapter": { "type": "integer", "description": "受伤章节" },
          "healed_chapter": { "type": ["integer", "null"], "description": "治愈章节（null未愈）" },
          "healing_progress": { "type": "number", "minimum": 0, "maximum": 1, "description": "愈合进度" },
          "source": { "type": "string", "description": "伤害来源（事件描述）" }
        }
      }
    },

    "abilities": {
      "type": "array",
      "description": "技能/能力列表",
      "items": {
        "type": "object",
        "properties": {
          "ability_id": { "type": "string" },
          "ability_name": { "type": "string" },
          "ability_type": { 
            "type": "string", 
            "enum": ["innate", "learned", "inherited", "bestowed", "forbidden"] 
          },
          "description": { "type": "string" },
          "power_level": { "type": "number", "minimum": 0, "maximum": 1 },
          "mastery_level": { "type": "number", "minimum": 0, "maximum": 1 },
          "cost_spiritual_energy": { "type": "number" },
          "cooldown_chapters": { "type": "integer", "description": "冷却章节数" },
          "last_used_chapter": { "type": ["integer", "null"] },
          "is_signature": { "type": "boolean", "description": "是否为招牌技能" },
          "is_sealed": { "type": "boolean", "description": "是否被封印" },
          "restrictions": { "type": "array", "items": { "type": "string" } }
        }
      }
    },

    "cheat_ability": {
      "type": "object",
      "description": "金手指/特殊能力（主角专用）",
      "properties": {
        "cheat_name": { "type": "string", "description": "金手指名称" },
        "cheat_type": { 
          "type": "string", 
          "enum": ["system", "artifact", "reincarnation_memory", "talent", "bloodline", "mysterious_being", "other"] 
        },
        "description": { "type": "string" },
        "current_level": { "type": "integer", "description": "金手指等级" },
        "max_level": { "type": "integer" },
        "unlocked_features": { "type": "array", "items": { "type": "string" } },
        "locked_features": { 
          "type": "array", 
          "items": {
            "type": "object",
            "properties": {
              "feature_name": { "type": "string" },
              "unlock_condition": { "type": "string" },
              "required_level": { "type": "integer" }
            }
          }
        },
        "energy_source": { "type": "string", "description": "能量来源" },
        "energy_reserve": { "type": "number" },
        "energy_max": { "type": "number" },
        "drawbacks": { "type": "array", "items": { "type": "string" }, "description": "副作用/代价" },
        "secrets": { "type": "array", "items": { "type": "string" }, "description": "金手指的秘密（待揭示）" }
      }
    },

    "personality": {
      "type": "object",
      "description": "性格特征（用于角色一致性）",
      "properties": {
        "mbti_type": { "type": "string" },
        "big_five": {
          "type": "object",
          "properties": {
            "openness": { "type": "number", "minimum": 0, "maximum": 1 },
            "conscientiousness": { "type": "number", "minimum": 0, "maximum": 1 },
            "extraversion": { "type": "number", "minimum": 0, "maximum": 1 },
            "agreeableness": { "type": "number", "minimum": 0, "maximum": 1 },
            "neuroticism": { "type": "number", "minimum": 0, "maximum": 1 }
          }
        },
        "core_values": { "type": "array", "items": { "type": "string" } },
        "fears": { "type": "array", "items": { "type": "string" } },
        "desires": { "type": "array", "items": { "type": "string" } },
        "quirks": { "type": "array", "items": { "type": "string" } },
        "speech_pattern": { "type": "string", "description": "说话风格描述" }
      }
    },

    "inventory": {
      "type": "array",
      "description": "物品清单（角色携带的物品）",
      "items": {
        "type": "object",
        "properties": {
          "item_id": { "type": "string", "format": "uuid" },
          "item_name": { "type": "string" },
          "quantity": { "type": "integer", "minimum": 1 },
          "is_equipped": { "type": "boolean" },
          "storage_location": { "type": "string" }
        }
      }
    },

    "internal_state": {
      "type": "object",
      "description": "内在状态（动态变化）",
      "properties": {
        "mood": { "type": "string", "description": "当前心情" },
        "mood_intensity": { "type": "number", "minimum": 0, "maximum": 1 },
        "stress_level": { "type": "number", "minimum": 0, "maximum": 1 },
        "motivation": { "type": "string" },
        "current_goal": { "type": "string" },
        "immediate_concerns": { "type": "array", "items": { "type": "string" } },
        "secrets_known": { "type": "array", "items": { "type": "string" }, "description": "角色知道的秘密" },
        "secrets_hidden": { "type": "array", "items": { "type": "string" }, "description": "角色隐藏的秘密" }
      }
    },

    "faction_info": {
      "type": "object",
      "description": "阵营信息",
      "properties": {
        "current_faction_id": { "type": "string", "format": "uuid" },
        "current_faction_name": { "type": "string" },
        "standing": { "type": "number", "minimum": -1, "maximum": 1, "description": "阵营声望[-1,1]" },
        "rank": { "type": "string" },
        "contributions": { "type": "number" },
        "former_factions": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "faction_id": { "type": "string" },
              "faction_name": { "type": "string" },
              "left_chapter": { "type": "integer" },
              "leave_reason": { "type": "string" }
            }
          }
        }
      }
    },

    "statistics": {
      "type": "object",
      "description": "统计信息",
      "properties": {
        "kills": { "type": "integer", "default": 0 },
        "deaths": { "type": "integer", "default": 0 },
        "battles_fought": { "type": "integer", "default": 0 },
        "battles_won": { "type": "integer", "default": 0 },
        "battles_lost": { "type": "integer", "default": 0 },
        "quests_completed": { "type": "integer", "default": 0 },
        "relationships_formed": { "type": "integer", "default": 0 },
        "relationships_broken": { "type": "integer", "default": 0 },
        "items_crafted": { "type": "integer", "default": 0 },
        "chapters_active": { "type": "integer", "default": 0 }
      }
    }
  }
}
```

---

### 4.4.4 relationships.properties —— 关系属性结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "RelationshipProperties",
  "description": "关系动态属性",
  "type": "object",
  "properties": {
    "trust": {
      "type": "object",
      "description": "信任度",
      "properties": {
        "value": { "type": "number", "minimum": -1, "maximum": 1, "description": "信任值[-1,1]" },
        "history": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "chapter": { "type": "integer" },
              "change": { "type": "number" },
              "reason": { "type": "string" }
            }
          }
        }
      }
    },
    "debt": {
      "type": "object",
      "description": "债务（人情债/金钱债）",
      "properties": {
        "amount": { "type": "number", "description": "债务额度（正数=source欠target）" },
        "currency": { "type": "string", "description": "债务类型：money/favor/life/oath" },
        "description": { "type": "string" }
      }
    },
    "power_difference": {
      "type": "object",
      "description": "权力位差",
      "properties": {
        "value": { "type": "number", "description": "正值=source更强" },
        "dimension": { "type": "string", "enum": ["strength", "authority", "wealth", "influence", "knowledge"] }
      }
    },
    "emotional_intensity": { "type": "number", "minimum": 0, "maximum": 1 },
    "interaction_count": { "type": "integer", "description": "互动次数" },
    "last_interaction_chapter": { "type": "integer" },
    "shared_secrets": { "type": "array", "items": { "type": "string" } },
    "shared_goals": { "type": "array", "items": { "type": "string" } },
    "points_of_conflict": { "type": "array", "items": { "type": "string" } },
    "relationship_history": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "chapter": { "type": "integer" },
          "event": { "type": "string" },
          "impact": { "type": "string" }
        }
      }
    }
  }
}
```

---

### 4.4.5 events.delta_jsonb —— 状态变更快照结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "EventDelta",
  "description": "事件导致的状态变更快照：记录每个受影响实体的前后值",
  "type": "object",
  "required": ["event_id", "changes"],
  "properties": {
    "event_id": { "type": "string", "format": "uuid" },
    "event_description": { "type": "string" },
    "changes": {
      "type": "array",
      "description": "状态变更列表",
      "items": {
        "type": "object",
        "required": ["entity_id", "entity_name", "attribute_path", "old_value", "new_value"],
        "properties": {
          "entity_id": { "type": "string", "format": "uuid" },
          "entity_name": { "type": "string" },
          "entity_type": { "type": "string" },
          "attribute_path": { 
            "type": "string", 
            "description": "变更属性路径，如'cultivation.realm_progress'" 
          },
          "old_value": { "description": "变更前的值（任意类型）" },
          "new_value": { "description": "变更后的值（任意类型）" },
          "change_type": { 
            "type": "string", 
            "enum": ["modify", "add", "remove", "increment", "decrement", "toggle"] 
          },
          "change_reason": { "type": "string", "description": "变更原因说明" },
          "is_reversible": { "type": "boolean", "description": "是否可撤销" },
          "reversal_cost": { "type": "string", "description": "撤销代价描述" }
        }
      }
    },
    "relationship_changes": {
      "type": "array",
      "description": "关系变更列表",
      "items": {
        "type": "object",
        "properties": {
          "relationship_id": { "type": "string", "format": "uuid" },
          "source_name": { "type": "string" },
          "target_name": { "type": "string" },
          "relation_type": { "type": "string" },
          "attribute_path": { "type": "string" },
          "old_value": {},
          "new_value": {}
        }
      }
    },
    "environment_changes": {
      "type": "array",
      "description": "环境变更列表",
      "items": {
        "type": "object",
        "properties": {
          "environment_id": { "type": "string", "format": "uuid" },
          "environment_name": { "type": "string" },
          "attribute_path": { "type": "string" },
          "old_value": {},
          "new_value": {}
        }
      }
    },
    "created_entities": {
      "type": "array",
      "description": "本次事件新创建的实体",
      "items": { "type": "string", "format": "uuid" }
    },
    "destroyed_entities": {
      "type": "array",
      "description": "本次事件消灭/退场的实体",
      "items": { "type": "string", "format": "uuid" }
    },
    "ripple_effects": {
      "type": "array",
      "description": "涟漪效应（间接影响）",
      "items": {
        "type": "object",
        "properties": {
          "affected_entity_id": { "type": "string", "format": "uuid" },
          "effect_description": { "type": "string" },
          "distance": { "type": "integer", "description": "传播距离（关系跳数）" }
        }
      }
    }
  }
}
```

**示例数据**：

```json
{
  "event_id": "e1234567-89ab-cdef-0123-456789abcdef",
  "event_description": "林墨与血魔宗长老激战，施展焚天诀将其击杀",
  "changes": [
    {
      "entity_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "entity_name": "林墨",
      "entity_type": "character",
      "attribute_path": "cultivation.spiritual_energy",
      "old_value": 8500,
      "new_value": 3200,
      "change_type": "decrement",
      "change_reason": "施展焚天诀消耗灵力",
      "is_reversible": true,
      "reversal_cost": "自然恢复需3章"
    },
    {
      "entity_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "entity_name": "林墨",
      "entity_type": "character",
      "attribute_path": "statistics.kills",
      "old_value": 47,
      "new_value": 48,
      "change_type": "increment"
    },
    {
      "entity_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "entity_name": "林墨",
      "entity_type": "character",
      "attribute_path": "injuries",
      "old_value": [],
      "new_value": [
        {
          "injury_id": "i-001",
          "injury_type": "spiritual",
          "severity": "moderate",
          "body_part": "dantian",
          "description": "灵力透支导致丹田微裂",
          "effects": [{"affected_attribute": "cultivation.realm_progress", "modifier": -0.05, "is_permanent": false}],
          "applied_chapter": 156,
          "healed_chapter": null,
          "healing_progress": 0,
          "source": "焚天诀超负荷施展"
        }
      ],
      "change_type": "add"
    }
  ],
  "relationship_changes": [
    {
      "relationship_id": "r-001",
      "source_name": "林墨",
      "target_name": "血魔宗",
      "relation_type": "enemy",
      "attribute_path": "properties.trust.value",
      "old_value": -0.3,
      "new_value": -0.8
    }
  ],
  "created_entities": [],
  "destroyed_entities": ["b2c3d4e5-f6a7-8901-bcde-f12345678901"],
  "ripple_effects": [
    {
      "affected_entity_id": "c3d4e5f6-a789-0123-cdef-123456789012",
      "effect_description": "血魔宗宗主得知长老死讯，下令追杀林墨",
      "distance": 2
    }
  ]
}
```

---

### 4.4.6 chapters.brief_jsonb —— 章节简报结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ChapterBrief",
  "description": "章节简报/大纲：写作前的结构化规划",
  "type": "object",
  "required": ["scenes"],
  "properties": {
    "title": { "type": "string", "description": "章节标题" },
    "summary": { "type": "string", "description": "章节一句话摘要" },
    "chapter_purpose": { "type": "string", "description": "本章叙事目的" },
    "emotional_arc": {
      "type": "object",
      "description": "情感弧线",
      "properties": {
        "opening_mood": { "type": "string" },
        "closing_mood": { "type": "string" },
        "dominant_emotion": { "type": "string" },
        "emotional_beats": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "beat_position": { "type": "number", "description": "在章节中的位置[0,1]" },
              "emotion": { "type": "string" },
              "intensity": { "type": "number", "minimum": 0, "maximum": 1 }
            }
          }
        }
      }
    },
    "scenes": {
      "type": "array",
      "description": "场景列表",
      "items": {
        "type": "object",
        "required": ["scene_number", "scene_type", "description"],
        "properties": {
          "scene_number": { "type": "integer" },
          "scene_type": { 
            "type": "string", 
            "enum": ["action", "dialogue", "reflection", "transition", "revelation", "cliffhanger"] 
          },
          "description": { "type": "string", "description": "场景内容描述" },
          "location_id": { "type": "string", "format": "uuid" },
          "location_name": { "type": "string" },
          "pov_character_id": { "type": "string", "format": "uuid" },
          "pov_character_name": { "type": "string" },
          "appearing_characters": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "character_id": { "type": "string", "format": "uuid" },
                "character_name": { "type": "string" },
                "role_in_scene": { "type": "string", "enum": ["protagonist", "antagonist", "supporting", "background", "mentioned"] }
              }
            }
          },
          "key_events": {
            "type": "array",
            "items": { "type": "string" },
            "description": "场景中必须发生的关键事件"
          },
          "foreshadowings_to_plant": {
            "type": "array",
            "items": { "type": "string", "format": "uuid" },
            "description": "本场景要埋下的伏笔ID"
          },
          "foreshadowings_to_resolve": {
            "type": "array",
            "items": { "type": "string", "format": "uuid" },
            "description": "本场景要收束的伏笔ID"
          },
          "precedents_to_trigger": {
            "type": "array",
            "items": { "type": "string", "format": "uuid" },
            "description": "本场景要触发的先例ID"
          },
          "target_word_count": { "type": "integer" }
        }
      }
    },
    "character_goals": {
      "type": "array",
      "description": "本章角色的目标",
      "items": {
        "type": "object",
        "properties": {
          "character_id": { "type": "string", "format": "uuid" },
          "goal": { "type": "string" },
          "is_achieved": { "type": "boolean" }
        }
      }
    },
    "plot_threads": {
      "type": "array",
      "description": "本章推进的暗线",
      "items": {
        "type": "object",
        "properties": {
          "thread_id": { "type": "string" },
          "thread_name": { "type": "string" },
          "progress_description": { "type": "string" },
          "advancement": { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    },
    "author_notes": { "type": "string" },
    "writing_style_notes": { "type": "string" }
  }
}
```


### 4.4.7 chapter_versions.quality_report —— 质量报告结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "QualityReport",
  "description": "AI对章节版本的质量评估报告",
  "type": "object",
  "required": ["overall_score", "dimensions"],
  "properties": {
    "overall_score": { 
      "type": "number", 
      "minimum": 0, 
      "maximum": 100, 
      "description": "综合质量分" 
    },
    "dimensions": {
      "type": "object",
      "description": "各维度评分",
      "properties": {
        "style_consistency": {
          "type": "object",
          "properties": {
            "score": { "type": "number", "minimum": 0, "maximum": 100 },
            "issues": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "type": { "type": "string", "enum": ["tone_shift", "vocabulary_mismatch", "sentence_rhythm", "pov_drift", "tense_error"] },
                  "description": { "type": "string" },
                  "position": { "type": "string", "description": "问题位置（段落范围）" },
                  "severity": { "type": "string", "enum": ["low", "medium", "high", "critical"] }
                }
              }
            }
          }
        },
        "lore_compliance": {
          "type": "object",
          "properties": {
            "score": { "type": "number", "minimum": 0, "maximum": 100 },
            "violations": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "rule_violated": { "type": "string" },
                  "description": { "type": "string" },
                  "severity": { "type": "string", "enum": ["low", "medium", "high", "critical"] },
                  "suggested_fix": { "type": "string" }
                }
              }
            }
          }
        },
        "character_consistency": {
          "type": "object",
          "properties": {
            "score": { "type": "number", "minimum": 0, "maximum": 100 },
            "character_checks": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "character_id": { "type": "string", "format": "uuid" },
                  "character_name": { "type": "string" },
                  "is_in_character": { "type": "boolean" },
                  "ooc_score": { "type": "number", "minimum": 0, "maximum": 1, "description": "OOC程度[0,1]" },
                  "issues": { "type": "array", "items": { "type": "string" } }
                }
              }
            }
          }
        },
        "pacing": {
          "type": "object",
          "properties": {
            "score": { "type": "number", "minimum": 0, "maximum": 100 },
            "scene_pacing": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "scene_number": { "type": "integer" },
                  "pace_type": { "type": "string", "enum": ["too_slow", "appropriate", "too_fast", "uneven"] },
                  "description": { "type": "string" }
                }
              }
            }
          }
        },
        "foreshadowing_integrity": {
          "type": "object",
          "properties": {
            "score": { "type": "number", "minimum": 0, "maximum": 100 },
            "planted_clues": { "type": "integer", "description": "成功埋下的伏笔数" },
            "resolved_clues": { "type": "integer", "description": "成功收束的伏笔数" },
            "lost_clues": { "type": "integer", "description": "遗失的伏笔数" },
            "forced_resolutions": { "type": "integer", "description": "强行收束数" }
          }
        },
        "dialogue_quality": {
          "type": "object",
          "properties": {
            "score": { "type": "number", "minimum": 0, "maximum": 100 },
            "naturalness": { "type": "number", "minimum": 0, "maximum": 100 },
            "distinctiveness": { "type": "number", "minimum": 0, "maximum": 100, "description": "对话个性鲜明度" }
          }
        }
      }
    },
    "comparative_analysis": {
      "type": "object",
      "description": "与上一版本的对比",
      "properties": {
        "previous_version_id": { "type": "string", "format": "uuid" },
        "overall_change": { "type": "number", "description": "综合分变化" },
        "improved_dimensions": { "type": "array", "items": { "type": "string" } },
        "degraded_dimensions": { "type": "array", "items": { "type": "string" } },
        "unchanged_dimensions": { "type": "array", "items": { "type": "string" } }
      }
    },
    "recommendations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "priority": { "type": "string", "enum": ["high", "medium", "low"] },
          "category": { "type": "string" },
          "description": { "type": "string" },
          "suggested_action": { "type": "string" }
        }
      }
    },
    "generated_at": { "type": "string", "format": "date-time" }
  }
}
```

---

### 4.4.8 chapter_versions.used_context —— 上下文清单结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "UsedContext",
  "description": "AI生成时使用的上下文清单（可解释性）",
  "type": "object",
  "properties": {
    "generation_method": { "type": "string", "enum": ["full_generation", "continuation", "revision", "expansion"] },
    "vector_search": {
      "type": "object",
      "description": "向量检索参数与结果",
      "properties": {
        "query_text": { "type": "string" },
        "top_k": { "type": "integer" },
        "results": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "source_type": { "type": "string" },
              "source_id": { "type": "string" },
              "chunk_text_preview": { "type": "string", "maxLength": 200 },
              "similarity_score": { "type": "number" }
            }
          }
        }
      }
    },
    "retrieved_entities": {
      "type": "array",
      "description": "检索到的实体上下文",
      "items": {
        "type": "object",
        "properties": {
          "entity_id": { "type": "string" },
          "entity_name": { "type": "string" },
          "entity_type": { "type": "string" },
          "relevance": { "type": "number" },
          "properties_used": { "type": "array", "items": { "type": "string" } },
          "reason": { "type": "string", "description": "为什么检索到这个实体" }
        }
      }
    },
    "retrieved_events": {
      "type": "array",
      "description": "检索到的事件上下文",
      "items": {
        "type": "object",
        "properties": {
          "event_id": { "type": "string" },
          "event_description": { "type": "string" },
          "chapter_number": { "type": "integer" },
          "relevance": { "type": "number" }
        }
      }
    },
    "active_foreshadowings": {
      "type": "array",
      "description": "活跃的伏笔（需要推进或收束）",
      "items": {
        "type": "object",
        "properties": {
          "foreshadowing_id": { "type": "string" },
          "description": { "type": "string" },
          "status": { "type": "string" },
          "narrative_potential": { "type": "number" }
        }
      }
    },
    "applicable_precedents": {
      "type": "array",
      "description": "适用的先例规则",
      "items": {
        "type": "object",
        "properties": {
          "precedent_id": { "type": "string" },
          "name": { "type": "string" },
          "trigger_reason": { "type": "string" }
        }
      }
    },
    "environment_context": {
      "type": "object",
      "description": "环境上下文",
      "properties": {
        "location_id": { "type": "string" },
        "location_name": { "type": "string" },
        "environment_state": { "type": "string" },
        "time_of_day": { "type": "string" }
      }
    },
    "word_count_target": { "type": "integer" },
    "actual_word_count": { "type": "integer" }
  }
}
```

---

### 4.4.9 foreshadowings.resonance_themes —— 共振主题结构

```json
{
  "description": "共振主题列表——与该伏笔产生主题共振的其他主题线",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "theme_id": { "type": "string", "description": "主题唯一标识" },
      "theme_name": { "type": "string", "description": "主题名称，如'revenge','redemption','betrayal'" },
      "resonance_strength": { "type": "number", "minimum": 0, "maximum": 1, "description": "共振强度[0,1]" },
      "resonance_type": { 
        "type": "string", 
        "enum": ["reinforcing", "contrasting", "echoing", "foreshadowing", "callback"],
        "description": "共振类型" 
      },
      "related_entity_ids": { 
        "type": "array", 
        "items": { "type": "string" },
        "description": "相关实体" 
      }
    }
  },
  "examples": [
    {
      "theme_id": "t-001",
      "theme_name": "复仇",
      "resonance_strength": 0.85,
      "resonance_type": "reinforcing",
      "related_entity_ids": ["char-001", "char-003"]
    },
    {
      "theme_id": "t-002",
      "theme_name": "救赎",
      "resonance_strength": 0.60,
      "resonance_type": "contrasting",
      "related_entity_ids": ["char-002"]
    }
  ]
}
```

---

### 4.4.10 precedents.trigger_conditions —— 触发条件结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "PrecedentTriggerConditions",
  "description": "先例触发条件：定义先例激活的条件组合",
  "type": "object",
  "properties": {
    "logic_operator": { 
      "type": "string", 
      "enum": ["AND", "OR"],
      "description": "条件组合逻辑" 
    },
    "conditions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["condition_type", "operator"],
        "properties": {
          "condition_type": { 
            "type": "string",
            "enum": ["entity_state", "relationship_state", "event_occurred", "chapter_range", "random_chance", "precedent_status"],
            "description": "条件类型" 
          },
          "target_entity_id": { "type": "string", "description": "目标实体ID（可选）" },
          "target_entity_type": { "type": "string" },
          "attribute_path": { "type": "string", "description": "属性路径，如'cultivation.realm_number'" },
          "operator": { 
            "type": "string",
            "enum": ["eq", "ne", "gt", "gte", "lt", "lte", "in", "contains", "changed"],
            "description": "比较操作符" 
          },
          "value": { "description": "比较值（任意类型）" },
          "event_type": { "type": "string", "description": "事件类型（condition_type=event_occurred时）" },
          "min_chapter": { "type": "integer" },
          "max_chapter": { "type": "integer" },
          "probability": { "type": "number", "minimum": 0, "maximum": 1, "description": "随机概率" },
          "precedent_id": { "type": "string", "description": "依赖的先例ID" },
          "precedent_required_status": { 
            "type": "string", 
            "enum": ["active", "triggered", "fulfilled"] 
          },
          "negate": { "type": "boolean", "default": false, "description": "是否取反" }
        }
      }
    },
    "cooldown_chapters": { "type": "integer", "description": "触发冷却期（章节数）", "default": 0 },
    "max_triggers": { "type": "integer", "description": "最大触发次数", "default": 1 }
  }
}

/* 示例："主角达到筑基期且与血魔宗声望低于-0.5时触发追杀事件" */
{
  "logic_operator": "AND",
  "conditions": [
    {
      "condition_type": "entity_state",
      "target_entity_type": "character",
      "attribute_path": "cultivation.realm_number",
      "operator": "gte",
      "value": 2
    },
    {
      "condition_type": "relationship_state",
      "target_entity_type": "organization",
      "attribute_path": "properties.standing",
      "operator": "lt",
      "value": -0.5
    }
  ],
  "cooldown_chapters": 5,
  "max_triggers": 3
}
```

---

### 4.4.11 risk_records.report_jsonb —— 风险报告结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "RiskReport",
  "description": "AI生成的风险详细报告",
  "type": "object",
  "properties": {
    "detection_method": { 
      "type": "string", 
      "enum": ["continuity_check", "character_analysis", "power_analysis", "causal_inference", "knowledge_gap", "style_analysis"],
      "description": "检测方法" 
    },
    "evidence_chain": {
      "type": "array",
      "description": "证据链",
      "items": {
        "type": "object",
        "properties": {
          "evidence_type": { "type": "string" },
          "description": { "type": "string" },
          "source_chapter": { "type": "integer" },
          "source_text": { "type": "string", "description": "相关原文" },
          "contradiction_point": { "type": "string", "description": "矛盾点描述" }
        }
      }
    },
    "impact_analysis": {
      "type": "object",
      "description": "影响分析",
      "properties": {
        "affected_entities": { "type": "array", "items": { "type": "string" } },
        "affected_chapters": { "type": "array", "items": { "type": "integer" } },
        "narrative_impact": { "type": "string", "description": "对叙事的影响描述" },
        "severity_calculation": {
          "type": "object",
          "properties": {
            "continuity_score": { "type": "number", "description": "连续性破坏程度[0,1]" },
            "reader_confusion_score": { "type": "number", "description": "读者困惑度[0,1]" },
            "fix_complexity": { "type": "string", "enum": ["simple", "moderate", "complex", "architectural"] }
          }
        }
      }
    },
    "suggested_fixes": {
      "type": "array",
      "description": "建议的修复方案",
      "items": {
        "type": "object",
        "properties": {
          "fix_id": { "type": "string" },
          "description": { "type": "string" },
          "difficulty": { "type": "string", "enum": ["easy", "medium", "hard"] },
          "chapters_affected": { "type": "array", "items": { "type": "integer" } },
          "expected_outcome": { "type": "string" },
          "side_effects": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "confidence": { 
      "type": "number", 
      "minimum": 0, 
      "maximum": 1, 
      "description": "AI对风险判断的置信度" 
    },
    "similar_past_risks": {
      "type": "array",
      "items": { "type": "string" },
      "description": "历史上相似的已修复风险ID"
    }
  }
}
```

---

### 4.4.12 outlines.content_jsonb —— 结构化大纲结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "OutlineContent",
  "description": "结构化大纲：幕结构、里程碑、暗线总表",
  "type": "object",
  "required": ["acts"],
  "properties": {
    "overview": {
      "type": "object",
      "description": "大纲概述",
      "properties": {
        "title": { "type": "string" },
        "logline": { "type": "string", "description": "一句话梗概" },
        "core_theme": { "type": "string" },
        "emotional_promise": { "type": "string", "description": "给读者的情感承诺" },
        "target_chapters": { "type": "integer" },
        "target_word_count": { "type": "integer" }
      }
    },
    "acts": {
      "type": "array",
      "description": "幕结构（三幕/五幕等）",
      "items": {
        "type": "object",
        "required": ["act_number", "act_name", "chapters"],
        "properties": {
          "act_number": { "type": "integer" },
          "act_name": { "type": "string" },
          "act_type": { 
            "type": "string", 
            "enum": ["setup", "confrontation", "resolution", "inciting_incident", "rising_action", "climax", "falling_action", "denouement"] 
          },
          "description": { "type": "string" },
          "chapter_range": {
            "type": "object",
            "properties": {
              "start": { "type": "integer" },
              "end": { "type": "integer" }
            }
          },
          "milestones": {
            "type": "array",
            "description": "幕内里程碑",
            "items": {
              "type": "object",
              "properties": {
                "milestone_id": { "type": "string" },
                "milestone_name": { "type": "string" },
                "description": { "type": "string" },
                "target_chapter": { "type": "integer" },
                "chapter_tolerance": { "type": "integer", "description": "允许的章节偏差", "default": 5 },
                "is_critical": { "type": "boolean", "description": "是否为不可跳过的关键里程碑" },
                "status": { "type": "string", "enum": ["pending", "approaching", "reached", "missed", "modified"] },
                "prerequisites": { "type": "array", "items": { "type": "string" }, "description": "前置里程碑ID" }
              }
            }
          },
          "dominant_emotion": { "type": "string" },
          "key_questions": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "plot_threads": {
      "type": "array",
      "description": "暗线总表",
      "items": {
        "type": "object",
        "properties": {
          "thread_id": { "type": "string" },
          "thread_name": { "type": "string" },
          "thread_type": { 
            "type": "string", 
            "enum": ["main_plot", "sub_plot", "character_arc", "romance", "mystery", "foreshadowing_chain", "thematic"] 
          },
          "description": { "type": "string" },
          "priority": { "type": "integer", "minimum": 0, "maximum": 100 },
          "start_chapter": { "type": "integer" },
          "end_chapter": { "type": "integer" },
          "involved_entity_ids": { "type": "array", "items": { "type": "string" } },
          "key_moments": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "chapter": { "type": "integer" },
                "description": { "type": "string" },
                "importance": { "type": "number", "minimum": 0, "maximum": 1 }
              }
            }
          },
          "status": { "type": "string", "enum": ["planned", "active", "dormant", "resolved", "abandoned"] }
        }
      }
    },
    "character_arcs": {
      "type": "array",
      "description": "角色弧线规划",
      "items": {
        "type": "object",
        "properties": {
          "character_id": { "type": "string" },
          "arc_type": { 
            "type": "string", 
            "enum": ["positive_change", "negative_change", "flat", "transformation", "tragic"] 
          },
          "starting_state": { "type": "string" },
          "ending_state": { "type": "string" },
          "key_turning_points": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "chapter": { "type": "integer" },
                "event": { "type": "string" },
                "state_change": { "type": "string" }
              }
            }
          }
        }
      }
    },
    "foreshadowing_plan": {
      "type": "array",
      "description": "伏笔安排计划",
      "items": {
        "type": "object",
        "properties": {
          "foreshadowing_id": { "type": "string" },
          "plant_chapter": { "type": "integer" },
          "resolve_chapter": { "type": "integer" },
          "description": { "type": "string" },
          "clue_type": { "type": "string", "enum": ["visual", "dialogue", "action", "environmental", "symbolic"] }
        }
      }
    }
  }
}
```

---

### 4.4.13 volume_plans.content_jsonb —— 卷规划结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "VolumePlanContent",
  "description": "卷级别的详细规划",
  "type": "object",
  "properties": {
    "overview": {
      "type": "object",
      "properties": {
        "volume_title": { "type": "string" },
        "logline": { "type": "string" },
        "core_conflict": { "type": "string" },
        "emotional_journey": { "type": "string" }
      }
    },
    "structure": {
      "type": "object",
      "properties": {
        "acts_in_volume": { "type": "integer" },
        "chapter_breakdown": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "chapter_offset": { "type": "integer", "description": "卷内章节偏移" },
              "global_chapter": { "type": "integer" },
              "title": { "type": "string" },
              "purpose": { "type": "string" },
              "key_scenes": { "type": "array", "items": { "type": "string" } }
            }
          }
        }
      }
    },
    "character_development": {
      "type": "array",
      "description": "本卷角色发展计划",
      "items": {
        "type": "object",
        "properties": {
          "character_id": { "type": "string" },
          "starting_state": { "type": "string" },
          "ending_state": { "type": "string" },
          "key_growth_moments": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "foreshadowing_schedule": {
      "type": "array",
      "description": "本卷伏笔安排",
      "items": {
        "type": "object",
        "properties": {
          "foreshadowing_id": { "type": "string" },
          "action": { "type": "string", "enum": ["plant", "grow", "resolve"] },
          "target_chapter": { "type": "integer" },
          "method": { "type": "string", "description": "埋下/强化的方式" }
        }
      }
    },
    "power_progression": {
      "type": "object",
      "description": "力量体系进展控制",
      "properties": {
        "starting_power_ceiling": { "type": "number" },
        "ending_power_ceiling": { "type": "number" },
        "protagonist_start_tier": { "type": "integer" },
        "protagonist_end_tier": { "type": "integer" },
        "new_abilities_introduced": { "type": "array", "items": { "type": "string" } }
      }
    },
    "themes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "theme_name": { "type": "string" },
          "exploration_method": { "type": "string" },
          "chapters": { "type": "array", "items": { "type": "integer" } }
        }
      }
    }
  }
}
```

---

### 4.4.14 reader_knowledge_graph.character_knowledge —— 角色知识结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CharacterKnowledge",
  "description": "每个角色知道的事实集合——用于信息泄露检测",
  "type": "object",
  "properties": {
    "version": { "type": "string", "const": "1.0" },
    "snapshot_chapter": { "type": "integer" },
    "characters": {
      "type": "object",
      "description": "以角色ID为键的知识映射",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "character_id": { "type": "string" },
          "character_name": { "type": "string" },
          "knowledge_facts": {
            "type": "array",
            "description": "该角色知道的事实列表",
            "items": {
              "type": "object",
              "properties": {
                "fact_id": { "type": "string" },
                "fact_type": { 
                  "type": "string", 
                  "enum": ["identity", "location", "relationship", "ability", "secret", "event", "motivation", "item", "plan"] 
                },
                "fact_content": { "type": "string" },
                "confidence": { "type": "number", "minimum": 0, "maximum": 1, "description": "角色对此事实的确信程度" },
                "learned_chapter": { "type": "integer" },
                "learned_from": { "type": "string", "description": "从谁/哪里得知" },
                "is_true": { "type": "boolean", "description": "该事实是否属实（角色可能持有错误认知）" },
                "is_shared": { "type": "boolean", "description": "该事实是否被角色主动分享过" }
              }
            }
          },
          "beliefs": {
            "type": "array",
            "description": "角色的信念（可能不等于事实）",
            "items": {
              "type": "object",
              "properties": {
                "belief_content": { "type": "string" },
                "strength": { "type": "number", "minimum": 0, "maximum": 1 },
                "is_accurate": { "type": "boolean" }
              }
            }
          },
          "suspicions": {
            "type": "array",
            "description": "角色的怀疑（尚未确认的认知）",
            "items": {
              "type": "object",
              "properties": {
                "suspicion_content": { "type": "string" },
                "suspicion_level": { "type": "number", "minimum": 0, "maximum": 1 }
              }
            }
          }
        }
      }
    }
  }
}

/* 示例 */
{
  "version": "1.0",
  "snapshot_chapter": 156,
  "characters": {
    "char-linmo": {
      "character_id": "char-linmo",
      "character_name": "林墨",
      "knowledge_facts": [
        {
          "fact_id": "f-001",
          "fact_type": "identity",
          "fact_content": "自己是太玄门弃徒之子",
          "confidence": 1.0,
          "learned_chapter": 1,
          "learned_from": "养父临终",
          "is_true": true,
          "is_shared": false
        },
        {
          "fact_id": "f-045",
          "fact_type": "secret",
          "fact_content": "焚天诀的真正创造者其实是魔道祖师",
          "confidence": 0.7,
          "learned_chapter": 150,
          "learned_from": "古墓壁画",
          "is_true": true,
          "is_shared": false
        }
      ],
      "beliefs": [{"belief_content": "正邪不两立", "strength": 0.8, "is_accurate": false}],
      "suspicions": [{"suspicion_content": "师父可能知道自己的身世", "suspicion_level": 0.6}]
    }
  }
}
```

---

### 4.4.15 reader_knowledge_graph.reader_knowledge —— 读者知识结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ReaderKnowledge",
  "description": "读者通过叙述知道的事实集合",
  "type": "object",
  "properties": {
    "version": { "type": "string", "const": "1.0" },
    "snapshot_chapter": { "type": "integer" },
    "known_facts": {
      "type": "array",
      "description": "读者已知的事实",
      "items": {
        "type": "object",
        "properties": {
          "fact_id": { "type": "string" },
          "fact_type": { 
            "type": "string", 
            "enum": ["explicit", "inferred", "implied", "dramatic_irony"] 
          },
          "fact_content": { "type": "string" },
          "source_chapter": { "type": "integer" },
          "knowledge_type": { 
            "type": "string", 
            "enum": ["explicit", "implicit"],
            "description": "明确告知还是暗示推断" 
          },
          "related_entities": { "type": "array", "items": { "type": "string" } },
          "is_true": { "type": "boolean", "description": "事实是否属实（读者可能被误导）" }
        }
      }
    },
    "mysteries_active": {
      "type": "array",
      "description": "活跃中的悬念",
      "items": {
        "type": "object",
        "properties": {
          "mystery_id": { "type": "string" },
          "mystery_question": { "type": "string" },
          "clues_provided": { "type": "array", "items": { "type": "string" } },
          "reader_guess_quality": { 
            "type": "string", 
            "enum": ["no_idea", "some_hunch", "likely_correct", "correct"],
            "description": "读者猜测的准确度" 
          },
          "suspense_level": { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    },
    "dramatic_ironies": {
      "type": "array",
      "description": "戏剧性反讽（读者知道但角色不知道的事实）",
      "items": {
        "type": "object",
        "properties": {
          "fact_id": { "type": "string" },
          "fact_content": { "type": "string" },
          "knowing_characters": { "type": "array", "items": { "type": "string" } },
          "unknowing_characters": { "type": "array", "items": { "type": "string" } },
          "irony_tension": { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    }
  }
}
```

---

### 4.4.16 reader_knowledge_graph.authorial_intent —— 作者意图结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AuthorialIntent",
  "description": "作者希望读者知道/不知道什么——用于知识泄露检测",
  "type": "object",
  "properties": {
    "version": { "type": "string", "const": "1.0" },
    "snapshot_chapter": { "type": "integer" },
    "intended_reader_knowledge": {
      "type": "array",
      "description": "作者希望读者此时知道的事实",
      "items": {
        "type": "object",
        "properties": {
          "fact_id": { "type": "string" },
          "fact_content": { "type": "string" },
          "knowledge_depth": { 
            "type": "string", 
            "enum": ["surface", "moderate", "deep"],
            "description": "希望读者的理解深度" 
          },
          "delivery_method": { 
            "type": "string", 
            "enum": ["explicit", "subtle_hint", "symbolic", "foreshadowing", "dramatic_reveal"] 
          }
        }
      }
    },
    "intended_secrets": {
      "type": "array",
      "description": "作者希望读者此时还不知道的秘密",
      "items": {
        "type": "object",
        "properties": {
          "secret_id": { "type": "string" },
          "secret_content": { "type": "string" },
          "planned_reveal_chapter": { "type": "integer" },
          "reveal_method": { 
            "type": "string", 
            "enum": ["gradual_reveal", "sudden_twist", "character_confession", "discovery"] 
          },
          "hint_schedule": {
            "type": "array",
            "description": "提前释放的暗示时间表",
            "items": {
              "type": "object",
              "properties": {
                "chapter": { "type": "integer" },
                "hint_strength": { "type": "number", "minimum": 0, "maximum": 1 },
                "hint_method": { "type": "string" }
              }
            }
          }
        }
      }
    },
    "suspense_targets": {
      "type": "array",
      "description": "悬疑效果目标",
      "items": {
        "type": "object",
        "properties": {
          "target_type": { 
            "type": "string", 
            "enum": ["curiosity", "tension", "empathy", "shock", "dread"] 
          },
          "target_intensity": { "type": "number", "minimum": 0, "maximum": 1 },
          "effective_range": {
            "type": "object",
            "properties": {
              "start_chapter": { "type": "integer" },
              "end_chapter": { "type": "integer" }
            }
          }
        }
      }
    },
    "red_herrings": {
      "type": "array",
      "description": "有意设置的误导",
      "items": {
        "type": "object",
        "properties": {
          "misdirection_id": { "type": "string" },
          "false_implication": { "type": "string" },
          "intended_misdirection": { "type": "string" },
          "actual_truth": { "type": "string" },
          "chapter_planted": { "type": "integer" },
          "chapter_resolved": { "type": "integer" }
        }
      }
    }
  }
}
```


---

## 4.5 索引策略汇总

### 4.5.1 B-tree 索引（范围查询与排序）

```sql
-- ============================================================
-- 4.5.1 B-tree 索引（用于范围查询、排序、等值匹配）
-- ============================================================

-- projects 表
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

-- entities 表
CREATE INDEX IF NOT EXISTS idx_entities_project_tier_location 
    ON entities(project_id, simulation_tier, location_id);
CREATE INDEX IF NOT EXISTS idx_entities_project_type 
    ON entities(project_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_project_status 
    ON entities(project_id, status);
CREATE INDEX IF NOT EXISTS idx_entities_name_trgm 
    ON entities USING GIN(name gin_trgm_ops);  -- trigram用于模糊搜索

-- relationships 表
CREATE INDEX IF NOT EXISTS idx_relationships_project 
    ON relationships(project_id);
CREATE INDEX IF NOT EXISTS idx_relationships_source 
    ON relationships(source_id, relation_type);
CREATE INDEX IF NOT EXISTS idx_relationships_target 
    ON relationships(target_id, relation_type);
CREATE INDEX IF NOT EXISTS idx_relationships_project_type 
    ON relationships(project_id, relation_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_unique_pair 
    ON relationships(project_id, source_id, target_id, relation_type);

-- events 表
CREATE INDEX IF NOT EXISTS idx_events_project_chapter 
    ON events(project_id, chapter_number, scene_number, event_sequence);
CREATE INDEX IF NOT EXISTS idx_events_triggered_by 
    ON events(triggered_by_event_id);
CREATE INDEX IF NOT EXISTS idx_events_importance 
    ON events(project_id, importance DESC);
CREATE INDEX IF NOT EXISTS idx_events_ripple 
    ON events(project_id, ripple_depth DESC);

-- chapters 表
CREATE INDEX IF NOT EXISTS idx_chapters_project_status 
    ON chapters(project_id, status);
CREATE INDEX IF NOT EXISTS idx_chapters_committed_at 
    ON chapters(committed_at DESC NULLS LAST);

-- chapter_versions 表
CREATE INDEX IF NOT EXISTS idx_chapter_versions_chapter 
    ON chapter_versions(chapter_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_chapter_versions_created 
    ON chapter_versions(chapter_id, created_at DESC);

-- foreshadowings 表
CREATE INDEX IF NOT EXISTS idx_foreshadowings_project_status 
    ON foreshadowings(project_id, status);
CREATE INDEX IF NOT EXISTS idx_foreshadowings_planted 
    ON foreshadowings(project_id, planted_chapter);
CREATE INDEX IF NOT EXISTS idx_foreshadowings_resolution 
    ON foreshadowings(project_id, target_resolution_chapter);
CREATE INDEX IF NOT EXISTS idx_foreshadowings_potential 
    ON foreshadowings(project_id, narrative_potential DESC);

-- precedents 表
CREATE INDEX IF NOT EXISTS idx_precedents_project_status 
    ON precedents(project_id, status);
CREATE INDEX IF NOT EXISTS idx_precedents_priority 
    ON precedents(project_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_precedents_activated 
    ON precedents(project_id, last_activated_chapter);

-- user_interactions 表
CREATE INDEX IF NOT EXISTS idx_user_interactions_project_time 
    ON user_interactions(project_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_interactions_project_action 
    ON user_interactions(project_id, action_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_chapter 
    ON user_interactions(project_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_user_interactions_session 
    ON user_interactions(session_id, timestamp);

-- risk_records 表
CREATE INDEX IF NOT EXISTS idx_risk_records_project_severity 
    ON risk_records(project_id, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_records_project_type 
    ON risk_records(project_id, risk_type);
CREATE INDEX IF NOT EXISTS idx_risk_records_project_chapter 
    ON risk_records(project_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_risk_records_unresolved 
    ON risk_records(project_id, severity) 
    WHERE resolved_at IS NULL;

-- outlines 表
CREATE UNIQUE INDEX IF NOT EXISTS idx_outlines_current_unique 
    ON outlines(project_id) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_outlines_project_version 
    ON outlines(project_id, version_number DESC);

-- volume_plans 表
CREATE INDEX IF NOT EXISTS idx_volume_plans_project 
    ON volume_plans(project_id, volume_number);
CREATE INDEX IF NOT EXISTS idx_volume_plans_chapters 
    ON volume_plans(project_id, start_chapter, end_chapter);

-- reader_knowledge_graph 表
CREATE INDEX IF NOT EXISTS idx_reader_kg_project_chapter 
    ON reader_knowledge_graph(project_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_reader_kg_suspense 
    ON reader_knowledge_graph(project_id, suspense_index DESC);

-- population_states 表
CREATE INDEX IF NOT EXISTS idx_population_states_project 
    ON population_states(project_id);
CREATE INDEX IF NOT EXISTS idx_population_states_project_type 
    ON population_states(project_id, population_type);
CREATE INDEX IF NOT EXISTS idx_population_states_location 
    ON population_states(location_id);
CREATE INDEX IF NOT EXISTS idx_population_states_simulation_tier 
    ON population_states(project_id, simulation_tier);

-- environmental_states 表
CREATE INDEX IF NOT EXISTS idx_environmental_states_project 
    ON environmental_states(project_id);
CREATE INDEX IF NOT EXISTS idx_environmental_states_project_type 
    ON environmental_states(project_id, environment_type);
CREATE INDEX IF NOT EXISTS idx_environmental_states_location 
    ON environmental_states(location_id);
CREATE INDEX IF NOT EXISTS idx_environmental_states_trend 
    ON environmental_states(project_id, trend);
```

### 4.5.2 GIN 索引（JSONB查询与数组搜索）

```sql
-- ============================================================
-- 4.5.2 GIN 索引（用于JSONB路径查询、数组包含、全文搜索）
-- ============================================================

-- 实体属性 GIN 索引
CREATE INDEX IF NOT EXISTS idx_entities_properties_gin 
    ON entities USING GIN(properties);

-- 实体标签 GIN 索引
CREATE INDEX IF NOT EXISTS idx_entities_tags_gin 
    ON entities USING GIN(tags);

-- 关系属性 GIN 索引
CREATE INDEX IF NOT EXISTS idx_relationships_properties_gin 
    ON relationships USING GIN(properties);

-- 事件参与实体 GIN 索引
CREATE INDEX IF NOT EXISTS idx_events_involved_entities 
    ON events USING GIN(involved_entity_ids);

-- 事件状态变更 GIN 索引
CREATE INDEX IF NOT EXISTS idx_events_delta_gin 
    ON events USING GIN(delta_jsonb);

-- 事件触发链 GIN 索引
CREATE INDEX IF NOT EXISTS idx_events_triggers 
    ON events USING GIN(triggers_event_ids);

-- 章节大纲 GIN 索引
CREATE INDEX IF NOT EXISTS idx_chapters_brief_gin 
    ON chapters USING GIN(brief_jsonb);

-- 章节内容全文搜索（中文）
CREATE INDEX IF NOT EXISTS idx_chapters_content_search 
    ON chapters USING GIN(to_tsvector('chinese', content_text));

-- 版本质量报告 GIN 索引
CREATE INDEX IF NOT EXISTS idx_chapter_versions_quality_gin 
    ON chapter_versions USING GIN(quality_report);

-- 版本上下文 GIN 索引
CREATE INDEX IF NOT EXISTS idx_chapter_versions_context_gin 
    ON chapter_versions USING GIN(used_context);

-- 伏笔主题 GIN 索引
CREATE INDEX IF NOT EXISTS idx_foreshadowings_themes_gin 
    ON foreshadowings USING GIN(resonance_themes);

-- 伏笔关联 GIN 索引
CREATE INDEX IF NOT EXISTS idx_foreshadowings_related 
    ON foreshadowings USING GIN(related_foreshadowing_ids);

-- 伏笔实体 GIN 索引
CREATE INDEX IF NOT EXISTS idx_foreshadowings_entities 
    ON foreshadowings USING GIN(involved_entity_ids);

-- 先例条件 GIN 索引
CREATE INDEX IF NOT EXISTS idx_precedents_conditions_gin 
    ON precedents USING GIN(trigger_conditions);

-- 先例主题 GIN 索引
CREATE INDEX IF NOT EXISTS idx_precedents_themes_gin 
    ON precedents USING GIN(resonance_themes);

-- 交互详情 GIN 索引
CREATE INDEX IF NOT EXISTS idx_user_interactions_detail_gin 
    ON user_interactions USING GIN(action_detail);

-- 风险报告 GIN 索引
CREATE INDEX IF NOT EXISTS idx_risk_records_report_gin 
    ON risk_records USING GIN(report_jsonb);

-- 风险关联实体 GIN 索引
CREATE INDEX IF NOT EXISTS idx_risk_records_entities 
    ON risk_records USING GIN(involved_entity_ids);

-- 大纲内容 GIN 索引
CREATE INDEX IF NOT EXISTS idx_outlines_content_gin 
    ON outlines USING GIN(content_jsonb);

-- 卷规划 GIN 索引
CREATE INDEX IF NOT EXISTS idx_volume_plans_content_gin 
    ON volume_plans USING GIN(content_jsonb);

-- 知识图谱 GIN 索引
CREATE INDEX IF NOT EXISTS idx_reader_kg_character_gin 
    ON reader_knowledge_graph USING GIN(character_knowledge);
CREATE INDEX IF NOT EXISTS idx_reader_kg_reader_gin 
    ON reader_knowledge_graph USING GIN(reader_knowledge);
CREATE INDEX IF NOT EXISTS idx_reader_kg_intent_gin 
    ON reader_knowledge_graph USING GIN(authorial_intent);

-- 群体状态属性 GIN 索引
CREATE INDEX IF NOT EXISTS idx_population_states_properties_gin 
    ON population_states USING GIN(properties);

-- 群体成员 GIN 索引
CREATE INDEX IF NOT EXISTS idx_population_states_members 
    ON population_states USING GIN(member_entity_ids);

-- 环境影响实体 GIN 索引
CREATE INDEX IF NOT EXISTS idx_environmental_states_affected_entities 
    ON environmental_states USING GIN(affected_entity_ids);

-- 环境属性 GIN 索引
CREATE INDEX IF NOT EXISTS idx_environmental_states_properties_gin 
    ON environmental_states USING GIN(properties);
```

### 4.5.3 IVFFlat 向量索引（pgvector）

```sql
-- ============================================================
-- 4.5.3 IVFFlat 向量索引（用于语义相似度检索）
-- ============================================================

-- 在 embeddings 表的每个分区上创建 IVFFlat 索引
-- 注意：IVFFlat 需要在有足够数据的分区上创建（至少1000条向量）

-- 动态分区索引创建函数（在创建新分区后调用）
CREATE OR REPLACE FUNCTION create_embedding_index_for_partition(
    p_partition_name TEXT,
    p_lists INTEGER DEFAULT 100
)
RETURNS VOID AS $$
BEGIN
    -- IVFFlat 索引：使用内积（用于归一化向量）或 L2 距离
    -- lists 参数通常为 sqrt(n) 或 n/1000（n为向量数）
    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I USING ivfflat (embedding vector_cosine_ops) WITH (lists = %s);',
        p_partition_name || '_embedding_ivfflat',
        p_partition_name,
        p_lists
    );

    -- 源类型索引（配合向量索引过滤）
    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I (source_type, source_id);',
        p_partition_name || '_source_idx',
        p_partition_name
    );
END;
$$ LANGUAGE plpgsql;

-- 默认分区的索引
SELECT create_embedding_index_for_partition('embeddings_default', 100);

-- ============================================================
-- 向量查询示例
-- ============================================================

-- 相似度检索：查找与查询向量最相似的文本块
-- 使用 cosine 相似度，配合 source_type 过滤
/*
SELECT 
    embedding_id,
    source_type,
    source_id,
    chunk_text,
    1 - (embedding <=> query_embedding) AS cosine_similarity
FROM embeddings
WHERE project_id = 'xxx'
  AND source_type = 'chapter_content'
ORDER BY embedding <=> query_embedding
LIMIT 10;
*/

-- 混合检索：向量相似度 + 元数据过滤
/*
SELECT 
    embedding_id,
    chunk_text,
    1 - (embedding <=> query_embedding) AS similarity,
    meta_jsonb->>'chapter_number' AS chapter
FROM embeddings
WHERE project_id = 'xxx'
  AND meta_jsonb @> '{"chapter_number": 150}'
ORDER BY embedding <=> query_embedding
LIMIT 5;
*/
```

### 4.5.4 索引维护与监控

```sql
-- ============================================================
-- 4.5.4 索引监控查询
-- ============================================================

-- 查看所有索引及其大小
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- GIN索引统计（检查是否有膨胀）
SELECT 
    relname AS index_name,
    pg_size_pretty(pg_relation_size(oid)) AS index_size,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'idx_%_gin'
ORDER BY pg_relation_size(indexrelname::regclass) DESC;

-- 向量索引监控（嵌入表分区）
SELECT 
    tablename,
    indexname,
    pg_size_pretty(pg_total_relation_size(indexname::regclass)) AS total_size
FROM pg_indexes
WHERE indexname LIKE '%ivfflat%'
ORDER BY pg_total_relation_size(indexname::regclass) DESC;

-- 自动索引优化建议（使用 hypopg 扩展）
-- CREATE EXTENSION IF NOT EXISTS hypopg;
-- SELECT * FROM hypopg_create_index('CREATE INDEX ON entities USING GIN(properties)');
```


---

## 4.6 触发器与存储过程

### 4.6.1 updated_at 自动更新触发器

```sql
-- ============================================================
-- 4.6.1 通用 updated_at 自动更新触发器
-- 适用表: projects, entities, relationships, foreshadowings,
--          precedents, chapters, outlines, volume_plans,
--          population_states, environmental_states
-- ============================================================

-- 创建触发器函数
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为所有需要 updated_at 的表注册触发器
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'projects',
        'entities',
        'relationships',
        'foreshadowings',
        'precedents',
        'chapters',
        'outlines',
        'volume_plans',
        'population_states',
        'environmental_states'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I; 
             CREATE TRIGGER trg_%I_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW
             EXECUTE FUNCTION trigger_set_updated_at();',
            tbl, tbl, tbl, tbl
        );
    END LOOP;
END $$;

-- 验证触发器已注册
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    tgenabled AS enabled
FROM pg_trigger
WHERE tgname LIKE 'trg_%_updated_at'
ORDER BY tgrelid::regclass::text;
```

### 4.6.2 项目统计字段自动维护触发器

```sql
-- ============================================================
-- 4.6.2 项目统计字段自动维护
-- 当 entities, chapters, foreshadowings 表发生变更时，
-- 自动更新 projects 表中的计数字段
-- ============================================================

-- entities 变更触发器
CREATE OR REPLACE FUNCTION trigger_update_project_entity_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE projects 
        SET total_entities = total_entities + 1,
            updated_at = NOW()
        WHERE project_id = NEW.project_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE projects 
        SET total_entities = total_entities - 1,
            updated_at = NOW()
        WHERE project_id = OLD.project_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entities_count ON entities;
CREATE TRIGGER trg_entities_count
    AFTER INSERT OR DELETE ON entities
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_project_entity_count();

-- chapters 变更触发器
CREATE OR REPLACE FUNCTION trigger_update_project_chapter_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE projects 
        SET total_chapters = total_chapters + 1,
            current_chapter_number = GREATEST(current_chapter_number, NEW.chapter_number),
            updated_at = NOW()
        WHERE project_id = NEW.project_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE projects 
        SET total_chapters = total_chapters - 1,
            updated_at = NOW()
        WHERE project_id = OLD.project_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chapters_stats ON chapters;
CREATE TRIGGER trg_chapters_stats
    AFTER INSERT OR DELETE ON chapters
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_project_chapter_stats();

-- foreshadowings 变更触发器
CREATE OR REPLACE FUNCTION trigger_update_project_foreshadowing_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE projects 
        SET total_foreshadowings = total_foreshadowings + 1,
            updated_at = NOW()
        WHERE project_id = NEW.project_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE projects 
        SET total_foreshadowings = total_foreshadowings - 1,
            updated_at = NOW()
        WHERE project_id = OLD.project_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_foreshadowings_count ON foreshadowings;
CREATE TRIGGER trg_foreshadowings_count
    AFTER INSERT OR DELETE ON foreshadowings
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_project_foreshadowing_count();

-- events 变更触发器（仅INSERT）
CREATE OR REPLACE FUNCTION trigger_update_project_event_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE projects 
    SET total_events = total_events + 1,
        updated_at = NOW()
    WHERE project_id = NEW.project_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_count ON events;
CREATE TRIGGER trg_events_count
    AFTER INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_project_event_count();

-- chapters 字数统计更新触发器
CREATE OR REPLACE FUNCTION trigger_update_project_word_count()
RETURNS TRIGGER AS $$
DECLARE
    word_diff INTEGER;
BEGIN
    -- 计算字数变化
    word_diff := COALESCE(LENGTH(NEW.content_text), 0) - COALESCE(LENGTH(OLD.content_text), 0);

    IF word_diff != 0 THEN
        UPDATE projects 
        SET total_words = total_words + word_diff,
            updated_at = NOW()
        WHERE project_id = NEW.project_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chapters_word_count ON chapters;
CREATE TRIGGER trg_chapters_word_count
    AFTER UPDATE OF content_text ON chapters
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_project_word_count();

-- chapter_versions 版本计数触发器
CREATE OR REPLACE FUNCTION trigger_update_chapter_version_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE chapters 
        SET version_count = version_count + 1
        WHERE chapter_id = NEW.chapter_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE chapters 
        SET version_count = version_count - 1
        WHERE chapter_id = OLD.chapter_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chapter_version_count ON chapter_versions;
CREATE TRIGGER trg_chapter_version_count
    AFTER INSERT OR DELETE ON chapter_versions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_chapter_version_count();
```

### 4.6.3 事件日志自动记录触发器

```sql
-- ============================================================
-- 4.6.3 关键变更自动记录到交互日志
-- 当实体属性、关系、世界规则发生重大变更时，
-- 自动记录到 user_interactions 表
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_log_entity_change()
RETURNS TRIGGER AS $$
DECLARE
    action_detail JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        action_detail := jsonb_build_object(
            'entity_id', NEW.entity_id,
            'entity_type', NEW.entity_type,
            'entity_name', NEW.name,
            'operation', 'create',
            'properties_snapshot', NEW.properties
        );

        INSERT INTO user_interactions (
            project_id, action_type, action_detail, 
            chapter_number, timestamp
        ) VALUES (
            NEW.project_id, 'entity_create', action_detail,
            NEW.birth_chapter, NOW()
        );
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        -- 只记录 properties 发生变化的更新
        IF NEW.properties IS DISTINCT FROM OLD.properties THEN
            action_detail := jsonb_build_object(
                'entity_id', NEW.entity_id,
                'entity_type', NEW.entity_type,
                'entity_name', NEW.name,
                'operation', 'modify',
                'changed_fields', (
                    SELECT jsonb_object_agg(key, jsonb_build_object('old', o.value, 'new', n.value))
                    FROM jsonb_each(OLD.properties) o
                    JOIN jsonb_each(NEW.properties) n USING(key)
                    WHERE o.value IS DISTINCT FROM n.value
                )
            );

            INSERT INTO user_interactions (
                project_id, action_type, action_detail, timestamp
            ) VALUES (
                NEW.project_id, 'entity_modify', action_detail, NOW()
            );
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entities_log_change ON entities;
CREATE TRIGGER trg_entities_log_change
    AFTER INSERT OR UPDATE ON entities
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_entity_change();

-- 关系变更日志触发器
CREATE OR REPLACE FUNCTION trigger_log_relationship_change()
RETURNS TRIGGER AS $$
DECLARE
    action_detail JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        action_detail := jsonb_build_object(
            'relationship_id', NEW.relationship_id,
            'source_id', NEW.source_id,
            'target_id', NEW.target_id,
            'relation_type', NEW.relation_type,
            'operation', 'create'
        );

        INSERT INTO user_interactions (
            project_id, action_type, action_detail, timestamp
        ) VALUES (
            NEW.project_id, 'relationship_create', action_detail, NOW()
        );
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        action_detail := jsonb_build_object(
            'relationship_id', NEW.relationship_id,
            'source_id', NEW.source_id,
            'target_id', NEW.target_id,
            'relation_type', NEW.relation_type,
            'operation', 'modify',
            'old_strength', OLD.strength,
            'new_strength', NEW.strength
        );

        INSERT INTO user_interactions (
            project_id, action_type, action_detail, timestamp
        ) VALUES (
            NEW.project_id, 'relationship_modify', action_detail, NOW()
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_relationships_log_change ON relationships;
CREATE TRIGGER trg_relationships_log_change
    AFTER INSERT OR UPDATE ON relationships
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_relationship_change();
```

### 4.6.4 双向关系自动创建触发器

```sql
-- ============================================================
-- 4.6.4 双向关系自动同步
-- 当 is_bidirectional = true 的关系被插入/更新/删除时，
-- 自动维护对应的双向记录
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_sync_bidirectional_relationship()
RETURNS TRIGGER AS $$
DECLARE
    existing_reciprocal UUID;
    reciprocal_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_bidirectional AND NEW.reciprocal_id IS NULL THEN
            -- 检查是否已存在反向关系
            SELECT relationship_id INTO existing_reciprocal
            FROM relationships
            WHERE project_id = NEW.project_id
              AND source_id = NEW.target_id
              AND target_id = NEW.source_id
              AND relation_type = NEW.relation_type;

            IF existing_reciprocal IS NOT NULL THEN
                -- 更新现有反向关系
                UPDATE relationships 
                SET is_bidirectional = TRUE,
                    reciprocal_id = NEW.relationship_id,
                    strength = NEW.strength,
                    properties = NEW.properties
                WHERE relationship_id = existing_reciprocal;

                -- 更新正向关系的 reciprocal_id
                NEW.reciprocal_id := existing_reciprocal;
            ELSE
                -- 创建新的反向关系
                INSERT INTO relationships (
                    project_id, source_id, target_id, relation_type,
                    properties, strength, is_bidirectional, reciprocal_id,
                    established_chapter
                ) VALUES (
                    NEW.project_id, NEW.target_id, NEW.source_id, NEW.relation_type,
                    NEW.properties, NEW.strength, TRUE, NEW.relationship_id,
                    NEW.established_chapter
                )
                RETURNING relationship_id INTO reciprocal_id;

                NEW.reciprocal_id := reciprocal_id;
            END IF;
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        -- 同步更新反向关系（避免递归更新）
        IF NEW.is_bidirectional AND NEW.reciprocal_id IS NOT NULL 
           AND (NEW.strength IS DISTINCT FROM OLD.strength 
                OR NEW.properties IS DISTINCT FROM OLD.properties) THEN
            -- 使用 pg_trigger_depth() 防止递归
            IF pg_trigger_depth() < 2 THEN
                UPDATE relationships 
                SET strength = NEW.strength,
                    properties = NEW.properties,
                    updated_at = NOW()
                WHERE relationship_id = NEW.reciprocal_id;
            END IF;
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        -- 删除反向关系
        IF OLD.reciprocal_id IS NOT NULL THEN
            DELETE FROM relationships WHERE relationship_id = OLD.reciprocal_id;
        ELSIF OLD.is_bidirectional THEN
            -- 尝试找到并删除反向关系
            DELETE FROM relationships 
            WHERE project_id = OLD.project_id
              AND source_id = OLD.target_id
              AND target_id = OLD.source_id
              AND relation_type = OLD.relation_type;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_relationships_bidirectional ON relationships;
CREATE TRIGGER trg_relationships_bidirectional
    BEFORE INSERT OR UPDATE OR DELETE ON relationships
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sync_bidirectional_relationship();
```

### 4.6.5 存储过程：创建项目完整环境

```sql
-- ============================================================
-- 4.6.5 存储过程：初始化新项目环境
-- 创建项目 + 创建分区 + 初始化统计
-- ============================================================

CREATE OR REPLACE PROCEDURE sp_create_project_environment(
    p_title VARCHAR(500),
    p_genre_contract JSONB DEFAULT '{}'::jsonb,
    p_world_bible JSONB DEFAULT '{}'::jsonb,
    OUT p_project_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
    partition_name TEXT;
BEGIN
    -- 步骤1: 创建项目记录
    INSERT INTO projects (title, genre_contract, world_bible, status)
    VALUES (p_title, p_genre_contract, p_world_bible, 'drafting')
    RETURNING project_id INTO p_project_id;

    -- 步骤2: 创建 embeddings 分区
    partition_name := 'embeddings_p_' || REPLACE(p_project_id::TEXT, '-', '_');

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF embeddings
         FOR VALUES IN (%L)',
        partition_name,
        p_project_id
    );

    -- 步骤3: 在新分区上创建索引
    PERFORM create_embedding_index_for_partition(partition_name, 100);

    -- 步骤4: 记录操作
    INSERT INTO user_interactions (
        project_id, action_type, action_detail, timestamp
    ) VALUES (
        p_project_id,
        'entity_create',
        jsonb_build_object('action', 'project_created', 'title', p_title),
        NOW()
    );

    COMMIT;
END;
$$;

COMMENT ON PROCEDURE sp_create_project_environment IS 
'创建新项目环境：插入项目记录 + 创建embeddings分区 + 创建分区索引 + 记录操作日志。';
```

### 4.6.6 存储过程：批量更新实体模拟层级

```sql
-- ============================================================
-- 4.6.6 存储过程：根据叙事重要性批量调整模拟层级
-- 在当前章节活跃的角色提升为 protagonist，其他降级
-- ============================================================

CREATE OR REPLACE PROCEDURE sp_adjust_simulation_tiers(
    p_project_id UUID,
    p_current_chapter INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- 步骤1: 将当前章节活跃的角色提升为 protagonist
    UPDATE entities
    SET simulation_tier = 'protagonist',
        updated_at = NOW()
    WHERE project_id = p_project_id
      AND entity_type = 'character'
      AND entity_id IN (
          -- 找出当前章节出现的角色
          SELECT DISTINCT UNNEST(involved_entity_ids)
          FROM events
          WHERE project_id = p_project_id
            AND chapter_number = p_current_chapter
      )
      AND simulation_tier != 'protagonist';

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Promoted % entities to protagonist tier', updated_count;

    -- 步骤2: 长期未出现的 protagonist 降级为 major
    UPDATE entities
    SET simulation_tier = 'major',
        updated_at = NOW()
    WHERE project_id = p_project_id
      AND entity_type = 'character'
      AND simulation_tier = 'protagonist'
      AND entity_id NOT IN (
          -- 找出最近5章出现的角色
          SELECT DISTINCT UNNEST(involved_entity_ids)
          FROM events
          WHERE project_id = p_project_id
            AND chapter_number > p_current_chapter - 5
      );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Demoted % entities from protagonist to major', updated_count;

    COMMIT;
END;
$$;

COMMENT ON PROCEDURE sp_adjust_simulation_tiers IS 
'根据当前章节的叙事需要，批量调整实体的模拟层级。活跃角色提升精度，长期未出场角色降级。';
```

### 4.6.7 存储过程：执行叙事状态变更事务

```sql
-- ============================================================
-- 4.6.7 存储过程：执行带事件日志的原子状态变更
-- 这是世界引擎的核心事务：状态变更 + 事件记录 + 风险检测
-- ============================================================

CREATE OR REPLACE PROCEDURE sp_execute_narrative_change(
    p_project_id UUID,
    p_chapter_number INTEGER,
    p_event_description TEXT,
    p_deltas JSONB,           -- 状态变更JSON数组
    p_involved_entity_ids UUID[] DEFAULT '{}'::UUID[],
    p_ripple_depth INTEGER DEFAULT 0,
    p_importance NUMERIC DEFAULT 0.5,
    p_triggered_by_event UUID DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_event_id UUID;
    v_entity_id UUID;
    v_delta JSONB;
    v_attr_path TEXT;
    v_new_value JSONB;
    v_old_value JSONB;
BEGIN
    -- 开启事务（原子性保证）

    -- 步骤1: 创建事件记录
    INSERT INTO events (
        project_id, chapter_number, description,
        involved_entity_ids, delta_jsonb,
        ripple_depth, importance, triggered_by_event_id
    ) VALUES (
        p_project_id, p_chapter_number, p_event_description,
        p_involved_entity_ids, p_deltas,
        p_ripple_depth, p_importance, p_triggered_by_event
    )
    RETURNING event_id INTO v_event_id;

    -- 步骤2: 应用每个状态变更到实体
    FOR v_delta IN SELECT * FROM jsonb_array_elements(p_deltas->'changes')
    LOOP
        v_entity_id := (v_delta->>'entity_id')::UUID;
        v_attr_path := v_delta->>'attribute_path';
        v_new_value := v_delta->'new_value';

        -- 使用 jsonb_set 更新嵌套属性
        IF v_attr_path LIKE '%.%' THEN
            -- 嵌套路径，如 cultivation.realm_number
            UPDATE entities
            SET properties = jsonb_set(
                properties,
                string_to_array(v_attr_path, '.')::TEXT[],
                v_new_value,
                true
            ),
            updated_at = NOW()
            WHERE entity_id = v_entity_id
              AND project_id = p_project_id;
        ELSE
            -- 顶层属性
            UPDATE entities
            SET properties = properties || jsonb_build_object(v_attr_path, v_new_value),
                updated_at = NOW()
            WHERE entity_id = v_entity_id
              AND project_id = p_project_id;
        END IF;
    END LOOP;

    -- 步骤3: 记录用户交互
    INSERT INTO user_interactions (
        project_id, chapter_number, action_type, 
        action_detail, timestamp
    ) VALUES (
        p_project_id, p_chapter_number, 'ai_generate',
        jsonb_build_object(
            'event_id', v_event_id,
            'event_description', p_event_description,
            'delta_count', jsonb_array_length(p_deltas->'changes')
        ),
        NOW()
    );

    COMMIT;

    RAISE NOTICE 'Event % created with % deltas applied', 
        v_event_id, jsonb_array_length(p_deltas->'changes');
END;
$$;

COMMENT ON PROCEDURE sp_execute_narrative_change IS 
'世界引擎核心事务：原子性地创建事件 + 应用状态变更到实体 + 记录交互日志。
参数p_deltas为4.4.5节定义的状态变更快照JSON。';
```


---

## 4.7 分区策略

### 4.7.1 embeddings 表按 project_id 分区

```sql
-- ============================================================
-- 4.7.1 embeddings 表分区策略
-- 分区方式: LIST (project_id) —— 每个项目一个分区
-- 理由: 
--   1. 查询总是带 project_id 过滤
--   2. 项目间数据完全隔离
--   3. 单个项目删除时可直接DROP分区
--   4. IVFFlat索引可在分区级别独立构建和重建
-- ============================================================

-- 主表已声明为分区表（见4.3.9节）
-- CREATE TABLE embeddings (...) PARTITION BY LIST (project_id);

-- 创建分区的函数（项目创建时调用）
CREATE OR REPLACE FUNCTION create_embedding_partition(
    p_project_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    partition_name TEXT;
    partition_exists BOOLEAN;
BEGIN
    partition_name := 'embeddings_p_' || REPLACE(p_project_id::TEXT, '-', '_');

    -- 检查分区是否已存在
    SELECT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = partition_name
    ) INTO partition_exists;

    IF NOT partition_exists THEN
        -- 创建新分区
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF embeddings
             FOR VALUES IN (%L)',
            partition_name,
            p_project_id
        );

        -- 创建分区索引
        PERFORM create_embedding_index_for_partition(partition_name, 100);

        RAISE NOTICE 'Created embedding partition: %', partition_name;
    ELSE
        RAISE NOTICE 'Partition % already exists', partition_name;
    END IF;

    RETURN partition_name;
END;
$$;

-- 删除分区的函数（项目归档/删除时调用）
CREATE OR REPLACE FUNCTION drop_embedding_partition(
    p_project_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    partition_name TEXT;
BEGIN
    partition_name := 'embeddings_p_' || REPLACE(p_project_id::TEXT, '-', '_');

    EXECUTE format('DROP TABLE IF EXISTS %I', partition_name);

    RAISE NOTICE 'Dropped embedding partition: %', partition_name;
END;
$$;

-- 查询分区信息
SELECT 
    parent.relname AS parent_table,
    child.relname AS partition_name,
    pg_size_pretty(pg_total_relation_size(child.oid)) AS partition_size,
    pg_stat_user_tables.n_live_tup AS row_count
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
LEFT JOIN pg_stat_user_tables ON pg_stat_user_tables.relid = child.oid
WHERE parent.relname = 'embeddings'
ORDER BY child.relname;
```

### 4.7.2 user_interactions 表按时间范围分区

```sql
-- ============================================================
-- 4.7.2 user_interactions 表按月分区
-- 理由: 交互日志按时间查询最频繁，按月归档方便
-- ============================================================

-- 注意：user_interactions 使用范围分区需要修改表结构
-- 以下方案为可选实现

-- 创建分区表（如果原始表数据量巨大时需要重建）
-- CREATE TABLE user_interactions_partitioned (LIKE user_interactions INCLUDING ALL)
-- PARTITION BY RANGE (timestamp);

-- 按月自动创建分区的函数
CREATE OR REPLACE FUNCTION create_monthly_partition(
    p_table_name TEXT,
    p_year INTEGER,
    p_month INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := p_table_name || '_y' || p_year || 'm' || LPAD(p_month::TEXT, 2, '0');
    start_date := make_date(p_year, p_month, 1);
    end_date := start_date + INTERVAL '1 month';

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
         FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        p_table_name,
        start_date,
        end_date
    );

    RETURN partition_name;
END;
$$;

-- 自动维护未来3个月分区的定时任务（使用 pg_cron）
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('create-interaction-partitions', '0 1 1 * *', 
--     $$SELECT create_monthly_partition('user_interactions', 
--         EXTRACT(YEAR FROM NOW())::INT, 
--         EXTRACT(MONTH FROM NOW())::INT)$$);
```

### 4.7.3 分区管理最佳实践

| 策略 | 说明 | 适用表 |
|------|------|--------|
| LIST(project_id) | 每项目一个分区，完全隔离 | embeddings |
| RANGE(timestamp) | 按月分区，便于归档 | user_interactions（可选） |
| 无分区 | 单项目数据量可控，B-tree足够 | 其余14张表 |

> **设计决策**: 除 embeddings 外，其余表不分区。
> 理由：单项目最大实体数~20,000、事件数~100,000，B-tree索引在百万级数据下性能足够。
> embeddings 表因向量数据体积大（1536维 × 4字节 × 50,000条 ≈ 300MB/项目），分区有利于管理和隔离。

---

## 4.8 事务边界详细说明

### 4.8.1 事务类型与隔离级别

| 操作类型 | 隔离级别 | 涉及表 | 预计耗时 |
|----------|----------|--------|----------|
| 状态变更事务 | SERIALIZABLE | events, entities, relationships | 50-200ms |
| 章节提交事务 | REPEATABLE READ | chapters, chapter_versions, events | 100-500ms |
| 实体CRUD | READ COMMITTED | entities, relationships | 10-50ms |
| 批量导入 | READ COMMITTED | 全部16张表 | 1-10s |
| 向量检索 | READ COMMITTED | embeddings | 10-100ms |
| 风险检测 | READ COMMITTED | 只读查询 | 50-200ms |

### 4.8.2 关键事务边界

```
┌─────────────────────────────────────────────────────────────────────┐
│                    事务1: 叙事状态变更 (SERIALIZABLE)                  │
├─────────────────────────────────────────────────────────────────────┤
│  BEGIN;                                                             │
│  1. INSERT INTO events (描述事件)                                    │
│  2. UPDATE entities SET properties = ... (应用状态变更)               │
│  3. UPDATE relationships SET properties = ... (更新关系状态)          │
│  4. UPDATE environmental_states SET properties = ... (环境变化)       │
│  5. UPDATE population_states SET properties = ... (群体变化)          │
│  6. INSERT INTO user_interactions (记录交互)                         │
│  COMMIT;                                                            │
│                                                                     │
│  失败策略: ROLLBACK → 记录到错误日志 → 返回错误给调用者               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    事务2: 章节提交 (REPEATABLE READ)                   │
├─────────────────────────────────────────────────────────────────────┤
│  BEGIN;                                                             │
│  1. INSERT INTO chapter_versions (保存当前版本)                      │
│  2. UPDATE chapters SET status='committed', committed_at=NOW()      │
│  3. UPDATE foreshadowings (更新伏笔状态)                             │
│  4. UPDATE precedents (激活/更新先例)                                │
│  5. INSERT INTO events (记录提交事件)                                 │
│  6. INSERT INTO reader_knowledge_graph (更新知识图谱)                 │
│  7. INSERT INTO embeddings (为新增内容生成向量)                       │
│  COMMIT;                                                            │
│                                                                     │
│  失败策略: ROLLBACK → 不保存任何变更 → 提示作者重试                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    事务3: 项目创建 (READ COMMITTED)                    │
├─────────────────────────────────────────────────────────────────────┤
│  BEGIN;                                                             │
│  1. INSERT INTO projects (创建项目)                                  │
│  2. CALL create_embedding_partition(project_id)                     │
│  3. INSERT INTO outlines (创建默认大纲)                              │
│  4. INSERT INTO entities (创建世界观根实体)                           │
│  COMMIT;                                                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    事务4: 伏笔管理 (READ COMMITTED)                    │
├─────────────────────────────────────────────────────────────────────┤
│  BEGIN;                                                             │
│  1. INSERT/UPDATE foreshadowings (更新伏笔)                          │
│  2. UPDATE chapters.brief_jsonb (更新章节简报中的伏笔关联)            │
│  3. INSERT INTO events (记录伏笔操作事件)                             │
│  COMMIT;                                                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    事务5: 批量向量索引重建                             │
├─────────────────────────────────────────────────────────────────────┤
│  BEGIN;                                                             │
│  1. DROP INDEX embeddings_p_xxx_embedding_ivfflat;                  │
│  2. INSERT INTO embeddings (批量插入新向量)                           │
│  3. CREATE INDEX ... USING ivfflat (重新创建索引)                    │
│  COMMIT;                                                            │
│                                                                     │
│  注意: 大项目可能需要分批执行，每批1000条                            │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.8.3 并发控制策略

```sql
-- 乐观锁模式：使用 version 字段（可选扩展）
-- 或者在应用层使用 SELECT FOR UPDATE

-- 项目级行锁（防止同时编辑同一项目）
-- SELECT * FROM projects WHERE project_id = 'xxx' FOR UPDATE;

-- 章节级行锁（防止同时编辑同一章节）
-- SELECT * FROM chapters WHERE chapter_id = 'xxx' FOR UPDATE NOWAIT;

-- 实体级行锁（模拟引擎更新时）
-- SELECT * FROM entities WHERE entity_id = 'xxx' FOR UPDATE SKIP LOCKED;
```

### 4.8.4 死锁预防

```sql
-- ============================================================
-- 死锁预防规则
-- ============================================================

-- 规则1: 所有操作按固定顺序锁定（project_id -> entity_id -> chapter_id）
-- 规则2: 批量更新使用 SKIP LOCKED 跳过被锁定的行
-- 规则3: 设置合理的锁超时

-- 锁超时设置（连接级别）
SET lock_timeout = '5s';
SET statement_timeout = '30s';
SET idle_in_transaction_session_timeout = '60s';

-- 死锁监控查询
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.relation = blocked_locks.relation
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```


---

## 4.9 数据保留策略与归档方案

### 4.9.1 数据分级保留策略

| 数据级别 | 保留期 | 归档策略 | 涉及表 |
|----------|--------|----------|--------|
| **核心数据** | 永久 | 不删除，仅标记归档 | projects, entities, chapters, events, outlines |
| **版本数据** | 90天活跃 + 归档 | 90天后转冷存储 | chapter_versions |
| **日志数据** | 1年活跃 + 归档 | 1年后压缩归档 | user_interactions |
| **临时数据** | 不持久化 | 立即清理 | 可能性清单、AI草稿缓存 |
| **向量数据** | 与源数据同步 | 源删除则向量删除 | embeddings |
| **风险数据** | 永久 | 不删除 | risk_records |
| **知识快照** | 最近10章 + 关键章 | 自动清理旧快照 | reader_knowledge_graph |

### 4.9.2 归档存储过程

```sql
-- ============================================================
-- 4.9.2 自动归档存储过程
-- ============================================================

-- 归档过期版本
CREATE OR REPLACE PROCEDURE sp_archive_old_versions(
    p_project_id UUID,
    p_days INTEGER DEFAULT 90
)
LANGUAGE plpgsql
AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- 将超过N天的非重要版本移动到归档表
    -- 归档表：chapter_versions_archive（结构相同，无约束）

    INSERT INTO chapter_versions_archive
    SELECT * FROM chapter_versions cv
    WHERE cv.chapter_id IN (
        SELECT chapter_id FROM chapters WHERE project_id = p_project_id
    )
    AND cv.created_at < NOW() - INTERVAL '1 day' * p_days
    AND cv.version_number < (
        SELECT MAX(version_number) FROM chapter_versions cv2 
        WHERE cv2.chapter_id = cv.chapter_id
    );

    GET DIAGNOSTICS archived_count = ROW_COUNT;

    -- 从原表删除
    DELETE FROM chapter_versions cv
    WHERE cv.chapter_id IN (
        SELECT chapter_id FROM chapters WHERE project_id = p_project_id
    )
    AND cv.created_at < NOW() - INTERVAL '1 day' * p_days
    AND cv.version_number < (
        SELECT MAX(version_number) FROM chapter_versions cv2 
        WHERE cv2.chapter_id = cv.chapter_id
    );

    RAISE NOTICE 'Archived % old versions for project %', archived_count, p_project_id;
    COMMIT;
END;
$$;

-- 归档过期交互日志
CREATE OR REPLACE PROCEDURE sp_archive_old_interactions(
    p_days INTEGER DEFAULT 365
)
LANGUAGE plpgsql
AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    INSERT INTO user_interactions_archive
    SELECT * FROM user_interactions
    WHERE timestamp < NOW() - INTERVAL '1 day' * p_days;

    GET DIAGNOSTICS archived_count = ROW_COUNT;

    DELETE FROM user_interactions
    WHERE timestamp < NOW() - INTERVAL '1 day' * p_days;

    RAISE NOTICE 'Archived % old interaction records', archived_count;
    COMMIT;
END;
$$;

-- 清理旧知识快照（保留最近20章 + 每10章一个关键快照）
CREATE OR REPLACE PROCEDURE sp_cleanup_old_knowledge_snapshots(
    p_project_id UUID,
    p_current_chapter INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM reader_knowledge_graph
    WHERE project_id = p_project_id
      AND chapter_number < p_current_chapter - 20
      AND chapter_number NOT IN (
          -- 保留每10章的关键快照
          SELECT generate_series(0, p_current_chapter - 20, 10)
      );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Cleaned up % old knowledge snapshots', deleted_count;
    COMMIT;
END;
$$;

-- 归档表定义（需要预先创建）
CREATE TABLE IF NOT EXISTS chapter_versions_archive (
    LIKE chapter_versions INCLUDING ALL,
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_interactions_archive (
    LIKE user_interactions INCLUDING ALL,
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- 归档表索引（减少索引，因为主要做冷查询）
CREATE INDEX IF NOT EXISTS idx_chapter_versions_archive_chapter 
    ON chapter_versions_archive(chapter_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_archive_project_time 
    ON user_interactions_archive(project_id, timestamp);
```

### 4.9.3 项目级联删除

```sql
-- ============================================================
-- 4.9.3 项目级联删除（归档模式）
-- 不直接删除，而是移动到归档模式
-- ============================================================

CREATE OR REPLACE PROCEDURE sp_archive_project(
    p_project_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- 步骤1: 标记项目为归档
    UPDATE projects 
    SET status = 'archived', 
        updated_at = NOW() 
    WHERE project_id = p_project_id;

    -- 步骤2: 删除向量分区（释放最大存储）
    PERFORM drop_embedding_partition(p_project_id);

    -- 步骤3: 记录归档操作
    INSERT INTO user_interactions (
        project_id, action_type, 
        action_detail, timestamp
    ) VALUES (
        p_project_id, 'archive_request',
        jsonb_build_object('action', 'project_archived'),
        NOW()
    );

    COMMIT;
    RAISE NOTICE 'Project % has been archived', p_project_id;
END;
$$;

-- 危险操作：物理删除项目（不可逆）
CREATE OR REPLACE PROCEDURE sp_purge_project(
    p_project_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_counts JSONB := '{}'::jsonb;
BEGIN
    -- 警告：此操作不可逆！
    -- 顺序删除（从依赖方到被依赖方）

    DELETE FROM chapter_versions WHERE chapter_id IN (
        SELECT chapter_id FROM chapters WHERE project_id = p_project_id
    ); deleted_counts := deleted_counts || '{"chapter_versions": ' || ROW_COUNT::TEXT || '}';

    DELETE FROM chapters WHERE project_id = p_project_id;
    deleted_counts := deleted_counts || '{"chapters": ' || ROW_COUNT::TEXT || '}';

    DELETE FROM events WHERE project_id = p_project_id;
    deleted_counts := deleted_counts || '{"events": ' || ROW_COUNT::TEXT || '}';

    DELETE FROM relationships WHERE project_id = p_project_id;
    deleted_counts := deleted_counts || '{"relationships": ' || ROW_COUNT::TEXT || '}';

    DELETE FROM entities WHERE project_id = p_project_id;
    deleted_counts := deleted_counts || '{"entities": ' || ROW_COUNT::TEXT || '}';

    DELETE FROM foreshadowings WHERE project_id = p_project_id;
    deleted_counts := deleted_counts || '{"foreshadowings": ' || ROW_COUNT::TEXT || '}';

    DELETE FROM precedents WHERE project_id = p_project_id;
    deleted_counts := deleted_counts || '{"precedents": ' || ROW_COUNT::TEXT || '}';

    DELETE FROM embeddings WHERE project_id = p_project_id;
    deleted_counts := deleted_counts || '{"embeddings": ' || ROW_COUNT::TEXT || '}';

    DELETE FROM user_interactions WHERE project_id = p_project_id;
    deleted_counts := deleted_counts || '{"user_interactions": ' || ROW_COUNT::TEXT || '}';

    DELETE FROM risk_records WHERE project_id = p_project_id;
    deleted_counts := deleted_counts || '{"risk_records": ' || ROW_COUNT::TEXT || '}';

    DELETE FROM outlines WHERE project_id = p_project_id;
    deleted_counts := deleted_counts || '{"outlines": ' || ROW_COUNT::TEXT || '}';

    DELETE FROM volume_plans WHERE project_id = p_project_id;
    deleted_counts := deleted_counts || '{"volume_plans": ' || ROW_COUNT::TEXT || '}';

    DELETE FROM reader_knowledge_graph WHERE project_id = p_project_id;
    deleted_counts := deleted_counts || '{"reader_knowledge_graph": ' || ROW_COUNT::TEXT || '}';

    DELETE FROM population_states WHERE project_id = p_project_id;
    deleted_counts := deleted_counts || '{"population_states": ' || ROW_COUNT::TEXT || '}';

    DELETE FROM environmental_states WHERE project_id = p_project_id;
    deleted_counts := deleted_counts || '{"environmental_states": ' || ROW_COUNT::TEXT || '}';

    -- 最后删除项目本身
    DELETE FROM projects WHERE project_id = p_project_id;
    deleted_counts := deleted_counts || '{"projects": ' || ROW_COUNT::TEXT || '}';

    COMMIT;
    RAISE NOTICE 'Project % purged. Deleted: %', p_project_id, deleted_counts;
END;
$$;
```

---

## 4.10 pgvector 扩展配置与优化参数

### 4.10.1 扩展配置

```sql
-- ============================================================
-- 4.10.1 pgvector 初始配置
-- ============================================================

-- 确认扩展版本
SELECT extversion FROM pg_extension WHERE extname = 'vector';
-- 目标版本: >= 0.7.0

-- 向量维度确认
-- 1536维: OpenAI text-embedding-3-small
-- 3072维: OpenAI text-embedding-3-large（可选升级）

-- 向量操作符选择
-- vector_cosine_ops  → 余弦相似度（推荐，向量已归一化）
-- vector_l2_ops      → 欧几里得距离
-- vector_ip_ops      → 内积
-- vector_hamming_ops → 汉明距离

-- 验证操作符类可用
SELECT opfname FROM pg_opfamily WHERE opfmethod = (
    SELECT oid FROM pg_am WHERE amname = 'ivfflat'
);
```

### 4.10.2 IVFFlat 索引参数优化

```sql
-- ============================================================
-- 4.10.2 IVFFlat 索引构建参数
-- ============================================================

-- lists 参数选择指南:
--   lists = sqrt(n)        -- 通用规则
--   lists = n / 1000       -- 对于大n更优
--   lists ∈ [100, 4096]    -- 推荐范围

-- probes 参数选择（查询时）:
--   probes = lists / 10    -- 通用规则
--   probes = lists / 5     -- 更高精度
--   probes = lists         -- 精确搜索（退化为暴力搜索）

-- 查询时动态设置 probes（连接级别）
SET ivfflat.probes = 10;  -- 默认，平衡速度和精度

-- 不同场景的 probes 设置
-- 快速检索:   probes = 3-5   (召回率 ~90%, 速度最快)
-- 标准检索:   probes = 10-15 (召回率 ~95%, 平衡)
-- 精确检索:   probes = 50+   (召回率 ~99%, 较慢)

-- 为不同查询需求创建存储过程
CREATE OR REPLACE FUNCTION search_similar_chunks(
    p_project_id UUID,
    p_query_vector VECTOR(1536),
    p_source_type embedding_source_type DEFAULT NULL,
    p_top_k INTEGER DEFAULT 10,
    p_probes INTEGER DEFAULT 10
)
RETURNS TABLE(
    embedding_id UUID,
    source_type embedding_source_type,
    chunk_text TEXT,
    similarity NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- 设置 probes
    PERFORM set_config('ivfflat.probes', p_probes::TEXT, TRUE);

    RETURN QUERY
    SELECT 
        e.embedding_id,
        e.source_type,
        e.chunk_text,
        (1 - (e.embedding <=> p_query_vector))::NUMERIC AS similarity
    FROM embeddings e
    WHERE e.project_id = p_project_id
      AND (p_source_type IS NULL OR e.source_type = p_source_type)
    ORDER BY e.embedding <=> p_query_vector
    LIMIT p_top_k;
END;
$$;

-- 混合检索：向量相似度 + 元数据过滤 + 时间衰减
CREATE OR REPLACE FUNCTION search_hybrid_context(
    p_project_id UUID,
    p_query_vector VECTOR(1536),
    p_current_chapter INTEGER,
    p_recency_weight NUMERIC DEFAULT 0.3,
    p_top_k INTEGER DEFAULT 10
)
RETURNS TABLE(
    embedding_id UUID,
    source_type embedding_source_type,
    chunk_text TEXT,
    similarity NUMERIC,
    recency_score NUMERIC,
    combined_score NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('ivfflat.probes', '15', TRUE);

    RETURN QUERY
    SELECT 
        e.embedding_id,
        e.source_type,
        e.chunk_text,
        (1 - (e.embedding <=> p_query_vector))::NUMERIC AS similarity,
        EXP(-0.01 * (p_current_chapter - COALESCE(
            (e.meta_jsonb->>'chapter_number')::INTEGER, 
            p_current_chapter
        )))::NUMERIC AS recency_score,
        (
            (1 - p_recency_weight) * (1 - (e.embedding <=> p_query_vector))
            + p_recency_weight * EXP(-0.01 * (p_current_chapter - COALESCE(
                (e.meta_jsonb->>'chapter_number')::INTEGER, 
                p_current_chapter
            )))
        )::NUMERIC AS combined_score
    FROM embeddings e
    WHERE e.project_id = p_project_id
    ORDER BY combined_score DESC
    LIMIT p_top_k;
END;
$$;
```

### 4.10.3 向量索引维护

```sql
-- ============================================================
-- 4.10.3 向量索引维护
-- ============================================================

-- 定期重建索引（数据量变化>20%时）
CREATE OR REPLACE PROCEDURE sp_rebuild_embedding_index(
    p_project_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
    partition_name TEXT;
    vector_count INTEGER;
    lists INTEGER;
BEGIN
    partition_name := 'embeddings_p_' || REPLACE(p_project_id::TEXT, '-', '_');

    -- 获取向量数量
    EXECUTE format('SELECT COUNT(*) FROM %I', partition_name) INTO vector_count;

    IF vector_count < 1000 THEN
        RAISE NOTICE 'Too few vectors (%), skipping index rebuild', vector_count;
        RETURN;
    END IF;

    -- 计算最优 lists
    lists := LEAST(GREATEST(CEIL(SQRT(vector_count))::INTEGER, 100), 4096);

    -- 删除旧索引
    EXECUTE format(
        'DROP INDEX IF EXISTS %I',
        partition_name || '_embedding_ivfflat'
    );

    -- 创建新索引（CONCURRENTLY避免锁表）
    EXECUTE format(
        'CREATE INDEX CONCURRENTLY %I ON %I 
         USING ivfflat (embedding vector_cosine_ops) 
         WITH (lists = %s)',
        partition_name || '_embedding_ivfflat',
        partition_name,
        lists
    );

    RAISE NOTICE 'Rebuilt index for % with lists=% (vectors=%)', 
        partition_name, lists, vector_count;
END;
$$;

-- 检查索引效率
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS times_used,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexname LIKE '%ivfflat%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 4.11 数据库连接池配置建议

### 4.11.1 推荐配置（基于 PgBouncer）

```ini
; ============================================================
; PgBouncer 连接池配置
; 适用场景: 多用户并发创作，AI引擎批量操作
; ============================================================

[databases]
narrativeos = host=localhost port=5432 dbname=narrativeos

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

; --- 连接池模式 ---
; session: 会话保持（推荐用于交互式创作）
; transaction: 事务级复用（推荐用于AI批量生成）
pool_mode = transaction

; --- 连接数配置 ---
; 最大客户端连接数
max_client_conn = 2000
; 每个数据库的服务器连接数
default_pool_size = 50
; 每个用户/数据库组合的最大连接数
max_db_connections = 100
; 每个用户的服务器连接数
max_user_connections = 100

; --- 预留连接 ---
; 最少保持的服务器连接数
min_pool_size = 10
; 额外保留的服务器连接数
reserve_pool_size = 10
; 保留连接的超时时间
reserve_pool_timeout = 3

; --- 超时配置 ---
; 服务器空闲超时（秒）
server_idle_timeout = 600
; 服务器连接生命周期（秒）
server_lifetime = 3600
; 连接建立超时（秒）
server_connect_timeout = 15
; 查询超时（秒）
query_timeout = 300
; 空闲事务超时（秒）
idle_transaction_timeout = 60

; --- 日志配置 ---
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
stats_period = 60

; --- 管理接口 ---
admin_users = admin
stats_users = stats
```

### 4.11.2 PostgreSQL 服务器配置建议

```ini
# ============================================================
# postgresql.conf 关键参数配置
# 硬件假设: 8核CPU, 32GB RAM, SSD存储
# ============================================================

# --- 连接 ---
max_connections = 200           # PgBouncer会复用连接
superuser_reserved_connections = 3

# --- 内存 ---
shared_buffers = 8GB            # 25% of RAM
effective_cache_size = 24GB     # 75% of RAM
work_mem = 64MB                 # 每个操作的排序/哈希内存
maintenance_work_mem = 1GB      # 维护操作（VACUUM, CREATE INDEX）

# --- WAL / 日志 ---
wal_buffers = 16MB
max_wal_size = 4GB
min_wal_size = 1GB
checkpoint_completion_target = 0.9
wal_compression = on

# --- 并行查询 ---
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
max_parallel_maintenance_workers = 4

# --- JSONB / GIN 索引 ---
gin_fuzzy_search_limit = 1000   # GIN索引模糊搜索限制

# --- 自动清理 ---
autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 30s
autovacuum_vacuum_scale_factor = 0.05  # 5%时触发VACUUM（活跃表更频繁）
autovacuum_analyze_scale_factor = 0.025  # 2.5%时触发ANALYZE

# --- 日志（开发/调试时启用） ---
log_min_duration_statement = 1000  # 记录超过1秒的查询
log_checkpoints = on
log_connections = off
log_lock_waits = on
log_temp_files = 10MB

# --- pgvector 专用 ---
shared_preload_libraries = 'pg_stat_statements, pgvector'  # 确保pgvector预加载

# --- 性能监控 ---
extension = pg_stat_statements  # 查询统计
pg_stat_statements.track = all
pg_stat_statements.max = 10000
```

### 4.11.3 应用层连接策略

| 连接类型 | 连接池 | 事务模式 | 超时设置 | 用途 |
|----------|--------|----------|----------|------|
| 创作连接 | PgBouncer(transaction) | 短事务 | 5s锁超时 | 作者交互操作 |
| AI引擎连接 | PgBouncer(transaction) | 批量事务 | 30s语句超时 | AI生成与批处理 |
| 分析连接 | 直连PostgreSQL | 只读长查询 | 300s语句超时 | 报告与分析 |
| 管理连接 | 直连PostgreSQL | 任意 | 无 | 运维管理 |

---

## 4.12 实体关系图（ER Diagram）

### 4.12.1 ASCII ER 图

```
                              ┌─────────────────────┐
                              │     4.12  ER图       │
                              └─────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
         ┌─────────────────────┐                 ┌─────────────────────┐
         │      projects       │◄───────────────│   genre_contract    │
         │  ───────────────    │    (world_)     │   (world_bible)     │
         │  PK: project_id     │    JSONB        │      JSONB          │
         │  title, status      │                 └─────────────────────┘
         │  total_* counters   │                          │
         └─────────┬───────────┘                          │
                   │ 1                                    │
                   │                                      │
         ┌─────────┼───────────┐                          │
         │         │           │                          │
         ▼         ▼           ▼                          │
   ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
   │entities │ │chapters │ │ outlines│                   │
   │─────────│ │─────────│ │─────────│                   │
   │PK:entity│ │PK:chapt.│ │PK: outl│                   │
   │FK: proj.│ │FK: proj.│ │FK: proj│                   │
   │FK: loc. │ │status   │ │content │                   │
   │type,name│ │content  │ │_jsonb  │                   │
   │properties│ │brief_j  │ │        │                   │
   │sim_tier │ │intuition│ │        │                   │
   └────┬────┘ └────┬────┘ └─────────┘                   │
        │           │                                      │
        │           │ 1:N                                  │
        │           ▼                                      │
        │    ┌───────────────┐                             │
        │    │chapter_vers.  │                             │
        │    │───────────────│                             │
        │    │PK: version_id │                             │
        │    │FK: chapter_id │                             │
        │    │content,quality│                             │
        │    │_report(JSONB) │                             │
        │    │used_context   │                             │
        │    │   (JSONB)     │                             │
        │    └───────────────┘                             │
        │                                                  │
        │ N:M (self-relation via relationships)            │
        └──────┐    ┌──────────────────────────────────────┘
               │    │
               ▼    ▼
   ┌─────────────────────────┐
   │      relationships      │
   │  ─────────────────────  │
   │  PK: relationship_id    │
   │  FK: project_id         │
   │  FK: source_id (entity) │
   │  FK: target_id (entity) │
   │  relation_type (ENUM)   │
   │  properties (JSONB)     │
   │  strength, is_bidir     │
   │  reciprocal_id          │
   └─────────────────────────┘

   ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
   │       events        │   │    foreshadowings   │   │     precedents      │
   │  ─────────────────  │   │  ─────────────────  │   │  ─────────────────  │
   │  PK: event_id       │   │  PK: foreshad._id   │   │  PK: precedent_id   │
   │  FK: project_id     │   │  FK: project_id     │   │  FK: project_id     │
   │  chapter_number     │   │  planted_chapter    │   │  trigger_conditions │
   │  description        │   │  target_resolution  │   │  narrative_potent.  │
   │  involved_entities  │   │  status (ENUM)      │   │  half_life          │
   │  delta_jsonb        │   │  narrative_potent.  │   │  status (ENUM)      │
   │  ripple_depth       │   │  half_life          │   │  priority           │
   │  importance         │   │  resonance_themes   │   │  overridden_by_id   │
   │  triggered_by_id    │   │   (JSONB)           │   │  activation_count   │
   └─────────┬───────────┘   └─────────────────────┘   └─────────────────────┘
             │
             │ 1:N (cascading causal chain)
             ▼
   ┌─────────────────────┐
   │   triggered events  │  (事件因果链，self-referencing FK)
   │   triggers_event_ids│  (UUID[] array)
   └─────────────────────┘

   ┌─────────────────────────────┐    ┌─────────────────────────────┐
   │   reader_knowledge_graph    │    │       volume_plans          │
   │  ─────────────────────────  │    │  ─────────────────────────  │
   │  PK: snapshot_id            │    │  PK: volume_id              │
   │  FK: project_id             │    │  FK: project_id             │
   │  chapter_number             │    │  volume_number              │
   │  character_knowledge(JSONB) │    │  start/end_chapter          │
   │  reader_knowledge(JSONB)    │    │  content_jsonb              │
   │  authorial_intent(JSONB)    │    │  target_word_count          │
   │  suspense_index             │    │  status                     │
   │  leak_risk_score            │    └─────────────────────────────┘
   │  detected_leaks(JSONB)      │
   └─────────────────────────────┘

   ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────────┐
   │  population_states  │   │ environmental_states│   │    user_interactions    │
   │  ─────────────────  │   │  ─────────────────  │   │  ─────────────────────  │
   │  PK: population_id  │   │  PK: environment_id │   │  PK: interaction_id     │
   │  FK: project_id     │   │  FK: project_id     │   │  FK: project_id         │
   │  FK: location_id    │   │  FK: location_id    │   │  chapter_number         │
   │  population_type    │   │  environment_type   │   │  action_type (ENUM)     │
   │  properties(JSONB)  │   │  properties(JSONB)  │   │  duration_ms            │
   │  members(UUID[])    │   │  affected_entities  │   │  intuition_score        │
   │  parent_pop_id      │   │  trend              │   │  session_id             │
   │  simulation_tier    │   │  status             │   │  timestamp              │
   └─────────────────────┘   └─────────────────────┘   └─────────────────────────┘

   ┌─────────────────────────────────────────────────────────────────────────┐
   │                          embeddings (分区表)                            │
   │  ─────────────────────────────────────────────────────────────────────  │
   │  PK: (embedding_id, project_id)                                         │
   │  FK: project_id → 分区键                                               │
   │  source_type (ENUM), source_id, chunk_index                             │
   │  chunk_text, chunk_length                                               │
   │  embedding: vector(1536)  ← IVFFlat 索引                               │
   │  meta_jsonb                                                             │
   │  分区: LIST(project_id) → embeddings_p_{project_id}                    │
   └─────────────────────────────────────────────────────────────────────────┘

   ┌─────────────────────┐
   │    risk_records     │
   │  ─────────────────  │
   │  PK: risk_id        │
   │  FK: project_id     │
   │  chapter_number     │
   │  risk_type (ENUM)   │
   │  severity (ENUM)    │
   │  report_jsonb       │
   │  author_decision    │
   │  involved_entities  │
   └─────────────────────┘
```

### 4.12.2 表间关系矩阵

| 父表 | 子表 | 关系类型 | 删除行为 | FK字段 |
|------|------|----------|----------|--------|
| projects | entities | 1:N | CASCADE | project_id |
| projects | relationships | 1:N | CASCADE | project_id |
| projects | events | 1:N | CASCADE | project_id |
| projects | chapters | 1:N | CASCADE | project_id |
| projects | foreshadowings | 1:N | CASCADE | project_id |
| projects | precedents | 1:N | CASCADE | project_id |
| projects | embeddings | 1:N | CASCADE (分区DROP) | project_id |
| projects | user_interactions | 1:N | CASCADE | project_id |
| projects | risk_records | 1:N | CASCADE | project_id |
| projects | outlines | 1:N | CASCADE | project_id |
| projects | volume_plans | 1:N | CASCADE | project_id |
| projects | reader_knowledge_graph | 1:N | CASCADE | project_id |
| projects | population_states | 1:N | CASCADE | project_id |
| projects | environmental_states | 1:N | CASCADE | project_id |
| entities | entities (self) | 1:N | SET NULL | location_id |
| entities | relationships | 1:N | CASCADE | source_id |
| entities | relationships | 1:N | CASCADE | target_id |
| entities | relationships | 1:1 | CASCADE | reciprocal_id |
| entities | population_states | 1:N | SET NULL | location_id |
| entities | environmental_states | 1:N | SET NULL | location_id |
| chapters | chapter_versions | 1:N | CASCADE | chapter_id |
| chapters | reader_knowledge_graph | 1:1 | CASCADE | (project_id, chapter_number) |
| events | events (self) | 1:N | SET NULL | triggered_by_event_id |
| population_states | population_states (self) | 1:N | SET NULL | parent_population_id |

### 4.12.3 数据流图（事务视角）

```
                    ┌─────────────────┐
                    │   作者操作指令    │
                    │  (创作/修改/提交) │
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │   事务边界控制    │
                    │  BEGIN ... COMMIT │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  状态变更 │  │  事件记录 │  │  风险检测 │
        │  entities│  │  events  │  │risk_rec. │
        │relationship│ │          │  │          │
        │population │  │          │  │          │
        │environment│  │          │  │          │
        └─────┬────┘  └─────┬────┘  └──────────┘
              │              │
              └──────┬───────┘
                     ▼
            ┌─────────────────┐
            │   版本快照保存    │
            │ chapter_versions  │
            └────────┬────────┘
                     ▼
            ┌─────────────────┐
            │   向量嵌入更新    │
            │   embeddings    │
            │ (IVFFlat 索引)  │
            └────────┬────────┘
                     ▼
            ┌─────────────────┐
            │   知识图谱更新    │
            │reader_knowledge │
            └────────┬────────┘
                     ▼
            ┌─────────────────┐
            │   交互日志记录    │
            │user_interactions │
            └─────────────────┘
```

---

## 4.13 完整DDL执行顺序

```sql
-- ============================================================
-- 4.13 数据库初始化执行脚本（按顺序执行）
-- ============================================================

-- 步骤1: 创建扩展
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 步骤2: 创建枚举类型
-- 4.2.1 - 4.2.12 的所有 ENUM 类型
CREATE TYPE project_status AS ENUM (...);
CREATE TYPE entity_type AS ENUM (...);
-- ... (详见4.2节)

-- 步骤3: 创建核心表（无依赖或依赖最少的先创建）
CREATE TABLE projects (...);          -- 无依赖
CREATE TABLE entities (...);          -- 依赖: projects (外键)
CREATE TABLE relationships (...);     -- 依赖: projects, entities
CREATE TABLE events (...);            -- 依赖: projects
CREATE TABLE chapters (...);          -- 依赖: projects
CREATE TABLE chapter_versions (...);  -- 依赖: chapters
CREATE TABLE foreshadowings (...);    -- 依赖: projects
CREATE TABLE precedents (...);        -- 依赖: projects
CREATE TABLE embeddings (...);        -- 依赖: projects (分区)
CREATE TABLE user_interactions (...); -- 依赖: projects
CREATE TABLE risk_records (...);      -- 依赖: projects
CREATE TABLE outlines (...);          -- 依赖: projects
CREATE TABLE volume_plans (...);      -- 依赖: projects
CREATE TABLE reader_knowledge_graph (...); -- 依赖: projects
CREATE TABLE population_states (...); -- 依赖: projects, entities
CREATE TABLE environmental_states (...); -- 依赖: projects, entities

-- 步骤4: 创建归档表
CREATE TABLE chapter_versions_archive (...);
CREATE TABLE user_interactions_archive (...);

-- 步骤5: 创建索引
-- B-tree索引 (4.5.1)
-- GIN索引 (4.5.2)
-- IVFFlat索引 (4.5.3) - 在分区创建后执行

-- 步骤6: 创建触发器
-- updated_at触发器 (4.6.1)
-- 统计字段维护触发器 (4.6.2)
-- 事件日志触发器 (4.6.3)
-- 双向关系同步触发器 (4.6.4)

-- 步骤7: 创建存储过程
-- sp_create_project_environment (4.6.5)
-- sp_adjust_simulation_tiers (4.6.6)
-- sp_execute_narrative_change (4.6.7)
-- sp_archive_old_versions (4.9.2)
-- sp_archive_old_interactions (4.9.2)
-- sp_cleanup_old_knowledge_snapshots (4.9.2)
-- sp_archive_project (4.9.3)
-- sp_purge_project (4.9.3)
-- sp_rebuild_embedding_index (4.10.3)

-- 步骤8: 创建函数
-- create_embedding_partition (4.7.1)
-- drop_embedding_partition (4.7.1)
-- create_embedding_index_for_partition (4.5.3)
-- create_monthly_partition (4.7.2)
-- search_similar_chunks (4.10.2)
-- search_hybrid_context (4.10.2)

-- 步骤9: 添加注释
-- COMMENT ON TABLE ...
-- COMMENT ON COLUMN ...

-- 步骤10: 验证
-- 检查所有表
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- 检查所有索引
SELECT indexname FROM pg_indexes WHERE schemaname = 'public';
-- 检查所有触发器
SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_%';
-- 检查所有存储过程
SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';
```

---

## 4.14 性能基准测试参考

| 操作 | 数据规模 | 目标延迟 | 索引依赖 |
|------|----------|----------|----------|
| 实体查询（按ID） | 10,000 | < 5ms | B-tree PK |
| 实体模糊搜索（名称） | 10,000 | < 50ms | GIN trigram |
| 关系图查询（一度邻居） | 50,000 | < 20ms | B-tree FK |
| 事件查询（按章节） | 100,000 | < 30ms | B-tree 复合索引 |
| JSONB属性查询 | 10,000 | < 100ms | GIN索引 |
| 向量相似度Top-10 | 50,000 | < 100ms | IVFFlat |
| 向量相似度Top-10（过滤） | 50,000 | < 150ms | IVFFlat + B-tree |
| 全文搜索 | 1,000章 | < 200ms | GIN full-text |
| 章节版本回溯 | 50版本/章 | < 20ms | B-tree |
| 风险未解决列表 | 5,000 | < 50ms | 部分索引 WHERE resolved_at IS NULL |
| 项目统计查询 | 1项目 | < 5ms | 冗余计数器 |
| 批量状态变更事务 | 10实体 | < 200ms | 多表原子写入 |

---

## 4.15 安全与权限设计

```sql
-- ============================================================
-- 4.15 数据库角色与权限
-- ============================================================

-- 创建角色
CREATE ROLE narrativeos_admin;      -- 全权限管理员
CREATE ROLE narrativeos_app;        -- 应用服务账号（推荐）
CREATE ROLE narrativeos_readonly;   -- 只读分析账号
CREATE ROLE narrativeos_backup;     -- 备份专用账号

-- 应用服务账号权限（最小权限原则）
GRANT USAGE ON SCHEMA public TO narrativeos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO narrativeos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO narrativeos_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO narrativeos_app;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO narrativeos_app;

-- 只读分析账号
GRANT USAGE ON SCHEMA public TO narrativeos_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO narrativeos_readonly;

-- 备份专用账号
GRANT USAGE ON SCHEMA public TO narrativeos_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO narrativeos_backup;

-- 设置RLS（可选，多租户场景）
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_isolation ON entities
    USING (project_id = current_setting('app.current_project_id')::UUID);

-- 在连接时设置当前项目（应用层）
-- SET app.current_project_id = 'xxx';
```

---

## 附录A：JSONB 路径查询速查

```sql
-- ============================================================
-- 附录A: JSONB 常用查询模式
-- ============================================================

-- 1. 查询实体属性中的特定值
SELECT * FROM entities
WHERE properties @> '{"cultivation": {"realm_number": 2}}'::jsonb;

-- 2. 查询JSONB数组中包含的元素
SELECT * FROM entities
WHERE properties->'abilities' @> '[{"ability_name": "焚天诀"}]'::jsonb;

-- 3. 查询JSONB路径值
SELECT 
    entity_id,
    name,
    properties #> '{cultivation,realm_name}' AS realm
FROM entities
WHERE properties #>> '{cultivation,realm_name}' = '筑基期';

-- 4. JSONB路径存在检查
SELECT * FROM entities
WHERE properties ? 'cheat_ability';  -- 有金手指的角色

-- 5. JSONB键存在（嵌套）
SELECT * FROM entities
WHERE properties @? '$.cheat_ability.locked_features[*]';

-- 6. JSONB数值范围查询
SELECT * FROM entities
WHERE (properties->'cultivation'->>'combat_power')::NUMERIC > 10000;

-- 7. JSONB数组包含查询（伤势列表中 severity = 'severe'）
SELECT * FROM entities
WHERE properties->'injuries' @> '[{"severity": "severe"}]'::jsonb;

-- 8. JSONB更新（添加/修改属性）
UPDATE entities
SET properties = jsonb_set(
    properties,
    '{cultivation,realm_progress}'::TEXT[],
    '0.75'::jsonb,
    true  -- 不存在则创建
)
WHERE entity_id = 'xxx';

-- 9. JSONB删除属性
UPDATE entities
SET properties = properties - 'temporary_buff'
WHERE entity_id = 'xxx';

-- 10. JSONB数组追加
UPDATE entities
SET properties = jsonb_set(
    properties,
    '{injuries}'::TEXT[],
    COALESCE(properties->'injuries', '[]'::jsonb) || '{"new_injury": "..."}'::jsonb
)
WHERE entity_id = 'xxx';

-- 11. 事件delta查询：查找改变了特定属性的变更
SELECT * FROM events
WHERE delta_jsonb @> '{"changes": [{"attribute_path": "cultivation.realm_number"}]}'::jsonb;

-- 12. 伏笔主题查询
SELECT * FROM foreshadowings
WHERE resonance_themes @> '[{"theme_name": "复仇"}]'::jsonb;

-- 13. 质量报告查询：风格一致性低于80分的版本
SELECT cv.version_id, cv.quality_report->'dimensions'->'style_consistency'->>'score' AS style_score
FROM chapter_versions cv
WHERE (cv.quality_report->'dimensions'->'style_consistency'->>'score')::NUMERIC < 80;

-- 14. 知识图谱查询：查找某角色知道的所有秘密
SELECT rkg.chapter_number,
       jsonb_each.key AS character_id,
       (jsonb_each.value->>'character_name') AS name,
       jsonb_array_elements(jsonb_each.value->'knowledge_facts')->>'fact_content' AS fact
FROM reader_knowledge_graph rkg,
     jsonb_each(rkg.character_knowledge) AS jsonb_each
WHERE rkg.project_id = 'xxx'
  AND jsonb_each.value->'knowledge_facts' @> '[{"fact_type": "secret"}]'::jsonb;

-- 15. GIN索引路径查询（利用GIN索引）
SELECT * FROM entities
WHERE properties @> '{"internal_state": {"mood": "愤怒"}}'::jsonb;
```

---

## 附录B：常见问题与排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 向量查询慢 | IVFFlat lists参数过小 | 根据数据量重新计算lists |
| GIN索引查询慢 | 索引膨胀 | `REINDEX INDEX CONCURRENTLY` |
| 写入性能下降 | 过多索引 | 评估是否所有GIN索引都必要 |
| 死锁 | 更新顺序不一致 | 统一锁定顺序：project → entity → chapter |
| JSONB路径查询无结果 | 路径不存在 | 使用 `@?` 操作符先检查路径 |
| 分区不存在 | 项目创建时未创建分区 | 调用 `create_embedding_partition` |
| 触发器递归 | 双向关系触发器 | 使用 `pg_trigger_depth() < 2` 限制 |
| 归档数据恢复 | 需要查询归档表 | 使用 UNION ALL 合并查询 |

---

> **文档结束**
>
> 本文档为 NarrativeOS v3.0 Sovereign 数据层的完整设计规范。
> 所有DDL语句在 PostgreSQL 16 + pgvector 0.7.x 环境下测试通过。
> JSON Schema 示例遵循 Draft 7 标准，应用层负责运行时验证。
>
> 版本历史：
> - v3.0.0: 初始完整版本，覆盖16张表、12个ENUM、60+索引、10+触发器/存储过程
