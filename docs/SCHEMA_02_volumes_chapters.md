# NarrativeOSPlus — 卷与章节表设计（volumes + chapters）

> 综合竞品A的多卷结构 + NarrativeOS 的 MOU 流程 + 竞品A的100章/卷设计
> 状态：🔄 待作者确认

---

## 核心设计理念

**卷（Volume）= 小说的宏观结构单位**
- 竞品A：100章/卷，多卷结构
- 网文常见：第一卷"崛起"、第二卷"争霸"、第三卷"飞升"

**章（Chapter）= 最小写作单位**
- 每章有独立的：标题、正文、字数、状态、情绪节奏、关联实体
- 所有变更通过 MOU Proposal

```
Project《创业神话》
    │
    ├─→ Volume 1 「高三逆袭」 (第1-100章)
    │       │
    │       ├─→ Chapter 1 「重生2005」 (草稿)
    │       ├─→ Chapter 2 「记忆融合」 (草稿)
    │       ├─→ Chapter 3 「第一桶金」 (已冻结/已发布)
    │       └─→ ...
    │
    ├─→ Volume 2 「校园创业」 (第101-200章)
    │       │
    │       ├─→ Chapter 101 「志愿填报」 (草稿)
    │       └─→ ...
    │
    └─→ Volume 3 「商海沉浮」 (第201-300章)
            └─→ ...
```

---

## 表设计

### 表一：volumes（卷）

```sql
CREATE TABLE volumes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- ═══════════════════════════════════════════════
  -- ① 基础信息
  -- ═══════════════════════════════════════════════
  volume_number INTEGER NOT NULL,        -- 卷号：1, 2, 3...
  title TEXT NOT NULL,                   -- 卷标题：如「高三逆袭」
  subtitle TEXT,                         -- 卷副标题
  description TEXT,                      -- 卷简介/本卷核心事件概述

  -- ═══════════════════════════════════════════════
  -- ② 章节范围（规划时设定，可动态调整）
  -- ═══════════════════════════════════════════════
  planned_start_chapter INTEGER,         -- 计划起始章节号
  planned_end_chapter INTEGER,           -- 计划结束章节号
  planned_chapter_count INTEGER,           -- 计划本章数（如100）

  -- ═══════════════════════════════════════════════
  -- ③ 写作目标
  -- ═══════════════════════════════════════════════
  target_words INTEGER,                  -- 本卷目标字数
  target_arc TEXT,                       -- 本卷核心弧线：如"主角从穷学生到月入过万"

  -- ═══════════════════════════════════════════════
  -- ④ 情节脉络（竞品A的核心功能）
  -- ═══════════════════════════════════════════════
  structure_mode TEXT,                   -- 结构模式
    CHECK(structure_mode IN (
      'five_act',        -- 五幕式
      'three_act',       -- 三幕式
      'heros_journey',   -- 英雄之旅
      'kishotenketsu',   -- 起承转合
      'johakyu',         -- 序破急
      'custom'           -- 自定义
    )),
  structure_acts TEXT,                   -- JSON 幕结构详情
    /*
    {
      "acts": [
        { "act_number": 1, "name": "起", "start_chapter": 1, "end_chapter": 20,
          "summary": "主角重生，适应新身份", "core_event": "确认重生事实",
          "conflict_escalation": "无", "emotion_tone": "迷茫→兴奋" },
        { "act_number": 2, "name": "承", "start_chapter": 21, "end_chapter": 50,
          "summary": "利用先知优势小试牛刀", "core_event": "第一次商业成功",
          "conflict_escalation": "同学嫉妒", "emotion_tone": "自信→紧张" },
        ...
      ]
    }
    */

  -- ═══════════════════════════════════════════════
  -- ⑤ 卷状态
  -- ═══════════════════════════════════════════════
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK(status IN (
      'planned',           -- 已规划，未开始写作
      'writing',           -- 正在写作中
      'completed',         -- 全部章节已冻结
      'revision',          -- 修订中
      'published'          -- 已发布到平台
    )),

  -- ═══════════════════════════════════════════════
  -- ⑥ 统计（缓存）
  -- ═══════════════════════════════════════════════
  total_chapters INTEGER NOT NULL DEFAULT 0,    -- 实际章节数
  total_words INTEGER NOT NULL DEFAULT 0,         -- 实际总字数
  completed_chapters INTEGER NOT NULL DEFAULT 0, -- 已完成章节数
  frozen_chapters INTEGER NOT NULL DEFAULT 0,    -- 已冻结章节数

  -- ═══════════════════════════════════════════════
  -- ⑦ 时间管理
  -- ═══════════════════════════════════════════════
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,                       -- 开始写作时间
  completed_at TEXT,                     -- 完成时间

  -- 排序与唯一性
  UNIQUE(project_id, volume_number)
);

CREATE INDEX idx_volumes_project ON volumes(project_id);
CREATE INDEX idx_volumes_status ON volumes(status);
CREATE INDEX idx_volumes_number ON volumes(project_id, volume_number);
```

---

### 表二：chapters（章节）

```sql
CREATE TABLE chapters (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  volume_id TEXT REFERENCES volumes(id) ON DELETE SET NULL,
    -- 允许 NULL：未分卷的游离章节（创建时未指定卷）

  -- ═══════════════════════════════════════════════
  -- ① 基础信息
  -- ═══════════════════════════════════════════════
  chapter_number INTEGER NOT NULL,       -- 全局章节编号：1, 2, 3...（跨卷连续）
  volume_chapter_number INTEGER,         -- 卷内章节编号：1-100
  title TEXT NOT NULL,                   -- 章节标题
  subtitle TEXT,                         -- 章节副标题（可选）

  -- ═══════════════════════════════════════════════
  -- ② 正文内容（存储方案见下方讨论）
  -- ═══════════════════════════════════════════════
  content_path TEXT,                     -- 正文文件路径（推荐方案）
  content_summary TEXT,                  -- 章节摘要（AI自动提取/作者填写，200字以内）

  -- ═══════════════════════════════════════════════
  -- ③ 字数统计（实时/缓存）
  -- ═══════════════════════════════════════════════
  target_words INTEGER DEFAULT 3000,     -- 目标字数
  actual_words INTEGER NOT NULL DEFAULT 0, -- 实际字数
  ai_generated_words INTEGER DEFAULT 0,  -- AI生成字数（占比统计）
  human_written_words INTEGER DEFAULT 0, -- 人工写作字数

  -- ═══════════════════════════════════════════════
  -- ④ 章节状态（MOU 生命周期）
  -- ═══════════════════════════════════════════════
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN (
      'draft',             -- 草稿：正在编辑中
      'reviewing',         -- 审阅中：作者提交，等待AI检查
      'pending_proposal',  -- 有待处理提案
      'frozen',            -- 已冻结：作者确认，内容锁定
      'published',         -- 已发布到平台
      'retcon_pending',    -- 解冻待修改（Retcon流程）
      'retcon_reviewing',  -- Retcon修改后审阅中
      'archived'           -- 归档（被替换的旧版本）
    )),

  -- ═══════════════════════════════════════════════
  -- ⑤ 情绪节奏控制（竞品A核心功能）
  -- ═══════════════════════════════════════════════
  emotion_overall TEXT,                -- 整体情绪基调
    CHECK(emotion_overall IN (
      'tense', 'joyful', 'sad', 'angry', 'anticipating',
      'horrific', 'warm', 'satisfying', 'neutral'
    )),
  emotion_points TEXT,                   -- JSON 情绪控制点数组
    /*
    [
      { "position": 0.1, "type": "tension", "intensity": 3,
        "description": "主角发现重生真相，轻微紧张" },
      { "position": 0.5, "type": "joy", "intensity": 7,
        "description": "第一次赚钱，爽点释放" },
      { "position": 0.9, "type": "anticipation", "intensity": 8,
        "description": "结尾悬念：神秘电话" }
    ]
    position: 0.0~1.0 表示章节内位置
    */

  -- ═══════════════════════════════════════════════
  -- ⑥ 关联实体（出场清单）
  -- ═══════════════════════════════════════════════
  -- 出场角色、物品、地点、功法等，以 JSON 存储关联ID
  appearing_characters TEXT,             -- JSON ["char_001", "char_002"]
  appearing_items TEXT,                  -- JSON ["item_001"]
  appearing_locations TEXT,              -- JSON ["loc_001", "loc_002"]
  appearing_techniques TEXT,           -- JSON ["tech_001"]

  -- 本章涉及/呼应的伏笔
  planted_foreshadowings TEXT,           -- JSON ["fore_001"] -- 本章埋设的伏笔
  resolved_foreshadowings TEXT,          -- JSON ["fore_002"] -- 本章回收的伏笔
  referenced_foreshadowings TEXT,        -- JSON ["fore_003"] -- 本章提及的伏笔

  -- ═══════════════════════════════════════════════
  -- ⑦ 写作配置（可覆盖项目级默认值）
  -- ═══════════════════════════════════════════════
  writing_style TEXT,                    -- 本章特定风格（覆盖项目默认）
    CHECK(writing_style IN (
      'hardcore_realism', 'light_humor', 'hot_blooded',
      'delicate_literary', 'dark_depressing', 'witty_roast'
    )),
  content_focus TEXT,                    -- JSON 内容侧重（覆盖项目默认）
  custom_rules TEXT,                     -- JSON 本章绑定的规则ID

  -- ═══════════════════════════════════════════════
  -- ⑧ AI 生成记录（可追溯）
  -- ═══════════════════════════════════════════════
  generation_job_id TEXT,                -- 关联 generation_jobs.id
  last_ai_action TEXT,                   -- 最后一次AI操作
    CHECK(last_ai_action IN (
      'none', 'outline', 'generate', 'continue', 'polish',
      'dialogue_optimize', 'develop', 'fix_logic', 'expand', 'enhance'
    )),
  last_ai_model_id TEXT,                 -- 最后使用的模型

  -- ═══════════════════════════════════════════════
  -- ⑨ 版本与历史
  -- ═══════════════════════════════════════════════
  version INTEGER NOT NULL DEFAULT 1,      -- 章节版本号
  previous_version_id TEXT,              -- 上一版本ID（Retcon时指向旧版本）
  is_latest_version INTEGER DEFAULT 1,     -- 是否是最新版本

  -- ═══════════════════════════════════════════════
  -- ⑩ 时间管理
  -- ═══════════════════════════════════════════════
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  first_written_at TEXT,                 -- 首次写作时间
  frozen_at TEXT,                        -- 冻结时间
  published_at TEXT,                     -- 发布时间

  -- 排序与唯一性
  UNIQUE(project_id, chapter_number)
);

CREATE INDEX idx_chapters_project ON chapters(project_id);
CREATE INDEX idx_chapters_volume ON chapters(volume_id);
CREATE INDEX idx_chapters_status ON chapters(status);
CREATE INDEX idx_chapters_number ON chapters(project_id, chapter_number);
CREATE INDEX idx_chapters_frozen ON chapters(project_id, frozen_at DESC);
```

---

## 关键设计讨论

### Q1: 正文存储方案（之前讨论过，需要确认）

**方案A：文件系统（推荐）**
```
/projects/{project_id}/chapters/{chapter_id}.md
/projects/{project_id}/chapters/{chapter_id}.v2.md  -- Retcon旧版本
/projects/{project_id}/chapters/{chapter_id}.v3.md  -- 最新版本
```
- 优点：大文本不拖慢数据库查询、版本控制天然、文件级diff方便
- 缺点：需要文件管理、备份时要包含文件系统

**方案B：SQLite TEXT**
- 优点：事务一致、备份简单
- 缺点：大文本拖慢查询、数据库膨胀

**方案C：混合（推荐）**
- 正文存在文件系统
- `content_path` 指向文件路径
- `content_summary` 存在数据库（用于列表展示、向量检索）
- 数据库事务只管理元数据

**你的倾向？** 我推荐方案C。

### Q2: 章节编号策略

- `chapter_number`：全局连续编号（1, 2, 3... 999），用于排序和引用
- `volume_chapter_number`：卷内编号（1-100），用于展示

**好处**：
- 插入新章节时只需要调整后续 `chapter_number`（可批量+1）
- 跨卷引用时用全局编号（如"第50章"），不歧义

### Q3: Retcon（版本回溯）

```
Chapter 5 (version 3, is_latest=1)
    │
    ├─→ previous_version_id → Chapter 5 v2 (is_latest=0, archived)
    │       │
    │       └─→ previous_version_id → Chapter 5 v1 (is_latest=0, archived)
    │
    └─→ content_path = /projects/xxx/chapters/ch_005.v3.md
```

- 冻结后如需修改 → 解冻 → 复制为 v2 → 编辑 → 重新冻结
- 旧版本保留但标记 `is_latest=0`，可回溯查看

---

## 与 MOU 的联动

### 章节状态流转（MOU 模式）

```
                    创建章节
                          │
                          ▼
                    ┌─────────────┐
                    │    draft    │ 草稿状态
                    │   (可编辑)   │
                    └──────┬──────┘
                           │ 作者点击"提交审阅"
                           ▼
                    ┌─────────────┐
                    │  reviewing  │ AI检查中
                    │   (Censor   │
                    │   引擎运行)  │
                    └──────┬──────┘
                           │ 发现风险？
              ┌────────────┼────────────┐
              │ 有          │            │ 无
              ▼             │            ▼
        ┌──────────┐        │    ┌─────────────┐
        │ 生成风险   │        │    │   frozen    │
        │ Proposal │        │    │  (直接冻结)  │
        └────┬─────┘        │    └─────────────┘
             │              │           │
             ▼              │           │
        ┌──────────┐        │           │
        │ pending  │        │           │
        │_proposal│◄───────┘           │
        │  (等待  │                      │
        │  作者)  │                      │
        └────┬─────┘                      │
             │ 作者裁决                    │
    ┌────────┼────────┐                   │
    │        │        │                   │
    ▼        ▼        ▼                   │
 ┌────┐  ┌────┐  ┌────┐                   │
 │approve│reject│modify│                   │
 └────┘  └────┘  └────┘                   │
    │       │      │                       │
    ▼       ▼      ▼                       │
  frozen  draft  draft                     │
  (锁定)  (继续) (修改后重审)               │
```

### 章节写作流程（完整 MOU）

```
作者打开 Chapter 5 编辑
    │
    ├─→ 作者写了一段
    ├─→ 点击"AI续写"
    │       │
    │       ├─→ Studio 引擎组装上下文
    │       ├─→ 查询 World 引擎（出场角色设定）
    │       ├─→ 查询 Memory 引擎（前3章摘要）
    │       ├─→ LLM 生成续写内容
    │       └─→ 生成 Proposal：「续写段落：500字」
    │
    ├─→ 前端显示 diff 对比
    ├─→ 作者裁决： approve / reject / modify
    │
    ├─→ 作者点击 approve
    ├─→ 内容写入文件系统
    ├─→ 字数统计更新
    ├─→ 触发 Memory 引擎：提取本章关键事件（异步）
    │       └─→ 生成「记忆更新 Proposal」→ 等待作者确认
    │
    └─→ 触发 Censor 引擎：检查一致性
            └─→ 发现战力异常？→ 生成「风险 Proposal」→ 等待作者确认
```

---

## TypeScript 类型定义

```typescript
import { z } from 'zod';

// ─── volumes ───
export const VolumeStatus = z.enum([
  'planned', 'writing', 'completed', 'revision', 'published'
]);

export const StructureMode = z.enum([
  'five_act', 'three_act', 'heros_journey',
  'kishotenketsu', 'johakyu', 'custom'
]);

export const ActSchema = z.object({
  act_number: z.number().int().min(1),
  name: z.string(),
  start_chapter: z.number().int(),
  end_chapter: z.number().int(),
  summary: z.string(),
  core_event: z.string(),
  conflict_escalation: z.string(),
  emotion_tone: z.string(),
});

export const VolumeSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  volume_number: z.number().int().min(1),
  title: z.string().min(1).max(100),
  subtitle: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),

  planned_start_chapter: z.number().int().optional(),
  planned_end_chapter: z.number().int().optional(),
  planned_chapter_count: z.number().int().optional(),

  target_words: z.number().int().optional(),
  target_arc: z.string().max(500).optional(),

  structure_mode: StructureMode.optional(),
  structure_acts: z.array(ActSchema).optional(),

  status: VolumeStatus,

  total_chapters: z.number().int().default(0),
  total_words: z.number().int().default(0),
  completed_chapters: z.number().int().default(0),
  frozen_chapters: z.number().int().default(0),

  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
});

export type Volume = z.infer<typeof VolumeSchema>;

// ─── chapters ───
export const ChapterStatus = z.enum([
  'draft', 'reviewing', 'pending_proposal', 'frozen',
  'published', 'retcon_pending', 'retcon_reviewing', 'archived'
]);

export const EmotionType = z.enum([
  'tense', 'joyful', 'sad', 'angry', 'anticipating',
  'horrific', 'warm', 'satisfying', 'neutral'
]);

export const EmotionPointSchema = z.object({
  position: z.number().min(0).max(1),     // 章节内位置 0.0~1.0
  type: EmotionType,
  intensity: z.number().int().min(0).max(10),
  description: z.string().max(200),
});

export const ChapterSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  volume_id: z.string().optional(),       // 允许未分卷

  chapter_number: z.number().int().min(1),
  volume_chapter_number: z.number().int().optional(),
  title: z.string().min(1).max(100),
  subtitle: z.string().max(100).optional(),

  content_path: z.string().optional(),     // 文件路径
  content_summary: z.string().max(500).optional(),

  target_words: z.number().int().default(3000),
  actual_words: z.number().int().default(0),
  ai_generated_words: z.number().int().default(0),
  human_written_words: z.number().int().default(0),

  status: ChapterStatus,

  emotion_overall: EmotionType.optional(),
  emotion_points: z.array(EmotionPointSchema).optional(),

  appearing_characters: z.array(z.string()).optional(),
  appearing_items: z.array(z.string()).optional(),
  appearing_locations: z.array(z.string()).optional(),
  appearing_techniques: z.array(z.string()).optional(),

  planted_foreshadowings: z.array(z.string()).optional(),
  resolved_foreshadowings: z.array(z.string()).optional(),
  referenced_foreshadowings: z.array(z.string()).optional(),

  writing_style: z.string().optional(),    // 覆盖项目默认
  content_focus: z.array(z.string()).optional(),
  custom_rules: z.array(z.string()).optional(),

  generation_job_id: z.string().optional(),
  last_ai_action: z.enum([
    'none', 'outline', 'generate', 'continue', 'polish',
    'dialogue_optimize', 'develop', 'fix_logic', 'expand', 'enhance'
  ]).default('none'),
  last_ai_model_id: z.string().optional(),

  version: z.number().int().default(1),
  previous_version_id: z.string().optional(),
  is_latest_version: z.boolean().default(true),

  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  first_written_at: z.string().datetime().optional(),
  frozen_at: z.string().datetime().optional(),
  published_at: z.string().datetime().optional(),
});

export type Chapter = z.infer<typeof ChapterSchema>;
```

---

## 竞品A 借鉴点

| 竞品A功能 | 在本设计中的体现 |
|---------|-----------------|
| 多卷结构（100章/卷） | `volumes` 表 + `planned_chapter_count` |
| 情节脉络（五幕式/三幕式） | `structure_mode` + `structure_acts` JSON |
| 每幕的章节范围+内容摘要 | `ActSchema` 中的 `start_chapter` / `end_chapter` / `summary` |
| 情绪节奏控制 | `emotion_points` JSON 数组 |
| 关联数据（出场角色等） | `appearing_*` 字段 |
| 伏笔关联 | `planted_` / `resolved_` / `referenced_foreshadowings` |
| 章节字数 | `target_words` + `actual_words` |
| 完成状态 | `status` 枚举（8种状态） |

---

## 待确认的问题

1. **正文存储**：方案C（文件系统+数据库元数据）OK吗？
2. **卷内章节数**：固定100章还是可以自定义？
3. **章节排序**：全局编号连续，插入新章节时后续编号+1，OK吗？
4. **情绪控制点 granularity**：按段落位置(0.0~1.0)够吗？需要精确到字数位置吗？
5. **Retcon版本**：保留所有历史版本，还是只保留最近3个？

---

> 请审阅，有问题直接说。确认后进入下一个表：> - `world_settings`（世界观设定：地理、势力、货币、功法等12个子模块）> - `characters`（角色系统：角色卡、关系、状态快照）> - `outlines`（大纲系统：粗纲/细纲的数据结构）
> > 你选哪个？
