# NarrativeOSPlus — 伏笔管理架构决策

> 问题：伏笔应该独立成表，还是和大纲表继承在一起？
> 分析日期：2026-05-21

---

## 方案对比

### 方案A：独立管理（推荐）

```
foreshadowings（独立表）        outline_items（大纲条目）
├─ id                           ├─ id
├─ project_id                   ├─ outline_id
├─ title                        ├─ chapter_number
├─ description                  ├─ title
├─ type                         ├─ ...
├─ importance                   ├─ to_plant_foreshadowings ──► ["fore_001"]
├─ status                       ├─ to_resolve_foreshadowings ──► ["fore_001"]
├─ plant_chapters ──► ["ch_003"]├─ to_reference_foreshadowings ──► ["fore_002"]
├─ resolve_chapters ──► ["ch_060"]
├─ related_entity_ids
└─ created_at
```

**关系**：outline_items 只存伏笔ID引用，真正的伏笔数据在 `foreshadowings` 表。

| 优点 | 说明 |
|------|------|
| ✅ 生命周期独立 | 大纲v1废弃了，伏笔还在，因为伏笔是"世界设定"的一部分 |
| ✅ 跨版本存在 | 大纲v2可以引用v1创建的伏笔，不用重新规划 |
| ✅ 独立查询 | "有哪些伏笔还没回收？"直接查 `foreshadowings` 表 |
| ✅ 写作中动态创建 | 不写大纲也能创建伏笔（即兴创作时） |
| ✅ 状态清晰 | `planned` → `planted` → `referenced` → `resolved` 完整追踪 |
| ✅ 世界引擎统一管理 | 伏笔和角色、物品一样，是世界资产 |

| 缺点 | 说明 |
|------|------|
| ⚠️ 多一层关联 | 查大纲时需要 JOIN 两个表 |
| ⚠️ 数据一致性 | outline_items 引用不存在的 foreshadowing_id 需要外键约束 |

---

### 方案B：和大纲继承在一起

```
outline_items（大纲条目）
├─ id
├─ outline_id
├─ chapter_number
├─ title
├─ ...
├─ foreshadowing_plans ──► JSON [
│   {
│     "foreshadowing_id": "fore_001",
│     "action": "plant",
│     "title": "玉佩来历",
│     "description": "...",
│     "importance": "critical"
│   }
│ ]
```

**关系**：伏笔数据内嵌在 outline_items 的 JSON 字段里。

| 优点 | 说明 |
|------|------|
| ✅ 查询简单 | 查大纲时一并拿到伏笔规划 |
| ✅ 版本天然隔离 | 大纲v1的伏笔和v2不冲突 |

| 缺点 | 说明 |
|------|------|
| ❌ 伏笔随大纲一起死 | 大纲v1废弃 → 里面的伏笔规划也丢了（除非复制到v2） |
| ❌ 无法独立查询 | "有哪些伏笔还没回收？"要遍历所有 outline_items 的 JSON |
| ❌ 无法动态创建 | 不写大纲就不能有伏笔 |
| ❌ 状态追踪困难 | 伏笔的状态分散在各个 outline_items 里 |
| ❌ 世界设定不统一 | 伏笔不像角色/物品那样被世界引擎管理 |

---

## 实际场景对比

### 场景1：大纲升级（v1 → v2）

**方案A（独立表）：**
```
v1 大纲废弃 → foreshadowings 还在
v2 大纲创建 → 直接引用已有的 foreshadowings
    outline_items[3].to_plant = ["fore_001"]  -- 复用旧伏笔
不需要重新规划！
```

**方案B（继承）：**
```
v1 大纲废弃 → v1 里的伏笔规划全丢了
v2 大纲创建 → 必须重新写一遍伏笔规划
或者：写脚本把 v1 的伏笔 JSON 复制到 v2
```

---

### 场景2：即兴创作时埋伏笔

**方案A（独立表）：**
```
作者写到第50章，突然想埋一个新伏笔
→ 直接创建 foreshadowing 记录
→ 不用改大纲
→ 系统会追踪这个伏笔，未来主动提醒回收
```

**方案B（继承）：**
```
作者写到第50章，想埋伏笔
→ 必须先找到对应的 outline_item
→ 修改 outline_item.foreshadowing_plans JSON
→ 如果没有 outline（不写大纲的人）→ 无法管理伏笔
```

---

### 场景3：AI 主动提醒

**方案A（独立表）：**
```
Memory 引擎查询：
"SELECT * FROM foreshadowings 
 WHERE project_id = 'proj_001' 
 AND status != 'resolved' 
 AND plant_chapters IS NOT NULL"
→ 返回所有未回收伏笔
→ AI 生成 Proposal："伏笔X已埋设30章未回收，建议在本章回收"
```

**方案B（继承）：**
```
Memory 引擎查询：
"遍历所有 outline_items 的 JSON 字段 
 提取 foreshadowing_plans 数组 
 筛选 status != resolved 的"
→ 性能差、逻辑复杂、容易漏
```

---

## 推荐方案：独立表 + 大纲引用

```
┌─────────────────────────────────────────────────────────────┐
│                        世界引擎层                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ characters  │  │ locations   │  │  foreshadowings     │  │
│  │ 角色        │  │ 地点        │  │  伏笔               │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │               │                   │               │
│         └───────────────┴───────────────────┘               │
│                         │                                   │
│              ┌──────────┴──────────┐                        │
│              │   world_entities    │ 统一管理               │
│              │   （统一接口）       │                        │
│              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        大纲层                                │
│  ┌─────────────┐  ┌─────────────────────────────────────┐   │
│  │ outlines    │  │ outline_items                       │   │
│  │ 大纲主表     │  │ 大纲条目                             │   │
│  └─────────────┘  │ ├─ to_plant_foreshadowings           │   │
│         │         │ │   ──► ["fore_001"] 引用伏笔ID     │   │
│         │         │ ├─ to_resolve_foreshadowings        │   │
│         │         │ │   ──► ["fore_001"] 引用伏笔ID     │   │
│         │         │ ├─ to_reference_foreshadowings      │   │
│         │         │ │   ──► ["fore_002"] 引用伏笔ID     │   │
│         │         └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 数据关系

| 关系 | 类型 | 说明 |
|------|------|------|
| `foreshadowings.project_id` → `projects.id` | 多对一 | 伏笔属于项目 |
| `outline_items.to_plant` → `foreshadowings.id` | 引用数组 | 大纲条目引用伏笔（不级联删除） |
| `foreshadowings.plant_chapters` → `chapters.id` | 数组 | 伏笔在哪些章节被埋设 |
| `foreshadowings.resolve_chapters` → `chapters.id` | 数组 | 伏笔在哪些章节被回收 |

---

## 伏笔表设计预览（后续会出完整 SCHEMA）

```sql
CREATE TABLE foreshadowings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  title TEXT NOT NULL,                   -- 伏笔名称
  description TEXT NOT NULL,             -- 伏笔描述
  type TEXT NOT NULL,                    -- 类型：item/clue/character/plot/commercial
  importance TEXT NOT NULL,              -- 重要度：low/medium/high/critical

  status TEXT NOT NULL DEFAULT 'planned' -- 状态
    CHECK(status IN ('planned','planted','referenced','resolved')),

  plant_chapters TEXT,                   -- JSON ["ch_003"] 埋设章节
  resolve_chapters TEXT,                 -- JSON ["ch_060"] 回收章节
  related_entity_ids TEXT,               -- JSON ["char_001","item_002"]

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 结论

| 维度 | 独立表 | 继承大纲 |
|------|--------|---------|
| 生命周期 | ✅ 跨大纲版本 | ❌ 随大纲生死 |
| 即兴创作 | ✅ 不写大纲也能用 | ❌ 必须写大纲 |
| 查询效率 | ✅ 直接查表 | ❌ 遍历JSON |
| 状态追踪 | ✅ 完整状态机 | ❌ 分散在JSON里 |
| 世界引擎 | ✅ 统一资产管理 | ❌ 游离在外 |
| 复杂度 | 稍高（多一层关联） | 稍低（内嵌JSON） |

**强烈建议：独立表。**

大纲中的 `to_plant` / `to_resolve` / `to_reference` 只存 **伏笔ID引用**（如 `["fore_001"]`），真正的伏笔数据在 `foreshadowings` 表。

这样：
- 大纲只是"规划"什么时候用伏笔
- 伏笔本身是"世界资产"，独立存在
- 不写大纲也能创建和管理伏笔
- AI 可以独立查询和提醒伏笔状态

---

> 确认独立表方案后，我会：
> 1. 保持 `outline_items` 中的 `to_plant` / `to_resolve` / `to_reference` 字段（只存ID引用）
> 2. 后续设计完整的 `foreshadowings` 表 SCHEMA

**确认吗？**