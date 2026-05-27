> [!WARNING] **[DEPRECATED] 本文档已废弃 — 2026-05-20**
> 原 P9 DevAgent 集群（5 层架构）不再另建代码实现。Claude Code 直接担任开发维护角色（见 `CLAUDE.md` §"自动化开发维护角色"）。
> 验证与部署的功能已由 `pnpm test` / `pnpm typecheck` + Claude Code 自身执行。金丝雀/蓝绿部署等云端部署概念不适用于 NarrativeOS 单机运行环境。
> 本文档保留为参考档案，其中代码审查清单（24 项）可作为人工审查 checklist 参考。

# DevAgent Cluster 第四层：验证与部署系统（Validation & Deployment Layer）

## NarrativeOS v3.0 Sovereign — 设计文档

**版本**: v3.0.0-alpha  
**状态**: [DEPRECATED] 架构设计（参考档案，不实现）  
**技术栈**: TypeScript + PostgreSQL 16 + pgvector + XState + LLM API  
**运行环境**: Windows + WSL2 / Docker  
**设计者**: DevAgent Cluster  

---

## 目录

1. [系统架构概览](#1-系统架构概览)
2. [代码审查器（CodeReviewer）](#2-代码审查器codereviewer)
3. [集成测试器（IntegrationTester）](#3-集成测试器integrationtester)
4. [渐进部署器（GradualDeployer）](#4-渐进部署器gradualdeployer)
5. [回滚保护器（RollbackGuardian）](#5-回滚保护器rollbackguardian)
6. [作者审批界面（AuthorApprovalUI）](#6-作者审批界面authorapprovalui)
7. [部署流水线编排](#7-部署流水线编排)
8. [TypeScript 接口定义](#8-typescript-接口定义)
9. [核心配置（YAML）](#9-核心配置yaml)
10. [第一公理合规声明](#10-第一公理合规声明)

---

## 1. 系统架构概览

### 1.1 设计哲学

验证与部署系统遵循以下核心原则：

| 原则 | 描述 |
|------|------|
| **叙事主权至上** | 任何影响世界规则、创作流程、LLM Prompt的变更必须经作者明确审批 |
| **技术自主** | 纯技术修复（bug修复、性能优化、安全补丁）可自动部署，但保留完整回滚能力 |
| **渐进信任** | 部署采用渐进式策略，从不信任逐步过渡到信任 |
| **最小影响** | 任何变更的验证失败都应阻断部署，绝不允许带病上线 |
| **全程可观测** | 从代码审查到部署完成的每个阶段都完整记录，作者可随时查阅 |

### 1.2 系统拓扑

```
+------------------------------------------------------------------+
|                    Validation & Deployment Layer                   |
+------------------------------------------------------------------+
|                                                                    |
|  +----------------+   +----------------+   +------------------+   |
|  |  CodeReviewer  |-->| IntegrationTest|-->|  GradualDeployer |   |
|  |   (代码审查器)  |   |  (集成测试器)   |   |  (渐进部署器)    |   |
|  +----------------+   +----------------+   +------------------+   |
|          |                      |                      |          |
|          v                      v                      v          |
|  +----------------+   +----------------+   +------------------+   |
|  | ReviewReport   |   | TestReport     |   | DeploymentLog    |   |
|  | (审查报告)      |   | (测试报告)      |   | (部署日志)       |   |
|  +----------------+   +----------------+   +------------------+   |
|                                    |                      |        |
|                                    v                      v        |
|  +----------------+   +----------------+   +------------------+   |
|  |AuthorApprovalUI|   |RollbackGuardian|   | PipelineOrchestr |   |
|  | (作者审批界面)  |   |  (回滚保护器)   |   | (流水线编排器)   |   |
|  +----------------+   +----------------+   +------------------+   |
|                                                                    |
+------------------------------------------------------------------+
         |                      |                      |
         v                      v                      v
  +------------+       +--------------+      +----------------+
  |  DevAgent  |       | NarrativeOS  |      |   PostgreSQL   |
  |   Cluster  |       |   Runtime    |      |    + pgvector  |
  +------------+       +--------------+      +----------------+
```

### 1.3 部署决策矩阵

```
变更类型判断：

                    +---------------------+
                    |   变更分类器         |
                    +----------+----------+
                               |
              +----------------+----------------+
              |                                 |
        [叙事相关变更]                    [纯技术变更]
              |                                 |
     +--------v--------+              +---------v--------+
     | 涉及世界规则？   |              | Bug修复？         |
     | 涉及创作流程？   |              | 性能优化？        |
     | 涉及LLM Prompt？ |              | 安全补丁？        |
     | 涉及角色设定？   |              | 重构（无行为变更）？|
     +--------+--------+              +---------+--------+
              |                                 |
              v                                 v
     [必须作者审批]                      [自动部署通道]
              |                                 |
              v                                 v
     AuthorApprovalUI               GradualDeployer.autoDeploy()
     审批通过 -> 部署                审查通过 + 测试通过 -> 部署
     审批拒绝 -> 退回修改             任一失败 -> 阻断部署
```

---

## 2. 代码审查器（CodeReviewer）

### 2.1 审查清单（24项核心检查）

#### 类别 A：类型安全（2项）

| 编号 | 检查项 | 严重级别 | 自动修复 | 说明 |
|------|--------|----------|----------|------|
| CR-A01 | `any` 类型使用审查 | **阻断** | 否 | 禁止无合理注释的 `any` 类型使用；每次使用必须在代码注释中说明原因 |
| CR-A02 | 类型断言合理性 | **警告** | 否 | `as` 类型断言必须有防御性检查；禁止 `as unknown as X` 双重断言链 |

#### 类别 B：错误处理（2项）

| 编号 | 检查项 | 严重级别 | 自动修复 | 说明 |
|------|--------|----------|----------|------|
| CR-B01 | 异步操作 try-catch 覆盖 | **阻断** | 否 | 所有 `async/await` 操作必须有 try-catch；Promise 必须有 `.catch()` |
| CR-B02 | 错误传播完整性 | **警告** | 否 | 自定义错误必须有明确的错误码；禁止吞没异常（空的 catch 块） |

#### 类别 C：资源管理（3项）

| 编号 | 检查项 | 严重级别 | 自动修复 | 说明 |
|------|--------|----------|----------|------|
| CR-C01 | 数据库连接释放 | **阻断** | 否 | 所有 `PoolClient` 必须在 finally 块中释放 |
| CR-C02 | 事件监听器清理 | **阻断** | 否 | 所有 `.on()` 必须有对应的 `.off()`；组件卸载时清理监听器 |
| CR-C03 | 流资源释放 | **警告** | 否 | ReadableStream/WritableStream 必须在 finally 中销毁 |

#### 类别 D：并发安全（2项）

| 编号 | 检查项 | 严重级别 | 自动修复 | 说明 |
|------|--------|----------|----------|------|
| CR-D01 | 共享状态访问控制 | **阻断** | 否 | 共享可变状态必须有互斥访问；禁止使用全局变量存储请求状态 |
| CR-D02 | 竞态条件检测 | **警告** | 否 | 异步操作序列必须保持一致性；检查 TOCTOU 问题 |

#### 类别 E：测试覆盖（2项）

| 编号 | 检查项 | 严重级别 | 自动修复 | 说明 |
|------|--------|----------|----------|------|
| CR-E01 | 新增代码测试覆盖 | **阻断** | 否 | 新增行覆盖率必须 >= 80%；新增分支覆盖率必须 >= 70% |
| CR-E02 | 关键路径测试 | **阻断** | 否 | 状态机所有状态转换必须有测试覆盖；LLM 调用降级路径必须有测试 |

#### 类别 F：代码风格（2项）

| 编号 | 检查项 | 严重级别 | 自动修复 | 说明 |
|------|--------|----------|----------|------|
| CR-F01 | ESLint 规则合规 | **警告** | 是 | 所有 ESLint 规则必须通过；warning 数量不得超过 5 个 |
| CR-F02 | Prettier 格式合规 | **信息** | 是 | 代码必须通过 Prettier 格式化检查 |

#### 类别 G：第一公理合规（3项）

| 编号 | 检查项 | 严重级别 | 自动修复 | 说明 |
|------|--------|----------|----------|------|
| CR-G01 | 越权自动决策检测 | **阻断** | 否 | 检查是否有系统绕过作者决策的代码；禁止自动修改作者创作内容 |
| CR-G02 | 叙事主权边界检查 | **阻断** | 否 | 检查是否有可能改变世界规则/角色设定的自动逻辑 |
| CR-G03 | LLM 自主行为审查 | **阻断** | 否 | LLM 的输出是否必须经过作者确认才能影响系统状态 |

#### 类别 H：架构一致性（2项）

| 编号 | 检查项 | 严重级别 | 自动修复 | 否 | 说明 |
|------|--------|----------|------|------|------|
| CR-H01 | 分层架构合规 | **阻断** | | | 代码必须在正确的分层中；禁止跨层直接调用 |
| CR-H02 | 依赖方向合规 | **阻断** | 否 | 内层不能依赖外层；遵循依赖倒置原则 |

#### 类别 I：接口兼容性（2项）

| 编号 | 检查项 | 严重级别 | 自动修复 | 说明 |
|------|--------|----------|----------|------|
| CR-I01 | 公共接口破坏性变更 | **阻断** | 否 | 禁止删除/修改已发布的公共 API；新增参数必须有默认值 |
| CR-I02 | 数据库兼容性 | **阻断** | 否 | Schema 变更必须有向后兼容的迁移策略 |

#### 类别 J：性能影响（2项）

| 编号 | 检查项 | 严重级别 | 自动修复 | 说明 |
|------|--------|----------|----------|------|
| CR-J01 | N+1 查询检测 | **阻断** | 否 | 禁止在循环中执行未优化的数据库查询 |
| CR-J02 | 内存泄漏风险 | **警告** | 否 | 检查闭包引用、缓存无限增长、大对象生命周期 |

#### 类别 K：安全审查（2项）

| 编号 | 检查项 | 严重级别 | 自动修复 | 说明 |
|------|--------|----------|----------|------|
| CR-K01 | 注入攻击防护 | **阻断** | 否 | 所有 SQL 必须使用参数化查询；禁止字符串拼接 SQL |
| CR-K02 | 敏感信息泄露 | **阻断** | 否 | 日志中禁止输出 API Key、密码；禁止硬编码凭据 |

#### 类别 L：日志与配置（2项）

| 编号 | 检查项 | 严重级别 | 自动修复 | 说明 |
|------|--------|----------|----------|------|
| CR-L01 | 日志完整性 | **警告** | 否 | 关键操作必须有日志记录；日志必须包含足够的上下文 |
| CR-L02 | 配置管理合规 | **警告** | 否 | 禁止硬编码配置值；环境敏感配置必须来自环境变量 |

### 2.2 审查报告 JSON Schema

```typescript
interface ReviewReport {
  /** 审查唯一标识 */
  reviewId: string;
  /** 关联的变更ID */
  changeId: string;
  /** 审查时间戳 */
  timestamp: string;
  /** 审查状态 */
  status: 'passed' | 'failed' | 'warning';
  /** 综合评分 0-100 */
  score: number;
  /** 通过的检查项 */
  passed: ReviewCheckItem[];
  /** 警告的检查项 */
  warnings: ReviewCheckItem[];
  /** 失败的检查项 */
  failures: ReviewCheckItem[];
  /** 信息项 */
  infos: ReviewCheckItem[];
  /** 是否允许自动修复 */
  autoFixAvailable: boolean;
  /** 自动修复结果 */
  autoFixResults?: AutoFixResult[];
  /** 整体判定 */
  verdict: ReviewVerdict;
  /** 建议操作 */
  recommendedAction: ReviewAction;
  /** 人工复核标记 */
  requiresHumanReview: boolean;
  /** 复核原因 */
  humanReviewReason?: string;
}

interface ReviewCheckItem {
  /** 检查编号 */
  checkId: string;
  /** 检查类别 */
  category: string;
  /** 检查描述 */
  description: string;
  /** 严重级别 */
  severity: 'blocking' | 'warning' | 'info';
  /** 检查结果 */
  result: 'pass' | 'fail' | 'warn';
  /** 检查的文件位置 */
  locations: CodeLocation[];
  /** 修复建议 */
  suggestion?: string;
  /** 参考文档链接 */
  docsLink?: string;
}

interface CodeLocation {
  /** 文件路径 */
  filePath: string;
  /** 起始行 */
  startLine: number;
  /** 结束行 */
  endLine: number;
  /** 相关代码片段 */
  snippet?: string;
}

interface AutoFixResult {
  checkId: string;
  /** 是否成功修复 */
  fixed: boolean;
  /** 修复描述 */
  description: string;
  /** 修改的文件 */
  modifiedFiles: string[];
  /** 修复失败的原因 */
  error?: string;
}

/** 审查判定 */
type ReviewVerdict = 
  | 'auto_approved'      // 全部通过，自动批准
  | 'approved_with_warnings' // 通过但有警告
  | 'needs_human_review' // 需要人工复核
  | 'rejected';          // 存在阻断性问题，拒绝

/** 审查后的建议操作 */
type ReviewAction =
  | 'proceed_to_test'    // 继续到测试阶段
  | 'apply_auto_fix'     // 应用自动修复后重试
  | 'request_human_review' // 请求人工复核
  | 'return_to_developer'  // 退回开发者修改;
```

### 2.3 审查阈值

```yaml
review_thresholds:
  # 阻断性问题：必须为零
  blocking_failures:
    max: 0
    action: reject

  # 警告阈值体系
  warnings:
    # 绿色：0-2 个警告，自动通过
    green_zone:
      max: 2
      action: proceed
    # 黄色：3-5 个警告，需要人工复核
    yellow_zone:
      max: 5
      action: human_review
    # 红色：>5 个警告，退回修改
    red_zone:
      min: 6
      action: return_to_developer

  # 综合评分阈值
  score:
    excellent: 90    # >= 90：优秀，直接通过
    acceptable: 75   # >= 75：可接受，通过但记录
    poor: 60         # >= 60：需改进，需人工复核
    critical: 0      # < 60：不合格，退回修改

  # 自动修复策略
  auto_fix:
    enabled: true
    # 只有警告级别的风格问题可以自动修复
    allowed_severities: ['warning']
    # 可自动修复的类别
    allowed_categories: ['CR-F']  # 仅代码风格
```

### 2.4 审查不通过的回退策略

```
审查失败后的回退路径：

[审查发现阻断性问题]
    |
    +---> 1. 生成详细审查报告（含修复建议）
    |
    +---> 2. 标记变更状态为 "needs_fix"
    |
    +---> 3. 通知开发智能体（含具体修复指导）
    |
    +---> 4. 开发智能体修复后重新提交审查
    |           |
    |           +---> 审查通过 -> 进入测试阶段
    |           |
    |           +---> 仍然失败 -> 最多3次尝试
    |                           |
    |                           +---> 3次后仍失败
    |                                   |
    |                                   +---> 升级到作者审批
    |                                           |
    |                                           +---> 作者可覆盖审查结果
    |                                           +---> 或退回重新设计
    |
    +---> 5. 全程记录到变更历史（用于学习改进）
```

---

## 3. 集成测试器（IntegrationTester）

### 3.1 测试环境管理

#### 3.1.1 测试数据库（TestContainers）

```typescript
interface TestDatabaseConfig {
  /** TestContainers PostgreSQL 配置 */
  container: {
    image: 'postgres:16-alpine';
    /** 数据库初始化脚本 */
    initScripts: string[];
    /** pgvector 扩展自动安装 */
    extensions: ['pgvector', 'pg_trgm'];
    /** 数据库名称 */
    databaseName: 'narrativeos_test';
    /** 容器资源限制 */
    resources: {
      memory: '512MB';
      cpus: 1.0;
    };
  };
  
  /** 测试数据工厂 */
  dataFactory: {
    /** 是否使用固定种子（保证可重复） */
    fixedSeed: true;
    seedValue: 42;
    /** 生成测试网文数据 */
    novelGenerators: NovelDataGenerator[];
  };
  
  /** 测试隔离策略 */
  isolation: 'transaction' | 'database_per_test' | 'schema_per_test';
  
  /** 测试完成后清理 */
  cleanup: 'always' | 'on_success' | 'never';
}
```

#### 3.1.2 Mock LLM 服务

```typescript
interface MockLLMService {
  /** Mock 服务配置 */
  config: {
    /** 预定义响应模式 */
    responseMode: 'predefined' | 'deterministic' | 'hybrid';
    /** 响应延迟模拟 */
    latencySimulation: {
      enabled: true;
      baseLatency: 100;    // ms
      jitter: 50;          // +/- ms
      /** 慢响应模拟比例 */
      slowResponseRate: 0.1;
      slowLatency: 2000;   // ms
    };
    /** 错误注入 */
    errorInjection: {
      enabled: true;
      rate: 0.05;          // 5% 错误率
      errorTypes: [
        'timeout',
        'rate_limit',
        'invalid_json',
        'empty_response',
        'model_unavailable',
        'token_exceeded'
      ];
    };
  };

  /** 预定义响应库 */
  predefinedResponses: {
    /** 世界引擎响应 */
    worldEngine: PredefinedWorldResponse[];
    /** 工作室引擎响应 */
    studioEngine: PredefinedStudioResponse[];
    /** 降级链路测试响应 */
    fallbackChain: PredefinedFallbackResponse[];
  };
}
```

#### 3.1.3 测试数据工厂

```typescript
interface NovelDataFactory {
  /** 生成网文章节 */
  generateChapter: (options: {
    wordCount: number;      // 字数
    genreTags: string[];    // 标签
    characterCount: number; // 出场角色数
    hasConflict: boolean;   // 是否有冲突
  }) => TestChapter;

  /** 生成世界设定 */
  generateWorldSetting: (options: {
    worldRules: string[];   // 世界规则
    powerSystem: string;    // 力量体系
    geography: string;      // 地理设定
  }) => TestWorldSetting;

  /** 生成角色档案 */
  generateCharacterProfile: (options: {
    name: string;
    personality: string[];
    relationships: Relationship[];
    powerLevel: number;
  }) => TestCharacterProfile;

  /** 生成测试向量数据 */
  generateVectorData: (dimensions: number) => Float32Array;
}
```

### 3.2 集成测试套件

#### 3.2.1 MOU 完整流程测试

```typescript
/**
 * MOU (Memorandum of Understanding) 完整状态机测试
 * 
 * 测试目标：验证从 idle 到 committing 的所有可能路径
 * 测试策略：状态机路径覆盖 + 边界条件
 */
interface MOUIntegrationTestSuite {
  // A. 主路径测试
  'MOU-001': {
    name: '标准 MOU 流程 - 作者发起 -> 协商 -> 确认 -> 固化';
    path: ['idle', 'negotiating', 'confirming', 'committing'];
    triggers: ['author_initiates', 'system_proposes', 'author_confirms', 'system_commits'];
    assertions: [
      '数据库存在对应 MOU 记录',
      '状态转换日志完整',
      '所有参与者的认知更新',
      '世界状态一致'
    ];
  };

  // B. 异常路径测试
  'MOU-002': {
    name: '作者拒绝路径 - idle -> negotiating -> cancelled';
    path: ['idle', 'negotiating', 'cancelled'];
    trigger: 'author_rejects';
  };

  'MOU-003': {
    name: '超时取消路径 - 协商超时自动取消';
    path: ['idle', 'negotiating', 'timeout_cancelled'];
    trigger: 'timeout_reached';
  };

  'MOU-004': {
    name: '撤回确认路径 - confirming -> negotiating';
    path: ['idle', 'negotiating', 'confirming', 'negotiating'];
    trigger: 'author_reconsiders';
  };

  // C. 边界条件
  'MOU-005': {
    name: '并发 MOU 冲突检测 - 两个 MOU 修改同一世界规则';
    setup: '同时创建两个修改同一规则冲突的 MOU';
    assertion: '第二个 MOU 应被标记为冲突，进入冲突解决状态';
  };

  'MOU-006': {
    name: 'MOU 依赖链 - MOU-B 依赖 MOU-A 先固化';
    path: ['MOU-A: committing', 'MOU-B: committing'];
    assertion: 'MOU-B 必须等待 MOU-A 完成后才能固化';
  };

  'MOU-007': {
    name: 'MOU 历史追溯 - 固化后可查看完整协商历史';
    assertion: '所有状态转换、提议内容、修改记录完整保留';
  };

  // D. 失败恢复测试
  'MOU-008': {
    name: '固化过程中数据库断开 -> 自动回滚';
    fault: '数据库连接断开';
    assertion: 'MOU 状态回退到 confirming，数据保持一致';
  };

  'MOU-009': {
    name: '固化过程中 LLM 超时 -> 降级处理';
    fault: 'LLM 调用超时';
    assertion: '使用缓存响应，标记需要后续处理';
  };
}
```

#### 3.2.2 世界引擎测试

```typescript
/**
 * 世界引擎集成测试套件
 * 
 * 测试目标：验证 CSP 推演、涟漪传播、先例检测
 */
interface WorldEngineTestSuite {
  // A. CSP 推演测试
  'WE-001': {
    name: 'CSP 变量一致性求解 - 简单约束';
    setup: '定义 3 个变量、5 个约束';
    assertion: '求解器返回有效解，计算时间在 < 100ms';
  };

  'WE-002': {
    name: 'CSP 不可解检测 - 冲突约束';
    setup: '定义互相矛盾的约束';
    assertion: '检测到无解，返回冲突约束列表';
  };

  'WE-003': {
    name: 'CSP 大规模变量 - 50+ 变量';
    setup: '50 个变量、200 个约束';
    assertion: '求解在 < 500ms 内完成，不崩溃';
  };

  // B. 涟漪传播测试
  'WE-004': {
    name: '单点修改涟漪传播 - 修改角色等级';
    setup: '修改角色 A 的等级（影响力量、可进入区域、NPC 态度）';
    assertion: '所有受影响的衍生属性正确更新，传播深度 = 3';
  };

  'WE-005': {
    name: '涟漪传播边界 - 无关联修改';
    setup: '修改不相关的两个属性';
    assertion: '两个涟漪不互相干扰';
  };

  'WE-006': {
    name: '涟漪传播循环检测 - A->B->C->A';
    setup: '创建循环依赖关系';
    assertion: '检测循环并终止传播，记录循环路径';
  };

  'WE-007': {
    name: '大规模涟漪 - 修改核心规则';
    setup: '修改世界核心规则（影响 100+ 实体）';
    assertion: '传播完成时间 < 2s，所有实体正确更新';
  };

  // C. 先例检测测试
  'WE-008': {
    name: '先例精确匹配 - 相同角色、相同情境';
    setup: '角色 A 在情境 X 的先例已存在';
    assertion: '精确匹配到先例，返回置信度 1.0';
  };

  'WE-009': {
    name: '先例模糊匹配 - 相似但不完全同';
    setup: '类似情境 Y 但没有完全相同的情境 X';
    assertion: '返回相似先例列表，按相似度排序';
  };

  'WE-010': {
    name: '先例向量检索 - pgvector 语义搜索';
    setup: '使用向量嵌入检索先例';
    assertion: '返回语义相关先例，top-k 准确性 > 90%';
  };
}
```

#### 3.2.3 工作室引擎测试

```typescript
/**
 * 工作室引擎集成测试套件
 * 
 * 测试目标：验证 Prompt 组装、正文生成、质量评分
 */
interface StudioEngineTestSuite {
  // A. Prompt 组装测试
  'SE-001': {
    name: 'Prompt 组装完整性 - 包含所有必要上下文';
    setup: '世界设定 + 角色档案 + 前文摘要 + 本章目标';
    assertion: 'Prompt 包含所有必要字段，格式正确';
  };

  'SE-002': {
    name: 'Prompt 长度控制 - 超长上下文截断';
    setup: '上下文超过模型最大输入长度';
    assertion: '智能截断非关键部分，保留核心信息';
  };

  'SE-003': {
    name: 'Prompt 版本兼容性 - 新旧 Prompt 格式';
    setup: '使用旧版本世界数据组装新版本 Prompt';
    assertion: '自动适配，不报错';
  };

  // B. 正文生成测试
  'SE-004': {
    name: '正文生成 - 标准章节生成';
    setup: '完整的 Prompt 和生成参数';
    assertion: '生成内容 > 2000 字，与大纲一致';
  };

  'SE-005': {
    name: '生成质量 - 角色一致性检查';
    setup: '检查生成内容中角色行为是否符合人设';
    assertion: '角色行为一致性 > 95%';
  };

  'SE-006': {
    name: '生成质量 - 世界规则遵守';
    setup: '检查生成内容是否违反世界规则';
    assertion: '世界规则违反率 = 0';
  };

  // C. 质量评分测试
  'SE-007': {
    name: '质量评分 - 优秀章节评分';
    setup: '高质量生成内容';
    assertion: '综合评分 >= 85';
  };

  'SE-008': {
    name: '质量评分 - 低质量检测';
    setup: '故意生成低质量内容（重复、跑题）';
    assertion: '低质量指标被正确标记';
  };
}
```

#### 3.2.4 数据库事务测试

```typescript
/**
 * 数据库事务集成测试
 */
interface DatabaseTransactionTestSuite {
  'DB-001': {
    name: '原子固化 - MOU 提交要么全成功要么全失败';
    setup: '模拟提交到一半时故障';
    assertion: '数据库状态回滚到提交前';
  };

  'DB-002': {
    name: '并发事务隔离 - 两个同时提交的 MOU';
    setup: '两个客户端同时提交';
    assertion: '数据一致性保持，无脏读/幻读';
  };

  'DB-003': {
    name: '死锁检测与恢复';
    setup: '制造死锁条件';
    assertion: '检测到死锁，自动回滚其中一个事务';
  };

  'DB-004': {
    name: '向量操作原子性 - pgvector 与普通表一致性';
    setup: '同时更新普通表和向量表';
    assertion: '两个表要么都更新成功，要么都回滚';
  };

  'DB-005': {
    name: '长事务超时 - 事务执行超过最大时间';
    setup: '故意延长事务执行时间';
    assertion: '超时后自动回滚，释放锁';
  };
}
```

#### 3.2.5 LLM 降级测试

```typescript
/**
 * LLM 降级链路测试
 */
interface LLMFallbackTestSuite {
  'LLM-001': {
    name: '主模型不可用 -> 降级到备用模型';
    fault: '主模型返回 503';
    assertion: '自动切换到备用模型，功能正常';
  };

  'LLM-002': {
    name: '所有在线模型不可用 -> 使用本地缓存';
    fault: '所有模型返回错误';
    assertion: '使用最近的有效缓存响应，标记降级状态';
  };

  'LLM-003': {
    name: '降级链完整耗尽 -> 优雅降级';
    fault: '所有模型 + 缓存都不可用';
    assertion: '返回预设默认响应，记录故障';
  };

  'LLM-004': {
    name: '模型恢复自动恢复';
    setup: '先故障降级，然后模型恢复';
    assertion: '检测模型恢复，自动切回主模型';
  };

  'LLM-005': {
    name: '降级期间质量保持';
    setup: '降级到备用模型';
    assertion: '备用模型输出质量 >= 主模型的 80%';
  };
}
```

### 3.3 测试矩阵

```
                    功能测试    性能测试    稳定性测试    兼容性测试
MOU 流程              [x]        [x]         [x]          [x]
世界引擎              [x]        [x]         [x]          [x]
工作室引擎            [x]        [x]         [x]          [x]
数据库事务            [x]        [x]         [x]          [ ]
LLM 降级              [x]        [x]         [x]          [ ]
API 接口              [x]        [x]         [x]          [x]
pgvector 向量操作      [x]        [x]         [ ]          [x]
XState 状态机         [x]        [ ]         [x]          [ ]

图例说明：
[x] = 已覆盖
[ ] = 不适用于此模块（将在其他层测试）
```

### 3.4 测试通过判定标准

```yaml
test_pass_criteria:
  # 功能测试
  functional:
    all_tests_pass: true           # 所有测试用例通过
    assertion_coverage: '>=' 95    # 断言覆盖率 >= 95%
  
  # 性能测试
  performance:
    api_response_p95: '<=' 500ms   # API P95 响应时间
    db_query_p95: '<=' 100ms       # 数据库查询 P95
    llm_call_timeout: '<=' 10s     # LLM 调用超时时间
    concurrent_users: '>=' 10      # 支持的并发用户数
    memory_usage: '<=' 512MB       # 内存使用峰值
  
  # 稳定性测试
  stability:
    soak_test_duration: 4h         # 浸泡测试时长
    memory_growth_rate: '<=' 1MB/h # 内存增长速率
    error_rate: '<=' 0.1%          # 错误率
    recovery_time: '<=' 5s         # 故障恢复时间
  
  # 兼容性测试
  compatibility:
    pg_versions: ['16.x']          # PostgreSQL 版本
    node_versions: ['20.x', '22.x'] # Node.js 版本
    os_platforms: ['linux', 'win32'] # 操作系统
```

---

## 4. 渐进部署器（GradualDeployer）

### 4.1 部署策略

#### 4.1.1 金丝雀部署（Canary Deployment）

```typescript
interface CanaryDeploymentConfig {
  /** 金丝雀流量分配 */
  trafficStages: [
    { percentage: 1;   duration: '5m';  exitCriteria: 'error_rate < 1%' },
    { percentage: 5;   duration: '10m'; exitCriteria: 'error_rate < 0.5%' },
    { percentage: 25;  duration: '15m'; exitCriteria: 'p95_latency < 500ms' },
    { percentage: 50;  duration: '20m'; exitCriteria: 'all_health_checks_pass' },
    { percentage: 100; duration: '0';   exitCriteria: 'immediate' }
  ];
  
  /** 快速回滚条件 */
  rollbackTriggers: {
    errorRateThreshold: 5;        // 错误率 > 5% 立即回滚
    latencyP95Threshold: 2000;    // P95 延迟 > 2000ms 回滚
    criticalFunctionFailure: true; // 关键功能失败立即回滚
  };
  
  /** 自动推进条件 */
  autoProgress: {
    enabled: true;
    // 所有退出指标持续满足才自动推进
    requiredConsecutiveChecks: 3;
    checkInterval: 60; // 秒
  };
}
```

#### 4.1.2 蓝绿部署（Blue-Green Deployment）

```typescript
interface BlueGreenDeploymentConfig {
  /** 蓝环境（当前运行版本） */
  blue: {
    version: string;
    traffic: 100;
    status: 'active';
  };
  
  /** 绿环境（待部署版本） */
  green: {
    version: string;
    traffic: 0;
    status: 'standby' | 'warming_up' | 'health_check';
  };
  
  /** 切换策略 */
  switchover: {
    /** 切换方式 */
    type: 'instant' | 'gradual';
    /** 切换前验证 */
    preSwitchChecks: HealthCheck[];
    /** 切换超时 */
    timeout: 30; // 秒
    /** 切换失败回滚 */
    autoRollback: true;
  };
  
  /** 环境预热 */
  warmup: {
    enabled: true;
    duration: 120; // 预热 2 分钟
    healthCheckInterval: 10;
  };
}
```

#### 4.1.3 功能开关（Feature Flag）

```typescript
interface FeatureFlagConfig {
  /** 功能开关注册表 */
  flags: {
    [flagName: string]: {
      /** 开关描述 */
      description: string;
      /** 变更分类（决定审批流程） */
      category: 'narrative' | 'technical';
      /** 默认状态 */
      defaultValue: boolean;
      /** 作者是否可以控制 */
      authorControllable: boolean;
      /** 依赖的其他开关 */
      dependencies: string[];
      /** 关联的变更集 */
      relatedChanges: string[];
    };
  };
  
  /** 开关变更规则 */
  activationRules: {
    narrative: {
      // 叙事相关开关：必须作者审批
      requiresApproval: true;
      approvalType: 'author_explicit';
    };
    technical: {
      // 技术开关：可以自动启用
      requiresApproval: false;
      autoEnableAfter: 'deployment_success' | 'health_check_pass' | 'manual';
    };
  };
}
```

### 4.2 部署阶段

```
部署流水线阶段详解：

Phase 1: 预检查 (PreCheck)
  ├── 磁盘空间检查 (>= 1GB 可用)
  ├── 数据库连接检查
  ├── 待执行迁移列表确认
  ├── 数据库备份完成确认
  ├── 当前版本回滚点记录
  └── 超时: 5分钟
  └── 失败: 阻断部署，通知开发者

Phase 2: 数据库迁移 (DBMigration)
  ├── 迁移脚本校验 (checksum)
  ├── 按顺序执行迁移
  ├── 迁移验证 (row count, schema version)
  ├── 迁移失败自动回滚
  └── 超时: 10分钟
  └── 失败: 回滚已执行的迁移，阻断部署

Phase 3: 代码部署 (CodeDeploy)
  ├── 新代码包下载/复制
  ├── 文件完整性校验 (SHA256)
  ├── 配置文件合并
  ├── 旧版本备份
  ├── 原子性文件替换
  └── 超时: 5分钟
  └── 失败: 恢复旧版本文件

Phase 4: 健康检查 (HealthCheck)
  ├── 服务启动检查
  ├── 数据库连接检查
  ├── 核心 API 冒烟测试
  ├── LLM 连接检查
  ├── XState 状态机初始化检查
  └── 超时: 3分钟
  └── 失败: 自动回滚到上一个版本

Phase 5: 监控观察 (Monitoring)
  ├── 错误率监控
  ├── 响应延迟监控
  ├── 内存使用监控
  ├── 数据库连接池监控
  ├── 作者操作日志监控
  └── 持续时间: 按部署策略决定
  └── 失败: 自动回滚

Phase 6: 完全切换 (FullSwitch)
  ├── 100% 流量切换
  ├── 旧版本保留 1 小时 (快速回滚)
  ├── 通知作者部署完成
  └── 超时: 2分钟
  └── 失败: 保持当前流量分配，人工介入
```

### 4.3 部署失败自动回滚触发条件

```yaml
deployment_rollback_triggers:
  # 致命级（立即回滚）
  critical:
    - name: 服务无法启动
      condition: health_check.count_failures >= 3
      action: immediate_rollback
      
    - name: 数据库迁移失败
      condition: migration.status == 'failed'
      action: rollback_migration_then_code
      
    - name: 核心功能不可用
      condition: smoke_test.critical_failures > 0
      action: immediate_rollback
      
    - name: 大量错误
      condition: error_rate.percentage > 5
      window: 2m
      action: immediate_rollback

  # 警告级（人工决策）
  warning:
    - name: 性能下降
      condition: latency_p95.percentage_increase > 30
      window: 5m
      action: alert_author_with_rollback_option
      
    - name: 错误率轻微上升
      condition: error_rate.percentage > 1 AND error_rate.percentage < 5
      window: 5m
      action: alert_author_with_rollback_option
      
    - name: 内存使用异常
      condition: memory.usage_percent > 90
      window: 5m
      action: alert_author_with_rollback_option
```

### 4.4 部署日志记录

```typescript
interface DeploymentLog {
  /** 部署唯一ID */
  deploymentId: string;
  /** 版本信息 */
  version: {
    from: string;
    to: string;
    changeIds: string[];
  };
  /** 时间线 */
  timeline: DeploymentPhaseLog[];
  /** 状态 */
  status: DeploymentStatus;
  /** 错误信息 */
  error?: DeploymentError;
  /** 回滚信息 */
  rollback?: RollbackInfo;
  /** 作者决策 */
  authorDecision?: AuthorDeploymentDecision;
}

interface DeploymentPhaseLog {
  phase: DeploymentPhase;
  startTime: string;
  endTime?: string;
  status: 'in_progress' | 'completed' | 'failed' | 'skipped';
  details: Record<string, unknown>;
  metrics?: PhaseMetrics;
}

type DeploymentPhase =
  | 'pre_check'
  | 'db_migration'
  | 'code_deploy'
  | 'health_check'
  | 'monitoring'
  | 'full_switch'
  | 'completed';

type DeploymentStatus =
  | 'pending'
  | 'in_progress'
  | 'succeeded'
  | 'failed'
  | 'rolled_back'
  | 'author_approval_pending';
```

---

## 5. 回滚保护器（RollbackGuardian）

### 5.1 回滚触发条件

```yaml
rollback_triggers:
  # A. 指标触发
  metrics:
    # 错误率触发
    error_rate:
      critical: 
        threshold: 5.0    # 错误率 > 5%
        duration: 2m      # 持续 2 分钟
        action: immediate_rollback
      warning:
        threshold: 1.0    # 错误率 > 1%
        duration: 5m      # 持续 5 分钟
        action: alert_with_rollback_option
    
    # 性能触发
    performance:
      latency_p95_increase:
        critical: 100     # P95 延迟增加 > 100%
        action: immediate_rollback
      latency_p95_absolute:
        critical: 5000    # P95 延迟 > 5000ms
        action: immediate_rollback
    
    # 可用性触发
    availability:
      health_check_failures:
        critical: 3       # 连续 3 次健康检查失败
        action: immediate_rollback
      critical_function_unavailable:
        action: immediate_rollback

  # B. 作者主动触发
  author_initiated:
    # 作者可以通过 UI 一键回滚
    ui_button: true
    # 作者可以通过命令回滚
    command: 'narrativeos rollback --deployment <id>'
    # 回滚审批
    requires_approval: false  # 作者可以直接回滚，不需要额外审批
    # 回滚确认
    confirmation_required: true  # 需要二次确认防止误操作

  # C. 部署超时触发
  timeout:
    any_phase_timeout:
      action: rollback_to_previous_phase

  # D. 依赖故障触发
  dependency_failure:
    database_unavailable:
      action: immediate_rollback
    llm_all_models_failed:
      action: alert_with_rollback_option
```

### 5.2 回滚机制

#### 5.2.1 代码回滚

```typescript
interface CodeRollback {
  /** 回滚策略 */
  strategy: 'full' | 'partial';
  
  full: {
    /** 完整恢复到上一个版本 */
    steps: [
      '停止当前运行服务',
      '恢复备份的代码文件',
      '恢复上一个版本的配置文件',
      '重启服务',
      '验证服务恢复正常'
    ];
    /** 回滚时间目标 */
    rto: 60; // 60 秒内完成
  };
  
  partial: {
    /** 只回滚指定功能开关 */
    featureFlags: string[];
    /** 只回滚指定模块 */
    modules: string[];
  };
}
```

#### 5.2.2 数据库回滚

```typescript
interface DatabaseRollback {
  /** 数据库回滚策略 */
  strategy: 'migration_down' | 'backup_restore' | 'compatibility_layer';
  
  /** A. 迁移回退（推荐） */
  migration_down: {
    /** 适用条件：变更有对应的 down 迁移 */
    condition: 'migration.has_down_script';
    steps: [
      '按逆序执行 down 迁移',
      '验证 schema 版本正确',
      '验证数据完整性'
    ];
  };
  
  /** B. 备份恢复（降级方案） */
  backup_restore: {
    /** 适用条件：down 迁移不可用 */
    condition: 'no_down_migration OR data_corruption';
    steps: [
      '停止写入服务',
      '从部署前备份恢复',
      '应用备份后产生的增量数据（如有）',
      '验证数据一致性',
      '恢复写入服务'
    ];
    /** 恢复时间目标 */
    rto: 300; // 5 分钟
  };
  
  /** C. 兼容层（最保守） */
  compatibility_layer: {
    /** 适用条件：其他方法都不可用 */
    condition: 'last_resort';
    description: '保持新 schema，但代码回滚到旧版本，通过兼容层适配';
  };
}
```

#### 5.2.3 配置回滚

```typescript
interface ConfigRollback {
  /** 配置分层回滚 */
  layers: {
    /** 系统级配置 */
    system: {
      backupPath: './backups/config/system';
      files: ['app.config.yaml', 'logging.config.yaml'];
    };
    /** 数据库连接配置 */
    database: {
      backupPath: './backups/config/database';
      files: ['database.config.yaml'];
    };
    /** LLM 配置 */
    llm: {
      backupPath: './backups/config/llm';
      files: ['llm.config.yaml', 'models.config.yaml'];
    };
    /** 功能开关配置 */
    featureFlags: {
      backupPath: './backups/config/features';
      files: ['feature-flags.yaml'];
    };
  };
  
  /** 配置验证 */
  validation: {
    /** 回滚后验证配置有效性 */
    schemaValidation: true;
    /** 验证必需配置项存在 */
    requiredKeys: string[];
    /** 验证配置值在有效范围内 */
    valueRanges: Record<string, { min: number; max: number }>;
  };
}
```

#### 5.2.4 部分回滚

```typescript
interface PartialRollback {
  /** 只回滚指定的功能 */
  target: {
    /** 按功能开关回滚 */
    featureFlags: string[];
    /** 按模块回滚 */
    modules: string[];
    /** 按变更回滚 */
    changes: string[];
  };
  
  /** 依赖检查 */
  dependencyCheck: {
    /** 检查要回滚的目标是否有依赖 */
    checkReverseDependencies: true;
    /** 检查依赖目标是否也要回滚 */
    checkForwardDependencies: true;
  };
  
  /** 部分回滚的执行步骤 */
  execution: {
    1: '分析目标变更的影响范围';
    2: '检查依赖关系';
    3: '关闭相关功能开关';
    4: '恢复相关代码文件（如果有）';
    5: '如果有 schema 变更，评估是否需要 down 迁移';
    6: '验证系统稳定性';
    7: '通知作者部分回滚完成';
  };
}
```

### 5.3 回滚验证

```typescript
interface RollbackVerification {
  /** 验证项目 */
  checks: {
    /** 服务健康 */
    serviceHealth: {
      healthEndpoint: '/api/health';
      expectedStatus: 200;
      maxRetries: 5;
      retryInterval: 10;
    };
    
    /** 核心功能 */
    coreFunctions: {
      /** 测试关键 API */
      apiTests: string[];
      /** 数据库读写 */
      dbOperations: ['read', 'write'];
      /** LLM 连接 */
      llmConnectivity: true;
    };
    
    /** 数据完整性 */
    dataIntegrity: {
      /** 行数检查 */
      rowCountCheck: true;
      /** 关键数据校验 */
      checksumValidation: true;
      /** 外键约束检查 */
      foreignKeyCheck: true;
    };
    
    /** 性能指标 */
    performance: {
      /** 延迟检查 */
      latencyCheck: { p95: '<=' 1000 };
      /** 错误率检查 */
      errorRateCheck: '<=' 1.0;
      /** 内存使用 */
      memoryUsage: '<=' 80;
    };
  };
  
  /** 验证失败处理 */
  onVerificationFailure: {
    action: 'retry_rollback' | 'alert_author' | 'escalate';
    maxRetries: 3;
    /** 验证失败是否尝试其他回滚策略 */
    fallbackStrategies: ['backup_restore', 'manual_intervention'];
  };
}
```

### 5.4 数据安全

```yaml
rollback_data_safety:
  # 创作数据保护原则
  principles:
    - name: 作者创作数据永不丢失
      description: 回滚操作绝不能删除或覆盖作者创作的小说内容、世界设定、角色档案
    
    - name: 回滚只影响系统代码和配置
      description: 回滚范围仅限于系统可执行文件和配置，不涉及创作数据库
    
    - name: Schema 变更必须向后兼容
      description: 数据库 Schema 的变更必须保持向后兼容，允许旧版本代码在新 Schema 上运行

  # 保护措施
  protections:
    # A. 数据库隔离
    database_isolation:
      system_db: 'narrativeos_system'   # 系统数据（可回滚）
      content_db: 'narrativeos_content' # 创作数据（永不回滚）
      vector_db: 'narrativeos_vectors'  # 向量数据（按需处理）
    
    # B. 备份策略
    backups:
      pre_deployment:
        system_db: true    # 部署前备份系统数据库
        content_db: false  # 创作数据不备份（已持久化）
      
      automatic:
        content_db:        # 创作数据自动备份
          frequency: '1h'  # 每小时
          retention: '30d' # 保留 30 天
    
    # C. 回滚范围限制
    rollback_scope:
      allowed:
        - 系统可执行文件
        - 系统配置文件
        - 系统数据库（schema_migrations, settings, caches）
      forbidden:
        - 小说正文内容
        - 世界设定数据
        - 角色档案
        - 作者偏好设置
        - 创作历史记录
    
    # D. 写保护机制
    write_protection:
      tables:
        - name: novels
          protection: readonly_during_rollback
        - name: chapters
          protection: readonly_during_rollback
        - name: world_settings
          protection: readonly_during_rollback
        - name: character_profiles
          protection: readonly_during_rollback
```

### 5.5 回滚历史记录

```typescript
interface RollbackHistory {
  /** 回滚记录 */
  entries: RollbackEntry[];
  
  /** 回滚统计 */
  statistics: {
    totalRollbacks: number;
    byTrigger: Record<RollbackTrigger, number>;
    byStrategy: Record<RollbackStrategy, number>;
    averageRecoveryTime: number;
    successRate: number;
  };
  
  /** 趋势分析 */
  trends: {
    /** 最近 30 天回滚频率 */
    frequencyTrend: 'increasing' | 'stable' | 'decreasing';
    /** 常见回滚原因 */
    topCauses: string[];
    /** 改进建议 */
    recommendations: string[];
  };
}

interface RollbackEntry {
  /** 回滚 ID */
  rollbackId: string;
  /** 对应的部署 */
  deploymentId: string;
  /** 触发时间 */
  timestamp: string;
  /** 触发原因 */
  trigger: RollbackTrigger;
  /** 使用的策略 */
  strategy: RollbackStrategy;
  /** 回滚范围 */
  scope: RollbackScope;
  /** 执行步骤日志 */
  steps: RollbackStep[];
  /** 结果 */
  result: 'success' | 'partial_success' | 'failed';
  /** 恢复时间（秒） */
  recoveryTime: number;
  /** 作者通知 */
  authorNotification: {
    sent: boolean;
    acknowledged: boolean;
    message: string;
  };
}

type RollbackTrigger =
  | 'error_rate_spike'
  | 'latency_increase'
  | 'health_check_failure'
  | 'deployment_timeout'
  | 'database_migration_failure'
  | 'author_requested'
  | 'critical_function_failure'
  | 'dependency_failure';

type RollbackStrategy =
  | 'code_rollback'
  | 'db_migration_down'
  | 'backup_restore'
  | 'feature_flag_disable'
  | 'partial_module_rollback'
  | 'compatibility_layer';

type RollbackScope = 'full' | 'partial';

interface RollbackStep {
  step: number;
  description: string;
  startTime: string;
  endTime?: string;
  status: 'in_progress' | 'completed' | 'failed';
  output?: string;
}
```

---

## 6. 作者审批界面（AuthorApprovalUI）

### 6.1 审批工作流

```
完整的审批工作流：

[开发智能体提交变更]
    |
    +---> 系统分类变更类型
    |         |
    |         +---> 叙事相关变更 ----+
    |         |                      |
    |         +---> 纯技术变更      |
    |                                |
    +---> [推送通知给作者]           |
    |         |                      |
    |         v                      |
    |   +-------------------+       |
    |   | 待审批队列          |       |
    |   | - 变更摘要          |       |
    |   | - 影响分析          |       |
    |   | - 代码 diff        |       |
    |   | - 测试报告          |       |
    |   +---------+---------+       |
    |             |                 |
    |             v                 |
    |   +-------------------+       |
    |   | 作者审查变更        |       |
    |   | - 查看详细信息      |       |
    |   | - 要求解释/修改     |       |
    |   +---------+---------+       |
    |             |                 |
    |      +------+------+          |
    |      |      |      |          |
    |      v      v      v          v
    |   [批准] [拒绝] [修改]    [自动部署通道]
    |      |      |      |          |
    |      v      v      v          v
    |   部署   退回   标记待      审查+测试通过
    |   队列   修改   修改          |
    |                              |
    |   部署完成后通知作者          部署完成后通知作者
    |   可在历史查看               可在历史查看

作者可选操作：
1. 批准 (Approve)      -> 变更进入部署队列
2. 拒绝 (Reject)       -> 变更退回，附拒绝原因
3. 要求修改 (Request Changes) -> 退回给开发智能体，附修改建议
4. 延迟处理 (Snooze)   -> 暂不做决定，设定提醒时间
5. 批量审批 (Batch)    -> 选择多个相关变更一并处理
```

### 6.2 变更展示格式

#### 6.2.1 变更摘要（一句话描述）

```typescript
interface ChangeSummary {
  /** 变更 ID */
  changeId: string;
  /** 一句话描述 */
  oneLineSummary: string;
  /** 提交的智能体 */
  submittedBy: string;
  /** 提交时间 */
  submittedAt: string;
  /** 变更类型 */
  type: 'narrative' | 'technical';
  /** 紧急程度 */
  urgency: 'low' | 'medium' | 'high' | 'critical';
  /** 变更类别 */
  category: 'world_rule' | 'character' | 'prompt' | 'bugfix' | 'performance' | 'security' | 'refactor';
  /** 代码审查结果 */
  reviewStatus: 'passed' | 'warning' | 'failed';
  /** 测试通过率 */
  testPassRate: number;
}

// 示例
const exampleSummary: ChangeSummary = {
  changeId: 'CHG-2025-0847',
  oneLineSummary: '修复世界引擎 CSP 求解器在并发约束下的死锁问题',
  submittedBy: 'WorldEngineAgent',
  submittedAt: '2025-01-15T10:30:00Z',
  type: 'technical',
  urgency: 'high',
  category: 'bugfix',
  reviewStatus: 'passed',
  testPassRate: 96.5
};
```

#### 6.2.2 影响分析

```typescript
interface ImpactAnalysis {
  /** 受影响的模块 */
  affectedModules: {
    name: string;
    impact: 'direct' | 'indirect';
    /** 影响描述 */
    description: string;
  }[];
  
  /** 是否有叙事影响 */
  hasNarrativeImpact: boolean;
  narrativeImpact?: {
    /** 影响的世界规则 */
    worldRulesAffected: string[];
    /** 影响的角色 */
    charactersAffected: string[];
    /** 影响的 Prompt */
    promptsAffected: string[];
    /** 影响程度 */
    severity: 'cosmetic' | 'minor' | 'major' | 'critical';
    /** 详细说明 */
    description: string;
  };
  
  /** 数据库变更 */
  databaseChanges: {
    hasSchemaChange: boolean;
    hasMigration: boolean;
    migrationDetails?: string;
    rollbackAvailable: boolean;
  };
  
  /** API 兼容性 */
  apiCompatibility: {
    breakingChanges: string[];
    deprecatedItems: string[];
    newEndpoints: string[];
  };
}
```

#### 6.2.3 代码 Diff 展示

```typescript
interface CodeDiffView {
  /** 变更文件列表 */
  files: DiffFile[];
  
  /** 统计信息 */
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
    /** 代码审查注释数 */
    reviewComments: number;
  };
  
  /** 展示选项 */
  viewOptions: {
    syntaxHighlighting: true;      // 语法高亮
    inlineComments: true;          // 行内审查注释
    wordDiff: true;                // 单词级差异
    hideWhitespace: boolean;       // 忽略空白差异
    collapsedFiles: string[];      // 默认折叠的文件
  };
}

interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  language: string;                 // 用于语法高亮
  hunks: DiffHunk[];
  /** 审查注释 */
  reviewComments: ReviewComment[];
}

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

interface DiffLine {
  type: 'context' | 'addition' | 'deletion';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface ReviewComment {
  line: number;
  author: string;
  body: string;
  severity: 'info' | 'warning' | 'blocking';
}
```

#### 6.2.4 测试结果展示

```typescript
interface TestResultView {
  /** 总体结果 */
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
  };
  
  /** 代码覆盖率 */
  coverage: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
  
  /** 各套件结果 */
  suites: TestSuiteResult[];
  
  /** 失败的测试（需要突出显示） */
  failures: TestFailure[];
  
  /** 性能基准 */
  performance: {
    benchmarkName: string;
    currentValue: number;
    baselineValue: number;
    change: number; // 百分比变化
  }[];
}
```

#### 6.2.5 风险评估

```typescript
interface RiskAssessment {
  /** 总体风险等级 */
  overall: 'low' | 'medium' | 'high' | 'critical';
  
  /** 回归风险 */
  regression: {
    level: 'low' | 'medium' | 'high';
    /** 可能受影响的已有功能 */
    affectedAreas: string[];
    /** 风险描述 */
    description: string;
    /** 缓解措施 */
    mitigation: string[];
  };
  
  /** 兼容性风险 */
  compatibility: {
    level: 'low' | 'medium' | 'high';
    /** 向前兼容性 */
    forwardCompatible: boolean;
    /** 向后兼容性 */
    backwardCompatible: boolean;
    /** 不兼容点 */
    incompatibilities: string[];
  };
  
  /** 部署风险 */
  deployment: {
    level: 'low' | 'medium' | 'high';
    /** 是否需要停机 */
    requiresDowntime: boolean;
    /** 预计停机时间 */
    estimatedDowntime?: number; // 秒
    /** 回滚复杂度 */
    rollbackComplexity: 'simple' | 'moderate' | 'complex';
  };
  
  /** 建议 */
  recommendations: string[];
}
```

### 6.3 批量审批

```typescript
interface BatchApproval {
  /** 批量选择 */
  selection: {
    /** 按标签筛选 */
    filterByTags: string[];
    /** 按智能体筛选 */
    filterByAgent: string[];
    /** 按类型筛选 */
    filterByType: ('narrative' | 'technical')[];
    /** 手动选择 */
    manualSelection: string[]; // changeIds
  };
  
  /** 批量操作 */
  operations: {
    /** 批量批准 */
    approve: {
      available: boolean;
      condition: 'all_passed_review';
    };
    /** 批量拒绝 */
    reject: {
      available: boolean;
      requiresReason: true;
    };
    /** 批量延迟 */
    snooze: {
      available: boolean;
      snoozeDuration: string; // ISO 8601 duration
    };
  };
  
  /** 冲突检测 */
  conflictDetection: {
    /** 检测选中的变更是否互相冲突 */
    enabled: true;
    /** 冲突解决建议 */
    resolutionHints: string[];
  };
}
```

### 6.4 审批历史记录

```typescript
interface ApprovalHistory {
  /** 历史记录条目 */
  entries: ApprovalHistoryEntry[];
  
  /** 统计 */
  statistics: {
    totalChanges: number;
    approved: number;
    rejected: number;
    modified: number;
    averageDecisionTime: number; // 平均决策时间（分钟）
    byAgent: Record<string, { submitted: number; approved: number; rejected: number }>;
  };
  
  /** 筛选 */
  filters: {
    byDate: DateRange;
    byAgent: string[];
    byType: ('narrative' | 'technical')[];
    byDecision: ('approved' | 'rejected' | 'modified')[];
  };
  
  /** 导出 */
  export: {
    formats: ['json', 'csv', 'pdf'];
  };
}

interface ApprovalHistoryEntry {
  changeId: string;
  timestamp: string;
  changeType: 'narrative' | 'technical';
  submittedBy: string;
  oneLineSummary: string;
  decision: 'approved' | 'rejected' | 'modified' | 'snoozed';
  decidedAt: string;
  /** 决策说明 */
  decisionNote?: string;
  /** 原始变更 */
  originalChange: ChangeSummary;
  /** 如果修改过，修改后的版本 */
  modifiedVersion?: ChangeSummary;
  /** 部署结果 */
  deploymentResult?: 'success' | 'failed' | 'rolled_back';
}
```

### 6.5 界面线框图描述

```
========================================================================
                    NarrativeOS - 变更审批中心
========================================================================

+------------------+------------------+------------------+------------+
| 待审批 (3)       | 已批准 (12)      | 已拒绝 (5)       | [设置 ⚙️]  |
+------------------+------------------+------------------+------------+

[筛选: 全部 ▼] [排序: 时间 ▼] [搜索...              ] [批量操作 ▼]

+--------------------------------------------------------------------+
| ⚠️  高优先级  | CHG-2025-0847  | WorldEngineAgent  | 10分钟前    |
|               | 修复世界引擎 CSP 求解器并发死锁问题                 |
|               | 类型: 技术修复  | 审查: 通过  | 测试: 96.5%        |
|               | [查看详情]  [批准]  [拒绝]  [要求修改]              |
+--------------------------------------------------------------------+
| 📝 叙事相关   | CHG-2025-0846  | PromptTuningAgent | 30分钟前    |
|               | 优化角色对话生成 Prompt，增加情感维度参数           |
|               | 类型: 叙事变更  | 审查: 警告  | 测试: 92.0%        |
|               | [查看详情]  [批准]  [拒绝]  [要求修改]              |
+--------------------------------------------------------------------+
| 🔧 技术修复   | CHG-2025-0845  | StudioEngineAgent | 1小时前     |
|               | 优化数据库连接池配置，减少空闲连接数                |
|               | 类型: 技术修复  | 审查: 通过  | 测试: 98.2%        |
|               | [查看详情]  [批准]  [拒绝]  [要求修改]              |
+--------------------------------------------------------------------+

========================================================================
                        变更详情面板（点击展开）
========================================================================

+--------------------------------------------------------------------+
| CHG-2025-0847  修复世界引擎 CSP 求解器并发死锁问题                  |
| 提交者: WorldEngineAgent  |  时间: 2025-01-15 10:30              |
| 类型: 🔧 技术修复  |  紧急: ⚠️ 高  |  状态: 待审批                |
+--------------------------------------------------------------------+
|                                                                      |
|  [📋 摘要]  [📊 影响分析]  [📑 代码Diff]  [🧪 测试]  [⚠️ 风险]      |
|                                                                      |
| +-- 📋 摘要 -------------------------------------------------------+|
| |                                                                   ||
| | 一句话描述：修复世界引擎 CSP 求解器在并发约束下的死锁问题          ||
| |                                                                   ||
| | 详细说明：                                                        ||
| | 在高并发场景下，CSP 求解器的约束锁机制存在竞态条件，导致           ||
| | 两个线程互相等待对方释放锁。本次修复使用有序加锁策略               ||
| | 确保锁的获取顺序一致，消除死锁可能性。                            ||
| |                                                                   ||
| | 相关 Issue: #DE-042                                               ||
| +-------------------------------------------------------------------+|
|                                                                      |
| +-- 📊 影响分析 ----------------------------------------------------+|
| |                                                                   ||
| | 直接影响模块：                                                    ||
| |   ✅ WorldEngine.CSPSolver (直接) - 核心修复目标                   ||
| |   ✅ WorldEngine.ConstraintLock (直接) - 新增有序锁管理            ||
| |   ⚠️  WorldEngine.ConcurrentExecutor (间接) - 调用方式微调         ||
| |                                                                   ||
| | 叙事影响: 无 - 本变更仅涉及内部算法优化                            ||
| | 数据库变更: 无 Schema 变更                                         ||
| | API 兼容性: 向后兼容，无破坏性变更                                  ||
| +-------------------------------------------------------------------+|
|                                                                      |
| +-- 📑 代码 Diff ----------------------------------------------------+|
| |                                                                   ||
| | src/world-engine/csp/solver.ts                                    ||
| | @@ -45,12 +45,18 @@                                             ||
| |    async acquireLocks(constraints: Constraint[]):                 ||
| | -    for (const c of constraints) {                               ||
| | -      await this.lockManager.acquire(c.id);                      ||
| | +    // 按 ID 排序后加锁，避免死锁                                 ||
| | +    const sorted = [...constraints].sort((a, b) =>               ||
| | +      a.id.localeCompare(b.id)                                   ||
| | +    );                                                           ||
| | +    for (const c of sorted) {                                    ||
| | +      await this.lockManager.acquire(c.id);                      ||
| |      }                                                            ||
| |                                                                   ||
| +-------------------------------------------------------------------+|
|                                                                      |
| +-- 🧪 测试结果 -----------------------------------------------------+|
| |                                                                   ||
| | 总计: 156  |  通过: 151  |  失败: 0  |  跳过: 5                  ||
| | 通过率: 96.8%  ✅ 超过阈值 (90%)                                  ||
| |                                                                   ||
| | 覆盖率: 行: 89%  分支: 85%  函数: 92%  语句: 88%                 ||
| |                                                                   ||
| | 性能基准:                                                         ||
| |   CSP 求解 (50变量):  当前 45ms  |  基线 120ms  |  -62.5% ⚡    ||
| +-------------------------------------------------------------------+|
|                                                                      |
| +-- ⚠️ 风险评估 -----------------------------------------------------+|
| |                                                                   ||
| | 总体风险: 🟢 低                                                   ||
| |                                                                   ||
| | 回归风险: 🟢 低 - 仅修改内部锁机制，不影响对外接口                  ||
| | 兼容性风险: 🟢 低 - 向后兼容                                       ||
| | 部署风险: 🟢 低 - 无需停机，可热更新                               ||
| | 回滚复杂度: 简单 - 单文件替换                                      ||
| +-------------------------------------------------------------------+|
|                                                                      |
| +-- 💬 作者决策区 ---------------------------------------------------+|
| |                                                                   ||
| | [✅ 批准并部署]  [❌ 拒绝并说明原因]  [📝 要求修改]               ||
| |                                                                   ||
| | 决策备注（可选）：                                                ||
| | +----------------------------------------------------------------+||
| | |                                                                 |||
| | +----------------------------------------------------------------+||
+--------------------------------------------------------------------+

========================================================================
                        批量审批界面
========================================================================

+--------------------------------------------------------------------+
| 批量操作 - 已选择 3 个变更                                          |
+--------------------------------------------------------------------+
|                                                                      |
| [✓] CHG-2025-0847 - CSP 死锁修复                                   |
| [✓] CHG-2025-0845 - 连接池优化                                     |
| [✓] CHG-2025-0844 - 日志格式统一                                   |
|                                                                      |
| 冲突检测: ✅ 无冲突 - 这些变更互不影响                               |
| 综合通过率: 97.2%                                                   |
| 总体风险: 🟢 低                                                     |
|                                                                      |
| [✅ 批量批准并部署]  [📅 批量延迟]  [❌ 批量拒绝]                   |
|                                                                      |
| 批量备注：                                                          |
| +----------------------------------------------------------------+|
| |                                                                 ||
| +----------------------------------------------------------------+|
+--------------------------------------------------------------------+
```

---

## 7. 部署流水线编排

### 7.1 完整流水线定义

```yaml
pipeline:
  name: "NarrativeOS 部署流水线"
  version: "3.0.0"
  
  stages:
    # ---- Stage 1: 变更分类 ----
    - name: change_classification
      description: "将变更分类为叙事相关或纯技术"
      type: automatic
      timeout: 30s
      failure_action: block
      steps:
        - analyze_changed_files
        - classify_change_type
        - set_approval_requirement
      
    # ---- Stage 2: 代码审查 ----
    - name: code_review
      description: "自动代码审查（24项检查）"
      type: automatic
      timeout: 5m
      failure_action: return_to_developer
      parallel:
        max_concurrency: 4
      steps:
        - type_safety_check      # CR-A01, CR-A02
        - error_handling_check   # CR-B01, CR-B02
        - resource_leak_check    # CR-C01, CR-C02, CR-C03
        - concurrency_check      # CR-D01, CR-D02
        - test_coverage_check    # CR-E01, CR-E02
        - code_style_check       # CR-F01, CR-F02
        - axiom_compliance_check # CR-G01, CR-G02, CR-G03
        - architecture_check     # CR-H01, CR-H02
        - interface_compat_check # CR-I01, CR-I02
        - performance_check      # CR-J01, CR-J02
        - security_check         # CR-K01, CR-K02
        - logging_config_check   # CR-L01, CR-L02
      output: review_report
      
    # ---- Stage 3: 自动修复 ----
    - name: auto_fix
      description: "应用可自动修复的问题"
      type: automatic
      timeout: 2m
      condition: "review.has_auto_fixable_issues"
      steps:
        - apply_prettier_format
        - apply_eslint_fixes
      failure_action: skip_and_continue
      
    # ---- Stage 4: 单元测试 ----
    - name: unit_tests
      description: "执行单元测试套件"
      type: automatic
      timeout: 10m
      failure_action: return_to_developer
      parallel:
        max_concurrency: 8
      steps:
        - run_unit_tests
        - generate_coverage_report
      condition:
        coverage_threshold:
          lines: 80
          branches: 70
          functions: 80
      
    # ---- Stage 5: 集成测试 ----
    - name: integration_tests
      description: "执行集成测试套件（使用 TestContainers）"
      type: automatic
      timeout: 20m
      failure_action: return_to_developer
      environment:
        database: testcontainers
        llm: mock_service
      steps:
        - start_test_environment
        - run_mou_flow_tests        # MOU-001 ~ MOU-009
        - run_world_engine_tests    # WE-001 ~ WE-010
        - run_studio_engine_tests   # SE-001 ~ SE-008
        - run_database_tests        # DB-001 ~ DB-005
        - run_llm_fallback_tests    # LLM-001 ~ LLM-005
        - run_performance_benchmarks
      output: integration_test_report
      
    # ---- Stage 6: 作者审批（条件执行）----
    - name: author_approval
      description: "叙事相关变更需作者审批"
      type: manual
      timeout: 7d                # 7 天超时
      condition: "change.type == 'narrative'"
      failure_action: 
        timeout: cancel_change
        rejection: return_to_developer
      notifications:
        - type: system_tray
          message: "NarrativeOS: 有待审批的叙事变更"
        - type: email
          condition: "urgency >= high"
      
    # ---- Stage 7: 预部署检查 ----
    - name: pre_deploy_check
      description: "部署前环境检查"
      type: automatic
      timeout: 5m
      failure_action: block_and_alert
      steps:
        - check_disk_space        # >= 1GB
        - check_database_health
        - check_backup_status
        - verify_migration_scripts
        - record_rollback_point
      
    # ---- Stage 8: 数据库迁移 ----
    - name: db_migration
      description: "执行数据库迁移"
      type: automatic
      timeout: 10m
      failure_action: rollback_and_block
      steps:
        - backup_current_db
        - run_migration_scripts
        - verify_migration_applied
        - validate_schema_integrity
      
    # ---- Stage 9: 渐进部署 ----
    - name: gradual_deploy
      description: "渐进式代码部署"
      type: automatic
      timeout: 60m
      failure_action: auto_rollback
      strategy:
        type: canary             # 金丝雀部署
        stages:
          - traffic: 1%
            duration: 5m
            health_check_interval: 30s
          - traffic: 10%
            duration: 10m
            health_check_interval: 30s
          - traffic: 50%
            duration: 15m
            health_check_interval: 60s
          - traffic: 100%
            duration: 0
            health_check_interval: 60s
      steps:
        - deploy_to_canary
        - health_check
        - monitor_metrics
        - progressive_rollout
      
    # ---- Stage 10: 部署后监控 ----
    - name: post_deploy_monitoring
      description: "部署后持续监控"
      type: automatic
      timeout: 30m
      failure_action: auto_rollback
      steps:
        - monitor_error_rate       # < 1%
        - monitor_latency          # P95 < 500ms
        - monitor_memory_usage     # < 80%
        - monitor_author_actions   # 作者操作是否正常
        - verify_critical_functions
      
    # ---- Stage 11: 完成 ----
    - name: completion
      description: "部署完成确认"
      type: automatic
      timeout: 2m
      steps:
        - cleanup_old_version
        - record_deployment_history
        - notify_completion
      output: deployment_complete_notification

  # 全局配置
  global:
    # 重试策略
    retry:
      max_attempts: 3
      backoff: exponential
      initial_delay: 5s
      
    # 并行执行规则
    parallelism:
      # Stage 2-5 可以并行执行（不同变更之间）
      across_changes: true
      # 每个 Stage 内部的最大并行度
      within_stage: 4
      
    # 通知配置
    notifications:
      success: author
      failure: author + developer
      approval_needed: author
      
    # 清理策略
    cleanup:
      # 保留最近 10 次部署的旧版本
      keep_old_versions: 10
      # 保留最近 30 天的部署日志
      log_retention: 30d
```

### 7.2 流水线状态机

```
                     +------------+
                     |   queued   |
                     +-----+------+
                           |
                           v
                  +--------+--------+
                  | change_classify |
                  +--------+--------+
                           |
              +------------+------------+
              |                         |
              v                         v
      +-------+-------+         +-------+-------+
      |  narrative    |         |  technical    |
      |  (needs auth) |         |  (auto deploy)|
      +-------+-------+         +-------+-------+
              |                         |
              v                         v
      +-------+-------+         +-------+-------+
      | code_review   |         | code_review   |
      +-------+-------+         +-------+-------+
              |                         |
              v                         v
      +-------+-------+         +-------+-------+
      | auto_fix      |         | auto_fix      |
      +-------+-------+         +-------+-------+
              |                         |
              v                         v
      +-------+-------+         +-------+-------+
      | unit_tests    |         | unit_tests    |
      +-------+-------+         +-------+-------+
              |                         |
              v                         v
      +-------+-------+         +-------+-------+
      | integration   |         | integration   |
      | _tests        |         | _tests        |
      +-------+-------+         +-------+-------+
              |                         |
              v                         |
      +-------+-------+                 |
      | author_approval |               |
      |   (manual)      |               |
      +-------+-------+                 |
              |                         |
              v                         v
      +-------+-----------------+-------+-------+
      |       pre_deploy_check  |       |
      +-------+-----------------+-------+
              |
              v
      +-------+-------+
      | db_migration  |
      +-------+-------+
              |
              v
      +-------+-------+
      | gradual_deploy|
      +-------+-------+
              |
              v
      +-------+-------+
      | post_deploy   |
      | _monitoring   |
      +-------+-------+
              |
      +-------+-------+
      |       |       |
      v       v       v
  +-------+ +------+ +-------+
  |success| |rolled| |failure|
  |       | |_back  | |       |
  +-------+ +------+ +-------+

状态转换规则：
- 任何自动阶段失败 -> 按 failure_action 处理
- author_approval 超时 (7天) -> cancel_change
- author_approval 拒绝 -> return_to_developer
- gradual_deploy 阶段 -> 按金丝雀策略自动推进
- post_deploy_monitoring 失败 -> auto_rollback -> rolled_back
```

### 7.3 每个阶段的超时和失败处理

| 阶段 | 超时 | 失败处理 | 重试策略 | 通知对象 |
|------|------|----------|----------|----------|
| 变更分类 | 30s | 阻断部署 | 3次，指数退避 | 开发者 |
| 代码审查 | 5m | 退回开发者 | 不适用 | 开发者 |
| 自动修复 | 2m | 跳过继续 | 不适用 | - |
| 单元测试 | 10m | 退回开发者 | 1次（可能临时故障） | 开发者 |
| 集成测试 | 20m | 退回开发者 | 1次（容器启动可能慢） | 开发者 |
| 作者审批 | 7天 | 超时取消 | 不适用 | 作者 |
| 预部署检查 | 5m | 阻断部署 | 2次 | 开发者+作者 |
| 数据库迁移 | 10m | 回滚并阻断 | 不适用 | 开发者+作者 |
| 渐进部署 | 60m | 自动回滚 | 不适用 | 开发者+作者 |
| 部署后监控 | 30m | 自动回滚 | 不适用 | 开发者+作者 |
| 完成 | 2m | 记录警告 | 不适用 | 作者 |

### 7.4 并行与串行编排

```yaml
# 串行阶段（必须顺序执行）
serial_stages:
  - change_classification    # 必须先分类
  - code_review              # 审查后才能知道是否需要修复
  - auto_fix                 # 修复后重新审查
  - author_approval          # 必须在部署前获得审批
  - pre_deploy_check         # 部署前检查
  - db_migration             # 代码部署前先迁移数据库
  - gradual_deploy           # 必须先完成迁移
  - post_deploy_monitoring   # 部署后监控
  - completion               # 最后完成

# 可并行阶段
can_parallel:
  within_code_review:
    - type_safety_check
    - error_handling_check
    - resource_leak_check
    - concurrency_check
    - test_coverage_check
    - code_style_check
    - axiom_compliance_check
    - architecture_check
    - interface_compat_check
    - performance_check
    - security_check
    - logging_config_check
  
  within_integration_tests:
    - mou_flow_tests
    - world_engine_tests
    - studio_engine_tests
    - database_tests
    - llm_fallback_tests
  
  across_changes:             # 多个变更可同时通过流水线
    max_parallel_changes: 5   # 最多 5 个变更并行
```

### 7.5 流水线状态追踪

```typescript
interface PipelineOrchestrator {
  /** 当前运行中的流水线 */
  activePipelines: PipelineInstance[];
  
  /** 历史流水线 */
  pipelineHistory: PipelineInstance[];
  
  /** 流水线统计 */
  statistics: {
    totalRuns: number;
    successRate: number;
    averageDuration: number;
    byStage: Record<string, { 
      avgDuration: number; 
      failureRate: number;
      bottleneck: boolean;
    }>;
  };
  
  /** 可视化数据 */
  visualization: {
    /** 流水线 DAG 图 */
    dagGraph: PipelineDAG;
    /** 实时状态仪表盘 */
    dashboard: PipelineDashboard;
    /** 阶段耗时热力图 */
    stageHeatmap: StageHeatmapData;
  };
}

interface PipelineInstance {
  instanceId: string;
  changeId: string;
  status: PipelineStatus;
  currentStage: string;
  stages: StageExecution[];
  startTime: string;
  estimatedEndTime?: string;
  actualEndTime?: string;
}

type PipelineStatus =
  | 'queued'
  | 'running'
  | 'waiting_for_approval'
  | 'succeeded'
  | 'failed'
  | 'rolled_back'
  | 'cancelled';

interface StageExecution {
  stageName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  duration?: number;
  logs: string[];
  metrics?: Record<string, number>;
}
```

---

## 8. TypeScript 接口定义

### 8.1 核心接口汇总

```typescript
// ============================================================================
// 验证与部署系统 - TypeScript 接口定义
// ============================================================================

// ---- 变更定义 ----

/** 变更类型 */
export type ChangeType = 'narrative' | 'technical';

/** 叙事变更子类型 */
export type NarrativeSubType = 
  | 'world_rule' 
  | 'character' 
  | 'prompt' 
  | 'plot' 
  | 'setting';

/** 技术变更子类型 */
export type TechnicalSubType = 
  | 'bugfix' 
  | 'performance' 
  | 'security' 
  | 'refactor' 
  | 'dependency';

/** 变更紧急程度 */
export type Urgency = 'low' | 'medium' | 'high' | 'critical';

/** 变更状态 */
export type ChangeStatus = 
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'needs_fix'
  | 'approved'
  | 'rejected'
  | 'in_deployment'
  | 'deployed'
  | 'rolled_back';

/** 变更实体 */
export interface Change {
  id: string;
  type: ChangeType;
  subType: NarrativeSubType | TechnicalSubType;
  urgency: Urgency;
  status: ChangeStatus;
  title: string;
  description: string;
  author: string;           // 提交的智能体
  filesChanged: string[];
  createdAt: Date;
  updatedAt: Date;
  reviewReport?: ReviewReport;
  testReport?: TestReport;
  approvalRecord?: ApprovalRecord;
  deploymentRecord?: DeploymentRecord;
}

// ---- 审查报告 ----

export interface ReviewReport {
  reviewId: string;
  changeId: string;
  timestamp: Date;
  status: 'passed' | 'failed' | 'warning';
  score: number;
  passed: ReviewCheckItem[];
  warnings: ReviewCheckItem[];
  failures: ReviewCheckItem[];
  infos: ReviewCheckItem[];
  autoFixAvailable: boolean;
  autoFixResults?: AutoFixResult[];
  verdict: ReviewVerdict;
  recommendedAction: ReviewAction;
  requiresHumanReview: boolean;
  humanReviewReason?: string;
}

export interface ReviewCheckItem {
  checkId: string;
  category: string;
  description: string;
  severity: 'blocking' | 'warning' | 'info';
  result: 'pass' | 'fail' | 'warn';
  locations: CodeLocation[];
  suggestion?: string;
  docsLink?: string;
}

export interface CodeLocation {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet?: string;
}

export interface AutoFixResult {
  checkId: string;
  fixed: boolean;
  description: string;
  modifiedFiles: string[];
  error?: string;
}

export type ReviewVerdict = 
  | 'auto_approved'
  | 'approved_with_warnings'
  | 'needs_human_review'
  | 'rejected';

export type ReviewAction =
  | 'proceed_to_test'
  | 'apply_auto_fix'
  | 'request_human_review'
  | 'return_to_developer';

// ---- 测试报告 ----

export interface TestReport {
  reportId: string;
  changeId: string;
  timestamp: Date;
  summary: TestSummary;
  coverage: CoverageReport;
  suites: TestSuiteResult[];
  failures: TestFailure[];
  performance: PerformanceBenchmark[];
  status: 'passed' | 'failed';
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
}

export interface CoverageReport {
  lines: number;
  branches: number;
  functions: number;
  statements: number;
}

export interface TestSuiteResult {
  name: string;
  total: number;
  passed: number;
  failed: number;
  duration: number;
}

export interface TestFailure {
  testName: string;
  suiteName: string;
  error: string;
  stack?: string;
}

export interface PerformanceBenchmark {
  name: string;
  currentValue: number;
  baselineValue: number;
  change: number;
  unit: string;
}

// ---- 审批记录 ----

export interface ApprovalRecord {
  recordId: string;
  changeId: string;
  status: ApprovalStatus;
  submittedAt: Date;
  decidedAt?: Date;
  decision?: ApprovalDecision;
  decisionNote?: string;
  reviewedBy: string;
}

export type ApprovalStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'snoozed';

export type ApprovalDecision = 'approve' | 'reject' | 'request_changes' | 'snooze';

// ---- 部署记录 ----

export interface DeploymentRecord {
  deploymentId: string;
  changeId: string;
  version: {
    from: string;
    to: string;
  };
  strategy: DeploymentStrategy;
  status: DeploymentStatus;
  timeline: DeploymentPhase[];
  startTime: Date;
  endTime?: Date;
  triggeredBy: 'automatic' | 'author';
}

export type DeploymentStrategy = 
  | 'canary' 
  | 'blue_green' 
  | 'feature_flag';

export type DeploymentStatus = 
  | 'pending'
  | 'in_progress'
  | 'succeeded'
  | 'failed'
  | 'rolled_back';

export interface DeploymentPhase {
  phase: string;
  startTime: Date;
  endTime?: Date;
  status: 'in_progress' | 'completed' | 'failed' | 'skipped';
  details: Record<string, unknown>;
}

// ---- 回滚记录 ----

export interface RollbackRecord {
  rollbackId: string;
  deploymentId: string;
  trigger: RollbackTrigger;
  strategy: RollbackStrategy;
  scope: RollbackScope;
  status: 'in_progress' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  recoveryTime?: number;
}

export type RollbackTrigger =
  | 'error_rate_spike'
  | 'latency_increase'
  | 'health_check_failure'
  | 'author_requested'
  | 'critical_function_failure';

export type RollbackStrategy =
  | 'code_rollback'
  | 'db_migration_down'
  | 'backup_restore'
  | 'feature_flag_disable'
  | 'partial_module_rollback';

export type RollbackScope = 'full' | 'partial';

// ---- 功能开关 ----

export interface FeatureFlag {
  name: string;
  description: string;
  category: 'narrative' | 'technical';
  defaultValue: boolean;
  currentValue: boolean;
  authorControllable: boolean;
  dependencies: string[];
  relatedChanges: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ---- 流水线 ----

export interface PipelineDefinition {
  id: string;
  name: string;
  version: string;
  stages: PipelineStage[];
  globalConfig: PipelineGlobalConfig;
}

export interface PipelineStage {
  name: string;
  description: string;
  type: 'automatic' | 'manual';
  timeout: number; // 秒
  condition?: string;
  failureAction: string;
  steps: PipelineStep[];
}

export interface PipelineStep {
  name: string;
  command: string;
  retries: number;
}

export interface PipelineGlobalConfig {
  retry: {
    maxAttempts: number;
    backoff: 'fixed' | 'linear' | 'exponential';
  };
  parallelism: {
    maxConcurrency: number;
    acrossChanges: boolean;
  };
  notifications: NotificationConfig;
}

export interface NotificationConfig {
  success: string[];
  failure: string[];
  approvalNeeded: string[];
}

// ---- 服务接口 ----

/** 代码审查器服务接口 */
export interface ICodeReviewer {
  review(change: Change): Promise<ReviewReport>;
  applyAutoFix(report: ReviewReport): Promise<AutoFixResult[]>;
  getCheckList(): Promise<ReviewCheckItem[]>;
}

/** 集成测试器服务接口 */
export interface IIntegrationTester {
  runTests(change: Change, environment: TestEnvironment): Promise<TestReport>;
  setupEnvironment(config: TestEnvironmentConfig): Promise<TestEnvironment>;
  teardownEnvironment(env: TestEnvironment): Promise<void>;
}

/** 渐进部署器服务接口 */
export interface IGradualDeployer {
  deploy(change: Change, strategy: DeploymentStrategy): Promise<DeploymentRecord>;
  getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus>;
  cancelDeployment(deploymentId: string): Promise<void>;
}

/** 回滚保护器服务接口 */
export interface IRollbackGuardian {
  rollback(deploymentId: string, trigger: RollbackTrigger): Promise<RollbackRecord>;
  verifyRollback(rollbackId: string): Promise<boolean>;
  getRollbackHistory(): Promise<RollbackRecord[]>;
}

/** 审批界面服务接口 */
export interface IAuthorApprovalUI {
  getPendingApprovals(): Promise<Change[]>;
  getChangeDetails(changeId: string): Promise<ChangeDetailView>;
  approve(changeId: string, note?: string): Promise<ApprovalRecord>;
  reject(changeId: string, reason: string): Promise<ApprovalRecord>;
  requestChanges(changeId: string, feedback: string): Promise<ApprovalRecord>;
  snooze(changeId: string, duration: string): Promise<ApprovalRecord>;
  getApprovalHistory(): Promise<ApprovalRecord[]>;
}

/** 流水线编排器服务接口 */
export interface IPipelineOrchestrator {
  startPipeline(change: Change): Promise<string>; // 返回 pipeline instance ID
  getPipelineStatus(instanceId: string): Promise<PipelineInstance>;
  cancelPipeline(instanceId: string): Promise<void>;
  retryStage(instanceId: string, stageName: string): Promise<void>;
  getPipelineHistory(): Promise<PipelineInstance[]>;
}

// ---- 视图模型 ----

export interface ChangeDetailView {
  summary: ChangeSummary;
  impact: ImpactAnalysis;
  diff: CodeDiffView;
  tests: TestResultView;
  risk: RiskAssessment;
}

export interface ChangeSummary {
  changeId: string;
  oneLineSummary: string;
  submittedBy: string;
  submittedAt: Date;
  type: ChangeType;
  urgency: Urgency;
  category: string;
  reviewStatus: 'passed' | 'warning' | 'failed';
  testPassRate: number;
}

export interface ImpactAnalysis {
  affectedModules: { name: string; impact: 'direct' | 'indirect'; description: string }[];
  hasNarrativeImpact: boolean;
  narrativeImpact?: {
    worldRulesAffected: string[];
    charactersAffected: string[];
    promptsAffected: string[];
    severity: 'cosmetic' | 'minor' | 'major' | 'critical';
    description: string;
  };
  databaseChanges: {
    hasSchemaChange: boolean;
    hasMigration: boolean;
    rollbackAvailable: boolean;
  };
  apiCompatibility: {
    breakingChanges: string[];
    deprecatedItems: string[];
    newEndpoints: string[];
  };
}

export interface CodeDiffView {
  files: DiffFile[];
  stats: { filesChanged: number; insertions: number; deletions: number; reviewComments: number };
}

export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  language: string;
  hunks: DiffHunk[];
  reviewComments: ReviewComment[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'context' | 'addition' | 'deletion';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface ReviewComment {
  line: number;
  author: string;
  body: string;
  severity: 'info' | 'warning' | 'blocking';
}

export interface TestResultView {
  summary: { total: number; passed: number; failed: number; skipped: number; passRate: number };
  coverage: { lines: number; branches: number; functions: number; statements: number };
  suites: TestSuiteResult[];
  failures: TestFailure[];
  performance: PerformanceBenchmark[];
}

export interface RiskAssessment {
  overall: 'low' | 'medium' | 'high' | 'critical';
  regression: {
    level: 'low' | 'medium' | 'high';
    affectedAreas: string[];
    description: string;
    mitigation: string[];
  };
  compatibility: {
    level: 'low' | 'medium' | 'high';
    forwardCompatible: boolean;
    backwardCompatible: boolean;
    incompatibilities: string[];
  };
  deployment: {
    level: 'low' | 'medium' | 'high';
    requiresDowntime: boolean;
    estimatedDowntime?: number;
    rollbackComplexity: 'simple' | 'moderate' | 'complex';
  };
  recommendations: string[];
}

// ---- 测试环境 ----

export interface TestEnvironment {
  id: string;
  database: {
    containerId: string;
    connectionString: string;
    host: string;
    port: number;
  };
  mockLLM: {
    endpoint: string;
    port: number;
  };
  dataFactory: {
    seed: number;
  };
}

export interface TestEnvironmentConfig {
  databaseImage: string;
  initScripts: string[];
  extensions: string[];
  fixedSeed: boolean;
  seedValue: number;
  isolation: 'transaction' | 'database_per_test' | 'schema_per_test';
  cleanup: 'always' | 'on_success' | 'never';
}

// ---- 流水线实例 ----

export interface PipelineInstance {
  instanceId: string;
  changeId: string;
  status: PipelineStatus;
  currentStage: string;
  stages: StageExecution[];
  startTime: Date;
  estimatedEndTime?: Date;
  actualEndTime?: Date;
}

export type PipelineStatus =
  | 'queued'
  | 'running'
  | 'waiting_for_approval'
  | 'succeeded'
  | 'failed'
  | 'rolled_back'
  | 'cancelled';

export interface StageExecution {
  stageName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  logs: string[];
  metrics?: Record<string, number>;
}
```

---

## 9. 核心配置（YAML）

### 9.1 系统主配置

```yaml
# narrativeos-deployment.yaml
# NarrativeOS v3.0 验证与部署系统配置

system:
  name: NarrativeOS Validation & Deployment Layer
  version: 3.0.0
  environment: production  # development | staging | production

# ============================================================================
# 1. 代码审查器配置
# ============================================================================
code_reviewer:
  enabled: true
  
  # 审查清单配置
  checklist:
    # 类别 A: 类型安全
    type_safety:
      checks:
        - id: CR-A01
          name: any类型使用审查
          severity: blocking
          enabled: true
          max_any_usage: 0  # 不允许使用 any（除非有注释说明）
          
        - id: CR-A02
          name: 类型断言合理性
          severity: warning
          enabled: true
          ban_double_assertion: true  # 禁止双重断言
    
    # 类别 B: 错误处理
    error_handling:
      checks:
        - id: CR-B01
          name: 异步操作try-catch覆盖
          severity: blocking
          enabled: true
          require_try_catch_for:
            - async_await
            - promise_chain
            - event_handler
            
        - id: CR-B02
          name: 错误传播完整性
          severity: warning
          enabled: true
          ban_empty_catch: true
          require_error_codes: true
    
    # 类别 C: 资源管理
    resource_management:
      checks:
        - id: CR-C01
          name: 数据库连接释放
          severity: blocking
          enabled: true
          require_pool_release_in_finally: true
          
        - id: CR-C02
          name: 事件监听器清理
          severity: blocking
          enabled: true
          require_listener_cleanup: true
          
        - id: CR-C03
          name: 流资源释放
          severity: warning
          enabled: true
    
    # 类别 D: 并发安全
    concurrency:
      checks:
        - id: CR-D01
          name: 共享状态访问控制
          severity: blocking
          enabled: true
          ban_global_mutable_state: true
          
        - id: CR-D02
          name: 竞态条件检测
          severity: warning
          enabled: true
    
    # 类别 E: 测试覆盖
    test_coverage:
      checks:
        - id: CR-E01
          name: 新增代码测试覆盖
          severity: blocking
          enabled: true
          thresholds:
            lines: 80
            branches: 70
            
        - id: CR-E02
          name: 关键路径测试
          severity: blocking
          enabled: true
          require_state_machine_coverage: true
          require_llm_fallback_coverage: true
    
    # 类别 F: 代码风格
    code_style:
      checks:
        - id: CR-F01
          name: ESLint规则合规
          severity: warning
          enabled: true
          auto_fixable: true
          max_warnings: 5
          
        - id: CR-F02
          name: Prettier格式合规
          severity: info
          enabled: true
          auto_fixable: true
    
    # 类别 G: 第一公理合规
    axiom_compliance:
      checks:
        - id: CR-G01
          name: 越权自动决策检测
          severity: blocking
          enabled: true
          forbidden_patterns:
            - auto_modify_author_content
            - bypass_author_approval
            
        - id: CR-G02
          name: 叙事主权边界检查
          severity: blocking
          enabled: true
          
        - id: CR-G03
          name: LLM自主行为审查
          severity: blocking
          enabled: true
    
    # 类别 H: 架构一致性
    architecture:
      checks:
        - id: CR-H01
          name: 分层架构合规
          severity: blocking
          enabled: true
          layers:
            - domain
            - application
            - infrastructure
            - interface
            
        - id: CR-H02
          name: 依赖方向合规
          severity: blocking
          enabled: true
    
    # 类别 I: 接口兼容性
    interface_compatibility:
      checks:
        - id: CR-I01
          name: 公共接口破坏性变更
          severity: blocking
          enabled: true
          
        - id: CR-I02
          name: 数据库兼容性
          severity: blocking
          enabled: true
    
    # 类别 J: 性能影响
    performance:
      checks:
        - id: CR-J01
          name: N+1查询检测
          severity: blocking
          enabled: true
          
        - id: CR-J02
          name: 内存泄漏风险
          severity: warning
          enabled: true
    
    # 类别 K: 安全审查
    security:
      checks:
        - id: CR-K01
          name: 注入攻击防护
          severity: blocking
          enabled: true
          require_parameterized_queries: true
          
        - id: CR-K02
          name: 敏感信息泄露
          severity: blocking
          enabled: true
          secrets_patterns:
            - api_key
            - password
            - token
            - secret
    
    # 类别 L: 日志与配置
    logging_config:
      checks:
        - id: CR-L01
          name: 日志完整性
          severity: warning
          enabled: true
          
        - id: CR-L02
          name: 配置管理合规
          severity: warning
          enabled: true
          ban_hardcoded_values: true

  # 审查阈值配置
  thresholds:
    blocking_failures:
      max: 0
      action: reject
    
    warnings:
      green_zone: { max: 2, action: proceed }
      yellow_zone: { max: 5, action: human_review }
      red_zone: { min: 6, action: return_to_developer }
    
    score:
      excellent: 90
      acceptable: 75
      poor: 60

  # 自动修复配置
  auto_fix:
    enabled: true
    allowed_severities: [warning]
    allowed_categories: [CR-F]

  # 回退策略
  fallback:
    max_retry_attempts: 3
    on_repeated_failure: escalate_to_author

# ============================================================================
# 2. 集成测试器配置
# ============================================================================
integration_tester:
  enabled: true
  
  # 测试环境
  environment:
    database:
      type: testcontainers
      image: postgres:16-alpine
      extensions:
        - pgvector
        - pg_trgm
      resources:
        memory: 512MB
        cpus: 1.0
    
    mock_llm:
      enabled: true
      latency_simulation:
        enabled: true
        base_latency: 100
        jitter: 50
        slow_response_rate: 0.1
        slow_latency: 2000
      error_injection:
        enabled: true
        rate: 0.05
        types:
          - timeout
          - rate_limit
          - invalid_json
          - empty_response
          - model_unavailable
          - token_exceeded
    
    data_factory:
      fixed_seed: true
      seed_value: 42

  # 测试套件
  test_suites:
    mou_flow:
      enabled: true
      tests:
        - MOU-001  # 标准流程
        - MOU-002  # 拒绝路径
        - MOU-003  # 超时取消
        - MOU-004  # 撤回确认
        - MOU-005  # 并发冲突
        - MOU-006  # 依赖链
        - MOU-007  # 历史追溯
        - MOU-008  # 故障回滚
        - MOU-009  # LLM降级
    
    world_engine:
      enabled: true
      tests:
        - WE-001  # CSP简单约束
        - WE-002  # CSP不可解
        - WE-003  # CSP大规模
        - WE-004  # 涟漪传播单点
        - WE-005  # 涟漪传播边界
        - WE-006  # 涟漪传播循环
        - WE-007  # 大规模涟漪
        - WE-008  # 先例精确匹配
        - WE-009  # 先例模糊匹配
        - WE-010  # 向量检索
    
    studio_engine:
      enabled: true
      tests:
        - SE-001  # Prompt组装
        - SE-002  # Prompt长度控制
        - SE-003  # Prompt兼容性
        - SE-004  # 正文生成
        - SE-005  # 角色一致性
        - SE-006  # 世界规则遵守
        - SE-007  # 质量评分优秀
        - SE-008  # 低质量检测
    
    database:
      enabled: true
      tests:
        - DB-001  # 原子固化
        - DB-002  # 并发隔离
        - DB-003  # 死锁恢复
        - DB-004  # 向量操作原子性
        - DB-005  # 长事务超时
    
    llm_fallback:
      enabled: true
      tests:
        - LLM-001  # 主模型降级
        - LLM-002  # 缓存降级
        - LLM-003  # 优雅降级
        - LLM-004  # 自动恢复
        - LLM-005  # 质量保持

  # 通过标准
  pass_criteria:
    functional:
      all_tests_pass: true
      assertion_coverage: 95
    performance:
      api_response_p95: 500
      db_query_p95: 100
      llm_call_timeout: 10000
      concurrent_users: 10
      memory_usage: 536870912  # 512MB
    stability:
      soak_test_duration: 4h
      memory_growth_rate: 1048576  # 1MB/h
      error_rate: 0.001  # 0.1%
      recovery_time: 5

# ============================================================================
# 3. 渐进部署器配置
# ============================================================================
gradual_deployer:
  enabled: true
  
  # 部署策略
  strategies:
    canary:
      enabled: true
      default: true
      stages:
        - traffic: 1
          duration: 5m
          exit_criteria: error_rate < 1%
        - traffic: 10
          duration: 10m
          exit_criteria: error_rate < 0.5%
        - traffic: 50
          duration: 15m
          exit_criteria: p95_latency < 500ms
        - traffic: 100
          duration: 0
          exit_criteria: immediate
      auto_progress:
        enabled: true
        consecutive_checks: 3
        interval: 60s
    
    blue_green:
      enabled: true
      warmup_duration: 2m
      health_check_interval: 10s
      switch_timeout: 30s
    
    feature_flag:
      enabled: true

  # 功能开关注册表
  feature_flags:
    # 叙事相关开关
    enhanced_dialogue_generation:
      description: "增强对话生成（包含情感维度）"
      category: narrative
      default_value: false
      author_controllable: true
      dependencies: []
      
    dynamic_plot_branches:
      description: "动态剧情分支生成"
      category: narrative
      default_value: false
      author_controllable: true
      dependencies: []
    
    # 技术开关
    connection_pool_v2:
      description: "新版数据库连接池"
      category: technical
      default_value: false
      author_controllable: false
      dependencies: []
      
    query_cache:
      description: "查询结果缓存"
      category: technical
      default_value: false
      author_controllable: false
      dependencies: []

  # 部署阶段超时
  phase_timeouts:
    pre_check: 5m
    db_migration: 10m
    code_deploy: 5m
    health_check: 3m
    monitoring: 60m
    full_switch: 2m

  # 自动回滚触发条件
  auto_rollback_triggers:
    critical:
      - condition: health_check.failures >= 3
        action: immediate
      - condition: error_rate.percentage > 5
        window: 2m
        action: immediate
    warning:
      - condition: latency_p95.increase > 30%
        window: 5m
        action: alert_author
      - condition: error_rate.percentage > 1
        window: 5m
        action: alert_author

# ============================================================================
# 4. 回滚保护器配置
# ============================================================================
rollback_guardian:
  enabled: true
  
  # 回滚触发条件
  triggers:
    metrics:
      error_rate:
        critical: { threshold: 5.0, duration: 2m }
        warning: { threshold: 1.0, duration: 5m }
      latency:
        p95_increase_critical: 100
        p95_absolute_critical: 5000
      availability:
        consecutive_health_failures: 3
    author_initiated:
      enabled: true
      confirmation_required: true

  # 回滚机制
  mechanisms:
    code_rollback:
      enabled: true
      rto: 60s
      keep_old_versions: 10
    
    db_migration_down:
      enabled: true
      rto: 30s
      require_down_scripts: true
    
    backup_restore:
      enabled: true
      rto: 300s
      backup_before_migration: true
    
    feature_flag_disable:
      enabled: true
      rto: 5s

  # 数据安全
  data_safety:
    content_protection:
      - novels
      - chapters
      - world_settings
      - character_profiles
    write_protection_during_rollback: true
    backup_content_before_any_operation: true
    schema_backward_compatibility_required: true

# ============================================================================
# 5. 作者审批界面配置
# ============================================================================
author_approval_ui:
  enabled: true
  
  # 通知配置
  notifications:
    system_tray: true
    sound: true
    auto_refresh_interval: 30s
    urgent_notification:
      channels: [system_tray, sound]
      threshold: high

  # 审批超时
  timeouts:
    default_snooze: 24h
    max_pending: 7d
    reminder_interval: 24h

  # 展示选项
  display:
    diff_syntax_highlighting: true
    inline_review_comments: true
    word_level_diff: true
    default_tab: summary  # summary | diff | tests | risk
    code_font: 'JetBrains Mono'
    dark_mode: auto  # auto | dark | light

# ============================================================================
# 6. 流水线编排配置
# ============================================================================
pipeline_orchestrator:
  enabled: true
  
  # 流水线定义
  pipeline:
    stages:
      - name: change_classification
        timeout: 30s
        parallel: false
      - name: code_review
        timeout: 5m
        parallel: true
        max_concurrency: 4
      - name: auto_fix
        timeout: 2m
        condition: has_auto_fixable_issues
      - name: unit_tests
        timeout: 10m
        parallel: true
        max_concurrency: 8
      - name: integration_tests
        timeout: 20m
        parallel: true
        max_concurrency: 4
      - name: author_approval
        timeout: 7d
        type: manual
        condition: narrative_change
      - name: pre_deploy_check
        timeout: 5m
      - name: db_migration
        timeout: 10m
      - name: gradual_deploy
        timeout: 60m
      - name: post_deploy_monitoring
        timeout: 30m
      - name: completion
        timeout: 2m

  # 全局重试策略
  retry:
    max_attempts: 3
    backoff: exponential
    initial_delay: 5s

  # 并行配置
  parallelism:
    max_parallel_changes: 5
    across_changes: true

  # 日志保留
  log_retention: 30d
  history_retention: 90d

# ============================================================================
# 7. 监控与告警配置
# ============================================================================
monitoring:
  metrics:
    collection_interval: 15s
    retention: 30d
    
  alerting:
    channels:
      system_tray:
        enabled: true
      ui_notification:
        enabled: true
    
    rules:
      - name: deployment_failed
        severity: critical
        notify: [author, developer]
      - name: rollback_triggered
        severity: critical
        notify: [author]
      - name: approval_pending_timeout
        severity: warning
        condition: pending > 3d
        notify: [author]
      - name: high_error_rate
        severity: critical
        condition: error_rate > 5%
        notify: [author]
```

---

## 10. 第一公理合规声明

### 10.1 设计原则

本验证与部署系统的设计严格遵守 **NarrativeOS 第一公理**：**作者（人类）对叙事世界拥有最终主权**。

### 10.2 合规措施

| 公理要求 | 系统实现 |
|----------|----------|
| **叙事相关变更必须经作者审批** | 部署流水线的 `author_approval` 阶段强制阻塞叙事相关变更的自动部署；变更分类器（CR-G01 ~ CR-G03）自动检测可能越权的自动决策 |
| **纯技术修复可自动部署** | 技术变更走自动通道，但仍需通过完整的审查和测试；保留回滚能力 |
| **作者随时可查看和控制** | AuthorApprovalUI 提供完整的变更查看、审批、回滚功能；系统托盘通知实时推送 |
| **系统不越权自动决策** | 代码审查清单的 CR-G 类别专门检测越权行为；功能开关将控制权交给作者 |
| **回滚保护数据安全** | 创作数据永不回滚；数据库隔离保护作者内容；Schema 变更必须向后兼容 |

### 10.3 审计追踪

系统维护完整的审计日志：
- 所有审查决策记录
- 所有审批决策记录
- 所有部署操作记录
- 所有回滚操作记录
- 所有功能开关状态变更记录

### 10.4 紧急通道

即使自动部署的技术变更，作者始终拥有：
- **一键回滚按钮**：系统托盘右键菜单
- **紧急停止命令**：`narrativeos emergency-stop`
- **强制回滚命令**：`narrativeos rollback --to <version>`

---

## 附录

### A. 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 第一公理 | First Axiom | NarrativeOS 核心原则：作者对叙事世界拥有最终主权 |
| MOU | Memorandum of Understanding | 系统与作者之间的共识记录，用于协商世界规则变更 |
| CSP | Constraint Satisfaction Problem | 约束满足问题，世界引擎的核心算法 |
| 金丝雀部署 | Canary Deployment | 渐进式部署策略，逐步增加新版本流量 |
| 蓝绿部署 | Blue-Green Deployment | 保持两个环境，切换流量的部署策略 |
| 功能开关 | Feature Flag | 可独立控制每个功能启停的开关机制 |
| RTO | Recovery Time Objective | 恢复时间目标 |
| TestContainers | - | Docker 容器测试框架，用于测试环境隔离 |

### B. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v3.0.0-alpha | 2025-01 | 初始设计文档 |

### C. 参考文档

- NarrativeOS v3.0 系统架构文档
- NarrativeOS 第一公理规范
- TypeScript 5.x 编码规范
- PostgreSQL 16 最佳实践
- XState 状态机设计模式
