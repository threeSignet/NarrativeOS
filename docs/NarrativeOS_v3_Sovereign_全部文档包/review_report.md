# NarrativeOS v3.0 Sovereign 技术审校报告

> **审校范围**: 9个章节文件的交叉一致性、接口兼容性、术语统一性
> **审校日期**: 2025年
> **文档版本**: v3.0.0-Sovereign

---

## 一、执行摘要

本次技术审校对 NarrativeOS v3.0 Sovereign 的9个核心设计章节进行了系统性交叉验证，共发现 **4项CRITICAL问题**、**10项WARNING问题**、**7项INFO建议**。最严重的问题集中在**接口定义不兼容**、**术语命名不一致**、**架构原则未被引擎文档遵循**三个方面。

**总体评估**: 系统设计思想清晰，架构分层合理，但在跨文档一致性方面存在显著缺陷。建议在编码启动前优先修复CRITICAL和WARNING级别问题，否则将导致实现阶段产生大量返工。

---

## 二、问题清单

### CRITICAL（必须修复）

#### C01: Possibility 接口在三章中定义完全不兼容 [接口一致性]

| 项目 | 详情 |
|------|------|
| **位置** | chapter02_architecture.md §2.6 (L2047)、chapter05_world_engine.md §5.10.4 (L4693)、chapter08_mou_interaction.md §3.1 (L163) |
| **问题描述** | 三个章节定义了三种完全不同的 `Possibility` 接口，字段完全不兼容。架构层定义的 `NarrativePossibility` 含 `possibilityId, description, worldStateDiff, estimatedImpact, sourceEngine`；世界引擎的 `Possibility` 含 `possibilityId, rank, causalPath, physicalFeasibility, powerAssessment, costBreakdown, narrativeEnhancement, compositeScore, recommendation`；MOU层的 `Possibility` 含 `id, title, summary, preview, confidence, tags, divergence, emotionalTone`。 |
| **影响** | 协调层、世界引擎壳、MOU状态机之间的数据流转将无法编译通过。三个"Possibility"虽同名但本质上是不同数据结构。 |
| **修复建议** | 统一为单一接口，建议采用世界引擎版本为"权威定义"（字段最全），架构层和MOU层都引用该定义。MOU层缺少的字段可通过UI适配层转换。架构层的 `NarrativePossibility` 应废弃或明确标注为内部中间表示。 |

#### C02: IStudioEngine 接口在工作室引擎文档中完全缺失 [接口一致性]

| 项目 | 详情 |
|------|------|
| **位置** | chapter02_architecture.md §2.4 (L819-857)、chapter06_drama_engine.md 全文 |
| **问题描述** | 架构层明确定义了 `StudioEngineTask`、`StudioEngineResult`、`Proposal` 等接口（L819-857），但 chapter06 工作室引擎全文（4,578行）**没有任何** TypeScript interface 定义来对应这些接口。chapter06 全部使用 class 定义（GenreDetector、StyleConsistencyEvaluator、FiveLayerPromptAssembler 等），没有暴露引擎级统一入口。 |
| **影响** | 架构层的 `invokeStudioEngine()` 接口无法映射到 chapter06 中的任何实现。工作室引擎没有统一对外接口，各子模块（Brief生成器、正文生成器等）如何被调用无定义。 |
| **修复建议** | 在 chapter06 开头补充 `IStudioEngine` 主接口定义，包含 `generateBrief()`、`generateChapter()`、`modifyContent()` 等方法，与架构层 `StudioEngineTask.taskType` 枚举一一对应。 |

#### C03: 谏官英文名不统一：Censor vs Counselor [术语一致性]

| 项目 | 详情 |
|------|------|
| **位置** | chapter02_architecture.md §2.1 (L62-63, L767-773, L861-882, L2005-2006)、chapter09_quality_system.md 全文 |
| **问题描述** | 架构层统一使用 **Censor/CensorShell/invokeCensor/censor_checks**（共9处），而 chapter09 全文使用 **Counselor**（共0处Censor引用）。两者指代同一系统但英文名完全不同。 |
| **影响** | 架构层 Agent 壳命名为 `CensorShell`，而实现文档标题和全文使用 "Counselor"，导致编码时无法确定类名、接口名、服务ID。错误码前缀也受影响（架构层为C01xxx，但文档未明确对应关系）。 |
| **修复建议** | 统一选择一个英文名并在所有章节中替换。建议采用 `Remonstrator`（与架构层 CensorShell 对应的中文名"谏官壳"直译，且 chapter08 术语表中已使用 `Remonstrator`）。chapter09 中所有 "Counselor" 替换为统一英文名。 |

#### C04: chapter07 Storyline 相关数据表在数据库中完全缺失 [数据一致性]

| 项目 | 详情 |
|------|------|
| **位置** | chapter07_narrative_elements.md §7.1 (L24-108)、chapter04_database.md 全文 |
| **问题描述** | chapter07 定义了完整的 Storyline、StorylineExposure、StorylineCrossing 等 TypeScript 接口（共5个interface），但 chapter04 数据库 Schema（5,999行）中**没有任何** storyline 相关表。数据库搜索 `storyline` 返回0结果，CREATE TABLE 中也无 storyline 表。 |
| **影响** | 故事线追踪系统的数据无持久化方案，与"服务无状态"原则矛盾。storyline 数据如果只在内存中维护，将导致会话重启后所有故事线追踪数据丢失。 |
| **修复建议** | 在 chapter04 中补充 `storylines`、`storyline_exposures`、`storyline_crossings` 三张核心表，字段与 chapter07 的 TypeScript 接口对齐。 |

---

### WARNING（建议修复）

#### W01: HumanEvent 类型定义与 MOU 事件类型命名不一致 [接口一致性]

| 项目 | 详情 |
|------|------|
| **位置** | chapter02_architecture.md §2.2.5 (L165-174)、chapter08_mou_interaction.md §3.2 (L275-309) |
| **问题描述** | 架构层定义的事件类型使用 `AUTHOR_` 前缀（`AUTHOR_APPROVE`、`AUTHOR_REJECT`、`AUTHOR_MODIFY` 等），而 chapter08 的 XState 状态机实际使用的事件类型无前缀（`APPROVE`、`REJECT`、`MODIFY`、`CHOOSE`、`RETRY` 等）。 |
| **影响** | 架构层定义的 `HumanEvent` union type 无法直接用于 XState 状态机的事件定义。两处事件类型的语义映射关系未明确。 |
| **修复建议** | 选择一种命名规范并在两处统一。建议架构层的事件类型去除 `AUTHOR_` 前缀，与 XState 实际使用保持一致，或明确说明前缀是架构层抽象、状态机层省略。 |

#### W02: Oracle/神谕 术语在引擎文档中完全缺失 [术语一致性]

| 项目 | 详情 |
|------|------|
| **位置** | chapter02_architecture.md §2.7.3 (L2496)、chapter08_mou_interaction.md §4 (L91-94)、chapter05_world_engine.md、chapter06_drama_engine.md、chapter09_quality_system.md |
| **问题描述** | Oracle/神谕 系统在 chapter02（架构）和 chapter08（MOU）中有详细定义，包含完整的子流程状态机、代价计算、混沌种子等概念。但在 chapter05（世界引擎）、chapter06（工作室引擎）、chapter09（谏官）中**完全未提及**。 |
| **影响** | Oracle 机制是系统核心创新点之一，但其与三大引擎的交互关系 undefined。世界引擎是否需要支持 Oracle 查询？谏官系统是否需要审查混沌种子的合法性？这些问题无文档依据。 |
| **修复建议** | 在 chapter05 中补充 Oracle 查询接口（`queryOracle()`）；在 chapter09 谏官检查项中增加 "混沌种子合规性审查" 条目；在 chapter06 中说明工作室引擎对混沌种子的处理方式。 |

#### W03: 固化（Solidification）机制在引擎文档中完全缺失 [术语一致性]

| 项目 | 详情 |
|------|------|
| **位置** | chapter02_architecture.md §2.2.4 (L150-160)、chapter04_database.md (L4828-4862)、chapter05_world_engine.md、chapter06_drama_engine.md |
| **问题描述** | "原子固化" 是架构核心概念（定义在 §2.2.4），数据库层也有对应的固化事务定义。但 chapter05（世界引擎，0处"固化"）和 chapter06（工作室引擎，0处"固化"）中**完全未提及**此概念。架构层定义了 `APPLY_SOLIDIFICATION` 任务类型，但世界引擎的 `IWorldEngine` 接口中没有 `applySolidification()` 方法。 |
| **影响** | "原子固化" 作为核心数据流终点，在引擎实现层无对应实现。开发者无法从文档中得知固化操作由世界引擎的哪个子模块负责执行。 |
| **修复建议** | 在 chapter05 的 `IWorldEngine` 接口中增加 `applySolidification()` 方法；在 chapter06 中说明工作室引擎提交的是"待固化提案"而非直接写入。 |

#### W04: 世界引擎 LLM 调用点与 chapter12 调用清单不完全对应 [接口一致性]

| 项目 | 详情 |
|------|------|
| **位置** | chapter05_world_engine.md §5.9 (L3496-3502)、chapter12_llm_integration.md §12.1 (L28-50) |
| **问题描述** | chapter05 的 LLM 调用清单与 chapter12 的调用节点清单存在差异：chapter05 定义了7个增强点（5.9.1-5.9.7），chapter12 列出的世界引擎调用点为6个（缺少5.9.7叙事价值评估，后者被归类到工作室引擎）。此外，chapter05 的调用频次（每章5次可能性增强）与 chapter12 的频次（每章5次可能性可读描述 + 每章5次可能性叙事增强）不完全一致——两个5次可能是同一调用的不同表述。 |
| **影响** | 无法确定每章实际 LLM 调用次数。两个 "每章5次" 的条目若重复计数，则每章调用将达到30-40次，超出 "20-30次" 的预算约束。 |
| **修复建议** | 合并 chapter12 中世界引擎的 "可能性清单可读描述" 和 "可能性叙事增强" 为单一调用点（对应5.9.4），统一频次。明确5.9.7 "叙事价值评估" 的归属引擎。 |

#### W05: chapter06 新增 LLM 调用点在 chapter12 中缺失 [接口一致性]

| 项目 | 详情 |
|------|------|
| **位置** | chapter06_drama_engine.md §6.0.2 (L32-40, L4546-4547)、chapter12_llm_integration.md §12.1 |
| **问题描述** | chapter06 的架构图和调用清单中出现了两个 chapter12 调用节点清单中**不存在**的调用点："对话生成"（重型/0.7/按需）和"冲突编排"（重型/0.7/按需）。同时 chapter06 中 "代价共情化" 标注为低频，chapter12 标注为低频但 model_tier 和 temperature 一致。 |
| **影响** | 两个未在调用清单中注册的调用点将无法通过模型路由层调度，也无法计入成本估算。 |
| **修复建议** | 在 chapter12 §12.1 的调用节点清单中补充"对话生成"和"冲突编排"两个条目，或在 chapter06 中注明这两个调用通过现有哪个调用点路由。 |

#### W06: pgvector embedding 维度未在 LLM 集成文档中确认 [技术约束]

| 项目 | 详情 |
|------|------|
| **位置** | chapter04_database.md §4.1 (L18, L31, L1115-1116)、chapter12_llm_integration.md 全文 |
| **问题描述** | chapter04 明确标注 embedding 维度为 **1536**（OpenAI text-embedding-3-small），并在多处重复确认。但 chapter12（LLM集成）全文**未提及** embedding 维度和 pgvector 配置。 |
| **影响** | 若未来切换 embedding 模型（如使用不同维度的模型），LLM集成文档无约束依据。新加入的开发者可能不了解embedding维度限制。 |
| **修复建议** | 在 chapter12 中补充embedding模型配置说明，明确维度约束为1536，并注明模型变更需要同步更新数据库Schema。 |

#### W07: 临时数据不持久化规则仅在数据库文档中提及 [数据一致性]

| 项目 | 详情 |
|------|------|
| **位置** | chapter04_database.md §4.x (L4962)、chapter02_architecture.md、chapter05/06_world_studio |
| **问题描述** | "临时数据不持久化（可能性清单、AI草稿缓存）" 仅在 chapter04 中出现一次，架构文档和引擎文档均未引用此规则。 |
| **影响** | 不持久化规则未在架构层确认为设计原则，引擎实现可能错误地将临时数据写入数据库。 |
| **修复建议** | 在 chapter02 §2.2 关键原则中增加"临时数据不持久化"条目，明确列出哪些数据类型属于临时数据。 |

#### W08: chapter02 成本约束未在架构文档中定义 [技术约束]

| 项目 | 详情 |
|------|------|
| **位置** | chapter12_llm_integration.md §12.2 (L56)、chapter02_architecture.md 全文 |
| **问题描述** | "每章成本约 ¥0.08-0.10，千章约 ¥80-100" 仅在 chapter12 中出现，架构文档中**无任何成本约束定义**。 |
| **影响** | 成本约束作为核心设计约束，未在架构层确认。若 chapter12 被遗忘，架构评审无法发现成本超标风险。 |
| **修复建议** | 在 chapter02 §2.2 关键原则或 §2.14 部署策略中增加成本约束条目，引用 chapter12 的详细模型。 |

#### W09: chapter05 WorldEngineTask 枚举与 IWorldEngine 接口方法不完全对应 [接口一致性]

| 项目 | 详情 |
|------|------|
| **位置** | chapter02_architecture.md §2.4 (L787-802)、chapter05_world_engine.md §5.10 (L4634-4671) |
| **问题描述** | 架构层定义的 `WorldEngineTask.taskType` 枚举包含9个条目（QUERY_SCENE_CONTEXT、QUERY_CHARACTER_DEPTH 等），但 world engine 的 `IWorldEngine` 接口中没有与之一一对应的方法。例如 `QUERY_CHARACTER_DEPTH` 无 `queryCharacterDepth()` 方法，`EVALUATE_NARRATIVE_VALUE` 无 `evaluateNarrativeValue()` 方法，`APPLY_SOLIDIFICATION` 无对应方法。 |
| **影响** | Agent 壳调用引擎时无法通过类型安全的方式映射任务到方法。 |
| **修复建议** | 在 `IWorldEngine` 接口中为每个 `WorldEngineTask.taskType` 增加对应方法，或增加一个统一的 `executeTask(task: WorldEngineTask)` 方法作为入口。 |

#### W10: 模型版本号可能是虚构的未来版本 [技术约束]

| 项目 | 详情 |
|------|------|
| **位置** | chapter12_llm_integration.md §12.4.1 (L83-97) |
| **问题描述** | 文档引用的模型版本包括 "DeepSeek V4-Pro"、"GPT-5.5"、"Claude Opus 4.7"、"Sonnet 4.6"、"Haiku 4.5"、"Qwen3-235B" 等。截至2025年，这些模型版本号均为虚构（实际 DeepSeek 最新为 V3，GPT 最新为 GPT-4o，Claude 最新为 Sonnet 3.5）。 |
| **影响** | 文档标注 "v3.0" 版本，但引用的模型不存在。工程实施时需要根据实际可用模型调整。 |
| **修复建议** | 在文档中增加版本号标注说明（如"基于预计2026年可用模型"），或创建一个"模型版本映射表"将虚构版本映射到实际版本。 |

---

### INFO（可改进项）

#### I01: chapter05 `IWorldEngine` 接口缺少返回类型标注

| 项目 | 详情 |
|------|------|
| **位置** | chapter05_world_engine.md §5.10 (L4634-4671) |
| **问题** | `getWorldState()` 返回 `WorldState`（正确），但 `processAction()` 返回 `ActionResult`（类型未定义）、`updateWorldState()` 返回 `void`（是否应有确认？）、`advanceTime()` 返回 `void`。部分方法缺少返回类型，部分返回 void 的方法在异步场景下可能需要 Promise。 |
| **建议** | 为所有接口方法补充完整返回类型，异步方法统一返回 Promise。 |

#### I02: 质量评分接口定义位置分散

| 项目 | 详情 |
|------|------|
| **位置** | chapter06_drama_engine.md §6.0.2 (L32-40)、chapter09_quality_system.md §9.1 |
| **问题** | "质量评分" 的接口定义分散在 chapter06（3次并行调用，轻型）和 chapter09（8+ 个检查维度）。两者对同一概念的定义不统一：chapter06 关注"评分任务"（LLM调用），chapter09 关注"评分维度"（检查项）。 |
| **建议** | 在 chapter09 中增加 "质量评分 LLM 调用接口" 小节，与 chapter06 对接。 |

#### I03: 成本估算中的货币符号不统一

| 项目 | 详情 |
|------|------|
| **位置** | chapter12_llm_integration.md §12.2 (L56) |
| **问题** | 同时出现 "V0.08-0.10"（V字）和 "¥80-100"（日元/人民币符号），可能为 typo。 |
| **建议** | 统一使用 ¥ 符号。 |

#### I04: 数据库 transaction 隔离级别使用不一致

| 项目 | 详情 |
|------|------|
| **位置** | chapter02_architecture.md §2.2.4 (L159)、chapter04_database.md §4.x (L4828-4862) |
| **问题** | 架构层要求固化事务使用 `SERIALIZABLE` 隔离级别，但 chapter04 的固化事务示例中未显式设置隔离级别（使用默认）。 |
| **建议** | 在 chapter04 的固化事务代码中显式添加 `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`。 |

#### I05: chapter05 LLM 调用频次总和可能超出预算

| 项目 | 详情 |
|------|------|
| **位置** | chapter05_world_engine.md §5.9 (L3496-3502)、chapter12_llm_integration.md §12.1 |
| **问题** | 仅世界引擎的同步调用上限已达 1+5+5+1=12次（不含涟漪异步0-10次和叙事价值评估5次）。加上工作室引擎约11次+按需，总计可能达到 23-38次/章（不含按需和异步），接近或超出 "20-30次" 的预算上限。 |
| **建议** | 增加一节 "LLM 调用频次预算分配"，明确各引擎调用上限及超预算时的裁剪策略。 |

#### I06: XState 等待状态的超时机制未在架构层定义

| 项目 | 详情 |
|------|------|
| **位置** | chapter08_mou_interaction.md §5 (多处)、chapter02_architecture.md §2.2.1 |
| **问题** | chapter08 的 waiting_* 状态有详细超时处理（AUTHOR_TIMEOUT 事件、Flow Guardian 干预），但架构层仅说"必须阻塞等待明确的人类输入事件，不允许自动跳过"，未提及超时作为合法的人类事件替代。 |
| **建议** | 在架构层明确超时作为等待状态的合法退出条件之一。 |

#### I07: chapter14 工程路线图与接口定义不完全对齐

| 项目 | 详情 |
|------|------|
| **位置** | chapter14_17_engineering.md §14.2-14.5、chapter02_architecture.md §2.4 |
| **问题** | Phase 0 任务包含 "定义XState状态机接口：MOU状态机、工作室状态机、世界引擎状态机"，但架构层定义的接口是 "WorldEngineTask/StudioEngineTask" 任务接口，不是 "状态机接口"。同时，Phase 1 中 "最简世界引擎" 和 "工作室引擎" 的验收标准未提及需要实现架构层定义的全部接口方法。 |
| **建议** | 更新工程路线图的接口定义任务描述，与架构层实际接口对齐。 |

---

## 三、术语一致性清单

### 已确认统一的术语

| 中文术语 | 英文术语 | 确认状态 | 备注 |
|----------|----------|----------|------|
| 世界引擎 | World Engine | 统一 | 所有章节一致 |
| 工作室引擎 | Studio Engine | 统一 | 所有章节一致 |
| 可能性清单 | Possibility Manifest / 可能性清单 | 基本统一 | chapter06 用 "Possibility Manifest"，其余多用 "可能性清单"，含义一致 |
| 重型模型 | Heavy Tier | 统一 | chapter12 明确定义，各引擎调用点一致 |
| 轻型模型 | Light Tier | 统一 | chapter12 明确定义，各引擎调用点一致 |
| MOU | Minimal Operating Unit | 统一 | chapter08 定义，架构层使用一致 |
| Flow Guardian | Flow Guardian | 统一 | chapter02、chapter09 一致 |
| 原子固化 | 原子固化 / Atomic Solidification | 部分统一 | 架构层+数据库层统一，引擎层缺失 |
| pgvector 维度 | 1536 | 统一 | chapter04 多处确认 |

### 需要统一的术语

| 中文术语 | 当前使用的英文 | 建议统一为 | 涉及章节 |
|----------|---------------|-----------|----------|
| 谏官 | Censor (ch02) / Counselor (ch09) / Remonstrator (ch08术语表) | **Remonstrator** | ch02, ch08, ch09 |
| 神谕 | Oracle (ch02, ch08) | Oracle | 需补充到 ch05, ch06, ch09 |
| 固化 | Solidification (ch02, ch04) | Solidification | 需补充到 ch05, ch06 |
| 故事线 | Storyline (ch07) | Storyline | 需补充到 ch04 (数据库表) |

---

## 四、架构原则遵循检查

| 原则 | 定义位置 | 遵循状态 | 备注 |
|------|----------|----------|------|
| 薄协调层（<5% 代码） | ch02 §2.2.1 | 设计层面 OK | 无具体代码量统计，无法验证 |
| 服务无状态 | ch02 §2.2.2 | ⚠️ 部分遵循 | chapter07 Storyline 无数据库表，违反无状态 |
| 单向数据流 | ch02 §2.2.3 | ✅ 遵循 | 所有章节一致描述 |
| 原子固化 | ch02 §2.2.4 | ⚠️ 部分遵循 | 引擎文档缺失固化概念 |
| 人类事件驱动 | ch02 §2.2.5 | ⚠️ 部分遵循 | 事件类型命名不一致（W01） |
| waiting_* 严格阻塞 | ch02 §2.2.1 / ch08 §2.2 | ✅ 遵循 | ch08 完整实现，含超时处理 |
| 工作室引擎不修改世界状态 | ch02 §2.2.3 | ✅ 遵循 | 架构图和描述一致 |

---

## 五、数据流一致性检查

### 世界引擎 → 工作室引擎 单向数据流

```
chapter02 架构定义：
  世界引擎 ──(场景感知查询)──→ 工作室引擎
        ←────(只读查询)────┘
  工作室引擎 ╳──(禁止)──→ 直接修改世界状态

chapter05 世界引擎：
  IWorldEngine 接口有 generatePossibilityList() → 返回 PossibilityList
  无 proposal 提交接口（需通过协调层）
  ✅ 单向数据流正确

chapter06 工作室引擎：
  核心数据流图中从 [可能性清单] → [Brief生成器] → ...
  无直接修改世界状态的路径
  ✅ 单向数据流正确

chapter08 MOU：
  状态机路径：generating_possibilities → waiting_author_choice → ...
  所有修改通过 AUTHOR_APPROVE 事件触发
  ✅ 单向数据流正确
```

**结论**：单向数据流在四章中定义一致，正确。✅

---

## 六、修复优先级建议

### P0（编码启动前必须完成）

1. **C01**: 统一 Possibility 接口定义
2. **C02**: 补充 IStudioEngine 接口
3. **C03**: 统一谏官英文名
4. **W01**: 统一 HumanEvent 事件类型命名

### P1（第一轮迭代前完成）

5. **C04**: 补充 storyline 数据库表
6. **W02**: 在引擎文档中补充 Oracle 引用
7. **W03**: 在引擎文档中补充固化机制
8. **W04**: 统一 LLM 调用清单

### P2（工程实施阶段完成）

9. **W05**: 补充缺失的 LLM 调用点
10. **W06**: 在 LLM 文档中补充 embedding 维度
11. **W07**: 在架构层补充临时数据规则
12. **W08**: 在架构层补充成本约束
13. **W09**: 统一 WorldEngineTask 与接口方法
14. **W10**: 确认模型版本号标注

---

## 七、可改进项（潜在优化）

### 性能相关
- **I05**: LLM 调用频次可能超出预算，建议增加调用预算分配和超限裁剪策略
- 异步调用（涟漪叙事后果）的批次合并策略未定义，可能导致大量并行请求

### 架构相关
- chapter05 的 `IWorldEngine` 接口过大（17个方法+LLM增强点），建议拆分为子接口或使用门面模式
- chapter06 缺乏引擎级统一接口，全部使用 class 可能导致模块间紧耦合

### 文档相关
- chapter05 和 chapter06 的 LLM 调用点分散在各小节中，建议增加汇总表
- chapter09 谏官的20+ 检查项缺乏优先级排序和性能影响评估

---

## 八、附录：交叉引用矩阵

| 概念/接口 | ch02 架构 | ch04 数据库 | ch05 世界引擎 | ch06 工作室引擎 | ch07 叙事要素 | ch08 MOU | ch09 质量系统 | ch12 LLM集成 | ch14 工程 |
|-----------|-----------|-------------|---------------|-----------------|---------------|----------|---------------|--------------|-----------|
| Possibility接口 | L2047 ✅ | - | L4693 ⚠️不兼容 | - | - | L163 ⚠️不兼容 | - | - | - |
| IWorldEngine | L756 ✅ | - | L4634 ✅ | - | - | - | - | - | - |
| IStudioEngine | L761 ✅ | - | - | ❌缺失 | - | - | - | - | - |
| 原子固化 | L150 ✅ | L4828 ✅ | ❌缺失 | ❌缺失 | - | - | ❌缺失 | - | - |
| Oracle/神谕 | L714 ✅ | - | ❌缺失 | ❌缺失 | - | L91 ✅ | ❌缺失 | - | - |
| 谏官系统 | L767 ✅ | - | - | - | - | L29 ✅ | ✅(命名不同) | - | - |
| Flow Guardian | L775 ✅ | - | - | - | - | L28 ✅ | L1495 ✅ | - | - |
| Storyline | - | ❌缺失 | - | - | L24 ✅ | - | - | - | - |
| pgvector/1536 | - | L18 ✅ | - | - | - | - | - | ❌缺失 | - |
| LLM调用清单 | - | - | L3496 ⚠️ | L32 ⚠️ | - | - | - | L28 ✅ | - |
| 成本估算 | - | - | - | - | - | - | - | L56 ✅ | - |
| waiting_*阻塞 | L132 ✅ | - | - | - | - | L67 ✅ | - | - | - |
| 单向数据流 | L138 ✅ | - | L4644 ✅ | L46 ✅ | - | - | - | - | - |

**图例**: ✅ = 存在且一致 | ⚠️ = 存在但不一致 | ❌ = 缺失 | - = 不适用

---

*报告生成完毕。以上问题总计21项，建议按优先级分批修复。*
