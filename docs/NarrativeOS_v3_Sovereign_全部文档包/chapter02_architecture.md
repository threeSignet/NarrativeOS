# 第二章 系统架构设计（完整版）

> 文档版本：v3.0.0-Sovereign
> 适用系统：NarrativeOS v3.0 Sovereign（100万字+长篇网文创作系统）
> 编写日期：2025年

---

## 目录

- 2.1 分层架构总览
- 2.2 关键原则
- 2.3 技术栈完整选型
- 2.4 层间接口定义
- 2.5 服务层完整服务清单
- 2.6 引擎协作接口
- 2.7 数据流序列图
- 2.8 认证与授权机制
- 2.9 配置管理方案
- 2.10 日志与监控接口
- 2.11 错误处理策略
- 2.12 缓存策略
- 2.13 WebSocket实时通信设计
- 2.14 部署拓扑与扩展策略
- 附录A：接口索引表
- 附录B：错误码对照表
- 附录C：数据库Schema概要

---

## 2.1 分层架构总览

### 2.1.1 架构层次图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        作者交互界面层 (Presentation Layer)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────────────┐  │
│  │   Web SPA    │  │   CLI工具     │  │   VS Code 扩展 (未来)            │  │
│  │  (React 19)  │  │  (Node.js)   │  │                                 │  │
│  └──────┬───────┘  └──────┬───────┘  └─────────────────────────────────┘  │
└─────────┼─────────────────┼───────────────────────────────────────────────┘
          │                 │
          ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      协调层 (Orchestration Layer) — 薄层                   │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              XState v5 状态机 (MOU 协议引擎)                      │   │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │   │
│   │  │  MOU状态机 │  │ 权限校验器 │  │ 事件路由器 │  │ 会话生命周期管理器 │  │   │
│   │  │(主状态机)  │  │ (RBAC+ABAC)│  │          │  │                │  │   │
│   │  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Agent层 (Agent Shell Layer)                       │
│                                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │  世界引擎壳    │ │  工作室引擎壳  │ │    谏官壳    │ │ Flow Guardian│  │
│  │ (WorldShell) │ │ (StudioShell)│ │(CensorShell) │ │   (GuardShell)│  │
│  │              │ │              │ │              │ │              │  │
│  │ • 状态加载    │ │ • 状态加载   │ │ • 检查触发   │ │ • 心流计算    │  │
│  │ • Prompt构建  │ │ • Prompt构建 │ │ • 结果评估   │ │ • 异常检测    │  │
│  │ • 结果解析    │ │ • 结果解析   │ │ • 拦截决策   │ │ • 干预执行    │  │
│  │ • 副作用提交  │ │ • 提案提交   │ │ • 反馈生成   │ │ • 状态修正    │  │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘  │
└─────────┼─────────────────┼─────────────────┼─────────────────┼─────────┘
          │                 │                 │                 │
          ▼                 ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        服务层 (Service Layer) — 厚层                       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     8个世界子引擎                                 │    │
│  │  ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐ │    │
│  │  │ 地理引擎 ││ 势力引擎 ││ 人物引擎 ││ 事件引擎 ││ 规则引擎 ││ 伏笔引擎 │ │    │
│  │  │(GeoEng)││(FrcEng) ││(ChrEng)││(EvtEng)││(RulEng)││(FtnEng)│ │    │
│  │  └────────┘└────────┘└────────┘└────────┘└────────┘└────────┘ │    │
│  │  ┌────────┐┌────────┐                                           │    │
│  │  │ 时间引擎 ││ 知识引擎 │                                           │    │
│  │  │(TmlEng)││(KnoEng)│                                           │    │
│  │  └────────┘└────────┘                                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                   核心服务模块                                    │    │
│  │  ┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐ │    │
│  │  │Prompt组装 ││  质检服务  ││ 风险分析   ││ 心流计算   ││ 版本管理   │ │    │
│  │  │ Service  ││ Service  ││ Service  ││ Service  ││ Service  │ │    │
│  │  └──────────┘└──────────┘└──────────┘└──────────┘└──────────┘ │    │
│  │  ┌──────────┐┌──────────┐┌──────────┐┌──────────┐            │    │
│  │  │ 叙事评估   ││ 场景查询   ││ 代价共情化  ││ 涟漪计算   │            │    │
│  │  │ Service  ││ Service  ││ Service  ││ Service  │            │    │
│  │  └──────────┘└──────────┘└──────────┘└──────────┘            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        数据层 (Data Layer)                              │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ PostgreSQL 16     │  │  Redis 7.2   │  │    MinIO / S3 兼容存储    │  │
│  │  + pgvector 0.7+ │  │  (缓存/会话)  │  │    (文档/快照/备份)       │  │
│  │                  │  │              │  │                          │  │
│  │ • 核心业务数据    │  │ • 状态缓存   │  │ • 章节Markdown文件        │  │
│  │ • 向量嵌入       │  │ • 分布式锁   │  │ • 完整快照归档            │  │
│  │ • 全文检索       │  │ • 限流计数   │  │ • 导出产物                │  │
│  │ • JSONB灵活结构  │  │ • Pub/Sub   │  │                          │  │
│  └──────────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.1.2 层间通信契约

| 源层 | 目标层 | 通信方式 | 协议 | 数据格式 |
|------|--------|----------|------|----------|
| 界面层 | 协调层 | HTTP/WebSocket | REST + WS | JSON |
| 协调层 | Agent层 | 进程内调用 | 函数调用 | TypeScript对象 |
| Agent层 | 服务层 | HTTP/gRPC | 内部API | JSON/Protobuf |
| 服务层 | 数据层 | TCP | SQL/协议 | 数据库原生格式 |
| 服务层之间 | 服务层之间 | HTTP/gRPC | 内部API | JSON/Protobuf |

---

## 2.2 关键原则

### 2.2.1 薄协调层

状态机仅编排流程和权限校验。协调层代码量不得超过总行数的 5%。状态机中每个 `waiting_*` 状态必须阻塞等待明确的人类输入事件，不允许自动跳过。

### 2.2.2 服务无状态

所有引擎服务从数据库读取状态，输出提案，不持有私有副本。Agent壳可以持有内存中的会话上下文（当前章节内容、待处理提案），但必须在会话结束时释放或在心跳超时后清除。

### 2.2.3 单向数据流

```
世界引擎 ──(场景感知查询)──→ 工作室引擎
      ←────(只读查询)────┘

工作室引擎 ╳──(禁止)──→ 直接修改世界状态

正确的修改路径：
工作室引擎 ──(提案)──→ 协调层 ──(人类确认)──→ 世界引擎 ──(原子固化)──→ 数据库
```

### 2.2.4 原子固化

章节固化作为一个数据库事务，一次性写入：
- 实体变更（人物属性、势力关系、地理状态）
- 事件日志（章节内发生的事件）
- 伏笔更新（新埋设/回收的伏笔）
- 涟漪记录（因果传播条目）
- 版本快照（完整世界状态备份）

全部成功或全部回滚。事务隔离级别：`SERIALIZABLE`。

### 2.2.5 人类事件驱动

协调器每次状态转移必须由明确的人类事件触发。允许的人类事件类型：

```typescript
type HumanEvent =
  | { type: 'AUTHOR_APPROVE'; payload: { proposalId: string; notes?: string } }
  | { type: 'AUTHOR_REJECT'; payload: { proposalId: string; reason: string } }
  | { type: 'AUTHOR_MODIFY'; payload: { proposalId: string; modification: string } }
  | { type: 'AUTHOR_CONTINUE'; payload: { context?: string } }
  | { type: 'AUTHOR_PAUSE'; payload: { reason: string } }
  | { type: 'AUTHOR_OVERRIDE'; payload: { overrideType: string; justification: string } }
  | { type: 'AUTHOR_COMMAND'; payload: { command: string; args: Record<string, unknown> } }
  ;
```

---

## 2.3 技术栈完整选型

### 2.3.1 全局技术栈一览表

```
┌────────────────────┬──────────────────────────────┬─────────────────────────┐
│       层次         │           组件               │       技术选型           │
├────────────────────┼──────────────────────────────┼─────────────────────────┤
│ 界面层              │ Web前端框架                   │ React 19.0.0 + TypeScript 5.7 │
│                    │ 构建工具                      │ Vite 6.0+               │
│                    │ UI组件库                      │ Radix UI Primitives +   │
│                    │                               │ Tailwind CSS 3.4+       │
│                    │ 状态管理                      │ Zustand 4.5+            │
│                    │ 富文本编辑器                   │ TipTap / ProseMirror    │
│                    │ 终端UI（CLI）                 │ Ink 4.x (React for CLI) │
│                    │ 图表可视化                    │ D3.js 7.x + ECharts 5.x │
├────────────────────┼──────────────────────────────┼─────────────────────────┤
│ 协调层              │ 状态机引擎                    │ XState 5.x (@xstate/    │
│                    │                               │ react, @xstate/store)   │
│                    │ HTTP服务器                    │ Fastify 5.x             │
│                    │ WebSocket服务器               │ Socket.io 4.7+          │
│                    │ 验证框架                      │ Zod 3.23+               │
│                    │ 认证中间件                    │ @fastify/jwt 9.x        │
├────────────────────┼──────────────────────────────┼─────────────────────────┤
│ Agent层             │ AI SDK                        │ Vercel AI SDK 3.x       │
│                    │ LLM提供商抽象                 │ AI SDK适配器模式         │
│                    │ 流式处理                      │ AI SDK Streaming        │
│                    │ Prompt管理                    │ handlebars 4.x +        │
│                    │                               │ 自定义模板引擎           │
├────────────────────┼──────────────────────────────┼─────────────────────────┤
│ 服务层              │ 运行时环境                    │ Node.js 22 LTS          │
│                    │ 进程管理                      │ PM2 5.x / Docker        │
│                    │ 向量计算                      │ pgvector 0.7+           │
│                    │ 全文检索                      │ PostgreSQL tsvector +   │
│                    │                               │ pg_trgm                 │
│                    │ 任务队列                      │ BullMQ 5.x (Redis)      │
│                    │ 服务通信(可选)                │ gRPC 1.6+ (@grpc/       │
│                    │                               │ grpc-js)                │
├────────────────────┼──────────────────────────────┼─────────────────────────┤
│ 数据层              │ 关系数据库                    │ PostgreSQL 16.x         │
│                    │ 向量扩展                      │ pgvector 0.7.0+         │
│                    │ 缓存数据库                    │ Redis 7.2+              │
│                    │ 对象存储                      │ MinIO RELEASE.2024+     │
│                    │ 数据库迁移                    │ Drizzle ORM 0.30+       │
│                    │ 查询构建器                    │ Drizzle ORM / Kysely    │
├────────────────────┼──────────────────────────────┼─────────────────────────┤
│ 基础设施            │ 容器化                       │ Docker 25+ /            │
│                    │                               │ Docker Compose 2.24+    │
│                    │ 编排(生产)                    │ Kubernetes 1.29+        │
│                    │ 监控                         │ Prometheus 2.50+ +      │
│                    │                               │ Grafana 10.4+           │
│                    │ 日志收集                      │ Loki 2.9+               │
│                    │ 链路追踪                      │ Jaeger 1.55+            │
├────────────────────┼──────────────────────────────┼─────────────────────────┤
│ 开发工具            │ 包管理器                      │ pnpm 9.x                │
│                    │ 代码质量                      │ ESLint 9.x +            │
│                    │                               │ Prettier 3.2+           │
│                    │ 测试框架                      │ Vitest 2.x +            │
│                    │                               │ @testing-library/       │
│                    │                               │ react 16.x              │
│                    │ 类型安全                      │ TypeScript 5.7.x        │
│                    │ API文档                       │ Scalar / OpenAPI 3.1    │
└────────────────────┴──────────────────────────────┴─────────────────────────┘
```

### 2.3.2 关键依赖版本锁定

```json
{
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=9.0.0"
  },
  "dependencies": {
    "xstate": "^5.19.0",
    "@xstate/react": "^5.0.0",
    "@xstate/store": "^2.6.0",
    "fastify": "^5.2.0",
    "socket.io": "^4.8.0",
    "ai": "^3.4.0",
    "@ai-sdk/openai": "^1.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "drizzle-orm": "^0.38.0",
    "pg": "^8.13.0",
    "pgvector": "^0.2.0",
    "ioredis": "^5.4.0",
    "bullmq": "^5.34.0",
    "zod": "^3.24.0",
    "@fastify/jwt": "^9.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/websocket": "^11.0.0",
    "handlebars": "^4.7.8",
    "minio": "^8.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0",
    "eslint": "^9.17.0",
    "prettier": "^3.4.0",
    "drizzle-kit": "^0.30.0"
  }
}
```

### 2.3.3 各层技术选型详解

#### 2.3.3.1 界面层选型理由

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| React 19 | 19.0.0 | Concurrent Features、Server Components、自动批处理，适合大型SPA |
| TypeScript | 5.7.x | 严格类型检查、更好的类型推断、装饰器支持 |
| Vite | 6.0+ | 快速HMR、原生ESM、Rollup优化构建 |
| Zustand | 4.5+ | 极简API、无样板代码、支持异步流、TypeScript友好 |
| TipTap | 2.x | 基于ProseMirror、可扩展、协同编辑友好、Markdown支持 |
| Ink | 4.x | React组件模型构建CLI界面，与Web端共享逻辑 |
| Radix UI | 最新 | 无样式headless组件，完全可控的a11y |
| Tailwind CSS | 3.4+ | 原子化CSS、设计系统一致性、Tree-shaking |

#### 2.3.3.2 协调层选型理由

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| XState v5 | 5.19+ | Actor模型、类型安全、可视化工具、持久化/恢复能力 |
| Fastify | 5.2+ | 高性能（比Express快3倍）、Schema验证、插件生态 |
| Socket.io | 4.8+ | 可靠的双向通信、自动重连、房间机制、降级支持 |
| Zod | 3.24+ | 运行时类型验证、从Schema推断TypeScript类型、错误信息友好 |
| @fastify/jwt | 9.0+ | 与Fastify深度集成、RS256支持、自动刷新 |

#### 2.3.3.3 Agent层选型理由

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| Vercel AI SDK | 3.4+ | 统一LLM接口、流式处理、工具调用、多提供商抽象 |
| Handlebars | 4.7.8 | 逻辑less模板、预编译、服务端渲染友好、易于版本控制 |
| 自定义模板引擎 | - | Handlebars之上封装：变量注入、条件区块、循环、部分模板 |

#### 2.3.3.4 服务层选型理由

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| Node.js 22 LTS | 22.x | 长期支持、性能优化、原生Test Runner、改进的Watch模式 |
| Drizzle ORM | 0.38+ | TypeScript原生、类型安全查询、零运行时开销、迁移支持 |
| Kysely | 最新 | 类型安全SQL查询构建器，复杂查询首选 |
| BullMQ | 5.34+ | 基于Redis、支持延迟任务、可重复任务、优先级队列 |
| gRPC | 1.6+ | 高性能二进制协议、强类型接口定义、流式支持（服务间通信） |

#### 2.3.3.5 数据层选型理由

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| PostgreSQL 16 | 16.x | 性能提升、JSONB优化、逻辑复制改进、并行查询增强 |
| pgvector | 0.7+ | 向量存储与相似度搜索、与PostgreSQL原生集成、HNSW索引 |
| Redis 7.2 | 7.2+ | 数据结构丰富、Pub/Sub、RediSearch模块、持久化选项 |
| MinIO | 2024+ | S3兼容API、高性能对象存储、分布式部署、开源 |

---

## 2.4 层间接口定义

### 2.4.1 接口设计总则

1. **所有接口使用 TypeScript 类型定义**，运行时通过 Zod Schema 验证
2. **语义化版本控制**：接口版本号遵循 MAJOR.MINOR.PATCH，破坏性变更必须升级 MAJOR
3. **幂等性**：所有写入操作必须支持幂等键（`idempotencyKey`）
4. **超时策略**：同步接口默认 30 秒超时，流式接口 5 分钟心跳
5. **分页约定**：列表接口统一使用游标分页（Cursor-based），pageSize 默认 20，最大 100

### 2.4.2 界面层 ↔ 协调层 接口

#### REST API 接口

```typescript
// ============================================================
// 基础类型定义
// ============================================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

interface ApiError {
  code: string;           // 机器可读错误码
  message: string;        // 人类可读错误消息
  details?: Record<string, unknown>;
  requestId: string;      // 链路追踪ID
}

interface ResponseMeta {
  requestId: string;
  timestamp: string;      // ISO 8601
  pagination?: CursorPagination;
}

interface CursorPagination {
  nextCursor: string | null;
  prevCursor: string | null;
  pageSize: number;
  totalCount?: number;    // 可选，大数据集可能不返回
}

// ============================================================
// 项目(小说)管理接口
// ============================================================

// POST /api/v3/projects
// 创建新小说项目
interface CreateProjectRequest {
  title: string;                          // 2-100字符
  genre: string[];                        // 题材标签
  targetWordCount: number;                // 目标字数（万）
  summary?: string;                       // 初始大纲摘要
  worldSetting: WorldSettingSeed;         // 世界设定种子
  authorStyle?: AuthorStyleProfile;       // 作者风格档案
}

interface CreateProjectResponse {
  projectId: string;                      // UUID v4
  mouState: MouState;                     // 初始MOU状态
  createdAt: string;
  setupTasks: SetupTask[];                // 初始化任务列表
}

// GET /api/v3/projects/:projectId
// 获取项目概要
interface GetProjectResponse {
  projectId: string;
  title: string;
  genre: string[];
  currentState: MouState;
  wordCount: number;                      // 当前字数
  chapterCount: number;
  lastActivityAt: string;
  worldSnapshot: WorldSummary;
  pendingProposals: ProposalSummary[];
}

// ============================================================
// MOU 状态机交互接口
// ============================================================

// GET /api/v3/projects/:projectId/mou/state
// 获取当前MOU状态
interface GetMouStateResponse {
  currentState: MouState;                 // 当前状态标识符
  stateLabel: string;                     // 人类可读状态名
  availableTransitions: TransitionInfo[]; // 可用的状态转移
  context: MouContext;                    // 状态机上下文（脱敏）
  waitingFor: HumanInputRequirement | null; // 等待什么人类输入
  timeoutAt?: string;                     // 超时时间（如果有）
}

interface TransitionInfo {
  event: string;                          // 事件类型
  label: string;                          // 人类可读标签
  description: string;                    // 操作说明
  requiresPayload: boolean;               // 是否需要附加数据
  payloadSchema?: z.ZodTypeAny;           // 附加数据Schema
}

interface HumanInputRequirement {
  inputType: 'APPROVAL' | 'REJECTION' | 'MODIFICATION' | 'COMMAND' | 'FREE_TEXT';
  description: string;                    // 需要作者做什么
  pendingProposals?: ProposalDetail[];    // 待审阅的提案
  suggestedActions?: SuggestedAction[];   // 建议操作
}

// POST /api/v3/projects/:projectId/mou/event
// 向MOU状态机发送人类事件
interface SendMouEventRequest {
  eventType: HumanEventType;
  payload: HumanEventPayload;
  idempotencyKey: string;                 // UUID v4，防重复提交
}

interface SendMouEventResponse {
  accepted: boolean;
  previousState: MouState;
  currentState: MouState;
  transitions: StateTransition[];          // 触发的状态转移链
  sideEffects: SideEffect[];              // 副作用（需要前端处理的通知）
  streamTicket?: string;                  // 流式响应票据（如果进入生成状态）
}

interface StateTransition {
  from: MouState;
  to: MouState;
  triggeredBy: string;
  timestamp: string;
}

interface SideEffect {
  type: 'NOTIFICATION' | 'PROPOSAL_READY' | 'STREAM_START' | 'STATE_CHANGE' | 'ALERT';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data?: Record<string, unknown>;
}

// ============================================================
// 流式生成接口 (SSE)
// ============================================================

// GET /api/v3/projects/:projectId/stream/:streamTicket
// Server-Sent Events 流式接口
// Content-Type: text/event-stream

interface StreamEvent {
  event: 'delta' | 'checkpoint' | 'proposal' | 'error' | 'complete' | 'waiting';
  id: string;                             // 事件序列号
  data: StreamEventData;
}

type StreamEventData =
  | DeltaEventData
  | CheckpointEventData
  | ProposalEventData
  | ErrorEventData
  | CompleteEventData
  | WaitingEventData;

interface DeltaEventData {
  type: 'chapter_text' | 'world_update' | 'analysis' | 'suggestion';
  content: string;                        // 增量文本
  metadata?: {
    wordCount?: number;
    confidence?: number;
    sourceEngine?: string;
  };
}

interface CheckpointEventData {
  type: 'autosave' | 'milestone';
  checkpointId: string;
  summary: string;
  canRollbackTo: boolean;
}

interface ProposalEventData {
  proposalId: string;
  proposalType: 'chapter' | 'world_edit' | 'plot_twist' | 'character_arc';
  title: string;
  summary: string;
  preview: string;                        // 预览内容
  requiresApproval: boolean;
  expiresAt?: string;
}

interface ErrorEventData {
  code: string;
  message: string;
  recoverable: boolean;                   // 是否可恢复
  suggestedAction?: string;
}

interface CompleteEventData {
  completionType: 'chapter' | 'batch' | 'task';
  summary: string;
  nextStates: string[];                   // 建议的下一步
  statistics: GenerationStatistics;
}

interface WaitingEventData {
  reason: string;
  requiredInput: HumanInputRequirement;
  timeoutAt?: string;
}

// ============================================================
// 世界数据查询接口
// ============================================================

// GET /api/v3/projects/:projectId/world/characters
// 人物列表（支持游标分页、筛选、搜索）
interface ListCharactersRequest {
  cursor?: string;
  pageSize?: number;                      // 默认20，最大100
  filters?: {
    factionId?: string;
    locationId?: string;
    importance?: 'major' | 'supporting' | 'minor';
    status?: 'alive' | 'dead' | 'missing' | 'unknown';
    searchQuery?: string;                  // 全文搜索
  };
  embed?: string;                         // 语义搜索查询文本
}

interface ListCharactersResponse {
  characters: CharacterSummary[];
  pagination: CursorPagination;
}

// GET /api/v3/projects/:projectId/world/characters/:characterId
interface GetCharacterResponse {
  characterId: string;
  name: string;
  aliases: string[];
  profile: CharacterProfile;
  relationships: CharacterRelationship[];
  arcProgression: ArcNode[];
  appearances: ChapterReference[];
  embeddings?: number[];                  // 向量表示（可选）
}

// GET /api/v3/projects/:projectId/world/query
// 场景感知查询（工作室引擎→世界引擎的代理接口）
interface WorldQueryRequest {
  queryType: 'scene_context' | 'character_motivation' | 'faction_dynamics' |
             'timeline_continuity' | 'foreshadowing_check' | 'causal_chain';
  context: {
    currentChapter?: number;
    sceneDescription?: string;
    involvedCharacters?: string[];
    locationId?: string;
    timePoint?: string;
  };
  depth: 'surface' | 'standard' | 'deep';  // 查询深度
  maxResults?: number;
}

interface WorldQueryResponse {
  queryId: string;
  narrativeContext: string;               // 叙事化环境描述
  structuredData: StructuredWorldData;    // 结构化数据（机器用）
  sources: WorldDataSource[];             // 数据来源引用
  confidence: number;
}

// ============================================================
// 提案管理接口
// ============================================================

// GET /api/v3/projects/:projectId/proposals
interface ListProposalsRequest {
  status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'superseded';
  proposalType?: string;
  cursor?: string;
  pageSize?: number;
}

interface ProposalSummary {
  proposalId: string;
  type: string;
  title: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'superseded';
  submittedBy: string;                    // 引擎标识
  submittedAt: string;
  expiresAt?: string;
}

// GET /api/v3/projects/:projectId/proposals/:proposalId
interface GetProposalResponse {
  proposalId: string;
  type: string;
  title: string;
  description: string;
  diff: WorldStateDiff;                   // 变更差异
  narrativeImpact: NarrativeImpactAssessment;
  costAnalysis: CostAnalysis;
  status: string;
  submittedBy: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewerNotes?: string;
}

// POST /api/v3/projects/:projectId/proposals/:proposalId/approve
interface ApproveProposalRequest {
  authorNotes?: string;
  modifications?: ModificationRequest[];  // 附带修改要求
}

// POST /api/v3/projects/:projectId/proposals/:proposalId/reject
interface RejectProposalRequest {
  reason: string;
  suggestAlternative?: boolean;
}

// ============================================================
// 章节管理接口
// ============================================================

// GET /api/v3/projects/:projectId/chapters
interface ListChaptersResponse {
  chapters: ChapterSummary[];
  totalWordCount: number;
  pagination: CursorPagination;
}

interface ChapterSummary {
  chapterId: string;
  chapterNumber: number;
  title: string;
  wordCount: number;
  status: 'draft' | 'generated' | 'reviewing' | 'solidified' | 'published';
  generationMode: 'manual' | 'ai_assisted' | 'ai_full';
  solidifiedAt?: string;
  summary?: string;
}

// GET /api/v3/projects/:projectId/chapters/:chapterId
interface GetChapterResponse {
  chapterId: string;
  chapterNumber: number;
  title: string;
  content: ChapterContent;                // Markdown格式
  metadata: ChapterMetadata;
  linkedEntities: EntityReference[];      // 关联的世界实体
  foreshadowings: ForeshadowingRef[];     // 伏笔引用
  rippleEffects: RippleEntry[];           // 涟漪效果
  versionHistory: VersionSnapshot[];      // 版本历史
}

// GET /api/v3/projects/:projectId/chapters/:chapterId/content/stream
// 流式获取章节内容（大文件分片）
interface ChapterContentStreamRequest {
  startByte?: number;
  endByte?: number;
}

// ============================================================
// 编辑与修改接口
// ============================================================

// PATCH /api/v3/projects/:projectId/chapters/:chapterId
// 更新章节内容（作者手动编辑）
interface UpdateChapterRequest {
  content?: string;                       // 完整新内容
  patch?: TextPatch;                      // 或者使用diff补丁
  editReason: string;                     // 编辑原因（审计用）
}

// POST /api/v3/projects/:projectId/oracle
// 神谕咨询（作者向系统提问）
interface OracleRequest {
  queryType: 'plot_suggestion' | 'continuity_check' | 'character_advice' |
             'world_building' | 'style_analysis' | 'custom';
  query: string;
  context?: {
    relevantChapterIds?: string[];
    relevantCharacterIds?: string[];
    focusArea?: string;
  };
}

interface OracleResponse {
  answerId: string;
  response: string;                       // 叙事化回答
  structuredData?: Record<string, unknown>;
  relevantSources?: WorldDataSource[];
  suggestedActions?: SuggestedAction[];
  cost: OracleCost;                       // 本次查询消耗
}

interface OracleCost {
  queryTokens: number;
  responseTokens: number;
  contextChunks: number;
  estimatedCost: string;                  // 人类可读成本描述
}
```

### 2.4.3 协调层 ↔ Agent层 接口

```typescript
// ============================================================
// 协调层 → Agent层 调用接口（进程内函数调用）
// ============================================================

// 引擎调用统一接口
interface EngineInvoker {
  // 调用世界引擎
  invokeWorldEngine(
    projectId: string,
    task: WorldEngineTask,
    context: EngineContext
  ): Promise<WorldEngineResult>;

  // 调用工作室引擎
  invokeStudioEngine(
    projectId: string,
    task: StudioEngineTask,
    context: EngineContext
  ): Promise<StudioEngineResult>;

  // 调用谏官
  invokeCensor(
    projectId: string,
    content: string,
    checkType: CensorCheckType[],
    context: EngineContext
  ): Promise<CensorResult>;

  // 调用 Flow Guardian
  invokeFlowGuardian(
    projectId: string,
    metrics: FlowMetrics,
    context: EngineContext
  ): Promise<GuardianIntervention | null>;
}

// ============================================================
// 世界引擎任务定义
// ============================================================

interface WorldEngineTask {
  taskType:
    | 'QUERY_SCENE_CONTEXT'         // 场景感知查询
    | 'QUERY_CHARACTER_DEPTH'       // 人物深度查询
    | 'QUERY_FACTION_STATE'         // 势力状态查询
    | 'QUERY_TIMELINE_CONTINUITY'   // 时间线连续性查询
    | 'EVALUATE_NARRATIVE_VALUE'    // 叙事价值评估
    | 'GENERATE_WORLD_PROPOSAL'     // 生成世界变更提案
    | 'APPLY_SOLIDIFICATION'        // 执行固化
    | 'COMPUTE_RIPPLE_EFFECTS'      // 计算涟漪效果
    | 'GENERATE_FORESHADOWING_HINT' // 生成伏笔提示
    ;
  payload: Record<string, unknown>;
  priority: 'critical' | 'high' | 'normal' | 'low';
  timeoutMs: number;
}

interface WorldEngineResult {
  success: boolean;
  taskType: string;
  data: Record<string, unknown>;
  narrativeOutput?: string;               // 叙事化输出（人类可读）
  structuredOutput?: Record<string, unknown>; // 结构化输出（机器用）
  confidence: number;                     // 0-1
  processingTimeMs: number;
  tokensUsed: TokenUsage;
}

// ============================================================
// 工作室引擎任务定义
// ============================================================

interface StudioEngineTask {
  taskType:
    | 'GENERATE_CHAPTER'            // 生成章节
    | 'GENERATE_SCENE'              // 生成场景
    | 'GENERATE_DIALOGUE'           // 生成对话
    | 'GENERATE_ACTION_SEQUENCE'    // 生成动作序列
    | 'EMPATHIZE_COST'              // 代价共情化
    | 'EVALUATE_PROPOSAL'           // 评估提案
    | 'SUGGEST_PLOT_DEVELOPMENT'    // 建议情节发展
    | 'ANALYZE_NARRATIVE_PACE'      // 分析叙事节奏
    | 'GENERATE_AUTHOR_OPTIONS'     // 生成作者选项
    ;
  payload: Record<string, unknown>;
  priority: 'critical' | 'high' | 'normal' | 'low';
  timeoutMs: number;
}

interface StudioEngineResult {
  success: boolean;
  taskType: string;
  proposals: Proposal[];
  narrativeOutput?: string;
  metadata: {
    wordCount: number;
    estimatedReadingTime: number;
    qualityScore: number;
    generationMode: 'stream' | 'batch';
  };
  tokensUsed: TokenUsage;
}

interface Proposal {
  proposalId: string;
  type: string;
  title: string;
  content: string;
  worldStateDiff: WorldStateDiff;
  narrativeImpact: NarrativeImpactAssessment;
  alternatives?: ProposalAlternative[];
}

// ============================================================
// 谏官任务定义
// ============================================================

type CensorCheckType =
  | 'CONTINUITY'              // 连续性检查
  | 'CHARACTER_CONSISTENCY'   // 人物一致性
  | 'LORE_COMPLIANCE'         // 设定合规性
  | 'QUALITY_GATE'            // 质量门槛
  | 'SENSITIVITY'             // 敏感性审查
  | 'STYLE_ADHERENCE'         // 风格一致性
  ;

interface CensorResult {
  passed: boolean;
  checks: CheckDetail[];
  overallScore: number;                   // 0-100
  mandatoryRevisions?: RevisionRequest[];
  suggestions?: Suggestion[];
}

interface CheckDetail {
  checkType: CensorCheckType;
  passed: boolean;
  score: number;
  findings: Finding[];
}

interface Finding {
  severity: 'error' | 'warning' | 'info';
  location?: TextLocation;
  message: string;
  suggestion?: string;
}

// ============================================================
// Flow Guardian 接口
// ============================================================

interface FlowMetrics {
  recentWordCount: number;                // 最近N章字数
  avgChapterInterval: number;             // 平均章节间隔（分钟）
  authorEngagementScore: number;          // 作者参与度 0-1
  revisionRate: number;                   // 返修率
  staleChapterCount: number;              // 停滞章节数
  lastAuthorActivity: string;             // ISO 8601
  currentMouState: MouState;
  stateDwellTime: number;                 // 当前状态停留时间（分钟）
}

interface GuardianIntervention {
  interventionType:
    | 'PROMPT_CONTINUE'         // 提示继续
    | 'SUGGEST_BREAK'           // 建议休息
    | 'OFFER_SUMMARY'           // 提供摘要
    | 'HIGHLIGHT_INCONSISTENCY' // 高亮不一致
    | 'PROPOSE_SIMPLIFICATION'  // 建议简化
    | 'ALERT_STUCK'             // 卡死警报
    ;
  message: string;                        // 叙事化消息
  priority: 'low' | 'medium' | 'high';
  suggestedAction?: string;
  autoEscalateAt?: string;                // 自动升级时间
}
```

### 2.4.4 Agent层 ↔ 服务层 接口

```typescript
// ============================================================
// Agent壳 → 服务层 HTTP/gRPC 接口
// 基础URL: http://service-layer:8080/internal/api/v3
// ============================================================

// ============================================================
// Prompt组装服务接口
// ============================================================

// POST /internal/api/v3/prompts/assemble
interface AssemblePromptRequest {
  templateId: string;                     // 模板标识
  variables: PromptVariable[];            // 变量注入
  contextWindow: {
    maxTokens: number;
    reservedTokens: number;               // 输出预留
  };
  optimizationHints?: {
    prioritizeRecency?: boolean;          // 优先近期内容
    prioritizeRelevance?: boolean;        // 优先相关内容
    compressionLevel?: 'none' | 'light' | 'aggressive';
  };
}

interface PromptVariable {
  name: string;
  value: string | number | boolean | object;
  source: 'database' | 'cache' | 'computation' | 'static';
}

interface AssemblePromptResponse {
  promptId: string;
  messages: ChatMessage[];                // 最终消息列表
  systemPrompt: string;
  estimatedTokens: number;
  tokenBreakdown: TokenBreakdown;
  templateVersion: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;                          // 可选命名（如角色名）
}

interface TokenBreakdown {
  systemPrompt: number;
  contextInjection: number;
  userMessage: number;
  overhead: number;
  total: number;
}

// ============================================================
// 质检服务接口
// ============================================================

// POST /internal/api/v3/quality/check
interface QualityCheckRequest {
  content: string;                        // 待检查内容
  checkTypes: QualityCheckType[];
  referenceContext?: {
    worldStateSnapshot?: WorldStateSnapshot;
    previousChapters?: string[];
    styleGuide?: string;
  };
}

type QualityCheckType =
  | 'GRAMMAR'                 // 语法检查
  | 'STYLE_CONSISTENCY'       // 风格一致性
  | 'PACING'                  // 节奏检查
  | 'DIALOGUE_QUALITY'        // 对话质量
  | 'DESCRIPTION_BALANCE'     // 描写平衡
  | 'TENSION_CURVE'           // 张力曲线
  | 'POV_CONSISTENCY'         // POV一致性
  | 'TONE_ALIGNMENT'          // 语气对齐
  ;

interface QualityCheckResponse {
  checkId: string;
  overallScore: number;                   // 0-100
  dimensionScores: DimensionScore[];
  issues: QualityIssue[];
  summary: string;
}

interface DimensionScore {
  dimension: QualityCheckType;
  score: number;
  weight: number;
}

interface QualityIssue {
  severity: 'critical' | 'major' | 'minor';
  type: QualityCheckType;
  location?: TextLocation;
  description: string;
  suggestion: string;
}

// ============================================================
// 风险分析服务接口
// ============================================================

// POST /internal/api/v3/risk/analyze
interface RiskAnalysisRequest {
  projectId: string;
  proposalType: string;
  worldStateDiff: WorldStateDiff;
  narrativeContext: string;
  depth: 'quick' | 'standard' | 'deep';
}

interface RiskAnalysisResponse {
  analysisId: string;
  riskScore: number;                      // 0-100，越高越危险
  riskCategories: RiskCategory[];
  mitigationSuggestions: MitigationSuggestion[];
  confidence: number;
}

interface RiskCategory {
  category: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  probability: number;                    // 0-1
  impact: number;                         // 0-1
}

interface MitigationSuggestion {
  action: string;
  expectedRiskReduction: number;
  implementationComplexity: 'easy' | 'medium' | 'hard';
}

// ============================================================
// 心流计算服务接口
// ============================================================

// POST /internal/api/v3/flow/compute
interface FlowComputeRequest {
  projectId: string;
  chapterId?: string;
  content?: string;
  metrics: FlowInputMetrics;
}

interface FlowInputMetrics {
  typingSpeed?: number;                   // 打字速度（WPM）
  pausePatterns?: PausePattern[];
  editFrequency?: number;
  scrollBehavior?: ScrollBehavior;
  timeOfDay?: string;
  sessionDuration?: number;               // 分钟
}

interface FlowComputeResponse {
  flowScore: number;                      // 0-100
  flowState: 'deep_flow' | 'flow' | 'engaged' | 'distracted' | 'stuck';
  indicators: FlowIndicator[];
  recommendations: FlowRecommendation[];
}

interface FlowIndicator {
  name: string;
  value: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface FlowRecommendation {
  action: string;
  expectedImpact: string;
  priority: number;
}

// ============================================================
// 版本管理服务接口
// ============================================================

// POST /internal/api/v3/versions/snapshot
interface CreateSnapshotRequest {
  projectId: string;
  chapterId?: string;
  snapshotType: 'auto' | 'manual' | 'pre_solidification' | 'milestone';
  label?: string;
  tags?: string[];
}

interface CreateSnapshotResponse {
  snapshotId: string;
  createdAt: string;
  sizeBytes: number;
  storagePath: string;
}

// POST /internal/api/v3/versions/rollback
interface RollbackRequest {
  projectId: string;
  snapshotId: string;
  rollbackMode: 'full' | 'selective';
  selectiveTargets?: string[];            // 选择性回滚目标
}

// ============================================================
// 涟漪计算服务接口
// ============================================================

// POST /internal/api/v3/ripple/compute
interface RippleComputeRequest {
  projectId: string;
  originEvent: OriginEvent;               // 原始事件
  propagationDepth: number;               // 传播深度（默认3）
  affectedDomains?: string[];             // 限定影响域
}

interface OriginEvent {
  entityType: 'character' | 'faction' | 'location' | 'item' | 'rule';
  entityId: string;
  changeType: 'created' | 'modified' | 'destroyed' | 'relocated' | 'status_changed';
  changeDescription: string;
  chapterId: string;
}

interface RippleComputeResponse {
  rippleId: string;
  directEffects: RippleEffect[];
  indirectEffects: RippleEffect[];
  longTermImplications: LongTermImplication[];
  narrativeOpportunities: NarrativeOpportunity[];
}

interface RippleEffect {
  affectedEntityType: string;
  affectedEntityId: string;
  effectType: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major';
  confidence: number;
}

// ============================================================
// 世界子引擎统一接口
// ============================================================

// 所有世界子引擎遵循统一接口模式
interface WorldSubEngine<TQuery, TResult> {
  // 查询接口
  query(request: SubEngineQueryRequest<TQuery>): Promise<SubEngineQueryResponse<TResult>>;

  // 变更提案接口
  propose(request: SubEngineProposeRequest): Promise<SubEngineProposeResponse>;

  // 状态验证接口
  validate(request: SubEngineValidateRequest): Promise<SubEngineValidateResponse>;
}

interface SubEngineQueryRequest<TQuery> {
  projectId: string;
  query: TQuery;
  options: {
    includeHistory?: boolean;
    depth?: number;
    format?: 'narrative' | 'structured' | 'both';
  };
}

interface SubEngineQueryResponse<TResult> {
  result: TResult;
  narrativeOutput?: string;
  sources: DataSource[];
  confidence: number;
  processingTimeMs: number;
}

interface SubEngineProposeRequest {
  projectId: string;
  proposedChanges: ProposedChange[];
  justification: string;
}

interface SubEngineProposeResponse {
  proposals: WorldStateDiff[];
  impactAssessment: ImpactAssessment;
  validationResults: ValidationResult[];
}

interface SubEngineValidateRequest {
  projectId: string;
  worldStateDiff: WorldStateDiff;
  validationRules?: string[];
}

interface SubEngineValidateResponse {
  valid: boolean;
  violations: ValidationViolation[];
  warnings: ValidationWarning[];
}
```

### 2.4.5 服务层 ↔ 数据层 接口

```typescript
// ============================================================
// 数据访问层 (Repository Pattern + Drizzle ORM)
// 所有数据库操作通过 Repository 类封装，禁止直接SQL
// ============================================================

// ============================================================
// 核心 Repository 接口
// ============================================================

interface IProjectRepository {
  create(project: InsertProject): Promise<Project>;
  findById(projectId: string): Promise<Project | null>;
  findByAuthor(authorId: string, pagination: CursorPaginationParams): Promise<PaginatedResult<Project>>;
  update(projectId: string, update: Partial<Project>): Promise<Project>;
  softDelete(projectId: string): Promise<void>;
  getStatistics(projectId: string): Promise<ProjectStatistics>;
}

interface IChapterRepository {
  create(chapter: InsertChapter): Promise<Chapter>;
  findById(chapterId: string): Promise<Chapter | null>;
  findByProject(projectId: string, pagination: CursorPaginationParams): Promise<PaginatedResult<Chapter>>;
  findByNumber(projectId: string, chapterNumber: number): Promise<Chapter | null>;
  updateContent(chapterId: string, content: string, versionMeta: VersionMetadata): Promise<Chapter>;
  updateStatus(chapterId: string, status: ChapterStatus): Promise<Chapter>;
  getContentStream(chapterId: string, range: ByteRange): Promise<ReadableStream>;
  getWordCount(projectId: string): Promise<number>;
  getRecentChapters(projectId: string, limit: number): Promise<Chapter[]>;
}

interface ICharacterRepository {
  create(character: InsertCharacter): Promise<Character>;
  findById(characterId: string): Promise<Character | null>;
  findByProject(projectId: string, filters: CharacterFilters, pagination: CursorPaginationParams): Promise<PaginatedResult<Character>>;
  searchByEmbedding(projectId: string, embedding: number[], limit: number): Promise<Character[]>;
  fullTextSearch(projectId: string, query: string, limit: number): Promise<Character[]>;
  updateProfile(characterId: string, profile: Partial<CharacterProfile>): Promise<Character>;
  updateRelationships(characterId: string, relationships: CharacterRelationship[]): Promise<Character>;
  recordAppearance(characterId: string, chapterId: string, context: string): Promise<void>;
}

interface IWorldStateRepository {
  getSnapshot(projectId: string, options?: SnapshotOptions): Promise<WorldStateSnapshot>;
  getSnapshotAt(projectId: string, chapterNumber: number): Promise<WorldStateSnapshot | null>;
  applyDiff(projectId: string, diff: WorldStateDiff, metadata: DiffMetadata): Promise<WorldStateSnapshot>;
  getDiffHistory(projectId: string, entityType?: string, entityId?: string): Promise<StateDiff[]>;
  getTimeline(projectId: string, range: ChapterRange): Promise<TimelineEvent[]>;
}

interface IProposalRepository {
  create(proposal: InsertProposal): Promise<Proposal>;
  findById(proposalId: string): Promise<Proposal | null>;
  findPendingByProject(projectId: string): Promise<Proposal[]>;
  findByProject(projectId: string, filters: ProposalFilters, pagination: CursorPaginationParams): Promise<PaginatedResult<Proposal>>;
  updateStatus(proposalId: string, status: ProposalStatus, reviewerNotes?: string): Promise<Proposal>;
  supersede(proposalId: string, supersededBy: string): Promise<void>;
}

interface IForeshadowingRepository {
  create(foreshadowing: InsertForeshadowing): Promise<Foreshadowing>;
  findByProject(projectId: string, status?: ForeshadowingStatus): Promise<Foreshadowing[]>;
  findByTargetChapter(projectId: string, chapterId: string): Promise<Foreshadowing[]>;
  updateStatus(foreshadowingId: string, status: ForeshadowingStatus, resolutionChapterId?: string): Promise<Foreshadowing>;
  getStats(projectId: string): Promise<ForeshadowingStats>;
}

interface IRippleRepository {
  create(ripple: InsertRipple): Promise<Ripple>;
  findByOrigin(projectId: string, originEventId: string): Promise<Ripple[]>;
  findByAffectedEntity(projectId: string, entityType: string, entityId: string): Promise<Ripple[]>;
  findUnresolved(projectId: string, maxDepth?: number): Promise<Ripple[]>;
  markResolved(rippleId: string, resolutionChapterId: string): Promise<Ripple>;
}

interface IEventLogRepository {
  log(event: InsertEventLog): Promise<EventLog>;
  findByProject(projectId: string, filters: EventLogFilters, pagination: CursorPaginationParams): Promise<PaginatedResult<EventLog>>;
  findByChapter(chapterId: string): Promise<EventLog[]>;
  findByEntity(entityType: string, entityId: string): Promise<EventLog[]>;
}

// ============================================================
// 数据库事务接口（原子固化核心）
// ============================================================

interface ISolidificationTransaction {
  // 在 SERIALIZABLE 隔离级别下执行原子固化
  execute(params: SolidificationParams): Promise<SolidificationResult>;
}

interface SolidificationParams {
  projectId: string;
  chapterId: string;
  chapterContent: string;
  entityChanges: EntityChange[];
  eventLogs: InsertEventLog[];
  foreshadowingUpdates: ForeshadowingUpdate[];
  rippleEntries: InsertRipple[];
  versionSnapshot: VersionSnapshotData;
  idempotencyKey: string;
}

interface SolidificationResult {
  success: boolean;
  chapterId: string;
  snapshotId: string;
  appliedChanges: AppliedChangeSummary;
  timestamp: string;
}

interface AppliedChangeSummary {
  entitiesCreated: number;
  entitiesModified: number;
  eventsLogged: number;
  foreshadowingsUpdated: number;
  ripplesRecorded: number;
}
```



---

## 2.5 服务层完整服务清单

### 2.5.1 服务总览

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         服务层服务总览图                                   │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  世界子引擎  │  │   Prompt    │  │    质检     │  │   风险分析  │    │
│  │  (8个引擎)   │  │  组装服务    │  │   服务      │  │   服务      │    │
│  │  领域服务    │  │  基础设施    │  │  质量保障   │  │  安全保障   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   心流计算   │  │   版本管理   │  │   叙事评估   │  │   场景查询   │    │
│  │   服务      │  │   服务      │  │   服务      │  │   服务      │    │
│  │  体验优化    │  │  数据管理    │  │  决策支持   │  │  上下文构建  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  代价共情化   │  │   涟漪计算   │  │   任务队列   │  │   缓存管理   │    │
│  │   服务      │  │   服务      │  │   服务      │  │   服务      │    │
│  │  展示优化    │  │  因果传播    │  │  异步处理   │  │  性能优化    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                       │
│  │   全文检索   │  │   向量检索   │  │   配置中心   │                       │
│  │   服务      │  │   服务      │  │   服务      │                       │
│  │  搜索能力    │  │  语义匹配    │  │  动态配置    │                       │
│  └─────────────┘  └─────────────┘  └─────────────┘                       │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.5.2 8个世界子引擎

#### 2.5.2.1 地理引擎 (GeoEngine)

| 属性 | 说明 |
|------|------|
| 引擎ID | `geo_engine` |
| 职责 | 管理虚构世界的地理环境，包括大陆、国家、城市、地标的创建、变更和查询 |
| 数据模型 | Location 实体树（区域→子区域→具体地点），支持多层级嵌套 |
| 核心能力 | 地理关系计算、距离/路径查询、区域归属判定、地形影响分析 |
| 依赖引擎 | 势力引擎（领土归属）、时间引擎（地理变迁历史） |

```typescript
interface GeoEngineQuery {
  queryType:
    | 'GET_LOCATION_DETAIL'           // 获取地点详情
    | 'GET_LOCATION_PATH'             // 获取两点间路径
    | 'GET_LOCATIONS_IN_REGION'       // 获取区域内所有地点
    | 'GET_LOCATION_HISTORY'          // 获取地点历史变迁
    | 'COMPUTE_TRAVEL_TIME'           // 计算旅行时间
    | 'GET_TERRAIN_EFFECT'            // 获取地形效果
    | 'FIND_SUITABLE_LOCATIONS'       // 查找适合某场景的地点
    ;
  parameters: Record<string, unknown>;
}

interface GeoEngineCapabilities {
  // 地理引擎特有功能
  computeTravelPath(
    fromLocationId: string,
    toLocationId: string,
    travelMode: 'walk' | 'ride' | 'ship' | 'fly' | 'magic',
    era?: string
  ): Promise<TravelPath>;

  findSuitableLocations(
    criteria: LocationCriteria,
    excludeIds?: string[]
  ): Promise<LocationSuitabilityScore[]>;

  getEnvironmentalNarrative(
    locationId: string,
    timeOfDay: string,
    weather?: string,
    mood?: string
  ): Promise<string>;                    // 返回叙事化环境描写
}
```

#### 2.5.2.2 势力引擎 (FactionEngine)

| 属性 | 说明 |
|------|------|
| 引擎ID | `faction_engine` |
| 职责 | 管理世界中的势力/组织，包括国家、门派、家族、秘密组织等 |
| 数据模型 | Faction 实体图（组织节点 + 关系边），支持权力结构、外交关系、资源控制 |
| 核心能力 | 势力关系计算、外交状态推演、资源分配模拟、权力斗争建模 |
| 依赖引擎 | 人物引擎（成员关系）、地理引擎（领土控制）、时间引擎（历史演变） |

```typescript
interface FactionEngineQuery {
  queryType:
    | 'GET_FACTION_DETAIL'            // 获取势力详情
    | 'GET_FACTION_RELATIONSHIPS'     // 获取势力关系网
    | 'GET_POWER_DYNAMICS'            // 获取权力动态
    | 'SIMULATE_DIPLOMATIC_ACTION'    // 模拟外交行动
    | 'GET_RESOURCE_CONTROL'          // 获取资源控制情况
    | 'GET_INFLUENCE_MAP'             // 获取影响力地图
    ;
  parameters: Record<string, unknown>;
}

interface FactionEngineCapabilities {
  simulateDiplomaticAction(
    actorFactionId: string,
    targetFactionId: string,
    action: DiplomaticAction,
    context: SimulationContext
  ): Promise<DiplomaticSimulationResult>;

  computeInfluenceMap(
    factionId: string,
    metric: 'military' | 'economic' | 'cultural' | 'political'
  ): Promise<InfluenceMap>;

  getFactionNarrativeContext(
    factionId: string,
    viewpointCharacterId?: string
  ): Promise<FactionNarrativeContext>;
}
```

#### 2.5.2.3 人物引擎 (CharacterEngine)

| 属性 | 说明 |
|------|------|
| 引擎ID | `character_engine` |
| 职责 | 管理所有角色（主角、配角、龙套），包括属性、关系、成长弧线 |
| 数据模型 | Character 实体 + Relationship 关系图 + Arc 成长轨迹 |
| 核心能力 | 人物一致性维护、关系网络分析、动机推理、性格发展推演 |
| 依赖引擎 | 事件引擎（经历关联）、势力引擎（组织归属）、时间引擎（成长时间线） |

```typescript
interface CharacterEngineQuery {
  queryType:
    | 'GET_CHARACTER_PROFILE'         // 获取人物档案
    | 'GET_CHARACTER_MOTIVATION'      // 获取人物动机分析
    | 'GET_CHARACTER_RELATIONSHIPS'   // 获取人物关系网
    | 'PREDICT_CHARACTER_ACTION'      // 预测人物行动
    | 'GET_CHARACTER_ARC'             // 获取人物成长弧线
    | 'CHECK_CHARACTER_CONSISTENCY'   // 检查人物一致性
    | 'GET_CHARACTER_VOICES'          // 获取人物语言风格
    ;
  parameters: Record<string, unknown>;
}

interface CharacterEngineCapabilities {
  predictAction(
    characterId: string,
    situation: SituationContext,
    options: PredictionOptions
  ): Promise<CharacterActionPrediction[]>;

  checkConsistency(
    characterId: string,
    proposedAction: string,
    chapterContext: string
  ): Promise<ConsistencyCheckResult>;

  getCharacterVoice(
    characterId: string,
    emotionalState?: string,
    formality?: 'casual' | 'formal' | 'intimate' | 'official'
  ): Promise<CharacterVoiceProfile>;
}
```

#### 2.5.2.4 事件引擎 (EventEngine)

| 属性 | 说明 |
|------|------|
| 引擎ID | `event_engine` |
| 职责 | 管理世界中的重大事件、历史节点、当前事件线 |
| 数据模型 | Event 实体（时间点 + 参与者 + 影响范围 + 因果链） |
| 核心能力 | 事件因果分析、时间线一致性校验、历史影响评估、未来事件推演 |
| 依赖引擎 | 所有其他引擎（事件影响全域） |

```typescript
interface EventEngineQuery {
  queryType:
    | 'GET_EVENT_DETAIL'              // 获取事件详情
    | 'GET_EVENT_CHAIN'               // 获取事件因果链
    | 'GET_TIMELINE'                  // 获取时间线
    | 'CHECK_TEMPORAL_CONSISTENCY'    // 检查时间一致性
    | 'PREDICT_EVENT_CONSEQUENCES'    // 预测事件后果
    | 'GET_PARALLEL_EVENTS'           // 获取并行事件
    ;
  parameters: Record<string, unknown>;
}

interface EventEngineCapabilities {
  predictConsequences(
    eventDescription: string,
    scope: 'local' | 'regional' | 'global',
    depth: number
  ): Promise<EventConsequence[]>;

  checkTemporalConsistency(
    proposedEvent: ProposedEvent,
    existingTimeline: TimelineRange
  ): Promise<TemporalConsistencyResult>;
}
```

#### 2.5.2.5 规则引擎 (RulesEngine)

| 属性 | 说明 |
|------|------|
| 引擎ID | `rules_engine` |
| 职责 | 管理世界观规则，包括物理法则、魔法体系、社会制度、经济系统 |
| 数据模型 | Rule 实体（规则定义 + 参数 + 约束条件 + 例外条款） |
| 核心能力 | 规则合规性检查、规则冲突检测、规则应用推演、规则变更影响分析 |
| 依赖引擎 | 所有其他引擎（规则约束全域） |

```typescript
interface RulesEngineQuery {
  queryType:
    | 'GET_RULE_DETAIL'               // 获取规则详情
    | 'CHECK_RULE_COMPLIANCE'         // 检查规则合规性
    | 'DETECT_RULE_CONFLICTS'         // 检测规则冲突
    | 'SIMULATE_RULE_APPLICATION'     // 模拟规则应用
    | 'GET_RULE_HISTORY'              // 获取规则演变历史
    ;
  parameters: Record<string, unknown>;
}

interface RulesEngineCapabilities {
  checkCompliance(
    action: string,
    context: RulesContext,
    ruleCategories?: string[]
  ): Promise<ComplianceResult>;

  detectConflicts(
    proposedRule: Rule,
    existingRules: Rule[]
  ): Promise<RuleConflict[]>;
}
```

#### 2.5.2.6 伏笔引擎 (ForeshadowingEngine)

| 属性 | 说明 |
|------|------|
| 引擎ID | `foreshadowing_engine` |
| 职责 | 管理伏笔生命周期，包括埋设、追踪、回收、过期处理 |
| 数据模型 | Foreshadowing 实体（类型、状态、目标章节、关联实体） |
| 核心能力 | 伏笔密度分析、回收时机推荐、过期预警、新伏笔生成建议 |
| 依赖引擎 | 事件引擎（事件关联）、人物引擎（人物关联） |

```typescript
interface ForeshadowingEngineQuery {
  queryType:
    | 'GET_ACTIVE_FORESHADOWINGS'     // 获取活跃伏笔
    | 'GET_FORESHADOWING_DETAIL'      // 获取伏笔详情
    | 'GET_FORESHADOWING_STATS'       // 获取伏笔统计
    | 'SUGGEST_PLACEMENT'             // 建议埋设位置
    | 'SUGGEST_RESOLUTION'            // 建议回收时机
    | 'CHECK_EXPIRED'                 // 检查过期伏笔
    ;
  parameters: Record<string, unknown>;
}

interface ForeshadowingEngineCapabilities {
  suggestPlacement(
    targetEventId: string,
    currentChapterId: string,
    subtletyLevel: 'obvious' | 'moderate' | 'subtle' | 'cryptic'
  ): Promise<PlacementSuggestion[]>;

  suggestResolution(
    foreshadowingId: string,
    upcomingChapters: ChapterPreview[]
  ): Promise<ResolutionOpportunity[]>;

  analyzeDensity(
    chapterId: string,
    targetDensity?: number
  ): Promise<DensityAnalysis>;
}
```

#### 2.5.2.7 时间引擎 (TimelineEngine)

| 属性 | 说明 |
|------|------|
| 引擎ID | `timeline_engine` |
| 职责 | 管理世界时间线，包括纪元、历法、季节、特殊时间点 |
| 数据模型 | Timeline 实体（纪元→年→季节→月→日→时辰），支持多历法系统 |
| 核心能力 | 时间转换、历法计算、季节效果、时间流逝感知 |
| 依赖引擎 | 无（被其他引擎依赖） |

```typescript
interface TimelineEngineQuery {
  queryType:
    | 'GET_CURRENT_TIME'              // 获取当前时间
    | 'CONVERT_CALENDAR'              // 历法转换
    | 'GET_SEASON_EFFECTS'            // 获取季节效果
    | 'COMPUTE_TIME_DELTA'            // 计算时间差
    | 'GET_TIME_DESCRIPTION'          // 获取叙事化时间描述
    ;
  parameters: Record<string, unknown>;
}

interface TimelineEngineCapabilities {
  getTimeDescription(
    timePoint: TimePoint,
    narrativeStyle?: 'precise' | 'poetic' | 'casual'
  ): Promise<string>;

  computeTimeDelta(
    from: TimePoint,
    to: TimePoint,
    unit: 'days' | 'months' | 'years' | 'hours'
  ): Promise<number>;

  getSeasonEffects(
    locationId: string,
    timePoint: TimePoint
  ): Promise<SeasonEffects>;
}
```

#### 2.5.2.8 知识引擎 (KnowledgeEngine)

| 属性 | 说明 |
|------|------|
| 引擎ID | `knowledge_engine` |
| 职责 | 管理世界知识体系，包括常识、秘密、传说、学问体系 |
| 数据模型 | Knowledge 实体（知识项 + 传播范围 + 持有者 + 可信度） |
| 核心能力 | 知识传播模拟、信息不对称分析、知识冲突检测、秘密揭露推演 |
| 依赖引擎 | 人物引擎（知识持有者）、事件引擎（知识产生） |

```typescript
interface KnowledgeEngineQuery {
  queryType:
    | 'GET_KNOWLEDGE_DETAIL'          // 获取知识详情
    | 'GET_KNOWN_BY_CHARACTER'        // 获取某角色知道的知识
    | 'SIMULATE_KNOWLEDGE_SPREAD'     // 模拟知识传播
    | 'GET_INFORMATION_ASYMMETRY'     // 获取信息不对称情况
    | 'SUGGEST_REVELATION'            // 建议揭露时机
    ;
  parameters: Record<string, unknown>;
}

interface KnowledgeEngineCapabilities {
  simulateKnowledgeSpread(
    knowledgeId: string,
    startingCharacters: string[],
    rounds: number
  ): Promise<KnowledgeSpreadSimulation>;

  getInformationAsymmetry(
    characterIds: string[],
    topic?: string
  ): Promise<InformationAsymmetryMatrix>;
}
```

### 2.5.3 核心服务模块

#### 2.5.3.1 Prompt组装服务 (PromptAssemblyService)

| 属性 | 说明 |
|------|------|
| 服务ID | `prompt_assembly_service` |
| 职责 | 管理所有LLM Prompt的模板、变量注入、上下文窗口优化 |
| 核心能力 | 模板管理、变量替换、上下文压缩、Token预算管理、多模板组合 |
| 输入 | 模板ID + 变量集合 + Token预算 |
| 输出 | 组装好的消息列表 + Token使用预估 |

```typescript
interface PromptAssemblyService {
  // 注册模板
  registerTemplate(template: PromptTemplate): Promise<void>;

  // 组装Prompt
  assemble(request: AssemblePromptRequest): Promise<AssemblePromptResponse>;

  // 动态压缩上下文（当超出Token预算时）
  compressContext(
    context: ChatMessage[],
    targetTokens: number,
    strategy: CompressionStrategy
  ): Promise<CompressedContext>;

  // 多模板组合
  composeTemplates(
    templateIds: string[],
    sharedVariables: Record<string, unknown>,
    contextWindow: ContextWindowConfig
  ): Promise<ComposedPrompt>;
}

type CompressionStrategy =
  | 'truncate_oldest'         // 截断最旧内容
  | 'summarize_old'           // 摘要旧内容
  | 'semantic_pruning'        // 语义剪枝（向量相似度）
  | 'hierarchical_summary'    // 分层摘要
  ;
```

#### 2.5.3.2 质检服务 (QualityService)

| 属性 | 说明 |
|------|------|
| 服务ID | `quality_service` |
| 职责 | 对生成的内容进行多维度质量检查 |
| 核心能力 | 语法检查、风格一致性、节奏分析、对话质量、POV一致性 |
| 检查维度 | 8个维度（GRAMMAR, STYLE_CONSISTENCY, PACING, DIALOGUE_QUALITY, DESCRIPTION_BALANCE, TENSION_CURVE, POV_CONSISTENCY, TONE_ALIGNMENT） |
| 输出 | 综合质量分(0-100) + 各维度分 + 问题列表 + 改进建议 |

#### 2.5.3.3 风险分析服务 (RiskAnalysisService)

| 属性 | 说明 |
|------|------|
| 服务ID | `risk_analysis_service` |
| 职责 | 分析世界状态变更的潜在风险 |
| 核心能力 | 连续性风险评估、人物崩坏风险、设定冲突检测、叙事失控预警 |
| 风险分级 | low / medium / high / critical |

#### 2.5.3.4 心流计算服务 (FlowService)

| 属性 | 说明 |
|------|------|
| 服务ID | `flow_computation_service` |
| 职责 | 监测和评估作者的创作心流状态 |
| 核心能力 | 打字模式分析、停顿检测、编辑频率追踪、心流状态判定、干预建议 |
| 心流状态 | deep_flow(90-100) / flow(70-89) / engaged(50-69) / distracted(30-49) / stuck(0-29) |

#### 2.5.3.5 版本管理服务 (VersionManagementService)

| 属性 | 说明 |
|------|------|
| 服务ID | `version_management_service` |
| 职责 | 管理章节和世界状态的版本快照 |
| 核心能力 | 快照创建、差异比较、选择性回滚、分支管理、自动清理 |

#### 2.5.3.6 叙事评估服务 (NarrativeEvaluationService)

| 属性 | 说明 |
|------|------|
| 服务ID | `narrative_evaluation_service` |
| 职责 | 评估叙事元素的价值和效果 |
| 核心能力 | 情节价值评分、伏笔回收评估、情感曲线分析、节奏评价 |

#### 2.5.3.7 场景查询服务 (SceneQueryService)

| 属性 | 说明 |
|------|------|
| 服务ID | `scene_query_service` |
| 职责 | 为工作室引擎生成上下文丰富的场景描述 |
| 核心能力 | 多引擎数据聚合、叙事化转换、相关性排序、上下文压缩 |

#### 2.5.3.8 代价共情化服务 (CostEmpathyService)

| 属性 | 说明 |
|------|------|
| 服务ID | `cost_empathy_service` |
| 职责 | 将结构化代价数据转为故事性描述 |
| 核心能力 | 代价翻译、情感注入、叙事化包装、个性化适配 |

#### 2.5.3.9 涟漪计算服务 (RippleComputationService)

| 属性 | 说明 |
|------|------|
| 服务ID | `ripple_computation_service` |
| 职责 | 计算事件/变更的因果传播效果 |
| 核心能力 | 直接影响推演、间接影响传播、长期影响预测、叙事机会发现 |

#### 2.5.3.10 任务队列服务 (TaskQueueService)

| 属性 | 说明 |
|------|------|
| 服务ID | `task_queue_service` |
| 职责 | 管理异步任务的排队、调度、执行 |
| 核心能力 | 优先级队列、延迟任务、任务重试、死信队列、任务监控 |
| 技术实现 | BullMQ 5.x on Redis 7.2 |

```typescript
interface TaskQueueService {
  // 提交任务
  submit<T>(task: Task<T>): Promise<TaskResult<T>>;

  // 提交延迟任务
  submitDelayed<T>(task: Task<T>, delayMs: number): Promise<TaskResult<T>>;

  // 提交重复任务
  submitRepeatable<T>(
    task: Task<T>,
    pattern: RepeatPattern
  ): Promise<RepeatableTaskHandle>;

  // 取消任务
  cancel(taskId: string): Promise<boolean>;

  // 获取任务状态
  getStatus(taskId: string): Promise<TaskStatus>;

  // 注册任务处理器
  registerHandler<T>(
    taskType: string,
    handler: TaskHandler<T>,
    options?: HandlerOptions
  ): Promise<void>;
}

interface Task<T> {
  id: string;
  type: string;
  payload: unknown;
  priority: number;           // 1-10, 10最高
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  idempotencyKey?: string;
}

interface TaskResult<T> {
  taskId: string;
  status: 'completed' | 'failed' | 'cancelled' | 'pending';
  result?: T;
  error?: TaskError;
  attempts: number;
  durationMs: number;
}

interface TaskStatus {
  taskId: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress?: number;          // 0-100
  startedAt?: string;
  completedAt?: string;
  attempts: number;
  errorCount: number;
}
```

#### 2.5.3.11 缓存管理服务 (CacheService)

| 属性 | 说明 |
|------|------|
| 服务ID | `cache_management_service` |
| 职责 | 统一管理多层缓存策略 |
| 核心能力 | 缓存读写、失效策略执行、预热、分布式锁、限流计数 |
| 技术实现 | Redis 7.2 (主缓存) + 应用内存 (L1热点缓存) |

#### 2.5.3.12 全文检索服务 (FullTextSearchService)

| 属性 | 说明 |
|------|------|
| 服务ID | `fulltext_search_service` |
| 职责 | 提供所有文本数据的全文检索能力 |
| 核心能力 | 多字段搜索、模糊匹配、相关性排序、搜索结果高亮 |
| 技术实现 | PostgreSQL tsvector + pg_trgm |

#### 2.5.3.13 向量检索服务 (VectorSearchService)

| 属性 | 说明 |
|------|------|
| 服务ID | `vector_search_service` |
| 职责 | 基于向量嵌入的语义检索 |
| 核心能力 | 相似度搜索、混合搜索（向量+全文）、聚类分析 |
| 技术实现 | pgvector 0.7+ (HNSW索引) |

#### 2.5.3.14 配置中心服务 (ConfigService)

| 属性 | 说明 |
|------|------|
| 服务ID | `config_service` |
| 职责 | 集中管理系统配置，支持动态更新 |
| 核心能力 | 配置分层加载、环境覆盖、热更新、变更通知、配置审计 |

### 2.5.4 服务间依赖关系

```
                    ┌─────────────────┐
                    │  任务队列服务     │
                    │ (TaskQueue)     │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Prompt组装    │   │   场景查询     │   │   叙事评估     │
│   服务         │   │   服务        │   │   服务        │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                    │
        │    ┌──────────────┼───────────────────┘
        │    │              │
        ▼    ▼              ▼
┌───────────────┐   ┌───────────────┐
│  8个世界子引擎 │   │  工作室引擎壳  │
│ (WorldSubEng) │   │(StudioShell)  │
└───────────────┘   └───────────────┘
        │
        │    ┌────────────────────────────────┐
        │    │                                │
        ▼    ▼                                ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  涟漪计算      │   │   代价共情化   │   │   风险分析     │
│   服务         │   │   服务        │   │   服务        │
└───────────────┘   └───────────────┘   └───────┬───────┘
                                                │
        ┌───────────────────────────────────────┘
        │
        ▼
┌───────────────┐   ┌───────────────┐
│  版本管理      │   │   缓存管理     │
│   服务         │   │   服务        │
└───────────────┘   └───────────────┘
        │
        │    ┌───────────────┐   ┌───────────────┐
        │    │               │   │               │
        ▼    ▼               ▼   ▼               ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   心流计算     │   │  全文检索      │   │  向量检索      │
│   服务         │   │   服务        │   │   服务        │
└───────────────┘   └───────────────┘   └───────────────┘
```



---

## 2.6 引擎协作接口

### 2.6.1 接口总览

三个核心协作接口定义了Agent层四个壳之间的数据流动：

```
┌──────────────────────────────────────────────────────────────┐
│                     引擎协作接口图                            │
│                                                              │
│   ┌──────────────┐         叙事价值评估          ┌──────────┐ │
│   │  世界引擎壳    │ ───────────────────────────→ │ 工作室壳  │ │
│   │ (WorldShell) │                              │(Studio)  │ │
│   └──────────────┘ ←─────────────────────────── └──────────┘ │
│         ↑            场景感知查询（只读）              │        │
│         │                                            │        │
│         │         质检请求/反馈                      │        │
│         │←───────────────────────────────────────────┘        │
│         │                                                    │
│         │         风险分析                                   │
│         │←──────────────────────────┐                        │
│         │                           │                        │
│   ┌─────┴──────┐              ┌─────┴──────┐                │
│   │   谏官壳   │              │ Flow Guard │                │
│   │(Censor)   │              │ (Guardian) │                │
│   └────────────┘              └────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

### 2.6.2 叙事价值评估接口

**调用方向**：世界引擎 → 工作室引擎壳
**目的**：世界引擎向工作室引擎提供可能性清单的叙事价值排序

```typescript
// ============================================================
// 叙事价值评估接口
// ============================================================

// 请求方：世界引擎壳
// 处理方：叙事评估服务 (NarrativeEvaluationService)
// 触发时机：世界引擎生成世界变更提案时

interface NarrativeValueAssessmentRequest {
  // 上下文
  projectId: string;
  currentChapterId?: string;
  currentWorldState: WorldStateSnapshot;

  // 需要评估的可能性清单
  possibilities: NarrativePossibility[];

  // 评估维度配置
  evaluationDimensions: EvaluationDimension[];

  // 叙事约束
  narrativeConstraints: {
    targetTone?: string[];                  // 目标基调
    targetPacing?: 'fast' | 'moderate' | 'slow' | 'mixed';
    foreshadowingTargets?: string[];        // 需要回收的伏笔
    characterArcPriorities?: string[];      // 优先人物弧线
    thematicElements?: string[];            // 主题元素
  };
}

interface NarrativePossibility {
  possibilityId: string;
  description: string;                    // 可能性描述
  worldStateDiff: WorldStateDiff;         // 对应的世界状态变更
  estimatedImpact: ImpactEstimate;        // 预估影响
  sourceEngine: string;                   // 来源引擎
}

interface ImpactEstimate {
  scope: 'local' | 'regional' | 'global';
  severity: 'minor' | 'moderate' | 'major' | 'transformative';
  affectedEntities: AffectedEntity[];
}

interface AffectedEntity {
  entityType: string;
  entityId: string;
  effectType: 'created' | 'modified' | 'destroyed' | 'related';
}

interface EvaluationDimension {
  dimension: 'PLOT_ADVANCEMENT' | 'CHARACTER_DEVELOPMENT' | 'WORLD_DEPTH' |
             'EMOTIONAL_RESONANCE' | 'FORESHADOWING_POTENTIAL' | 'SURPRISE_FACTOR' |
             'THEMATIC_ALIGNMENT' | 'READER_ENGAGEMENT' | 'CONSISTENCY_MAINTENANCE';
  weight: number;                         // 0-1，权重
}

interface NarrativeValueAssessmentResponse {
  assessmentId: string;
  timestamp: string;

  // 排序后的结果
  rankedPossibilities: RankedPossibility[];

  // 总体分析
  overallAnalysis: string;                // 叙事化分析总结

  // 维度雷达图数据
  dimensionScores: DimensionScore[];
}

interface RankedPossibility {
  possibilityId: string;
  rank: number;
  overallScore: number;                   // 0-100
  dimensionBreakdown: Record<string, number>; // 各维度得分
  narrativeRationale: string;             // 叙事化推荐理由
  riskFlags: RiskFlag[];                  // 风险标记
  pairingSuggestions?: string[];          // 与其他可能性的搭配建议
}

interface RiskFlag {
  riskType: 'continuity' | 'character_consistency' | 'tone_shift' | 'pacing_disruption';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

interface DimensionScore {
  dimension: string;
  averageScore: number;
  maxScore: number;
  minScore: number;
}
```

### 2.6.3 场景感知查询接口

**调用方向**：工作室引擎 → 世界引擎壳
**目的**：正文生成时获取叙事化的环境上下文
**关键约束**：**只读查询**，工作室引擎不得通过此接口修改世界状态

```typescript
// ============================================================
// 场景感知查询接口
// ============================================================

// 请求方：工作室引擎壳
// 处理方：场景查询服务 (SceneQueryService) → 聚合多个世界子引擎
// 触发时机：章节/场景生成前的上下文构建阶段

interface SceneAwareQueryRequest {
  // 查询标识
  queryId: string;
  projectId: string;

  // 场景描述（工作室引擎提供的当前场景信息）
  sceneContext: {
    chapterNumber?: number;
    sceneDescription: string;           // 场景大意描述
    povCharacterId?: string;            // POV角色
    involvedCharacters: string[];       // 涉及角色
    locationId?: string;                // 场景地点
    timeOfScene?: string;               // 场景时间
    mood?: string;                      // 场景情绪基调
    pacingIntent?: 'fast' | 'moderate' | 'slow';
    narrativePurpose?: string;          // 叙事目的（如"揭示秘密"、"铺垫冲突"）
  };

  // 查询深度和范围
  queryConfig: {
    depth: 'surface' | 'standard' | 'deep';  // 查询深度
    maxContextTokens: number;                // 最大上下文Token数
    narrativeFormat: boolean;                // 是否返回叙事化格式
    includeHistoryDepth?: number;            // 包含多少章历史
  };

  // 所需信息类型
  requiredInformation: InformationType[];
}

type InformationType =
  | 'LOCATION_ENVIRONMENT'      // 地点环境描写
  | 'CHARACTER_MOTIVATION'      // 人物动机
  | 'FACTION_DYNAMICS'          // 势力动态
  | 'RECENT_EVENTS'             // 近期事件
  | 'RELEVANT_HISTORY'          // 相关历史
  | 'FORESHADOWING_CONTEXT'     // 伏笔上下文
  | 'SENSORY_DETAILS'           // 感官细节
  | 'ATMOSPHERE_MOOD'           // 氛围情绪
  | 'RULES_CONSTRAINTS'         // 规则约束
  | 'RELATIONSHIP_DYNAMICS'     // 关系动态
  | 'TIME_CONTEXT'              // 时间上下文
  | 'KNOWLEDGE_GAPS'            // 知识差距（信息不对称）
  ;

interface SceneAwareQueryResponse {
  queryId: string;

  // 叙事化环境描述（给LLM使用）
  narrativeContext: string;

  // 结构化数据（给工作室引擎逻辑使用）
  structuredData: {
    locationDetails?: LocationContext;
    characterContexts?: CharacterContext[];
    factionUpdates?: FactionUpdate[];
    recentEvents?: EventSummary[];
    foreshadowingOpportunities?: ForeshadowingOpportunity[];
    tensionPoints?: TensionPoint[];
    sensoryDetails?: SensoryDetail[];
  };

  // 数据来源追踪
  sources: SceneDataSource[];

  // 质量元数据
  metadata: {
    confidence: number;                 // 0-1，数据置信度
    completeness: number;               // 0-1，信息完整度
    contextTokens: number;              // 实际使用Token数
    queryTimeMs: number;
  };
}

interface CharacterContext {
  characterId: string;
  name: string;
  currentEmotionalState: string;
  currentMotivation: string;
  relevantRelationships: RelationshipSnapshot[];
  recentExperiences: ExperienceSummary[];
  physicalCondition?: string;
  currentLocation?: string;
}

interface LocationContext {
  locationId: string;
  name: string;
  description: string;
  environmentalConditions: string;
  relevantFeatures: string[];
  historicalSignificance?: string;
  currentOccupants?: string[];
  sensoryAtmosphere: string;
}

interface FactionUpdate {
  factionId: string;
  name: string;
  recentDevelopments: string[];
  relationshipToPOV?: string;
  currentPowerLevel?: string;
}

interface ForeshadowingOpportunity {
  foreshadowingId: string;
  description: string;
  suggestedApproach: string;
  subtletyLevel: 'obvious' | 'moderate' | 'subtle' | 'cryptic';
}

interface TensionPoint {
  description: string;
  intensity: number;                    // 0-1
  involvedParties: string[];
  escalationPotential: number;          // 0-1
}

interface SensoryDetail {
  sense: 'sight' | 'sound' | 'smell' | 'touch' | 'taste';
  description: string;
  relevanceScore: number;
}

interface SceneDataSource {
  engineName: string;
  queryType: string;
  confidence: number;
  dataPoints: number;
}
```

### 2.6.4 代价共情化接口

**调用方向**：协调层 → 工作室引擎壳（代价共情化服务）
**目的**：将结构化的代价数据转为故事性描述，呈现给作者

```typescript
// ============================================================
// 代价共情化接口
// ============================================================

// 请求方：协调层（当需要向作者展示神谕代价时）
// 处理方：代价共情化服务 (CostEmpathyService)
// 触发时机：神谕响应需要展示消耗时、提案需要展示影响时

interface CostEmpathyRequest {
  // 受众
  targetAudience: 'author' | 'character' | 'narrator';

  // 结构化代价数据
  costs: StructuredCost[];

  // 叙事上下文
  narrativeContext: {
    currentScene?: string;
    povCharacterId?: string;
    tonePreference?: 'somber' | 'dramatic' | 'matter_of_fact' | 'poetic';
    urgencyLevel?: 'calm' | 'pressing' | 'urgent' | 'desperate';
  };

  // 展示风格
  presentationStyle: {
    format: 'inline' | 'dialogue' | 'oracle_vision' | 'scroll' | 'whisper';
    length: 'brief' | 'standard' | 'elaborate';
    personalization?: boolean;          // 是否根据作者风格个性化
  };
}

interface StructuredCost {
  costType:
    | 'COMPUTATIONAL_TOKENS'      // 计算Token消耗
    | 'CONTEXT_WINDOW'            // 上下文窗口占用
    | 'KNOWLEDGE_DEPTH'           // 知识深度折损
    | 'CREATIVE_ENERGY'           // 创作能量（隐喻）
    | 'NARRATIVE_MOMENTUM'        // 叙事动量影响
    | 'TRUTH_REVEALED'            // 真相揭露程度
    | 'CONSEQUENCE_WEIGHT'        // 后果权重
    ;
  value: number;
  unit: string;
  description: string;
}

interface CostEmpathyResponse {
  empathyId: string;

  // 故事性描述（主要输出）
  narrativeDescription: string;

  // 备选表述（不同角度）
  alternativeDescriptions?: AlternativeDescription[];

  // 结构化数据（附带）
  costBreakdown: EmpatheticCostBreakdown[];

  // 元数据
  metadata: {
    totalCosts: number;
    primaryCostType: string;
    emotionalTone: string;
    wordCount: number;
  };
}

interface AlternativeDescription {
  perspective: 'omniscient' | 'character' | 'environment' | 'abstract';
  description: string;
}

interface EmpatheticCostBreakdown {
  costType: string;
  narrativeDescription: string;         // "知识的代价是记忆模糊"
  concreteValue: string;                // "消耗了 2,048 个Token"
  visualMetaphor?: string;              // "如同书页在风中逐渐模糊"
}
```

---

## 2.7 数据流序列图

### 2.7.1 章节生成完整流程

```
作者交互界面                          协调层                     Agent层                     服务层                      数据层
     │                                  │                          │                          │                          │
     │  [1] 请求生成新章节               │                          │                          │                          │
     │ ───────────────────────────────> │                          │                          │                          │
     │                                  │                          │                          │                          │
     │                                  │  [2] 验证权限，检查MOU状态   │                          │                          │
     │                                  │ ──────────────────────── │                          │                          │
     │                                  │                          │                          │                          │
     │                                  │  [3] MOU状态机：idle → generating                │                          │                          │
     │                                  │  触发条件：AUTHOR_CONTINUE 事件                    │                          │                          │
     │                                  │ ──────────────────────── │                          │                          │
     │                                  │                          │                          │                          │
     │                                  │  [4] 调用工作室引擎壳      │                          │                          │
     │                                  │ ────────────────────────>│                          │                          │
     │                                  │                          │                          │                          │
     │                                  │                          │  [5] 构建场景感知查询      │                          │
     │                                  │                          │ ────────────────────────>│                          │
     │                                  │                          │                          │                          │
     │                                  │                          │                          │  [6] 聚合多引擎数据       │
     │                                  │                          │                          │  • 查询地点上下文         │
     │                                  │                          │                          │  • 查询人物状态           │
     │                                  │                          │                          │  • 查询势力动态           │
     │                                  │                          │                          │  • 查询近期事件           │
     │                                  │                          │                          │  • 查询伏笔上下文         │
     │                                  │                          │                          │ ────────────────────────>│
     │                                  │                          │                          │                          │
     │                                  │                          │                          │                          │  [7] 执行SQL查询
     │                                  │                          │                          │                          │  • 人物表JOIN关系表
     │                                  │                          │                          │                          │  • 地点表JOIN环境表
     │                                  │                          │                          │                          │  • 事件表按时间筛选
     │                                  │                          │                          │                          │  • 向量相似度搜索
     │                                  │                          │                          │ <────────────────────────│
     │                                  │                          │                          │
     │                                  │                          │ <────────────────────────│
     │                                  │                          │  [8] 返回叙事化上下文      │
     │                                  │                          │  (地点描写+人物状态+氛围)  │
     │                                  │                          │
     │                                  │                          │  [9] 调用Prompt组装服务    │
     │                                  │                          │ ────────────────────────>│
     │                                  │                          │                          │
     │                                  │                          │ <────────────────────────│
     │                                  │                          │  [10] 返回组装好的Prompt   │
     │                                  │                          │  (系统提示+上下文+任务)     │
     │                                  │                          │
     │                                  │                          │  [11] 调用LLM生成          │
     │                                  │                          │  (流式输出)                │
     │                                  │                          │
     │  [12] SSE 流式传输生成内容        │                          │                          │
     │ <══════════════════════════════════════════════════════════ │                          │
     │  (逐字/逐句返回生成文本)           │                          │                          │
     │                                  │                          │
     │                                  │                          │  [13] 生成完成，构建提案    │
     │                                  │ <────────────────────────│                          │
     │                                  │                          │
     │                                  │  [14] MOU状态机：generating → review_pending        │                          │
     │                                  │  等待人类审阅              │                          │
     │                                  │                          │
     │  [15] 推送提案待审阅通知          │                          │                          │
     │ <─────────────────────────────── │                          │                          │
     │                                  │                          │                          │
     │  [16] 作者审阅提案                │                          │                          │
     │ ───────────────────────────────> │                          │                          │
     │  (APPROVE / REJECT / MODIFY)     │                          │                          │
     │                                  │                          │                          │
     │                                  │  [17] 发送人类事件到MOU状态机                       │                          │
     │                                  │  如 AUTHOR_APPROVE        │                          │                          │
     │                                  │                          │
     │                                  │  [18] 触发谏官审查        │                          │
     │                                  │ ────────────────────────>│                          │
     │                                  │                          │                          │
     │                                  │                          │  [19] 执行质量检查         │
     │                                  │                          │  • 连续性检查              │
     │                                  │                          │  • 风格一致性              │
     │                                  │                          │  • 设定合规性              │
     │                                  │                          │
     │                                  │ <────────────────────────│                          │
     │                                  │                          │
     │                                  │  [20] 谏官审查通过        │                          │
     │                                  │  (未通过则返回修改)        │                          │
     │                                  │                          │
     │                                  │  [21] 触发世界引擎固化     │                          │
     │                                  │ ────────────────────────>│                          │
     │                                  │                          │                          │
     │                                  │                          │  [22] 执行原子固化事务     │
     │                                  │                          │  BEGIN TRANSACTION        │
     │                                  │                          │  SERIALIZABLE             │
     │                                  │                          │                          │
     │                                  │                          │                          │  [23] 原子写入
     │                                  │                          │                          │  INSERT INTO chapters
     │                                  │                          │                          │  UPDATE characters SET ...
     │                                  │                          │                          │  INSERT INTO event_logs
     │                                  │                          │                          │  INSERT INTO foreshadowings
     │                                  │                          │                          │  INSERT INTO ripples
     │                                  │                          │                          │  INSERT INTO version_snapshots
     │                                  │                          │                          │  COMMIT
     │                                  │                          │                          │
     │                                  │                          │ <────────────────────────│
     │                                  │                          │
     │                                  │  [24] 固化完成，MOU状态更新                         │                          │
     │                                  │  review_pending → idle (或下一状态)                  │                          │
     │                                  │                          │
     │  [25] 推送固化完成通知            │                          │                          │
     │  + 世界变更摘要                   │                          │                          │
     │  + 新伏笔提示                     │                          │                          │
     │  + 涟漪效果预览                   │                          │                          │
     │ <─────────────────────────────── │                          │                          │
     │                                  │                          │                          │
```

### 2.7.2 作者手动编辑流程

```
作者交互界面                          协调层                     Agent层                     服务层                      数据层
     │                                  │                          │                          │                          │
     │  [1] 手动编辑章节内容             │                          │                          │                          │
     │  (PATCH /api/v3/chapters/:id)    │                          │                          │                          │
     │ ───────────────────────────────> │                          │                          │                          │
     │                                  │                          │                          │
     │                                  │  [2] 权限验证 + MOU状态检查 │                          │                          │
     │                                  │                          │
     │                                  │  [3] 允许编辑，不经过MOU状态机                        │                          │
     │                                  │  (人类编辑是最高权限)        │                          │                          │
     │                                  │                          │
     │                                  │  [4] 直接写入数据库        │                          │                          │
     │                                  │ ────────────────────────────────────────────────────>│
     │                                  │                          │                          │
     │                                  │                          │                          │  [5] 更新章节内容
     │                                  │                          │                          │  + 创建新版本记录
     │                                  │                          │                          │
     │                                  │  [6] 异步触发谏官审查      │                          │
     │                                  │  (不阻塞编辑流程)          │                          │
     │                                  │ ────────────────────────>│                          │
     │                                  │                          │
     │  [7] 返回编辑成功                 │                          │                          │
     │ <─────────────────────────────── │                          │                          │
     │                                  │                          │
     │                                  │                          │  [8] 谏官审查结果         │
     │                                  │                          │  (异步通知)                │
     │                                  │                          │
     │  [9] 推送审查建议（如有）          │                          │                          │
     │ <─────────────────────────────── │                          │                          │
     │  "发现人物行为与前设不一致..."      │                          │                          │
```

### 2.7.3 神谕查询流程

```
作者交互界面                          协调层                     Agent层                     服务层                      数据层
     │                                  │                          │                          │                          │
     │  [1] 向神谕提问                   │                          │                          │
     │  (POST /api/v3/oracle)           │                          │                          │
     │ ───────────────────────────────> │                          │
     │                                  │
     │                                  │  [2] 验证权限             │
     │                                  │  检查查询频率限制          │
     │                                  │
     │                                  │  [3] 构建查询上下文        │
     │                                  │  从会话中获取当前项目ID    │
     │                                  │
     │                                  │  [4] 调用世界引擎壳        │
     │                                  │  (场景感知查询)            │
     │                                  │ ────────────────────────>│
     │                                  │                          │
     │                                  │                          │  [5] 查询相关世界数据      │
     │                                  │                          │  ───────────────────────>│
     │                                  │                          │                          │
     │                                  │                          │                          │  [6] 数据库查询
     │                                  │                          │                          │  + 向量搜索相关实体
     │                                  │                          │                          │  + 全文检索相关事件
     │                                  │                          │                          │
     │                                  │                          │ <────────────────────────│
     │                                  │                          │
     │                                  │ <────────────────────────│
     │                                  │                          │
     │                                  │  [7] 调用LLM生成回答      │
     │                                  │  (通过工作室引擎壳)        │
     │                                  │ ────────────────────────>│
     │                                  │                          │
     │                                  │                          │  [8] 组装Prompt           │
     │                                  │                          │  上下文+问题+风格指令       │
     │                                  │                          │
     │                                  │                          │  [9] LLM生成回答           │
     │                                  │                          │
     │                                  │ <────────────────────────│
     │                                  │                          │
     │                                  │  [10] 调用代价共情化服务   │
     │                                  │  (展示查询消耗)            │
     │                                  │ ────────────────────────>│
     │                                  │                          │
     │                                  │ <────────────────────────│
     │                                  │                          │
     │  [11] 返回回答+消耗描述           │                          │
     │  + 叙事化回答                     │                          │
     │  + "这次窥视消耗了 1,500 个灵视…"  │                          │                          │
     │ <─────────────────────────────── │                          │
```

### 2.7.4 涟漪效果计算流程

```
协调层                             世界引擎壳                 涟漪计算服务               数据层
  │                                   │                          │                          │
  │  [1] 固化完成后，检测到状态变更      │                          │                          │
  │ ────────────────────────────────> │                          │
  │                                   │
  │                                   │  [2] 构建涟漪计算请求      │
  │                                   │  originEvent = 本次变更    │
  │                                   │ ────────────────────────>│
  │                                   │                          │
  │                                   │                          │  [3] 读取当前世界状态      │
  │                                   │                          │  ───────────────────────>│
  │                                   │                          │                          │
  │                                   │                          │                          │  [4] SQL查询
  │                                   │                          │                          │  • 受影响的实体
  │                                   │                          │                          │  • 相关的关系链
  │                                   │                          │                          │  • 历史和约束
  │                                   │                          │                          │
  │                                   │                          │ <────────────────────────│
  │                                   │                          │
  │                                   │                          │  [5] 递归推演因果传播      │
  │                                   │                          │  Depth 1: 直接影响        │
  │                                   │                          │  Depth 2: 间接影响        │
  │                                   │                          │  Depth 3: 长期影响        │
  │                                   │                          │
  │                                   │ <────────────────────────│
  │                                   │                          │
  │                                   │  [6] 存储涟漪记录          │
  │                                   │  ──────────────────────────────────────────────────>│
  │                                   │                          │
  │                                   │                          │  [7] 写入 ripples 表
  │                                   │                          │
  │  [8] 返回涟漪效果摘要              │                          │
  │  (含叙事机会建议)                   │                          │
  │ <───────────────────────────────  │                          │
```

---

## 2.8 认证与授权机制

### 2.8.1 认证架构

```
┌──────────────────────────────────────────────────────────────┐
│                     认证架构图                                │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │   用户名/密码  │   │   JWT Token   │   │   API Key    │   │
│  │  (本地认证)    │   │  (会话管理)    │   │ (自动化访问)  │   │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   │
│         │                   │                   │           │
│         └───────────────────┼───────────────────┘           │
│                             │                               │
│                             ▼                               │
│                  ┌────────────────────┐                     │
│                  │   @fastify/jwt     │                     │
│                  │   (Token签发/校验)  │                     │
│                  └─────────┬──────────┘                     │
│                            │                                │
│                            ▼                                │
│                  ┌────────────────────┐                     │
│                  │   认证中间件        │                     │
│                  │  1. 提取Token       │                     │
│                  │  2. 校验签名        │                     │
│                  │  3. 检查过期        │                     │
│                  │  4. 解析声明        │                     │
│                  └─────────┬──────────┘                     │
│                            │                                │
│                            ▼                                │
│                  ┌────────────────────┐                     │
│                  │   请求上下文注入    │                     │
│                  │  request.user       │                     │
│                  └────────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

### 2.8.2 JWT Token 设计

```typescript
// ============================================================
// JWT Token 规范
// 算法：RS256 (RSA + SHA-256)
// Token有效期：access_token 15分钟, refresh_token 7天
// ============================================================

// Access Token Payload
interface AccessTokenPayload {
  // 标准声明
  sub: string;                    // 用户ID (UUID)
  iss: string;                    // 签发者: "narrative-os-auth"
  aud: string;                    // 受众: "narrative-os-api"
  iat: number;                    // 签发时间 (Unix timestamp)
  exp: number;                    // 过期时间 (15分钟)
  jti: string;                    // Token唯一标识 (UUID)

  // 自定义声明
  user: {
    userId: string;
    username: string;
    displayName: string;
    email: string;
    plan: 'free' | 'pro' | 'ultimate';  // 订阅等级
  };

  // 权限声明 (RBAC)
  roles: UserRole[];

  // 项目上下文（可选，用于项目级Token）
  projectContext?: {
    projectId: string;
    permissions: ProjectPermission[];
  };
}

type UserRole = 'author' | 'admin' | 'system' | 'guest';

type ProjectPermission =
  | 'read'                    // 读取项目
  | 'write'                   // 编辑内容
  | 'generate'                // AI生成
  | 'manage_world'            // 管理世界设定
  | 'manage_members'          // 管理成员
  | 'delete'                  // 删除项目
  | 'export'                  // 导出数据
  ;

// Refresh Token Payload（仅包含最小信息）
interface RefreshTokenPayload {
  sub: string;                    // 用户ID
  jti: string;                    // Token唯一标识
  iat: number;
  exp: number;                    // 7天
  tokenVersion: number;           // 令牌版本（用于强制失效）
}

// API Key（用于自动化访问/第三方集成）
interface ApiKeyCredentials {
  keyId: string;                  // 密钥标识
  prefix: string;                 // 可识别前缀 (nosak_)
  scopes: ApiScope[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  projectAccess: string[];        // 可访问的项目列表
  expiresAt?: string;
}

type ApiScope =
  | 'read:projects'
  | 'write:chapters'
  | 'generate:content'
  | 'read:world'
  | 'write:world'
  | 'admin:all'
  ;
```

### 2.8.3 授权模型（RBAC + ABAC）

```typescript
// ============================================================
// 角色定义（RBAC）
// ============================================================

interface RoleDefinition {
  roleId: UserRole;
  displayName: string;
  description: string;
  basePermissions: Permission[];
  inheritsFrom?: UserRole[];
}

const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  author: {
    roleId: 'author',
    displayName: '作者',
    description: '项目创作者，拥有项目完全控制权',
    basePermissions: [
      'project:create', 'project:read', 'project:update', 'project:delete',
      'chapter:create', 'chapter:read', 'chapter:update', 'chapter:delete',
      'world:read', 'world:update',
      'generate:use', 'generate:configure',
      'member:invite', 'member:manage',
      'export:all'
    ]
  },
  admin: {
    roleId: 'admin',
    displayName: '管理员',
    description: '系统管理员',
    basePermissions: [
      'system:manage', 'user:manage', 'project:admin',
      'billing:manage', 'config:update', 'log:read'
    ]
  },
  system: {
    roleId: 'system',
    displayName: '系统',
    description: '内部系统服务间调用',
    basePermissions: [
      'internal:all', 'service:call', 'health:check'
    ]
  },
  guest: {
    roleId: 'guest',
    displayName: '访客',
    description: '未认证访客，仅预览',
    basePermissions: [
      'project:preview', 'chapter:sample'
    ]
  }
};

// ============================================================
// 属性授权（ABAC）
// ============================================================

interface AttributeBasedAccessControl {
  // 资源属性
  resourceAttributes: {
    projectOwnerId?: string;        // 项目所有者
    projectVisibility: 'public' | 'private' | 'shared';
    chapterStatus: 'draft' | 'published';
    isArchived: boolean;
  };

  // 主体属性
  subjectAttributes: {
    userId: string;
    roles: UserRole[];
    subscriptionPlan: string;
    isProjectMember: boolean;
    memberRole?: 'owner' | 'editor' | 'viewer';
  };

  // 环境属性
  environmentAttributes: {
    timeOfDay: string;
    requestIp: string;
    userAgent: string;
    rateLimitRemaining: number;
  };
}

// ABAC 决策规则
interface AccessDecisionRule {
  ruleId: string;
  description: string;
  effect: 'allow' | 'deny';
  conditions: AccessCondition[];
  priority: number;
}

type AccessCondition =
  | { type: 'role_in'; roles: UserRole[] }
  | { type: 'permission_has'; permission: Permission }
  | { type: 'is_owner'; resourceField: string }
  | { type: 'is_member'; projectIdField: string }
  | { type: 'attribute_equals'; attribute: string; value: unknown }
  | { type: 'attribute_in'; attribute: string; values: unknown[] }
  | { type: 'rate_limit_check'; maxRequests: number; windowMs: number }
  | { type: 'custom'; evaluator: (context: AccessContext) => boolean }
  ;
```

### 2.8.4 中间件接口

```typescript
// ============================================================
// 认证中间件
// ============================================================

interface AuthenticationMiddleware {
  // Fastify 中间件注册
  register(server: FastifyInstance): void;

  // 提取认证凭据
  extractCredentials(request: FastifyRequest): Credentials | null;

  // 校验凭据
  verifyCredentials(credentials: Credentials): Promise<AuthResult>;

  // 注入用户信息到请求上下文
  decorateRequest(request: FastifyRequest, user: AuthenticatedUser): void;
}

interface Credentials {
  type: 'bearer' | 'api_key' | 'session';
  value: string;
}

interface AuthResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: AuthError;
}

interface AuthenticatedUser {
  userId: string;
  username: string;
  displayName: string;
  email: string;
  roles: UserRole[];
  plan: string;
  permissions: Permission[];
  sessionId?: string;
}

// ============================================================
// 授权中间件
// ============================================================

interface AuthorizationMiddleware {
  // 注册路由级权限检查
  requirePermission(permission: Permission): preHandlerHookHandler;

  // 注册资源所有权检查
  requireOwnership(resourceType: string, extractor: ParamExtractor): preHandlerHookHandler;

  // 项目级权限检查
  requireProjectPermission(permission: ProjectPermission): preHandlerHookHandler;

  // 组合权限检查（满足任意或全部）
  requireAnyPermission(permissions: Permission[]): preHandlerHookHandler;
  requireAllPermissions(permissions: Permission[]): preHandlerHookHandler;
}

type ParamExtractor = (request: FastifyRequest) => { resourceId: string; ownerField: string };

// ============================================================
// 速率限制中间件
// ============================================================

interface RateLimitConfig {
  // 全局限制
  global: {
    maxRequests: number;
    windowMs: number;
  };

  // 按端点限制
  endpoints: Record<string, {
    maxRequests: number;
    windowMs: number;
    keyGenerator?: (request: FastifyRequest) => string;
  }>;

  // 按用户等级限制
  tierLimits: Record<string, {
    maxRequestsPerMinute: number;
    maxConcurrentGenerations: number;
    maxTokensPerDay: number;
  }>;
}

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  global: {
    maxRequests: 100,
    windowMs: 60000           // 1分钟
  },
  endpoints: {
    'POST /api/v3/projects/:projectId/mou/event': {
      maxRequests: 30,
      windowMs: 60000
    },
    'POST /api/v3/oracle': {
      maxRequests: 10,
      windowMs: 60000
    }
  },
  tierLimits: {
    free: {
      maxRequestsPerMinute: 20,
      maxConcurrentGenerations: 1,
      maxTokensPerDay: 100000
    },
    pro: {
      maxRequestsPerMinute: 60,
      maxConcurrentGenerations: 3,
      maxTokensPerDay: 500000
    },
    ultimate: {
      maxRequestsPerMinute: 120,
      maxConcurrentGenerations: 5,
      maxTokensPerDay: 2000000
    }
  }
};
```

---

## 2.9 配置管理方案

### 2.9.1 配置分层架构

```
配置优先级（从上到下，下面的覆盖上面的）：

┌──────────────────────────────────────────────────────────────┐
│ Layer 4: 运行时动态配置 (Runtime / DB)                        │
│          管理员通过管理界面实时修改，无需重启                   │
│          存储在 PostgreSQL config 表                          │
├──────────────────────────────────────────────────────────────┤
│ Layer 3: 环境变量 (Environment Variables)                      │
│          容器/服务器环境注入，敏感信息优先                      │
│          命名规范：NOS__{SECTION}__{KEY}                       │
├──────────────────────────────────────────────────────────────┤
│ Layer 2: 环境配置文件 (Environment Config Files)                │
│          config/{environment}.yaml                            │
│          development.yaml / staging.yaml / production.yaml    │
├──────────────────────────────────────────────────────────────┤
│ Layer 1: 默认配置 (Default Config)                             │
│          config/default.yaml                                  │
│          所有配置的基线值                                      │
└──────────────────────────────────────────────────────────────┘
```

### 2.9.2 配置文件结构

```yaml
# ============================================================
# 默认配置文件: config/default.yaml
# ============================================================

# 应用基础配置
app:
  name: "NarrativeOS"
  version: "3.0.0"
  env: "development"               # development | staging | production
  logLevel: "info"                 # debug | info | warn | error
  timezone: "Asia/Shanghai"
  defaultLanguage: "zh-CN"

# HTTP服务器配置
server:
  host: "0.0.0.0"
  port: 3000
  keepAliveTimeout: 72000          # ms
  bodyLimit: 10485760              # 10MB
  trustProxy: false

  # CORS配置
  cors:
    origin: ["http://localhost:5173"]
    credentials: true
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allowedHeaders: ["Authorization", "Content-Type", "X-Request-ID"]

  # 限流配置
  rateLimit:
    enabled: true
    maxRequests: 100
    windowMs: 60000

# WebSocket配置
websocket:
  enabled: true
  pingInterval: 25000              # ms
  pingTimeout: 20000               # ms
  maxConnectionsPerUser: 5
  messageRateLimit: 60             # 每分钟最大消息数

# JWT认证配置
auth:
  algorithm: "RS256"
  accessTokenExpiry: "15m"         # 15分钟
  refreshTokenExpiry: "7d"         # 7天
  issuer: "narrative-os-auth"
  audience: "narrative-os-api"

  # 公钥/私钥路径（文件路径或环境变量引用）
  publicKeyPath: "./keys/jwt-public.pem"
  privateKeyPath: "./keys/jwt-private.pem"

# 数据库配置
database:
  postgresql:
    host: "localhost"
    port: 5432
    database: "narrative_os"
    schema: "public"
    poolSize: 20
    connectionTimeout: 10000       # ms
    idleTimeout: 30000             # ms
    ssl: false
    migrations:
      autoRun: true
      directory: "./drizzle"

  redis:
    host: "localhost"
    port: 6379
    database: 0
    password: null
    keyPrefix: "nos:"
    maxRetriesPerRequest: 3
    enableReadyCheck: true

  minio:
    endPoint: "localhost"
    port: 9000
    useSSL: false
    accessKey: "minioadmin"
    secretKey: "minioadmin"
    bucketName: "narrative-os-documents"

# LLM配置
llm:
  defaultProvider: "openai"
  timeout: 300000                  # 5分钟
  maxRetries: 3
  retryDelay: 1000                 # ms

  providers:
    openai:
      apiKey: "${NOS__LLM__OPENAI_API_KEY}"   # 从环境变量读取
      baseUrl: "https://api.openai.com/v1"
      defaultModel: "gpt-4o"
      models:
        generation: "gpt-4o"       # 生成主力模型
        analysis: "gpt-4o-mini"    # 分析轻量模型
        embedding: "text-embedding-3-large"

    anthropic:
      apiKey: "${NOS__LLM__ANTHROPIC_API_KEY}"
      baseUrl: "https://api.anthropic.com"
      defaultModel: "claude-3-5-sonnet-20241022"
      models:
        generation: "claude-3-5-sonnet-20241022"
        longContext: "claude-3-5-sonnet-20241022"

  # Token预算配置
  tokenBudget:
    maxContextWindow: 128000       # 最大上下文窗口
    reservedOutputTokens: 4096     # 预留输出Token
    safetyMargin: 0.9              # 安全边距系数

# 引擎配置
engines:
  world:
    cacheTimeout: 300              # 世界数据缓存5分钟
    queryTimeout: 30000            # 查询超时30秒
    maxQueryDepth: 3               # 最大查询深度

  studio:
    generationTimeout: 300000      # 生成超时5分钟
    maxConcurrentGenerations: 3    # 最大并发生成数
    streamChunkSize: 16            # 流式输出块大小（字符）

  censor:
    checkTimeout: 15000            # 检查超时15秒
    maxConcurrentChecks: 5
    autoCheckOnEdit: true          # 编辑后自动检查

  flowGuardian:
    checkInterval: 300000          # 5分钟检查一次
    flowThreshold:
      deep_flow: 90
      flow: 70
      engaged: 50
      distracted: 30
      stuck: 0
    interventionCooldown: 600000   # 干预冷却10分钟

# 服务配置
services:
  promptAssembly:
    maxTemplateDepth: 5            # 模板嵌套最大深度
    defaultCompression: "light"

  quality:
    minScoreThreshold: 60          # 最低质量分（低于则要求修改）
    autoCheckEnabled: true

  risk:
    analysisDepth: "standard"      # quick | standard | deep
    maxRiskScore: 75               # 超过则阻止执行

  version:
    autoSnapshot: true
    snapshotInterval: 5            # 每5章自动快照
    maxSnapshotsPerProject: 50     # 最大保留快照数
    storagePath: "versions/"

  ripple:
    maxPropagationDepth: 3
    defaultAffectedDomains: ["character", "faction", "location"]

# 缓存配置
cache:
  defaultTTL: 300                  # 默认5分钟
  worldDataTTL: 600               # 世界数据10分钟
  userSessionTTL: 3600            # 会话1小时
  maxKeySize: 1048576             # 1MB

  # 热点数据本地缓存
  localCache:
    enabled: true
    maxSize: 100                   # 最多100条
    ttl: 60                        # 1分钟

# 功能开关
features:
  webSocketEnabled: true
  streamingGeneration: true
  autoSave: true
  collaborativeEditing: false      # v3.1 规划
  aiSuggestions: true
  foreshadowingTracking: true
  rippleVisualization: true
  oracleConsultation: true
  costDisplay: true

# 监控配置
monitoring:
  metricsEnabled: true
  tracingEnabled: true
  healthCheckPath: "/health"
  metricsPath: "/metrics"

  prometheus:
    enabled: true
    port: 9090

  jaeger:
    enabled: false
    agentHost: "localhost"
    agentPort: 6832

# 安全配置
security:
  bcryptRounds: 12
  maxLoginAttempts: 5
  lockoutDuration: 900             # 15分钟
  passwordMinLength: 8
  requireSpecialChar: true

  dataEncryption:
    enabled: true
    algorithm: "aes-256-gcm"
    keyRotationDays: 90
```

### 2.9.3 配置管理代码接口

```typescript
// ============================================================
// 配置管理服务接口
// ============================================================

interface ConfigService {
  // 获取配置值（支持嵌套路径）
  get<T>(key: string, defaultValue?: T): T;
  // 示例: config.get<number>('server.port') → 3000
  // 示例: config.get<string>('llm.providers.openai.defaultModel') → "gpt-4o"

  // 获取配置值（必须存在，不存在则抛错）
  getOrThrow<T>(key: string): T;

  // 设置配置值（运行时，仅当前实例）
  set<T>(key: string, value: T): void;

  // 检查配置是否存在
  has(key: string): boolean;

  // 获取整个配置对象
  getAll(): Record<string, unknown>;

  // 监听配置变更
  onChange(key: string, handler: ConfigChangeHandler): ConfigSubscription;

  // 获取配置变更历史
  getChangeHistory(key?: string): ConfigChangeRecord[];

  // 热重载配置（从数据库/文件重新加载）
  reload(): Promise<void>;
}

type ConfigChangeHandler = (newValue: unknown, oldValue: unknown, key: string) => void;

interface ConfigSubscription {
  unsubscribe(): void;
}

interface ConfigChangeRecord {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  changedAt: string;
  changedBy?: string;
  source: 'file' | 'environment' | 'database' | 'runtime';
}

// ============================================================
// 配置验证 Schema (Zod)
// ============================================================

import { z } from 'zod';

const ConfigSchema = z.object({
  app: z.object({
    name: z.string().default('NarrativeOS'),
    version: z.string().regex(/^\d+\.\d+\.\d+/),
    env: z.enum(['development', 'staging', 'production']),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }),

  server: z.object({
    host: z.string().default('0.0.0.0'),
    port: z.number().int().min(1).max(65535).default(3000),
    keepAliveTimeout: z.number().default(72000),
    bodyLimit: z.number().default(10485760),
  }),

  database: z.object({
    postgresql: z.object({
      host: z.string(),
      port: z.number().default(5432),
      database: z.string(),
      poolSize: z.number().default(20),
    }),
    redis: z.object({
      host: z.string(),
      port: z.number().default(6379),
      password: z.string().nullable().default(null),
    }),
  }),

  llm: z.object({
    defaultProvider: z.string(),
    timeout: z.number().default(300000),
    maxRetries: z.number().default(3),
    providers: z.record(z.object({
      apiKey: z.string(),
      baseUrl: z.string().url(),
      defaultModel: z.string(),
    })),
    tokenBudget: z.object({
      maxContextWindow: z.number().default(128000),
      reservedOutputTokens: z.number().default(4096),
      safetyMargin: z.number().min(0).max(1).default(0.9),
    }),
  }),

  auth: z.object({
    algorithm: z.string().default('RS256'),
    accessTokenExpiry: z.string().default('15m'),
    refreshTokenExpiry: z.string().default('7d'),
  }),

  cache: z.object({
    defaultTTL: z.number().default(300),
    worldDataTTL: z.number().default(600),
  }),

  features: z.record(z.boolean()).default({}),
});

type AppConfig = z.infer<typeof ConfigSchema>;
```

---

## 2.10 日志与监控接口

### 2.10.1 日志架构

```
┌──────────────────────────────────────────────────────────────┐
│                       日志架构图                              │
│                                                              │
│  应用程序日志                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ 请求日志 │  │ 业务日志 │  │ 错误日志 │  │ 审计日志 │       │
│  │ Access  │  │ Business│  │ Error   │  │ Audit   │       │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
│       │            │            │            │              │
│       └────────────┴────────────┴────────────┘              │
│                        │                                     │
│                        ▼                                     │
│              ┌─────────────────────┐                         │
│              │   Pino Logger       │  ← 高性能JSON日志库      │
│              │   (pino 9.x)        │                         │
│              └─────────────────────┘                         │
│                        │                                     │
│           ┌────────────┼────────────┐                       │
│           │            │            │                       │
│           ▼            ▼            ▼                       │
│     ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│     │ 控制台    │ │ 日志文件  │ │ Loki     │                │
│     │ (开发)    │ │ (结构化)  │ │ (聚合)   │                │
│     └──────────┘ └──────────┘ └──────────┘                │
│                                     │                        │
│                                     ▼                        │
│                             ┌──────────────┐                │
│                             │   Grafana    │                │
│                             │  (可视化)     │                │
│                             └──────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

### 2.10.2 日志规范

```typescript
// ============================================================
// 日志等级与用途
// ============================================================

enum LogLevel {
  TRACE = 10,    // 最详细跟踪，仅开发环境
  DEBUG = 20,    // 调试信息，开发/测试环境
  INFO = 30,     // 正常操作信息，生产环境默认
  WARN = 40,     // 警告，不影响核心功能
  ERROR = 50,    // 错误，功能受影响但系统可用
  FATAL = 60,    // 致命错误，系统不可用
}

// ============================================================
// 日志条目结构 (结构化JSON日志)
// ============================================================

interface LogEntry {
  // 标准字段
  level: LogLevel;
  timestamp: string;                      // ISO 8601
  message: string;

  // 上下文字段
  requestId?: string;                     // 请求追踪ID
  userId?: string;                        // 用户ID
  projectId?: string;                     // 项目ID
  sessionId?: string;                     // 会话ID

  // 位置信息
  service: string;                        // 服务名
  component: string;                      // 组件名
  function?: string;                      // 函数名
  file?: string;
  line?: number;

  // 业务上下文
  event?: string;                         // 事件名
  entityType?: string;                    // 实体类型
  entityId?: string;                      // 实体ID
  action?: string;                        // 操作名
  mouState?: string;                      // MOU状态

  // 性能数据
  durationMs?: number;
  memoryUsage?: NodeJS.MemoryUsage;

  // 错误详情
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    cause?: unknown;
  };

  // 附加数据（业务自定义）
  metadata?: Record<string, unknown>;
}

// ============================================================
// 日志记录器接口
// ============================================================

interface Logger {
  // 基础日志方法
  trace(msg: string, meta?: LogMetadata): void;
  debug(msg: string, meta?: LogMetadata): void;
  info(msg: string, meta?: LogMetadata): void;
  warn(msg: string, meta?: LogMetadata): void;
  error(msg: string, meta?: LogMetadata): void;
  fatal(msg: string, meta?: LogMetadata): void;

  // 子记录器（绑定上下文）
  child(bindings: LogBindings): Logger;

  // 带性能计时
  startTimer(label: string): () => void;

  // 刷新日志缓冲区
  flush(): Promise<void>;
}

interface LogMetadata {
  [key: string]: unknown;
  error?: Error;
  durationMs?: number;
}

interface LogBindings {
  service?: string;
  component?: string;
  requestId?: string;
  userId?: string;
  projectId?: string;
  [key: string]: unknown;
}

// ============================================================
// 审计日志（单独规范，不可丢失）
// ============================================================

interface AuditLogEntry {
  logId: string;                          // UUID
  timestamp: string;                      // ISO 8601

  // 主体
  actorId: string;                        // 操作者ID
  actorType: 'user' | 'system' | 'api';
  actorRole?: string;

  // 动作
  action: AuditAction;
  actionCategory: 'auth' | 'crud' | 'mou' | 'system' | 'billing';

  // 对象
  resourceType: string;
  resourceId: string;
  projectId?: string;

  // 详情
  details: {
    before?: Record<string, unknown>;     // 变更前
    after?: Record<string, unknown>;      // 变更后
    diff?: Record<string, unknown>;       // 差异
    metadata?: Record<string, unknown>;
  };

  // 结果
  result: 'success' | 'failure' | 'denied';
  failureReason?: string;

  // 上下文
  ipAddress?: string;
  userAgent?: string;
  requestId: string;
  mouState?: string;
}

type AuditAction =
  // 认证
  | 'login' | 'logout' | 'token_refresh' | 'password_change'
  // CRUD
  | 'create' | 'read' | 'update' | 'delete'
  // MOU
  | 'mou_transition' | 'proposal_approve' | 'proposal_reject' | 'proposal_modify'
  // 系统
  | 'config_change' | 'backup' | 'restore'
  ;

// 审计日志记录接口
interface AuditLogger {
  log(entry: Omit<AuditLogEntry, 'logId' | 'timestamp'>): Promise<void>;
  query(filters: AuditQueryFilters): Promise<PaginatedResult<AuditLogEntry>>;
}
```

### 2.10.3 监控接口

```typescript
// ============================================================
// 指标收集 (Prometheus格式)
// ============================================================

interface MetricsCollector {
  // 计数器
  counter(name: string, labels?: Record<string, string>): Counter;

  // 仪表盘（瞬时值）
  gauge(name: string, labels?: Record<string, string>): Gauge;

  // 直方图
  histogram(name: string, buckets?: number[], labels?: Record<string, string>): Histogram;

  // 摘要
  summary(name: string, percentiles?: number[], labels?: Record<string, string>): Summary;
}

interface Counter {
  inc(value?: number): void;
  labels(labels: Record<string, string>): Counter;
}

interface Gauge {
  set(value: number): void;
  inc(value?: number): void;
  dec(value?: number): void;
  labels(labels: Record<string, string>): Gauge;
}

interface Histogram {
  observe(value: number): void;
  labels(labels: Record<string, string>): Histogram;
  startTimer(): () => number;        // 返回stop函数，自动记录时长
}

interface Summary {
  observe(value: number): void;
  labels(labels: Record<string, string>): Summary;
}

// ============================================================
// 预定义业务指标
// ============================================================

const BUSINESS_METRICS = {
  // MOU状态机指标
  'mou_transitions_total': 'MOU状态转移总次数',
  'mou_state_duration_seconds': 'MOU状态停留时长',
  'mou_waiting_human_total': '等待人类输入次数',

  // 生成指标
  'generation_requests_total': '生成请求总数',
  'generation_duration_seconds': '生成耗时',
  'generation_tokens_total': '生成Token总数',
  'generation_errors_total': '生成错误数',
  'generation_quality_score': '生成质量分',

  // 提案指标
  'proposals_created_total': '提案创建数',
  'proposals_approved_total': '提案批准数',
  'proposals_rejected_total': '提案拒绝数',
  'proposal_review_duration_seconds': '提案审阅时长',

  // 固化指标
  'solidifications_total': '固化操作数',
  'solidification_duration_seconds': '固化耗时',
  'solidification_entities_changed_total': '固化实体变更数',

  // API指标
  'http_requests_total': 'HTTP请求总数',
  'http_request_duration_seconds': 'HTTP请求耗时',
  'http_errors_total': 'HTTP错误数',
  'websocket_connections_total': 'WebSocket连接数',
  'websocket_messages_total': 'WebSocket消息数',

  // 系统指标
  'active_projects_total': '活跃项目数',
  'active_sessions_total': '活跃会话数',
  'queue_jobs_total': '队列任务数',
  'cache_hit_ratio': '缓存命中率',

  // 谏官指标
  'censor_checks_total': '谏官检查次数',
  'censor_violations_total': '违规发现次数',
  'censor_pass_rate': '通过率',

  // 心流指标
  'flow_scores_histogram': '心流分数分布',
  'interventions_total': '干预次数',
} as const;

// ============================================================
// 健康检查接口
// ============================================================

interface HealthChecker {
  // 综合健康检查
  check(): Promise<HealthStatus>;

  // 组件级健康检查
  checkComponent(name: string): Promise<ComponentHealth>;

  // 注册自定义健康检查
  registerCheck(
    name: string,
    checker: () => Promise<ComponentHealth>,
    options?: { critical?: boolean; interval?: number }
  ): void;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: ComponentHealth[];
}

interface ComponentHealth {
  name: string;
  status: 'up' | 'down' | 'degraded' | 'unknown';
  responseTimeMs: number;
  lastChecked: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// 链路追踪 (OpenTelemetry/Jaeger)
// ============================================================

interface Tracer {
  // 开始一个Span
  startSpan(name: string, options?: SpanOptions): Span;

  // 获取当前Span
  getCurrentSpan(): Span | null;

  // 注入追踪上下文到请求
  inject(context: TraceContext, carrier: Record<string, string>): void;

  // 从请求中提取追踪上下文
  extract(carrier: Record<string, string>): TraceContext | null;
}

interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  startTime: number;
  endTime?: number;

  setAttribute(key: string, value: unknown): void;
  addEvent(name: string, attributes?: Record<string, unknown>): void;
  setStatus(status: SpanStatus): void;
  recordException(error: Error): void;
  end(): void;

  // 创建子Span
  child(name: string, options?: SpanOptions): Span;
}

interface SpanOptions {
  parent?: Span;
  kind?: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
  attributes?: Record<string, unknown>;
}

interface SpanStatus {
  code: 'unset' | 'ok' | 'error';
  message?: string;
}

interface TraceContext {
  traceId: string;
  spanId: string;
  sampled: boolean;
  baggage: Record<string, string>;
}
```

---

## 2.11 错误处理策略

### 2.11.1 错误码体系

```typescript
// ============================================================
// 错误码体系 (分层设计)
// ============================================================
//
// 错误码格式：{LAYER}{MODULE}{SEQUENCE}
// 示例：A01001 = APP层/通用模块/第1个错误
//       D02003 = DATA层/查询模块/第3个错误
// ============================================================

// ============================================================
// 错误码分类表
// ============================================================

// A层：应用层错误 (APP)
// A01xxx：通用错误
// A02xxx：认证授权错误
// A03xxx：请求参数错误
// A04xxx：资源错误
// A05xxx：限流错误
const APP_ERRORS = {
  // A01 通用
  A01001: { code: 'A01001', message: '未知错误', httpStatus: 500 },
  A01002: { code: 'A01002', message: '服务暂时不可用', httpStatus: 503 },
  A01003: { code: 'A01003', message: '操作超时', httpStatus: 504 },
  A01004: { code: 'A01004', message: '功能暂未开放', httpStatus: 403 },

  // A02 认证授权
  A02001: { code: 'A02001', message: '未提供认证凭据', httpStatus: 401 },
  A02002: { code: 'A02002', message: '认证凭据无效或已过期', httpStatus: 401 },
  A02003: { code: 'A02003', message: '权限不足', httpStatus: 403 },
  A02004: { code: 'A02004', message: '账户已被锁定', httpStatus: 403 },
  A02005: { code: 'A02005', message: 'Token已被撤销', httpStatus: 401 },
  A02006: { code: 'A02006', message: 'API Key无效或已过期', httpStatus: 401 },
  A02007: { code: 'A02007', message: '账户订阅已过期', httpStatus: 403 },

  // A03 请求参数
  A03001: { code: 'A03001', message: '请求参数验证失败', httpStatus: 400 },
  A03002: { code: 'A03002', message: '缺少必需参数', httpStatus: 400 },
  A03003: { code: 'A03003', message: '参数类型错误', httpStatus: 400 },
  A03004: { code: 'A03004', message: '参数格式无效', httpStatus: 400 },
  A03005: { code: 'A03005', message: '请求体过大', httpStatus: 413 },
  A03006: { code: 'A03006', message: '幂等键重复', httpStatus: 409 },

  // A04 资源
  A04001: { code: 'A04001', message: '资源不存在', httpStatus: 404 },
  A04002: { code: 'A04002', message: '资源已被删除', httpStatus: 410 },
  A04003: { code: 'A04003', message: '资源冲突', httpStatus: 409 },
  A04004: { code: 'A04004', message: '资源已达上限', httpStatus: 429 },

  // A05 限流
  A05001: { code: 'A05001', message: '请求过于频繁', httpStatus: 429 },
  A05002: { code: 'A05002', message: '并发请求数超出限制', httpStatus: 429 },
  A05003: { code: 'A05003', message: 'Token配额已用完', httpStatus: 429 },
} as const;

// B层：业务逻辑错误 (BUSINESS)
// B01xxx：项目错误
// B02xxx：章节错误
// B03xxx：MOU状态机错误
// B04xxx：世界引擎错误
// B05xxx：工作室引擎错误
// B06xxx：提案错误
const BUSINESS_ERRORS = {
  // B01 项目
  B01001: { code: 'B01001', message: '项目不存在或无访问权限', httpStatus: 404 },
  B01002: { code: 'B01002', message: '项目初始化未完成', httpStatus: 400 },
  B01003: { code: 'B01003', message: '项目已达最大数量限制', httpStatus: 429 },
  B01004: { code: 'B01004', message: '项目数据已损坏', httpStatus: 500 },

  // B02 章节
  B02001: { code: 'B02001', message: '章节不存在', httpStatus: 404 },
  B02002: { code: 'B02002', message: '章节内容为空', httpStatus: 400 },
  B02003: { code: 'B02003', message: '章节已固化不可修改', httpStatus: 409 },
  B02004: { code: 'B02004', message: '章节序号冲突', httpStatus: 409 },
  B02005: { code: 'B02005', message: '章节字数超出限制', httpStatus: 400 },

  // B03 MOU状态机
  B03001: { code: 'B03001', message: '当前状态不允许此操作', httpStatus: 409 },
  B03002: { code: 'B03002', message: '状态转移条件未满足', httpStatus: 409 },
  B03003: { code: 'B03003', message: '等待人类输入中，无法执行自动操作', httpStatus: 423 },
  B03004: { code: 'B03004', message: '状态机执行超时', httpStatus: 504 },
  B03005: { code: 'B03005', message: '无效的人类事件', httpStatus: 400 },
  B03006: { code: 'B03006', message: 'MOU协议违反', httpStatus: 409 },

  // B04 世界引擎
  B04001: { code: 'B04001', message: '世界状态查询失败', httpStatus: 500 },
  B04002: { code: 'B04002', message: '世界状态不一致', httpStatus: 500 },
  B04003: { code: 'B04003', message: '实体不存在', httpStatus: 404 },
  B04004: { code: 'B04004', message: '实体关系验证失败', httpStatus: 409 },
  B04005: { code: 'B04005', message: '地理/时间计算错误', httpStatus: 500 },

  // B05 工作室引擎
  B05001: { code: 'B05001', message: '生成任务启动失败', httpStatus: 500 },
  B05002: { code: 'B05002', message: '生成内容被中断', httpStatus: 499 },
  B05003: { code: 'B05003', message: '生成内容质量不达标', httpStatus: 500 },
  B05004: { code: 'B05004', message: '上下文窗口溢出', httpStatus: 500 },
  B05005: { code: 'B05005', message: 'LLM提供商不可用', httpStatus: 503 },

  // B06 提案
  B06001: { code: 'B06001', message: '提案不存在', httpStatus: 404 },
  B06002: { code: 'B06002', message: '提案已过期', httpStatus: 410 },
  B06003: { code: 'B06003', message: '提案已被取代', httpStatus: 409 },
  B06004: { code: 'B06004', message: '提案已被处理', httpStatus: 409 },
  B06005: { code: 'B06005', message: '提案修改无效', httpStatus: 400 },
} as const;

// C层：引擎内部错误 (ENGINE)
// C01xxx：谏官错误
// C02xxx：Flow Guardian错误
// C03xxx：Prompt组装错误
// C04xxx：质检错误
// C05xxx：风险分析错误
const ENGINE_ERRORS = {
  // C01 谏官
  C01001: { code: 'C01001', message: '谏官检查执行失败', httpStatus: 500 },
  C01002: { code: 'C01002', message: '发现严重违规，内容被拦截', httpStatus: 400 },
  C01003: { code: 'C01003', message: '谏官规则集版本不匹配', httpStatus: 500 },
  C01004: { code: 'C01004', message: '谏官检查超时', httpStatus: 504 },

  // C02 Flow Guardian
  C02001: { code: 'C02001', message: '心流计算失败', httpStatus: 500 },
  C02002: { code: 'C02002', message: '干预执行失败', httpStatus: 500 },
  C02003: { code: 'C02003', message: '心流数据不足', httpStatus: 400 },

  // C03 Prompt组装
  C03001: { code: 'C03001', message: '模板不存在', httpStatus: 404 },
  C03002: { code: 'C03002', message: '模板变量缺失', httpStatus: 400 },
  C03003: { code: 'C03003', message: '上下文超出Token预算', httpStatus: 500 },
  C03004: { code: 'C03004', message: '模板渲染错误', httpStatus: 500 },

  // C04 质检
  C04001: { code: 'C04001', message: '质检执行失败', httpStatus: 500 },
  C04002: { code: 'C04002', message: '质量评分低于阈值', httpStatus: 400 },

  // C05 风险分析
  C05001: { code: 'C05001', message: '风险分析执行失败', httpStatus: 500 },
  C05002: { code: 'C05002', message: '风险评分超过安全阈值', httpStatus: 400 },
} as const;

// D层：数据层错误 (DATA)
// D01xxx：数据库错误
// D02xxx：缓存错误
// D03xxx：存储错误
const DATA_ERRORS = {
  // D01 数据库
  D01001: { code: 'D01001', message: '数据库连接失败', httpStatus: 500 },
  D01002: { code: 'D01002', message: '数据库查询超时', httpStatus: 504 },
  D01003: { code: 'D01003', message: '数据库事务失败', httpStatus: 500 },
  D01004: { code: 'D01004', message: '唯一约束冲突', httpStatus: 409 },
  D01005: { code: 'D01005', message: '外键约束冲突', httpStatus: 409 },
  D01006: { code: 'D01006', message: '序列化冲突，请重试', httpStatus: 409 },

  // D02 缓存
  D02001: { code: 'D02001', message: '缓存服务不可用', httpStatus: 500 },
  D02002: { code: 'D02002', message: '缓存键不存在', httpStatus: 404 },

  // D03 存储
  D03001: { code: 'D03001', message: '文件存储服务不可用', httpStatus: 500 },
  D03002: { code: 'D03002', message: '文件不存在', httpStatus: 404 },
  D03003: { code: 'D03003', message: '文件上传失败', httpStatus: 500 },
} as const;

// E层：外部服务错误 (EXTERNAL)
// E01xxx：LLM提供商错误
// E02xxx：第三方API错误
const EXTERNAL_ERRORS = {
  // E01 LLM提供商
  E01001: { code: 'E01001', message: 'LLM API调用失败', httpStatus: 502 },
  E01002: { code: 'E01002', message: 'LLM API限流', httpStatus: 429 },
  E01003: { code: 'E01003', message: 'LLM响应格式无效', httpStatus: 502 },
  E01004: { code: 'E01004', message: 'LLM内容被过滤', httpStatus: 400 },
  E01005: { code: 'E01005', message: 'LLM上下文过长', httpStatus: 400 },
  E01006: { code: 'E01006', message: '所有LLM提供商不可用', httpStatus: 503 },

  // E02 第三方API
  E02001: { code: 'E02001', message: '第三方服务调用失败', httpStatus: 502 },
  E02002: { code: 'E02002', message: '第三方服务超时', httpStatus: 504 },
} as const;

// 合并所有错误
const ALL_ERRORS = {
  ...APP_ERRORS,
  ...BUSINESS_ERRORS,
  ...ENGINE_ERRORS,
  ...DATA_ERRORS,
  ...EXTERNAL_ERRORS,
} as const;

type ErrorCode = keyof typeof ALL_ERRORS;
```

### 2.11.2 错误响应格式

```typescript
// ============================================================
// 统一错误响应
// ============================================================

interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;                    // 机器可读错误码
    message: string;                    // 人类可读错误消息
    details?: Record<string, unknown>;  // 额外错误详情
    stack?: string;                     // 开发环境包含堆栈
  };
  meta: {
    requestId: string;                  // 请求追踪ID
    timestamp: string;                  // ISO 8601
    documentation?: string;             // 错误文档链接
  };
}

// ============================================================
// 错误类定义
// ============================================================

class NarrativeOSError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;
  readonly requestId: string;
  readonly timestamp: string;
  readonly isOperational: boolean;        // 是否为预期内的业务错误

  constructor(params: {
    code: ErrorCode;
    message?: string;
    details?: Record<string, unknown>;
    requestId?: string;
    cause?: Error;
    isOperational?: boolean;
  }) {
    const errorDef = ALL_ERRORS[params.code];
    super(params.message || errorDef?.message || '未知错误');
    this.code = params.code;
    this.httpStatus = errorDef?.httpStatus || 500;
    this.details = params.details;
    this.requestId = params.requestId || generateRequestId();
    this.timestamp = new Date().toISOString();
    this.isOperational = params.isOperational ?? true;
    this.cause = params.cause;
  }

  toJSON(): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        ...(process.env.NODE_ENV === 'development' ? { stack: this.stack } : {}),
      },
      meta: {
        requestId: this.requestId,
        timestamp: this.timestamp,
        documentation: `https://docs.narrative-os.dev/errors/${this.code}`,
      },
    };
  }
}

// 便捷错误工厂
const ErrorFactory = {
  notFound: (resource: string, requestId?: string) =>
    new NarrativeOSError({ code: 'A04001', details: { resource }, requestId }),

  unauthorized: (requestId?: string) =>
    new NarrativeOSError({ code: 'A02001', requestId }),

  forbidden: (requestId?: string) =>
    new NarrativeOSError({ code: 'A02003', requestId }),

  validationFailed: (details: Record<string, string[]>, requestId?: string) =>
    new NarrativeOSError({ code: 'A03001', details, requestId }),

  rateLimited: (retryAfter?: number, requestId?: string) =>
    new NarrativeOSError({ code: 'A05001', details: { retryAfter }, requestId }),

  llmUnavailable: (providers: string[], requestId?: string) =>
    new NarrativeOSError({ code: 'E01006', details: { providers }, requestId, isOperational: true }),

  mouInvalidTransition: (from: string, event: string, requestId?: string) =>
    new NarrativeOSError({ code: 'B03001', details: { fromState: from, event }, requestId }),

  transactionConflict: (requestId?: string) =>
    new NarrativeOSError({ code: 'D01006', requestId, isOperational: true }),
} as const;
```

### 2.11.3 降级策略

```typescript
// ============================================================
// 降级策略定义
// ============================================================

interface DegradationStrategy {
  // 降级触发条件
  trigger: DegradationTrigger;

  // 降级行为
  behavior: DegradationBehavior;

  // 恢复策略
  recovery: RecoveryStrategy;

  // 通知配置
  notification: NotificationConfig;
}

interface DegradationTrigger {
  type: 'error_rate' | 'latency' | 'availability' | 'manual';
  threshold: number;
  windowMs: number;
  consecutiveFailures?: number;
}

interface DegradationBehavior {
  type: 'failover' | 'cache_only' | 'simplified' | 'queue' | 'reject';
  fallback?: FallbackConfig;
  simplification?: SimplificationConfig;
}

interface RecoveryStrategy {
  type: 'automatic' | 'manual';
  checkIntervalMs?: number;
  recoveryThreshold?: number;             // 连续成功次数阈值
  maxWaitMs?: number;                     // 最大等待时间
}

interface NotificationConfig {
  channels: ('log' | 'webhook' | 'email' | 'alert')[];
  severity: 'info' | 'warning' | 'critical';
  cooldownMs: number;
}

// ============================================================
// 预定义降级策略
// ============================================================

const DEGRADATION_STRATEGIES: Record<string, DegradationStrategy> = {
  // LLM提供商降级
  llmProvider: {
    trigger: { type: 'error_rate', threshold: 0.5, windowMs: 60000, consecutiveFailures: 3 },
    behavior: {
      type: 'failover',
      fallback: {
        // 主用 OpenAI → 备用 Anthropic → 备用 本地模型
        chain: ['openai', 'anthropic', 'local'],
        timeoutMs: 30000,
      },
    },
    recovery: { type: 'automatic', checkIntervalMs: 30000, recoveryThreshold: 3, maxWaitMs: 300000 },
    notification: { channels: ['log', 'alert'], severity: 'warning', cooldownMs: 300000 },
  },

  // 世界引擎查询降级
  worldEngineQuery: {
    trigger: { type: 'latency', threshold: 5000, windowMs: 60000 },
    behavior: {
      type: 'cache_only',                    // 仅返回缓存数据
    },
    recovery: { type: 'automatic', checkIntervalMs: 15000, recoveryThreshold: 2, maxWaitMs: 60000 },
    notification: { channels: ['log'], severity: 'info', cooldownMs: 60000 },
  },

  // 谏官检查降级
  censorCheck: {
    trigger: { type: 'latency', threshold: 10000, windowMs: 120000 },
    behavior: {
      type: 'simplified',                    // 简化检查规则
      simplification: {
        skipChecks: ['STYLE_ADHERENCE', 'PACING'],
        reducedRuleset: 'minimal',
      },
    },
    recovery: { type: 'automatic', checkIntervalMs: 30000, recoveryThreshold: 2, maxWaitMs: 120000 },
    notification: { channels: ['log', 'alert'], severity: 'warning', cooldownMs: 60000 },
  },

  // 数据库降级
  databaseQuery: {
    trigger: { type: 'availability', threshold: 0, windowMs: 10000 },
    behavior: {
      type: 'queue',                         // 请求入队，稍后重试
    },
    recovery: { type: 'automatic', checkIntervalMs: 5000, recoveryThreshold: 1, maxWaitMs: 300000 },
    notification: { channels: ['log', 'alert', 'webhook'], severity: 'critical', cooldownMs: 60000 },
  },

  // 生成质量降级
  generationQuality: {
    trigger: { type: 'error_rate', threshold: 0.3, windowMs: 300000 },
    behavior: {
      type: 'simplified',
      simplification: {
        reducedContextWindow: 0.5,           // 减少上下文窗口
        simplifiedPrompt: true,              // 使用简化Prompt
        singlePassGeneration: true,          // 单遍生成（不迭代优化）
      },
    },
    recovery: { type: 'manual' },            // 需人工确认恢复
    notification: { channels: ['log', 'alert'], severity: 'critical', cooldownMs: 60000 },
  },

  // 流式生成降级（连接中断）
  streamGeneration: {
    trigger: { type: 'error_rate', threshold: 0.2, windowMs: 30000 },
    behavior: {
      type: 'reject',
      fallback: {
        message: '当前生成服务繁忙，请稍后重试或使用批量生成模式',
        alternativeMode: 'batch',
      },
    },
    recovery: { type: 'automatic', checkIntervalMs: 10000, recoveryThreshold: 3, maxWaitMs: 60000 },
    notification: { channels: ['log'], severity: 'info', cooldownMs: 60000 },
  },
};

// ============================================================
// 降级管理器接口
// ============================================================

interface DegradationManager {
  // 注册降级策略
  register(name: string, strategy: DegradationStrategy): void;

  // 检查是否需要降级
  check(name: string, metrics: ServiceMetrics): DegradationDecision;

  // 执行降级
  execute(name: string, decision: DegradationDecision): Promise<DegradationResult>;

  // 恢复服务
  recover(name: string): Promise<RecoveryResult>;

  // 获取降级状态
  getStatus(name: string): DegradationStatus;

  // 获取所有降级状态
  getAllStatus(): Record<string, DegradationStatus>;
}

interface DegradationDecision {
  shouldDegrade: boolean;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedBehavior: DegradationBehavior;
}

interface DegradationResult {
  success: boolean;
  behavior: DegradationBehavior;
  message: string;
}

interface RecoveryResult {
  success: boolean;
  recoveredAt: string;
  message: string;
}

interface DegradationStatus {
  name: string;
  isDegraded: boolean;
  currentBehavior: DegradationBehavior;
  triggeredAt?: string;
  recoveryAttempts: number;
  metrics: ServiceMetrics;
}

interface ServiceMetrics {
  errorRate: number;
  avgLatencyMs: number;
  availability: number;
  requestCount: number;
  errorCount: number;
}
```

### 2.11.4 重试策略

```typescript
// ============================================================
// 重试策略
// ============================================================

interface RetryPolicy {
  // 最大重试次数
  maxRetries: number;

  // 重试间隔计算策略
  backoffStrategy: BackoffStrategy;

  // 哪些错误码可以重试
  retryableErrorCodes: ErrorCode[];

  // 哪些错误码不可重试
  nonRetryableErrorCodes: ErrorCode[];

  // 超时后是否继续重试
  continueOnTimeout: boolean;

  // 是否启用抖动（避免惊群效应）
  jitter: boolean;
}

interface BackoffStrategy {
  type: 'fixed' | 'linear' | 'exponential';
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier?: number;                    // 指数退乘数
}

// 默认重试策略
const DEFAULT_RETRY_POLICIES: Record<string, RetryPolicy> = {
  database: {
    maxRetries: 3,
    backoffStrategy: { type: 'exponential', baseDelayMs: 100, maxDelayMs: 5000, multiplier: 2 },
    retryableErrorCodes: ['D01002', 'D01003', 'D01006', 'D02001'],
    nonRetryableErrorCodes: ['D01004', 'D01005', 'D02002'],
    continueOnTimeout: true,
    jitter: true,
  },

  llm: {
    maxRetries: 3,
    backoffStrategy: { type: 'exponential', baseDelayMs: 1000, maxDelayMs: 30000, multiplier: 2 },
    retryableErrorCodes: ['E01001', 'E01002', 'E01005'],
    nonRetryableErrorCodes: ['E01004', 'E01003', 'E01006'],
    continueOnTimeout: true,
    jitter: true,
  },

  worldEngine: {
    maxRetries: 2,
    backoffStrategy: { type: 'fixed', baseDelayMs: 500, maxDelayMs: 2000 },
    retryableErrorCodes: ['B04001', 'B04005'],
    nonRetryableErrorCodes: ['B04002', 'B04003', 'B04004'],
    continueOnTimeout: false,
    jitter: false,
  },
};
```



---

## 2.12 缓存策略

### 2.12.1 缓存架构总览

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           多层缓存架构                                    │
│                                                                          │
│   第一层 (L1)：应用内存缓存                                                │
│   ┌──────────────────────────────────────────────────────────────┐       │
│   │  Node.js 进程内存 (Map / LRU Cache)                           │       │
│   │  • 热点世界状态片段                                             │       │
│   │  • 编译后的 Prompt 模板                                         │       │
│   │  • MOU 状态机上下文                                             │       │
│   │  TTL: 30-60秒 | 容量: 100-500条                                │       │
│   └──────────────────────────────────────────────────────────────┘       │
│                                 │                                        │
│                                 ▼ (未命中)                                │
│   第二层 (L2)：分布式缓存 (Redis)                                         │
│   ┌──────────────────────────────────────────────────────────────┐       │
│   │  Redis 7.2 集群                                               │       │
│   │  • 世界数据查询结果                                           │       │
│   │  • 会话状态                                                   │       │
│   │  • 用户权限缓存                                               │       │
│   │  • 分布式锁 / 限流计数                                        │       │
│   │  TTL: 5-60分钟 | 容量: GB级                                   │       │
│   └──────────────────────────────────────────────────────────────┘       │
│                                 │                                        │
│                                 ▼ (未命中)                                │
│   第三层 (L3)：数据库层                                                   │
│   ┌──────────────────────────────────────────────────────────────┐       │
│   │  PostgreSQL 16 + pgvector                                    │       │
│   │  • 持久化业务数据                                             │       │
│   │  • 查询结果可缓存标记                                          │       │
│   │  • 物化视图（预计算聚合）                                      │       │
│   └──────────────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.12.2 各层缓存配置

#### L1 应用内存缓存

```typescript
// ============================================================
// L1 缓存配置
// ============================================================

interface L1CacheConfig {
  // 世界数据缓存
  worldState: {
    maxSize: number;            // 最大条目数: 200
    ttlMs: number;              // 生存时间: 60000 (1分钟)
    evictionPolicy: 'lru';      // 淘汰策略: LRU
  };

  // Prompt 模板缓存
  promptTemplates: {
    maxSize: number;            // 50
    ttlMs: number;              // 300000 (5分钟)
    evictionPolicy: 'lru';
  };

  // MOU 状态缓存
  mouState: {
    maxSize: number;            // 100 (每个活跃会话一个)
    ttlMs: number;              // 30000 (30秒，MOU状态变化频繁)
    evictionPolicy: 'lru';
  };

  // 编译后的 Zod Schema 缓存
  compiledSchemas: {
    maxSize: number;            // 100
    ttlMs: number;              // 600000 (10分钟)
    evictionPolicy: 'lru';
  };
}

// L1 缓存实现
interface L1Cache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T, ttlMs?: number): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
  size(): number;
  keys(): string[];
}

// L1 缓存键命名规范
// 格式: {domain}:{entityType}:{entityId}:{version?}
// 示例:
//   world:location:loc_123:v3
//   world:character:chr_456:v5
//   template:chapter_generation:v1.2
//   mou_state:proj_789:active
//   session:user_001:ctx
```

#### L2 分布式缓存 (Redis)

```typescript
// ============================================================
// L2 缓存配置
// ============================================================

interface L2CacheConfig {
  // 世界数据查询结果缓存
  worldQueryResults: {
    keyPrefix: 'nos:world:query:';
    ttlSeconds: number;         // 600 (10分钟)
    maxKeyLength: number;       // 256字符
    hashStructure: true;        // 使用Hash结构存储复杂结果
  };

  // 场景感知查询结果缓存
  sceneQueryResults: {
    keyPrefix: 'nos:scene:query:';
    ttlSeconds: number;         // 300 (5分钟)
    // 场景查询高度依赖上下文，TTL较短
  };

  // 用户会话缓存
  userSessions: {
    keyPrefix: 'nos:session:';
    ttlSeconds: number;         // 3600 (1小时)
    slidingWindow: true;        // 滑动窗口，每次访问重置TTL
  };

  // 用户权限缓存
  userPermissions: {
    keyPrefix: 'nos:auth:perm:';
    ttlSeconds: number;         // 1800 (30分钟)
  };

  // 项目元数据缓存
  projectMetadata: {
    keyPrefix: 'nos:project:meta:';
    ttlSeconds: number;         // 1800 (30分钟)
  };

  // 生成结果缓存（避免重复生成相同内容）
  generationResults: {
    keyPrefix: 'nos:gen:result:';
    ttlSeconds: number;         // 86400 (24小时)
    maxSize: number;            // 100MB (使用Redis内存限制)
  };

  // 限流计数器
  rateLimitCounters: {
    keyPrefix: 'nos:ratelimit:';
    ttlSeconds: number;         // 与限流窗口一致
    useRedisCommands: ['INCR', 'EXPIRE'];
  };

  // 分布式锁
  distributedLocks: {
    keyPrefix: 'nos:lock:';
    ttlSeconds: number;         // 30 (锁默认30秒)
    autoRenew: true;            // 自动续期
    renewIntervalMs: number;    // 10000 (每10秒续期)
  };
}

// L2 缓存服务接口
interface L2CacheService {
  // 字符串操作
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  setnx(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
  getdel(key: string): Promise<string | null>;

  // Hash操作
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  hset(key: string, field: string, value: string): Promise<void>;
  hmset(key: string, values: Record<string, string>): Promise<void>;

  // 列表/集合操作
  lpush(key: string, ...values: string[]): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  sadd(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;

  // 原子计数
  incr(key: string): Promise<number>;
  incrby(key: string, increment: number): Promise<number>;
  decr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<boolean>;

  // 分布式锁 (Redlock算法)
  acquireLock(lockKey: string, ttlSeconds: number): Promise<Lock | null>;

  // 批量操作
  mget(keys: string[]): Promise<(string | null)[]>;
  mset(entries: Record<string, string>): Promise<void>;
  del(keys: string[]): Promise<number>;

  // 缓存穿透保护 (布隆过滤器)
  bloomCheck(key: string, element: string): Promise<boolean>;
  bloomAdd(key: string, element: string): Promise<void>;

  // Pub/Sub（用于缓存失效广播）
  subscribe(channel: string, handler: (message: string) => void): Promise<void>;
  publish(channel: string, message: string): Promise<number>;

  // 缓存标记
  getCacheTag(tag: string): Promise<string[]>;     // 获取标签关联的所有键
  setCacheTag(tag: string, keys: string[]): Promise<void>;
  invalidateTag(tag: string): Promise<number>;      // 按标签批量失效
}

interface Lock {
  key: string;
  value: string;              // 锁唯一值（防止误释放）
  release(): Promise<boolean>;
  extend(ttlSeconds: number): Promise<boolean>;
}
```

### 2.12.3 缓存策略矩阵

| 数据类型 | L1 缓存 | L2 缓存 | TTL | 失效策略 |
|----------|---------|---------|-----|----------|
| 世界状态快照 | ✅ | ✅ | L1:60s / L2:10m | 写后失效 + 事件驱动 |
| 人物档案 | ✅ | ✅ | L1:60s / L2:10m | 写后失效 |
| 地点详情 | ✅ | ✅ | L1:60s / L2:10m | 写后失效 |
| 势力状态 | ✅ | ✅ | L1:30s / L2:5m | 写后失效（变化频繁） |
| 时间线 | ✅ | ✅ | L1:120s / L2:30m | 事件驱动 |
| 伏笔列表 | ✅ | ✅ | L1:60s / L2:10m | 写后失效 |
| Prompt 模板 | ✅ | ❌ | L1:5m | 热更新时手动失效 |
| MOU 状态 | ✅ | ✅ | L1:30s / L2:2m | 状态转移后失效 |
| 用户会话 | ❌ | ✅ | L2:1h | 滑动窗口 + 登出时失效 |
| 用户权限 | ✅ | ✅ | L1:10m / L2:30m | 权限变更后失效 |
| 生成结果 | ❌ | ✅ | L2:24h | LRU 淘汰 |
| 项目元数据 | ✅ | ✅ | L1:5m / L2:30m | 写后失效 |
| 场景查询结果 | ❌ | ✅ | L2:5m | 上下文依赖，TTL短 |
| 叙事评估结果 | ❌ | ✅ | L2:15m | 依赖世界状态版本 |
| 质检报告 | ❌ | ✅ | L2:1h | 内容不变则不过期 |
| 版本快照 | ❌ | ❌ | - | 不缓存（直接从存储读取） |

### 2.12.4 缓存失效策略

```typescript
// ============================================================
// 缓存失效策略
// ============================================================

interface CacheInvalidationStrategy {
  // 1. TTL 过期（被动失效）
  // 最基础的失效方式，缓存到期后自动清除

  // 2. 写后失效（Write-Through Invalidate）
  // 数据写入数据库后，立即清除相关缓存
  invalidateOnWrite(params: {
    entityType: string;
    entityId: string;
    affectedKeys: string[];
    affectedTags: string[];
  }): Promise<void>;

  // 3. 事件驱动失效（Event-Driven）
  // 通过事件总线广播缓存失效事件
  invalidateOnEvent(event: CacheInvalidationEvent): Promise<void>;

  // 4. 标签失效（Tag-Based）
  // 通过标签批量失效一组相关缓存
  invalidateByTag(tag: string): Promise<number>;

  // 5. 主动刷新（Proactive Refresh）
  // 在TTL到期前主动刷新缓存（适用于热点数据）
  proactiveRefresh(key: string, refreshFn: () => Promise<unknown>): Promise<void>;

  // 6. 版本号机制（Version-Based）
  // 通过版本号控制缓存有效性
  checkVersion(key: string, version: number): Promise<boolean>;
}

interface CacheInvalidationEvent {
  eventType:
    | 'ENTITY_UPDATED'
    | 'ENTITY_DELETED'
    | 'CHAPTER_SOLIDIFIED'
    | 'MOU_TRANSITION'
    | 'WORLD_STATE_CHANGED'
    | 'PERMISSION_CHANGED'
    | 'BATCH_INVALIDATE';
  projectId: string;
  entityType?: string;
  entityId?: string;
  affectedKeys?: string[];
  affectedTags?: string[];
  timestamp: string;
  source: string;                         // 触发源（服务名）
}

// ============================================================
// 缓存失效事件流
// ============================================================

// 缓存失效通道命名规范
// nos:cache:invalidate:{projectId}
// nos:cache:invalidate:all          // 全局失效（谨慎使用）

// 缓存失效事件处理流程
//
// 世界引擎 ──(实体更新)──> 数据库
//    │                       │
//    │                       │ (触发器 / ORM Hook)
//    │                       ▼
//    │                  发布缓存失效事件
//    │                  Redis Pub/Sub
//    │                       │
//    │         ┌─────────────┼─────────────┐
//    │         ▼             ▼             ▼
//    │    [服务A]       [服务B]       [服务C]
//    │    清除L1缓存    清除L1缓存    清除L1缓存
//    │         │             │             │
//    │         └─────────────┴─────────────┘
//    │                       │
//    ▼                       ▼
// L1 + L2 缓存同时失效     其他服务L1缓存清除
```

### 12.4.5 缓存穿透/击穿/雪崩防护

```typescript
// ============================================================
// 缓存问题防护
// ============================================================

interface CacheProtection {
  // 1. 缓存穿透防护 (Cache Penetration)
  // 问题：查询不存在的数据，每次穿透到数据库
  // 解决：布隆过滤器 + 空值缓存
  preventPenetration<T>(
    key: string,
    fetchFn: () => Promise<T | null>,
    options: {
      bloomFilterKey: string;
      nullValueTtlSeconds: number;    // 空值缓存TTL：60秒
    }
  ): Promise<T | null>;

  // 2. 缓存击穿防护 (Cache Breakdown)
  // 问题：热点数据过期瞬间大量请求打到数据库
  // 解决：互斥锁 + 逻辑过期
  preventBreakdown<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: {
      lockTtlSeconds: number;         // 锁TTL：10秒
      earlyRefreshSeconds: number;    // 提前刷新：30秒
    }
  ): Promise<T>;

  // 3. 缓存雪崩防护 (Cache Avalanche)
  // 问题：大量缓存同时过期
  // 解决：随机TTL + 多级缓存
  preventAvalanche<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: {
      baseTtlSeconds: number;
      jitterRangeSeconds: number;     // 随机范围：±10%
    }
  ): Promise<T>;
}

// 实现：带互斥锁的缓存读取
async function getWithMutexLock<T>(
  cache: L2CacheService,
  key: string,
  fetchFn: () => Promise<T>,
  lockKey: string,
  ttlSeconds: number
): Promise<T> {
  // 1. 先查缓存
  const cached = await cache.get(key);
  if (cached) return JSON.parse(cached);

  // 2. 获取互斥锁
  const lock = await cache.acquireLock(lockKey, 10);
  if (!lock) {
    // 未获取到锁，等待后重试
    await sleep(100);
    return getWithMutexLock(cache, key, fetchFn, lockKey, ttlSeconds);
  }

  try {
    // 3. 双重检查（拿到锁后再次检查）
    const doubleCheck = await cache.get(key);
    if (doubleCheck) return JSON.parse(doubleCheck);

    // 4. 执行数据库查询
    const result = await fetchFn();

    // 5. 写入缓存
    await cache.set(key, JSON.stringify(result), ttlSeconds);

    return result;
  } finally {
    // 6. 释放锁
    await lock.release();
  }
}
```

---

## 2.13 WebSocket 实时通信设计

### 2.13.1 WebSocket 架构

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       WebSocket 实时通信架构                              │
│                                                                          │
│   作者客户端                                                               │
│   ┌──────────────┐                                                       │
│   │  Web Browser │                                                       │
│   │  (React App) │                                                       │
│   └──────┬───────┘                                                       │
│          │ wss://api.nos.dev/ws                                          │
│          │                                                               │
│          ▼                                                               │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │                   Load Balancer (Nginx)                       │      │
│   │               sticky session (ip_hash / user_id)              │      │
│   └──────┬────────────────────┬────────────────────┬─────────────┘      │
│          │                    │                    │                     │
│          ▼                    ▼                    ▼                     │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐              │
│   │  WS Server 1 │   │  WS Server 2 │   │  WS Server 3 │              │
│   │  (Node.js)   │   │  (Node.js)   │   │  (Node.js)   │              │
│   │  Socket.io   │   │  Socket.io   │   │  Socket.io   │              │
│   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘              │
│          │                    │                    │                     │
│          └────────────────────┼────────────────────┘                     │
│                               │                                         │
│                               ▼                                         │
│                   ┌───────────────────────┐                             │
│                   │    Redis Pub/Sub      │                             │
│                   │  (跨服务器消息广播)     │                             │
│                   └───────────────────────┘                             │
│                               │                                         │
│                               ▼                                         │
│                   ┌───────────────────────┐                             │
│                   │  协调层 / Agent层      │                             │
│                   │  (业务逻辑处理)         │                             │
│                   └───────────────────────┘                             │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.13.2 Socket.io 事件设计

```typescript
// ============================================================
// WebSocket 事件协议
// Socket.io Namespace: /v3/projects
// ============================================================

// ============================================================
// 连接认证
// ============================================================

// 连接时携带认证信息
interface ConnectionAuth {
  token: string;                          // JWT Access Token
  projectId: string;                      // 当前项目ID
  clientVersion: string;                  // 客户端版本
  deviceId: string;                       // 设备标识
}

// ============================================================
// 客户端 → 服务器 事件
// ============================================================

interface ClientEvents {
  // 连接后立即发送认证信息
  'auth': (auth: ConnectionAuth) => void;

  // 心跳 (每25秒)
  'ping': (timestamp: number) => void;

  // 订阅项目更新
  'project:subscribe': (projectId: string) => void;

  // 取消订阅
  'project:unsubscribe': (projectId: string) => void;

  // 发送人类事件到MOU状态机
  'mou:event': (payload: {
    eventType: HumanEventType;
    eventPayload: HumanEventPayload;
    idempotencyKey: string;
  }) => void;

  // 流式生成心跳确认
  'stream:heartbeat': (payload: {
    streamTicket: string;
    receivedChunks: number;
  }) => void;

  // 流式生成中断
  'stream:abort': (payload: {
    streamTicket: string;
    reason: string;
  }) => void;

  // 作者编辑内容变更（用于实时协作/草稿保存）
  'editor:change': (payload: {
    chapterId: string;
    content: string;
    cursorPosition: number;
    editTimestamp: string;
  }) => void;

  // 作者编辑光标位置（用于协作编辑指示器）
  'editor:cursor': (payload: {
    chapterId: string;
    position: number;
    selection?: { start: number; end: number };
  }) => void;

  // 请求神谕查询
  'oracle:query': (payload: {
    queryId: string;
    queryType: string;
    query: string;
    context?: Record<string, unknown>;
  }) => void;

  // 请求预览提案
  'proposal:preview': (payload: {
    proposalId: string;
  }) => void;

  // 确认收到通知
  'notification:ack': (payload: {
    notificationId: string;
    ackedAt: string;
  }) => void;
}

// ============================================================
// 服务器 → 客户端 事件
// ============================================================

interface ServerEvents {
  // 连接成功
  'connected': (payload: {
    connectionId: string;
    serverTime: string;
    heartbeatInterval: number;
  }) => void;

  // 心跳响应
  'pong': (timestamp: number) => void;

  // 认证结果
  'auth:result': (payload: {
    success: boolean;
    userId?: string;
    projectId?: string;
    error?: string;
  }) => void;

  // ─── MOU 状态同步 ───────────────────────────────────────

  // MOU 状态变更通知
  'mou:state_changed': (payload: {
    projectId: string;
    previousState: MouState;
    currentState: MouState;
    transition: StateTransition;
    context: Partial<MouContext>;
    waitingFor: HumanInputRequirement | null;
    timestamp: string;
  }) => void;

  // 等待人类输入通知
  'mou:waiting_input': (payload: {
    projectId: string;
    currentState: MouState;
    requirement: HumanInputRequirement;
    timeoutAt?: string;
  }) => void;

  // ─── 流式生成 ───────────────────────────────────────────

  // 流式生成开始
  'stream:started': (payload: {
    streamTicket: string;
    generationType: string;
    estimatedDuration: number;
  }) => void;

  // 流式文本增量
  'stream:delta': (payload: {
    streamTicket: string;
    chunkId: number;
    content: string;
    metadata: {
      wordCount: number;
      confidence: number;
      sourceEngine: string;
    };
  }) => void;

  // 流式检查点
  'stream:checkpoint': (payload: {
    streamTicket: string;
    checkpointId: string;
    summary: string;
    canRollbackTo: boolean;
  }) => void;

  // 流式提案
  'stream:proposal': (payload: {
    streamTicket: string;
    proposal: ProposalEventData;
  }) => void;

  // 流式生成完成
  'stream:completed': (payload: {
    streamTicket: string;
    summary: string;
    statistics: GenerationStatistics;
    nextStates: string[];
  }) => void;

  // 流式生成错误
  'stream:error': (payload: {
    streamTicket: string;
    error: {
      code: string;
      message: string;
      recoverable: boolean;
    };
  }) => void;

  // ─── 提案通知 ───────────────────────────────────────────

  // 新提案就绪
  'proposal:ready': (payload: {
    projectId: string;
    proposal: ProposalSummary;
  }) => void;

  // 提案状态更新
  'proposal:updated': (payload: {
    projectId: string;
    proposalId: string;
    newStatus: string;
    reviewerNotes?: string;
  }) => void;

  // ─── 世界状态变更 ───────────────────────────────────────

  // 世界数据变更
  'world:updated': (payload: {
    projectId: string;
    changeType: string;
    entityType: string;
    entityId: string;
    changeSummary: string;
    affectedDomains: string[];
  }) => void;

  // 固化完成
  'world:solidified': (payload: {
    projectId: string;
    chapterId: string;
    summary: AppliedChangeSummary;
    rippleEffects: RippleEffectPreview[];
    newForeshadowings: ForeshadowingPreview[];
  }) => void;

  // ─── 谏官通知 ───────────────────────────────────────────

  // 谏官检查结果
  'censor:result': (payload: {
    projectId: string;
    checkId: string;
    passed: boolean;
    score: number;
    findings: Finding[];
  }) => void;

  // ─── 心流通知 ───────────────────────────────────────────

  // 心流状态变更
  'flow:state_changed': (payload: {
    projectId: string;
    previousState: string;
    currentState: string;
    flowScore: number;
    indicators: FlowIndicator[];
  }) => void;

  // 干预建议
  'flow:intervention': (payload: {
    projectId: string;
    interventionType: string;
    message: string;
    priority: 'low' | 'medium' | 'high';
    suggestedAction?: string;
  }) => void;

  // ─── 系统通知 ───────────────────────────────────────────

  // 通用通知
  'notification': (payload: {
    notificationId: string;
    type: 'info' | 'warning' | 'success' | 'error';
    title: string;
    message: string;
    data?: Record<string, unknown>;
    createdAt: string;
  }) => void;

  // 系统消息
  'system:message': (payload: {
    level: 'info' | 'warning' | 'critical';
    message: string;
    action?: string;
    dismissible: boolean;
  }) => void;

  // 连接将被关闭通知
  'system:disconnect_soon': (payload: {
    reason: string;
    reconnectIn: number;
    countdownSeconds: number;
  }) => void;

  // ─── 编辑同步 (协作编辑) ─────────────────────────────────

  // 其他用户编辑内容（未来版本）
  'editor:remote_change': (payload: {
    chapterId: string;
    userId: string;
    userName: string;
    operation: 'insert' | 'delete' | 'replace';
    position: number;
    content?: string;
    length?: number;
  }) => void;

  // 其他用户光标位置
  'editor:remote_cursor': (payload: {
    chapterId: string;
    userId: string;
    userName: string;
    color: string;
    position: number;
    selection?: { start: number; end: number };
  }) => void;

  // 草稿自动保存确认
  'editor:autosaved': (payload: {
    chapterId: string;
    versionId: string;
    savedAt: string;
  }) => void;

  // ─── 错误 ───────────────────────────────────────────────

  // 通用错误
  'error': (payload: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }) => void;
}

// ============================================================
// 房间 (Room) 设计
// ============================================================

// 房间命名规范
// project:{projectId}          — 项目级更新广播
// chapter:{chapterId}          — 章节级协作编辑
// user:{userId}                — 用户级通知（私密）
// mou:{projectId}              — MOU状态同步
// stream:{streamTicket}        — 流式生成通道

interface RoomDesign {
  // 项目房间：所有项目成员自动加入
  // 事件：mou:state_changed, world:updated, world:solidified,
  //       proposal:ready, proposal:updated, notification
  'project': (projectId: string) => `project:${projectId}`;

  // 用户房间：每个用户的私密通知
  // 事件：flow:intervention, system:message, flow:state_changed
  'user': (userId: string) => `user:${userId}`;

  // 流式生成房间：动态创建，生成完成后销毁
  // 事件：stream:* 所有流式事件
  'stream': (ticket: string) => `stream:${ticket}`;

  // 编辑房间：用于协作编辑
  // 事件：editor:remote_change, editor:remote_cursor, editor:autosaved
  'chapter': (chapterId: string) => `chapter:${chapterId}`;
}
```

### 2.13.3 连接管理

```typescript
// ============================================================
// WebSocket 连接管理
// ============================================================

interface ConnectionManager {
  // 连接生命周期
  onConnection(socket: Socket): Promise<void>;
  onDisconnection(socket: Socket, reason: string): Promise<void>;
  onReconnect(socket: Socket, previousConnectionId: string): Promise<void>;

  // 连接状态查询
  getConnection(connectionId: string): ConnectionInfo | null;
  getConnectionsByUser(userId: string): ConnectionInfo[];
  getConnectionsByProject(projectId: string): ConnectionInfo[];
  getActiveConnectionCount(): number;

  // 广播消息
  broadcastToProject(projectId: string, event: string, payload: unknown): void;
  broadcastToUser(userId: string, event: string, payload: unknown): void;
  broadcastToStream(streamTicket: string, event: string, payload: unknown): void;

  // 踢出连接
  disconnect(connectionId: string, reason?: string): void;
  disconnectByUser(userId: string, reason?: string): void;
}

interface ConnectionInfo {
  connectionId: string;
  socketId: string;
  userId: string;
  projectId: string;
  clientVersion: string;
  deviceId: string;
  connectedAt: string;
  lastActivityAt: string;
  rooms: string[];
  ipAddress: string;
  userAgent: string;
}

// ============================================================
// 重连策略
// ============================================================

interface ReconnectConfig {
  // 自动重连
  autoReconnect: true;

  // 重连延迟策略
  reconnectionDelay: 1000;        // 初始延迟 1秒
  reconnectionDelayMax: 30000;    // 最大延迟 30秒
  reconnectionAttempts: 10;       // 最大重连次数

  // 随机化延迟 (避免惊群)
  randomizationFactor: 0.5;       // 延迟随机化因子

  // 超时
  timeout: 20000;                 // 连接超时 20秒

  // 重连时恢复会话
  resumeSession: true;
  sessionTimeoutMs: 300000;       // 会话保持5分钟
}

// ============================================================
// 消息可靠性保障
// ============================================================

interface MessageReliability {
  // 重要消息使用 ACK 机制
  // 客户端收到后发送 ack 确认

  // 消息去重（基于消息ID）
  deduplicate(messageId: string): boolean;

  // 消息排序
  // 每条消息携带序列号，客户端按序处理
  sequenceNumber: number;

  // 离线消息队列
  // 用户离线期间的消息入队，重连后推送
  queueOfflineMessage(userId: string, event: string, payload: unknown): Promise<void>;
  drainOfflineMessages(userId: string, socket: Socket): Promise<void>;
}
```

### 2.13.4 流式生成 WebSocket 流程

```
客户端                                  协调层 / Agent层
  │                                          │
  │  [1] 发送 AUTHOR_CONTINUE 事件            │
  │  ──────────────────────────────────────> │
  │  (通过 mou:event)                         │
  │                                          │
  │                                          │  [2] 启动工作室引擎生成
  │                                          │  创建 stream ticket
  │                                          │
  │  [3] 加入流式房间                          │
  │  socket.emit('join', 'stream:{ticket}')  │
  │                                          │
  │  [4] 流式开始通知                          │
  │  <────────────────────────────────────── │
  │  stream:started                           │
  │                                          │
  │  [5] 流式文本增量（SSE 或 WS）             │
  │  <══════════════════════════════════════ │
  │  stream:delta                             │
  │  "风起云涌，天色骤变..."                   │
  │  <══════════════════════════════════════ │
  │  stream:delta                             │
  │  "那人站在山巅，衣袂翻飞..."               │
  │  <══════════════════════════════════════ │
  │  stream:delta                             │
  │  "眼中似有星辰流转..."                     │
  │  ...                                     │
  │                                          │
  │  [6] 客户端心跳确认                        │
  │  ──────────────────────────────────────> │
  │  stream:heartbeat                         │
  │                                          │
  │  [7] 检查点（可回滚位置）                   │
  │  <────────────────────────────────────── │
  │  stream:checkpoint                        │
  │                                          │
  │  [8a] 流式完成                            │
  │  <────────────────────────────────────── │
  │  stream:completed                         │
  │                                          │
  │  [9a] 退出流式房间                         │
  │  socket.emit('leave', 'stream:{ticket}') │
  │                                          │
  │  ─────── 或 ─────────────────────────────│
  │                                          │
  │  [8b] 作者中断                             │
  │  ──────────────────────────────────────> │
  │  stream:abort                             │
  │                                          │
  │  [9b] 流式中断确认                         │
  │  <────────────────────────────────────── │
  │  stream:error (recoverable)               │
  │                                          │
  │  [10b] 作者选择回滚到检查点                 │
  │  ──────────────────────────────────────> │
  │  mou:event (AUTHOR_MODIFY)                │
  │  { rollbackToCheckpoint: "cp_123" }       │
  │                                          │
  │  [11b] 从检查点重新生成                     │
  │  <══════════════════════════════════════> │
  │  重新开始 stream:started → stream:delta   │
```

### 2.13.5 状态同步机制

```typescript
// ============================================================
// 状态同步协议
// ============================================================

// 服务器维护每个客户端的最后已知状态版本
// 当状态变更时，发送增量更新而非完整状态

interface StateSyncProtocol {
  // 状态版本控制
  version: number;                        // 单调递增版本号
  timestamp: string;                      // 变更时间

  // 增量更新
  delta: StateDelta;
}

interface StateDelta {
  path: string;                           // 变更路径 (JSON Pointer)
  operation: 'add' | 'remove' | 'replace' | 'move';
  value?: unknown;                        // 新值
  oldValue?: unknown;                     // 旧值（用于冲突检测）
}

// ============================================================
// 客户端状态同步策略
// ============================================================

interface ClientStateSync {
  // 1. 初始连接：请求完整状态快照
  requestFullSnapshot(): Promise<FullStateSnapshot>;

  // 2. 正常运作：接收增量更新
  applyDelta(delta: StateDelta): void;

  // 3. 版本不匹配（错过更新）：请求重新同步
  requestResync(lastKnownVersion: number): Promise<StateSyncResult>;

  // 4. 乐观更新（UI先行，后确认）
  optimisticUpdate(localDelta: StateDelta): void;
  confirmUpdate(serverVersion: number): void;
  rollbackUpdate(serverDelta: StateDelta): void;
}

// ============================================================
// 状态同步事件
// ============================================================

interface StateSyncEvents {
  // 完整状态快照（初始连接或重新同步）
  'state:snapshot': (payload: {
    version: number;
    state: MouState;
    context: MouContext;
    pendingProposals: Proposal[];
    projectStats: ProjectStatistics;
  }) => void;

  // 增量更新
  'state:delta': (payload: {
    baseVersion: number;
    newVersion: number;
    deltas: StateDelta[];
    timestamp: string;
  }) => void;

  // 版本冲突（客户端版本落后于服务器）
  'state:conflict': (payload: {
    clientVersion: number;
    serverVersion: number;
    hint: 'resync_required';
  }) => void;
}
```

---

## 2.14 部署拓扑与扩展策略

### 2.14.1 部署架构

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          生产环境部署拓扑                                 │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                     Ingress (Nginx / Traefik)                        │ │
│  │              TLS终止 / 限流 / WAF / 负载均衡                          │ │
│  └────────────────────┬────────────────────────┬──────────────────────┘ │
│                       │                        │                        │
│           ┌───────────┴───────────┐   ┌──────┴──────────┐             │
│           │   REST API 路由        │   │  WebSocket 路由  │             │
│           │   /api/v3/*           │   │  /ws/v3/*       │             │
│           └───────────┬───────────┘   └──────┬──────────┘             │
│                       │                        │                        │
│           ┌───────────┴────────────────────────┴───────────┐           │
│           │              Kubernetes Cluster                 │           │
│           │                                                  │           │
│           │  ┌──────────────────────────────────────────┐   │           │
│           │  │         Coordination Tier                 │   │           │
│           │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │           │
│           │  │  │ Fastify  │ │ Fastify  │ │ Fastify  │ │   │           │
│           │  │  │ Pod 1    │ │ Pod 2    │ │ Pod 3    │ │   │           │
│           │  │  │ HPA: 3-10│ │          │ │          │ │   │           │
│           │  │  └──────────┘ └──────────┘ └──────────┘ │   │           │
│           │  └──────────────────────────────────────────┘   │           │
│           │                                                  │           │
│           │  ┌──────────────────────────────────────────┐   │           │
│           │  │         Service Tier (Worker)             │   │           │
│           │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │           │
│           │  │  │ Worker 1 │ │ Worker 2 │ │ Worker 3 │ │   │           │
│           │  │  │ HPA: 3-20│ │          │ │          │ │   │           │
│           │  │  └──────────┘ └──────────┘ └──────────┘ │   │           │
│           │  └──────────────────────────────────────────┘   │           │
│           │                                                  │           │
│           │  ┌──────────────────────────────────────────┐   │           │
│           │  │          Job Processing                   │   │           │
│           │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │           │
│           │  │  │ Queue W  │ │ Queue W  │ │ Queue W  │ │   │           │
│           │  │  │ orker 1  │ │ orker 2  │ │ orker 3  │ │   │           │
│           │  │  │ HPA: 2-10│ │          │ │          │ │   │           │
│           │  │  └──────────┘ └──────────┘ └──────────┘ │   │           │
│           │  └──────────────────────────────────────────┘   │           │
│           └──────────────────────────────────────────────────┘           │
│                              │                                           │
│           ┌──────────────────┼──────────────────┐                       │
│           │                  │                  │                       │
│           ▼                  ▼                  ▼                       │
│     ┌──────────┐      ┌──────────┐      ┌──────────┐                  │
│     │PostgreSQL│      │  Redis   │      │  MinIO   │                  │
│     │  Primary │      │ Cluster  │      │  Cluster │                  │
│     │  + Replicas     │ (3 Master + 3 Slave)      │                  │
│     └──────────┘      └──────────┘      └──────────┘                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.14.2 水平扩展策略

```typescript
// ============================================================
// 自动伸缩配置 (HPA)
// ============================================================

const HPA_CONFIG = {
  // 协调层 (REST API)
  coordination: {
    minReplicas: 3,
    maxReplicas: 10,
    metrics: [
      { type: 'cpu', targetAverageUtilization: 70 },
      { type: 'memory', targetAverageUtilization: 80 },
      { type: 'custom', name: 'http_requests_per_second', target: { averageValue: '1000' } },
    ],
    scaleUp: { stabilizationWindowSeconds: 60, policy: { type: 'Percent', value: 100, periodSeconds: 60 } },
    scaleDown: { stabilizationWindowSeconds: 300, policy: { type: 'Percent', value: 10, periodSeconds: 60 } },
  },

  // 服务层 (Worker)
  service: {
    minReplicas: 3,
    maxReplicas: 20,
    metrics: [
      { type: 'cpu', targetAverageUtilization: 75 },
      { type: 'memory', targetAverageUtilization: 80 },
      { type: 'custom', name: 'active_generation_tasks', target: { averageValue: '5' } },
    ],
    scaleUp: { stabilizationWindowSeconds: 30, policy: { type: 'Pods', value: 2, periodSeconds: 30 } },
    scaleDown: { stabilizationWindowSeconds: 600, policy: { type: 'Pods', value: 1, periodSeconds: 120 } },
  },

  // 队列处理 Worker
  queueWorker: {
    minReplicas: 2,
    maxReplicas: 10,
    metrics: [
      { type: 'custom', name: 'queue_pending_jobs', target: { averageValue: '50' } },
    ],
    scaleUp: { stabilizationWindowSeconds: 30, policy: { type: 'Pods', value: 2, periodSeconds: 30 } },
    scaleDown: { stabilizationWindowSeconds: 300, policy: { type: 'Pods', value: 1, periodSeconds: 60 } },
  },

  // WebSocket 服务器（需要粘性会话）
  websocket: {
    minReplicas: 3,
    maxReplicas: 15,
    metrics: [
      { type: 'cpu', targetAverageUtilization: 70 },
      { type: 'custom', name: 'websocket_connections', target: { averageValue: '5000' } },
    ],
    scaleUp: { stabilizationWindowSeconds: 30, policy: { type: 'Pods', value: 2, periodSeconds: 30 } },
    scaleDown: { stabilizationWindowSeconds: 600, policy: { type: 'Pods', value: 1, periodSeconds: 300 } },
  },
};

// ============================================================
// 数据库扩展策略
// ============================================================

interface DatabaseScalingStrategy {
  // 读扩展：读写分离 + 连接池
  readReplicas: {
    count: number;              // 2-5个只读副本
    routing: 'round_robin' | 'least_connections' | 'latency_based';
    replicationLag: {           // 复制延迟容忍
      maxLagMs: 1000;
      fallbackToPrimary: true;
    };
  };

  // 写扩展：分片（当单库容量不足时）
  sharding: {
    enabled: false;             // 初始不分片
    shardKey: 'projectId';      // 按项目ID分片
    shardCount: 4;              // 初始4个分片
  };

  // 连接池
  connectionPool: {
    min: 5;
    max: 50;
    idleTimeoutMs: 30000;
    acquireTimeoutMs: 10000;
  };
}

// ============================================================
// 缓存扩展策略
// ============================================================

interface CacheScalingStrategy {
  // Redis Cluster 模式
  cluster: {
    masterNodes: 3;
    replicaFactor: 1;           // 每个主节点1个副本
    sharding: 'hash_slot';      // 哈希槽分片 (0-16383)
  };

  // 缓存预热
  warmup: {
    enabled: true;
    onStartup: true;            // 启动时预热
    onDeployment: true;         // 部署后预热
    warmupKeys: string[];       // 需要预热的键模式
  };
}
```

---

## 附录A：接口索引表

### A.1 REST API 端点索引

| 方法 | 端点 | 功能 | 认证 |
|------|------|------|------|
| POST | `/api/v3/auth/login` | 用户登录 | 公开 |
| POST | `/api/v3/auth/refresh` | 刷新Token | 公开 |
| GET | `/api/v3/projects` | 列出项目 | 需要 |
| POST | `/api/v3/projects` | 创建项目 | 需要 |
| GET | `/api/v3/projects/:id` | 获取项目 | 需要 |
| GET | `/api/v3/projects/:id/mou/state` | 获取MOU状态 | 需要 |
| POST | `/api/v3/projects/:id/mou/event` | 发送MOU事件 | 需要 |
| GET | `/api/v3/projects/:id/mou/stream/:ticket` | 流式输出 | 需要 |
| GET | `/api/v3/projects/:id/chapters` | 列出章节 | 需要 |
| GET | `/api/v3/projects/:id/chapters/:cid` | 获取章节 | 需要 |
| PATCH | `/api/v3/projects/:id/chapters/:cid` | 更新章节 | 需要 |
| GET | `/api/v3/projects/:id/world/characters` | 人物列表 | 需要 |
| GET | `/api/v3/projects/:id/world/characters/:cid` | 人物详情 | 需要 |
| GET | `/api/v3/projects/:id/world/query` | 场景感知查询 | 需要 |
| GET | `/api/v3/projects/:id/proposals` | 提案列表 | 需要 |
| GET | `/api/v3/projects/:id/proposals/:pid` | 提案详情 | 需要 |
| POST | `/api/v3/projects/:id/proposals/:pid/approve` | 批准提案 | 需要 |
| POST | `/api/v3/projects/:id/proposals/:pid/reject` | 拒绝提案 | 需要 |
| POST | `/api/v3/oracle` | 神谕查询 | 需要 |

### A.2 WebSocket 事件索引

| 方向 | 事件名 | 功能 |
|------|--------|------|
| C→S | `auth` | 连接认证 |
| C→S | `ping` | 心跳 |
| C→S | `mou:event` | MOU事件 |
| C→S | `stream:heartbeat` | 流式心跳 |
| C→S | `stream:abort` | 流式中断 |
| C→S | `editor:change` | 编辑变更 |
| S→C | `connected` | 连接成功 |
| S→C | `mou:state_changed` | MOU状态变更 |
| S→C | `mou:waiting_input` | 等待输入 |
| S→C | `stream:delta` | 流式文本增量 |
| S→C | `stream:completed` | 流式完成 |
| S→C | `proposal:ready` | 提案就绪 |
| S→C | `world:solidified` | 固化完成 |
| S→C | `censor:result` | 谏官结果 |
| S→C | `flow:intervention` | 心流干预 |
| S→C | `notification` | 系统通知 |

---

## 附录B：错误码对照表

| 错误码 | 层级 | 说明 | HTTP状态 |
|--------|------|------|----------|
| A01001 | APP | 未知错误 | 500 |
| A01002 | APP | 服务不可用 | 503 |
| A01003 | APP | 操作超时 | 504 |
| A02001 | APP | 未提供认证凭据 | 401 |
| A02002 | APP | 认证凭据无效 | 401 |
| A02003 | APP | 权限不足 | 403 |
| A02004 | APP | 账户已锁定 | 403 |
| A03001 | APP | 参数验证失败 | 400 |
| A03006 | APP | 幂等键重复 | 409 |
| A04001 | APP | 资源不存在 | 404 |
| A05001 | APP | 请求过于频繁 | 429 |
| B01001 | BIZ | 项目不存在 | 404 |
| B02001 | BIZ | 章节不存在 | 404 |
| B02003 | BIZ | 章节已固化不可修改 | 409 |
| B03001 | BIZ | 当前状态不允许此操作 | 409 |
| B03003 | BIZ | 等待人类输入中 | 423 |
| B04001 | BIZ | 世界状态查询失败 | 500 |
| B05001 | BIZ | 生成任务启动失败 | 500 |
| B05004 | BIZ | 上下文窗口溢出 | 500 |
| B05005 | BIZ | LLM提供商不可用 | 503 |
| B06001 | BIZ | 提案不存在 | 404 |
| B06002 | BIZ | 提案已过期 | 410 |
| C01002 | ENG | 严重违规内容被拦截 | 400 |
| C03003 | ENG | 上下文超出Token预算 | 500 |
| D01001 | DATA | 数据库连接失败 | 500 |
| D01003 | DATA | 数据库事务失败 | 500 |
| D01006 | DATA | 序列化冲突 | 409 |
| E01001 | EXT | LLM API调用失败 | 502 |
| E01002 | EXT | LLM API限流 | 429 |
| E01006 | EXT | 所有LLM提供商不可用 | 503 |

---

## 附录C：数据库 Schema 概要

### C.1 核心表清单

| 表名 | 用途 | 估计行数 |
|------|------|----------|
| `users` | 用户账户 | 万级 |
| `projects` | 小说项目 | 万级 |
| `chapters` | 章节数据 | 十万级 |
| `chapter_contents` | 章节内容（大文本，分表） | 十万级 |
| `characters` | 人物实体 | 百万级 |
| `locations` | 地点实体 | 十万级 |
| `factions` | 势力实体 | 万级 |
| `events` | 事件实体 | 百万级 |
| `rules` | 规则实体 | 万级 |
| `foreshadowings` | 伏笔追踪 | 十万级 |
| `ripples` | 涟漪效果 | 百万级 |
| `proposals` | 提案记录 | 十万级 |
| `event_logs` | 事件日志 | 千万级 |
| `version_snapshots` | 版本快照 | 百万级 |
| `mou_states` | MOU状态历史 | 百万级 |
| `prompt_templates` | Prompt模板 | 百级 |
| `cache_invalidation_log` | 缓存失效日志 | 千万级 |
| `audit_logs` | 审计日志 | 千万级 |

### C.2 向量索引

| 表名 | 向量字段 | 维度 | 索引类型 |
|------|----------|------|----------|
| `characters` | `embedding` | 1536 | HNSW |
| `locations` | `embedding` | 1536 | HNSW |
| `events` | `embedding` | 1536 | HNSW |
| `chapters` | `embedding` | 1536 | HNSW |

### C.3 全文检索索引

| 表名 | 检索字段 | 语言 |
|------|----------|------|
| `chapters` | `title`, `content_summary` | 中文 |
| `characters` | `name`, `aliases`, `description` | 中文 |
| `locations` | `name`, `description` | 中文 |
| `events` | `title`, `description` | 中文 |
| `proposals` | `title`, `description` | 中文 |

---

> **文档结束**
>
> 本文档为 NarrativeOS v3.0 Sovereign 的系统架构设计规格书第二章（完整版）。
> 所有接口签名、类型定义、配置参数均为可直接指导编码的技术规格。
> 各章节的接口定义使用 TypeScript 类型系统，运行时通过 Zod Schema 进行验证。

