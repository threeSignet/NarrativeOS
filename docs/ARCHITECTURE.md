# NarrativeOSPlus — 架构蓝图

> 项目地址：`C:\Users\10652\Documents\person\NarrativeOSPlus`
> 创建日期：2026-05-21
> 核心哲学：**MOU 协议** — AI 主动提案，作者裁决，系统执行。AI 不是工具，是副驾驶。

---

## 目录

1. [核心哲学](#1-核心哲学)
2. [系统概览](#2-系统概览)
3. [五大引擎设计](#3-五大引擎设计)
4. [数据模型总览](#4-数据模型总览)
5. [MOU 状态机](#5-mou-状态机)
6. [向量化设计](#6-向量化设计)
7. [API 设计原则](#7-api-设计原则)
8. [前端架构](#8-前端架构)
9. [分阶段路线图](#9-分阶段路线图)

---

## 1. 核心哲学

### 1.1 NarrativeOSPlus 运行定律

```
┌──────────────────────────────────────────────────────┐
│                   NarrativeOSPlus 运行定律             │
├──────────────────────────────────────────────────────┤
│ ① AI 永不擅自执行 → 必须先产生 Proposal                │
│ ② 系统主动推送 → 作者不用"找"AI，AI会"找"作者          │
│ ③ 作者始终有否决权 → 任何 Proposal 可被拒绝/修改     │
│ ④ 上下文透明 → 作者知道 AI 为什么这样提议             │
│ ⑤ 记忆是作者的记忆 → AI 记住的是作者确认过的东西      │
│ ⑥ 数据优先于逻辑 → 先定义好数据结构，再写业务逻辑      │
└──────────────────────────────────────────────────────┘
```

### 1.2 与竞品的根本区别

| 维度 | 竞品A（AI小说助手） | NarrativeOSPlus |
|------|---------------------|-----------------|
| 控制权 | AI 直接生成，作者修改 | AI 提案，作者裁决后执行 |
| 记忆 | 自动上下文注入（黑盒） | 已确认事件线（透明可控） |
| 风控 | 无 | 谏官主动提案风险 |
| 规则 | 简单绑定 | 完整规则引擎 |
| 向量化 | 无 | 全文向量化检索 |
| 一致性 | 依赖模型能力 | 系统级强制校验 |

---

## 2. 系统概览

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         作者层（Human Layer）                        │
│    驾驶舱 Cockpit → 编辑器 Editor → 提案流 Proposal Stream          │
│    命令面板 Command Palette → AI 助手面板 AI Panel                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       编排层（Orchestrator Layer）                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  提案收集器   │ │  上下文组装  │ │  LLM 网关   │ │  状态机     │   │
│  │  Collector  │ │  Assembler  │ │  Gateway    │ │  State      │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  Token监控  │ │  降级策略   │ │  SSE推送    │ │  队列调度   │   │
│  │  Monitor    │ │  Fallback   │ │  Stream     │ │  Queue      │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  工作室引擎      │  │  世界引擎      │  │  记忆引擎      │
│ Studio Engine  │  │ World Engine  │  │ Memory Engine │
├───────────────┤  ├───────────────┤  ├───────────────┤
│ • 大纲生成     │  │ • 实体管理     │  │ • 事件线提取   │
│ • 正文生成     │  │ • 关系图谱     │  │ • 伏笔追踪     │
│ • 续写/润色   │  │ • 地理地图     │  │ • 角色状态     │
│ • 对话优化     │  │ • 势力/货币   │  │ • 时间线管理   │
│ • 逻辑修正     │  │ • 功法/物品   │  │ • 上下文压缩   │
│ • 去AI味      │  │ • 一致性查询   │  │ • 记忆注入     │
│ • 语音合成     │  │ • 世界规则     │  │ • 智能提醒     │
└───────────────┘  └───────────────┘  └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  规则引擎      │  │  谏官引擎      │  │  向量检索层   │
│ Rules Engine  │  │ Censor Engine │  │ Vector Layer  │
├───────────────┤  ├───────────────┤  ├───────────────┤
│ • 规则存储     │  │ • 战力校验     │  │ • 全文嵌入     │
│ • 规则绑定     │  │ • 时间线校验   │  │ • 语义检索     │
│ • Prompt注入  │  │ • 人物行为校验 │  │ • 相似章节     │
│ • 风格规则     │  │ • 价值观审查   │  │ • 实体聚类     │
│ • 去AI味规则   │  │ • 合规性检查   │  │ • RAG增强     │
│ • 高频词库     │  │ • 风险评估     │  │ • 上下文压缩   │
└───────────────┘  └───────────────┘  └───────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         数据层（Data Layer）                         │
│                                                                     │
│   SQLite (主数据库)    │   Vector DB (向量数据库)    │   文件存储    │
│   ─────────────────    │   ─────────────────────    │   ────────    │
│   Drizzle ORM + Zod    │   sqlite-vec / pgvector    │   章节内容    │
│   关系型数据            │   全文嵌入 + 语义检索       │   世界设定    │
│   事务 + 一致性         │   相似度搜索 + RAG         │   附件文件    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 五大引擎设计

### 3.1 工作室引擎（Studio Engine）

**职责**：所有 AI 创作功能的入口。

**不是**：直接返回内容给前端。
**而是**：生成 Proposal，走 MOU 流程。

| 能力 | 输入 | 输出（Proposal） |
|------|------|-----------------|
| `generate_outline` | 世界观 + 角色 + 风格参数 | 大纲提案 |
| `generate_content` | 章节上下文 + 大纲 + 记忆 | 正文提案 |
| `continue_writing` | 前文 + 情绪控制点 | 续写提案 |
| `polish_text` | 选中文本 + 润色深度 + 风格 | 润色提案 |
| `optimize_dialogue` | 对话段落 + 角色卡 | 对话优化提案 |
| `develop_plot` | 当前情节 + 大纲目标 | 情节发展提案 |
| `fix_logic` | 选中文本 + 世界设定 | 逻辑修正提案 |
| `expand_text` | 简略段落 + 展开方向 | 展开提案 |
| `deai_writing` | 全文/选段 + 去味强度 | 去AI味提案 |
| `enhance_chapter` | 章节 + 完善深度 + 风格模板 | 完善提案 |
| `generate_character` | 人设描述 + 世界观 | 角色卡提案 |
| `generate_world` | 题材 + 风格 | 世界观提案 |
| `generate_foreshadowing` | 目标 + 类型 + 范围 | 伏笔提案 |
| `tts_speak` | 章节文本 | 语音文件（非提案，直接执行） |

### 3.2 世界引擎（World Engine）

**职责**：管理小说的"宇宙法则"。

| 领域 | 实体 | 说明 |
|------|------|------|
| 基础设定 | `world_setting` | 故事核心、主题标签 |
| 地理 | `location` + `location_map` | 地点 + 地图坐标 |
| 势力 | `faction` + `faction_relation` | 势力 + 关系矩阵 |
| 货币 | `currency` + `currency_rate` | 货币 + 汇率 |
| 力量 | `power_system` + `power_level` | 体系 + 等级 |
| 功法 | `technique` | 功法/技能库 |
| 物品 | `item` | 道具/装备 |
| 规则 | `world_rule` | 自定义世界规则 |
| 历史 | `historical_event` | 历史年表事件 |

**所有实体统一接口**：
```typescript
interface WorldEntity {
  id: string;
  type: 'character' | 'location' | 'faction' | 'item' | 'technique' | 'currency' | 'power_level' | 'world_rule' | 'historical_event';
  name: string;
  description: string;
  properties: Record<string, any>;
  relationships: Relationship[];
  vector_embedding?: number[]; // 向量化
  createdAt: string;
  updatedAt: string;
}
```

### 3.3 记忆引擎（Memory Engine）

**职责**：管理"已经历事件线"和伏笔系统。

| 组件 | 说明 |
|------|------|
| `experienced_event` | 每章确认后自动提取的关键事件 |
| `character_state` | 角色在各章节的状态快照 |
| `foreshadowing` | 伏笔全生命周期管理 |
| `context_snapshot` | 每次 AI 调用时的上下文快照 |
| `memory_query` | 自然语言查询记忆 |

**自动提取触发**：章节 commit 后异步触发
```
章节 commit
    │
    ├─→ 记忆引擎提取：
    │   • 重大事件（50字摘要）
    │   • 角色变化（心理/能力/状态）
    │   • 新出场实体
    │   • 已埋伏笔的呼应
    │
    ├─→ 生成"记忆更新提案"
    │   → 作者裁决（确认/修改/拒绝）
    │
    └─→ 已确认的写入 experienced_events
```

### 3.4 规则引擎（Rules Engine）

**职责**：让作者自定义 AI 的行为。

```
规则表
├── id
├── project_id
├── title: string          // "去AI味规则v2"
├── content: text          // Prompt 内容
├── scenarios: string[]     // 应用场景
│   └── 'generate_content' | 'polish' | 'continue' | 'deai' | ...
├── priority: number       // 优先级，数字小优先
├── is_enabled: boolean
└── created_by: 'system' | 'author' | 'ai'
```

**Prompt 注入流程**：
```
AI 调用前
    │
    ├─→ 查询规则引擎：
    │   "当前场景是 'generate_content'，
    │    本项目绑定了哪些规则？"
    │
    ├─→ 返回规则列表（按优先级排序）
    │
    └─→ 将规则内容注入 system prompt
        "【自定义规则】\n"
        + rules.map(r => r.content).join('\n\n')
```

### 3.5 谏官引擎（Censor Engine）

**职责**：主动发现风险，生成风险提案。

| 检查类型 | 触发条件 | 风险提案 |
|---------|---------|---------|
| 战力校验 | 战斗描写提交时 | "战力体系崩坏风险" |
| 时间线校验 | 涉及时间相关描写时 | "时间线矛盾风险" |
| 人物行为 | 角色行为偏离人设时 | "人设偏离风险" |
| 伏笔遗忘 | 伏笔超过N章未回收 | "伏笔遗忘风险" |
| 风格偏离 | 风格参数偏离设定 | "风格偏离风险" |
| 价值观 | 敏感内容检测 | "内容风险" |

**不是**：自动阻止/修改。
**而是**：生成 Proposal，作者裁决。

---

## 4. 数据模型总览

### 4.1 三大数据类别

| 类别 | 表 | 说明 |
|------|------|------|
| **作者资产** | `projects`, `volumes`, `chapters`, `characters`, `locations`, `factions`, `items`, `techniques`, ... | 作者创造和确认的内容 |
| **提案与决策** | `proposals`, `mou_sessions`, `human_events`, `decisions` | MOU 核心流转 |
| **AI 记忆** | `experienced_events`, `foreshadowings`, `character_states`, `context_snapshots`, `llm_calls` | AI 的"记忆" |

### 4.2 核心表详细设计（待讨论细化）

见 `docs/SCHEMA_DESIGN.md`

---

## 5. MOU 状态机

### 5.1 状态定义

```
┌──────────────┐   author_continue    ┌──────────────┐
│    IDLE      │ ────────────────────→ │  DRAFTING    │
│   (空闲)     │                       │  (写作中)     │
└──────────────┘                       └──────────────┘
                                              │
                                              │ author_pause
                                              ▼
                                        ┌──────────────┐
                                        │   PAUSED     │
                                        │   (暂停)     │
                                        └──────────────┘
                                              │ author_continue
                                              ▼
┌──────────────┐   author_submit      ┌──────────────┐
│              │ ←──────────────────── │              │
│  REVIEWING   │                       │ AI_PROCESSING│
│  (审阅中)    │ ←──────────────────── │  (AI处理中)  │
│              │   proposal_complete   │              │
└──────┬───────┘                       └──────────────┘
       │
       │ proposal_approved / proposal_rejected / proposal_modified
       ▼
┌──────────────┐
│   EXECUTING  │
│   (执行中)   │
└──────┬───────┘
       │ execute_complete
       ▼
┌──────────────┐
│   COMPLETED  │
│   (已完成)   │
└──────────────┘
       │
       │ author_continue (写下一章)
       ▼
    [IDLE]
```

### 5.2 提案类型

| 类型 | 说明 | 来源引擎 |
|------|------|---------|
| `OUTLINE` | 大纲生成/修改提案 | Studio |
| `CONTENT` | 正文生成/续写提案 | Studio |
| `POLISH` | 润色/优化提案 | Studio |
| `WORLD` | 世界观设定提案 | World |
| `CHARACTER` | 角色设定/完善提案 | Studio + World |
| `RULE` | 规则修改提案 | Rules |
| `RISK` | 风险提醒提案 | Censor |
| `MEMORY` | 记忆更新提案 | Memory |
| `FORESHADOWING` | 伏笔提案 | Memory + Studio |
| `LOGIC_FIX` | 逻辑修正提案 | Studio + Censor |

---

## 6. 向量化设计

### 6.1 向量化目标

| 场景 | 向量化内容 | 检索方式 |
|------|-----------|---------|
| 全文语义检索 | 章节正文 | 相似度搜索 |
| 实体聚类 | 角色/地点描述 | 语义聚类 |
| 上下文压缩 | 章节摘要 | 层次化摘要 |
| RAG增强 | 相关章节/设定 | 向量召回 |
| 风格分析 | 已确认章节 | 风格相似度 |

### 6.2 技术方案

```
嵌入模型：
• 中文：BGE-M3（多语言，8192上下文）
• 备选：OpenAI text-embedding-3-large

向量存储：
• 开发：sqlite-vec（SQLite扩展，零依赖）
• 生产：pgvector（PostgreSQL）

维度：1024（BGE-M3）或 3072（OpenAI）

索引：IVF-Flat 或 HNSW
```

### 6.3 需要向量化的内容

| 内容 | 粒度 | 更新时机 |
|------|------|---------|
| 章节全文 | 每章 | commit后 |
| 章节摘要 | 每章 | commit后 |
| 角色描述 | 每个角色 | 修改后 |
| 地点描述 | 每个地点 | 修改后 |
| 世界规则 | 每条规则 | 修改后 |
| 历史事件 | 每个事件 | 创建后 |
| 伏笔描述 | 每个伏笔 | 创建/修改后 |

### 6.4 RAG 查询流程

```
AI 生成正文时
    │
    ├─→ 查询向量数据库：
    │   "找到与当前章节语义最相似的已写章节"
    │   → 返回 Top-K 相关章节
    │
    ├─→ 查询相关实体：
    │   "找到与当前场景相关的角色/地点"
    │   → 返回关联实体
    │
    └─→ 组装增强上下文
        = 世界观 + 角色卡 + 大纲 + 相似章节 + 记忆摘要
```

---

## 7. API 设计原则

### 7.1 接口风格

**不是 RESTful 资源操作，而是"事件驱动 + 状态机"**。

```typescript
// ❌ 传统 REST
GET /chapters/:id
POST /chapters
PUT /chapters/:id

// ✅ NarrativeOSPlus 风格
POST /mou/session/start      // 开始创作会话
POST /mou/event              // 作者事件（continue/pause/submit/approve/reject）
GET /mou/proposals           // 获取待裁决提案列表
POST /mou/decide            // 裁决提案
POST /studio/request        // 请求AI创作（产生Proposal）
GET /world/query            // 世界引擎查询
GET /memory/query           // 记忆引擎查询
POST /rules/bind            // 绑定规则
```

### 7.2 响应格式

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    requestId: string;
    timestamp: string;
    mouSessionId?: string;
    contextTokens?: { used: number; total: number };
  };
}
```

### 7.3 SSE 流式协议

```typescript
// SSE 事件类型
interface SseEvent {
  type: 
    | 'proposal.created'      // 新提案生成
    | 'proposal.progress'     // 生成进度
    | 'proposal.complete'     // 提案完成
    | 'memory.extracted'      // 记忆提取完成
    | 'censor.alert'          // 谏官警报
    | 'token.update'          // Token用量更新
    | 'state.change'          // MOU状态变化
    | 'system.message';       // 系统消息
  payload: any;
}
```

---

## 8. 前端架构

### 8.1 不是页面集合，是驾驶舱

```
┌─────────────────────────────────────────────────────────────────────┐
│  Imperial Top Bar                                                     │
│  [项目名] [当前模型] [Token: 3,024/128K] [⚡×3 新提案] [👤作者]      │
├──────────────────────┬──────────────────┬─────────────────────────────┤
│                      │                  │                             │
│  📋 提案流            │   📝 编辑器      │    🤖 AI 助手面板          │
│  Proposal Stream     │   Editor         │    AI Panel                │
│                      │                  │                             │
│  ┌────────────────┐  │                  │  ┌──────────────────────┐  │
│  │ ⚡ 新提案 ×3    │  │  第5章...        │  │ 智能续写 ▶           │  │
│  │ ─────────────── │  │                  │  │ 文字润色 ✎           │  │
│  │ [战力异常]      │  │                  │  │ 对话优化 💬          │  │
│  │ [伏笔回收]      │  │                  │  │ 剧情发展 ➤           │  │
│  │ [角色完善]      │  │                  │  │ 逻辑修正 🛠          │  │
│  └────────────────┘  │                  │  │ 文段展开 ⬇           │  │
│                      │                  │  │                      │  │
│  ┌────────────────┐  │                  │  │ 自定义要求...        │  │
│  │ 📜 历史提案      │  │                  │  │                      │  │
│  │ ─────────────── │  │                  │  │ Token: 3,024/128K    │  │
│  │ [已批准 ×12]    │  │                  │  │ 模型: Claude-4       │  │
│  │ [已拒绝 ×3]     │  │                  │  └──────────────────────┘  │
│  └────────────────┘  │                  │                             │
│                      │                  │                             │
├──────────────────────┴──────────────────┴─────────────────────────────┤
│  Imperial Bottom Bar                                                 │
│  [世界概览] [角色状态] [时间线] [已埋伏笔 ×7] [已回收 ×3] [规则×5]  │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 前端技术栈

| 层 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 状态管理 | Zustand（多个store：project, proposal, mou, world, editor） |
| 编辑器 | TipTap / Monaco Editor |
| UI组件 | shadcn/ui + Tailwind CSS |
| 图表 | D3.js（关系图、时间线） |
| 地图 | Leaflet（地理地图） |
| SSE | EventSource API |
| 向量客户端 | sqlite-vec-js（浏览器端查询） |

---

## 9. 分阶段路线图

### Phase 0：设计蓝图（现在 - 2周）

**目标**：产出完整设计文档，确定数据结构。

| 文档 | 状态 |
|------|------|
| `docs/ARCHITECTURE.md` | ✅ 初版（本文档） |
| `docs/SCHEMA_DESIGN.md` | 🔄 待讨论细化 |
| `docs/API_CONTRACT.md` | 🔄 待编写 |
| `docs/MOU_STATE_MACHINE.md` | 🔄 待细化 |
| `docs/FRONTEND_DESIGN.md` | 🔄 待编写 |
| `docs/PROMPT_TEMPLATES.md` | 🔄 待编写 |
| `docs/VECTOR_DESIGN.md` | 🔄 待编写 |

### Phase 1：MOU 核心骨架（3-4周）

**目标**：一个完整的端到端 MOU 流程跑通。

- [ ] 数据库 Schema 落地（SQLite + Drizzle）
- [ ] 后端：Fastify + 基础路由（项目/章节/提案）
- [ ] 后端：MOU 状态机完整实现
- [ ] 后端：基础 LLM 调用（Vercel AI SDK）
- [ ] 前端：驾驶舱骨架（三栏布局）
- [ ] 前端：编辑器 + 提案流面板
- [ ] 前端 → 后端：项目 CRUD 通
- [ ] 前端 → 后端：章节编辑保存通
- [ ] 前端 → 后端：AI 续写走 MOU 通

**不做的**：向量化、谏官引擎、规则引擎、复杂世界引擎、记忆自动提取。

### Phase 2：世界引擎 + 基础向量化（3-4周）

- [ ] 世界引擎：实体 CRUD（角色/地点/物品）
- [ ] 世界引擎：关系管理
- [ ] 前端：实体管理页面
- [ ] 前端：编辑器实体高亮
- [ ] 向量化：章节全文嵌入
- [ ] 向量化：基础语义检索 API

### Phase 3：记忆引擎 + 主动互动（3-4周）

- [ ] 记忆引擎：已经历事件线自动提取
- [ ] 记忆引擎：伏笔管理系统
- [ ] 记忆引擎：上下文智能压缩
- [ ] 谏官引擎：基础风险检测（战力/时间线）
- [ ] 前端：提案流常驻面板
- [ ] **主动互动**：写完后自动推送记忆更新提案

### Phase 4：规则引擎 + 工作室引擎完整功能（4-6周）

- [ ] 规则引擎：规则 CRUD + Prompt 注入
- [ ] 工作室引擎：大纲生成（粗纲/细纲）
- [ ] 工作室引擎：正文生成（批量/单章）
- [ ] 工作室引擎：完善面板（对比/风格/深度）
- [ ] 工作室引擎：去 AI 味
- [ ] 多模型支持

### Phase 5：增强体验（2-3周）

- [ ] 人物关系图可视化
- [ ] 地图可视化
- [ ] 语音校对（TTS）
- [ ] 便签批注
- [ ] 情节脉络模板
- [ ] 性能优化

---

## 附录

### A. 项目结构

```
NarrativeOSPlus/
├── apps/
│   ├── server/          # Fastify 后端
│   │   ├── src/
│   │   │   ├── api/     # API 路由
│   │   │   ├── engine/  # 五大引擎
│   │   │   ├── mou/     # MOU 状态机
│   │   │   ├── db/      # Drizzle ORM
│   │   │   ├── vector/  # 向量化服务
│   │   │   └── llm/     # LLM 调用层
│   │   └── package.json
│   └── web/             # React 前端
│       ├── src/
│       │   ├── pages/   # 页面
│       │   ├── components/ # 组件
│       │   ├── stores/  # Zustand stores
│       │   ├── api/     # API 客户端
│       │   └── engine/  # 前端引擎对接
│       └── package.json
├── packages/
│   ├── shared/          # 共享类型 + Zod Schema
│   └── vector/          # 向量数据库封装
├── docs/                # 设计文档
├── memory/              # 会议纪要
└── README.md
```

### B. 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 后端框架 | Fastify | 高性能、插件丰富 |
| ORM | Drizzle ORM | TypeScript 原生、类型安全 |
| 数据库 | SQLite (dev) / PostgreSQL (prod) | 开发零配置 |
| 向量 | sqlite-vec (dev) / pgvector (prod) | 同数据库内嵌 |
| LLM SDK | Vercel AI SDK | 多模型统一接口、SSE 流式 |
| 前端框架 | React 19 | 并发特性 |
| 状态管理 | Zustand | 轻量、TypeScript友好 |
| 编辑器 | TipTap | ProseMirror封装、可扩展 |
| UI | shadcn/ui + Tailwind | 可定制、组件丰富 |
| 类型校验 | Zod | 前后端共享 Schema |

---

> 本文档是 NarrativeOSPlus 的架构蓝图。后续所有开发决策必须以此为基准。
> 如需修改，必须经过讨论并记录变更原因。
