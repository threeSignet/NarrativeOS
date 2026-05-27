> [!NOTE] **本文档第十一章"作者控制台"中的 UI/三模式描述已作废**
> 文中"驾驶舱 Cockpit / 仪表盘 Dashboard / 休眠舱 Hibernation"三模式 + 顶部导航/页面布局/视觉描述 均为旧赛博风遗物。
> 2026-05-19 起，前端美学统一为"司天监位面"（深靛/朱砂/紫金 + 宋体 + 准/驳/议三联钤印 + 信息架构：小说宇宙 → 项目门厅 → 三堂 + 提案台 + 心法台），新设计真相源：`docs/imperial-design-system.md`。
> 第十章"四层文档体系与修订管理"等**后端文档/数据/业务规则**仍是真理源。

---

# NarrativeOS v3.0 Sovereign 技术设计文档

---

## 第十章 四层文档体系与修订管理

> *"叙事之神首先创造了世界，然后创造了世界的规则，最后才让人物在其中行走。"*

---

### 10.0 章节概述

NarrativeOS v3.0 Sovereign 采用四层文档架构作为叙事生产的核心骨架。这四层——**设定集（World Bible）→ 大纲（Master Outline）→ 卷纲（Volume Plan）→ 章纲（Chapter Brief）**——构成一个自顶向下逐层展开、自底向上逐层验证的双向闭环系统。四层之间通过严格的引用关系和一致性校验机制保持同步，任何一层的变更都会通过**影响域分析器（Impact Analyzer）**自动评估对其他层及既有正文的影响范围，从而支撑复杂的 **Retcon（Retroactive Continuity）**修订流程。

本章将完整定义四层文档的数据结构、版本管理、一致性校验和 Retcon 修订系统的全部技术规格。

---

### 10.1 设定集层（World Bible）

#### 10.1.1 职能定位

设定集层是叙事宇宙的"宪法"，定义了世界运行的全部基础规则。它是四层体系中最稳定的一层，变更频率最低，但影响范围最大。任何设定集的修改都必须经过最严格的 Retcon 审批流程。

#### 10.1.2 JSON Schema 完整定义

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "narrative-os://schemas/world-bible/v3.0",
  "title": "World Bible",
  "type": "object",
  "required": ["meta", "world_view", "power_systems", "factions", "geography", "timeline", "races_classes", "items_artifacts", "custom_domains"],
  "properties": {
    "meta": {
      "type": "object",
      "required": ["project_id", "version", "last_modified", "authors", "change_log"],
      "properties": {
        "project_id":   { "type": "string", "format": "uuid" },
        "version":      { "type": "string", "pattern": "^WB\\.\\d+\\.\\d+\\.\\d+$" },
        "last_modified":{ "type": "string", "format": "date-time" },
        "authors":      { "type": "array", "items": { "type": "string" } },
        "change_log":   { "type": "array", "items": { "$ref": "#/definitions/ChangeLogEntry" } },
        "stability_score": { "type": "number", "minimum": 0, "maximum": 1, "description": "设定稳定度评分，1.0表示完全锁定" }
      }
    },
    "world_view": {
      "type": "object",
      "required": ["cosmology", "natural_laws", "metaphysics", "thematic_core"],
      "properties": {
        "cosmology":     { "type": "string", "minLength": 100 },
        "natural_laws":  { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "metaphysics":   { "type": "string" },
        "thematic_core": { "type": "array", "items": { "type": "string" } },
        "atmosphere_tags":{ "type": "array", "items": { "type": "string" } }
      }
    },
    "power_systems": {
      "type": "object",
      "required": ["systems"],
      "properties": {
        "systems": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["system_id", "name", "description", "hierarchy", "rules", "restrictions"],
            "properties": {
              "system_id":    { "type": "string", "format": "uuid" },
              "name":         { "type": "string" },
              "description":  { "type": "string", "minLength": 50 },
              "hierarchy":    { "type": "array", "items": { "type": "string" } },
              "rules":        { "type": "array", "items": { "type": "string" }, "minItems": 1 },
              "restrictions": { "type": "array", "items": { "type": "string" } },
              "interactions": { "type": "array", "items": { "type": "string" }, "description": "与其他力量体系的交互规则" },
              "cultivation_stages": { "type": "array", "items": { "type": "string" } },
              "visual_language": { "type": "string", "description": "力量表现时的视觉风格描述" }
            }
          }
        }
      }
    },
    "factions": {
      "type": "object",
      "required": ["factions_list"],
      "properties": {
        "factions_list": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["faction_id", "name", "type", "ideology", "strength_metrics", "relationships"],
            "properties": {
              "faction_id":      { "type": "string", "format": "uuid" },
              "name":            { "type": "string" },
              "type":            { "type": "string", "enum": ["protagonist", "antagonist", "neutral", "observer", "wildcard"] },
              "parent_faction":  { "type": "string", "format": "uuid" },
              "sub_factions":    { "type": "array", "items": { "type": "string", "format": "uuid" } },
              "ideology":        { "type": "string", "minLength": 30 },
              "goals":           { "type": "array", "items": { "type": "string" } },
              "strength_metrics":{
                "type": "object",
                "properties": {
                  "military":    { "type": "integer", "minimum": 0, "maximum": 100 },
                  "economic":    { "type": "integer", "minimum": 0, "maximum": 100 },
                  "political":   { "type": "integer", "minimum": 0, "maximum": 100 },
                  "cultural":    { "type": "integer", "minimum": 0, "maximum": 100 },
                  "magical":     { "type": "integer", "minimum": 0, "maximum": 100 }
                }
              },
              "territories":     { "type": "array", "items": { "type": "string", "format": "uuid" } },
              "key_members":     { "type": "array", "items": { "type": "string", "format": "uuid" } },
              "relationships":   { "type": "array", "items": { "$ref": "#/definitions/FactionRelationship" } }
            }
          }
        }
      }
    },
    "geography": {
      "type": "object",
      "required": ["regions"],
      "properties": {
        "regions": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["region_id", "name", "description", "climate", "significance"],
            "properties": {
              "region_id":   { "type": "string", "format": "uuid" },
              "name":        { "type": "string" },
              "parent_region":{ "type": "string", "format": "uuid" },
              "description": { "type": "string", "minLength": 50 },
              "climate":     { "type": "string" },
              "terrain":     { "type": "string" },
              "significance":{ "type": "string", "description": "在叙事中的重要性说明" },
              "connected_regions": { "type": "array", "items": { "type": "string", "format": "uuid" } },
              "key_locations": { "type": "array", "items": { "$ref": "#/definitions/Location" } },
              "travel_difficulty": { "type": "integer", "minimum": 1, "maximum": 10 }
            }
          }
        }
      }
    },
    "timeline": {
      "type": "object",
      "required": ["eras", "epoch_system"],
      "properties": {
        "epoch_system": { "type": "string", "description": "纪年法描述" },
        "eras": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["era_id", "name", "start_year", "end_year", "description", "key_events"],
            "properties": {
              "era_id":     { "type": "string", "format": "uuid" },
              "name":       { "type": "string" },
              "start_year": { "type": "integer" },
              "end_year":   { "type": ["integer", "null"] },
              "description":{ "type": "string", "minLength": 30 },
              "key_events": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": ["event_id", "name", "year", "description", "impact_level"],
                  "properties": {
                    "event_id":     { "type": "string", "format": "uuid" },
                    "name":         { "type": "string" },
                    "year":         { "type": "integer" },
                    "description":  { "type": "string" },
                    "impact_level": { "type": "integer", "minimum": 1, "maximum": 10 },
                    "participating_entities": { "type": "array", "items": { "type": "string", "format": "uuid" } },
                    "referenced_in_chapters": { "type": "array", "items": { "type": "string", "format": "uuid" } }
                  }
                }
              }
            }
          }
        }
      }
    },
    "races_classes": {
      "type": "object",
      "required": ["races", "occupations"],
      "properties": {
        "races": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["race_id", "name", "description", "lifespan", "traits", "social_status"],
            "properties": {
              "race_id":      { "type": "string", "format": "uuid" },
              "name":         { "type": "string" },
              "description":  { "type": "string", "minLength": 50 },
              "lifespan":     { "type": "string" },
              "traits":       { "type": "array", "items": { "type": "string" } },
              "social_status":{ "type": "string" },
              "inherent_abilities": { "type": "array", "items": { "type": "string" } },
              "inherent_weaknesses":{ "type": "array", "items": { "type": "string" } }
            }
          }
        },
        "occupations": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["occupation_id", "name", "description", "requirements", "social_tier"],
            "properties": {
              "occupation_id": { "type": "string", "format": "uuid" },
              "name":          { "type": "string" },
              "description":   { "type": "string" },
              "requirements":  { "type": "array", "items": { "type": "string" } },
              "social_tier":   { "type": "integer", "minimum": 1, "maximum": 10 },
              "associated_powers": { "type": "array", "items": { "type": "string", "format": "uuid" } },
              "prestige_ranking":  { "type": "integer", "minimum": 1, "maximum": 100 }
            }
          }
        }
      }
    },
    "items_artifacts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["item_id", "name", "type", "description", "significance"],
        "properties": {
          "item_id":     { "type": "string", "format": "uuid" },
          "name":        { "type": "string" },
          "type":        { "type": "string", "enum": ["weapon", "armor", "artifact", "consumable", "material", "key_item", "misc"] },
          "description": { "type": "string" },
          "significance":{ "type": "string", "enum": ["trivial", "minor", "major", "plot_critical", "world_defining"] },
          "current_owner": { "type": "string", "format": "uuid" },
          "origin":        { "type": "string" },
          "capabilities":  { "type": "array", "items": { "type": "string" } },
          "limitations":   { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "custom_domains": {
      "type": "object",
      "description": "用户自定义设定域，允许作者扩展标准设定集之外的自定义分类",
      "additionalProperties": true
    }
  },
  "definitions": {
    "ChangeLogEntry": {
      "type": "object",
      "required": ["version", "timestamp", "author", "changes"],
      "properties": {
        "version":   { "type": "string" },
        "timestamp": { "type": "string", "format": "date-time" },
        "author":    { "type": "string" },
        "changes":   { "type": "array", "items": { "type": "string" } },
        "change_type": { "type": "string", "enum": ["addition", "modification", "removal", "reorganization", "clarification"] },
        "breaking":  { "type": "boolean", "description": "是否为破坏性变更" }
      }
    },
    "FactionRelationship": {
      "type": "object",
      "required": ["target_faction_id", "relationship_type", "intensity"],
      "properties": {
        "target_faction_id": { "type": "string", "format": "uuid" },
        "relationship_type": { "type": "string", "enum": ["alliance", "hostile", "neutral", "vassal", "overlord", "trade", "secret"] },
        "intensity":         { "type": "integer", "minimum": -100, "maximum": 100 },
        "description":       { "type": "string" },
        "known_to_public":   { "type": "boolean" }
      }
    },
    "Location": {
      "type": "object",
      "required": ["location_id", "name", "description", "location_type"],
      "properties": {
        "location_id":   { "type": "string", "format": "uuid" },
        "name":          { "type": "string" },
        "description":   { "type": "string" },
        "location_type": { "type": "string", "enum": ["city", "dungeon", "wilderness", "landmark", "sacred_site", "battlefield", "settlement", "fortress", "other"] },
        "significance":  { "type": "string" }
      }
    }
  }
}
```

#### 10.1.3 设定引用追踪系统

设定集中的每个实体（种族、势力、地点、事件、物品）都拥有一个全局唯一的 UUID。系统在 `entity_references` 表中维护从实体到章节的引用关系：

| 字段名 | 类型 | 说明 |
|---|---|---|
| `reference_id` | UUID | 主键 |
| `entity_id` | UUID | 引用实体ID |
| `entity_type` | ENUM | 实体类型（race/faction/location/event/item/power_system） |
| `chapter_id` | UUID | 引用该实体的章节 |
| `reference_type` | ENUM | 引用方式（mentioned/featured/deeply_explored/changed） |
| `line_number` | INTEGER | 在正文中出现的行号 |
| `context_snippet` | TEXT | 引用的上下文片段（前50字） |
| `created_at` | TIMESTAMP | 记录创建时间 |

通过此表，系统可以实时回答：
- 实体 X 在哪些章节中被引用过？
- 章节 Y 引用了哪些设定实体？
- 哪些实体从未被引用（孤儿实体）？
- 某个设定实体的引用深度分布如何？

#### 10.1.4 设定一致性自动校验规则

```typescript
interface ConsistencyRule {
  rule_id: string;
  rule_name: string;
  severity: 'fatal' | 'warning' | 'info';
  check_function: (worldBible: WorldBible, chapterText: string) => Violation[];
}

// 示例校验规则集
const CONSISTENCY_RULES: ConsistencyRule[] = [
  {
    rule_id: 'RULE-001',
    rule_name: '力量体系等级上限校验',
    severity: 'fatal',
    check_function: (wb, text) => {
      // 检测正文中是否出现超出设定等级上限的能力描述
    }
  },
  {
    rule_id: 'RULE-002',
    rule_name: '势力关系一致性校验',
    severity: 'fatal',
    check_function: (wb, text) => {
      // 检测正文中描述的势力关系是否与设定集矛盾
    }
  },
  {
    rule_id: 'RULE-003',
    rule_name: '地理位置可达性校验',
    severity: 'warning',
    check_function: (wb, text) => {
      // 检测角色在不可能的短时间内跨越不可能的距离
    }
  },
  {
    rule_id: 'RULE-004',
    rule_name: '物品归属一致性校验',
    severity: 'fatal',
    check_function: (wb, text) => {
      // 检测关键物品的当前持有者是否与设定一致
    }
  },
  {
    rule_id: 'RULE-005',
    rule_name: '时间线一致性校验',
    severity: 'fatal',
    check_function: (wb, text) => {
      // 检测正文中的时间描述是否与历史时间线矛盾
    }
  },
  {
    rule_id: 'RULE-006',
    rule_name: '种族特性一致性校验',
    severity: 'warning',
    check_function: (wb, text) => {
      // 检测角色行为是否违反其种族特性
    }
  }
];
```

每次设定集更新或新章节生成后，系统自动运行全部校验规则，生成**一致性校验报告**。任何 `fatal` 级别的违规必须解决后才能进入下一流程状态。

---

### 10.2 大纲层（Master Outline）

#### 10.2.1 职能定位

大纲层是叙事的全局路线图，定义故事从开端到结局的完整路径。它包含幕结构规划、主线里程碑、暗线布局和角色弧线设计。大纲层是连接设定集（世界规则）与卷纲/章纲（具体执行）的桥梁。

#### 10.2.2 JSON Schema 完整定义

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "narrative-os://schemas/master-outline/v3.0",
  "title": "Master Outline",
  "type": "object",
  "required": ["meta", "structure", "main_plot", "sub_plots", "character_arcs", "foreshadowing_master", "pacing_model"],
  "properties": {
    "meta": {
      "type": "object",
      "required": ["project_id", "version", "total_acts", "estimated_chapters", "status"],
      "properties": {
        "project_id":         { "type": "string", "format": "uuid" },
        "version":            { "type": "string", "pattern": "^MO\\.\\d+\\.\\d+\\.\\d+$" },
        "total_acts":         { "type": "integer", "minimum": 1 },
        "estimated_chapters": { "type": "integer" },
        "estimated_volumes":  { "type": "integer" },
        "status":             { "type": "string", "enum": ["draft", "reviewing", "locked", "completed"] },
        "genre_tags":         { "type": "array", "items": { "type": "string" } },
        "target_word_count":  { "type": "integer" },
        "core_theme":         { "type": "string" }
      }
    },
    "structure": {
      "type": "object",
      "required": ["act_model", "acts"],
      "properties": {
        "act_model": { "type": "string", "enum": ["three_act", "five_act", "seven_act", "kishotenketsu", "freytag", "custom"] },
        "acts": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["act_id", "act_number", "name", "purpose", "milestones"],
            "properties": {
              "act_id":        { "type": "string", "format": "uuid" },
              "act_number":    { "type": "integer" },
              "name":          { "type": "string" },
              "purpose":       { "type": "string", "description": "该幕在叙事中的功能" },
              "emotional_tone":{ "type": "string" },
              "milestones":    { "type": "array", "items": { "$ref": "#/definitions/Milestone" } },
              "volumes_range": { "type": "array", "items": { "type": "integer" }, "description": "该幕覆盖的卷号范围 [start, end]" },
              "chapter_range": { "type": "array", "items": { "type": "integer" } }
            }
          }
        }
      }
    },
    "main_plot": {
      "type": "object",
      "required": ["plot_id", "title", "description", "beats"],
      "properties": {
        "plot_id":     { "type": "string", "format": "uuid" },
        "title":       { "type": "string" },
        "description": { "type": "string", "minLength": 100 },
        "protagonist_goal": { "type": "string" },
        "central_conflict": { "type": "string" },
        "beats": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["beat_id", "name", "position", "description", "emotional_shift"],
            "properties": {
              "beat_id":         { "type": "string", "format": "uuid" },
              "name":            { "type": "string" },
              "position":        { "type": "number", "description": "在全文中的位置百分比 0.0-1.0" },
              "description":     { "type": "string" },
              "emotional_shift": { "type": "string", "description": "该节点前后情绪变化描述" },
              "foreshadowing_beats": { "type": "array", "items": { "type": "string", "format": "uuid" } },
              "payoff_beats":    { "type": "array", "items": { "type": "string", "format": "uuid" } },
              "assigned_chapter":{ "type": ["integer", "null"] }
            }
          }
        }
      }
    },
    "sub_plots": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["plot_id", "title", "type", "description", "beats"],
        "properties": {
          "plot_id":     { "type": "string", "format": "uuid" },
          "title":       { "type": "string" },
          "type":        { "type": "string", "enum": ["romance", "mystery", "political", "friendship", "rivalry", "growth", "revenge", "redemption", "custom"] },
          "description": { "type": "string" },
          "related_characters": { "type": "array", "items": { "type": "string", "format": "uuid" } },
          "beats": {
            "type": "array",
            "items": { "$ref": "#/definitions/SubPlotBeat" }
          },
          "resolution_chapter": { "type": ["integer", "null"] }
        }
      }
    },
    "character_arcs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["character_id", "arc_type", "starting_state", "ending_state", "transformation_points"],
        "properties": {
          "character_id":        { "type": "string", "format": "uuid" },
          "arc_type":            { "type": "string", "enum": ["positive_change", "negative_change", "flat", "circular"] },
          "starting_state":      { "type": "string" },
          "ending_state":        { "type": "string" },
          "core_lie_or_flaw":    { "type": "string" },
          "truth_or_lesson":     { "type": "string" },
          "transformation_points": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "point_id":    { "type": "string", "format": "uuid" },
                "chapter":     { "type": "integer" },
                "description": { "type": "string" },
                "degree":      { "type": "number", "minimum": 0, "maximum": 1 }
              }
            }
          }
        }
      }
    },
    "foreshadowing_master": {
      "type": "object",
      "required": ["seeds"],
      "properties": {
        "seeds": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["seed_id", "description", "plant_chapter", "harvest_chapter", "importance"],
            "properties": {
              "seed_id":          { "type": "string", "format": "uuid" },
              "description":      { "type": "string" },
              "plant_chapter":    { "type": "integer" },
              "harvest_chapter":  { "type": "integer" },
              "importance":       { "type": "string", "enum": ["subtle", "noticeable", "obvious", "critical"] },
              "related_seeds":    { "type": "array", "items": { "type": "string", "format": "uuid" } },
              "current_status":   { "type": "string", "enum": ["planned", "planted", "growing", "harvested", "withered"] }
            }
          }
        }
      }
    },
    "pacing_model": {
      "type": "object",
      "properties": {
        "tension_curve": {
          "type": "array",
          "description": "全局紧张度曲线，每章一个采样点 0-100",
          "items": { "type": "integer", "minimum": 0, "maximum": 100 }
        },
        "cliffhanger_positions": {
          "type": "array",
          "items": { "type": "integer", "description": " cliffhanger 章节号" }
        },
        "breathing_room_interval": {
          "type": "integer",
          "description": "紧张段落之间的间隔章节数"
        }
      }
    }
  },
  "definitions": {
    "Milestone": {
      "type": "object",
      "required": ["milestone_id", "name", "description"],
      "properties": {
        "milestone_id":   { "type": "string", "format": "uuid" },
        "name":           { "type": "string" },
        "description":    { "type": "string" },
        "chapter_marker": { "type": "integer" },
        "emotional_tone": { "type": "string" },
        "narrative_function": { "type": "string" }
      }
    },
    "SubPlotBeat": {
      "type": "object",
      "required": ["beat_id", "chapter", "description"],
      "properties": {
        "beat_id":     { "type": "string", "format": "uuid" },
        "chapter":     { "type": "integer" },
        "description": { "type": "string" },
        "visibility":  { "type": "string", "enum": ["overt", "subtle", "hidden"] }
      }
    }
  }
}
```

#### 10.2.3 大纲-章节映射关系

大纲通过 `milestone` 和 `beat` 两级节点与具体章节建立映射：

```
Master Outline
  ├── Act 1
  │     ├── Milestone M1 ────────→ Chapter 1-5
  │     │     ├── Beat B1.1 ─────→ Chapter 1
  │     │     ├── Beat B1.2 ─────→ Chapter 2-3
  │     │     └── Beat B1.3 ─────→ Chapter 4-5
  │     └── Milestone M2 ────────→ Chapter 6-10
  ├── Act 2
  └── Act 3
```

映射关系在 `outline_chapter_map` 表中维护：

| 字段 | 类型 | 说明 |
|---|---|---|
| `map_id` | UUID | 主键 |
| `milestone_id` | UUID | 关联里程碑 |
| `beat_id` | UUID | 关联节拍（可选） |
| `chapter_id` | UUID | 关联章节 |
| `mapping_type` | ENUM | 映射类型（drives/inspired_by/foreshadows/resolves） |
| `mapping_strength` | FLOAT | 映射强度 0.0-1.0 |

#### 10.2.4 大纲变更的级联影响分析

当大纲发生变更时，系统自动执行级联影响分析：

```python
def analyze_cascade_impact(outline_change: OutlineChange) -> CascadeImpactReport:
    """
    分析大纲变更的级联影响
    """
    report = CascadeImpactReport()
    
    # 1. 结构层影响
    if outline_change.affects_act_structure():
        report.add_impact(
            ImpactLevel.STRUCTURAL,
            f"幕结构调整影响 {outline_change.affected_chapters_count()} 个章节",
            affected_volumes=outline_change.get_affected_volume_ids()
        )
    
    # 2. 情节层影响
    for beat in outline_change.modified_beats:
        downstream = find_downstream_beats(beat.beat_id)
        report.add_impact(
            ImpactLevel.PLOT,
            f"情节节拍 '{beat.name}' 变更影响 {len(downstream)} 个下游节拍",
            affected_beats=[b.beat_id for b in downstream]
        )
    
    # 3. 伏笔层影响
    if outline_change.affects_foreshadowing():
        seeds = find_affected_foreshadowing_seeds(outline_change)
        report.add_impact(
            ImpactLevel.FORESHADOWING,
            f"伏笔布局受影响: {len(seeds)} 个种子需要重新评估",
            affected_seeds=[s.seed_id for s in seeds]
        )
    
    # 4. 角色弧线影响
    for arc in outline_change.touched_character_arcs:
        report.add_impact(
            ImpactLevel.CHARACTER,
            f"角色 {arc.character_id} 的成长弧线受影响",
            transformation_points=arc.get_affected_points()
        )
    
    return report
```

---

### 10.3 卷纲层（Volume Plan）

#### 10.3.1 职能定位

卷纲层是叙事的中观控制器，将大纲的宏大蓝图分解为可执行的卷级单元。每卷拥有独立的叙事目标、节奏控制和爽点布局，同时必须与上下卷保持无缝衔接。卷纲是连接大纲（全局视图）与章纲（微观执行）的关键枢纽。

#### 10.3.2 JSON Schema 完整定义

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "narrative-os://schemas/volume-plan/v3.0",
  "title": "Volume Plan",
  "type": "object",
  "required": ["meta", "volume_objectives", "chapter_breakdown", "foreshadowing_plan", "satisfaction_points", "bridge_requirements", "pacing_parameters"],
  "properties": {
    "meta": {
      "type": "object",
      "required": ["project_id", "volume_id", "volume_number", "version", "chapter_range"],
      "properties": {
        "project_id":     { "type": "string", "format": "uuid" },
        "volume_id":      { "type": "string", "format": "uuid" },
        "volume_number":  { "type": "integer" },
        "version":        { "type": "string", "pattern": "^VP\\.\\d+\\.\\d+\\.\\d+$" },
        "chapter_range":  { "type": "array", "items": { "type": "integer" }, "description": "[start_chapter, end_chapter]" },
        "estimated_word_count": { "type": "integer" },
        "title":          { "type": "string" },
        "subtitle":       { "type": "string" }
      }
    },
    "volume_objectives": {
      "type": "object",
      "required": ["primary_objective", "secondary_objectives", "character_goals", "reader_experience_goals"],
      "properties": {
        "primary_objective": {
          "type": "string",
          "description": "本卷必须完成的核心叙事任务"
        },
        "secondary_objectives": {
          "type": "array",
          "items": { "type": "string" }
        },
        "character_goals": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "character_id": { "type": "string", "format": "uuid" },
              "goal":         { "type": "string" },
              "obstacles":    { "type": "array", "items": { "type": "string" } },
              "growth_target":{ "type": "string" }
            }
          }
        },
        "reader_experience_goals": {
          "type": "array",
          "description": "期望读者在本卷获得的体验",
          "items": { "type": "string", "enum": ["excitement", "empathy", "curiosity", "satisfaction", "surprise", "nostalgia", "awe"] }
        }
      }
    },
    "chapter_breakdown": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["chapter_number", "chapter_id", "title", "narrative_function", "word_count_target"],
        "properties": {
          "chapter_number":     { "type": "integer" },
          "chapter_id":         { "type": "string", "format": "uuid" },
          "title":              { "type": "string" },
          "narrative_function": { "type": "string" },
          "word_count_target":  { "type": "integer" },
          "key_scenes": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "scene_id":      { "type": "string", "format": "uuid" },
                "description":   { "type": "string" },
                "scene_type":    { "type": "string", "enum": ["action", "dialogue", "introspection", "transition", "revelation", "climax", "setup"] },
                "emotional_tone":{ "type": "string" },
                "setting_id":    { "type": "string", "format": "uuid" },
                "involved_characters": { "type": "array", "items": { "type": "string", "format": "uuid" } }
              }
            }
          },
          "required_elements": {
            "type": "array",
            "description": "该章节必须包含的叙事元素",
            "items": { "type": "string" }
          },
          "forbidden_elements": {
            "type": "array",
            "description": "该章节不得出现的元素（防剧透/节奏控制）",
            "items": { "type": "string" }
          }
        }
      }
    },
    "foreshadowing_plan": {
      "type": "array",
      "description": "本卷内的伏笔播种与收割计划",
      "items": {
        "type": "object",
        "required": ["seed_id", "action", "chapter", "method"],
        "properties": {
          "seed_id":  { "type": "string", "format": "uuid" },
          "action":   { "type": "string", "enum": ["plant", "nurture", "harvest", "wither"] },
          "chapter":  { "type": "integer" },
          "method":   { "type": "string", "description": "播种/收割的方式（对话/场景/道具等）" },
          "subtlety": { "type": "integer", "minimum": 1, "maximum": 10, "description": "隐蔽程度，1=极明显，10=极隐蔽" }
        }
      }
    },
    "satisfaction_points": {
      "type": "array",
      "description": "爽点布局表",
      "items": {
        "type": "object",
        "required": ["point_id", "chapter", "type", "intensity"],
        "properties": {
          "point_id":   { "type": "string", "format": "uuid" },
          "chapter":    { "type": "integer" },
          "type":       { "type": "string", "enum": ["face_slap", "breakthrough", "revelation", "reunion", "revenge", "triumph", "emotional_payoff", "power_display", "plot_twist"] },
          "intensity":  { "type": "integer", "minimum": 1, "maximum": 10 },
          "setup_chapters": { "type": "array", "items": { "type": "integer" }, "description": "为该爽点做铺垫的章节列表" },
          "description":{ "type": "string" }
        }
      }
    },
    "bridge_requirements": {
      "type": "object",
      "description": "与上下卷的衔接要求",
      "required": ["from_previous", "to_next"],
      "properties": {
        "from_previous": {
          "type": "object",
          "properties": {
            "required_recap":     { "type": "string", "description": "需要回顾的前情" },
            "unresolved_threads": { "type": "array", "items": { "type": "string" }, "description": "上卷遗留的未解决线索" },
            "emotional_carryover":{ "type": "string", "description": "需要延续的情绪状态" }
          }
        },
        "to_next": {
          "type": "object",
          "properties": {
            "must_setup":         { "type": "array", "items": { "type": "string" }, "description": "必须为下卷铺设的内容" },
            "cliffhanger_type":   { "type": "string", "enum": ["none", "mild", "moderate", "severe", "sequel_bait"] },
            "cliffhanger_description": { "type": "string" }
          }
        }
      }
    },
    "pacing_parameters": {
      "type": "object",
      "description": "卷级节奏控制参数",
      "properties": {
        "opening_hook_strength":   { "type": "integer", "minimum": 1, "maximum": 10 },
        "rising_action_slope":     { "type": "number", "minimum": 0, "maximum": 1 },
        "midpoint_shift_intensity":{ "type": "integer", "minimum": 0, "maximum": 10 },
        "climax_chapters":         { "type": "array", "items": { "type": "integer" } },
        "resolution_breathing_room":{ "type": "integer", "minimum": 0, "description": "高潮后的缓冲章节数" },
        "chapter_tension_curve":   {
          "type": "array",
          "description": "每章紧张度采样",
          "items": { "type": "integer", "minimum": 0, "maximum": 100 }
        }
      }
    }
  }
}
```

#### 10.3.3 卷间衔接验证

系统在卷纲审批时自动执行衔接验证：

```typescript
interface VolumeBridgeValidator {
  // 验证卷间衔接一致性
  validateBridge(previousVolume: VolumePlan, currentVolume: VolumePlan): BridgeValidationResult;
}

interface BridgeValidationResult {
  passed: boolean;
  checks: {
    unresolvedThreadsResolved: boolean;    // 上卷遗留线索在本卷得到处理
    emotionalContinuityMaintained: boolean; // 情绪过渡自然
    characterStateConsistency: boolean;     // 角色状态衔接一致
    timelineContinuity: boolean;            // 时间线连贯
    powerSystemConsistency: boolean;        // 力量体系未出现跳跃
  };
  warnings: string[];
  blockers: string[];
}
```

---

### 10.4 章纲层（Chapter Brief）

#### 10.4.1 职能定位

章纲层是叙事生产的直接指令集，为 LLM 生成正文提供精确的微观指导。它定义单章内的场景分解、角色指令、情感弧线、信息管理和连续性约束。章纲由系统根据卷纲自动扩展生成，经作者审批后作为正文的生成蓝图。

#### 10.4.2 JSON Schema 完整定义

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "narrative-os://schemas/chapter-brief/v3.0",
  "title": "Chapter Brief",
  "type": "object",
  "required": ["meta", "scene_breakdown", "character_directives", "emotional_arc", "information_management", "continuity_constraints", "style_directives"],
  "properties": {
    "meta": {
      "type": "object",
      "required": ["chapter_id", "project_id", "chapter_number", "version", "brief_status"],
      "properties": {
        "chapter_id":      { "type": "string", "format": "uuid" },
        "project_id":      { "type": "string", "format": "uuid" },
        "chapter_number":  { "type": "integer" },
        "version":         { "type": "string", "pattern": "^CB\\.\\d+\\.\\d+\\.\\d+$" },
        "brief_status":    { "type": "string", "enum": ["generated", "author_editing", "approved", "rejected", "superseded"] },
        "generated_at":    { "type": "string", "format": "date-time" },
        "approved_at":     { "type": ["string", "null"], "format": "date-time" },
        "generation_seed": { "type": "string", "description": "生成该Brief的随机种子" },
        "brief_checksum":  { "type": "string", "description": "Brief内容的SHA256校验和" }
      }
    },
    "scene_breakdown": {
      "type": "array",
      "description": "场景分解列表，按叙事顺序排列",
      "items": {
        "type": "object",
        "required": ["scene_id", "scene_number", "description", "setting", "characters_present"],
        "properties": {
          "scene_id":          { "type": "string", "format": "uuid" },
          "scene_number":      { "type": "integer" },
          "description":       { "type": "string", "minLength": 50, "description": "场景的叙事功能描述" },
          "setting": {
            "type": "object",
            "required": ["location_id", "time_of_day", "atmosphere"],
            "properties": {
              "location_id":   { "type": "string", "format": "uuid" },
              "location_name": { "type": "string" },
              "time_of_day":   { "type": "string", "enum": ["dawn", "morning", "noon", "afternoon", "dusk", "evening", "midnight", "unspecified"] },
              "atmosphere":    { "type": "string" },
              "weather":       { "type": "string" },
              "sensory_details": { "type": "array", "items": { "type": "string" } }
            }
          },
          "characters_present": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "character_id":  { "type": "string", "format": "uuid" },
                "character_name":{ "type": "string" },
                "role_in_scene": { "type": "string", "enum": ["protagonist", "antagonist", "supporter", "observer", "catalyst", "victim"] },
                "emotional_state":{ "type": "string" },
                "objective_in_scene": { "type": "string" }
              }
            }
          },
          "scene_type":        { "type": "string", "enum": ["action", "dialogue", "introspection", "transition", "revelation", "setup", "cliffhanger"] },
          "expected_length":   { "type": "integer", "description": "期望字数" },
          "pov_character":     { "type": "string", "format": "uuid" },
          "key_dialogues":     { "type": "array", "items": { "type": "string" } },
          "must_include":      { "type": "array", "items": { "type": "string" }, "description": "场景中必须出现的元素" },
          "must_avoid":        { "type": "array", "items": { "type": "string" }, "description": "场景中不得出现的元素" }
        }
      }
    },
    "character_directives": {
      "type": "array",
      "description": "本章节中各角色的行动指令",
      "items": {
        "type": "object",
        "required": ["character_id", "directive", "motivation"],
        "properties": {
          "character_id":    { "type": "string", "format": "uuid" },
          "character_name":  { "type": "string" },
          "directive":       { "type": "string", "description": "该角色在本章的核心行动指令" },
          "motivation":      { "type": "string", "description": "行动动机" },
          "emotional_journey": {
            "type": "array",
            "description": "情绪变化轨迹",
            "items": {
              "type": "object",
              "properties": {
                "scene_number": { "type": "integer" },
                "emotion":      { "type": "string" },
                "intensity":    { "type": "integer", "minimum": 1, "maximum": 10 }
              }
            }
          },
          "dialogue_style":  { "type": "string", "description": "对话风格要求" },
          "growth_moment":   { "type": ["string", "null"], "description": "若有角色成长时刻，描述其内容" }
        }
      }
    },
    "emotional_arc": {
      "type": "object",
      "required": ["opening_emotion", "closing_emotion", "arc_shape", "key_turning_points"],
      "properties": {
        "opening_emotion": {
          "type": "object",
          "properties": {
            "primary":   { "type": "string" },
            "intensity": { "type": "integer", "minimum": 1, "maximum": 10 }
          }
        },
        "closing_emotion": {
          "type": "object",
          "properties": {
            "primary":   { "type": "string" },
            "intensity": { "type": "integer", "minimum": 1, "maximum": 10 },
            "cliffhanger_strength": { "type": "integer", "minimum": 0, "maximum": 10 }
          }
        },
        "arc_shape": {
          "type": "string",
          "enum": ["rising", "falling", "rise_fall", "fall_rise", "rise_fall_rise", "fall_rise_fall", "plateau", "volatile" ]
        },
        "key_turning_points": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "scene":     { "type": "integer" },
              "from_emotion": { "type": "string" },
              "to_emotion":   { "type": "string" },
              "trigger":   { "type": "string" }
            }
          }
        }
      }
    },
    "information_management": {
      "type": "object",
      "description": "信息管理：读者已知 vs 新揭示",
      "required": ["reader_knowledge_state", "new_revelations", "misdirections"],
      "properties": {
        "reader_knowledge_state": {
          "type": "array",
          "description": "读者在阅读本章前应已知晓的信息",
          "items": { "type": "string" }
        },
        "new_revelations": {
          "type": "array",
          "description": "本章计划向读者揭示的新信息",
          "items": {
            "type": "object",
            "properties": {
              "revelation_id": { "type": "string", "format": "uuid" },
              "description":   { "type": "string" },
              "reveal_method": { "type": "string", "enum": ["dialogue", "narration", "action", "discovery", "flashback", "implication"] },
              "scene":         { "type": "integer" },
              "subtlety":      { "type": "integer", "minimum": 1, "maximum": 10 }
            }
          }
        },
        "misdirections": {
          "type": "array",
          "description": "有意引导读者的错误方向",
          "items": {
            "type": "object",
            "properties": {
              "description":   { "type": "string" },
              "scene":         { "type": "integer" },
              "will_be_corrected_in_chapter": { "type": ["integer", "null"] }
            }
          }
        },
        "reader_expected_to_wonder": {
          "type": "array",
          "description": "期望读者在本章产生的疑问",
          "items": { "type": "string" }
        }
      }
    },
    "continuity_constraints": {
      "type": "object",
      "description": "连续性约束：与前文的衔接要求",
      "required": ["immediate_continuation", "required_callbacks", "state_carryover"],
      "properties": {
        "immediate_continuation": {
          "type": "string",
          "description": "紧接上章结尾的衔接描述"
        },
        "required_callbacks": {
          "type": "array",
          "description": "必须提及/呼应的前文内容",
          "items": {
            "type": "object",
            "properties": {
              "reference_type": { "type": "string", "enum": ["event", "dialogue", "item", "promise", "emotion", "prophecy"] },
              "description":    { "type": "string" },
              "source_chapter": { "type": "integer" },
              "callback_method":{ "type": "string", "enum": ["direct_reference", "subtle_allusion", "contrast", "echo"] }
            }
          }
        },
        "state_carryover": {
          "type": "object",
          "description": "必须继承的前章状态",
          "properties": {
            "character_states": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "character_id": { "type": "string", "format": "uuid" },
                  "physical_state": { "type": "string" },
                  "emotional_state":{ "type": "string" },
                  "inventory":    { "type": "array", "items": { "type": "string" } },
                  "location":     { "type": "string", "format": "uuid" }
                }
              }
            },
            "environment_state": {
              "type": "object",
              "properties": {
                "current_location": { "type": "string", "format": "uuid" },
                "time_elapsed":     { "type": "string" },
                "weather_changes":  { "type": "string" }
              }
            }
          }
        },
        "timeline_constraint": {
          "type": "string",
          "description": "时间线约束（如：必须在某事件后X天）"
        }
      }
    },
    "style_directives": {
      "type": "object",
      "description": "写作风格指令",
      "properties": {
        "overall_tone":        { "type": "string" },
        "pacing_speed":        { "type": "string", "enum": ["fast", "moderate", "slow", "variable"] },
        "description_density": { "type": "integer", "minimum": 1, "maximum": 10 },
        "dialogue_ratio":      { "type": "number", "minimum": 0, "maximum": 1, "description": "对话占全文比例目标" },
        "sentence_complexity": { "type": "string", "enum": ["simple", "moderate", "complex", "mixed"] },
        "show_dont_tell_balance": { "type": "integer", "minimum": 1, "maximum": 10, "description": "展示vs叙述的偏向度" },
        "special_instructions":   { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

#### 10.4.3 章纲与正文的对应关系

章纲到正文的生成是一个"蓝图→建筑"的精确映射过程。系统通过以下机制确保对应关系：

**（1）Scene Anchor 标记系统**

正文中通过不可见的 XML 标记锚定场景边界：

```xml
<!-- 场景开始标记，在最终呈现中隐藏 -->
<scene-anchor id="scene_001" brief_ref="uuid-here" />

场景正文内容...

<scene-anchor id="scene_001_end" />
```

**（2）Brief 遵从度评分**

每章正文生成后，系统自动计算 Brief 遵从度：

```typescript
interface BriefComplianceScore {
  overall: number;              // 0-100 总分
  scene_match: number;          // 场景数量与描述的匹配度
  character_presence: number;   // 角色出场与指令的匹配度
  emotional_arc_accuracy: number; // 情感弧线的准确度
  revelation_delivery: number;  // 信息揭示的执行度
  continuity_score: number;     // 连续性约束的遵守度
  style_adherence: number;      // 风格指令的遵守度
  violations: BriefViolation[]; // 违规项列表
}

// 低于阈值（默认 75 分）的正文需重新生成或进入修订流程
const BRIEF_COMPLIANCE_THRESHOLD = 75;
```

#### 10.4.4 章纲的生成与审批流程

章纲的生成严格遵循 MOU 状态机：

```
MOU: idle
  ├── 作者触发"下一章"或系统定时触发
  │     └── MOU → generating_possibilities
  │           └── 系统生成 3-5 个章纲可能性
  │                 └── MOU → waiting_author_choice
  │                       └── 作者在可能性选择页面 CHOOSE
  │                             └── MOU → generating_brief
  │                                   └── 系统基于选定方向生成详细 Brief
  │                                         └── MOU → waiting_brief_approval
  │                                               └── 作者审批 Brief
  │                                                     ├── APPROVE → MOU → generating_content
  │                                                     └── REVISE → 系统重新生成
```

---

### 10.5 Retcon（Retroactive Continuity）修订流程

#### 10.5.1 Retcon 触发条件

Retcon 流程在以下任一条件下触发：

| 触发类型 | 触发源 | 示例 | 默认分类 |
|---|---|---|---|
| 设定矛盾检测 | 自动校验系统 | 第50章说角色A的等级为金丹期，但第120章描述他使用元婴期才能用的法术 | 中型调整 |
| 作者主动调整 | 作者通过 GOD_MODE 或直接编辑 | 作者决定将力量体系从5级改为7级 | 大型重构 |
| 读者反馈 | 谏官系统收集的读者报告 | 大量读者指出某段情节与前期设定矛盾 | 视影响范围 |
| 大纲变更 | 大纲层修改产生的级联需求 | 主线情节转折需要修改前文伏笔 | 中型调整 |
| 创意迭代 | 长期创作中的自然进化 | 角色人气超出预期，需要增加戏份 | 小型修补 |

#### 10.5.2 Retcon 分类体系

**小型修补（Patch）—— 影响范围 ≤ 3 章**

- 错别字或事实性小错误修正
- 数值微调（如等级描述、时间描述）
- 不影响情节逻辑的细节修正
- **审批流程**：自动记录，作者收到通知，可一键确认
- **执行方式**：原地修改，自动生成补丁记录

**中型调整（Adjustment）—— 影响范围 4-15 章**

- 角色行为动机修正
- 单一设定项的变更（如某势力的实力评价）
- 单条支线的走向修改
- **审批流程**：影响域分析→作者确认修改计划→逐章执行→一致性验证
- **执行方式**：按影响范围逐个修改，保留完整变更历史

**大型重构（Reconstruction）—— 影响范围 ≥ 16 章或涉及设定集层变更**

- 核心设定变更（力量体系重构、世界观调整）
- 主线走向的重大修改
- 主要角色的增删或定位调整
- **审批流程**：完整影响分析→修改方案评审→分阶段执行→全量一致性验证→版本快照
- **执行方式**：创建新分支，保留原版本完整备份，支持随时回滚

#### 10.5.3 影响域分析器（Impact Analyzer）完整算法

影响域分析器是 Retcon 流程的核心引擎。其算法分为四个阶段：

**阶段一：变更影响图构建**

```python
class ImpactAnalyzer:
    def build_impact_graph(self, change: DocumentChange) -> ImpactGraph:
        """
        构建变更影响图
        节点：文档实体（设定/大纲节点/章节/角色/地点等）
        边：依赖/引用/因果关系
        """
        graph = ImpactGraph()
        
        # 1. 添加变更源节点
        source_node = ImpactNode(
            entity_id=change.target_entity_id,
            entity_type=change.entity_type,
            change_type=change.change_type,
            is_source=True
        )
        graph.add_node(source_node)
        
        # 2. 向前传播：查找受影响的下游实体
        # 使用 BFS 在引用关系图上传播
        queue = deque([source_node])
        visited = {source_node.entity_id}
        
        while queue:
            current = queue.popleft()
            
            # 2a. 查找直接引用该实体的文档
            for ref in self.reference_registry.get_referencers(current.entity_id):
                if ref.entity_id not in visited:
                    visited.add(ref.entity_id)
                    impact_level = self._calculate_impact_severity(
                        change, current, ref
                    )
                    node = ImpactNode(
                        entity_id=ref.entity_id,
                        entity_type=ref.entity_type,
                        impact_level=impact_level,
                        impact_path=graph.get_path(source_node, ref)
                    )
                    graph.add_node(node)
                    graph.add_edge(current.entity_id, ref.entity_id, 
                                 relation=ref.reference_type,
                                 weight=impact_level)
                    
                    if impact_level > self.FORWARD_PROPAGATION_THRESHOLD:
                        queue.append(node)
            
            # 2b. 查找因果依赖
            for causal_dep in self.causal_registry.get_dependents(current.entity_id):
                if causal_dep.entity_id not in visited:
                    visited.add(causal_dep.entity_id)
                    impact_level = self._calculate_causal_impact(
                        change, current, causal_dep
                    )
                    node = ImpactNode(
                        entity_id=causal_dep.entity_id,
                        entity_type=causal_dep.entity_type,
                        impact_level=impact_level,
                        impact_path=graph.get_path(source_node, causal_dep)
                    )
                    graph.add_node(node)
                    graph.add_edge(current.entity_id, causal_dep.entity_id,
                                 relation='causal',
                                 weight=impact_level)
                    
                    if impact_level > self.CAUSAL_PROPAGATION_THRESHOLD:
                        queue.append(node)
        
        # 3. 向后追溯：查找需要修改的前置内容
        self._backward_trace(graph, source_node, change)
        
        return graph
    
    def _backward_trace(self, graph: ImpactGraph, source: ImpactNode, 
                       change: DocumentChange):
        """
        向后追溯分析：哪些前置内容需要修改以支撑本次变更
        """
        # 查找设定前提
        for prerequisite in self.prerequisite_registry.get_prerequisites(
            source.entity_id
        ):
            if self._needs_modification(prerequisite, change):
                node = ImpactNode(
                    entity_id=prerequisite.entity_id,
                    entity_type=prerequisite.entity_type,
                    impact_level=prerequisite.required_change_severity,
                    change_required=True,
                    change_description=prerequisite.get_required_change(change)
                )
                graph.add_node(node)
                graph.add_edge(prerequisite.entity_id, source.entity_id,
                             relation='prerequisite',
                             weight=prerequisite.required_change_severity)
```

**阶段二：影响严重程度评估**

```python
@dataclass
class ImpactSeverityScore:
    structural_impact: float    # 结构影响度 0-1
    plot_impact: float         # 情节影响度 0-1
    character_impact: float    # 角色影响度 0-1
    consistency_impact: float  # 一致性影响度 0-1
    reader_experience_impact: float  # 读者体验影响度 0-1
    
    @property
    def composite_score(self) -> float:
        """综合影响评分，加权计算"""
        weights = {
            'structural': 0.25,
            'plot': 0.25,
            'character': 0.20,
            'consistency': 0.20,
            'reader_exp': 0.10
        }
        return (
            self.structural_impact * weights['structural'] +
            self.plot_impact * weights['plot'] +
            self.character_impact * weights['character'] +
            self.consistency_impact * weights['consistency'] +
            self.reader_experience_impact * weights['reader_exp']
        )
    
    @property
    def retcon_category(self) -> RetconCategory:
        score = self.composite_score
        affected_chapters = self.get_affected_chapter_count()
        
        if affected_chapters <= 3 and score < 0.3:
            return RetconCategory.PATCH
        elif affected_chapters <= 15 and score < 0.7:
            return RetconCategory.ADJUSTMENT
        else:
            return RetconCategory.RECONSTRUCTION
```

**阶段三：影响报告生成**

影响域分析完成后，系统生成结构化影响报告：

```json
{
  "report_id": "imp-report-uuid",
  "generated_at": "2026-01-15T10:30:00Z",
  "trigger_change": {
    "change_id": "change-uuid",
    "description": "将'天剑宗'的实力评级从B级提升至A级",
    "source_layer": "world_bible",
    "target_entity": "faction-tianjian-id"
  },
  "impact_summary": {
    "total_affected_entities": 47,
    "affected_chapters": 12,
    "affected_volumes": 2,
    "composite_severity": 0.58,
    "category": "ADJUSTMENT"
  },
  "forward_impacts": [
    {
      "entity_id": "chapter-45",
      "entity_type": "chapter",
      "severity": 0.8,
      "reason": "第45章描述主角挑战天剑宗，实力评级提升后战斗逻辑需重写",
      "required_action": "修改战斗场景的难度描述和胜负逻辑"
    },
    {
      "entity_id": "chapter-62",
      "entity_type": "chapter",
      "severity": 0.6,
      "reason": "第62章提到天剑宗的综合实力排名",
      "required_action": "更新排名描述"
    }
  ],
  "backward_traces": [
    {
      "entity_id": "event-tianjian-rise",
      "entity_type": "timeline_event",
      "severity": 0.5,
      "reason": "天剑宗崛起事件中需要补充A级实力的铺垫",
      "required_action": "在历史时间线中增加相关描述"
    }
  ],
  "cross_layer_impacts": [
    {
      "source_layer": "world_bible",
      "target_layer": "master_outline",
      "impact_description": "大纲第3幕中天剑宗的战略定位需要调整",
      "severity": 0.4
    }
  ],
  "suggested_modification_plan": {
    "phases": 3,
    "estimated_time": "45分钟",
    "phase_breakdown": [
      {
        "phase": 1,
        "description": "修改设定集中的实力评级和相关描述",
        "estimated_chapters": 1,
        "entities": ["faction-tianjian-id"]
      },
      {
        "phase": 2,
        "description": "修改直接引用了天剑宗实力的12个章节",
        "estimated_chapters": 12,
        "entities": ["chapter-45", "chapter-62", "..."]
      },
      {
        "phase": 3,
        "description": "全量一致性验证",
        "estimated_chapters": 0,
        "action": "run_full_consistency_check"
      }
    ]
  }
}
```

#### 10.5.4 Retcon 完整审批与执行流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Retcon 完整流程状态机                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [触发]                                                                      │
│    │                                                                         │
│    ▼                                                                         │
│  ┌──────────────┐    影响域分析器    ┌──────────────┐                      │
│  │  IMPACT      │ ─────────────────▶ │  IMPACT      │                      │
│  │  DETECTED    │    自动运行        │  ANALYZED    │                      │
│  └──────────────┘                   └──────┬───────┘                      │
│                                            │                                │
│                                            ▼                                │
│                                   ┌──────────────┐                         │
│                                   │  CATEGORY    │                         │
│                                   │  CLASSIFIED  │  Patch/Adjustment/      │
│                                   └──────┬───────┘  Reconstruction         │
│                                          │                                  │
│                    ┌─────────────────────┼─────────────────────┐           │
│                    │                     │                     │           │
│                    ▼                     ▼                     ▼           │
│              ┌──────────┐         ┌──────────┐         ┌──────────────┐   │
│              │  PATCH   │         │ ADJUST   │         │ RECONSTRUCT  │   │
│              │  AUTO    │         │ MENT     │         │ ION          │   │
│              │  EXECUTE │         │ PLANNING │         │ BRANCHING    │   │
│              └────┬─────┘         └────┬─────┘         └──────┬───────┘   │
│                   │                    │                      │            │
│                   ▼                    ▼                      ▼            │
│              ┌──────────┐         ┌──────────┐         ┌──────────────┐   │
│              │  DONE    │         │  AUTHOR  │         │  AUTHOR      │   │
│              │          │         │  REVIEW  │         │  APPROVAL    │   │
│              └──────────┘         │  PLAN    │         │  REQUIRED    │   │
│                                   └────┬─────┘         └──────┬───────┘   │
│                                        │                      │            │
│                    ┌───────────────────┘                      │            │
│                    │                                           │            │
│                    ▼                                           ▼            │
│              ┌──────────┐                              ┌──────────────┐    │
│              │  PHASED  │                              │  BRANCH      │    │
│              │  EXEC    │                              │  CREATED     │    │
│              │  UTION   │                              │              │    │
│              └────┬─────┘                              └──────┬───────┘    │
│                   │                                           │             │
│                   ▼                                           ▼             │
│              ┌──────────┐                              ┌──────────────┐    │
│              │  CONSIS  │                              │  PHASED      │    │
│              │  TENCY   │                              │  EXECUTION   │    │
│              │  CHECK   │                              │              │    │
│              └────┬─────┘                              └──────┬───────┘    │
│                   │                                           │             │
│         ┌─────────┴──────────┐                                ▼             │
│         │                      │                        ┌──────────────┐   │
│    ┌────┴────┐           ┌────┴────┐                   │  MERGE       │   │
│    │  PASS   │           │  FAIL   │                   │  DECISION    │   │
│    └────┬────┘           └────┬────┘                   └──────┬───────┘   │
│         │                     │                               │            │
│         ▼                     ▼                    ┌──────────┴──────┐    │
│    ┌──────────┐         ┌──────────┐              │  MERGE /        │    │
│    │  DONE    │         │  REVISE  │              │  ABORT          │    │
│    │          │         │  & RETRY │              └─────────────────┘    │
│    └──────────┘         └──────────┘                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 10.5.5 Retcon 历史记录与回滚支持

所有 Retcon 操作在 `retcon_history` 表中完整记录：

| 字段 | 类型 | 说明 |
|---|---|---|
| `retcon_id` | UUID | 主键 |
| `project_id` | UUID | 项目ID |
| `trigger_type` | ENUM | 触发类型 |
| `category` | ENUM | Retcon分类 |
| `change_description` | TEXT | 变更描述 |
| `impact_report_id` | UUID | 关联影响报告 |
| `modification_plan` | JSONB | 修改计划 |
| `execution_log` | JSONB | 执行日志（每步操作记录） |
| `affected_chapters` | UUID[] | 受影响的章节列表 |
| `snapshot_before` | UUID | 变更前的版本快照ID |
| `snapshot_after` | UUID | 变更后的版本快照ID |
| `author_id` | UUID | 执行变更的作者 |
| `started_at` | TIMESTAMP | 开始时间 |
| `completed_at` | TIMESTAMP | 完成时间 |
| `status` | ENUM | 状态 |

回滚支持：
- **小型修补**：通过 `snapshot_before` 直接恢复
- **中型调整**：通过 `execution_log` 逆向执行
- **大型重构**：通过分支机制保留原版本，切换回原分支即可

---

### 10.6 文档间自动一致性校验

#### 10.6.1 校验规则体系

四层文档之间存在多条校验链路，系统提供 20+ 条内置校验规则：

**设定集 ↔ 正文校验链路：**

| 规则ID | 规则名称 | 严重程度 | 校验方法 |
|---|---|---|---|
| WB-C-001 | 等级/实力描述校验 | FATAL | 正则提取正文中的等级描述，与设定集对比 |
| WB-C-002 | 势力名称校验 | FATAL | 势力名称拼写/引用是否与设定集一致 |
| WB-C-003 | 地理位置可达性 | WARNING | 角色移动速度 vs 距离 / 时间比 |
| WB-C-004 | 物品能力边界 | FATAL | 物品使用是否超出设定能力范围 |
| WB-C-005 | 时间线一致性 | FATAL | 正文中的历史事件描述与设定集时间线对比 |
| WB-C-006 | 种族特性遵守 | WARNING | 角色行为是否违反种族固有特性 |
| WB-C-007 | 力量体系规则遵守 | FATAL | 战斗场景是否违反力量体系规则 |

**大纲 ↔ 卷纲校验链路：**

| 规则ID | 规则名称 | 严重程度 | 校验方法 |
|---|---|---|---|
| MO-VP-001 | 幕结构覆盖完整度 | FATAL | 卷纲是否覆盖了大纲指定幕的全部章节 |
| MO-VP-002 | 里程碑对应检查 | WARNING | 卷内里程碑是否与大纲里程碑对应 |
| MO-VP-003 | 角色弧线进度检查 | WARNING | 角色成长进度是否与大纲规划匹配 |
| MO-VP-004 | 伏笔种子覆盖检查 | WARNING | 卷内伏笔计划是否覆盖了大纲要种植的全部种子 |

**章纲 ↔ 正文校验链路：**

| 规则ID | 规则名称 | 严重程度 | 校验方法 |
|---|---|---|---|
| CB-C-001 | 场景数量匹配 | FATAL | 正文场景数 ≥ 章纲场景数 |
| CB-C-002 | 角色出场检查 | WARNING | 正文是否包含章纲指定的全部角色 |
| CB-C-003 | 情感弧线匹配度 | WARNING | 情感走向与章纲规划的相似度 ≥ 60% |
| CB-C-004 | 信息揭示检查 | FATAL | 章纲要揭示的信息是否在正文中实际揭示 |
| CB-C-005 | 连续性约束遵守 | FATAL | 前文状态继承是否正确 |

**伏笔追踪完整性校验：**

| 规则ID | 规则名称 | 严重程度 | 校验方法 |
|---|---|---|---|
| FS-001 | 种子种植检查 | INFO | 所有 planned 状态的种子是否在指定章节种植 |
| FS-002 | 收割时机检查 | WARNING | 已到 harvest_chapter 的种子是否实际收割 |
| FS-003 | 孤儿种子检查 | WARNING | 是否有 planned 但永远未种植的种子 |
| FS-004 | 过度提示检查 | INFO | 伏笔提示次数是否过多导致剧透 |

#### 10.6.2 校验报告格式

```json
{
  "report_id": "cons-uuid",
  "generated_at": "2026-01-15T11:00:00Z",
  "project_id": "proj-uuid",
  "check_scope": "full",
  "summary": {
    "total_rules_checked": 24,
    "fatal_violations": 1,
    "warnings": 3,
    "info_items": 7,
    "passed": 13
  },
  "violations": [
    {
      "rule_id": "WB-C-001",
      "severity": "fatal",
      "description": "等级描述不一致",
      "location": {
        "chapter": 127,
        "paragraph": 15,
        "line": 3
      },
      "expected": "金丹期后期（依据设定集 power_systems[0].hierarchy[3]）",
      "actual": "元婴期初期",
      "suggested_fix": "将正文中等级描述修正为金丹期后期，或在设定集中为元婴期添加合理解释",
      "related_entities": ["char-zhangsan-id", "power-cultivation-id"]
    }
  ],
  "warnings": [
    {
      "rule_id": "CB-C-003",
      "severity": "warning",
      "description": "情感弧线偏离度为42%，超出建议阈值（40%）",
      "brief_arc": "rise_fall（章纲规划）",
      "actual_arc": "volatile（正文实际）",
      "deviation_points": [2, 4, 6]
    }
  ]
}
```

---

### 10.7 文档版本管理

#### 10.7.1 版本号规范

四层文档采用各自独立的语义化版本号：

| 层级 | 前缀 | 格式 | 示例 |
|---|---|---|---|
| 设定集 | `WB` | `WB.MAJOR.MINOR.PATCH` | WB.2.1.3 |
| 大纲 | `MO` | `MO.MAJOR.MINOR.PATCH` | MO.1.4.0 |
| 卷纲 | `VP` | `VP.VOLUME.MAJOR.MINOR` | VP.3.1.2 |
| 章纲 | `CB` | `CB.CHAPTER.MAJOR.MINOR` | CB.45.1.0 |

**版本升级规则：**

- **MAJOR（主版本）**：破坏性变更（Retcon Reconstruction 级别）、影响大纲结构的变化
- **MINOR（次版本）**：功能性变更（Retcon Adjustment 级别）、新增内容但保持向后兼容
- **PATCH（补丁）**：小型修正（Retcon Patch 级别）、不影响结构的细节修改

#### 10.7.2 变更日志格式

采用结构化变更日志（Keep a Changelog + 自定义扩展）：

```markdown
## [WB.2.1.3] - 2026-01-15

### Changed (Breaking)
- 天剑宗实力评级从 B 级提升至 A 级
  - 影响范围: 第3-5卷，第45-120章
  - Retcon ID: retcon-uuid-123
  - 作者: 张三
  - 触发原因: 设定矛盾修复（WB-C-001 检测）

### Added
- 新增势力「暗影阁」
  - 关联设定: factions[12]
  - 创建者: AI (Sovereign)
  - 审批状态: 作者已确认

### Fixed
- 修正「千年之战」年份描述（从1024年修正为1026年）
  - 影响: timeline.eras[2].events[3]
  - 一致性影响: 3个章节需同步修正
```

#### 10.7.3 版本对比与 Diff 展示

系统提供四层文档的细粒度对比功能：

```typescript
interface DiffView {
  left_version: string;       // 左版本号
  right_version: string;      // 右版本号
  diff_blocks: DiffBlock[];   // 差异块列表
}

interface DiffBlock {
  block_type: 'added' | 'removed' | 'modified' | 'unchanged';
  path: string;               // JSON 路径（如 factions[3].strength_metrics.military）
  left_value?: any;
  right_value?: any;
  diff_at_char_level?: CharacterDiff[];  // 字符级差异（文本内容）
  impact_hint?: string;       // 系统提示：此变更的影响范围
}
```

Diff 展示支持两种模式：
1. **结构模式**：JSON 树形对比，适合设定集和大纲
2. **文本模式**：行级/字符级对比，适合正文内容

#### 10.7.4 版本回滚策略

| 层级 | 回滚方式 | 回滚粒度 | 数据保留策略 |
|---|---|---|---|
| 设定集 | 点恢复（Point-in-time） | 任意历史版本 | 保留全部历史版本 |
| 大纲 | 里程碑恢复 | 任意历史版本 | 保留全部历史版本 |
| 卷纲 | 快照恢复 | 卷级 | 保留全部历史版本 |
| 章纲 | 即时恢复 | 任意历史版本 | 保留全部历史版本 |
| 正文 | 分支合并 | 章节级 | 保留30天内的全部版本，更早版本归档至冷存储 |

回滚操作始终创建新版本而非覆盖现有版本，确保所有历史可追溯。

---

> *"十层之台，起于垒土；千里之行，始于足下。"*  
> *四层文档体系如同叙事的 DNA 双螺旋——设定集与大轮廓写世界的蓝图，卷纲与章纲编织故事的纹理。Retcon 系统则如同进化的剪刀，允许叙事在最合适的时机发生最有意义的突变。*

---



## 第十一章 作者控制台界面设计

> *"给作者的不应是一台机器，而是一艘可以驾驭的飞船——驾驶舱中掌握全局，仪表盘前洞察一切，休眠舱内安心托付。"*

---

### 11.0 章节概述

NarrativeOS v3.0 Sovereign 的作者控制台是作者与 AI 协作创作的核心界面。它不仅仅是"一个网页"，而是一套完整的**创作驾驶系统**，围绕三种工作模式构建：**驾驶舱模式（Cockpit）** 用于实时创作与交互，**仪表盘模式（Dashboard）** 用于项目监控与分析，**休眠舱模式（Hibernation）** 用于后台运行与最小化监督。

本章将详细定义三种模式的完整界面规格、关键页面的线框图设计、设计系统规范、响应式策略和前端技术选型。

---

### 11.1 三模式控制台的完整设计

#### 11.1.1 模式切换架构

三种模式构成一个完整的创作工作循环，而非三个孤立的页面。作者可以在任何时候通过全局模式切换器在三种模式间切换：

```
                    ┌─────────────────┐
                    │   全局导航栏     │
                    │  [驾驶舱|仪表盘|休眠舱]  │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │  COCKPIT    │  │  DASHBOARD  │  │ HIBERNATION │
     │   驾驶舱     │  │   仪表盘    │  │   休眠舱    │
     │             │  │             │  │             │
     │ 实时创作交互 │  │ 项目监控分析 │  │ 后台运行监控 │
     │ 可能性选择  │  │ 健康度概览  │  │ 最小化界面  │
     │ Brief审批  │  │ 进度追踪    │  │ 状态指示    │
     │ 正文终审   │  │ 成本监控    │  │ 快速唤醒    │
     │ 谏官报告   │  │ 历史趋势    │  │             │
     └──────┬──────┘  └─────────────┘  └─────────────┘
            │
            │ (CHOOSE/APPROVE/REVISE 等操作)
            ▼
     ┌─────────────┐
     │   MOU状态   │
     │   机联动   │
     └─────────────┘
```

**模式切换规则：**

| 从/到 | 驾驶舱 | 仪表盘 | 休眠舱 |
|---|---|---|---|
| 驾驶舱 | — | 任意时刻 | 仅 idle 状态下 |
| 仪表盘 | 任意时刻 | — | 任意时刻 |
| 休眠舱 | 点击唤醒后 | 点击唤醒后 | — |

#### 11.1.2 驾驶舱模式（Cockpit）详细设计

驾驶舱是作者与 NarrativeOS 进行实时交互的核心空间。其设计理念借鉴了真实飞行驾驶舱的"抬头即可见一切关键信息"原则——作者在任何时刻都能一眼掌握当前状态、可用操作和待办事项。

**（1）核心工作区布局（ASCII 线框图）**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [■] NarrativeOS Sovereign      🧭 驾驶舱  [仪表盘] [休眠舱]    👤 作者  ⚙ │
├──────────────┬──────────────────────────────────────────┬───────────────────┤
│              │                                          │                   │
│  导航面板     │          主工作区 (动态内容)              │    右侧面板        │
│              │                                          │                   │
│  📋 可能性   │  ┌──────────────────────────────────┐   │  🌡️ 状态指示器    │
│  📝 Brief    │  │                                  │   │                   │
│  📖 正文     │  │    根据 MOU 状态动态显示内容：     │   │  MOU: generating_ │
│  🔍 审查     │  │                                  │   │  possibilities   │
│  ⚡ 行动     │  │  - 可能性选择卡片                │   │                   │
│  📊 报告     │  │  - Brief 编辑器                  │   │  心流熵: 0.42     │
│              │  │  - 正文阅读区                    │   │  ████████░░░░     │
│  ──────────  │  │  - 终审滑动条                    │   │                   │
│              │  │  - 谏官报告面板                  │   │  谏官: online     │
│  📚 项目树   │  │                                  │   │  🟢 正常运行      │
│  ├─ 第一卷   │  └──────────────────────────────────┘   │                   │
│  │  ├─ 第1章 │                                          │  ─────────────   │
│  │  └─ 第2章 │                                          │  快捷操作栏        │
│  ├─ 第二卷   │                                          │                   │
│  │  └─ ...  │                                          │  [CHOOSE] [SKIP]  │
│              │                                          │  [APPROVE] [REVISE]│
│              │                                          │  [GOD_MODE]       │
│              │                                          │                   │
├──────────────┴──────────────────────────────────────────┴───────────────────┤
│  📢 通知中心                                                                │
│  [🔔] 谏官: "第45章伏笔密度偏高，建议增加缓冲"  [查看] [忽略]          [×]  │
└─────────────────────────────────────────────────────────────────────────────┘

区域尺寸规范（桌面端 1920×1080 基准）：
- 导航面板：宽度 220px，固定
- 主工作区：宽度 1020px，自适应
- 右侧面板：宽度 300px，固定
- 通知中心：高度 48px，可折叠
- 顶部导航栏：高度 56px，固定
```

**（2）可能性选择面板**

可能性选择面板呈现系统生成的 3-5 个叙事方向。支持三种视图模式：

**卡片式视图（默认）：**

```
┌────────────────────────────────────────────────────┐
│           选择本章的叙事方向 (3/5)                  │
├───────────────┬───────────────┬────────────────────┤
│               │               │                    │
│  可能性 A     │  可能性 B     │  可能性 C          │
│  ⭐ 推荐      │               │                    │
│               │               │                    │
│  "危机中的    │  "意外的     │  "平静的          │
│   突破"      │   盟友"      │   日常"           │
│               │               │                    │
│  主角在第45   │  主角遇到    │  主角修炼一天，    │
│  章面临的围   │  一个神秘    │  巩固新获得的      │
│  攻中触发潜   │  的盟友，    │  力量，与同伴      │
│  在力量，实   │  获得关键    │  交流感情。        │
│  现等级突破。 │  情报。      │                    │
│               │               │                    │
│  紧张度: ████ │  紧张度: ██   │  紧张度: █        │
│  爽点强度: 9  │  爽点强度: 5  │  爽点强度: 3       │
│  伏笔: 2个    │  伏笔: 1个    │  伏笔: 0个         │
│               │               │                    │
│  [预览Brief]  │  [预览Brief]  │  [预览Brief]       │
│  [选择此方向] │  [选择此方向] │  [选择此方向]      │
│               │               │                    │
└───────────────┴───────────────┴────────────────────┘
```

**列表式视图（对比模式）：**

```
┌──────────────────────────────────────────────────────────────┐
│ 特性对比                                                     │
├─────────────┬──────────┬──────────┬──────────┬──────────────┤
│ 维度        │ 可能性A  │ 可能性B  │ 可能性C  │ 你的偏好      │
├─────────────┼──────────┼──────────┼──────────┼──────────────┤
│ 叙事节奏    │ 快节奏    │ 中节奏    │ 慢节奏    │ 快节奏 ✓      │
│ 情感基调    │ 激昂     │ 神秘     │ 温馨     │ —            │
│ 角色成长    │ ★★★★★   │ ★★★☆☆   │ ★★☆☆☆   │ ★★★★☆        │
│ 伏笔播种    │ 2个      │ 1个      │ 0个      │ ≥1 ✓         │
│ 爽点强度    │ 9/10     │ 5/10     │ 3/10     │ ≥7 ✓         │
│ 连续性      │ 优秀     │ 良好     │ 优秀     │ —            │
│ 匹配度评分  │ 92%      │ 67%      │ 45%      │              │
└─────────────┴──────────┴──────────┴──────────┴──────────────┘
```

**对比式视图（A/B 对比模式，支持两两详细对比）：**

```
┌─────────────────────────────────────────────────────────────┐
│ 可能性 A vs 可能性 B — 详细对比                             │
├────────────────────────┬────────────────────────────────────┤
│ 可能性 A: "危机中的突破" │ 可能性 B: "意外的盟友"              │
├────────────────────────┼────────────────────────────────────┤
│                        │                                    │
│ 场景1: 围攻开始         │ 场景1: 逃亡途中                     │
│ 场景2: 绝境中的领悟      │ 场景2: 神秘人出现                    │
│ 场景3: 力量突破         │ 场景3: 身份揭示                      │
│ 场景4: 反杀             │ 场景4: 合作突围                      │
│                        │                                    │
│ 优势: 爽点强烈、读者     │ 优势: 增加新角色、扩展世界           │
│ 情绪高涨                │ 观、埋下长线伏笔                     │
│                        │                                    │
│ 风险: 力量升级可能显得   │ 风险: 新角色引入可能分散             │
│ 突兀                    │ 主线焦点                            │
│                        │                                    │
│ [选择A]                │ [选择B]                             │
└────────────────────────┴────────────────────────────────────┘
```

**（3）Brief 编辑区**

Brief 编辑区是一个带语法高亮的结构化 JSON 编辑器，专为章纲编辑优化：

```
┌──────────────────────────────────────────────────────────────┐
│ 章纲编辑器 — 第45章  [APPROVE] [REVISE] [RESET] [?]          │
├──────────────────────────────────────────────────────────────┤
│ 折叠/展开: [全部] [场景] [角色] [情感] [信息] [连续] [风格]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📁 meta                                                     │
│  ├─ chapter_number: 45                                       │
│  ├─ version: "CB.45.1.0"                                     │
│  └─ brief_status: "author_editing"                           │
│                                                              │
│  📁 scene_breakdown [2个场景]                                 │
│  ├─ 📄 场景1                                                 │
│  │   ├─ scene_number: 1    ← 可编辑，蓝色高亮               │
│  │   ├─ description:                                        │
│  │   │  "主角在绝境中领悟新技能的核心要义，                   │
│  │   │   周围环境因力量波动而崩塌。"                          │
│  │   ├─ scene_type: "action"    ← 下拉选择 [action|dialogue│
│  │   │                                          |setup|...] │
│  │   ├─ expected_length: 2500                                │
│  │   └─ setting:                                             │
│  │       ├─ location: "断魂崖"                               │
│  │       ├─ time_of_day: "dusk"                              │
│  │       └─ atmosphere: "压抑，雷电交加"                      │
│  │                                                           │
│  ├─ 📄 场景2                                                 │
│  │   └─ ...                                                  │
│                                                              │
│  📁 emotional_arc                                            │
│  ├─ opening_emotion: { "primary": "绝望", "intensity": 8 }    │
│  ├─ closing_emotion: { "primary": "狂喜", "intensity": 9 }    │
│  └─ arc_shape: "fall_rise" ← 可视化弧线: ╲╱╲               │
│                                                              │
│  📁 continuity_constraints                                   │
│  └─ immediate_continuation: "紧接第44章结尾，                  │
│      主角被天剑宗弟子围困在断魂崖边缘"                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

编辑器特性：
- **语法高亮**：JSON 键（灰色）、字符串值（白色）、数值（绿色）、枚举值（黄色下拉框）
- **实时验证**：编辑时即时显示 JSON Schema 验证错误（红色下划线 + 悬浮提示）
- **智能补全**：基于 World Bible 的实体引用自动补全（势力名、角色名、地点名）
- **折叠导航**：左侧迷你地图显示整体结构，可快速跳转
- **变更追踪**：修改过的字段左侧显示橙色标记，悬停显示原值

**（4）正文预览区**

正文预览区提供带批注的阅读视图，支持终审流程：

```
┌──────────────────────────────────────────────────────────────┐
│ 正文预览 — 第45章  [返回Brief] [开始终审] [RAW]               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  字数: 3,247 | 段落: 28 | 阅读时间: ~12分钟                  │
│                                                              │
│  ─────────────────────────────────────────────────────────   │
│                                                              │
│    断魂崖上的风像是刀子，一刀一刀地割在张三的脸上。          │
│  他背靠着万丈深渊，面前是十二名天剑宗弟子组成的剑阵。        │
│                                                              │
│    💬 谏官批注                                               │
│    ┌────────────────────────────────────────────────────┐    │
│    │ "此处环境描写可再增加嗅觉细节（血腥味？焦糊味？）   │    │
│    │  以强化绝境氛围。"  — 谏官·文笔                     │    │
│    └────────────────────────────────────────────────────┘    │
│                                                              │
│    张三握紧手中的断剑，感受着体内灵力的枯竭。七天七夜的     │
│  逃亡已经耗尽了他的全部力量，此刻连站立都在摇晃。             │
│                                                              │
│    🔗 连续性                                                 │
│    ┌────────────────────────────────────────────────────┐    │
│    │ 延续自: 第44章 §3 "主角灵力消耗至10%"              │    │
│    │ 状态校验: ✓ 一致                                    │    │
│    └────────────────────────────────────────────────────┘    │
│                                                              │
│    剑阵中心，天剑宗首弟子李长青缓缓走出，嘴角挂着一丝         │
│  冷笑：                                                      │
│                                                              │
│    "张三，交出传承玉佩，我给你一个痛快。"                    │
│                                                              │
│    ✏️ 作者批注 (你的批注)                                    │
│    ┌────────────────────────────────────────────────────┐    │
│    │ 这句台词太平了，改成带个人恩怨色彩的                │    │
│    │ [标记为 REVISE 要点]                                │    │
│    └────────────────────────────────────────────────────┘    │
│                                                              │
│  ─────────────────────────────────────────────────────────   │
│                                                              │
│  [上一章] [第44章]        [目录]        [第46章] [下一章]   │
└──────────────────────────────────────────────────────────────┘
```

**（5）状态指示器（右侧面板）**

```
┌─────────────────┐
│ 🌡️ 状态指示器   │
├─────────────────┤
│                 │
│  MOU 状态       │
│  ┌───────────┐ │
│  │ generating│ │
│  │ _content  │ │
│  └───────────┘ │
│  正在生成正文   │
│                 │
│  ⏱️ 预计完成    │
│  12:34 (ETC)   │
│                 │
│  ─────────────  │
│                 │
│  心流熵值       │
│  0.42 / 1.00   │
│  ████████░░░░  │
│                 │
│  [趋势图 ▼]    │
│    ╱╲╱╲╱╲╱╲    │
│   ╱    ╲   ╲   │
│  ╱      ╲   ╲  │
│                 │
│  ─────────────  │
│                 │
│  谏官系统       │
│  🟢 在线        │
│                 │
│  活跃谏官:      │
│  ├─ 文笔     🟢│
│  ├─ 设定     🟢│
│  ├─ 节奏     🟡│
│  └─ 伏笔     🟢│
│                 │
│  待处理报告: 2  │
│  [查看报告]     │
│                 │
│  ─────────────  │
│                 │
│  今日统计       │
│  生成: 3章      │
│  审批: 2章      │
│  修订: 1章      │
│  字数: 9,800    │
│                 │
└─────────────────┘
```

**（6）快捷操作栏**

快捷操作栏根据当前 MOU 状态动态显示可用操作：

| MOU 状态 | 显示按钮 | 功能说明 |
|---|---|---|
| `generating_possibilities` | [REFRESH] [SKIP] [MANUAL] | 刷新可能性/跳过此章/手动编写 |
| `waiting_author_choice` | [CHOOSE A] [CHOOSE B] ... [REJECT ALL] | 选择方向/全部拒绝 |
| `generating_brief` | [CANCEL] | 取消生成 |
| `waiting_brief_approval` | [APPROVE] [REVISE] [EDIT] [REJECT] | 批准/要求修订/手动编辑/拒绝 |
| `generating_content` | [CANCEL] | 取消生成 |
| `waiting_final_review` | [APPROVE] [REVISE] [REJECT] [GOD_MODE] | 终审通过/要求修订/拒绝/神谕模式 |
| `revising_content` | [CANCEL] | 取消修订 |
| `waiting_author_verdict` | [ACCEPT] [REJECT] [COMPARE] | 接受修订/拒绝/对比版本 |
| `committing` | — | 自动提交，无操作 |
| `idle` | [NEXT CHAPTER] [PAUSE] [SETTINGS] | 下一章/暂停/设置 |

**（7）通知中心**

通知中心位于界面底部，可折叠。显示三类通知：

1. **谏官报告通知**：自动弹出新的谏官审查报告
2. **Flow Guardian 提醒**：心流熵值异常、创作节奏警告等
3. **系统消息**：MOU 状态变更、生成完成、错误告警等

每条通知支持的操作：[查看] [忽略] [稍后提醒] [不再提醒此类]

---

#### 11.1.3 仪表盘模式（Dashboard）详细设计

仪表盘模式是作者脱离实时创作、进入项目宏观管理时的界面。它提供项目健康度、创作进度、世界状态和成本监控四大核心视图。

**（1）项目健康度概览**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  NarrativeOS Sovereign      [驾驶舱] 🧭 仪表盘  [休眠舱]    👤 作者  ⚙   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  项目: 《苍穹之上》                    状态: 🔴 需要关注                    │
│                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌───────────────────┐  │
│  │ 📊 综合健康评分      │  │ 📈 完读率趋势        │  │ 🔥 质量评分        │  │
│  │                     │  │                     │  │                   │  │
│  │    72 / 100         │  │    ╱╲╱╲╱╲╱╲        │  │    82 / 100       │  │
│  │    ████████░░       │  │   ╱    ╲   ╲       │  │    ████████░░     │  │
│  │                     │  │  ╱      ╲   ╲      │  │                   │  │
│  │    ↑ +5 vs 上周    │  │   第1-45章趋势      │  │    文笔: 85       │  │
│  │                     │  │                     │  │    设定: 78 ⚠    │  │
│  │    最后更新: 2h前  │  │    当前: 68%        │  │    节奏: 88       │  │
│  │                     │  │    趋势: ↘          │  │    角色: 79       │  │
│  └─────────────────────┘  └─────────────────────┘  └───────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🕸️ 伏笔回收率                                                        │   │
│  │                                                                      │   │
│  │  已种植: 23 个种子    已收割: 14 个    枯萎: 2 个    回收率: 73.7%   │   │
│  │                                                                      │   │
│  │  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  73.7%       │   │
│  │                                                                      │   │
│  │  即将到期（3章内需收割）: 3 个                                        │   │
│  │  [查看伏笔地图]                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ⚠️ 告警面板                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ [设定] WB-C-001: 第45章等级描述与设定集不一致（1项违规）             │   │
│  │ [伏笔] FS-002: 3个种子即将超过最佳收割窗口期                         │   │
│  │ [节奏] PG-003: 第42-45章紧张度连续上升，建议在第46章设置缓冲          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**（2）创作进度追踪**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  创作进度                                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📊 总体进度                                                             │
│  ████████████████████████████████████████░░░░░░░░░░░░░░░░░░  45/100章   │
│  45,200 / 预计 120,000 字                                                │
│                                                                         │
│  📅 日更统计（过去14天）                                                  │
│   一   二   三   四   五   六   日                                       │
│  ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐                                          │
│  │🔥││✓ ││✓ ││⚠ ││✓ ││✗ ││✓ │  ✓ 完成  ✗ 未完成  ⚠ 部分完成  🔥 超额   │
│  │2章││1章││1章││1章││1章││0章││1章│                                          │
│  └──┘└──┘└──┘└──┘└──┘└──┘└──┘                                          │
│   3.2k 2.1k 1.8k 1.5k 2.3k —   2.1k  (字)                               │
│                                                                         │
│  📈 字数趋势                                                             │
│     字数(k)                                                               │
│  3.5 ┤        ╱╲                                                          │
│  3.0 ┤   ╱╲  ╱  ╲    ╱╲                                                   │
│  2.5 ┤  ╱  ╲╱    ╲  ╱  ╲                                                  │
│  2.0 ┤ ╱          ╲╱    ╲╱╲                                               │
│  1.5 ┤╱                    ╲                                              │
│  1.0 ┤                     ╲                                             │
│  0.5 ┤                                                                   │
│  0.0 ┼────┬────┬────┬────┬────┬────┬────┬────┬────┬──                  │
│      第35 第36 第37 第38 第39 第40 第41 第42 第43 第44                   │
│                                                                         │
│  日均字数: 2,100  |  平均章节完成时间: 18分钟  |  连续日更: 5天           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**（3）世界状态快照**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  世界状态快照 — 《苍穹之上》                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   👤 实体    │  │   🔗 关系    │  │   ⚔️ 势力    │  │   📍 地点    │  │
│  │             │  │             │  │             │  │             │  │
│  │  总: 142    │  │  总: 387    │  │  总: 12     │  │  总: 28     │  │
│  │  角色: 48   │  │  同盟: 23   │  │  主角派: 3  │  │  城市: 8    │  │
│  │  物品: 31   │  │  敌对: 17   │  │  反派派: 4  │  │  秘境: 12   │  │
│  │  技能: 63   │  │  家族: 45   │  │  中立: 5    │  │  野外: 8    │  │
│  │             │  │             │  │             │  │             │  │
│  │ 新增(7d): 8 │  │ 新增(7d): 15│  │ 变动(7d): 2 │  │ 新增(7d): 3 │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                                         │
│  🕸️ 势力平衡图                                                          │
│                                                                         │
│  天剑宗 ████████████████████████████████████ 78%  (+5%本周)            │
│  暗影阁 ██████████████████████░░░░░░░░░░░░░░ 45%  (+2%本周)            │
│  散修盟 ██████████████████░░░░░░░░░░░░░░░░░░ 38%  (-3%本周)            │
│  妖族   ██████████████░░░░░░░░░░░░░░░░░░░░░░ 28%  (—)                 │
│                                                                         │
│  [查看势力详情]  [关系图谱]  [查看世界地图]                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**（4）成本监控面板**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  成本监控                                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  本月累计消耗                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                                                                  │  │
│  │  LLM 调用次数    │  87,234 次    │  预估成本: ¥156.40           │  │
│  │  Token 消耗      │  12.4M 输入   │  输出: 3.2M                  │  │
│  │  平均每章成本    │  ¥1.73        │  较上月: -12%                │  │
│  │                                                                  │  │
│  │  Token 消耗分布                                                  │  │
│  │  Brief生成 ████████████████████░░░░░░░░  35%                    │  │
│  │  正文生成  ████████████████████████████  45%                    │  │
│  │  审查分析  ████████░░░░░░░░░░░░░░░░░░░░  12%                    │  │
│  │  Retcon    ████░░░░░░░░░░░░░░░░░░░░░░░░   8%                    │  │
│  │                                                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  🔔 成本告警设置                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [✓] 每日预算告警: ¥10/天                                         │  │
│  │ [✓] 月度预算告警: ¥200/月                                        │  │
│  │ [✗] Token 速率告警: 100K/小时                                    │  │
│  │ [✓] 单次调用成本上限: ¥0.50                                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**（5）谏官历史报告趋势**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  谏官报告趋势（过去30天）                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  报告数量趋势                                                           │
│  20 ┤    ╱╲      ╱╲╱╲                                                  │
│  15 ┤   ╱  ╲    ╱    ╲╱╲                                               │
│  10 ┤  ╱    ╲  ╱         ╲                                             │
│   5 ┤ ╱      ╲╱           ╲                                            │
│   0 ┼────┬────┬────┬────┬────┬────┬────┬────┬────┬───                │
│     第1周 第2周 第3周 第4周                                             │
│                                                                         │
│  谏官表现统计                                                           │
│  ┌─────────┬────────┬────────┬──────────┬──────────┐                  │
│  │ 谏官    │ 报告数 │ 采纳率 │ 平均严重度 │ 最近活跃  │                  │
│  ├─────────┼────────┼────────┼──────────┼──────────┤                  │
│  │ 文笔    │ 45     │ 82%    │ 2.3      │ 2小时前   │                  │
│  │ 设定    │ 32     │ 91%    │ 3.1      │ 昨天      │                  │
│  │ 节奏    │ 28     │ 67%    │ 2.8      │ 3小时前   │                  │
│  │ 伏笔    │ 19     │ 95%    │ 1.9      │ 昨天      │                  │
│  │ 角色    │ 15     │ 73%    │ 2.5      │ 2天前     │                  │
│  └─────────┴────────┴────────┴──────────┴──────────┘                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**（6）可自定义小部件系统**

仪表盘支持作者自定义布局：

```typescript
interface DashboardWidget {
  widget_id: string;
  widget_type: WidgetType;
  position: { x: number; y: number; w: number; h: number };
  config: WidgetConfig;
  refresh_interval: number; // 秒
}

type WidgetType =
  | 'health_score'      // 健康评分
  | 'completion_rate'   // 完读率
  | 'word_count_chart'  // 字数趋势图
  | 'foreshadowing_map' // 伏笔地图缩略图
  | 'critic_summary'    // 谏官摘要
  | 'cost_tracker'      // 成本追踪
  | 'daily_quote'       // 每日金句
  | 'character_mood'    // 角色情绪状态
  | 'world_events'      // 世界事件时间线
  | 'custom_note'       // 自定义便签
  | 'recent_activity';  // 最近活动
```

作者可以拖拽添加、移除、调整大小和重新排列小部件。布局使用 `react-grid-layout` 实现，自动持久化到用户配置中。

---

#### 11.1.4 休眠舱模式（Hibernation）详细设计

休眠舱模式是当作者暂时离开、系统进入后台自主运行时的界面。其设计理念是"最小必要信息，最大安心感"。

**（1）最小化界面**

```
┌──────────────────────────────────────────┐
│  NarrativeOS Sovereign  [唤醒] [设置]    │
├──────────────────────────────────────────┤
│                                          │
│      ┌──────────────────────────┐        │
│      │                          │        │
│      │      💤 休眠中           │        │
│      │                          │        │
│      │   系统正在后台运行       │        │
│      │   下一章预计 12:34 完成  │        │
│      │                          │        │
│      │   已完成: 第45章 ✓       │        │
│      │   进行中: 第46章 ...     │        │
│      │                          │        │
│      └──────────────────────────┘        │
│                                          │
│  必要操作:                               │
│  [⏸ 暂停所有任务]  [⚙ 调整运行参数]      │
│                                          │
│  最近事件:                               │
│  12:30 ✓ 第45章 终审通过                 │
│  12:28 📝 第46章 Brief 已生成            │
│  12:15 ⚡ 第46章 正在生成正文             │
│                                          │
│  ─────────────────────────────────────── │
│                                          │
│  后台任务队列:                           │
│  ┌────────────────────────────────────┐ │
│  │ ⏳ 第46章正文生成     ETA 12:34    │ │
│  │ ⏳ 第46章谏官审查     ETA 12:38    │ │
│  │ ⏳ 第47章可能性生成   ETA 12:45    │ │
│  │ 📋 第48章大纲预计算   已排队      │ │
│  └────────────────────────────────────┘ │
│                                          │
└──────────────────────────────────────────┘
```

**（2）后台运行指示器**

界面底部有一个微妙的脉动动画指示器，表示系统正在后台运行：

```css
@keyframes hibernation-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1;0; }
}

.hibernation-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
  animation: hibernation-pulse 3s ease-in-out infinite;
}
```

**（3）唤醒条件和动画规格**

唤醒触发条件：
- 作者手动点击唤醒按钮
- 系统需要作者决策（MOU 进入 `waiting_*` 状态）
- 检测到需要关注的异常（fatal 违规、谏官紧急报告）
- 设定的时间提醒

唤醒动画：

```css
@keyframes wake-up {
  0% {
    opacity: 0;
    transform: scale(0.95);
    filter: blur(4px);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.02);
    filter: blur(1px);
  }
  100% {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
  }
}

/* 从休眠舱 → 驾驶舱的过渡动画 */
.hibernation-to-cockpit {
  animation: wake-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* 同时播放环境光从暗到亮的过渡 */
@keyframes ambient-light {
  0% { background-color: #0a0e1a; }
  100% { background-color: #0f1729; }
}
```

**（4）自动保存状态展示**

休眠舱界面实时显示自动保存状态：

```
自动保存状态
┌──────────────────────────────────────────┐
│ 最后保存: 2分钟前                        │
│                                          │
│ 设定集:  ✓ WB.2.1.3  (已同步)           │
│ 大纲:    ✓ MO.1.4.0   (已同步)           │
│ 卷3纲:   ✓ VP.3.1.2   (已同步)           │
│ 第45章:  ✓ CB.45.1.0  (已同步)           │
│ 正文:    ✓ CV.45.3    (已同步)           │
│                                          │
│ 云端备份: 最后一次 12:30 ✓               │
│ 本地快照: 3个版本保留                    │
└──────────────────────────────────────────┘
```

---

### 11.2 关键页面详细设计

#### 11.2.1 可能性选择页面

**线框图描述：**

可能性选择页面是驾驶舱模式在 MOU 处于 `waiting_author_choice` 状态时的主工作区。页面顶部显示标题"选择本章叙事方向"，中间为 3-5 个可能性卡片（响应式网格布局），底部为操作栏。

**交互说明：**

```typescript
interface PossibilitySelectionPage {
  // 页面状态
  state: 'loading' | 'displaying' | 'comparing' | 'confirming';
  
  // 核心交互
  interactions: {
    // 1. 卡片悬停：显示更多详情（Brief预览弹窗）
    onCardHover: (possibilityId: string) => BriefPreviewPopup;
    
    // 2. 卡片点击：展开详细视图
    onCardClick: (possibilityId: string) => DetailedView;
    
    // 3. 选择按钮：确认选择
    onChoose: (possibilityId: string) => {
      // 显示确认对话框
      showConfirmDialog({
        title: "确认选择",
        message: `你将选择 "${possibility.title}" 作为第${chapterNumber}章的叙事方向。系统将基于此方向生成详细Brief。`,
        actions: ["确认", "再看看", "取消"]
      });
      // 确认后发送 CHOOSE 命令到 MOU
      mou.sendCommand({ type: 'CHOOSE', possibility_id: possibilityId });
    };
    
    // 4. 对比模式切换：进入两两对比视图
    onCompareMode: () => void;
    
    // 5. 全部拒绝：作者对当前所有选项不满意
    onRejectAll: () => {
      showPromptDialog({
        title: "拒绝全部选项",
        message: "请简要说明你期望的方向，系统将重新生成可能性：",
        inputType: 'textarea',
        actions: ["提交并重新生成", "取消"]
      });
    };
    
    // 6. 手动编写：作者想自己写Brief
    onManualWrite: () => {
      // 跳转到Brief编辑器，预填基本结构
      navigateToBriefEditor({ mode: 'manual', template: 'chapter_brief' });
    };
    
    // 7. 投票功能（可选）：多个可能性的投票比较
    onVote: (possibilityId: string, voteType: 'up' | 'down') => void;
  };
}
```

---

#### 11.2.2 Brief 审批页面

**线框图描述：**

Brief 审批页面展示系统生成的章纲，供作者审查。采用左右分栏布局：左侧为结构化的 Brief 编辑器（JSON Tree 视图），右侧为自然语言摘要视图（"人话版"Brief）。

**交互说明：**

```typescript
interface BriefApprovalPage {
  // 双视图切换
  views: ['structured', 'natural_language', 'split'];
  
  // 核心交互
  interactions: {
    // 1. 直接编辑：在结构化视图中修改任意字段
    onFieldEdit: (path: string, newValue: any) => {
      // 实时 JSON Schema 验证
      const validation = validateAgainstSchema(newValue, path);
      if (!validation.valid) {
        showFieldError(validation.errors);
        return;
      }
      // 标记字段为"已修改"
      markFieldAsModified(path);
      // 重新计算校验和
      updateBriefChecksum();
    };
    
    // 2. APPROVE：批准当前 Brief
    onApprove: () => {
      // 验证必填字段
      if (!validateAllRequiredFields()) {
        showError("存在必填字段未填写");
        return;
      }
      mou.sendCommand({ type: 'APPROVE', brief_checksum: currentChecksum });
    };
    
    // 3. REVISE：请求系统重新生成
    onRevise: () => {
      showPromptDialog({
        title: "请求修订",
        message: "请描述你期望的修改方向：",
        inputType: 'textarea',
        actions: ["提交修订请求", "取消"]
      });
      mou.sendCommand({ type: 'REVISE', feedback: userInput });
    };
    
    // 4. 字段级注释：作者可以对特定字段添加注释
    onAddFieldComment: (path: string, comment: string) => void;
    
    // 5. 对比上一个版本（如果这是修订后的版本）
    onCompareWithPrevious: () => DiffView;
    
    // 6. 智能建议：AI 根据编辑历史提供的优化建议
    onShowSmartSuggestions: () => SuggestionPanel;
  };
}
```

---

#### 11.2.3 正文终审页面（仪式化阅读 + 滑动条交互）

正文终审页面是整个创作流程中最具仪式感的界面。其设计目标是创造一个沉浸式的阅读环境，让作者能以"读者"的身份审视 AI 生成的正文，同时保持对创作全局的掌控。

**（1）仪式化阅读环境**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  沉浸模式 [ON]    字体: [Sans ▼] 大小: [16 ▼] 行距: [1.6 ▼] 主题: [暗▼]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│                        第45章 绝境中的领悟                                  │
│                                                                             │
│                                                                             │
│    断魂崖上的风像是刀子，一刀一刀地割在张三的脸上。                         │
│    他背靠着万丈深渊，面前是十二名天剑宗弟子组成的剑阵。                      │
│                                                                             │
│    剑光如雪。                                                               │
│                                                                             │
│    张三握紧手中的断剑，感受着体内灵力的枯竭。七天七夜的                     │
│  逃亡已经耗尽了他的全部力量，此刻连站立都在摇晃。                             │
│                                                                             │
│    ——但他没有退路。                                                         │
│                                                                             │
│    剑阵中心，天剑宗首弟子李长青缓缓走出，嘴角挂着一丝                         │
│  冷笑：                                                                     │
│                                                                             │
│    "张三，你以为逃到这里就能活命？"                                         │
│                                                                             │
│    [批注] 💬 "台词可以更有威胁感"                                          │
│                                                                             │
│    张三抬起头，血从额角的伤口滑落，滴进眼睛里。                              │
│  他没有擦，只是握紧了断剑。                                                  │
│                                                                             │
│    "李长青，"他的声音沙哑，"你知道为什么我能逃七天七夜                     │
│  吗？"                                                                      │
│                                                                             │
│    [批注] 🔗 延续自第44章 §3 "主角灵力消耗至10%" — 一致                   │
│                                                                             │
│    李长青眉头微皱。                                                         │
│                                                                             │
│    "因为每一次绝境，"张三低声说，嘴角忽然扬起一个疯狂的                     │
│  笑容，"都是突破的契机。"                                                   │
│                                                                             │
│    轰——                                                                     │
│                                                                             │
│    天地变色。                                                               │
│                                                                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📊 实时分析面板（可折叠）                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 情绪弧线: 绝望(8) → 疲惫(7) → 决绝(9) → 狂喜(9)                    │   │
│  │ Brief匹配度: 87%  ████████████████████████████████░░░              │   │
│  │ 节奏评分: 8.5/10                                                    │   │
│  │ 文笔评分: 8.2/10                                                    │   │
│  │ 伏笔播种: 2个 ✓                                                    │   │
│  │ 设定一致: ✓ 全部通过                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  [◀ 上一章]      [返回Brief]  [终审判定]  [下一章 ▶]                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**沉浸式阅读特性：**
- **无干扰模式**：隐藏所有UI元素，仅显示正文和极简导航
- **行聚焦模式**：高亮当前阅读行，其余行半透明
- **进度感知**：右侧边缘显示阅读进度指示条
- **实时分析**：浮动面板显示当前章节的实时质量分析
- **批注内嵌**：谏官报告和连续性检查的结果以内联批注形式呈现，不打断阅读流

**（2）滑动条交互详细规格**

终审判定采用三滑动条系统，这是整个界面中最重要的交互组件之一。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           终审判定面板                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  对第45章正文的终审判定                                                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  1️⃣ 整体质量评分                                                     │   │
│  │                                                                      │   │
│  │     极差          一般         良好         优秀        完美          │   │
│  │      │            │            │            │           │           │   │
│  │  ════●═══════════════════════════════════════════════════          │   │
│  │      5.5/10                                                          │   │
│  │                                                                      │   │
│  │  [需要修改后才能接受]                                                 │   │
│  │                                                                      │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  2️⃣ Brief 遵从度                                                      │   │
│  │                                                                      │   │
│  │     严重偏离     部分偏离    基本遵从     完全遵从     超越预期       │   │
│  │      │            │            │            │           │           │   │
│  │  ════════════════●═══════════════════════════════════════          │   │
│  │                   75%                                                │   │
│  │                                                                      │   │
│  │  ⚠️ 情感弧线偏离: Brief规划为"rise_fall"，实际为"volatile"          │   │
│  │  ✓ 场景数量匹配                                                      │   │
│  │  ✓ 角色出场正确                                                      │   │
│  │  ✗ 信息揭示顺序与Brief不同                                           │   │
│  │                                                                      │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  3️⃣ 读者体验预判                                                      │   │
│  │                                                                      │   │
│  │     无聊           平淡         尚可         精彩        震撼         │   │
│  │      │            │            │            │           │           │   │
│  │  ═══════════════════════════●═══════════════════════════          │   │
│  │                            7.2/10                                    │   │
│  │                                                                      │   │
│  │  预估完读率: 78%    情绪峰值: 9/10    爽点强度: 8/10                │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  综合判定建议: 需要修改后重审                                                 │
│                                                                             │
│  [提交判定并进入修订]  [降低标准接受]  [返回继续阅读]  [GOD_MODE 强制通过]   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**滑动条组件规格（Slider Component）：**

```typescript
interface VerdictSlider {
  // 基础属性
  id: string;
  label: string;
  description: string;
  min: number;       // 0
  max: number;       // 10
  step: number;      // 0.1
  defaultValue: number;
  
  // 分段标记
  segments: {
    position: number;    // 0-10 的位置
    label: string;       // 分段标签
    color: string;       // 分段颜色
    description: string; // 悬浮时显示的描述
  }[];
  
  // 视觉规格
  visual: {
    trackHeight: 4;           // 轨道高度 4px
    thumbSize: 20;            // 滑块大小 20px
    thumbBorderWidth: 3;      // 滑块边框 3px
    thumbBorderColor: 'var(--color-primary)';
    trackColor: 'var(--color-border)';
    filledTrackColor: 'var(--color-primary)';
    segmentLabels: true;      // 显示分段标签
    showTooltip: true;        // 拖动时显示数值提示
    tooltipFormat: (value: number) => string;  // 格式化函数
  };
  
  // 交互行为
  behavior: {
    snapToSegments: false;    // 不吸附到分段点
    showTicks: true;          // 显示刻度线
    keyboardStep: 0.5;        // 键盘左右箭头步进值
    requireConfirmation: true; // 提交前需要确认
  };
  
  // 状态联动
  onValueChange: (value: number) => {
    // 更新综合判定建议
    updateVerdictRecommendation();
    // 更新可用操作按钮
    updateActionButtons();
  };
}

// 三个滑动条的联动逻辑
function updateVerdictRecommendation(): VerdictRecommendation {
  const quality = getSliderValue('quality');
  const compliance = getSliderValue('compliance');
  const experience = getSliderValue('experience');
  
  const composite = quality * 0.4 + compliance * 0.3 + experience * 0.3;
  
  if (composite >= 8.0) {
    return {
      recommendation: 'APPROVE',
      description: '质量优秀，建议直接通过',
      availableActions: ['APPROVE', 'REVISE']
    };
  } else if (composite >= 6.0) {
    return {
      recommendation: 'CONDITIONAL',
      description: '基本合格，建议小幅修改后重审',
      availableActions: ['APPROVE', 'REVISE', 'GOD_MODE']
    };
  } else {
    return {
      recommendation: 'REJECT',
      description: '质量不达标，建议重新生成',
      availableActions: ['REVISE', 'REJECT', 'GOD_MODE']
    };
  }
}
```

**滑动条动画规格：**

```css
/* 滑动条拖动动画 */
.slider-thumb {
  transition: transform 0.15s ease-out, box-shadow 0.2s ease;
}

.slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 0 0 6px var(--color-primary-alpha-20);
}

.slider-thumb:active {
  transform: scale(1.1);
  cursor: grabbing;
}

/* 轨道填充动画 */
.slider-track-filled {
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 数值变化时的数字滚动动画 */
@keyframes score-update {
  0% { transform: translateY(-10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

.score-value.updated {
  animation: score-update 0.3s ease-out;
}
```

---

#### 11.2.4 谏官报告页面

谏官报告页面汇总展示所有谏官（AI 审查代理）的审查结果。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  谏官报告中心 — 第45章                                           [筛选 ▼]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📊 综合评分: 82/100    致命: 0    警告: 2    建议: 5    信息: 3            │
│                                                                             │
│  谏官筛选: [全部] [文笔] [设定] [节奏] [伏笔] [角色] [自定义]              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ⚠️ 设定 — 天剑宗实力                                               │   │
│  │                                                                     │   │
│  │ 位置: 第45章 §3 第15行                                              │   │
│  │ 正文: "天剑宗首弟子李长青已达到金丹后期"                             │   │
│  │ 问题: 根据设定集 WB.2.1.3，天剑宗弟子等级上限为金丹中期              │   │
│  │ 建议: 将"后期"改为"中期"，或在设定集中提升天剑宗等级上限             │   │
│  │                                                                     │   │
│  │ [查看设定] [一键修复] [标记已处理] [忽略此条]                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ⚠️ 节奏 — 紧张度持续                                                │   │
│  │                                                                     │   │
│  │ 第42-45章紧张度曲线: 65% → 72% → 80% → 85%                         │   │
│  │ 问题: 连续4章紧张度上升，读者可能产生阅读疲劳                        │   │
│  │ 建议: 第46章建议设置为"缓冲章节"，紧张度降至 50% 以下                │   │
│  │                                                                     │   │
│  │ [查看趋势图] [采纳建议] [忽略]                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 💬 文笔 — 描写建议                                                  │   │
│  │                                                                     │   │
│  │ 位置: 第45章 §1                                                     │   │
│  │ 正文: "断魂崖上的风像是刀子，一刀一刀地割在张三的脸上。"            │   │
│  │ 建议: 可增加嗅觉细节（如"血腥味混合着焦土的气息"）以强化沉浸感      │   │
│  │ 优先级: 低                                                          │   │
│  │                                                                     │   │
│  │ [查看上下文] [采纳修改] [忽略]                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [导出报告] [全部标记已读] [批量操作]                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

#### 11.2.5 神谕下达页面（Oracle-Interface）

神谕下达页面（GOD_MODE 界面）是作者在需要直接干预叙事时的特殊界面。它提供最高级别的创作控制权。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚡ 神谕下达台                    ⚠️ 这是最高级别干预 — 使用需谨慎         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  神谕类型: [直接改写正文 ▼] [修改设定] [调整大纲] [自定义指令]             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📝 自然语言指令                                                      │   │
│  │                                                                      │   │
│  │ ┌────────────────────────────────────────────────────────────────┐  │   │
│  │ │ 请让第45章的战斗场景更加激烈。具体来说：                        │  │   │
│  │ │                                                                 │  │   │
│  │ │ 1. 增加天剑宗弟子的人数到24人                                  │  │   │
│  │ │ 2. 让张三在突破前先受一次重伤（断臂）                           │  │   │
│  │ │ 3. 突破时加入天地异象描写（雷劫、彩虹等）                       │  │   │
│  │ │                                                                 │  │   │
│  │ │ 风格要求：保持热血激昂的基调，不要过于黑暗。                    │  │   │
│  │ └────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │ 指令复杂度: 🟢 简单    预估影响: 本章（1个章节）                     │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🔮 影响域预览                                                        │   │
│  │                                                                      │   │
│  │  将受影响的文档:                                                     │   │
│  │  ├─ 第45章 正文（直接修改）                                          │   │
│  │  ├─ 第45章 章纲（同步更新）                                          │   │
│  │  ├─ 第46章 章纲（连续性约束需更新）                                  │   │
│  │  └─ 设定集: 力量体系（可能需要调整上限说明）                         │   │
│  │                                                                      │   │
│  │  [运行影响域分析]                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  执行选项:                                                                  │
│  [✓] 同步更新章纲                                                          │
│  [✓] 运行一致性校验                                                        │
│  [✗] 自动修复发现的问题                                                    │
│  [✓] 生成变更日志                                                          │
│                                                                             │
│  [预览修改] [直接执行] [取消]                                               │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                             │
│  📜 最近的神谕记录                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 今天 10:23 — 修改第43章角色对话风格 — 已执行 ✓                       │   │
│  │ 昨天 15:45 — 新增势力「暗影阁」— 已执行 ✓（触发中型Retcon）          │   │
│  │ 昨天 11:20 — 调整第40章伏笔强度 — 已执行 ✓                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**神谕执行的安全机制：**

1. **复杂度检测**：系统自动评估指令复杂度，高复杂度指令需要额外确认
2. **影响域预览**：执行前必须先运行影响域分析
3. **版本快照**：执行前自动创建当前状态快照
4. **分步执行**：复杂修改可预览每一步的效果
5. **回滚按钮**：执行后 5 分钟内显示"撤销此神谕"按钮

---

#### 11.2.6 设定集编辑器

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📚 设定集编辑器  WB.2.1.3                                    [保存] [▲]  │
├──────────────┬──────────────────────────────────────────────────────────────┤
│              │                                                              │
│  📁 世界总览  │   🏛️ 天剑宗 — 势力详情                                       │
│  📁 力量体系  │                                                              │
│  ├─ 修真体系 │   基础信息                                   [编辑] [历史]  │
│  └─ 武道体系 │                                                              │
│  📁 势力分布  │   名称: 天剑宗                                                │
│  ├─ 🏛️ 天剑宗│   类型: 反派                                                  │
│  ├─ 🏰 暗影阁│   等级: A级                                                   │
│  └─ 🛖 散修盟│   总部: 天剑山脉 · 天剑峰                                     │
│  📁 地理环境  │                                                              │
│  📁 历史时间线│   实力指标                                                    │
│  📁 种族职业  │   军事: ████████████████████░░ 78%                           │
│  📁 物品法宝  │   经济: ████████████████░░░░░░ 55%                           │
│  📁 自定义    │   政治: ████████████████████████ 82%                           │
│              │   文化: ██████████████░░░░░░░░░░ 48%                           │
│              │   修为: ██████████████████████░░ 72%                           │
│              │                                                              │
│              │   关系网络                                                    │
│              │   ┌───────────┐                                               │
│              │   │   天剑宗   │                                               │
│              │   └─────┬─────┘                                               │
│              │    敌对 │ 敌对                                                  │
│              │   ┌────┴────┐                                                  │
│              │   ▼         ▼                                                  │
│              │ 散修盟    暗影阁（秘密同盟）                                    │
│              │                                                              │
│              │   引用追踪: 在 12 个章节中被引用                                │
│              │   [查看引用分布] [查看一致性报告]                               │
│              │                                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

---

#### 11.2.7 大纲可视化页面

大纲可视化页面将叙事结构以图形化方式呈现，让作者能直观把握全局。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🗺️ 大纲可视化                                                [幕] [卷] [章]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  幕结构视图:                                                                │
│                                                                             │
│  第一幕: 启程          第二幕: 历练          第三幕: 决战                     │
│  ═══════════════       ═══════════════       ═══════════════                │
│  紧张度: ▁▂▃▅▆        ▆▅▃▂▁▂▃▅▆          ▆▆▆▅▃▂▁                          │
│                                                                             │
│  ┌─┐ ┌─┐ ┌─┐          ┌─┐ ┌─┐ ┌─┐ ┌─┐          ┌─┐ ┌─┐                    │
│  │1│ │2│ │3│          │20│ │21│ │22│ │23│        │45│ │46│                    │
│  └─┘ └─┘ └─┘          └─┘ └─┘ └─┘ └─┘          └─┘ └─┘                    │
│   ▲   ▲   ▲            ▲   ▲   ▲   ▲            ▲   ▲                     │
│   │   │   │            │   │   │   │            │   │                     │
│  ═══════════════════════════════════════════════════════════════════════    │
│  主线: ─────●────────────●───────────────────────────●─────────▶          │
│  暗线1: ────────────●────────────────────●─────────────────────▶          │
│  暗线2: ─────●────────────────────────────────●────────────●───▶          │
│                                                                             │
│  伏笔种子: 🌱(种植) 🌿(成长) 🌾(收割)                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 第1章🌱  第5章🌱  第15章🌿  第20章🌱  第35章🌿  第45章🌾          │   │
│  │ [查看伏笔地图]                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  角色弧线追踪:                                                              │
│  张三: 天真(1) → 觉醒(15) → 迷茫(25) → 坚定(35) → 巅峰(45)                │
│  李长青: 傲慢(1) → 忌惮(20) → 疯狂(40) → ???                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 11.3 设计系统（Design System）

#### 11.3.1 色彩体系

NarrativeOS 采用深色主题为主的色彩体系，灵感来自航空电子设备和科幻终端界面。所有颜色使用 CSS 自定义属性定义，支持一键切换主题。

```css
:root {
  /* === 主题色 === */
  --color-primary: #6366F1;           /* 靛蓝 — 主要操作 */
  --color-primary-light: #818CF8;     /* 浅靛蓝 — 悬停 */
  --color-primary-dark: #4F46E5;      /* 深靛蓝 — 按下 */
  --color-primary-alpha-20: rgba(99, 102, 241, 0.2);
  --color-primary-alpha-10: rgba(99, 102, 241, 0.1);
  
  --color-secondary: #10B981;         /* 翠绿 — 成功/通过 */
  --color-accent: #F59E0B;            /* 琥珀 — 警告/注意 */
  --color-danger: #EF4444;            /* 红色 — 错误/危险 */
  --color-info: #3B82F6;              /* 蓝色 — 信息提示 */
  
  /* === 语义色 === */
  --color-text-primary: #F1F5F9;      /* 主要文字 — 近乎白 */
  --color-text-secondary: #94A3B8;    /* 次要文字 — 灰蓝 */
  --color-text-tertiary: #64748B;     /* 辅助文字 — 深灰 */
  --color-text-disabled: #475569;     /* 禁用文字 */
  
  --color-bg-base: #0F172A;           /* 基础背景 — 深蓝黑 */
  --color-bg-elevated: #1E293B;       /* 抬升背景 — 面板 */
  --color-bg-overlay: #334155;        /* 叠加背景 — 悬停/选中 */
  --color-bg-input: #0F172A;          /* 输入框背景 */
  
  --color-border: #334155;            /* 边框 */
  --color-border-light: #475569;      /* 浅色边框 */
  --color-divider: #1E293B;           /* 分割线 */
  
  /* === MOU 状态色 === */
  --mou-idle: #10B981;                /* 空闲 — 翠绿 */
  --mou-generating: #6366F1;          /* 生成中 — 靛蓝（脉动动画） */
  --mou-waiting: #F59E0B;             /* 等待中 — 琥珀 */
  --mou-error: #EF4444;               /* 错误 — 红色 */
  --mou-committing: #8B5CF6;          /* 提交中 — 紫色 */
  
  /* === 谏官类型色 === */
  --critic-literary: #EC4899;         /* 文笔 — 粉红 */
  --critic-worldbuilding: #06B6D4;    /* 设定 — 青色 */
  --critic-pacing: #F97316;           /* 节奏 — 橙色 */
  --critic-foreshadowing: #A78BFA;    /* 伏笔 — 紫罗兰 */
  --critic-character: #14B8A6;        /* 角色 — 薄荷绿 */
  
  /* === 层级标识色 === */
  --layer-world-bible: #EF4444;       /* 设定集 — 红色 */
  --layer-master-outline: #F59E0B;    /* 大纲 — 琥珀 */
  --layer-volume-plan: #3B82F6;       /* 卷纲 — 蓝色 */
  --layer-chapter-brief: #10B981;     /* 章纲 — 翠绿 */
}
```

**心流熵值渐变色：**

```css
/* 心流熵值 0-1 的渐变映射 */
--flow-entropy-0: #10B981;   /* 0.0 — 完美心流，翠绿 */
--flow-entropy-1: #A3E635;   /* 0.25 — 良好，黄绿 */
--flow-entropy-2: #FACC15;   /* 0.5 — 一般，黄色 */
--flow-entropy-3: #FB923C;   /* 0.75 — 偏差，橙色 */
--flow-entropy-4: #EF4444;   /* 1.0 — 严重偏离，红色 */
```

#### 11.3.2 字体规范

```css
:root {
  /* === 字体族 === */
  --font-sans: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-serif: 'Noto Serif SC', 'Songti SC', Georgia, serif;
  --font-mono: 'JetBrains Mono', 'Noto Sans SC', 'Fira Code', monospace;
  
  /* === 字号规范 === */
  --text-xs: 0.75rem;       /* 12px — 标签、小字 */
  --text-sm: 0.875rem;      /* 14px — 次要文字 */
  --text-base: 1rem;        /* 16px — 正文 */
  --text-lg: 1.125rem;      /* 18px — 小标题 */
  --text-xl: 1.25rem;       /* 20px — 面板标题 */
  --text-2xl: 1.5rem;       /* 24px — 页面标题 */
  --text-3xl: 1.875rem;     /* 30px — 大标题 */
  
  /* === 字重 === */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
  
  /* === 行高 === */
  --leading-tight: 1.25;    /* 标题 */
  --leading-normal: 1.5;    /* 正文 */
  --leading-relaxed: 1.75;  /* 阅读模式 */
  --leading-loose: 2;       /* 沉浸阅读 */
}
```

正文阅读区使用 `--font-serif` 以提供更好的阅读体验，UI 元素使用 `--font-sans`，代码/JSON 编辑器使用 `--font-mono`。

#### 11.3.3 组件库清单

NarrativeOS 控制台使用一套自定义的 React 组件库，基于以下分类：

**基础组件（Primitive）：**

| 组件名 | 用途 | 状态 |
|---|---|---|
| `Button` | 按钮（主要/次要/危险/幽灵/链接五种变体） | 正常、悬停、按下、禁用、加载中 |
| `Input` | 文本输入框 | 正常、聚焦、错误、禁用 |
| `Textarea` | 多行文本输入 | 同上 |
| `Select` | 下拉选择器 | 正常、展开、选中、禁用 |
| `Slider` | 滑动条（终审判定核心组件） | 正常、拖动中、禁用 |
| `Switch` | 开关切换 | 开、关、禁用 |
| `Checkbox` | 复选框 | 选中、未选中、半选、禁用 |
| `Radio` | 单选按钮 | 选中、未选中、禁用 |
| `Tag` | 标签（信息/成功/警告/错误/中性） | — |
| `Badge` | 徽标（数字/状态指示） | — |
| `Tooltip` | 悬浮提示 | 显示、隐藏 |
| `Popover` | 弹出面板 | 显示、隐藏 |
| `Modal` | 模态对话框 | 打开、关闭 |
| `Toast` | 轻提示 | 显示、隐藏、自动关闭 |

**复合组件（Composite）：**

| 组件名 | 用途 |
|---|---|
| `Card` | 卡片容器（可能性卡片、谏官报告卡片等） |
| `Panel` | 面板容器（右侧状态面板、通知中心等） |
| `DataTable` | 数据表格（实体列表、引用追踪等） |
| `TreeView` | 树形视图（项目树、JSON 导航等） |
| `Timeline` | 时间线（历史时间线、伏笔追踪等） |
| `Chart` | 图表（健康度、字数趋势、成本监控等） |
| `DiffViewer` | 差异对比视图（版本对比、Retcon 预览等） |
| `JsonEditor` | JSON 编辑器（Brief 编辑器等） |
| `BatchAnnotator` | 批注组件（正文批注显示） |
| `StatusIndicator` | 状态指示器（MOU 状态、谏官状态等） |
| `ProgressBar` | 进度条（生成进度、阅读进度等） |
| `MouStateMachine` | MOU 状态机可视化 |

**布局组件（Layout）：**

| 组件名 | 用途 |
|---|---|
| `AppShell` | 应用外壳（导航栏+主内容区+侧面板的布局骨架） |
| `Sidebar` | 侧边栏 |
| `Topbar` | 顶部导航栏 |
| `Workspace` | 工作区容器 |
| `SplitPane` | 可拖拽分栏 |
| `ResizablePanel` | 可调整大小面板 |
| `NotificationCenter` | 通知中心 |

#### 11.3.4 间距和布局规范

```css
:root {
  /* === 间距 === */
  --space-1: 0.25rem;    /* 4px */
  --space-2: 0.5rem;     /* 8px */
  --space-3: 0.75rem;    /* 12px */
  --space-4: 1rem;       /* 16px */
  --space-5: 1.25rem;    /* 20px */
  --space-6: 1.5rem;     /* 24px */
  --space-8: 2rem;       /* 32px */
  --space-10: 2.5rem;    /* 40px */
  --space-12: 3rem;      /* 48px */
  
  /* === 圆角 === */
  --radius-sm: 4px;      /* 小元素 */
  --radius-md: 8px;      /* 按钮、输入框 */
  --radius-lg: 12px;     /* 卡片、面板 */
  --radius-xl: 16px;     /* 大面板、模态框 */
  
  /* === 阴影 === */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.4);
  --shadow-xl: 0 16px 32px rgba(0, 0, 0, 0.5);
  --shadow-glow-primary: 0 0 20px rgba(99, 102, 241, 0.3);
  
  /* === 过渡 === */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;
}
```

**布局栅格：**

- 基础栅格：8px 网格系统
- 面板间距：`--space-4` (16px)
- 卡片内边距：`--space-6` (24px)
- 页面外边距：`--space-8` (32px)

#### 11.3.5 暗黑模式支持

NarrativeOS 默认使用暗黑模式，同时支持亮色模式切换。实现方案：

```css
/* 暗黑模式（默认） */
[data-theme="dark"] {
  /* 使用上面定义的深色变量 */
}

/* 亮色模式 */
[data-theme="light"] {
  --color-bg-base: #F8FAFC;
  --color-bg-elevated: #FFFFFF;
  --color-bg-overlay: #F1F5F9;
  --color-text-primary: #0F172A;
  --color-text-secondary: #475569;
  --color-text-tertiary: #94A3B8;
  --color-border: #E2E8F0;
  --color-border-light: #CBD5E1;
  --color-divider: #E2E8F0;
  /* ... */
}

/* 自动跟随系统 */
[data-theme="auto"] {
  @media (prefers-color-scheme: light) {
    /* 亮色变量 */
  }
  @media (prefers-color-scheme: dark) {
    /* 暗色变量 */
  }
}
```

---

### 11.4 响应式设计策略

#### 11.4.1 桌面端（主要场景 — 1920×1080 及以上）

桌面端是 NarrativeOS 控制台的主要目标平台。布局采用三栏式：

| 断点 | 宽度 | 布局策略 |
|---|---|---|
| `xl` | ≥ 1920px | 完整三栏布局，最大内容区 |
| `lg` | 1440-1919px | 三栏布局，右侧面板收窄至 260px |
| `md` | 1280-1439px | 三栏布局，导航面板可折叠 |

#### 11.4.2 平板端（阅读模式 — 768×1024 至 1280×800）

平板端定位为"移动阅读"场景，优化阅读体验：

```
┌────────────────────────────────────────────┐
│  ≡  [标题]              [驾驶舱] [👤] [⚙]  │
├────────────────────────────────────────────┤
│                                            │
│  断魂崖上的风像是刀子，一刀一刀地割         │
│  在张三的脸上。他背靠着万丈深渊，面前       │
│  是十二名天剑宗弟子组成的剑阵。             │
│                                            │
│  ——但他没有退路。                          │
│                                            │
│  张三握紧手中的断剑，感受着体内灵力         │
│  的枯竭。七天七夜的逃亡已经耗尽了他         │
│  的全部力量...                              │
│                                            │
│                                            │
├────────────────────────────────────────────┤
│  [◀]      [▓▓▓░░░░░ 45%]         [▶]      │
│  [批注] [终审] [设置] [目录]               │
└────────────────────────────────────────────┘
```

平板端特性：
- 导航面板变为可滑出的抽屉
- 右侧面板集成到底部工具栏
- 正文区域最大化
- 支持手势操作：左滑上一章、右滑下一章、双指缩放

#### 11.4.3 键盘快捷键系统

全面的键盘快捷键支持，提高创作效率：

| 快捷键 | 功能 | 适用模式 |
|---|---|---|
| `Ctrl/Cmd + 1` | 切换到驾驶舱模式 | 全局 |
| `Ctrl/Cmd + 2` | 切换到仪表盘模式 | 全局 |
| `Ctrl/Cmd + 3` | 切换到休眠舱模式 | 全局 |
| `Ctrl/Cmd + N` | 开始下一章 | 驾驶舱 |
| `Ctrl/Cmd + A` | APPROVE（审批通过） | 驾驶舱 |
| `Ctrl/Cmd + R` | REVISE（请求修订） | 驾驶舱 |
| `Ctrl/Cmd + G` | 打开 GOD_MODE | 驾驶舱 |
| `Ctrl/Cmd + C` | CHOOSE 选中的可能性 | 驾驶舱 |
| `Space` | 向下翻页阅读 | 阅读视图 |
| `Shift + Space` | 向上翻页 | 阅读视图 |
| `F` | 切换沉浸模式 | 阅读视图 |
| `B` | 添加批注 | 阅读视图 |
| `Ctrl/Cmd + S` | 保存当前编辑 | 编辑器 |
| `Ctrl/Cmd + Z` | 撤销 | 编辑器 |
| `Ctrl/Cmd + Shift + Z` | 重做 | 编辑器 |
| `Ctrl/Cmd + /` | 显示快捷键帮助 | 全局 |
| `Escape` | 关闭弹窗/取消操作 | 全局 |
| `Ctrl/Cmd + ,` | 打开设置 | 全局 |

---

### 11.5 前端技术选型

#### 11.5.1 框架选择

**React 18+** 作为前端框架。选择理由：
- 生态成熟，组件库丰富
- Concurrent Features（并发特性）适合复杂的实时 UI 更新
- Suspense 机制适合异步数据加载（MOU 状态变更、AI 生成等待）
- 广泛的社区支持和人才储备

#### 11.5.2 状态管理

采用分层状态管理架构：

```
状态层级:
├── 全局状态 (Zustand)
│   ├── 当前模式 (cockpit/dashboard/hibernation)
│   ├── 当前项目ID
│   ├── 用户设置
│   ├── 主题
│   └── 通知队列
│
├── MOU 状态 (Zustand + WebSocket同步)
│   ├── 当前 MOU 状态
│   ├── 当前章节
│   ├── 操作历史
│   └── 待处理命令
│
├── 领域状态 (React Query / SWR)
│   ├── 设定集数据
│   ├── 大纲数据
│   ├── 卷纲/章纲数据
│   ├── 正文内容
│   ├── 谏官报告
│   └── 版本历史
│
└── 局部状态 (useState / useReducer)
    ├── UI 状态（折叠/展开、选中项等）
    ├── 表单状态
    └── 编辑器状态
```

- **Zustand**：轻量级的全局状态管理，适合同步 UI 状态
- **React Query / SWR**：服务端状态管理，自动缓存、失效和重取
- **WebSocket 连接**：MOU 状态的实时同步

#### 11.5.3 UI 组件库

- **基础组件**：自定义实现（基于 Tailwind CSS + Radix UI Primitives）
- **Radix UI Primitives**：提供无障碍支持的基础 UI 原语（Dialog、DropdownMenu、Tabs 等）
- **图标**：Lucide React（轻量、风格统一的图标库）
- **图表**：Recharts（基于 React 和 D3 的图表库，用于仪表盘数据可视化）
- **日期处理**：date-fns
- **类名管理**：clsx + tailwind-merge

#### 11.5.4 实时通信

**WebSocket (Socket.io)** 用于前后端实时通信：

```typescript
interface WebSocketEvents {
  // 服务器 → 客户端
  'mou:state_changed': (state: MOUState) => void;
  'content:generation_progress': (progress: GenerationProgress) => void;
  'critic:report_ready': (report: CriticReport) => void;
  'notification:new': (notification: Notification) => void;
  'consistency:check_complete': (result: ConsistencyResult) => void;
  
  // 客户端 → 服务器
  'mou:command': (command: MOUCommand) => void;
  'brief:edit': (edit: BriefEdit) => void;
  'verdict:submit': (verdict: Verdict) => void;
  'god_mode:execute': (instruction: GodModeInstruction) => void;
}
```

通信策略：
- 使用 Socket.io 的房间（Room）机制隔离不同项目的数据
- 心跳机制保持连接（30秒间隔）
- 自动重连机制（指数退避，最大重试间隔 30 秒）
- 消息队列保证命令按序执行

#### 11.5.5 代码编辑器组件

Brief 编辑器和设定集编辑器使用以下方案：

- **CodeMirror 6**：JSON 编辑器的核心
  - 自定义 JSON Schema 验证扩展
  - 自定义语法高亮主题（匹配 NarrativeOS 设计系统）
  - 自动补全扩展（基于 World Bible 实体）
  - 折叠/展开支持
  - 行号显示

- **Monaco Editor**（可选方案）：
  - 如果 CodeMirror 6 不能满足需求，可降级使用 Monaco Editor
  - 提供更强大的 IntelliSense 和错误提示
  - 但包体积较大（约 30MB），需要按需加载

**编辑器配置：**

```typescript
const jsonEditorConfig = {
  theme: 'narrative-os-dark',      // 自定义主题
  schemaValidation: 'strict',       // 严格模式验证
  allowComments: true,              // 允许 JSON 注释
  formatOnSave: true,               // 保存时格式化
  tabSize: 2,                       // 缩进2空格
  wordWrap: 'on',                   // 自动换行
  minimap: { enabled: true },       // 迷你地图
  folding: true,                    // 代码折叠
  renderLineHighlight: 'all',       // 高亮当前行
  matchBrackets: 'always',          // 括号匹配
  // 自定义扩展
  extensions: [
    entityAutocompleteExtension,    // 实体自动补全
    schemaValidationExtension,      // Schema 验证
    changeTrackingExtension,        // 变更追踪
    conflictHighlightingExtension   // 冲突高亮
  ]
};
```

#### 11.5.6 技术栈总结

| 层次 | 技术选型 | 版本 |
|---|---|---|
| 框架 | React | 18+ |
| 语言 | TypeScript | 5.0+ |
| 样式 | Tailwind CSS | 3.4+ |
| 构建 | Vite | 5.0+ |
| 路由 | React Router | 6+ |
| 全局状态 | Zustand | 4.5+ |
| 服务端状态 | TanStack Query (React Query) | 5+ |
| 实时通信 | Socket.io Client | 4+ |
| UI 原语 | Radix UI Primitives | latest |
| 图标 | Lucide React | latest |
| 图表 | Recharts | 2.10+ |
| 编辑器 | CodeMirror 6 | latest |
| 日期处理 | date-fns | 3+ |
| 动画 | Framer Motion | 11+ |
| 拖拽布局 | react-grid-layout | latest |
| 测试 | Vitest + React Testing Library | latest |

---

> *"最好的工具是让你忘记工具的存在，只专注于创作的工具。"*  
> *NarrativeOS 的作者控制台不是作者要学习的另一套软件，而是作者思维的自然延伸——驾驶舱中的每一次选择、仪表盘上的每一次洞察、休眠舱中的每一次安心托付，都是人机协作叙事美学的具体实践。*

---

## 附录 A：完整数据模型关系图

```
project
 ├── world_bible (1:1)
 │    ├── power_systems (1:N)
 │    ├── factions (1:N)
 │    ├── geography/regions (1:N)
 │    ├── timeline/eras (1:N)
 │    ├── timeline/events (1:N)
 │    ├── races_classes/races (1:N)
 │    └── races_classes/occupations (1:N)
 │
 ├── master_outline (1:1)
 │    ├── structure/acts (1:N)
 │    ├── main_plot/beats (1:N)
 │    ├── sub_plots (1:N) → sub_plot_beats (1:N)
 │    ├── character_arcs (1:N) → transformation_points (1:N)
 │    └── foreshadowing_master/seeds (1:N)
 │
 ├── volume_plans (1:N)
 │    ├── volume_objectives (1:1)
 │    ├── chapter_breakdown (1:N) → key_scenes (1:N)
 │    ├── foreshadowing_plan (1:N)
 │    ├── satisfaction_points (1:N)
 │    ├── bridge_requirements (1:1)
 │    └── pacing_parameters (1:1)
 │
 ├── chapters (1:N)
 │    ├── chapter_briefs (版本历史 1:N)
 │    ├── chapter_versions (1:N)
 │    │    └── content_text (正文)
 │    └── entity_references (1:N)
 │
 ├── foreshadowings (1:N)
 │    └── seed lifecycle tracking
 │
 ├── entity_references (全局引用表 N:M)
 ├── retcon_history (1:N)
 ├── consistency_reports (1:N)
 └── mou_state_log (1:N)
```

---

## 附录 B：状态转换速查表

| 当前状态 | 触发条件 | 下一状态 | 界面响应 |
|---|---|---|---|
| `idle` | 作者触发"下一章" | `generating_possibilities` | 显示"正在生成可能性..."动画 |
| `generating_possibilities` | LLM 返回结果 | `waiting_author_choice` | 渲染可能性选择卡片 |
| `waiting_author_choice` | 作者 CHOOSE | `generating_brief` | 显示 Brief 生成进度 |
| `generating_brief` | LLM 返回 Brief | `waiting_brief_approval` | 渲染 Brief 编辑器 |
| `waiting_brief_approval` | 作者 APPROVE | `generating_content` | 显示正文生成进度 |
| `waiting_brief_approval` | 作者 REVISE | `generating_brief` | 显示修订反馈输入框 |
| `generating_content` | LLM 返回正文 | `waiting_final_review` | 渲染正文预览 + 终审面板 |
| `waiting_final_review` | 作者 APPROVE | `committing` | 显示提交进度 |
| `waiting_final_review` | 作者 REVISE | `revising_content` | 显示修订指令输入框 |
| `waiting_final_review` | 作者 GOD_MODE | `committing`（强制） | 显示神谕确认对话框 |
| `revising_content` | LLM 返回修订版 | `waiting_author_verdict` | 渲染对比视图 |
| `waiting_author_verdict` | 作者 ACCEPT | `committing` | 显示提交进度 |
| `waiting_author_verdict` | 作者 REJECT | `revising_content` | 要求重新修订 |
| `committing` | 数据库操作完成 | `idle` | 显示"已完成！"提示 |

---

*文档版本: v3.0-Sovereign*  
*最后更新: 2026-01-15*  
*作者: NarrativeOS 架构设计团队*
