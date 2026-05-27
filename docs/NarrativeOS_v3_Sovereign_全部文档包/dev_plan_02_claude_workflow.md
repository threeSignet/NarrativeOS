> [!NOTE] **本文档的前端工作流/模块命名已作废**
> 文中 `feature/frontend-cockpit` / `feature/frontend-dashboard` / "驾驶舱·仪表盘·休眠舱" 模块约定对应旧赛博风前端，已于 2026-05-19 整目录删除并重写为"司天监位面"。
> 前端真理源：`docs/imperial-design-system.md`；Phase 排期权威源：`docs/iterations/index.md`。
> **Claude Code 协作流程、commit 规范、自检清单等开发方法论仍可参考**。

---

# NarrativeOS v3.0 Sovereign — Claude Code 协作开发完整工作手册

> **版本**: v1.0
> **适用对象**: 1人业余开发者 + Claude Code (Claude 3.5 Sonnet / Claude 4)
> **项目规模**: 5-10万行 TypeScript，87,122行设计文档
> **开发环境**: VSCode + Windows WSL2 + Node.js + PostgreSQL 16
> **最后更新**: 2025年

---

## 目录

- [第一章 上下文管理策略（核心）](#第一章-上下文管理策略核心)
- [第二章 Claude Code Prompt 模板库](#第二章-claude-code-prompt-模板库)
- [第三章 开发 Session 工作流](#第三章-开发-session-工作流)
- [第四章 Claude Code 最佳实践](#第四章-claude-code-最佳实践)
- [第五章 代码审查清单](#第五章-代码审查清单)
- [第六章 Git 工作流](#第六章-git-工作流)
- [第七章 问题排查指南](#第七章-问题排查指南)

---

## 第一章 上下文管理策略（核心）

### 1.1 核心挑战分析

**Claude Code 的上下文约束**（以实际使用经验为准）：

| 指标 | 估算值 | 说明 |
|------|--------|------|
| 有效上下文窗口 | ~180K-200K tokens | 约等于 13-15 万行中文文档 |
| 代码生成注意力 | ~8K-12K tokens | Claude 对最近输入的注意力最佳 |
| 单次文件读取上限 | ~50 个文件 | 超出后性能显著下降 |
| 最佳交互轮次 | 5-15 轮 | 超过后上下文稀释 |

**NarrativeOS 设计文档规模**：

| 文档 | 行数 | 说明 |
|------|------|------|
| 终极完整设计文档 | 87,122 行 | 全部内容合并版 |
| chapter02_架构 | 5,611 行 | 系统架构总览 |
| chapter04_数据库 | 5,999 行 | 完整 DDL + 类型系统 |
| chapter05_世界引擎 | 5,390 行 | 8 个子引擎设计 |
| chapter06_工作室引擎 | 4,578 行 | 类型内核 + Brief 生成 |
| chapter08_MOU 交互 | 5,145 行 | XState v5 状态机 |
| 其他章节（10+） | 各 1,500-6,000 行 | 各专题设计 |

**关键矛盾**：设计文档总量远超单次上下文容量，必须进行**精确分片**。

---

### 1.2 文件分片策略：三层金字塔模型

```
                    ▲
                   /│\     第1层：常驻上下文（~3000行）
                  / │ \    ───────────────────────────
                 /  │  \   架构概览 + 接口契约 + 编码规范 + DB核心表
                /   │   \  + 技术栈锁定 + 错误码体系 + 主权原则
               /────┼────\─────────────────────────────
              /     │     \ 第2层：模块上下文（按需加载，~4000-8000行）
             /      │      \────────────────────────────
            /       │       \世界引擎 / 工作室引擎 / MOU / 前端 / 质量
           /        │        \等各模块专属设计文档
          /─────────┼─────────\───────────────────────────
         /          │          \ 第3层：参考上下文（即时检索，按需复制）
        /           │           \─────────────────────────
       /            │            \ 完整的 DDL 文件、长算法描述、
      /             │             \ Prompt 模板库、国际化词条
     /              │              \ 等超大块内容
    ────────────────┴────────────────────────────────────────
```

**分片原则**：
1. **常驻层**必须足够小（< 3000 行），每次 Session 都完整加载
2. **模块层**按业务域组织，开发哪个模块加载哪个文档
3. **参考层**不直接加载，只在需要时复制关键段落给 Claude

---

### 1.3 常驻上下文清单（每次 Session 必加载）

**目标总行数**：控制在 2500-3000 行以内

#### 必加载文件（5 个核心文件）

| # | 文件路径 | 行数 | 作用 | 加载方式 |
|---|----------|------|------|----------|
| 1 | `chapter02_architecture.md` 精简版 | ~400 行 | 架构总览、技术栈、分层原则 | 开发者预提取（见 1.3.1） |
| 2 | `chapter01_03_philosophy_sovereignty.md` 精简版 | ~300 行 | 第一公理、权力边界、禁止行为清单 | 开发者预提取（见 1.3.2） |
| 3 | `chapter04_database.md` 核心表摘要 | ~500 行 | 16 张核心表结构 + 关键 ENUM 类型 | 开发者预提取（见 1.3.3） |
| 4 | `chapter02_architecture.md` 接口契约摘要 | ~600 行 | 层间 TypeScript 接口定义 | 开发者预提取（见 1.3.4） |
| 5 | `project_conventions.md`（新建） | ~200 行 | 编码规范、命名约定、目录结构 | 新建文件（见 1.3.5） |

**常驻上下文合计：~2000 行（预留 1000 行给代码文件）**

---

#### 1.3.1 架构总览精简版（`extracts/architecture_brief.md`）

**开发者预提取内容**（从 chapter02_architecture.md 提取）：

```markdown
# NarrativeOS v3.0 架构总览（精简版 —— 常驻上下文）

## 分层架构
```
Presentation Layer (React 19 + TypeScript + Tailwind)
  ↕ REST API / WebSocket SSE
Orchestration Layer (XState v5 状态机 — MOU 协议引擎)
  ↕ 内部调用
Agent Shell Layer (WorldShell / StudioShell / CensorShell / GuardShell)
  ↕ 内部调用
Service Layer — 厚层
  ├─ 8 个世界子引擎 (Geo/Frc/Chr/Evt/Rul/Ftn/Tml/Kno)
  ├─ 核心服务 (Prompt组装/质检/风险分析/心流/版本管理/叙事评估/场景查询/共情化/涟漪)
  └─ LLM 调用层
  ↕ SQL / 向量查询
Data Layer (PostgreSQL 16 + pgvector 0.7.x)
```

## 技术栈锁定
| 组件 | 版本 | 用途 |
|------|------|------|
| Node.js | 20 LTS | 运行时 |
| TypeScript | 5.4+ | 全栈语言 |
| React | 19 | 前端框架 |
| XState | 5.x | 状态机 |
| PostgreSQL | 16 | 主数据库 |
| pgvector | 0.7.x | 向量检索 |
| Zod | 3.22+ | 运行时校验 |
| Vitest | 1.x | 测试框架 |
| Tailwind CSS | 3.4+ | 样式 |

## 关键原则
1. 薄协调层 —— XState 状态机只做路由，不做业务逻辑
2. 服务无状态 —— 状态在数据库，服务可水平扩展
3. 单向数据流 —— 作者事件 → MOU 状态机 → Agent 壳 → 服务 → DB
4. 原子固化 —— 每次作者确认 = 一次不可逆的原子操作
5. 人类事件驱动 —— 只有作者交互才能推动 MOU 状态转移

## 错误码体系（摘要）
| 码段 | 含义 |
|------|------|
| AUTH_* | 认证授权错误 |
| MOU_* | 状态机错误 |
| WORLD_* | 世界引擎错误 |
| STUDIO_* | 工作室引擎错误 |
| DB_* | 数据库错误 |
| LLM_* | LLM 调用错误 |
| VALID_* | 验证错误 |

## 接口设计总则
1. 所有接口使用 TypeScript 类型定义，运行时通过 Zod Schema 验证
2. 幂等性：所有写入操作必须支持 idempotencyKey
3. 超时策略：同步接口 30s，流式接口 5min 心跳
4. 分页约定：游标分页，pageSize 默认 20，最大 100
```

---

#### 1.3.2 主权原则精简版（`extracts/sovereignty_brief.md`）

**开发者预提取内容**（从 chapter01_03_philosophy_sovereignty.md 提取）：

```markdown
# NarrativeOS 主权原则（精简版 —— 常驻上下文）

## 第一公理
叙事裁决权不可转让 —— 作者对故事的每一个字拥有最终且不可撤销的决定权。
系统只能**提案**，不能**执行**。

## 权力边界（系统绝对不能做的事）
1. 禁止直接修改作者已确认的正文（包括标点）
2. 禁止在作者未授权时推进故事时间线
3. 禁止删除或修改作者已确认的世界观设定
4. 禁止自动发布或导出任何内容
5. 禁止忽略作者的否决权
6. 禁止在写作中注入与作者价值观冲突的内容
7. 禁止绕过谏官系统进行质量检查
8. 禁止未经作者知情同意调用外部服务

## 越权处理
任何检测到越权的行为：
1. 立即阻止操作
2. 记录安全事件日志
3. 通知作者（严重级别 alert）
4. 系统进入 degraded 模式等待人工确认

## 三组核心悖论
1. 创意悖论：系统要辅助创作但不能替代创作
2. 控制悖论：系统要主动但不能越权
3. 一致悖论：系统要保持世界自洽但不能否决作者
```

---

#### 1.3.3 数据库核心表摘要（`extracts/database_core.md`）

**开发者预提取内容**（从 chapter04_database.md 提取）：

```markdown
# 数据库核心表摘要（常驻上下文）

## 16 张核心表
| 表名 | 用途 | 关键字段 |
|------|------|----------|
| projects | 小说项目 | id, title, genre[], status, world_setting, author_style |
| chapters | 章节 | id, project_id, order_index, status, content, word_count |
| entities | 世界实体 | id, project_id, type, name, attributes(JSONB), embedding |
| relations | 实体关系 | id, source_id, target_id, type, strength, metadata |
| events | 世界事件 | id, project_id, type, triggered_by, status, time_anchor |
| power_systems | 战力体系 | id, project_id, realm_tree, formula_params |
| knowledge_graph | 知识图谱 | id, entity_id, known_to(JSONB), revealed_at |
| narrative_arcs | 叙事弧线 | id, project_id, type, tension_curve, status |
| proposals | 系统提案 | id, project_id, type, payload, status, author_decision |
| mou_states | MOU 状态 | id, project_id, current_state, context, history |
| author_styles | 作者风格 | id, profile(JSONB), ama_model, samples |
| content_versions | 内容版本 | id, content_id, version_type, diff, created_by |
| quality_reports | 质检报告 | id, project_id, checks[], score, violations[] |
| flow_states | 心流状态 | id, session_id, metrics, interventions[] |
| llm_calls | LLM 调用日志 | id, model, prompt_tokens, cost, latency, cache_hit |
| users | 用户 | id, auth_provider, config, preferences |

## 关键 ENUM 类型
- project_status: drafting → outlining → writing → completed → archived
- entity_type: character / faction / location / item / concept / realm
- proposal_status: pending → approved → rejected → modified → expired
- proposal_type: chapter / world_edit / plot_twist / character_arc / style_change
- chapter_status: draft → reviewed → finalized → locked
```

---

#### 1.3.4 接口契约摘要（`extracts/interface_contracts.md`）

**开发者预提取内容**（从 chapter02_architecture.md 提取）：

```markdown
# 层间接口契约摘要（常驻上下文）

## 统一响应格式
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; requestId: string };
  meta?: { requestId: string; timestamp: string; pagination?: CursorPagination };
}

## 核心接口
- POST /api/v3/projects — 创建项目
- GET /api/v3/projects/:id/mou/state — MOU 状态
- POST /api/v3/projects/:id/mou/event — 发送人类事件
- GET /api/v3/projects/:id/stream/:ticket — SSE 流式生成
- GET /api/v3/projects/:id/proposals — 提案列表
- POST /api/v3/projects/:id/proposals/:id/decide — 作者裁决
- GET /api/v3/projects/:id/entities — 实体查询
- POST /api/v3/projects/:id/oracle — 神谕查询

## SSE 事件类型
delta | checkpoint | proposal | error | complete | waiting

## 分页
interface CursorPagination {
  nextCursor: string | null;
  prevCursor: string | null;
  pageSize: number;
}
```

---

#### 1.3.5 项目编码规范（`project_conventions.md` —— 新建）

```markdown
# NarrativeOS 编码规范

## 目录结构
```
/apps
  /web                 # React SPA 前端
    /src
      /components      # 通用组件
      /pages           # 页面级组件
      /hooks           # 自定义 hooks
      /lib             # 工具函数
      /stores          # 状态管理
      /types           # 类型定义
      /styles          # 全局样式
  /server              # Node.js 后端
    /src
      /orchestration   # XState 状态机
      /agents          # Agent Shell 层
      /services        # 服务层
        /world         # 世界引擎
        /studio        # 工作室引擎
      /db              # 数据库访问层
      /api             # REST API 路由
      /llm             # LLM 调用封装
      /middleware      # 认证/日志/错误处理
/packages
  /shared              # 共享类型和工具
  /config              # 共享配置
/tests                 # E2E 测试
/docs                  # 设计文档
```

## 命名约定
- 文件：kebab-case.ts（服务、工具）或 PascalCase.tsx（组件）
- 接口：PascalCase + 语义后缀（CreateProjectRequest, ProjectResponse）
- 数据库表：snake_case，复数形式
- TypeScript 类型：camelCase 变量，PascalCase 类型
- 错误码：UPPER_SNAKE_CASE，带模块前缀（WORLD_REALM_NOT_FOUND）

## 代码规范
- 严格模式：strictNullChecks, noImplicitAny, noUncheckedIndexedAccess
- 导入排序：外部库 → 内部模块 → 相对路径 → 类型导入
- 函数长度：< 50 行，超过必须拆分
- 圈复杂度：< 10
- 注释：JSDoc 描述所有导出函数，重点说明副作用和前提条件
```

---

### 1.4 按需上下文清单（按模块分组）

#### 1.4.1 开发世界引擎时加载

| 文件 | 行数 | 加载时机 |
|------|------|----------|
| `chapter05_world_engine.md` | 5,390 行 | **主参考文档，完整加载** |
| `chapter04_database.md` §4.3（entities/events/power_systems 表） | ~800 行 | 需要具体表结构时 |
| `chapter06_drama_engine.md` §6.1（类型内核系统） | ~500 行 | 需要类型定义交互时 |

**加载策略**：
- 常驻上下文 + `chapter05_world_engine.md`（5,390 行）= ~7,400 行
- 在上下文窗口边缘，但可接受
- 数据库细节不常驻，只在写具体 SQL/TypeScript 接口时复制相关段落

#### 1.4.2 开发工作室引擎时加载

| 文件 | 行数 | 加载时机 |
|------|------|----------|
| `chapter06_drama_engine.md` | 4,578 行 | **主参考文档，完整加载** |
| `chapter12_llm_integration.md` | 2,638 行 | 需要 Prompt 模板时 |
| `chapter09_quality_system.md` §9.4（质量评分） | ~300 行 | 需要评分体系交互时 |

#### 1.4.3 开发 MOU 交互层时加载

| 文件 | 行数 | 加载时机 |
|------|------|----------|
| `chapter08_mou_interaction.md` | 5,145 行 | **主参考文档，完整加载** |
| `chapter07_narrative_elements.md` | 3,605 行 | 需要叙事要素交互时 |

**警告**：MOU + 叙事要素 = 8,750 行，可能超出上下文窗口。
**策略**：MOU 完整加载，叙事要素只在涉及具体交互时按需复制段落。

#### 1.4.4 开发前端时加载

| 文件 | 行数 | 加载时机 |
|------|------|----------|
| `responsive_frontend_arch.md` | ~1,000 行 | **主参考文档** |
| `ui_design_system.md` | ~3,000 行 | **主参考文档** |
| `chapter08_mou_interaction.md` §7-8（控制台页面设计） | ~800 行 | 需要页面布局时 |
| `chapter10_11_document_console.md` | 3,487 行 | 需要文档控制台时 |

**策略**：前端两个文档 + 常驻 = ~6,000 行，可接受。

#### 1.4.5 开发数据库层时加载

| 文件 | 行数 | 加载时机 |
|------|------|----------|
| `chapter04_database.md` | 5,999 行 | **完整加载** |
| `chapter02_architecture.md` §2.5（服务清单） | ~500 行 | 需要服务-表映射时 |

#### 1.4.6 开发质量系统时加载

| 文件 | 行数 | 加载时机 |
|------|------|----------|
| `chapter09_quality_system.md` | 3,176 行 | **完整加载** |
| `chapter08_mou_interaction.md` §9（谏官子流程） | ~500 行 | 需要谏官状态机时 |

#### 1.4.7 开发 DevAgent 集群时加载

| 文件 | 行数 | 加载时机 |
|------|------|----------|
| `chapter18_devagent_cluster.md` | 23,698 行 | **不加载全文** |
| `devagent_cluster_plan.md` | 54 行 | 快速参考 |
| `devagent_01_telemetry.md` | 3,751 行 | 按需加载 |
| `devagent_02_router.md` | 4,768 行 | 按需加载 |
| `devagent_03_swarm.md` | 4,380 行 | 按需加载 |
| `devagent_04_validation.md` | 3,663 行 | 按需加载 |
| `devagent_05_evolution.md` | 4,686 行 | 按需加载 |

**策略**：chapter18 太大不直接加载，5 个子 Agent 文档按需逐个加载。

#### 1.4.8 开发 LLM 集成层时加载

| 文件 | 行数 | 加载时机 |
|------|------|----------|
| `chapter12_llm_integration.md` | 2,638 行 | **完整加载** |
| `chapter13_observability.md` | 1,659 行 | 需要监控/日志时 |

---

### 1.5 上下文组合速查表

| 开发任务 | 常驻(5文件) | 加载文档 | 预估总行数 | 是否可行 |
|----------|-------------|----------|------------|----------|
| 初始化项目骨架 | + | conventions | ~2,200 | 充裕 |
| 开发数据库 DDL | + | chapter04(~6000行) | ~8,000 | 临界但可行 |
| 开发世界引擎 | + | chapter05(~5400行) | ~7,400 | 可行 |
| 开发工作室引擎 | + | chapter06(~4600行) | ~6,600 | 可行 |
| 开发 MOU 状态机 | + | chapter08(~5100行) | ~7,100 | 可行 |
| 开发前端组件 | + | ui_design_system + frontend_arch(~4000行) | ~6,000 | 可行 |
| 开发质量系统 | + | chapter09(~3200行) | ~5,200 | 充裕 |
| 开发 LLM 层 | + | chapter12(~2600行) | ~4,600 | 充裕 |
| 端到端调试 | + | 无（只加载代码） | ~2,000 | 充裕 |

---

### 1.6 上下文加载操作脚本

在 VSCode 终端中预置以下命令，快速复制上下文：

```bash
# === NarrativeOS 上下文加载快捷命令 ===

# 查看当前 Session 建议加载的文档
cat ~/.nos/context_plan.txt

# 快速复制常驻上下文到剪贴板 (WSL)
cat ~/NarrativeOS/docs/extracts/architecture_brief.md \
    ~/NarrativeOS/docs/extracts/sovereignty_brief.md \
    ~/NarrativeOS/docs/extracts/database_core.md \
    ~/NarrativeOS/docs/extracts/interface_contracts.md \
    ~/NarrativeOS/docs/project_conventions.md | clip.exe

# 复制世界引擎上下文
cat ~/NarrativeOS/docs/chapter05_world_engine.md | clip.exe

# 复制工作室引擎上下文
cat ~/NarrativeOS/docs/chapter06_drama_engine.md | clip.exe

# 复制 MOU 上下文
cat ~/NarrativeOS/docs/chapter08_mou_interaction.md | clip.exe

# 复制前端上下文
cat ~/NarrativeOS/docs/ui_design_system.md \
    ~/NarrativeOS/docs/responsive_frontend_arch.md | clip.exe
```

---

### 1.7 超大文档的按需阅读策略

对于超过 5000 行的文档，**不要完整复制给 Claude**。使用以下策略：

**策略 A：分段加载**（推荐）
1. 第一次 Prompt："请先阅读文档的前 2000 行，了解整体结构"
2. 后续 Prompt："现在阅读 §5.3-5.5 部分（因果推演器、NPC 行为引擎、环境模拟器）"

**策略 B：关键词检索**
```bash
# 在 WSL 中搜索相关段落
grep -n -A 20 "NPC 行为引擎" chapter05_world_engine.md
# 将搜索结果复制给 Claude
```

**策略 C：让 Claude 自己读取**
```
请读取 @chapter05_world_engine.md 的 5.3-5.5 节，实现因果推演器。
```

**策略 D：预提取关键段落**
开发者在开发前预先将长文档中的关键 TypeScript 接口、算法伪代码提取到单独的 `snippets/` 目录下，每个文件 < 500 行。

---

### 1.8 Session 上下文生命周期管理

```
[Session 开始]
   │
   ▼
[步骤1: 加载常驻上下文] ──→ 5 个核心文件，~2000行
   │                         （通过 @文件 引用或粘贴）
   ▼
[步骤2: 声明开发目标] ──→ "本次开发：实现世界引擎的因果推演器"
   │
   ▼
[步骤3: 加载模块上下文] ──→ 按需加载对应设计文档
   │                         （如 chapter05_world_engine.md）
   ▼
[步骤4: 引用已有代码] ──→ @已有的接口文件/类型定义
   │
   ▼
[开发迭代：5-15 轮对话]
   │
   ▼
[Session 结束] ──→ 执行 git commit
```

**重要规则**：
- 每过 10 轮对话，用一句话重述当前目标，防止 Claude "遗忘"
- 如果 Claude 开始重复之前的错误或偏离设计文档，立即重新加载模块上下文
- 一个 Session 只聚焦一个模块的一个子功能（如：只实现因果推演器，不碰 NPC 行为引擎）

---


## 第二章 Claude Code Prompt 模板库

### 2.0 模板使用总则

**所有模板的通用结构**：

```
[角色设定] ← 告诉Claude它是谁、做什么、遵循什么原则
[上下文注入] ← 通过 @文件 引用需要的设计文档和代码
[任务描述] ← 具体要做什么，越具体越好
[输出要求] ← 代码+测试+文档的具体格式
[约束条件] ← 绝对不能做什么（主权合规）
[验收标准] ← 怎样算完成
```

**模板填充规则**：
1. `{{MODULE_NAME}}` — 替换为具体模块名（如：世界引擎 / 工作室引擎）
2. `{{DESIGN_DOC}}` — 替换为对应设计文档路径
3. `{{EXISTING_CODE}}` — 替换为已有代码文件路径
4. `{{TASK_DETAIL}}` — 替换为具体开发任务
5. `[ ]` 中的内容是可选的，根据场景决定是否包含

---

### 2.1 模板 A：新建模块/服务

**适用场景**：从零开始实现一个新模块、新服务、新子引擎

```markdown
## 角色设定
你是 NarrativeOS v3.0 的资深 TypeScript 后端工程师。你正在开发一个
支持100万字以上长篇网文创作的AI辅助写作系统。

你必须遵循以下核心原则：
1. **叙事裁决权不可转让** —— 系统只能提案，不能替作者做决定
2. **薄协调层，厚服务层** —— 状态机在协调层，业务逻辑在服务层
3. **所有接口必须有 Zod Schema 校验**
4. **所有函数必须有 JSDoc 注释**
5. **每个导出函数都必须有对应的单元测试**

## 上下文注入
请参考以下设计文档：
@docs/extracts/architecture_brief.md
@docs/extracts/sovereignty_brief.md
@docs/extracts/database_core.md
@docs/extracts/interface_contracts.md
@docs/project_conventions.md
@docs/{{DESIGN_DOC}}

## 任务描述
请实现以下新模块：

**模块名称**: {{MODULE_NAME}}
**模块职责**: {{MODULE_RESPONSIBILITY}}

具体要实现的内容：
{{TASK_DETAIL}}

例如：
- 实现物理规则引擎的 RealmSystem 类
- 实现境界体系的 CRUD 操作
- 实现战力计算公式

## 已有接口约束
以下接口已由其他模块定义，你的实现必须与之兼容：
@{{EXISTING_CODE}}/types/{{MODULE_NAME}}.types.ts [如果存在]

## 输出要求
请按以下顺序输出：

### 1. 类型定义文件
- 路径: `src/services/{{MODULE_PATH}}/types.ts`
- 包含所有接口、类型别名、Zod Schema
- 命名: PascalCase + 语义后缀

### 2. 核心实现文件
- 路径: `src/services/{{MODULE_PATH}}/{{MODULE_NAME}}.service.ts`
- 使用纯函数 + 依赖注入模式
- 错误处理: 使用自定义错误类，带错误码
- 日志: 每个公共方法入口/出口打 DEBUG 日志

### 3. 测试文件
- 路径: `src/services/{{MODULE_PATH}}/{{MODULE_NAME}}.test.ts`
- 覆盖: 所有公共方法
- 使用 Vitest，mock 外部依赖
- 至少包含: 正常路径、边界条件、错误路径

### 4. 模块导出文件
- 路径: `src/services/{{MODULE_PATH}}/index.ts`
- 导出公开 API

## 约束条件（绝对不能违反）
- [ ] 不能直接在服务层修改任何数据库表（必须通过 Repository 层）
- [ ] 不能调用任何 LLM API（通过 LLM Service 间接调用）
- [ ] 不能在服务中存储可变状态（服务必须是无状态的）
- [ ] 不能绕过谏官系统直接修改正文
- [ ] 所有可能失败的操作必须有 try-catch 和降级策略
- [ ] 循环引用检测: 你的代码不能引入循环依赖

## 验收标准
- [ ] TypeScript 编译通过（strict 模式）
- [ ] 所有测试通过（vitest run）
- [ ] Zod Schema 覆盖所有输入参数
- [ ] JSDoc 覆盖所有导出函数
- [ ] 代码复杂度: 函数 < 50 行，圈复杂度 < 10
```

---

### 2.2 模板 B：修改/修复已有代码

**适用场景**：修复 bug、添加功能、优化已有代码

```markdown
## 角色设定
你是 NarrativeOS v3.0 的代码维护工程师。你需要修改已有代码，
同时确保：
1. 不破坏现有接口契约
2. 向后兼容（除非明确要求破坏性变更）
3. 所有现有测试继续通过
4. 修改范围最小化

## 上下文注入
需要修改的代码：
@{{TARGET_FILE}}

相关设计文档：
@docs/extracts/architecture_brief.md
@docs/{{RELEVANT_DESIGN_DOC}}

相关类型定义：
@{{TYPE_DEFINITION_FILE}}

## 任务描述
**修改类型**: {{BUG_FIX | FEATURE_ADD | OPTIMIZATION}}

**问题描述**: {{ISSUE_DESCRIPTION}}

**期望行为**: {{EXPECTED_BEHAVIOR}}

**当前行为**: {{CURRENT_BEHAVIOR}} [如果是 bug 修复]

**具体修改要求**:
{{DETAILED_CHANGES}}

## 输出要求

### 1. 修改后的代码
- 使用 diff 格式标注变更
- 每处变更附简要说明

### 2. 变更影响分析
- 列出受此变更影响的所有文件
- 列出需要更新的测试
- 列出是否破坏向后兼容

### 3. 新增/更新的测试
- 针对本次变更的新测试用例
- 边界条件覆盖

### 4. 回归检查清单
- [ ] 所有现有测试通过
- [ ] 类型检查通过
- [ ] 手动验证 {{MANUAL_VERIFICATION_STEPS}}

## 约束条件
- [ ] 不修改公开接口签名（除非特别授权）
- [ ] 不删除已有功能
- [ ] 不引入新的依赖（除非说明理由）
- [ ] 保持与现有代码风格一致
- [ ] 如果涉及数据库变更，提供 migration 脚本
```

---

### 2.3 模板 C：数据库 Schema 变更

**适用场景**：新增表、修改字段、添加索引、调整约束

```markdown
## 角色设定
你是 NarrativeOS v3.0 的数据库架构师。你负责 PostgreSQL 16 的 schema 设计，
要求：
1. 所有变更必须有对应的 migration 脚本
2. 支持零停机部署（加字段必须 DEFAULT 或允许 NULL）
3. 新索引必须在低峰期创建（CONCURRENTLY）
4. 所有表必须有 created_at/updated_at
5. JSONB 字段必须有对应的 GIN 索引

## 上下文注入
当前数据库设计：
@docs/chapter04_database.md

已有 schema：
@src/db/schema.ts [如果存在]

## 任务描述
**变更类型**: {{CREATE_TABLE | ALTER_TABLE | ADD_INDEX | ADD_CONSTRAINT}}

**变更内容**:
{{SCHEMA_CHANGES}}

例如：
- 新增 knowledge_snapshots 表，用于存储世界知识的快照版本
- 在 entities 表上添加 embedding 向量索引
- 给 chapters 表添加 deleted_at 软删除字段

## 输出要求

### 1. Migration 脚本
- 路径: `src/db/migrations/{{TIMESTAMP}}_{{DESCRIPTION}}.sql`
- 使用事务包裹
- 回滚脚本包含在 down 部分
- 注释说明变更目的

### 2. TypeScript 类型更新
- 更新对应的类型定义文件
- 更新 Zod Schema

### 3. Repository 层更新 [如果需要]
- 新增/修改对应的数据访问方法
- 包含测试

### 4. Schema 文档更新
- 更新 docs/extracts/database_core.md 的对应部分

## 约束条件
- [ ] 生产环境变更必须使用 CONCURRENTLY 创建索引
- [ ] 新增字段必须有 DEFAULT 值或为 NULLABLE
- [ ] 删除字段必须先在代码中停用，下一个版本再删表
- [ ] 所有外键必须带 ON DELETE 策略
- [ ] JSONB 字段的 GIN 索引使用 jsonb_path_ops
```

---

### 2.4 模板 D：添加测试

**适用场景**：为已有代码补测试、提高覆盖率、添加集成测试

```markdown
## 角色设定
你是 NarrativeOS v3.0 的测试工程师。你的任务是为已有代码编写全面的测试套件。
测试原则：
1. 每个导出函数至少一个测试
2. 覆盖: 正常路径、边界条件、错误路径
3. 外部依赖全部 mock
4. 测试描述使用中文，说明测试场景
5. 使用 Vitest + 内置 mocking

## 上下文注入
需要测试的代码：
@{{TARGET_FILE}}

类型定义：
@{{TYPE_FILE}}

## 任务描述
**测试范围**: {{TEST_SCOPE}}

**当前覆盖率**: {{CURRENT_COVERAGE}} [如果已知]

**目标覆盖率**: {{TARGET_COVERAGE}}

**重点测试场景**:
{{KEY_SCENARIOS}}

## 输出要求

### 1. 测试文件
- 路径: 与被测文件同目录，`.test.ts` 后缀
- 使用 describe/it 结构，嵌套不超过 3 层
- 测试名格式: `应该{{行为}}当{{条件}}时`

### 2. Mock 工厂
- 为复杂依赖提供 mock 工厂函数
- mock 数据使用 faker-js 或手写常量

### 3. 测试数据构建器
- 使用 builder 模式创建测试数据
- 提供合理的默认值

## 测试结构模板
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { {{ServiceName}} } from './{{service}}.service';

describe('{{ServiceName}}', () => {
  let service: {{ServiceName}};
  let mockRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockRepo = createMockRepository();
    service = new {{ServiceName}}(mockRepo);
  });

  describe('{{methodName}}', () => {
    it('应该{{正确行为}}当{{正常条件}}时', async () => {
      // Arrange
      // Act
      // Assert
    });

    it('应该{{错误处理}}当{{错误条件}}时', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

## 约束条件
- [ ] 不使用真实数据库（使用 mock repository）
- [ ] 不使用真实 LLM API（使用 mock LLM service）
- [ ] 每个测试独立，不依赖执行顺序
- [ ] 测试运行时间 < 100ms/个
```

---

### 2.5 模板 E：重构/优化代码

**适用场景**：代码重构、性能优化、技术债清理

```markdown
## 角色设定
你是 NarrativeOS v3.0 的代码重构专家。你的任务是在不改变外部行为的前提下，
改善代码的内部结构。原则：
1. 重构前必须有完整的测试覆盖
2. 每次重构只做一件事
3. 重构后所有测试必须通过
4. 提交前进行性能基准对比

## 上下文注入
需要重构的代码：
@{{TARGET_FILE}}

相关测试：
@{{TEST_FILE}}

## 任务描述
**重构目标**: {{REFACTOR_GOAL}}

**当前问题**: {{CURRENT_ISSUES}}

**期望改善**:
- 代码行数减少 {{TARGET}}%
- 圈复杂度从 {{CURRENT}} 降到 {{TARGET}}
- 重复代码消除
- [其他指标]

## 输出要求

### 1. 重构方案说明
- 采用的重构手法（提炼函数/搬移函数/引入参数对象等）
- 变更步骤（按顺序）

### 2. 重构后代码
- 使用 diff 格式标注
- 每处重构附简要理由

### 3. 性能对比
- 重构前后的基准测试结果

### 4. 检查清单
- [ ] 所有现有测试通过
- [ ] 公开接口不变
- [ ] 行为不变（黑盒测试通过）

## 约束条件
- [ ] 不修改公开 API
- [ ] 不引入新依赖
- [ ] 不删除已有测试
- [ ] 如果测试不够，先补测试再重构
```

---

### 2.6 模板 F：前端组件开发

**适用场景**：开发 React 组件、页面、自定义 hooks

```markdown
## 角色设定
你是 NarrativeOS v3.0 的前端工程师，专注于 React 19 + TypeScript + Tailwind CSS。
设计要求：
1. **叙事优先** —— UI 绝不喧宾夺主，大量留白
2. **响应式** —— 完美适配手机/Pad/PC（6 个断点）
3. **无障碍** —— 支持键盘导航和屏幕阅读器
4. **暗黑模式** —— 默认深色主题，支持切换
5. **性能** —— 组件懒加载，虚拟列表处理长数据

## 上下文注入
UI 设计系统：
@docs/ui_design_system.md

前端架构：
@docs/responsive_frontend_arch.md

接口契约：
@docs/extracts/interface_contracts.md

## 任务描述
**组件/页面名称**: {{COMPONENT_NAME}}

**功能描述**: {{FUNCTION_DESCRIPTION}}

**所属模块**: {{MODULE}} [驾驶舱 / 仪表盘 / 休眠舱 / 世界管理 / 大纲管理 / 叙事辅助 / 系统管理]

**设计参考**:
{{DESIGN_SPEC}}

## 输出要求

### 1. 组件实现
- 路径: `src/components/{{MODULE}}/{{ComponentName}}.tsx`
- 使用函数组件 + hooks
- Props 接口必须有 JSDoc 注释
- 使用 Tailwind CSS 类名（不使用内联样式）
- 支持响应式断点: xs sm md lg xl 2xl

### 2. 组件测试
- 路径: `src/components/{{MODULE}}/{{ComponentName}}.test.tsx`
- 使用 React Testing Library
- 测试: 渲染、交互、响应式、无障碍

### 3. Storybook 故事 [可选]
- 路径: `src/components/{{MODULE}}/{{ComponentName}}.stories.tsx`
- 覆盖主要变体

### 4. 自定义 Hook [如果需要]
- 路径: `src/hooks/use{{HookName}}.ts`
- 包含测试

## 设计约束
- [ ] 配色必须使用设计系统的色彩变量
- [ ] 字体使用设计系统的字体栈
- [ ] 间距使用 Tailwind 的 spacing scale
- [ ] 圆角使用设计系统的圆角规范
- [ ] 动效使用设计系统的动效规范
- [ ] 图标使用 lucide-react

## 响应式要求
| 断点 | 布局 | 字体 | 间距 |
|------|------|------|------|
| xs (<480px) | 单栏堆叠，底部 Tab | text-sm | p-3 |
| sm (480-767) | 紧凑双栏 | text-sm | p-4 |
| md (768-1023) | 单栏+底部导航 | text-base | p-4 |
| lg (1024-1279) | 折叠侧边栏，双栏 | text-base | p-5 |
| xl (1280-1535) | 多栏，侧边栏常驻 | text-base | p-6 |
| 2xl (>1536) | 宽屏三栏 | text-lg | p-8 |
```

---

### 2.7 模板 G：调试/排错

**适用场景**：排查 Bug、定位问题、分析日志

```markdown
## 角色设定
你是 NarrativeOS v3.0 的调试专家。你的任务是快速定位并修复系统问题。
调试原则：
1. 先复现，后修复
2. 最小改动原则
3. 每步假设都必须验证
4. 修复后必须添加回归测试

## 上下文注入
错误日志/堆栈：
```
{{ERROR_LOGS}}
```

相关代码：
@{{RELEVANT_FILES}}

## 任务描述
**问题描述**: {{ISSUE_DESCRIPTION}}

**复现步骤**:
1. {{STEP_1}}
2. {{STEP_2}}
3. {{STEP_3}}

**错误表现**:
{{ERROR_MANIFESTATION}}

**已知信息**:
- 最近变更: {{RECENT_CHANGES}}
- 环境: {{ENVIRONMENT}}
- 频率: {{FREQUENCY}} [每次/偶发/特定条件]

## 输出要求

### 1. 根因分析
- 问题根因（一句话总结）
- 触发条件分析
- 影响范围评估

### 2. 修复方案
- 推荐的修复方法
- 替代方案（如果有）
- 各方案优缺点对比

### 3. 修复代码
- diff 格式的修复
- 修复说明

### 4. 回归测试
- 针对此 bug 的测试用例
- 确保不会再次发生的断言

### 5. 事后总结
- 为什么会引入这个 bug
- 如何防止类似问题

## 调试检查清单
- [ ] 是否能在本地复现
- [ ] 是否是竞态条件
- [ ] 是否是类型错误（strictNullChecks?）
- [ ] 是否是数据库事务问题
- [ ] 是否是 LLM 返回格式不兼容
- [ ] 是否是异步错误未捕获
- [ ] 是否是状态机转换条件错误
```

---

### 2.8 快捷 Prompt 速查卡

以下是更简短的 Prompt，适用于熟悉的常见操作：

#### 快速生成 CRUD
```
为 {{entity}} 实体生成完整的 CRUD 服务，包括：
1. TypeScript 接口 + Zod Schema
2. Repository 层（Knex/query builder）
3. Service 层（业务逻辑）
4. API 路由（Express/Fastify）
5. 完整测试

数据库表结构参考 @docs/extracts/database_core.md 的 {{entity}} 表。
```

#### 快速生成组件
```
实现 {{ComponentName}} 组件：
- 功能：{{description}}
- 接收 props：{{props}}
- 使用 Tailwind CSS
- 支持响应式：xs md xl
- 添加测试
```

#### 快速修复
```
修复以下问题：{{bug_description}}

相关代码：
```
[paste relevant code]
```

错误信息：
```
[paste error]
```
```

#### 快速审查
```
请审查以下代码，重点检查：
1. 类型安全性
2. 错误处理完整性
3. 是否违反主权原则（系统越权操作？）
4. 性能问题
5. 代码风格一致性

代码文件：
@{{FILE_PATH}}
```

---


## 第三章 开发 Session 工作流

### 3.1 Session 完整流程图

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         开发 Session 完整流程                                ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ┌─────────────────────────────────────────────────────────────────────┐     ║
║  │ PHASE 0: 准备工作 (2分钟)                                           │     ║
║  └─────────────────────────────────────────────────────────────────────┘     ║
║         │                                                                    ║
║         ▼                                                                    ║
║  ┌─────────────────────────────────────────────────────────────────────┐     ║
║  │ PHASE 1: 加载上下文 (3分钟)                                         │     ║
║  └─────────────────────────────────────────────────────────────────────┘     ║
║         │                                                                    ║
║         ▼                                                                    ║
║  ┌─────────────────────────────────────────────────────────────────────┐     ║
║  │ PHASE 2: 开发迭代 (30-60分钟)                                       │     ║
║  │  ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐                │     ║
║  │  │ 发  │ → │ 审  │ → │ 修  │ → │ 验  │ → │ 下  │                │     ║
║  │  │ 指令│   │ 产出│   │ 正  │   │ 证  │   │ 一  │ ...            │     ║
║  │  │     │   │     │   │ 问题│   │     │   │ 轮  │                │     ║
║  │  └─────┘   └─────┘   └─────┘   └─────┘   └─────┘                │     ║
║  └─────────────────────────────────────────────────────────────────────┘     ║
║         │                                                                    ║
║         ▼                                                                    ║
║  ┌─────────────────────────────────────────────────────────────────────┐     ║
║  │ PHASE 3: 验证 (10分钟)                                              │     ║
║  └─────────────────────────────────────────────────────────────────────┘     ║
║         │                                                                    ║
║         ▼                                                                    ║
║  ┌─────────────────────────────────────────────────────────────────────┐     ║
║  │ PHASE 4: 提交 (3分钟)                                               │     ║
║  └─────────────────────────────────────────────────────────────────────┘     ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

### 3.2 PHASE 0: 准备工作（2 分钟）

**执行清单**（按顺序打勾）：

```markdown
#### 环境检查
- [ ] 打开 VSCode，确认在 WSL 模式
- [ ] 终端执行 `git status`，确认工作区干净
- [ ] 确认当前分支是 `feature/xxx`
- [ ] 执行 `git pull origin main --rebase` 获取最新代码
- [ ] 确认数据库已启动：`sudo service postgresql status`
- [ ] 确认 Node.js 版本：`node -v` (应为 20.x)

#### 工具就绪
- [ ] VSCode 终端打开（至少 2 个标签页）
- [ ] 一个终端用于编译/测试
- [ ] 一个终端用于 git 操作
- [ ] Claude Code 聊天窗口已打开（VSCode Copilot 或独立窗口）

#### Session 计划确认
- [ ] 本次 Session 的目标写在一张便利贴（或 VSCode 注释）上
- [ ] 确认预计时长（工作日 90 分钟 / 周末 150 分钟）
- [ ] 设计文档已准备好加载路径
```

**VSCode 工作区布局建议**：
```
┌──────────────────────────┬──────────────────────┐
│                          │                      │
│   代码编辑区域 (主)       │   Claude Code 聊天   │
│                          │   (侧边栏或分栏)      │
│                          │                      │
│                          ├──────────────────────┤
│                          │                      │
│                          │   终端 / 测试输出     │
│                          │                      │
├──────────────────────────┼──────────────────────┤
│   文件浏览器 / Git       │   问题 / 调试控制台   │
└──────────────────────────┴──────────────────────┘
```

---

### 3.3 PHASE 1: 加载上下文（3 分钟）

**步骤 1.1：声明开发目标**（30 秒）

对 Claude 说的第一句话必须是：
```
本次 Session 目标：[一句话描述]
预计时长：90分钟
相关模块：[模块名]

--- 常驻上下文加载开始 ---
```

**步骤 1.2：加载常驻上下文**（1 分钟）

使用 VSCode 的 `@` 引用功能或手动粘贴：
```
请参考以下常驻上下文文件：
@docs/extracts/architecture_brief.md
@docs/extracts/sovereignty_brief.md
@docs/extracts/database_core.md
@docs/extracts/interface_contracts.md
@docs/project_conventions.md
```

**步骤 1.3：加载模块上下文**（1 分钟）

```
本次开发涉及的设计文档：
@docs/chapter05_world_engine.md

重点关注 §5.3 因果推演器的实现。
```

**步骤 1.4：加载已有代码**（30 秒）

```
已有代码参考：
@src/services/world/types.ts
@src/db/schema.ts

请勿修改这些文件中的现有接口。
```

---

### 3.4 PHASE 2: 开发迭代（核心 30-60 分钟）

#### 3.4.1 开发迭代的微循环

```
第 1 轮 (5-10 分钟)
   │
   ├── 发指令：给出完整的 Prompt（使用模板 A）
   │
   ├── 审产出：逐行检查 Claude 的输出
   │   ├── 类型安全性检查
   │   ├── 主权合规性检查（是否有越权操作）
   │   ├── 接口一致性检查
   │   └── 测试完整性检查
   │
   ├── 修正：指出问题，让 Claude 修复
   │   ├── 小问题：一句话指出
   │   ├── 中等问题：指出位置 + 期望行为
   │   └── 严重问题：重新加载上下文，重新开始
   │
   └── 验证：本地运行编译/测试
       ├── 通过 → 下一轮
       └── 失败 → 粘贴错误给 Claude 修复

第 2 轮 (5-10 分钟)
   │
   ├── 发指令：下一个子任务或深化当前任务
   │
   └── ...（同上）

第 3-N 轮
   └── ... 直到时间用完或目标完成
```

#### 3.4.2 如何给 Claude 正确的指令

**好的指令特征**：
1. **单一职责**：每条指令只要求一件事
2. **边界明确**：说清楚"做到哪里为止"
3. **约束清晰**： sovereignty 红线必须先声明
4. **上下文充分**：引用相关文件和已有代码
5. **示例驱动**：给出一个输入/输出示例

**示例 —— 好的指令**：
```
请实现因果推演器的 CausalPropagator 类。

设计要求：
- 输入：Event 实体 + 当前世界状态快照
- 输出：Effect[] 数组（每个 Effect 包含 affectedEntityId, changeType, magnitude, reasoning）
- 算法：基于规则匹配 + 图遍历（详见设计文档 §5.3.4）
- 最大传播深度：3 层

约束：
- 不能修改数据库（只读查询）
- 不能调用 LLM（纯规则计算）
- 传播时间控制在 100ms 以内

请同时编写完整的单元测试。
```

**示例 —— 差的指令**：
```
帮我写一下因果推演器的代码。    ← 问题：太模糊，没有边界
```

#### 3.4.3 如何审查 Claude 的产出

**审查优先级**（按重要程度排序）：

| 优先级 | 检查项 | 检查方法 |
|--------|--------|----------|
| P0 | **主权合规** — 代码中是否有绕过作者裁决的操作？ | 搜索所有 write/update/delete 操作，确认都需要 authorDecision 或 proposal 流程 |
| P0 | **类型安全** — strictNullChecks 下能否编译？ | 运行 `tsc --noEmit` |
| P1 | **接口兼容** — 是否与已有接口定义一致？ | 对比已有类型定义文件 |
| P1 | **错误处理** — 所有异步操作是否有 try-catch？ | 搜索所有 async/await，确认有错误处理 |
| P2 | **测试覆盖** — 是否覆盖了正常+异常路径？ | 运行 `vitest --coverage` |
| P2 | **代码风格** — 是否符合项目规范？ | 检查命名、长度、注释 |

**审查话术模板**：
```
审查结果：

✅ 类型安全 — 通过编译
✅ 接口兼容 — 与已有类型一致
⚠️ 错误处理 — 第 45 行的 async 函数缺少 try-catch
❌ 主权合规 — 第 78 行直接调用了 chapterRepository.update()，
   必须通过 Proposal 流程，请修复

请修复以上 ⚠️ 和 ❌ 项。
```

#### 3.4.4 如何让 Claude 修正问题

**小修正**（一行或一个函数的问题）：
```
第 45 行：请给 async function propagateEffects 添加 try-catch，
捕获 CausalLoopDetectedError 和 TimeoutError。
```

**中修正**（需要重写一个函数或调整逻辑）：
```
propagateEffects 方法需要重构：
1. 传播深度控制应该在 while 循环的头部检查，而不是尾部
2.  visited 集合应该使用 Set<string> 而不是 string[]
3. 请重写这个函数，保持接口签名不变
```

**大修正**（需要重新开始）：
```
目前的实现偏离了设计文档的要求。让我重新说明需求：
[重新加载相关设计文档段落]
[重新说明核心要求]

请基于以上信息重新实现。
```

#### 3.4.5 每轮对话后的验证

```bash
# 第 1 步：类型检查（最快，先跑）
npx tsc --noEmit

# 第 2 步：lint
npm run lint

# 第 3 步：相关测试
npx vitest run src/services/world/causal-propagator.test.ts

# 第 4 步：全量测试（Session 最后才跑）
npx vitest run
```

**验证失败时的处理**：
1. 复制错误信息的前 20 行
2. 粘贴给 Claude："修复以下编译错误："
3. Claude 修复后再次验证
4. 重复直到通过

---

### 3.5 PHASE 3: 验证（10 分钟）

#### 验证清单

```markdown
#### 编译验证
- [ ] `npx tsc --noEmit` 通过（无类型错误）
- [ ] `npm run lint` 通过（无 lint 错误）
- [ ] 无 console.log 残留（使用 console 仅限调试）

#### 测试验证
- [ ] 新增功能的单元测试全部通过
- [ ] 相关模块的测试通过
- [ ] 覆盖率不降低（`npx vitest run --coverage`）

#### 功能验证
- [ ] 手动走查代码逻辑
- [ ] 边界条件检查（空值、最大值、异常输入）
- [ ] 主权合规最终确认

#### 回归验证
- [ ] 与已有代码的集成点检查
- [ ] 没有破坏其他模块的接口
- [ ] 数据库 migration 可正常执行（如适用）
```

#### 手动验证步骤模板

```typescript
// 在终端或临时测试文件中执行：

// 1. 验证服务可以实例化
import { CausalPropagator } from './causal-propagator.service';
const propagator = new CausalPropagator(mockRepo, mockConfig);
console.log('✅ 实例化成功');

// 2. 验证正常路径
const result = await propagator.propagate(eventId, worldState);
console.assert(result.effects.length > 0, '应该有传播效果');
console.assert(result.processingTimeMs < 100, '应该在 100ms 内完成');
console.log('✅ 正常路径通过');

// 3. 验证边界条件
const emptyResult = await propagator.propagate('nonexistent', worldState);
console.assert(emptyResult.effects.length === 0, '不存在的实体应返回空');
console.log('✅ 边界条件通过');

// 4. 验证错误处理
try {
  await propagator.propagate(eventId, null as any);
  console.assert(false, '应该抛出错误');
} catch (e) {
  console.log('✅ 错误处理通过');
}
```

---

### 3.6 PHASE 4: 提交（3 分钟）

#### Git 提交流程

```bash
# 步骤 1：查看变更
$ git status
$ git diff --stat

# 步骤 2：选择性暂存（不要一次 add 所有）
$ git add src/services/world/causal-propagator.ts
$ git add src/services/world/causal-propagator.test.ts
$ git add src/services/world/types.ts

# 步骤 3：如果涉及数据库变更
$ git add src/db/migrations/...

# 步骤 4：确认暂存内容
$ git diff --cached --stat

# 步骤 5：提交
$ git commit -m "feat(world-engine): 实现因果推演器 CausalPropagator

- 实现基于规则匹配的因果传播算法
- 支持最大 3 层传播深度
- 传播超时控制 100ms
- 覆盖正常路径 + 边界条件 + 错误处理的完整测试
- 所有传播操作均为只读，不修改世界状态

审查要点:
- 类型安全: strictNullChecks 通过
- 主权合规: 无数据库写操作，纯计算服务
- 测试覆盖: 12 个测试用例，100% 行覆盖
- 性能: 平均传播时间 15ms (本地测试)

Closes #{{issue_number}}"

# 步骤 6：推送到远程
$ git push origin feature/world-engine-causal
```

#### Commit Message 规范

**格式**：
```
<type>(<scope>): <简短描述>

- 详细变更 1
- 详细变更 2

审查要点:
- 检查项 1
- 检查项 2
```

**Type 前缀**：
| 前缀 | 用途 |
|------|------|
| `feat()` | 新功能 |
| `fix()` | Bug 修复 |
| `refactor()` | 重构（无功能变化） |
| `test()` | 测试相关 |
| `docs()` | 文档变更 |
| `chore()` | 构建/工具/配置 |
| `perf()` | 性能优化 |

**Scope 范围**：
`world-engine` | `studio-engine` | `mou` | `frontend` | `database` | `llm` | `quality` | `shared`

---

### 3.7 Session 时长规划

#### 工作日晚上 Session（90 分钟）

```
18:30-18:32  准备（2 分钟）
18:32-18:35  加载上下文（3 分钟）
18:35-19:25  开发迭代（50 分钟）
              └─ 约 5-7 轮对话
              └─ 目标：完成 1 个子功能的实现 + 测试
19:25-19:32  验证（7 分钟）
19:32-19:35  提交（3 分钟）
19:35        结束，记录下次待办
```

#### 周末白天 Session（150 分钟）

```
09:00-09:02  准备（2 分钟）
09:02-09:05  加载上下文（3 分钟）
09:05-10:35  开发迭代（90 分钟）
              └─ 两个微循环（45 分钟 x 2）
              └─ 微循环 1：实现核心功能
              └─ 微循环 2：完善边界条件 + 测试
              └─ 中场休息 5 分钟
10:35-10:45  验证（10 分钟）
10:45-10:48  提交（3 分钟）
10:48        结束
```

**周末可以连续进行 2-3 个 Session**，每个 Session 之间有 15-30 分钟休息。

---

### 3.8 Session 中断处理

#### 正常中断（时间到了但任务没完成）

```bash
# 1. 提交当前进度（即使未完成）
$ git add .
$ git commit -m "wip(world-engine): 因果推演器实现中

- 完成核心传播算法
- TODO: 边界条件测试、超时控制

进度: ~70%"

# 2. 在代码中标记 TODO
// TODO[next-session]: 添加传播深度超限的测试
// TODO[next-session]: 实现超时控制逻辑

# 3. 下次 Session 开头，从上次中断处继续
```

#### 意外中断（Claude 失去上下文、VSCode 崩溃等）

```
1. 重新打开 VSCode 和终端
2. 执行 git status 确认代码状态
3. 重新加载常驻上下文
4. 不需要重新加载模块上下文（除非 Claude 完全遗忘）
5. 用一句话重述当前进度："上次我们在实现因果传播的深度控制，
   核心算法已完成，正在写测试"
6. 继续开发
```

---

### 3.9 Session 产出物标准

每个 Session 应该产出以下**至少一项**可提交的成品：

| 产出类型 | 示例 | 最低标准 |
|----------|------|----------|
| 完整功能 | 因果推演器核心实现 | 编译通过 + 测试通过 + 至少 80% 覆盖 |
| 功能增强 | 给已有模块添加新字段 | 编译通过 + 测试更新 + API 文档更新 |
| 重构改进 | 提取公共函数消除重复 | 编译通过 + 所有测试通过 + 代码行数减少 |
| 测试补充 | 给已有代码补测试 | 新增 5+ 个测试用例 + 覆盖率提升 10%+ |
| 文档完善 | 更新 API 文档 | 覆盖所有公开接口 + 包含示例 |

**禁止提交未完成代码到 main 分支**。
WIP 代码可以提交到 feature 分支，但必须显式标记为 `wip`。

---


## 第四章 Claude Code 最佳实践

### 4.1 Do（要做的）

#### 4.1.1 如何组织 Prompt 以获得最佳代码质量

**1. 先约束，后任务**

```
差的顺序：
"帮我写因果推演器。对了，不要修改数据库。"

好的顺序：
"约束：本服务为只读，禁止任何数据库写操作。
约束：传播深度不得超过 3 层。
约束：处理时间不得超过 100ms。
任务：实现因果推演器 CausalPropagator。"
```

**原因**：Claude 在生成代码时会记住所有约束。如果约束放在后面，可能先生成了违规代码，然后才意识到要遵守约束。

**2. 分层描述复杂度**

```
第一层（必须记住）：核心算法要求
第二层（参考）：数据结构定义
第三层（查阅时才需要）：完整的类型定义

用法：
"核心算法：使用 BFS 遍历影响图，深度不超过 3。
数据结构：Effect { entityId, changeType, magnitude, reasoning }
完整类型定义参考 @src/services/world/types.ts"
```

**3. 提供最少但足够的上下文**

```
不要给 Claude 10 个文件让它自己找答案。
要精确说明：
"实体的数据结构定义在 @src/db/schema.ts 第 45-67 行。"
"传播算法参考设计文档 §5.3.4（已粘贴如下：...）"
```

**4. 用示例驱动**

```
任务：实现战力计算函数 calculatePower()

输入示例：
{ realm: "qi_refining", tier: 3, artifacts: [{type: "sword", bonus: 1.5}] }

期望输出：
{ basePower: 300, artifactBonus: 150, totalPower: 450, realmLabel: "练气三层" }

请基于以上示例实现函数。
```

**5. 要求 Claude 先写设计再写代码**

```
对于复杂功能，使用两步法：

第一步："请先描述你的实现方案（不要写代码），包括：
- 核心算法步骤（伪代码级别）
- 关键数据结构
- 错误处理策略
- 与已有代码的集成点"

（审查方案后）

第二步："方案 OK，请实现代码。"
```

#### 4.1.2 如何利用 Claude 的代码审查能力

**场景 A：审查自己的代码**
```
我写了一部分代码，请审查：

审查维度：
1. 类型安全性 —— 是否有 any 或类型不安全的操作？
2. 错误处理 —— 所有 async 函数是否有 try-catch？
3. 主权合规 —— 是否有绕过作者裁决的操作？
4. 性能 —— 是否有 O(n^2) 以上的算法？
5. 代码异味 —— 是否有重复、过长函数、魔法数字？

请逐行审查，发现问题时标注行号和严重程度。

代码如下：
```
[paste code]
```
```

**场景 B：审查 Claude 自己刚写的代码**
```
你刚才写的代码，请用审查者视角再检查一遍，
重点关注：
1. 是否有边界条件遗漏？
2. 测试是否充分？
3. 变量命名是否清晰？

以审查报告格式输出。
```

#### 4.1.3 如何让 Claude 生成高质量测试

**策略 1：明确测试层次**
```
请为以下函数编写测试，分为三个层次：
- Level 1 (基础)：正常输入的正常输出
- Level 2 (边界)：空值、最大值、最小值、空数组
- Level 3 (异常)：无效输入、超时、竞态条件
```

**策略 2：要求基于属性测试**
```
除了示例测试，请为关键函数添加基于属性的测试：
- 幂等性：f(f(x)) === f(x)
- 单调性：如果 a > b，则 f(a) >= f(b)
- 不变性：f(x) 的某些属性始终保持不变
```

**策略 3：要求错误注入测试**
```
请为所有外部依赖（数据库、LLM API）添加 mock 错误场景：
- 超时错误
- 返回格式错误
- 连接断开
- 返回 null
```

#### 4.1.4 如何让 Claude 写文档注释

**步骤**：
```
1. 代码完成后，追加指令：
"请为以上所有导出函数补充 JSDoc 注释，要求：
- @param 说明每个参数的用途和约束
- @returns 说明返回值
- @throws 说明可能抛出的错误
- 用中文描述"

2. 对复杂算法，追加：
"请在核心算法函数内部添加行内注释，说明关键步骤的逻辑"
```

**JSDoc 模板**：
```typescript
/**
 * 计算角色在当前境界下的总战力值
 *
 * 战力公式：basePower × realmMultiplier + artifactBonus
 * 其中 realmMultiplier 从境界树中查找
 *
 * @param characterId - 角色实体 ID（UUID）
 * @param context - 计算上下文，包含当前境界树和装备列表
 * @returns 战力计算结果，包含基础值、加成和总值
 * @throws {EntityNotFoundError} 角色不存在时
 * @throws {InvalidRealmError} 境界数据损坏时
 *
 * @example
 * ```ts
 * const result = await calculator.calculate('char-123', {
 *   realmTree: qiRefiningTree,
 *   artifacts: [{ type: 'sword', bonus: 1.5 }]
 * });
 * // result: { basePower: 300, artifactBonus: 150, totalPower: 450 }
 * ```
 */
```

---

### 4.2 Don't（不要做的）

#### 4.2.1 哪些任务不适合交给 Claude

| 任务类型 | 原因 | 建议 |
|----------|------|------|
| 架构级别的重大决策 | Claude 没有项目的全局历史和业务深度 | 自己做决策，让 Claude 实现 |
| 涉及多模块协调的复杂重构 | 容易遗漏依赖关系，导致连锁故障 | 手动规划步骤，让 Claude 逐个模块执行 |
| 安全敏感的代码（认证/授权） | Claude 可能遗漏安全边界情况 | 手动实现核心逻辑，Claude 辅助写测试 |
| 性能关键路径的算法优化 | Claude 倾向于可读性而非性能 | 自己设计算法，Claude 实现骨架 |
| 数据库 migration 的数据迁移 | 涉及数据完整性，风险高 | 手动编写和验证 |
| 第三方 API 的集成细节 | Claude 的 API 知识可能过时 | 自己读文档，Claude 辅助封装 |

#### 4.2.2 什么时候应该手动写代码

**手动编写的场景**：
1. **核心主权检查逻辑** —— 这是系统的底线，不能出错
2. **错误码定义** —— 需要与已有体系保持一致
3. **数据库核心事务** —— 涉及数据一致性
4. **XState 状态机定义** —— 涉及复杂的状态转换条件
5. **公开 API 接口签名** —— 影响所有调用方

**Claude 编写的场景**：
1. 具体的业务逻辑实现
2. CRUD 操作的 boilerplate
3. 单元测试
4. JSDoc 注释
5. 数据转换/格式化函数
6. 简单的 React 组件

#### 4.2.3 什么时候应该拆分为多个 Prompt

**必须拆分的情况**：
1. 代码超过 200 行 —— 拆分为多个函数/文件
2. 涉及多个不相关的子功能 —— 逐个实现
3. 需要先设计再实现 —— 两步 Prompt
4. 需要审查后修改 —— 先审查再修复
5. 上下文窗口即将用完 —— 新开 Session

**拆分模板**：
```
原指令："实现世界引擎（包含8个子引擎）" ← 太大

拆分后：
Session 1："实现物理规则引擎的 RealmSystem 和战力计算"
Session 2："实现因果推演器（基于 Session 1 的接口）"
Session 3："实现 NPC 行为引擎"
...
```

#### 4.2.4 常见反模式

| 反模式 | 现象 | 后果 | 解决方案 |
|--------|------|------|----------|
| **Prompt 过于宏大** | "帮我实现整个世界引擎" | 产出质量低、遗漏关键约束 | 拆分为子引擎逐个实现 |
| **上下文加载不全** | 不给 Claude 看设计文档 | 代码偏离架构要求 | 始终先加载相关设计文档 |
| **不审查就接受** | Claude 说写好了就提交 | 隐藏的类型错误、安全漏洞 | 强制进行审查清单检查 |
| **Session 太长** | 一个 Session 做 3 小时 | Claude 注意力衰减，代码质量下降 | 控制在 90 分钟内 |
| **不给约束** | 只说"实现某某功能" | Claude 做出不符合主权原则的设计 | 约束条件放在 Prompt 最前面 |
| **反复修改同一处** | 第 5 次让 Claude 修改同一个函数 | 代码越来越混乱 | 回退到稳定版本重新来 |
| **忽视测试** | 只要求实现功能，不要求测试 | 回归 Bug 无法发现 | 每个功能必须附带测试 |
| **复制粘贴错误** | 把 Claude 的代码直接粘贴到错误的位置 | 编译失败 | 使用 diff 格式确认变更位置 |

---

### 4.3 Claude 能力边界速查表

| 能力 | Claude 表现 | 建议 |
|------|------------|------|
| 代码生成（< 200 行） | 优秀 | 放心使用 |
| 代码生成（200-500 行） | 良好 | 分模块生成，逐个审查 |
| 代码生成（> 500 行） | 一般 | 强烈建议拆分 |
| TypeScript 类型推导 | 优秀 | 放心使用 |
| 算法设计（标准算法） | 良好 | 提供参考实现 |
| 算法设计（领域特定） | 一般 | 自己设计，Claude 实现 |
| 错误处理设计 | 良好 | 明确列出需要处理的错误类型 |
| 测试生成 | 良好 | 提供边界条件示例 |
| 代码重构 | 良好 | 保持接口不变的前提下使用 |
| 文档生成 | 优秀 | 放心使用 |
| 跨文件依赖分析 | 一般 | 手动确认依赖关系 |
| 性能优化 | 一般 | 提供性能目标和基准 |
| 安全审计 | 一般 | 核心安全逻辑手动审查 |
| 复杂状态机设计 | 一般 | XState 配置手动编写 |

---

## 第五章 代码审查清单

### 5.1 审查清单总览

每次 Session 结束前，必须按以下清单逐条检查 Claude 的产出：

```markdown
## 代码审查清单 v1.0

### P0 —— 阻塞性问题（必须修复）
- [ ] 第一公理合规（主权检查）
- [ ] 类型安全性
- [ ] 错误处理完整性

### P1 —— 重要问题（强烈建议修复）
- [ ] 架构一致性
- [ ] 接口兼容性
- [ ] 测试覆盖度

### P2 —— 一般问题（有空再修复）
- [ ] 代码风格
- [ ] 性能影响
- [ ] 文档完整性
```

---

### 5.2 P0 级审查 —— 第一公理合规性（主权检查）

**这是 NarrativeOS 最重要的审查项，绝对不能跳过。**

**检查问题**：代码中是否有系统**未经作者明确授权**就执行以下操作：

| 检查项 | 检查方法 | 修复要求 |
|--------|----------|----------|
| 直接修改已确认正文 | 搜索所有 `update`/`save` 正文内容的代码路径 | 必须经过 Proposal → AuthorApproval 流程 |
| 未经授权推进时间线 | 搜索修改 `current_time`/`timeline` 的操作 | 必须通过 MOU 状态机的作者事件触发 |
| 删除已确认的世界观设定 | 搜索 `DELETE FROM entities WHERE status='confirmed'` 类操作 | 软删除 + 必须 Proposal |
| 自动发布/导出内容 | 搜索 `export`/`publish` 相关调用 | 必须有作者显式触发 |
| 绕过谏官系统 | 搜索质检相关调用是否都经过 CounselorService | 所有质检必须通过谏官壳 |
| 越权调用外部服务 | 搜索 LLM API 调用点 | 必须通过 LLMService 调用，且记录日志 |

**审查话术**（对 Claude）：
```
请审查以下代码的第一公理合规性：
1. 标出所有直接修改数据的地方（不是通过 Proposal 流程的）
2. 标出所有可能绕过作者裁决的代码路径
3. 确认每个 "write" 操作都有对应的授权检查

代码：
@{{FILE_PATH}}
```

**手动复查重点**：
- 即使 Claude 说合规，也要手动检查 `if (!authorized)` 的条件是否覆盖所有路径
- 检查是否有 `// TODO: 添加权限检查` 的遗留注释
- 检查测试用例中是否测试了未授权访问的场景

---

### 5.3 P0 级审查 —— 类型安全性

**检查清单**：

```markdown
- [ ] `strictNullChecks` 开启，无类型错误
- [ ] 无 `any` 类型（除非有注释说明原因）
- [ ] 函数参数和返回值都有类型标注
- [ ] 数据库查询结果有正确的类型断言
- [ ] JSONB 字段有对应的 Zod Schema 校验
- [ ] 枚举类型使用一致（不混用 string 和 enum）
- [ ] Promise 的返回类型正确
- [ ] 数组访问有边界检查（`noUncheckedIndexedAccess`）
- [ ] 可选链操作符使用恰当（`?.` 不是掩盖类型错误）
```

**验证命令**：
```bash
# 类型检查
npx tsc --noEmit

# 查看 any 使用情况
grep -rn ": any" src/ --include="*.ts" | grep -v "test" | grep -v "mock"

# 查看未处理的 null
grep -rn "!." src/ --include="*.ts" | grep -v "test"
```

---

### 5.4 P0 级审查 —— 错误处理完整性

**检查清单**：

```markdown
- [ ] 所有 async 函数有 try-catch
- [ ] 所有 Promise 有 .catch 或 await + try-catch
- [ ] 外部 API 调用（LLM/数据库）有超时处理
- [ ] 超时后有降级策略（不抛未处理异常）
- [ ] 错误日志包含足够的上下文（requestId、参数摘要）
- [ ] 不向客户端暴露敏感信息（数据库连接串、内部路径）
- [ ] 自定义错误类继承自 AppError，有错误码
- [ ] 错误响应格式符合 ApiResponse 接口定义
```

**常见错误处理模板**：
```typescript
// 好的错误处理
async function getEntity(id: string): Promise<Entity> {
  try {
    const entity = await db.entities.findById(id);
    if (!entity) {
      throw new EntityNotFoundError({ entityId: id });
    }
    return entity;
  } catch (error) {
    if (error instanceof EntityNotFoundError) {
      throw error; // 已知错误，直接抛出
    }
    logger.error('Failed to fetch entity', { error, entityId: id, requestId });
    throw new DatabaseError({ code: 'DB_QUERY_FAILED', cause: error });
  }
}

// 差的错误处理
async function getEntity(id: string) {
  return await db.entities.findById(id); // 没有错误处理！
}
```

---

### 5.5 P1 级审查 —— 架构一致性

**检查清单**：

```markdown
- [ ] 代码所在层级正确（服务层不做协调层的事）
- [ ] 遵循依赖方向（上层可以调下层，反之不行）
- [ ] 使用已定义的接口，不私自定义新契约
- [ ] 服务是无状态的（不存储会话状态）
- [ ] 数据库操作通过 Repository 层，不直接 raw query
- [ ] LLM 调用通过 LLMService，不直接调用 provider API
- [ ] 配置通过 ConfigService 读取，不硬编码
- [ ] 日志通过 LoggerService 记录，不直接 console.log
```

**层级违规检查**：
```bash
# 检查服务层是否直接操作 WebSocket（应该在协调层）
grep -rn "websocket\|sse\|stream" src/services/ --include="*.ts"

# 检查是否直接调用 LLM API
grep -rn "openai\|anthropic\|api.openai.com" src/ --include="*.ts" | grep -v "llm.service"

# 检查是否有 console.log
grep -rn "console\.log\|console\.error" src/ --include="*.ts" | grep -v "test"
```

---

### 5.6 P1 级审查 —— 接口兼容性

**检查清单**：

```markdown
- [ ] 新增接口遵循 ApiResponse 统一响应格式
- [ ] 不修改已有接口的签名（除非经过影响分析）
- [ ] 使用 Zod Schema 校验所有输入
- [ ] 接口版本号正确（破坏性变更升级 MAJOR）
- [ ] 分页参数遵循游标分页规范
- [ ] 幂等键（idempotencyKey）在所有写入接口中支持
```

---

### 5.7 P1 级审查 —— 测试覆盖度

**检查清单**：

```markdown
- [ ] 每个导出函数至少 1 个测试
- [ ] 正常路径有测试
- [ ] 边界条件有测试（空值、空数组、最大值）
- [ ] 错误路径有测试（异常输入、超时、外部失败）
- [ ] 新代码的覆盖率 ≥ 80%
- [ ] 测试运行时间 < 100ms/个
- [ ] 测试之间相互独立（无执行顺序依赖）
```

---

### 5.8 P2 级审查 —— 代码风格

**检查清单**：

```markdown
- [ ] 命名符合项目规范（文件/接口/变量/函数）
- [ ] 函数长度 < 50 行
- [ ] 圈复杂度 < 10
- [ ] 无魔法数字（有命名的常量）
- [ ] 无重复代码（DRY 原则）
- [ ] JSDoc 覆盖所有导出函数
- [ ] 导入排序正确（外部 → 内部 → 相对）
```

---

### 5.9 P2 级审查 —— 性能影响

**检查清单**：

```markdown
- [ ] 数据库查询有适当的索引
- [ ] 无 N+1 查询问题
- [ ] 大数据集使用分页/流式处理
- [ ] 缓存了重复计算结果
- [ ] 异步操作使用了 Promise.all 并行化
- [ ] 无内存泄漏（事件监听器清理、大对象释放）
```

---

### 5.10 审查 Checklist 使用模板

在每次 Session 结束前，将此清单填入实际检查结果：

```markdown
## Session 审查记录 —— {{日期}} —— {{模块名}}

### P0 阻塞项
- [x] 第一公理合规 —— 通过/不通过 —— 备注
- [x] 类型安全 —— 通过/不通过 —— 备注
- [x] 错误处理 —— 通过/不通过 —— 备注

### P1 重要项
- [x] 架构一致性 —— 通过/不通过 —— 备注
- [x] 接口兼容 —— 通过/不通过 —— 备注
- [x] 测试覆盖 —— 通过/不通过 —— 备注

### P2 一般项
- [x] 代码风格 —— 通过/不通过 —— 备注
- [x] 性能影响 —— 通过/不通过 —— 备注
- [x] 文档完整 —— 通过/不通过 —— 备注

### 结论
- [ ] 可以提交
- [ ] 需要修复（列出问题）
- [ ] 需要重新设计

审查人：{{你的名字}}
```

---


## 第六章 Git 工作流

### 6.1 分支策略

#### 分支模型

```
main (受保护，只能 PR 合并)
  │
  ├── feature/world-engine-realm      ← 世界引擎：境界体系
  ├── feature/world-engine-causal     ← 世界引擎：因果推演
  ├── feature/world-engine-npc        ← 世界引擎：NPC 行为
  ├── feature/studio-engine-brief     ← 工作室引擎：Brief 生成
  ├── feature/studio-engine-ama       ← 工作室引擎：AMA 蒸馏
  ├── feature/mou-state-machine       ← MOU 状态机核心
  ├── feature/mou-oracle              ← 神谕查询
  ├── feature/frontend-cockpit        ← 前端：驾驶舱
  ├── feature/frontend-dashboard      ← 前端：仪表盘
  ├── feature/db-initial-schema       ← 数据库：初始 schema
  ├── feature/db-migrations           ← 数据库：变更 migration
  ├── feature/quality-counselor       ← 质量系统：谏官
  ├── feature/llm-integration         ← LLM 集成层
  ├── feature/shared-types            ← 共享类型定义
  └── refactor/extract-common-utils   ← 重构：提取公共工具
```

#### 分支命名规范

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feature/` | 新功能开发 | `feature/world-engine-realm` |
| `fix/` | Bug 修复 | `fix/causal-loop-detection` |
| `refactor/` | 重构（无功能变化） | `refactor/extract-base-service` |
| `test/` | 测试补充 | `test/add-world-engine-tests` |
| `docs/` | 文档更新 | `docs/update-api-reference` |
| `chore/` | 构建/工具 | `chore/update-dependencies` |

**命名规则**：
- 全部小写，用连字符分隔
- 格式：`{前缀}/{模块}-{简要描述}`
- 描述不超过 5 个单词
- 不使用中文

#### 分支生命周期

```
创建：基于最新 main 创建
  │
  ▼
开发：多次 commit（使用本手册的 Session 流程）
  │
  ▼
保持同步：定期 rebase 到最新 main
  │
  ▼
合并：通过 PR/MR 合并到 main（单人项目可直接 merge）
  │
  ▼
删除：合并后删除 feature 分支
```

---

### 6.2 Commit Message 规范

#### 格式

```
<type>(<scope>): <简短描述（50字符以内）>

- 详细变更 1
- 详细变更 2
- 详细变更 3

审查记录:
- P0 第一公理: ✅ 通过
- P0 类型安全: ✅ 通过
- P1 架构一致: ✅ 通过
- P1 测试覆盖: {{覆盖率}}%

参考: #{{issue_number}}
```

#### Type 前缀

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(world-engine): 实现境界体系战力计算` |
| `fix` | Bug 修复 | `fix(mou): 修复状态机转换条件判断` |
| `refactor` | 重构 | `refactor(db): 提取公共查询构建器` |
| `test` | 测试 | `test(studio): 补充 Brief 生成器测试` |
| `docs` | 文档 | `docs(api): 更新实体查询接口文档` |
| `chore` | 工具/配置 | `chore(deps): 升级 XState 到 5.5` |
| `perf` | 性能优化 | `perf(world): 优化因果传播算法` |
| `style` | 代码格式 | `style(frontend): 统一组件导入排序` |

#### Scope 范围

| Scope | 说明 |
|-------|------|
| `world-engine` | 世界引擎 |
| `studio-engine` | 工作室引擎 |
| `mou` | MOU 状态机 |
| `frontend` | 前端 |
| `db` | 数据库 |
| `llm` | LLM 集成 |
| `quality` | 质量系统 |
| `shared` | 共享代码 |
| `api` | API 层 |
| `config` | 配置 |
| `deps` | 依赖 |

#### 完整示例

```
feat(world-engine): 实现因果推演器 CausalPropagator

- 实现基于 BFS 的因果传播算法
- 支持最大 3 层传播深度
- 添加传播超时控制（100ms）
- 覆盖 12 个测试用例（正常/边界/错误路径）
- 所有传播操作均为只读，不修改世界状态

审查记录:
- P0 第一公理: ✅ 通过（纯只读服务）
- P0 类型安全: ✅ 通过（strictNullChecks）
- P0 错误处理: ✅ 通过（全路径覆盖）
- P1 架构一致: ✅ 通过（服务无状态）
- P1 测试覆盖: 100%
- P2 代码风格: ✅ 通过

性能基准:
- 平均传播时间: 15ms（本地测试，100 实体图）
- 最大传播深度 3 时：95 分位 < 50ms

参考: #42
```

---

### 6.3 Rebase vs Merge 策略

#### 使用 Rebase 的场景

```bash
# 在 feature 分支上，同步 main 的最新变更
$ git checkout feature/world-engine-realm
$ git fetch origin
$ git rebase origin/main

# 如果冲突
$ git rebase --continue
# 或放弃
$ git rebase --abort
```

**Rebase 适用**：
- feature 分支尚未推送到远程（或只有你在用）
- 需要保持线性提交历史
- 解决冲突后立即继续

#### 使用 Merge 的场景

```bash
# 合并 feature 分支到 main
$ git checkout main
$ git pull origin main
$ git merge --no-ff feature/world-engine-realm
$ git push origin main
```

**Merge 适用**：
- feature 分支已推送到远程（多人协作）
- 需要保留分支合并历史
- 合并后删除 feature 分支

#### 单人项目推荐流程

```bash
# ===== 每日开始 =====
# 1. 切到 main，拉取最新
git checkout main
git pull origin main

# 2. 创建/切到 feature 分支
git checkout -b feature/xxx   # 新建
git checkout feature/xxx      # 已有

# ===== 开发中 =====
# 3. 定期 rebase 保持同步
git fetch origin
git rebase origin/main

# ===== 开发完成 =====
# 4. 最终 rebase
git rebase origin/main

# 5. 切到 main 合并
git checkout main
git merge --no-ff feature/xxx

# 6. 推送
git push origin main

# 7. 删除 feature 分支
git branch -d feature/xxx
```

---

### 6.4 Tag 策略

#### 里程碑标记

```bash
# 主要里程碑
git tag -a v0.1.0-alpha -m "MVP: 项目骨架 + 数据库 Schema"
git tag -a v0.2.0-alpha -m "MVP: 世界引擎核心（物理规则 + 因果推演）"
git tag -a v0.3.0-alpha -m "MVP: 工作室引擎核心（Brief + AMA）"
git tag -a v0.4.0-alpha -m "MVP: MOU 状态机 + 前端控制台"
git tag -a v0.5.0-beta  -m "内测版: 完整端到端流程"
git tag -a v1.0.0       -m "正式版: NarrativeOS v3.0 Sovereign"

# 推送 tag
git push origin v0.1.0-alpha

# 推送所有 tag
git push origin --tags
```

#### 版本号语义

```
v{MAJOR}.{MINOR}.{PATCH}-{stage}

MAJOR: 架构级变更，不兼容的 API 修改
MINOR: 功能新增，向后兼容
PATCH: Bug 修复，向后兼容
stage: alpha（开发中）/ beta（内测）/ rc（候选）

示例:
v0.1.0-alpha  ← 第一个可运行的骨架
v0.1.1-alpha  ← 骨架的 Bug 修复
v0.2.0-alpha  ← 新增世界引擎
v0.5.0-beta   ← 进入内测
v1.0.0        ← 正式发布
```

---

### 6.5 提交前 Hook 脚本

在 `package.json` 中配置：

```json
{
  "scripts": {
    "precommit": "npm run lint && npm run typecheck && npm run test:changed",
    "lint": "eslint src/ --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "test:changed": "vitest run --changed",
    "test": "vitest run"
  }
}
```

可选配置 Git pre-commit hook（使用 husky）：

```bash
# 安装 husky
npm install --save-dev husky
npx husky init

# 创建 pre-commit hook
echo 'npm run precommit' > .husky/pre-commit
```

---

## 第七章 问题排查指南

### 7.1 常见问题分类

```
问题来源树:
├── Claude 产出质量问题
│   ├── 代码编译不通过
│   ├── 测试不通过
│   ├── 偏离设计文档
│   ├── 遗漏约束条件
│   └── 重复/冗余代码
├── 集成问题
│   ├── 与已有代码不兼容
│   ├── 类型定义冲突
│   └── 模块循环依赖
├── 性能问题
│   ├── Session 中 Claude 响应变慢
│   ├── 上下文窗口耗尽
│   └── 代码生成质量下降
└── 环境问题
    ├── WSL/Node.js/数据库连接
    ├── Git 冲突
    └── 依赖版本问题
```

---

### 7.2 Claude 产出质量问题处理

#### 问题 1：代码编译不通过

**症状**：Claude 生成代码后，运行 `tsc --noEmit` 出现大量错误

**解决步骤**：
```
Step 1: 收集前 20 行错误信息（不要全部给 Claude）
        分类统计：类型错误 X 个，导入错误 Y 个，...

Step 2: 将错误信息粘贴给 Claude：
        "修复以下编译错误：
        [粘贴错误]

        相关代码：
        [粘贴相关文件]"

Step 3: Claude 修复后，重新编译

Step 4: 如果还有错误，重复 Step 2（通常 1-2 轮可解决）

Step 5: 如果超过 3 轮仍有大量错误：
        - 可能是设计方向问题
        - 重新加载上下文，重新开始
```

**预防**：
- 在 Prompt 中明确说明 TypeScript 严格模式配置
- 让 Claude 在生成代码前先列出类型依赖

#### 问题 2：测试不通过

**症状**：Claude 写的测试运行失败

**解决步骤**：
```
Step 1: 查看失败测试的具体错误

Step 2: 分类：
        A. 测试本身有 bug → 让 Claude 修复测试
        B. 被测代码有 bug → 让 Claude 修复代码
        C. mock 数据不匹配 → 更新 mock

Step 3: 将失败信息给 Claude：
        "以下测试失败：
        [粘贴失败信息]

        请修复。如果是被测代码的问题，修复代码；
        如果是测试的问题，修复测试。"

Step 4: 重新运行测试
```

#### 问题 3：偏离设计文档

**症状**：实现与设计文档中的架构/算法/接口不一致

**解决步骤**：
```
Step 1: 确认偏离点（对照设计文档的具体段落）

Step 2: 将设计文档的相关段落复制给 Claude：
        "根据设计文档 §X.Y 的要求：
        [粘贴相关段落]

        你当前的实现与此不符，请修改。"

Step 3: 如果 Claude 反复偏离：
        - 可能是设计文档太长导致上下文稀释
        - 只给 Claude 相关的 1-2 个段落
        - 明确说"严格按照以上要求实现"

Step 4: 如果仍然不行：
        - 可能是设计文档本身模糊
        - 自己明确接口签名，让 Claude 按签名实现
```

#### 问题 4：遗漏约束条件

**症状**：Claude 生成的代码违反了主权原则或其他约束

**解决步骤**：
```
Step 1: 指出具体的违规点（行号 + 问题）

Step 2: 重申约束：
        "注意约束：系统不能直接修改数据库，必须通过 Proposal 流程。
        你第 X 行直接调用了 db.update()，请修改。"

Step 3: 提供正确模式：
        "正确的做法是通过 ProposalService 创建提案：
        ```ts
        await proposalService.create({
          type: 'world_edit',
          payload: changes,
          requiresAuthorApproval: true
        });
        ```"
```

#### 问题 5：重复/冗余代码

**症状**：Claude 在不同地方生成了相似的代码

**解决步骤**：
```
Step 1: 让 Claude 自己识别重复：
        "请检查你刚才写的所有代码，是否有重复逻辑？
        如果有，提取为公共函数。"

Step 2: 如果 Claude 没发现，手动指出：
        "第 X 行的 validateInput 和第 Y 行的 checkInput
        功能相同，请提取到 shared/utils/validation.ts"

Step 3: 如果重复模式多：
        让 Claude 生成一个通用的基础类/工具函数
```

---

### 7.3 集成问题处理

#### 问题 1：与已有代码不兼容

**症状**：新代码与已有模块的类型/接口不匹配

**解决方案**：
```
Step 1: 明确已有接口定义
        "已有接口定义在 @src/shared/types.ts 第 X-Y 行：
        ```ts
        interface ExistingInterface { ... }
        ```

Step 2: 让 Claude 适配：
        "你的代码必须使用以上接口，请修改适配。"

Step 3: 如果确实需要修改已有接口：
        - 评估影响范围
        - 创建兼容层（adapter pattern）
        - 不要直接修改已有接口（除非确定无影响）
```

#### 问题 2：模块循环依赖

**症状**：TypeScript 编译报错 `Circular dependency detected`

**解决方案**：
```
Step 1: 运行依赖分析：
        npx madge --circular src/

Step 2: 确定循环路径：
        A.ts → B.ts → C.ts → A.ts

Step 3: 打破循环：
        方案 A：提取公共部分到 D.ts
        方案 B：使用接口隔离（A 依赖接口，B 实现接口）
        方案 C：使用依赖注入（不在文件顶部 import）

Step 4: 让 Claude 按选定方案重构
```

---

### 7.4 性能问题处理

#### 问题 1：Claude 响应变慢

**症状**：Claude 的回复越来越慢，或生成不完整

**原因和解决**：

| 原因 | 现象 | 解决 |
|------|------|------|
| 上下文窗口接近上限 | 回复被截断 | 新开 Session，重新加载精简上下文 |
| 对话轮次过多 | 第 15+ 轮后质量下降 | 控制在 10-15 轮内结束 Session |
| Prompt 太长 | 每次发送都要等很久 | 精简 Prompt，只给必要上下文 |
| 文件太大 | 引用超大文件 | 只引用文件的特定行范围 |

#### 问题 2：上下文窗口耗尽

**症状**：Claude 提示 "Context window exceeded" 或明显遗忘

**解决步骤**：
```
Step 1: 新开一个 Session

Step 2: 只加载常驻上下文（不加载模块文档）

Step 3: 用一句话重述当前进度：
        "我们正在实现世界引擎的因果推演器。
        核心算法已完成，正在处理边界条件测试。"

Step 4: 只给 Claude 当前需要的文件（1-2 个）

Step 5: 继续开发
```

#### 问题 3：代码生成质量下降

**症状**：Claude 在同一个 Session 后期的代码质量明显不如前期

**解决步骤**：
```
方案 A：提前结束 Session（推荐）
        - 提交当前进度
        - 新开 Session 继续

方案 B：重置上下文
        - "让我们重新开始这个话题"
        - 重新加载关键上下文

方案 C：切换任务类型
        - 从"写代码"切换到"审查代码"
        - 让 Claude 审查自己之前写的代码
```

---

### 7.5 环境问题处理

#### 问题 1：WSL 相关问题

| 问题 | 解决 |
|------|------|
| WSL 启动失败 | `wsl --shutdown` 然后重启 |
| 文件权限问题 | `chmod -R 755 ~/NarrativeOS` |
| Node.js 版本不对 | `nvm use 20` |
| 端口占用 | `lsof -i :3000` 然后 `kill -9 PID` |
| 内存不足 | `.wslconfig` 中增加 memory=8GB |

#### 问题 2：数据库连接问题

```bash
# 检查 PostgreSQL 状态
sudo service postgresql status

# 启动 PostgreSQL
sudo service postgresql start

# 检查数据库是否存在
psql -U postgres -l

# 检查表结构
psql -U postgres -d narrativeos -c "\dt"

# 检查连接池
psql -U postgres -d narrativeos -c "SELECT count(*) FROM pg_stat_activity;"
```

#### 问题 3：Git 冲突处理

```bash
# 1. 查看冲突文件
git status

# 2. 解决冲突（在 VSCode 中打开冲突文件，选择保留哪个版本）

# 3. 标记为已解决
git add <resolved-file>

# 4. 继续 rebase
git rebase --continue

# 5. 如果冲突太多，放弃 rebase
git rebase --abort
```

---

### 7.6 降级策略：何时切换人工编写

**以下情况，停止让 Claude 写代码，改为自己手动编写**：

| 情况 | 判断标准 | 原因 |
|------|----------|------|
| 同一问题修复 3 次仍未解决 | Claude 反复犯同样的错误 | Claude 陷入了错误的模式 |
| 涉及核心安全逻辑 | 认证/授权/主权检查 | 不能有风险 |
| 需要深度领域知识 | 网文创作领域的特殊逻辑 | Claude 可能不理解领域细节 |
| 性能关键路径 | 每毫秒都很重要 | Claude 倾向于可读性而非性能 |
| 架构决策点 | 影响多个模块的设计决策 | 需要全局视野 |
| Claude 严重偏离 | 完全误解了需求 | 继续让 Claude 写会浪费更多时间 |

**切换人工的流程**：
```
1. 评估：这个问题需要人工处理吗？（参考上表）
2. 记录：在代码中标记 TODO，说明需要人工审查的点
3. 手写：自己编写核心逻辑
4. 让 Claude 补充：写完核心逻辑后，让 Claude 补充：
   - 测试用例
   - JSDoc 注释
   - 错误处理边界
   - 代码审查
```

---

### 7.7 排查决策树

```
遇到问题
    │
    ├── 代码质量问题？
    │     │
    │     ├── 编译错误？ → 给 Claude 错误信息，让其修复（1-2 轮）
    │     │
    │     ├── 测试失败？ → 分析失败类型，给 Claude 具体指令
    │     │
    │     ├── 偏离设计？ → 重新加载设计文档，指出具体偏离
    │     │
    │     ├── 违反约束？ → 重申约束，给出正确模式示例
    │     │
    │     └── 质量下降？ → 检查对话轮次，可能需要新开 Session
    │
    ├── 集成问题？
    │     │
    │     ├── 类型冲突？ → 明确已有接口，让 Claude 适配
    │     │
    │     └── 循环依赖？ → 用 madge 分析，重构打破循环
    │
    ├── 性能问题？
    │     │
    │     ├── Claude 响应慢？ → 精简上下文，或减少对话轮次
    │     │
    │     └── 上下文耗尽？ → 新开 Session，精简加载
    │
    └── 环境问题？
          │
          ├── WSL？ → 重启 WSL / 检查配置
          │
          ├── 数据库？ → 检查服务状态 / 连接 / 权限
          │
          └── Git？ → 根据冲突情况解决
```

---

### 7.8 紧急回滚流程

当 Claude 的代码导致严重问题时：

```bash
# 方式 1：回滚到上一次提交（如果还没 commit）
git checkout -- .
git clean -fd

# 方式 2：回滚到上一个 commit（已 commit 但未 push）
git reset --hard HEAD~1

# 方式 3：回滚到指定 commit
git log --oneline -10  # 查看历史
git reset --hard <commit-hash>

# 方式 4：保留修改但撤销 commit
git reset --soft HEAD~1
```

---

## 附录 A：快速参考卡

### A.1 Session 启动清单（打印出来贴屏幕旁边）

```
□ 打开 VSCode + WSL
□ git status 干净
□ git pull origin main --rebase
□ 数据库运行中
□ 打开 Claude Code

□ 加载常驻上下文（5个文件）
□ 声明本次目标
□ 加载模块上下文
□ 加载已有代码

□ 开始开发！
```

### A.2 上下文加载速查表

| 开发什么 | 加载哪些文档 |
|----------|-------------|
| 世界引擎 | 常驻 5 文件 + chapter05_world_engine.md |
| 工作室引擎 | 常驻 5 文件 + chapter06_drama_engine.md |
| MOU 交互 | 常驻 5 文件 + chapter08_mou_interaction.md |
| 前端组件 | 常驻 5 文件 + ui_design_system.md + responsive_frontend_arch.md |
| 数据库 | 常驻 5 文件 + chapter04_database.md |
| 质量系统 | 常驻 5 文件 + chapter09_quality_system.md |
| LLM 层 | 常驻 5 文件 + chapter12_llm_integration.md |
| 初始化项目 | 常驻 5 文件 + chapter02_architecture.md |

### A.3 Git 速查

```bash
# 新功能
git checkout main && git pull
git checkout -b feature/xxx
git add . && git commit -m "feat(scope): description"
git push -u origin feature/xxx

# 同步 main
git fetch origin && git rebase origin/main

# 合并
git checkout main && git merge --no-ff feature/xxx
git push && git branch -d feature/xxx

# 回滚
git reset --hard HEAD~1

# Tag
git tag -a v0.1.0 -m "description"
git push origin v0.1.0
```

### A.4 验证命令速查

```bash
# 类型检查
npx tsc --noEmit

# Lint
npm run lint

# 单元测试
npx vitest run

# 带覆盖率
npx vitest run --coverage

# 只测修改的文件
npx vitest run --changed

# 测试特定文件
npx vitest run src/services/world/

# 数据库连接测试
psql -U postgres -d narrativeos -c "SELECT 1"

# 检查循环依赖
npx madge --circular src/

# 检查 any 类型
grep -rn ": any" src/ --include="*.ts" | grep -v test
```

### A.5 Prompt 模板索引

| 场景 | 模板 | 章节 |
|------|------|------|
| 新建模块 | 模板 A | 2.1 |
| 修改/修复 | 模板 B | 2.2 |
| 数据库变更 | 模板 C | 2.3 |
| 添加测试 | 模板 D | 2.4 |
| 重构优化 | 模板 E | 2.5 |
| 前端组件 | 模板 F | 2.6 |
| 调试排错 | 模板 G | 2.7 |

---

## 附录 B：项目文件结构参考

```
NarrativeOS/
├── apps/
│   ├── web/                          # React SPA 前端
│   │   ├── src/
│   │   │   ├── components/           # 通用组件
│   │   │   ├── pages/                # 页面级组件
│   │   │   ├── hooks/                # 自定义 hooks
│   │   │   ├── lib/                  # 工具函数
│   │   │   ├── stores/               # 状态管理
│   │   │   ├── types/                # 类型定义
│   │   │   └── styles/               # 全局样式
│   │   └── public/
│   │
│   └── server/                       # Node.js 后端
│       ├── src/
│       │   ├── orchestration/        # XState 状态机 (MOU)
│       │   ├── agents/               # Agent Shell 层
│       │   │   ├── WorldShell.ts
│       │   │   ├── StudioShell.ts
│       │   │   ├── CensorShell.ts
│       │   │   └── GuardShell.ts
│       │   ├── services/             # 服务层
│       │   │   ├── world/            # 世界引擎
│       │   │   │   ├── realm-system.service.ts
│       │   │   │   ├── causal-propagator.service.ts
│       │   │   │   ├── npc-behavior.service.ts
│       │   │   │   └── ...
│       │   │   ├── studio/           # 工作室引擎
│       │   │   │   ├── brief-generator.service.ts
│       │   │   │   ├── ama-distiller.service.ts
│       │   │   │   └── ...
│       │   │   ├── llm/              # LLM 调用层
│       │   │   ├── quality/          # 质量服务
│       │   │   └── shared/           # 公共工具
│       │   ├── db/                   # 数据库访问层
│       │   │   ├── schema.ts         # 类型定义
│       │   │   ├── migrations/       # Migration 脚本
│       │   │   └── repositories/     # Repository 层
│       │   ├── api/                  # REST API 路由
│       │   ├── middleware/           # 中间件
│       │   └── llm/                  # LLM 集成
│       └── tests/
│
├── packages/
│   ├── shared/                       # 共享类型和工具
│   └── config/                       # 共享配置
│
├── docs/                             # 设计文档
│   ├── extracts/                     # 常驻上下文提取
│   │   ├── architecture_brief.md
│   │   ├── sovereignty_brief.md
│   │   ├── database_core.md
│   │   └── interface_contracts.md
│   ├── project_conventions.md
│   ├── chapter02_architecture.md
│   ├── chapter04_database.md
│   ├── chapter05_world_engine.md
│   ├── chapter06_drama_engine.md
│   ├── chapter08_mou_interaction.md
│   └── ...
│
└── tests/                            # E2E 测试
```

---

> **文档结束**
>
> 本工作手册是活文档，随着项目进展和 Claude Code 能力的更新，应定期回顾和调整。
>
> 建议在项目里程碑（v0.1.0-alpha, v0.5.0-beta, v1.0.0）时全面回顾本手册的有效性。
