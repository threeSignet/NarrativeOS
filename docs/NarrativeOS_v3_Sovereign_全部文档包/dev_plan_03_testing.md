# NarrativeOS v3.0 Sovereign — 单人开发测试验收策略

> **版本**: v1.0
> **适用范围**: 单人业余开发 + Claude Code辅助
> **核心原则**: 最小投入、最大保障、自动化优先、AI辅助生成

---

## 目录

1. [测试金字塔（适配单人项目）](#1-测试金字塔适配单人项目)
2. [测试策略（分Phase）](#2-测试策略分phase)
3. [测试基础设施](#3-测试基础设施)
4. [关键测试用例（详细）](#4-关键测试用例详细)
5. [自动化测试流水线](#5-自动化测试流水线)
6. [质量门禁](#6-质量门禁)
7. [手动测试清单](#7-手动测试清单)
8. [性能测试策略](#8-性能测试策略)
9. [附录：完整配置文件](#9-附录完整配置文件)
10. [附录：测试命令速查表](#10-附录测试命令速查表)

---

## 1. 测试金字塔（适配单人项目）

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

## 2. 测试策略（分Phase）

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

## 3. 测试基础设施

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

## 4. 关键测试用例（详细）

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

## 5. 自动化测试流水线

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

## 6. 质量门禁

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

## 7. 手动测试清单

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

## 8. 性能测试策略

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

## 9. 附录：完整配置文件

### 9.1 测试目录结构

```
 tests/
 ├── setup/
 │   ├── global-setup.ts          # 全局启动（TestContainers）
 │   ├── setup-files.ts           # 每个测试文件前置
 │   ├── db-container.ts          # PostgreSQL TestContainer
 │   └── msw-server.ts            # MSW服务器实例
 │
 ├── mocks/
 │   ├── llm-mock.ts              # LLM API Mock处理器
 │   ├── websocket-mock.ts        # WebSocket Mock服务器
 │   ├── responses/               # 预设响应JSON
 │   │   ├── possibilities/
 │   │   ├── briefs/
 │   │   └── errors/
 │   └── fixtures/                # 测试数据工厂
 │       ├── worlds.factory.ts
 │       ├── characters.factory.ts
 │       └── snapshots.factory.ts
 │
 ├── unit/
 │   ├── state-machine/
 │   │   ├── core-flow.test.ts     # 35个核心状态转换
 │   │   ├── guards.test.ts        # 守卫条件
 │   │   ├── actions.test.ts       # 进入/退出动作
 │   │   └── error-handling.test.ts # 异常处理
 │   ├── engine/
 │   │   ├── power-calculator.test.ts
 │   │   ├── causal-engine.test.ts
 │   │   ├── cost-calculator.test.ts
 │   │   └── ability-validator.test.ts
 │   ├── tools/
 │   │   ├── llm-client.test.ts
 │   │   ├── logger.test.ts
 │   │   └── error-handler.test.ts
 │   └── utils/
 │       ├── token-counter.test.ts
 │       └── json-validator.test.ts
 │
 ├── integration/
 │   ├── database/
 │   │   ├── core-operations.test.ts   # 20个CRUD/约束/事务
 │   │   ├── pgvector.test.ts
 │   │   └── migration.test.ts
 │   ├── llm/
 │   │   └── client.test.ts            # 10个LLM集成测试
 │   ├── orchestrator/
 │   │   └── approval-flow.test.ts     # 8个审批流程
 │   └── studio/
 │       ├── prompt-builder.test.ts
 │       └── context-retriever.test.ts
 │
 ├── e2e/
 │   ├── full-journey.spec.ts      # 完整用户旅程
 │   ├── error-recovery.spec.ts    # 错误恢复
 │   └── websocket.spec.ts         # 实时更新
 │
 ├── performance/
 │   ├── llm-latency.bench.ts
 │   ├── db-query.bench.ts
 │   └── memory-leak.test.ts
 │
 └── smoke/
     └── health-check.test.ts      # 健康检查
```

### 9.2 package.json 完整测试配置

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext .ts,.tsx --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "precommit": "bash scripts/pre-commit-check.sh",
    
    "test": "vitest",
    "test:run": "vitest run",
    "test:unit": "vitest run tests/unit",
    "test:unit:watch": "vitest tests/unit",
    "test:db": "vitest run tests/integration/database",
    "test:db:watch": "vitest tests/integration/database",
    "test:integration": "vitest run tests/integration",
    "test:integration:watch": "vitest tests/integration",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:smoke": "vitest run tests/smoke",
    "test:state-machine": "vitest run tests/unit/state-machine",
    "test:state-machine:coverage": "vitest run tests/unit/state-machine --coverage",
    "test:coverage": "vitest run --coverage",
    "test:coverage:html": "vitest run --coverage && open coverage/index.html",
    "test:perf": "vitest run tests/performance",
    "test:ci": "pnpm typecheck && pnpm lint && vitest run --coverage && playwright test",
    "test:watch": "vitest --watch",
    
    "db:test:up": "docker compose -f docker-compose.test.yml up -d",
    "db:test:down": "docker compose -f docker-compose.test.yml down",
    "db:migrate": "prisma migrate dev",
    "db:rollback": "prisma migrate resolve --rolled-back",
    "db:seed": "tsx scripts/seed.ts",
    "db:reset": "prisma migrate reset --force"
  },
  "devDependencies": {
    "@playwright/test": "^1.42.0",
    "@testcontainers/postgresql": "^10.7.0",
    "@types/node": "^20.11.0",
    "@types/ws": "^8.5.10",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@vitest/coverage-v8": "^1.3.0",
    "@xstate/test": "^1.0.0",
    "eslint": "^8.57.0",
    "msw": "^2.2.0",
    "playwright": "^1.42.0",
    "testcontainers": "^10.7.0",
    "typescript": "^5.3.0",
    "vitest": "^1.3.0",
    "ws": "^8.16.0"
  }
}
```

### 9.3 ESLint配置（测试专用规则）

```javascript
// eslint.config.js
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // 通用规则
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      
      // 测试文件特殊规则
      ...(process.env.NODE_ENV === 'test' ? {
        '@typescript-eslint/no-explicit-any': 'off',  // 测试中允许any
      } : {}),
    },
  },
  // 测试文件配置
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': 'off',  // 测试中允许console
    },
  },
];
```

---

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
║                                                                  ║
║  数据库                                                          ║
║  ───────                                                         ║
║  pnpm db:test:up          启动测试数据库                          ║
║  pnpm db:test:down        停止测试数据库                          ║
║  pnpm db:migrate          运行迁移                                ║
║  pnpm db:reset            重置数据库                              ║
║                                                                  ║
║  E2E调试                                                         ║
║  ────────                                                        ║
║  pnpm test:e2e:ui         UI模式调试                              ║
║  pnpm test:e2e:debug      调试模式                                ║
║                                                                  ║
║  CI完整                                                          ║
║  ───────                                                         ║
║  pnpm test:ci             完整CI流水线                            ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 总结：测试投入产出比

| 测试类型 | 投入时间 | 发现缺陷率 | 维护成本 | 推荐度 |
|----------|----------|------------|----------|--------|
| 类型/契约测试 | 低 | 高（30%） | 极低 | ★★★★★ |
| 状态机单元测试 | 高 | 极高（40%） | 中 | ★★★★★ |
| 数据库集成测试 | 中 | 高（20%） | 低 | ★★★★☆ |
| LLM Mock测试 | 中 | 中（5%） | 中 | ★★★★☆ |
| E2E测试 | 高 | 中（4%） | 高 | ★★★☆☆ |
| 手动测试 | 高 | 低（1%） | — | ★★☆☆☆ |

> **核心建议**：将80%的测试精力放在状态机（35个测试用例）和数据层（20个测试用例）上，这两个部分覆盖了系统60%以上的业务逻辑风险。使用Claude Code辅助生成样板测试，人工审核和补充边界场景。
