# NarrativeOS Phase 0 开发手册

> **目标：人能发一条消息给 AI，AI 能流式回复，回复过程被完整记录。**
> 
> **工期：2 天。**
> **验收：4 条 curl 全通。**
> **纪律：不做任何超出本页的事情。**

---

## 一、技术栈（锁定，不讨论）

| 层 | 选型 | 理由 |
|----|------|------|
| Runtime | Node.js 20+ | 稳定，TS 生态成熟 |
| 语言 | TypeScript 5.4+ | 类型安全 |
| 包管理 | pnpm workspace | monorepo 管理 |
| 框架 | Hono | 轻量，SSE 原生支持 |
| ORM | Drizzle ORM + drizzle-kit | 类型安全，migrations 简单 |
| DB | PostgreSQL 16 + Docker | 本机开发用容器 |
| LLM SDK | `openai` npm 包 | DeepSeek 是 OpenAI 兼容 API |
| Token 估算 | 字符数 / 3.5（中文）| Phase 0 不要求精确 |
| 验证 | Zod | 运行时校验 |
| 测试 | curl | Phase 0 不写单元测试，curl 即测试 |

---

## 二、目录结构（Phase 0 限定）

```
narrative-os/
├── apps/
│   └── server/                    # Hono 服务
│       ├── src/
│       │   ├── index.ts           # 入口：DB 初始化 + Hono 监听
│       │   ├── db.ts              # Drizzle 连接
│       │   ├── routes/
│       │   │   ├── projects.ts    # POST /projects
│       │   │   ├── sessions.ts    # POST /sessions + SSE /messages
│       │   │   └── llm-logs.ts   # GET /llm-logs
│       │   └── services/
│       │       └── chat.ts        # 消息处理：入库 → 调 LLM → SSE 返回 → 入库
│       └── package.json
│
├── packages/
│   └── llm-client/                # 【核心】供应商兼容 LLM 层
│       ├── src/
│       │   ├── index.ts           # 导出 LLMClient
│       │   ├── types.ts           # 类型定义
│       │   ├── client.ts          # 供应商路由
│       │   ├── providers/
│       │   │   ├── base.ts        # 供应商基类
│       │   │   ├── openai-compatible.ts  # OpenAI 兼容供应商（DeepSeek）
│       │   │   └── anthropic.ts   # Anthropic 原生（Phase 0 空实现）
│       │   ├── tokenizer.ts       # Token 估算
│       │   └── cost.ts            # 成本计算（按供应商定价表）
│       └── package.json
│
├── packages/
│   └── database/                  # 【核心】Drizzle Schema + 连接
│       ├── src/
│       │   ├── index.ts           # 导出 db 实例
│       │   └── schema.ts          # 6 张表定义
│       └── package.json
│
├── docker-compose.yml             # PostgreSQL 16
├── .env.example                   # 环境变量模板
└── package.json                   # workspace root (pnpm)
```

**纪律：Phase 0 不建 `packages/agent-base`，不建 `packages/orchestrator`，不建 `apps/web`。那些是 Phase 1+ 的事情。**

---

## 三、开发顺序（一步一步来，不准跳）

### Step 1：Docker + 数据库（30 分钟）

**任务：** 跑起 PostgreSQL，能连上。

```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: nos
      POSTGRES_PASSWORD: nos
      POSTGRES_DB: narrative_os
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

**命令：**
```bash
docker-compose up -d
# 验证
psql postgresql://nos:nos@localhost:5432/narrative_os -c "SELECT 1"
```

**验收：** `SELECT 1` 返回 `1`。

---

### Step 2：Drizzle Schema（1 小时）

**任务：** 建 6 张表，能 push 到数据库。

```typescript
// packages/database/src/schema.ts
import { pgTable, uuid, text, timestamp, integer, jsonb, sql } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  genre: text("genre").notNull(),
  style: text("style"),
  targetWords: integer("target_words"),
  status: text("status").notNull().default("hatching"),
  genreContract: jsonb("genre_contract"),
  worldBible: jsonb("world_bible"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  type: text("type").notNull(),
  title: text("title"),
  status: text("status").notNull().default("active"),
  contextSnapshot: jsonb("context_snapshot"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const discussions = pgTable("discussions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  sessionId: uuid("session_id").notNull().references(() => sessions.id),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  proposalId: uuid("proposal_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const aiProposals = pgTable("ai_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  sessionId: uuid("session_id").notNull().references(() => sessions.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: jsonb("content").notNull(),
  targetTable: text("target_table"),
  targetAction: text("target_action", { enum: ["insert", "update", "delete"] }),
  targetId: uuid("target_id"),
  payload: jsonb("payload"),
  approvalMode: text("approval_mode", { enum: ["manual", "auto", "threshold"] }).notNull().default("manual"),
  impactScore: integer("impact_score"),
  status: text("status", { enum: ["pending", "approved", "rejected", "superseded"] }).notNull().default("pending"),
  version: integer("version").notNull().default(1),
  parentId: uuid("parent_id"),
  rejectionNote: text("rejection_note"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  sourceAgent: text("source_agent").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const settingItems = pgTable("setting_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  proposalId: uuid("proposal_id").references(() => aiProposals.id),
  type: text("type").notNull(),
  name: text("name").notNull(),
  summary: text("summary").notNull(),
  content: jsonb("content").notNull(),
  status: text("status", { enum: ["draft", "confirmed", "archived"] }).notNull().default("draft"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const llmLogs = pgTable("llm_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id),
  sessionId: uuid("session_id").references(() => sessions.id),
  caller: text("caller").notNull(),
  callerRefId: uuid("caller_ref_id"),
  callerRefType: text("caller_ref_type"),
  model: text("model").notNull(),  // 格式："deepseek/deepseek-chat"
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
  costUsd: text("cost_usd"),
  latencyMs: integer("latency_ms"),
  status: text("status", { enum: ["success", "error", "timeout"] }).notNull(),
  errorMessage: text("error_message"),
  promptSnapshot: jsonb("prompt_snapshot"),
  responseSnapshot: jsonb("response_snapshot"),
  storageRef: text("storage_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**命令：**
```bash
cd packages/database
npx drizzle-kit push
```

**验收：** `psql` 连进去 `<` 能看到 6 张表。

---

### Step 3：数据库连接层（15 分钟）

```typescript
// packages/database/src/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./schema";

const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://nos:nos@localhost:5432/narrative_os",
});

await client.connect();
export const db = drizzle(client, { schema });
export * from "./schema";
```

**验收：** `console.log(db)` 不报错。

---

### Step 4：LLM 供应商兼容层（2 小时）

这是 Phase 0 最重要的地基。设计要点：
- **当前供应商：DeepSeek**（OpenAI 兼容 API）
- **配置方式：环境变量**（不换代码换供应商）
- **未来扩展：加 `providers/xxx.ts`，不调调用方代码**

#### 4.1 环境变量（`.env`）

```bash
# === LLM 供应商配置 ===
LLM_PROVIDER=deepseek
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-xxxxxxxxxxxxxxxx
LLM_MODEL=deepseek-chat

# === 数据库 ===
DATABASE_URL=postgresql://nos:nos@localhost:5432/narrative_os
```

#### 4.2 类型定义

```typescript
// packages/llm-client/src/types.ts

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ProviderConfig {
  name: string;           // "deepseek" / "openai" / "siliconflow" / "anthropic"
  baseURL: string;        // "https://api.deepseek.com/v1"
  apiKey: string;
  model: string;          // "deepseek-chat"
}

export interface LLMOptions {
  provider?: ProviderConfig;  // 不传则读环境变量默认供应商
  maxTokens?: number;
  temperature?: number;
  
  // 审计追踪（必填）
  caller: string;         // 谁调的："chat-service" / "hatching-agent"
  projectId?: string;
  sessionId?: string;
  callerRefId?: string;
  callerRefType?: string;
}

export interface LLMStreamChunk {
  text: string;
  done: boolean;
}
```

#### 4.3 成本计算（按供应商定价表）

```typescript
// packages/llm-client/src/cost.ts

interface Pricing {
  inputPer1M: number;   // 美元
  outputPer1M: number;
}

const PRICING_TABLE: Record<string, Record<string, Pricing>> = {
  deepseek: {
    "deepseek-chat": { inputPer1M: 0.5, outputPer1M: 2.0 },
    "deepseek-reasoner": { inputPer1M: 4.0, outputPer1M: 16.0 },
  },
  openai: {
    "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
    "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  },
};

export function calculateCost(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = PRICING_TABLE[provider]?.[model];
  if (!pricing) return 0;
  return (promptTokens * pricing.inputPer1M + completionTokens * pricing.outputPer1M) / 1_000_000;
}
```

#### 4.4 Token 估算

```typescript
// packages/llm-client/src/tokenizer.ts

export function estimateTokens(text: string): number {
  // Phase 0：中文字符数 / 3.5 保守估算
  // Phase 1+：可接入 tiktoken 精确计算
  return Math.ceil(text.length / 3.5);
}
```

#### 4.5 供应商基类

```typescript
// packages/llm-client/src/providers/base.ts
import type { Message, LLMOptions, LLMStreamChunk } from "../types";

export abstract class BaseProvider {
  abstract readonly name: string;
  abstract streamChat(messages: Message[], options: LLMOptions): AsyncGenerator<LLMStreamChunk>;
}
```

#### 4.6 OpenAI 兼容供应商（DeepSeek 用这套）

```typescript
// packages/llm-client/src/providers/openai-compatible.ts
import OpenAI from "openai";
import { db, llmLogs } from "@narrative-os/database";
import { BaseProvider } from "./base";
import type { Message, LLMOptions, LLMStreamChunk, ProviderConfig } from "../types";
import { estimateTokens } from "../tokenizer";
import { calculateCost } from "../cost";

export class OpenAICompatibleProvider extends BaseProvider {
  readonly name: string;
  private client: OpenAI;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    super();
    this.name = config.name;
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  async *streamChat(
    messages: Message[],
    options: LLMOptions
  ): AsyncGenerator<LLMStreamChunk> {
    const startTime = Date.now();
    const model = this.config.model;

    try {
      const openaiMessages = messages.map(m => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

      const promptTokens = estimateTokens(JSON.stringify(messages));

      const stream = await this.client.chat.completions.create({
        model,
        messages: openaiMessages,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        stream: true,
      });

      let fullResponse = "";
      let completionTokens = 0;

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          fullResponse += text;
          completionTokens += estimateTokens(text);
          yield { text, done: false };
        }
      }

      // 写日志
      const latencyMs = Date.now() - startTime;
      const totalTokens = promptTokens + completionTokens;
      const costUsd = calculateCost(this.config.name, model, promptTokens, completionTokens);

      await db.insert(llmLogs).values({
        projectId: options.projectId ? sql`CAST(${options.projectId} AS UUID)` : null,
        sessionId: options.sessionId ? sql`CAST(${options.sessionId} AS UUID)` : null,
        caller: options.caller,
        callerRefId: options.callerRefId ? sql`CAST(${options.callerRefId} AS UUID)` : null,
        callerRefType: options.callerRefType,
        model: `${this.config.name}/${model}`,
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd: costUsd.toFixed(6),
        latencyMs,
        status: "success",
        promptSnapshot: { messages },
        responseSnapshot: { text: fullResponse.substring(0, 8000) },
      });

      yield { text: "", done: true };

    } catch (error: any) {
      await db.insert(llmLogs).values({
        caller: options.caller,
        model: `${this.config.name}/${this.config.model}`,
        status: "error",
        errorMessage: error.message,
        latencyMs: Date.now() - startTime,
      });
      throw error;
    }
  }
}
```

**注意：** `sql` 需要从 `drizzle-orm` 导入，用于 `CAST(... AS UUID)`。

#### 4.7 供应商路由器

```typescript
// packages/llm-client/src/client.ts
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import { AnthropicProvider } from "./providers/anthropic";
import type { ProviderConfig, Message, LLMOptions, LLMStreamChunk } from "./types";

function loadDefaultProvider(): ProviderConfig {
  const name = process.env.LLM_PROVIDER || "deepseek";
  const baseURL = process.env.LLM_BASE_URL || "https://api.deepseek.com/v1";
  const apiKey = process.env.LLM_API_KEY || "";
  const model = process.env.LLM_MODEL || "deepseek-chat";

  if (!apiKey) throw new Error("LLM_API_KEY not set");

  return { name, baseURL, apiKey, model };
}

function createProvider(config: ProviderConfig) {
  switch (config.name) {
    case "deepseek":
    case "openai":
    case "siliconflow":
      return new OpenAICompatibleProvider(config);
    case "anthropic":
      return new AnthropicProvider(config);
    default:
      return new OpenAICompatibleProvider(config);
  }
}

export class LLMClient {
  private defaultProvider: ProviderConfig;

  constructor() {
    this.defaultProvider = loadDefaultProvider();
  }

  async *stream(
    messages: Message[],
    options: LLMOptions
  ): AsyncGenerator<LLMStreamChunk> {
    const provider = options.provider || this.defaultProvider;
    const instance = createProvider(provider);
    yield* instance.streamChat(messages, options);
  }
}
```

#### 4.8 Anthropic 占位（Phase 0 不实现）

```typescript
// packages/llm-client/src/providers/anthropic.ts
import { BaseProvider } from "./base";

export class AnthropicProvider extends BaseProvider {
  readonly name = "anthropic";

  async *streamChat() {
    throw new Error("Anthropic provider not implemented in Phase 0");
  }
}
```

#### 4.9 统一导出

```typescript
// packages/llm-client/src/index.ts
export { LLMClient } from "./client";
export type { Message, LLMOptions, LLMStreamChunk, ProviderConfig } from "./types";
```

**关键纪律：**
- `LLMClient.stream()` 是唯一出口
- 无论成功/失败/超时，必须写 `llm_logs`
- `responseSnapshot` > 8KB 时截断存前 8KB（MinIO Phase 1 再做）
- `model` 字段格式：`供应商名/模型名`，如 `"deepseek/deepseek-chat"`
- `caller` 字段必填，用于追溯谁调的

**验收：** 调一次 `streamChat`，`llm_logs` 表有 1 条记录，`status=success`，`cost_usd` 有值。

---

### Step 5：Chat Service（1 小时）

**任务：** 接收用户消息 → 写 `discussions` → 调 LLM → SSE 返回 → 写 `discussions`。

```typescript
// apps/server/src/services/chat.ts
import { db, discussions, sessions, projects } from "@narrative-os/database";
import { LLMClient } from "@narrative-os/llm-client";
import { eq } from "drizzle-orm";
import type { Message } from "@narrative-os/llm-client";

const llm = new LLMClient();

export async function* handleChat(sessionId: string, userContent: string) {
  // 1. 查 session
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });
  if (!session) throw new Error("Session not found");

  // 2. 写 user 消息
  await db.insert(discussions).values({
    projectId: session.projectId,
    sessionId,
    role: "user",
    content: userContent,
  });

  // 3. 查项目信息（注入 system prompt）
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, session.projectId),
  });

  // 4. 组装 messages（Phase 0：只有 system + user input，不读历史）
  const messages: Message[] = [
    {
      role: "system",
      content: `你是一个小说创作助手。当前项目：《${project?.title || "未命名"}》，类型：${project?.genre || "未知"}。请帮助作者完善设定。`,
    },
    { role: "user", content: userContent },
  ];

  // 5. 调 LLM（流式）
  let fullResponse = "";
  for await (const chunk of llm.stream(messages, {
    caller: "chat-service",
    projectId: session.projectId,
    sessionId,
    callerRefType: "session",
    callerRefId: sessionId,
  })) {
    if (chunk.done) break;
    fullResponse += chunk.text;
    yield chunk.text;
  }

  // 6. 写 assistant 消息
  await db.insert(discussions).values({
    projectId: session.projectId,
    sessionId,
    role: "assistant",
    content: fullResponse,
  });

  yield "[DONE]";
}
```

**纪律：Phase 0 不读 discussions 历史，每次独立调用。历史注入 Phase 1 再做。**

---

### Step 6：HTTP 路由 + SSE（1 小时）

#### 6.1 项目路由

```typescript
// apps/server/src/routes/projects.ts
import { Hono } from "hono";
import { db, projects } from "@narrative-os/database";

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json();
  const result = await db.insert(projects).values({
    title: body.title,
    genre: body.genre,
    style: body.style,
    targetWords: body.target_words,
  }).returning();
  return c.json(result[0]);
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });
  if (!project) return c.json({ error: "not found" }, 404);
  return c.json(project);
});

export default app;
```

#### 6.2 会话路由（含 SSE 消息接口）

```typescript
// apps/server/src/routes/sessions.ts
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { db, sessions, discussions } from "@narrative-os/database";
import { eq, desc } from "drizzle-orm";
import { handleChat } from "../services/chat";

const app = new Hono();

// POST /sessions - 创建会话
app.post("/", async (c) => {
  const body = await c.req.json();
  const result = await db.insert(sessions).values({
    projectId: body.project_id,
    type: body.type || "hatching",
    title: body.title,
  }).returning();
  return c.json(result[0]);
});

// POST /sessions/:id/messages - 发消息，SSE 流式返回
app.post("/:id/messages", async (c) => {
  const sessionId = c.req.param("id");
  const body = await c.req.json();

  return stream(c, async (s) => {
    s.write(`event: start\n\n`);

    for await (const text of handleChat(sessionId, body.content)) {
      if (text === "[DONE]") {
        s.write(`event: end\ndata: [DONE]\n\n`);
        break;
      }
      s.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
  });
});

// GET /sessions/:id/discussions - 拉取对话历史
app.get("/:id/discussions", async (c) => {
  const sessionId = c.req.param("id");
  const history = await db.select()
    .from(discussions)
    .where(eq(discussions.sessionId, sessionId))
    .orderBy(desc(discussions.createdAt))
    .limit(100);
  return c.json(history);
});

export default app;
```

#### 6.3 LLM 日志路由

```typescript
// apps/server/src/routes/llm-logs.ts
import { Hono } from "hono";
import { db, llmLogs } from "@narrative-os/database";
import { eq, desc } from "drizzle-orm";

const app = new Hono();

app.get("/", async (c) => {
  const projectId = c.req.query("project_id");
  const sessionId = c.req.query("session_id");

  let query = db.select().from(llmLogs).orderBy(desc(llmLogs.createdAt)).limit(50);

  if (projectId) {
    query = db.select().from(llmLogs)
      .where(eq(llmLogs.projectId, projectId))
      .orderBy(desc(llmLogs.createdAt))
      .limit(50);
  }

  return c.json(await query);
});

export default app;
```

#### 6.4 入口文件

```typescript
// apps/server/src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import projects from "./routes/projects";
import sessions from "./routes/sessions";
import llmLogs from "./routes/llm-logs";

const app = new Hono();
app.use(cors());

app.route("/projects", projects);
app.route("/sessions", sessions);
app.route("/llm-logs", llmLogs);

export default {
  port: 3000,
  fetch: app.fetch,
};
```

---

## 四、验收清单（4 条 curl）

### 前提

```bash
# 1. 启动数据库
docker-compose up -d

# 2. push schema
cd packages/database && npx drizzle-kit push

# 3. 设环境变量（或 .env 文件）
export ANTHROPIC_API_KEY=""  # 留空，不用
export LLM_API_KEY="sk-xxxxxxxxxxxxxxxx"
export LLM_PROVIDER="deepseek"
export LLM_BASE_URL="https://api.deepseek.com/v1"
export LLM_MODEL="deepseek-chat"
export DATABASE_URL="postgresql://nos:nos@localhost:5432/narrative_os"

# 4. 启动服务
cd apps/server && pnpm dev
```

### 验收 1：创建项目

```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"凡人修仙传","genre":"修仙"}'
```

**通过标准：** 返回 JSON，有 `id` 字段（UUID），`status` 为 `"hatching"`。

---

### 验收 2：创建会话

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"project_id":"上一步的uuid","type":"hatching"}'
```

**通过标准：** 返回 JSON，有 `id` 字段（UUID），`status` 为 `"active"`。

---

### 验收 3：发消息，流式响应

```bash
curl -N http://localhost:3000/sessions/SESSION_ID/messages \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"content":"帮我设计一个修仙世界的力量体系"}'
```

**通过标准：**
- 终端看到 SSE 流
- 有多行 `data: {"text":"..."}`
- 最后有 `event: end` + `data: [DONE]`
- 同时 `discussions` 表有 2 条记录（user + assistant）

---

### 验收 4：查 LLM 日志

```bash
curl "http://localhost:3000/llm-logs?project_id=PROJECT_ID"
```

**通过标准：**
- 返回数组，有 1 条记录
- `model` 非空（格式 `"deepseek/deepseek-chat"`）
- `status` 为 `"success"`
- `cost_usd` 有值（如 `"0.001234"`）
- `prompt_snapshot` 非空，能看到完整的 messages
- `response_snapshot` 非空，能看到 AI 的完整回复（截断前 8KB）

---

## 五、明确不做（Phase 0 碰了就违规）

| 不做项 | 原因 |
|--------|------|
| 不读 discussions 历史 | Phase 1 再做多轮上下文注入 |
| 不解析结构化提案 | AI 回复纯文本，不解析 JSON，不入 `ai_proposals` |
| 不写 `ai_proposals` | Phase 1 才结构化提案入库 |
| 不写 `setting_items` | Phase 1 才设定集入库 |
| 不实现审批接口 | 没有 `/proposals/:id/approve` |
| 不建 Agent 基类 | Phase 1 才抽象 BaseAgent |
| 不建 Orchestrator | 直接 `routes → service → llm-client` |
| 不写前端 | curl 即前端 |
| 不用 Redis | 内存足够 |
| 不做 Token 预算裁剪 | 简单计数即可 |
| 不做降级重试 | Anthropic/DeepSeek 挂了直接报错 |
| 不做 MinIO | `responseSnapshot` 截断到 8KB |
| 不处理大文件上传 | 没有文件相关功能 |
| 不做身份验证 | Phase 0 无 auth |

---

## 六、如果 2 天没跑通怎么办

**第一天晚上检查点（必须全部通过）：**
- [ ] Docker 起了？`docker ps` 能看到 postgres？
- [ ] `psql` 能连？`SELECT 1` 返回 `1`？
- [ ] 6 张表 push 成功？`<` 能看到所有表？
- [ ] `streamChat` 调一次，`llm_logs` 有记录？

**第二天中午检查点（必须全部通过）：**
- [ ] 验收 1 通过（创建项目）？
- [ ] 验收 2 通过（创建会话）？
- [ ] 验收 3 有 SSE 流出来？

**第二天晚上（必须全部通过）：**
- [ ] 验收 4 通过（`llm_logs` 有完整记录）？

**如果没通：** 延期一天，但**不准开 Phase 1 的代码**。Phase 0 没通说明地基裂缝，裂缝上砌墙会塌。

---

## 七、代码提交建议

```bash
# Step 1 完：docker postgres
git add docker-compose.yml
git commit -m "phase0: docker postgres up"

# Step 2 完：drizzle schema
git add packages/database/src/schema.ts
git commit -m "phase0: drizzle schema 6 tables"

# Step 3 完：db connection
git add packages/database/src/index.ts
git commit -m "phase0: db connection layer"

# Step 4 完：llm client
git add packages/llm-client/
git commit -m "phase0: vendor-compatible llm client with auto-logging"

# Step 5 完：chat service
git add apps/server/src/services/chat.ts
git commit -m "phase0: chat service (no history)"

# Step 6 完：http routes + sse
git add apps/server/src/routes/ apps/server/src/index.ts
git commit -m "phase0: http routes + sse streaming"

# 验收完
git commit -m "phase0: ACCEPTED - 4 curls passing"
```

---

## 八、供应商切换速查（不换代码）

| 目标 | 改环境变量 |
|------|-----------|
| DeepSeek 官方 | `LLM_PROVIDER=deepseek` `LLM_BASE_URL=https://api.deepseek.com/v1` |
| DeepSeek 第三方代理 | `LLM_BASE_URL=https://第三方.com/v1` |
| OpenAI 官方 | `LLM_PROVIDER=openai` `LLM_BASE_URL=https://api.openai.com/v1` |
| 硅基流动 | `LLM_PROVIDER=siliconflow` `LLM_BASE_URL=https://api.siliconflow.cn/v1` |

Phase 0 只需要 DeepSeek 跑通。其他供应商 Phase 1+ 再验证。

---

## 一句话

> **Step 1 到 Step 6，一步不准跳。4 条 curl 全绿，Phase 0 结束。不做任何 Phase 0 之外的事情。**
