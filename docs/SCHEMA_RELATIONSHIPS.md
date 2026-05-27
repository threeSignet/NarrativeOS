# NarrativeOSPlus — 数据表关联关系（ERD）

> 基于 SCHEMA_01_projects.md 与 SCHEMA_02_volumes_chapters.md 梳理
> 状态：🔄 随设计推进持续更新

---

## 一、当前已设计的表

| # | 表名 | 说明 | 主键 |
|---|------|------|------|
| 1 | `projects` | 小说项目 | `id` |
| 2 | `volumes` | 卷 | `id` |
| 3 | `chapters` | 章节 | `id` |
| 4 | `project_daily_stats` | 项目日统计 | `id` |

---

## 二、表关系图（ERD 文字版）

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                               │
│  ┌─────────────────────┐                                                                      │
│  │    projects         │                                                                      │
│  │  ┌──────────────┐  │                                                                      │
│  │  │ id (PK)      │  │◄──────────────────────────────────────────────────────────────────┐   │
│  │  │ ...          │  │                                                                       │   │
│  │  │ status       │  │  1 : N                                                                │   │
│  │  │ total_words  │  │  (cascade delete)                                                    │   │
│  │  └──────────────┘  │◄────────────────────┐                                                  │   │
│  │                    │                    │ 1 : N                                           │   │
│  └─────────────────────┘                    │ (cascade delete)                                 │   │
│                                           │                                                   │   │
│                    1 : N                  │                                                   │   │
│          (cascade delete)                 │                                                   │   │
│                                           ▼                                                   │   │
│  ┌─────────────────────┐     ┌─────────────────────┐     ┌──────────────────────────────┐    │   │
│  │    volumes          │     │    chapters          │     │ project_daily_stats          │    │   │
│  │  ┌──────────────┐   │     │  ┌──────────────┐   │     │  ┌──────────────────────┐   │    │   │
│  │  │ id (PK)      │◄──┼─────┼──│ volume_id    │   │     │  │ id (PK)              │   │    │   │
│  │  │ project_id   │   │     │  │ (FK→volumes) │   │     │  │ project_id (FK)      │   │    │   │
│  │  │ volume_num   │   │     │  │ project_id   │   │     │  │ date                 │   │    │   │
│  │  │ title        │   │ 1:N │  │ chapter_num  │   │     │  │ words_added          │   │    │   │
│  │  │ structure    │   │(set │  │ status       │   │     │  │ chapters_added       │   │    │   │
│  │  │ status       │   │null│  │ ...          │   │     │  │ ...                  │   │    │   │
│  │  └──────────────┘   │  on │  └──────────────┘   │     │  └──────────────────────┘   │    │   │
│  └─────────────────────┘delete│                     │     └──────────────────────────────┘    │   │
│                               │                     │                                        │   │
│                               └─────────────────────┘                                        │   │
│                                                                                                │   │
└────────────────────────────────────────────────────────────────────────────────────────────────┘


关系总览：
═════════════════════════════════════════════════════════════════════
projects.id ──1:N──► volumes.project_id        (ON DELETE CASCADE)
projects.id ──1:N──► chapters.project_id       (ON DELETE CASCADE)
projects.id ──1:N──► project_daily_stats        (ON DELETE CASCADE)
volumes.id  ──1:N──► chapters.volume_id         (ON DELETE SET NULL)
═════════════════════════════════════════════════════════════════════
```

---

## 三、关系详解

### 3.1 projects → volumes（一对多）

| 项目 | 值 |
|------|-----|
| 父表 | `projects` |
| 子表 | `volumes` |
| 关联字段 | `volumes.project_id` → `projects.id` |
| 关系类型 | 一对多（1个项目可有多卷） |
| 级联行为 | `ON DELETE CASCADE` — 删除项目时自动删除所有卷 |
| 约束 | `UNIQUE(project_id, volume_number)` — 同项目内卷号唯一 |

**业务含义**：
- 《创业神话》项目 → 卷1「高三逆袭」、卷2「校园创业」、卷3「商海沉浮」
- 删除项目 → 自动级联删除所有卷记录

---

### 3.2 projects → chapters（一对多，直接关联）

| 项目 | 值 |
|------|-----|
| 父表 | `projects` |
| 子表 | `chapters` |
| 关联字段 | `chapters.project_id` → `projects.id` |
| 关系类型 | 一对多（1个项目可有多章） |
| 级联行为 | `ON DELETE CASCADE` — 删除项目时自动删除所有章节 |
| 约束 | `UNIQUE(project_id, chapter_number)` — 同项目内章节号唯一 |

**业务含义**：
- 《创业神话》 → 第1章「重生2005」、第2章「记忆融合」... 第1000章「终章」
- 删除项目 → 自动级联删除所有章节

**为什么同时保留 volume_id 和 project_id？**
- `volume_id` 允许 NULL：章节可以暂时不分卷（创建时未指定卷）
- `project_id` 不为 NULL：每章必须属于某个项目（即使未分卷）
- `project_id` 冗余但方便查询：查某项目全部章节无需 JOIN volumes

---

### 3.3 volumes → chapters（一对多）

| 项目 | 值 |
|------|-----|
| 父表 | `volumes` |
| 子表 | `chapters` |
| 关联字段 | `chapters.volume_id` → `volumes.id` |
| 关系类型 | 一对多（1卷可有多章） |
| 级联行为 | `ON DELETE SET NULL` — 删除卷时，章节变为"未分卷"状态 |
| 约束 | `UNIQUE(project_id, chapter_number)` 仍生效 |

**业务含义**：
- 卷1「高三逆袭」 → 第1-100章
- 删除卷1 → 第1-100章的 `volume_id` 自动设为 NULL，但章节本身保留（变成游离章节）
- 之后可重新分配到其他卷

---

### 3.4 projects → project_daily_stats（一对多）

| 项目 | 值 |
|------|-----|
| 父表 | `projects` |
| 子表 | `project_daily_stats` |
| 关联字段 | `project_daily_stats.project_id` → `projects.id` |
| 关系类型 | 一对多（1个项目每天一条记录） |
| 级联行为 | `ON DELETE CASCADE` — 删除项目时删除所有日统计 |
| 约束 | `UNIQUE(project_id, date)` — 同一天只一条记录 |

**业务含义**：
- 《创业神话》 → 2026-05-01: 写了3000字、2026-05-02: 写了5000字...
- 用于生成写作趋势图、连续更新天数、字数统计

---

## 四、数据流向图

```
作者操作
    │
    ├─→ 创建项目 → INSERT projects
    │       │
    │       └─→ 项目级统计初始化 → INSERT project_daily_stats (首日)
    │
    ├─→ 添加卷 → INSERT volumes (project_id = 项目ID)
    │       │
    │       └─→ 更新 projects.total_volumes += 1
    │
    ├─→ 创建章节 → INSERT chapters
    │       │
    │       ├─→ project_id = 项目ID
    │       ├─→ volume_id = 卷ID (可为NULL)
    │       ├─→ chapter_number = 全局递增
    │       │
    │       └─→ 更新统计：
    │               projects.total_chapters += 1
    │               projects.latest_chapter_number = N
    │               projects.latest_chapter_id = 章节ID
    │               volumes.total_chapters += 1
    │               project_daily_stats.chapters_added += 1
    │
    ├─→ 写正文 → 写入文件系统
    │       │
    │       └─→ 更新 chapters.actual_words
    │               projects.total_words += Δ
    │               project_daily_stats.words_added += Δ
    │
    ├─→ 提交冻结 → UPDATE chapters.status = 'frozen'
    │       │
    │       ├─→ volumes.frozen_chapters += 1
    │       ├─→ 检查：volumes.frozen_chapters == volumes.total_chapters ?
    │       │       是 → volumes.status = 'completed'
    │       └─→ 触发 Memory 引擎异步提取事件
    │
    └─→ 删除项目 → DELETE projects (cascade)
            │
            ├─→ volumes 级联删除
            ├─→ chapters 级联删除
            ├─→ project_daily_stats 级联删除
            └─→ 正文文件需单独清理（业务层处理）
```

---

## 五、索引策略总览

### 5.1 projects 表索引

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `idx_projects_status` | `status` | 按状态筛选（如列出"写作中"的项目） |
| `idx_projects_novel_type` | `novel_type` | 按类型筛选（如列出"都市"小说） |
| `idx_projects_platform` | `platform_name` | 按平台筛选 |
| `idx_projects_created_at` | `created_at DESC` | 最近创建的项目 |
| `idx_projects_updated_at` | `updated_at DESC` | 最近活跃的项目 |

### 5.2 volumes 表索引

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `idx_volumes_project` | `project_id` | 查某项目的所有卷 |
| `idx_volumes_status` | `status` | 按卷状态筛选 |
| `idx_volumes_number` | `project_id, volume_number` | 卷号排序 |

### 5.3 chapters 表索引

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `idx_chapters_project` | `project_id` | 查某项目的所有章节 |
| `idx_chapters_volume` | `volume_id` | 查某卷的所有章节 |
| `idx_chapters_status` | `status` | 按章节状态筛选 |
| `idx_chapters_number` | `project_id, chapter_number` | 全局排序 |
| `idx_chapters_frozen` | `project_id, frozen_at DESC` | 最近冻结的章节 |

### 5.4 project_daily_stats 表索引

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `idx_project_stats_project_date` | `project_id, date DESC` | 某项目的日统计排序 |
| `idx_project_stats_date` | `date DESC` | 全局日统计 |

---

## 六、约束检查清单

### 6.1 唯一约束

| 表 | 约束 | 说明 |
|------|------|------|
| `volumes` | `UNIQUE(project_id, volume_number)` | 同项目内卷号唯一 |
| `chapters` | `UNIQUE(project_id, chapter_number)` | 同项目内章节号唯一 |
| `project_daily_stats` | `UNIQUE(project_id, date)` | 同项目同一天只一条记录 |

### 6.2 外键约束

| 子表 | 字段 | 父表 | 级联行为 |
|------|------|------|---------|
| `volumes` | `project_id` | `projects` | CASCADE |
| `chapters` | `project_id` | `projects` | CASCADE |
| `chapters` | `volume_id` | `volumes` | SET NULL |
| `project_daily_stats` | `project_id` | `projects` | CASCADE |

### 6.3 CHECK 约束（业务规则）

| 表 | 字段 | CHECK | 说明 |
|------|------|-------|------|
| `projects` | `status` | 9种枚举值 | 项目生命周期 |
| `projects` | `novel_type` | 14种枚举值 | 小说类型 |
| `projects` | `publish_status` | 5种枚举值 | 发布状态 |
| `volumes` | `status` | 5种枚举值 | 卷生命周期 |
| `volumes` | `structure_mode` | 6种枚举值 | 情节结构模式 |
| `chapters` | `status` | 8种枚举值 | 章节生命周期 |
| `chapters` | `emotion_overall` | 9种枚举值 | 情绪类型 |
| `chapters` | `last_ai_action` | 10种枚举值 | AI操作类型 |

---

## 七、未来新增表的位置（预留）

后续设计完成后，关系图会扩展为：

```
projects
    │ 1:N
    ├─→ volumes
    │       │ 1:N
    │       └─→ chapters
    │               │ 1:N
    │               ├─→ chapter_versions (Retcon历史版本)
    │               └─→ emotion_points (拆分JSON为独立表?)
    │
    ├─→ characters (角色)
    ├─→ locations (地点)
    ├─→ factions (势力)
    ├─→ items (物品)
    ├─→ techniques (功法)
    ├─→ currencies (货币)
    ├─→ power_systems (力量体系)
    ├─→ historical_events (历史事件)
    ├─→ world_rules (世界规则)
    │
    ├─→ outlines (大纲)
    │       │ 1:N
    │       └─→ outline_items (章节级细纲)
    │
    ├─→ foreshadowings (伏笔)
    ├─→ experienced_events (已经历事件线)
    ├─→ character_states (角色状态快照)
    │
    ├─→ proposals (MOU提案)
    │       │ 1:N
    │       └─→ human_events (作者决策)
    │
    ├─→ rules (自定义规则)
    ├─→ model_configs (模型配置)
    ├─→ llm_calls (LLM调用日志)
    │
    └─→ project_daily_stats (日统计)
```

---

> 如有关系理解错误或需要调整级联策略，直接说。确认后我们继续设计下一个表。
