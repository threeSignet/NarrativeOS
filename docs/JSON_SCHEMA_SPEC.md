# NarrativeOSPlus — JSON Schema 规范

> 铁律：所有 JSON 字段必须有固定 Schema，AI 生成内容入库前必须经过 Zod 校验
> 创建日期：2026-05-21
> 状态：基于 SCHEMA_01 + SCHEMA_02 整理

---

## 设计铁律

```
┌─────────────────────────────────────────────────────────────────────┐
│                         JSON 字段管理法则                             │
├─────────────────────────────────────────────────────────────────────┤
│ ① 任何 JSON 字段不允许自由格式 —— 必须有对应的 Zod Schema            │
│ ② AI 生成的 JSON 必须先过 Zod 校验，失败则重试/报错，绝不脏写         │
│ ③ 数据库层加 JSON 约束（SQLite CHECK / 应用层校验）                  │
│ ④ 版本化 Schema —— 结构变更时升级版本号，旧数据兼容迁移               │
│ ⑤ 每个 Schema 有示例数据 + 错误案例，作为 AI Prompt 的一部分          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 一、当前已设计表中的 JSON 字段清单

### 1.1 projects 表

| 字段 | 类型 | 说明 | 状态 |
|------|------|------|------|
| `tags` | `TagItem[]` | 标签数组 | ✅ 已定义 Schema |
| `default_content_focus` | `ContentFocus[]` | 内容侧重 | ✅ 已定义 Schema |
| `custom_rules` | `string[]` | 规则ID列表 | ✅ 已定义 Schema |
| `words_trend` | `number[]` | 7天字数趋势 | ✅ 已定义 Schema |

### 1.2 volumes 表

| 字段 | 类型 | 说明 | 状态 |
|------|------|------|------|
| `structure_acts` | `Act[]` | 幕结构详情 | ✅ 已定义 Schema |

### 1.3 chapters 表

| 字段 | 类型 | 说明 | 状态 |
|------|------|------|------|
| `emotion_points` | `EmotionPoint[]` | 情绪控制点 | ✅ 已定义 Schema |
| `appearing_characters` | `string[]` | 出场角色ID | ✅ 已定义 Schema |
| `appearing_items` | `string[]` | 出场物品ID | ✅ 已定义 Schema |
| `appearing_locations` | `string[]` | 出场地点ID | ✅ 已定义 Schema |
| `appearing_techniques` | `string[]` | 出场功法ID | ✅ 已定义 Schema |
| `planted_foreshadowings` | `string[]` | 埋设伏笔ID | ✅ 已定义 Schema |
| `resolved_foreshadowings` | `string[]` | 回收伏笔ID | ✅ 已定义 Schema |
| `referenced_foreshadowings` | `string[]` | 提及伏笔ID | ✅ 已定义 Schema |
| `content_focus` | `ContentFocus[]` | 内容侧重 | ✅ 已定义 Schema |
| `custom_rules` | `string[]` | 规则ID | ✅ 已定义 Schema |

---

## 二、完整 Zod Schema 定义

### 2.1 基础枚举（已定义，复用）

```typescript
// 这些枚举在 SCHEMA_01 / SCHEMA_02 已定义，此处复用
const NovelType = z.enum([...]);
const ProjectStatus = z.enum([...]);
const PlatformName = z.enum([...]);
const PlatformStatus = z.enum([...]);
const TargetAudience = z.enum([...]);
const WritingStyle = z.enum([...]);
const Pace = z.enum([...]);
const ContentFocus = z.enum([
  'combat', 'dialogue', 'psychological', 'environment',
  'plot', 'romance', 'daily', 'suspense'
]);
const VolumeStatus = z.enum([...]);
const StructureMode = z.enum([...]);
const ChapterStatus = z.enum([...]);
const EmotionType = z.enum([...]);
```

### 2.2 projects 表 JSON 字段 Schema

#### `tags` —— 标签数组

```typescript
export const TagItemSchema = z.object({
  name: z.string().min(1).max(30),        // 标签名
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(), // 标签颜色 #RRGGBB
  is_primary: z.boolean().default(false), // 是否主标签
});

export const TagsSchema = z.array(TagItemSchema).max(20);
export type Tags = z.infer<typeof TagsSchema>;

// ✅ 正确示例
[
  { "name": "重生", "color": "#FF6B6B", "is_primary": true },
  { "name": "系统流", "color": "#4ECDC4" },
  { "name": "创业" }
]

// ❌ 错误示例（校验会拒绝）
[
  { "name": "", "color": "red" },        // name 为空，color 不是 #RRGGBB
  { "label": "重生" }                      // 字段名错误，应为 name
]
```

#### `default_content_focus` —— 内容侧重

```typescript
export const ContentFocusListSchema = z.array(ContentFocus).max(5);
export type ContentFocusList = z.infer<typeof ContentFocusListSchema>;

// ✅ 正确示例
["combat", "dialogue", "plot"]

// ❌ 错误示例
["战斗", "对话"]                          // 必须用英文枚举值
["combat", "combat"]                      // 重复值（视业务决定是否允许）
```

#### `custom_rules` —— 规则ID列表

```typescript
export const RuleIdListSchema = z.array(
  z.string().regex(/^rule_[a-z0-9_]+$/)     // 格式：rule_xxx
).max(50);
export type RuleIdList = z.infer<typeof RuleIdListSchema>;

// ✅ 正确示例
["rule_deai_v2", "rule_dialogue_natural"]

// ❌ 错误示例
["去AI味规则"]                              // 格式不对
["rule_"]                                   // 太短
```

#### `words_trend` —— 7天字数趋势

```typescript
export const WordsTrendSchema = z.array(
  z.number().int().min(0).max(50000)       // 单日最多5万字（防异常）
).length(7);                                // 严格7天
export type WordsTrend = z.infer<typeof WordsTrendSchema>;

// ✅ 正确示例
[2000, 3500, 0, 4000, 3000, 0, 5000]

// ❌ 错误示例
[2000, 3500, 4000]                          // 长度不对
[2000, -100, 3500]                          // 负数
```

### 2.3 volumes 表 JSON 字段 Schema

#### `structure_acts` —— 幕结构详情

```typescript
export const ActSchema = z.object({
  act_number: z.number().int().min(1).max(10),     // 幕号：1-10
  name: z.string().min(1).max(50),                  // 幕名称：如"起"、"第一幕"
  start_chapter: z.number().int().min(1),           // 起始章节
  end_chapter: z.number().int().min(1),             // 结束章节
  summary: z.string().min(1).max(500),                // 本幕内容摘要
  core_event: z.string().min(1).max(200),           // 核心事件
  conflict_escalation: z.string().max(500),           // 冲突升级描述
  emotion_tone: z.string().max(100),                // 情感基调：如"迷茫→兴奋"
  key_characters: z.array(z.string()).max(10).optional(), // 关键角色ID
  key_locations: z.array(z.string()).max(5).optional(),   // 关键地点ID
  key_items: z.array(z.string()).max(5).optional(),        // 关键物品ID
});

export const StructureActsSchema = z.array(ActSchema).min(1).max(10);
export type StructureActs = z.infer<typeof StructureActsSchema>;

// ✅ 正确示例
[
  {
    "act_number": 1,
    "name": "起",
    "start_chapter": 1,
    "end_chapter": 20,
    "summary": "主角重生回高三，确认先知优势，开始小试牛刀",
    "core_event": "第一次利用记忆赚钱",
    "conflict_escalation": "同学开始注意到主角的异常",
    "emotion_tone": "迷茫→兴奋→自信",
    "key_characters": ["char_001"],
    "key_locations": ["loc_001"]
  }
]

// ❌ 错误示例
[
  {
    "act_number": 0,                          // 必须从1开始
    "start_chapter": 50,
    "end_chapter": 20,                        // start > end
    "summary": ""                              // 不能为空
  }
]
```

### 2.4 chapters 表 JSON 字段 Schema

#### `emotion_points` —— 情绪控制点

```typescript
export const EmotionPointSchema = z.object({
  position: z.number().min(0).max(1),                // 章节内位置 0.0~1.0
  type: EmotionType,                                  // 情绪类型
  intensity: z.number().int().min(0).max(10),         // 强度 0-10
  description: z.string().min(1).max(200),          // 描述
  trigger_text: z.string().max(500).optional(),       // 触发文本（可选，用于高亮）
});

export const EmotionPointsSchema = z.array(EmotionPointSchema).max(20);
export type EmotionPoints = z.infer<typeof EmotionPointsSchema>;

// ✅ 正确示例
[
  {
    "position": 0.1,
    "type": "tense",
    "intensity": 3,
    "description": "主角发现重生真相，轻微紧张",
    "trigger_text": "等等，今天是2005年6月7日？"
  },
  {
    "position": 0.5,
    "type": "joy",
    "intensity": 7,
    "description": "第一次赚钱，爽点释放"
  },
  {
    "position": 0.9,
    "type": "anticipating",
    "intensity": 8,
    "description": "结尾悬念：神秘电话"
  }
]

// ❌ 错误示例
[
  {
    "position": 1.5,                            // 超出1.0
    "type": "happy",                             // 无效枚举值
    "intensity": 15,                             // 超出10
    "description": ""                            // 不能为空
  }
]
```

#### `appearing_*` —— 出场实体ID列表

```typescript
// 所有出场列表共用同一个Schema
export const EntityIdListSchema = z.array(
  z.string().regex(/^(char|loc|item|tech|fac)_\w+$/)  // 格式前缀校验
).max(50);
export type EntityIdList = z.infer<typeof EntityIdListSchema>;

// 分别导出别名，语义清晰
export const AppearingCharactersSchema = z.array(
  z.string().regex(/^char_\w+$/)
).max(50);
export const AppearingItemsSchema = z.array(
  z.string().regex(/^item_\w+$/)
).max(50);
export const AppearingLocationsSchema = z.array(
  z.string().regex(/^loc_\w+$/)
).max(50);
export const AppearingTechniquesSchema = z.array(
  z.string().regex(/^tech_\w+$/)
).max(50);

// ✅ 正确示例
["char_001", "char_003", "char_005"]
["loc_001"]
["item_002", "item_007"]

// ❌ 错误示例
["林渊", "苏婉桐"]                              // 必须是ID格式
["char_", "char__001"]                          // 格式不对
```

#### `foreshadowing_*` —— 伏笔关联ID列表

```typescript
export const ForeshadowingIdListSchema = z.array(
  z.string().regex(/^fore_\w+$/)
).max(20);
export type ForeshadowingIdList = z.infer<typeof ForeshadowingIdListSchema>;

// ✅ 正确示例
["fore_001", "fore_003"]

// ❌ 错误示例
["伏笔_1"]                                      // 格式不对
```

---

## 三、AI 生成 JSON 的 Prompt 模板规范

### 3.1 模板结构

每个 AI 生成 JSON 的 Prompt 必须包含：

```
【输出格式要求】
请严格按照以下 JSON Schema 输出，不要添加任何额外字段：

{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "position": { "type": "number", "minimum": 0, "maximum": 1 },
      "type": { "enum": ["tense","joyful","sad","angry","anticipating","horrific","warm","satisfying","neutral"] },
      "intensity": { "type": "integer", "minimum": 0, "maximum": 10 },
      "description": { "type": "string", "minLength": 1, "maxLength": 200 }
    },
    "required": ["position","type","intensity","description"]
  }
}

【示例】
[
  {"position": 0.1, "type": "tense", "intensity": 3, "description": "..."}
]

【警告】
- 不要输出 markdown 代码块标记（```json）
- 不要添加任何注释
- 字段名必须完全匹配，不能多也不能少
```

### 3.2 校验层代码（入库前必走）

```typescript
import { z } from 'zod';

class JsonValidator {
  private schemas: Map<string, z.ZodTypeAny>;

  constructor() {
    this.schemas = new Map([
      ['projects.tags', TagsSchema],
      ['projects.default_content_focus', ContentFocusListSchema],
      ['projects.custom_rules', RuleIdListSchema],
      ['projects.words_trend', WordsTrendSchema],
      ['volumes.structure_acts', StructureActsSchema],
      ['chapters.emotion_points', EmotionPointsSchema],
      ['chapters.appearing_characters', AppearingCharactersSchema],
      ['chapters.appearing_items', AppearingItemsSchema],
      ['chapters.appearing_locations', AppearingLocationsSchema],
      ['chapters.appearing_techniques', AppearingTechniquesSchema],
      ['chapters.planted_foreshadowings', ForeshadowingIdListSchema],
      ['chapters.resolved_foreshadowings', ForeshadowingIdListSchema],
      ['chapters.referenced_foreshadowings', ForeshadowingIdListSchema],
      ['chapters.content_focus', ContentFocusListSchema],
      ['chapters.custom_rules', RuleIdListSchema],
    ]);
  }

  validate(fieldPath: string, data: unknown): { success: true; data: any } | { success: false; error: string } {
    const schema = this.schemas.get(fieldPath);
    if (!schema) {
      return { success: false, error: `Unknown JSON field: ${fieldPath}` };
    }

    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      const errorMsg = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, error: `Validation failed for ${fieldPath}: ${errorMsg}` };
    }
  }

  // AI 生成后调用：校验 + 清洗
  sanitize(fieldPath: string, rawJson: string): { success: true; data: any } | { success: false; error: string } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (e) {
      return { success: false, error: `Invalid JSON: ${e.message}` };
    }
    return this.validate(fieldPath, parsed);
  }
}

export const jsonValidator = new JsonValidator();

// 使用示例
const aiOutput = '[{"position": 0.1, "type": "tense", "intensity": 3, "description": "..."}]';
const result = jsonValidator.sanitize('chapters.emotion_points', aiOutput);
if (!result.success) {
  console.error('AI generated invalid JSON:', result.error);
  // 触发重试或降级
}
```

---

## 四、JSON 字段版本管理

### 4.1 为什么需要版本

```
Schema v1 (现在):
  emotion_points = [{ position, type, intensity, description }]

未来 Schema v2 (可能增加):
  emotion_points = [{ position, type, intensity, description, trigger_text, duration }]

→ 旧数据需要迁移兼容
```

### 4.2 版本化方案

```typescript
// 在数据库层记录版本
interface JsonFieldVersion {
  fieldPath: string;      // 如 "chapters.emotion_points"
  schemaVersion: number;  // 当前数据使用的 Schema 版本
  data: unknown;          // JSON 数据
}

// 校验时指定版本
const EmotionPointsV1Schema = z.array(...);
const EmotionPointsV2Schema = z.array(...).extend(...);

class VersionedValidator {
  private schemas: Map<string, Map<number, z.ZodTypeAny>>;

  validate(fieldPath: string, version: number, data: unknown) {
    const versionMap = this.schemas.get(fieldPath);
    const schema = versionMap?.get(version);
    if (!schema) throw new Error(`Schema ${fieldPath} v${version} not found`);
    return schema.parse(data);
  }
}
```

---

## 五、待定义的 JSON Schema（预留）

后续表设计中会出现的新 JSON 字段，需要在这里补充：

| 表 | 字段 | 类型 | 状态 |
|------|------|------|------|
| `characters` | `properties` | `CharacterProperties` | 🔄 待定义 |
| `characters` | `relationships` | `Relationship[]` | 🔄 待定义 |
| `locations` | `coordinates` | `MapCoordinates` | 🔄 待定义 |
| `outlines` | `outline_items` | `OutlineItem[]` | 🔄 待定义 |
| `foreshadowings` | `plant_chapters` | `string[]` | 🔄 待定义 |
| `experienced_events` | `changes` | `EventChanges` | 🔄 待定义 |
| `rules` | `scenarios` | `RuleScenario[]` | 🔄 待定义 |
| `llm_calls` | `token_usage` | `TokenUsage` | 🔄 待定义 |

---

## 六、规范检查清单

- [x] projects.tags —— `TagsSchema`
- [x] projects.default_content_focus —— `ContentFocusListSchema`
- [x] projects.custom_rules —— `RuleIdListSchema`
- [x] projects.words_trend —— `WordsTrendSchema`
- [x] volumes.structure_acts —— `StructureActsSchema`
- [x] chapters.emotion_points —— `EmotionPointsSchema`
- [x] chapters.appearing_characters —— `AppearingCharactersSchema`
- [x] chapters.appearing_items —— `AppearingItemsSchema`
- [x] chapters.appearing_locations —— `AppearingLocationsSchema`
- [x] chapters.appearing_techniques —— `AppearingTechniquesSchema`
- [x] chapters.planted_foreshadowings —— `ForeshadowingIdListSchema`
- [x] chapters.resolved_foreshadowings —— `ForeshadowingIdListSchema`
- [x] chapters.referenced_foreshadowings —— `ForeshadowingIdListSchema`
- [x] chapters.content_focus —— `ContentFocusListSchema`
- [x] chapters.custom_rules —— `RuleIdListSchema`

---

> 后续每新增一张表，必须先在此处定义其 JSON 字段的 Schema，才能进入 SCHEMA_xxx.md 设计。
> 所有 AI Prompt 模板必须引用此文档中的 Schema 定义。
