# NarrativeOSPlus — 大纲表设计（outlines + outline_items）

> 综合竞品A的粗纲/细纲双模式 + NarrativeOSPlus 的 MOU 流程
> 状态：🔄 待作者确认

---

## 核心设计理念

**大纲是"未来章节的蓝图"，不是"现在的章节"。**

```
作者创建项目《创业神话》
    │
    ├─→ AI 生成大纲 Proposal
    │       │
    │       ├─→ 粗纲模式：100章 × 标题 + 50字摘要
    │       └─→ 细纲模式：每章 × 500字详细情节
    │
    ├─→ 作者裁决（approve / reject / modify）
    │
    └─→ approve 后：
            1. 创建 outline 记录（状态 approved）
            2. 创建 outline_items × N
            3. 可选：一键生成 chapters（根据 outline_items 预创建）
```

**关键决策**：
- `outline_items` 不等于 `chapters` —— 大纲是蓝图，章节是实体。
- 一个项目可以有**多个大纲版本**（v1 → v2），但只有一个 `current`。
- 旧大纲标记 `deprecated`，不删除，方便回溯。

---

## 表设计

### 表一：outlines（大纲主表）

```sql
CREATE TABLE outlines (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- ═══════════════════════════════════════════════
  -- ① 基础信息
  -- ═══════════════════════════════════════════════
  name TEXT NOT NULL,                      -- 大纲名称，如"第一版大纲"、"细纲v2"
  outline_mode TEXT NOT NULL DEFAULT 'rough'
    CHECK(outline_mode IN (
      'rough',             -- 粗纲：标题 + 核心事件（50字）
      'detailed'           -- 细纲：标题 + 详细情节（500字）
    )),

  -- ═══════════════════════════════════════════════
  -- ② 生成配置（记录AI生成时的参数，用于追溯）
  -- ═══════════════════════════════════════════════
  structure_mode TEXT,                     -- 关联的情节结构模式
    CHECK(structure_mode IN (
      'five_act', 'three_act', 'heros_journey',
      'kishotenketsu', 'johakyu', 'custom'
    )),
  target_total_words INTEGER,              -- 目标总字数
  target_chapter_count INTEGER,            -- 目标章节数
  target_volume_count INTEGER,             -- 目标卷数
  narrative_pace TEXT DEFAULT 'medium',    -- 生成时指定的叙事节奏
    CHECK(narrative_pace IN ('fast', 'medium', 'slow')),
  content_focus TEXT,                      -- JSON 生成时指定的内容侧重
  custom_requirements TEXT,                -- 作者的额外要求（纯文本记录）
  generation_model_id TEXT,              -- 生成时使用的模型

  -- ═══════════════════════════════════════════════
  -- ③ 大纲状态
  -- ═══════════════════════════════════════════════
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN (
      'draft',             -- 草稿：AI生成后待作者裁决
      'approved',          -- 已批准：作者确认，成为当前蓝图
      'deprecated',        -- 已废弃：被新版本替代
      'rejected'           -- 已拒绝：作者否决
    )),
  is_current INTEGER DEFAULT 0,            -- 是否为当前生效大纲（一个项目只有一个1）

  -- ═══════════════════════════════════════════════
  -- ④ 版本与提案
  -- ═══════════════════════════════════════════════
  version INTEGER NOT NULL DEFAULT 1,        -- 大纲版本号
  previous_outline_id TEXT,                -- 上一版本ID（deprecated时指向）
  source_proposal_id TEXT,                 -- 来源Proposal ID（MOU追溯）

  -- ═══════════════════════════════════════════════
  -- ⑤ 统计（根据 outline_items 汇总）
  -- ═══════════════════════════════════════════════
  total_outline_items INTEGER DEFAULT 0,     -- 条目数（章数）
  total_planned_words INTEGER DEFAULT 0,     -- 计划总字数

  -- ═══════════════════════════════════════════════
  -- ⑥ 时间管理
  -- ═══════════════════════════════════════════════
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,                        -- 批准时间
  deprecated_at TEXT,                    -- 废弃时间

  UNIQUE(project_id, is_current)         -- 一个项目只能有一个current=1
    WHERE is_current = 1
);

CREATE INDEX idx_outlines_project ON outlines(project_id);
CREATE INDEX idx_outlines_status ON outlines(status);
CREATE INDEX idx_outlines_current ON outlines(project_id, is_current);
```

---

### 表二：outline_items（大纲条目——对应未来的章节）

```sql
CREATE TABLE outline_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  outline_id TEXT NOT NULL REFERENCES outlines(id) ON DELETE CASCADE,

  -- ═══════════════════════════════════════════════
  -- ① 位置信息（对应未来的章节位置）
  -- ═══════════════════════════════════════════════
  volume_number INTEGER NOT NULL DEFAULT 1, -- 所属卷号
  chapter_number INTEGER NOT NULL,            -- 全局章节编号
  volume_chapter_number INTEGER,              -- 卷内章节编号

  -- ═══════════════════════════════════════════════
  -- ② 标题与摘要（所有模式都有）
  -- ═══════════════════════════════════════════════
  title TEXT NOT NULL,                      -- 章节标题
  rough_summary TEXT,                         -- 粗纲摘要（50字以内）
    -- 如："主角重生回到高三，发现自己拥有2005-2025年完整记忆"

  -- ═══════════════════════════════════════════════
  -- ③ 详细情节（细纲模式才有）
  -- ═══════════════════════════════════════════════
  detailed_plot TEXT,                         -- 详细情节（500字以内）
    -- 细纲模式下填充，粗纲模式为NULL
  plot_points TEXT,                           -- JSON 情节节点列表
    /*
    [
      { "point_number": 1, "type": "setup", "description": "主角醒来发现异常", "word_estimate": 300 },
      { "point_number": 2, "type": "development", "description": "通过细节确认重生", "word_estimate": 500 },
      { "point_number": 3, "type": "climax", "description": "第一次利用记忆做出决策", "word_estimate": 400 },
      { "point_number": 4, "type": "resolution", "description": "决策初现成效，留下悬念", "word_estimate": 200 }
    ]
    */

  -- ═══════════════════════════════════════════════
  -- ④ 情绪与节奏
  -- ═══════════════════════════════════════════════
  emotion_overall TEXT,                       -- 整体情绪基调
    CHECK(emotion_overall IN (
      'tense', 'joyful', 'sad', 'angry', 'anticipating',
      'horrific', 'warm', 'satisfying', 'neutral'
    )),
  emotion_points TEXT,                        -- JSON 情绪控制点
    -- 同 chapters.emotion_points Schema
  narrative_pace TEXT DEFAULT 'medium',         -- 本章节奏
    CHECK(narrative_pace IN ('fast', 'medium', 'slow')),

  -- ═══════════════════════════════════════════════
  -- ⑤ 出场与关联（蓝图阶段的预设）
  -- ═══════════════════════════════════════════════
  key_characters TEXT,                        -- JSON ["char_001", "char_002"]
  key_locations TEXT,                         -- JSON ["loc_001"]
  key_items TEXT,                             -- JSON ["item_001"]
  key_events TEXT,                            -- JSON 本章核心事件清单
    /*
    [
      { "event_type": "character_arrival", "description": "主角重生", "entity_id": "char_001" },
      { "event_type": "item_acquisition", "description": "获得记忆碎片", "entity_id": "item_001" }
    ]
    */

  -- ═══════════════════════════════════════════════
  -- ⑥ 伏笔规划
  -- ═══════════════════════════════════════════════
  to_plant_foreshadowings TEXT,               -- JSON 计划埋设的伏笔ID
  to_resolve_foreshadowings TEXT,             -- JSON 计划回收的伏笔ID
  to_reference_foreshadowings TEXT,           -- JSON 计划提及的伏笔ID

  -- ═══════════════════════════════════════════════
  -- ⑦ 字数规划
  -- ═══════════════════════════════════════════════
  target_words INTEGER DEFAULT 3000,            -- 目标字数
  min_words INTEGER DEFAULT 2000,               -- 最少字数
  max_words INTEGER DEFAULT 5000,               -- 最多字数

  -- ═══════════════════════════════════════════════
  -- ⑧ 执行状态（大纲 → 章节的映射）
  -- ═══════════════════════════════════════════════
  linked_chapter_id TEXT,                     -- 已关联的章节ID（NULL=未创建）
  execution_status TEXT DEFAULT 'pending'     -- 执行状态
    CHECK(execution_status IN (
      'pending',            -- 等待创建章节
      'linked',               -- 已关联章节
      'deviated',             -- 写作时偏离大纲
      'completed'             -- 章节已完成且符合大纲
    )),

  -- ═══════════════════════════════════════════════
  -- ⑨ 作者备注与AI建议
  -- ═══════════════════════════════════════════════
  author_notes TEXT,                          -- 作者对大纲条目的备注
  ai_suggestions TEXT,                        -- JSON AI 的写作建议
    /*
    {
      "focus_tips": ["强化环境描写", "增加心理活动"],
      "risk_warnings": ["注意战力一致性"],
      "reference_chapters": ["ch_003", "ch_007"],
      "style_reminder": "本章是爽点章节，节奏要加快"
    }
    */

  -- ═══════════════════════════════════════════════
  -- ⑩ 排序
  -- ═══════════════════════════════════════════════
  sort_order INTEGER NOT NULL,                  -- 排序序号（用于拖拽重排）

  UNIQUE(outline_id, chapter_number),
  UNIQUE(outline_id, sort_order)
);

CREATE INDEX idx_outline_items_outline ON outline_items(outline_id);
CREATE INDEX idx_outline_items_chapter ON outline_items(outline_id, chapter_number);
CREATE INDEX idx_outline_items_linked ON outline_items(linked_chapter_id);
```

---

## 三、JSON Schema 定义（入库前校验用）

### 3.1 outlines 表 JSON 字段

#### `content_focus` —— 内容侧重

```typescript
// 复用已有的 ContentFocusListSchema
export const OutlineContentFocusSchema = z.array(ContentFocus).max(5);
export type OutlineContentFocus = z.infer<typeof OutlineContentFocusSchema>;

// ✅ 正确示例
["combat", "dialogue", "plot"]
```

### 3.2 outline_items 表 JSON 字段

#### `emotion_points` —— 情绪控制点

**复用已有的 `EmotionPointsSchema`**，见 `JSON_SCHEMA_SPEC.md`。

```typescript
// 复用 chapters 的同名 Schema，确保一致性
export const OutlineEmotionPointsSchema = EmotionPointsSchema;
```

#### `key_characters` / `key_locations` / `key_items`

**复用已有的 `AppearingCharactersSchema` / `AppearingLocationsSchema` / `AppearingItemsSchema`**。

```typescript
export const OutlineKeyCharactersSchema = AppearingCharactersSchema;
export const OutlineKeyLocationsSchema = AppearingLocationsSchema;
export const OutlineKeyItemsSchema = AppearingItemsSchema;
```

#### `plot_points` —— 情节节点列表（细纲特有）

```typescript
export const PlotPointType = z.enum([
  'setup',           -- 铺垫
  'development',     -- 发展
  'twist',           -- 转折
  'climax',          -- 高潮
  'resolution',      -- 收束
  'transition',      -- 过渡
  'flashback',       -- 回忆
  'foreshadowing',   -- 埋设伏笔
  'callback',        -- 呼应伏笔
  'character_moment', -- 角色刻画
  'world_building'   -- 世界观展开
]);

export const PlotPointSchema = z.object({
  point_number: z.number().int().min(1).max(20),      -- 节点序号
  type: PlotPointType,                                  -- 节点类型
  description: z.string().min(1).max(500),            -- 描述
  word_estimate: z.number().int().min(100).max(5000).optional(), -- 预估字数
  linked_entity_ids: z.array(z.string()).max(10).optional(),      -- 关联实体
});

export const PlotPointsSchema = z.array(PlotPointSchema).min(1).max(20);
export type PlotPoints = z.infer<typeof PlotPointsSchema>;

// ✅ 正确示例
[
  {
    "point_number": 1,
    "type": "setup",
    "description": "主角醒来发现日期不对，以为是梦",
    "word_estimate": 300,
    "linked_entity_ids": ["char_001"]
  },
  {
    "point_number": 2,
    "type": "development",
    "description": "通过彩票号码、新闻事件确认重生",
    "word_estimate": 500,
    "linked_entity_ids": ["char_001"]
  },
  {
    "point_number": 3,
    "type": "climax",
    "description": "做出第一个利用先知的决策：填报志愿",
    "word_estimate": 400,
    "linked_entity_ids": ["char_001", "loc_001"]
  },
  {
    "point_number": 4,
    "type": "resolution",
    "description": "决策初现成效，留下未来悬念",
    "word_estimate": 200
  }
]

// ❌ 错误示例
[
  {
    "point_number": 0,                        -- 必须从1开始
    "type": "beginning",                      -- 无效枚举
    "description": ""                           -- 不能为空
  }
]
```

#### `key_events` —— 核心事件清单

```typescript
export const KeyEventType = z.enum([
  'character_arrival',      -- 角色登场
  'character_departure',    -- 角色退场
  'character_death',        -- 角色死亡
  'item_acquisition',       -- 获得物品
  'item_loss',              -- 失去物品
  'location_change',        -- 场景切换
  'battle_start',           -- 战斗开始
  'battle_end',             -- 战斗结束
  'revelation',             -- 真相揭露
  'betrayal',               -- 背叛
  'reunion',                -- 重逢
  'breakthrough',           -- 突破
  'contract_signed',        -- 签约
  'organization_joined',    -- 加入组织
  'relationship_change',    -- 关系变化
  'time_jump',              -- 时间跳跃
  'world_event'             -- 世界事件
]);

export const KeyEventSchema = z.object({
  event_type: KeyEventType,
  description: z.string().min(1).max(200),
  entity_id: z.string().optional(),          -- 关联实体ID（可选）
  entity_type: z.enum(['character','location','item','technique','faction']).optional(),
});

export const KeyEventsSchema = z.array(KeyEventSchema).max(10);
export type KeyEvents = z.infer<typeof KeyEventsSchema>;

// ✅ 正确示例
[
  {
    "event_type": "character_arrival",
    "description": "主角重生回到2005年",
    "entity_id": "char_001",
    "entity_type": "character"
  },
  {
    "event_type": "revelation",
    "description": "主角确认自己拥有20年完整记忆"
  }
]
```

#### `to_plant_foreshadowings` / `to_resolve_foreshadowings` / `to_reference_foreshadowings`

**复用已有的 `ForeshadowingIdListSchema`**。

```typescript
export const OutlineForeshadowingListSchema = ForeshadowingIdListSchema;
```

#### `ai_suggestions` —— AI 写作建议

```typescript
export const AiSuggestionSchema = z.object({
  focus_tips: z.array(z.string().max(100)).max(10).optional(),      -- 重点提示
  risk_warnings: z.array(z.string().max(200)).max(5).optional(),      -- 风险警告
  reference_chapters: z.array(z.string().max(10).optional()),     -- 参考章节
  style_reminder: z.string().max(500).optional(),                     -- 风格提醒
  dialogue_tips: z.array(z.string().max(100)).max(5).optional(),     -- 对话建议
  pacing_tips: z.array(z.string().max(100)).max(5).optional(),      -- 节奏建议
});

export const AiSuggestionsSchema = AiSuggestionSchema;
export type AiSuggestions = z.infer<typeof AiSuggestionsSchema>;

// ✅ 正确示例
{
  "focus_tips": ["强化环境描写", "增加心理活动"],
  "risk_warnings": ["注意战力一致性"],
  "reference_chapters": ["ch_003", "ch_007"],
  "style_reminder": "本章是爽点章节，节奏要加快",
  "dialogue_tips": ["苏婉桐的台词要体现温柔但坚定的性格"],
  "pacing_tips": ["前半段慢铺垫，后半段快节奏"]
}
```

---

## 四、与 MOU 的联动

### 4.1 大纲生成流程

```
作者："帮我生成细纲，100章，300万字，热血燃向"
    │
    ▼
Studio 引擎组装上下文
    ├─→ 项目设定（小说类型、核心创意）
    ├─→ 世界观摘要
    ├─→ 角色卡
    ├─→ 已确认的大纲版本（如果有）
    └─→ 规则注入
    │
    ▼
LLM 生成大纲 JSON（粗纲/细纲）
    │
    ▼
Zod 校验大纲 JSON
    ├─→ 失败 → 重试/报错
    └─→ 通过 → 继续
    │
    ▼
生成 Proposal：「生成大纲：100章细纲」
    │
    ▼
前端展示：大纲预览面板（可展开每章）
    ├─→ 作者可修改：标题、摘要、情节节点
    ├─→ 作者可拖拽重排章节顺序
    └─→ 作者可删除/新增条目
    │
    ▼
作者裁决：
    ├─→ approve → 创建 outline(status=approved, is_current=1) + outline_items
    │               旧大纲自动标记 deprecated
    ├─→ reject → 丢弃
    └─→ modify → 生成修改版 Proposal（迭代）
```

### 4.2 大纲 → 章节 的执行流程

```
大纲已批准
    │
    ├─→ 作者点击"根据大纲创建章节"
    │
    ├─→ 系统遍历 outline_items：
    │       每条 → 预创建 chapter（status='draft'）
    │       chapter.title = outline_item.title
    │       chapter.target_words = outline_item.target_words
    │       chapter.emotion_points = outline_item.emotion_points
    │       chapter.appearing_characters = outline_item.key_characters
    │       ...
    │       outline_item.linked_chapter_id = chapter.id
    │       outline_item.execution_status = 'linked'
    │
    └─→ chapters 创建完成，作者进入写作
```

### 4.3 写作偏离检测

```
作者写完 Chapter 5
    │
    ├─→ Censor 引擎对比 outline_items[5]
    │       ├─→ 标题偏离？→ 生成风险 Proposal
    │       ├─→ 关键事件缺失？→ 生成风险 Proposal
    │       └─→ 节奏偏离（该快变慢）？→ 生成风险 Proposal
    │
    └─→ 作者裁决偏离 Proposal → 确认/修改/忽略
            │
            ├─→ 忽略 → outline_item.execution_status = 'deviated'
            └─→ 修改 → 更新 outline_item 或 chapter
```

---

## 五、与已有表的关系

```
projects
    │ 1:N (cascade)
    ├─→ volumes
    │       │ 1:N (set null)
    │       └─→ chapters
    │
    ├─→ outlines
    │       │ 1:N (cascade)
    │       ├─→ outline_items
    │       │       │
    │       │       └─→ linked_chapter_id → chapters.id (nullable)
    │       │
    │       └─→ previous_outline_id → outlines.id (自引用，nullable)
    │
    └─→ project_daily_stats
```

### outline_items → chapters 的关系说明

| 状态 | outline_items.linked_chapter_id | 含义 |
|------|--------------------------------|------|
| 蓝图阶段 | NULL | 大纲条目尚未创建对应章节 |
| 已创建 | 有值 | 已预创建章节，等待写作 |
| 写作中 | 有值 | 章节在 draft/reviewing 状态 |
| 已完成 | 有值 | 章节已 frozen，且与大纲一致 |
| 已偏离 | 有值 | 章节已 frozen，但内容偏离大纲 |

---

## 六、TypeScript 类型定义

```typescript
import { z } from 'zod';
import {
  ContentFocusListSchema,
  EmotionPointsSchema,
  AppearingCharactersSchema,
  AppearingLocationsSchema,
  AppearingItemsSchema,
  ForeshadowingIdListSchema,
} from './JSON_SCHEMA_SPEC';

// ─── 枚举 ───
export const OutlineMode = z.enum(['rough', 'detailed']);
export const OutlineStatus = z.enum(['draft', 'approved', 'deprecated', 'rejected']);
export const ExecutionStatus = z.enum(['pending', 'linked', 'deviated', 'completed']);

// ─── PlotPoint 定义（上文已有详细定义）───
export const PlotPointType = z.enum([
  'setup', 'development', 'twist', 'climax', 'resolution',
  'transition', 'flashback', 'foreshadowing', 'callback',
  'character_moment', 'world_building'
]);

export const PlotPointSchema = z.object({
  point_number: z.number().int().min(1).max(20),
  type: PlotPointType,
  description: z.string().min(1).max(500),
  word_estimate: z.number().int().min(100).max(5000).optional(),
  linked_entity_ids: z.array(z.string()).max(10).optional(),
});

export const PlotPointsSchema = z.array(PlotPointSchema).min(1).max(20);

// ─── KeyEvent 定义（上文已有详细定义）───
export const KeyEventType = z.enum([
  'character_arrival', 'character_departure', 'character_death',
  'item_acquisition', 'item_loss', 'location_change',
  'battle_start', 'battle_end', 'revelation', 'betrayal',
  'reunion', 'breakthrough', 'contract_signed',
  'organization_joined', 'relationship_change',
  'time_jump', 'world_event'
]);

export const KeyEventSchema = z.object({
  event_type: KeyEventType,
  description: z.string().min(1).max(200),
  entity_id: z.string().optional(),
  entity_type: z.enum(['character','location','item','technique','faction']).optional(),
});

export const KeyEventsSchema = z.array(KeyEventSchema).max(10);

// ─── AiSuggestion 定义（上文已有详细定义）───
export const AiSuggestionSchema = z.object({
  focus_tips: z.array(z.string().max(100)).max(10).optional(),
  risk_warnings: z.array(z.string().max(200)).max(5).optional(),
  reference_chapters: z.array(z.string()).max(10).optional(),
  style_reminder: z.string().max(500).optional(),
  dialogue_tips: z.array(z.string().max(100)).max(5).optional(),
  pacing_tips: z.array(z.string().max(100)).max(5).optional(),
});

// ─── outlines ───
export const OutlineSchema = z.object({
  id: z.string(),
  project_id: z.string(),

  name: z.string().min(1).max(100),
  outline_mode: OutlineMode,

  structure_mode: z.string().optional(),
  target_total_words: z.number().int().positive().optional(),
  target_chapter_count: z.number().int().positive().optional(),
  target_volume_count: z.number().int().positive().optional(),
  narrative_pace: z.enum(['fast', 'medium', 'slow']).default('medium'),
  content_focus: ContentFocusListSchema.optional(),
  custom_requirements: z.string().max(2000).optional(),
  generation_model_id: z.string().optional(),

  status: OutlineStatus,
  is_current: z.boolean().default(false),

  version: z.number().int().default(1),
  previous_outline_id: z.string().optional(),
  source_proposal_id: z.string().optional(),

  total_outline_items: z.number().int().default(0),
  total_planned_words: z.number().int().default(0),

  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  approved_at: z.string().datetime().optional(),
  deprecated_at: z.string().datetime().optional(),
});

export type Outline = z.infer<typeof OutlineSchema>;

// ─── outline_items ───
export const OutlineItemSchema = z.object({
  id: z.string(),
  outline_id: z.string(),

  volume_number: z.number().int().min(1).default(1),
  chapter_number: z.number().int().min(1),
  volume_chapter_number: z.number().int().optional(),

  title: z.string().min(1).max(100),
  rough_summary: z.string().max(100).optional(),

  detailed_plot: z.string().max(2000).optional(),
  plot_points: PlotPointsSchema.optional(),

  emotion_overall: z.string().optional(),
  emotion_points: EmotionPointsSchema.optional(),
  narrative_pace: z.enum(['fast', 'medium', 'slow']).default('medium'),

  key_characters: AppearingCharactersSchema.optional(),
  key_locations: AppearingLocationsSchema.optional(),
  key_items: AppearingItemsSchema.optional(),
  key_events: KeyEventsSchema.optional(),

  to_plant_foreshadowings: ForeshadowingIdListSchema.optional(),
  to_resolve_foreshadowings: ForeshadowingIdListSchema.optional(),
  to_reference_foreshadowings: ForeshadowingIdListSchema.optional(),

  target_words: z.number().int().min(100).default(3000),
  min_words: z.number().int().min(100).default(2000),
  max_words: z.number().int().min(100).default(5000),

  linked_chapter_id: z.string().optional(),
  execution_status: ExecutionStatus.default('pending'),

  author_notes: z.string().max(1000).optional(),
  ai_suggestions: AiSuggestionSchema.optional(),

  sort_order: z.number().int().min(0),
});

export type OutlineItem = z.infer<typeof OutlineItemSchema>;
```

---

## 七、竞品A 借鉴点

| 竞品A功能 | 在本设计中的体现 |
|---------|-----------------|
| 大纲模式/细纲模式 | `outline_mode` 枚举（rough/detailed） |
| 100章概览 | `outline_items` × N，`chapter_number` 全局排序 |
| 每章详细情节 | `detailed_plot` + `plot_points` JSON |
| 情节节点（铺垫/发展/高潮/收束） | `PlotPointType` 枚举 |
| 字数规划（自动分配） | `target_words` / `min_words` / `max_words` |
| 叙事节奏控制 | `narrative_pace` 字段（快/中/慢） |
| 内容侧重 | `content_focus` JSON |
| 额外要求 | `custom_requirements` 文本记录 |
| 伏笔埋设/回收规划 | `to_plant` / `to_resolve` 字段 |
| AI 写作建议 | `ai_suggestions` JSON |

---

## 八、待确认的问题

1. **大纲条目与章节的绑定时机**：作者 approve 大纲后立即预创建 chapters，还是写作时才按需创建？（当前设计：一键预创建）
2. **大纲拖拽重排**：改变 `sort_order` 后，是否同步更新 `chapter_number`？（需要业务层处理编号重排）
3. **粗纲 → 细纲升级**：已有粗纲后，能否"展开"为细纲？（当前设计：生成新版本 outline）
4. **偏离检测粒度**：只检测标题偏离，还是也检测情节节点完成度？

---

> 请审阅。确认后进入下一个表：
> - `characters` — 角色系统（角色卡、关系、状态快照）
> - `world_entities` — 世界设定（统一实体模型）
> - `proposals` — MOU 核心（提案/裁决/状态机流转）
> 
> 你选哪个？
