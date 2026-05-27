> [!NOTE] **本文档的前端/UI 章节已作废 · 其余章节仍可参考**
> 本作战手册含"驾驶舱 / 仪表盘 / 休眠舱"三模式前端实现描述、React 页面命名约定等内容，与新美学冲突。
> 2026-05-19 起，前端美学统一为"司天监位面"（深靛/朱砂/紫金 + 宋体 + 准/驳/议三联钤印 + 信息架构：小说宇宙 → 项目门厅 → 三堂 + 提案台 + 心法台），新设计真相源：`docs/imperial-design-system.md`。
> 本文档中**所有页面命名、组件路径、driver 模式描述不可作为前端开发锚点**。后端模块/数据库/MOU/谏官/Phase 排期等仍可作历史参考。
> 注：Phase 编号体系以 `docs/iterations/index.md` 为准（已扩展到 P0–P11 + G1–G5 + P0'–P11'）。

---

# NarrativeOS v3.0 Sovereign —— 开发作战手册

> **版本**: v1.0-IntegratedBattleManual  
> **适用范围**: 单人业余开发者 + Claude Code  
> **时间模型**: 工作日 3h/天 + 周末 8h/天 = 约 31h/周  
> **总工期估算**: 18-22 周（约 4.5-5.5 个月）  
> **设计文档基础**: 87,122 行，9 卷 25 章  

---

## 目录

- [序言：写给一个人、一台电脑、一个AI助手](#序言写给一个人一台电脑一个ai助手)
- [第一部分：开发路线图](#第一部分开发路线图)
  - [第1章 总体开发策略](#第1章-总体开发策略)
  - [第2章 模块依赖图](#第2章-模块依赖图)
  - [第3章 十二阶段路线图](#第3章-十二阶段路线图)
  - [第4章 Phase 0-5 详细任务清单](#第4章-phase-0-5-详细任务清单)
  - [第5章 Phase 6-11 详细任务清单](#第5章-phase-6-11-详细任务清单)
  - [第6章 弹性裁剪路线](#第6章-弹性裁剪路线)
  - [第7章 风险缓解策略](#第7章-风险缓解策略)
- [第二部分：Claude Code 协作手册](#第二部分claude-code-协作手册)
  - [第8章 上下文管理策略](#第8章-上下文管理策略)
  - [第9章 Claude Code Prompt模板库](#第9章-claude-code-prompt模板库)
  - [第10章 开发Session工作流](#第10章-开发session工作流)
  - [第11章 最佳实践](#第11章-最佳实践)
  - [第12章 代码审查清单](#第12章-代码审查清单)
  - [第13章 Git工作流与提交规范](#第13章-git工作流与提交规范)
  - [第14章 问题排查决策树](#第14章-问题排查决策树)
- [第三部分：测试与验收](#第三部分测试与验收)
  - [第15章 测试金字塔](#第15章-测试金字塔)
  - [第16章 分Phase测试策略](#第16章-分phase测试策略)
  - [第17章 测试基础设施](#第17章-测试基础设施)
  - [第18章 关键测试用例](#第18章-关键测试用例)
  - [第19章 自动化测试流水线](#第19章-自动化测试流水线)
  - [第20章 质量门禁](#第20章-质量门禁)
  - [第21章 手动测试清单](#第21章-手动测试清单)
  - [第22章 性能基准](#第22章-性能基准)
- [附录](#附录)
  - [附录 A. 每日晨间清单](#附录-a-每日晨间清单)
  - [附录 B. 每日晚间清单](#附录-b-每日晚间清单)
  - [附录 C. Claude Code Session启动模板](#附录-c-claude-code-session启动模板)
  - [附录 D. Git命令速查表](#附录-d-git命令速查表)
  - [附录 E. 测试命令速查表](#附录-e-测试命令速查表)
  - [附录 F. Prompt模板索引](#附录-f-prompt模板索引)

---

## 序言：写给一个人、一台电脑、一个AI助手

### 你是谁，你将面对什么

你是 NarrativeOS v3.0 Sovereign 的唯一开发者。你一个人，要设计、开发、测试、部署一个目标代码量 15-20 万行、支持 100 万字以上长篇网文创作的 AI 辅助写作系统。

你会面临以下挑战：

| 挑战 | 现实 |
|------|------|
| **规模** | 87,122 行设计文档，9 卷 25 章，50+ 张数据库表，8 个子引擎 |
| **复杂度** | XState v5 状态机、WebSocket 实时通信、LLM 集成、向量检索、战力计算 |
| **时间** | 工作日 3h + 周末 8h = 31h/周，共 18-22 周 |
| **资源** | 1 个人、1 台电脑、1 个 Claude Code 订阅 |
| **风险** | LLM API 成本、状态机复杂度、模块依赖循环、进度延迟 |

### 这份手册能帮你什么

这本手册是你 22 周开发的**唯一作战地图**。它整合了三个核心维度：

1. **开发路线图**（Part I）—— 何时做什么、做到什么程度算完成、每一步的验收标准
2. **Claude Code 协作手册**（Part II）—— 如何与一个 AI 结对编程，如何给它上下文、如何审查它的产出
3. **测试与验收**（Part III）—— 每个 Phase 的测试要求、自动化流水线、质量门禁

### 核心原则：小步快跑、快速验证、Mock先行

贯穿这本手册的三条铁律：

**铁律一：Mock 先行**
> 没有 LLM API，系统也能跑。没有数据库，前端也能渲染。Mock 是一切并行开发的基础。

**铁律二：垂直切片**
> 每个 Phase 交付一个完整可用的功能，不是"这周写完后端所有层，下周写前端"。

**铁律三：主权不可侵犯**
> 叙事裁决权不可转让。系统只能提案，不能替作者做决定。这条原则写入每一条代码的 DNA。

---



# 第一部分：开发路线图

## 第1章 总体开发策略

### 1.1 模块化并行策略

NarrativeOS v3.0 是一个大型系统（设计文档 87,122 行，预估代码量 15-20 万行），但**模块间存在明确的依赖边界**。对于单人开发，"并行"不是指同时写多个模块，而是指**每个模块可以被独立设计、独立测试、独立验证**，不需要等上游全部完成才能开始。

**可独立开发的模块（零外部依赖）**:

| 模块 | 独立原因 | 开发顺序建议 |
|------|----------|-------------|
| **数据库 Schema** | 零依赖，所有其他模块都依赖它 | **第 1 个做** |
| **配置/工具层** | 纯工具函数，零业务依赖 | 与 Schema 并行 |
| **LLM 客户端** | 仅依赖配置，可用 Mock 服务器 | 与 Schema 并行 |
| **类型定义/DTO** | 仅依赖数据库 Schema | Schema 完成后 |
| **前端组件库** | 可用 Storybook 独立开发 | Phase 6 开始 |

**Mock 驱动的并行开发链**:

```
Phase 1: 数据库 Schema ──────────────────────────────────────▶
              │                                               │
              ▼                                               ▼
Phase 2: 配置层 + LLM客户端(带Mock) ──────────────────────────▶
              │                                               │
              ▼                                               ▼
Phase 3: 世界引擎(硬编码规则) ──────▶ 可独立测试的完整引擎    │
              │                                               │
              ▼                                               ▼
Phase 4: 工作室引擎(接入LLM) ───────▶ 第一个端到端切片        │
              │                                               │
              ▼                                               ▼
Phase 5: 协调层+XState ────────────▶ MOU 完整闭环            │
              │                                               │
              ▼                                               ▼
Phase 6: 前端驾驶舱 ───────────────▶ 用户可交互的完整系统    │
```

### 1.2 数据库先行原则

**为什么数据库 Schema 是一切的基础？**

NarrativeOS 是一个**状态密集**的系统：世界状态、人物状态、章节状态、MOU 状态机上下文、谏官报告、历史版本——几乎所有操作都是围绕数据状态的读写转换。设计文档中定义了 50+ 张表、30+ 枚举类型、10+ 向量索引。先把 Schema 定下来，有三大好处：

1. **TypeScript 类型自动推导**: Prisma Client 自动生成类型定义，上层代码零类型维护成本
2. **接口契约前置**: 引擎间的数据交换格式由 Schema 定义，减少沟通成本（自己和 AI 的沟通成本）
3. **测试数据可复用**: Seed 数据一次编写，全生命周期复用（单元测试、集成测试、演示）

**数据库先行的执行策略**:

```
Week 1 目标: 完成 Prisma Schema 中所有表的定义

Day 1-2: 核心表（projects, novels, chapters, entities, relations）
Day 3-4: 世界引擎表（realm_systems, power_systems, events, ripples, foreshadowings）
Day 5-6: 工作室引擎表（briefs, content_revisions, ama_profiles, genre_kernels）
Day 7:   MOU/协调层表（mou_sessions, proposals, remonstrator_reports, flow_states）

→ 每个表定义后立即写对应的 seed 数据（3-5 条）
→ 每个表定义后立即写一个 CRUD 单元测试
```

### 1.3 假服务 (Mock) 策略

**核心原则: 没有 LLM API，前端和后端也能跑。**

这是单人开发最重要的策略。LLM API 调用有三大不确定性：成本、延迟、可用性。用 Mock 服务把这些不确定性隔离掉，可以确保开发不被阻塞。

**三层 Mock 架构**:

```
┌─────────────────────────────────────────────────────────┐
│                    LLM 调用接口 (统一)                      │
│              interface LLMClient {                        │
│                call(request: LLMRequest): Promise<LLMResponse>  │
│              }                                            │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐ ┌──────────┐ ┌──────────┐
   │ RealLLM │ │ MockLLM  │ │ CachedLLM│
   │ 真实API │ │ 假响应   │ │ 缓存层   │
   └─────────┘ └──────────┘ └──────────┘
```

**MockLLM 实现要点**:

| 调用点 | Mock 响应内容 | 用途 |
|--------|-------------|------|
| 可能性清单 | 预置 3-5 条 JSON 格式的假可能性 | 测试 MOU 循环 |
| Brief 生成 | 预置 Brief JSON（约 500 字段填充） | 测试 Brief 审批流 |
| 正文生成 | 返回一段固定文本（如《凡人修仙传》节选） | 测试内容展示 |
| 质量评分 | 返回固定分数 (0.7-0.9) + 假评语 | 测试谏官报告展示 |
| 战力检查 | 返回 "无异常" | 测试规则引擎通路 |

**Mock 切换配置**:

```typescript
// config/mock.config.ts
export const mockConfig = {
  // 全局 Mock 开关
  globalMock: process.env.USE_MOCK === 'true',
  
  // 按调用点精细控制
  mockPoints: {
    'world.possibilities': true,    // Mock 可能性清单
    'world.npc_intent': true,       // Mock NPC 意图
    'studio.brief': true,           // Mock Brief 生成
    'studio.content': true,         // Mock 正文生成
    'studio.quality_score': true,   // Mock 质量评分
    'counselor.power_check': false, // 规则引擎用真实计算
  },
  
  // Mock 响应延迟（模拟真实网络延迟）
  artificialDelay: 500, // ms
};
```

### 1.4 垂直切片策略

**水平分层 vs 垂直切片**:

```
❌ 错误：水平分层 —— "这周写完后端所有层，下周写前端"
   Phase 1: 数据库 ──→ Phase 2: 服务层 ──→ Phase 3: API层 ──→ Phase 4: 前端
   问题：前3周看不到任何东西在运行，容易失去信心

✅ 正确：垂直切片 —— "每个 Phase 交付一个完整可用的功能"
   Phase 3: 世界引擎MVP = 数据库存储 + 规则计算 + CLI调用 + 测试验证 ✓
   Phase 4: 工作室MVP = 数据库 + LLM调用 + Brief生成 + 审批流程 ✓
   Phase 5: MOU协调层 = XState + WebSocket + 完整闭环 ✓
   Phase 6: 前端MVP = React + WebSocket + 驾驶舱界面 ✓
```

**每个垂直切片的验收标准**:
1. 有一个可以运行的命令/页面
2. 有可以看到的输出（不是单元测试通过就算）
3. 有一个 "Hello World" 级别的用户交互

---


## 第2章 模块依赖图

### 2.1 完整依赖拓扑（文字描述）

```
═══════════════════════════════════════════════════════════════
                        依赖层级图（从底向上）
═══════════════════════════════════════════════════════════════

第 0 层 ———— 零依赖基础（最先构建）
├── data: Prisma Schema + 迁移 + Seed + 基础 CRUD
└── config: 环境变量 + 日志 + 错误定义 + 常量

第 1 层 ———— 工具与客户端（仅依赖第 0 层）
├── llm-client: LLM 调用封装 + Mock 实现 + Token 计数
└── utils: 字符串处理 + 日期 + ID 生成 + 验证

第 2 层 ———— 核心引擎（依赖第 0 + 1 层）
├── world-engine: 物理规则 + 战力计算 + 因果推演（硬编码）
│   ├── sub: 地理引擎 (GeoEng)
│   ├── sub: 势力引擎 (FrcEng)
│   ├── sub: 人物引擎 (ChrEng)
│   ├── sub: 事件引擎 (EvtEng)
│   ├── sub: 规则引擎 (RulEng)
│   ├── sub: 伏笔引擎 (FtnEng)
│   ├── sub: 时间引擎 (TmlEng)
│   └── sub: 知识引擎 (KnoEng)
└── studio-engine: Brief 生成 + 正文生成 + 修改系统
    ├── sub: 类型内核 (GenreKernel)
    ├── sub: AMA 风格蒸馏 (AMAStyle)
    ├── sub: 上下文组装 (ContextBuilder)
    └── sub: 读者知识图谱 (ReaderKG)

第 3 层 ———— 质量与守护（依赖第 2 层接口）
├── counselor: 谏官系统（20+ 检查项）
│   ├── sub: 战力检查 (C01)
│   ├── sub: 人设检查 (C02)
│   ├── sub: 伏笔追踪 (C03)
│   └── sub: ...（共 20 项）
└── flow-guardian: 心流监测 + 超时召回 + 状态分析

第 4 层 ———— 协调与编排（依赖第 2 + 3 层）
├── mou-orchestrator: XState v5 状态机
│   ├── mou.statemachine.ts (父状态机)
│   ├── oracle.statemachine.ts (Oracle 子状态机)
│   └── event.router.ts (事件路由器)
└── websocket: Socket.io 服务器 + 房间管理

第 5 层 ———— 接口层（依赖第 4 层）
├── api-rest: Fastify REST API
├── api-ws: WebSocket 消息协议实现
└── cli: Ink 终端 UI

第 6 层 ———— 前端（依赖第 5 层 WebSocket API）
└── web-frontend: React 19 + Tailwind + Zustand
    ├── pages: 驾驶舱 / 世界管理 / 章节编辑 / 谏官报告
    ├── components: 共享组件库
    └── hooks: WebSocket + API 调用

第 7 层 ———— 文档体系（依赖第 0 + 2 层）
├── doc-system: 四层文档（设定集 / 大纲 / 卷纲 / 章纲）
├── narrative-graph: 故事线 + 关系网可视化
└── revision-manager: Retcon 修订管理

第 8 层 ———— DevAgent（依赖所有以上 + 外部 Git）
└── devagent-cluster:
    ├── telemetry: 遥测探针
    ├── router: 分类路由
    ├── swarm: 智能体群
    ├── validation: 验证部署
    └── knowledge: 知识库

═══════════════════════════════════════════════════════════════
```

### 2.2 Mermaid 依赖图

```mermaid
graph TB
    subgraph L0["第0层: 零依赖基础"]
        DB["data: Prisma Schema"]
        CFG["config: 环境/日志/常量"]
    end

    subgraph L1["第1层: 工具与客户端"]
        LLM["llm-client: LLM调用"]
        UTIL["utils: 工具函数"]
    end

    subgraph L2["第2层: 核心引擎"]
        WE["world-engine: 世界引擎<br/>物理规则/战力/因果"]
        SE["studio-engine: 工作室引擎<br/>Brief/正文/风格"]
    end

    subgraph L3["第3层: 质量与守护"]
        CS["counselor: 谏官系统<br/>20+检查项"]
        FG["flow-guardian: 心流守护"]
    end

    subgraph L4["第4层: 协调编排"]
        MOU["mou-orchestrator: XState"]
        WS["websocket: Socket.io"]
    end

    subgraph L5["第5层: 接口层"]
        API["api-rest: Fastify"]
        CLI["cli: Ink 终端UI"]
    end

    subgraph L6["第6层: 前端"]
        FE["web-frontend: React"]
    end

    subgraph L7["第7层: 文档体系"]
        DOC["doc-system: 四层文档"]
        NAV["narrative-graph: 故事网"]
    end

    subgraph L8["第8层: DevAgent"]
        DA["devagent-cluster"]
    end

    DB --> LLM
    DB --> WE
    DB --> SE
    CFG --> LLM
    CFG --> WE
    CFG --> SE
    UTIL --> WE
    UTIL --> SE

    LLM --> SE
    WE --> CS
    SE --> CS
    WE --> FG
    SE --> FG

    WE --> MOU
    SE --> MOU
    CS --> MOU
    FG --> MOU

    MOU --> WS
    MOU --> API
    MOU --> CLI
    WS --> FE
    API --> FE

    WE --> DOC
    WE --> NAV
    DB --> DOC

    API --> DA
    WS --> DA
    DB --> DA
```

### 2.3 依赖矩阵速查表

| 模块 | 第 0 层 | 第 1 层 | 第 2 层 | 第 3 层 | 第 4 层 | 第 5 层 | 可 Mock 的依赖 |
|------|--------|--------|--------|--------|--------|--------|--------------|
| config | — | — | — | — | — | — | 无 |
| data | — | — | — | — | — | — | 无 |
| llm-client | 依赖 | — | — | — | — | — | 无（但可以全 Mock） |
| world-engine | 依赖 | 依赖 | — | — | — | — | LLM 调用 |
| studio-engine | 依赖 | 依赖 | — | — | — | — | LLM 调用 |
| counselor | 依赖 | 依赖 | 接口 | — | — | — | world/studio 结果 |
| flow-guardian | 依赖 | 依赖 | 接口 | — | — | — | world/studio 结果 |
| mou-orchestrator | 依赖 | 依赖 | 接口 | 接口 | — | — | 引擎执行结果 |
| websocket | 依赖 | — | — | — | 依赖 | — | 无 |
| api-rest | 依赖 | — | — | — | 依赖 | — | 无 |
| web-frontend | — | — | — | — | — | 依赖 | WebSocket 消息 |
| doc-system | 依赖 | — | 接口 | — | — | — | 引擎接口 |
| devagent-cluster | 依赖 | 依赖 | 接口 | 接口 | 接口 | 接口 | Git 操作 |

---


## 第3章 十二阶段路线图

### 3.1 时间线总览

```
周次:  W1   W2   W3   W4   W5   W6   W7   W8   W9   W10  W11  W12  W13  W14  W15  W16  W17  W18  W19  W20  W21  W22
      ├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
      │████│████│████│████│████│████│████│████│████│████│████│████│████│████│████│████│████│████│████│████│████│████│
      │ P0 │ P1 │ P2 │ P3 │ P3 │ P4 │ P4 │ P5 │ P5 │ P6 │ P6 │ P7 │ P7 │ P8 │ P8 │ P9 │ P9 │ P9 │ P10│ P10│ P11│ P11│
      │ Env│Data│Cfg+│World│ Eng│Stud│ Eng│ MOU│    │ Frn│    │ Cns│    │ Doc│    │ Dev│ Age│    │ UI │    │Pol │    │
      │Boot│Schm│LLM │ MVP│    │ MVP│    │  WS│    │ t  │    │ l+ │    │ Sys│    │ Age│ nt │    │ Des│    │ ish│    │
      │    │    │Ske│ (硬│    │(首接│    │XStt│    │ MVP│    │ Flw│    │    │    │ Cls│    │    │ ign│    │ +  │    │
      │    │    │ltn│编码)│    │ LLM)│    │ ate │    │    │    │ Gd │    │    │    │ ter│    │    │    │    │ E2E│    │
      ├────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┤
      │        核心引擎可运行 (10周)         │        完整系统可交互 (8周)        │        打磨上线 (4周)        │
      └────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 阶段速览表

| Phase | 名称 | 工期 | 人力 | 交付物 | 关键风险 |
|-------|------|------|------|--------|----------|
| P0 | 环境搭建 | 1 周 | 31h | 可运行的空壳项目 | WSL2/Node 环境问题 |
| P1 | 数据层骨架 | 1 周 | 31h | 完整 Schema + CRUD + Seed | Schema 设计返工 |
| P2 | 配置与工具链 | 1 周 | 31h | 配置系统 + Mock LLM + 测试框架 | 技术选型变更 |
| P3 | 世界引擎 MVP | 2 周 | 62h | 硬编码规则引擎 + 战力计算 | 规则复杂度失控 |
| P4 | 工作室引擎 MVP | 2 周 | 62h | Brief 生成 + 正文生成（首接 LLM） | LLM API 延迟/成本 |
| P5 | MOU 协调层 | 2 周 | 62h | XState + WebSocket + CLI | 状态机复杂度 |
| P6 | 前端 MVP | 2 周 | 62h | React 驾驶舱 + WS 连接 | 前端状态管理 |
| P7 | 谏官 + FlowGuardian | 2 周 | 62h | 20 项检查 + 心流监测 | 检查项数量爆炸 |
| P8 | 叙事系统 + 文档体系 | 2 周 | 62h | 故事网 + 四层文档 | 可视化复杂度 |
| P9 | DevAgent 集群 | 3 周 | 93h | 遥测 + 路由 + 智能体 + 验证 | 范围蔓延 |
| P10 | UI 设计体系 + 主题 | 2 周 | 62h | 设计系统 + 响应式 + 主题 | 设计细节耗 |
| P11 | 打磨 + 测试 + 部署 | 2 周 | 62h | E2E 测试 + Docker + CI | 测试覆盖不足 |

### 3.3 里程碑检查点

| 里程碑 | 时间 | 可演示内容 | 信心指标 |
|--------|------|----------|----------|
| **M1: 骨架立起** | Week 2 | `npm run test` 全绿，数据库连接成功 | 开发流程跑通 |
| **M2: 引擎觉醒** | Week 4 | `node cli.js world:calc-power` 输出战力值 | 核心算法验证 |
| **M3: 首次创作** | Week 6 | `node cli.js studio:brief` 生成一个 Brief | LLM 通路验证 |
| **M4: 完整闭环** | Week 8 | CLI 运行完整 MOU 循环：生成→审批→固化 | 系统协作验证 |
| **M5: 可视界面** | Week 10 | 浏览器打开驾驶舱，看到 Brief 生成过程 | 用户体验验证 |
| **M6: 质量守护** | Week 12 | 提交有问题的内容，看到谏官报告 | 质量系统验证 |
| **M7: 完整产品** | Week 16 | 从头到尾创建一个章节（有世界/有 Brief/有正文/有谏官） | 端到端验证 |
| **M8: 部署就绪** | Week 22 | `docker-compose up` 一键启动完整系统 | 生产就绪 |

---


## 第4章 Phase 0-5 详细任务清单

---

### Phase 0: 环境搭建（Week 1，31h）

**目标**: 从 0 到 `npm run dev` 能看到 "NarrativeOS Server Running"

**每日任务分配**:

| 天 | 任务 | 时长 | Claude Prompt 核心指令 |
|----|------|------|----------------------|
| D1 | 项目脚手架 + 目录结构 | 3h | "初始化 monorepo，pnpm workspace，创建 apps/server 和 apps/web 目录" |
| D2 | WSL2 + PostgreSQL 16 + pgvector | 3h | "写 docker-compose.yml 包含 postgres:16 带 pgvector，写启动/停止脚本" |
| D3 | TypeScript 配置 + ESLint + Prettier | 3h | "配置严格的 TypeScript，设置路径别名 @narrative-os/*，配置 ESLint 规则" |
| D4 | 测试框架（Vitest）+ 首个通过测试 | 3h | "配置 Vitest，写第一个测试 '1+1=2'，确保覆盖率报告可用" |
| D5 | CI/CD 骨架（GitHub Actions） | 3h | "写 GitHub Actions workflow：安装 → 检查 → 测试 → 构建" |
| D6 | 文档索引建立 | 3h | "创建 docs/index.md 索引所有设计文档，建立开发速查表" |
| D7 | 环境验证 + 查漏补缺 | 3h | 手动验证所有脚本都能运行 |

**需要创建的文件清单**:

```
NarrativeOS/
├── package.json                    # pnpm workspace 根配置
├── pnpm-workspace.yaml            # workspace 定义
├── tsconfig.json                   # 根 TypeScript 配置
├── .eslintrc.js                    # ESLint 规则
├── .prettierrc                     # 格式化配置
├── docker-compose.yml              # PG + Redis + MinIO
├── Makefile                        # 常用命令速查
├── .github/
│   └── workflows/
│       └── ci.yml                  # CI 流水线
├── apps/
│   ├── server/                     # 后端服务
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       └── index.ts           # 入口："Hello NarrativeOS"
│   └── web/                       # 前端
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── src/
│           └── main.tsx           # 入口："Hello NarrativeOS"
└── packages/
    ├── shared-types/              # 共享类型（空壳）
    │   ├── package.json
    │   └── src/
    │       └── index.ts
    └── config/                    # 共享配置
        └── package.json
```

**验收标准**:
- [ ] `make dev` 一键启动数据库 + 后端 + 前端
- [ ] `make test` 运行 Vitest，至少 1 个测试通过
- [ ] `make lint` ESLint 零报错
- [ ] `make build` 后端和前端都构建成功
- [ ] GitHub Actions 在 push 时自动跑通 CI
- [ ] 浏览器访问 `localhost:5173` 看到前端页面
- [ ] 浏览器访问 `localhost:3000/health` 看到健康检查响应

**并行任务**:
- 读设计文档第 2 章（架构）和第 4 章（数据库），提前理解 Schema
- 注册 LLM API 账号（DeepSeek/OpenAI），获取 API Key
- 安装 Claude Code CLI，熟悉命令

**风险提示**:
| 风险 | 概率 | 缓解措施 |
|------|------|----------|
| WSL2 文件系统性能差 | 中 | 项目放在 WSL 文件系统内（非 /mnt/c） |
| pnpm workspace 配置复杂 | 中 | 先用最简单的 2-package 结构验证 |
| pgvector Docker 镜像问题 | 低 | 用 `ankane/pgvector` 官方镜像 |
| Node 版本不兼容 | 低 | 用 nvm 锁定 Node 20 LTS |

---

### Phase 1: 数据层骨架（Week 2，31h）

**目标**: 完整 Prisma Schema，所有表可 CRUD，Seed 数据可运行

**核心策略**: 
- 按**模块边界**分组定义表，不是一次性定义所有
- 每个表定义后立即写 Seed 和测试
- 用 `prisma db push`（开发阶段不用 migrate，加减速率）

**Schema 分组计划**:

| 分组 | 表数量 | 天数 | 包含的核心表 |
|------|--------|------|------------|
| A: 核心 | 5 | D1 | projects, novels, chapters, users, settings |
| B: 世界 | 8 | D2-D3 | entities, relations, entity_attributes, events, realm_systems, power_systems, locations, factions |
| C: 工作室 | 6 | D4-D5 | briefs, content_revisions, ama_profiles, genre_kernels, style_snapshots, reader_knowledge |
| D: MOU/质量 | 6 | D6 | mou_sessions, proposals, remonstrator_reports, flow_states, counselor_checks, oracle_records |
| E: 系统 | 4 | D7 | embeddings, audit_logs, snapshots, system_configs |

**需要创建的文件**:

```
packages/
├── database/
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma          # 主 Schema 文件（最终约 3000-5000 行）
│   │   ├── schema/
│   │   │   ├── core.prisma       # 分组 A: 核心表
│   │   │   ├── world.prisma      # 分组 B: 世界引擎表
│   │   │   ├── studio.prisma     # 分组 C: 工作室引擎表
│   │   │   ├── mou.prisma        # 分组 D: MOU/质量表
│   │   │   └── system.prisma     # 分组 E: 系统表
│   │   ├── seed.ts               # 种子数据脚本
│   │   └── seed/
│   │       ├── core.seed.ts
│   │       ├── world.seed.ts
│   │       ├── studio.seed.ts
│   │       └── mou.seed.ts
│   └── src/
│       ├── client.ts             # Prisma Client 单例导出
│       ├── repositories/         # 按模块的 Repository 层
│       │   ├── core.repo.ts
│       │   ├── world.repo.ts
│       │   ├── studio.repo.ts
│       │   └── mou.repo.ts
│       └── index.ts
```

**Claude Code Prompt 模板（可直接复制粘贴）**:

```
# Prompt P1-A: 定义核心 Schema

请根据设计文档 chapter04_database.md 的第 4.2 节（类型系统定义）和 4.3 节（核心表定义），
在 packages/database/prisma/schema/core.prisma 中定义以下表的完整 Prisma Schema：

1. Project（项目）- 对应 novels 表
2. Novel（作品）
3. Chapter（章节）
4. Entity（实体）- 人物/组织/地点/物品等
5. Relation（关系）- 实体间关系

要求：
- 使用设计文档中定义的枚举类型（project_status, entity_type, entity_status, relation_type, chapter_status 等）
- 添加 @map 映射到 snake_case 的字段名
- 添加适当的索引（@@index）
- 添加注释（///）
- 每个表至少要有 created_at 和 updated_at
- 定义表之间的 @relation 关系

完成后，运行 npx prisma validate 验证 Schema 语法正确。
```

**验收标准**:
- [ ] `npx prisma validate` 零报错
- [ ] `npx prisma db push` 成功创建所有表
- [ ] `npx tsx prisma/seed.ts` 成功插入所有种子数据
- [ ] `npx prisma studio` 能打开 GUI 看到数据
- [ ] Repository 层每个表有至少 1 个 CRUD 测试通过
- [ ] 总测试数 >= 30（平均每表至少 1 个）

**并行任务**:
- Phase 1 第 3-4 天可以启动 Phase 2 的配置系统设计（零依赖）
- 阅读设计文档第 5 章（世界引擎），准备 Phase 3

**风险提示**:
| 风险 | 概率 | 缓解 |
|------|------|------|
| Schema 字段遗漏 | 高 | 先在 core.prisma 验证模式，确认后再复制到分组文件 |
| 关系定义循环引用 | 中 | 用 `prisma validate` 立即验证 |
| Seed 数据外键顺序 | 中 | Seed 脚本按拓扑排序插入 |

---

### Phase 2: 配置与工具链（Week 3，31h）

**目标**: 完整的配置系统 + Mock LLM 客户端 + 可运行的测试框架

**任务分配**:

| 天 | 任务 | 时长 | 关键输出 |
|----|------|------|---------|
| D1 | 环境变量 + Zod 验证 | 3h | `packages/config/src/env.ts` —— 类型安全的环境变量 |
| D2 | 日志系统（Pino） | 3h | `packages/logger/src/index.ts` —— 结构化日志 |
| D3 | 错误处理体系 | 3h | `packages/errors/src/` —— 业务错误码 + 错误类 |
| D4 | LLM 客户端骨架 | 3h | `packages/llm/src/client.ts` —— 统一调用接口 |
| D5 | Mock LLM 实现 | 3h | `packages/llm/src/mock-provider.ts` —— 假响应 |
| D6 | Token 计数 + 成本计算 | 3h | `packages/llm/src/tokenizer.ts` —— 预算控制 |
| D7 | 集成测试 + 联调 | 3h | 验证 Mock LLM 返回正确结构 |

**需要创建的文件**:

```
packages/
├── config/
│   ├── src/
│   │   ├── env.ts                # Zod schema 验证环境变量
│   │   ├── app.config.ts         # 应用配置（端口/超时/阈值）
│   │   ├── llm.config.ts         # LLM 模型配置（温度/模型选择）
│   │   └── index.ts
│   └── test/env.test.ts
├── logger/
│   ├── src/
│   │   ├── index.ts              # Pino 日志实例
│   │   ├── serializers.ts        # 敏感字段脱敏
│   │   └── context.ts            # 请求上下文日志（requestId）
│   └── test/logger.test.ts
├── errors/
│   ├── src/
│   │   ├── codes.ts              # 错误码枚举（NOS-001 ~ NOS-999）
│   │   ├── base-error.ts         # NarrativeOSError 基类
│   │   ├── domain-errors.ts      # 领域错误（WorldError, StudioError...）
│   │   └── http-mapper.ts        # 错误→HTTP状态码映射
│   └── test/errors.test.ts
└── llm/
    ├── src/
    │   ├── types.ts                # LLMRequest, LLMResponse 类型
    │   ├── client.ts               # 统一客户端（工厂模式）
    │   ├── providers/
    │   │   ├── base.ts             # 提供商基类
    │   │   ├── deepseek.ts         # DeepSeek 适配
    │   │   ├── openai.ts           # OpenAI 适配
    │   │   └── mock.ts             # Mock 提供商 ★关键
    │   ├── router.ts               # 模型路由（Heavy/Light 选择）
    │   ├── tokenizer.ts            # Token 计数（tiktoken）
    │   ├── cost-tracker.ts         # 成本追踪
    │   └── cache.ts                # 响应缓存
    └── test/llm.test.ts
```

**Mock LLM 关键实现**:

```typescript
// packages/llm/src/providers/mock.ts
// 这是 Phase 2 最重要的文件——它让后续所有开发不依赖真实 API

const MOCK_RESPONSES: Record<string, MockResponse> = {
  'studio.brief': {
    delay: 800,
    response: {
      content: JSON.stringify({
        direction: '主角在藏经阁发现上古功法残卷',
        plotPoints: [
          { id: 'pp1', description: '发现残卷的契机', type: 'trigger' },
          { id: 'pp2', description: '解读过程中的困难', type: 'conflict' },
          { id: 'pp3', description: '功法与现有体系的冲突', type: 'twist' },
        ],
        characterArcs: [
          { characterId: 'char_001', arc: '好奇心→谨慎→兴奋' },
        ],
        pacing: 'medium',
        mood: '神秘、紧张',
      }),
    },
  },
  'studio.content': {
    delay: 1500,
    response: {
      content: '藏经阁深处，尘封的檀木书架间弥漫着\n淡淡的霉味与檀香混合的气息...（约 2000 字）',
    },
  },
  'world.possibilities': {
    delay: 600,
    response: {
      content: JSON.stringify([
        { id: 'p1', title: '功法传承线', summary: '残卷指向一处上古遗迹', confidence: 0.85 },
        { id: 'p2', title: '阴谋线', summary: '残卷是敌人设下的陷阱', confidence: 0.6 },
        { id: 'p3', title: '内心挣扎线', summary: '功法需要付出道德代价', confidence: 0.7 },
      ]),
    },
  },
  // ... 其他调用点的 Mock 响应
};
```

**验收标准**:
- [ ] `LLMClient.call()` 能切换 Real/Mock 模式
- [ ] Mock 模式下所有调用点返回有效 JSON
- [ ] Token 计数误差 < 5%
- [ ] 成本追踪器能计算单次调用成本
- [ ] 日志包含 requestId，可追溯完整调用链
- [ ] 环境变量验证失败时给出清晰的错误消息

**并行任务**:
- 与 Phase 1 并行（D3-D4 之后）
- 可提前阅读设计文档第 6 章（工作室引擎）和第 12 章（LLM 集成）

---

### Phase 3: 世界引擎 MVP（Week 4-5，62h）

**目标**: 不调用 LLM，纯硬编码规则的世界引擎——能计算战力、验证规则、推演因果

**为什么先硬编码？**
1. 规则引擎的核心是**数据结构和计算逻辑**，不是 LLM
2. 硬编码规则 = 即时响应、零成本、可测试
3. LLM 增强层后续可以无缝叠加（插件架构）

**两週任务分解**:

**Week 4: 物理规则 + 战力系统**

| 天 | 任务 | 输出文件 |
|----|------|---------|
| D1 | RealmSystem 类型定义 + 数据 | `world-engine/src/types/realm.ts` |
| D2 | 战力计算公式实现 | `world-engine/src/combat/power-calc.ts` |
| D3 | 装备/Buff/Debuff 系统 | `world-engine/src/combat/equipment.ts` |
| D4 | 境界突破验证 | `world-engine/src/combat/breakthrough.ts` |
| D5 | 规则引擎（动作合法性检查） | `world-engine/src/rules/action-validator.ts` |
| D6 | 特殊能力管理器 | `world-engine/src/rules/ability-manager.ts` |
| D7 | 周总结 + 集成测试 | `world-engine/test/week4-integration.test.ts` |

**Week 5: 因果推演 + 代价计算 + 集成**

| 天 | 任务 | 输出文件 |
|----|------|---------|
| D1 | 事件引擎（事件创建/查询/链） | `world-engine/src/causality/event-engine.ts` |
| D2 | 因果链构建 | `world-engine/src/causality/chain-builder.ts` |
| D3 | 涟漪计算（影响扩散） | `world-engine/src/causality/ripple-calculator.ts` |
| D4 | 代价计算器 | `world-engine/src/causality/cost-calculator.ts` |
| D5 | 伏笔引擎（埋设/回收/追踪） | `world-engine/src/foreshadowing/tracker.ts` |
| D6 | 世界引擎 Shell（Agent 包装） | `world-engine/src/shell/world-shell.ts` |
| D7 | 完整集成测试 | `world-engine/test/full-engine.test.ts` |

**需要创建的文件**:

```
packages/world-engine/
├── src/
│   ├── types/
│   │   ├── realm.ts              # 境界体系类型
│   │   ├── combat.ts             # 战斗/战力类型
│   │   ├── event.ts              # 事件类型
│   │   └── world-state.ts        # 世界状态快照类型
│   ├── combat/
│   │   ├── power-calc.ts         # ★战力计算（核心公式）
│   │   ├── stat-vector.ts        # 六维属性向量
│   │   ├── equipment.ts          # 装备加成计算
│   │   ├── status-effects.ts     # Buff/Debuff 系统
│   │   └── breakthrough.ts       # 境界突破验证
│   ├── rules/
│   │   ├── action-validator.ts   # 动作合法性检查
│   │   ├── ability-manager.ts    # 特殊能力管理
│   │   ├── physics-engine.ts     # 物理规则应用
│   │   └── realm-rules.ts        # 境界限制规则
│   ├── causality/
│   │   ├── event-engine.ts       # 事件 CRUD
│   │   ├── chain-builder.ts      # 因果链构建
│   │   ├── ripple-calculator.ts  # ★涟漪扩散计算
│   │   └── cost-calculator.ts    # ★代价计算器
│   ├── foreshadowing/
│   │   ├── tracker.ts            # 伏笔埋设/回收追踪
│   │   └── analyzer.ts           # 伏笔密度分析
│   ├── knowledge/
│   │   ├── info-graph.ts         # 信息传播图
│   │   └── propagation.ts        # 信息扩散模拟
│   ├── shell/
│   │   └── world-shell.ts        # ★Agent Shell（对外接口）
│   └── index.ts
├── test/
│   ├── combat/
│   │   ├── power-calc.test.ts    # 战力计算测试（核心）
│   │   └── breakthrough.test.ts  # 突破验证测试
│   ├── causality/
│   │   └── ripple.test.ts        # 涟漪计算测试
│   └── integration/
│       └── full-flow.test.ts     # 完整流程测试
└── data/
    └── default-realm-system.json   # 默认修真体系数据
```

**战力计算核心公式实现**（Phase 3 最关键代码）:

```typescript
// packages/world-engine/src/combat/power-calc.ts
// 实现设计文档 5.1.2.2 节的完整战力计算公式

export interface StatVector {
  atk: number;    // 攻击力
  def: number;    // 防御力
  spd: number;    // 速度
  spi: number;    // 精神力/法力
  tech: number;   // 技巧
  luck: number;   // 运气
}

export interface CombatPowerResult {
  dimensionVector: StatVector;
  totalCP: number;           // 综合战力
  powerTier: PowerTier;      // 战力分级
  realmMultiplier: number;   // 境界倍率
}

export function calculateCombatPower(
  baseStats: StatVector,
  realm: RealmTier,
  equipment: Equipment[] = [],
  buffs: Buff[] = [],
  debuffs: Debuff[] = [],
  specialAbilities: SpecialAbility[] = []
): CombatPowerResult {
  // Step 1: 基础属性 × 境界加成
  // Step 2: 装备加成（加算后乘算）
  // Step 3: Buff/Debuff 修正
  // Step 4: 特殊能力被动加成
  // Step 5: 综合战力合成（六维加权）
  // Step 6: 战力分级
}
```

**验收标准**:
- [ ] 战力计算测试覆盖：同境界对战、越级挑战、装备加成、Buff叠加
- [ ] 境界突破验证：满足条件可突破、不满足条件拒绝
- [ ] 因果链测试：A→B→C 的三级因果链正确追踪
- [ ] 涟漪计算：一个事件影响 3-5 个相关实体
- [ ] 伏笔追踪：埋设→回收→超时未回收预警
- [ ] CLI 命令 `world:calc-power` 能输出战力值（可视化验证）
- [ ] 测试覆盖率 > 80%

**Claude Prompt 模板（战力计算）**:

```
# Prompt P3-A: 实现战力计算系统

请根据设计文档 chapter05_world_engine.md 第 5.1.2 节（战力计算公式体系），
在 packages/world-engine/src/combat/power-calc.ts 中实现完整的战力计算系统。

要求：
1. 实现六维属性向量 StatVector（atk, def, spd, spi, tech, luck）
2. 实现 calculateCombatPower 函数，包含完整的 6 个步骤
3. 权重配置从外部读取（packages/config/src/app.config.ts 中添加 combatPowerWeights）
4. 境界倍率使用 default-realm-system.json 中的数据
5. 实现战力分级 classifyPowerTier 函数
6. 写出完整的单元测试，覆盖以下场景：
   - 练气期角色基础战力计算
   - 金丹期 vs 元婴期的战力差距
   - 装备加成后的战力变化
   - Buff叠加（同类型加算，不同类型乘算）
   - 越级挑战的战力比阈值检测

注意：
- 使用纯数学计算，不调用 LLM
- 所有数值精度用 number 类型
- 添加详细的 JSDoc 注释
- 参考设计文档中的境界倍率表

完成后运行测试：cd packages/world-engine && npx vitest run
```

**风险提示**:
| 风险 | 概率 | 缓解 |
|------|------|------|
| 战力公式平衡性 | 高 | 先用默认值，后续通过配置调整 |
| 因果链循环引用 | 中 | 实现环形检测，最大深度限制 |
| 涟漪计算性能 | 中 | 实现缓存，最大扩散深度 5 层 |

---

### Phase 4: 工作室引擎 MVP（Week 6-7，62h）

**目标**: 第一个接入 LLM 的功能——能生成 Brief、能生成正文、能评分

**这是整个项目最重要的 Phase**，因为：
1. 首次接入真实 LLM API，验证成本/延迟/质量
2. 五层 Prompt 组装是系统的核心技术
3. Brief→正文→修改的流水线是作者的核心工作流

**两周任务分解**:

**Week 6: Brief 生成 + 上下文组装**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | GenreKernel（类型内核加载） | `studio-engine/src/genre/kernel-loader.ts` |
| D2 | AMAProfile 骨架 | `studio-engine/src/ama/profile.ts` |
| D3 | 上下文检索（pgvector） | `studio-engine/src/context/retriever.ts` |
| D4 | 五层 Prompt 组装器 | `studio-engine/src/prompt/builder.ts` ★核心 |
| D5 | Brief 生成器（首次 LLM 调用） | `studio-engine/src/brief/generator.ts` ★核心 |
| D6 | Brief 解析与验证 | `studio-engine/src/brief/parser.ts` |
| D7 | Brief 生成测试 + 调优 | 至少 3 个真实 Brief 输出 |

**Week 7: 正文生成 + 修改系统**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | 正文生成器 | `studio-engine/src/content/generator.ts` ★核心 |
| D2 | 输出解析与格式验证 | `studio-engine/src/content/parser.ts` |
| D3 | 质量评分（3 维度） | `studio-engine/src/quality/scorer.ts` |
| D4 | 修改策略选择器 | `studio-engine/src/revision/strategy.ts` |
| D5 | 局部补丁/全文重写 | `studio-engine/src/revision/patcher.ts` |
| D6 | 工作室 Shell | `studio-engine/src/shell/studio-shell.ts` |
| D7 | 端到端测试（Brief→正文→修改） | `studio-engine/test/e2e.test.ts` |

**五层 Prompt 组装器**（Phase 4 最关键的实现）:

```typescript
// studio-engine/src/prompt/builder.ts
// 实现设计文档 6.3 节的五层 Prompt 结构

export interface FiveLayerPrompt {
  layer1_genreKernel: string;      // 类型内核（节奏/爽点/禁忌）
  layer2_amaStyle: string;         // 作者风格（词汇/句式/修辞）
  layer3_worldState: string;       // 世界状态（人物/地点/势力）
  layer4_context: string;          // 上下文（前文摘要/相关设定）
  layer5_brief: string;            // 创作指令（Brief 具体指示）
}

export class PromptBuilder {
  async build(request: GenerationRequest): Promise<FiveLayerPrompt> {
    // L1: 加载类型内核
    // L2: 加载 AMA 风格配置（或默认）
    // L3: 从数据库序列化世界状态
    // L4: pgvector 检索相关上下文
    // L5: 格式化 Brief 为指令
    // 返回五层结构（后续组装为 LLM 输入）
  }
}
```

**验收标准**:
- [ ] Mock 模式下 Brief 生成 < 100ms，真实 LLM 下 < 5s
- [ ] Brief 输出包含：direction, plotPoints(>=3), characterArcs, pacing, mood
- [ ] 正文生成单次调用，输出 >= 2000 字
- [ ] 质量评分 3 维度（文学性/一致性/节奏）分数在 0-1 范围
- [ ] 修改指令支持：局部替换、全文重写、风格调整
- [ ] 五层 Prompt 总 Token 数 < 6000（控制在成本范围内）
- [ ] 端到端测试：Mock 模式完整流程通过

**Claude Prompt 模板（五层 Prompt 组装器）**:

```
# Prompt P4-A: 实现五层 Prompt 组装器

请根据设计文档 chapter06_drama_engine.md 第 6.3-6.4 节（上下文组装与生成），
在 packages/studio-engine/src/prompt/builder.ts 中实现五层 Prompt 组装器。

核心要求：
1. 定义 FiveLayerPrompt 接口（5 层结构）
2. 实现 PromptBuilder 类，包含 build() 方法
3. 第 1 层：从 genre-kernels/ 目录加载对应类型的内核配置
4. 第 2 层：从数据库加载 AMAProfile（如果存在，否则用默认）
5. 第 3 层：从 world-engine 获取当前世界状态序列化（用 WorldShell.queryState）
6. 第 4 层：用 pgvector 检索相关上下文（使用 packages/database 的 embeddings 表）
7. 第 5 层：将 Brief 格式化为创作指令
8. 添加 assemble() 方法，将五层组装为最终字符串（带分隔标记）
9. 添加 tokenCount 估算（调用 packages/llm 的 tokenizer）

输入类型：
interface GenerationRequest {
  novelId: string;
  chapterId: string;
  genre: string;           // 'xuanhuan' | 'wuxia' | 'xianxia' | ...
  briefId: string;
  maxContextTokens: number; // 默认 6000
}

先写类型定义，再写实现，最后写单元测试。
测试覆盖：
- 各层是否正确加载
- Token 预算超限时是否截断第 4 层（上下文层）
- 组装后的字符串包含所有五层标记
```

**成本验证（Week 6 必须完成）**:

在第一次真实 LLM 调用前，计算理论成本：

```
假设使用 DeepSeek-V3:
- Brief 生成: ~4000 input + ~800 output tokens × 1次 = ~￥0.02
- 正文生成: ~5000 input + ~2000 output tokens × 1次 = ~￥0.05
- 质量评分: ~3000 input + ~200 output tokens × 3次 = ~￥0.015
- 每章总计: ~￥0.085

验证: 生成 1 个 Brief + 1 章正文，对比实际账单与预估
```

**风险提示**:
| 风险 | 概率 | 缓解 |
|------|------|------|
| LLM 输出格式不稳定 | 高 | Zod schema 验证 + 重试机制（最多 3 次） |
| Prompt 过长超 Token 限制 | 高 | 第 4 层（上下文）可动态截断 |
| 生成质量不达预期 | 中 | 先用 Mock 验证流程，再用真实 API 调优 |
| API 延迟 > 10s | 中 | 流式输出 + 超时降级 |
| API 成本超预期 | 低 | 先用 DeepSeek（成本最低），设置每日预算上限 |

---

### Phase 5: MOU 协调层（Week 8-9，62h）

**目标**: XState v5 状态机 + WebSocket + CLI 交互 = 完整 MOU 闭环

**核心交付**: 一个可以在终端运行的完整创作循环

```
作者输入 → 生成可能性 → 等待选择 → 生成 Brief → 等待审批 → 生成正文 → 等待终审 → 固化提交
```

**Week 8: XState 状态机**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | MouContext 类型 + 初始状态 | `mou-orchestrator/src/types/context.ts` |
| D2 | 父状态机（主循环） | `mou-orchestrator/src/machines/mou.machine.ts` ★核心 |
| D3 | Oracle 子状态机 | `mou-orchestrator/src/machines/oracle.machine.ts` |
| D4 | 事件路由器 | `mou-orchestrator/src/router.ts` |
| D5 | 人类事件处理器 | `mou-orchestrator/src/human-events.ts` |
| D6 | 引擎调用编排 | `mou-orchestrator/src/engine-calls.ts` |
| D7 | 状态机单元测试 | 覆盖所有状态转移路径 |

**Week 9: WebSocket + CLI**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | Socket.io 服务器 | `apps/server/src/websocket/server.ts` |
| D2 | 房间管理（每novel一个房间） | `apps/server/src/websocket/rooms.ts` |
| D3 | WebSocket 消息协议 | `apps/server/src/websocket/protocol.ts` |
| D4 | Ink CLI 界面 | `apps/cli/src/app.tsx` ★核心 |
| D5 | CLI 交互组件（选择/审批/终审） | `apps/cli/src/components/` |
| D6 | CLI 与 WebSocket 连接 | `apps/cli/src/hooks/use-websocket.ts` |
| D7 | 端到端测试：CLI 完成一个 MOU 循环 | 手动演示 |

**XState 状态机核心结构**（设计文档第 8 章）:

```typescript
// mou-orchestrator/src/machines/mou.machine.ts
// 实现设计文档 8.3 节的完整状态机

export const mouMachine = setup({
  types: {
    context: {} as MouContext,
    events: {} as MouEvent | HumanEvent,
  },
  actions: {
    // 世界引擎调用
    generatePossibilities: assign(/* ... */),
    generateBrief: assign(/* ... */),
    // 工作室引擎调用
    generateContent: assign(/* ... */),
    // 谏官调用
    runCounselor: assign(/* ... */),
    // 固化
    commitWorldState: assign(/* ... */),
  },
  guards: {
    canUseOracle: ({ context }) => !context.oracleCooldown,
    needsRevision: ({ context }) => context.reviseCount < 3,
  },
}).createMachine({
  id: 'mou',
  initial: 'idle',
  states: {
    idle: {
      on: { AUTHOR_CONTINUE: 'generating_possibilities' },
    },
    generating_possibilities: {
      entry: 'generatePossibilities',
      on: { COMPLETE: 'waiting_author_choice' },
    },
    waiting_author_choice: {
      // 严格阻塞态：等待人类输入
      on: {
        AUTHOR_CHOOSE: 'generating_brief',
        AUTHOR_RETRY: 'generating_possibilities',
        ORACLE_REQUEST: { target: '.oracle_flow', guard: 'canUseOracle' },
      },
    },
    generating_brief: {
      entry: 'generateBrief',
      on: { COMPLETE: 'waiting_brief_approval' },
    },
    waiting_brief_approval: {
      on: {
        AUTHOR_APPROVE: 'generating_content',
        AUTHOR_MODIFY: { target: 'generating_brief', actions: 'applyModification' },
        AUTHOR_REJECT: 'generating_possibilities',
      },
    },
    generating_content: {
      entry: 'generateContent',
      on: { COMPLETE: 'waiting_final_review' },
    },
    waiting_final_review: {
      on: {
        AUTHOR_APPROVE: 'committing',
        AUTHOR_MODIFY: 'revising_content',
        AUTHOR_RETRY: 'generating_content',
      },
    },
    revising_content: {
      entry: 'generateRevision',
      on: { COMPLETE: 'waiting_final_review' },
      guard: 'needsRevision',
    },
    committing: {
      entry: ['commitWorldState', 'updateStatistics'],
      always: 'idle',
    },
  },
});
```

**验收标准**:
- [ ] 状态机覆盖所有设计文档 8.3 节定义的状态
- [ ] 每个 `waiting_*` 状态严格阻塞，不自动推进
- [ ] 人类事件能正确触发状态转移
- [ ] Oracle 子流程正确嵌入（条件触发、代价计算、混沌种子）
- [ ] WebSocket 消息格式符合协议定义
- [ ] CLI 能展示当前状态、接收输入、发送事件
- [ ] 完整 MOU 循环（idle → idle）能在 < 30s 内完成（Mock 模式）

**Claude Prompt 模板（XState 状态机）**:

```
# Prompt P5-A: 实现 MOU 主状态机

请根据设计文档 chapter08_mou_interaction.md 第 3 节（XState v5 状态机完整配置），
在 packages/mou-orchestrator/src/machines/mou.machine.ts 中实现完整的 MOU 状态机。

要求：
1. 使用 XState v5 的 setup() + createMachine() API
2. 实现 MouContext 接口（设计文档 3.1 节定义的所有字段）
3. 实现所有父状态机状态：
   - idle（初始状态）
   - generating_possibilities
   - waiting_author_choice（含 oracle_flow 子入口）
   - generating_brief
   - waiting_brief_approval
   - generating_content
   - waiting_final_review（含 oracle_flow 子入口）
   - revising_content（可循环到 generating_content）
   - committing
4. 每个 waiting_* 状态必须严格阻塞等待明确的人类事件
5. 实现所有 guard 条件（canUseOracle, needsRevision, isFlowHealthy）
6. 使用 assign() 更新 context，不使用副作用
7. 写单元测试覆盖：
   - 正常流程：idle → possibilities → brief → content → commit → idle
   - Brief 被拒：回退到 possibilities
   - 终审修改：不超过 3 次
   - Oracle 触发条件

参考 XState v5 文档：https://stately.ai/docs/xstate-v5
```

**风险提示**:
| 风险 | 概率 | 缓解 |
|------|------|------|
| XState v5 学习曲线 | 高 | 先用简单状态机练手，再迁移到完整配置 |
| 状态机过于复杂 | 中 | 先用简化版（去掉 Oracle 子流程），验证后再加 |
| WebSocket 房间管理 | 中 | 每个 novel 一个 room，用 novelId 命名 |
| CLI 界面复杂度 | 中 | 先用最简单的文本界面，再加 Ink 美化 |

---


## 第5章 Phase 6-11 详细任务清单

---

### Phase 6: 前端 MVP（Week 10-11，62h）

**目标**: React 驾驶舱核心页面 + WebSocket 连接 + 可交互的 MOU 流程

**设计决策**:
- 状态管理: Zustand（简单、无样板代码）
- 数据获取: 直接 WebSocket（不用 TanStack Query，因为主要通信是 WS）
- UI 组件: Radix UI Primitives + Tailwind（不引入重型组件库）
- 图表: D3.js（故事网需要自定义力导向图）

**Week 10: 项目骨架 + 驾驶舱**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | Zustand Store 设计 | `apps/web/src/stores/` |
| D2 | WebSocket Hook | `apps/web/src/hooks/use-mou.ts` |
| D3 | 布局组件（侧边栏/主区域） | `apps/web/src/components/layout/` |
| D4 | 驾驶舱首页 | `apps/web/src/pages/dashboard.tsx` |
| D5 | 可能性选择面板 | `apps/web/src/pages/possibilities.tsx` |
| D6 | Brief 审批面板 | `apps/web/src/pages/brief-review.tsx` |
| D7 | 连接调试 + 集成 | Mock 数据驱动页面渲染 |

**Week 11: 正文编辑 + 终审 + 世界浏览器**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | 正文编辑器（TipTap） | `apps/web/src/components/editor/` |
| D2 | 终审面板（滑动条/幽灵锚点） | `apps/web/src/pages/final-review.tsx` |
| D3 | 谏官报告展示 | `apps/web/src/pages/counselor-report.tsx` |
| D4 | 世界浏览器（实体列表/详情） | `apps/web/src/pages/world-browser.tsx` |
| D5 | 实时状态指示器（MOU 当前状态） | `apps/web/src/components/status-bar.tsx` |
| D6 | 响应式适配（移动端基本可用） | CSS 媒体查询 |
| D7 | 端到端测试 + 性能优化 | Lighthouse 评分 |

**前端 Store 设计**:

```typescript
// apps/web/src/stores/mou-store.ts
interface MouStore {
  // 连接状态
  connection: 'disconnected' | 'connecting' | 'connected';
  
  // MOU 状态
  mouState: string;           // 当前 XState 状态
  context: MouContext | null; // 完整上下文
  
  // 当前显示内容
  possibilities: Possibility[];
  currentBrief: Brief | null;
  generatedContent: string;
  counselorReport: RemonstratorReport | null;
  
  // 操作
  sendEvent: (event: HumanEvent) => void;
  connect: () => void;
  disconnect: () => void;
}
```

**验收标准**:
- [ ] 浏览器连接 WebSocket，实时显示 MOU 状态
- [ ] 可能性选择页面：3-5 个卡片，点击选择
- [ ] Brief 审批页面：完整 Brief 展示，Approve/Modify/Reject 按钮
- [ ] 正文编辑器：支持基本编辑，显示谏官批注
- [ ] 终审页面：滑动条（0-100）、幽灵锚点显示
- [ ] 世界浏览器：实体列表、搜索、详情面板
- [ ] 响应式：1024px+ 完整布局，768px 简化布局
- [ ] Lighthouse 性能评分 > 70

**风险提示**:
| 风险 | 概率 | 缓解 |
|------|------|------|
| WebSocket 重连逻辑复杂 | 中 | 用 Socket.io 内置重连 |
| TipTap 学习成本 | 中 | 先用 textarea，再替换为 TipTap |
| 前端状态与后端状态不一致 | 中 | 以服务端状态为准，前端只做镜像 |

---

### Phase 7: 谏官 + FlowGuardian（Week 12-13，62h）

**目标**: 20+ 检查项的规则引擎 + LLM 混合检查 + 心流监测

**核心架构**: 规则引擎（即时）+ LLM 检查（异步）= 混合检查

**Week 12: 谏官系统**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | 谏官核心 + 检查项注册表 | `counselor/src/core/engine.ts` |
| D2 | C01 战力检查（规则+LLM） | `counselor/src/checks/c01-power.ts` |
| D3 | C02 人设检查（LLM） | `counselor/src/checks/c02-character.ts` |
| D4 | C03-C05 伏笔/节奏/套路 | `counselor/src/checks/c03-foreshadow.ts` |
| D5 | C06-C10 水文/预期/能力/地理/势力 | 批量实现（结构相同） |
| D6 | 综合报告生成（三策输出） | `counselor/src/reports/synthesis.ts` |
| D7 | 谏官 Shell + 集成测试 | `counselor/src/shell/counselor-shell.ts` |

**Week 13: FlowGuardian**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | 心流状态机（engaged/distracted/away） | `flow-guardian/src/flow-state.ts` |
| D2 | 操作模式分析器（冥想/推进/怀疑） | `flow-guardian/src/mode-analyzer.ts` |
| D3 | 超时检测 + 召回策略 | `flow-guardian/src/timeout-guard.ts` |
| D4 | 召回语生成（LLM） | `flow-guardian/src/recall-generator.ts` |
| D5 | 会话健康报告 | `flow-guardian/src/health-reporter.ts` |
| D6 | 与 MOU 状态机集成 | `flow-guardian/src/integration.ts` |
| D7 | 端到端测试 | 模拟心流场景 |

**验收标准**:
- [ ] 谏官检查 20 项全部注册，每项有独立测试
- [ ] 规则检查 < 100ms，LLM 检查 < 3s
- [ ] 报告包含：严重程度/问题描述/三策建议/位置
- [ ] 心流状态正确识别（操作间隔 > 5min → distracted）
- [ ] 召回消息不超过 3 次，不强制打断
- [ ] FlowGuardian 失效不影响核心创作流程

**风险提示**:
| 风险 | 概率 | 缓解 |
|------|------|------|
| 20 项检查工作量爆炸 | 高 | 先做 5 项核心检查，其余先留接口 |
| LLM 检查成本高 | 中 | 规则检查先做过滤，LLM 只检查可疑内容 |
| 心流误判 | 中 | 保守策略：宁可漏判也不错判 |

---

### Phase 8: 叙事系统 + 文档体系（Week 14-15，62h）

**目标**: 故事线可视化 + 关系网 + 四层文档管理

**Week 14: 故事网 + 关系网**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | 故事线数据结构 | `narrative-graph/src/timeline/` |
| D2 | 关系网图构建 | `narrative-graph/src/relation-graph/` |
| D3 | D3.js 力导向图渲染 | `apps/web/src/components/graph/` |
| D4 | 故事线 + 关系网联动 | 点击节点高亮关联 |
| D5 | 伏笔追踪可视化 | 埋设/回收/超时 不同颜色 |
| D6 | 地图可视化（简化） | SVG 地图 + 势力范围 |
| D7 | 前端集成 + 调优 | 性能优化（大数据量） |

**Week 15: 四层文档体系**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | World Bible 编辑器 | `apps/web/src/pages/doc-world-bible.tsx` |
| D2 | Master Outline 编辑器 | `apps/web/src/pages/doc-outline.tsx` |
| D3 | Volume Plan 编辑器 | `apps/web/src/pages/doc-volume.tsx` |
| D4 | Chapter Brief 编辑器 | `apps/web/src/pages/doc-chapter-brief.tsx` |
| D5 | 影响域分析器 | `doc-system/src/impact-analyzer.ts` |
| D6 | Retcon 修订流程 | `doc-system/src/retcon-manager.ts` |
| D7 | 一致性校验 | 四层文档交叉引用验证 |

**验收标准**:
- [ ] 关系网能渲染 100+ 节点不卡顿
- [ ] 故事线时间轴可缩放/平移
- [ ] 四层文档编辑器能 CRUD
- [ ] 影响域分析：修改 World Bible 字段，显示影响的章节列表
- [ ] Retcon 修订：创建修订提案 → 预览影响 → 作者确认 → 批量应用

---

### Phase 9: DevAgent 集群（Week 16-18，93h）

**目标**: 遥测 + 路由 + 智能体 + 验证部署（外部进化引擎）

**重要: DevAgent 是独立进程，不阻塞核心创作功能。**

**Week 16: 遥测 + 路由**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | 遥测探针（AOP 注入） | `devagent/src/telemetry/probes.ts` |
| D2 | 运行时数据收集 | `devagent/src/telemetry/collector.ts` |
| D3 | 遥测上报（不阻塞主线程） | `devagent/src/telemetry/reporter.ts` |
| D4 | 分类器（异常/需求/性能） | `devagent/src/router/classifier.ts` |
| D5 | 路由决策（优先级/分配） | `devagent/src/router/dispatcher.ts` |
| D6 | 工单系统 | `devagent/src/router/tickets.ts` |
| D7 | 遥测 + 路由集成测试 | 模拟异常触发完整流程 |

**Week 17: 智能体群 + 验证**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | 开发者智能体（BugFixAgent） | `devagent/src/swarm/bugfix-agent.ts` |
| D2 | 优化智能体（OptimizeAgent） | `devagent/src/swarm/optimize-agent.ts` |
| D3 | 重构智能体（RefactorAgent） | `devagent/src/swarm/refactor-agent.ts` |
| D4 | 测试智能体（TestAgent） | `devagent/src/swarm/test-agent.ts` |
| D5 | 验证管道（自动测试） | `devagent/src/validation/test-runner.ts` |
| D6 | 部署系统（分支/PR/合并） | `devagent/src/validation/deployer.ts` |
| D7 | 智能体群集成测试 | 模拟工单 → 提案 → 验证 |

**Week 18: 知识库 + 集成**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | Issue 知识库 | `devagent/src/knowledge/issue-db.ts` |
| D2 | 代码记忆 | `devagent/src/knowledge/code-memory.ts` |
| D3 | 进化追踪 | `devagent/src/knowledge/evolution.ts` |
| D4 | DevAgent API（REST + WS） | `devagent/src/api/` |
| D5 | 前端 DevAgent 面板 | `apps/web/src/pages/devagent/` |
| D6 | 完整集成测试 | 端到端异常 → 修复流程 |
| D7 | 文档 + 部署脚本 | `devagent/README.md` |

**验收标准**:
- [ ] 遥测零侵入（AOP 注入，不修改业务代码）
- [ ] 异常自动分类准确率 > 80%
- [ ] 智能体生成代码能通过 TypeScript 编译
- [ ] 验证管道自动跑通测试套件
- [ ] 所有变更以 PR 形式提交，不直接修改主分支
- [ ] DevAgent 停止不影响 NarrativeOS 核心功能

**风险提示**:
| 风险 | 概率 | 缓解 |
|------|------|------|
| 范围蔓延（最容易超时的 Phase） | 高 | 严格限制：只做监测+告警，不做自动修复 |
| 智能体代码质量差 | 中 | 先生成简单修复，复杂问题交给人类 |
| Git 操作风险 | 中 | 所有操作在独立分支，永不 touch main |

---

### Phase 10: UI 设计体系 + 主题（Week 19-20，62h）

**目标**: 完整的设计系统 + 响应式 + 主题引擎

**Week 19: 设计系统**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | 设计 Token（颜色/字体/间距） | `packages/ui/tokens.ts` |
| D2 | 基础组件（Button/Input/Card） | `packages/ui/components/` |
| D3 | 复合组件（Modal/Table/Form） | `packages/ui/components/` |
| D4 | 反馈组件（Toast/Loading/Empty） | `packages/ui/components/` |
| D5 | 主题引擎（亮/暗/自定义） | `packages/ui/theme/engine.ts` |
| D6 | 响应式断点系统 | `packages/ui/responsive.ts` |
| D7 | 组件文档 + Storybook | `packages/ui/stories/` |

**Week 20: 主题 + 动效 + 打磨**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | 暗黑主题 | `packages/ui/themes/dark.ts` |
| D2 | 网文风格主题 | `packages/ui/themes/wuxia.ts` |
| C3 | 页面过渡动效 | Framer Motion |
| D4 | 数据可视化主题 | D3.js 主题适配 |
| D5 | 前端性能优化 | 代码分割/懒加载 |
| D6 | 可访问性（a11y） | ARIA 标签/键盘导航 |
| D7 | UI 审计 + 修复 | 一致性检查 |

**验收标准**:
- [ ] 设计系统 30+ 组件全部可用
- [ ] 主题切换无闪烁
- [ ] 响应式：320px - 2560px 可用
- [ ] Lighthouse 可访问性 > 90
- [ ] 首屏加载 < 3s（3G 网络）

---

### Phase 11: 打磨 + 测试 + 部署（Week 21-22，62h）

**目标**: E2E 测试 + 性能优化 + Docker 部署

**Week 21: 测试 + 优化**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | E2E 测试（Playwright） | `e2e/` |
| D2 | 核心场景测试（创作一个章节） | `e2e/create-chapter.spec.ts` |
| D3 | 性能测试（k6） | `perf/` |
| D4 | 数据库查询优化（慢查询分析） | 索引优化 |
| D5 | LLM 调用优化（缓存/批量） | 缓存命中率 > 50% |
| D6 | 内存泄漏检测 | Heap dump 分析 |
| D7 | 安全审计（依赖扫描） | `npm audit` 零高危 |

**Week 22: 部署 + 文档**

| 天 | 任务 | 输出 |
|----|------|------|
| D1 | Docker 多阶段构建 | `Dockerfile` |
| D2 | docker-compose 生产配置 | `docker-compose.prod.yml` |
| D3 | 数据库备份策略 | `scripts/backup.sh` |
| D4 | 部署文档 | `docs/DEPLOYMENT.md` |
| D5 | 用户手册（简化版） | `docs/USER_GUIDE.md` |
| D6 | 视频演示录制 | `docs/demo/` |
| D7 | 最终检查 + 发布 | Tag v0.1.0-mvp |

**验收标准**:
- [ ] E2E 测试覆盖 5 个核心场景
- [ ] API 响应 P95 < 200ms（不含 LLM 调用）
- [ ] `docker-compose up` 一键启动
- [ ] 数据库备份/恢复脚本可用
- [ ] 文档完整（部署/使用/开发）

---


## 第6章 弹性裁剪路线

### 6.1 如何让 Claude Code 最高效地工作

**上下文管理策略**:

Claude Code 的上下文窗口有限（约 200K tokens）。对于一个大型项目，每次对话都要精确控制上下文。

```
每次对话的最佳实践：

1. 开始新对话时：
   /compact                    # 压缩历史上下文
   
2. 给 Claude 读文件：
   不要 "请读这些文件"（Claude 会自己找）
   要 "参考 /path/to/file.ts 中的 XXX 函数"
   
3. 单次任务控制在：
   - 1 个文件（< 500 行）或
   - 1 个模块（3-5 个相关文件）或
   - 1 个接口定义
   
4. 复杂任务分解：
   "先写类型定义 → 告诉我 → 然后写实现"
   而不是 "一次性写完整个引擎"
```

**高效 Prompt 模板**:

```
# 最佳实践：先给上下文，再给任务

Context:
- 我正在开发 NarrativeOS v3.0 的世界引擎模块
- 当前在 Phase 3，实现战力计算系统
- 设计文档参考：chapter05_world_engine.md 5.1.2 节
- 已完成：StatVector 类型定义、RealmTier 类型定义
- 当前文件：packages/world-engine/src/combat/power-calc.ts（空）

Task:
请实现 calculateCombatPower 函数，要求：
1. 输入：baseStats, realm, equipment[], buffs[], debuffs[], specialAbilities[]
2. 按设计文档的 6 步公式计算
3. 权重从 config 读取
4. 返回 CombatPowerResult

Reference:
- 境界倍率表：/mnt/agents/output/chapter05_world_engine.md 第 150-153 行
- 权重配置：packages/config/src/app.config.ts

Output:
只输出 power-calc.ts 的完整代码，不需要测试（我单独写）。
```

### 6.2 每天开始工作时（15 分钟）

```
晨间启动清单：

[ ] git status                    # 确认工作目录干净
[ ] git pull origin main          # 同步远程（如果有协作）
[ ] make dev                      # 启动数据库+后端+前端
[ ] make test                     # 跑测试，确认全绿
[ ] 查看昨天的 TODO（记录在 todo.md）
[ ] 今天只做 1 件事：写在便签上贴屏幕
```

### 6.3 每天结束工作时（15 分钟）

```
晚间收尾清单：

[ ] git add -A
[ ] git commit -m "feat(模块): 今天做了什么"  # 约定式提交
[ ] git push origin $(git branch --show-current)
[ ] 更新 todo.md（今天做了什么/明天做什么）
[ ] 写一句话开发日志（log/DATE.md）
[ ] make stop                      # 关闭数据库（省内存）
```

### 6.4 周末大块时间安排

```
周末（每天 8 小时）安排：

上午（3小时）—— 深度工作：
  - 写核心算法/复杂状态机
  - 需要连续思考的任务
  - 关闭通知，专注编码

午休（1小时）—— 充电：
  - 看设计文档相关章节
  - 思考架构问题

下午（3小时）—— 集成工作：
  - 连接上午写的模块
  - 写集成测试
  - 调试跨模块问题

晚上（1小时）—— 轻量工作：
  - 写文档/注释
  - 整理代码
  - 规划下周任务
```

### 6.5 每周节奏

| 时间 | 活动 | 时长 |
|------|------|------|
| 周一早 | 周计划：明确本周目标和每日任务 | 30min |
| 每天 | 按日程编码（3h/工作日，8h/周末） | — |
| 周五晚 | 周总结：完成度、问题、下周调整 | 30min |
| 周六 | 本周最困难的技术任务 | — |
| 周日 | 集成测试 + 下周准备 | — |

---


## 第7章 风险缓解策略

### 7.1 LLM API 成本超预期

**场景**: 预估每章 ￥0.10，实际 ￥0.50（5 倍超支）

**缓解措施**:
1. **分层预算控制**:
   ```typescript
   // 每日/每周/每月预算硬上限
   const budgetConfig = {
     dailyMax: 5,      // 元/天
     weeklyMax: 20,    // 元/周
     monthlyMax: 50,   // 元/月
   };
   ```
2. **本地模型降级**: vLLM + Qwen3-72B（一次性硬件投入，零 API 成本）
3. **响应缓存**: 相同输入直接返回缓存结果（命中率可达 30-50%）
4. **Mock 模式日常开发**: 只在验证质量时切到真实 API

**成本对照表**:

| 方案 | 每章成本 | 千章成本 | 质量 |
|------|---------|---------|------|
| DeepSeek V3（默认） | ￥0.08 | ￥80 | ★★★★ |
| DeepSeek V3 + 缓存 | ￥0.05 | ￥50 | ★★★★ |
| GPT-4o-mini | ￥0.15 | ￥150 | ★★★☆ |
| Claude Haiku | ￥0.20 | ￥200 | ★★★★ |
| 本地 Qwen3-72B | ￥0（电费） | ￥~1000/年 | ★★★☆ |

### 7.2 模块卡住（最常见风险）

**绕过策略：「接口先行，实现后置」**

```
场景：世界引擎的因果链推导卡住了

标准流程（卡住）：
  研究算法 → 写代码 → 调试 → 卡在第 3 步 → 整周无进展

绕过流程（推荐）：
  1. 定义接口：export function buildCausalChain(event: Event): CausalChain
  2. 实现 Mock：return { chain: [event], depth: 1 }  // 最简单的实现
  3. 继续下游：基于这个接口继续开发 MOU 协调层
  4. 后续再回来优化因果链算法
  
结果：下游模块不被阻塞，整体进度继续
```

**各模块的「最小可绕行实现」**:

| 模块 | 卡住风险点 | 最小绕行实现 |
|------|-----------|-------------|
| 战力计算 | 公式平衡性 | 查表法（预计算好所有组合的战力值） |
| 因果推演 | 图算法复杂 | 只追踪直接因果（1 层深度） |
| Brief 生成 | LLM 质量差 | 模板填充（从数据库拼接固定模板） |
| 谏官检查 | 20 项太多 | 只做 3 项核心检查，其余返回空 |
| 心流监测 | 误判率高 | 只用简单超时检测（10 分钟无操作） |
| DevAgent | 智能体质量 | 只做遥测和告警，不做自动修复 |

### 7.3 开发进度延迟

**优先级裁剪策略（当进度落后时）**:

```
Phase 3-8 每个模块都有 "MVP / 完整 / 完美" 三级：

MVP 级（必须做）：核心流程能跑通
完整级（应该做）：所有功能可用
完美级（有时间再做）：性能/体验最优

如果延迟 1 周：砍掉当前 Phase 的 "完美级" 任务
如果延迟 2 周：砍掉当前 Phase 的 "完整级"，只保留 MVP
如果延迟 3 周 + ：考虑跳过非核心 Phase
```

**Phase 优先级（从高到低）**:
1. P0-P5（核心引擎 + 协调层）—— **不可跳过**
2. P6（前端 MVP）—— **不可跳过**（没有前端就不是完整产品）
3. P7（谏官）—— 可延迟到 P10 之后
4. P8（文档体系）—— 可简化（先做 World Bible）
5. P9（DevAgent）—— **可跳过**（不影响核心功能）
6. P10（UI 设计）—— 可简化（用默认主题）
7. P11（打磨部署）—— 最小化（能跑就行）

**推荐的「紧缩版」路线（延迟严重时）**:
```
P0 → P1 → P2 → P3 → P4 → P5 → P6 → P11
(环境 → 数据 → 工具 → 世界 → 工作室 → 协调 → 前端 → 部署)
= 10 周（精简版）
```

### 7.4 技术选型备选方案

| 组件 | 首选 | 备选 1 | 备选 2 | 切换成本 |
|------|------|--------|--------|----------|
| LLM 提供商 | DeepSeek | OpenAI | 本地 vLLM | 低（统一接口） |
| 前端框架 | React 19 | Vue 3 | Preact | 中（需重写组件） |
| 状态机 | XState v5 | Redux Toolkit | 手写 | 高（状态机是核心） |
| ORM | Prisma | Drizzle | Kysely | 中（Schema 需重写） |
| WebSocket | Socket.io | ws | SSE | 低（接口隔离） |
| 部署 | Docker | PM2 | 手动 | 低 |

**切换触发条件**:
- DeepSeek API 不可用 > 24h → 切换到 OpenAI
- Prisma 性能问题（查询 > 500ms）→ 评估 Drizzle
- XState v5 严重 Bug → 降级到 Redux Toolkit + Saga

---



# 第二部分：Claude Code 协作手册

## 第8章 上下文管理策略（核心）

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



## 第9章 Claude Code Prompt 模板库

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



## 第10章 开发Session工作流

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



## 第11章 最佳实践

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


## 第12章 代码审查清单

### 5.1 审查清单总览

每次 Session 结束前，必须按以下清单逐条检查 Claude 的产出：

```markdown
### 代码审查清单 v1.0

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



## 第13章 Git工作流与提交规范

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


## 第14章 问题排查决策树

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

#---

> **以下为快速参考卡片内容，已整合到各附录中。**

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

> **以下为项目文件结构参考，完整内容见第1章 §1.3**

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



# 第三部分：测试与验收

## 第15章 测试金字塔（适配单人项目）

### 1.1 传统金字塔 vs 单人项目金字塔

传统项目的测试金字塔（70%单元 / 20%集成 / 10%E2E）不适合单人项目，原因：
- 单人项目代码量相对可控，过度单元测试收益递减
- AI生成的代码更需要集成层面的验证
- LLM集成无法纯单元测试，需要专门的Mock测试层
- 状态机是核心风险点，需要状态转换全覆盖

### 1.2 NarrativeOS 测试金字塔

```
                    ▲
                   / \
                  / 5%\     探索性测试（手动）
                 /─────\
                /  10%  \   E2E关键路径（Playwright）
               /─────────\
              /   30%    \  集成测试（模块间 + DB + LLM Mock）
             /─────────────\
            /     40%      \ 单元测试（状态机 + 核心逻辑 + 工具函数）
           /─────────────────\
          /      15%         \  契约/类型测试（TypeScript编译 + Zod）
         /─────────────────────\
```

### 1.3 测试类型分布

| 层级 | 占比 | 目标时间 | 测试内容 | 优先级 |
|------|------|----------|----------|--------|
| **契约测试** | 15% | 编译时 | TS编译、Zod Schema验证、类型守卫 | P0 |
| **单元测试** | 40% | <30秒 | 状态机转换、公式计算、数据处理、工具函数 | P0 |
| **集成测试** | 30% | <60秒 | DB操作、模块间交互、LLM Mock响应、Prompt组装 | P0 |
| **E2E测试** | 10% | <3分钟 | 关键用户流程（创建世界→生成Brief→审批→发布） | P1 |
| **探索性测试** | 5% | 手动 | LLM输出质量、UI体验、边界场景 | P1 |

### 1.4 单人项目测试原则

```
┌─────────────────────────────────────────────────────────────┐
│                    单人项目测试十诫                           │
├─────────────────────────────────────────────────────────────┤
│ 1. 类型系统是第一道防线 — 充分利用TypeScript和Zod           │
│ 2. 状态机必须全覆盖 — 每个状态×每个事件至少一个测试         │
│ 3. 数据库操作必须测试 — CRUD + 约束 + 事务一个不能少        │
│ 4. LLM调用必须Mock — 永远不在自动化测试中调用真实LLM        │
│ 5. 测试速度是生命线 — 单元测试>100个/秒，否则要优化         │
│ 6. 用AI生成测试 — Claude Code辅助生成样板测试，人工审核     │
│ 7. 先写测试再写代码 — 对状态机和高风险逻辑严格执行TDD       │
│ 8. 测试即文档 — 测试用例命名清晰，描述业务场景              │
│ 9. 失败即停止 — CI中任何测试失败立即阻断，不积累技术债务    │
│ 10. 定期清理 — 每个Phase结束Review测试，删除无效测试      │
└─────────────────────────────────────────────────────────────┘
```

---


## 第16章 分Phase测试策略

### 2.1 Phase 0 — 环境搭建（测试基础设施先行）

```typescript
/**
 * Phase 0 测试目标：验证开发/测试环境可用
 * 优先级：P0（阻塞后续所有Phase）
 * 预计时间：2小时
 */

// 2.1.1 数据库连接测试
TEST("数据库连接：应成功连接到PostgreSQL")
  INPUT:  { host, port, database, user, password } from env
  EXPECT: connection.query('SELECT 1') → { rows: [{ ?column?: 1 }] }
  TIMEOUT: 5000ms

TEST("数据库连接：错误的密码应抛出ConnectionError")
  INPUT:  { password: "wrong_password" }
  EXPECT: throws DatabaseConnectionError with code 28P01

TEST("数据库扩展：pgvector扩展应已安装")
  INPUT:  "SELECT * FROM pg_extension WHERE extname = 'vector'"
  EXPECT: rows.length === 1

TEST("数据库扩展：uuid-ossp扩展应已安装")
  INPUT:  "SELECT * FROM pg_extension WHERE extname = 'uuid-ossp'"
  EXPECT: rows.length === 1

// 2.1.2 环境变量加载测试
TEST("环境变量：应正确加载.env.test")
  INPUT:  process.env.DATABASE_URL
  EXPECT: matches pattern "postgresql://user:pass@host:port/db"

TEST("环境变量：必需变量缺失应抛出ConfigError")
  INPUT:  unset LLM_API_KEY
  EXPECT: throws ConfigurationError on app startup

TEST("环境变量：可选变量应使用默认值")
  INPUT:  unset LOG_LEVEL
  EXPECT: defaultValue === "info"

// 2.1.3 目录结构验证
TEST("项目结构：必要的目录应存在")
  EXPECT: exists("src/") && exists("tests/") && exists("prisma/migrations/")
```

### 2.2 Phase 1 — 数据层（最基础的测试层）

```typescript
/**
 * Phase 1 测试目标：所有数据库操作100%覆盖
 * 优先级：P0（世界引擎依赖数据层）
 * 预计时间：4小时
 * 测试数量：~25个
 */

// ===== CRUD操作测试 =====

// --- World（世界）表 ---
TEST("World.create: 应创建世界记录")
  INPUT:  { name: "赛博朋克2077", genre: "scifi", theme: "corporate_war" }
  EXPECT: returned.id is UUID, createdAt is Date, status === "draft"

TEST("World.create: 重复名称应违反唯一性约束")
  INPUT:  { name: "赛博朋克2077" } // 已存在
  EXPECT: throws UniqueConstraintViolation (code 23505)

TEST("World.findById: 应通过ID查询世界")
  INPUT:  existingWorldId
  EXPECT: returned.id === input.id, returned.factions is Array

TEST("World.findById: 不存在ID应返回null")
  INPUT:  randomUUID()
  EXPECT: returned === null

TEST("World.update: 应更新世界属性")
  INPUT:  { id: existingId, data: { theme: "ai_uprising" } }
  EXPECT: returned.theme === "ai_uprising", updatedAt > createdAt

TEST("World.delete: 应软删除世界")
  INPUT:  existingWorldId
  EXPECT: returned.deletedAt is Date, hard query returns null

// --- Character（角色）表 ---
TEST("Character.create: 应在世界中创建角色")
  INPUT:  { worldId, name: "V", role: "mercenary", powerLevel: 75 }
  EXPECT: returned.worldId === input.worldId, returned.relationships is JSONB

TEST("Character.create: 超出世界范围的外键应报错")
  INPUT:  { worldId: nonExistentWorldId }
  EXPECT: throws ForeignKeyConstraintViolation (code 23503)

TEST("Character.findByWorld: 应返回世界内所有角色")
  INPUT:  worldId with 5 characters
  EXPECT: returned.length === 5, all items have worldId === input

TEST("Character.updateRelationships: 应正确更新JSONB关系")
  INPUT:  { id: charId, relationships: { "Judy": 80, "Jackie": 95 } }
  EXPECT: returned.relationships.Judy === 80

// --- Possibility（可能性）表 ---
TEST("Possibility.create: 应创建可能性记录")
  INPUT:  { worldId, title: "企业战争爆发", probability: 0.85, effects: [...] }
  EXPECT: returned.probability is Number between 0 and 1

TEST("Possibility.findByProbabilityRange: 应正确范围查询")
  INPUT:  { worldId, min: 0.5, max: 1.0 }
  EXPECT: all returned have probability between 0.5 and 1.0

// --- Snapshot（快照）表 ---
TEST("Snapshot.create: 应创建世界状态快照")
  INPUT:  { worldId, state: fullWorldState }
  EXPECT: returned.state contains all world properties

TEST("Snapshot.getLatest: 应返回最新快照")
  INPUT:  worldId with 3 snapshots
  EXPECT: returned.id === mostRecentSnapshotId

// --- Event（事件）表 ---
TEST("Event.create: 应创建因果事件")
  INPUT:  { possibilityId, type: "trigger", description: "荒坂塔被炸" }
  EXPECT: returned.causalChain is Array

// ===== 约束条件测试 =====

TEST("数据库约束：战力值应在0-100范围内")
  INPUT:  { powerLevel: 150 }
  EXPECT: throws CheckConstraintViolation (code 23514)

TEST("数据库约束：概率值应在0-1范围内")
  INPUT:  { probability: 1.5 }
  EXPECT: throws CheckConstraintViolation

TEST("数据库约束：JSONB字段结构验证")
  INPUT:  { effects: { invalid: "structure" } } // 缺少required字段
  EXPECT: throws/或应用层验证拒绝

// ===== pgvector检索测试 =====

TEST("pgvector.insert: 应正确插入向量嵌入")
  INPUT:  { entityId, embedding: [0.1, 0.2, ...] } // 1536维
  EXPECT: returned.embedding is valid vector type

TEST("pgvector.similaritySearch: 应返回按相似度排序的结果")
  INPUT:  { worldId, queryEmbedding: [...], limit: 5 }
  EXPECT: returned.length <= 5, returned[0].similarity >= returned[1].similarity

TEST("pgvector.similaritySearch: 不同世界的实体应隔离")
  INPUT:  { worldId: "world-a", queryEmbedding: [...] }
  EXPECT: none of returned have worldId === "world-b"

// ===== 事务测试 =====

TEST("事务：批量插入应原子性完成")
  INPUT:  10 characters in a transaction, #5 fails
  EXPECT: all 10 rolled back, table count unchanged

TEST("事务：嵌套事务应正确处理")
  INPUT:  nested transaction with savepoint
  EXPECT: inner rollback doesn't affect outer commit
```

### 2.3 Phase 2 — 工具链（LLM客户端 + 日志 + 错误处理）

```typescript
/**
 * Phase 2 测试目标：工具链可靠性
 * 优先级：P0（后续Phase依赖工具链）
 * 预计时间：3小时
 * 测试数量：~20个
 */

// ===== LLM客户端Mock测试 =====

TEST("LLMClient.send: Mock响应应正确返回")
  MOCK:  response = { content: "test response", usage: { tokens: 150 } }
  INPUT:  { prompt: "Hello", model: "claude-sonnet-4-20250514" }
  EXPECT: returned.content === "test response", returned.usage.tokens === 150

TEST("LLMClient.send: 应正确组装消息格式")
  MOCK:  capture request format
  INPUT:  { system: "You are a writer", messages: [{role:"user", content:"hi"}] }
  EXPECT: captured request has correct Anthropic API format

TEST("LLMClient.send: 超长Prompt应触发TokenBudgetError")
  INPUT:  { prompt: 50000 characters } // exceeds budget
  EXPECT: throws TokenBudgetError before API call

TEST("LLMClient.send: API超时应自动重试")
  MOCK:  timeout on 1st call, success on 2nd
  INPUT:  { prompt: "test", timeout: 5000, maxRetries: 3 }
  EXPECT: returned successfully after 2 attempts, log shows retry

TEST("LLMClient.send: 连续3次超时应放弃并抛出")
  MOCK:  timeout on all 3 calls
  INPUT:  { prompt: "test", maxRetries: 3 }
  EXPECT: throws LLMTimeoutError, callCount === 3

TEST("LLMClient.send: 速率限制应触发指数退避")
  MOCK:  rate limit (429) on 1st, success on 3rd
  INPUT:  { prompt: "test" }
  EXPECT: success after 2 retries with exponential backoff delays

TEST("LLMClient.send: 不同模型应调用不同endpoint")
  INPUT:  { model: "claude-opus-4" } vs { model: "claude-sonnet-4" }
  EXPECT: different API endpoints called, different pricing logged

TEST("LLMClient.stream: 应正确流式返回")
  MOCK:  stream of 5 chunks: "Hello", " world", "!", "", ""
  INPUT:  { prompt: "Say hello", stream: true }
  EXPECT: emitted chunks in order, final assembled === "Hello world!"

TEST("LLMClient.stream: 流中断应抛出AbortError")
  MOCK:  stream interrupted mid-way
  INPUT:  { prompt: "long response", abortSignal }
  EXPECT: throws AbortError, partial result available

// ===== 日志记录测试 =====

TEST("Logger: 应正确记录结构化日志")
  INPUT:  logger.info("World created", { worldId: "abc" })
  EXPECT: log output has { level, message, worldId, timestamp }

TEST("Logger: LLM调用应记录token使用量")
  MOCK:  LLM response with { usage: { input: 100, output: 50 } }
  EXPECT: log contains tokenUsage = { input: 100, output: 50, cost: 0.003 }

TEST("Logger: 错误应记录完整堆栈")
  INPUT:  throw new Error("DB failed")
  EXPECT: log contains error.name, error.message, error.stack

// ===== 错误处理测试 =====

TEST("ErrorHandler: 数据库错误应分类为Retryable/NonRetryable")
  INPUT:  connection timeout (retryable) vs syntax error (non-retryable)
  EXPECT: first.isRetryable === true, second.isRetryable === false

TEST("ErrorHandler: LLM错误应触发降级策略")
  INPUT:  3 consecutive LLM failures
  EXPECT: triggers fallback to simpler model, logs escalation

TEST("ErrorHandler: 未知错误应包装为InternalError")
  INPUT:  throw "string error" // non-Error
  EXPECT: wrapped in InternalError with original preserved
```

### 2.4 Phase 3 — 世界引擎（核心数值 + 推演逻辑）

```typescript
/**
 * Phase 3 测试目标：所有数值计算100%正确
 * 优先级：P0（故事正确性依赖数值正确性）
 * 预计时间：4小时
 * 测试数量：~25个
 */

// ===== 战力公式计算测试 =====

TEST("PowerCalculator: 基础战力应为属性加权平均")
  INPUT:  { strength: 80, agility: 60, intelligence: 90, weights: [0.4, 0.3, 0.3] }
  EXPECT: result === 80*0.4 + 60*0.3 + 90*0.3 = 32+18+27 = 77

TEST("PowerCalculator: 属性超出范围应被截断")
  INPUT:  { strength: 150 } // max 100
  EXPECT: clamped to 100, log warning

TEST("PowerCalculator: 装备加成应正确累加")
  INPUT:  { basePower: 75, equipment: [{ bonus: 10 }, { bonus: 5 }] }
  EXPECT: result === 75 + 10 + 5 = 90

TEST("PowerCalculator: 负面状态应正确减免")
  INPUT:  { basePower: 80, debuffs: [{ type: "injured", modifier: 0.5 }] }
  EXPECT: result === 80 * 0.5 = 40

TEST("PowerCalculator: 复合buff应正确计算")
  INPUT:  { basePower: 100, buffs: [{+20%}, {+10}], debuffs: [{-30%}] }
  EXPECT: result === 100 * 1.2 + 10 = 130; 130 * 0.7 = 91 (按定义顺序)

TEST("PowerCalculator: 战力差应在[-100, 100]区间")
  INPUT:  { powerA: 10, powerB: 90 }
  EXPECT: difference === -80 (capped)

TEST("PowerCalculator: 极端值不应溢出")
  INPUT:  { strength: Number.MAX_SAFE_INTEGER }
  EXPECT: clamped to 100, no overflow

// ===== CSP因果推演测试 =====

TEST("CausalEngine: 单一触发应产生正确事件链")
  INPUT:  trigger = { type: "bombing", target: "tower" }
  EXPECT: eventChain.length >= 2 (direct + cascading)

TEST("CausalEngine: 无关联触发不应产生虚假因果")
  INPUT:  trigger = { type: "weather_change", target: "rain" }
  EXPECT: eventChain.length === 1 (only direct, no cascade)

TEST("CausalEngine: 循环依赖应被检测并打破")
  INPUT:  A causes B, B causes C, C causes A
  EXPECT: detects cycle at depth 3, breaks with CycleDetectedError

TEST("CausalEngine: 概率传播应正确计算")
  INPUT:  P(A) = 0.8, P(B|A) = 0.6
  EXPECT: P(B) ≈ 0.48 (within 0.001 tolerance)

TEST("CausalEngine: 多条路径应合并概率")
  INPUT:  A→C (P=0.7), B→C (P=0.5), A and B triggered
  EXPECT: P(C) ≈ 1 - (1-0.7)*(1-0.5) = 0.85

TEST("CausalEngine: 时间衰减应影响远期事件")
  INPUT:  event at t=0 with decay rate 0.1
  EXPECT: effect at t=10 is 1/e of original (within tolerance)

TEST("CausalEngine: 大规模推演应在时间内完成")
  INPUT:  world with 100 entities, 50 triggers
  EXPECT: completes within 5000ms

// ===== 代价计算测试 =====

TEST("CostCalculator: 基础代价应为属性差函数")
  INPUT:  { from: { power: 50 }, to: { power: 80 } }
  EXPECT: cost === (80-50) * baseRate = positive number

TEST("CostCalculator: 不可能目标应返回Infinity")
  INPUT:  { from: { power: 10 }, to: { power: 100 }, constraints: "max_increase=50" }
  EXPECT: cost === Infinity

TEST("CostCalculator: 多资源代价应加权汇总")
  INPUT:  { resources: [{ type: "money", cost: 100 }, { type: "time", cost: 2 }] }
  EXPECT: totalCost === weighted sum

// ===== 特殊能力校验测试 =====

TEST("AbilityValidator: 有效能力应通过校验")
  INPUT:  { name: "隐身", cooldown: 3, effects: [...] }
  EXPECT: validationResult.valid === true

TEST("AbilityValidator: 重复能力名应拒绝")
  INPUT:  { name: "隐身" } // already exists
  EXPECT: validationResult.valid === false, error: "duplicate_name"

TEST("AbilityValidator: 效果引用不存在的实体应拒绝")
  INPUT:  { effects: [{ target: "non-existent-entity" }] }
  EXPECT: validationResult.valid === false, error: "invalid_target"

TEST("AbilityValidator: 冷却时间为负应拒绝")
  INPUT:  { cooldown: -1 }
  EXPECT: validationResult.valid === false, error: "negative_cooldown"
```

### 2.5 Phase 4 — 工作室引擎（Prompt工程 + 上下文管理）

```typescript
/**
 * Phase 4 测试目标：Prompt正确组装 + 上下文正确检索
 * 优先级：P0（生成质量依赖Prompt质量）
 * 预计时间：4小时
 * 测试数量：~20个
 */

// ===== Prompt组装测试 =====

TEST("PromptBuilder: 基础Prompt应包含所有必要部分")
  INPUT:  { world: worldData, task: "generate_brief" }
  EXPECT: output contains <world>, <characters>, <possibilities>, <instructions>

TEST("PromptBuilder: 世界上下文应被正确序列化")
  INPUT:  world with factions, relationships, currentState
  EXPECT: serialized factions.length === actual factions.length

TEST("PromptBuilder: Token预算应被严格限制")
  INPUT:  large world (potential > 10k tokens), budget: 4000
  EXPECT: output token count <= 4000, priority content preserved

TEST("PromptBuilder: 优先级排序应正确工作")
  INPUT:  20 characters, budget allows 5
  EXPECT: top 5 by relevance/priority selected

TEST("PromptBuilder: 特殊指令应正确注入")
  INPUT:  { specialInstructions: ["avoid_violence", "focus_on_politics"] }
  EXPECT: output contains both instruction strings

TEST("PromptBuilder: 不同任务应使用不同模板")
  INPUT:  task: "generate_brief" vs "revise_brief" vs "generate_possibilities"
  EXPECT: different template structures used

// ===== 上下文检索测试 =====

TEST("ContextRetriever: 应通过相似度检索相关实体")
  INPUT:  { worldId, query: "corporate conflict" }
  EXPECT: returned entities relevance-ranked, all related to corporate

TEST("ContextRetriever: 应包含最近修改的实体")
  INPUT:  { worldId, recentlyModified: ["char1", "char2"] }
  EXPECT: char1 and char2 in results regardless of similarity

TEST("ContextRetriever: 应过滤已删除实体")
  INPUT:  { worldId, includeDeleted: false }
  EXPECT: no results have deletedAt set

TEST("ContextRetriever: 空查询应返回默认上下文")
  INPUT:  { worldId, query: "" }
  EXPECT: returns world overview + top entities by importance

// ===== Brief生成测试（Mock LLM） =====

TEST("BriefGenerator: 正常流程应生成完整Brief")
  MOCK:  LLM returns valid brief JSON with title, scenes, characters
  INPUT:  { worldId, authorIntent: "dark turn" }
  EXPECT: returned brief has all required fields, valid JSON

TEST("BriefGenerator: LLM返回无效JSON应重试")
  MOCK:  1st call returns invalid JSON, 2nd returns valid
  INPUT:  { worldId }
  EXPECT: success after retry, log shows parsing error

TEST("BriefGenerator: LLM返回3次无效JSON应人工介入")
  MOCK:  all calls return invalid JSON
  INPUT:  { worldId }
  EXPECT: triggers human-in-the-loop alert, returns error with raw output

TEST("BriefGenerator: 生成内容应符合安全策略")
  MOCK:  LLM returns content with policy violation
  INPUT:  { worldId }
  EXPECT: filtered by SafetyGuard, flagged items logged

TEST("BriefGenerator: Token使用应在预算内")
  MOCK:  track all LLM calls
  INPUT:  { worldId, budget: { input: 2000, output: 1000 } }
  EXPECT: total usage within budget, cost logged
```

### 2.6 Phase 5 — 协调层（XState状态机 — 核心中的核心）

```typescript
/**
 * Phase 5 测试目标：状态机100%转换覆盖
 * 优先级：P0（业务流程正确性的最后防线）
 * 预计时间：6小时
 * 测试数量：~35个（所有状态×所有事件）
 * 策略：使用@xstate/test模型测试
 */

// ===== 核心状态转换测试 =====

TEST("FSM: idle → generating_possibilities（GENERATE事件）")
  SETUP:  machine in "idle" state
  INPUT:  { type: "GENERATE", worldId: "valid-world" }
  EXPECT: state === "generating_possibilities"
  VERIFY: context.worldId === "valid-world", context.retryCount === 0

TEST("FSM: generating_possibilities → waiting_author_choice（SUCCESS）")
  SETUP:  machine in "generating_possibilities"
  MOCK:   PossibilityGenerator returns 3 possibilities
  INPUT:  { type: "GENERATE_COMPLETE", possibilities: [...] }
  EXPECT: state === "waiting_author_choice"
  VERIFY: context.possibilities.length === 3, context.lastGeneratedAt is Date

TEST("FSM: generating_possibilities → idle（FAIL + maxRetries未达）")
  SETUP:  machine in "generating_possibilities", context.retryCount = 1, maxRetries = 3
  MOCK:   PossibilityGenerator throws error
  INPUT:  { type: "GENERATE_ERROR", error }
  EXPECT: state === "generating_possibilities" (auto-retry)
  VERIFY: context.retryCount === 2, context.lastError === error

TEST("FSM: generating_possibilities → error_recovery（FAIL + maxRetries达到）")
  SETUP:  machine in "generating_possibilities", context.retryCount = 3, maxRetries = 3
  MOCK:   PossibilityGenerator throws error
  INPUT:  { type: "GENERATE_ERROR", error }
  EXPECT: state === "error_recovery"
  VERIFY: context.retryCount === 3, alert sent to author

TEST("FSM: waiting_author_choice → generating_brief（CHOOSE事件）")
  SETUP:  machine in "waiting_author_choice" with possibilities
  INPUT:  { type: "CHOOSE", possibilityId: "poss-1" }
  EXPECT: state === "generating_brief"
  VERIFY: context.selectedPossibility === "poss-1", context.briefRetryCount = 0

TEST("FSM: waiting_author_choice → generating_possibilities（RETRY事件）")
  SETUP:  machine in "waiting_author_choice"
  INPUT:  { type: "RETRY" }
  EXPECT: state === "generating_possibilities"
  VERIFY: context.retryCount incremented, context.possibilities cleared

TEST("FSM: waiting_author_choice → idle（ABANDON事件）")
  SETUP:  machine in "waiting_author_choice"
  INPUT:  { type: "ABANDON" }
  EXPECT: state === "idle"
  VERIFY: all transient context cleared (possibilities, retry counts)

TEST("FSM: generating_brief → waiting_author_approval（SUCCESS）")
  SETUP:  machine in "generating_brief"
  MOCK:   BriefGenerator returns valid brief
  INPUT:  { type: "BRIEF_COMPLETE", brief: validBrief }
  EXPECT: state === "waiting_author_approval"
  VERIFY: context.currentBrief === validBrief

TEST("FSM: generating_brief → generating_brief（FAIL + retry）")
  SETUP:  machine in "generating_brief", context.briefRetryCount = 0
  MOCK:   BriefGenerator throws error
  INPUT:  { type: "BRIEF_ERROR", error }
  EXPECT: state === "generating_brief" (auto-retry)
  VERIFY: context.briefRetryCount === 1

TEST("FSM: generating_brief → error_recovery（FAIL + maxBriefRetries）")
  SETUP:  machine in "generating_brief", context.briefRetryCount = 3
  MOCK:   BriefGenerator throws error
  INPUT:  { type: "BRIEF_ERROR", error }
  EXPECT: state === "error_recovery"

TEST("FSM: waiting_author_approval → publishing（APPROVE事件）")
  SETUP:  machine in "waiting_author_approval" with valid brief
  INPUT:  { type: "APPROVE" }
  EXPECT: state === "publishing"
  VERIFY: context.approvedAt is Date

TEST("FSM: waiting_author_approval → generating_brief（REVISE事件）")
  SETUP:  machine in "waiting_author_approval"
  INPUT:  { type: "REVISE", feedback: "make it darker" }
  EXPECT: state === "generating_brief"
  VERIFY: context.revisionFeedback === "make it darker", context.revisionCount incremented

TEST("FSM: waiting_author_approval → generating_possibilities（RESELECT事件）")
  SETUP:  machine in "waiting_author_approval"
  INPUT:  { type: "RESELECT" }
  EXPECT: state === "generating_possibilities"
  VERIFY: context.selectedPossibility cleared, context.possibilities cleared

TEST("FSM: publishing → completed（PUBLISH_SUCCESS）")
  SETUP:  machine in "publishing"
  MOCK:   Publisher returns success
  INPUT:  { type: "PUBLISH_SUCCESS", snapshot: {...} }
  EXPECT: state === "completed"
  VERIFY: context.publishedSnapshot === snapshot, context.completedAt is Date

TEST("FSM: publishing → error_recovery（PUBLISH_FAIL）")
  SETUP:  machine in "publishing"
  MOCK:   Publisher throws error
  INPUT:  { type: "PUBLISH_FAIL", error }
  EXPECT: state === "error_recovery"
  VERIFY: context.publishError === error

// ===== 审批流程测试 =====

TEST("FSM: 连续3次RETRY应触发Oracle（下神谕）")
  SETUP:  start from idle
  STEPS:  GENERATE → ERROR → (auto-retry x3) → retryCount=3
  EXPECT: enters error_recovery, Oracle service triggered
  VERIFY: context.oracleTriggered === true, notification sent

TEST("FSM: 连续3次REVISE应触发FlowGuardian")
  SETUP:  machine in waiting_author_approval
  STEPS:  REVISE → BRIEF_COMPLETE → REVISE → BRIEF_COMPLETE → REVISE
  EXPECT: on 3rd REVISE, FlowGuardian state entered
  VERIFY: context.flowGuardianTriggered === true

TEST("FSM: FlowGuardian → generating_possibilities（DIVERGE）")
  SETUP:  machine in FlowGuardian
  INPUT:  { type: "DIVERGE" }
  EXPECT: state === "generating_possibilities"
  VERIFY: revisionCount reset, new direction context set

TEST("FSM: FlowGuardian → generating_brief（REFINE）")
  SETUP:  machine in FlowGuardian
  INPUT:  { type: "REFINE", specificFeedback: "..." }
  EXPECT: state === "generating_brief"
  VERIFY: context.refinementMode === true

// ===== 异常恢复测试 =====

TEST("FSM: error_recovery → idle（RESET事件）")
  SETUP:  machine in "error_recovery"
  INPUT:  { type: "RESET" }
  EXPECT: state === "idle"
  VERIFY: all context reset to initial values

TEST("FSM: error_recovery → previous_state（RETRY_NOW事件）")
  SETUP:  machine in "error_recovery", context.previousState = "generating_brief"
  INPUT:  { type: "RETRY_NOW" }
  EXPECT: returns to "generating_brief"
  VERIFY: retry count reset for that phase

// ===== 守卫条件测试 =====

TEST("FSM: CHOOSE守卫应拒绝无效possibilityId")
  SETUP:  machine in "waiting_author_choice" with possibilities ["p1", "p2"]
  INPUT:  { type: "CHOOSE", possibilityId: "invalid" }
  EXPECT: state unchanged (guard rejects), error logged

TEST("FSM: APPROVE守卫应检查brief存在")
  SETUP:  machine in "waiting_author_approval", context.currentBrief = null
  INPUT:  { type: "APPROVE" }
  EXPECT: state unchanged, guard error thrown

// ===== 进入/退出动作测试 =====

TEST("FSM: 进入generating_possibilities应记录timestamp")
  INPUT:  { type: "GENERATE" }
  EXPECT: context.generationStartTime is set

TEST("FSM: 退出任何状态应清理临时错误")
  SETUP:  state with context.lastError set
  INPUT:  any valid transition
  EXPECT: context.lastError cleared (exit action)

// ===== 并行状态测试 =====

TEST("FSM: 编辑状态应独立于主流程")
  SETUP:  machine in "waiting_author_choice"
  INPUT:  { type: "TOGGLE_EDIT_MODE" }
  EXPECT: parallel "edit" state active, main state unchanged
  THEN:   { type: "SAVE_EDIT" } → edit state inactive

TEST("FSM: 编辑状态不应影响主流程转换")
  SETUP:  machine in "waiting_author_choice" with edit active
  INPUT:  { type: "CHOOSE", possibilityId: "p1" }
  EXPECT: main state → "generating_brief", edit state still active
```

### 2.7 Phase 6 — 前端（React组件 + 交互 + WebSocket）

```typescript
/**
 * Phase 6 测试目标：用户界面正确渲染和交互
 * 优先级：P1（用户体验）
 * 预计时间：4小时
 * 测试数量：~20个
 */

// ===== 组件渲染测试 =====

TEST("WorldList: 应渲染世界列表")
  RENDER: <WorldList worlds={[world1, world2, world3]} />
  EXPECT: 3 world cards visible, names displayed

TEST("WorldList: 空状态应显示创建提示")
  RENDER: <WorldList worlds={[]} />
  EXPECT: "Create your first world" message visible

TEST("BriefCard: 应正确显示Brief内容")
  RENDER: <BriefCard brief={testBrief} />
  EXPECT: title, scenes (count), characters listed

TEST("PossibilityPanel: 应按概率排序显示")
  RENDER: <PossibilityPanel possibilities={[low, high, medium]} />
  EXPECT: order = [high, medium, low]

TEST("ApprovalButtons: 根据状态显示不同按钮")
  RENDER: <ApprovalButtons state="waiting_author_approval" />
  EXPECT: Approve, Revise, Reselect buttons visible
  RENDER: <ApprovalButtons state="generating_brief" />
  EXPECT: loading spinner, no action buttons

// ===== 用户交互测试 =====

TEST("WorldList: 点击世界应导航到详情")
  ACTION: user.click(worldCard)
  EXPECT: navigate called with /worlds/:id

TEST("BriefCard: 点击Approve应发送APPROVE事件")
  ACTION: user.click(approveButton)
  EXPECT: sendEvent called with { type: "APPROVE" }

TEST("PossibilityPanel: 选择可能性应高亮并启用CHOOSE")
  ACTION: user.click(possibilityCard[1])
  EXPECT: card[1] has "selected" class, CHOOSE button enabled

TEST("ReviseModal: 提交反馈应发送REVISE事件")
  ACTION: user.click(reviseButton)
  ACTION: user.type(feedbackInput, "make it darker")
  ACTION: user.click(submitButton)
  EXPECT: sendEvent called with { type: "REVISE", feedback: "make it darker" }

// ===== WebSocket连接测试 =====

TEST("WebSocket: 应成功连接到服务器")
  MOCK:   WebSocket server
  RENDER: <App />
  EXPECT: ws.connected === true within 3000ms

TEST("WebSocket: 应接收状态更新并刷新UI")
  MOCK:   server sends { type: "STATE_CHANGE", state: "generating_brief" }
  EXPECT: UI shows loading state for brief generation

TEST("WebSocket: 断开应显示重连提示")
  MOCK:   server closes connection
  EXPECT: "Reconnecting..." banner visible

TEST("WebSocket: 重连成功应自动恢复")
  MOCK:   server reopens
  EXPECT: banner dismissed, state synced

TEST("WebSocket: 3次重连失败应显示错误")
  MOCK:   all reconnection attempts fail
  EXPECT: "Connection lost" error state visible
```

### 2.8 Phase 7+ — 各引擎集成 + 性能基准

```typescript
/**
 * Phase 7+ 测试目标：全系统集成 + 性能基线
 * 优先级：P1（上线前必须完成）
 * 预计时间：4小时
 * 测试数量：~15个
 */

// ===== 引擎集成测试 =====

TEST("Integration: 完整创作流程端到端")
  STEPS:
    1. Create world → DB record created
    2. Add characters → characters linked to world
    3. GENERATE → possibilities generated
    4. CHOOSE possibility → brief generated (mock LLM)
    5. APPROVE brief → world state updated
    6. Publish → snapshot created
  EXPECT: each step data consistent, final state === "completed"

TEST("Integration: 数据层→世界引擎数据流")
  INPUT:  World with 10 characters from DB
  PROCESS: WorldEngine.loadWorld(worldId)
  EXPECT: all 10 characters loaded, relationships resolved

TEST("Integration: 世界引擎→工作室引擎数据流")
  INPUT:  Causal chain from WorldEngine
  PROCESS: StudioEngine.generateBrief(worldState)
  EXPECT: brief references correct entities from world state

TEST("Integration: 工作室引擎→协调层事件流")
  INPUT:  Brief generation complete
  PROCESS: send BRIEF_COMPLETE event
  EXPECT: FSM transitions to waiting_author_approval

TEST("Integration: 并发编辑不应丢失数据")
  ACTION: Edit character in UI + Simulate another edit
  EXPECT: last-write-wins or merge-conflict detected, no silent data loss

TEST("Integration: 长时间运行的生成应显示进度")
  MOCK:   LLM takes 10 seconds
  ACTION: Trigger GENERATE
  EXPECT: progress indicator updates (0% → 25% → 50% → 75% → 100%)

// ===== 性能基准测试 =====

TEST("Perf: LLM调用延迟基准")
  MOCK:   simulate 100 LLM calls
  MEASURE: TP50 < 2000ms, TP90 < 5000ms, TP99 < 10000ms

TEST("Perf: 数据库查询性能")
  MEASURE: World.findById with 1000 worlds → < 5ms
  MEASURE: Character.findByWorld with 100 characters → < 10ms
  MEASURE: pgvector similarity with 10000 vectors → < 50ms

TEST("Perf: Brief生成完整流程")
  MEASURE: GENERATE → BRIEF_COMPLETE → < 30000ms (with mock LLM)

TEST("Perf: 前端首屏渲染")
  MEASURE: <App /> first render → < 1000ms on slow 4G
  MEASURE: WorldList with 50 items → < 500ms

TEST("Perf: 状态机转换延迟")
  MEASURE: 100 state transitions → average < 1ms each

// ===== 内存泄漏检测 =====

TEST("Memory: 不应泄漏事件监听器")
  ACTION: Mount/unmount <BriefCard /> 100 times
  MEASURE: listener count before === after

TEST("Memory: 不应泄漏WebSocket连接")
  ACTION: Navigate away and back 50 times
  MEASURE: active WebSocket count ≤ 1

TEST("Memory: 大数据集不应无限增长")
  ACTION: Load 100 worlds sequentially
  MEASURE: heap growth < 10MB total
```

---


## 第17章 测试基础设施

### 3.1 测试工具链选择

| 工具 | 选择 | 理由 | 替代方案 |
|------|------|------|----------|
| **测试框架** | **Vitest** | 原生TS支持、速度极快（>100测试/秒）、与Vite生态一致、watch模式好 | Jest（配置更复杂、慢） |
| **E2E框架** | **Playwright** | 自动等待、Trace Viewer、多浏览器、CI友好、速度比Cypress快 | Cypress（生态好但慢） |
| **DB测试** | **TestContainers** | 真实PostgreSQL + pgvector、支持迁移、最接*生产 | pg-mem（轻量但不支持pgvector） |
| **覆盖率** | **v8** | Vitest内置、速度快、TS源码映射好 | istanbul（更成熟但慢） |
| **Mock HTTP** | **msw** | 统一Mock浏览器+Node端LLM调用、可录制真实响应复用 | nock（仅Node） |
| **状态机测试** | **@xstate/test** | 官方模型测试、自动生成路径、全覆盖保证 | 手写测试（容易遗漏） |

### 3.2 Mock设计详解

#### 3.2.1 LLM API Mock（msw + 预设响应）

```typescript
// tests/mocks/llm-mock.ts
import { http, HttpResponse, delay } from 'msw';

export const llmMockHandlers = [
  // 正常响应
  http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
    const body = await request.json();
    const model = body.model;

    // 根据Prompt内容返回不同Mock响应
    if (body.messages[0].content.includes('generate_possibilities')) {
      return HttpResponse.json({
        id: 'msg_mock_001',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              possibilities: [
                { id: 'p1', title: '企业战争爆发', probability: 0.85, description: '...' },
                { id: 'p2', title: 'AI觉醒反叛', probability: 0.65, description: '...' },
                { id: 'p3', title: '英雄牺牲', probability: 0.45, description: '...' },
              ]
            })
          }
        ],
        usage: { input_tokens: 1500, output_tokens: 300 }
      });
    }

    if (body.messages[0].content.includes('generate_brief')) {
      return HttpResponse.json({
        id: 'msg_mock_002',
        content: [{
          type: 'text',
          text: JSON.stringify({
            title: '荒坂塔的阴影',
            scenes: [
              { id: 's1', title: '潜入', characters: ['V', 'Judy'], description: '...' },
              { id: 's2', title: '对峙', characters: ['V', 'Smasher'], description: '...' },
            ],
            narrativeArc: 'rising_action',
            estimatedReadingTime: 15
          })
        }],
        usage: { input_tokens: 2000, output_tokens: 500 }
      });
    }

    // 默认响应
    return HttpResponse.json({
      id: 'msg_mock_default',
      content: [{ type: 'text', text: 'Mock response' }],
      usage: { input_tokens: 100, output_tokens: 50 }
    });
  }),

  // 超时模拟
  http.post('https://api.anthropic.com/v1/messages/timeout', async () => {
    await delay(30000); // 超长延迟触发超时
    return HttpResponse.json({ error: 'timeout' });
  }),

  // 速率限制模拟
  http.post('https://api.anthropic.com/v1/messages/ratelimit', () => {
    return new HttpResponse(
      JSON.stringify({ error: 'rate_limit_exceeded' }),
      { status: 429, headers: { 'retry-after': '2' } }
    );
  }),

  // 无效JSON响应（用于测试重试）
  http.post('https://api.anthropic.com/v1/messages/invalid', () => {
    return HttpResponse.json({
      content: [{ type: 'text', text: 'this is not valid json {' }]
    });
  }),

  // Token预算超限
  http.post('https://api.anthropic.com/v1/messages/expensive', () => {
    return HttpResponse.json({
      content: [{ type: 'text', text: 'expensive response' }],
      usage: { input_tokens: 50000, output_tokens: 25000 }
    });
  }),
];

// Mock响应预设库
export const mockResponses = {
  possibilities: {
    standard: { /* ... */ },
    empty: { possibilities: [] },
    large: { possibilities: Array(20).fill(null).map((_, i) => ({ ... })) },
  },
  brief: {
    standard: { /* ... */ },
    minimal: { title: '', scenes: [], narrativeArc: '' },
    complex: { /* 包含所有可选字段 */ },
  }
};
```

#### 3.2.2 数据库Mock（TestContainers配置）

```typescript
// tests/setup/db-container.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

let container: PostgreSqlContainer;
let client: Client;

export async function startDatabase() {
  container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
    .withDatabase('narrativeos_test')
    .withUsername('test')
    .withPassword('test')
    .withExposedPorts(5432)
    .start();

  const connectionString = container.getConnectionUri();

  client = new Client({ connectionString });
  await client.connect();

  // 安装扩展
  await client.query('CREATE EXTENSION IF NOT EXISTS vector');
  await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // 运行迁移
  await runMigrations(connectionString);

  return { container, client, connectionString };
}

export async function stopDatabase() {
  await client?.end();
  await container?.stop();
}

// 每个测试前清理数据
export async function resetDatabase() {
  // 使用事务回滚或TRUNCATE
  await client.query('
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = \'public\') LOOP
        EXECUTE \'TRUNCATE TABLE \' || quote_ident(r.tablename) || \' CASCADE\';
      END LOOP;
    END $$;
  ');
}

// 测试用的DB工具
export async function insertWorld(data: Partial<World>) {
  const result = await client.query(
    'INSERT INTO worlds (name, genre, theme) VALUES ($1, $2, $3) RETURNING *',
    [data.name || 'Test World', data.genre || 'fantasy', data.theme || 'default']
  );
  return result.rows[0];
}

export async function insertCharacter(data: Partial<Character>) {
  const result = await client.query(
    'INSERT INTO characters (world_id, name, role, power_level, relationships) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [data.worldId, data.name, data.role, data.powerLevel || 50, JSON.stringify(data.relationships || {})]
  );
  return result.rows[0];
}
```

#### 3.2.3 WebSocket Mock

```typescript
// tests/mocks/websocket-mock.ts
import { WebSocketServer } from 'ws';

export class MockWebSocketServer {
  private server: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private messageHandlers: Map<string, Function> = new Map();

  constructor(port: number = 8765) {
    this.server = new WebSocketServer({ port });
    this.server.on('connection', (ws) => {
      this.clients.add(ws);
      ws.on('close', () => this.clients.delete(ws));
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        const handler = this.messageHandlers.get(message.type);
        if (handler) handler(ws, message);
      });
    });
  }

  // 模拟服务器推送状态更新
  broadcastStateChange(state: string, context: any) {
    this.broadcast({
      type: 'STATE_CHANGE',
      payload: { state, context, timestamp: Date.now() }
    });
  }

  // 模拟生成进度更新
  broadcastProgress(phase: string, percent: number) {
    this.broadcast({
      type: 'PROGRESS_UPDATE',
      payload: { phase, percent, timestamp: Date.now() }
    });
  }

  // 模拟错误通知
  broadcastError(error: string, code: string) {
    this.broadcast({
      type: 'ERROR',
      payload: { error, code, timestamp: Date.now() }
    });
  }

  private broadcast(message: any) {
    const data = JSON.stringify(message);
    this.clients.forEach(ws => ws.send(data));
  }

  // 注册消息处理器
  onMessage(type: string, handler: Function) {
    this.messageHandlers.set(type, handler);
  }

  close() {
    this.server.close();
  }

  get connectedClients(): number {
    return this.clients.size;
  }
}

// 测试用法示例
// const wsServer = new MockWebSocketServer(8765);
// wsServer.broadcastStateChange('generating_brief', { progress: 50 });
```

### 3.3 测试配置文件

#### 3.3.1 vitest.config.ts（完整配置）

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // 测试框架配置
    globals: true,                    // 使用全局describe/test/expect
    environment: 'node',              // 默认Node环境
    
    // 并行执行
    pool: 'threads',                  // 使用线程池
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },
    
    // 覆盖率
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        global: {
          branches: 70,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // 核心模块更高要求
        './src/engine/': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        './src/state-machine/': {
          branches: 95,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        'src/main.tsx',
        'src/App.tsx',
      ],
    },
    
    // 测试文件匹配
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/e2e/**/*.spec.ts',
    ],
    
    // 排除
    exclude: [
      'node_modules/',
      'dist/',
      '.idea/',
      '.git/',
      '.cache/',
    ],
    
    // 超时
    testTimeout: 10000,               // 默认10秒
    hookTimeout: 30000,               // before/after 30秒
    
    // 重试
    retry: 1,                         // 失败自动重试1次（防flaky）
    
    // 输出
    reporters: ['verbose'],           // 详细输出
    
    // 环境变量
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',             // 测试时只记录error
    },
    
    // 全局setup
    globalSetup: './tests/setup/global-setup.ts',
    setupFiles: ['./tests/setup/setup-files.ts'],
    
    // 文件变化监听模式
    watch: false,
  },
  
  // 路径别名
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@mocks': path.resolve(__dirname, './tests/mocks'),
    },
  },
});
```

#### 3.3.2 playwright.config.ts（完整配置）

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // 测试目录
  testDir: './tests/e2e',
  
  // 并行执行
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  
  // 重试
  retries: process.env.CI ? 2 : 0,
  
  // 超时
  timeout: 30000,                   // 每个测试30秒
  expect: {
    timeout: 5000,                  // 断言等待5秒
  },
  
  // 报告器
  reporter: [
    ['html', { open: 'never' }],   // HTML报告
    ['list'],                       // 列表格式
    process.env.CI ? ['github'] : ['null'],  // CI环境用GitHub注释
  ],
  
  // 共享配置
  use: {
    // 基础URL
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    
    // 追踪
    trace: 'on-first-retry',        // 失败时记录trace
    screenshot: 'only-on-failure',  // 失败时截图
    video: 'on-first-retry',        // 失败时录制视频
    
    // 浏览器上下文
    actionTimeout: 5000,            // 操作超时5秒
    navigationTimeout: 10000,       // 导航超时10秒
    
    // 测试数据
    launchOptions: {
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
    },
  },
  
  // 项目配置（多浏览器）
  projects: [
    // 本地开发
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    // 仅在CI中运行的项目
    ...(process.env.CI ? [
      {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
      },
      {
        name: 'Mobile Chrome',
        use: { ...devices['Pixel 5'] },
      },
      {
        name: 'Mobile Safari',
        use: { ...devices['iPhone 12'] },
      },
    ] : []),
  ],
  
  // 本地开发服务器
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

#### 3.3.3 .env.test（完整配置）

```bash
# .env.test — 测试环境配置
# 此文件提交到版本控制，不含敏感信息

# === 应用配置 ===
NODE_ENV=test
LOG_LEVEL=error

# === 数据库（TestContainers动态分配端口，这里用占位符） ===
# 实际由测试setup动态设置DATABASE_URL
DATABASE_URL=postgresql://test:test@localhost:5432/narrativeos_test
# 测试数据库不使用连接池（避免TestContainers问题）
DATABASE_POOL_SIZE=1

# === LLM API（Mock，不调用真实API） ===
LLM_API_KEY=test-mock-key-do-not-use-in-production
LLM_API_BASE_URL=http://localhost:3001/mock/anthropic
LLM_DEFAULT_MODEL=claude-sonnet-4-20250514
LLM_MAX_TOKENS=4096
LLM_TIMEOUT_MS=5000
LLM_MAX_RETRIES=3

# === Token预算（测试环境严格限制） ===
LLM_DAILY_TOKEN_BUDGET=100000
LLM_REQUEST_TOKEN_BUDGET=4000
LLM_COST_BUDGET_USD=0.50

# === 缓存（测试禁用） ===
CACHE_ENABLED=false
REDIS_URL=redis://localhost:6379/1

# === WebSocket ===
WS_URL=ws://localhost:3001
WS_RECONNECT_MAX_RETRIES=3
WS_RECONNECT_INTERVAL_MS=1000

# === 安全 ===
ENCRYPTION_KEY=test-encryption-key-32-chars-long!!
JWT_SECRET=test-jwt-secret-not-for-production

# === 特性开关（测试环境） ===
FEATURE_FLAG_ORACLE=true
FEATURE_FLAG_FLOW_GUARDIAN=true
FEATURE_FLAG_COLLABORATION=false
FEATURE_FLAG_ANALYTICS=false

# === 测试专用 ===
TEST_MOCK_LLM_RESPONSES_DIR=./tests/mocks/responses
TEST_RECORD_HTTP=false
TEST_PARALLEL_WORKERS=4
```

#### 3.3.4 测试全局Setup文件

```typescript
// tests/setup/global-setup.ts
import { startDatabase, stopDatabase } from './db-container';

let dbContainer: Awaited<ReturnType<typeof startDatabase>>;

export default async function() {
  console.log('Starting test infrastructure...');
  
  // 启动TestContainer数据库
  dbContainer = await startDatabase();
  
  // 设置环境变量
  process.env.DATABASE_URL = dbContainer.connectionString;
  
  // 启动Mock LLM服务器（msw或独立服务器）
  // await startMockLLMServer();
  
  console.log('Test infrastructure ready');
  
  return async () => {
    console.log('Shutting down test infrastructure...');
    await stopDatabase();
    console.log('Test infrastructure stopped');
  };
}

// tests/setup/setup-files.ts
import { resetDatabase } from './db-container';
import { server } from '../mocks/msw-server';

// 每个测试文件前
beforeAll(() => {
  // 启动MSW Mock服务器
  server.listen({ onUnhandledRequest: 'error' });
});

// 每个测试前
beforeEach(async () => {
  // 重置数据库
  await resetDatabase();
  
  // 重置MSW处理器
  server.resetHandlers();
  
  // 重置所有Mock
  vi.clearAllMocks();
});

// 每个测试文件后
afterAll(() => {
  server.close();
});
```

---


## 第18章 关键测试用例（状态机35+数据库20+LLM10+审批8）

### 4.1 XState状态机测试用例（35个）

这是系统最核心的测试。使用 `@xstate/test` 模型测试实现全覆盖。

```typescript
// tests/unit/state-machine/core-flow.test.ts
import { createMachine } from 'xstate';
import { createModel } from '@xstate/test';
import { describe, it, expect, beforeEach } from 'vitest';

// ========== 核心流程测试 ==========

describe('State Machine - Core Flow', () => {
  
  // --- 测试用例 1-5：idle 状态 ---
  describe('State: idle', () => {
    
    it('TC-SM-001: idle + GENERATE → generating_possibilities', async () => {
      const machine = createNarrativeMachine();
      const state = machine.transition('idle', { type: 'GENERATE', worldId: 'w1' });
      expect(state.value).toBe('generating_possibilities');
      expect(state.context.worldId).toBe('w1');
      expect(state.context.retryCount).toBe(0);
      expect(state.context.generationStartTime).toBeInstanceOf(Date);
    });

    it('TC-SM-002: idle + GENERATE（无效worldId）→ idle（守卫拒绝）', async () => {
      const machine = createNarrativeMachine();
      const state = machine.transition('idle', { type: 'GENERATE', worldId: '' });
      expect(state.value).toBe('idle');  // 守卫拒绝，状态不变
      expect(state.context.error).toMatch(/invalid_world_id/);
    });

    it('TC-SM-003: idle + LOAD（继续上次会话）→ 恢复保存的状态', async () => {
      const savedState = { value: 'waiting_author_choice', context: { /* ... */ } };
      const machine = createNarrativeMachine({ savedState });
      const state = machine.transition('idle', { type: 'LOAD', sessionId: 'sess-1' });
      expect(state.value).toBe('waiting_author_choice');
    });

    it('TC-SM-004: idle + 无效事件 → idle（无变化）', async () => {
      const machine = createNarrativeMachine();
      const state = machine.transition('idle', { type: 'APPROVE' });
      expect(state.value).toBe('idle');  // APPROVE在idle中无效
    });

    it('TC-SM-005: idle → 进入时应清理所有临时状态', async () => {
      const machine = createNarrativeMachine({
        context: { lastError: 'previous error', retryCount: 5 }
      });
      const state = machine.transition('any', { type: 'RESET' });
      expect(state.context.lastError).toBeNull();
      expect(state.context.retryCount).toBe(0);
    });
  });

  // --- 测试用例 6-12：generating_possibilities 状态 ---
  describe('State: generating_possibilities', () => {
    
    it('TC-SM-006: generating + GENERATE_COMPLETE → waiting_author_choice', async () => {
      const machine = createNarrativeMachine({
        context: { possibilities: [] }
      });
      const possibilities = [
        { id: 'p1', title: '战争爆发', probability: 0.8 },
        { id: 'p2', title: '和平谈判', probability: 0.6 },
      ];
      const state = machine.transition(
        'generating_possibilities',
        { type: 'GENERATE_COMPLETE', possibilities }
      );
      expect(state.value).toBe('waiting_author_choice');
      expect(state.context.possibilities).toHaveLength(2);
      expect(state.context.lastGeneratedAt).toBeInstanceOf(Date);
    });

    it('TC-SM-007: generating + GENERATE_COMPLETE（空列表）→ waiting_author_choice（允许空）', async () => {
      const machine = createNarrativeMachine();
      const state = machine.transition(
        'generating_possibilities',
        { type: 'GENERATE_COMPLETE', possibilities: [] }
      );
      expect(state.value).toBe('waiting_author_choice');
      expect(state.context.possibilities).toHaveLength(0);
    });

    it('TC-SM-008: generating + GENERATE_ERROR（首次）→ generating（自动重试）', async () => {
      const machine = createNarrativeMachine({
        context: { retryCount: 0, maxRetries: 3 }
      });
      const state = machine.transition(
        'generating_possibilities',
        { type: 'GENERATE_ERROR', error: new Error('LLM timeout') }
      );
      expect(state.value).toBe('generating_possibilities');  // 停留原地
      expect(state.context.retryCount).toBe(1);
      expect(state.context.lastError).toMatch(/timeout/);
    });

    it('TC-SM-009: generating + GENERATE_ERROR（第2次）→ generating（继续重试）', async () => {
      const machine = createNarrativeMachine({
        context: { retryCount: 1, maxRetries: 3 }
      });
      const state = machine.transition(
        'generating_possibilities',
        { type: 'GENERATE_ERROR', error: new Error('LLM timeout') }
      );
      expect(state.value).toBe('generating_possibilities');
      expect(state.context.retryCount).toBe(2);
    });

    it('TC-SM-010: generating + GENERATE_ERROR（第3次，max reached）→ error_recovery', async () => {
      const machine = createNarrativeMachine({
        context: { retryCount: 2, maxRetries: 3 }
      });
      const state = machine.transition(
        'generating_possibilities',
        { type: 'GENERATE_ERROR', error: new Error('LLM timeout') }
      );
      expect(state.value).toBe('error_recovery');
      expect(state.context.oracleTriggered).toBe(true);
      expect(state.context.previousState).toBe('generating_possibilities');
    });

    it('TC-SM-011: generating + CANCEL → idle', async () => {
      const machine = createNarrativeMachine();
      const state = machine.transition(
        'generating_possibilities',
        { type: 'CANCEL' }
      );
      expect(state.value).toBe('idle');
      expect(state.context.possibilities).toBeNull();
    });

    it('TC-SM-012: generating + 超时（内部事件）→ 自动重试', async () => {
      // 测试内部after超时守卫
      const machine = createNarrativeMachine({
        context: { retryCount: 0 },
        // 模拟：after 30s 自动触发重试
      });
      // 使用 interpret 测试超时
      const service = interpret(machine).start();
      // 快进时间...
    });
  });

  // --- 测试用例 13-19：waiting_author_choice 状态 ---
  describe('State: waiting_author_choice', () => {
    
    it('TC-SM-013: choice + CHOOSE（有效possibility）→ generating_brief', async () => {
      const machine = createNarrativeMachine({
        context: { possibilities: [{ id: 'p1', title: '战争' }], worldId: 'w1' }
      });
      const state = machine.transition(
        'waiting_author_choice',
        { type: 'CHOOSE', possibilityId: 'p1' }
      );
      expect(state.value).toBe('generating_brief');
      expect(state.context.selectedPossibility).toBe('p1');
      expect(state.context.briefRetryCount).toBe(0);
    });

    it('TC-SM-014: choice + CHOOSE（无效possibilityId）→ choice（守卫拒绝）', async () => {
      const machine = createNarrativeMachine({
        context: { possibilities: [{ id: 'p1', title: '战争' }] }
      });
      const state = machine.transition(
        'waiting_author_choice',
        { type: 'CHOOSE', possibilityId: 'invalid-id' }
      );
      expect(state.value).toBe('waiting_author_choice');
      expect(state.context.error).toMatch(/invalid_possibility/);
    });

    it('TC-SM-015: choice + RETRY → generating_possibilities', async () => {
      const machine = createNarrativeMachine({
        context: { possibilities: [{ id: 'p1' }], retryCount: 0 }
      });
      const state = machine.transition(
        'waiting_author_choice',
        { type: 'RETRY' }
      );
      expect(state.value).toBe('generating_possibilities');
      expect(state.context.possibilities).toBeNull();  // 清除旧可能性
      expect(state.context.retryCount).toBe(1);
    });

    it('TC-SM-016: choice + ABANDON → idle', async () => {
      const machine = createNarrativeMachine({
        context: { possibilities: [...], worldId: 'w1' }
      });
      const state = machine.transition(
        'waiting_author_choice',
        { type: 'ABANDON' }
      );
      expect(state.value).toBe('idle');
      expect(state.context.possibilities).toBeNull();
      expect(state.context.selectedPossibility).toBeNull();
      expect(state.context.retryCount).toBe(0);
    });

    it('TC-SM-017: choice + REFRESH → 重新加载可能性（不重新生成）', async () => {
      const machine = createNarrativeMachine({
        context: { possibilities: [{ id: 'p1', title: '旧标题' }] }
      });
      const state = machine.transition(
        'waiting_author_choice',
        { type: 'REFRESH' }
      );
      expect(state.value).toBe('waiting_author_choice');
      // 从数据库重新加载，不调用LLM
    });
  });

  // --- 测试用例 18-24：generating_brief 状态 ---
  describe('State: generating_brief', () => {
    
    it('TC-SM-018: brief_gen + BRIEF_COMPLETE → waiting_author_approval', async () => {
      const brief = {
        title: '荒坂塔的阴影',
        scenes: [{ id: 's1', title: '潜入' }],
        narrativeArc: 'rising_action'
      };
      const machine = createNarrativeMachine({
        context: { selectedPossibility: 'p1', briefRetryCount: 0 }
      });
      const state = machine.transition(
        'generating_brief',
        { type: 'BRIEF_COMPLETE', brief }
      );
      expect(state.value).toBe('waiting_author_approval');
      expect(state.context.currentBrief).toEqual(brief);
    });

    it('TC-SM-019: brief_gen + BRIEF_ERROR（首次）→ brief_gen（重试）', async () => {
      const machine = createNarrativeMachine({
        context: { briefRetryCount: 0, maxBriefRetries: 3 }
      });
      const state = machine.transition(
        'generating_brief',
        { type: 'BRIEF_ERROR', error: new Error('Parse error') }
      );
      expect(state.value).toBe('generating_brief');
      expect(state.context.briefRetryCount).toBe(1);
    });

    it('TC-SM-020: brief_gen + BRIEF_ERROR（max reached）→ error_recovery', async () => {
      const machine = createNarrativeMachine({
        context: { briefRetryCount: 2, maxBriefRetries: 3 }
      });
      const state = machine.transition(
        'generating_brief',
        { type: 'BRIEF_ERROR', error: new Error('Parse error') }
      );
      expect(state.value).toBe('error_recovery');
      expect(state.context.previousState).toBe('generating_brief');
    });

    it('TC-SM-021: brief_gen + CANCEL → waiting_author_choice', async () => {
      const machine = createNarrativeMachine({
        context: { possibilities: [{ id: 'p1' }] }
      });
      const state = machine.transition('generating_brief', { type: 'CANCEL' });
      expect(state.value).toBe('waiting_author_choice');
      expect(state.context.currentBrief).toBeNull();
    });

    it('TC-SM-022: brief_gen 进入时应注入revision feedback', async () => {
      const machine = createNarrativeMachine({
        context: { revisionFeedback: 'make it darker' }
      });
      // 验证进入action正确设置了feedback
    });
  });

  // --- 测试用例 23-29：waiting_author_approval 状态 ---
  describe('State: waiting_author_approval', () => {
    
    it('TC-SM-023: approval + APPROVE → publishing', async () => {
      const machine = createNarrativeMachine({
        context: { currentBrief: { title: 'Test' } }
      });
      const state = machine.transition('waiting_author_approval', { type: 'APPROVE' });
      expect(state.value).toBe('publishing');
      expect(state.context.approvedAt).toBeInstanceOf(Date);
    });

    it('TC-SM-024: approval + APPROVE（无brief）→ approval（守卫拒绝）', async () => {
      const machine = createNarrativeMachine({
        context: { currentBrief: null }
      });
      const state = machine.transition('waiting_author_approval', { type: 'APPROVE' });
      expect(state.value).toBe('waiting_author_approval');
    });

    it('TC-SM-025: approval + REVISE → generating_brief', async () => {
      const machine = createNarrativeMachine({
        context: { currentBrief: { title: 'Old' }, revisionCount: 0 }
      });
      const state = machine.transition(
        'waiting_author_approval',
        { type: 'REVISE', feedback: 'add more tension' }
      );
      expect(state.value).toBe('generating_brief');
      expect(state.context.revisionFeedback).toBe('add more tension');
      expect(state.context.revisionCount).toBe(1);
    });

    it('TC-SM-026: approval + REVISE（第3次）→ FlowGuardian', async () => {
      const machine = createNarrativeMachine({
        context: { revisionCount: 2 }
      });
      const state = machine.transition(
        'waiting_author_approval',
        { type: 'REVISE', feedback: 'still not right' }
      );
      expect(state.value).toBe('flow_guardian');
      expect(state.context.flowGuardianTriggered).toBe(true);
    });

    it('TC-SM-027: approval + RESELECT → generating_possibilities', async () => {
      const machine = createNarrativeMachine({
        context: { possibilities: [...], selectedPossibility: 'p1' }
      });
      const state = machine.transition('waiting_author_approval', { type: 'RESELECT' });
      expect(state.value).toBe('generating_possibilities');
      expect(state.context.selectedPossibility).toBeNull();
      expect(state.context.currentBrief).toBeNull();
    });

    it('TC-SM-028: approval + SAVE_DRAFT → approval（保存但不推进）', async () => {
      const machine = createNarrativeMachine();
      const state = machine.transition('waiting_author_approval', { type: 'SAVE_DRAFT' });
      expect(state.value).toBe('waiting_author_approval');
      // 验证brief被保存到数据库
    });
  });

  // --- 测试用例 29-32：publishing 状态 ---
  describe('State: publishing', () => {
    
    it('TC-SM-029: publishing + PUBLISH_SUCCESS → completed', async () => {
      const machine = createNarrativeMachine({
        context: { currentBrief: { title: 'Final' }, worldId: 'w1' }
      });
      const state = machine.transition(
        'publishing',
        { type: 'PUBLISH_SUCCESS', snapshot: { id: 'snap-1', state: {} } }
      );
      expect(state.value).toBe('completed');
      expect(state.context.publishedSnapshot.id).toBe('snap-1');
      expect(state.context.completedAt).toBeInstanceOf(Date);
    });

    it('TC-SM-030: publishing + PUBLISH_FAIL → error_recovery', async () => {
      const machine = createNarrativeMachine();
      const state = machine.transition(
        'publishing',
        { type: 'PUBLISH_FAIL', error: new Error('DB write failed') }
      );
      expect(state.value).toBe('error_recovery');
      expect(state.context.previousState).toBe('publishing');
    });
  });

  // --- 测试用例 31-35：error_recovery 状态 ---
  describe('State: error_recovery', () => {
    
    it('TC-SM-031: recovery + RESET → idle', async () => {
      const machine = createNarrativeMachine({
        context: { previousState: 'generating_brief', lastError: 'timeout' }
      });
      const state = machine.transition('error_recovery', { type: 'RESET' });
      expect(state.value).toBe('idle');
      expect(state.context).toEqual(expect.objectContaining(initialContext));
    });

    it('TC-SM-032: recovery + RETRY_NOW → previous_state', async () => {
      const machine = createNarrativeMachine({
        context: { previousState: 'generating_brief' }
      });
      const state = machine.transition('error_recovery', { type: 'RETRY_NOW' });
      expect(state.value).toBe('generating_brief');
    });

    it('TC-SM-033: recovery + CONTACT_SUPPORT → 发送支持请求', async () => {
      const machine = createNarrativeMachine();
      const state = machine.transition('error_recovery', { type: 'CONTACT_SUPPORT' });
      // 验证支持请求被记录
    });
  });

  // --- FlowGuardian 状态 ---
  describe('State: flow_guardian', () => {
    
    it('TC-SM-034: guardian + DIVERGE → generating_possibilities', async () => {
      const machine = createNarrativeMachine({
        context: { revisionCount: 3 }
      });
      const state = machine.transition('flow_guardian', { type: 'DIVERGE' });
      expect(state.value).toBe('generating_possibilities');
      expect(state.context.revisionCount).toBe(0);  // 重置
    });

    it('TC-SM-035: guardian + REFINE → generating_brief', async () => {
      const machine = createNarrativeMachine({
        context: { revisionCount: 3 }
      });
      const state = machine.transition(
        'flow_guardian',
        { type: 'REFINE', specificFeedback: 'focus on character X' }
      );
      expect(state.value).toBe('generating_brief');
      expect(state.context.refinementMode).toBe(true);
    });
  });
});
```

### 4.2 数据库测试用例（20个）

```typescript
// tests/integration/database/core-operations.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, insertWorld, insertCharacter } from '@tests/setup/db-container';
import { WorldRepository } from '@/repositories/world.repository';

describe('Database - Core Operations', () => {
  let worldRepo: WorldRepository;

  beforeEach(async () => {
    await resetDatabase();
    worldRepo = new WorldRepository();
  });

  // ===== CRUD 测试（10个）=====

  it('TC-DB-001: World.create 应插入记录并返回带ID的实体', async () => {
    const world = await worldRepo.create({
      name: '赛博朋克2077',
      genre: 'scifi',
      theme: 'corporate_war',
      description: 'A dystopian future',
    });
    expect(world.id).toMatch(/^[0-9a-f-]{36}$/); // UUID
    expect(world.createdAt).toBeInstanceOf(Date);
    expect(world.status).toBe('draft');
  });

  it('TC-DB-002: World.create 重复名称应抛出唯一性错误', async () => {
    await worldRepo.create({ name: 'TestWorld', genre: 'fantasy' });
    await expect(
      worldRepo.create({ name: 'TestWorld', genre: 'scifi' })
    ).rejects.toThrow(/unique.*constraint/i);
  });

  it('TC-DB-003: World.findById 应返回完整世界数据', async () => {
    const created = await worldRepo.create({ name: 'FindTest', genre: 'horror' });
    const found = await worldRepo.findById(created.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('FindTest');
    expect(found!.genre).toBe('horror');
  });

  it('TC-DB-004: World.findById 不存在应返回null', async () => {
    const found = await worldRepo.findById('00000000-0000-0000-0000-000000000000');
    expect(found).toBeNull();
  });

  it('TC-DB-005: World.update 应修改指定字段', async () => {
    const created = await worldRepo.create({ name: 'UpdateTest', genre: 'fantasy' });
    const updated = await worldRepo.update(created.id, { theme: 'dragon_awakening' });
    expect(updated.theme).toBe('dragon_awakening');
    expect(updated.name).toBe('UpdateTest'); // 未修改字段不变
    expect(updated.updatedAt!.getTime()).toBeGreaterThan(created.createdAt.getTime());
  });

  it('TC-DB-006: World.delete 应软删除', async () => {
    const created = await worldRepo.create({ name: 'DeleteTest', genre: 'noir' });
    const deleted = await worldRepo.delete(created.id);
    expect(deleted.deletedAt).toBeInstanceOf(Date);
    const found = await worldRepo.findById(created.id);
    expect(found).toBeNull(); // 默认查询不应返回
  });

  it('TC-DB-007: World.list 应支持分页', async () => {
    await Promise.all(Array.from({ length: 25 }, (_, i) =>
      worldRepo.create({ name: `World-${i}`, genre: 'test' })
    ));
    const page1 = await worldRepo.list({ limit: 10, offset: 0 });
    const page2 = await worldRepo.list({ limit: 10, offset: 10 });
    expect(page1.items).toHaveLength(10);
    expect(page2.items).toHaveLength(10);
    expect(page1.total).toBe(25);
    expect(page1.items[0].id).not.toBe(page2.items[0].id);
  });

  it('TC-DB-008: Character.create 应在世界中创建角色', async () => {
    const world = await worldRepo.create({ name: 'CharTest', genre: 'fantasy' });
    const charRepo = new CharacterRepository();
    const char = await charRepo.create({
      worldId: world.id,
      name: 'V',
      role: 'mercenary',
      powerLevel: 75,
      relationships: { ally: ['char2'], enemy: ['char3'] },
    });
    expect(char.worldId).toBe(world.id);
    expect(char.relationships.ally).toContain('char2');
  });

  it('TC-DB-009: Character.create 外键不存在的world应报错', async () => {
    const charRepo = new CharacterRepository();
    await expect(charRepo.create({
      worldId: '00000000-0000-0000-0000-000000000000',
      name: 'Orphan',
    })).rejects.toThrow(/foreign key/i);
  });

  it('TC-DB-010: Character.findByWorld 应只返回该世界的角色', async () => {
    const w1 = await worldRepo.create({ name: 'W1', genre: 'test' });
    const w2 = await worldRepo.create({ name: 'W2', genre: 'test' });
    const charRepo = new CharacterRepository();
    await charRepo.create({ worldId: w1.id, name: 'C1' });
    await charRepo.create({ worldId: w1.id, name: 'C2' });
    await charRepo.create({ worldId: w2.id, name: 'C3' });
    const chars = await charRepo.findByWorld(w1.id);
    expect(chars).toHaveLength(2);
    expect(chars.every(c => c.worldId === w1.id)).toBe(true);
  });

  // ===== 约束测试（5个）=====

  it('TC-DB-011: power_level CHECK约束应拒绝超出0-100的值', async () => {
    const world = await worldRepo.create({ name: 'ConstraintTest', genre: 'test' });
    const charRepo = new CharacterRepository();
    await expect(charRepo.create({
      worldId: world.id, name: 'TooStrong', powerLevel: 150,
    })).rejects.toThrow(/check constraint/i);
    await expect(charRepo.create({
      worldId: world.id, name: 'TooWeak', powerLevel: -10,
    })).rejects.toThrow(/check constraint/i);
  });

  it('TC-DB-012: probability CHECK约束应在0-1范围内', async () => {
    const world = await worldRepo.create({ name: 'ProbTest', genre: 'test' });
    const possRepo = new PossibilityRepository();
    await expect(possRepo.create({
      worldId: world.id, title: 'Invalid', probability: 1.5,
    })).rejects.toThrow(/check constraint/i);
  });

  it('TC-DB-013: NOT NULL约束应拒绝null值', async () => {
    await expect(worldRepo.create({ name: null as any, genre: 'test' }))
      .rejects.toThrow(/not null/i);
  });

  it('TC-DB-014: 唯一索引应拒绝重复slug', async () => {
    await worldRepo.create({ name: 'First', slug: 'my-world' });
    await expect(worldRepo.create({ name: 'Second', slug: 'my-world' }))
      .rejects.toThrow(/unique/i);
  });

  it('TC-DB-015: JSONB字段应正确存储和查询', async () => {
    const world = await worldRepo.create({ name: 'JsonTest', genre: 'test' });
    const charRepo = new CharacterRepository();
    const complex = {
      skills: ['hacking', 'combat'],
      inventory: [{ item: 'katana', damage: 50 }],
      flags: { isAwakened: true },
    };
    const char = await charRepo.create({
      worldId: world.id, name: 'Complex', attributes: complex,
    });
    const found = await charRepo.findById(char.id);
    expect(found.attributes.skills).toContain('hacking');
    expect(found.attributes.inventory[0].damage).toBe(50);
  });

  // ===== 事务测试（3个）=====

  it('TC-DB-016: 事务应在全部成功时提交', async () => {
    const result = await worldRepo.transaction(async (trx) => {
      const w = await trx.create({ name: 'TrxTest', genre: 'test' });
      const c = await trx.characters.create({ worldId: w.id, name: 'TrxChar' });
      return { world: w, character: c };
    });
    expect(result.world.id).toBeDefined();
    expect(result.character.worldId).toBe(result.world.id);
    // 验证都持久化了
    const found = await worldRepo.findById(result.world.id);
    expect(found).not.toBeNull();
  });

  it('TC-DB-017: 事务应在任何失败时回滚', async () => {
    await worldRepo.create({ name: 'RollbackTest', genre: 'test' });
    await expect(
      worldRepo.transaction(async (trx) => {
        await trx.create({ name: 'ShouldNotExist', genre: 'test' });
        throw new Error('Intentional failure');
      })
    ).rejects.toThrow('Intentional failure');
    // 验证第一条没有持久化
    const found = await worldRepo.findByName('ShouldNotExist');
    expect(found).toBeNull();
  });

  it('TC-DB-018: 并发事务应正确处理冲突', async () => {
    const world = await worldRepo.create({ name: 'ConflictTest', genre: 'test', version: 0 });
    // 模拟两个并发更新
    const [result1, result2] = await Promise.allSettled([
      worldRepo.updateWithVersion(world.id, { version: 1 }, 0),
      worldRepo.updateWithVersion(world.id, { version: 1 }, 0),
    ]);
    // 只有一个应该成功
    const successes = [result1, result2].filter(r => r.status === 'fulfilled');
    expect(successes).toHaveLength(1);
    const failures = [result1, result2].filter(r => r.status === 'rejected');
    expect(failures).toHaveLength(1);
  });

  // ===== pgvector 测试（2个）=====

  it('TC-DB-019: pgvector 应正确存储和检索向量', async () => {
    const embedRepo = new EmbeddingRepository();
    const vector = Array(1536).fill(0).map(() => Math.random());
    const embedding = await embedRepo.create({
      entityId: 'test-entity',
      entityType: 'character',
      embedding: vector,
    });
    expect(embedding.embedding).toHaveLength(1536);
    // 检索自身应该最相似
    const similar = await embedRepo.similaritySearch(vector, 1);
    expect(similar[0].entityId).toBe('test-entity');
    expect(similar[0].similarity).toBeGreaterThan(0.99);
  });

  it('TC-DB-020: pgvector 应按相似度排序返回结果', async () => {
    const embedRepo = new EmbeddingRepository();
    // 插入3个不同的向量
    const v1 = Array(1536).fill(0).map((_, i) => (i === 0 ? 1 : 0));
    const v2 = Array(1536).fill(0).map((_, i) => (i === 0 ? 0.8 : 0));
    const v3 = Array(1536).fill(0).map((_, i) => (i === 0 ? 0.5 : 0));
    await embedRepo.create({ entityId: 'e1', entityType: 'test', embedding: v1 });
    await embedRepo.create({ entityId: 'e2', entityType: 'test', embedding: v2 });
    await embedRepo.create({ entityId: 'e3', entityType: 'test', embedding: v3 });
    // 用v1查询，应该e1最相似
    const results = await embedRepo.similaritySearch(v1, 3);
    expect(results[0].entityId).toBe('e1');
    expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
  });
});
```

### 4.3 LLM集成测试用例（10个）

```typescript
// tests/integration/llm/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMClient } from '@/tools/llm-client';
import { server } from '@tests/mocks/msw-server';
import { http, HttpResponse } from 'msw';

describe('LLM Integration', () => {
  let client: LLMClient;

  beforeEach(() => {
    client = new LLMClient({
      apiKey: 'test-key',
      baseUrl: 'http://localhost:3001/mock/anthropic',
      model: 'claude-sonnet-4-20250514',
      maxRetries: 3,
      timeout: 5000,
    });
  });

  it('TC-LLM-001: 正常调用应返回结构化响应', async () => {
    const response = await client.send({
      messages: [{ role: 'user', content: 'generate_possibilities for scifi world' }],
    });
    expect(response.content).toBeDefined();
    expect(response.usage.inputTokens).toBeGreaterThan(0);
    expect(response.usage.outputTokens).toBeGreaterThan(0);
  });

  it('TC-LLM-002: Token预算检查应在API调用前执行', async () => {
    const oversizedPrompt = 'x'.repeat(100000); // 远超预算
    await expect(client.send({
      messages: [{ role: 'user', content: oversizedPrompt }],
      maxInputTokens: 1000,
    })).rejects.toThrow(/token budget exceeded/i);
  });

  it('TC-LLM-003: 超时应自动重试并最终成功', async () => {
    let callCount = 0;
    server.use(
      http.post('*', async () => {
        callCount++;
        if (callCount < 3) {
          await delay(10000); // 超时
        }
        return HttpResponse.json({ content: 'success after retries', usage: { input_tokens: 10, output_tokens: 5 } });
      })
    );
    const response = await client.send({ messages: [{ role: 'user', content: 'test' }] });
    expect(callCount).toBe(3);
    expect(response.content).toBe('success after retries');
  });

  it('TC-LLM-004: 连续失败达到maxRetries应放弃', async () => {
    server.use(
      http.post('*', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );
    await expect(client.send({ messages: [{ role: 'user', content: 'test' }] }))
      .rejects.toThrow(/max retries exceeded/i);
  });

  it('TC-LLM-005: 速率限制(429)应指数退避重试', async () => {
    let callCount = 0;
    const delays: number[] = [];
    server.use(
      http.post('*', () => {
        callCount++;
        delays.push(Date.now());
        if (callCount < 3) {
          return new HttpResponse(JSON.stringify({ error: 'rate limited' }), {
            status: 429,
            headers: { 'retry-after': '1' },
          });
        }
        return HttpResponse.json({ content: 'ok', usage: { input_tokens: 10, output_tokens: 5 } });
      })
    );
    const start = Date.now();
    await client.send({ messages: [{ role: 'user', content: 'test' }] });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThan(2000); // 至少2秒（1s + 2s退避）
  });

  it('TC-LLM-006: 流式响应应逐块返回', async () => {
    const chunks: string[] = [];
    for await (const chunk of client.stream({
      messages: [{ role: 'user', content: 'stream test' }],
    })) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe('Hello world!');
  });

  it('TC-LLM-007: 流式中断应抛出AbortError', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100); // 100ms后中断
    const chunks: string[] = [];
    await expect(async () => {
      for await (const chunk of client.stream({
        messages: [{ role: 'user', content: 'long stream' }],
        signal: controller.signal,
      })) {
        chunks.push(chunk);
      }
    }).rejects.toThrow(/abort/i);
  });

  it('TC-LLM-008: 不同模型应调用不同endpoint', async () => {
    const opusClient = new LLMClient({ model: 'claude-opus-4' });
    const sonnetClient = new LLMClient({ model: 'claude-sonnet-4' });
    // 验证endpoint不同
    expect(opusClient.endpoint).not.toBe(sonnetClient.endpoint);
  });

  it('TC-LLM-009: 响应解析失败应包装为ParseError', async () => {
    server.use(
      http.post('*', () => {
        return HttpResponse.json({
          content: [{ type: 'text', text: 'invalid json {' }]
        });
      })
    );
    await expect(client.send({ messages: [{ role: 'user', content: 'test' }] }))
      .rejects.toThrow(/failed to parse/i);
  });

  it('TC-LLM-010: 成本追踪应累计到session', async () => {
    await client.send({ messages: [{ role: 'user', content: 'call 1' }] });
    await client.send({ messages: [{ role: 'user', content: 'call 2' }] });
    await client.send({ messages: [{ role: 'user', content: 'call 3' }] });
    const stats = client.getSessionStats();
    expect(stats.totalCalls).toBe(3);
    expect(stats.totalInputTokens).toBeGreaterThan(0);
    expect(stats.totalCostUSD).toBeGreaterThan(0);
  });
});
```

### 4.4 审批流程测试用例（8个）

```typescript
// tests/integration/approval-flow/full-cycle.test.ts
import { describe, it, expect, vi } from 'vitest';
import { NarrativeOrchestrator } from '@/orchestrator/narrative.orchestrator';

describe('Approval Flow - Full Cycle', () => {
  let orchestrator: NarrativeOrchestrator;

  beforeEach(() => {
    orchestrator = new NarrativeOrchestrator({
      llmClient: createMockLLMClient(),
      db: createTestDatabase(),
    });
  });

  // ===== 正常审批流程 =====

  it('TC-AF-001: 正常审批流程（一次通过）', async () => {
    // Step 1: 创建世界
    const world = await orchestrator.createWorld({ name: 'ApprovalTest', genre: 'scifi' });
    expect(world.status).toBe('draft');

    // Step 2: 触发GENERATE
    orchestrator.send({ type: 'GENERATE', worldId: world.id });
    await waitForState('waiting_author_choice');
    expect(orchestrator.getState().context.possibilities).toHaveLength(3);

    // Step 3: 选择可能性
    const possId = orchestrator.getState().context.possibilities[0].id;
    orchestrator.send({ type: 'CHOOSE', possibilityId: possId });
    await waitForState('waiting_author_approval');
    expect(orchestrator.getState().context.currentBrief).toBeDefined();

    // Step 4: 审批通过
    orchestrator.send({ type: 'APPROVE' });
    await waitForState('completed');
    expect(orchestrator.getState().context.completedAt).toBeInstanceOf(Date);

    // 验证世界状态已更新
    const updated = await orchestrator.db.worlds.findById(world.id);
    expect(updated.status).toBe('published');
    expect(updated.latestSnapshotId).toBeDefined();
  });

  it('TC-AF-002: 修订一次后通过', async () => {
    // 到waiting_author_approval
    await orchestrator.setupToState('waiting_author_approval');

    // 第一次REVISE
    orchestrator.send({ type: 'REVISE', feedback: 'add more tension' });
    await waitForState('waiting_author_approval');
    expect(orchestrator.getState().context.revisionCount).toBe(1);

    // 审批通过
    orchestrator.send({ type: 'APPROVE' });
    await waitForState('completed');
    expect(orchestrator.getState().value).toBe('completed');
  });

  // ===== Oracle触发测试 =====

  it('TC-AF-003: 连续3次RETRY在possibility生成时触发Oracle', async () => {
    // Mock LLM连续失败
    orchestrator.mockLLM({ failCount: 10 });

    orchestrator.send({ type: 'GENERATE', worldId: 'test' });

    // 第一次失败 → 自动重试（retryCount=1）
    await waitForState('generating_possibilities');
    // 第二次失败 → 自动重试（retryCount=2）
    // 第三次失败 → error_recovery + Oracle
    await waitForState('error_recovery', { timeout: 30000 });

    const ctx = orchestrator.getState().context;
    expect(ctx.oracleTriggered).toBe(true);
    expect(ctx.retryCount).toBe(3);
  });

  it('TC-AF-004: Oracle触发后可RESET重新开始', async () => {
    await orchestrator.setupToState('error_recovery');
    expect(orchestrator.getState().context.oracleTriggered).toBe(true);

    orchestrator.send({ type: 'RESET' });
    await waitForState('idle');

    const ctx = orchestrator.getState().context;
    expect(ctx.worldId).toBeNull();
    expect(ctx.possibilities).toBeNull();
    expect(ctx.retryCount).toBe(0);
    expect(ctx.oracleTriggered).toBe(false);
  });

  // ===== FlowGuardian触发测试 =====

  it('TC-AF-005: 连续3次REVISE触发FlowGuardian', async () => {
    await orchestrator.setupToState('waiting_author_approval');

    // 连续3次REVISE
    for (let i = 0; i < 3; i++) {
      orchestrator.send({ type: 'REVISE', feedback: `revision ${i + 1}` });
      if (i < 2) {
        await waitForState('waiting_author_approval');
      }
    }

    await waitForState('flow_guardian');
    expect(orchestrator.getState().context.flowGuardianTriggered).toBe(true);
    expect(orchestrator.getState().context.revisionCount).toBe(3);
  });

  it('TC-AF-006: FlowGuardian + DIVERGE → 重新生成可能性', async () => {
    await orchestrator.setupToState('flow_guardian');

    orchestrator.send({ type: 'DIVERGE' });
    await waitForState('generating_possibilities');

    const ctx = orchestrator.getState().context;
    expect(ctx.revisionCount).toBe(0);  // 重置
    expect(ctx.currentBrief).toBeNull(); // 清除当前brief
  });

  it('TC-AF-007: FlowGuardian + REFINE → 进入精炼模式生成', async () => {
    await orchestrator.setupToState('flow_guardian');

    orchestrator.send({ type: 'REFINE', specificFeedback: 'focus on the betrayal angle' });
    await waitForState('generating_brief');

    const ctx = orchestrator.getState().context;
    expect(ctx.refinementMode).toBe(true);
    expect(ctx.revisionFeedback).toBe('focus on the betrayal angle');
  });

  // ===== 异常恢复流程 =====

  it('TC-AF-008: 完整异常恢复流程（RETRY_NOW → 成功）', async () => {
    // 在publishing阶段模拟失败
    await orchestrator.setupToState('publishing');
    orchestrator.mockPublisher({ fail: true });

    orchestrator.send({ type: 'PUBLISH_CONFIRM' });
    await waitForState('error_recovery');
    expect(orchestrator.getState().context.previousState).toBe('publishing');

    // 修复问题后重试
    orchestrator.mockPublisher({ fail: false });
    orchestrator.send({ type: 'RETRY_NOW' });
    await waitForState('completed');
    expect(orchestrator.getState().value).toBe('completed');
  });
});
```

---


## 第19章 自动化测试流水线（本地+CI）

### 5.1 本地开发流水线

```bash
#!/bin/bash
# scripts/pre-commit-check.sh — 每次commit前运行

set -e  # 任何命令失败立即退出

echo "========== NarrativeOS 提交前检查 =========="

# 1. TypeScript编译检查（<5秒）
echo "[1/5] TypeScript编译检查..."
pnpm tsc --noEmit

# 2. ESLint检查（<5秒）
echo "[2/5] ESLint检查..."
pnpm eslint . --ext .ts,.tsx --max-warnings=0

# 3. 单元测试（<30秒）
echo "[3/5] 单元测试..."
pnpm test:unit --run

# 4. 数据库测试（<60秒）
echo "[4/5] 数据库测试..."
pnpm test:db --run

# 5. 检查console.log（<1秒）
echo "[5/5] 检查console.log..."
if grep -r "console\.log" src/ --include="*.ts" --include="*.tsx" | grep -v "logger.ts" | grep -v "test"; then
    echo "❌ 发现console.log残留，请使用logger代替"
    exit 1
fi

echo "✅ 所有检查通过！可以提交。"
```

```json
// package.json 测试脚本
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:db": "vitest run tests/integration/database",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:smoke": "vitest run tests/smoke",
    "test:state-machine": "vitest run tests/unit/state-machine",
    "test:coverage": "vitest run --coverage",
    "test:ci": "vitest run --coverage && playwright test",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "precommit": "bash scripts/pre-commit-check.sh",
    "test:watch": "vitest --watch"
  }
}
```

### 5.2 CI流水线（GitHub Actions）

```yaml
# .github/workflows/test.yml
name: Test Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # ===== 阶段1：快速检查 =====
  quick-check:
    name: Quick Check
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: TypeScript compile check
        run: pnpm typecheck

      - name: ESLint
        run: pnpm lint

      - name: Check for console.log
        run: |
          if grep -r "console\.log" src/ --include="*.ts" --include="*.tsx" | grep -v "logger.ts"; then
            echo "❌ Found console.log - use logger instead"
            exit 1
          fi

  # ===== 阶段2：单元测试 =====
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 5
    needs: quick-check
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit --run --reporter=verbose

  # ===== 阶段3：数据库测试 =====
  db-tests:
    name: Database Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: quick-check
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - name: Run DB tests with TestContainers
        run: pnpm test:db --run --reporter=verbose
        env:
          TESTCONTAINERS_RYUK_DISABLED: true

  # ===== 阶段4：集成测试 =====
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: [unit-tests, db-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:integration --run --reporter=verbose

  # ===== 阶段5：覆盖率 =====
  coverage:
    name: Coverage Report
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:coverage --run
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: true

  # ===== 阶段6：E2E测试 =====
  e2e-tests:
    name: E2E Tests (Playwright)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium firefox
      - name: Run E2E tests
        run: pnpm test:e2e
      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  # ===== 通知 =====
  notify:
    name: Notify
    runs-on: ubuntu-latest
    needs: [e2e-tests, coverage]
    if: always()
    steps:
      - name: Report status
        run: |
          if [ "${{ needs.e2e-tests.result }}" == "success" ] && [ "${{ needs.coverage.result }}" == "success" ]; then
            echo "✅ All tests passed"
          else
            echo "❌ Some tests failed"
            exit 1
          fi
```

### 5.3 流水线执行时间预算

| 阶段 | 超时设置 | 实际目标 | 失败策略 |
|------|----------|----------|----------|
| Quick Check | 5分钟 | <1分钟 | 立即阻断 |
| Unit Tests | 5分钟 | <30秒 | 阻断后续阶段 |
| DB Tests | 10分钟 | <60秒 | 阻断后续阶段 |
| Integration Tests | 10分钟 | <2分钟 | 阻断后续阶段 |
| Coverage | 10分钟 | <2分钟 | 不阻断但告警 |
| E2E Tests | 15分钟 | <5分钟 | 告警但不阻断合并 |

---


## 第20章 质量门禁（提交前+Phase交付）

### 6.1 提交前门禁（Pre-Commit）

```
┌──────────────────────────────────────────────────────────┐
│                  代码提交前必须通过                          │
├──────────────────────────────────────────────────────────┤
│ [✓] TypeScript编译零错误（tsc --noEmit）                 │
│ [✓] ESLint零错误（--max-warnings=0）                     │
│ [✓] 单元测试全部通过（tests/unit）                       │
│ [✓] 无console.log遗留代码                                │
│ [✓] 状态机相关测试覆盖100%                               │
│ [✓] git commit message符合规范                           │
└──────────────────────────────────────────────────────────┘
```

### 6.2 Phase交付门禁（Phase Gate）

每个Phase完成后，必须通过以下检查才能进入下一阶段：

```
┌─────────────────────────────────────────────────────────────────┐
│                    Phase交付质量门禁                              │
├─────────────────────────────────────────────────────────────────┤
│ 通用门禁（所有Phase）                                           │
│   [✓] 该Phase所有单元测试通过                                   │
│   [✓] 集成测试通过（涉及该Phase的模块）                         │
│   [✓] 数据库迁移可正常升级和回滚                                │
│   [✓] 代码覆盖率≥80%（状态机≥95%）                              │
│   [✓] 手动功能测试清单全部通过                                  │
├─────────────────────────────────────────────────────────────────┤
│ Phase 1 特殊门禁                                               │
│   [✓] 所有CRUD操作通过DB测试                                    │
│   [✓] 约束条件测试全部通过                                      │
│   [✓] pgvector相似度搜索返回正确结果                            │
├─────────────────────────────────────────────────────────────────┤
│ Phase 2 特殊门禁                                               │
│   [✓] LLM Mock测试全部通过                                      │
│   [✓] 错误处理覆盖所有错误类型                                  │
│   [✓] 日志结构化输出验证                                        │
├─────────────────────────────────────────────────────────────────┤
│ Phase 3 特殊门禁                                               │
│   [✓] 战力公式测试覆盖所有属性组合                              │
│   [✓] CSP因果推演无循环依赖泄漏                                 │
│   [✓] 极端数值不溢出/不崩溃                                   │
├─────────────────────────────────────────────────────────────────┤
│ Phase 4 特殊门禁                                               │
│   [✓] Prompt组装Token数≤预算                                   │
│   [✓] 上下文检索相关性排序正确                                  │
│   [✓] Brief生成输出符合JSON Schema                            │
├─────────────────────────────────────────────────────────────────┤
│ Phase 5 特殊门禁（最重要）                                     │
│   [✓] 状态转换全覆盖（@xstate/test路径覆盖=100%）              │
│   [✓] 所有守卫条件测试通过                                      │
│   [✓] 异常恢复流程测试通过                                      │
│   [✓] FlowGuardian触发条件测试通过                              │
│   [✓] Oracle触发条件测试通过                                    │
├─────────────────────────────────────────────────────────────────┤
│ Phase 6 特殊门禁                                               │
│   [✓] 组件渲染测试无警告                                        │
│   [✓] WebSocket连接/断开/重连正常                               │
│   [✓]  Lighthouse性能分数≥80                                   │
├─────────────────────────────────────────────────────────────────┤
│ 最终交付门禁（上线前）                                         │
│   [✓] E2E关键路径全部通过                                       │
│   [✓] 性能基准测试通过                                          │
│   [✓] LLM调用成本在预算内                                       │
│   [✓] 手动测试清单全部通过                                      │
│   [✓] 安全扫描无高危漏洞                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 代码覆盖率门禁

```typescript
// vitest.config.ts 覆盖率阈值
{
  coverage: {
    thresholds: {
      // 全局最低标准
      global: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      // 核心引擎 — 高要求
      'src/engine/': {
        branches: 90,
        functions: 95,
        lines: 95,
        statements: 95,
      },
      // 状态机 — 最高要求
      'src/state-machine/': {
        branches: 95,
        functions: 100,
        lines: 100,
        statements: 100,
      },
      // 数据层 — 高要求
      'src/repositories/': {
        branches: 85,
        functions: 90,
        lines: 90,
        statements: 90,
      },
      // 工具链
      'src/tools/': {
        branches: 80,
        functions: 85,
        lines: 85,
        statements: 85,
      },
    },
  },
}
```

---


## 第21章 手动测试清单

### 7.1 每个Phase交付后的手动检查

```markdown
## Phase 0 — 环境搭建
- [ ] 项目能在全新机器上`pnpm install`后运行
- [ ] 数据库Docker Compose一键启动成功
- [ ] `.env.example`包含所有必需变量
- [ ] 测试用`pnpm test`一键运行成功

## Phase 1 — 数据层
- [ ] 数据库迁移`pnpm db:migrate`成功
- [ ] 迁移回滚`pnpm db:rollback`成功
- [ ] pgvector扩展正常工作（向量插入+检索）
- [ ] 数据库备份/恢复脚本可用
- [ ] [手动] 使用pgAdmin/DBeaver查看表结构正确

## Phase 2 — 工具链
- [ ] LLM Mock响应与真实响应格式一致
- [ ] 错误日志在控制台清晰可读
- [ ] 日志文件正确轮转
- [ ] [手动] 临时禁用Mock，调用一次真实LLM验证连通性

## Phase 3 — 世界引擎
- [ ] 战力计算器与手工计算10组数据一致
- [ ] 因果推演结果符合直觉
- [ ] 大规模世界（100+实体）不卡顿
- [ ] [手动] 用已知世界观测试推演结果合理性

## Phase 4 — 工作室引擎
- [ ] 组装后的Prompt符合Anthropic API格式
- [ ] Token数估算与实际接近（误差<10%）
- [ ] 上下文检索返回相关实体
- [ ] [手动] 抽查3个Prompt，确认上下文完整

## Phase 5 — 协调层
- [ ] 状态转换图与文档一致
- [ ] 每个按钮触发正确的状态转换
- [ ] 异常场景（断网/超时）正确处理
- [ ] [手动] 完整走一遍：生成→选择→生成Brief→审批→发布
- [ ] [手动] 测试连续RETRY触发Oracle
- [ ] [手动] 测试连续REVISE触发FlowGuardian

## Phase 6 — 前端
- [ ] 在Chrome/Firefox/Safari正常显示
- [ ] 移动端响应式布局正常
- [ ] 深色模式切换正常
- [ ] WebSocket实时更新正常
- [ ] [手动] Lighthouse评分≥80
- [ ] [手动] 在低配设备上测试流畅度

## Phase 7+ — 集成
- [ ] 完整用户故事端到端流畅
- [ ] 性能指标达到基准
- [ ] LLM调用成本可控
- [ ] [手动] 模拟长时间使用无内存泄漏
- [ ] [手动] 多世界切换数据隔离正确
```

### 7.2 LLM输出质量评估清单（手动）

```markdown
## LLM输出质量检查（每次Prompt变更后）

### 可能性生成
- [ ] 输出是合法的JSON
- [ ] 每个可能性有id/title/probability/description
- [ ] probability在0-1之间且合理
- [ ] 可能性之间有区分度，不重复
- [ ] 与提供的世界设定一致
- [ ] 风格与genre匹配

### Brief生成
- [ ] 输出是合法的JSON
- [ ] 有title/scenes/narrativeArc
- [ ] scenes数量合理（3-7个）
- [ ] 每个scene有参与角色
- [ ] 场景之间有连贯性
- [ ] 与选中的可能性一致
- [ ] 阅读时间估计合理

### 修订响应
- [ ] 保留了之前版本的核心要素
- [ ] 针对feedback做了具体修改
- [ ] 没有引入与设定矛盾的内容
- [ ] 质量没有下降

### 安全性
- [ ] 无有害内容
- [ ] 无版权侵权内容
- [ ] 符合内容安全策略
```

---


## 第22章 性能基准

### 8.1 LLM调用延迟基准

```typescript
// tests/performance/llm-latency.bench.ts
import { bench, describe } from 'vitest';

describe('LLM Latency Benchmarks', () => {
  bench('possibility generation', async () => {
    await llmClient.send({
      messages: [{ role: 'user', content: generatePossibilityPrompt(testWorld) }],
    });
  }, {
    time: 1000,        // 至少运行1秒
    iterations: 10,    // 最少10次
  });

  bench('brief generation', async () => {
    await llmClient.send({
      messages: [{ role: 'user', content: generateBriefPrompt(testWorld, testPossibility) }],
    });
  }, { time: 1000, iterations: 10 });
});

// 基准指标（Mock环境）
const LLM_LATENCY_BUDGET = {
  possibilityGeneration: { TP50: 2000, TP90: 5000, TP99: 10000 },
  briefGeneration:       { TP50: 3000, TP90: 8000, TP99: 15000 },
  briefRevision:         { TP50: 2500, TP90: 6000, TP99: 12000 },
};
```

| 操作 | TP50目标 | TP90目标 | TP99目标 | 测试方法 |
|------|----------|----------|----------|----------|
| 可能性生成 | <2s | <5s | <10s | Mock LLM，100次采样 |
| Brief生成 | <3s | <8s | <15s | Mock LLM，100次采样 |
| Brief修订 | <2.5s | <6s | <12s | Mock LLM，100次采样 |
| 上下文检索 | <50ms | <100ms | <200ms | pgvector，10000向量 |

### 8.2 数据库查询性能基准

```typescript
// tests/performance/db-query.bench.ts
describe('Database Query Benchmarks', () => {
  bench('World.findById (hot cache)', async () => {
    await worldRepo.findById(cachedWorldId);
  }, { time: 1000 });

  bench('Character.findByWorld (100 chars)', async () => {
    await charRepo.findByWorld(worldWith100Chars);
  }, { time: 1000 });

  bench('pgvector.similaritySearch (10k vectors)', async () => {
    await embedRepo.similaritySearch(testVector, 10);
  }, { time: 5000 });

  bench('Snapshot.create (large state)', async () => {
    await snapshotRepo.create({ worldId, state: largeWorldState });
  }, { time: 1000 });
});
```

| 查询 | 数据量 | TP50目标 | TP90目标 | 测试方法 |
|------|--------|----------|----------|----------|
| World.findById | 1000 | <5ms | <10ms | 预热缓存后1000次 |
| Character.findByWorld | 100 | <10ms | <20ms | 1000次 |
| Possibility.findByWorld | 50 | <10ms | <20ms | 1000次 |
| pgvector similarity | 10000 | <50ms | <100ms | 100次 |
| Snapshot.create | 1MB state | <50ms | <100ms | 100次 |

### 8.3 前端渲染性能基准

```typescript
// tests/performance/frontend-render.bench.ts
describe('Frontend Render Benchmarks', () => {
  bench('App initial render', () => {
    render(<App />);
  }, { time: 1000, iterations: 50 });

  bench('WorldList with 50 items', () => {
    render(<WorldList worlds={generateWorlds(50)} />);
  }, { time: 1000, iterations: 50 });

  bench('PossibilityPanel with 20 items', () => {
    render(<PossibilityPanel possibilities={generatePossibilities(20)} />);
  }, { time: 1000, iterations: 50 });
});
```

| 场景 | TP50目标 | 测试方法 |
|------|----------|----------|
| App首屏渲染 | <500ms | Lighthouse slow 4G |
| WorldList 50项 | <300ms | React Profiler |
| BriefCard渲染 | <100ms | React Profiler |
| 状态更新响应 | <50ms | React Profiler |

### 8.4 内存泄漏检测

```typescript
// tests/performance/memory-leak.test.ts
describe('Memory Leak Detection', () => {
  it('WebSocket连接不应泄漏', async () => {
    const initialMemory = getHeapUsed();
    
    for (let i = 0; i < 50; i++) {
      const ws = new WebSocket(wsUrl);
      await waitForOpen(ws);
      ws.close();
      await waitForClose(ws);
      // 强制GC
      if (global.gc) global.gc();
    }
    
    const finalMemory = getHeapUsed();
    const growth = finalMemory - initialMemory;
    expect(growth).toBeLessThan(10 * 1024 * 1024); // <10MB增长
  });

  it('组件挂载/卸载不应泄漏', async () => {
    const initialMemory = getHeapUsed();
    
    for (let i = 0; i < 100; i++) {
      const { unmount } = render(<App />);
      unmount();
      if (global.gc) global.gc();
    }
    
    const finalMemory = getHeapUsed();
    const growth = finalMemory - initialMemory;
    expect(growth).toBeLessThan(5 * 1024 * 1024); // <5MB增长
  });
});
```

---



# 附录

## 附录 A. 每日晨间清单（可打印）

```
╔══════════════════════════════════════════════════════════════════╗
║                    每日晨间清单 — NarrativeOS 开发               ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  □ 环境检查 (2min)                                               ║
║    □ VSCode 打开项目                                             ║
║    □ 终端 WSL 环境就绪                                           ║
║    □ PostgreSQL 运行中:  make db-status                          ║
║    □ Git 状态干净:  git status                                   ║
║    □ 昨晚的变更已提交/暂存                                       ║
║                                                                  ║
║  □ Session 计划 (3min)                                           ║
║    □ 今天的开发目标: _________________                           ║
║    □ 属于哪个 Phase: _________________                           ║
║    □ 预计耗时: _____分钟                                         ║
║    □ 需要加载哪些设计文档: _________                           ║
║                                                                  ║
║  □ 加载上下文 (5min)                                             ║
║    □ 常驻上下文已就绪（架构+主权+数据库+接口+规范）              ║
║    □ 模块专属设计文档已复制到剪贴板                              ║
║    □ 上次 Session 的TODO已标注                                   ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

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

---

### 每日开始工作时（15 分钟）

来自《弹性裁剪路线》的最佳实践：

1. **回顾昨晚的 TODO**（2 分钟）：
   - 昨晚标注的 `TODO-NEXT` 在哪里？
   - 是否有一个清晰的下一步？

2. **设定今天的唯一目标**（3 分钟）：
   - 今天只有一个主要目标（如："完成战力计算系统"）
   - 如果只能做一件事，做哪件？

3. **加载上下文**（5 分钟）：
   - 将常驻上下文复制到 Claude Code
   - 告诉 Claude："今天我们要做..."

4. **写一个测试**（5 分钟）：
   - 先写今天目标对应的验收测试
   - 这个测试目前应该失败（TDD 模式）


## 附录 B. 每日晚间清单（可打印）

```
╔══════════════════════════════════════════════════════════════════╗
║                    每日晚间清单 — NarrativeOS 开发               ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  □ 提交检查 (5min)                                               ║
║    □ 代码编译通过:  make build                                   ║
║    □ 测试通过:  make test                                        ║
║    □ Lint通过:  make lint                                        ║
║    □ 没有 console.log 残留                                       ║
║                                                                  ║
║  □ 提交 (3min)                                                   ║
║    □ git add -p 选择性暂存                                       ║
║    □ 写有意义的 commit message                                   ║
║    □ git push                                                    ║
║                                                                  ║
║  □ 标注下一步 (5min)                                             ║
║    □ 在代码中标注 TODO-NEXT                                      ║
║    □ 记录今天的开发日志                                          ║
║    □ 写下明天的第一个任务                                        ║
║                                                                  ║
║  □ 更新追踪表 (2min)                                             ║
║    □ 实际工时 vs 预估工时                                        ║
║    □ 完成的功能点打勾                                            ║
║    □ 标记阻塞/风险项                                             ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

### 6.3 每天结束工作时（15 分钟）

```
晚间收尾清单：

[ ] git add -A
[ ] git commit -m "feat(模块): 今天做了什么"  # 约定式提交
[ ] git push origin $(git branch --show-current)
[ ] 更新 todo.md（今天做了什么/明天做什么）
[ ] 写一句话开发日志（log/DATE.md）
[ ] make stop                      # 关闭数据库（省内存）
```




## 附录 C. Claude Code Session启动模板（可复制）

> **每次新 Session 开始时，复制以下内容到 Claude Code，替换 {变量}。**

---

### 标准启动模板

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

## 上下文

参考以下设计文档：
@docs/extracts/architecture_brief.md
@docs/extracts/sovereignty_brief.md
@docs/extracts/database_core.md
@docs/extracts/interface_contracts.md
@docs/project_conventions.md
@docs/{DESIGN_DOC}

## 本次目标

**Phase**: {PHASE} — {PHASE_NAME}
**目标**: {TODAY_GOAL}
**预计耗时**: {ESTIMATED_TIME}

## 上次进度

{LAST_PROGRESS}

## 约束

- 绝对不要修改 {DONT_TOUCH}
- 必须保持与 {EXISTING_INTERFACE} 兼容
- 本次产出必须能通过: make test && make build && make lint
```

---

### 最小启动模板（快速开始）

```markdown
继续开发 NarrativeOS v3.0 {MODULE}模块。

上下文：
@docs/extracts/architecture_brief.md
@docs/extracts/sovereignty_brief.md
@docs/{DESIGN_DOC}

今天目标：{GOAL}。
上次进度：{PROGRESS}。

请实现 {TASK}，要求：
1. Zod Schema 校验
2. JSDoc 注释  
3. 单元测试覆盖
4. 通过 make test && make lint
```

---

### Session完整流程参考

> 以下摘录自第10章，完整内容请参考正文。

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
║  ┌──────────────────────────────────────────────────────────────
...（详见第10章完整内容）


## 附录 D. Git命令速查表

```
┌─────────────────────────────────────────────────────────────────┐
│                        Git 速查表                                │
├─────────────────────────────────────────────────────────────────┤
│  新功能                                                         │
│  git checkout -b feat/world-power-calc                          │
│                                                                 │
│  同步 main                                                      │
│  git fetch origin && git rebase origin/main                     │
│                                                                 │
│  合并（开发完成后）                                             │
│  git checkout main && git merge feat/xxx --no-ff                │
│                                                                 │
│  提交                                                           │
│  git add -p              # 选择性暂存                           │
│  git commit -m "feat(world): 实现战力计算"                      │
│  git push -u origin feat/xxx                                    │
│                                                                 │
│  回滚                                                           │
│  git reset --soft HEAD~1     # 撤销commit，保留修改             │
│  git reset --hard HEAD~1     # 彻底丢弃（慎用）                 │
│  git revert HEAD             # 新建反向commit                   │
│                                                                 │
│  Tag                                                            │
│  git tag -a v0.5.0 -m "M4: 完整闭环"                          │
│  git push origin --tags                                       │
│                                                                 │
│   stash（临时保存）                                             │
│  git stash push -m "临时保存"                                 │
│  git stash pop                                                │
│  git stash list                                               │
└─────────────────────────────────────────────────────────────────┘
```

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


## 附录 E. 测试命令速查表

```
┌─────────────────────────────────────────────────────────────────┐
│                     测试命令速查表                               │
├─────────────────────────────────────────────────────────────────┤
│  类型检查                                                       │
│  npx tsc --noEmit                                               │
│                                                                 │
│  Lint                                                           │
│  npx eslint src/ --ext .ts,.tsx                                 │
│                                                                 │
│  单元测试                                                       │
│  npx vitest run                                                 │
│  npx vitest run --reporter=verbose                              │
│                                                                 │
│  覆盖率                                                         │
│  npx vitest run --coverage                                      │
│                                                                 │
│  只测修改的文件                                                 │
│  npx vitest run --changed                                       │
│                                                                 │
│  测试特定文件                                                   │
│  npx vitest run src/services/world/power.test.ts                │
│                                                                 │
│  数据库测试                                                     │
│  npx vitest run --testNamePattern="DB"                          │
│                                                                 │
│  检查循环依赖                                                   │
│  npx madge --circular src/                                      │
│                                                                 │
│  检查 any 类型                                                  │
│  grep -r ": any" src/ --include="*.ts"                          │
│                                                                 │
│  E2E测试                                                        │
│  npx playwright test                                            │
│  npx playwright test --headed                                   │
│  npx playwright test --debug                                    │
│                                                                 │
│  预提交检查（一键）                                             │
│  ./scripts/pre-commit-check.sh                                  │
│                                                                 │
│  性能基准                                                       │
│  ./scripts/benchmark.sh                                         │
└─────────────────────────────────────────────────────────────────┘
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

---

### 测试配置速查

## 10. 附录：测试命令速查表

```
╔══════════════════════════════════════════════════════════════════╗
║                    测试命令速查表                                  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  日常开发                                                        ║
║  ─────────                                                       ║
║  pnpm test:watch          监视模式运行所有测试                    ║
║  pnpm test:unit:watch     监视模式运行单元测试                    ║
║  pnpm precommit           提交前完整检查                          ║
║                                                                  ║
║  特定模块测试                                                    ║
║  ─────────────                                                   ║
║  pnpm test:state-machine  状态机全覆盖测试                        ║
║  pnpm test:db             数据库测试（需Docker）                  ║
║  pnpm test:integration    集成测试                                ║
║  pnpm test:e2e            E2E测试（需dev server）                 ║
║  pnpm test:perf           性能基准测试                            ║
║                                                                  ║
║  覆盖率                                                          ║
║  ───────                                                         ║
║  pnpm test:coverage       生成覆盖率报告                          ║
║  pnpm test:coverage:html  生成并打开HTML报告                      ║
║                                      


## 附录 F. Prompt模板索引

> **完整模板内容见第9章。这里只放索引和快速使用指南。**

### 7套模板速查

| 模板 | 用途 | 典型使用场景 | 参考 |
|------|------|-------------|------|
| **模板A** — 新建模块 | 从零开始写一个服务/子引擎 | 新引擎开发 | 第9章 §2.1 |
| **模板B** — 修改修复 | 改已有代码、修复Bug | 需求变更、Bug修复 | 第9章 §2.2 |
| **模板C** — Schema变更 | 数据库变更全流程 | 新增表/字段 | 第9章 §2.3 |
| **模板D** — 添加测试 | 补测试覆盖 | 测试驱动开发 | 第9章 §2.4 |
| **模板E** — 重构优化 | 代码质量提升 | 技术债清理 | 第9章 §2.5 |
| **模板F** — 前端组件 | React组件开发 | UI开发 | 第9章 §2.6 |
| **模板G** — 调试排错 | 定位并修复问题 | 出Bug时 | 第9章 §2.7 |

### 快速填充指南

每个模板通用结构：
```
[角色设定] → 告诉Claude它是谁、遵循什么原则
[上下文注入] → @引用设计文档
[任务描述] → 具体要做什么
[输出要求] → 代码+测试+文档的格式
[约束条件] → 绝对不能做什么
[验收标准] → 怎样算完成
```

### 快捷Prompt速查卡

```markdown
# 快速生成 CRUD
新建 {ENTITY} 的完整 CRUD：
- Prisma Schema 定义
- Zod Schema（Create/Update/Patch）
- Repository 层
- Service 层
- REST API 路由
- 单元测试

# 快速生成组件
新建 React 组件 {ComponentName}：
- Props 接口 + Zod 校验
- 主组件实现
- Storybook 故事
- 单元测试
- 响应式支持

# 快速修复
修复 {BUG_DESCRIPTION}：
1. 先分析根因
2. 给出修复方案（不立即改代码）
3. 我确认后再实施
4. 写回归测试

# 快速审查
请审查以下代码的 P0/P1 问题：
- 第一公理合规性
- 类型安全性
- 错误处理完整性
- 架构一致性
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

> **以下为项目文件结构参考，完整内容见第1章 §1.3**

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


