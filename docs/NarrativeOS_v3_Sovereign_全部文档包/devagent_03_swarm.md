> [!WARNING] **[DEPRECATED] 本文档已废弃 — 2026-05-20**
> 原 P9 DevAgent 集群（5 层架构）不再另建代码实现。Claude Code 直接担任开发维护角色（见 `CLAUDE.md` §"自动化开发维护角色"）。
> 本文档保留为参考档案，其中 7 个 Agent 的职责定义、协作协议、质量门槛等设计理念可作为未来需要时参考，但不做实现承诺。
> 7 个 Agent 的核心能力已由 Claude Code 自身提供（分析/修复/优化/重构/测试/文档生成）。

# NarrativeOS v3.0 Sovereign — DevAgent Cluster 第三层：开发智能体集群

## DevAgent Swarm 设计规格书

> **文档版本**: v1.0.0  
> **系统版本**: NarrativeOS v3.0 Sovereign  
> **技术栈**: TypeScript + PostgreSQL 16 + pgvector + XState + LLM API  
> **目标代码规模**: 5-10万行（已废弃，不再实现）  
> **定位**: [DEPRECATED] 外部进化引擎 — 代码变更提案的生成与协作  

---

## 目录

1. [系统概述与核心约束](#1-系统概述与核心约束)
2. [全局共享数据结构](#2-全局共享数据结构)
   - 2.1 代码变更提案 Schema (PullRequestProposal)
   - 2.2 Agent 间消息协议 (AgentMessage)
   - 2.3 工单状态机 (TicketStateMachine)
3. [Agent 1: 修复Agent (BugFixAgent)](#3-agent-1-bugfixagent)
4. [Agent 2: 功能Agent (FeatureAgent)](#4-agent-2-featureagent)
5. [Agent 3: 优化Agent (OptimizationAgent)](#5-agent-3-optimizationagent)
6. [Agent 4: 安全Agent (SecurityAgent)](#6-agent-4-securityagent)
7. [Agent 5: 重构Agent (RefactorAgent)](#7-agent-5-refactoragent)
8. [Agent 6: 测试Agent (TestAgent)](#8-agent-6-testagent)
9. [Agent 7: 文档Agent (DocAgent)](#9-agent-7-docagent)
10. [智能体协作协议](#10-智能体协作协议)
11. [质量门槛定义](#11-质量门槛定义)
12. [附录](#12-附录)

---

## 1. 系统概述与核心约束

### 1.1 架构定位

```
┌─────────────────────────────────────────────────────────────────┐
│                    NarrativeOS v3.0 Sovereign                    │
│                      外部进化引擎架构                              │
├─────────────────────────────────────────────────────────────────┤
│  第一层: 监测层 (Monitor Layer)                                  │
│    ├── 异常监控器    ├── 性能监控器    ├── 行为监控器             │
├─────────────────────────────────────────────────────────────────┤
│  第二层: 路由层 (Router Layer) ← 你在这里                         │
│    ├── 意图识别    ├── 优先级排序    ├── Agent分发                  │
├─────────────────────────────────────────────────────────────────┤
│  ★ 第三层: 开发智能体集群 (DevAgent Swarm) ← 本层                 │
│    ├── BugFixAgent    ├── FeatureAgent    ├── OptimizationAgent   │
│    ├── SecurityAgent  ├── RefactorAgent   ├── TestAgent           │
│    └── DocAgent                                                  │
├─────────────────────────────────────────────────────────────────┤
│  第四层: 审查层 (Review Layer)                                   │
│    ├── 代码审查Agent    ├── 测试验证Agent    ├── 安全审查Agent      │
├─────────────────────────────────────────────────────────────────┤
│  第五层: 部署层 (Deploy Layer)                                   │
│    ├── 变更合并    ├── 灰度发布    ├── 回滚机制                    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 核心约束（不可违反）

| 编号 | 约束 | 说明 |
|------|------|------|
| C1 | **只生成变更提案，不直接修改代码** | 所有 Agent 的输出是 Pull Request 形式的代码变更提案 |
| C2 | **所有变更必须经过审查** | 代码审查 Agent + 测试 Agent 双重验证 |
| C3 | **叙事相关变更须作者审批** | 涉及故事内容、角色设定、情节走向的变更需人类作者确认 |
| C4 | **技术修复可自动部署** | 纯技术修复（不影响叙事逻辑）在审查通过后可自动合并，但保留回滚能力 |
| C5 | **第一公理不可违反** | 任何 Agent 不得破坏系统核心架构原则（见附录A） |
| C6 | **变更可追踪** | 每个代码变更必须关联到原始工单，形成完整溯源链 |
| C7 | **幂等性** | 同一提案多次提交不得产生重复变更 |

### 1.3 Agent 通用能力

所有 7 个 Agent 共享以下基础能力：

```typescript
interface BaseAgentCapabilities {
  // 代码分析
  analyzeCode(filePath: string): CodeAnalysis;
  locateSymbol(symbolName: string): SymbolLocation[];
  traceCallChain(entryPoint: string): CallGraph;
  
  // 代码理解
  summarizeModule(modulePath: string): ModuleSummary;
  extractDependencies(filePath: string): DependencyGraph;
  
  // 变更管理
  generateDiff(original: string, modified: string): DiffHunk[];
  estimateImpact(proposal: PullRequestProposal): ImpactReport;
  
  // 通信
  sendMessage(to: AgentId, message: AgentMessage): void;
  queryAgent(target: AgentId, query: string): Promise<AgentResponse>;
}
```

---

## 2. 全局共享数据结构

### 2.1 代码变更提案 Schema (PullRequestProposal)

```typescript
/**
 * 代码变更提案 — 所有 DevAgent 的统一输出格式
 * 符合 Conventional Commits 规范，兼容 GitHub/GitLab PR 格式
 */
interface PullRequestProposal {
  // ── 元数据 ──────────────────────────
  /** 唯一标识符: 格式 agent-type/{timestamp}-{hash} */
  proposalId: string;           // 例: "bugfix/20250115-142053-a1b2c3"
  
  /** 提案类型 */
  type: 'bugfix' | 'feature' | 'optimization' | 'security' | 
        'refactor' | 'test' | 'docs';
  
  /** 关联工单 */
  ticketId: string;             // 例: "BUG-2025-0042"
  
  /** 关联 Epic/Pipeline */
  epicId?: string;              // 例: "EPIC-OPT-2025-Q1"
  
  /** 创建时间 */
  createdAt: string;            // ISO 8601
  
  /** 提案版本 */
  version: number;              // 从 1 开始，每次修订递增
  
  /** 父提案（修订时指向原提案） */
  parentProposalId?: string;
  
  // ── 作者信息 ──────────────────────────
  author: {
    agentId: string;            // 例: "BugFixAgent-v3.1"
    modelId: string;            // 例: "claude-sonnet-4-20250514"
    confidence: number;         // 0.0 - 1.0，Agent 对自身提案的信心度
  };
  
  // ── 变更范围 ──────────────────────────
  /** 受影响的文件清单 */
  affectedFiles: AffectedFile[];
  
  /** 新增文件 */
  newFiles: NewFile[];
  
  /** 删除文件 */
  deletedFiles: string[];
  
  /** 重命名文件 */
  renamedFiles: RenamedFile[];
  
  // ── 变更描述 ──────────────────────────
  /** 标题: 一行摘要，符合 Conventional Commits */
  title: string;                // 例: "fix(llm): handle timeout in streaming response"
  
  /** 详细描述 */
  description: {
    summary: string;            // 背景说明
    motivation: string;         // 为什么要做这个变更
    approach: string;           // 采用什么方法
    alternatives: string[];     // 备选的实现方案（最多3个）
    breakingChanges?: string[]; // 破坏性变更说明
  };
  
  // ── 代码差异 ──────────────────────────
  /** Unified diff 格式的代码变更 */
  diffs: DiffHunk[];
  
  // ── 测试 ──────────────────────────
  tests: {
    /** 新增测试用例 */
    added: TestCase[];
    /** 修改的测试用例 */
    modified: ModifiedTestCase[];
    /** 测试结果摘要 */
    results?: TestResultSummary;
  };
  
  // ── 影响分析 ──────────────────────────
  impact: {
    /** 变更影响等级 */
    severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
    /** 影响范围描述 */
    scope: string;
    /** 性能影响 */
    performanceImpact: 'improve' | 'degrade' | 'neutral';
    /** 向后兼容性 */
    backwardCompatible: boolean;
    /** 依赖变更 */
    dependencyChanges?: DependencyChange[];
    /** 配置变更 */
    configChanges?: ConfigChange[];
  };
  
  // ── 安全评估 ──────────────────────────
  security: {
    /** 引入新攻击面？ */
    newAttackSurface: boolean;
    /** 涉及敏感数据处理？ */
    handlesSensitiveData: boolean;
    /** 权限变更 */
    permissionChanges: string[];
    /** 安全审查状态 */
    securityReviewStatus: 'pending' | 'approved' | 'rejected';
  };
  
  // ── 审查状态 ──────────────────────────
  review: {
    status: 'draft' | 'pending_review' | 'in_review' | 
            'changes_requested' | 'approved' | 'rejected';
    /** 审查记录 */
    reviews: CodeReview[];
    /** 测试验证状态 */
    testVerification: 'pending' | 'passed' | 'failed';
    /** 作者审批（叙事相关变更时需要） */
    authorApproval?: 'pending' | 'approved' | 'rejected';
  };
  
  // ── 部署信息 ──────────────────────────
  deploy: {
    /** 部署策略 */
    strategy: 'auto' | 'manual' | 'canary' | 'rollback_only';
    /** 回滚方案 */
    rollbackPlan: string;
    /** 灰度发布配置 */
    canaryConfig?: {
      percentage: number;       // 起始流量百分比
      duration: number;         // 观察时长（分钟）
      successCriteria: string;  // 成功判定标准
    };
  };
  
  // ── 元数据 ──────────────────────────
  metadata: {
    /** 标签 */
    labels: string[];
    /** 预估审查时间（分钟） */
    estimatedReviewTime: number;
    /** 是否为紧急修复 */
    isHotfix: boolean;
    /** 自动合并条件满足时可合并 */
    autoMergeConditions?: string[];
  };
}

// ── 子类型定义 ──────────────────────────

interface AffectedFile {
  path: string;                 // 文件路径
  changeType: 'modified';       // 变更类型
  linesAdded: number;
  linesRemoved: number;
  /** 变更摘要 */
  summary: string;
  /** 关联符号（函数/类/接口） */
  symbols: string[];
}

interface NewFile {
  path: string;
  content: string;              // 完整文件内容
  /** 文件用途说明 */
  purpose: string;
}

interface RenamedFile {
  from: string;
  to: string;
  /** 是否伴随内容修改 */
  contentChanged: boolean;
}

interface DiffHunk {
  filePath: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  /** Unified diff 文本 */
  diff: string;
  /** 变更上下文说明 */
  context: string;
}

interface TestCase {
  id: string;                   // 唯一ID
  name: string;                 // 测试名称
  type: 'unit' | 'integration' | 'e2e' | 'state_machine' | 'security';
  targetFile: string;           // 被测试的文件
  targetFunction?: string;      // 被测试的函数
  code: string;                 // 测试代码
  /** 测试数据（等价类、边界值等） */
  testData?: {
    equivalenceClasses?: string[];
    boundaryValues?: (string | number)[];
    exceptionValues?: (string | number)[];
  };
  /** 覆盖率目标 */
  coverageTarget?: number;      // 0-100%
}

interface ModifiedTestCase {
  testId: string;
  oldCode: string;
  newCode: string;
  reason: string;
}

interface TestResultSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  coverage: {
    lines: number;
    branches: number;
    functions: number;
  };
  /** 失败的测试详情 */
  failures?: Array<{
    testId: string;
    error: string;
    stackTrace?: string;
  }>;
}

interface CodeReview {
  reviewer: string;             // Agent 或人类审查者ID
  reviewedAt: string;
  verdict: 'approve' | 'request_changes' | 'reject';
  comments: ReviewComment[];
  /** 检查清单结果 */
  checklist: ChecklistResult[];
}

interface ReviewComment {
  filePath: string;
  line: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestion?: string;
}

interface ChecklistResult {
  item: string;
  passed: boolean;
  note?: string;
}

interface DependencyChange {
  name: string;
  oldVersion?: string;
  newVersion?: string;
  changeType: 'added' | 'removed' | 'updated';
  /** 变更原因 */
  reason: string;
}

interface ConfigChange {
  file: string;
  key: string;
  oldValue?: string;
  newValue?: string;
  /** 是否需要重启 */
  requiresRestart: boolean;
}
```

### 2.2 Agent 间消息协议 (AgentMessage)

```typescript
/**
 * Agent 间通信消息格式
 * 采用异步消息队列 + 状态事件总线的混合模式
 */
interface AgentMessage {
  /** 消息唯一ID */
  messageId: string;            // UUID v4
  
  /** 消息类型 */
  type: AgentMessageType;
  
  /** 发送方 */
  from: AgentId;
  
  /** 接收方 */
  to: AgentId;
  
  /** 关联的提案 */
  proposalId?: string;
  
  /** 关联的工单 */
  ticketId?: string;
  
  /** 创建时间 */
  timestamp: string;            // ISO 8601
  
  /** 优先级 */
  priority: 'urgent' | 'high' | 'normal' | 'low';
  
  /** 消息载荷 */
  payload: MessagePayload;
  
  /** 响应回调地址 */
  replyTo?: string;
  
  /** 超时时间（毫秒） */
  ttl?: number;
  
  /** 追踪上下文 */
  traceContext: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
  };
}

type AgentId = 
  | 'BugFixAgent'
  | 'FeatureAgent' 
  | 'OptimizationAgent'
  | 'SecurityAgent'
  | 'RefactorAgent'
  | 'TestAgent'
  | 'DocAgent'
  | 'CodeReviewAgent'
  | 'RouterAgent'
  | 'DeployAgent'
  | 'Orchestrator';

type AgentMessageType =
  // ── 工作流消息 ──
  | 'WORK_ASSIGNMENT'        // 工作分配
  | 'WORK_COMPLETE'          // 工作完成
  | 'WORK_FAILED'            // 工作失败
  | 'WORK_TIMEOUT'           // 工作超时
  | 'WORK_CANCELLED'         // 工作取消
  // ── 协作消息 ──
  | 'QUERY'                  // 查询请求（询问其他Agent）
  | 'RESPONSE'               // 查询响应
  | 'CONFLICT_DETECTED'      // 冲突检测
  | 'CONFLICT_RESOLVED'      // 冲突解决
  | 'BLOCKED'                // 被阻塞（等待其他Agent）
  | 'UNBLOCKED'              // 解除阻塞
  // ── 状态消息 ──
  | 'PROPOSAL_CREATED'       // 提案已创建
  | 'PROPOSAL_UPDATED'       // 提案已更新
  | 'PROPOSAL_REVIEWED'      // 提案已审查
  | 'PROPOSAL_APPROVED'      // 提案已通过
  | 'PROPOSAL_REJECTED'      // 提案已拒绝
  // ── 质量消息 ──
  | 'QUALITY_GATE_PASSED'    // 质量门槛通过
  | 'QUALITY_GATE_FAILED'    // 质量门槛未通过
  | 'TEST_RESULTS'           // 测试结果
  // ── 协调消息 ──
  | 'REQUEST_EXCLUSIVE_LOCK' // 请求排他锁
  | 'GRANT_EXCLUSIVE_LOCK'   // 授予排他锁
  | 'RELEASE_EXCLUSIVE_LOCK' // 释放排他锁'
  | 'HEARTBEAT'              // 心跳
  | 'STATUS_REPORT';         // 状态报告

// ── 具体载荷类型 ──────────────────────────

type MessagePayload =
  | WorkAssignmentPayload
  | WorkCompletePayload
  | QueryPayload
  | ConflictPayload
  | QualityGatePayload
  | TestResultsPayload
  | LockPayload;

interface WorkAssignmentPayload {
  taskType: string;
  taskDescription: string;
  /** 输入数据 */
  inputs: Record<string, unknown>;
  /** 约束条件 */
  constraints: string[];
  /** 截止时间 */
  deadline?: string;
}

interface WorkCompletePayload {
  proposalId: string;
  /** 产出摘要 */
  summary: string;
  /** 实际产出 */
  outputs: Record<string, unknown>;
  /** 执行时间（毫秒） */
  executionTime: number;
  /** 消耗的 token 数 */
  tokensUsed: number;
  /** 后续建议 */
  followUp?: string[];
}

interface QueryPayload {
  queryType: string;
  query: string;
  /** 期望的响应格式 */
  expectedFormat?: string;
}

interface ConflictPayload {
  /** 冲突类型 */
  conflictType: 'file_collision' | 'dependency_conflict' | 'semantic_conflict';
  /** 冲突的文件 */
  conflictingFiles: string[];
  /** 涉及的Agent */
  conflictingAgents: AgentId[];
  /** 冲突描述 */
  description: string;
  /** 解决建议 */
  resolutionOptions: string[];
}

interface QualityGatePayload {
  gateName: string;
  passed: boolean;
  /** 未通过的检查项 */
  failures: string[];
  /** 警告项 */
  warnings: string[];
  /** 评分 */
  score: number;               // 0-100
}

interface TestResultsPayload {
  proposalId: string;
  testSuite: string;
  summary: TestResultSummary;
  /** 详细测试报告链接 */
  reportUrl?: string;
}

interface LockPayload {
  resource: string;            // 资源标识（文件路径/模块名）
  duration: number;            // 请求持有时间（毫秒）
  reason: string;
}
```

### 2.3 工单状态机 (TicketStateMachine)

```typescript
/**
 * 工单生命周期 — XState 状态机定义
 * 所有 Agent 的工作都围绕工单状态流转展开
 */
const TicketStateMachine = {
  id: 'ticket-lifecycle',
  initial: 'CREATED',
  states: {
    CREATED: {
      on: {
        ASSIGN: 'ASSIGNED',
        DEFER: 'DEFERRED'
      }
    },
    ASSIGNED: {
      on: {
        START: 'IN_PROGRESS',
        REASSIGN: 'ASSIGNED'
      }
    },
    IN_PROGRESS: {
      on: {
        PROPOSAL_READY: 'REVIEW_PENDING',
        BLOCKED: 'BLOCKED',
        FAILED: 'FAILED'
      }
    },
    BLOCKED: {
      on: {
        UNBLOCKED: 'IN_PROGRESS',
        ESCALATE: 'ESCALATED'
      }
    },
    REVIEW_PENDING: {
      on: {
        START_REVIEW: 'IN_REVIEW',
        AUTO_APPROVE: 'APPROVED'       // 仅技术修复可自动
      }
    },
    IN_REVIEW: {
      on: {
        APPROVE: 'APPROVED',
        REQUEST_CHANGES: 'CHANGES_NEEDED',
        REJECT: 'REJECTED'
      }
    },
    CHANGES_NEEDED: {
      on: {
        REVISE: 'IN_PROGRESS',
        ABANDON: 'ABANDONED'
      }
    },
    APPROVED: {
      on: {
        QUEUE_DEPLOY: 'DEPLOY_PENDING',
        REQUIRE_AUTHOR_APPROVAL: 'AWAITING_AUTHOR'  // 叙事相关
      }
    },
    AWAITING_AUTHOR: {
      on: {
        AUTHOR_APPROVE: 'DEPLOY_PENDING',
        AUTHOR_REJECT: 'REJECTED'
      }
    },
    DEPLOY_PENDING: {
      on: {
        DEPLOY: 'DEPLOYING',
        SCHEDULE: 'SCHEDULED'
      }
    },
    DEPLOYING: {
      on: {
        DEPLOY_SUCCESS: 'DEPLOYED',
        DEPLOY_FAIL: 'ROLLBACK'
      }
    },
    DEPLOYED: {
      on: {
        VERIFY: 'VERIFIED',
        ROLLBACK: 'ROLLBACK'
      }
    },
    VERIFIED: {
      on: {
        CLOSE: 'CLOSED'
      }
    },
    ROLLBACK: {
      on: {
        ROLLBACK_COMPLETE: 'CLOSED',
        ROLLBACK_FAIL: 'ESCALATED'
      }
    },
    SCHEDULED: {
      on: {
        TRIGGER: 'DEPLOYING',
        CANCEL: 'CANCELLED'
      }
    },
    // ── 终止状态 ──
    CLOSED: { type: 'final' },
    REJECTED: { type: 'final' },
    ABANDONED: { type: 'final' },
    CANCELLED: { type: 'final' },
    DEFERRED: { 
      on: { ACTIVATE: 'CREATED' }
    },
    FAILED: { 
      on: { RETRY: 'ASSIGNED', ESCALATE: 'ESCALATED' }
    },
    ESCALATED: { type: 'final' }  // 需人工介入
  }
};
```



---

## 3. Agent 1: BugFixAgent（修复智能体）

### 3.1 职责范围

| 分类 | 具体职责 | 示例 |
|------|----------|------|
| **运行时异常修复** | LLM 调用失败处理 | 处理 API 超时、速率限制、空响应 |
| | 数据库连接恢复 | 连接池耗尽、事务超时、死锁检测 |
| | 状态机异常处理 | XState 无效状态转换、 guard 条件异常 |
| **边界条件修复** | 空值/undefined 处理 | 防御式编程、null safety |
| | 越界处理 | 数组越界、字符串截断、数值溢出 |
| | 并发竞争修复 | 竞态条件、原子操作缺失、锁粒度 |
| **回归问题修复** | 旧功能在新版本中失效 | 新版本 API 变更导致旧调用点出错 |
| | 依赖升级兼容性 | npm 包升级后的 breaking changes |
| | 配置变更副作用 | 配置项变更引发的级联问题 |

### 3.2 工作流程

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ 接收异常  │ → │ 根因分析  │ → │ 方案生成  │ → │ 测试生成  │ → │ 提案组装  │ → │ 提交审查  │
│ 报告      │   │ (最多5层) │   │ (最多3个) │   │ (覆盖率)  │   │ (PR格式)  │   │          │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
  异常堆栈      代码定位        备选方案        单元测试        变更提案
  + 上下文      + 调用链路      + 影响评估      + 回归测试      + 审查请求
```

**步骤 1: 异常分析**
- 解析异常堆栈，提取错误类型、文件、行号
- 追溯调用链路（最多向上追踪 5 层）
- 收集异常发生时的上下文变量

**步骤 2: 根因定位**
- 将异常映射到具体代码位置
- 分析可能的触发条件
- 评估是否为已知问题的变体

**步骤 3: 修复方案生成**
- 生成最多 3 个备选修复方案
- 每个方案包含：修复代码 + 修复说明 + 风险评估
- 推荐最优方案并说明理由

**步骤 4: 测试生成**
- 为修复生成触发异常的单元测试（必须失败 → 修复后通过）
- 生成边界条件测试
- 生成回归测试（确保修复不会破坏其他功能）

**步骤 5: 提案组装**
- 按 PullRequestProposal Schema 组装完整提案
- 标记变更类型为 `bugfix`

### 3.3 输入输出格式

**输入:**
```typescript
interface BugFixInput {
  // 异常信息
  exception: {
    type: string;              // 异常类型
    message: string;           // 异常消息
    stackTrace: string;        // 完整堆栈
    timestamp: string;
    environment: string;       // 'production' | 'staging' | 'development'
  };
  // 异常上下文
  context: {
    requestId: string;         // 请求追踪ID
    userAction?: string;       // 触发异常的用户操作
    storyContext?: {           // 叙事上下文（如适用）
      currentChapter?: number;
      currentScene?: string;
      involvedCharacters?: string[];
    };
    systemState?: Record<string, unknown>;
  };
  // 相关代码
  relatedCode: {
    primaryFile: string;       // 异常发生的文件
    lineNumber: number;
    snippet: string;           // 相关代码片段
    relatedFiles: string[];    // 可能相关的文件列表
  };
  // 历史参考
  history?: {
    previousFixes: Array<{     // 之前尝试过的修复
      fixId: string;
      description: string;
      result: 'success' | 'partial' | 'failed';
    }>;
    similarIssues: string[];   // 类似问题的工单ID
  };
  // 约束
  constraints: {
    maxChangeLines: number;    // 最大变更行数（默认100行）
    allowNewDependencies: boolean; // 是否允许引入新依赖（默认false）
    requireHotfix: boolean;    // 是否紧急修复
  };
}
```

**输出:** `PullRequestProposal`（type = 'bugfix'）

### 3.4 约束与限制

| 约束ID | 约束 | 违反后果 |
|--------|------|----------|
| BF-01 | 不修改架构设计 | 维持现有模块边界和接口契约 |
| BF-02 | 不引入新依赖 | 仅使用项目中已有的包 |
| BF-03 | 单文件变更不超过 100 行 | 超过时需拆分为多个工单 |
| BF-04 | 修复必须包含回归测试 | 无测试的提案自动驳回 |
| BF-05 | 不改变外部行为 | 仅修复异常，不添加新功能 |
| BF-06 | 最小化变更范围 | 只修改必要的代码 |

### 3.5 System Prompt

````markdown
# 角色定义

你是 **BugFixAgent**（修复智能体），NarrativeOS v3.0 Sovereign 开发集群中的
异常修复专家。你的唯一职责是分析运行时异常并生成精确的修复代码。

## 核心能力

- 堆栈追踪分析：从异常堆栈定位到具体代码行
- 根因推断：区分直接原因和根本原因
- 防御式编程：生成 null-safe、类型安全的修复代码
- 回归测试：确保修复不会引入新问题

## 工作原则

1. **最小变更原则**：只做必要的修改，越少越好
2. **防御优先**：优先添加防御性检查而非重构
3. **测试驱动**：每个修复必须伴随一个失败的测试（修复前）→ 通过的测试（修复后）
4. **向后兼容**：修复不能改变合法输入下的行为
5. **安全第一**：绝不通过 "catch-all" 掩盖安全漏洞

## 技术栈

- TypeScript 5.x（严格模式）
- Node.js 20+
- PostgreSQL 16 + pgvector
- XState 5.x（状态机）
- LLM API（OpenAI / Anthropic）

## 输出格式

你必须输出符合 `PullRequestProposal` 结构的 JSON（type = 'bugfix'），包含：
- title: 遵循 Conventional Commits 格式，前缀为 `fix(模块):`
- diffs: Unified diff 格式的代码变更
- tests: 至少包含一个触发异常的测试和一个回归测试
- impact.severity: 根据异常影响评估

## 绝对禁止

- 不要引入新依赖
- 不要修改架构设计或公共接口
- 不要添加新功能（修复 ≠ 功能开发）
- 不要使用 `catch(e) { /* ignore */ }` 式的错误掩盖
- 不要在修复中混合重构

## 分析深度

- 最多向上追溯调用链 5 层
- 生成最多 3 个备选修复方案并推荐最优
- 修复代码的行数不超过 100 行（单文件）
````

### 3.6 User Prompt 模板

````markdown
# Bug 修复任务

## 异常报告

**异常类型**: {{exception.type}}
**异常消息**: {{exception.message}}
**发生时间**: {{exception.timestamp}}
**环境**: {{exception.environment}}
**请求ID**: {{context.requestId}}

### 堆栈追踪

```
{{exception.stackTrace}}
```

### 异常上下文

{{#context.storyContext}}
- 当前章节: {{currentChapter}}
- 当前场景: {{currentScene}}
- 涉及角色: {{involvedCharacters}}
{{/context.storyContext}}

{{#context.userAction}}
**触发操作**: {{context.userAction}}
{{/context.userAction}}

## 相关代码

### 主文件：{{relatedCode.primaryFile}}:{{relatedCode.lineNumber}}

```typescript
{{relatedCode.snippet}}
```

### 可能相关的文件

{{#relatedCode.relatedFiles}}
- {{.}}
{{/relatedCode.relatedFiles}}

## 历史参考

{{#history.previousFixes}}
- 修复 {{fixId}}: {{description}} → 结果: {{result}}
{{/history.previousFixes}}

{{#history.similarIssues}}
- 类似问题: {{.}}
{{/history.similarIssues}}

## 约束条件

- 最大变更行数: {{constraints.maxChangeLines}}
- 允许新依赖: {{constraints.allowNewDependencies}}
- 紧急修复: {{constraints.requireHotfix}}

---

请按以下步骤进行分析并输出修复提案：

### 步骤 1: 根因分析

1. 定位异常发生的精确代码位置
2. 分析触发异常的条件（输入数据、状态、时序等）
3. 区分直接原因和根本原因
4. 如果追溯调用链，最多分析 5 层

### 步骤 2: 修复方案

生成最多 3 个备选修复方案：

**方案 A（推荐）**: 最小化变更
- 代码变更
- 修复说明
- 风险评估

**方案 B**: 防御性修复
- 代码变更
- 修复说明
- 风险评估

**方案 C**: 根因修复（如适用）
- 代码变更
- 修复说明
- 风险评估

### 步骤 3: 测试用例

为每个修复方案生成：
1. **失败重现测试**：在修复前触发异常的测试
2. **边界条件测试**：覆盖各种边界输入
3. **回归测试**：确保不破坏现有功能

### 步骤 4: 完整提案

输出符合 PullRequestProposal 结构的 JSON。
````

---

## 4. Agent 2: FeatureAgent（功能智能体）

### 4.1 职责范围

| 分类 | 具体职责 | 示例 |
|------|----------|------|
| **新功能实现** | 基于需求挖掘器的输出 | 新增"角色关系图谱可视化"功能 |
| | 新模块开发 | 新增"时间线管理"子系统 |
| | 新集成 | 接入新的 LLM Provider |
| **功能增强** | 现有功能的扩展 | 将大纲层级从 3 层扩展到 5 层 |
| | 配置项增加 | 新增 "输出风格" 参数 |
| | 性能优化相关功能 | 添加 Prompt 缓存配置界面 |
| **功能重构** | 拆分过复杂的功能 | 将 2000 行的 `generateChapter` 拆分为子函数 |
| | 模块化 | 将内联逻辑抽取为可复用模块 |
| | 接口统一 | 将多个相似 API 合并为通用接口 |

### 4.2 工作流程

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ 接收需求  │ → │ 架构分析  │ → │ 方案设计  │ → │ 代码实现  │ → │ 测试生成  │ → │ 文档更新  │
│ 文档      │   │          │   │ (最多3个) │   │          │   │          │   │          │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
  需求描述       现有代码        技术选型        代码实现        API文档
  + 约束条件      架构分析        接口设计        + 类型定义      + 变更日志
                                  数据模型
```

**步骤 1: 需求分析**
- 解析需求文档（来自需求挖掘器或人工输入）
- 识别功能范围、输入输出、边界条件
- 判断需求是否违反第一公理（见附录A）

**步骤 2: 架构分析**
- 分析现有代码架构，确定最佳接入点
- 评估对现有模块的影响
- 识别需要修改的接口和依赖

**步骤 3: 方案设计**
- 生成最多 3 个实现方案（含技术选型）
- 每个方案包含：架构图、接口设计、数据模型、风险评估
- 推荐最优方案并说明理由

**步骤 4: 代码实现**
- 生成 TypeScript 代码（含类型定义）
- 遵循项目编码规范
- 包含适当的错误处理和日志

**步骤 5: 测试生成**
- 单元测试（覆盖率目标 >= 80%）
- 集成测试（模块间交互）
- 端到端测试（完整用户流程）

**步骤 6: 文档更新**
- API 接口文档
- 变更日志条目
- 开发者使用指南

### 4.3 输入输出格式

**输入:**
```typescript
interface FeatureInput {
  // 需求信息
  requirement: {
    id: string;                // 需求ID
    title: string;             // 需求标题
    description: string;       // 详细描述（支持 Markdown）
    acceptanceCriteria: string[]; // 验收标准
    priority: 'critical' | 'high' | 'medium' | 'low';
    source: 'miner' | 'author' | 'system' | 'analytics'; // 需求来源
  };
  // 现有架构
  existingArchitecture: {
    relevantModules: Array<{
      name: string;
      path: string;
      description: string;
      keyInterfaces: string[];
      codeSnippet?: string;
    }>;
    relevantPipelines: string[];
    databaseSchema?: string;   // 相关数据库表结构
  };
  // 接口约束
  interfaceConstraints: {
    mustImplement: string[];   // 必须实现的接口
    mustNotBreak: string[];    // 不能破坏的接口
    deprecatedPatterns: string[]; // 避免使用的模式
  };
  // 技术偏好
  preferences: {
    language: 'typescript';
    preferredLibraries?: string[];
    avoidLibraries?: string[];
    performanceTarget?: string;
  };
  // 第一公理检查
  firstAxiomCheck: {
    involvesNarrativeLogic: boolean; // 是否涉及叙事逻辑
    affectsAuthorControl: boolean;   // 是否影响作者控制权
    autonomousDecisionScope?: string; // 自主决策范围
  };
}
```

**输出:** `PullRequestProposal`（type = 'feature'）

### 4.4 约束与限制

| 约束ID | 约束 | 说明 |
|--------|------|------|
| FE-01 | 不修改核心架构原则 | 保持现有分层和模块边界 |
| FE-02 | 不违反第一公理 | Agent 的自主决策必须有限制 |
| FE-03 | 向后兼容 | 不破坏现有 API 接口 |
| FE-04 | 类型安全 | 所有代码必须通过 TypeScript 严格模式检查 |
| FE-05 | 涉及叙事逻辑需作者审批 | 自动标记 `authorApproval` = 'pending' |
| FE-06 | 单模块变更不超过 500 行 | 超过时需分阶段提交 |

### 4.5 System Prompt

````markdown
# 角色定义

你是 **FeatureAgent**（功能智能体），NarrativeOS v3.0 Sovereign 开发集群中的
新功能开发专家。你的职责是将需求转化为高质量的、可测试的、文档化的代码实现。

## 核心能力

- 需求分析：从模糊的需求中提取明确的功能规格
- 架构设计：在现有架构中找到最佳接入点
- 技术选型：根据需求和约束选择合适的技术方案
- 代码生成：产出生产级 TypeScript 代码
- 接口设计：设计清晰、可测试的 API 接口

## 工作原则

1. **需求驱动**：每个代码行都必须可追溯到需求
2. **架构一致**：新功能必须与现有架构风格一致
3. **接口优先**：先设计接口，再实现内部逻辑
4. **测试伴随**：每个功能必须有对应的测试覆盖
5. **文档同步**：代码变更必须伴随文档更新
6. **安全第一**：绝不引入安全风险来实现功能便利

## 技术栈

- TypeScript 5.x（严格模式）
- XState 5.x（状态机用于复杂状态管理）
- PostgreSQL 16 + pgvector（数据持久化）
- Zod（运行时类型验证）
- Vitest（测试框架）

## 第一公理检查

NarrativeOS 的第一公理：
> **系统永远不得代替作者做出不可逆的叙事决策。**

在任何涉及叙事逻辑（角色命运、情节走向、世界设定）的功能中，你必须：
1. 明确识别需要作者确认的点
2. 设计"建议 → 确认"的交互模式
3. 在提案中标记所有需要 `authorApproval` 的位置
4. 默认所有叙事相关功能需要作者审批

## 输出格式

你必须输出符合 `PullRequestProposal` 结构的 JSON（type = 'feature'），包含：
- title: 遵循 Conventional Commits 格式，前缀为 `feat(模块):`
- description.alternatives: 最多 3 个备选实现方案
- description.approach: 推荐方案及其理由
- diffs: 完整的代码实现
- tests: 单元测试 + 集成测试
- impact: 详细的影响分析

## 绝对禁止

- 不要设计可能替代作者做叙事决策的功能
- 不要引入未经审查的新依赖
- 不要绕过现有安全控制
- 不要在功能代码中混合修复或重构
- 不要忽略类型安全（禁止 any 类型，除非有充分理由）
````

### 4.6 User Prompt 模板

````markdown
# 功能开发任务

## 需求信息

**需求ID**: {{requirement.id}}
**标题**: {{requirement.title}}
**优先级**: {{requirement.priority}}
**来源**: {{requirement.source}}

### 描述

{{requirement.description}}

### 验收标准

{{#requirement.acceptanceCriteria}}
- [ ] {{.}}
{{/requirement.acceptanceCriteria}}

---

## 现有架构

{{#existingArchitecture.relevantModules}}
### {{name}}（{{path}}）

{{description}}

关键接口：
{{#keyInterfaces}}
- {{.}}
{{/keyInterfaces}}

```typescript
{{codeSnippet}}
```

{{/existingArchitecture.relevantModules}}

### 相关 Pipeline

{{#existingArchitecture.relevantPipelines}}
- {{.}}
{{/existingArchitecture.relevantPipelines}}

{{#existingArchitecture.databaseSchema}}
### 相关数据库表

```sql
{{existingArchitecture.databaseSchema}}
```
{{/existingArchitecture.databaseSchema}}

---

## 接口约束

**必须实现的接口**:
{{#interfaceConstraints.mustImplement}}
- {{.}}
{{/interfaceConstraints.mustImplement}}

**不能破坏的接口**:
{{#interfaceConstraints.mustNotBreak}}
- {{.}}
{{/interfaceConstraints.mustNotBreak}}

**避免的模式**:
{{#interfaceConstraints.deprecatedPatterns}}
- {{.}}
{{/interfaceConstraints.deprecatedPatterns}}

---

## 技术偏好

- 语言: {{preferences.language}}
{{#preferences.preferredLibraries}}
- 偏好库: {{.}}
{{/preferences.preferredLibraries}}
{{#preferences.avoidLibraries}}
- 避免库: {{.}}
{{/preferences.avoidLibraries}}
{{#preferences.performanceTarget}}
- 性能目标: {{preferences.performanceTarget}}
{{/preferences.performanceTarget}}

---

## 第一公理检查

- 涉及叙事逻辑: {{firstAxiomCheck.involvesNarrativeLogic}}
- 影响作者控制权: {{firstAxiomCheck.affectsAuthorControl}}
{{#firstAxiomCheck.autonomousDecisionScope}}
- 自主决策范围: {{firstAxiomCheck.autonomousDecisionScope}}
{{/firstAxiomCheck.autonomousDecisionScope}}

---

请按以下步骤完成功能开发：

### 步骤 1: 需求分析

1. 提取功能的核心输入输出
2. 识别边界条件和异常场景
3. 判断是否涉及叙事逻辑（如涉及，标记需作者审批）

### 步骤 2: 架构设计

1. 分析现有架构的扩展点
2. 确定新功能的模块归属
3. 设计与现有模块的交互方式

### 步骤 3: 方案设计

生成最多 3 个实现方案：

**方案 A（推荐）**:
- 架构设计
- 接口定义
- 数据模型
- 技术选型
- 风险评估

**方案 B**:
（同上结构）

**方案 C**:
（同上结构）

### 步骤 4: 代码实现

基于推荐方案生成完整的 TypeScript 代码：
- 类型定义（interface / type）
- 核心实现
- 错误处理
- 日志记录
- 输入验证（Zod schema）

### 步骤 5: 测试

生成测试代码：
1. 单元测试（每个公共函数，目标覆盖率 >= 80%）
2. 集成测试（模块间交互）
3. 边界条件测试
4. 端到端测试（如适用）

### 步骤 6: 文档

生成文档更新：
- API 文档（函数签名 + 参数说明 + 返回值 + 示例）
- 变更日志条目
- 使用指南（如需要）

### 步骤 7: 完整提案

输出符合 PullRequestProposal 结构的 JSON。
````

---

## 5. Agent 3: OptimizationAgent（优化智能体）

### 5.1 职责范围

| 分类 | 具体职责 | 指标 |
|------|----------|------|
| **LLM 调用优化** | Prompt 压缩（减少 token 消耗） | 降低 20%+ token 使用 |
| | 缓存策略（命中相似请求） | 缓存命中率 > 60% |
| | 模型选择优化（根据任务选模型） | 在保持质量前提下降低成本 |
| | 批处理优化（合并小请求） | 减少 API 调用次数 |
| **数据库查询优化** | 慢查询重写 | 查询时间 < 100ms（P99） |
| | 索引建议 | 覆盖高频查询 |
| | 连接池调优 | 利用率 50-80%，无等待 |
| | 查询计划分析 | 消除全表扫描 |
| **代码性能优化** | 热点函数优化 | CPU 时间减少 30%+ |
| | 异步化改造 | I/O 等待时间减少 |
| | 内存优化 | 减少内存分配次数 |
| | 并发优化 | 提高并发处理能力 |
| **算法优化** | CSP 求解器性能 | 求解时间减少 40%+ |
| | 图扩散算法效率 | 迭代次数减少 |
| | 向量检索质量 | Recall@10 > 95% |

### 5.2 工作流程

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ 接收性能  │ → │ 瓶颈分析  │ → │ 方案生成  │ → │ A/B测试   │ → │ 提案组装  │
│ 报告      │   │ 火焰图等  │   │ (含基准)  │   │ 设计      │   │          │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
  性能指标      热点识别        优化策略        对照实验
  + 基准数据    + 根因定位      + 预期收益      + 成功标准
```

**步骤 1: 性能分析**
- 分析性能报告（火焰图、调用链、内存快照）
- 识别热点函数和瓶颈路径
- 收集基准数据（优化前的性能指标）

**步骤 2: 优化点定位**
- 确定最关键的性能瓶颈
- 评估每个优化点的潜在收益
- 按 ROI（投入产出比）排序优化机会

**步骤 3: 方案生成**
- 生成最多 3 个优化方案
- 每个方案包含：优化策略 + 预期收益 + 风险评估 + 基准对比
- 推荐最优方案

**步骤 4: A/B 测试设计**
- 设计对照实验
- 定义成功标准（性能提升阈值）
- 设计回滚策略

**步骤 5: 提案组装**
- 按 PullRequestProposal Schema 组装
- 标记变更类型为 `optimization`
- 包含详细的性能对比数据

### 5.3 输入输出格式

**输入:**
```typescript
interface OptimizationInput {
  // 性能报告
  performanceReport: {
    type: 'cpu' | 'memory' | 'io' | 'llm' | 'database' | 'vector_search' | 'algorithm';
    timestamp: string;
    // 火焰图数据
    flameGraph?: {
      topFunctions: Array<{
        name: string;
        file: string;
        selfTime: number;      // ms
        totalTime: number;     // ms
        callCount: number;
      }>;
    };
    // 调用链分析
    callChains?: Array<{
      path: string[];          // 调用路径
      totalTime: number;
      callCount: number;
    }>;
    // 内存分析
    memoryProfile?: {
      heapSize: number;
      gcFrequency: number;
      topAllocators: Array<{
        function: string;
        allocatedBytes: number;
      }>;
    };
    // LLM 指标
    llmMetrics?: {
      totalTokens: number;
      totalCalls: number;
      avgLatency: number;
      costPerRequest: number;
      cacheHitRate: number;
      topPrompts: Array<{
        endpoint: string;
        avgTokens: number;
        callCount: number;
      }>;
    };
    // 数据库指标
    dbMetrics?: {
      slowQueries: Array<{
        query: string;
        avgTime: number;
        callCount: number;
        rowsExamined: number;
      }>;
      connectionPoolStats: {
        total: number;
        active: number;
        waiting: number;
      };
    };
    // 基准数据
    baselineMetrics: Record<string, number>;
  };
  // 目标约束
  targets: {
    maxLatencyMs?: number;     // 最大延迟目标
    maxMemoryMB?: number;      // 内存上限
    maxCostPerRequest?: number; // 单次请求成本上限
    minThroughput?: number;    // 最小吞吐量
  };
  // 优化范围
  scope: {
    modules: string[];         // 允许优化的模块
    excludedFiles: string[];   // 排除的文件
    optimizationLevel: 'conservative' | 'moderate' | 'aggressive';
  };
}
```

**输出:** `PullRequestProposal`（type = 'optimization'）

### 5.4 约束与限制

| 约束ID | 约束 | 说明 |
|--------|------|------|
| OPT-01 | 必须有基准数据 | 所有优化必须附带 "优化前 vs 优化后" 对比 |
| OPT-02 | 不降低正确性 | 优化不能改变计算结果（允许近似算法需明确说明） |
| OPT-03 | 渐进式优化 | 优先低风险的优化，高风险优化需 A/B 测试 |
| OPT-04 | 可回滚 | 所有优化变更必须可在 5 分钟内回滚 |
| OPT-05 | 监控保留 | 不能移除现有的性能监控代码 |

### 5.5 System Prompt

````markdown
# 角色定义

你是 **OptimizationAgent**（优化智能体），NarrativeOS v3.0 Sovereign 开发集群中的
性能优化专家。你的职责是分析性能瓶颈并生成可量化的优化方案。

## 核心能力

- 性能分析：解读火焰图、调用链、内存分析
- 算法优化：选择更优算法和数据结构
- 系统级优化：I/O、并发、缓存、数据库调优
- LLM 优化：Prompt 工程、模型选择、缓存策略
- 基准测试：设计公平的性能对比实验

## 工作原则

1. **数据驱动**：每个优化建议必须有基准数据支撑
2. **可量化**：所有优化必须能表示为 "X% 提升" 或 "Y ms 减少"
3. **安全优先**：不为了性能牺牲正确性
4. **渐进式**：低风险优先，高风险需实验验证
5. **可回滚**：任何优化都必须在 5 分钟内可回滚

## 优化策略库

### LLM 调用优化
- Prompt 压缩：去除冗余上下文、使用更紧凑的格式
- 响应缓存：向量相似度缓存、精确匹配缓存
- 模型路由：简单任务用轻量模型、复杂任务用强力模型
- 批处理：合并小请求减少 API 开销

### 数据库优化
- 查询重写：避免 N+1 查询、使用覆盖索引
- 连接池调优：根据负载动态调整
- pgvector 优化：调整索引参数（lists、probes）

### 代码性能优化
- 热点函数内联或缓存
- 异步 I/O 避免阻塞
- 减少不必要的对象创建
- 使用流式处理替代全量加载

## 输出格式

你必须输出符合 `PullRequestProposal` 结构的 JSON（type = 'optimization'），必须包含：
- title: 遵循 Conventional Commits 格式，前缀为 `perf(模块):`
- impact.performanceImpact: 'improve'
- 详细的基准对比数据（before/after）
- A/B 测试设计方案
- 回滚策略

## 绝对禁止

- 不要引入未经测试的近似算法
- 不要移除错误处理和日志来换取性能
- 不要做可能改变系统行为的"优化"
- 不要在没有基准数据的情况下声称"优化"
````

### 5.6 User Prompt 模板

````markdown
# 性能优化任务

## 性能报告

**优化类型**: {{performanceReport.type}}
**报告时间**: {{performanceReport.timestamp}}

### 性能指标

{{#performanceReport.baselineMetrics}}
- {{@key}}: {{this}}
{{/performanceReport.baselineMetrics}}

{{#performanceReport.flameGraph}}
### 热点函数

{{#topFunctions}}
- {{name}} ({{file}}): 自身 {{selfTime}}ms / 总计 {{totalTime}}ms, 调用 {{callCount}} 次
{{/topFunctions}}
{{/performanceReport.flameGraph}}

{{#performanceReport.llmMetrics}}
### LLM 调用指标

- 总 Token 数: {{totalTokens}}
- 总调用次数: {{totalCalls}}
- 平均延迟: {{avgLatency}}ms
- 单次成本: ${{costPerRequest}}
- 缓存命中率: {{cacheHitRate}}%

**高频调用端点**:
{{#topPrompts}}
- {{endpoint}}: 平均 {{avgTokens}} tokens, {{callCount}} 次
{{/topPrompts}}
{{/performanceReport.llmMetrics}}

{{#performanceReport.dbMetrics}}
### 慢查询

{{#slowQueries}}
- 查询: {{query}}
  - 平均耗时: {{avgTime}}ms
  - 调用次数: {{callCount}}
  - 扫描行数: {{rowsExamined}}
{{/slowQueries}}
{{/performanceReport.dbMetrics}}

---

## 优化目标

{{#targets.maxLatencyMs}}- 最大延迟: {{targets.maxLatencyMs}}ms{{/targets.maxLatencyMs}}
{{#targets.maxMemoryMB}}- 内存上限: {{targets.maxMemoryMB}}MB{{/targets.maxMemoryMB}}
{{#targets.maxCostPerRequest}}- 单次成本上限: ${{targets.maxCostPerRequest}}{{/targets.maxCostPerRequest}}
{{#targets.minThroughput}}- 最小吞吐量: {{targets.minThroughput}} req/s{{/targets.minThroughput}}

---

## 优化范围

**允许优化的模块**:
{{#scope.modules}}
- {{.}}
{{/scope.modules}}

**排除的文件**:
{{#scope.excludedFiles}}
- {{.}}
{{/scope.excludedFiles}}

**优化级别**: {{scope.optimizationLevel}}

---

请按以下步骤完成性能优化：

### 步骤 1: 瓶颈分析

1. 识别最主要的性能瓶颈（按影响大小排序）
2. 分析瓶颈的根本原因
3. 评估每个瓶颈的优化潜力

### 步骤 2: 优化方案

生成最多 3 个优化方案：

**方案 A（推荐）**:
- 优化策略
- 涉及的文件和函数
- 预期收益（量化）
- 风险评估
- 实施难度

**方案 B**:
（同上结构）

**方案 C**:
（同上结构）

### 步骤 3: A/B 测试设计

设计对照实验：
- 对照组（现有实现）
- 实验组（优化实现）
- 成功标准（性能提升阈值）
- 观察时长
- 回滚触发条件

### 步骤 4: 代码实现

生成优化后的代码：
- 优化后的函数/类
- 关键优化点的注释说明
- 性能监控埋点

### 步骤 5: 基准对比

提供优化前后的对比数据：

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| ...  | ...    | ...    | ...  |

### 步骤 6: 完整提案

输出符合 PullRequestProposal 结构的 JSON，包含：
- 详细的基准对比数据
- A/B 测试方案
- 回滚策略
````

---

## 6. Agent 4: SecurityAgent（安全智能体）

### 6.1 职责范围

| 分类 | 具体职责 | 示例 |
|------|----------|------|
| **Prompt 注入防护** | 用户输入过滤 | 检测并中和 Prompt 注入攻击 |
| | 模板转义 | 确保模板变量正确转义 |
| | 指令分隔 | 使用明确的指令/内容分隔符 |
| **数据泄露防护** | API Key 管理 | 禁止硬编码密钥、使用密钥管理服务 |
| | 日志脱敏 | 自动检测并脱敏日志中的敏感信息 |
| | 数据传输加密 | 确保敏感数据在传输中加密 |
| **权限控制审计** | 未授权访问检测 | 检查缺少鉴权的 API 端点 |
| | 权限提升检测 | 检查可能的权限绕过路径 |
| | 最小权限原则 | 确保服务以最小权限运行 |
| **依赖漏洞扫描** | npm 包漏洞 | 扫描已知 CVE 漏洞 |
| | 许可证合规 | 检查依赖许可证兼容性 |
| | 依赖更新建议 | 推荐安全版本升级 |

### 6.2 工作流程

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ 安全扫描  │ → │ 漏洞评估  │ → │ 修复方案  │ → │ 安全测试  │ → │ 提案组装  │
│          │   │ (CVSS)   │   │ 生成      │   │ 验证      │   │          │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
  代码扫描       CVSS评分       修复补丁       渗透测试
  依赖扫描       影响范围       配置加固       回归验证
  配置审计
```

**步骤 1: 安全扫描**
- 静态代码安全分析（SAST）
- 依赖漏洞扫描（npm audit / Snyk）
- 配置审计（检查敏感配置泄露）
- Prompt 注入向量扫描

**步骤 2: 漏洞评估**
- CVSS 评分（如适用）
- 影响范围分析（数据泄露、权限提升、服务中断）
- 可利用性评估（攻击复杂度、所需权限）
- 修复优先级排序

**步骤 3: 修复方案生成**
- 为每个漏洞生成修复方案
- 包含修复代码 + 修复说明 + 验证方法
- 区分临时缓解措施和根本修复

**步骤 4: 安全测试验证**
- 生成针对漏洞的回归测试
- 设计渗透测试用例
- 验证修复不会引入新漏洞

### 6.3 输入输出格式

**输入:**
```typescript
interface SecurityInput {
  // 扫描类型
  scanType: 'code_scan' | 'dependency_scan' | 'config_audit' | 
            'prompt_injection_test' | 'full_security_audit';
  // 代码库
  codebase: {
    files: Array<{
      path: string;
      content: string;
      language: string;
    }>;
    // 重点关注文件
    criticalFiles: string[];   // 处理敏感数据的文件
  };
  // 依赖清单
  dependencies: {
    production: Array<{name: string; version: string}>;
    development: Array<{name: string; version: string}>;
  };
  // 配置文件
  configurations: Array<{
    file: string;
    content: string;
  }>;
  // 已知漏洞参考
  knownVulnerabilities?: Array<{
    cveId?: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    affectedFiles: string[];
  }>;
  // 合规要求
  compliance?: {
    standards: string[];       // 'GDPR' | 'CCPA' | 'SOC2' 等
    dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  };
}
```

**输出:** `PullRequestProposal`（type = 'security'）

### 6.4 约束与限制

| 约束ID | 约束 | 说明 |
|--------|------|------|
| SEC-01 | 安全优先于功能 | 安全修复优先级高于功能开发 |
| SEC-02 | 不引入新攻击面 | 修复不能创造新的安全漏洞 |
| SEC-03 | 最小权限 | 修复后的代码遵循最小权限原则 |
| SEC-04 | 可验证 | 每个安全修复必须有对应的测试验证 |
| SEC-05 | 及时性 | Critical 级别漏洞 24 小时内修复 |
| SEC-06 | 秘密不泄露 | 不得在代码或日志中暴露密钥 |

### 6.5 System Prompt

````markdown
# 角色定义

你是 **SecurityAgent**（安全智能体），NarrativeOS v3.0 Sovereign 开发集群中的
安全专家。你的职责是发现安全漏洞并生成修复方案，保护系统和用户数据。

## 核心能力

- 代码安全分析：识别常见漏洞模式（OWASP Top 10）
- Prompt 注入检测：识别 LLM 应用的注入攻击向量
- 依赖安全：分析 npm 包的已知漏洞
- 数据保护：确保敏感数据的正确处理和存储
- 权限审计：检查访问控制和权限边界

## 安全威胁模型

NarrativeOS 面临的特有风险：
1. **Prompt 注入**：恶意用户输入影响 LLM 行为
2. **数据泄露**：作者手稿、角色设定等敏感内容泄露
3. **权限绕过**：未授权访问其他作者的内容
4. **供应链攻击**：恶意 npm 包植入后门
5. **模型滥用**：通过系统 API 滥用 LLM 资源

## 工作原则

1. **安全优先**：安全 > 功能 > 性能
2. **纵深防御**：多层防护，不依赖单一安全控制
3. **默认安全**：默认配置必须是安全的
4. **最小权限**：每个组件只拥有必要的权限
5. **可验证**：每个安全控制必须有测试验证

## 输出格式

你必须输出符合 `PullRequestProposal` 结构的 JSON（type = 'security'），包含：
- title: 遵循 Conventional Commits 格式，前缀为 `security(模块):`
- security 字段详细填写（攻击面、敏感数据处理、权限变更）
- 漏洞的 CVSS 评分（如适用）
- 安全测试用例

## 绝对禁止

- 不要在代码中硬编码密钥或凭据
- 不要通过注释 "暂时禁用" 安全控制
- 不要引入已知有漏洞的依赖版本
- 不要在日志中输出敏感数据
- 不要做可能降低安全性的"便利"修改
````

### 6.6 User Prompt 模板

````markdown
# 安全任务

## 扫描类型: {{scanType}}

## 代码库

{{#codebase.files}}
### {{path}}

```{{language}}
{{content}}
```

{{/codebase.files}}

## 关键文件（处理敏感数据）

{{#codebase.criticalFiles}}
- {{.}}
{{/codebase.criticalFiles}}

---

## 依赖清单

**生产依赖**:
{{#dependencies.production}}
- {{name}}@{{version}}
{{/dependencies.production}}

**开发依赖**:
{{#dependencies.development}}
- {{name}}@{{version}}
{{/dependencies.development}}

---

## 配置文件

{{#configurations}}
### {{file}}

```
{{content}}
```

{{/configurations}}

---

{{#knownVulnerabilities}}
## 已知漏洞

{{#.}}
- **{{severity}}** {{#cveId}}({{cveId}}){{/cveId}}: {{description}}
  - 影响文件: {{affectedFiles}}
{{/.}}
{{/knownVulnerabilities}}

{{#compliance}}
## 合规要求

- 标准: {{standards}}
- 数据分类: {{dataClassification}}
{{/compliance}}

---

请按以下步骤完成安全分析：

### 步骤 1: 安全扫描

进行全面的安全扫描：

**A. 代码安全扫描**
1. 检查注入漏洞（SQL、NoSQL、命令注入、Prompt 注入）
2. 检查身份验证和授权缺陷
3. 检查敏感数据泄露（日志、错误消息、API 响应）
4. 检查不安全的反序列化
5. 检查 SSRF / 路径遍历
6. 检查不安全的随机数生成

**B. 依赖漏洞扫描**
1. 检查已知 CVE 漏洞
2. 检查许可证合规性
3. 检查依赖的健康状况（维护状态、社区活跃度）

**C. 配置审计**
1. 检查密钥管理
2. 检查 CORS 配置
3. 检查日志配置
4. 检查调试模式是否关闭

### 步骤 2: 漏洞评估

对每个发现的漏洞：
- 分配严重程度（Critical / High / Medium / Low / Info）
- CVSS 评分（如适用）
- 影响范围分析
- 利用难度评估
- 修复优先级

### 步骤 3: 修复方案

对每个漏洞生成修复方案：
- 漏洞描述
- 修复代码（diff 格式）
- 修复说明
- 验证方法

### 步骤 4: 安全测试

生成安全测试用例：
- 针对每个漏洞的回归测试
- 渗透测试用例
- 输入验证测试

### 步骤 5: 完整提案

输出符合 PullRequestProposal 结构的 JSON。
````



---

## 7. Agent 5: RefactorAgent（重构智能体）

### 7.1 职责范围

| 分类 | 具体职责 | 指标 |
|------|----------|------|
| **代码质量提升** | 圈复杂度降低 | 函数复杂度 < 10 |
| | 重复代码消除 | DRY 原则，提取公共函数 |
| | 函数长度控制 | 函数 < 50 行（推荐 < 30） |
| | 命名改善 | 语义化命名，消除模糊名称 |
| **架构清理** | 过时代码移除 | 移除已废弃的函数和模块 |
| | 接口统一 | 统一相似但不同的接口 |
| | 依赖清理 | 移除未使用的依赖 |
| | 模块边界清晰化 | 消除循环依赖 |
| **技术债务偿还** | 类型安全增强 | 消除 any 类型、完善类型定义 |
| | 错误处理统一 | 统一错误处理模式 |
| | 日志规范 | 统一日志格式和级别 |
| | 注释清理 | 移除过时注释、添加必要文档 |

### 7.2 工作流程

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ 质量扫描  │ → │ 重构机会  │ → │ 安全重构  │ → │ 回归测试  │ → │ 提案组装  │
│          │   │ 识别      │   │ (小步快跑) │   │ 生成      │   │          │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
  复杂度分析      优先级排序      原子化步骤      行为验证
  重复检测        风险评估        每步可验证      快照测试
```

**步骤 1: 代码质量扫描**
- 计算各函数的圈复杂度（Cyclomatic Complexity）
- 检测重复代码（相似度 > 80% 的代码块）
- 识别过长函数（> 50 行）和过大类
- 检测 any 类型使用、未使用变量

**步骤 2: 重构机会识别**
- 按质量影响排序重构机会
- 评估每个重构的风险等级
- 选择高影响、低风险的重构点优先处理

**步骤 3: 安全重构方案**
- 将重构拆分为小的、独立的步骤
- 每个步骤都是可编译、可测试的
- 使用"小步快跑"策略：编译 → 测试 → 提交 → 重复

**步骤 4: 回归测试生成**
- 为重构的代码生成快照测试（确保输出不变）
- 验证重构前后行为一致性
- 检查性能是否有退化

### 7.3 输入输出格式

**输入:**
```typescript
interface RefactorInput {
  // 代码质量报告
  qualityReport: {
    // 复杂度分析
    complexity: Array<{
      file: string;
      function: string;
      complexity: number;       // 圈复杂度
      lines: number;
      nestedDepth: number;      // 嵌套深度
    }>;
    // 重复代码
    duplications: Array<{
      files: string[];
      lines: number;
      similarity: number;       // 相似度百分比
      snippet: string;
    }>;
    // 代码异味
    codeSmells: Array<{
      file: string;
      line: number;
      type: 'long_method' | 'large_class' | 'god_object' |
            'feature_envy' | 'data_clump' | 'primitive_obsession' |
            'switch_statements' | 'temporary_field' | 'refused_bequest';
      description: string;
      severity: 'high' | 'medium' | 'low';
    }>;
    // 类型安全
    typeSafety: {
      anyCount: number;
      implicitAnyCount: number;
      missingTypes: Array<{
        file: string;
        symbol: string;
        currentType: string;
      }>;
    };
    // 架构问题
    architectural: {
      circularDependencies: Array<{
        cycle: string[];
        description: string;
      }>;
      unusedExports: Array<{
        file: string;
        export: string;
      }>;
      orphanedFiles: string[];
    };
  };
  // 重构范围
  scope: {
    targetFiles: string[];
    excludedFiles: string[];
    maxComplexityTarget?: number;  // 目标复杂度上限（默认10）
    maxFunctionLines?: number;     // 目标函数行数上限（默认50）
  };
  // 重构约束
  constraints: {
    preserveBehavior: boolean;     // 必须保持行为不变（默认true）
    maxStepsPerProposal: number;   // 单个提案的最大重构步骤（默认5）
    allowNewFiles: boolean;        // 允许创建新文件（默认true）
  };
}
```

**输出:** `PullRequestProposal`（type = 'refactor'）

### 7.4 约束与限制

| 约束ID | 约束 | 说明 |
|--------|------|------|
| REF-01 | **不改变行为** | 重构前后外部行为必须完全一致 |
| REF-02 | **小步快跑** | 每次重构一步，每步可独立验证 |
| REF-03 | **可回滚** | 每个重构步骤可在 1 分钟内回滚 |
| REF-04 | **不修改功能** | 重构 ≠ 功能修改 |
| REF-05 | **保持接口兼容** | 不修改公共接口签名 |
| REF-06 | **逐步提交** | 复杂重构拆分为多个独立提案 |

### 7.5 System Prompt

````markdown
# 角色定义

你是 **RefactorAgent**（重构智能体），NarrativeOS v3.0 Sovereign 开发集群中的
代码质量专家。你的职责是通过安全、渐进的重构提升代码质量，而不改变任何行为。

## 核心能力

- 代码质量分析：计算圈复杂度、检测重复、识别代码异味
- 安全重构：使用 Martin Fowler 的重构目录模式
- 架构清理：消除技术债务、统一接口、清理依赖
- 行为保持：确保重构前后行为完全一致

## 重构原则

1. **行为不变**：重构绝对不能改变代码的外部行为
2. **小步快跑**：每次只做一个小重构，编译 → 测试 → 提交
3. **自动化支持**：优先使用 IDE 自动化重构工具能做的操作
4. **测试先行**：重构前确保有充分的测试覆盖
5. **代码审查**：每个重构步骤都必须可审查

## 允许的重构模式

- 提取函数 / 提取变量
- 重命名（函数、变量、类）
- 内联函数 / 内联变量
- 移动函数 / 移动类
- 简化条件表达式
- 引入参数对象
- 移除重复代码（提取公共函数）
- 用多态替代条件判断
- 类型安全增强（消除 any，添加类型）

## 绝对禁止的重构

- 不要修改函数的外部行为
- 不要修改公共接口签名
- 不要在重构中混入功能修改
- 不要删除仍在使用的代码
- 不要做不可回滚的大范围修改

## 输出格式

你必须输出符合 `PullRequestProposal` 结构的 JSON（type = 'refactor'），包含：
- title: 遵循 Conventional Commits 格式，前缀为 `refactor(模块):`
- description.approach: 详细描述重构步骤
- diffs: 原子化的代码变更
- tests: 快照测试或行为验证测试
- impact.backwardCompatible: 必须为 true

## 质量指标

重构完成后应达到：
- 圈复杂度 < 10（所有函数）
- 函数长度 < 50 行
- 重复代码相似度 < 80% → 提取公共函数
- any 类型使用 < 1%
- 无循环依赖
````

### 7.6 User Prompt 模板

````markdown
# 重构任务

## 代码质量报告

### 高复杂度函数

{{#qualityReport.complexity}}
{{#complexity}}
- {{file}}::{{function}}: 复杂度 {{complexity}}, {{lines}} 行, 嵌套深度 {{nestedDepth}}
{{/complexity}}
{{/qualityReport.complexity}}

### 重复代码

{{#qualityReport.duplications}}
- 文件: {{files}} | 相似度 {{similarity}}% | {{lines}} 行
```
{{snippet}}
```
{{/qualityReport.duplications}}

### 代码异味

{{#qualityReport.codeSmells}}
- [{{severity}}] {{file}}:{{line}} — {{type}}: {{description}}
{{/qualityReport.codeSmells}}

### 类型安全问题

- any 类型使用: {{qualityReport.typeSafety.anyCount}} 处
- 隐式 any: {{qualityReport.typeSafety.implicitAnyCount}} 处

{{#qualityReport.typeSafety.missingTypes}}
- 缺少类型: {{file}}::{{symbol}} (当前: {{currentType}})
{{/qualityReport.typeSafety.missingTypes}}

### 架构问题

{{#qualityReport.architectural.circularDependencies}}
- 循环依赖: {{cycle}}
{{/qualityReport.architectural.circularDependencies}}

---

## 重构范围

**目标文件**:
{{#scope.targetFiles}}
- {{.}}
{{/scope.targetFiles}}

**排除文件**:
{{#scope.excludedFiles}}
- {{.}}
{{/scope.excludedFiles}}

**目标复杂度上限**: {{scope.maxComplexityTarget}}
**目标函数行数上限**: {{scope.maxFunctionLines}}

---

## 约束

- 保持行为不变: {{constraints.preserveBehavior}}
- 最大步骤数: {{constraints.maxStepsPerProposal}}
- 允许创建新文件: {{constraints.allowNewFiles}}

---

请按以下步骤完成重构：

### 步骤 1: 重构计划

识别优先级最高的重构机会：
1. 按影响大小排序
2. 评估风险等级
3. 制定分步计划

### 步骤 2: 分步重构

将重构拆分为可独立验证的步骤：

{{#constraints.maxStepsPerProposal}}
最多 {{constraints.maxStepsPerProposal}} 个步骤：
{{/constraints.maxStepsPerProposal}}

**步骤 1**: （描述）
- 重构操作
- 涉及的文件和函数
- 预期效果

**步骤 2**: （描述）
（同上）

### 步骤 3: 代码变更

生成每个步骤的代码变更（diff 格式）：

### 步骤 4: 回归测试

生成行为验证测试：
- 快照测试（如有输出变化风险）
- 单元测试（确保核心逻辑不变）
- 集成测试（确保模块间交互不变）

### 步骤 5: 质量改善度量

重构前后的对比：

| 指标 | 重构前 | 重构后 | 改善 |
|------|--------|--------|------|
| 平均圈复杂度 | ... | ... | ... |
| 重复代码块 | ... | ... | ... |
| any 类型数 | ... | ... | ... |

### 步骤 6: 完整提案

输出符合 PullRequestProposal 结构的 JSON。
````

---

## 8. Agent 6: TestAgent（测试智能体）

### 8.1 职责范围

| 分类 | 具体职责 | 说明 |
|------|----------|------|
| **为其他 Agent 产出测试** | 为 BugFix、Feature、Refactor 等 Agent 的代码变更生成测试 | 双重验证机制 |
| **补充缺失测试覆盖** | 扫描未测试代码，补充测试 | 目标行覆盖率 >= 80% |
| **生成回归测试套件** | 针对已知问题生成回归测试 | 防止 bug 复发 |
| **执行测试并验证** | 运行测试并生成报告 | 标记通过/失败 |
| **XState 状态机测试** | 全覆盖状态转换测试 | 每个状态/事件/守卫都测试 |

### 8.2 测试策略

#### 8.2.1 单元测试

```typescript
// 测试设计方法论
interface UnitTestStrategy {
  // 等价类划分
  equivalenceClasses: Array<{
    name: string;
    inputs: unknown[];
    expected: unknown;
    description: string;
  }>;
  
  // 边界值分析
  boundaryValues: Array<{
    name: string;
    input: unknown;
    expected: unknown | 'throw';
    description: string;
  }>;
  
  // 异常值测试
  exceptionValues: Array<{
    name: string;
    input: unknown;
    expectedError: string;
    description: string;
  }>;
  
  // Mock 策略
  mocks: Array<{
    target: string;            // 需要 mock 的依赖
    behavior: 'stub' | 'spy' | 'mock';
    returnValue?: unknown;
  }>;
}
```

#### 8.2.2 集成测试

- 模块间 API 调用测试
- 数据库交互测试（使用测试数据库）
- 外部服务交互测试（mock 外部 API）
- 消息队列测试

#### 8.2.3 XState 状态机测试（核心）

```typescript
// XState 状态机全覆盖测试策略
interface XStateTestStrategy {
  // 状态覆盖：每个状态至少被访问一次
  stateCoverage: Array<{
    state: string;
    testCases: Array<{
      sequence: string[];       // 事件序列到达该状态
      assertions: string[];     // 断言条件
    }>;
  }>;
  
  // 转换覆盖：每个状态-事件组合
  transitionCoverage: Array<{
    from: string;
    event: string;
    to: string;
    guard?: string;             // 守卫条件
    testCases: Array<{
      context: Record<string, unknown>;
      expectedTarget: string;
      expectedActions?: string[];
    }>;
  }>;
  
  // 守卫条件覆盖：每个守卫的真/假分支
  guardCoverage: Array<{
    guard: string;
    truthyTest: { context: Record<string, unknown>; expected: boolean };
    falsyTest: { context: Record<string, unknown>; expected: boolean };
  }>;
  
  // 无效转换测试：不允许的事件
  invalidTransitionTests: Array<{
    currentState: string;
    invalidEvent: string;
    expectedBehavior: 'ignore' | 'error' | 'fallback';
  }>;
}
```

#### 8.2.4 端到端测试（E2E）

- 完整 MOU（Memorandum of Understanding）流程测试
- 用户场景模拟
- 数据持久化验证

### 8.3 工作流程

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ 分析代码  │ → │ 生成用例  │ → │ 生成代码  │ → │ 执行测试  │ → │ 生成报告  │
│ 变更      │   │ (等价类)  │   │ (测试代码) │   │          │   │          │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
  变更差异分析    边界值识别      TypeScript      通过/失败
  影响范围        异常场景        Vitest代码      覆盖率报告
  风险点          状态转换        Mock设置        失败分析
```

**步骤 1: 代码变更分析**
- 分析变更的代码差异
- 确定受影响的函数和模块
- 识别测试重点和高风险点

**步骤 2: 测试用例生成**
- 等价类划分：将输入空间划分为等价类
- 边界值分析：每个等价类的边界
- 异常值测试：无效输入的处理
- 对于 XState：状态全覆盖 + 转换全覆盖 + 守卫全覆盖

**步骤 3: 测试代码生成**
- 生成 TypeScript 测试代码
- 使用 Vitest 框架
- 设置适当的 mock
- 确保类型安全

**步骤 4: 测试执行**
- 运行测试
- 收集覆盖率数据
- 记录失败原因

**步骤 5: 测试报告**
- 汇总测试结果
- 计算覆盖率
- 标记通过的测试和失败的测试
- 对失败测试提供诊断建议

### 8.4 输入输出格式

**输入:**
```typescript
interface TestInput {
  // 被测试的代码变更
  codeChanges: {
    proposalId: string;
    originalCode: Record<string, string>;   // 文件路径 -> 原始代码
    modifiedCode: Record<string, string>;   // 文件路径 -> 修改后代码
    diff: DiffHunk[];
  };
  // 变更分析
  changeAnalysis: {
    addedFunctions: string[];
    modifiedFunctions: string[];
    deletedFunctions: string[];
    addedTypes: string[];
    modifiedTypes: string[];
    affectedStateMachines?: string[];
  };
  // 现有测试
  existingTests: Array<{
    file: string;
    testCases: string[];
  }>;
  // 测试要求
  requirements: {
    targetLineCoverage: number;     // 目标行覆盖率（默认80%）
    targetBranchCoverage: number;   // 目标分支覆盖率（默认70%）
    includeStateMachineTests: boolean;
    includeE2ETests: boolean;
    mockExternalDeps: boolean;
  };
  // 生成的测试（来自其他 Agent）
  agentGeneratedTests?: TestCase[];
}
```

**输出:** `PullRequestProposal`（type = 'test'）+ 独立的 `TestReport`

```typescript
interface TestReport {
  proposalId: string;
  generatedBy: string;            // TestAgent ID
  generatedAt: string;
  
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;              // ms
  };
  
  coverage: {
    lines: { covered: number; total: number; percentage: number };
    branches: { covered: number; total: number; percentage: number };
    functions: { covered: number; total: number; percentage: number };
    statements: { covered: number; total: number; percentage: number };
  };
  
  results: Array<{
    testId: string;
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: string;
    stackTrace?: string;
    file: string;
  }>;
  
  // 质量评估
  quality: {
    coverageMet: boolean;
    allCriticalPathsTested: boolean;
    edgeCasesCovered: boolean;
    recommendations: string[];
  };
}
```

### 8.5 约束与限制

| 约束ID | 约束 | 说明 |
|--------|------|------|
| TST-01 | 测试必须独立 | 每个测试可独立运行，不依赖其他测试 |
| TST-02 | 测试必须可重复 | 相同输入始终产生相同结果 |
| TST-03 | 使用真实类型 | 测试代码必须类型安全 |
| TST-04 | Mock 最小化 | 仅在必要时 mock，优先使用真实依赖 |
| TST-05 | 命名规范 | 测试名必须描述行为和预期 |
| TST-06 | 快速执行 | 单元测试必须在 100ms 内完成 |

### 8.6 System Prompt

````markdown
# 角色定义

你是 **TestAgent**（测试智能体），NarrativeOS v3.0 Sovereign 开发集群中的
测试工程专家。你的职责是为代码变更生成高质量的测试用例，确保代码正确性和可靠性。

## 核心能力

- 测试设计：等价类划分、边界值分析、异常值测试
- XState 测试：状态机全覆盖测试生成
- 测试代码生成：使用 Vitest 的 TypeScript 测试代码
- Mock 设计：合理的依赖隔离
- 测试执行与报告：自动化测试执行和结果分析

## 测试原则

1. **FIRST 原则**：Fast（快）、Independent（独立）、Repeatable（可重复）、
   Self-validating（自验证）、Timely（及时）
2. **AAA 模式**：Arrange（准备）、Act（执行）、Assert（断言）
3. **一个概念一个测试**：每个测试只验证一个概念
4. **描述性行为命名**：测试名应描述行为和预期结果
5. **边界优先**：优先测试边界条件和异常情况

## 测试策略

### 单元测试
- 等价类划分：将输入分为有效/无效等价类
- 边界值：每个等价类的边界值必测
- 异常路径：错误处理、空值、越界
- Mock 策略：外部依赖 mock，内部逻辑真实

### 集成测试
- 模块间接口契约测试
- 数据库操作测试（使用测试数据库）
- 外部 API 调用测试（使用 mock server）

### XState 状态机测试（重点）
- 每个状态至少被访问一次
- 每个有效状态-事件组合测试
- 每个守卫条件的真/假分支
- 无效事件的处理

### 端到端测试
- 完整业务流程
- 数据持久化验证
- 用户场景模拟

## 输出格式

你必须输出：
1. 符合 `PullRequestProposal` 结构的 JSON（type = 'test'）
2. `TestReport` 结构

测试代码使用 Vitest + TypeScript：
```typescript
import { describe, it, expect, vi } from 'vitest';
```

## 绝对禁止

- 不要生成相互依赖的测试
- 不要在测试中使用 `any` 类型
- 不要忽略测试中的异步处理
- 不要生成没有断言的测试
- 不要在测试中使用随机数据（除非专门测试随机性）
````

### 8.7 User Prompt 模板

````markdown
# 测试生成任务

## 代码变更信息

**提案ID**: {{codeChanges.proposalId}}

### 变更摘要

{{#changeAnalysis.addedFunctions}}
- 新增函数: {{.}}
{{/changeAnalysis.addedFunctions}}
{{#changeAnalysis.modifiedFunctions}}
- 修改函数: {{.}}
{{/changeAnalysis.modifiedFunctions}}
{{#changeAnalysis.deletedFunctions}}
- 删除函数: {{.}}
{{/changeAnalysis.deletedFunctions}}
{{#changeAnalysis.affectedStateMachines}}
- 影响的状态机: {{.}}
{{/changeAnalysis.affectedStateMachines}}

### 代码差异

{{#codeChanges.diff}}
**文件**: {{filePath}}
```diff
{{diff}}
```
{{/codeChanges.diff}}

---

### 原始代码

{{#codeChanges.originalCode}}
**{{@key}}**:
```typescript
{{this}}
```
{{/codeChanges.originalCode}}

### 修改后代码

{{#codeChanges.modifiedCode}}
**{{@key}}**:
```typescript
{{this}}
```
{{/codeChanges.modifiedCode}}

---

## 测试要求

- 行覆盖率目标: {{requirements.targetLineCoverage}}%
- 分支覆盖率目标: {{requirements.targetBranchCoverage}}%
- 生成状态机测试: {{requirements.includeStateMachineTests}}
- 生成 E2E 测试: {{requirements.includeE2ETests}}
- Mock 外部依赖: {{requirements.mockExternalDeps}}

---

{{#agentGeneratedTests}}
## 其他 Agent 生成的测试（参考）

{{#.}}
- {{id}}: {{name}} ({{type}})
{{/.}}
{{/agentGeneratedTests}}

---

请按以下步骤生成测试：

### 步骤 1: 变更分析

1. 识别需要测试的新增/修改的函数
2. 分析每个函数的输入输出契约
3. 识别高风险点和关键路径
4. 确定测试优先级

### 步骤 2: 测试用例设计

对每个函数设计测试用例：

**函数: [函数名]**

**等价类划分**:
| 等价类 | 代表值 | 预期结果 |
|--------|--------|----------|
| ...    | ...    | ...      |

**边界值分析**:
| 边界值 | 类型 | 预期结果 |
|--------|------|----------|
| ...    | ...  | ...      |

**异常值**:
| 输入 | 预期错误 |
|------|----------|
| ...  | ...      |

{{#changeAnalysis.affectedStateMachines}}
### XState 状态机测试

对每个状态机生成全覆盖测试：

**状态覆盖**:
- [状态名]: 通过 [事件序列] 到达

**转换覆盖**:
| 当前状态 | 事件 | 守卫 | 目标状态 |
|----------|------|------|----------|
| ...      | ...  | ...  | ...      |

**无效转换测试**:
| 当前状态 | 无效事件 | 预期行为 |
|----------|----------|----------|
| ...      | ...      | ...      |
{{/changeAnalysis.affectedStateMachines}}

### 步骤 3: 测试代码生成

使用 Vitest + TypeScript 生成完整测试代码：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 测试代码...
```

### 步骤 4: 覆盖率分析

预期的覆盖率报告：
- 行覆盖率: [X]%
- 分支覆盖率: [X]%
- 函数覆盖率: [X]%

### 步骤 5: 完整输出

输出：
1. 符合 PullRequestProposal 结构的 JSON
2. TestReport 结构
````

---

## 9. Agent 7: DocAgent（文档智能体）

### 9.1 职责范围

| 分类 | 具体职责 | 说明 |
|------|----------|------|
| **API 文档同步** | 接口变更文档更新 | 函数签名、参数、返回值、示例 |
| | 类型定义文档 | Interface/Type 文档化 |
| | 错误码文档 | 错误代码和含义 |
| **变更日志维护** | 版本变更记录 | 遵循 Keep a Changelog 格式 |
| | 版本号更新 | SemVer 版本管理 |
| | 破坏性变更记录 | Breaking changes 说明 |
| **架构文档更新** | 模块关系图 | 更新架构图和模块描述 |
| | 数据流图 | 更新数据流描述 |
| | 部署图 | 更新部署架构 |
| **开发者指南** | 环境搭建 | 本地开发环境配置 |
| | 编码规范 | 项目特定的编码规范 |
| | 贡献指南 | 外部贡献者指南 |

### 9.2 工作流程

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ 分析代码  │ → │ 影响识别  │ → │ 文档更新  │ → │ 一致性   │ → │ 提案组装  │
│ 变更      │   │ (范围)    │   │ (生成)    │   │ 检查     │   │          │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
  代码差异分析    受影响文档      API文档更新     链接检查
  符号提取        范围确定        架构图更新      引用一致性
                                 变更日志条目
```

**步骤 1: 代码变更分析**
- 分析代码差异，提取变更的符号（函数、类、接口）
- 确定变更类型（新增/修改/删除）
- 判断变更的文档影响级别

**步骤 2: 文档影响识别**
- 识别需要更新的文档文件
- 确定每个文档需要更新的内容
- 评估文档变更的范围

**步骤 3: 文档更新**
- 更新 API 文档（函数签名、参数说明、返回值、示例代码）
- 更新变更日志
- 更新架构文档（如影响架构）
- 更新开发者指南（如影响开发流程）

**步骤 4: 一致性检查**
- 检查文档中的交叉引用是否有效
- 检查文档与代码的一致性
- 检查文档格式规范

### 9.3 输入输出格式

**输入:**
```typescript
interface DocInput {
  // 代码变更
  codeChanges: {
    proposalId: string;
    proposalType: 'bugfix' | 'feature' | 'optimization' | 'security' | 'refactor' | 'test';
    title: string;
    description: string;
    affectedFiles: Array<{
      path: string;
      changeType: 'added' | 'modified' | 'deleted' | 'renamed';
      summary: string;
    }>;
    diffs: DiffHunk[];
  };
  // 变更涉及的符号
  symbols: Array<{
    name: string;
    type: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable' | 'constant';
    file: string;
    signature: string;
    jsdoc: string;             // 现有的 JSDoc 注释
    changeType: 'added' | 'modified' | 'deleted';
  }>;
  // 现有文档
  existingDocs: Array<{
    file: string;
    content: string;
    type: 'api' | 'changelog' | 'architecture' | 'guide' | 'readme';
  }>;
  // 文档要求
  docRequirements: {
    docStyle: 'jsdoc' | 'tsdoc' | 'markdown';
    includeExamples: boolean;
    includeMigrationGuide?: boolean;  // 如有 breaking changes
  };
}
```

**输出:** `PullRequestProposal`（type = 'docs'）

### 9.4 约束与限制

| 约束ID | 约束 | 说明 |
|--------|------|------|
| DOC-01 | 文档与代码一致 | 文档描述必须与代码实现完全一致 |
| DOC-02 | 遵循项目文档规范 | 使用项目定义的文档格式和风格 |
| DOC-03 | 包含代码示例 | API 文档必须包含使用示例 |
| DOC-04 | 变更日志必须更新 | 任何代码变更都必须在 CHANGELOG 中记录 |
| DOC-05 | 链接有效 | 文档中的交叉引用和链接必须有效 |
| DOC-06 | 多语言支持 | 核心文档需中英文双语 |

### 9.5 System Prompt

````markdown
# 角色定义

你是 **DocAgent**（文档智能体），NarrativeOS v3.0 Sovereign 开发集群中的
技术文档专家。你的职责是确保代码变更被准确、完整地文档化。

## 核心能力

- API 文档生成：从 TypeScript 代码生成 JSDoc/TSDoc 文档
- 变更日志维护：遵循 Keep a Changelog 格式
- 架构文档更新：维护架构图和模块描述
- 开发者指南：编写清晰的操作指南
- 一致性检查：确保文档与代码同步

## 文档原则

1. **代码即文档**：优先考虑在代码中添加 JSDoc 注释
2. **示例驱动**：每个 API 必须有使用示例
3. **变更可追溯**：每个版本变更都有明确的记录
4. **读者导向**：针对不同读者（用户/开发者/维护者）提供不同内容
5. **及时更新**：文档变更与代码变更同步

## 文档格式

### API 文档（JSDoc/TSDoc）
```typescript
/**
 * 函数功能的简要描述
 *
 * @param paramName - 参数描述
 * @param options - 配置选项
 * @returns 返回值描述
 * @throws {ErrorType} 错误条件描述
 *
 * @example
 * ```typescript
 * const result = myFunction('input', { option: true });
 * console.log(result); // 预期输出
 * ```
 */
```

### 变更日志（Keep a Changelog）
```markdown
## [版本号] - YYYY-MM-DD

### Added
- 新增功能描述

### Changed
- 变更描述

### Fixed
- 修复描述

### Deprecated
- 废弃功能说明

### Removed
- 移除功能说明

### Security
- 安全修复说明
```

## 输出格式

你必须输出符合 `PullRequestProposal` 结构的 JSON（type = 'docs'），包含：
- title: 遵循 Conventional Commits 格式，前缀为 `docs(模块):`
- diffs: 文档更新内容
- 更新后的文档文件完整内容

## 绝对禁止

- 不要在文档中包含过时的信息
- 不要生成与代码不符的文档
- 不要遗漏 breaking changes 的迁移指南
- 不要使用模糊的语言（如"大概"、"可能"）
- 不要遗漏参数的必填/可选标记
````

### 9.6 User Prompt 模板

````markdown
# 文档更新任务

## 代码变更信息

**提案ID**: {{codeChanges.proposalId}}
**变更类型**: {{codeChanges.proposalType}}
**标题**: {{codeChanges.title}}

### 描述

{{codeChanges.description}}

### 受影响的文件

{{#codeChanges.affectedFiles}}
- [{{changeType}}] {{path}} — {{summary}}
{{/codeChanges.affectedFiles}}

---

## 变更涉及的符号

{{#symbols}}
### {{name}} ({{type}})

- 文件: {{file}}
- 变更: {{changeType}}

```typescript
{{signature}}
```

现有文档：
```
{{jsdoc}}
```

{{/symbols}}

---

## 现有文档

{{#existingDocs}}
### {{file}} ({{type}})

```
{{content}}
```

{{/existingDocs}}

---

## 文档要求

- 文档风格: {{docRequirements.docStyle}}
- 包含示例: {{docRequirements.includeExamples}}
{{#docRequirements.includeMigrationGuide}}
- 需要迁移指南: {{docRequirements.includeMigrationGuide}}
{{/docRequirements.includeMigrationGuide}}

---

请按以下步骤更新文档：

### 步骤 1: 影响分析

分析代码变更对文档的影响：
1. 哪些 API 需要新增/更新文档？
2. 哪些架构文档需要更新？
3. 变更日志需要添加什么条目？
4. 是否需要迁移指南？

### 步骤 2: API 文档更新

{{#symbols}}
#### {{name}}

生成/更新文档：

```typescript
/**
 * [功能描述]
 *
 * [详细说明]
 *
{{#docRequirements.includeExamples}}
 * @example
 * ```typescript
 * [使用示例]
 * ```
{{/docRequirements.includeExamples}}
 */
```

{{/symbols}}

### 步骤 3: 变更日志更新

在 CHANGELOG 中添加条目：

```markdown
## [Unreleased]

### {{#isAdded}}Added{{/isAdded}}{{#isChanged}}Changed{{/isChanged}}{{#isFixed}}Fixed{{/isFixed}}
- [{{codeChanges.title}}]({{codeChanges.proposalId}})
  - [详细说明]
```

### 步骤 4: 架构文档更新

如影响架构，更新：
- 模块关系图（Mermaid 格式）
- 数据流描述
- 接口变更说明

### 步骤 5: 一致性检查

1. 检查所有引用是否有效
2. 检查链接是否可访问
3. 检查文档与代码的一致性
4. 检查格式规范

### 步骤 6: 完整提案

输出符合 PullRequestProposal 结构的 JSON。
````



---

## 10. 智能体协作协议

### 10.1 协作模式总览

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     DevAgent Swarm 协作模式矩阵                           │
├──────────────────────┬──────────────┬──────────────┬──────────────────────┤
│ 协作模式              │ 适用场景      │ Agent 组合    │ 同步方式              │
├──────────────────────┼──────────────┼──────────────┼──────────────────────┤
│ 串行流水线 (Pipeline) │ 标准修复流程  │ BugFix →     │ 同步，每步完成后触发   │
│                       │              │ Test → Doc   │ 下一步                │
├──────────────────────┼──────────────┼──────────────┼──────────────────────┤
│ 并行执行 (Parallel)   │ 不同模块修改  │ Optim +      │ 异步，同时执行         │
│                       │              │ Refactor     │ 无依赖冲突时           │
├──────────────────────┼──────────────┼──────────────┼──────────────────────┤
│ 协商模式 (Negotiate)  │ 修改同一模块  │ 任意两个      │ 同步，需要协调         │
│                       │              │ Agent        │                      │
├──────────────────────┼──────────────┼──────────────┼──────────────────────┤
│ 主从模式 (Master-Slave│ 复杂功能开发  │ Feature →    │ 同步，Feature主导     │
│                       │              │ Test + Doc   │ Test/Doc辅助          │
├──────────────────────┼──────────────┼──────────────┼──────────────────────┤
│ 安全审查 (Security    │ 所有变更      │ Security     │ 异步，对所有提案       │
│ Review)               │              │ 审查所有     │ 进行安全审查          │
└──────────────────────┴──────────────┴──────────────┴──────────────────────┘
```

### 10.2 串行流水线模式

#### 标准修复流程（BugFix → Test → Doc）

```typescript
/**
 * 串行修复流程 — 标准工单处理流水线
 * 触发条件：BugFixAgent 提交修复提案
 */
const BugFixPipeline = {
  id: 'bugfix-pipeline',
  name: 'Standard Bug Fix Pipeline',
  
  stages: [
    {
      id: 'stage-1',
      name: 'BugFix',
      agent: 'BugFixAgent',
      action: 'generate_fix_proposal',
      // BugFixAgent 完成后，同时触发 TestAgent 和 CodeReviewAgent
      next: ['stage-2a', 'stage-2b'],
      timeout: 300000,           // 5 分钟
    },
    {
      id: 'stage-2a',
      name: 'Code Review',
      agent: 'CodeReviewAgent',
      action: 'review_code',
      // 代码审查必须在测试之前或并行完成
      dependencies: [],
      next: ['stage-3'],
      timeout: 180000,           // 3 分钟
    },
    {
      id: 'stage-2b',
      name: 'Test Generation & Execution',
      agent: 'TestAgent',
      action: 'generate_and_run_tests',
      // 测试必须在文档之前完成
      dependencies: [],
      next: ['stage-3'],
      timeout: 300000,           // 5 分钟
    },
    {
      id: 'stage-3',
      name: 'Gate Check',
      // 合并检查点：等待 stage-2a 和 stage-2b 都完成
      gate: {
        requiredStages: ['stage-2a', 'stage-2b'],
        condition: 'all_passed',
      },
      // 检查是否通过质量门槛
      action: 'quality_gate_check',
      next: ['stage-4a', 'stage-4b'],
      // 如果质量门槛未通过，回退到 stage-1
      fallback: 'stage-1',
    },
    {
      id: 'stage-4a',
      name: 'Documentation',
      agent: 'DocAgent',
      action: 'update_documentation',
      // 文档更新与部署准备并行
      dependencies: [],
      next: ['stage-5'],
      timeout: 120000,           // 2 分钟
    },
    {
      id: 'stage-4b',
      name: 'Deploy Preparation',
      agent: 'DeployAgent',
      action: 'prepare_deployment',
      dependencies: [],
      next: ['stage-5'],
      timeout: 60000,            // 1 分钟
    },
    {
      id: 'stage-5',
      name: 'Final Approval',
      // 最终审批：合并 stage-4a 和 stage-4b
      gate: {
        requiredStages: ['stage-4a', 'stage-4b'],
        condition: 'all_passed',
      },
      // 检查是否需要作者审批（叙事相关）
      action: 'final_approval',
      // 自动部署或等待人工审批
      autoDeploy: {
        condition: '!narrative_related && quality_gate_passed && review_approved',
        strategy: 'auto',
      },
      manualApproval: {
        condition: 'narrative_related',
        approvers: ['author'],
      },
    },
  ],
};
```

#### 串行执行规则

| 规则 | 说明 |
|------|------|
| S1 | 上游 Agent 完成前，下游 Agent 不会启动（除非并行标记） |
| S2 | 每个阶段有超时限制，超时后工单标记为 FAILED |
| S3 | 任何阶段失败，整个流水线暂停，等待人工或自动重试决策 |
| S4 | Gate Check 阶段必须等待所有前置阶段完成 |
| S5 | 质量门槛未通过时，回退到最近的修复阶段 |

### 10.3 并行执行模式

#### 并行条件

```typescript
/**
 * 并行执行决策引擎
 * 判断两个 Agent 是否可以同时工作
 */
interface ParallelExecutionPolicy {
  // 可以并行的 Agent 组合（修改不同模块时）
  allowedParallelPairs: Array<{
    agents: [AgentId, AgentId];
    condition: string;           // 并行条件描述
  }>;
}

const ParallelPolicy: ParallelExecutionPolicy = {
  allowedParallelPairs: [
    {
      agents: ['OptimizationAgent', 'RefactorAgent'],
      condition: '修改的文件集合无交集',
    },
    {
      agents: ['BugFixAgent', 'OptimizationAgent'],
      condition: 'BugFix 修复的文件不在 Optimization 范围内',
    },
    {
      agents: ['FeatureAgent', 'TestAgent'],
      condition: 'FeatureAgent 负责实现，TestAgent 同时生成测试',
    },
    {
      agents: ['DocAgent', 'TestAgent'],
      condition: 'DocAgent 更新文档，TestAgent 生成测试',
    },
    {
      agents: ['SecurityAgent', 'RefactorAgent'],
      condition: 'Security 审查独立模块，Refactor 重构其他模块',
    },
  ],
};

/**
 * 冲突检测函数
 */
function canExecuteInParallel(
  agentA: AgentId,
  agentB: AgentId,
  proposalA: PullRequestProposal,
  proposalB: PullRequestProposal
): { canParallel: boolean; reason: string } {
  // 检查文件冲突
  const filesA = new Set(proposalA.affectedFiles.map(f => f.path));
  const filesB = new Set(proposalB.affectedFiles.map(f => f.path));
  const conflicts = [...filesA].filter(f => filesB.has(f));
  
  if (conflicts.length > 0) {
    return {
      canParallel: false,
      reason: `文件冲突: ${conflicts.join(', ')}`,
    };
  }
  
  // 检查符号依赖冲突
  const symbolsA = new Set(proposalA.affectedFiles.flatMap(f => f.symbols));
  const symbolsB = new Set(proposalB.affectedFiles.flatMap(f => f.symbols));
  const symbolConflicts = [...symbolsA].filter(s => symbolsB.has(s));
  
  if (symbolConflicts.length > 0) {
    return {
      canParallel: false,
      reason: `符号依赖冲突: ${symbolConflicts.join(', ')}`,
    };
  }
  
  // 检查依赖变更冲突
  const depsA = new Set(proposalA.impact.dependencyChanges?.map(d => d.name) ?? []);
  const depsB = new Set(proposalB.impact.dependencyChanges?.map(d => d.name) ?? []);
  const depConflicts = [...depsA].filter(d => depsB.has(d));
  
  if (depConflicts.length > 0) {
    return {
      canParallel: false,
      reason: `依赖变更冲突: ${depConflicts.join(', ')}`,
    };
  }
  
  return {
    canParallel: true,
    reason: '无冲突，可以并行执行',
  };
}
```

### 10.4 协商模式

#### 冲突解决协议

```typescript
/**
 * 协商模式 — 当两个 Agent 修改同一模块时
 * 使用协商机制解决冲突
 */
interface NegotiationProtocol {
  // 协商触发条件
  triggers: Array<{
    condition: string;
    priority: 'immediate' | 'batched';
  }>;
  
  // 协商流程
  flow: Array<{
    step: number;
    action: string;
    responsible: AgentId | 'Orchestrator';
  }>;
  
  // 决策策略
  resolution: {
    strategies: ResolutionStrategy[];
    fallback: string;
  };
}

const NegotiationProtocol: NegotiationProtocol = {
  triggers: [
    { condition: '两个 Agent 提案修改同一文件', priority: 'immediate' },
    { condition: '符号依赖冲突', priority: 'immediate' },
    { condition: '依赖版本冲突', priority: 'immediate' },
    { condition: '配置项冲突', priority: 'batched' },
  ],
  
  flow: [
    { step: 1, action: 'Orchestrator 检测冲突', responsible: 'Orchestrator' },
    { step: 2, action: '暂停冲突的 Agent', responsible: 'Orchestrator' },
    { step: 3, action: '分析冲突范围', responsible: 'Orchestrator' },
    { step: 4, action: 'Agent 交换变更信息', responsible: 'Orchestrator' },
    { step: 5, action: '尝试自动合并', responsible: 'Orchestrator' },
    { step: 6, action: '如自动合并失败，生成冲突报告', responsible: 'Orchestrator' },
    { step: 7, action: '如需要，Agent 重新生成不冲突的变更', responsible: '协商涉及的Agent' },
  ],
  
  resolution: {
    strategies: [
      {
        name: 'sequential_merge',
        description: '按优先级顺序合并：先应用高优先级 Agent 的变更，再应用低优先级的',
        priority: ['BugFixAgent', 'SecurityAgent', 'FeatureAgent', 'OptimizationAgent', 'RefactorAgent', 'DocAgent', 'TestAgent'],
      },
      {
        name: 'semantic_merge',
        description: '语义合并：如果两个 Agent 修改的是文件的不同语义区域，自动合并',
      },
      {
        name: 'rebase_and_retry',
        description: '让低优先级 Agent 基于高优先级 Agent 的变更重新生成提案',
      },
      {
        name: 'human_escalation',
        description: '人工介入：冲突无法自动解决时，升级给人类开发者',
      },
    ],
    fallback: '如所有策略都失败，升级为人工介入',
  },
};

/**
 * Agent 优先级（用于冲突解决）
 */
const AGENT_PRIORITY: Record<AgentId, number> = {
  'BugFixAgent': 100,        // 修复最高（系统稳定优先）
  'SecurityAgent': 95,       // 安全次高
  'FeatureAgent': 70,        // 功能开发
  'OptimizationAgent': 60,   // 性能优化
  'RefactorAgent': 50,       // 重构
  'DocAgent': 40,            // 文档
  'TestAgent': 80,           // 测试（高优先级但不修改生产代码）
  'CodeReviewAgent': 90,     // 代码审查（高优先级，只读）
  'RouterAgent': 85,         // 路由器
  'DeployAgent': 75,         // 部署
  'Orchestrator': 200,       // 协调器（最高）
};
```

### 10.5 主从模式

#### Feature 开发主从协作

```typescript
/**
 * Feature 开发的主从模式
 * FeatureAgent 主导，TestAgent 和 DocAgent 辅助
 */
const FeatureMasterSlaveProtocol = {
  master: 'FeatureAgent',
  slaves: ['TestAgent', 'DocAgent'],
  
  // 主从通信协议
  communication: {
    // FeatureAgent 向从属 Agent 发送的信息
    masterToSlave: {
      // 当 FeatureAgent 完成核心实现后
      implementationComplete: {
        message: 'PROPOSAL_CREATED',
        payload: {
          proposalId: string;
          codeChanges: DiffHunk[];
          interfaceDefinitions: string[];
          behaviorContracts: string[];
        },
      },
      // 当 FeatureAgent 修改方案时
      implementationUpdated: {
        message: 'PROPOSAL_UPDATED',
        payload: {
          proposalId: string;
          updatedDiffs: DiffHunk[];
          changeSummary: string;
        },
      },
    },
    
    // 从属 Agent 向 FeatureAgent 发送的信息
    slaveToMaster: {
      // TestAgent 的测试反馈
      testFeedback: {
        message: 'TEST_RESULTS',
        payload: {
          proposalId: string;
          testResults: TestResultSummary;
          coverage: number;
          recommendations: string[];
        },
      },
      // DocAgent 的文档反馈
      docFeedback: {
        message: 'DOC_REVIEW',
        payload: {
          proposalId: string;
          docCompleteness: number;
          missingDocs: string[];
        },
      },
    },
  },
  
  // 同步点
  syncPoints: [
    {
      name: 'implementation_checkpoint',
      trigger: 'FeatureAgent 完成核心代码',
      action: '通知 TestAgent 和 DocAgent 开始工作',
    },
    {
      name: 'test_integration',
      trigger: 'TestAgent 完成测试生成',
      action: 'FeatureAgent 审查测试覆盖率',
    },
    {
      name: 'doc_integration',
      trigger: 'DocAgent 完成文档更新',
      action: 'FeatureAgent 审查文档准确性',
    },
    {
      name: 'final_integration',
      trigger: '所有 Agent 完成',
      action: '组装完整提案',
    },
  ],
};
```

### 10.6 通信协议详细规范

#### 消息队列设计

```typescript
/**
 * Agent 间通信使用基于主题的异步消息队列
 */
interface MessageQueueDesign {
  // 消息队列主题
  topics: {
    // 工单相关
    'tickets.created': '新工单创建';
    'tickets.assigned': '工单分配';
    'tickets.completed': '工单完成';
    'tickets.failed': '工单失败';
    
    // 提案相关
    'proposals.created': '新提案创建';
    'proposals.updated': '提案更新';
    'proposals.reviewed': '提案审查完成';
    'proposals.approved': '提案通过';
    'proposals.rejected': '提案拒绝';
    
    // 审查相关
    'reviews.requested': '审查请求';
    'reviews.completed': '审查完成';
    'reviews.changes_requested': '要求修改';
    
    // 部署相关
    'deploy.queued': '部署排队';
    'deploy.started': '部署开始';
    'deploy.completed': '部署完成';
    'deploy.failed': '部署失败';
    'deploy.rollback': '回滚';
    
    // 协调相关
    'coordination.conflict': '冲突检测';
    'coordination.lock': '资源锁定';
    'coordination.heartbeat': '心跳';
  };
  
  // 消息持久化
  persistence: {
    retentionPeriod: '30 days';    // 消息保留30天
    deadLetterQueue: true;         // 死信队列
    messageOrdering: 'per_ticket'; // 按工单保证消息顺序
  };
  
  // 消息可靠性
  reliability: {
    atLeastOnceDelivery: true;     // 至少一次投递
    idempotentConsumers: true;     // 消费者幂等
    messageDeduplication: true;    // 消息去重
  };
}
```

#### 状态同步机制

```typescript
/**
 * 全局状态同步 — 所有 Agent 共享的工单状态视图
 */
interface StateSynchronization {
  // 共享状态存储
  sharedState: {
    // 工单状态
    tickets: Map<string, {
      status: TicketState;
      currentAgent: AgentId | null;
      proposalId: string | null;
      reviewStatus: 'pending' | 'in_progress' | 'approved' | 'rejected';
      deployStatus: 'pending' | 'queued' | 'deploying' | 'deployed' | 'failed' | 'rolled_back';
      lastUpdated: string;
      version: number;             // 乐观锁版本号
    }>;
    
    // 资源锁状态
    locks: Map<string, {
      resource: string;            // 资源标识（文件路径/模块名）
      heldBy: AgentId;
      acquiredAt: string;
      expiresAt: string;
      reason: string;
    }>;
    
    // Agent 健康状态
    agentHealth: Map<AgentId, {
      status: 'healthy' | 'degraded' | 'unhealthy';
      lastHeartbeat: string;
      currentLoad: number;         // 0-100
      queueDepth: number;
    }>;
  };
  
  // 同步策略
  syncStrategy: {
    // 状态变更通知
    stateChangeNotifications: {
      mechanism: 'pub-sub';        // 发布-订阅模式
      delivery: 'push';            // 推送模式
      fanout: 'broadcast';         // 广播给所有相关 Agent
    };
    
    // 冲突解决
    conflictResolution: {
      strategy: 'last-write-wins'; // 乐观并发控制
      versionCheck: true;          // 版本号检查
      retryPolicy: {
        maxRetries: 3;
        backoffMs: 100;
      };
    };
  };
}
```

### 10.7 冲突检测机制

```typescript
/**
 * 代码变更冲突检测引擎
 */
interface ConflictDetectionEngine {
  // 检测级别
  detectionLevels: {
    // L1: 文件级冲突（最简单）
    fileLevel: {
      description: '两个提案修改同一个文件';
      detection: '文件名完全匹配';
      severity: 'potential';       // 可能冲突
    };
    
    // L2: 行级冲突
    lineLevel: {
      description: '两个提案修改文件的同一行范围';
      detection: 'diff hunk 范围重叠';
      severity: 'likely';          // 很可能冲突
    };
    
    // L3: 语义级冲突
    semanticLevel: {
      description: '两个提案修改相互依赖的符号';
      detection: '调用图分析';
      severity: 'definite';        // 确定冲突
    };
    
    // L4: 逻辑级冲突
    logicLevel: {
      description: '两个提案的逻辑相互矛盾';
      detection: '语义分析 + 约束求解';
      severity: 'critical';        // 严重冲突
    };
  };
  
  // 检测函数
  detect(proposalA: PullRequestProposal, proposalB: PullRequestProposal): ConflictReport;
}

interface ConflictReport {
  conflictId: string;
  proposals: [string, string];    // 冲突的两个提案ID
  detectedAt: string;
  
  conflicts: Array<{
    level: 'file' | 'line' | 'semantic' | 'logic';
    severity: 'potential' | 'likely' | 'definite' | 'critical';
    description: string;
    affectedFiles: string[];
    affectedSymbols: string[];
    resolution?: string;
  }>;
  
  // 自动合并建议
  autoMergeSuggestion?: {
    canAutoMerge: boolean;
    strategy: 'sequential' | 'semantic' | 'none';
    recommendedOrder: AgentId[];
    manualInterventionRequired: boolean;
  };
  
  // 升级建议
  escalation?: {
    required: boolean;
    reason: string;
    suggestedApprovers: string[];
  };
}

/**
 * 实际冲突检测实现
 */
function detectConflicts(
  proposalA: PullRequestProposal,
  proposalB: PullRequestProposal
): ConflictReport {
  const conflicts: ConflictReport['conflicts'] = [];
  
  // L1: 文件级冲突
  const filesA = proposalA.affectedFiles.map(f => f.path);
  const filesB = proposalB.affectedFiles.map(f => f.path);
  const fileConflicts = filesA.filter(f => filesB.includes(f));
  
  if (fileConflicts.length > 0) {
    conflicts.push({
      level: 'file',
      severity: 'potential',
      description: `文件级冲突: ${fileConflicts.join(', ')}`,
      affectedFiles: fileConflicts,
      affectedSymbols: [],
    });
  }
  
  // L2: 行级冲突
  for (const file of fileConflicts) {
    const hunksA = proposalA.diffs.filter(d => d.filePath === file);
    const hunksB = proposalB.diffs.filter(d => d.filePath === file);
    
    for (const hunkA of hunksA) {
      for (const hunkB of hunksB) {
        // 检查行范围重叠
        const overlap = !(hunkA.oldStart + hunkA.oldLines < hunkB.oldStart ||
                         hunkB.oldStart + hunkB.oldLines < hunkA.oldStart);
        if (overlap) {
          conflicts.push({
            level: 'line',
            severity: 'likely',
            description: `行级冲突: ${file} (行 ${hunkA.oldStart}-${hunkA.oldStart + hunkA.oldLines})`,
            affectedFiles: [file],
            affectedSymbols: [],
          });
        }
      }
    }
  }
  
  // L3: 语义级冲突
  const symbolsA = new Set(proposalA.affectedFiles.flatMap(f => f.symbols));
  const symbolsB = proposalB.affectedFiles.flatMap(f => f.symbols);
  const symbolConflicts = symbolsB.filter(s => symbolsA.has(s));
  
  if (symbolConflicts.length > 0) {
    conflicts.push({
      level: 'semantic',
      severity: 'definite',
      description: `语义冲突: 共享符号 ${symbolConflicts.join(', ')}`,
      affectedFiles: fileConflicts,
      affectedSymbols: symbolConflicts,
    });
  }
  
  // 生成自动合并建议
  const canAutoMerge = conflicts.every(c => c.level === 'file') || 
                       conflicts.length === 0;
  
  return {
    conflictId: `conflict-${Date.now()}`,
    proposals: [proposalA.proposalId, proposalB.proposalId],
    detectedAt: new Date().toISOString(),
    conflicts,
    autoMergeSuggestion: {
      canAutoMerge,
      strategy: canAutoMerge ? 'sequential' : 'none',
      recommendedOrder: [proposalA.author.agentId, proposalB.author.agentId]
        .sort((a, b) => (AGENT_PRIORITY[a] ?? 0) - (AGENT_PRIORITY[b] ?? 0)),
      manualInterventionRequired: !canAutoMerge,
    },
    escalation: conflicts.some(c => c.level === 'logic')
      ? { required: true, reason: '逻辑级冲突需要人工判断', suggestedApprovers: ['author', 'tech-lead'] }
      : undefined,
  };
}
```

### 10.8 资源锁定协议

```typescript
/**
 * 排他锁管理 — 防止多个 Agent 同时修改同一资源
 */
interface ResourceLockProtocol {
  // 锁定规则
  rules: {
    // 需要排他锁的操作
    requireLock: ['write_file', 'delete_file', 'rename_file', 'modify_interface'];
    
    // 不需要锁的操作（只读）
    noLockRequired: ['read_file', 'analyze_code', 'generate_test'];
    
    // 锁的粒度
    granularity: 'file';           // 文件级锁定
    
    // 锁超时
    lockTimeout: 600000;           // 10 分钟自动释放
    
    // 锁续约
    allowRenewal: true;
    renewalInterval: 300000;       // 每 5 分钟续约一次
  };
  
  // 锁定流程
  lockFlow: [
    { step: 1, action: 'Agent 向 Orchestrator 发送锁请求' },
    { step: 2, action: 'Orchestrator 检查资源是否已被锁定' },
    { step: 3, action: '如未锁定，授予锁并记录' },
    { step: 4, action: '如已锁定，放入等待队列或返回冲突' },
    { step: 5, action: 'Agent 完成工作后释放锁' },
    { step: 6, action: 'Orchestrator 通知等待队列中的下一个 Agent' },
  ];
}
```

---

## 11. 质量门槛定义

### 11.1 质量门槛总览

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       质量门槛体系 (Quality Gates)                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Gate 1: 代码质量门槛          Gate 2: 测试质量门槛                      │
│  ├── TypeScript 严格编译通过    ├── 行覆盖率 >= 80%                       │
│  ├── 无 ESLint 错误             ├── 分支覆盖率 >= 70%                     │
│  ├── 圈复杂度 < 10/函数         ├── 单元测试全部通过                      │
│  ├── 无 any 类型（有理由除外）  ├── 无测试跳过（有理由除外）               │
│  └── 代码风格一致               └── 快照测试无未预期变更                  │
│                                                                          │
│  Gate 3: 安全质量门槛          Gate 4: 文档质量门槛                      │
│  ├── 无已知安全漏洞             ├── API 文档完整性 100%                   │
│  ├── 无硬编码密钥               ├── 变更日志已更新                       │
│  ├── 输入已验证/转义            ├── 文档与代码一致                       │
│  ├── 无新增攻击面               └── 包含使用示例                         │
│  └── 依赖安全扫描通过                                                    │
│                                                                          │
│  Gate 5: 架构质量门槛          Gate 6: 性能质量门槛                      │
│  ├── 不违反第一公理             ├── 无性能退化（基准对比）                 │
│  ├── 接口向后兼容               ├── 内存使用无增长                       │
│  ├── 无循环依赖新增             ├── 响应时间在 SLA 内                     │
│  ├── 模块边界清晰               └── 资源使用合理                         │
│  └── 第一公理检查通过（叙事相关）                                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 11.2 各 Agent 质量门槛矩阵

| 质量门槛 | BugFix | Feature | Optimization | Security | Refactor | Test | Doc |
|----------|--------|---------|--------------|----------|----------|------|-----|
| **G1: 代码质量** | | | | | | | |
| TypeScript 严格编译 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | N/A |
| ESLint 无错误 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 |
| 圈复杂度 < 10 | ✅ 推荐 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 推荐 | N/A |
| any 类型控制 | <=1 | <=1 | <=1 | <=1 | <=0 | <=1 | N/A |
| **G2: 测试质量** | | | | | | | |
| 行覆盖率 >= 80% | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | N/A | N/A |
| 分支覆盖率 >= 70% | ✅ 推荐 | ✅ 必须 | ✅ 推荐 | ✅ 必须 | ✅ 推荐 | N/A | N/A |
| 回归测试 | ✅ 必须 | ✅ 推荐 | ✅ 推荐 | ✅ 必须 | ✅ 必须 | N/A | N/A |
| XState 全覆盖 | 如适用 | 如适用 | 如适用 | 如适用 | 如适用 | ✅ 必须 | N/A |
| **G3: 安全质量** | | | | | | | |
| 无已知漏洞 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | N/A |
| 无硬编码密钥 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | N/A |
| 输入验证 | ✅ 推荐 | ✅ 必须 | N/A | ✅ 必须 | N/A | N/A | N/A |
| **G4: 文档质量** | | | | | | | |
| API 文档完整 | N/A | ✅ 必须 | ✅ 推荐 | ✅ 必须 | ✅ 推荐 | N/A | ✅ 必须 |
| 变更日志更新 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | N/A | ✅ 必须 |
| 使用示例 | N/A | ✅ 必须 | ✅ 推荐 | ✅ 推荐 | N/A | N/A | ✅ 必须 |
| **G5: 架构质量** | | | | | | | |
| 第一公理检查 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | N/A | N/A |
| 向后兼容 | ✅ 必须 | ✅ 必须 | N/A | ✅ 必须 | ✅ 必须 | N/A | N/A |
| 无循环依赖新增 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | N/A | N/A |
| **G6: 性能质量** | | | | | | | |
| 无性能退化 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | N/A | N/A |
| 基准对比 | N/A | ✅ 推荐 | ✅ 必须 | N/A | ✅ 推荐 | N/A | N/A |
| 内存无增长 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | ✅ 必须 | N/A | N/A |

### 11.3 质量评分体系

```typescript
/**
 * 质量评分 — 每个提案的综合质量评分
 * 总分 100 分，60 分及格，80 分良好，90 分优秀
 */
interface QualityScore {
  // 代码质量 (25 分)
  codeQuality: {
    score: number;               // 0-25
    criteria: {
      typescriptStrict: boolean; // TypeScript 严格编译 (+5)
      eslintClean: boolean;      // ESLint 无错误 (+5)
      complexityOk: boolean;     // 圈复杂度达标 (+5)
      noAny: boolean;            // 无 any 类型 (+5)
      styleConsistent: boolean;  // 代码风格一致 (+5)
    };
  };
  
  // 测试质量 (25 分)
  testQuality: {
    score: number;               // 0-25
    criteria: {
      lineCoverage: number;      // 行覆盖率 (0-8)
      branchCoverage: number;    // 分支覆盖率 (0-5)
      allTestsPass: boolean;     // 全部通过 (+5)
      regressionTests: boolean;  // 回归测试 (+4)
      xstateCoverage: boolean;   // XState 全覆盖 (+3)
    };
  };
  
  // 安全质量 (20 分)
  securityQuality: {
    score: number;               // 0-20
    criteria: {
      noVulnerabilities: boolean;// 无已知漏洞 (+5)
      noHardcodedSecrets: boolean; // 无硬编码密钥 (+5)
      inputValidated: boolean;   // 输入已验证 (+5)
      noNewAttackSurface: boolean; // 无新增攻击面 (+5)
    };
  };
  
  // 文档质量 (15 分)
  docQuality: {
    score: number;               // 0-15
    criteria: {
      apiDocsComplete: boolean;  // API 文档完整 (+5)
      changelogUpdated: boolean; // 变更日志已更新 (+4)
      hasExamples: boolean;      // 包含示例 (+3)
      docsConsistent: boolean;   // 文档一致 (+3)
    };
  };
  
  // 架构质量 (15 分)
  architectureQuality: {
    score: number;               // 0-15
    criteria: {
      firstAxiomOk: boolean;     // 第一公理通过 (+5)
      backwardCompatible: boolean; // 向后兼容 (+4)
      noCircularDeps: boolean;   // 无循环依赖 (+3)
      cleanBoundaries: boolean;  // 模块边界清晰 (+3)
    };
  };
  
  // 总分
  total: number;                 // 0-100
  grade: 'excellent' | 'good' | 'pass' | 'fail'; // >=90 | >=80 | >=60 | <60
}

/**
 * 质量评分计算
 */
function calculateQualityScore(proposal: PullRequestProposal): QualityScore {
  const codeQuality: QualityScore['codeQuality'] = {
    score: 0,
    criteria: {
      typescriptStrict: true,    // 由编译检查
      eslintClean: true,         // 由 lint 检查
      complexityOk: true,        // 由静态分析
      noAny: false,              // 由类型检查
      styleConsistent: true,     // 由格式检查
    },
  };
  
  // 计算代码质量分数
  codeQuality.score = Object.values(codeQuality.criteria)
    .filter(Boolean).length * 5;
  
  const testQuality: QualityScore['testQuality'] = {
    score: 0,
    criteria: {
      lineCoverage: 0,
      branchCoverage: 0,
      allTestsPass: false,
      regressionTests: false,
      xstateCoverage: false,
    },
  };
  
  // 计算测试质量分数
  const tc = proposal.tests.results;
  if (tc) {
    testQuality.criteria.lineCoverage = tc.coverage.lines;
    testQuality.criteria.branchCoverage = tc.coverage.branches;
    testQuality.criteria.allTestsPass = tc.failed === 0;
    testQuality.score = Math.min(8, tc.coverage.lines / 10) +
                        Math.min(5, tc.coverage.branches / 14) +
                        (testQuality.criteria.allTestsPass ? 5 : 0) +
                        (testQuality.criteria.regressionTests ? 4 : 0) +
                        (testQuality.criteria.xstateCoverage ? 3 : 0);
  }
  
  const securityQuality: QualityScore['securityQuality'] = {
    score: 0,
    criteria: {
      noVulnerabilities: !proposal.security.newAttackSurface,
      noHardcodedSecrets: true,
      inputValidated: true,
      noNewAttackSurface: !proposal.security.newAttackSurface,
    },
  };
  securityQuality.score = Object.values(securityQuality.criteria)
    .filter(Boolean).length * 5;
  
  const docQuality: QualityScore['docQuality'] = {
    score: 0,
    criteria: {
      apiDocsComplete: proposal.type === 'feature',
      changelogUpdated: true,
      hasExamples: true,
      docsConsistent: true,
    },
  };
  docQuality.score = Object.values(docQuality.criteria)
    .filter(Boolean).length * 3 + (docQuality.criteria.apiDocsComplete ? 2 : 0);
  
  const architectureQuality: QualityScore['architectureQuality'] = {
    score: 0,
    criteria: {
      firstAxiomOk: true,
      backwardCompatible: proposal.impact.backwardCompatible,
      noCircularDeps: true,
      cleanBoundaries: true,
    },
  };
  architectureQuality.score = Object.values(architectureQuality.criteria)
    .filter(Boolean).length * 3 + (architectureQuality.criteria.firstAxiomOk ? 2 : 0);
  
  const total = codeQuality.score + testQuality.score + 
                securityQuality.score + docQuality.score + architectureQuality.score;
  
  return {
    codeQuality,
    testQuality,
    securityQuality,
    docQuality,
    architectureQuality,
    total,
    grade: total >= 90 ? 'excellent' : 
           total >= 80 ? 'good' : 
           total >= 60 ? 'pass' : 'fail',
  };
}
```

### 11.4 自动部署条件

```typescript
/**
 * 自动部署决策引擎
 * 定义什么条件下提案可以自动部署（无需人工审批）
 */
interface AutoDeployPolicy {
  // 自动部署条件
  conditions: {
    // 必须全部满足
    required: [
      'qualityScore.total >= 80',           // 质量评分 >= 80
      'review.status === "approved"',        // 代码审查通过
      'testVerification === "passed"',       // 测试验证通过
      'security.securityReviewStatus === "approved"', // 安全审查通过
      '!impact.narrativeRelated',             // 不涉及叙事逻辑
      '!metadata.isHotfix',                   // 不是热修复（热修复走快速通道）
      'impact.severity !== "critical"',       // 不是关键变更
    ];
    
    // 快速部署通道（热修复）
    hotfix: [
      'metadata.isHotfix === true',
      'qualityScore.total >= 60',             // 热修复门槛略低
      'review.status === "approved"',
      'securityReviewStatus !== "rejected"',
    ];
    
    // 必须不满足（阻止自动部署）
    blocking: [
      'security.newAttackSurface === true',   // 引入新攻击面
      '!impact.backwardCompatible',           // 不向后兼容
      'firstAxiomCheck.involvesNarrativeLogic', // 涉及叙事逻辑
      'deploy.strategy === "manual"',         // 明确要求手动部署
    ];
  };
  
  // 部署策略
  strategies: {
    auto: {
      description: '自动部署';
      applicable: '满足所有 required 条件且不触发任何 blocking 条件';
      process: '审查通过后自动合并到主分支并部署';
    };
    canary: {
      description: '灰度部署';
      applicable: '大型变更或涉及关键路径的变更';
      config: {
        initialPercentage: 5;    // 初始 5% 流量
        rampUpSteps: [10, 25, 50, 100]; // 逐步放量
        observationPeriod: 30;   // 每步观察 30 分钟
        rollbackThreshold: 0.1;  // 错误率 > 0.1% 回滚
      };
    };
    manual: {
      description: '手动部署';
      applicable: '涉及叙事逻辑、破坏性行为变更、或管理员要求';
    };
    rollback: {
      description: '仅回滚';
      applicable: '部署失败时';
      maxRollbackTime: 300;      // 5 分钟内回滚
    };
  };
}
```

### 11.5 质量检查清单

每个 Agent 提交提案前必须通过以下检查清单：

```typescript
const PreSubmitChecklist: ChecklistItem[] = [
  // === 所有 Agent 通用 ===
  { id: 'C-01', category: '通用', item: 'proposalId 格式正确', allAgents: true },
  { id: 'C-02', category: '通用', item: 'title 符合 Conventional Commits 格式', allAgents: true },
  { id: 'C-03', category: '通用', item: 'ticketId 已关联', allAgents: true },
  { id: 'C-04', category: '通用', item: 'description 完整且清晰', allAgents: true },
  { id: 'C-05', category: '通用', item: 'author.confidence >= 0.7', allAgents: true },
  { id: 'C-06', category: '通用', item: 'diffs 格式正确（unified diff）', allAgents: true },
  { id: 'C-07', category: '通用', item: 'affectedFiles 完整', allAgents: true },
  { id: 'C-08', category: '通用', item: 'impact 评估完整', allAgents: true },
  { id: 'C-09', category: '通用', item: 'rollbackPlan 已定义', allAgents: true },
  
  // === BugFixAgent ===
  { id: 'BF-01', category: '修复', item: '修复包含回归测试', agent: 'BugFixAgent' },
  { id: 'BF-02', category: '修复', item: '修复行数 <= 100 行/文件', agent: 'BugFixAgent' },
  { id: 'BF-03', category: '修复', item: '无新依赖引入', agent: 'BugFixAgent' },
  { id: 'BF-04', category: '修复', item: '修复前后行为一致（除异常外）', agent: 'BugFixAgent' },
  
  // === FeatureAgent ===
  { id: 'FE-01', category: '功能', item: '第一公理检查通过', agent: 'FeatureAgent' },
  { id: 'FE-02', category: '功能', item: '单元测试覆盖率 >= 80%', agent: 'FeatureAgent' },
  { id: 'FE-03', category: '功能', item: 'API 文档完整', agent: 'FeatureAgent' },
  { id: 'FE-04', category: '功能', item: '包含使用示例', agent: 'FeatureAgent' },
  { id: 'FE-05', category: '功能', item: 'Zod schema 输入验证', agent: 'FeatureAgent' },
  
  // === OptimizationAgent ===
  { id: 'OPT-01', category: '优化', item: '包含基准对比数据', agent: 'OptimizationAgent' },
  { id: 'OPT-02', category: '优化', item: 'A/B 测试方案已设计', agent: 'OptimizationAgent' },
  { id: 'OPT-03', category: '优化', item: '无性能退化', agent: 'OptimizationAgent' },
  { id: 'OPT-04', category: '优化', item: '回滚策略已定义', agent: 'OptimizationAgent' },
  
  // === SecurityAgent ===
  { id: 'SEC-01', category: '安全', item: '安全测试用例完整', agent: 'SecurityAgent' },
  { id: 'SEC-02', category: '安全', item: '漏洞风险评估完整', agent: 'SecurityAgent' },
  { id: 'SEC-03', category: '安全', item: '无新增攻击面', agent: 'SecurityAgent' },
  { id: 'SEC-04', category: '安全', item: '输入验证/转义策略', agent: 'SecurityAgent' },
  
  // === RefactorAgent ===
  { id: 'REF-01', category: '重构', item: '行为不变性验证', agent: 'RefactorAgent' },
  { id: 'REF-02', category: '重构', item: '圈复杂度 < 10', agent: 'RefactorAgent' },
  { id: 'REF-03', category: '重构', item: '小步快跑可回滚', agent: 'RefactorAgent' },
  { id: 'REF-04', category: '重构', item: '快照测试通过', agent: 'RefactorAgent' },
  
  // === TestAgent ===
  { id: 'TST-01', category: '测试', item: '测试独立可重复', agent: 'TestAgent' },
  { id: 'TST-02', category: '测试', item: '测试命名描述行为', agent: 'TestAgent' },
  { id: 'TST-03', category: '测试', item: '边界条件覆盖', agent: 'TestAgent' },
  { id: 'TST-04', category: '测试', item: 'Mock 最小化', agent: 'TestAgent' },
  
  // === DocAgent ===
  { id: 'DOC-01', category: '文档', item: 'API 参数完整', agent: 'DocAgent' },
  { id: 'DOC-02', category: '文档', item: '变更日志已更新', agent: 'DocAgent' },
  { id: 'DOC-03', category: '文档', item: '交叉引用有效', agent: 'DocAgent' },
  { id: 'DOC-04', category: '文档', item: '示例代码可运行', agent: 'DocAgent' },
];
```

### 11.6 审查清单

```typescript
/**
 * CodeReviewAgent 使用的审查清单
 */
const CodeReviewChecklist: Array<{
  id: string;
  category: string;
  item: string;
  severity: 'required' | 'recommended' | 'optional';
}> = [
  // 正确性
  { id: 'R-COR-01', category: '正确性', item: '代码逻辑正确，处理所有边界情况', severity: 'required' },
  { id: 'R-COR-02', category: '正确性', item: '错误处理完善，无遗漏的异常路径', severity: 'required' },
  { id: 'R-COR-03', category: '正确性', item: '异步处理正确（无 unhandled promise）', severity: 'required' },
  { id: 'R-COR-04', category: '正确性', item: '类型安全（无隐式 any）', severity: 'required' },
  
  // 可维护性
  { id: 'R-MAI-01', category: '可维护性', item: '命名清晰，符合项目规范', severity: 'required' },
  { id: 'R-MAI-02', category: '可维护性', item: '函数单一职责', severity: 'required' },
  { id: 'R-MAI-03', category: '可维护性', item: '注释必要且清晰', severity: 'recommended' },
  { id: 'R-MAI-04', category: '可维护性', item: '无重复代码', severity: 'recommended' },
  
  // 安全性
  { id: 'R-SEC-01', category: '安全性', item: '无硬编码密钥', severity: 'required' },
  { id: 'R-SEC-02', category: '安全性', item: '输入已验证/转义', severity: 'required' },
  { id: 'R-SEC-03', category: '安全性', item: '无新增攻击面', severity: 'required' },
  { id: 'R-SEC-04', category: '安全性', item: '敏感操作有权限检查', severity: 'required' },
  
  // 性能
  { id: 'R-PER-01', category: '性能', item: '无明显的性能问题', severity: 'recommended' },
  { id: 'R-PER-02', category: '性能', item: '无内存泄漏风险', severity: 'recommended' },
  { id: 'R-PER-03', category: '性能', item: '数据库查询优化', severity: 'optional' },
  
  // 测试
  { id: 'R-TST-01', category: '测试', item: '测试覆盖关键路径', severity: 'required' },
  { id: 'R-TST-02', category: '测试', item: '测试包含边界条件', severity: 'required' },
  { id: 'R-TST-03', category: '测试', item: '测试独立可重复', severity: 'required' },
  
  // 架构
  { id: 'R-ARC-01', category: '架构', item: '不违反第一公理', severity: 'required' },
  { id: 'R-ARC-02', category: '架构', item: '模块边界清晰', severity: 'required' },
  { id: 'R-ARC-03', category: '架构', item: '无循环依赖', severity: 'required' },
  { id: 'R-ARC-04', category: '架构', item: '向后兼容', severity: 'required' },
];
```

---

## 12. 附录

### 附录 A: NarrativeOS 第一公理

> **第一公理：系统永远不得代替作者做出不可逆的叙事决策。**

**定义与解释：**

```typescript
/**
 * 第一公理的程序化定义
 * 用于所有 Agent 的自动检查
 */
const FirstAxiom = {
  statement: '系统永远不得代替作者做出不可逆的叙事决策',
  
  // 不可逆的叙事决策类型
  irreversibleDecisions: [
    '角色死亡或永久性离开故事',
    '核心关系网的根本性改变（结盟/背叛/爱情）',
    '世界设定的根本性改变（规则、物理、历史）',
    '主要情节线的走向（关键转折点）',
    '故事结局的方向',
    '已有内容的删除或重大修改',
  ],
  
  // 允许的自主行为（不违反第一公理）
  allowedAutonomousActions: [
    '根据已有设定生成描写文本',
    '提出情节发展建议（需作者确认）',
    '保持已有设定的内在一致性',
    '自动处理纯技术性的编辑操作',
    '根据作者指令执行具体操作',
  ],
  
  // 违反第一公理的危险信号
  redFlags: [
    '代码中包含 "autoDecide"、"autoChoose" 等自动决策模式',
    '功能设计绕过了确认步骤',
    '默认值可能导致不可逆的叙事变更',
    '批处理操作中没有逐条确认',
    'LLM 输出直接写入持久层而未审核',
  ],
  
  // 检查函数
  check(proposal: PullRequestProposal): {
    compliant: boolean;
    violations: string[];
    warnings: string[];
  } {
    const violations: string[] = [];
    const warnings: string[] = [];
    
    // 检查 diff 中是否包含危险模式
    for (const diff of proposal.diffs) {
      const diffText = diff.diff.toLowerCase();
      
      if (diffText.includes('autodecide') || 
          diffText.includes('autochoose') ||
          diffText.includes('autokill') ||
          diffText.includes('auto_resolve_narrative')) {
        violations.push(`发现自动决策模式: ${diff.filePath}`);
      }
      
      if (diffText.includes('direct_write') || 
          diffText.includes('skip_confirmation')) {
        warnings.push(`可能绕过确认步骤: ${diff.filePath}`);
      }
    }
    
    // 检查是否需要作者审批
    if (proposal.impact.affectsNarrativeLogic && 
        !proposal.review.authorApproval) {
      violations.push('涉及叙事逻辑但未设置 authorApproval');
    }
    
    return {
      compliant: violations.length === 0,
      violations,
      warnings,
    };
  },
};
```

### 附录 B: Agent 元数据

```typescript
/**
 * 所有 7 个开发 Agent 的元数据注册表
 */
const AgentRegistry: Record<string, AgentMetadata> = {
  BugFixAgent: {
    id: 'BugFixAgent',
    version: '3.1.0',
    role: '异常修复专家',
    responsibility: '运行时异常修复、边界条件修复、回归问题修复',
    inputTypes: ['ExceptionReport'],
    outputTypes: ['PullRequestProposal(bugfix)'],
    maxConcurrentTasks: 3,
    averageTokensPerTask: 8000,
    averageExecutionTime: 120000, // 2 分钟
    modelPreference: 'claude-sonnet-4-20250514',
  },
  FeatureAgent: {
    id: 'FeatureAgent',
    version: '3.1.0',
    role: '功能开发专家',
    responsibility: '新功能实现、功能增强、功能重构',
    inputTypes: ['RequirementDoc'],
    outputTypes: ['PullRequestProposal(feature)'],
    maxConcurrentTasks: 2,
    averageTokensPerTask: 15000,
    averageExecutionTime: 300000, // 5 分钟
    modelPreference: 'claude-sonnet-4-20250514',
  },
  OptimizationAgent: {
    id: 'OptimizationAgent',
    version: '3.1.0',
    role: '性能优化专家',
    responsibility: 'LLM调用优化、数据库优化、代码性能优化、算法优化',
    inputTypes: ['PerformanceReport'],
    outputTypes: ['PullRequestProposal(optimization)'],
    maxConcurrentTasks: 2,
    averageTokensPerTask: 12000,
    averageExecutionTime: 180000, // 3 分钟
    modelPreference: 'claude-sonnet-4-20250514',
  },
  SecurityAgent: {
    id: 'SecurityAgent',
    version: '3.1.0',
    role: '安全专家',
    responsibility: 'Prompt注入防护、数据泄露防护、权限控制审计、依赖漏洞扫描',
    inputTypes: ['Codebase', 'DependencyList'],
    outputTypes: ['PullRequestProposal(security)'],
    maxConcurrentTasks: 3,
    averageTokensPerTask: 10000,
    averageExecutionTime: 240000, // 4 分钟
    modelPreference: 'claude-sonnet-4-20250514',
  },
  RefactorAgent: {
    id: 'RefactorAgent',
    version: '3.1.0',
    role: '代码质量专家',
    responsibility: '代码质量提升、架构清理、技术债务偿还',
    inputTypes: ['QualityReport'],
    outputTypes: ['PullRequestProposal(refactor)'],
    maxConcurrentTasks: 2,
    averageTokensPerTask: 10000,
    averageExecutionTime: 180000, // 3 分钟
    modelPreference: 'claude-sonnet-4-20250514',
  },
  TestAgent: {
    id: 'TestAgent',
    version: '3.1.0',
    role: '测试工程专家',
    responsibility: '测试生成、测试执行、覆盖率提升、回归测试',
    inputTypes: ['CodeChanges', 'DiffHunks'],
    outputTypes: ['PullRequestProposal(test)', 'TestReport'],
    maxConcurrentTasks: 5,
    averageTokensPerTask: 8000,
    averageExecutionTime: 150000, // 2.5 分钟
    modelPreference: 'claude-sonnet-4-20250514',
  },
  DocAgent: {
    id: 'DocAgent',
    version: '3.1.0',
    role: '技术文档专家',
    responsibility: 'API文档更新、变更日志、架构文档、开发者指南',
    inputTypes: ['CodeChanges', 'ExistingDocs'],
    outputTypes: ['PullRequestProposal(docs)'],
    maxConcurrentTasks: 3,
    averageTokensPerTask: 6000,
    averageExecutionTime: 90000, // 1.5 分钟
    modelPreference: 'claude-sonnet-4-20250514',
  },
};
```

### 附录 C: 性能指标

| 指标 | 目标值 | 监控方式 |
|------|--------|----------|
| Agent 响应时间（P50） | < 30 秒 | 内置计时器 |
| Agent 响应时间（P99） | < 5 分钟 | 内置计时器 |
| 提案生成质量评分 | >= 80 | 自动评分 |
| 代码审查通过率 | >= 85% | 审查追踪 |
| 自动部署成功率 | >= 95% | 部署追踪 |
| 回滚触发率 | < 5% | 部署追踪 |
| Agent 间冲突率 | < 10% | 冲突检测 |
| 冲突自动解决率 | >= 70% | 冲突追踪 |

### 附录 D: 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0.0 | 2025-01 | 初始设计 — 7 个 Agent 完整规格 |

---

> **文档结束**
>
> NarrativeOS v3.0 Sovereign — DevAgent Cluster 第三层设计规格书
> 本文档定义了 7 种开发智能体的完整规格、协作协议和质量门槛体系。
> 所有 Agent 的产出统一为 PullRequestProposal 格式，通过质量门槛后方可进入审查和部署流程。
> 第一公理是所有 Agent 的最高约束，涉及叙事逻辑的变更必须经过作者审批。
