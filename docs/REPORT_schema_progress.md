# NarrativeOSPlus — 数据库设计阶段汇报

> 汇报日期：2026-05-21
> 已完成表数：7张表
> 已完成文档：7份

---

## 一、已完成文档清单

| # | 文档 | 说明 | 状态 |
|---|------|------|------|
| 1 | `docs/ARCHITECTURE.md` | 系统架构蓝图（五大引擎、MOU状态机、向量化设计） | ✅ |
| 2 | `docs/SCHEMA_DESIGN.md` | 数据库设计总览（30张表规划 + 4个待讨论问题） | ✅ |
| 3 | `docs/SCHEMA_01_projects.md` | 项目表设计（projects + daily_stats） | ✅ |
| 4 | `docs/SCHEMA_02_volumes_chapters.md` | 卷/章节表设计（volumes + chapters） | ✅ |
| 5 | `docs/SCHEMA_03_outlines.md` | 大纲表设计（outlines + outline_items） | ✅ |
| 6 | `docs/SCHEMA_RELATIONSHIPS.md` | 表关联关系总览（ERD文字版） | ✅ |
| 7 | `docs/JSON_SCHEMA_SPEC.md` | JSON字段Schema规范（Zod校验规则） | ✅ |

---

## 二、已完成表结构（7张表）

### 表1：projects（小说项目）

| 类别 | 字段 | 类型 | 说明 |
|------|------|------|------|
| 主键 | `id` | TEXT | 主键 |
| 基础 | `title` | TEXT | 小说标题 |
| 基础 | `subtitle` | TEXT | 副标题 |
| 基础 | `author_pen_name` | TEXT | 笔名 |
| 基础 | `author_real_name` | TEXT | 真名（签约用） |
| 基础 | `author_qq/phone/email` | TEXT | 联系方式 |
| 类型 | `novel_type` | TEXT | 14种类型枚举（仙侠/都市/科幻...） |
| 类型 | `novel_sub_type` | TEXT | 子类型标签，逗号分隔 |
| 类型 | `core_concept` | TEXT | **核心创意**（必填） |
| 类型 | `tags` | TEXT(JSON) | 标签数组 ✅ |
| 类型 | `target_audience` | TEXT | 目标读者（男频/女频...） |
| 类型 | `synopsis` | TEXT | 小说简介 |
| 平台 | `platform_name` | TEXT | 发布平台（起点/番茄...） |
| 平台 | `platform_account` | TEXT | 平台账号 |
| 平台 | `platform_password_encrypted` | TEXT | 密码（AES-256-GCM加密） |
| 平台 | `platform_nickname` | TEXT | 平台笔名 |
| 平台 | `platform_status` | TEXT | 8种平台状态 |
| 平台 | `auto_sync` | INTEGER | 是否自动同步 |
| 平台 | `sync_mode` | TEXT | 同步模式 |
| 目标 | `target_total_words` | INTEGER | 目标总字数 |
| 目标 | `target_chapter_count` | INTEGER | 目标章节数 |
| 目标 | `target_daily_words` | INTEGER | 日更目标（默认2000） |
| 目标 | `target_chapter_words` | INTEGER | 每章目标（默认3000） |
| 目标 | `target_volume_count` | INTEGER | 目标卷数 |
| 目标 | `words_per_volume` | INTEGER | 每卷字数 |
| 状态 | `status` | TEXT | 9种项目状态 |
| 配置 | `default_model_id` | TEXT | 默认LLM模型 |
| 配置 | `default_writing_style` | TEXT | 6种写作风格 |
| 配置 | `default_pace` | TEXT | 叙事节奏（快/中/慢） |
| 配置 | `default_content_focus` | TEXT(JSON) | 内容侧重 ✅ |
| 配置 | `custom_rules` | TEXT(JSON) | 规则ID列表 ✅ |
| 统计 | `total_words` | INTEGER | 当前总字数 |
| 统计 | `total_chapters` | INTEGER | 当前章节数 |
| 统计 | `total_volumes` | INTEGER | 当前卷数 |
| 统计 | `latest_chapter_number` | INTEGER | 最新章节编号 |
| 统计 | `latest_chapter_id` | TEXT | 最新章节ID |
| 统计 | `words_today/week/month` | INTEGER | 时段字数 |
| 统计 | `words_trend` | TEXT(JSON) | 7天字数趋势 ✅ |
| 统计 | `streak_days` | INTEGER | 连续更新天数 |
| 统计 | `max_streak_days` | INTEGER | 最高连续记录 |
| 文件 | `cover_image` | TEXT | 封面图路径 |
| 文件 | `manuscript_path` | TEXT | 正文存储目录 |
| 时间 | `created_at` | TEXT | 创建时间 |
| 时间 | `updated_at` | TEXT | 更新时间 |
| 审计 | `created_by` | TEXT | 创建者 |

**约束**：
- 唯一：`UNIQUE(platform_name, project_id)` — 一个项目一个平台
- 索引：`status` / `novel_type` / `platform_name` / `created_at` / `updated_at`

---

### 表2：project_daily_stats（项目日统计）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 主键 |
| `project_id` | TEXT(FK) | 关联项目 |
| `date` | TEXT | 日期 YYYY-MM-DD |
| `words_added` | INTEGER | 当日新增字数 |
| `chapters_added` | INTEGER | 当日新增章节数 |
| `words_deleted` | INTEGER | 当日删除字数 |
| `words_edited` | INTEGER | 当日修改字数 |
| `writing_minutes` | INTEGER | 写作时长（分钟） |
| `ai_calls` | INTEGER | AI调用次数 |
| `proposals_generated/approved/rejected` | INTEGER | 提案统计 |
| `total_words_at_eod` | INTEGER | 日终总字数 |
| `total_chapters_at_eod` | INTEGER | 日终章节数 |

**约束**：`UNIQUE(project_id, date)`

---

### 表3：volumes（卷）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 主键 |
| `project_id` | TEXT(FK) | 关联项目 |
| `volume_number` | INTEGER | 卷号（1,2,3...） |
| `title` | TEXT | 卷标题 |
| `subtitle` | TEXT | 副标题 |
| `description` | TEXT | 卷简介 |
| `planned_start_chapter` | INTEGER | 计划起始章节 |
| `planned_end_chapter` | INTEGER | 计划结束章节 |
| `planned_chapter_count` | INTEGER | 计划本章数 |
| `target_words` | INTEGER | 本卷目标字数 |
| `target_arc` | TEXT | 本卷核心弧线 |
| `structure_mode` | TEXT | 情节结构（五幕式/三幕式/英雄之旅...） |
| `structure_acts` | TEXT(JSON) | **幕结构详情** ✅ |
| `status` | TEXT | 5种卷状态 |
| `total_chapters` | INTEGER | 实际章节数 |
| `total_words` | INTEGER | 实际字数 |
| `completed_chapters` | INTEGER | 已完成数 |
| `frozen_chapters` | INTEGER | 已冻结数 |
| `created_at` / `updated_at` / `started_at` / `completed_at` | TEXT | 时间 |

**约束**：`UNIQUE(project_id, volume_number)`

---

### 表4：chapters（章节）

| 类别 | 字段 | 类型 | 说明 |
|------|------|------|------|
| 主键 | `id` | TEXT | 主键 |
| 关联 | `project_id` | TEXT(FK) | 关联项目（非NULL） |
| 关联 | `volume_id` | TEXT(FK) | 关联卷（可为NULL=未分卷） |
| 位置 | `chapter_number` | INTEGER | 全局章节编号（跨卷连续） |
| 位置 | `volume_chapter_number` | INTEGER | 卷内编号 |
| 标题 | `title` | TEXT | 章节标题 |
| 标题 | `subtitle` | TEXT | 副标题 |
| 内容 | `content_path` | TEXT | 正文文件路径 |
| 内容 | `content_summary` | TEXT | 章节摘要（200字） |
| 字数 | `target_words` | INTEGER | 目标字数（默认3000） |
| 字数 | `actual_words` | INTEGER | 实际字数 |
| 字数 | `ai_generated_words` | INTEGER | AI生成字数 |
| 字数 | `human_written_words` | INTEGER | 人工字数 |
| 状态 | `status` | TEXT | **8种状态**：draft/reviewing/pending_proposal/frozen/published/retcon_pending/retcon_reviewing/archived |
| 情绪 | `emotion_overall` | TEXT | 整体情绪基调（9种） |
| 情绪 | `emotion_points` | TEXT(JSON) | **情绪控制点数组** ✅ |
| 出场 | `appearing_characters` | TEXT(JSON) | 出场角色ID ✅ |
| 出场 | `appearing_items` | TEXT(JSON) | 出场物品ID ✅ |
| 出场 | `appearing_locations` | TEXT(JSON) | 出场地点ID ✅ |
| 出场 | `appearing_techniques` | TEXT(JSON) | 出场功法ID ✅ |
| 伏笔 | `planted_foreshadowings` | TEXT(JSON) | 埋设伏笔ID ✅ |
| 伏笔 | `resolved_foreshadowings` | TEXT(JSON) | 回收伏笔ID ✅ |
| 伏笔 | `referenced_foreshadowings` | TEXT(JSON) | 提及伏笔ID ✅ |
| 配置 | `writing_style` | TEXT | 本章风格（覆盖项目默认） |
| 配置 | `content_focus` | TEXT(JSON) | 内容侧重 ✅ |
| 配置 | `custom_rules` | TEXT(JSON) | 规则ID ✅ |
| AI记录 | `generation_job_id` | TEXT | 关联生成任务 |
| AI记录 | `last_ai_action` | TEXT | 最后AI操作（10种） |
| AI记录 | `last_ai_model_id` | TEXT | 最后使用的模型 |
| 版本 | `version` | INTEGER | 章节版本号 |
| 版本 | `previous_version_id` | TEXT | 上一版本ID（Retcon） |
| 版本 | `is_latest_version` | INTEGER | 是否最新版本 |
| 时间 | `created_at` / `updated_at` / `first_written_at` / `frozen_at` / `published_at` | TEXT | 时间 |

**约束**：`UNIQUE(project_id, chapter_number)`

---

### 表5：outlines（大纲主表）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 主键 |
| `project_id` | TEXT(FK) | 关联项目 |
| `name` | TEXT | 大纲名称 |
| `outline_mode` | TEXT | 粗纲/细纲 |
| `structure_mode` | TEXT | 情节结构模式 |
| `target_total_words` | INTEGER | 目标总字数 |
| `target_chapter_count` | INTEGER | 目标章节数 |
| `target_volume_count` | INTEGER | 目标卷数 |
| `narrative_pace` | TEXT | 叙事节奏 |
| `content_focus` | TEXT(JSON) | 内容侧重 ✅ |
| `custom_requirements` | TEXT | 额外要求 |
| `generation_model_id` | TEXT | 生成模型 |
| `status` | TEXT | 4种状态：draft/approved/deprecated/rejected |
| `is_current` | INTEGER | 是否为当前生效大纲 |
| `version` | INTEGER | 版本号 |
| `previous_outline_id` | TEXT | 上一版本ID |
| `source_proposal_id` | TEXT | 来源Proposal |
| `total_outline_items` | INTEGER | 条目数 |
| `total_planned_words` | INTEGER | 计划总字数 |
| 时间字段 | TEXT | created/updated/approved/deprecated_at |

**约束**：`UNIQUE(project_id, is_current) WHERE is_current = 1`

---

### 表6：outline_items（大纲条目）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 主键 |
| `outline_id` | TEXT(FK) | 关联大纲 |
| `volume_number` | INTEGER | 所属卷号 |
| `chapter_number` | INTEGER | 全局章节编号 |
| `volume_chapter_number` | INTEGER | 卷内编号 |
| `title` | TEXT | 章节标题 |
| `rough_summary` | TEXT | 粗纲摘要（50字） |
| `detailed_plot` | TEXT | 细纲详细情节（500字） |
| `plot_points` | TEXT(JSON) | **情节节点列表** ✅ |
| `emotion_overall` | TEXT | 情绪基调 |
| `emotion_points` | TEXT(JSON) | 情绪控制点 ✅ |
| `narrative_pace` | TEXT | 本章节奏 |
| `key_characters` | TEXT(JSON) | 关键角色ID ✅ |
| `key_locations` | TEXT(JSON) | 关键地点ID ✅ |
| `key_items` | TEXT(JSON) | 关键物品ID ✅ |
| `key_events` | TEXT(JSON) | **核心事件清单** ✅ |
| `to_plant_foreshadowings` | TEXT(JSON) | 计划埋设伏笔ID ✅ |
| `to_resolve_foreshadowings` | TEXT(JSON) | 计划回收伏笔ID ✅ |
| `to_reference_foreshadowings` | TEXT(JSON) | 计划提及伏笔ID ✅ |
| `target_words` | INTEGER | 目标字数 |
| `min_words` | INTEGER | 最少字数 |
| `max_words` | INTEGER | 最多字数 |
| `linked_chapter_id` | TEXT | 已关联章节ID |
| `execution_status` | TEXT | 4种执行状态 |
| `author_notes` | TEXT | 作者备注 |
| `ai_suggestions` | TEXT(JSON) | **AI写作建议** ✅ |
| `sort_order` | INTEGER | 排序序号 |

---

## 三、表关联关系（ERD）

```
projects（项目）
    │
    │ 1 : N (ON DELETE CASCADE)
    ├──► volumes（卷）
    │       │
    │       │ 1 : N (ON DELETE SET NULL)
    │       └──► chapters（章节）
    │
    │ 1 : N (ON DELETE CASCADE)
    ├──► chapters（章节）【直接关联，volume_id可为NULL】
    │
    │ 1 : N (ON DELETE CASCADE)
    ├──► outlines（大纲）
    │       │
    │       │ 1 : N (ON DELETE CASCADE)
    │       ├──► outline_items（大纲条目）
    │       │       │
    │       │       │ nullable FK
    │       │       └──► chapters.id (linked_chapter_id)
    │       │
    │       │ self-ref (nullable)
    │       └──► outlines.id (previous_outline_id)
    │
    │ 1 : N (ON DELETE CASCADE)
    └──► project_daily_stats（日统计）

【后续待添加】
    │
    ├──► characters（角色）
    ├──► locations（地点）
    ├──► items（物品）
    ├──► foreshadowings（伏笔）← 独立表
    ├──► proposals（提案）
    ├──► rules（规则）
    └──► ...
```

### 关联详情

| 父表 | 子表 | 关联字段 | 级联行为 | 业务含义 |
|------|------|---------|---------|---------|
| projects | volumes | `volumes.project_id` | CASCADE | 删项目自动删卷 |
| projects | chapters | `chapters.project_id` | CASCADE | 删项目自动删章 |
| volumes | chapters | `chapters.volume_id` | SET NULL | 删卷章节变"未分卷" |
| projects | outlines | `outlines.project_id` | CASCADE | 删项目自动删大纲 |
| outlines | outline_items | `outline_items.outline_id` | CASCADE | 删大纲自动删条目 |
| outline_items | chapters | `outline_items.linked_chapter_id` | — | 大纲条目关联章节（可NULL） |
| outlines | outlines | `outlines.previous_outline_id` | — | 版本自引用（可NULL） |
| projects | project_daily_stats | `stats.project_id` | CASCADE | 删项目自动删统计 |

---

## 四、JSON Schema 规范（已定义）

### 已锁定Schema（17个）

| 字段路径 | Schema名称 | 关键约束 |
|---------|-----------|---------|
| `projects.tags` | `TagsSchema` | name必填、color=#RRGGBB、最多20个 |
| `projects.default_content_focus` | `ContentFocusListSchema` | 最多5个、英文枚举 |
| `projects.custom_rules` | `RuleIdListSchema` | 格式`rule_xxx`、最多50个 |
| `projects.words_trend` | `WordsTrendSchema` | **严格7天**、0~50000 |
| `volumes.structure_acts` | `StructureActsSchema` | 1~10幕、start≤end |
| `chapters.emotion_points` | `EmotionPointsSchema` | position 0.0~1.0、intensity 0~10、最多20个 |
| `chapters.appearing_characters` | `AppearingCharactersSchema` | 格式`char_xxx`、最多50个 |
| `chapters.appearing_items` | `AppearingItemsSchema` | 格式`item_xxx`、最多50个 |
| `chapters.appearing_locations` | `AppearingLocationsSchema` | 格式`loc_xxx`、最多50个 |
| `chapters.appearing_techniques` | `AppearingTechniquesSchema` | 格式`tech_xxx`、最多50个 |
| `chapters.foreshadowing_*` | `ForeshadowingIdListSchema` | 格式`fore_xxx`、最多20个 |
| `outline_items.plot_points` | `PlotPointsSchema` | 1~20个节点、10种类型 |
| `outline_items.key_events` | `KeyEventsSchema` | 18种事件类型、最多10个 |
| `outline_items.ai_suggestions` | `AiSuggestionsSchema` | 6类建议 |

### 铁律

```
所有JSON字段 → 必须有Zod Schema → AI生成后先校验 → 失败则重试/报错
```

---

## 五、后续待设计表（23张）

### 高优先级

| # | 表名 | 说明 | 状态 |
|---|------|------|------|
| 8 | `characters` | 角色系统（角色卡、关系、状态快照） | 🔄 待设计 |
| 9 | `locations` | 地点系统 | 🔄 待设计 |
| 10 | `items` | 物品系统 | 🔄 待设计 |
| 11 | `factions` | 势力系统 | 🔄 待设计 |
| 12 | `techniques` | 功法系统 | 🔄 待设计 |
| 13 | `foreshadowings` | **伏笔系统**（确认独立表） | 🔄 待设计 |
| 14 | `proposals` | **MOU核心**（提案/裁决/状态机） | 🔄 待设计 |
| 15 | `human_events` | 作者决策记录 | 🔄 待设计 |
| 16 | `mou_sessions` | MOU会话 | 🔄 待设计 |

### 中优先级

| # | 表名 | 说明 | 状态 |
|---|------|------|------|
| 17 | `power_systems` | 力量体系 | 🔄 待设计 |
| 18 | `currencies` | 货币系统 | 🔄 待设计 |
| 19 | `historical_events` | 历史事件 | 🔄 待设计 |
| 20 | `world_rules` | 世界规则 | 🔄 待设计 |
| 21 | `experienced_events` | 已经历事件线 | 🔄 待设计 |
| 22 | `character_states` | 角色状态快照 | 🔄 待设计 |
| 23 | `rules` | 自定义规则 | 🔄 待设计 |
| 24 | `model_configs` | LLM模型配置 | 🔄 待设计 |
| 25 | `llm_calls` | LLM调用日志 | 🔄 待设计 |
| 26 | `emotion_points` | 情绪控制点（如拆分JSON为独立表） | 🔄 待定 |

### 向量化相关

| # | 表/对象 | 说明 | 状态 |
|---|--------|------|------|
| 27 | `chapter_embeddings` | 章节全文嵌入 | 🔄 待设计 |
| 28 | `entity_embeddings` | 实体描述嵌入 | 🔄 待设计 |
| 29 | `summary_embeddings` | 章节摘要嵌入 | 🔄 待设计 |
| 30 | `context_snapshots` | 上下文快照 | 🔄 待设计 |

---

## 六、设计决策记录

| # | 决策 | 说明 | 文档 |
|---|------|------|------|
| 1 | 单平台 | 一个项目只绑定一个平台 | SCHEMA_01_projects.md |
| 2 | 密码加密 | AES-256-GCM，API绝不返回明文 | SCHEMA_01_projects.md |
| 3 | 正文文件存储 | 数据库存路径，文件系统存内容 | SCHEMA_02_volumes_chapters.md |
| 4 | 全局章节编号 | 跨卷连续，插入时后续+1 | SCHEMA_02_volumes_chapters.md |
| 5 | 大纲独立版本 | outline + outline_items，版本自引用 | SCHEMA_03_outlines.md |
| 6 | 伏笔独立表 | foreshadowings独立，大纲只存ID引用 | DECISION_foreshadowing_architecture.md |
| 7 | JSON强制校验 | 所有JSON字段必须有Zod Schema | JSON_SCHEMA_SPEC.md |

---

> 汇报完毕。确认后进入下一个表设计：
> 
> **高优先级候选**：
> - `characters` — 角色系统（角色卡、关系、状态快照）
> - `proposals` — MOU核心（提案表、作者决策、状态机流转）
> - `foreshadowings` — 伏笔系统（刚确认独立表，趁热设计）
> 
> **你选哪个？**
