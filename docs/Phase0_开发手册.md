# NarrativeOS Phase 0 开发手册

> **目标：人能发消息，AI 能流式回，日志有记。**
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
| 框架 | Hono | 轻量，SSE 原生支持 |
| ORM | Drizzle ORM | 类型安全， migrations 简单 |
| DB | PostgreSQL 16 + Docker | 本机开发用容器 |
| LLM SDK | @anthropic-ai/sdk | 主模型 Claude 4 Sonnet |
| Token 计算 | tiktoken | 精确计数 |
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
│       │   ├── db/                # Drizzle 连接
│       │   │   └── index.ts
│       │   ├── routes/            # HTTP 路由
│       │   │   ├── projects.ts    # POST /projects
│       │   │   ├── sessions.ts    # POST /sessions/:id/messages (SSE)
│       │   │   └── llm-logs.ts   # GET /llm-logs
│       │   └── services/          # 业务层（薄，直接调 LLM）
│       │       └── chat.ts        # 接收消息 → 调 LLM → SSE 返回
│       └── package.json
│
├── packages/
│   └── llm-client/                # 【核心】LLM 统一封装
│       ├── src/
│       │   ├── index.ts           # 导出 LLMClient
│       │   ├── types.ts           # 类型定义
│       │   ├── anthropic.ts       # Anthropic SDK 封装
│       │   └── logger.ts          # 自动写 llm_logs
│       └── package.json
│
├── packages/
│   └── database/                  # 【核心】Drizzle Schema + 连接
│       ├── src/
│       │   ├── index.ts           # 导出 db 实例
│       │   ├── schema.ts          # 6 张表定义
│       │   └── migrations/        # drizzle-kit 生成
│       └── package.json
│
├── docker-compose.yml             # PostgreSQL 16
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
import { pgTable, uuid, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

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
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
  costUsd: text("cost_usd"), // 用 text 存 decimal，避免浮点
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

**任务：** `packages/database/src/index.ts` 导出 `db` 实例。

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./schema";

const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://nos:nos@localhost:5432/narrative_os",
});

await client.connect();
export const db = drizzle(client, { schema });
```

**验收：** `console.log(db)` 不报错。

---

### Step 4：LLM Client（2 小时）

**任务：** 封装 Anthropic SDK，支持流式调用，**每次调用完自动写 `llm_logs`**。

```typescript
// packages/llm-client/src/types.ts
export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMOptions {
  model?: string;       // 默认 claude-sonnet-4-5
  maxTokens?: number;   // 默认 4096
  temperature?: number;   // 默认 0.7
  caller: string;         // 谁调的："chat-service" / "hatching-agent" / ...
  projectId?: string;
  sessionId?: string;
  callerRefId?: string;   // 关联对象 ID
  callerRefType?: string; // 关联对象类型
}

export interface LLMLogEntry {
  id?: string;
  // ... 同 schema 字段
}
```

```typescript
// packages/llm-client/src/anthropic.ts
import Anthropic from "@anthropic-ai/sdk";
import { encode } from "tiktoken";
import { db } from "@narrative-os/database";
import { llmLogs } from "@narrative-os/database/schema";
import type { Message, LLMOptions } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function* streamChat(
  messages: Message[],
  options: LLMOptions
): AsyncGenerator<{ text: string; done: boolean }> {
  const startTime = Date.now();
  const model = options.model || "claude-sonnet-4-5-20251022";
  
  // 1. 计算 prompt tokens
  const promptTokens = countTokens(messages);
  
  // 2. 转换消息格式
  const anthropicMessages = messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
  const systemPrompt = messages.find(m => m.role === "system")?.content;
  
  try {
    const stream = await client.messages.create({
      model,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      system: systemPrompt,
      messages: anthropicMessages,
      stream: true,
    });
    
    let fullResponse = "";
    let completionTokens = 0;
    
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        const text = chunk.delta.text;
        fullResponse += text;
        completionTokens += estimateTokenCount(text); // 粗略估算，或用 anthropic 的 usage
        yield { text, done: false };
      }
    }
    
    // 3. 流结束 → 写日志
    const latencyMs = Date.now() - startTime;
    const totalTokens = promptTokens + completionTokens;
    const costUsd = calculateCost(model, promptTokens, completionTokens);
    
    await db.insert(llmLogs).values({
      projectId: options.projectId ? sql`CAST(${options.projectId} AS UUID)` : null,
      sessionId: options.sessionId ? sql`CAST(${options.sessionId} AS UUID)` : null,
      caller: options.caller,
      callerRefId: options.callerRefId ? sql`CAST(${options.callerRefId} AS UUID)` : null,
      callerRefType: options.callerRefType,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd: costUsd.toFixed(6),
      latencyMs,
      status: "success",
      promptSnapshot: { messages },
      responseSnapshot: { text: fullResponse.substring(0, 8000) }, // >8KB 后面再说
    });
    
    yield { text: "", done: true };
    
  } catch (error) {
    // 错误也要写日志
    await db.insert(llmLogs).values({
      // ... 同上，status: "error", errorMessage: error.message
    });
    throw error;
  }
}

function countTokens(messages: Message[]): number {
  const enc = encode(JSON.stringify(messages));
  return enc.length;
}

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4); // 粗略估算，生产用 tiktoken
}

function calculateCost(model: string, prompt: number, completion: number): number {
  // Claude Sonnet 4.5: $3 / 1M input, $15 / 1M output (示例，按实际定价)
  if (model.includes("sonnet-4-5")) {
    return (prompt * 3 + completion * 15) / 1_000_000;
  }
  return 0;
}
```

**关键纪律：**
- `streamChat` 是唯一出口
- 无论成功/失败/超时，必须写 `llm_logs`
- `responseSnapshot` > 8KB 时截断存前 8KB（MinIO Phase 1 再做）
- `caller` 字段必填，用于追溯谁调的

**验收：** 调一次 `streamChat`，`llm_logs` 表有 1 条记录，`status=success`。

---

### Step 5：Chat Service（1 小时）

**任务：** 接收用户消息 → 写 `discussions` → 调 LLM → SSE 返回 → 写 `discussions`。

```typescript
// apps/server/src/services/chat.ts
import { db } from "@narrative-os/database";
import { discussions, sessions, projects } from "@narrative-os/database/schema";
import { streamChat } from "@narrative-os/llm-client";
import { eq } from "drizzle-orm";
import type { Message } from "@narrative-os/llm-client";

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
  
  // 3. 组装 messages（Phase 0：只有 system + user input，不读历史）
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, session.projectId),
  });
  
  const messages: Message[] = [
    {
      role: "system",
      content: `你是一个小说创作助手。当前项目：《${project?.title}》，类型：${project?.genre}。请帮助作者完善设定。`,
    },
    { role: "user", content: userContent },
  ];
  
  // 4. 调 LLM（流式）
  let fullResponse = "";
  for await (const chunk of streamChat(messages, {
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
  
  // 5. 写 assistant 消息
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

### Step 6：HTTP 路由（1 小时）

```typescript
// apps/server/src/routes/projects.ts
import { Hono } from "hono";
import { db } from "@narrative-os/database";
import { projects } from "@narrative-os/database/schema";

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json();
  // Zod 校验省略，直接插入
  const result = await db.insert(projects).values({
    title: body.title,
    genre: body.genre,
    style: body.style,
    targetWords: body.target_words,
  }).returning();
  return c.json(result[0]);
});

export default app;
```

```typescript
// apps/server/src/routes/sessions.ts
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { db } from "@narrative-os/database";
import { sessions } from "@narrative-os/database/schema";
import { handleChat } from "../services/chat";

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json();
  const result = await db.insert(sessions).values({
    projectId: body.project_id,
    type: body.type || "hatching",
    title: body.title,
  }).returning();
  return c.json(result[0]);
});

app.post("/:id/messages", async (c) => {
  const sessionId = c.req.param("id");
  const body = await c.req.json();
  
  return stream(c, async (s) => {
    for await (const text of handleChat(sessionId, body.content)) {
      if (text === "[DONE]") break;
      await s.write(`data: ${JSON.stringify({ text })}

`);
    }
    await s.write(`data: [DONE]

`);
  });
});

export default app;
```

```typescript
// apps/server/src/routes/llm-logs.ts
import { Hono } from "hono";
import { db } from "@narrative-os/database";
import { llmLogs } from "@narrative-os/database/schema";
import { eq, desc } from "drizzle-orm";

const app = new Hono();

app.get("/", async (c) => {
  const projectId = c.req.query("project_id");
  const sessionId = c.req.query("session_id");
  
  let query = db.select().from(llmLogs).orderBy(desc(llmLogs.createdAt)).limit(50);
  
  // 简单过滤
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

# 3. 设环境变量
export ANTHROPIC_API_KEY="sk-ant-..."
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
**通过标准：** 返回 JSON，有 `id` 字段，有 `status: "hatching"`。

---

### 验收 2：创建会话
```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"project_id":"上一步的uuid","type":"hatching"}'
```
**通过标准：** 返回 JSON，有 `id` 字段。

---

### 验收 3：发消息，流式响应
```bash
curl -N http://localhost:3000/sessions/SESSION_ID/messages \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"content":"帮我设计一个修仙世界的力量体系"}'
```
**通过标准：** 终端看到 SSE 流，有 `data: {"text":"..."}` 多行，最后有 `data: [DONE]`。

---

### 验收 4：查 LLM 日志
```bash
curl "http://localhost:3000/llm-logs?project_id=PROJECT_ID"
```
**通过标准：** 返回数组，有 1 条记录，`model` 非空，`status` 为 `success`，`cost_usd` 有值，`prompt_snapshot` 非空，`response_snapshot` 非空。

---

## 五、明确不做（Phase 0 碰了就违规）

| 不做项 | 原因 |
|--------|------|
| 不读 discussions 历史 | Phase 1 再做多轮上下文 |
| 不解析结构化提案 | AI 回复纯文本，不解析 JSON |
| 不写 ai_proposals | Phase 1 才结构化提案入库 |
| 不写 setting_items | Phase 1 才设定集入库 |
| 不实现审批接口 | 没有 `/proposals/:id/approve` |
| 不建 Agent 基类 | Phase 1 才抽象 |
| 不建 Orchestrator | 直接 `routes → service → llm-client` |
| 不写前端 | curl 即前端 |
| 不用 Redis | 内存足够 |
| 不做 Token 预算裁剪 | 简单计数即可 |
| 不做降级重试 | Anthropic 挂了直接报错 |
| 不做 MinIO | `responseSnapshot` 截断到 8KB |

---

## 六、如果 2 天没跑通怎么办

**第一天晚上检查点：**
- [ ] Docker 起了？`psql` 能连？
- [ ] 6 张表 push 成功？`<` 看到表？
- [ ] `streamChat` 调一次，`llm_logs` 有记录？

**第二天中午检查点：**
- [ ] 验收 1 和 2 通过（创建项目/会话）？
- [ ] 验收 3 有 SSE 流出来？

**第二天晚上：**
- [ ] 4 条验收 curl 全通？

**如果没通：** 延期一天，但**不准开 Phase 1 的代码**。Phase 0 没通说明地基裂缝，裂缝上砌墙会塌。

---

## 七、代码提交建议

```bash
# Step 1 完：git commit -m "phase0: docker postgres up"
# Step 2 完：git commit -m "phase0: drizzle schema 6 tables"
# Step 3 完：git commit -m "phase0: db connection layer"
# Step 4 完：git commit -m "phase0: llm-client with auto-logging"
# Step 5 完：git commit -m "phase0: chat service (no history)"
# Step 6 完：git commit -m "phase0: http routes + sse streaming"
# 验收完：git commit -m "phase0: ACCEPTED - 4 curls passing"
```

---

## 一句话

> **Step 1 到 Step 6，一步不准跳。4 条 curl 全绿，Phase 0 结束。不做任何 Phase 0 之外的事情。**
