# 第十三章 变更追踪与可观测性（Observability）

> **文档版本**: v3.0.0-final  
> **适用范围**: NarrativeOS v3.0 Sovereign — 面向100万字以上长篇网文创作的作者增强系统  
> **设计目标**: 100%可追溯、零盲区、作者可控  
> **关联文档**: 第四章（数据层）、第五章（世界引擎）、第八章（MOU）、第九章（质量系统）、第十二章（LLM集成）

---

## 13.0 可观测性架构总览

### 13.0.1 三大支柱

NarrativeOS v3.0 的可观测性体系建立在**指标（Metrics）、日志（Logs）、追踪（Traces）**三大支柱之上，面向分布式创作引擎的全链路进行监控与追踪：

| 支柱 | 采集对象 | 存储方案 | 查询语言 | 保留策略 |
|------|---------|---------|---------|---------|
| **指标（Metrics）** | 系统性能、业务计数器、质量评分 | Prometheus + 自定义汇总表 | PromQL + SQL | 系统指标30天，业务指标90天 |
| **日志（Logs）** | 引擎调用日志、Prompt记录、决策依据 | 结构化JSON日志 + PostgreSQL JSONB | SQL (JSONB路径查询) | 热存储30天，冷存储归档1年 |
| **追踪（Traces）** | MOU状态流转、引擎间调用链、LLM调用 | OpenTelemetry + Jaeger | TraceQL | 7天热存储，30天采样归档 |

### 13.0.2 系统架构图

```
+-----------------------------------------------------------------------------+
|                        NarrativeOS v3.0 可观测性管线                         |
|                                                                             |
|   +--------------+  +--------------+  +--------------+  +--------------+   |
|   |  世界引擎     |  |  工作室引擎   |  |   谏官系统    |  |  MOU状态机   |   |
|   |  (8子引擎)   |  |  (生成/修改) |  |  (20+检查项) |  |  (XState v5) |   |
|   +------+-------+  +------+-------+  +------+-------+  +------+-------+   |
|          |                 |                 |                 |           |
|   +------+-------+  +------+-------+  +------+-------+  +------+-------+   |
|   | 结构化日志   |  | 结构化日志   |  | 结构化日志   |  | 状态事件     |   |
|   | emit_log()   |  | emit_log()   |  | emit_log()   |  | emit_state() |   |
|   +------+-------+  +------+-------+  +------+-------+  +------+-------+   |
|          |                 |                 |                 |           |
|   +------+-----------------+-----------------+-----------------+           |
|   |                        采集层 (Collector)                               |
|   |  +----------+  +----------+  +----------+  +----------+                |
|   |  | 文件日志  |  | DB钩子   |  | OTEL SDK |  | 内存缓冲  |                |
|   |  | (JSONL)  |  | (触发器) |  | (Span)   |  | (RingBuf)|                |
|   |  +-----+----+  +-----+----+  +-----+----+  +-----+----+                |
|   +-------+-------------+-------------+-------------+----------------------+
|           |             |             |             |                       |
|   +-------+-------------+-------------+-------------+                       |
|   |                        处理层 (Processor)                                 |
|   |  +-----------------------------------------------------+                |
|   |  |  日志处理器: 解析->富化->聚合->路由                     |                |
|   |  |  指标处理器: 聚合->降采样->规则计算                     |                |
|   |  |  追踪处理器: Span组装->调用链重建->采样                 |                |
|   |  +-------------------------+---------------------------+                |
|   +----------------------------+---------------------------------------------+
|                                |                                            |
|   +----------------------------+--------------------------------------------+
|   |                        存储层 (Storage)                                   |
|   |  +--------------+  +--------------+  +--------------+                   |
|   |  | PostgreSQL   |  |  Prometheus  |  |   Jaeger     |                   |
|   |  | (JSONB日志)  |  |  (时序指标)  |  |  (调用链)    |                   |
|   |  +--------------+  +--------------+  +--------------+                   |
|   +--------------------------------------------------------------------------+
|                                |                                            |
|   +----------------------------+--------------------------------------------+
|   |                        展示层 (Presentation)                              |
|   |  +--------------+  +--------------+  +--------------+                   |
|   |  | 审计面板      |  |  Grafana     |  |  Jaeger UI   |                   |
|   |  | (内置)       |  |  (指标)      |  |  (追踪)      |                   |
|   |  +--------------+  +--------------+  +--------------+                   |
|   +--------------------------------------------------------------------------+
+-----------------------------------------------------------------------------+
```

### 13.0.3 与现有架构的集成点

可观测性管线与 NarrativeOS 核心架构的六个集成点：

| 集成点 | 位置 | 机制 | 数据类型 |
|--------|------|------|---------|
| **events表** | 数据库层 | INSERT/UPDATE触发器 | delta_jsonb变更日志 |
| **chapter_versions表** | 数据库层 | 版本快照 | 全文+质量报告+上下文 |
| **MOU状态机** | 应用层 | XState actor订阅 | 状态流转事件 |
| **LLM调用层** | 应用层 | 请求/响应拦截器 | Token消耗、延迟、模型路由 |
| **谏官管线** | 应用层 | 检查项执行钩子 | 20+项检查过程与结果 |
| **世界引擎** | 应用层 | 子引擎调用包装器 | 涟漪传播、势能计算、代价评估 |

---

## 13.1 世界引擎变更追踪

### 13.1.1 状态变更追踪：delta_jsonb的完整结构定义

`events.delta_jsonb` 采用严格的 JSON Schema 记录每次事件对所有相关实体属性的精确变更。该字段是因果推理和状态回溯的**核心数据源**。

#### JSON Schema 定义

```typescript
// ============================================================
// delta_jsonb 完整结构定义
// ============================================================

interface DeltaJsonb {
  // 元数据：本次变更的整体信息
  _meta: {
    version: "3.0";           // Schema版本号
    operationId: string;      // 本次操作的唯一ID（用于关联调用链）
    engineName: string;       // 产生变更的引擎名（如"physics_rules", "ripple_simulator"）
    subEngineName?: string;   // 子引擎名（如"combat_evaluator"）
    timestamp: string;        // ISO 8601格式的时间戳
    changeCount: number;      // 受影响的实体数量
    totalPaths: number;       // 变更路径总数
    causalityLevel: number;   // 因果层级（0=直接变更, 1=一级推断, 2+=多级传播）
    worldStateVersion: number;// 世界状态版本号（单调递增）
    sourceEventId?: string;   // 触发源事件ID（因果链回溯用）
    traceId: string;          // OpenTelemetry Trace ID
  };

  // 实体变更记录：键为实体ID，值为该实体的所有变更路径
  changes: Record<string, EntityDelta>;

  // 关系变更记录（独立存储，因关系是实体间的边）
  relationshipChanges?: RelationshipDelta[];

  // 全局状态变更（如世界时间、全局变量）
  globalChanges?: GlobalDelta[];
}

interface EntityDelta {
  entityId: string;
  entityType: "character" | "organization" | "location" | "item" | "skill" | "faction" | "concept" | "timeline";
  entityName: string;       // 人类可读的实体名（用于审计展示）
  
  // 属性路径变更：键为dot notation路径，值为旧/新值对
  propertyPaths: Record<string, PropertyChange>;
  
  // 变更摘要（用于快速展示，非冗余存储）
  summary: string;          // 如"林云战力从12500提升至18700（突破至元婴期）"
  
  // 变更类型
  changeType: "CREATE" | "UPDATE" | "DELETE" | "TRANSFORM";
  
  // 变更影响评估
  impact: {
    powerDelta?: number;    // 战力变化值（如有）
    narrativeWeight: number;// 叙事重要性 [0, 1]
    affectedRelationships: string[]; // 受影响的关联实体ID列表
  };
}

interface PropertyChange {
  path: string;             // dot notation路径，如"stats.combatPower.total"
  oldValue: unknown;        // 变更前值（null表示新增）
  newValue: unknown;        // 变更后值（null表示删除）
  valueType: "string" | "number" | "boolean" | "object" | "array" | "null";
  
  // 增量信息（数值类型时有用）
  delta?: number;           // 数值变化量（newValue - oldValue）
  deltaPercent?: number;    // 百分比变化（(delta / |oldValue|) * 100）
  
  // 变更原因
  reason: {
    type: "direct" | "formula" | "rule_engine" | "llm_inference" | "ripple_propagation" | "precedent_fusion";
    ruleId?: string;        // 触发的规则ID（规则引擎触发时）
    formula?: string;       // 计算公式（公式计算时）
    llmCallId?: string;     // LLM调用ID（LLM推断时）
    sourceEventId?: string; // 源事件ID（涟漪传播时）
    description: string;    // 人类可读的原因描述
  };
  
  // 审计信息
  audit: {
    verified: boolean;      // 是否已通过校验
    verifiedBy?: string;    // 校验者（"rule_engine" / "remonstrator" / "author"）
    verificationTime?: string; // ISO 8601
  };
}

interface RelationshipDelta {
  relationshipId: string;
  fromEntityId: string;
  toEntityId: string;
  changeType: "CREATE" | "UPDATE" | "DELETE";
  oldRelationType?: string;
  newRelationType?: string;
  oldStrength?: number;     // 关系强度 [-1, 1]
  newStrength?: number;
  reason: string;
}

interface GlobalDelta {
  path: string;             // 如"worldTime.currentYear"
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}
```

#### 属性路径追踪的精确格式（Dot Notation）

```
属性路径采用严格的三段式命名空间：

  <category>.<subcategory>.<field>

示例路径（角色实体）：
  stats.combatPower.total          -> 综合战力值
  stats.combatPower.vector.atk     -> 攻击力维度值
  realm.current.stageId            -> 当前境界阶段ID
  realm.current.tierId             -> 当前境界子层级ID
  realm.current.baseMultiplier     -> 境界基础倍率
  status.main                      -> 主状态（active/injured/dead等）
  status.effects[]                 -> 状态效果数组
  resources.hp.current             -> 当前生命值
  resources.mp.max                 -> 最大法力值
  abilities.active[].abilityId    -> 激活的能力ID列表
  abilities.cooldowns."fireball"   -> 特定能力的冷却时间

示例路径（组织实体）：
  influence.territory[].regionId   -> 势力范围区域ID列表
  members.leaderId                 -> 首领实体ID
  members.count                    -> 成员数量
  treasury.balance                 -> 库存资源量

索引规则：
  - 数组元素：使用 [] 表示追加，使用 [n] 表示索引位置
  - 含特殊字符的键：使用双引号包裹，如 cooldowns."fireball"
  - 嵌套深度：不限，但典型深度为3-5层
```

#### 存储策略：全量 + 增量混合

| 策略 | 适用场景 | 实现方式 |
|------|---------|---------|
| **增量存储** | 数值变更、关系强度微调 | 仅记录变化的路径和delta值 |
| **全量快照** | 境界突破、能力觉醒、状态跃迁 | 记录受影响实体的完整状态副本 |
| **混合模式** | 战斗事件（多维属性同时变化） | 核心路径用增量，辅助路径用全量 |

**存储优化**：对数值型变更采用增量编码，典型场景下 `delta_jsonb` 平均大小控制在 **2-8KB**（战斗事件可达20KB）。PostgreSQL GIN索引支持对JSONB路径的高效查询。

#### 变更类型分类

```typescript
type ChangeType = 
  | "CREATE"    // 新实体诞生（如新角色出场、新组织成立）
  | "UPDATE"    // 属性值变化（如战力提升、关系调整）
  | "DELETE"    // 实体退场（如角色死亡、组织解散）
  | "TRANSFORM" // 形态跃迁（如境界突破、物品升阶、阵营转换）
```

---

### 13.1.2 涟漪追踪

涟漪模拟器（5.6节）记录信息在世界中的传播链条，每条涟漪事件生成完整的传播链记录。

#### 涟漪传播链的完整记录格式

```typescript
// ============================================================
// 涟漪传播链记录（存储于 events.delta_jsonb._meta.rippleChain）
// ============================================================

interface RippleChain {
  rippleId: string;               // 涟漪唯一ID
  originEventId: string;          // 起源事件ID
  originEntityId: string;         // 信息始发实体
  informationType: "combat_result" | "realm_breakthrough" | "treasure_discovery" | "secret_leak" | "death" | "alliance" | "custom";
  initialIntensity: number;       // 初始强度 [0, 1]
  propagationPath: RippleNode[];  // 传播路径（按时间排序）
  decayModel: DecayModel;         // 衰减模型参数
  
  // 统计
  stats: {
    totalNodes: number;           // 总传播节点数
    maxDepth: number;             // 最大传播深度
    totalPropagationTime: number; // 传播总耗时（ms）
    entitiesReached: string[];    // 被触及的所有实体ID
    terminalNodes: string[];      // 衰减至停止的节点ID
  };
}

interface RippleNode {
  nodeId: string;                 // 节点ID（格式: ripple_{rippleId}_d{depth}_n{seq}）
  depth: number;                  // 传播深度（0=原点）
  sequence: number;               // 同深度内的传播顺序
  entityId: string;               // 当前传播到的实体
  
  // 接收状态
  receivedAt: string;             // ISO 8601接收时间
  receivedState: "known" | "rumor" | "distorted" | "dismissed";
  
  // 信息状态
  informationSnapshot: {          // 该实体接收到的信息快照
    content: string;              // 信息内容（可能被扭曲）
    fidelity: number;             // 保真度 [0, 1]（1.0=完全准确）
    distortionCauses?: string[];   // 扭曲原因
  };
  
  // 强度
  intensity: number;              // 到达时的强度 [0, 1]
  intensityDecay: number;         // 从上一节点到本节点的衰减量
  
  // 传播决策
  propagationDecision: {          // 该节点是否继续传播的决定
    willPropagate: boolean;       // 是否继续传播
    reason: "high_interest" | "strategic_value" | "gossip" | "obligation" | "too_weak" | "not_interested" | "keep_secret";
    targetEntityIds: string[];    // 决定传播给哪些实体
    delayMs: number;              // 传播延迟（模拟信息传递时间）
  };
  
  // 状态影响
  effects: RippleEffect[];       // 该信息对此实体产生的影响
  
  // 来源
  fromNodeId: string | null;     // 上一节点ID（null表示原点）
}

interface RippleEffect {
  effectType: "relation_change" | "goal_update" | "emotion_shift" | "action_trigger" | "knowledge_add";
  path: string;                   // 受影响的属性路径
  oldValue: unknown;
  newValue: unknown;
  significance: number;           // 影响重要性 [0, 1]
}

interface DecayModel {
  type: "exponential" | "distance_based" | "custom";
  halfLife: number;               // 半衰期（传播步数）
  baseDecayRate: number;          // 基础衰减率
  distanceFactor: number;         // 距离因子（地理/社交距离的影响权重）
  relationshipFactor: number;     // 关系因子（关系强度对传播效率的影响）
}
```

#### 涟漪衰减的计算记录

涟漪衰减采用指数衰减 + 距离修正的混合模型，所有计算步骤均记录：

```
衰减计算公式（每步）：
  I_next = I_current * decay_rate * rel_modifier * dist_modifier

其中：
  decay_rate = baseDecayRate^(1)                    // 基础衰减（默认0.85）
  rel_modifier = 0.5 + 0.5 * relationship_strength  // 关系修正 [-1,1] -> [0, 1.5]
  dist_modifier = 1 / (1 + spatial_distance * 0.1) // 距离修正

记录格式：
  {
    "step": 3,
    "inputIntensity": 0.614,
    "decayRate": 0.85,
    "relModifier": 1.2,
    "distModifier": 0.833,
    "outputIntensity": 0.437,
    "formula": "0.614 * 0.85 * 1.2 * 0.833 = 0.437",
    "termination": false
  }
```

---

### 13.1.3 先例势能历史

先例引擎（5.7节）追踪叙事先例的势能变化，形成完整的时间序列记录。

#### 势能变化的时间序列记录

```typescript
// ============================================================
// 先例势能历史记录
// ============================================================

interface PrecedentHistory {
  precedentId: string;            // 先例ID
  precedentType: "narrative_device" | "character_arc" | "world_mechanic" | "relationship_pattern";
  name: string;                   // 先例名称（如"扮猪吃虎桥段"）
  
  // 势能时间序列
  potentialSeries: PotentialPoint[];
  
  // 增殖记录
  reproductions: ReproductionEvent[];
  
  // 核聚变记录
  fusions: FusionEvent[];
  
  // 半衰期衰减参数
  decayParams: {
    halfLifeChapters: number;     // 半衰期（章节数）
    decayFactor: number;          // 衰减因子
    lastActivatedChapter: number; // 上次激活章节
    currentPotential: number;     // 当前势能值
  };
}

interface PotentialPoint {
  chapter: number;                // 章节号
  timestamp: string;              // 时间戳
  potential: number;              // 势能值 [0, 1]
  eventType: "activation" | "natural_decay" | "reproduction" | "fusion" | "author_boost";
  sourceEventId?: string;         // 关联事件ID
  description: string;            // 变化描述
  
  // 半衰期衰减计算日志
  decayCalculation?: {
    chaptersElapsed: number;      // 距上次激活的章节数
    expectedDecay: number;        // 预期衰减后值：P * (0.5)^(elapsed/halfLife)
    actualValue: number;          // 实际值
    deviation: number;            // 偏差（实际 - 预期）
  };
}

interface ReproductionEvent {
  reproductionId: string;
  parentPrecedentId: string;      // 母体先例ID
  childPrecedentIds: string[];    // 子代先例ID列表
  triggerChapter: number;
  triggerContext: string;         // 触发上下文描述
  reproductionScore: number;      // 增殖评分 [0, 1]（衡量子代质量）
  narrativeDistance: number;      // 叙事距离（与母体的差异度）
}

interface FusionEvent {
  fusionId: string;
  sourcePrecedentIds: string[];   // 参与聚变的先例ID列表
  resultPrecedentId: string;      // 聚变产物ID
  triggerChapter: number;
  fusionEnergy: number;           // 聚变能量（各先例势能之和）
  noveltyScore: number;           // 新颖度评分 [0, 1]
  narrativeDescription: string;   // 叙事层面的聚变描述
}
```

#### 半衰期衰减的计算日志

```
半衰期衰减公式：
  P_t = P_0 * (1/2)^(t / t_half)

其中：
  P_0  = 上次激活时的势能值
  t    = 距上次激活的章节数
  t_half = 半衰期章节数（由先例类型决定，默认50章）

示例计算日志：
  {
    "precedentId": "prec_001",
    "precedentName": "扮猪吃虎桥段",
    "initialPotential": 0.85,
    "halfLife": 50,
    "chaptersElapsed": 75,
    "calculation": "0.85 * (0.5)^(75/50) = 0.85 * 0.3535 = 0.3005",
    "currentPotential": 0.3005,
    "status": "decayed_but_usable"
  }
```

---

### 13.1.4 可能性清单元数据

可能性清单（5.9.4节）生成时记录完整的元数据，用于审计和优化。

#### 过滤原因的完整分类和编码

```typescript
// ============================================================
// 可能性清单元数据
// ============================================================

interface PossibilityMetadata {
  generationId: string;           // 生成批次ID
  generationContext: {
    chapter: number;
    scene: number;
    currentWorldStateHash: string;
    constraintSetVersion: string;
    narrativeWeights: Record<string, number>;
  };
  
  // 生成统计
  stats: {
    totalGenerated: number;       // 初始生成总数
    filteredCount: number;        // 被过滤的数量
    finalCount: number;           // 最终输出数量
    generationTimeMs: number;     // 生成耗时
    llmCallCount: number;         // LLM调用次数
    totalTokensConsumed: number;  // 总Token消耗
  };
  
  // 完整的可能性记录（含被过滤的）
  possibilities: PossibilityAuditRecord[];
  
  // 生成参数
  generationParams: {
    maxDepth: number;
    branchingFactor: number;
    cspTimeoutMs: number;
    llmTemperature: number;
    pruningThreshold: number;
  };
}

interface PossibilityAuditRecord {
  possibilityId: string;
  title: string;
  summary: string;
  
  // 评分维度
  scores: {
    narrativeMerit: number;       // 叙事价值 [0, 1]
    dramaticTension: number;      // 戏剧张力 [0, 1]
    foreshadowingFit: number;     // 伏笔契合度 [0, 1]
    surpriseFactor: number;       // 意外程度 [0, 1]
    feasibility: number;          // 可行性 [0, 1]
    protagonistRelevance: number; // 主角关联度 [0, 1]
    compositeScore: number;       // 综合评分
  };
  
  // 代价评估
  costs: {
    narrativeCost: number;        // 叙事代价（对后续可能性的限制程度）
    characterCost: number;        // 角色代价（对角色的消耗/损伤）
    worldCost: number;            // 世界代价（对世界状态的不可逆改变）
    authorCost: number;           // 作者代价（写作难度评估）
    totalCost: number;            // 综合代价
  };
  
  // 风险分析
  risks: {
    narrativeRisk: number;        // 叙事风险 [0, 1]
    consistencyRisk: number;      // 一致性风险 [0, 1]
    readerDissatisfactionRisk: number; // 读者不满风险 [0, 1]
    maxSeverity: "info" | "caution" | "warning" | "critical";
  };
  
  // 过滤信息
  filtering?: {
    wasFiltered: boolean;         // 是否被过滤
    filterReason?: FilterReason;  // 过滤原因（如被过滤）
    filterStage?: "csp_pruning" | "rule_elimination" | "quality_gate" | "diversity_filter" | "author_preference";
    filterTimestamp?: string;
  };
}

// 过滤原因枚举
type FilterReason =
  | "HARD_CONSTRAINT_VIOLATION"     // 违反硬约束
  | "LOW_NARRATIVE_MERIT"           // 叙事价值过低（<阈值）
  | "HIGH_CONSISTENCY_RISK"         // 一致性风险过高
  | "REDUNDANT_WITH_EXISTING"       // 与现有可能性重复
  | "PROHIBITED_BY_AUTHOR_RULE"     // 被作者自定义规则禁止
  | "REMONSTRATOR_BLOCK"           // 谏官拦截
  | "COST_EXCEEDS_BUDGET"          // 代价超出预算
  | "VIOLATES_FORESHADOWING"       // 违背伏笔约束
  | "NARRATIVE_DISTANCE_TOO_HIGH"  // 叙事偏离度过大
  | "PLAUSIBILITY_TOO_LOW";        // 可信度不足
```

---

## 13.2 工作室引擎变更追踪

### 13.2.1 版本追踪的完整规格

#### chapter_versions表的完整使用规范

`chapter_versions` 表记录每次生成或修改的完整快照，是工作室引擎的核心可观测性载体。每条记录对应一个**不可变的版本节点**。

**版本生成时机**：

| 触发时机 | version_number递增 | 说明 |
|----------|-------------------|------|
| AI首次生成初稿 | 是 | 从null -> v1 |
| AI修改正文 | 是 | vN -> v(N+1) |
| 作者手动编辑后保存 | 是 | 创建新版本 |
| 润色操作 | 是 | vN -> v(N+1) |
| 谏官建议采纳并应用 | 是 | 创建新版本 |
| 仅审阅通过（无修改） | 否 | 更新chapter状态 |

**版本记录内容**：

```typescript
// chapter_versions 记录的完整结构

interface ChapterVersionRecord {
  version_id: string;           // UUID（主键）
  chapter_id: string;           // 关联章节ID
  version_number: number;       // 章节内递增版本号
  
  content_text: string;         // 完整正文（该版本的不可变快照）
  content_hash: string;         // 内容SHA256哈希（用于快速比对）
  word_count: number;           // 字数统计
  
  intuition_score: number;      // 直觉分 [0, 100]（作者直觉评估）
  
  quality_report: QualityReport; // 质量报告（详见下方）
  
  used_context: UsedContext;    // 上下文清单（详见下方）
  
  diff_word_count: number;      // 与上一版本的字数差异
  diff_ratio: number;           // 变化比例 [0, 1]
  
  version_note: string;         // 版本备注
  
  // 审计字段
  created_by: "ai_generation" | "author_edit" | "polishing" | "remonstrator_fix";
  created_at: string;           // ISO 8601
  trace_id: string;             // OpenTelemetry Trace ID
}

interface QualityReport {
  // 整体评分
  overallScore: number;         // 综合质量分 [0, 100]
  
  // 六维度评分
  dimensions: {
    styleConsistency: number;   // 风格一致性 [0, 100]
    loreAdherence: number;      // 设定遵守度 [0, 100]
    pacingScore: number;        // 节奏评分 [0, 100]
    characterVoice: number;     // 角色声线 [0, 100]
    emotionalImpact: number;    // 情感冲击力 [0, 100]
    narrativeFlow: number;      // 叙事流畅度 [0, 100]
  };
  
  // 文本级诊断
  paragraphDiagnoses: ParagraphDiagnosis[];
  
  // 问题列表
  issues: QualityIssue[];
  
  // 与前序章节的连贯性评估
  continuity: {
    transitionSmoothness: number; // 过渡平滑度 [0, 100]
    plotThreadResolutions: string[]; // 收束的情节线
    plotThreadOpenings: string[];   // 新开的情节线
    foreshadowingHints: string[];   // 埋下的新伏笔
  };
  
  // 评分置信度
  confidence: number;           // LLM评分的置信度 [0, 1]
  scoringModel: string;         // 使用的评分模型
  scoringTimestamp: string;     // 评分时间
}

interface ParagraphDiagnosis {
  paragraphIndex: number;
  wordCount: number;
  pacingTag: "setup" | "build_up" | "climax" | "resolution" | "transition";
  tensionScore: number;
  informationDensity: number;
  flaggedIssues: string[];
}

interface QualityIssue {
  severity: "info" | "minor" | "major" | "critical";
  category: "style" | "lore" | "pacing" | "character" | "grammar" | "plot";
  location: string;             // 段落/句子位置
  description: string;
  suggestion: string;
}

interface UsedContext {
  retrievalTimestamp: string;
  topK: number;
  
  // 检索的实体
  entities: {
    entityId: string;
    entityName: string;
    entityType: string;
    similarityScore: number;    // 向量相似度分数
    contentSnapshot: string;    // 检索时使用的文本片段
  }[];
  
  // 检索的事件
  events: {
    eventId: string;
    description: string;
    chapter: number;
    relevanceScore: number;
  }[];
  
  // 检索的伏笔
  foreshadowings: {
    fsId: string;
    description: string;
    status: "planted" | "activated" | "recovered";
  }[];
  
  // 使用的写作指令
  directives: {
    briefSummary: string;
    authorNotes: string[];
    styleGuidelines: string[];
  };
  
  // 检索质量元数据
  retrievalQuality: {
    averageSimilarity: number;
    minSimilarity: number;
    maxSimilarity: number;
    coverageScore: number;      // 上下文覆盖度 [0, 1]
  };
}
```

#### 版本对比算法

系统提供两种对比模式：

**文本 Diff（Text Diff）**：
- 基于 Myers 差分算法，支持段落级、句子级、字词级三级粒度
- 展示增删改标记，支持合并冲突的可视化
- 统计指标：字数变化率、段落变化数、修改密度

**语义 Diff（Semantic Diff）**：
- 基于 LLM 的语义分析，识别"改了什么"而非"哪里不同"
- 输出叙事层面的变更描述，如："本章新增了一段林云的内心独白，强化了他对师门的矛盾心理"
- 自动识别：角色行为变化、情节走向调整、情感基调偏移、伏笔增减

#### 版本回溯的用户体验设计

```
版本回溯界面
+-- 版本列表（左侧时间线）
|   +-- v1 -- AI初稿 -- 直觉分:72 -- 2025-05-01 14:30
|   +-- v2 -- 作者编辑 -- 直觉分:85 -- 2025-05-01 15:45
|   +-- v3 -- AI修改 -- 直觉分:78 -- 2025-05-02 09:00
|   +-- v4 -- 润色 -- 直觉分:91 -- 2025-05-02 11:20
|
+-- 对比面板（中央）
|   +-- 选中v2与v4对比
|   +-- 文本diff高亮
|   +-- 语义diff摘要
|
+-- 操作栏
    +-- [回溯到此版本]（需确认）
    +-- [导出版本]
    +-- [复制内容]

回溯操作：
  1. 作者选择目标版本
  2. 系统显示确认对话框，列出将丢失的变更
  3. 作者确认后，创建新的回溯版本（v5 = 复制v2 + 回溯标记）
  4. 原版本链保持不变（回溯创建新分支，非破坏性操作）
```

---

### 13.2.2 生成过程追踪

#### Prompt组装日志

每次LLM调用的Prompt组装过程生成结构化日志：

```typescript
interface PromptAssemblyLog {
  assemblyId: string;
  callPoint: string;            // 调用点标识，如"possibility_narrative_enhancement"
  modelRoute: string;           // 路由结果，如"deepseek_v4_pro"
  
  // 组装层级
  layers: PromptLayer[];
  
  // 最终Prompt统计
  finalPrompt: {
    totalTokens: number;
    systemTokens: number;
    contextTokens: number;
    instructionTokens: number;
    outputTokens: number;
  };
  
  assemblyTimeMs: number;
}

interface PromptLayer {
  layerName: string;            // 如"system_prompt", "world_context", "character_context", "author_directive", "task_instruction"
  source: string;               // 来源模块
  contentPreview: string;       // 内容前200字符（审计用）
  tokenCount: number;
  priority: number;             // 优先级（优先级低的在Token不足时被截断）
  wasTruncated: boolean;        // 是否被截断
  truncationReason?: string;
}
```

#### 上下文检索日志

```typescript
interface ContextRetrievalLog {
  retrievalId: string;
  query: string;                // 检索查询（或embedding的文本）
  queryEmbedding?: number[];    // 查询向量（1536维，可选存储）
  
  // 检索结果
  results: {
    entityId: string;
    entityName: string;
    entityType: string;
    similarityScore: number;    // 向量相似度
    metadataScore: number;      // 元数据匹配度
    compositeRank: number;      // 综合排名
    retrievedSnapshot: string;  // 实际使用的文本片段
  }[];
  
  // 检索质量
  quality: {
    top1Relevance: number;      // Top-1相关性评分
    averageRelevance: number;   // 平均相关性
    diversityScore: number;     // 结果多样性 [0, 1]
    coverageGap: string[];      // 覆盖盲区提示
  };
  
  retrievalTimeMs: number;
}
```

#### LLM调用日志

```typescript
interface LLMCallLog {
  callId: string;
  traceId: string;
  parentSpanId?: string;
  
  // 请求信息
  request: {
    callPoint: string;          // 调用点（如"studio_generate_content"）
    engine: string;             // 调用引擎
    model: string;              // 实际使用的模型
    modelTier: "heavy" | "light";
    temperature: number;
    maxTokens: number;
    promptTokenCount: number;
    promptHash: string;         // Prompt哈希（用于缓存命中检测）
  };
  
  // 响应信息
  response: {
    status: "success" | "failure" | "timeout" | "rate_limited";
    outputTokenCount: number;
    outputHash: string;
    responseTimeMs: number;
    finishReason: "stop" | "length" | "content_filter" | "error";
    parsingResult: "success" | "partial" | "failed"; // JSON解析结果
  };
  
  // 成本
  cost: {
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;      // 估算成本（元）
    currency: "CNY";
  };
  
  // 错误信息（如失败）
  error?: {
    errorType: string;
    errorMessage: string;
    retryCount: number;
    fallbackModel?: string;
  };
  
  // 缓存信息
  cache: {
    cacheHit: boolean;
    cacheKey?: string;
    cacheTtlMs?: number;
  };
  
  timestamp: string;
}
```

---

### 13.2.3 质量追踪

#### 直觉分的历史趋势

直觉分（intuition_score）是作者对章节质量的主观评分，系统追踪其历史趋势：

```typescript
interface IntuitionTrend {
  chapterId: string;
  chapterNumber: number;
  
  // 版本级直觉分序列
  versionScores: {
    versionNumber: number;
    score: number;
    createdBy: string;
    timestamp: string;
  }[];
  
  // 趋势分析
  trend: {
    direction: "improving" | "stable" | "declining";
    slope: number;              // 回归斜率
    peakScore: number;
    peakVersion: number;
    latestScore: number;
    averageScore: number;
  };
  
  // 与同作品的横向对比
  comparison: {
    vsChapterAverage: number;   // 与全书平均分差异
    vsSameArc: number;          // 与同幕平均分差异
    rankPercentile: number;     // 百分位排名 [0, 100]
  };
}
```

---

## 13.3 决策可解释性

### 13.3.1 谏官报告的可解释性

谏官系统（第九章）的每项检查均附带完整的证据链。

#### 每项检查的证据链

```typescript
interface RemonstratorEvidence {
  checkId: string;              // 如"C01"（战力体系一致性）
  checkName: string;
  severity: "info" | "caution" | "warning" | "critical";
  
  // 证据链
  evidenceChain: {
    ruleReference: string;      // 引用的规则/设定（如"境界突破规则v3.2"）
    textEvidence: string[];     // 具体文本引用（原文段落）
    calculationSteps: CalculationStep[]; // 计算步骤
    historicalContext?: string; // 历史上下文引用
    authoritySource: string;    // 依据来源（如"物理规则引擎", "角色档案", "作者设定"）
  };
  
  // 判定逻辑
  verdict: {
    conclusion: string;         // 结论
    reasoning: string;          // 推理过程
    confidence: number;         // 置信度 [0, 1]
    overrideable: boolean;      // 作者是否可以覆盖
  };
  
  // 策略建议
  strategies: Strategy[];
}

interface CalculationStep {
  step: number;
  description: string;          // 如"计算突破后的境界倍率"
  formula: string;              // 如"baseMultiplier * breakthroughBonus"
  inputs: Record<string, number>;
  output: number;
  unit?: string;
}

interface Strategy {
  strategyId: string;
  title: string;
  description: string;
  estimatedEffort: "low" | "medium" | "high";
  tradeOffs: string[];
}
```

#### 战力公式的计算过程展示

当谏官报告战力体系问题时，展示完整的计算过程：

```
[战力异常报告 - 计算过程]

检查项: C01 - 战力体系一致性
严重度: WARNING

规则引用: 5.1.2.2 综合战力公式
角色: 林云（entity_id: char_001）

计算步骤:
  Step 1: 基础属性
    攻击:  基础120 * 境界倍率200 = 24,000
    防御:  基础100 * 境界倍率200 = 20,000
    速度:  基础80  * 境界倍率200 = 16,000
    
  Step 2: 装备加成
    龙鳞剑: 攻击 +15%
    青云甲: 防御 +20%
    
  Step 3: Buff/Debuff
    燃烧精血: 攻击 *1.5, 防御 *0.8
    
  Step 4: 综合战力
    加权攻击 = 24,000 * 1.15 * 1.5 = 41,400
    加权防御 = 20,000 * 1.20 * 0.8 = 19,200
    加权速度 = 16,000 * 1.0  * 1.0 = 16,000
    
    综合战力 = 0.25*41,400 + 0.20*19,200 + 0.15*16,000 + ... = 24,150
    
  Step 5: 预期范围
    金丹后期标准范围: 15,000 - 30,000
    林云当前值: 24,150 (在合理范围内)
    
  但: 本章描述暗示"远超同阶"，实际值仅处于中上水平。
  建议: 提升燃烧精血效果描述或调整数值预期。

文本证据:
  "林云只觉体内灵力暴涨，一股远超金丹后期的气势轰然爆发..."
  （原文第3段第5句）
```

---

### 13.3.2 引擎调用链路追踪

#### 引擎间调用的完整记录

MOU状态流转过程中的所有引擎间调用均被记录：

```typescript
interface EngineCallRecord {
  callId: string;
  traceId: string;
  spanId: string;
  
  caller: {
    engine: string;             // 调用方引擎
    operation: string;          // 调用方操作
    mouState: string;           // 当前MOU状态
  };
  
  callee: {
    engine: string;             // 被调用引擎
    subEngine?: string;         // 子引擎
    operation: string;          // 被调用操作
  };
  
  // 调用详情
  request: {
    parameters: Record<string, unknown>;
    parameterHash: string;
    timestamp: string;
  };
  
  response: {
    status: "success" | "failure" | "partial";
    resultSummary: string;
    resultHash: string;
    processingTimeMs: number;
    timestamp: string;
  };
  
  // 性能
  performance: {
    queueWaitMs: number;        // 队列等待时间
    processingMs: number;       // 实际处理时间
    totalLatencyMs: number;     // 总延迟
  };
  
  // 资源消耗
  resources: {
    llmCalls: number;
    tokensIn: number;
    tokensOut: number;
    dbQueries: number;
  };
}
```

---

## 13.4 审计面板设计

### 13.4.1 世界状态变更时间线

#### 时间线组件设计

```
+------------------------------------------------------------------+
|  世界状态变更时间线                                               |
|                                                                   |
|  [筛选: v全部引擎] [v全部实体] [v全部类型] [搜索...] [导出]      |
|                                                                   |
|  <------------------------------------------------------->        |
|                                                                   |
|  +- 第150章 ------------------------------------------------+     |
|  | 14:32:15  ### 物理规则引擎 林云突破至元婴期              |     |
|  |           dCP: +450,000  [详情] [查看delta_jsonb]        |     |
|  |                                                          |     |
|  | 14:32:18  ### 涟漪模拟器  | 信息传播链启动               |     |
|  |           原点: 林云突破 -> 影响23个实体                  |     |
|  |           最大深度: 3  总传播时间: 1.2s                   |     |
|  |           [展开传播树]                                    |     |
|  |                                                          |     |
|  | 14:32:20  ### 先例引擎    | "境界突破"先例激活           |     |
|  |           势能: 0.3 -> 0.95 (+0.65)                      |     |
|  |           增殖: 2个子先例                                 |     |
|  |           [查看势能曲线]                                  |     |
|  |                                                          |     |
|  | 14:33:01  ### 工作室引擎  生成第150章v1                   |     |
|  |           直觉分: 72  质量分: 68/100                      |     |
|  |           [查看生成日志] [查看版本对比]                     |     |
|  |                                                          |     |
|  | 14:45:22  ### 谏官系统    ! 1个WARNING                    |     |
|  |           C02: 人设一致性 - 行为微调建议                   |     |
|  |           [查看谏官报告]                                    |     |
|  +-----------------------------------------------------------+     |
|                                                                   |
|  +- 第151章 ------------------------------------------------+     |
|  | 09:15:00  ### 物理规则引擎 敌方宗门战力评估                |     |
|  | ...                                                       |     |
|  +-----------------------------------------------------------+     |
+------------------------------------------------------------------+

交互功能:
  - 点击事件节点 -> 展开详细面板（展示完整delta_jsonb）
  - 点击传播树 -> 展开涟漪传播的可视化图
  - 双选两个版本 -> 自动打开版本对比工具
  - 筛选栏 -> 按引擎/实体/类型/时间范围过滤
  - 搜索 -> 全文搜索delta_jsonb中的路径和值
```

---

### 13.4.2 版本对比工具

#### 文本Diff展示

采用三色标注体系：
- **绿色背景**：新增内容
- **红色背景+删除线**：删除内容
- **黄色高亮**：修改内容（鼠标悬浮显示差异说明）

支持段落级导航和变更统计面板。

#### 结构化数据Diff展示

```
delta_jsonb 对比视图
+-- 属性路径: stats.combatPower.total
|   +-- v2:  12,500
|   +-- v4:  18,700 (+6,200 / +49.6%)
|   +-- 原因: 境界突破（金丹->元婴）
|
+-- 属性路径: status.main
|   +-- v2: "active"
|   +-- v4: "injured"
|   +-- 原因: 战斗负伤
|
+-- 新增路径: realm.current.stageId
    +-- v2: null (不存在)
    +-- v4: "nascent_soul"
```

---

### 13.4.3 可能性清单历史

```
可能性清单历史面板
+-- 批次列表（左侧）
|   +-- 第150章 - 生成v1 - 5条可能性 - 2025-05-01 14:32
|   +-- 第150章 - 修改v2 - 3条可能性 - 2025-05-01 15:45
|
+-- 选中批次的详情（中央）
|   +-- 可能性列表（含被过滤的）
|   |   +-- #1 [最终入选] 林云独闯魔宗 (评分:0.92)
|   |   +-- #2 [最终入选] 暗中布局反间计 (评分:0.88)
|   |   +-- #3 [最终入选] 寻找盟友联合对抗 (评分:0.85)
|   |   +-- #4 [被过滤] 直接投降求和 (评分:0.15)
|   |   |   +-- 过滤原因: LOW_NARRATIVE_MERIT（叙事价值过低）
|   |   |   +-- 过滤阶段: csp_pruning
|   |   +-- #5 [被过滤] 意外获得上古传承 (评分:0.45)
|   |       +-- 过滤原因: PROHIBITED_BY_AUTHOR_RULE（违反作者设定）
|   |       +-- 过滤阶段: rule_elimination
|   |
|   +-- 选择记录
|       +-- 作者选择: #1 林云独闯魔宗
|       +-- 选择时间: 2025-05-01 14:35:22
|       +-- 选择耗时: 203秒（作者决策用时）
```

---

### 13.4.4 谏官档案

```
谏官档案面板
+-- 统计概览
|   +-- 总检查次数: 1,250
|   +-- 通过: 1,080 (86.4%)
|   +-- INFO: 120 (9.6%)
|   +-- WARNING: 42 (3.4%)
|   +-- CRITICAL: 8 (0.6%)
|   +-- 平均处理时间: 1.2s
|
+-- 风险趋势图（时间序列）
|   +-- 最近50章的WARNING/CRITICAL出现频率
|
+-- 检查项分布
|   +-- C01 战力体系: 通过率 94%
|   +-- C02 人设一致: 通过率 89%
|   +-- C03 伏笔追踪: 通过率 91%
|   +-- ...（20+项完整列表）
|
+-- 历史报告检索
    +-- 按章节搜索
    +-- 按严重度筛选
    +-- 按检查项筛选
    +-- 全文搜索建议文本
```

---

### 13.4.5 检索质量趋势

```
检索质量趋势面板
+-- 指标时间序列
|   +-- 平均相似度分数（最近50章）
|   +-- Top-1相关性趋势
|   +-- 结果多样性评分
|   +-- 覆盖盲区出现频率
|
+-- 当前章节的检索诊断
|   +-- 检索实体数量: 12
|   +-- 平均相似度: 0.78
|   +-- 最低相似度: 0.52 (警告 低于0.6阈值)
|   +-- 覆盖盲区: ["林云早期功法细节"]
|   +-- 优化建议:
|       +-- 建议增加top_k从10到15以改善覆盖
|
+-- 检索优化建议历史
    +-- 系统提出的优化建议及采纳状态
```

---

## 13.5 技术实现方案

### 13.5.1 日志采集：结构化JSON日志

所有引擎通过统一的 `emit_log()` 接口输出结构化日志：

```typescript
// 日志级别定义
enum LogLevel {
  TRACE = "TRACE",      // 最详细的调试信息（开发模式）
  DEBUG = "DEBUG",      // 调试信息（开发/测试模式）
  INFO = "INFO",        // 常规操作记录（生产模式默认）
  NOTICE = "NOTICE",    // 重要但非异常的事件
  WARNING = "WARNING",  // 潜在问题（如Token预算逼近阈值）
  ERROR = "ERROR",      // 错误但系统可继续运行
  CRITICAL = "CRITICAL",// 严重错误需立即关注
  ALERT = "ALERT",      // 需人工介入的异常
}

// 日志结构
interface NarrativeOSLog {
  // 标准字段（RFC 5424兼容）
  timestamp: string;        // ISO 8601 + 时区
  level: LogLevel;
  hostname: string;
  appName: string;          // "narrativeos_v3"
  processId: number;
  
  // 业务字段
  engine: string;           // 引擎名
  subEngine?: string;       // 子引擎名
  operation: string;        // 操作名
  traceId: string;          // 追踪ID
  spanId: string;           // Span ID
  
  // 消息
  message: string;
  
  // 结构化数据
  data: Record<string, unknown>;
  
  // 上下文
  context: {
    projectId?: string;
    chapterId?: string;
    chapterNumber?: number;
    mouState?: string;
  };
}
```

**日志输出格式**：JSON Lines（每行一条JSON），文件轮转策略按天切割，单文件上限256MB。

### 13.5.2 指标采集：Prometheus指标定义

```python
# ============================================================
# Prometheus指标定义（Python客户端示例）
# ============================================================

from prometheus_client import Counter, Histogram, Gauge, Summary

# --- 系统级指标 ---

# LLM调用计数器（按调用点、模型、状态标记）
llm_calls_total = Counter(
    'nos_llm_calls_total',
    'Total LLM calls',
    ['call_point', 'model', 'status', 'tier']
)

# LLM Token消耗
llm_tokens_consumed = Counter(
    'nos_llm_tokens_consumed_total',
    'Total tokens consumed',
    ['call_point', 'model', 'token_type']  # token_type: input/output
)

# LLM调用延迟分布
llm_call_latency = Histogram(
    'nos_llm_call_latency_seconds',
    'LLM call latency',
    ['call_point', 'model'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
)

# LLM成本估算
llm_estimated_cost = Counter(
    'nos_llm_estimated_cost_cny',
    'Estimated LLM cost in CNY',
    ['call_point', 'model']
)

# --- 业务级指标 ---

# 章节生成时间
chapter_generation_duration = Histogram(
    'nos_chapter_generation_duration_seconds',
    'Chapter generation time',
    ['chapter_number', 'generation_type'],  # generation_type: initial/modify/polish
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0]
)

# 直觉分分布
intuition_score = Gauge(
    'nos_intuition_score',
    'Chapter intuition score',
    ['chapter_id', 'chapter_number', 'version']
)

# 谏官检查结果
remonstrator_checks_total = Counter(
    'nos_remonstrator_checks_total',
    'Total remonstrator checks',
    ['check_id', 'severity', 'result']  # result: pass/fail
)

# MOU状态停留时间
mou_state_duration = Histogram(
    'nos_mou_state_duration_seconds',
    'Time spent in each MOU state',
    ['state_name', 'outcome'],  # outcome: approved/revised/timeout
    buckets=[1.0, 10.0, 60.0, 300.0, 600.0, 1800.0, 3600.0]
)

# --- 数据库级指标 ---

db_query_latency = Histogram(
    'nos_db_query_latency_seconds',
    'Database query latency',
    ['table', 'operation'],  # operation: select/insert/update/delete
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]
)

db_connections_active = Gauge(
    'nos_db_connections_active',
    'Active database connections',
    ['pool_name']
)
```

### 13.5.3 追踪实现：OpenTelemetry集成

```typescript
// ============================================================
// OpenTelemetry Span 定义
// ============================================================

// 根Span：MOU循环
const mouLoopSpan = tracer.startSpan("mou.loop", {
  attributes: {
    "mou.chapter_id": chapterId,
    "mou.chapter_number": chapterNumber,
    "mou.loop_count": loopCount,
    "mou.current_phase": currentPhase,
  },
});

// 子Span：可能性生成
tracer.startSpan("world_engine.generate_possibilities", {
  parent: mouLoopSpan,
  attributes: {
    "engine.name": "world_engine",
    "engine.sub": "possibility_generator",
    "possibility.count": 5,
    "possibility.llm_calls": 3,
  },
});

// 子Span：LLM调用
tracer.startSpan("llm.invoke", {
  attributes: {
    "llm.provider": "deepseek",
    "llm.model": "deepseek-chat-v4-pro",
    "llm.tier": "heavy",
    "llm.tokens.input": 8200,
    "llm.tokens.output": 1200,
    "llm.cost_cny": 0.032,
    "llm.latency_ms": 4500,
  },
});

// 事件：作者决策
tracer.addEvent("author.decision", {
  "decision.type": "CHOOSE",
  "decision.target": "possibility_3",
  "decision.time_ms": 15000,
});

// 关键Span类型清单：
// - mou.loop              MOU完整循环
// - mou.state_transition  状态转换
// - world_engine.*        世界引擎各子操作
// - studio_engine.*       工作室引擎操作
// - remonstrator.check    谏官检查项
// - llm.invoke            LLM调用
// - db.query              数据库查询
// - cache.operation       缓存操作
```

### 13.5.4 存储方案

| 数据类型 | 存储方案 | 保留策略 | 容量估算 |
|----------|---------|---------|---------|
| 结构化日志 | PostgreSQL JSONB + 文件归档 | 热存储30天，冷存储1年 | ~50GB/百万章 |
| 时序指标 | Prometheus本地TSDB | 原始精度15天，降采样后90天 | ~10GB/项目 |
| 调用链追踪 | Jaeger + Elasticsearch | 7天热存储，采样归档30天 | ~20GB/百万章 |
| 版本全文 | PostgreSQL TEXT + 外部存储 | 永久保留 | ~500MB/百万字 |
| delta_jsonb | PostgreSQL JSONB | 永久保留 | ~1GB/百万事件 |

### 13.5.5 展示方案

**Grafana面板配置**：

```yaml
# grafana-dashboards/narrativeos-observability.yml
dashboards:
  - title: "NarrativeOS - 系统概览"
    panels:
      - title: "LLM调用速率"
        type: graph
        query: 'rate(nos_llm_calls_total[5m])'
        
      - title: "LLM调用延迟P99"
        type: stat
        query: 'histogram_quantile(0.99, nos_llm_call_latency_seconds_bucket)'
        
      - title: "Token消耗趋势"
        type: graph
        query: 'rate(nos_llm_tokens_consumed_total[1h])'
        
      - title: "谏官风险分布"
        type: pie
        query: 'sum by (severity) (nos_remonstrator_checks_total)'
        
      - title: "MOU状态停留时间"
        type: heatmap
        query: 'nos_mou_state_duration_seconds_bucket'
        
      - title: "直觉分趋势"
        type: graph
        query: 'nos_intuition_score'
```

---

## 13.6 告警系统

### 13.6.1 告警规则定义

| 规则ID | 规则名称 | 表达式 | 阈值 | 级别 | 触发条件 |
|--------|---------|--------|------|------|---------|
| A01 | LLM调用延迟高 | P99 > 30s | 30秒 | WARNING | 连续3次采样 |
| A02 | LLM调用延迟极高 | P99 > 60s | 60秒 | CRITICAL | 连续2次采样 |
| A03 | LLM错误率上升 | 错误率 > 5% | 5% | WARNING | 5分钟内 |
| A04 | LLM成本超标 | 单章成本 > V0.5 | V0.5 | WARNING | 单次 |
| A05 | Token预算耗尽 | 剩余 < 10% | 10% | CRITICAL | 单次 |
| A06 | 谏官CRITICAL频发 | 连续3章出现 | 3章 | WARNING | 滑动窗口 |
| A07 | 直觉分持续下降 | 连续5章下降 | 5章趋势 | WARNING | 趋势检测 |
| A08 | 数据库连接池耗尽 | 活跃连接 > 80% | 80% | CRITICAL | 连续2次 |
| A09 | MOU状态超时 | 等待状态 > 1小时 | 1小时 | INFO | 单次（作者提醒） |
| A10 | 涟漪传播异常 | 传播时间 > 10s | 10秒 | WARNING | 单次 |

### 13.6.2 告警级别

```typescript
enum AlertSeverity {
  INFO = "INFO",          // 信息性通知，无需行动
  WARNING = "WARNING",    // 潜在问题，建议关注
  CRITICAL = "CRITICAL",  // 严重问题，需立即处理
}

interface Alert {
  alertId: string;
  ruleId: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  
  // 触发上下文
  context: {
    projectId: string;
    chapterId?: string;
    chapterNumber?: number;
    mouState?: string;
    traceId?: string;
  };
  
  // 触发时的指标值
  triggeredValue: number;
  threshold: number;
  
  // 时间
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  
  // 通知
  notifiedChannels: string[];
  
  // 处理
  status: "active" | "acknowledged" | "resolved" | "suppressed";
  acknowledgedBy?: string;
}
```

### 13.6.3 告警通知渠道

| 渠道 | 适用级别 | 延迟 | 用途 |
|------|---------|------|------|
| 审计面板通知中心 | 全部 | 实时 | 所有告警的统一入口 |
| WebSocket推送 | WARNING+ | <1s | 前端实时通知 |
| 邮件 | CRITICAL | <5min | 严重问题需离线知晓 |
| 企业微信/钉钉 | CRITICAL | <1min | 紧急响应 |

### 13.6.4 告警抑制和聚合

```typescript
// 告警抑制规则
interface SuppressionRule {
  ruleId: string;
  
  // 抑制条件
  conditions: {
    alertRuleIds?: string[];   // 匹配的告警规则
    timeWindow?: number;        // 时间窗口（秒）
    maxCount?: number;          // 窗口内最大触发次数
    suppressionDuration: number;// 抑制持续时间（秒）
  };
  
  // 示例：A02触发后抑制A01 15分钟
  // 示例：连续3次A06触发后升级为单次汇总告警
}

// 告警聚合规则
interface AggregationRule {
  ruleId: string;
  groupBy: string[];          // 按哪些维度聚合，如["severity", "engine"]
  timeWindow: number;         // 聚合窗口（秒）
  maxAlerts: number;          // 单个窗口内最多独立告警数
  summaryTemplate: string;    // 汇总模板
}
```

---

## 13.7 性能指标清单

### 13.7.1 系统层面

| 指标名称 | 类型 | 采集频率 | 正常范围 | 告警阈值 |
|---------|------|---------|---------|---------|
| CPU使用率 | Gauge | 10s | < 60% | 80% |
| 内存使用率 | Gauge | 10s | < 70% | 85% |
| 数据库连接池活跃数 | Gauge | 10s | < 50% | 80% |
| 数据库查询P99延迟 | Histogram | 每查询 | < 50ms | 200ms |
| 磁盘I/O利用率 | Gauge | 30s | < 60% | 80% |
| 网络出站带宽 | Gauge | 30s | < 10Mbps | 50Mbps |
| 缓存命中率 | Gauge | 60s | > 80% | 60% |

### 13.7.2 业务层面

| 指标名称 | 类型 | 采集时机 | 正常范围 | 告警阈值 |
|---------|------|---------|---------|---------|
| 单章LLM调用次数 | Counter | 每章 | 20-30次 | > 50次 |
| 单章Token消耗总量 | Counter | 每章 | 50K-100K | > 200K |
| 单章生成总时间 | Histogram | 每章 | < 5分钟 | > 15分钟 |
| 单章成本（CNY） | Counter | 每章 | V0.08-0.15 | > V0.50 |
| LLM调用P99延迟 | Histogram | 每次 | < 10s | > 30s |
| LLM错误率 | Gauge | 每分钟 | < 1% | > 5% |
| 模型降级频率 | Counter | 每次 | < 5%/天 | > 20%/天 |
| MOU循环次数/章 | Counter | 每章 | 2-5次 | > 10次 |
| 作者决策平均用时 | Histogram | 每次 | 30s-5min | > 30min |

### 13.7.3 质量层面

| 指标名称 | 类型 | 采集时机 | 正常范围 | 关注点 |
|---------|------|---------|---------|--------|
| 直觉分分布 | Histogram | 每版本 | 70-100 | < 60需关注 |
| 质量评分分布 | Histogram | 每版本 | 65-100 | < 55需关注 |
| 谏官通过率 | Gauge | 每章 | > 85% | < 70%需优化 |
| CRITICAL问题数 | Counter | 每章 | 0 | > 0需处理 |
| 伏笔回收率 | Gauge | 每章 | > 70% | < 50%需关注 |
| 人设一致性得分 | Gauge | 每章 | > 85 | < 70需关注 |
| 战力体系一致性 | Gauge | 每章 | > 90 | < 80需关注 |
| 检索平均相似度 | Gauge | 每次 | > 0.70 | < 0.55需优化 |
| 上下文覆盖率 | Gauge | 每次 | > 80% | < 60%需优化 |

---

## 13.8 数据保留与归档策略

| 数据类型 | 热存储 | 温存储 | 冷存储 | 销毁 |
|----------|--------|--------|--------|------|
| delta_jsonb | 90天（PG活跃分区） | 1年（压缩分区） | 永久（对象存储） | 永不 |
| chapter_versions | 90天 | 1年 | 永久 | 永不 |
| LLM调用日志 | 30天 | 90天 | 1年 | 3年后 |
| 调用链追踪 | 7天 | 30天（采样） | 1年（采样） | 2年后 |
| 系统指标 | 15天（原始精度） | 90天（降采样） | 1年（降采样） | 2年后 |
| 审计面板访问日志 | 30天 | 90天 | - | 1年后 |

---

## 13.9 隐私与权限

| 角色 | 可见范围 | 操作权限 |
|------|---------|---------|
| **作者（作品所有者）** | 全部数据 | 查看、导出、回溯版本、覆盖谏官建议 |
| **协作者** | 时间线、版本对比、质量报告 | 查看、添加注释 |
| **系统管理员** | 系统指标、错误日志 | 查看、配置告警阈值 |
| **匿名审计** | 聚合统计（无个人数据） | 仅查看 |

---

> **文档结束**  
> 本章为 NarrativeOS v3.0 Sovereign 可观测性体系的完整设计规格，涵盖世界引擎与工作室引擎的变更追踪、决策可解释性、审计面板、技术实现方案、告警系统与性能指标体系。所有接口定义和存储策略均与第四章（数据层）、第五章（世界引擎）、第八章（MOU）、第九章（质量系统）保持一致。
