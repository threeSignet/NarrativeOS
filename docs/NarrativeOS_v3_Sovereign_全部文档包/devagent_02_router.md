> [!WARNING] **[DEPRECATED] 本文档已废弃 — 2026-05-20**
> 原 P9 DevAgent 集群（5 层架构）不再另建代码实现。Claude Code 直接担任开发维护角色（见 `CLAUDE.md` §"自动化开发维护角色"）。
> 本文档保留为参考档案，其中的分类/路由设计理念可作为未来需要时参考，但不做实现承诺。

# NarrativeOS v3.0 Sovereign — DevAgent Cluster 第二层：分类与路由系统

## Classification Router Layer (CRL) Design Document

**版本**: v3.0.0  
**日期**: 2025-07-24  
**负责**: DevAgent Cluster — Router Subsystem  
**状态**: [DEPRECATED] Design Spec (参考档案，不实现)

---

## Table of Contents

1. [系统架构总览](#1-system-architecture-overview)
2. [严重性评估器 (SeverityAssessor)](#2-severityassessor)
3. [智能路由器 (SmartRouter)](#3-smartrouter)
4. [依赖分析器 (DependencyAnalyzer)](#4-dependencyanalyzer)
5. [影响域评估器 (ImpactAnalyzer)](#5-impactanalyzer)
6. [工单管理系统 (TicketManager)](#6-ticketmanager)
7. [路由决策引擎 (RoutingDecisionEngine)](#7-routingdecisionengine)
8. [TypeScript 接口定义](#8-typescript-interfaces)
9. [工单 JSON Schema](#9-ticket-json-schema)
10. [核心算法伪代码](#10-core-algorithms)
11. [工单状态机定义](#11-ticket-state-machine)
12. [数据流与交互图](#12-dataflow)
13. [配置参考](#13-configuration)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NarrativeOS v3.0 — DevAgent Cluster                       │
│                       Classification Router Layer                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│   │  Telemetry      │    │  Telemetry      │    │  Telemetry      │        │
│   │  Layer — 异常    │    │  Layer — 性能    │    │  Layer — 需求    │        │
│   │   Reports       │    │   Reports       │    │   Reports       │        │
│   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘        │
│            │                      │                      │                  │
│            └──────────────────────┼──────────────────────┘                  │
│                                   ▼                                          │
│            ┌─────────────────────────────────────┐                          │
│            │   1. Ingestion & Normalization      │                          │
│            │      (统一数据格式转换)               │                          │
│            └─────────────────┬───────────────────┘                          │
│                              ▼                                               │
│   ╔═══════════════════════════════════════════════════════════════╗         │
│   ║   2. SEVERITY ASSESSOR (SeverityAssessor)                    ║         │
│   ║   — 四维加权严重评估 → P0~P4 定级                            ║         │
│   ║   — 重复问题升级 + 心流熵调节                                ║         │
│   ╚═══════════════════════════════════════════════════════════════╝         │
│                              │                                               │
│                              ▼                                               │
│   ╔═══════════════════════════════════════════════════════════════╗         │
│   ║   3. DEPENDENCY ANALYZER (DependencyAnalyzer)                ║         │
│   ║   — 模块依赖图谱构建                                          ║         │
│   ║   — 影响域传播计算                                            ║         │
│   ║   — 最小变更集计算                                            ║         │
│   ╚═══════════════════════════════════════════════════════════════╝         │
│                              │                                               │
│                              ▼                                               │
│   ╔═══════════════════════════════════════════════════════════════╗         │
│   ║   4. IMPACT ANALYZER (ImpactAnalyzer)                        ║         │
│   ║   — 四类影响域评估                                            ║         │
│   ║   — 回归风险评分                                              ║         │
│   ║   — 人工审批决策                                              ║         │
│   ╚═══════════════════════════════════════════════════════════════╝         │
│                              │                                               │
│                              ▼                                               │
│   ╔═══════════════════════════════════════════════════════════════╗         │
│   ║   5. SMART ROUTER (SmartRouter)                              ║         │
│   ║   — 路由决策矩阵 (20+ 规则)                                   ║         │
│   ║   — 冲突解决 + 历史学习 + 批量聚合                            ║         │
│   ╚═══════════════════════════════════════════════════════════════╝         │
│                              │                                               │
│                              ▼                                               │
│   ╔═══════════════════════════════════════════════════════════════╗         │
│   ║   6. TICKET MANAGER (TicketManager)                          ║         │
│   ║   — 工单生命周期管理                                          ║         │
│   ║   — 动态优先级 + 合并拆分                                     ║         │
│   ╚═══════════════════════════════════════════════════════════════╝         │
│                              │                                               │
│                              ▼                                               │
│   ╔═══════════════════════════════════════════════════════════════╗         │
│   ║   7. ROUTING DECISION ENGINE                                 ║         │
│   ║   — 规则优先 → LLM补充 → 历史校正                           ║         │
│   ║   — 置信度评分 + 降级策略                                    ║         │
│   ╚═══════════════════════════════════════════════════════════════╝         │
│                              │                                               │
│                              ▼                                               │
│   ┌──────────┬──────────┬──────────┬──────────┬──────────┬─────────┐       │
│   │ Fix      │ Optimize │ Feature  │ Refactor │ Security │ Test    │       │
│   │ Agent    │ Agent    │ Agent    │ Agent    │ Agent    │ Agent   │       │
│   └──────────┴──────────┴──────────┴──────────┴──────────┴─────────┘       │
│   ┌──────────┬──────────┬──────────┬─────────────────────────────────┐     │
│   │ Doc      │ Deploy   │ Review   │ Human Review Queue              │     │
│   │ Agent    │ Agent    │ Agent    │ (降级/叙事审批)                  │     │
│   └──────────┴──────────┴──────────┴─────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 数据流

```
Telemetry Ingestion → Normalize → SeverityAssessor → DependencyAnalyzer
                                                          ↓
                                         ImpactAnalyzer → SmartRouter
                                                          ↓
                                              TicketManager → RoutingEngine
                                                                  ↓
                                                        Target Agent(s)
```

---

## 2. SeverityAssessor

### 2.1 四维严重评估模型

每个问题在四个独立维度上被评分 (0.0 ~ 1.0)，然后加权综合为单一严重性分数。

#### 维度 D1: 影响面 (Impact Scope)

| 分值 | 级别 | 描述 | 示例 |
|------|------|------|------|
| 0.90~1.00 | 作者创作受阻 | 作者无法继续创作，完全阻塞 | LLM完全无响应；数据库连接中断；自动保存失败 |
| 0.60~0.89 | 功能降级 | 核心功能可用但严重受限 | 生成速度下降80%；大纲解析错误 |
| 0.30~0.59 | 性能下降 | 系统可用但体验受损 | 响应延迟>5s；内存泄漏缓慢增长 |
| 0.00~0.29 | 纯信息 | 不影响正常运行，仅记录 | 监控指标；日志警告；统计信息 |

**子因子**:
- `affectedUsers`: 影响作者数 (1=单作者, 0.8=部分, 0.5=全部)
- `affectedFeature`: 影响功能等级 (1=核心创作, 0.7=辅助, 0.3=管理)
- `dataIntegrity`: 数据完整性风险 (1=数据丢失, 0.5=脏数据, 0=无影响)

```
D1 = 0.5 * scopeLevel + 0.3 * affectedUsers + 0.2 * dataIntegrity
```

#### 维度 D2: 紧急度 (Urgency)

| 分值 | 级别 | 描述 | 示例 |
|------|------|------|------|
| 0.90~1.00 | 立即崩溃 | 系统已崩溃或即将崩溃 | OOM; 死锁; 无限循环; 磁盘满 |
| 0.60~0.89 | 逐步恶化 | 问题会随时间恶化 | 内存泄漏; 连接池耗尽; 缓存雪崩 |
| 0.30~0.59 | 可延后 | 不影响当下，但需处理 | 性能瓶颈; 代码异味; 测试缺失 |
| 0.00~0.29 | 可选优化 | 锦上添花类 | UI微调; 新功能构想; 文档美化 |

**子因子**:
- `timeToFailure`: 距完全失效时间 (越短越高)
- `growthRate`: 恶化速度 (指数>线性>稳定)
- `workaroundAvailable`: 是否有临时规避 (无=1.0, 有=0.3)

```
D2 = 0.4 * urgencyLevel + 0.35 * (1 - normalizedTimeToFailure) + 0.25 * (1 - workaroundScore)
```

#### 维度 D3: 可恢复性 (Recoverability)

| 分值 | 级别 | 描述 | 示例 |
|------|------|------|------|
| 0.00~0.20 | 自动恢复 | 系统自动恢复，无需干预 | 网络瞬断; 连接重试成功 |
| 0.21~0.50 | 需重启 | 需要重启服务/进程 | 内存碎片; 句柄泄漏 |
| 0.51~0.80 | 需修复 | 需要代码修复+部署 | Bug修复; 配置错误 |
| 0.81~1.00 | 不可逆 | 可能造成数据永久丢失 | 数据库损坏; 覆盖写入 |

**子因子**:
- `autoRecoveryTime`: 自动恢复所需时间 (>5min=不可逆风险)
- `dataBackupAvailable`: 是否有可恢复的数据备份
- `rollbackCapability`: 是否可回滚到之前版本

```
D3 = 0.5 * recoveryLevel + 0.3 * (1 - backupScore) + 0.2 * (1 - rollbackScore)
```

#### 维度 D4: 关联度 (Connectivity)

| 分值 | 级别 | 描述 | 示例 |
|------|------|------|------|
| 0.00~0.25 | 孤立问题 | 仅影响单一模块 | 某组件内部日志格式错误 |
| 0.26~0.55 | 局部影响 | 影响相邻2-3个模块 | API格式变更影响调用方 |
| 0.56~0.80 | 跨层影响 | 跨越架构层次 | 数据库变更影响多个服务层 |
| 0.81~1.00 | 系统性风险 | 可能级联影响整个系统 | 核心状态机变更; LLM API策略变更 |

**子因子**:
- `dependencyDepth`: 依赖链深度 (影响越多模块越高)
- `cascadeProbability`: 级联故障概率 (基于历史数据)
- `blastRadius`: 爆炸半径 (受影响模块数 / 总模块数)

```
D4 = 0.4 * connectivityLevel + 0.35 * cascadeProbability + 0.25 * blastRadius
```

### 2.2 综合严重性计算公式

#### 基础加权公式

```
SeverityScore = w1 * D1 + w2 * D2 + w3 * D3 + w4 * D4

其中权重 (可配置):
  w1 = 0.30  (影响面 — 最重要，直接关系到作者体验)
  w2 = 0.30  (紧急度 — 时间敏感性)
  w3 = 0.20  (可恢复性 — 修复难度)
  w4 = 0.20  (关联度 — 系统稳定性风险)

约束: w1 + w2 + w3 + w4 = 1.0
```

#### P 级映射

```
SeverityScore → Priority Level:

  [0.850, 1.000]  → P0 (紧急/Critical)   — 立即处理，中断当前所有工作
  [0.600, 0.849]  → P1 (高/High)          — 2小时内处理
  [0.350, 0.599]  → P2 (中/Medium)        — 24小时内处理
  [0.150, 0.349]  → P3 (低/Low)           — 7天内处理
  [0.000, 0.149]  → P4 (建议/Suggestion)  — 排期处理，可选
```

#### 动态调整机制

##### A. 重复问题自动升级

```
recurrenceCount = 同一signature问题在过去N天内的出现次数

if recurrenceCount >= 5:
    escalationBonus = +0.25  (直接升一级)
elif recurrenceCount >= 3:
    escalationBonus = +0.15
elif recurrenceCount >= 2:
    escalationBonus = +0.08

adjustedSeverity = min(1.0, baseSeverity + escalationBonus)

// 重复问题判定规则
sameSignature = (module + errorCode + rootCauseCategory + similarStackTrace)
// 使用 stack trace 模糊匹配 (忽略行号，只匹配调用链模式)
```

##### B. 作者心流熵调节 (Flow Guardian Integration)

```
// Flow Guardian 持续监控作者心流状态
// flowEntropy ∈ [0, 1], 0=完全沉浸, 1=严重分心

flowEntropy = FlowGuardian.getCurrentEntropy(authorId)

// 心流熵作为影响面的放大因子
if flowEntropy > FLOW_CRITICAL_THRESHOLD (0.7):
    // 作者已在心流中断边缘，任何问题都更严重
    flowMultiplier = 1.0 + 0.3 * (flowEntropy - 0.7) / 0.3
    D1_adjusted = min(1.0, D1 * flowMultiplier)
    
    // 当熵值极高时，P3及以下问题自动升一级
    if flowEntropy > 0.85 and adjustedSeverity < 0.6:
        adjustedSeverity = min(0.6, adjustedSeverity + 0.1)
        priorityBumpReason = "HIGH_FLOW_ENTROPY_ESCALATION"
```

##### C. 时间衰减因子

```
// 某些问题在特定时间更严重
hourOfDay = currentHour()  // 0-23

// 作者在创作高峰时段 (20:00-02:00)，问题权重提升
if hourOfDay in [20, 21, 22, 23, 0, 1, 2]:
    timeMultiplier = 1.15
elif hourOfDay in [9, 10, 11, 14, 15, 16]:  // 白天工作时段
    timeMultiplier = 1.0
else:  // 低活跃时段
    timeMultiplier = 0.9

D1_adjusted = min(1.0, D1 * timeMultiplier)
```

### 2.3 SeverityAssessor 状态机

```
┌──────────┐    ingest     ┌──────────────┐    calculate    ┌──────────────┐
│  IDLE    │ ─────────────→│  ANALYZING   │ ──────────────→│  SCORED      │
│          │               │              │                │              │
└──────────┘               └──────────────┘                └──────┬───────┘
     ▲                                                             │
     │                    ┌──────────────┐                         │ escalate
     └────────────────────│  ESCALATED   │←────────────────────────┘
                          └──────────────┘
```

### 2.4 核心算法伪代码

```
function assessSeverity(report, context):
    // 1. 提取四维原始评分
    D1_raw = assessImpactScope(report.impactIndicators)
    D2_raw = assessUrgency(report.urgencyIndicators, context.systemState)
    D3_raw = assessRecoverability(report.errorType, context.backupStatus)
    D4_raw = assessConnectivity(report.module, context.dependencyGraph)
    
    // 2. 子因子精细化
    D1 = refineD1(D1_raw, report.affectedUsers, report.dataIntegrityRisk)
    D2 = refineD2(D2_raw, report.workaroundAvailable, report.growthRate)
    D3 = refineD3(D3_raw, context.backupAvailable, context.rollbackCapability)
    D4 = refineD4(D4_raw, context.dependencyGraph, report.module)
    
    // 3. 基础加权
    weights = config.severityWeights  // [0.3, 0.3, 0.2, 0.2]
    baseScore = weights[0]*D1 + weights[1]*D2 + weights[2]*D3 + weights[3]*D4
    
    // 4. 动态调整
    recurrenceCount = getRecurrenceCount(report.signature, days=7)
    escalationBonus = getEscalationBonus(recurrenceCount)
    
    flowEntropy = FlowGuardian.getEntropy(context.authorId)
    flowAdjustment = getFlowAdjustment(flowEntropy, D1)
    
    timeMultiplier = getTimeOfDayMultiplier(context.currentHour)
    
    // 5. 综合计算
    adjustedScore = min(1.0, baseScore + escalationBonus + flowAdjustment)
    adjustedScore = min(1.0, adjustedScore * timeMultiplier)
    
    // 6. 定级
    priority = mapScoreToPriority(adjustedScore)  // P0-P4
    
    return SeverityAssessment {
        priority: P0..P4,
        score: adjustedScore,
        dimensions: { D1, D2, D3, D4 },
        adjustments: {
            escalationBonus,
            flowAdjustment,
            timeMultiplier,
            recurrenceCount
        },
        reasoning: generateReasoning(D1, D2, D3, D4, adjustments)
    }
```

---

## 3. SmartRouter

### 3.1 路由决策矩阵（完整版 — 20+ 规则）

路由规则表结构说明:
- **规则ID**: 唯一标识
- **问题类型**: 触发路由的问题分类
- **目标Agent**: 分配的处理智能体
- **触发条件**: 精确触发条件（含阈值）
- **优先级**: 规则匹配优先级（数字越小越优先）
- **置信度**: 规则的确定性评分
- **批量聚合**: 是否支持批量处理
- **需审批**: 是否需要人类审批

#### 3.1.1 异常类路由规则 (Rules A01-A08)

| 规则ID | 问题类型 | 目标Agent | 触发条件 | 优先级 | 置信度 | 批量聚合 | 需审批 |
|--------|---------|----------|---------|--------|--------|---------|--------|
| A01 | LLM API调用完全失败 | FixAgent | 失败率 > 5% 持续 10 分钟 | 1 | 0.95 | 是(按错误码) | 否 |
| A02 | LLM API调用超时 | OptimizeAgent | 超时率 > 10% 持续 15 分钟 | 3 | 0.90 | 是(按超时类型) | 否 |
| A03 | LLM输出质量下降 | OptimizeAgent | 质量评分连续 5 章 < 阈值 (0.65) | 2 | 0.85 | 否 | 否 |
| A04 | LLM输出格式异常 | FixAgent | JSON解析失败率 > 3% | 2 | 0.92 | 是 | 否 |
| A05 | 数据库连接异常 | FixAgent | 连接失败/超时/断开 | 1 | 0.95 | 是(按DB实例) | 否 |
| A06 | 数据库查询缓慢 | OptimizeAgent | P95延迟 > 500ms 持续 20 分钟 | 3 | 0.88 | 是(按查询模式) | 否 |
| A07 | pgvector向量搜索异常 | FixAgent | 向量检索返回错误/空结果异常 | 2 | 0.90 | 否 | 否 |
| A08 | 状态机死锁/超时 | FixAgent | XState状态机进入死锁或转换超时 > 30s | 1 | 0.95 | 否 | 是 |

#### 3.1.2 引擎类路由规则 (Rules B01-B06)

| 规则ID | 问题类型 | 目标Agent | 触发条件 | 优先级 | 置信度 | 批量聚合 | 需审批 |
|--------|---------|----------|---------|--------|--------|---------|--------|
| B01 | 世界引擎子引擎异常 | FixAgent | 8个子引擎中任一个报错/超时 | 2 | 0.90 | 是(按子引擎) | 是(若影响叙事一致性) |
| B02 | 工作室引擎子系统异常 | FixAgent | 8个子系统中任一个报错 | 2 | 0.90 | 是(按子系统) | 是 |
| B03 | 谏官系统异常 | FixAgent | 谏官决策循环异常/输出不可用 | 1 | 0.93 | 否 | 是 |
| B04 | 引擎间数据不一致 | FixAgent | 世界引擎与工作室引擎数据校验失败 | 1 | 0.95 | 否 | 是 |
| B05 | 引擎性能下降 | OptimizeAgent | 引擎处理时间 > P95基线 50% 持续 30 分钟 | 4 | 0.82 | 是(按引擎) | 否 |
| B06 | 引擎内存泄漏 | FixAgent | 引擎进程RSS内存持续增长 > 20%/小时 | 2 | 0.88 | 是(按引擎) | 否 |

#### 3.1.3 交互类路由规则 (Rules C01-C06)

| 规则ID | 问题类型 | 目标Agent | 触发条件 | 优先级 | 置信度 | 批量聚合 | 需审批 |
|--------|---------|----------|---------|--------|--------|---------|--------|
| C01 | 作者频繁RETRY | FeatureAgent | RETRY率 > 30% 连续 3 章 | 3 | 0.80 | 否 | 是 |
| C02 | 作者频繁UNDO | FeatureAgent | UNDO率 > 40% 单章 | 3 | 0.78 | 否 | 是 |
| C03 | 作者长时间停滞 | OptimizeAgent | 单节点停留 > 30 分钟无操作 | 4 | 0.70 | 否 | 是 |
| C04 | 作者主动反馈问题 | FeatureAgent | 反馈通道提交的问题/建议 | 5 | 0.85 | 否 | 是 |
| C05 | 作者跳过推荐内容 | OptimizeAgent | 跳过率 > 60% 连续 5 次推荐 | 4 | 0.75 | 否 | 否 |
| C06 | 创作路径异常偏离 | FeatureAgent | 实际路径与预测路径偏差 > 3σ | 3 | 0.72 | 否 | 是 |

#### 3.1.4 代码质量类路由规则 (Rules D01-D06)

| 规则ID | 问题类型 | 目标Agent | 触发条件 | 优先级 | 置信度 | 批量聚合 | 需审批 |
|--------|---------|----------|---------|--------|--------|---------|--------|
| D01 | 代码冗余/重复 | RefactorAgent | 重复代码 > 阈值 (相似度 > 80%, 行数 > 20) | 5 | 0.85 | 是(按模块) | 否 |
| D02 | 圈复杂度过高 | RefactorAgent | 函数圈复杂度 > 15 或文件均值 > 10 | 5 | 0.80 | 是(按文件) | 否 |
| D03 | 缺少测试覆盖 | TestAgent | 新代码覆盖率 < 80% 或核心路径未覆盖 | 4 | 0.88 | 是(按模块) | 否 |
| D04 | 测试持续失败 | FixAgent | 同一测试失败 > 3 次连续执行 | 2 | 0.90 | 是(按测试套件) | 否 |
| D05 | 类型安全违规 | FixAgent | TypeScript any 类型新增 / 类型检查失败 | 3 | 0.87 | 是 | 否 |
| D06 | 代码异味聚集 | RefactorAgent | 单一文件 Code Smell 密度 > 阈值 | 5 | 0.75 | 是(按文件) | 否 |

#### 3.1.5 安全与运维类路由规则 (Rules E01-E06)

| 规则ID | 问题类型 | 目标Agent | 触发条件 | 优先级 | 置信度 | 批量聚合 | 需审批 |
|--------|---------|----------|---------|--------|--------|---------|--------|
| E01 | 安全漏洞 | SecurityAgent | 任何安全相关问题 (CVE/注入/越权) | 1 | 0.98 | 否 | 是 |
| E02 | 敏感数据泄露风险 | SecurityAgent | 日志/API响应中出现敏感信息 | 1 | 0.97 | 否 | 是 |
| E03 | API密钥异常使用 | SecurityAgent | 异常调用模式 / 使用量突增 > 300% | 1 | 0.93 | 否 | 是 |
| E04 | 依赖包漏洞 | SecurityAgent | npm audit 发现 high/critical 漏洞 | 2 | 0.90 | 是(按包) | 是 |
| E05 | 文档与API不同步 | DocAgent | API变更后 24h 内文档未更新 | 5 | 0.80 | 是(按API) | 否 |
| E06 | 部署失败/回滚 | DeployAgent | CI/CD 管道失败或生产回滚 | 1 | 0.95 | 否 | 是 |

#### 3.1.6 需求与优化类路由规则 (Rules F01-F04)

| 规则ID | 问题类型 | 目标Agent | 触发条件 | 优先级 | 置信度 | 批量聚合 | 需审批 |
|--------|---------|----------|---------|--------|--------|---------|--------|
| F01 | 新功能需求 | FeatureAgent | 需求挖掘器提交的功能差距报告 | 4 | 0.75 | 否 | 是 |
| F02 | 摩擦点报告 | FeatureAgent | 作者操作摩擦热力图热点区域 | 4 | 0.72 | 是(按功能区域) | 是 |
| F03 | 性能优化机会 | OptimizeAgent | 性能分析器识别的瓶颈 (收益 > 20%) | 4 | 0.82 | 是(按瓶颈类型) | 否 |
| F04 | 架构债务积累 | RefactorAgent | 技术债务评分增长 > 基线 15% | 5 | 0.78 | 是 | 否 |

### 3.2 路由冲突解决

当一个问题匹配多个路由规则时，使用以下优先级算法：

#### 冲突解决层次

```
Level 1: 优先级数值 (priority字段，越小越优先)
         ↓ 如果相同
Level 2: 置信度最高 (confidence字段)
         ↓ 如果相同
Level 3: 是否需要审批 (needApproval=true 优先，更谨慎)
         ↓ 如果相同
Level 4: 规则特异性 (触发条件越具体的规则优先)
         ↓ 如果相同
Level 5: 历史成功率 (该规则在过去30天内的修复成功率)
         ↓ 如果相同
Level 6: LLM辅助裁决 (将冲突详情提交LLM进行最终判断)
```

#### 冲突解决伪代码

```
function resolveConflicts(matchedRules: RoutingRule[], context: Context): RoutingDecision {
    // Level 1: 按优先级排序
    sortedByPriority = matchedRules.sort((a, b) => a.priority - b.priority)
    bestPriority = sortedByPriority[0].priority
    candidates = sortedByPriority.filter(r => r.priority == bestPriority)
    
    if candidates.length == 1:
        return makeDecision(candidates[0])
    
    // Level 2: 置信度最高
    candidates = candidates.sort((a, b) => b.confidence - a.confidence)
    bestConfidence = candidates[0].confidence
    // 保留置信度差距 < 0.1 的所有候选
    candidates = candidates.filter(r => bestConfidence - r.confidence < 0.1)
    
    if candidates.length == 1:
        return makeDecision(candidates[0])
    
    // Level 3: 需要审批的优先
    approvalRequired = candidates.filter(r => r.needApproval)
    if approvalRequired.length > 0:
        candidates = approvalRequired
    
    if candidates.length == 1:
        return makeDecision(candidates[0])
    
    // Level 4: 特异性评分
    candidates = candidates.sort((a, b) => b.specificityScore - a.specificityScore)
    candidates = candidates.filter(r => candidates[0].specificityScore - r.specificityScore < 0.2)
    
    if candidates.length == 1:
        return makeDecision(candidates[0])
    
    // Level 5: 历史成功率
    for rule in candidates:
        rule.successRate = getHistoricalSuccessRate(rule.id, days=30)
    candidates = candidates.sort((a, b) => b.successRate - a.successRate)
    
    if candidates.length == 1 || candidates[0].successRate - candidates[1].successRate > 0.2:
        return makeDecision(candidates[0])
    
    // Level 6: LLM裁决
    llmDecision = llmArbitrate(candidates, context)
    return makeDecision(llmDecision, confidence=0.60, reason="LLM_ARBITRATION")
}
```

### 3.3 路由历史学习

```
// 每条规则维护历史统计
interface RouteHistory {
    ruleId: string;
    totalRouted: number;        // 总路由次数
    successfulFix: number;      // 成功修复次数
    failedFix: number;          // 修复失败次数
    avgFixTime: number;         // 平均修复时间(分钟)
    reoccurrenceAfterFix: number; // 修复后复发次数
    lastUpdated: Date;
}

// 权重调整算法
function adjustRouteWeight(rule: RoutingRule, history: RouteHistory): number {
    baseWeight = rule.baseConfidence
    
    // 成功率因子
    if history.totalRouted > 5:
        successRate = history.successfulFix / history.totalRouted
        successMultiplier = 0.5 + successRate  // 0.5 ~ 1.5
    else:
        successMultiplier = 1.0  // 数据不足，不调整
    
    // 复发惩罚
    if history.totalRouted > 0:
        recurrenceRate = history.reoccurrenceAfterFix / history.totalRouted
        recurrencePenalty = recurrenceRate * 0.3  // 最多扣0.3
    else:
        recurrencePenalty = 0
    
    // 时效奖励 (最近修复的权重更高)
    recencyBonus = 0
    hoursSinceLastRoute = (now - history.lastUpdated) / 3600000
    if hoursSinceLastRoute < 24:
        recencyBonus = 0.05
    
    adjustedWeight = baseWeight * successMultiplier - recurrencePenalty + recencyBonus
    return clamp(adjustedWeight, 0.1, 1.0)
}
```

### 3.4 批量问题聚合

```
// 聚合策略
interface AggregationStrategy {
    groupBy: string[];          // 聚合维度
    timeWindow: number;         // 时间窗口(毫秒)
    maxBundleSize: number;      // 最大包大小
    similarityThreshold: number; // 相似度阈值
}

// 聚合规则
const AGGREGATION_RULES: AggregationStrategy[] = [
    // API错误按错误码聚合
    { groupBy: ["errorCode", "apiEndpoint"], timeWindow: 10*60*1000, maxBundleSize: 20, similarityThreshold: 0.9 },
    // 数据库错误按查询模式聚合
    { groupBy: ["queryPattern", "dbInstance"], timeWindow: 20*60*1000, maxBundleSize: 15, similarityThreshold: 0.85 },
    // 性能问题按模块聚合
    { groupBy: ["module", "metricType"], timeWindow: 30*60*1000, maxBundleSize: 10, similarityThreshold: 0.8 },
    // 代码质量问题按文件聚合
    { groupBy: ["filePath", "smellType"], timeWindow: 60*60*1000, maxBundleSize: 50, similarityThreshold: 0.75 },
]

function aggregateIssues(issues: Issue[], rules: AggregationStrategy[]): Bundle[] {
    bundles = []
    unbundled = [...issues]
    
    for rule in rules:
        groups = groupBy(unbundled, rule.groupBy)
        for (key, group) in groups:
            if group.length >= 2:
                // 检查时间窗口
                timeSpan = max(group.map(i => i.timestamp)) - min(group.map(i => i.timestamp))
                if timeSpan <= rule.timeWindow:
                    // 检查相似度
                    if computeGroupSimilarity(group) >= rule.similarityThreshold:
                        bundle = createBundle(group.slice(0, rule.maxBundleSize))
                        bundles.push(bundle)
                        unbundled = unbundled.filter(i => !bundle.contains(i))
    
    // 剩余未聚合的作为单问题工单
    for issue in unbundled:
        bundles.push(createSingletonBundle(issue))
    
    return bundles
}

function createBundle(issues: Issue[]): Bundle {
    return {
        id: generateBundleId(),
        type: "AGGREGATED",
        title: `[聚合] ${issues[0].title} 等 ${issues.length} 个问题`,
        description: synthesizeBundleDescription(issues),
        severity: max(issues.map(i => i.severity)),  // 取最高严重性
        primaryIssue: issues[0],
        subIssues: issues.slice(1),
        count: issues.length,
        timeSpan: max(issues.map(i => i.timestamp)) - min(issues.map(i => i.timestamp)),
        routingTarget: determineBundleRouting(issues)
    }
}
```

---

## 4. DependencyAnalyzer

### 4.1 NarrativeOS 模块依赖图谱

#### 4.1.1 架构层次依赖

```
┌─────────────────────────────────────────────────────────────┐
│                      协调层 (Coordination Layer)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 谏官系统  │  │ 调度器    │  │ 网关     │  │ 负载均衡 │    │
│  │ Advisor  │  │ Scheduler│  │ Gateway  │  │ Balancer │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│       └─────────────┴──────┬──────┴─────────────┘           │
│                            ▼                                 │
├─────────────────────────────────────────────────────────────┤
│                        Agent 层 (Agent Layer)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 叙事Agent│  │ 设定Agent│  │ 角色Agent│  │ 剧情Agent│    │
│  │ Narrative│  │  Setting │  │ Character│  │  Plot    │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 文风Agent│  │ 知识Agent│  │ 审核Agent│  │ 工具Agent│    │
│  │  Style   │  │Knowledge │  │  Review  │  │  Tool    │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│       └─────────────┴──────┬──────┴─────────────┘           │
│                            ▼                                 │
├─────────────────────────────────────────────────────────────┤
│                      服务层 (Service Layer)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 世界引擎  │  │ 工作室   │  │ 状态管理 │  │ 缓存服务 │    │
│  │  World   │  │  Studio  │  │  State   │  │  Cache   │    │
│  │  Engine  │  │  Engine  │  │ Manager  │  │ Service  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ LLM服务  │  │ 文件服务 │  │ 事件总线 │  │ 搜索服务 │    │
│  │ LLM Svc  │  │  File    │  │  Event   │  │  Search  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│       └─────────────┴──────┬──────┴─────────────┘           │
│                            ▼                                 │
├─────────────────────────────────────────────────────────────┤
│                        数据层 (Data Layer)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │PostgreSQL│  │ pgvector │  │ 对象存储 │  │ 消息队列 │    │
│  │  Core DB │  │  Vector  │  │  Object  │  │  Queue   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ 时序DB   │  │ 日志存储 │  │ 配置中心 │                   │
│  │  Time    │  │  Log     │  │  Config  │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

**层次间依赖规则**:
- 上层可调用下层，下层不可调用上层
- 同层内可相互调用（需通过事件总线解耦）
- 谏官系统可跨层调用（特殊权限）

#### 4.1.2 世界引擎 8 个子引擎依赖图

```
                    ┌───────────────┐
                    │   世界引擎总控  │
                    │ World Engine  │
                    └───────┬───────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────┴────┐         ┌────┴────┐         ┌────┴────┐
   │ 时间引擎 │←───────→│ 地理引擎 │←───────→│ 势力引擎 │
   │ Timeline│         │Geography│         │  Force  │
   └────┬────┘         └────┬────┘         └────┬────┘
        │                   │                   │
        └─────────┬─────────┘                   │
                  │                             │
             ┌────┴────┐                   ┌────┴────┐
             │ 规则引擎 │←─────────────────→│ 事件引擎 │
             │  Rules  │                     │  Event  │
             └────┬────┘                     └────┬────┘
                  │                             │
        ┌─────────┘                             └─────────┐
        │                                                 │
   ┌────┴────┐         ┌─────────────┐         ┌────┴────┐
   │ 因果引擎 │←───────→│  叙事引擎   │←───────→│ 记忆引擎 │
   │Causality│         │ Narrative   │         │ Memory  │
   └─────────┘         └─────────────┘         └─────────┘

依赖关系:
  时间引擎 → 事件引擎 (时间触发事件)
  地理引擎 → 势力引擎 (地理决定势力范围)
  势力引擎 → 事件引擎 (势力行为产生事件)
  规则引擎 → 因果引擎 (规则约束因果关系)
  因果引擎 → 叙事引擎 (因果驱动叙事)
  叙事引擎 → 记忆引擎 (叙事产生记忆)
  记忆引擎 → 时间引擎 (记忆锚定时间点)
  事件引擎 → 因果引擎 (事件产生因果链)
```

#### 4.1.3 工作室引擎 8 个子系统依赖图

```
                    ┌───────────────┐
                    │  工作室引擎总控 │
                    │Studio Engine  │
                    └───────┬───────┘
                            │
    ┌───────────┬───────────┼───────────┬───────────┐
    │           │           │           │           │
┌───┴───┐   ┌───┴───┐   ┌───┴───┐   ┌───┴───┐   ┌───┴───┐
│ 大纲编辑│   │ 章节写作│   │ 角色管理│   │ 设定管理│   │ 伏笔追踪│
│Outline │   │Chapter│   │Character│  │ Setting│   │ Fore  │
│ Editor │   │Writer │   │ Manager│   │Manager │   │shadow │
└───┬───┘   └───┬───┘   └───┬───┘   └───┬───┘   └───┬───┘
    │           │           │           │           │
    └───────────┴───────┬───┴───────────┴───────────┘
                        │
                ┌───────┴───────┐
                │    协作总线     │
                │ Collaboration │
                └───────┬───────┘
                        │
    ┌───────────┬───────┴───────┬───────────┐
    │           │               │           │
┌───┴───┐   ┌───┴───┐      ┌───┴───┐   ┌───┴───┐
│ 版本控制│   │ 统计分析│      │ 导出发布│   │ 反馈收集│
│Version│   │Analytics│     │ Export│   │Feedback│
│Control│   │         │     │Publish│   │Collect │
└───────┘   └─────────┘      └───────┘   └───────┘

依赖关系:
  大纲编辑 → 章节写作 (大纲指导写作)
  角色管理 → 章节写作 (角色信息供写作使用)
  设定管理 → 章节写作 (设定信息供写作使用)
  伏笔追踪 → 大纲编辑 (伏笔影响大纲走向)
  章节写作 → 版本控制 (写作产生版本)
  章节写作 → 统计分析 (写作数据供分析)
  统计分析 → 反馈收集 (分析驱动反馈)
  反馈收集 → 角色管理/设定管理 (反馈影响内容)
  导出发布 → 版本控制 (发布依赖版本)
  伏笔追踪 → 设定管理 (伏笔依赖设定一致性)
```

#### 4.1.4 谏官系统 ↔ 双引擎三向依赖

```
           ┌─────────────────────────────────────┐
           │           谏官系统 (Advisor)           │
           │                                     │
           │  ┌─────────┐  ┌─────────┐           │
           │  │ 决策引擎 │  │ 评估引擎 │           │
           │  │Decision │  │Evaluate │           │
           │  └────┬────┘  └────┬────┘           │
           │       └────────┬───┘                │
           │                │                     │
           │           ┌────┴────┐               │
           │           │ 谏官核心 │               │
           │           │  Core   │               │
           │           └────┬────┘               │
           └────────────────┼─────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ 世界引擎  │←│ 谏官观察  │→│ 工作室引擎│
        │ 输入:    │ │  哨兵    │ │ 输入:    │
        │ 世界状态 │ │          │ │ 创作状态 │
        │ 规则变化 │ │  协调    │ │ 写作进度 │
        │ 事件触发 │ │  仲裁    │ │ 作者行为 │
        └────┬─────┘ └──────────┘ └────┬─────┘
             │                          │
             ▼                          ▼
        ┌──────────┐              ┌──────────┐
        │ 输出:    │              │ 输出:    │
        │ 世界调整 │              │ 创作建议 │
        │ 规则修正 │              │ 流程优化 │
        │ 事件干预 │              │ 内容提示 │
        └──────────┘              └──────────┘

三向依赖规则:
  1. 谏官观察世界引擎状态，做出决策
  2. 谏官观察工作室引擎状态，给出建议
  3. 世界引擎的变更可能影响工作室引擎的工作内容
  4. 工作室引擎的创作可能触发世界引擎的状态更新
  5. 谏官可以协调两者之间的冲突
  6. 谏官的决策依赖两者的综合状态
```

#### 4.1.5 LLM API 全模块依赖

```
                    ┌─────────────────┐
                    │   LLM API 网关   │
                    │  (OpenRouter/    │
                    │   Anthropic/     │
                    │   DeepSeek等)    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────┴────┐         ┌────┴────┐         ┌────┴────┐
   │ 请求路由 │         │ 负载均衡 │         │ 熔断降级 │
   │ Router  │         │  Load   │         │ Circuit │
   └────┬────┘         │ Balancer│         │ Breaker │
        │              └────┬────┘         └────┬────┘
        │                   │                    │
        └───────────────────┼────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────┴────┐        ┌────┴────┐        ┌────┴────┐
   │ 协调层   │        │ Agent层 │        │ 服务层  │
   │100%依赖 │        │100%依赖 │        │80%依赖 │
   │(谏官/调度)│       │(所有Agent)│      │(引擎/缓存)│
   └─────────┘        └─────────┘        └─────────┘
        │                   │                   │
        │    ┌──────────────┼───────────────────┤
        │    │              │                   │
        │    │         ┌────┴────┐         ┌────┴────┐
        │    │         │ 数据层  │        │ 基础设施 │
        │    │         │20%依赖 │        │  (监控/  │
        │    │         │(向量嵌入)│       │   日志)  │
        │    │         └─────────┘        └─────────┘
        │    │
        │    └──────────────────────────────────┐
        │                                       │
        ▼                                       ▼
   ┌─────────────────────────────────────────────────────┐
   │                    LLM 依赖等级                        │
   │                                                      │
   │  P0 (关键): 谏官决策、叙事生成、角色对话、大纲扩展        │
   │  P1 (重要): 设定生成、风格分析、知识问答、伏笔检测        │
   │  P2 (辅助): 统计分析、反馈分析、测试生成、文档生成        │
   │  P3 (可选): 日志摘要、监控报告、代码审查建议             │
   │                                                      │
   │  降级策略: P0不可降级 → 必须重试+告警                   │
   │            P1可降级 → 使用缓存/简化逻辑                 │
   │            P2可降级 → 跳过功能                          │
   │            P3可降级 → 直接跳过                          │
   └─────────────────────────────────────────────────────┘
```

### 4.2 变更影响域分析

#### 4.2.1 模块间变更传播规则

```
// 变更传播有向图
// 箭头表示: 源模块变更 → 可能影响目标模块
// 权重表示: 影响概率 (0.0 ~ 1.0)

变更传播图 G = (V, E, W)

V = {所有模块}
E = {(u, v) | 模块u的变更可能影响模块v}
W: E → [0, 1] (影响概率权重)

传播规则:
  1. 直接依赖: 如果模块A直接导入/调用模块B，则 A→B 权重 = 0.8
  2. 间接依赖: 如果 A→C→B，则 A→B 权重 = 0.8 * 0.5 = 0.4 (每跳衰减50%)
  3. 共享数据: 如果A和B共享数据库表/接口，则 A↔B 权重 = 0.6
  4. 事件耦合: 如果A发布事件B订阅，则 A→B 权重 = 0.5
  5. 配置依赖: 如果A依赖B的配置，则 B→A 权重 = 0.3

影响域计算:
  impactScope(module, changeType) = {
    direct: getDirectDependencies(module),          // 直接依赖
    transitive: getTransitiveDependencies(module, depth=3), // 传递依赖(最多3跳)
    reverse: getReverseDependencies(module),          // 反向依赖（被谁依赖）
    data: getSharedDataConsumers(module),            // 共享数据消费者
    event: getEventSubscribers(module)               // 事件订阅者
  }
```

### 4.3 依赖环路检测

```
// 环路检测算法 (基于DFS)
function detectCycles(graph: DependencyGraph): Cycle[] {
    cycles = []
    visited = new Set()
    recursionStack = new Set()
    path = []
    
    function dfs(node):
        visited.add(node)
        recursionStack.add(node)
        path.push(node)
        
        for neighbor in graph.getDependencies(node):
            if !visited.has(neighbor):
                dfs(neighbor)
            else if recursionStack.has(neighbor):
                // 发现环路
                cycleStart = path.indexOf(neighbor)
                cycle = path.slice(cycleStart)
                cycles.push(cycle)
        
        path.pop()
        recursionStack.delete(node)
    
    for node in graph.getAllModules():
        if !visited.has(node):
            dfs(node)
    
    return deduplicateCycles(cycles)
}

// 部署死锁预防
function preventDeployDeadlock(cycles: Cycle[], deployPlan: DeployPlan): DeployOrder {
    if cycles.length == 0:
        return topologicalSort(deployPlan)  // 无环，正常拓扑排序
    
    // 有环时需要破环
    for cycle in cycles:
        // 策略1: 合并循环依赖模块为单一部署单元
        merged = mergeIntoDeployUnit(cycle)
        deployPlan.replace(cycle, merged)
        
        // 策略2: 如果无法合并，标记为需要同步部署
        if !canMerge(cycle):
            markAsAtomicDeploy(cycle)
    
    return topologicalSort(deployPlan)
}
```

### 4.4 最小变更集计算

```
function computeMinimalChangeSet(
    rootModule: string,
    issue: Issue,
    dependencyGraph: DependencyGraph
): ChangeSet {
    // 1. 确定需要修改的模块
    modulesToChange = new Set([rootModule])
    
    // 2. 接口变更传播
    if issue.type == "API_CHANGE" || issue.type == "INTERFACE_CHANGE":
        // API变更需要更新所有调用方
        consumers = dependencyGraph.getConsumers(rootModule)
        for consumer in consumers:
            modulesToChange.add(consumer)
    
    // 3. 数据模型变更传播
    if issue.type == "SCHEMA_CHANGE":
        // 数据库表变更需要更新所有读写该表的模块
        dataConsumers = dependencyGraph.getDataConsumers(rootModule)
        for consumer in dataConsumers:
            modulesToChange.add(consumer)
    
    // 4. 配置变更传播
    if issue.type == "CONFIG_CHANGE":
        configDependents = dependencyGraph.getConfigDependents(rootModule)
        for dependent in configDependents:
            modulesToChange.add(dependent)
    
    // 5. 测试覆盖
    testsToUpdate = new Set()
    for module in modulesToChange:
        testFiles = findTestsForModule(module)
        for test in testFiles:
            testsToUpdate.add(test)
    
    // 6. 文档覆盖
    docsToUpdate = new Set()
    for module in modulesToChange:
        if hasPublicAPI(module):
            docsToUpdate.add(getModuleDoc(module))
    
    return {
        sourceModules: [...modulesToChange],
        testFiles: [...testsToUpdate],
        docFiles: [...docsToUpdate],
        estimatedEffort: estimateEffort(modulesToChange, testsToUpdate),
        riskLevel: assessChangeRisk(modulesToChange, dependencyGraph),
        rollbackPlan: generateRollbackPlan(modulesToChange)
    }
}
```

---

## 5. ImpactAnalyzer

### 5.1 四类影响域定义

#### 5.1.1 叙事影响 (Narrative Impact)

```
// 叙事影响评估维度
interface NarrativeImpact {
    // 世界规则一致性
    worldRuleAffected: boolean;      // 是否影响已建立的世界规则
    ruleChangeScope: 'none' | 'minor' | 'major' | 'fundamental';
    
    // 设定一致性
    settingConsistencyRisk: number;  // 0-1, 设定冲突风险
    affectedSettings: string[];      // 受影响的设定项
    
    // 伏笔追踪
    foreshadowingDisrupted: boolean; // 是否破坏已有伏笔
    affectedForeshadowings: string[];// 受影响的伏笔ID
    
    // 角色一致性
    characterConsistencyRisk: number;// 0-1, 角色行为一致性风险
    affectedCharacters: string[];    // 受影响的角色ID
    
    // 时间线完整性
    timelineIntegrityRisk: number;   // 0-1, 时间线冲突风险
    
    // 综合评分
    overallScore: number;            // 0-1, 综合叙事影响评分
}

// 叙事影响阈值
const NARRATIVE_IMPACT_THRESHOLDS = {
    CRITICAL: 0.8,   // ≥0.8: 严重叙事影响，必须人工审批
    HIGH: 0.5,       // ≥0.5: 显著叙事影响，建议人工审批
    MEDIUM: 0.2,     // ≥0.2: 轻微叙事影响，可自动处理+通知
    LOW: 0.0         // <0.2: 无叙事影响，可自动处理
}
```

#### 5.1.2 功能影响 (Functional Impact)

```
// 功能影响评估维度
interface FunctionalImpact {
    // 接口兼容性
    apiCompatibility: 'backward_compatible' | 'breaking_change' | 'new_api';
    affectedEndpoints: string[];     // 受影响的API端点
    
    // 功能变更类型
    changeType: 'fix' | 'enhancement' | 'refactor' | 'removal' | 'new_feature';
    
    // 用户可见性
    userVisible: boolean;            // 变更是否对用户可见
    uiChanges: boolean;              // 是否涉及UI变更
    workflowChanges: boolean;        // 是否影响用户工作流
    
    // 配置变更
    configChanges: boolean;          // 是否需要配置变更
    migrationRequired: boolean;      // 是否需要数据迁移
    
    // 综合评分
    disruptionScore: number;         // 0-1, 功能中断风险
}
```

#### 5.1.3 性能影响 (Performance Impact)

```
// 性能影响评估维度
interface PerformanceImpact {
    // 响应时间影响
    latencyChange: number;           // 预期延迟变化 (ms)
    latencyChangePercent: number;    // 预期延迟变化百分比
    
    // 资源消耗影响
    cpuImpact: number;               // CPU消耗变化
    memoryImpact: number;            // 内存消耗变化 (MB)
    ioImpact: number;                // I/O负载变化
    
    // 吞吐量影响
    throughputChangePercent: number; // 吞吐量变化百分比
    
    // 扩展性影响
    scalabilityImpact: 'improved' | 'neutral' | 'degraded';
    
    // 综合评分 (负值表示性能改善)
    overallScore: number;            // -1 ~ 1, 负值=改善, 正值=恶化
}
```

#### 5.1.4 安全影响 (Security Impact)

```
// 安全影响评估维度
interface SecurityImpact {
    // 数据安全
    dataExposureRisk: number;        // 0-1, 数据暴露风险
    affectedDataClasses: string[];   // 受影响的数据分级
    
    // 访问控制
    authChanges: boolean;            // 是否影响认证机制
    authorizationChanges: boolean;   // 是否影响授权机制
    
    // 漏洞相关
    cveLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
    attackVector: string[];          // 可能的攻击向量
    
    // 合规性
    complianceAffected: string[];    // 受影响的合规要求 (GDPR/等)
    
    // 综合评分
    overallScore: number;            // 0-1, 安全风险评分
}
```

### 5.2 影响矩阵（模块间影响权重）

#### 5.2.1 核心影响矩阵

行 = 变更源模块，列 = 受影响模块，值 = 影响权重 (0.0~1.0)

```
                        ┌─────────────────────────────────────────────────────────────┐
                        │受 影 响 模 块 (Impact Target →)                             │
┌───────────────────────┼─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┤
│ 变更源模块            │谏官 │调度 │Agent│世界 │工作│状态│ LLM │  DB │向量 │事件 │
│ (Change Source ↓)     │系统 │器   │层   │引擎 │室  │管理│服务 │     │存储 │总线 │
├───────────────────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ 谏官系统 (Advisor)    │ —   │0.4  │0.6  │0.5  │0.5 │0.3 │0.4  │0.1  │0.0  │0.5  │
│ 调度器 (Scheduler)    │0.3  │ —   │0.7  │0.4  │0.4 │0.4 │0.5  │0.1  │0.0  │0.6  │
│ Agent层 (Agent Layer) │0.4  │0.3  │0.4* │0.3  │0.3 │0.3 │0.8  │0.2  │0.1  │0.4  │
│ 世界引擎 (World Eng)  │0.5  │0.2  │0.4  │0.5* │0.5 │0.3 │0.3  │0.4  │0.2  │0.5  │
│ 工作室引擎 (Studio)   │0.4  │0.2  │0.3  │0.4  │0.4*│0.2 │0.3  │0.3  │0.1  │0.4  │
│ 状态管理 (State Mgr)  │0.3  │0.3  │0.5  │0.3  │0.3 │ —  │0.2  │0.3  │0.0  │0.5  │
│ LLM服务 (LLM Service) │0.2  │0.3  │0.8  │0.3  │0.3 │0.2 │ —   │0.0  │0.0  │0.3  │
│ 数据库 (Core DB)      │0.1  │0.1  │0.3  │0.5  │0.5 │0.3 │0.0  │ —   │0.0  │0.2  │
│ 向量存储 (Vector)     │0.0  │0.0  │0.2  │0.3  │0.2 │0.0 │0.1  │0.0  │ —   │0.1  │
│ 事件总线 (Event Bus)  │0.3  │0.4  │0.5  │0.4  │0.4 │0.4 │0.3  │0.1  │0.0  │ —   │
└───────────────────────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘

* 对角线上的值表示模块内部变更的自我影响 (模块内部组件间的耦合度)
```

#### 5.2.2 子引擎影响矩阵

```
世界引擎子引擎影响矩阵:

                    时间  地理  势力  规则  因果  叙事  记忆  事件
时间引擎 (Timeline)   —   0.2  0.1  0.1  0.3  0.2  0.4  0.6
地理引擎 (Geography) 0.1   —   0.5  0.2  0.1  0.1  0.1  0.2
势力引擎 (Force)     0.1  0.3   —   0.3  0.3  0.2  0.1  0.4
规则引擎 (Rules)     0.1  0.1  0.2   —   0.6  0.3  0.1  0.2
因果引擎 (Causality) 0.3  0.1  0.2  0.4   —   0.5  0.2  0.3
叙事引擎 (Narrative) 0.2  0.1  0.1  0.2  0.4   —   0.5  0.2
记忆引擎 (Memory)    0.5  0.0  0.0  0.1  0.2  0.4   —   0.1
事件引擎 (Event)     0.4  0.2  0.3  0.1  0.3  0.2  0.1   —

工作室引擎子系统影响矩阵:

                    大纲  章节  角色  设定  伏笔  版本  统计  导出  反馈
大纲编辑 (Outline)    —   0.6  0.2  0.3  0.5  0.3  0.1  0.2  0.2
章节写作 (Chapter)   0.4   —   0.4  0.4  0.2  0.5  0.4  0.3  0.3
角色管理 (Character) 0.2  0.4   —   0.5  0.2  0.1  0.2  0.1  0.3
设定管理 (Setting)   0.3  0.4  0.4   —   0.4  0.1  0.2  0.1  0.2
伏笔追踪 (Fore)      0.4  0.2  0.1  0.3   —   0.1  0.1  0.1  0.1
版本控制 (Version)   0.2  0.4  0.1  0.1  0.1   —   0.1  0.4  0.0
统计分析 (Analytics) 0.1  0.3  0.2  0.2  0.1  0.1   —   0.2  0.4
导出发布 (Export)    0.1  0.2  0.1  0.1  0.1  0.3  0.2   —   0.1
反馈收集 (Feedback)  0.2  0.3  0.3  0.2  0.1  0.0  0.3  0.1   —
```

### 5.3 回归风险评分

```
// 回归风险评分模型
function calculateRegressionRisk(change: Change, history: ProjectHistory): number {
    // 基础风险因子
    riskFactors = {
        // 1. 变更复杂度
        complexity: estimateChangeComplexity(change) / 10,  // 归一化到 0-1
        
        // 2. 受影响测试覆盖率
        testCoverageGap: 1 - getAffectedAreaTestCoverage(change),
        
        // 3. 模块历史缺陷密度
        defectDensity: getModuleDefectDensity(change.targetModule) / maxDefectDensity,
        
        // 4. 变更类型风险
        changeTypeRisk: {
            'fix': 0.3,
            'enhancement': 0.4,
            'refactor': 0.6,      // 重构风险较高
            'removal': 0.5,
            'new_feature': 0.4,
            'dependency_upgrade': 0.5
        }[change.type],
        
        // 5. 代码变动量
        changeSizeRisk: min(1.0, (change.linesAdded + change.linesRemoved) / 500),
        
        // 6. 关键路径风险
        criticalPathRisk: change.touchesCriticalPath ? 0.8 : 0.1,
        
        // 7. 历史回归率
        historicalRegressionRate: getModuleHistoricalRegressionRate(change.targetModule)
    }
    
    // 加权综合
    weights = {
        complexity: 0.15,
        testCoverageGap: 0.20,
        defectDensity: 0.15,
        changeTypeRisk: 0.15,
        changeSizeRisk: 0.10,
        criticalPathRisk: 0.15,
        historicalRegressionRate: 0.10
    }
    
    regressionRisk = 0
    for factor, weight in weights:
        regressionRisk += riskFactors[factor] * weight
    
    return clamp(regressionRisk, 0, 1)
}
```

### 5.4 人类审批决策逻辑

```
// 审批决策树
function determineApprovalRequired(impact: FullImpactAssessment): ApprovalDecision {
    // 规则1: 任何叙事影响评分 ≥ HIGH (0.5) → 必须审批
    if impact.narrative.overallScore >= NARRATIVE_IMPACT_THRESHOLDS.HIGH:
        return {
            required: true,
            reason: "NARRATIVE_IMPACT_CRITICAL",
            approvers: ["author", "narrative_lead"],
            urgency: mapSeverityToUrgency(impact.severity)
        }
    
    // 规则2: 任何安全影响评分 ≥ 0.5 → 必须审批
    if impact.security.overallScore >= 0.5:
        return {
            required: true,
            reason: "SECURITY_IMPACT_HIGH",
            approvers: ["security_lead", "tech_lead"],
            urgency: "immediate"
        }
    
    // 规则3: 功能影响为 breaking_change → 必须审批
    if impact.functional.apiCompatibility == 'breaking_change':
        return {
            required: true,
            reason: "BREAKING_CHANGE",
            approvers: ["tech_lead", "product_owner"],
            urgency: mapSeverityToUrgency(impact.severity)
        }
    
    // 规则4: 回归风险 > 0.7 → 建议审批
    if impact.regressionRisk > 0.7:
        return {
            required: true,
            reason: "HIGH_REGRESSION_RISK",
            approvers: ["tech_lead"],
            urgency: "high",
            canOverride: false
        }
    
    // 规则5: 性能影响恶化 > 50% → 建议审批
    if impact.performance.latencyChangePercent > 50 || impact.performance.throughputChangePercent < -30:
        return {
            required: true,
            reason: "PERFORMANCE_DEGRADATION",
            approvers: ["tech_lead"],
            urgency: "medium"
        }
    
    // 规则6: 影响核心创作流程 → 必须审批
    if impact.functional.workflowChanges && impact.functional.userVisible:
        return {
            required: true,
            reason: "CORE_WORKFLOW_CHANGE",
            approvers: ["author", "product_owner"],
            urgency: "medium"
        }
    
    // 规则7: 纯技术修复，无上述影响 → 自动处理
    if impact.narrative.overallScore < 0.1 && 
       impact.security.overallScore < 0.2 &&
       impact.functional.apiCompatibility == 'backward_compatible' &&
       impact.regressionRisk < 0.5:
        return {
            required: false,
            reason: "PURE_TECHNICAL_FIX",
            approvers: [],
            autoDeploy: true
        }
    
    // 默认: 建议审批但不强制
    return {
        required: false,
        reason: "DEFAULT_RECOMMENDATION",
        approvers: ["tech_lead"],
        recommended: true
    }
}
```



---

## 6. TicketManager

### 6.1 工单生命周期

```
                          ┌─────────────┐
                          │   CREATED   │ ← 报告进入系统，工单创建
                          └──────┬──────┘
                                 │ classify()
                                 ▼
                          ┌─────────────┐
                          │  CLASSIFIED │ ← 严重性评估完成，分类信息填充
                          └──────┬──────┘
                                 │ route()
                                 ▼
                          ┌─────────────┐
                          │   ROUTED    │ ← 路由决策完成，目标Agent确定
                          └──────┬──────┘
                                 │ assign()
                                 ▼
                          ┌─────────────┐
          ┌──────────────→│   ASSIGNED  │ ← 分配给具体Agent
          │               └──────┬──────┘
          │                      │ startWork()
          │                      ▼
          │               ┌─────────────┐
          │    ┌─────────→│  IN_PROGRESS│ ← Agent开始处理
          │    │          └──────┬──────┘
          │    │                 │ submitForReview()
          │    │                 ▼
          │    │          ┌─────────────┐
          │    │          │PENDING_REVIEW│ ← 等待审批/验证
          │    │          └──────┬──────┘
          │    │                 │ approve() / reject()
          │    │                 ▼
          │    │          ┌─────────────┐
          │    │ ┌───────→│   APPROVED  │ ← 审批通过
          │    │ │        └──────┬──────┘
          │    │ │               │ markForDeploy()
          │    │ │               ▼
          │    │ │        ┌─────────────┐
          │    │ │        │  DEPLOYING  │ ← 部署中
          │    │ │        └──────┬──────┘
          │    │ │               │ deploySuccess() / deployFail()
          │    │ │               ▼
          │    │ │        ┌─────────────┐     ┌─────────────┐
          │    │ │        │   VERIFIED  │     │DEPLOY_FAILED│
          │    │ │        │  (活跃状态)  │     └──────┬──────┘
          │    │ │        └──────┬──────┘            │
          │    │ │               │ autoResolve()     │ retryDeploy()
          │    │ │               │ (监控N天无复发)   │ 或 rollback()
          │    │ │               ▼                   │
          │    │ │        ┌─────────────┐            ▼
          │    │ │        │   CLOSED    │      ┌─────────────┐
          │    │ │        └─────────────┘      │  ROLLING_BACK│
          │    │ │                             └──────┬──────┘
          │    │ │                                    │
          │    │ │   ┌────────────────────────────────┘
          │    │ │   │ rollbackComplete()
          │    │ │   ▼
          │    │ │ ┌─────────────┐
          │    │ └─┤   REJECTED  │ ← 审批拒绝，返回修改
          │    │   │  (回到开发)  │
          │    │   └──────┬──────┘
          │    │          │
          │    └──────────┘ (返回 IN_PROGRESS)
          │
          └─────────────────────┐
                                │ needMoreInfo() / blocked()
                                ▼
                          ┌─────────────┐
                          │   BLOCKED   │ ← 阻塞（依赖其他工单/信息不足）
                          └──────┬──────┘
                                 │ unblock()
                                 │
                                 └──────────────────────→ (返回 IN_PROGRESS)

                          ┌─────────────┐
                          │   MERGED    │ ← 被合并到其他工单
                          └──────┬──────┘
                                 │
                                 ▼ (跟随主工单生命周期)
                          ┌─────────────┐
                          │   CLOSED    │
                          └─────────────┘

                          ┌─────────────┐
                          │   SPLIT     │ ← 拆分为多个子工单
                          └──────┬──────┘
                                 │
                                 ▼ (子工单各自走独立生命周期)
                          ┌─────────────┐
                          │   CLOSED    │ (原工单关闭，指向子工单)
                          └─────────────┘
```

### 6.2 工单优先级动态调整

```
// 动态优先级调整公式
function adjustTicketPriority(ticket: Ticket, context: SystemContext): Priority {
    basePriority = ticket.severity.priority  // P0-P4
    baseScore = ticket.severity.score        // 0-1
    
    adjustments = []
    
    // 1. 作者创作状态调整
    if context.authorFlowState == 'in_flow':
        // 作者在心流中，降低非紧急工单优先级，避免干扰
        if basePriority >= P2:
            adjustments.push({ type: 'FLOW_DEFER', value: -0.1 })
    elif context.authorFlowState == 'struggling':
        // 作者遇到困难，提升相关工单优先级
        if ticket.category == 'interaction':
            adjustments.push({ type: 'FLOW_ASSIST', value: +0.15 })
    elif context.authorFlowState == 'blocked':
        // 作者被阻塞，紧急提升所有相关工单
        if ticket.module == context.blockedModule:
            adjustments.push({ type: 'FLOW_CRITICAL', value: +0.25 })
    
    // 2. 系统负载调整
    systemLoad = context.systemLoad  // 0-1
    if systemLoad > 0.8:
        // 高负载时，降低非紧急工单优先级
        if basePriority >= P2:
            adjustments.push({ type: 'HIGH_LOAD_DEFER', value: -0.1 })
    elif systemLoad < 0.3:
        // 低负载时，提升可批量处理工单优先级
        if ticket.aggregation.batchable:
            adjustments.push({ type: 'LOW_LOAD_BATCH', value: +0.05 })
    
    // 3. 业务优先级调整
    if context.businessPriority == 'release_critical':
        if ticket.tags.includes('release-blocker'):
            adjustments.push({ type: 'RELEASE_CRITICAL', value: +0.2 })
    elif context.businessPriority == 'user_experience_focus':
        if ticket.category == 'interaction' || ticket.category == 'performance':
            adjustments.push({ type: 'UX_FOCUS', value: +0.1 })
    
    // 4. 工单年龄调整 (防止工单被遗忘)
    age = now - ticket.createdAt
    if age > 7 days and basePriority <= P2:
        ageBonus = min(0.1, (age - 7 days) / 30 days * 0.1)
        adjustments.push({ type: 'AGE_ESCALATION', value: ageBonus })
    
    // 5. 计算最终优先级
    totalAdjustment = sum(adjustments.map(a => a.value))
    adjustedScore = clamp(baseScore + totalAdjustment, 0, 1)
    finalPriority = mapScoreToPriority(adjustedScore)
    
    return {
        priority: finalPriority,
        adjustedScore,
        adjustments,
        originalPriority: basePriority
    }
}
```

### 6.3 工单合并逻辑

```
// 工单合并条件
function canMergeTickets(ticketA: Ticket, ticketB: Ticket): MergeDecision {
    // 条件1: 相同模块 + 相同问题类型
    sameModule = ticketA.module == ticketB.module
    sameType = ticketA.type == ticketB.type
    
    // 条件2: 相似描述 (文本相似度)
    descriptionSimilarity = computeSimilarity(
        ticketA.description,
        ticketB.description
    )
    
    // 条件3: 时间窗口
    timeGap = abs(ticketA.createdAt - ticketB.createdAt)
    withinTimeWindow = timeGap < MERGE_TIME_WINDOW  // 默认 24h
    
    // 条件4: 相同根因 (stack trace / error code 匹配)
    sameRootCause = compareRootCause(ticketA, ticketB)
    
    // 条件5: 严重性兼容 (可合并的范围)
    severityCompatible = abs(ticketA.severity.score - ticketB.severity.score) < 0.3
    
    // 合并评分
    mergeScore = 0
    if sameModule: mergeScore += 0.25
    if sameType: mergeScore += 0.25
    if descriptionSimilarity > 0.7: mergeScore += 0.2
    if withinTimeWindow: mergeScore += 0.1
    if sameRootCause: mergeScore += 0.15
    if severityCompatible: mergeScore += 0.05
    
    if mergeScore >= MERGE_THRESHOLD (0.7):
        return {
            canMerge: true,
            score: mergeScore,
            primary: ticketA.severity.score >= ticketB.severity.score ? ticketA : ticketB,
            secondary: ticketA.severity.score >= ticketB.severity.score ? ticketB : ticketA,
            reason: buildMergeReason(sameModule, sameType, descriptionSimilarity, sameRootCause)
        }
    else:
        return { canMerge: false, score: mergeScore }
}

// 合并执行
function mergeTickets(primary: Ticket, secondary: Ticket): Ticket {
    merged = { ...primary }
    
    // 合并标题
    if !primary.title.includes(secondary.title):
        merged.title = `[聚合] ${primary.title} (+${secondary.subIssues?.length || 1})`
    
    // 合并描述
    merged.description = synthesizeDescriptions([primary, secondary])
    
    // 合并子问题
    merged.subIssues = [
        ...(primary.subIssues || []),
        secondary,
        ...(secondary.subIssues || [])
    ]
    
    // 取最高严重性
    merged.severity = primary.severity.score >= secondary.severity.score 
        ? primary.severity : secondary.severity
    merged.severity.adjustments.push({
        type: 'MERGE_ESCALATION',
        value: max(0, secondary.severity.score - primary.severity.score) * 0.3
    })
    
    // 合并标签
    merged.tags = [...new Set([...primary.tags, ...secondary.tags])]
    
    // 合并关联工单
    merged.dependencies = {
        blocks: [...new Set([...primary.dependencies.blocks, ...secondary.dependencies.blocks])],
        blockedBy: [...new Set([...primary.dependencies.blockedBy, ...secondary.dependencies.blockedBy])]
    }
    
    // 记录合并历史
    merged.mergeHistory = [
        ...(primary.mergeHistory || []),
        {
            mergedAt: now(),
            mergedTicketId: secondary.id,
            mergeScore: mergeScore,
            reason: mergeReason
        }
    ]
    
    // 标记被合并工单
    secondary.status = 'MERGED'
    secondary.mergedInto = primary.id
    
    return merged
}
```

### 6.4 工单拆分逻辑

```
// 工单拆分条件
function shouldSplitTicket(ticket: Ticket): SplitDecision {
    // 条件1: 涉及多个不相关模块 (跨模块数 > 3)
    moduleCount = estimateAffectedModules(ticket)
    if moduleCount > 3:
        return {
            shouldSplit: true,
            reason: 'TOO_MANY_MODULES',
            suggestedParts: splitByModule(ticket, moduleCount)
        }
    
    // 条件2: 复合问题描述 (包含多个独立问题)
    subProblems = extractSubProblems(ticket.description)
    if subProblems.length > 2:
        return {
            shouldSplit: true,
            reason: 'MULTIPLE_SUB_PROBLEMS',
            suggestedParts: splitByProblem(ticket, subProblems)
        }
    
    // 条件3: 估计工作量过大 ( > 5 人天)
    estimatedEffort = estimateTicketEffort(ticket)
    if estimatedEffort > 5 * EFFORT_UNIT:
        return {
            shouldSplit: true,
            reason: 'EFFORT_TOO_LARGE',
            suggestedParts: splitByEffort(ticket, estimatedEffort)
        }
    
    // 条件4: 涉及完全不同的技术栈
    techStacks = extractTechStacks(ticket)
    if techStacks.length > 2 and !areRelated(techStacks):
        return {
            shouldSplit: true,
            reason: 'MULTIPLE_TECH_STACKS',
            suggestedParts: splitByTechStack(ticket, techStacks)
        }
    
    return { shouldSplit: false }
}

// 拆分执行
function splitTicket(ticket: Ticket, splitPlan: SplitPlan): Ticket[] {
    childTickets = []
    
    for part in splitPlan.parts:
        child = createTicket({
            title: `[拆分${part.index}] ${ticket.title}: ${part.title}`,
            description: part.description,
            type: part.type || ticket.type,
            module: part.module,
            severity: part.severity || adjustSeverityForPart(ticket.severity, part),
            tags: [...ticket.tags, 'split-child'],
            parentTicket: ticket.id,
            dependencies: {
                blocks: [],
                blockedBy: part.dependencies || [ticket.id]
            }
        })
        childTickets.push(child)
    
    // 更新原工单
    ticket.status = 'SPLIT'
    ticket.childTickets = childTickets.map(c => c.id)
    ticket.title = `[已拆分] ${ticket.title}`
    
    return childTickets
}
```

---

## 7. RoutingDecisionEngine

### 7.1 混合路由策略

```
// 三层路由策略
RoutingStrategy = RuleBased | LLMBased | HistoryBased

function routeTicket(ticket: Ticket, context: RoutingContext): RoutingDecision {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Layer 1: 基于规则的路由 (硬编码优先规则)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ruleMatches = applyRoutingRules(ticket, ROUTING_RULES)
    
    if ruleMatches.length == 1 and ruleMatches[0].confidence >= 0.9:
        // 单一高置信度规则匹配 → 直接采用
        return {
            targetAgent: ruleMatches[0].targetAgent,
            confidence: ruleMatches[0].confidence,
            strategy: 'RULE_BASED',
            reason: `High-confidence rule match: ${ruleMatches[0].ruleId}`
        }
    
    if ruleMatches.length >= 1:
        // 多规则匹配或低置信度 → 进入下一层
        ruleBasedCandidates = ruleMatches
    } else {
        ruleBasedCandidates = []
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Layer 2: 基于LLM的智能路由
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    llmRecommendation = llmRouteAnalyze(ticket, context, ruleBasedCandidates)
    
    // 如果规则层有候选，与LLM推荐融合
    if ruleBasedCandidates.length > 0:
        fusedDecision = fuseRuleAndLLM(ruleBasedCandidates, llmRecommendation)
    } else {
        // 无规则匹配，纯LLM推荐
        fusedDecision = {
            targetAgent: llmRecommendation.targetAgent,
            confidence: llmRecommendation.confidence * 0.8,  // LLM单独推荐降权
            strategy: 'LLM_BASED',
            reason: `LLM analysis: ${llmRecommendation.reasoning}`
        }
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Layer 3: 历史学习校正
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    historicalCorrection = applyHistoricalCorrection(
        fusedDecision,
        ticket,
        context.routeHistory
    )
    
    finalDecision = {
        ...historicalCorrection,
        originalDecision: fusedDecision,
        historicalAdjustment: historicalCorrection.adjustment
    }
    
    // 最终置信度评估
    finalDecision.finalConfidence = evaluateConfidence(finalDecision)
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 降级处理
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if finalDecision.finalConfidence < CONFIDENCE_THRESHOLD (0.5):
        return fallbackToHumanReview(ticket, finalDecision)
    
    return finalDecision
}
```

### 7.2 LLM路由分析

```
// LLM路由分析提示词模板
LLM_ROUTE_PROMPT = `
你是一位资深技术工单路由专家。请分析以下工单，推荐最合适的处理Agent。

可用Agent列表:
- FixAgent: 修复Bug、处理异常、解决技术故障
- OptimizeAgent: 性能优化、资源调优、架构优化
- FeatureAgent: 新功能开发、用户体验改进、需求实现
- RefactorAgent: 代码重构、技术债务清理、架构调整
- SecurityAgent: 安全漏洞修复、安全策略、合规性
- TestAgent: 测试覆盖、测试质量、测试策略
- DocAgent: 文档更新、API文档、用户手册
- DeployAgent: 部署问题、CI/CD、运维

工单信息:
标题: {ticket.title}
描述: {ticket.description}
类型: {ticket.type}
模块: {ticket.module}
严重性: {ticket.severity.priority} (得分: {ticket.severity.score})
影响面: {ticket.impact.dimensions.impactScope}
紧急度: {ticket.impact.dimensions.urgency}

{ruleBasedCandidates ? `规则匹配候选: ${JSON.stringify(ruleBasedCandidates)}` : ''}

请输出JSON格式:
{
    "recommendedAgent": "Agent名称",
    "confidence": 0.0-1.0,
    "reasoning": "详细分析理由",
    "secondaryAgent": "备选Agent名称 (如需要)",
    "riskFactors": ["风险因子1", "风险因子2"],
    "additionalContext": "任何额外建议"
}
`

function llmRouteAnalyze(ticket, context, ruleCandidates): LLMRoutingResult {
    prompt = LLM_ROUTE_PROMPT
        .replace('{ticket.title}', ticket.title)
        .replace('{ticket.description}', ticket.description)
        .replace('{ticket.type}', ticket.type)
        .replace('{ticket.module}', ticket.module)
        .replace('{ticket.severity.priority}', ticket.severity.priority)
        .replace('{ticket.severity.score}', ticket.severity.score.toString())
        .replace('{ticket.impact.dimensions.impactScope}', ticket.impact.dimensions.impactScope)
        .replace('{ticket.impact.dimensions.urgency}', ticket.impact.dimensions.urgency)
    
    response = llm.complete(prompt, {
        model: 'claude-sonnet-4-20250514',
        temperature: 0.2,  // 低温度确保一致性
        maxTokens: 1000,
        responseFormat: { type: 'json' }
    })
    
    return parseJSON(response)
}
```

### 7.3 规则与LLM融合

```
function fuseRuleAndLLM(
    ruleCandidates: RoutingRule[],
    llmRecommendation: LLMRoutingResult
): FusedDecision {
    // 如果LLM推荐与最高优先级规则一致
    topRule = ruleCandidates[0]
    if topRule.targetAgent == llmRecommendation.recommendedAgent:
        return {
            targetAgent: topRule.targetAgent,
            confidence: min(0.98, topRule.confidence * 0.6 + llmRecommendation.confidence * 0.4),
            strategy: 'RULE_LLM_AGREED',
            reason: `Rule ${topRule.ruleId} and LLM agree on ${topRule.targetAgent}`
        }
    
    // 如果不一致，进行加权决策
    ruleWeight = 0.5
    llmWeight = 0.5
    
    // 如果LLM置信度很高，增加LLM权重
    if llmRecommendation.confidence > 0.85:
        llmWeight = 0.6
        ruleWeight = 0.4
    
    // 如果规则置信度很高，增加规则权重
    if topRule.confidence > 0.9:
        ruleWeight = 0.6
        llmWeight = 0.4
    
    // 构建Agent得分表
    agentScores = {}
    for rule in ruleCandidates:
        agentScores[rule.targetAgent] = (agentScores[rule.targetAgent] || 0) 
            + rule.confidence * ruleWeight / ruleCandidates.length
    
    agentScores[llmRecommendation.recommendedAgent] = 
        (agentScores[llmRecommendation.recommendedAgent] || 0)
        + llmRecommendation.confidence * llmWeight
    
    if llmRecommendation.secondaryAgent:
        agentScores[llmRecommendation.secondaryAgent] = 
            (agentScores[llmRecommendation.secondaryAgent] || 0)
            + llmRecommendation.confidence * llmWeight * 0.3
    
    // 选择得分最高的Agent
    bestAgent = Object.entries(agentScores)
        .sort((a, b) => b[1] - a[1])[0]
    
    return {
        targetAgent: bestAgent[0],
        confidence: bestAgent[1],
        strategy: 'RULE_LLM_FUSED',
        reason: `Fused: ruleWeight=${ruleWeight}, llmWeight=${llmWeight}, scores=${JSON.stringify(agentScores)}`,
        ruleContrib: topRule,
        llmContrib: llmRecommendation
    }
}
```

### 7.4 历史学习校正

```
function applyHistoricalCorrection(
    decision: FusedDecision,
    ticket: Ticket,
    history: RouteHistory[]
): CorrectedDecision {
    // 查询该Agent处理同类问题的历史表现
    relevantHistory = history.filter(h => 
        h.targetAgent == decision.targetAgent &&
        h.ticketType == ticket.type &&
        h.module == ticket.module
    )
    
    if relevantHistory.length < 3:
        // 历史数据不足，不做校正
        return { ...decision, adjustment: 0, correctionApplied: false }
    
    // 计算历史成功率
    successRate = relevantHistory.filter(h => h.successful).length / relevantHistory.length
    avgFixTime = mean(relevantHistory.map(h => h.fixTimeMinutes))
    
    adjustment = 0
    correctionReason = []
    
    // 校正1: 历史成功率低 → 降低置信度
    if successRate < 0.5:
        adjustment -= 0.15
        correctionReason.push(`Low historical success rate: ${successRate}`)
    elif successRate > 0.8:
        adjustment += 0.05
        correctionReason.push(`High historical success rate: ${successRate}`)
    
    // 校正2: 历史修复时间过长 → 建议备选Agent
    if avgFixTime > 240:  // > 4小时
        adjustment -= 0.1
        correctionReason.push(`Long historical fix time: ${avgFixTime}min`)
    
    // 校正3: 最近是否有同类问题复发
    recentReoccurrence = relevantHistory
        .filter(h => h.reoccurred && h.timestamp > now() - 7*24*3600*1000)
    if recentReoccurrence.length > 0:
        adjustment -= 0.1 * min(recentReoccurrence.length, 3)
        correctionReason.push(`${recentReoccurrence.length} recent reoccurrences`)
    
    // 应用校正
    correctedConfidence = clamp(decision.confidence + adjustment, 0.1, 1.0)
    
    // 如果校正后置信度低于阈值，检查是否有历史表现更好的Agent
    if correctedConfidence < 0.5:
        alternativeAgents = findBetterHistoricalAgent(ticket, history)
        if alternativeAgents.length > 0:
            return {
                ...decision,
                targetAgent: alternativeAgents[0].agent,
                confidence: alternativeAgents[0].historicalSuccessRate,
                adjustment: adjustment,
                correctionApplied: true,
                correctionReason: [...correctionReason, 'switched_to_better_historical_agent'],
                originalTarget: decision.targetAgent
            }
    
    return {
        ...decision,
        confidence: correctedConfidence,
        adjustment: adjustment,
        correctionApplied: adjustment != 0,
        correctionReason
    }
}
```

### 7.5 路由失败降级

```
// 降级策略层次
function fallbackToHumanReview(ticket: Ticket, failedDecision: RoutingDecision): RoutingDecision {
    // 记录路由失败
    logRouteFailure(ticket, failedDecision)
    
    return {
        targetAgent: 'HumanReviewQueue',
        confidence: failedDecision.confidence,
        strategy: 'FALLBACK_HUMAN_REVIEW',
        reason: `Routing failed: confidence ${failedDecision.confidence} below threshold. Original attempt: ${failedDecision.strategy}`,
        originalDecision: failedDecision,
        escalation: {
            level: failedDecision.confidence < 0.3 ? 'URGENT' : 'NORMAL',
            notify: ['tech_lead', 'router_admin'],
            timeout: failedDecision.confidence < 0.3 ? 30 * 60 * 1000 : 4 * 3600 * 1000
            // 30分钟或4小时后如仍无人处理，再次升级
        },
        humanReviewContext: {
            suggestedAgents: inferSuggestedAgents(failedDecision),
            complexity: assessTicketComplexity(ticket),
            requiredSkills: extractRequiredSkills(ticket)
        }
    }
}

// 人工审查队列状态机
HumanReviewQueue:
  STATES:
    - PENDING_REVIEW: 等待人工审查
    - ASSIGNED: 已分配给审查人员
    - ROUTED: 人工完成路由决策
    - ESCALATED: 超时升级
  
  TRANSITIONS:
    PENDING_REVIEW → ASSIGNED: onAssign(reviewer)
    PENDING_REVIEW → ESCALATED: onTimeout(timeoutMs)
    ASSIGNED → ROUTED: onDecision(agent, reason)
    ASSIGNED → ESCALATED: onReviewerTimeout()
    ESCALATED → ASSIGNED: onEscalationAssign(seniorReviewer)
```

### 7.6 路由结果置信度评分

```
function evaluateConfidence(decision: RoutingDecision): number {
    factors = {
        // 策略可信度
        strategyConfidence: {
            'RULE_BASED': 0.9,
            'RULE_LLM_AGREED': 0.95,
            'RULE_LLM_FUSED': 0.75,
            'LLM_BASED': 0.65,
            'HISTORY_CORRECTED': 0.7,
            'FALLBACK_HUMAN_REVIEW': 0.1
        }[decision.strategy] || 0.5,
        
        // 历史成功率
        historicalSuccess: getHistoricalSuccessRate(decision.targetAgent, decision.ticketType) || 0.5,
        
        // 规则匹配数 (多条规则匹配更可靠)
        ruleMatchCount: min(decision.ruleMatches || 1, 5) / 5,
        
        // 信息完整性
        infoCompleteness: assessInformationCompleteness(decision.ticket)
    }
    
    weights = {
        strategyConfidence: 0.35,
        historicalSuccess: 0.30,
        ruleMatchCount: 0.15,
        infoCompleteness: 0.20
    }
    
    confidence = 0
    for factor, weight in weights:
        confidence += factors[factor] * weight
    
    return clamp(confidence, 0, 1)
}
```



---

## 8. TypeScript Interfaces

### 8.1 核心类型定义

```typescript
// ═══════════════════════════════════════════════════════════════
// 基础枚举类型
// ═══════════════════════════════════════════════════════════════

/** 工单优先级 P0-P4 */
export enum Priority {
    P0 = 'P0',  // 紧急/Critical
    P1 = 'P1',  // 高/High
    P2 = 'P2',  // 中/Medium
    P3 = 'P3',  // 低/Low
    P4 = 'P4',  // 建议/Suggestion
}

/** 工单类型 */
export enum TicketType {
    ANOMALY = 'anomaly',           // 异常报告
    PERFORMANCE = 'performance',   // 性能报告
    REQUIREMENT = 'requirement',   // 需求报告
    SECURITY = 'security',         // 安全问题
    REFACTOR = 'refactor',         // 重构需求
    TEST = 'test',                 // 测试相关
    DOCUMENTATION = 'documentation',// 文档相关
    DEPLOYMENT = 'deployment',     // 部署问题
}

/** 工单状态 */
export enum TicketStatus {
    CREATED = 'created',
    CLASSIFIED = 'classified',
    ROUTED = 'routed',
    ASSIGNED = 'assigned',
    IN_PROGRESS = 'in_progress',
    BLOCKED = 'blocked',
    PENDING_REVIEW = 'pending_review',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    DEPLOYING = 'deploying',
    DEPLOY_FAILED = 'deploy_failed',
    ROLLING_BACK = 'rolling_back',
    VERIFIED = 'verified',
    MERGED = 'merged',
    SPLIT = 'split',
    CLOSED = 'closed',
}

/** 目标Agent类型 */
export enum TargetAgent {
    FIX = 'FixAgent',
    OPTIMIZE = 'OptimizeAgent',
    FEATURE = 'FeatureAgent',
    REFACTOR = 'RefactorAgent',
    SECURITY = 'SecurityAgent',
    TEST = 'TestAgent',
    DOCUMENTATION = 'DocAgent',
    DEPLOYMENT = 'DeployAgent',
    HUMAN_REVIEW = 'HumanReviewQueue',
}

/** 影响面级别 */
export enum ImpactScope {
    BLOCKING = 'blocking',       // 作者创作受阻
    DEGRADED = 'degraded',       // 功能降级
    PERFORMANCE = 'performance', // 性能下降
    INFORMATIONAL = 'informational', // 纯信息
}

/** 紧急度级别 */
export enum Urgency {
    CRITICAL = 'critical',     // 立即崩溃
    ESCALATING = 'escalating', // 逐步恶化
    DEFERRABLE = 'deferrable', // 可延后
    OPTIONAL = 'optional',     // 可选优化
}

/** 可恢复性级别 */
export enum Recoverability {
    AUTO = 'auto',       // 自动恢复
    RESTART = 'restart', // 需重启
    FIX = 'fix',         // 需修复
    IRREVERSIBLE = 'irreversible', // 不可逆
}

/** 关联度级别 */
export enum Connectivity {
    ISOLATED = 'isolated',     // 孤立问题
    LOCAL = 'local',           // 局部影响
    CROSS_LAYER = 'cross_layer',// 跨层影响
    SYSTEMIC = 'systemic',     // 系统性风险
}

/** 路由策略 */
export enum RoutingStrategy {
    RULE_BASED = 'RULE_BASED',
    LLM_BASED = 'LLM_BASED',
    RULE_LLM_AGREED = 'RULE_LLM_AGREED',
    RULE_LLM_FUSED = 'RULE_LLM_FUSED',
    HISTORY_CORRECTED = 'HISTORY_CORRECTED',
    FALLBACK_HUMAN_REVIEW = 'FALLBACK_HUMAN_REVIEW',
}

// ═══════════════════════════════════════════════════════════════
// 严重评估相关接口
// ═══════════════════════════════════════════════════════════════

/** 四维严重评估评分 */
export interface SeverityDimensions {
    /** D1: 影响面 0-1 */
    impactScope: number;
    /** D2: 紧急度 0-1 */
    urgency: number;
    /** D3: 可恢复性 0-1 */
    recoverability: number;
    /** D4: 关联度 0-1 */
    connectivity: number;
}

/** 动态调整记录 */
export interface SeverityAdjustment {
    type: string;
    value: number;
    reason?: string;
}

/** 严重评估结果 */
export interface SeverityAssessment {
    priority: Priority;
    score: number;
    dimensions: SeverityDimensions;
    adjustments: SeverityAdjustment[];
    reasoning: string;
}

// ═══════════════════════════════════════════════════════════════
// 影响分析相关接口
// ═══════════════════════════════════════════════════════════════

/** 叙事影响评估 */
export interface NarrativeImpact {
    worldRuleAffected: boolean;
    ruleChangeScope: 'none' | 'minor' | 'major' | 'fundamental';
    settingConsistencyRisk: number;
    affectedSettings: string[];
    foreshadowingDisrupted: boolean;
    affectedForeshadowings: string[];
    characterConsistencyRisk: number;
    affectedCharacters: string[];
    timelineIntegrityRisk: number;
    overallScore: number;
}

/** 功能影响评估 */
export interface FunctionalImpact {
    apiCompatibility: 'backward_compatible' | 'breaking_change' | 'new_api';
    affectedEndpoints: string[];
    changeType: 'fix' | 'enhancement' | 'refactor' | 'removal' | 'new_feature';
    userVisible: boolean;
    uiChanges: boolean;
    workflowChanges: boolean;
    configChanges: boolean;
    migrationRequired: boolean;
    disruptionScore: number;
}

/** 性能影响评估 */
export interface PerformanceImpact {
    latencyChange: number;
    latencyChangePercent: number;
    cpuImpact: number;
    memoryImpact: number;
    ioImpact: number;
    throughputChangePercent: number;
    scalabilityImpact: 'improved' | 'neutral' | 'degraded';
    overallScore: number;
}

/** 安全影响评估 */
export interface SecurityImpact {
    dataExposureRisk: number;
    affectedDataClasses: string[];
    authChanges: boolean;
    authorizationChanges: boolean;
    cveLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
    attackVector: string[];
    complianceAffected: string[];
    overallScore: number;
}

/** 完整影响评估 */
export interface ImpactAssessment {
    narrative: NarrativeImpact;
    functional: FunctionalImpact;
    performance: PerformanceImpact;
    security: SecurityImpact;
    regressionRisk: number;
    severity: SeverityAssessment;
}

/** 审批决策 */
export interface ApprovalDecision {
    required: boolean;
    reason: string;
    approvers: string[];
    urgency?: string;
    canOverride?: boolean;
    autoDeploy?: boolean;
    recommended?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 路由相关接口
// ═══════════════════════════════════════════════════════════════

/** 路由规则 */
export interface RoutingRule {
    id: string;
    problemType: string;
    targetAgent: TargetAgent;
    triggerCondition: string;
    priority: number;
    confidence: number;
    batchAggregation: boolean;
    needApproval: boolean;
    specificityScore?: number;
}

/** 路由历史记录 */
export interface RouteHistoryEntry {
    ruleId: string;
    targetAgent: TargetAgent;
    ticketType: TicketType;
    module: string;
    successful: boolean;
    fixTimeMinutes: number;
    reoccurred: boolean;
    timestamp: Date;
}

/** 路由决策 */
export interface RoutingDecision {
    targetAgent: TargetAgent;
    confidence: number;
    strategy: RoutingStrategy;
    reason: string;
    ruleMatches?: RoutingRule[];
    llmContrib?: LLMRoutingResult;
    historicalAdjustment?: number;
    correctionApplied?: boolean;
    correctionReason?: string[];
    originalDecision?: RoutingDecision;
    originalTarget?: TargetAgent;
    finalConfidence?: number;
    escalation?: {
        level: 'URGENT' | 'NORMAL';
        notify: string[];
        timeout: number;
    };
    humanReviewContext?: {
        suggestedAgents: string[];
        complexity: string;
        requiredSkills: string[];
    };
}

/** LLM路由分析结果 */
export interface LLMRoutingResult {
    recommendedAgent: string;
    confidence: number;
    reasoning: string;
    secondaryAgent?: string;
    riskFactors: string[];
    additionalContext?: string;
}

// ═══════════════════════════════════════════════════════════════
// 依赖分析相关接口
// ═══════════════════════════════════════════════════════════════

/** 模块节点 */
export interface ModuleNode {
    id: string;
    name: string;
    layer: 'coordination' | 'agent' | 'service' | 'data' | 'infrastructure';
    subEngine?: string;        // 所属子引擎
    criticalPath: boolean;     // 是否在关键路径上
    llmDependency: 'P0' | 'P1' | 'P2' | 'P3';  // LLM依赖等级
}

/** 依赖边 */
export interface DependencyEdge {
    source: string;
    target: string;
    type: 'import' | 'api_call' | 'event' | 'shared_data' | 'config';
    weight: number;  // 影响权重 0-1
    bidirectional: boolean;
}

/** 依赖图谱 */
export interface DependencyGraph {
    nodes: ModuleNode[];
    edges: DependencyEdge[];
    cycles: string[][];  // 检测到的环路
}

/** 变更集 */
export interface ChangeSet {
    sourceModules: string[];
    testFiles: string[];
    docFiles: string[];
    estimatedEffort: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    rollbackPlan: string;
}

// ═══════════════════════════════════════════════════════════════
// 工单相关接口
// ═══════════════════════════════════════════════════════════════

/** 原始报告 */
export interface RawReport {
    id: string;
    source: 'telemetry_anomaly' | 'telemetry_performance' | 'telemetry_requirement';
    title: string;
    description: string;
    module: string;
    timestamp: Date;
    rawData: Record<string, unknown>;
}

/** 工单依赖关系 */
export interface TicketDependencies {
    blocks: string[];       // 此工单阻塞的其他工单
    blockedBy: string[];    // 阻塞此工单的其他工单
    relatesTo: string[];    // 相关的其他工单
}

/** 工单处理信息 */
export interface TicketProcessing {
    assignedAt?: Date;
    assignedTo?: TargetAgent;
    startedAt?: Date;
    progress: number;  // 0-100
    solution?: string;
    testReport?: string;
    codeReview?: string;
}

/** 工单部署信息 */
export interface TicketDeployment {
    approvalStatus: 'pending' | 'approved' | 'rejected';
    approvedBy?: string[];
    approvedAt?: Date;
    deployedAt?: Date;
    rollbackMarked: boolean;
    rollbackReason?: string;
    verificationStatus: 'pending' | 'passed' | 'failed';
    verifiedAt?: Date;
}

/** 聚合信息 */
export interface TicketAggregation {
    batchable: boolean;
    bundleId?: string;
    isPrimary: boolean;
    subIssues?: string[];
    parentTicket?: string;
}

/** 工单实体 */
export interface Ticket {
    // 基本信息
    id: string;
    title: string;
    description: string;
    source: string;
    createdAt: Date;
    updatedAt: Date;
    closedAt?: Date;

    // 分类信息
    type: TicketType;
    severity: SeverityAssessment;
    module: string;
    tags: string[];

    // 路由信息
    routing: RoutingDecision;
    targetAgent: TargetAgent;

    // 依赖关系
    dependencies: TicketDependencies;

    // 处理信息
    processing: TicketProcessing;

    // 部署信息
    deployment: TicketDeployment;

    // 状态
    status: TicketStatus;

    // 聚合信息
    aggregation: TicketAggregation;

    // 合并/拆分历史
    mergeHistory?: MergeRecord[];
    childTickets?: string[];
    parentTicket?: string;

    // 影响评估
    impact?: ImpactAssessment;
    approvalDecision?: ApprovalDecision;

    // 变更集
    changeSet?: ChangeSet;
}

/** 合并记录 */
export interface MergeRecord {
    mergedAt: Date;
    mergedTicketId: string;
    mergeScore: number;
    reason: string;
}

// ═══════════════════════════════════════════════════════════════
// 系统上下文接口
// ═══════════════════════════════════════════════════════════════

/** 系统上下文 */
export interface SystemContext {
    authorId?: string;
    authorFlowState: 'in_flow' | 'struggling' | 'blocked' | 'idle';
    flowEntropy: number;  // 0-1
    blockedModule?: string;
    systemLoad: number;   // 0-1
    businessPriority: 'normal' | 'release_critical' | 'user_experience_focus';
    currentHour: number;  // 0-23
    dependencyGraph: DependencyGraph;
    routeHistory: RouteHistoryEntry[];
}

/** 分类路由系统配置 */
export interface RouterConfig {
    severityWeights: {
        impactScope: number;
        urgency: number;
        recoverability: number;
        connectivity: number;
    };
    priorityThresholds: {
        P0: number;
        P1: number;
        P2: number;
        P3: number;
        P4: number;
    };
    flowEntropyThresholds: {
        critical: number;
        high: number;
    };
    routing: {
        confidenceThreshold: number;
        llmTemperature: number;
        llmModel: string;
        rulePriorityWeight: number;
        llmWeight: number;
        historyWeight: number;
        maxRulesToMatch: number;
        humanReviewTimeout: number;
    };
    aggregation: {
        timeWindowMs: number;
        maxBundleSize: number;
        similarityThreshold: number;
    };
    merge: {
        timeWindowMs: number;
        threshold: number;
    };
    escalation: {
        recurrenceWindowDays: number;
        recurrenceLevels: number[];  // [0.08, 0.15, 0.25] for 2,3,5+
    };
}
```

---

## 9. Ticket JSON Schema

```json
{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "$id": "https://narrativeos.dev/schemas/ticket.json",
    "title": "DevAgent Ticket",
    "description": "NarrativeOS DevAgent Cluster 工单数据结构",
    "type": "object",
    "required": ["id", "title", "description", "source", "createdAt", "type", "severity", "module", "tags", "routing", "targetAgent", "dependencies", "processing", "deployment", "status", "aggregation"],
    "properties": {
        "id": {
            "type": "string",
            "description": "工单唯一标识，格式: TICK-{timestamp}-{hash}",
            "pattern": "^TICK-[0-9]{14}-[a-f0-9]{8}$"
        },
        "title": {
            "type": "string",
            "description": "工单标题",
            "minLength": 1,
            "maxLength": 200
        },
        "description": {
            "type": "string",
            "description": "工单详细描述，包含问题详情、上下文、复现步骤等",
            "minLength": 1
        },
        "source": {
            "type": "string",
            "description": "工单来源标识，如遥测报告ID或手动创建标记"
        },
        "createdAt": {
            "type": "string",
            "format": "date-time",
            "description": "工单创建时间 (ISO 8601)"
        },
        "updatedAt": {
            "type": "string",
            "format": "date-time",
            "description": "工单最后更新时间 (ISO 8601)"
        },
        "closedAt": {
            "type": "string",
            "format": "date-time",
            "description": "工单关闭时间 (ISO 8601)"
        },
        "type": {
            "type": "string",
            "enum": ["anomaly", "performance", "requirement", "security", "refactor", "test", "documentation", "deployment"],
            "description": "工单类型"
        },
        "severity": {
            "type": "object",
            "description": "严重性评估结果",
            "required": ["priority", "score", "dimensions", "adjustments", "reasoning"],
            "properties": {
                "priority": {
                    "type": "string",
                    "enum": ["P0", "P1", "P2", "P3", "P4"],
                    "description": "优先级 P0(紧急) 到 P4(建议)"
                },
                "score": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "严重性综合得分 0-1"
                },
                "dimensions": {
                    "type": "object",
                    "description": "四维评估评分",
                    "required": ["impactScope", "urgency", "recoverability", "connectivity"],
                    "properties": {
                        "impactScope": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 1,
                            "description": "D1: 影响面 0-1"
                        },
                        "urgency": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 1,
                            "description": "D2: 紧急度 0-1"
                        },
                        "recoverability": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 1,
                            "description": "D3: 可恢复性 0-1"
                        },
                        "connectivity": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 1,
                            "description": "D4: 关联度 0-1"
                        }
                    }
                },
                "adjustments": {
                    "type": "array",
                    "description": "动态调整记录",
                    "items": {
                        "type": "object",
                        "required": ["type", "value"],
                        "properties": {
                            "type": {
                                "type": "string",
                                "enum": ["RECURRENCE_ESCALATION", "FLOW_ENTROPY_ESCALATION", "TIME_OF_DAY", "HIGH_FLOW_ENTROPY_ESCALATION", "MERGE_ESCALATION", "AGE_ESCALATION", "FLOW_ASSIST", "FLOW_CRITICAL", "FLOW_DEFER", "HIGH_LOAD_DEFER", "LOW_LOAD_BATCH", "RELEASE_CRITICAL", "UX_FOCUS"]
                            },
                            "value": {
                                "type": "number",
                                "description": "调整值 (正数=升级, 负数=降级)"
                            },
                            "reason": {
                                "type": "string"
                            }
                        }
                    }
                },
                "reasoning": {
                    "type": "string",
                    "description": "评估推理说明"
                }
            }
        },
        "module": {
            "type": "string",
            "description": "问题所属模块，如 world-engine/studio-engine/advisor 等"
        },
        "tags": {
            "type": "array",
            "description": "标签列表，用于分类和筛选",
            "items": {
                "type": "string"
            }
        },
        "routing": {
            "type": "object",
            "description": "路由决策详情",
            "required": ["targetAgent", "confidence", "strategy", "reason"],
            "properties": {
                "targetAgent": {
                    "type": "string",
                    "enum": ["FixAgent", "OptimizeAgent", "FeatureAgent", "RefactorAgent", "SecurityAgent", "TestAgent", "DocAgent", "DeployAgent", "HumanReviewQueue"]
                },
                "confidence": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                },
                "strategy": {
                    "type": "string",
                    "enum": ["RULE_BASED", "LLM_BASED", "RULE_LLM_AGREED", "RULE_LLM_FUSED", "HISTORY_CORRECTED", "FALLBACK_HUMAN_REVIEW"]
                },
                "reason": {
                    "type": "string"
                },
                "ruleMatches": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "ruleId": { "type": "string" },
                            "targetAgent": { "type": "string" },
                            "confidence": { "type": "number" }
                        }
                    }
                },
                "llmContrib": {
                    "type": "object",
                    "properties": {
                        "recommendedAgent": { "type": "string" },
                        "confidence": { "type": "number" },
                        "reasoning": { "type": "string" },
                        "secondaryAgent": { "type": "string" }
                    }
                },
                "historicalAdjustment": {
                    "type": "number"
                },
                "finalConfidence": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                }
            }
        },
        "targetAgent": {
            "type": "string",
            "enum": ["FixAgent", "OptimizeAgent", "FeatureAgent", "RefactorAgent", "SecurityAgent", "TestAgent", "DocAgent", "DeployAgent", "HumanReviewQueue"]
        },
        "dependencies": {
            "type": "object",
            "description": "工单依赖关系",
            "required": ["blocks", "blockedBy", "relatesTo"],
            "properties": {
                "blocks": {
                    "type": "array",
                    "description": "此工单阻塞的其他工单ID",
                    "items": { "type": "string" }
                },
                "blockedBy": {
                    "type": "array",
                    "description": "阻塞此工单的其他工单ID",
                    "items": { "type": "string" }
                },
                "relatesTo": {
                    "type": "array",
                    "description": "相关工单ID",
                    "items": { "type": "string" }
                }
            }
        },
        "processing": {
            "type": "object",
            "description": "处理进度信息",
            "required": ["progress"],
            "properties": {
                "assignedAt": {
                    "type": "string",
                    "format": "date-time"
                },
                "assignedTo": {
                    "type": "string"
                },
                "startedAt": {
                    "type": "string",
                    "format": "date-time"
                },
                "progress": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 100,
                    "description": "处理进度百分比"
                },
                "solution": {
                    "type": "string",
                    "description": "解决方案描述"
                },
                "testReport": {
                    "type": "string",
                    "description": "测试报告"
                },
                "codeReview": {
                    "type": "string",
                    "description": "代码审查记录"
                }
            }
        },
        "deployment": {
            "type": "object",
            "description": "部署信息",
            "required": ["approvalStatus", "rollbackMarked", "verificationStatus"],
            "properties": {
                "approvalStatus": {
                    "type": "string",
                    "enum": ["pending", "approved", "rejected"]
                },
                "approvedBy": {
                    "type": "array",
                    "items": { "type": "string" }
                },
                "approvedAt": {
                    "type": "string",
                    "format": "date-time"
                },
                "deployedAt": {
                    "type": "string",
                    "format": "date-time"
                },
                "rollbackMarked": {
                    "type": "boolean"
                },
                "rollbackReason": {
                    "type": "string"
                },
                "verificationStatus": {
                    "type": "string",
                    "enum": ["pending", "passed", "failed"]
                },
                "verifiedAt": {
                    "type": "string",
                    "format": "date-time"
                }
            }
        },
        "status": {
            "type": "string",
            "enum": ["created", "classified", "routed", "assigned", "in_progress", "blocked", "pending_review", "approved", "rejected", "deploying", "deploy_failed", "rolling_back", "verified", "merged", "split", "closed"]
        },
        "aggregation": {
            "type": "object",
            "required": ["batchable", "isPrimary"],
            "properties": {
                "batchable": {
                    "type": "boolean"
                },
                "bundleId": {
                    "type": "string"
                },
                "isPrimary": {
                    "type": "boolean"
                },
                "subIssues": {
                    "type": "array",
                    "items": { "type": "string" }
                }
            }
        },
        "mergeHistory": {
            "type": "array",
            "description": "合并历史记录",
            "items": {
                "type": "object",
                "required": ["mergedAt", "mergedTicketId", "mergeScore", "reason"],
                "properties": {
                    "mergedAt": { "type": "string", "format": "date-time" },
                    "mergedTicketId": { "type": "string" },
                    "mergeScore": { "type": "number" },
                    "reason": { "type": "string" }
                }
            }
        },
        "childTickets": {
            "type": "array",
            "description": "拆分后的子工单ID",
            "items": { "type": "string" }
        },
        "parentTicket": {
            "type": "string",
            "description": "父工单ID (对于合并/拆分)"
        },
        "impact": {
            "type": "object",
            "description": "完整影响评估",
            "properties": {
                "narrative": {
                    "type": "object",
                    "properties": {
                        "worldRuleAffected": { "type": "boolean" },
                        "ruleChangeScope": { "type": "string", "enum": ["none", "minor", "major", "fundamental"] },
                        "settingConsistencyRisk": { "type": "number", "minimum": 0, "maximum": 1 },
                        "affectedSettings": { "type": "array", "items": { "type": "string" } },
                        "foreshadowingDisrupted": { "type": "boolean" },
                        "affectedForeshadowings": { "type": "array", "items": { "type": "string" } },
                        "characterConsistencyRisk": { "type": "number", "minimum": 0, "maximum": 1 },
                        "affectedCharacters": { "type": "array", "items": { "type": "string" } },
                        "timelineIntegrityRisk": { "type": "number", "minimum": 0, "maximum": 1 },
                        "overallScore": { "type": "number", "minimum": 0, "maximum": 1 }
                    }
                },
                "functional": {
                    "type": "object",
                    "properties": {
                        "apiCompatibility": { "type": "string", "enum": ["backward_compatible", "breaking_change", "new_api"] },
                        "affectedEndpoints": { "type": "array", "items": { "type": "string" } },
                        "changeType": { "type": "string", "enum": ["fix", "enhancement", "refactor", "removal", "new_feature"] },
                        "userVisible": { "type": "boolean" },
                        "uiChanges": { "type": "boolean" },
                        "workflowChanges": { "type": "boolean" },
                        "configChanges": { "type": "boolean" },
                        "migrationRequired": { "type": "boolean" },
                        "disruptionScore": { "type": "number", "minimum": 0, "maximum": 1 }
                    }
                },
                "performance": {
                    "type": "object",
                    "properties": {
                        "latencyChange": { "type": "number" },
                        "latencyChangePercent": { "type": "number" },
                        "cpuImpact": { "type": "number" },
                        "memoryImpact": { "type": "number" },
                        "ioImpact": { "type": "number" },
                        "throughputChangePercent": { "type": "number" },
                        "scalabilityImpact": { "type": "string", "enum": ["improved", "neutral", "degraded"] },
                        "overallScore": { "type": "number", "minimum": -1, "maximum": 1 }
                    }
                },
                "security": {
                    "type": "object",
                    "properties": {
                        "dataExposureRisk": { "type": "number", "minimum": 0, "maximum": 1 },
                        "affectedDataClasses": { "type": "array", "items": { "type": "string" } },
                        "authChanges": { "type": "boolean" },
                        "authorizationChanges": { "type": "boolean" },
                        "cveLevel": { "type": "string", "enum": ["none", "low", "medium", "high", "critical"] },
                        "attackVector": { "type": "array", "items": { "type": "string" } },
                        "complianceAffected": { "type": "array", "items": { "type": "string" } },
                        "overallScore": { "type": "number", "minimum": 0, "maximum": 1 }
                    }
                },
                "regressionRisk": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                }
            }
        },
        "approvalDecision": {
            "type": "object",
            "properties": {
                "required": { "type": "boolean" },
                "reason": { "type": "string" },
                "approvers": { "type": "array", "items": { "type": "string" } },
                "autoDeploy": { "type": "boolean" }
            }
        }
    }
}
```

---

## 10. Core Algorithms

### 10.1 严重性评估算法

```typescript
/**
 * SeverityAssessor — 四维加权严重性评估
 * 
 * @param report 原始遥测报告
 * @param context 系统上下文 (包含依赖图谱、Flow Guardian状态等)
 * @returns 严重性评估结果
 */
function assessSeverity(report: RawReport, context: SystemContext): SeverityAssessment {
    // ── Step 1: 四维基础评估 ─────────────────────────────
    const D1 = assessImpactScope(report, context);
    const D2 = assessUrgency(report, context);
    const D3 = assessRecoverability(report, context);
    const D4 = assessConnectivity(report, context);

    // ── Step 2: 基础加权 ────────────────────────────────
    const weights = context.config.severityWeights;
    const baseScore = weights.impactScope * D1 
                    + weights.urgency * D2 
                    + weights.recoverability * D3 
                    + weights.connectivity * D4;

    // ── Step 3: 动态调整 ────────────────────────────────
    const adjustments: SeverityAdjustment[] = [];

    // 3a: 重复问题升级
    const recurrenceCount = getRecurrenceCount(report.signature, 7);
    const recurrenceBonus = recurrenceCount >= 5 ? 0.25
                          : recurrenceCount >= 3 ? 0.15
                          : recurrenceCount >= 2 ? 0.08 : 0;
    if (recurrenceBonus > 0) {
        adjustments.push({
            type: 'RECURRENCE_ESCALATION',
            value: recurrenceBonus,
            reason: `问题在过去7天内复现${recurrenceCount}次`
        });
    }

    // 3b: 心流熵调节
    const flowEntropy = FlowGuardian.getCurrentEntropy(context.authorId);
    let flowAdjustment = 0;
    if (flowEntropy > context.config.flowEntropyThresholds.critical) {
        const flowMultiplier = 1.0 + 0.3 * (flowEntropy - 0.7) / 0.3;
        flowAdjustment = D1 * (flowMultiplier - 1);
        adjustments.push({
            type: 'FLOW_ENTROPY_ESCALATION',
            value: flowAdjustment,
            reason: `作者心流熵值 ${flowEntropy.toFixed(2)} > 临界值`
        });
    }

    // 3c: 时间衰减
    const hourMultiplier = getTimeOfDayMultiplier(context.currentHour);

    // ── Step 4: 综合计算 ────────────────────────────────
    const adjustedScore = Math.min(1.0, 
        Math.min(1.0, baseScore + recurrenceBonus + flowAdjustment) * hourMultiplier
    );

    // ── Step 5: 定级 ────────────────────────────────────
    const priority = mapScoreToPriority(adjustedScore, context.config.priorityThresholds);

    // ── Step 6: 生成推理说明 ─────────────────────────────
    const reasoning = generateSeverityReasoning(D1, D2, D3, D4, adjustments, priority);

    return {
        priority,
        score: parseFloat(adjustedScore.toFixed(4)),
        dimensions: { impactScope: D1, urgency: D2, recoverability: D3, connectivity: D4 },
        adjustments,
        reasoning
    };
}

// ── 辅助函数 ──────────────────────────────────────────────

function getRecurrenceCount(signature: string, days: number): number {
    // 查询数据库: 相同 signature 的问题在过去 N 天出现次数
    return db.tickets.count({
        where: {
            signature,
            createdAt: { gte: subDays(new Date(), days) },
            status: { notIn: ['closed', 'merged'] }
        }
    });
}

function getTimeOfDayMultiplier(hour: number): number {
    if (hour >= 20 || hour <= 2) return 1.15;   // 创作高峰
    if (hour >= 9 && hour <= 17) return 1.0;     // 工作时段
    return 0.9;                                    // 低活跃
}

function mapScoreToPriority(
    score: number, 
    thresholds: RouterConfig['priorityThresholds']
): Priority {
    if (score >= thresholds.P0) return Priority.P0;
    if (score >= thresholds.P1) return Priority.P1;
    if (score >= thresholds.P2) return Priority.P2;
    if (score >= thresholds.P3) return Priority.P3;
    return Priority.P4;
}
```

### 10.2 智能路由算法

```typescript
/**
 * SmartRouter — 三层混合路由决策
 * 
 * @param ticket 已分类的工单
 * @param context 路由上下文
 * @returns 路由决策
 */
function routeTicket(ticket: Ticket, context: RoutingContext): RoutingDecision {
    // ═══════════════════════════════════════════
    // Layer 1: 规则匹配
    // ═══════════════════════════════════════════
    const ruleMatches = ROUTING_RULES
        .filter(rule => matchesRule(ticket, rule))
        .sort((a, b) => a.priority - b.priority || b.confidence - a.confidence);

    if (ruleMatches.length === 1 && ruleMatches[0].confidence >= 0.9) {
        return {
            targetAgent: ruleMatches[0].targetAgent,
            confidence: ruleMatches[0].confidence,
            strategy: RoutingStrategy.RULE_BASED,
            reason: `高置信度规则匹配: ${ruleMatches[0].id}`
        };
    }

    // ═══════════════════════════════════════════
    // Layer 2: LLM分析 (补充或裁决)
    // ═══════════════════════════════════════════
    const llmResult = analyzeWithLLM(ticket, context, ruleMatches);

    let fusedDecision: RoutingDecision;

    if (ruleMatches.length > 0) {
        // 规则 + LLM 融合
        fusedDecision = fuseDecisions(ruleMatches, llmResult, context);
    } else {
        // 纯 LLM 推荐
        fusedDecision = {
            targetAgent: llmResult.recommendedAgent as TargetAgent,
            confidence: llmResult.confidence * 0.8,
            strategy: RoutingStrategy.LLM_BASED,
            reason: `LLM分析: ${llmResult.reasoning}`
        };
    }

    // ═══════════════════════════════════════════
    // Layer 3: 历史学习校正
    // ═══════════════════════════════════════════
    const corrected = applyHistoricalCorrection(fusedDecision, ticket, context.history);

    // ═══════════════════════════════════════════
    // 置信度评估与降级
    // ═══════════════════════════════════════════
    const finalConfidence = evaluateFinalConfidence(corrected);

    if (finalConfidence < context.config.routing.confidenceThreshold) {
        return fallbackToHumanReview(ticket, {
            ...corrected,
            finalConfidence
        });
    }

    return {
        ...corrected,
        finalConfidence
    };
}

/**
 * 规则匹配检查
 */
function matchesRule(ticket: Ticket, rule: RoutingRule): boolean {
    const typeMatch = ticket.type === rule.problemType ||
        (Array.isArray(rule.problemType) && rule.problemType.includes(ticket.type));
    
    if (!typeMatch) return false;

    // 评估触发条件 (简单的表达式引擎)
    return evaluateTriggerCondition(rule.triggerCondition, ticket);
}

/**
 * 融合规则与LLM决策
 */
function fuseDecisions(
    rules: RoutingRule[],
    llm: LLMRoutingResult,
    context: RoutingContext
): RoutingDecision {
    const topRule = rules[0];

    // 完全一致 → 高置信度
    if (topRule.targetAgent === llm.recommendedAgent) {
        return {
            targetAgent: topRule.targetAgent,
            confidence: Math.min(0.98, topRule.confidence * 0.6 + llm.confidence * 0.4),
            strategy: RoutingStrategy.RULE_LLM_AGREED,
            reason: `规则 ${topRule.id} 与LLM一致推荐 ${topRule.targetAgent}`
        };
    }

    // 不一致 → 加权决策
    const ruleWeight = topRule.confidence > 0.9 ? 0.6 : 0.5;
    const llmWeight = llm.confidence > 0.85 ? 0.6 : 0.5;
    const totalWeight = ruleWeight + llmWeight;

    const scores: Map<TargetAgent, number> = new Map();

    for (const rule of rules) {
        const current = scores.get(rule.targetAgent) || 0;
        scores.set(rule.targetAgent, current + rule.confidence * ruleWeight / rules.length);
    }

    const llmCurrent = scores.get(llm.recommendedAgent as TargetAgent) || 0;
    scores.set(llm.recommendedAgent as TargetAgent, llmCurrent + llm.confidence * llmWeight);

    const best = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
        targetAgent: best[0],
        confidence: best[1] / totalWeight,
        strategy: RoutingStrategy.RULE_LLM_FUSED,
        reason: `融合决策: 规则权重=${ruleWeight}, LLM权重=${llmWeight}, 得分分布=${JSON.stringify(Object.fromEntries(scores))}`,
        ruleMatches: rules,
        llmContrib: llm
    };
}
```

### 10.3 依赖环路检测算法

```typescript
/**
 * DependencyAnalyzer — 基于DFS的环路检测
 * 
 * @param graph 依赖图谱
 * @returns 检测到的所有环路
 */
function detectCycles(graph: DependencyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    function dfs(nodeId: string): void {
        visited.add(nodeId);
        recursionStack.add(nodeId);
        path.push(nodeId);

        const neighbors = graph.edges
            .filter(e => e.source === nodeId)
            .map(e => e.target);

        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                dfs(neighbor);
            } else if (recursionStack.has(neighbor)) {
                // 发现环路
                const cycleStart = path.indexOf(neighbor);
                const cycle = path.slice(cycleStart);
                cycles.push([...cycle]);
            }
        }

        path.pop();
        recursionStack.delete(nodeId);
    }

    for (const node of graph.nodes) {
        if (!visited.has(node.id)) {
            dfs(node.id);
        }
    }

    // 去重 (规范化环路表示)
    return deduplicateCycles(cycles);
}

/**
 * 最小变更集计算
 */
function computeMinimalChangeSet(
    rootModule: string,
    issue: TicketType,
    graph: DependencyGraph
): ChangeSet {
    const modulesToChange = new Set<string>([rootModule]);
    const affectedByType = new Set<string>();

    // 根据问题类型传播影响
    switch (issue) {
        case TicketType.ANOMALY:
            // API 异常需要更新调用方
            addApiConsumers(rootModule, graph, affectedByType);
            break;
        case TicketType.PERFORMANCE:
            // 性能问题影响缓存策略
            addCacheDependents(rootModule, graph, affectedByType);
            break;
        case TicketType.SECURITY:
            // 安全问题影响认证/授权链
            addSecurityChain(rootModule, graph, affectedByType);
            break;
        default:
            addDirectConsumers(rootModule, graph, affectedByType);
    }

    for (const m of affectedByType) modulesToChange.add(m);

    // 测试覆盖
    const testsToUpdate = [...modulesToChange].flatMap(m => findTestsForModule(m));

    // 文档覆盖
    const docsToUpdate = [...modulesToChange]
        .filter(m => hasPublicAPI(m, graph))
        .map(m => getModuleDoc(m));

    return {
        sourceModules: [...modulesToChange],
        testFiles: [...new Set(testsToUpdate)],
        docFiles: docsToUpdate,
        estimatedEffort: estimateEffort(modulesToChange.size, testsToUpdate.length),
        riskLevel: assessChangeRisk([...modulesToChange], graph),
        rollbackPlan: generateRollbackPlan([...modulesToChange])
    };
}
```

### 10.4 工单聚合算法

```typescript
/**
 * TicketAggregator — 批量问题聚合
 * 
 * @param issues 原始问题列表
 * @returns 聚合后的工单包
 */
function aggregateIssues(issues: RawReport[]): TicketBundle[] {
    const bundles: TicketBundle[] = [];
    let unbundled = [...issues];

    for (const strategy of AGGREGATION_STRATEGIES) {
        const groups = groupBySimilarity(unbundled, strategy);

        for (const [key, group] of groups) {
            if (group.length < 2) continue;

            const timeSpan = Math.max(...group.map(i => i.timestamp.getTime()))
                         - Math.min(...group.map(i => i.timestamp.getTime()));

            if (timeSpan > strategy.timeWindowMs) continue;

            const similarity = computeGroupSimilarity(group);
            if (similarity < strategy.similarityThreshold) continue;

            const bundle = createBundle(
                group.slice(0, strategy.maxBundleSize)
            );
            bundles.push(bundle);
            unbundled = unbundled.filter(i => !group.includes(i));
        }
    }

    // 剩余未聚合的作为单问题
    for (const issue of unbundled) {
        bundles.push(createSingletonBundle(issue));
    }

    return bundles;
}

/**
 * 聚合包创建
 */
function createBundle(issues: RawReport[]): TicketBundle {
    const primary = issues.reduce((best, current) => 
        (getSeverityScore(current) > getSeverityScore(best)) ? current : best
    );

    return {
        id: `BUNDLE-${Date.now()}-${hash(primary.id)}`,
        type: 'aggregated',
        title: `[聚合] ${primary.title} 等 ${issues.length} 个问题`,
        description: synthesizeBundleDescription(issues),
        severity: Math.max(...issues.map(i => getSeverityScore(i))),
        primaryIssue: primary,
        subIssues: issues.filter(i => i.id !== primary.id),
        count: issues.length,
        timeSpan: Math.max(...issues.map(i => i.timestamp.getTime()))
               - Math.min(...issues.map(i => i.timestamp.getTime())),
        routingTarget: determineBundleRouting(issues)
    };
}
```

### 10.5 回归风险评分算法

```typescript
/**
 * RegressionRiskScorer — 回归风险评分
 * 
 * @param change 变更描述
 * @param history 项目历史数据
 * @returns 回归风险分数 0-1
 */
function calculateRegressionRisk(
    change: ChangeDescriptor,
    history: ProjectHistory
): number {
    const factors = {
        // 1. 变更复杂度
        complexity: Math.min(1.0, estimateChangeComplexity(change) / 10),

        // 2. 测试覆盖率缺口
        testCoverageGap: 1 - getAffectedAreaTestCoverage(change),

        // 3. 模块历史缺陷密度
        defectDensity: getModuleDefectDensity(change.targetModule) 
                     / (history.maxDefectDensity || 1),

        // 4. 变更类型风险
        changeTypeRisk: CHANGE_TYPE_RISK[change.type] ?? 0.4,

        // 5. 代码变动量
        changeSizeRisk: Math.min(1.0, (change.linesAdded + change.linesRemoved) / 500),

        // 6. 关键路径风险
        criticalPathRisk: change.touchesCriticalPath ? 0.8 : 0.1,

        // 7. 历史回归率
        historicalRegressionRate: getModuleHistoricalRegressionRate(
            change.targetModule, history
        )
    };

    const weights = {
        complexity: 0.15,
        testCoverageGap: 0.20,
        defectDensity: 0.15,
        changeTypeRisk: 0.15,
        changeSizeRisk: 0.10,
        criticalPathRisk: 0.15,
        historicalRegressionRate: 0.10
    };

    let risk = 0;
    for (const [factor, weight] of Object.entries(weights)) {
        risk += factors[factor as keyof typeof factors] * weight;
    }

    return Math.min(1.0, Math.max(0, risk));
}

const CHANGE_TYPE_RISK: Record<string, number> = {
    fix: 0.3,
    enhancement: 0.4,
    refactor: 0.6,
    removal: 0.5,
    new_feature: 0.4,
    dependency_upgrade: 0.5
};
```

---

## 11. Ticket State Machine

### 11.1 XState 状态机定义

```typescript
import { createMachine, assign } from 'xstate';
import type { Ticket, TicketStatus, RoutingDecision, TargetAgent } from './types';

/**
 * 工单生命周期状态机
 * 
 * 状态: created → classified → routed → assigned → in_progress → [pending_review] → 
 *       [approved|rejected] → [deploying] → [verified] → closed
 * 
 * 并行区域: 
 *   - 主生命周期 (上述状态流转)
 *   - 异常处理 (blocked, merged, split)
 *   - 部署保护 (审批、部署、回滚)
 */
export const ticketLifecycleMachine = createMachine({
    id: 'ticketLifecycle',
    initial: 'created',
    
    context: ({ input }: { input: { ticket: Ticket } }) => ({
        ticket: input.ticket,
        error: null as string | null,
        retryCount: 0,
        mergeParentId: null as string | null,
        childTicketIds: [] as string[],
    }),

    states: {
        // ── 初始: 工单已创建 ──────────────────────────
        created: {
            description: '工单刚创建，等待分类',
            on: {
                CLASSIFY: {
                    target: 'classified',
                    actions: assign({
                        ticket: ({ context, event }) => ({
                            ...context.ticket,
                            status: TicketStatus.CLASSIFIED,
                            severity: event.severity,
                            type: event.ticketType,
                            module: event.module,
                            tags: event.tags,
                            updatedAt: new Date()
                        })
                    }),
                    guard: ({ event }) => event.severity != null
                }
            },
            after: {
                // 30秒内未分类 → 自动分类超时
                30000: {
                    target: 'classified',
                    actions: assign({
                        ticket: ({ context }) => ({
                            ...context.ticket,
                            status: TicketStatus.CLASSIFIED,
                            severity: autoClassify(context.ticket),
                            tags: [...context.ticket.tags, 'auto-classified'],
                            updatedAt: new Date()
                        })
                    })
                }
            }
        },

        // ── 已分类: 等待路由 ──────────────────────────
        classified: {
            description: '工单已分类，等待路由决策',
            on: {
                ROUTE: {
                    target: 'routed',
                    actions: assign({
                        ticket: ({ context, event }) => ({
                            ...context.ticket,
                            status: TicketStatus.ROUTED,
                            routing: event.routing,
                            targetAgent: event.routing.targetAgent,
                            impact: event.impact,
                            updatedAt: new Date()
                        })
                    })
                },
                AUTO_ROUTE: {
                    target: 'routed',
                    actions: assign({
                        ticket: ({ context }) => {
                            const routing = executeAutoRouting(context.ticket);
                            return {
                                ...context.ticket,
                                status: TicketStatus.ROUTED,
                                routing,
                                targetAgent: routing.targetAgent,
                                updatedAt: new Date()
                            };
                        }
                    })
                }
            },
            after: {
                // 60秒内未路由 → 自动路由
                60000: { target: 'routed', actions: 'autoRoute' }
            }
        },

        // ── 已路由: 等待分配 ──────────────────────────
        routed: {
            description: '工单已路由，等待Agent分配',
            on: {
                ASSIGN: {
                    target: 'assigned',
                    actions: assign({
                        ticket: ({ context, event }) => ({
                            ...context.ticket,
                            status: TicketStatus.ASSIGNED,
                            processing: {
                                ...context.ticket.processing,
                                assignedAt: new Date(),
                                assignedTo: event.agent,
                                progress: 0
                            },
                            updatedAt: new Date()
                        })
                    }),
                    guard: ({ event, context }) => 
                        event.agent === context.ticket.targetAgent ||
                        event.agent === TargetAgent.HUMAN_REVIEW
                },
                RE_ROUTE: {
                    target: 'classified',
                    actions: assign({
                        ticket: ({ context }) => ({
                            ...context.ticket,
                            status: TicketStatus.CLASSIFIED,
                            tags: [...context.ticket.tags, 're-routed'],
                            updatedAt: new Date()
                        })
                    })
                }
            }
        },

        // ── 已分配: 等待Agent开始处理 ──────────────────
        assigned: {
            description: '工单已分配，Agent尚未开始',
            on: {
                START_WORK: {
                    target: 'in_progress',
                    actions: assign({
                        ticket: ({ context }) => ({
                            ...context.ticket,
                            status: TicketStatus.IN_PROGRESS,
                            processing: {
                                ...context.ticket.processing,
                                startedAt: new Date()
                            },
                            updatedAt: new Date()
                        })
                    })
                },
                // 分配后长时间未开始 → 重新路由
                TIMEOUT: { target: 'routed', actions: 'incrementRetry' }
            },
            after: {
                // 2小时未开始 → 超时
                7200000: { target: 'routed', actions: 'incrementRetry' }
            }
        },

        // ── 处理中: Agent正在工作 ─────────────────────
        in_progress: {
            description: 'Agent正在处理工单',
            on: {
                UPDATE_PROGRESS: {
                    actions: assign({
                        ticket: ({ context, event }) => ({
                            ...context.ticket,
                            processing: {
                                ...context.ticket.processing,
                                progress: event.progress
                            },
                            updatedAt: new Date()
                        })
                    })
                },
                SUBMIT_FOR_REVIEW: {
                    target: 'pending_review',
                    actions: assign({
                        ticket: ({ context, event }) => ({
                            ...context.ticket,
                            status: TicketStatus.PENDING_REVIEW,
                            processing: {
                                ...context.ticket.processing,
                                progress: 100,
                                solution: event.solution,
                                testReport: event.testReport
                            },
                            updatedAt: new Date()
                        })
                    }),
                    guard: ({ context }) => {
                        // 叙事影响或安全问题 → 必须审批
                        const needApproval = 
                            context.ticket.impact?.narrative.overallScore! >= 0.5 ||
                            context.ticket.impact?.security.overallScore! >= 0.5 ||
                            context.ticket.routing?.targetAgent === TargetAgent.SECURITY;
                        return needApproval;
                    }
                },
                // 不需要审批 → 直接部署
                MARK_FOR_DEPLOY: {
                    target: 'approved',
                    guard: ({ context }) => 
                        !context.ticket.approvalDecision?.required ?? false
                },
                BLOCK: {
                    target: 'blocked',
                    actions: assign({
                        ticket: ({ context, event }) => ({
                            ...context.ticket,
                            status: TicketStatus.BLOCKED,
                            dependencies: {
                                ...context.ticket.dependencies,
                                blockedBy: [...context.ticket.dependencies.blockedBy, event.blockerId]
                            },
                            updatedAt: new Date()
                        })
                    })
                },
                MERGE: {
                    target: 'merged',
                    actions: assign({
                        mergeParentId: ({ event }) => event.parentId
                    })
                },
                SPLIT: {
                    target: 'split',
                    actions: assign({
                        childTicketIds: ({ event }) => event.childIds
                    })
                }
            }
        },

        // ── 阻塞: 等待依赖解除 ────────────────────────
        blocked: {
            description: '工单因依赖问题阻塞',
            on: {
                UNBLOCK: {
                    target: 'in_progress',
                    actions: assign({
                        ticket: ({ context, event }) => ({
                            ...context.ticket,
                            status: TicketStatus.IN_PROGRESS,
                            dependencies: {
                                ...context.ticket.dependencies,
                                blockedBy: context.ticket.dependencies.blockedBy
                                    .filter(id => id !== event.unblockerId)
                            },
                            updatedAt: new Date()
                        })
                    }),
                    guard: ({ context, event }) => 
                        context.ticket.dependencies.blockedBy.length <= 1 ||
                        event.unblockAll === true
                }
            },
            after: {
                // 阻塞超过24小时 → 升级
                86400000: { actions: 'escalateBlockedTicket' }
            }
        },

        // ── 待审批: 等待人工/自动审批 ─────────────────
        pending_review: {
            description: '解决方案等待审批',
            on: {
                APPROVE: {
                    target: 'approved',
                    actions: assign({
                        ticket: ({ context, event }) => ({
                            ...context.ticket,
                            status: TicketStatus.APPROVED,
                            deployment: {
                                ...context.ticket.deployment,
                                approvalStatus: 'approved' as const,
                                approvedBy: event.approvers,
                                approvedAt: new Date()
                            },
                            updatedAt: new Date()
                        })
                    })
                },
                REJECT: {
                    target: 'rejected',
                    actions: assign({
                        ticket: ({ context, event }) => ({
                            ...context.ticket,
                            status: TicketStatus.REJECTED,
                            deployment: {
                                ...context.ticket.deployment,
                                approvalStatus: 'rejected' as const
                            },
                            updatedAt: new Date()
                        })
                    })
                }
            },
            after: {
                // 审批超时: P0=30min, P1=2h, P2=6h, P3=24h, P4=72h
                10800000: {  // 默认3小时
                    target: 'approved',
                    actions: assign({
                        ticket: ({ context }) => ({
                            ...context.ticket,
                            status: TicketStatus.APPROVED,
                            deployment: {
                                ...context.ticket.deployment,
                                approvalStatus: 'approved' as const,
                                approvedBy: ['auto-approval-timeout']
                            },
                            tags: [...context.ticket.tags, 'auto-approved-timeout'],
                            updatedAt: new Date()
                        })
                    }),
                    guard: ({ context }) => 
                        context.ticket.severity.priority !== Priority.P0
                }
            }
        },

        // ── 已拒绝: 需修改后重新提交 ──────────────────
        rejected: {
            description: '方案被驳回，需修改',
            on: {
                REVISE: {
                    target: 'in_progress',
                    actions: assign({
                        ticket: ({ context }) => ({
                            ...context.ticket,
                            status: TicketStatus.IN_PROGRESS,
                            processing: {
                                ...context.ticket.processing,
                                progress: Math.max(0, context.ticket.processing.progress - 30)
                            },
                            updatedAt: new Date()
                        })
                    })
                },
                // 拒绝超过3次 → 转人工
                REJECT_TOO_MANY: {
                    target: 'assigned',
                    actions: assign({
                        ticket: ({ context }) => ({
                            ...context.ticket,
                            status: TicketStatus.ASSIGNED,
                            targetAgent: TargetAgent.HUMAN_REVIEW,
                            routing: {
                                ...context.ticket.routing,
                                targetAgent: TargetAgent.HUMAN_REVIEW,
                                reason: '多次审批拒绝，转人工处理'
                            },
                            tags: [...context.ticket.tags, 'human-review-required'],
                            updatedAt: new Date()
                        })
                    }),
                    guard: ({ context }) => context.retryCount >= 3
                }
            }
        },

        // ── 已批准: 等待部署 ──────────────────────────
        approved: {
            description: '方案已批准，等待部署',
            on: {
                DEPLOY: {
                    target: 'deploying',
                    actions: assign({
                        ticket: ({ context }) => ({
                            ...context.ticket,
                            status: TicketStatus.DEPLOYING,
                            updatedAt: new Date()
                        })
                    })
                }
            },
            after: {
                // 批准后1小时未部署 → 自动触发
                3600000: { target: 'deploying' }
            }
        },

        // ── 部署中: 部署正在进行 ──────────────────────
        deploying: {
            description: '正在部署变更',
            on: {
                DEPLOY_SUCCESS: {
                    target: 'verified',
                    actions: assign({
                        ticket: ({ context }) => ({
                            ...context.ticket,
                            status: TicketStatus.VERIFIED,
                            deployment: {
                                ...context.ticket.deployment,
                                deployedAt: new Date(),
                                verificationStatus: 'pending'
                            },
                            updatedAt: new Date()
                        })
                    })
                },
                DEPLOY_FAILED: {
                    target: 'deploy_failed',
                    actions: assign({
                        ticket: ({ context, event }) => ({
                            ...context.ticket,
                            status: TicketStatus.DEPLOY_FAILED,
                            deployment: {
                                ...context.ticket.deployment,
                                rollbackMarked: true,
                                rollbackReason: event.reason
                            },
                            updatedAt: new Date()
                        })
                    })
                },
                ROLLBACK: {
                    target: 'rolling_back',
                    actions: assign({
                        ticket: ({ context }) => ({
                            ...context.ticket,
                            status: TicketStatus.ROLLING_BACK,
                            deployment: {
                                ...context.ticket.deployment,
                                rollbackMarked: true
                            },
                            updatedAt: new Date()
                        })
                    })
                }
            },
            after: {
                // 部署超过10分钟 → 超时
                600000: { target: 'deploy_failed', actions: 'markDeployTimeout' }
            }
        },

        // ── 部署失败: 需要处理 ────────────────────────
        deploy_failed: {
            description: '部署失败',
            on: {
                RETRY_DEPLOY: { target: 'deploying', actions: 'incrementRetry' },
                ROLLBACK: { target: 'rolling_back' }
            }
        },

        // ── 回滚中: 正在回滚 ──────────────────────────
        rolling_back: {
            description: '正在回滚变更',
            on: {
                ROLLBACK_COMPLETE: { target: 'in_progress' }
            }
        },

        // ── 已验证: 部署成功等待最终验证 ──────────────
        verified: {
            description: '已部署，观察期内',
            on: {
                VERIFY_PASS: {
                    target: 'closed',
                    actions: assign({
                        ticket: ({ context }) => ({
                            ...context.ticket,
                            status: TicketStatus.CLOSED,
                            deployment: {
                                ...context.ticket.deployment,
                                verificationStatus: 'passed',
                                verifiedAt: new Date()
                            },
                            closedAt: new Date(),
                            updatedAt: new Date()
                        })
                    })
                },
                VERIFY_FAIL: {
                    target: 'in_progress',
                    actions: assign({
                        ticket: ({ context }) => ({
                            ...context.ticket,
                            status: TicketStatus.IN_PROGRESS,
                            deployment: {
                                ...context.ticket.deployment,
                                verificationStatus: 'failed'
                            },
                            tags: [...context.ticket.tags, 'verification-failed'],
                            updatedAt: new Date()
                        })
                    })
                }
            },
            after: {
                // 观察期: P0=1天, P1=3天, P2=7天, P3=14天, P4=30天
                259200000: {  // 默认3天
                    target: 'closed',
                    actions: assign({
                        ticket: ({ context }) => ({
                            ...context.ticket,
                            status: TicketStatus.CLOSED,
                            deployment: {
                                ...context.ticket.deployment,
                                verificationStatus: 'passed',
                                verifiedAt: new Date()
                            },
                            closedAt: new Date(),
                            tags: [...context.ticket.tags, 'auto-resolved'],
                            updatedAt: new Date()
                        })
                    })
                }
            }
        },

        // ── 已合并: 合并到其他工单 ────────────────────
        merged: {
            description: '此工单已合并到其他工单',
            type: 'final',
            on: {
                // 合并工单如被重新打开，此工单也重新打开
                PARENT_REOPENED: {
                    target: 'in_progress',
                    actions: assign({
                        ticket: ({ context }) => ({
                            ...context.ticket,
                            status: TicketStatus.IN_PROGRESS,
                            tags: context.ticket.tags.filter(t => t !== 'merged'),
                            updatedAt: new Date()
                        })
                    })
                }
            }
        },

        // ── 已拆分: 拆分为多个子工单 ──────────────────
        split: {
            description: '此工单已拆分为多个子工单',
            type: 'final',
            on: {
                // 所有子工单关闭后，此工单关闭
                ALL_CHILDREN_CLOSED: {
                    target: 'closed',
                    actions: assign({
                        ticket: ({ context }) => ({
                            ...context.ticket,
                            status: TicketStatus.CLOSED,
                            closedAt: new Date(),
                            updatedAt: new Date()
                        })
                    })
                }
            }
        },

        // ── 已关闭: 工单完成 ──────────────────────────
        closed: {
            description: '工单已关闭',
            type: 'final',
            on: {
                // P0/P1工单可重新打开
                REOPEN: {
                    target: 'in_progress',
                    guard: ({ context }) => 
                        context.ticket.severity.priority === Priority.P0 ||
                        context.ticket.severity.priority === Priority.P1
                }
            }
        }
    }
}, {
    // 动作实现
    actions: {
        autoRoute: assign({
            ticket: ({ context }) => {
                const routing = executeAutoRouting(context.ticket);
                return {
                    ...context.ticket,
                    status: TicketStatus.ROUTED,
                    routing,
                    targetAgent: routing.targetAgent,
                    updatedAt: new Date()
                };
            }
        }),

        incrementRetry: assign({
            retryCount: ({ context }) => context.retryCount + 1,
            ticket: ({ context }) => ({
                ...context.ticket,
                tags: [...context.ticket.tags, `retry-${context.retryCount + 1}`],
                updatedAt: new Date()
            })
        }),

        escalateBlockedTicket: assign({
            ticket: ({ context }) => ({
                ...context.ticket,
                severity: {
                    ...context.ticket.severity,
                    priority: escalatePriority(context.ticket.severity.priority),
                    score: Math.min(1.0, context.ticket.severity.score + 0.1)
                },
                tags: [...context.ticket.tags, 'auto-escalated-blocked'],
                updatedAt: new Date()
            })
        }),

        markDeployTimeout: assign({
            ticket: ({ context }) => ({
                ...context.ticket,
                status: TicketStatus.DEPLOY_FAILED,
                deployment: {
                    ...context.ticket.deployment,
                    rollbackMarked: true,
                    rollbackReason: '部署超时(10分钟)'
                },
                updatedAt: new Date()
            })
        })
    }
});

// ── 辅助函数 ──────────────────────────────────────────────

function autoClassify(ticket: Ticket): SeverityAssessment {
    // 基于关键字和模式的简单自动分类
    const lowerDesc = ticket.description.toLowerCase();
    
    if (lowerDesc.includes('crash') || lowerDesc.includes('error') || lowerDesc.includes('fail')) {
        return {
            priority: Priority.P2,
            score: 0.5,
            dimensions: { impactScope: 0.5, urgency: 0.5, recoverability: 0.5, connectivity: 0.4 },
            adjustments: [{ type: 'AUTO_CLASSIFIED', value: 0 }],
            reasoning: '基于关键词的自动分类'
        };
    }
    
    return {
        priority: Priority.P3,
        score: 0.2,
        dimensions: { impactScope: 0.2, urgency: 0.2, recoverability: 0.2, connectivity: 0.1 },
        adjustments: [{ type: 'AUTO_CLASSIFIED', value: 0 }],
        reasoning: '默认自动分类'
    };
}

function executeAutoRouting(ticket: Ticket): RoutingDecision {
    // 基于模块的默认路由
    const moduleAgentMap: Record<string, TargetAgent> = {
        'world-engine': TargetAgent.FIX,
        'studio-engine': TargetAgent.FIX,
        'advisor': TargetAgent.FIX,
        'llm-service': TargetAgent.OPTIMIZE,
        'database': TargetAgent.FIX,
        'state-manager': TargetAgent.FIX,
        'cache': TargetAgent.OPTIMIZE,
        'security': TargetAgent.SECURITY,
    };

    const targetAgent = moduleAgentMap[ticket.module] ?? TargetAgent.HUMAN_REVIEW;

    return {
        targetAgent,
        confidence: 0.5,
        strategy: RoutingStrategy.RULE_BASED,
        reason: '自动路由: 基于模块的默认映射'
    };
}

function escalatePriority(current: Priority): Priority {
    const escalation: Record<Priority, Priority> = {
        [Priority.P4]: Priority.P3,
        [Priority.P3]: Priority.P2,
        [Priority.P2]: Priority.P1,
        [Priority.P1]: Priority.P0,
        [Priority.P0]: Priority.P0,
    };
    return escalation[current];
}
```

### 11.2 状态转换矩阵

```
当前状态 \ 事件          │ CLASSIFY  │ ROUTE    │ ASSIGN   │ START    │ UPDATE   │ SUBMIT   │ APPROVE  │ REJECT   │ DEPLOY   │ DEPLOY   │ BLOCK    │ UNBLOCK  │ MERGE    │ SPLIT    │ VERIFY   │ VERIFY   │ ROLLBACK │ TIMEOUT  │ REOPEN
                      │           │          │          │ _WORK    │ _PROGRESS│_FOR_REVIEW│        │          │          │ _FAIL   │          │          │          │          │ _PASS   │ _FAIL   │          │          │
──────────────────────┼───────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
created               │ classified│   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │classified│   —      │
classified            │   —       │ routed   │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │ routed   │   —      │
routed                │   —       │   —      │ assigned │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │
assigned              │   —       │   —      │   —      │in_progress│   —     │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │ routed   │   —      │
in_progress           │   —       │   —      │   —      │   —      │in_progress│pending  │ approved │   —      │   —      │   —      │ blocked  │   —      │ merged   │ split    │   —      │   —      │   —      │   —      │   —      │
blocked               │   —       │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │in_progress│   —     │   —      │   —      │   —      │   —      │   —      │   —      │
pending_review        │   —       │   —      │   —      │   —      │   —      │   —      │ approved │ rejected │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │ approved │   —      │
rejected              │   —       │   —      │   —      │in_progress│   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │ assigned │   —      │
approved              │   —       │   —      │   —      │   —      │   —      │   —      │   —      │   —      │deploying │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │deploying │   —      │
deploying             │   —       │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │deploy_  │   —      │   —      │   —      │   —      │   —      │   —      │rolling_  │deploy_  │   —      │
                      │           │          │          │          │          │          │          │          │          │failed   │          │          │          │          │          │          │back     │failed   │          │
deploy_failed         │   —       │   —      │   —      │   —      │   —      │   —      │   —      │   —      │deploying │   —      │   —      │   —      │   —      │   —      │   —      │   —      │rolling_  │   —      │   —      │
                      │           │          │          │          │          │          │          │          │          │          │          │          │          │          │          │          │back     │          │          │
rolling_back          │   —       │   —      │   —      │in_progress│   —     │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │
verified              │   —       │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │ closed   │in_progress│   —      │   —      │   —      │
merged                │   —       │   —      │   —      │in_progress*│  —     │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │
                      │           │          │          │*parent    │          │          │          │          │          │          │          │          │          │          │          │          │          │          │          │
                      │           │          │          │reopened   │          │          │          │          │          │          │          │          │          │          │          │          │          │          │          │
split                 │   —       │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │
closed                │   —       │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │   —      │in_progress│
                      │           │          │          │          │          │          │          │          │          │          │          │          │          │          │          │          │          │          │*P0/P1   │
```



---

## 12. Dataflow & Interactions

### 12.1 系统数据流

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         Classification Router Layer                          ║
║                              数据流全景图                                     ║
╠══════════════════════════════════════════════════════════════════════════════╣

  [Telemetry Layer]                    [Classification Router Layer]
       │                                          │
       │  ① Ingest Report                         │
       │  {anomaly|performance|requirement}        │
       │─────────────────────────────────────────>│
       │                                          │
       │                    ┌──────────────────┐   │
       │                    │  Normalization   │   │
       │                    │  统一数据格式     │   │
       │                    └────────┬─────────┘   │
       │                             │ ② Normalize │
       │                             ▼             │
       │                    ┌──────────────────┐   │
       │                    │ SeverityAssessor │   │
       │                    │ 四维严重评估      │   │
       │                    │                  │   │
       │  ③ Return P0-P4    │ D1 × D2 × D3 × D4 │ │
       │                    │ + 动态调整        │   │
       │                    └────────┬─────────┘   │
       │                             │ Severity     │
       │                             ▼ Score        │
       │                    ┌──────────────────┐   │
       │                    │DependencyAnalyzer│   │
       │                    │ 依赖图谱构建      │   │
       │                    │ 影响域分析        │   │
       │                    │ 环路检测          │   │
       │                    └────────┬─────────┘   │
       │                             │ ChangeSet    │
       │                             ▼              │
       │                    ┌──────────────────┐   │
       │                    │ ImpactAnalyzer   │   │
       │                    │ 四类影响评估      │   │
       │                    │ 回归风险评分      │   │
       │                    │ 审批决策          │   │
       │                    └────────┬─────────┘   │
       │                             │ Impact       │
       │                             ▼ Assessment   │
       │                    ┌──────────────────┐   │
       │                    │ SmartRouter      │   │
       │                    │ 路由决策矩阵      │   │
       │                    │ 冲突解决          │   │
       │                    │ 历史学习          │   │
       │                    └────────┬─────────┘   │
       │                             │ Route        │
       │                             ▼ Decision     │
       │                    ┌──────────────────┐   │
       │                    │ TicketManager    │   │
       │                    │ 工单创建/管理     │   │
       │                    │ 合并/拆分         │   │
       │                    │ 动态优先级        │   │
       │                    └────────┬─────────┘   │
       │                             │ Ticket       │
       │                             ▼ Entity       │
       │                    ┌──────────────────┐   │
       │                    │RoutingDecision   │   │
       │                    │    Engine        │   │
       │                    │ 规则→LLM→历史    │   │
       │                    │ 置信度评估        │   │
       │                    └────────┬─────────┘   │
       │                             │ Final Route  │
       │                             ▼              │
       │                                          │
       │  ④ Dispatch to Target Agent              │
       │  {Fix|Optimize|Feature|Refactor|Security  │
       │   |Test|Doc|Deploy|HumanReview}           │
       │─────────────────────────────────────────>│
       │                                          │ [Agent Layer]


  [Flow Guardian Integration]
       │
       │  实时心流熵值 flowEntropy ∈ [0, 1]
       │───────────────────────────────────────> SeverityAssessor
       │                                         (D1影响面放大因子)
       │
       │  作者创作状态 {in_flow|struggling|blocked|idle}
       │───────────────────────────────────────> TicketManager
       │                                         (动态优先级调整)

  [Historical Database]
       │
       │  路由历史记录 routeHistory[]
       │<──────────────────────────────────────> SmartRouter
       │  (成功率/修复时间/复发率)                  (历史学习校正)
       │
       │  工单数据库 tickets[]
       │<──────────────────────────────────────> TicketManager
       │  (状态/严重性/依赖关系)                    (生命周期管理)

  [Human Review Queue]
       │
       │  ⑤ Human Decision
       │<──────────────────────────────────────> RoutingDecisionEngine
       │  (审批/路由修正/降级处理)                  (置信度不足时)
       │

═══════════════════════════════════════════════════════════════════════════════
```

### 12.2 组件间交互序列图

```
场景: LLM API连续失败，触发异常报告

Telemetry        Severity      Dependency    Impact        Smart       Ticket      Routing      Target
Layer            Assessor      Analyzer      Analyzer      Router      Manager     Engine       Agent
  │                │              │             │             │           │            │            │
  │ 1.Report Error │              │             │             │           │            │            │
  │───────────────>│              │             │             │           │            │            │
  │                │              │             │             │           │            │            │
  │                │ 2.Assess     │             │             │           │            │            │
  │                │   Severity   │             │             │           │            │            │
  │                │  (D1-D4)     │             │             │           │            │            │
  │                │              │             │             │           │            │            │
  │                │ 3.Query Flow │             │             │           │            │            │
  │                │   Guardian   │             │             │           │            │            │
  │                │   Entropy    │             │             │           │            │            │
  │                │<─────────────│             │             │           │            │            │
  │                │              │             │             │           │            │            │
  │                │ 4.Check      │             │             │           │            │            │
  │                │   Recurrence │             │             │           │            │            │
  │                │<─────────────│             │             │           │            │            │
  │                │              │             │             │           │            │            │
  │                │ 5.Return P0  │             │             │           │            │            │
  │                │   Severity   │             │             │           │            │            │
  │                │─────────────>│             │             │           │            │            │
  │                │              │             │             │           │            │            │
  │                │              │ 6.Analyze   │             │           │            │            │
  │                │              │   Impact    │             │           │            │            │
  │                │              │   Scope     │             │           │            │            │
  │                │              │             │             │           │            │            │
  │                │              │ 7.Return    │             │           │            │            │
  │                │              │   ChangeSet │             │           │            │            │
  │                │              │────────────>│             │           │            │            │
  │                │              │             │             │           │            │            │
  │                │              │             │ 8.Assess    │           │            │            │
  │                │              │             │   Narrative │           │            │            │
  │                │              │             │   Impact    │           │            │            │
  │                │              │             │             │           │            │            │
  │                │              │             │ 9.Assess    │           │            │            │
  │                │              │             │   Security  │           │            │            │
  │                │              │             │             │           │            │            │
  │                │              │             │ 10.Calc    │           │            │            │
  │                │              │             │   Regression│           │            │            │
  │                │              │             │   Risk      │           │            │            │
  │                │              │             │             │           │            │            │
  │                │              │             │ 11.Determine│           │            │            │
  │                │              │             │   Approval  │           │            │            │
  │                │              │             │             │           │            │            │
  │                │              │             │ 12.Return   │           │            │            │
  │                │              │             │   Impact    │           │            │            │
  │                │              │             │   +Approval │           │            │            │
  │                │              │             │────────────>│           │            │            │
  │                │              │             │             │           │            │            │
  │                │              │             │             │ 13.Match  │            │            │
  │                │              │             │             │   Rules   │            │            │
  │                │              │             │             │           │            │            │
  │                │              │             │             │ 14.Query  │            │            │
  │                │              │             │             │   History │            │            │
  │                │              │             │             │<─────────│            │            │
  │                │              │             │             │           │            │            │
  │                │              │             │             │ 15.LLM    │            │            │
  │                │              │             │             │   Analysis│            │            │
  │                │              │             │             │<─────────│            │            │
  │                │              │             │             │           │            │            │
  │                │              │             │             │ 16.Fuse  │            │            │
  │                │              │             │             │   +Correct│            │            │
  │                │              │             │             │           │            │            │
  │                │              │             │             │ 17.Return │            │            │
  │                │              │             │             │   Route   │            │            │
  │                │              │             │             │──────────>│            │            │
  │                │              │             │             │           │            │            │
  │                │              │             │             │           │ 18.Create  │            │
  │                │              │             │             │           │   Ticket   │            │
  │                │              │             │             │           │            │            │
  │                │              │             │             │           │ 19.Track   │            │
  │                │              │             │             │           │   State    │            │
  │                │              │             │             │           │            │            │
  │                │              │             │             │           │            │ 20.Evaluate│
  │                │              │             │             │           │            │   Confidence│
  │                │              │             │             │           │            │            │
  │                │              │             │             │           │            │ 21.Route   │
  │                │              │             │             │           │            │   to Agent │
  │                │              │             │             │           │            │───────────>│
  │                │              │             │             │           │            │            │
  │                │              │             │             │           │            │            │
  │                │              │             │             │           │            │ 22.Agent   │
  │                │              │             │             │           │            │   Starts   │
  │                │              │             │             │           │            │<───────────│
  │                │              │             │             │           │            │            │
  │                │              │             │             │           │ 23.Update  │            │
  │                │              │             │             │           │   Progress │            │
  │                │              │             │             │           │<───────────│            │
  │                │              │             │             │           │            │            │
  │                │              │             │             │           │ 24.Submit  │            │
  │                │              │             │             │           │   Review   │            │
  │                │              │             │             │           │            │            │
  │                │              │             │             │           │ 25.Approve │            │
  │                │              │             │             │           │   /Reject  │            │
  │                │              │             │             │           │            │            │
  │                │              │             │             │           │ 26.Deploy  │            │
  │                │              │             │             │           │            │            │
  │                │              │             │             │           │ 27.Verify  │            │
  │                │              │             │             │           │            │            │
  │                │              │             │             │           │ 28.Close   │            │
  │                │              │             │             │           │            │            │
```

### 12.3 关键性能指标 (KPI)

```
┌─────────────────────────────────────────────────────────────┐
│                  路由系统性能指标                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  路由准确率 (Routing Accuracy)                               │
│  ├── 目标: > 92% (路由到正确Agent的比例)                      │
│  ├── 测量: 人工审查后修正的路由 / 总路由数                     │
│  └── 基线: 规则层单独 78%, LLM辅助后 88%, 历史校正后 92%       │
│                                                              │
│  平均路由延迟 (Routing Latency)                              │
│  ├── 目标: < 500ms (P99)                                    │
│  ├── 规则层: ~50ms                                           │
│  ├── LLM层: ~300-400ms (异步调用)                            │
│  └── 历史查询: ~50ms                                         │
│                                                              │
│  工单生命周期 (Ticket Lifecycle)                             │
│  ├── P0: 创建到关闭 < 4小时                                  │
│  ├── P1: 创建到关闭 < 24小时                                 │
│  ├── P2: 创建到关闭 < 3天                                    │
│  ├── P3: 创建到关闭 < 7天                                    │
│  └── P4: 创建到关闭 < 30天                                   │
│                                                              │
│  合并有效率 (Merge Efficiency)                               │
│  ├── 目标: > 85% (合并后无需重新拆分的比例)                   │
│  └── 测量: 合并后 reopen 数 / 合并总数                        │
│                                                              │
│  降级率 (Fallback Rate)                                     │
│  ├── 目标: < 5% (路由到人工审查的比例)                        │
│  └── 测量: HumanReviewQueue 工单数 / 总工单数                  │
│                                                              │
│  首次修复率 (First-Time Fix Rate)                            │
│  ├── 目标: > 80% (首次路由即成功修复的比例)                   │
│  └── 测量: 一次路由后 closed 数 / 总 closed 数                │
│                                                              │
│  回归率 (Regression Rate)                                   │
│  ├── 目标: < 3% (修复后7天内再次出现的比例)                   │
│  └── 测量: reopen 数 / closed 数                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 13. Configuration Reference

### 13.1 默认配置

```yaml
# ═══════════════════════════════════════════════════════════
# NarrativeOS v3.0 — Classification Router Layer Config
# ═══════════════════════════════════════════════════════════

severity_assessor:
  # 四维权重
  weights:
    impact_scope: 0.30      # 影响面
    urgency: 0.30           # 紧急度
    recoverability: 0.20    # 可恢复性
    connectivity: 0.20      # 关联度

  # 优先级阈值
  priority_thresholds:
    P0: 0.850               # 紧急
    P1: 0.600               # 高
    P2: 0.350               # 中
    P3: 0.150               # 低
    P4: 0.000               # 建议

  # 心流熵调节
  flow_entropy:
    critical_threshold: 0.70
    high_threshold: 0.50
    max_multiplier: 1.30
    p0_escalation_threshold: 0.85

  # 重复问题升级
  escalation:
    recurrence_window_days: 7
    bonuses:
      - count: 2            # 2次出现
        bonus: 0.08
      - count: 3            # 3次出现
        bonus: 0.15
      - count: 5            # 5次及以上
        bonus: 0.25

  # 时间衰减
  time_of_day:
    peak_hours: [20, 21, 22, 23, 0, 1, 2]  # 创作高峰
    peak_multiplier: 1.15
    work_hours: [9, 10, 11, 14, 15, 16, 17]  # 工作时段
    work_multiplier: 1.0
    off_multiplier: 0.90

smart_router:
  # 路由规则配置路径
  rules_config: "./config/routing-rules.yaml"

  # 冲突解决
  conflict_resolution:
    max_levels: 6
    llm_arbitration_threshold: 2  # 前2名差距<0.2时启用LLM

  # 历史学习
  history_learning:
    lookback_days: 30
    minimum_samples: 5
    success_rate_weight: 0.15
    recency_bonus_hours: 24

  # 批量聚合
  aggregation:
    enabled: true
    strategies:
      - name: "api_errors"
        group_by: ["error_code", "api_endpoint"]
        time_window_ms: 600000          # 10分钟
        max_bundle_size: 20
        similarity_threshold: 0.90

      - name: "db_errors"
        group_by: ["query_pattern", "db_instance"]
        time_window_ms: 1200000         # 20分钟
        max_bundle_size: 15
        similarity_threshold: 0.85

      - name: "performance"
        group_by: ["module", "metric_type"]
        time_window_ms: 1800000         # 30分钟
        max_bundle_size: 10
        similarity_threshold: 0.80

      - name: "code_quality"
        group_by: ["file_path", "smell_type"]
        time_window_ms: 3600000         # 60分钟
        max_bundle_size: 50
        similarity_threshold: 0.75

dependency_analyzer:
  # 模块定义
  modules:
    config_path: "./config/modules.yaml"

  # 变更传播
  propagation:
    direct_dependency_weight: 0.80
    indirect_decay_rate: 0.50
    shared_data_weight: 0.60
    event_coupling_weight: 0.50
    config_dependency_weight: 0.30
    max_propagation_depth: 3

  # 环路检测
  cycle_detection:
    algorithm: "dfs"
    max_cycle_length: 10

impact_analyzer:
  # 影响阈值
  thresholds:
    narrative_critical: 0.80
    narrative_high: 0.50
    narrative_medium: 0.20
    security_high: 0.50
    regression_risk_high: 0.70
    performance_latency_degradation: 50   # 百分比
    performance_throughput_degradation: 30 # 百分比

  # 回归风险权重
  regression_risk_weights:
    complexity: 0.15
    test_coverage_gap: 0.20
    defect_density: 0.15
    change_type_risk: 0.15
    change_size_risk: 0.10
    critical_path_risk: 0.15
    historical_regression_rate: 0.10

ticket_manager:
  # 工单合并
  merge:
    time_window_ms: 86400000              # 24小时
    threshold: 0.70
    max_bundles_per_merge: 10

  # 工单拆分
  split:
    max_modules: 3
    max_sub_problems: 2
    max_effort_days: 5
    max_tech_stacks: 2

  # 动态优先级
  priority_adjustment:
    enabled: true
    flow_state_boost: 0.15
    flow_critical_boost: 0.25
    high_load_penalty: -0.10
    low_load_batch_bonus: 0.05
    age_escalation_rate: 0.10  # 每30天
    max_age_escalation: 0.30

  # 审批超时
  approval_timeouts:
    P0: 1800000                           # 30分钟
    P1: 7200000                           # 2小时
    P2: 21600000                          # 6小时
    P3: 86400000                          # 24小时
    P4: 259200000                         # 72小时

  # 验证观察期
  verification_periods:
    P0: 86400000                          # 1天
    P1: 259200000                         # 3天
    P2: 604800000                         # 7天
    P3: 1209600000                        # 14天
    P4: 2592000000                        # 30天

routing_decision_engine:
  # 混合路由权重
  fusion_weights:
    rule_weight_high_confidence: 0.60
    rule_weight_normal: 0.50
    llm_weight_high_confidence: 0.60
    llm_weight_normal: 0.50

  # LLM配置
  llm:
    model: "claude-sonnet-4-20250514"
    temperature: 0.20
    max_tokens: 1000
    timeout_ms: 5000

  # 置信度阈值
  confidence:
    minimum_acceptable: 0.50
    high_confidence: 0.85
    low_confidence: 0.30

  # 降级策略
  fallback:
    human_review_timeout_urgent: 1800000   # 30分钟
    human_review_timeout_normal: 14400000  # 4小时
    notify_roles: ["tech_lead", "router_admin"]

# ═══════════════════════════════════════════════════════════
# 数据库配置 (PostgreSQL 16 + pgvector)
# ═══════════════════════════════════════════════════════════
database:
  tables:
    tickets:
      primary_key: "id"
      vector_columns:
        - name: "description_embedding"
          dimensions: 1536
          metric: "cosine"
      indexes:
        - "status, priority"
        - "module, type"
        - "created_at DESC"
        - "target_agent, status"

    routing_history:
      primary_key: "id"
      indexes:
        - "rule_id, created_at"
        - "target_agent, module, ticket_type"
        - "created_at DESC"

    dependency_graph:
      primary_key: "id"
      indexes:
        - "source_module, target_module"

  connection_pool:
    max: 20
    idle_timeout: 300000
```

### 13.2 环境变量

```bash
# ═══════════════════════════════════════════════════════════
# Classification Router Layer 环境变量
# ═══════════════════════════════════════════════════════════

# ── 核心 ──
ROUTER_CONFIG_PATH=./config/router.yaml
ROUTER_LOG_LEVEL=info

# ── 数据库 ──
ROUTER_DB_HOST=localhost
ROUTER_DB_PORT=5432
ROUTER_DB_NAME=narrativeos_router
ROUTER_DB_USER=router_svc
ROUTER_DB_PASSWORD=
ROUTER_DB_POOL_MAX=20

# ── LLM API ──
ROUTER_LLM_API_KEY=
ROUTER_LLM_MODEL=claude-sonnet-4-20250514
ROUTER_LLM_TEMPERATURE=0.2
ROUTER_LLM_TIMEOUT=5000

# ── Flow Guardian 集成 ──
FLOW_GUARDIAN_API_URL=http://localhost:8081
FLOW_GUARDIAN_ENABLED=true

# ── 遥测接收 ──
TELEMETRY_INGEST_ENDPOINT=http://localhost:8082/ingest
TELEMETRY_BATCH_SIZE=100
TELEMETRY_FLUSH_INTERVAL=5000

# ── 指标 ──
METRICS_ENABLED=true
METRICS_PORT=9090
METRICS_PATH=/metrics
```

---

## 14. Implementation Notes

### 14.1 关键技术决策

```
1. XState 用于工单状态机
   理由: NarrativeOS 已使用 XState 进行状态管理，保持一致性
         XState 的可视化能力和类型安全对工单生命周期管理至关重要

2. pgvector 存储工单向量嵌入
   理由: 支持工单相似度搜索，用于合并检测和重复问题识别
         与 NarrativeOS 数据库栈一致

3. 三层混合路由 (规则→LLM→历史)
   理由: 规则层保证可预测性和速度
         LLM层处理模糊边界和未知场景
         历史层持续优化决策质量

4. 异步LLM调用
   理由: LLM路由分析不应阻塞整体流程
         规则层先给出初始路由，LLM结果异步校正
         如果规则层结果可靠 (confidence > 0.9)，可跳过LLM

5. 事件驱动架构
   理由: 各组件间通过事件总线通信，松耦合
         支持组件独立升级和替换
         便于扩展新的Agent类型
```

### 14.2 扩展点

```
新增路由规则:
  → 在 ROUTING_RULES 数组中添加新规则
  → 无需修改核心逻辑

新增Agent类型:
  → 在 TargetAgent 枚举中添加
  → 在路由决策矩阵中添加对应规则
  → 在 SmartRouter 冲突解决中添加Agent权重

新增严重性调整因子:
  → 在 SeverityAssessor.adjustments 中添加新逻辑
  → 配置文件中添加新参数

新增影响维度:
  → 在 ImpactAssessment 接口中添加
  → 在 ImpactAnalyzer 中添加评估函数
  → 在审批决策逻辑中添加新规则
```

### 14.3 风险与缓解

```
风险1: LLM API 不可用导致路由降级
  缓解: 规则层始终可用，LLM层为可选增强
       设置LLM调用超时(5s)，超时后直接使用规则结果

风险2: 路由错误导致问题修复失败
  缓解: 历史学习机制自动纠正
       人工审查队列作为最终安全网
       路由决策的完整追溯链

风险3: 工单数量爆发导致系统过载
  缓解: 批量聚合减少工单总量
       P3/P4工单在低负载时批量处理
       数据库连接池控制并发

风险4: 心流熵调节过度升级
  缓解: 设置最大调节上限 (+0.25)
       仅D1影响面维度参与调节
       平滑衰减而非阶跃式调整

风险5: 环路检测性能问题
  缓解: 依赖图谱增量更新而非全量重建
       限制DFS搜索深度(3跳)
       缓存环路检测结果
```

---

## 15. Appendix

### 15.1 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 严重性 | Severity | 问题的严重程度，用P0-P4表示 |
| 影响面 | Impact Scope | 问题影响的范围大小 |
| 紧急度 | Urgency | 问题需要处理的时间紧迫性 |
| 可恢复性 | Recoverability | 问题恢复所需的干预程度 |
| 关联度 | Connectivity | 问题与其他模块的关联紧密程度 |
| 路由 | Routing | 将工单分配给合适的处理Agent |
| 聚合 | Aggregation | 将多个相似问题合并为单一工单 |
| 变更集 | Change Set | 修复问题所需修改的最小模块集合 |
| 回归风险 | Regression Risk | 变更引入新bug的概率 |
| 心流熵 | Flow Entropy | 作者心流状态的混乱程度指标 |
| 谏官 | Advisor | NarrativeOS的AI决策协调系统 |

### 15.2 参考文档

- NarrativeOS v3.0 Architecture Overview
- DevAgent Cluster Layer 1: Telemetry System Design
- Flow Guardian System Specification
- XState v5 Documentation: https://stately.ai/docs/
- pgvector Documentation: https://github.com/pgvector/pgvector

---

*文档版本: v3.0.0*  
*最后更新: 2025-07-24*  
*文档状态: 设计规范 (Design Specification Ready for Implementation)*  
*下一层: DevAgent Cluster Layer 3 — Agent Execution Layer*

---

**END OF DOCUMENT**
