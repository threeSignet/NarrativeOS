> [!WARNING] **[DEPRECATED] 本文档已废弃 — 2026-05-20**
> 原 P9 DevAgent 集群（5 层架构）不再另建代码实现。Claude Code 直接担任开发维护角色（见 `CLAUDE.md` §"自动化开发维护角色"）。
> 本文档保留为参考档案，其中的设计理念（遥测、采样策略、上报格式）可作为未来需要时参考，但不做实现承诺。
>
> 原 NOTE（已过期）：文中 `mode.cockpit_to_dashboard` / `mode.dashboard_to_cockpit` / `mode.to_sleep_pod` 等指标基于旧"驾驶舱/仪表盘/休眠舱"三模式 UI，与新"司天监位面"信息架构不一致。

---

# DevAgent Cluster — 第一层：遥测与上报系统（Runtime Telemetry Layer）

> **文档版本**: v3.0-Sovereign-RC1  
> **设计目标**: 为 NarrativeOS v3.0 Sovereign 构建完整的运行时遥测基础设施，支撑 DevAgent Cluster 的自主进化能力  
> **核心约束**: 叙事裁决权永远在人类作者手中；所有变更须经作者审批；数据须脱敏  

---

## 目录

1. [系统架构总览](#1-系统架构总览)
2. [异常收集器（ErrorCollector）](#2-异常收集器errorcollector)
3. [性能指标采集器（MetricsCollector）](#3-性能指标采集器metricscollector)
4. [使用模式分析器（UsagePatternAnalyzer）](#4-使用模式分析器usagepatternanalyzer)
5. [需求挖掘器（NeedMiner）](#5-需求挖掘器needminer)
6. [上报管道设计](#6-上报管道设计)
7. [数据存储设计](#7-数据存储设计)
8. [TypeScript 核心类型定义汇总](#8-typescript-核心类型定义汇总)
9. [核心算法伪代码汇总](#9-核心算法伪代码汇总)

---

## 1. 系统架构总览

### 1.1 设计哲学

```
┌─────────────────────────────────────────────────────────────────────┐
│                     NarrativeOS v3.0 Sovereign                      │
│                         作者本地运行环境                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐ │
│  │ 世界引擎  │  │ 工作室引擎│  │  谏官系统 │  │   Flow Guardian     │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┬──────────┘ │
│       └─────────────┴─────────────┴───────────────────┘              │
│                         │                                           │
│              ┌──────────▼──────────┐                                │
│              │  XState 状态机层     │◄── 遥测探针注入点              │
│              └──────────┬──────────┘                                │
│                         │                                           │
│  ╔══════════════════════▼══════════════════════╗                    │
│  ║     Runtime Telemetry Layer (本设计)         ║                    │
│  ║  ┌─────────┐ ┌──────────┐ ┌──────────────┐ ║                    │
│  ║  │ Error   │ │ Metrics  │ │ UsagePattern │ ║                    │
│  ║  │Collector│ │Collector │ │  Analyzer    │ ║                    │
│  ║  └────┬────┘ └────┬─────┘ └──────┬───────┘ ║                    │
│  ║       └───────────┼──────────────┘        ║                    │
│  ║                   ▼                       ║                    │
│  ║  ┌─────────────────────────────────────┐  ║                    │
│  ║  │         NeedMiner (需求挖掘)         │  ║                    │
│  ║  └────────────────────┬────────────────┘  ║                    │
│  ║                       ▼                   ║                    │
│  ║  ┌─────────────────────────────────────┐  ║                    │
│  ║  │      上报管道 (Reporter Pipeline)    │  ║                    │
│  ║  │  实时通道 │ 批量通道 │ 离线通道       │  ║                    │
│  ║  └─────────────────────────────────────┘  ║                    │
│  ╚═══════════════════════════════════════════╝                    │
│                         │                                           │
│              ┌──────────▼──────────┐                                │
│              │   SQLite 本地缓存    │                                │
│              │   (脱敏 + 加密)      │                                │
│              └─────────────────────┘                                │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              作者控制面板（完全透明可控）                      │   │
│  │  • 查看所有待上报数据  • 开关各模块上报  • 手动触发上报       │   │
│  │  • 审批数据上报策略    • 查看已上报历史  • 紧急暂停所有上报   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心设计原则

| 原则 | 说明 |
|------|------|
| **零内容泄露** | 遥测数据绝不包含小说正文、角色对话、世界观设定等叙事内容 |
| **作者完全可控** | 所有上报项均可独立开关，作者可实时查看即将上报的内容 |
| **最小必要原则** | 仅采集诊断系统问题和优化体验所必需的数据 |
| **本地优先** | 所有原始数据先存本地SQLite，经作者确认后再上报 |
| **故障降级** | 遥测系统故障不影响 NarrativeOS 核心功能运行 |
| **隐私分级** | 数据按敏感度分级，高敏感数据不上报，仅本地保留 |

### 1.3 组件交互图

```
                    ┌────────────────────────────────────────┐
                    │         NarrativeOS 运行时              │
                    │  LLM调用 │ DB操作 │ 状态转换 │ 引擎运算  │
                    └─────────┬──────────┬─────────┬─────────┘
                              │          │         │
                    ┌─────────▼──────────▼─────────▼─────────┐
                    │          遥测探针 (Telemetry Probe)      │
                    │    统一拦截点：无侵入式 AOP 注入          │
                    │    • 异常拦截  • 计时环绕  • 行为钩子      │
                    └──────┬─────────────┬───────────┬────────┘
                           │             │           │
              ┌────────────▼──┐ ┌────────▼────┐ ┌───▼─────────────┐
              │ ErrorCollector│ │MetricsColl. │ │UsagePattern     │
              │               │ │             │ │    Analyzer      │
              │ • 分类        │ │ • 30+ 指标  │ │ • 行为追踪      │
              │ • 聚合        │ │ • 基线检测  │ │ • 摩擦点检测    │
              │ • 严重度评估  │ │ • 异常检测  │ │ • 习惯学习      │
              └──────┬────────┘ └──────┬──────┘ └──────┬──────────┘
                     └─────────────────┼───────────────┘
                                       ▼
                          ┌────────────────────────┐
                          │       NeedMiner        │
                          │  • 被动需求推导         │
                          │  • 主动需求发现         │
                          │  • 优先级排序           │
                          └───────────┬────────────┘
                                      ▼
                          ┌────────────────────────┐
                          │    Reporter Pipeline   │
                          │  实时 │ 批量 │ 离线     │
                          │  脱敏 │ 压缩 │ 签名     │
                          └───────────┬────────────┘
                                      ▼
                          ┌────────────────────────┐
                          │    SQLite 本地存储       │
                          │  加密缓存 / 分级保留      │
                          │  自动清理 / 作者审阅      │
                          └────────────────────────┘
```

---

## 2. 异常收集器（ErrorCollector）

### 2.1 异常分类体系（共 20 种异常类型）

#### 2.1.1 LLM 调用异常（LLM_ERR）

| 编码 | 异常类型 | 说明 | 典型触发场景 |
|------|----------|------|-------------|
| LLM-001 | LLM_TIMEOUT | LLM API 调用超时 | 网络波动、模型过载、生成长文本 |
| LLM-002 | LLM_QUOTA_EXHAUSTED | 配额耗尽 | 月度Token预算用完、API密钥失效 |
| LLM-003 | LLM_FORMAT_ERROR | 返回格式错误 | JSON解析失败、Schema不匹配、XML混乱 |
| LLM-004 | LLM_CONTENT_FILTER | 内容过滤触发 | 输出被安全过滤器拦截、输入被拒绝 |
| LLM-005 | LLM_MODEL_DEGRADATION | 模型输出质量骤降 | 逻辑混乱、格式崩溃、前后矛盾 |
| LLM-006 | LLM_RATE_LIMIT | 速率限制 | 短时间内调用过于频繁 |
| LLM-007 | LLM_CONNECTION_RESET | 连接重置 | TCP连接异常断开、代理问题 |

#### 2.1.2 数据库异常（DB_ERR）

| 编码 | 异常类型 | 说明 | 典型触发场景 |
|------|----------|------|-------------|
| DB-001 | DB_POOL_EXHAUSTED | 连接池耗尽 | 并发查询过多、连接未释放 |
| DB-002 | DB_DEADLOCK | 死锁 | 事务冲突、pgvector并发写入 |
| DB-003 | DB_SLOW_QUERY | 慢查询 | 缺少索引、大数据量检索、复杂JOIN |
| DB-004 | DB_VECTOR_INDEX_INVALID | pgvector索引失效 | ivfflat索引需要重建、维度不匹配 |
| DB-005 | DB_CONNECTION_LOST | 连接丢失 | PostgreSQL重启、网络中断 |
| DB-006 | DB_MIGRATION_FAILED | 迁移失败 | Schema升级冲突、数据类型不兼容 |

#### 2.1.3 状态机异常（STATE_ERR）

| 编码 | 异常类型 | 说明 | 典型触发场景 |
|------|----------|------|-------------|
| ST-001 | STATE_ILLEGAL_TRANSITION | 非法状态转换 | 当前状态下不允许的目标状态 |
| ST-002 | STATE_DEADLOCK | 状态死锁 | 两个MOU互相等待对方释放资源 |
| ST-003 | STATE_WAIT_TIMEOUT | 等待超时 | MOU在waiting状态超过最大等待时间 |
| ST-004 | STATE_ORACLE_TIMEOUT | Oracle未响应 | 神谕请求在约定时间内未返回 |
| ST-005 | STATE_GUARDIAN_REJECTION | Flow Guardian拦截 | 业务规则校验不通过 |

#### 2.1.4 引擎异常（ENGINE_ERR）

| 编码 | 异常类型 | 说明 | 典型触发场景 |
|------|----------|------|-------------|
| ENG-001 | ENG_WORLD_SIM_FAILURE | 世界引擎推演失败 | 因果链断裂、设定冲突无法调和 |
| ENG-002 | ENG_STUDIO_QUALITY_DROP | 工作室引擎质量骤降 | 生成章节可读性严重下降 |
| ENG-003 | ENG_CENSOR_FALSE_POSITIVE | 谏官误报 | 正常内容被误判为违规 |
| ENG-004 | ENG_CENSOR_FALSE_NEGATIVE | 谏官漏报 | 违规内容未被检测出来 |
| ENG-005 | ENG_ENSEMBLE_TIMEOUT | 集成模型超时 | 多个内核投票过程超时 |

#### 2.1.5 系统异常（SYS_ERR）

| 编码 | 异常类型 | 说明 | 典型触发场景 |
|------|----------|------|-------------|
| SYS-001 | SYS_MEMORY_LEAK | 内存泄漏 | Node.js堆内存持续增长不释放 |
| SYS-002 | SYS_DISK_FULL | 磁盘空间不足 | 日志膨胀、vector数据过大 |
| SYS-003 | SYS_EVENT_LOOP_LAG | 事件循环阻塞 | 同步操作阻塞、CPU密集型计算 |
| SYS-004 | SYS_HANDLE_LEAK | 句柄泄漏 | 文件描述符、网络连接未关闭 |
| SYS-005 | SYS_PROCESS_CRASH | 进程崩溃 | 未捕获异常导致主进程退出 |

### 2.2 异常上报数据结构（JSON Schema）

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://narrativeos.dev/schemas/telemetry-error-v1",
  "title": "NarrativeOS Telemetry Error Event",
  "type": "object",
  "required": ["eventId", "eventType", "timestamp", "severity", "category", "errorCode", "errorType", "source", "context"],
  "properties": {
    "eventId": {
      "type": "string",
      "description": "全局唯一事件ID (ULID格式)",
      "pattern": "^[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "eventType": {
      "type": "string",
      "const": "ERROR",
      "description": "事件类型标识"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 UTC 时间戳"
    },
    "severity": {
      "type": "string",
      "enum": ["P0", "P1", "P2", "P3", "P4"],
      "description": "严重程度等级"
    },
    "category": {
      "type": "string",
      "enum": ["LLM_ERR", "DB_ERR", "STATE_ERR", "ENGINE_ERR", "SYS_ERR"],
      "description": "异常大类"
    },
    "errorCode": {
      "type": "string",
      "description": "异常编码，如 'LLM-001'",
      "pattern": "^[A-Z]+-[0-9]{3}$"
    },
    "errorType": {
      "type": "string",
      "description": "异常类型枚举值"
    },
    "source": {
      "type": "object",
      "description": "异常来源信息",
      "required": ["component", "version"],
      "properties": {
        "component": {
          "type": "string",
          "description": "发生异常的组件名",
          "examples": ["WorldEngine", "StudioEngine", "Censor", "Oracle", "FlowGuardian"]
        },
        "version": {
          "type": "string",
          "description": "组件版本号"
        },
        "module": {
          "type": "string",
          "description": "模块/文件名（已脱敏）"
        },
        "function": {
          "type": "string",
          "description": "函数名（已脱敏）"
        }
      }
    },
    "context": {
      "type": "object",
      "description": "异常上下文（脱敏后）",
      "required": ["sessionId"],
      "properties": {
        "sessionId": {
          "type": "string",
          "description": "匿名化会话ID（SHA-256哈希）"
        },
        "mouState": {
          "type": "string",
          "enum": ["planning", "generating", "censoring", "waiting", "oracling", "approving", "executing", "failed", "completed", "idle"],
          "description": "异常发生时MOU所处状态"
        },
        "operationPhase": {
          "type": "string",
          "description": "操作阶段标识",
          "examples": ["chapter_generation", "world_simulation", "censor_check", "oracle_consult"]
        },
        "chapterNumber": {
          "type": "integer",
          "description": "当前章节序号（不暴露标题）"
        },
        "currentKernelType": {
          "type": "string",
          "enum": ["ACTION", "MYSTERY", "RELATIONSHIP", "HORROR", "NONE"],
          "description": "当前激活的内核类型"
        },
        "elapsedMs": {
          "type": "integer",
          "description": "异常发生前已耗费的毫秒数"
        }
      }
    },
    "details": {
      "type": "object",
      "description": "异常详细信息",
      "properties": {
        "message": {
          "type": "string",
          "description": "异常消息（已脱敏，不含正文内容）"
        },
        "stackHash": {
          "type": "string",
          "description": "堆栈轨迹的SHA-256哈希（用于聚合相同异常）"
        },
        "stackFrames": {
          "type": "array",
          "description": "脱敏后的堆栈帧列表",
          "items": {
            "type": "object",
            "properties": {
              "moduleHash": { "type": "string", "description": "模块名哈希" },
              "lineNumber": { "type": "integer" },
              "columnNumber": { "type": "integer" },
              "functionHash": { "type": "string", "description": "函数名哈希" }
            }
          }
        },
        "llmMeta": {
          "type": "object",
          "description": "LLM相关元数据（仅LLM_ERR）",
          "properties": {
            "modelId": { "type": "string", "description": "模型标识，如 'gpt-4o'" },
            "provider": { "type": "string", "enum": ["openai", "anthropic", "deepseek", "local"] },
            "requestTokens": { "type": "integer" },
            "responseTokens": { "type": "integer" },
            "latencyMs": { "type": "integer" },
            "retryCount": { "type": "integer", "description": "已重试次数" },
            "statusCode": { "type": "integer", "description": "HTTP状态码" }
          }
        },
        "dbMeta": {
          "type": "object",
          "description": "数据库相关元数据（仅DB_ERR）",
          "properties": {
            "queryHash": { "type": "string", "description": "SQL查询的SHA-256哈希" },
            "queryType": { "type": "string", "enum": ["SELECT", "INSERT", "UPDATE", "DELETE", "VECTOR_SEARCH", "INDEX_OP", "MIGRATION"] },
            "tableName": { "type": "string", "description": "表名（不暴露列含义）" },
            "executionTimeMs": { "type": "integer" },
            "rowsAffected": { "type": "integer" },
            "poolUsed": { "type": "integer", "description": "连接池已用连接数" },
            "poolTotal": { "type": "integer", "description": "连接池总连接数" }
          }
        },
        "stateMeta": {
          "type": "object",
          "description": "状态机相关元数据（仅STATE_ERR）",
          "properties": {
            "fromState": { "type": "string", "description": "源状态" },
            "toState": { "type": "string", "description": "目标状态" },
            "trigger": { "type": "string", "description": "触发事件" },
            "mouId": { "type": "string", "description": "MOU标识哈希" },
            "waitDurationMs": { "type": "integer", "description": "等待时长" }
          }
        },
        "engineMeta": {
          "type": "object",
          "description": "引擎相关元数据（仅ENGINE_ERR）",
          "properties": {
            "engineType": { "type": "string", "enum": ["world", "studio", "censor", "ensemble"] },
            "kernelTypes": {
              "type": "array",
              "items": { "type": "string", "enum": ["ACTION", "MYSTERY", "RELATIONSHIP", "HORROR"] }
            },
            "inputLength": { "type": "integer", "description": "输入Token数" },
            "qualityScore": { "type": "number", "description": "质量评分（如可用）" }
          }
        },
        "systemMeta": {
          "type": "object",
          "description": "系统相关元数据（仅SYS_ERR）",
          "properties": {
            "memoryUsedMB": { "type": "integer" },
            "memoryTotalMB": { "type": "integer" },
            "heapUsedMB": { "type": "integer" },
            "eventLoopLagMs": { "type": "number" },
            "openHandles": { "type": "integer" },
            "diskFreeGB": { "type": "number" },
            "cpuUsage": { "type": "number" }
          }
        }
      }
    },
    "aggregation": {
      "type": "object",
      "description": "聚合统计信息（由聚合器填充）",
      "properties": {
        "fingerprint": {
          "type": "string",
          "description": "异常指纹（category + errorCode + stackHash + source.component 的组合哈希）"
        },
        "occurrenceCount": { "type": "integer", "description": "相同指纹异常累计发生次数" },
        "firstSeenAt": { "type": "string", "format": "date-time" },
        "lastSeenAt": { "type": "string", "format": "date-time" },
        "windowCount": { "type": "integer", "description": "当前时间窗口内发生次数" },
        "trend": {
          "type": "string",
          "enum": ["increasing", "stable", "decreasing", "spike"],
          "description": "趋势方向"
        }
      }
    },
    "privacy": {
      "type": "object",
      "description": "隐私处理记录",
      "properties": {
        "sensitivityLevel": {
          "type": "string",
          "enum": ["public", "internal", "restricted", "secret"],
          "description": "数据敏感度等级"
        },
        "redactionLog": {
          "type": "array",
          "description": "脱敏操作日志",
          "items": {
            "type": "object",
            "properties": {
              "field": { "type": "string", "description": "被脱敏字段" },
              "method": { "type": "string", "enum": ["hash", "truncate", "replace", "drop", "aggregate"] },
              "reason": { "type": "string" }
            }
          }
        },
        "approvedForUpload": { "type": "boolean", "description": "是否已通过作者审批上报" }
      }
    }
  }
}
```

### 2.3 异常聚合算法

#### 2.3.1 异常指纹生成

```
ALGORITHM: generateErrorFingerprint(errorEvent)
─────────────────────────────────────────────
INPUT:  errorEvent - 异常事件对象
OUTPUT: fingerprint - 64字符十六进制字符串

STEPS:
  1. 提取关键字段：
     - category      (e.g., "LLM_ERR")
     - errorCode     (e.g., "LLM-001")
     - source.component (e.g., "WorldEngine")
     - stackHash     (堆栈哈希，去除行号后重新哈希)

  2. 构建规范化字符串：
     canonical = join("|", [category, errorCode, source.component, stackHash])

  3. 计算 SHA-256 哈希：
     fingerprint = sha256(canonical)

  4. RETURN fingerprint

目的：将相同根因的异常归类到同一指纹下，
      即使发生在不同时间、不同会话也能聚合
```

#### 2.3.2 时间窗口聚合

```
ALGORITHM: slidingWindowAggregate(errorStream, windowSize, slideInterval)
────────────────────────────────────────────────────────────────────────
INPUT:
  - errorStream   : 实时异常事件流
  - windowSize    : 窗口大小（默认 5 分钟 = 300000ms）
  - slideInterval : 滑动步长（默认 1 分钟 = 60000ms）
OUTPUT:
  - aggregatedBatches : 聚合后的异常批次

DATA STRUCTURES:
  - windows: Map<fingerprint, WindowStats>
  - WindowStats: { count, firstAt, lastAt, severities[], sessions[] }

STEPS:
  1. 初始化当前窗口起始时间 windowStart = now()

  2. FOR EACH errorEvent IN errorStream:

       a. fp = generateErrorFingerprint(errorEvent)

       b. IF fp NOT IN windows:
            windows[fp] = {
              count: 0,
              firstAt: errorEvent.timestamp,
              lastAt: errorEvent.timestamp,
              severities: [],
              sessions: Set(),
              errorCodes: Set(),
              components: Set()
            }

       c. stats = windows[fp]
          stats.count += 1
          stats.lastAt = errorEvent.timestamp
          stats.severities.push(errorEvent.severity)
          stats.sessions.add(errorEvent.context.sessionId)
          stats.errorCodes.add(errorEvent.errorCode)
          stats.components.add(errorEvent.source.component)

       d. IF now() - windowStart >= windowSize:
            // 窗口已满，输出聚合结果
            FOR EACH (fp, stats) IN windows:
              batch = createAggregationBatch(fp, stats)
              OUTPUT batch

            // 滑动窗口：移除过期数据
            expireBefore = now() - windowSize
            FOR EACH (fp, stats) IN windows:
              IF stats.lastAt < expireBefore:
                REMOVE windows[fp]

            windowStart += slideInterval

  3. 系统关闭时，刷新所有剩余窗口
     FOR EACH (fp, stats) IN windows:
       OUTPUT createAggregationBatch(fp, stats)

辅助函数 createAggregationBatch(fp, stats):
  RETURN {
    fingerprint: fp,
    totalCount: stats.count,
    uniqueSessions: stats.sessions.size,
    severityDistribution: countBy(stats.severities),  // {P0: 2, P1: 5, ...}
    affectedComponents: [...stats.components],
    errorCodeSet: [...stats.errorCodes],
    timeSpanMs: stats.lastAt - stats.firstAt,
    trend: calculateTrend(stats)  // increasing/stable/decreasing/spike
  }
```

#### 2.3.3 趋势检测算法（基于指数加权移动平均）

```
ALGORITHM: detectTrend(historicalCounts, currentCount, alpha=0.3, spikeThreshold=3.0)
────────────────────────────────────────────────────────────────────────────────
INPUT:
  - historicalCounts  : 历史窗口的异常计数数组 [c_{t-n}, ..., c_{t-1}]
  - currentCount      : 当前窗口异常计数 c_t
  - alpha             : EWMA 平滑因子（默认 0.3）
  - spikeThreshold    : 尖峰检测阈值（默认 3.0 倍标准差）
OUTPUT:
  - trend : "increasing" | "stable" | "decreasing" | "spike"

STEPS:
  1. IF length(historicalCounts) < 3:
       RETURN "stable"  // 数据不足，默认稳定

  2. 计算 EWMA 序列：
     ewma[0] = historicalCounts[0]
     FOR i = 1 TO length(historicalCounts) - 1:
       ewma[i] = alpha * historicalCounts[i] + (1 - alpha) * ewma[i-1]

  3. 当前 EWMA 值：
     currentEwma = alpha * currentCount + (1 - alpha) * ewma[last]

  4. 计算 EWMA 的标准差：
     ewmaStd = stdDev(ewma)

  5. 计算 EWMA 的斜率（最近3个点线性回归）：
     slope = linearRegressionSlope(ewma[-3:])

  6. 尖峰检测：
     IF currentCount > currentEwma + spikeThreshold * ewmaStd:
       RETURN "spike"

  7. 趋势判断：
     IF slope > 0.1 * ewmaStd:   RETURN "increasing"
     IF slope < -0.1 * ewmaStd:  RETURN "decreasing"
     RETURN "stable"
```

### 2.4 严重程度评估体系

#### P0 — 紧急（Critical）

| 属性 | 定义 |
|------|------|
| **判定条件** | 系统核心功能完全不可用；数据丢失风险；安全漏洞 |
| **触发场景** | 进程崩溃(SYS-005)；数据库完全不可连接(DB-005)；所有LLM调用连续失败>5次(LLM-001+002)；状态机死锁导致全部MOU卡死(ST-002) |
| **响应时间** | 立即（< 30 秒） |
| **上报方式** | WebSocket 实时推送 + 系统托盘通知 + 本地弹窗 |
| **自动动作** | 暂停新任务提交；启动保护模式；记录完整现场 |
| **需作者介入** | 是，必须立即通知 |

#### P1 — 高优先级（High）

| 属性 | 定义 |
|------|------|
| **判定条件** | 主要功能严重受损；用户体验极差；有扩散风险 |
| **触发场景** | LLM配额耗尽(LLM-002)；连接池耗尽持续>2分钟(DB-001)；谏官漏报(ENG-004)；内存泄漏达到阈值(SYS-001) |
| **响应时间** | < 5 分钟 |
| **上报方式** | WebSocket 实时推送 + 系统托盘通知 |
| **自动动作** | 尝试自动降级（切换备用模型、释放连接） |
| **需作者介入** | 是，建议尽快处理 |

#### P2 — 中等（Medium）

| 属性 | 定义 |
|------|------|
| **判定条件** | 功能可用但降级；非核心流程受阻；有累积效应 |
| **触发场景** | 单次LLM超时(LLM-001)；单次慢查询>3秒(DB-003)；谏官误报(ENG-003)；单次状态等待超时(ST-003)；模型降级触发(LLM-005) |
| **响应时间** | < 30 分钟（批量上报周期内） |
| **上报方式** | 批量通道上报 |
| **自动动作** | 自动重试、切换降级方案 |
| **需作者介入** | 否，但会在日报中汇总 |

#### P3 — 低优先级（Low）

| 属性 | 定义 |
|------|------|
| **判定条件** | 轻微影响；偶发性；有成熟规避方案 |
| **触发场景** | 偶发的格式错误(LLM-003)；非关键索引效率下降(DB-004)；事件循环短暂阻塞<100ms(SYS-003) |
| **响应时间** | < 24 小时（周报） |
| **上报方式** | 批量通道上报 |
| **自动动作** | 记录日志，不主动干预 |
| **需作者介入** | 否 |

#### P4 — 信息（Info）

| 属性 | 定义 |
|------|------|
| **判定条件** | 纯信息记录；用于趋势分析；无即时影响 |
| **触发场景** | 单次速率限制但立即重试成功(LLM-006)；连接池使用率达到60%(DB-001)；事件循环延迟>10ms(SYS-003) |
| **响应时间** | 不上报，仅本地记录 |
| **上报方式** | 仅本地SQLite存储 |
| **自动动作** | 无 |
| **需作者介入** | 否 |

#### 严重度自动判定矩阵

```
ALGORITHM: autoSeverity(errorEvent)
────────────────────────────────────
INPUT:  errorEvent
OUTPUT: severity ∈ {P0, P1, P2, P3, P4}

RULES:
  // P0 判定
  IF errorEvent.category == "SYS_ERR" AND errorEvent.errorType == "SYS_PROCESS_CRASH"
     RETURN "P0"
  IF errorEvent.category == "DB_ERR" AND errorEvent.errorType == "DB_CONNECTION_LOST"
     AND errorEvent.details.dbMeta.poolUsed == 0
     RETURN "P0"
  IF errorEvent.category == "LLM_ERR"
     AND errorEvent.details.llmMeta.retryCount >= 5
     AND allLLMProvidersFailed()
     RETURN "P0"
  IF errorEvent.category == "STATE_ERR" AND errorEvent.errorType == "STATE_DEADLOCK"
     AND affectedMOUCount() > 3
     RETURN "P0"

  // P1 判定
  IF errorEvent.category == "LLM_ERR" AND errorEvent.errorType == "LLM_QUOTA_EXHAUSTED"
     RETURN "P1"
  IF errorEvent.category == "DB_ERR" AND errorEvent.errorType == "DB_POOL_EXHAUSTED"
     AND errorEvent.details.dbMeta.poolUsed / errorEvent.details.dbMeta.poolTotal > 0.95
     RETURN "P1"
  IF errorEvent.category == "ENGINE_ERR" AND errorEvent.errorType == "ENG_CENSOR_FALSE_NEGATIVE"
     RETURN "P1"
  IF errorEvent.category == "SYS_ERR" AND errorEvent.errorType == "SYS_MEMORY_LEAK"
     AND errorEvent.details.systemMeta.heapUsedMB / errorEvent.details.systemMeta.memoryTotalMB > 0.85
     RETURN "P1"

  // P2 判定
  IF errorEvent.category == "LLM_ERR" AND errorEvent.details.llmMeta.retryCount >= 2
     RETURN "P2"
  IF errorEvent.category == "DB_ERR" AND errorEvent.errorType == "DB_SLOW_QUERY"
     AND errorEvent.details.dbMeta.executionTimeMs > 3000
     RETURN "P2"
  IF errorEvent.category == "STATE_ERR" AND errorEvent.errorType == "STATE_WAIT_TIMEOUT"
     AND errorEvent.details.stateMeta.waitDurationMs > 300000  // 5分钟
     RETURN "P2"
  IF errorEvent.category == "ENGINE_ERR"
     RETURN "P2"  // 所有引擎异常至少P2

  // P3 判定
  IF errorEvent.category == "LLM_ERR" AND errorEvent.details.llmMeta.retryCount == 1
     RETURN "P3"
  IF errorEvent.category == "DB_ERR" AND errorEvent.errorType == "DB_SLOW_QUERY"
     AND errorEvent.details.dbMeta.executionTimeMs > 1000
     RETURN "P3"
  IF errorEvent.category == "SYS_ERR" AND errorEvent.errorType == "SYS_EVENT_LOOP_LAG"
     AND errorEvent.details.systemMeta.eventLoopLagMs > 100
     RETURN "P3"

  // P4 判定 — 其他所有情况
  RETURN "P4"
```

### 2.5 作者隐私保护策略

#### 2.5.1 数据敏感度分级

| 敏感度 | 说明 | 处理方式 | 能否上报 |
|--------|------|----------|----------|
| **Public** | 纯技术元数据，不含任何业务信息 | 直接上报 | ✅ 是 |
| **Internal** | 脱敏后的系统行为数据 | 哈希化处理后上报 | ✅ 是（默认开） |
| **Restricted** | 作者行为模式数据 | 聚合匿名化后上报 | ⚠️ 需作者授权 |
| **Secret** | 任何可能推断出小说内容的数据 | 仅本地存储，不上报 | ❌ 否 |

#### 2.5.2 必须脱敏的字段清单

| 原始数据 | 脱敏方法 | 脱敏后示例 |
|----------|----------|-----------|
| 小说正文内容 | drop（丢弃） | — |
| 章节标题 | hash | "a1b2c3d4..." |
| 角色名称 | hash | "e5f6g7h8..." |
| 世界观设定文本 | drop | — |
| 文件路径 | replace（仅保留文件名哈希） | "/.../a3f7x9.ts" |
| 绝对路径 | replace | "/.../project/" |
| 环境变量值 | replace（标记为**REDACTED**） | "**REDACTED**" |
| API Key | replace（仅保留前4位+***） | "sk-ab***" |
| 错误消息中的文本片段 | truncate（截断至50字符+"..."） | "The character decided to go..." |
| 会话ID | hash | "sha256:9f86d0..." |
| IP地址 | replace | "127.0.0.1"（固定值） |
| 主机名 | replace | "narrativeos-local" |
| 操作系统用户名 | replace | "author" |

#### 2.5.3 隐私保护代码示例

```typescript
// privacy-sanitizer.ts

interface SanitizationRule {
  fieldPattern: RegExp;
  method: 'hash' | 'truncate' | 'replace' | 'drop' | 'aggregate';
  replacement?: string;
  maxLength?: number;
}

const DEFAULT_RULES: SanitizationRule[] = [
  // Secret 级别 — 直接丢弃
  { fieldPattern: /content|text|body|narrative|story/i, method: 'drop' },
  { fieldPattern: /worldSetting|lore|background/i, method: 'drop' },
  { fieldPattern: /character.*description|npc.*detail/i, method: 'drop' },

  // Restricted 级别 — 哈希化
  { fieldPattern: /chapterTitle|sceneName/i, method: 'hash' },
  { fieldPattern: /characterName|npcName/i, method: 'hash' },
  { fieldPattern: /location|place/i, method: 'hash' },

  // Internal 级别 — 替换敏感信息
  { fieldPattern: /apiKey|token|secret/i, method: 'replace', replacement: '***REDACTED***' },
  { fieldPattern: /filePath|absolutePath/i, method: 'replace', replacement: '/.../' },
  { fieldPattern: /homeDirectory|userProfile/i, method: 'replace', replacement: '/author/' },

  // 错误消息截断
  { fieldPattern: /errorMessage|message/i, method: 'truncate', maxLength: 200 },
];

function sanitizeErrorEvent(event: ErrorEvent, rules: SanitizationRule[]): SanitizedErrorEvent {
  const redactionLog: RedactionEntry[] = [];
  const sanitized = deepClone(event);

  for (const rule of rules) {
    const matches = findFieldsByPattern(sanitized, rule.fieldPattern);
    for (const match of matches) {
      const original = match.value;
      switch (rule.method) {
        case 'drop':
          deleteFieldByPath(sanitized, match.path);
          redactionLog.push({ field: match.path, method: 'drop', reason: 'Contains narrative content' });
          break;
        case 'hash':
          setFieldByPath(sanitized, match.path, sha256(String(original)));
          redactionLog.push({ field: match.path, method: 'hash', reason: 'Potential narrative identifier' });
          break;
        case 'replace':
          setFieldByPath(sanitized, match.path, rule.replacement ?? '***');
          redactionLog.push({ field: match.path, method: 'replace', reason: 'Sensitive system info' });
          break;
        case 'truncate':
          setFieldByPath(sanitized, match.path, truncate(String(original), rule.maxLength ?? 100));
          redactionLog.push({ field: match.path, method: 'truncate', reason: 'Length limit for safety' });
          break;
      }
    }
  }

  sanitized.privacy = {
    sensitivityLevel: classifySensitivity(redactionLog),
    redactionLog,
    approvedForUpload: false,
  };

  return sanitized;
}
```

---

## 3. 性能指标采集器（MetricsCollector）

### 3.1 完整指标清单（共 35 项）

#### 3.1.1 LLM 维度（10 项）

| 编号 | 指标名 | 类型 | 单位 | 采集频率 | 说明 |
|------|--------|------|------|----------|------|
| LLM-01 | llm.call_count | Counter | 次 | 实时 | LLM API 总调用次数 |
| LLM-02 | llm.token_input | Counter | tokens | 实时 | 输入Token累计数 |
| LLM-03 | llm.token_output | Counter | tokens | 实时 | 输出Token累计数 |
| LLM-04 | llm.latency_p50 | Gauge | ms | 分钟 | 响应延迟P50 |
| LLM-05 | llm.latency_p90 | Gauge | ms | 分钟 | 响应延迟P90 |
| LLM-06 | llm.latency_p99 | Gauge | ms | 分钟 | 响应延迟P99 |
| LLM-07 | llm.cost_usd | Counter | USD | 实时 | 累计API费用 |
| LLM-08 | llm.cache_hit_rate | Gauge | % | 分钟 | 提示缓存命中率 |
| LLM-09 | llm.model_downgrade_count | Counter | 次 | 实时 | 模型降级触发次数 |
| LLM-10 | llm.retry_count | Counter | 次 | 实时 | 重试总次数 |

#### 3.1.2 数据库维度（8 项）

| 编号 | 指标名 | 类型 | 单位 | 采集频率 | 说明 |
|------|--------|------|------|----------|------|
| DB-01 | db.qps | Gauge | 次/秒 | 实时 | 每秒查询数 |
| DB-02 | db.pool_utilization | Gauge | % | 实时 | 连接池使用率 |
| DB-03 | db.slow_query_count | Counter | 次 | 实时 | 慢查询(>1s)累计数 |
| DB-04 | db.vector_search_latency_p99 | Gauge | ms | 分钟 | pgvector检索延迟P99 |
| DB-05 | db.index_efficiency | Gauge | % | 小时 | 索引扫描命中率 |
| DB-06 | db.tx_conflict_rate | Gauge | % | 分钟 | 事务冲突率 |
| DB-07 | db.connection_wait_time_ms | Gauge | ms | 实时 | 获取连接等待时间 |
| DB-08 | db.table_size_mb | Gauge | MB | 小时 | 数据表总大小 |

#### 3.1.3 引擎维度（7 项）

| 编号 | 指标名 | 类型 | 单位 | 采集频率 | 说明 |
|------|--------|------|------|----------|------|
| ENG-01 | eng.world_sim_duration_ms | Histogram | ms | 实时 | 世界引擎推演耗时 |
| ENG-02 | eng.studio_gen_duration_ms | Histogram | ms | 实时 | 工作室引擎生成耗时 |
| ENG-03 | eng.censor_check_duration_ms | Histogram | ms | 实时 | 谏官检查耗时 |
| ENG-04 | eng.flowguard_duration_ms | Histogram | ms | 实时 | Flow Guardian计算耗时 |
| ENG-05 | eng.ensemble_vote_duration_ms | Histogram | ms | 实时 | 集成投票耗时 |
| ENG-06 | eng.quality_score | Gauge | 0-100 | 实时 | 生成质量评分 |
| ENG-07 | eng.censor_accuracy | Gauge | % | 小时 | 谏官准确率（采纳率） |

#### 3.1.4 业务维度（5 项）

| 编号 | 指标名 | 类型 | 单位 | 采集频率 | 说明 |
|------|--------|------|------|----------|------|
| BIZ-01 | biz.chapter_gen_time_ms | Histogram | ms | 实时 | 单章生成总耗时 |
| BIZ-02 | biz.author_action_count | Counter | 次 | 实时 | 作者操作次数 |
| BIZ-03 | biz.mou_state_dwell_time_ms | Histogram | ms | 实时 | MOU状态停留时间 |
| BIZ-04 | biz.approval_rate | Gauge | % | 小时 | 审批通过率 |
| BIZ-05 | biz.session_duration_ms | Gauge | ms | 实时 | 单次创作会话时长 |

#### 3.1.5 系统维度（5 项）

| 编号 | 指标名 | 类型 | 单位 | 采集频率 | 说明 |
|------|--------|------|------|----------|------|
| SYS-01 | sys.cpu_percent | Gauge | % | 实时 | CPU使用率 |
| SYS-02 | sys.memory_used_mb | Gauge | MB | 实时 | 内存使用量 |
| SYS-03 | sys.disk_io_wait_percent | Gauge | % | 实时 | 磁盘IO等待率 |
| SYS-04 | sys.event_loop_lag_ms | Gauge | ms | 实时 | 事件循环延迟 |
| SYS-05 | sys.open_handles | Gauge | 个 | 实时 | 打开句柄数 |

### 3.2 指标采集频率与存储策略

```
┌─────────────────────────────────────────────────────────────────┐
│                    指标采集与存储架构                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  实时层 (Hot)  ──►  Ring Buffer (内存)  ──►  5分钟滚动窗口      │
│  频率: 1-10秒      容量: 10K 样本      用途: 实时监控/告警       │
│  数据类型: Counter增量, Gauge瞬时值                              │
│                                                                 │
│       │                                                          │
│       ▼                                                          │
│  分钟层 (Warm) ──►  SQLite内存表  ──►  1小时保留                │
│  频率: 1分钟       聚合: P50/P90/P99     用途: 趋势分析          │
│  数据类型: 直方图分桶, 计数器累计值                              │
│                                                                 │
│       │                                                          │
│       ▼                                                          │
│  小时层 (Cool) ──►  SQLite磁盘表  ──►  7天保留                  │
│  频率: 1小时       聚合: 均值/标准差/最大值  用途: 日报生成       │
│  数据类型: 预聚合统计量                                          │
│                                                                 │
│       │                                                          │
│       ▼                                                          │
│  天层 (Cold)   ──►  SQLite磁盘表  ──►  90天保留                 │
│  频率: 1天       聚合: 日汇总/周对比    用途: 周报/月报          │
│  数据类型: 日级汇总统计                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 采集频率矩阵

| 指标类别 | 实时(1s) | 分钟 | 小时 | 天 | 存储策略 |
|----------|----------|------|------|-----|----------|
| LLM 计数器 | ✅ 增量 | 累计 | 累计 | 累计 | 实时→环形缓冲→分钟聚合 |
| LLM 延迟 | ✅ 单个值 | P50/P90/P99 | 均值/标准差 | 日均值 | TDigest近似计算 |
| DB 使用率 | ✅ 瞬时值 | 均值/最大值 | 均值 | 日均值 | 滑动窗口均值 |
| DB 慢查询 | ✅ 增量 | 累计 | Top5 | 日Top10 | 实时记录→分钟聚合 |
| 引擎耗时 | ✅ 单个值 | P50/P90/P99 | 均值/标准差 | 日均值 | 直方图分桶 |
| 业务指标 | ✅ 事件驱动 | 汇总 | 汇总 | 汇总 | 事件触发式记录 |
| 系统指标 | ✅ 瞬时值 | 均值/最大值 | 均值 | 日均值 | 采样+插值 |

### 3.3 指标上报数据结构（JSON Schema）

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://narrativeos.dev/schemas/telemetry-metrics-v1",
  "title": "NarrativeOS Telemetry Metrics Batch",
  "type": "object",
  "required": ["batchId", "eventType", "timestamp", "collectionInterval", "metrics"],
  "properties": {
    "batchId": {
      "type": "string",
      "description": "批次唯一标识 (ULID)"
    },
    "eventType": {
      "type": "string",
      "const": "METRICS"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "批次采集结束时间"
    },
    "collectionInterval": {
      "type": "object",
      "description": "本次采集的时间区间",
      "properties": {
        "startTime": { "type": "string", "format": "date-time" },
        "endTime": { "type": "string", "format": "date-time" },
        "durationMs": { "type": "integer" }
      }
    },
    "metrics": {
      "type": "array",
      "description": "指标数组",
      "items": {
        "type": "object",
        "required": ["name", "value", "type", "timestamp"],
        "properties": {
          "name": {
            "type": "string",
            "description": "指标名称，如 'llm.latency_p99'"
          },
          "value": {
            "oneOf": [
              { "type": "number" },
              { "type": "integer" },
              { "type": "object" }
            ],
            "description": "指标值（标量或直方图对象）"
          },
          "type": {
            "type": "string",
            "enum": ["counter", "gauge", "histogram"],
            "description": "指标类型"
          },
          "timestamp": {
            "type": "string",
            "format": "date-time",
            "description": "指标采集时间"
          },
          "unit": {
            "type": "string",
            "description": "单位",
            "examples": ["ms", "bytes", "percent", "count"]
          },
          "dimensions": {
            "type": "object",
            "description": "维度标签（用于分组）",
            "properties": {
              "modelId": { "type": "string", "description": "模型标识" },
              "provider": { "type": "string" },
              "kernelType": { "type": "string", "enum": ["ACTION", "MYSTERY", "RELATIONSHIP", "HORROR", "NONE"] },
              "mouState": { "type": "string" },
              "operation": { "type": "string" },
              "component": { "type": "string" }
            },
            "additionalProperties": false
          },
          "histogram": {
            "type": "object",
            "description": "直方图数据（仅 type='histogram'）",
            "properties": {
              "count": { "type": "integer", "description": "样本总数" },
              "sum": { "type": "number", "description": "样本总和" },
              "min": { "type": "number" },
              "max": { "type": "number" },
              "buckets": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "upperBound": { "type": "number" },
                    "count": { "type": "integer" }
                  }
                }
              },
              "percentiles": {
                "type": "object",
                "description": "预计算分位值",
                "properties": {
                  "p50": { "type": "number" },
                  "p90": { "type": "number" },
                  "p95": { "type": "number" },
                  "p99": { "type": "number" }
                }
              }
            }
          }
        }
      }
    },
    "metadata": {
      "type": "object",
      "description": "批次元数据",
      "properties": {
        "sdkVersion": { "type": "string" },
        "collectorVersion": { "type": "string" },
        "samplesCollected": { "type": "integer" },
        "samplesDropped": { "type": "integer" }
      }
    }
  }
}
```

### 3.4 基线建立与异常检测算法

#### 3.4.1 动态基线建立算法

```
ALGORITHM: establishDynamicBaseline(metricHistory, windowDays=7)
─────────────────────────────────────────────────────────────
INPUT:
  - metricHistory : 历史指标时序数据 [{timestamp, value}, ...]
  - windowDays    : 基线计算窗口（默认7天）
OUTPUT:
  - baseline : { expectedValue, lowerBound, upperBound, seasonalityPattern }

STEPS:
  1. 数据预处理：
     a. 去除明显的异常值（IQR方法：Q1 - 1.5*IQR 以下或 Q3 + 1.5*IQR 以上）
     b. 按时间排序，填充缺失值（线性插值）

  2. 趋势分解（如果时间跨度 > 2天）：
     // 使用简单的时间序列分解
     trend = calculateMovingAverage(metricHistory, 24)  // 24点移动平均
     detrended = metricHistory.value - trend

  3. 季节性检测（如果时间跨度 > 7天）：
     // 检测日内周期性（作者创作习惯）
     hourlyPattern = groupByHourOfDay(detrended)
     seasonalityPattern = calculateHourlyAverage(hourlyPattern)
     residual = detrended - seasonalityPattern

  4. 基线统计量计算：
     expectedValue = mean(residual) + last(trend) + getHourlySeasonality(now())
     stdDev = stdDev(residual)
     lowerBound = expectedValue - 2 * stdDev   // 95% 置信区间
     upperBound = expectedValue + 2 * stdDev

  5. RETURN {
       expectedValue,
       lowerBound,
       upperBound,
       seasonalityPattern,
       trendSlope: linearRegressionSlope(trend),
       confidence: calculateConfidence(metricHistory.length, stdDev)
     }

NOTE: 基线每日凌晨 3:00 自动更新，使用最近 7 天数据
```

#### 3.4.2 同比环比异常检测

```
ALGORITHM: detectAnomaly(currentValue, baseline, config)
───────────────────────────────────────────────────────
INPUT:
  - currentValue : 当前指标值
  - baseline     : 基线对象（来自 establishDynamicBaseline）
  - config       : 检测配置 { sensitivity, enableSeasonality }
OUTPUT:
  - result : { isAnomaly, severity, direction, confidence }

STEPS:
  1. 季节性调整：
     IF config.enableSeasonality AND baseline.seasonalityPattern exists:
       adjustedValue = currentValue - getSeasonalComponent(now(), baseline)
     ELSE:
       adjustedValue = currentValue

  2. 偏差计算：
     deviation = adjustedValue - baseline.expectedValue
     zScore = deviation / ((baseline.upperBound - baseline.lowerBound) / 4)
     // 注意：除以4是因为上下界是2σ，所以范围宽度=4σ

  3. 同比环比检查：
     momChange = (currentValue - sameTimeYesterday) / sameTimeYesterday  // 环比
     yoyChange = null  // 年同比（数据不足时为空）

  4. 综合异常判断：
     anomalyScore = 0

     // Z-Score 评分
     IF abs(zScore) > 3:   anomalyScore += 1.0
     ELSE IF abs(zScore) > 2: anomalyScore += 0.7
     ELSE IF abs(zScore) > 1.5: anomalyScore += 0.4

     // 环比变化评分
     IF abs(momChange) > 0.5:  anomalyScore += 0.5   // 50%变化
     ELSE IF abs(momChange) > 0.3: anomalyScore += 0.3

     // 趋势偏离评分
     IF baseline.trendSlope > 0 AND deviation < 0:
       // 上升趋势中出现负偏离，可能更严重
       anomalyScore += 0.2

  5. 结果判定：
     sensitivity = config.sensitivity  // "low", "medium", "high"
     thresholds = { low: 1.2, medium: 0.9, high: 0.6 }
     threshold = thresholds[sensitivity]

     IF anomalyScore >= threshold:
       RETURN {
         isAnomaly: true,
         severity: anomalyScore >= 1.5 ? "critical" : anomalyScore >= 1.0 ? "warning" : "minor",
         direction: deviation > 0 ? "up" : "down",
         confidence: min(anomalyScore, 1.0),
         zScore,
         momChange,
         deviation
       }
     ELSE:
       RETURN { isAnomaly: false, confidence: 1 - anomalyScore }
```

#### 3.4.3 多指标联合异常检测

```
ALGORITHM: detectCorrelatedAnomaly(metricSet, correlationMatrix)
───────────────────────────────────────────────────────────────
INPUT:
  - metricSet : 同时异常的指标集合 [{name, zScore}, ...]
  - correlationMatrix : 指标间的历史相关系数矩阵
OUTPUT:
  - correlatedGroups : 相关异常指标组

STEPS:
  1. 构建异常指标图：
     graph = new UndirectedGraph()
     FOR EACH m1 IN metricSet:
       FOR EACH m2 IN metricSet:
         IF m1 != m2 AND correlationMatrix[m1.name][m2.name] > 0.7:
           graph.addEdge(m1.name, m2.name, correlationMatrix[m1.name][m2.name])

  2. 查找连通分量：
     components = graph.findConnectedComponents()

  3. 对每个连通分量评估根因概率：
     FOR EACH component IN components:
       rootCauseProb = {}
       FOR EACH metric IN component:
         // 根因指标通常有更高的zScore且是其他指标的"上游"
         rootCauseProb[metric] = metric.zScore * inDegreeWeight(metric)

       mostLikelyRoot = argmax(rootCauseProb)
       OUTPUT {
         metrics: component,
         rootCause: mostLikelyRoot,
         correlation: calculateComponentCorrelation(component),
         recommendation: generateRecommendation(mostLikelyRoot)
       }

示例：
  如果 llm.latency_p99↑ 和 llm.retry_count↑ 和 db.pool_utilization↑ 同时异常，
  且它们高度相关，则根因可能是 DB_POOL_EXHAUSTED → 导致 LLM 超时重试增加
```



---

## 4. 使用模式分析器（UsagePatternAnalyzer）

### 4.1 作者行为追踪指标体系

#### 4.1.1 MOU 状态停留时长分布

| 指标ID | 指标名 | 类型 | 说明 |
|--------|--------|------|------|
| MOU-01 | mou.dwell_time.planning | Histogram | 在 planning 状态的停留时长 |
| MOU-02 | mou.dwell_time.generating | Histogram | 在 generating 状态的停留时长 |
| MOU-03 | mou.dwell_time.censoring | Histogram | 在 censoring 状态的停留时长 |
| MOU-04 | mou.dwell_time.waiting | Histogram | 在 waiting 状态的停留时长 |
| MOU-05 | mou.dwell_time.oracling | Histogram | 在 oracling 状态的停留时长 |
| MOU-06 | mou.dwell_time.approving | Histogram | 在 approving 状态的停留时长 |
| MOU-07 | mou.dwell_time.executing | Histogram | 在 executing 状态的停留时长 |
| MOU-08 | mou.dwell_time.failed | Histogram | 在 failed 状态的停留时长 |
| MOU-09 | mou.state_transition_count | Counter | 状态转换总次数 |
| MOU-10 | mou.state_transition_matrix | Matrix | 状态转移频率矩阵（9×9） |

#### 4.1.2 按钮点击率追踪

| 指标ID | 指标名 | 类型 | 说明 |
|--------|--------|------|------|
| BTN-01 | btn.choose_click_rate | Gauge | CHOOSE 按钮点击率 |
| BTN-02 | btn.retry_click_rate | Gauge | RETRY 按钮点击率 |
| BTN-03 | btn.revise_click_rate | Gauge | REVISE 按钮点击率 |
| BTN-04 | btn.approve_click_rate | Gauge | APPROVE 按钮点击率 |
| BTN-05 | btn.god_mode_click_rate | Gauge | GOD_MODE 按钮点击率 |
| BTN-06 | btn.choose_per_session | Counter | 每会话 CHOOSE 次数 |
| BTN-07 | btn.retry_per_session | Counter | 每会话 RETRY 次数 |
| BTN-08 | btn.retry_rate_by_phase | Gauge | 各阶段的 RETRY 率 |

#### 4.1.3 模式切换频率

| 指标ID | 指标名 | 类型 | 说明 |
|--------|--------|------|------|
| MODE-01 | mode.cockpit_to_dashboard | Counter | 驾驶舱→仪表盘切换次数 |
| MODE-02 | mode.dashboard_to_cockpit | Counter | 仪表盘→驾驶舱切换次数 |
| MODE-03 | mode.to_sleep_pod | Counter | 进入休眠舱次数 |
| MODE-04 | mode.from_sleep_pod | Counter | 退出休眠舱次数 |
| MODE-05 | mode.session_switch_interval | Histogram | 模式切换间隔时间 |

#### 4.1.4 谏官报告处理方式

| 指标ID | 指标名 | 类型 | 说明 |
|--------|--------|------|------|
| CEN-01 | censor.adopt_rate | Gauge | 采纳谏官建议比例 |
| CEN-02 | censor.ignore_rate | Gauge | 忽略谏官建议比例 |
| CEN-03 | censor.self_modify_rate | Gauge | 自行修改比例 |
| CEN-04 | censor.appeal_rate | Gauge | 申诉比例（Oracle介入） |
| CEN-05 | censor.avg_resolution_time | Histogram | 谏官问题平均解决时间 |

#### 4.1.5 Oracle 神谕触发

| 指标ID | 指标名 | 类型 | 说明 |
|--------|--------|------|------|
| ORA-01 | oracle.consult_count | Counter | Oracle 下神谕次数 |
| ORA-02 | oracle.consult_trigger | Counter | 神谕触发原因分布 |
| ORA-03 | oracle.appeal_success_rate | Gauge | 申诉成功率 |
| ORA-04 | oracle.avg_consult_duration | Histogram | 神谕平均耗时 |

#### 4.1.6 类型内核偏好

| 指标ID | 指标名 | 类型 | 说明 |
|--------|--------|------|------|
| KERN-01 | kernel.action_usage_rate | Gauge | ACTION 内核使用率 |
| KERN-02 | kernel.mystery_usage_rate | Gauge | MYSTERY 内核使用率 |
| KERN-03 | kernel.relationship_usage_rate | Gauge | RELATIONSHIP 内核使用率 |
| KERN-04 | kernel.horror_usage_rate | Gauge | HORROR 内核使用率 |
| KERN-05 | kernel.switch_frequency | Counter | 内核切换次数 |
| KERN-06 | kernel.preferred_kernel | Gauge | 作者偏好的主导内核 |

### 4.2 摩擦点检测算法

摩擦点定义为：作者在特定环节反复操作、长时间犹豫或频繁切换模式的位置。

```
ALGORITHM: detectFrictionPoints(behaviorLog, timeWindow=3600000)
───────────────────────────────────────────────────────────────
INPUT:
  - behaviorLog : 作者行为日志 [{timestamp, action, mouState, duration}, ...]
  - timeWindow  : 分析时间窗口（默认1小时 = 3600000ms）
OUTPUT:
  - frictionPoints : 摩擦点列表 [{location, severity, indicators, recommendation}]

FRICTION INDICATOR 定义:

  TYPE-1: 反复重试摩擦
    条件: 同一 MOU 在 generating 状态下 RETRY >= 3 次
    指标: retry_count, retry_interval_cv (重试间隔变异系数)
    严重度: retry_count * 0.3

  TYPE-2: 决策停滞摩擦
    条件: waiting 状态停留 > 平均 waiting 时间的 2 倍标准差
    指标: dwell_time_vs_baseline_ratio
    严重度: ratio - 2  (当 ratio > 2 时)

  TYPE-3: 频繁切换摩擦
    条件: 同一创作会话内 驾驶舱↔仪表盘 切换 >= 5 次
    指标: switch_count, switch_interval_mean
    严重度: (switch_count - 4) * 0.2

  TYPE-4: 谏官对抗摩擦
    条件: 谏官建议被忽略或申诉的比例 > 60%
    指标: ignore_rate, appeal_rate
    严重度: max(ignore_rate, appeal_rate) * 0.5

  TYPE-5: 模式逃离摩擦
    条件: 操作后立即进入休眠舱的比例异常高
    指标: escape_to_sleep_rate
    严重度: escape_rate * 2

  TYPE-6: Oracle 依赖摩擦
    条件: Oracle 介入频率 > 正常水平的 2 倍
    指标: oracle_consult_rate_vs_baseline
    严重度: (rate_ratio - 1) * 0.5

ALGORITHM STEPS:
  1. 过滤 behaviorLog 到当前 timeWindow

  2. 对每个 MOU 实例计算摩擦指标：
     FOR EACH mouInstance IN getMOUInstances(windowLog):
       indicators = []

       // TYPE-1: 反复重试
       retryCount = countActions(mouInstance, 'RETRY')
       IF retryCount >= 3:
         indicators.push({
           type: 'RETRY_FRICTION',
           severity: min(retryCount * 0.3, 1.0),
           data: { retryCount, avgRetryInterval }
         })

       // TYPE-2: 决策停滞
       waitTime = getStateDwellTime(mouInstance, 'waiting')
       baselineWait = getBaselineWaitTime()
       IF waitTime > baselineWait.mean + 2 * baselineWait.std:
         indicators.push({
           type: 'DECISION_STALL',
           severity: min((waitTime / baselineWait.mean - 1) * 0.5, 1.0),
           data: { waitTime, baseline: baselineWait.mean }
         })

       // TYPE-3: 频繁切换
       switchCount = countModeSwitches(mouInstance.sessionId)
       IF switchCount >= 5:
         indicators.push({
           type: 'MODE_SWITCH_FRICTION',
           severity: min((switchCount - 4) * 0.15, 1.0),
           data: { switchCount }
         })

       // TYPE-4: 谏官对抗
       IF mouInstance.censorResult EXISTS:
         censorAction = mouInstance.censorResult.authorAction  // adopt/ignore/appeal
         IF censorAction IN ['ignore', 'appeal']:
           indicators.push({
             type: 'CENSOR_RESISTANCE',
             severity: 0.4,
             data: { action: censorAction }
           })

  3. 聚合摩擦点到阶段层面：
     frictionByPhase = groupByOperationPhase(indicators)

  4. 计算综合摩擦分数：
     FOR EACH (phase, indList) IN frictionByPhase:
       compositeScore = weightedSum(indList.map(i => i.severity))
       IF compositeScore > 0.5:
         frictionPoints.push({
           location: phase,                    // e.g., "chapter_generation"
           severity: compositeScore,
           indicators: indList,
           timestamp: now(),
           recommendation: generateFrictionRecommendation(phase, indList)
         })

  5. RETURN frictionPoints.sortBy(severity, DESC)

辅助函数 generateFrictionRecommendation(phase, indicators):
  IF indicators contains RETRY_FRICTION:
    RETURN "可能性清单生成质量可能不足，建议检查叙事增强器参数"
  IF indicators contains DECISION_STALL:
    RETURN "作者在此阶段决策困难，建议增强辅助信息或选项说明"
  IF indicators contains MODE_SWITCH_FRICTION:
    RETURN "作者频繁切换模式，可能当前界面信息不足或焦虑感高"
  IF indicators contains CENSOR_RESISTANCE:
    RETURN "谏官校准可能过于保守，建议调整风险偏好阈值"
  RETURN "建议关注此环节的交互体验"
```

### 4.3 工作流瓶颈分析

```
ALGORITHM: analyzeWorkflowBottleneck(sessionMetrics, globalBaseline)
───────────────────────────────────────────────────────────────
INPUT:
  - sessionMetrics  : 会话级指标 {phases: [{name, duration, satisfaction}]}
  - globalBaseline  : 全局基线数据
OUTPUT:
  - bottlenecks : 瓶颈分析报告

STEPS:
  1. 计算各阶段耗时分布：
     phaseStats = {}
     FOR EACH phase IN sessionMetrics.phases:
       baseline = globalBaseline[phase.name]
       phaseStats[phase.name] = {
         actualDuration: phase.duration,
         expectedDuration: baseline.mean,
         deviation: phase.duration - baseline.mean,
         zScore: (phase.duration - baseline.mean) / baseline.std,
         satisfactionScore: phase.satisfaction  // 1-5 主观评分（如有）
       }

  2. 识别时间瓶颈：
     timeBottlenecks = filter(phaseStats, s => s.zScore > 1.5)
                        .sortBy(zScore, DESC)
                        .limit(3)

  3. 识别满意度瓶颈：
     satisfactionBottlenecks = filter(phaseStats, s => s.satisfactionScore < 3)
                                .sortBy(satisfactionScore, ASC)
                                .limit(3)

  4. 综合瓶颈评分：
     FOR EACH phase IN phaseStats:
       // 瓶颈指数 = 时间偏离权重 * 时间zScore + 满意度权重 * (5 - 满意度)
       bottleneckIndex = 0.6 * max(phase.zScore, 0) + 0.4 * max(3 - phase.satisfactionScore, 0)
       phase.bottleneckScore = bottleneckIndex

     topBottlenecks = sortBy(phaseStats, bottleneckScore, DESC).limit(3)

  5. 输出分析报告：
     RETURN {
       topTimeBottlenecks: timeBottlenecks,
       topSatisfactionBottlenecks: satisfactionBottlenecks,
       rankedBottlenecks: topBottlenecks,
       overallFlowHealth: calculateFlowHealthScore(phaseStats),
       suggestions: generateWorkflowSuggestions(topBottlenecks)
     }
```

### 4.4 习惯模式学习

```
ALGORITHM: learnAuthorHabits(historicalSessions, minSessions=10)
─────────────────────────────────────────────────────────────
INPUT:
  - historicalSessions : 历史会话数据 [{startTime, endTime, actions, kernelUsage}]
  - minSessions        : 最少需要的会话数（默认10）
OUTPUT:
  - habitProfile : 作者习惯画像

STEPS:
  IF length(historicalSessions) < minSessions:
    RETURN { status: "INSUFFICIENT_DATA", profile: null }

  1. 创作时段偏好：
     hourDistribution = groupByHourOfDay(historicalSessions.map(s => s.startTime))
     preferredHours = findPeaks(hourDistribution, threshold=mean(hourDistribution)*1.5)

  2. 创作节奏：
     sessionDurations = historicalSessions.map(s => s.endTime - s.startTime)
     rhythm = {
       avgSessionDuration: mean(sessionDurations),
       sessionDurationStd: stdDev(sessionDurations),
       avgDailySessions: countDailySessions(historicalSessions),
       preferredSessionLength: mode(sessionDurations)  // 众数
     }

  3. 内核偏好：
     kernelUsage = aggregateKernelUsage(historicalSessions)
     preferredKernel = argmax(kernelUsage)
     kernelDiversity = shannonEntropy(kernelUsage)  // 香农熵衡量多样性

  4. 操作风格：
     actionDistribution = countBy(flatten(historicalSessions.map(s => s.actions)))
     style = classifyStyle(actionDistribution):
       IF actionDistribution.APPROVE / total > 0.7:     RETURN "TRUSTING"
       IF actionDistribution.RETRY / total > 0.3:       RETURN "PERFECTIONIST"
       IF actionDistribution.REVISE / total > 0.3:      RETURN "HANDS_ON"
       IF actionDistribution.GOD_MODE / total > 0.1:    RETURN "EXPERIMENTAL"
       RETURN "BALANCED"

  5. 输出画像：
     RETURN {
       status: "READY",
       profile: {
         preferredHours,           // e.g., [20, 21, 22] 晚间创作者
         rhythm,                    // 创作节奏
         preferredKernel,          // 偏好的内核类型
         kernelDiversity,          // 0-1, 越高越爱切换
         operationStyle,           // TRUSTING/PERFECTIONIST/HANDS_ON/EXPERIMENTAL/BALANCED
         avgDecisionTime,          // 平均决策时间
         frictionTolerance,        // 摩擦耐受度（从摩擦点频率推断）
         censorRelationship,       // COOPERATIVE / ADVERSARIAL / NEUTRAL
         oracleDependency          // LOW / MEDIUM / HIGH
       }
     }
```

### 4.5 使用模式上报数据结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://narrativeos.dev/schemas/telemetry-usage-v1",
  "title": "NarrativeOS Usage Pattern Report",
  "type": "object",
  "required": ["reportId", "eventType", "timestamp", "period", "patterns"],
  "properties": {
    "reportId": { "type": "string" },
    "eventType": { "type": "string", "const": "USAGE_PATTERN" },
    "timestamp": { "type": "string", "format": "date-time" },
    "period": {
      "type": "object",
      "properties": {
        "start": { "type": "string", "format": "date-time" },
        "end": { "type": "string", "format": "date-time" },
        "label": { "type": "string", "enum": ["hourly", "daily", "weekly"] }
      }
    },
    "patterns": {
      "type": "object",
      "properties": {
        "mouDwellTimes": {
          "type": "object",
          "description": "各MOU状态停留时间统计",
          "patternProperties": {
            "^(planning|generating|censoring|waiting|oracling|approving|executing|failed)$": {
              "type": "object",
              "properties": {
                "meanMs": { "type": "number" },
                "p50Ms": { "type": "number" },
                "p90Ms": { "type": "number" },
                "p99Ms": { "type": "number" },
                "count": { "type": "integer" }
              }
            }
          }
        },
        "buttonUsage": {
          "type": "object",
          "properties": {
            "choose": { "type": "integer" },
            "retry": { "type": "integer" },
            "revise": { "type": "integer" },
            "approve": { "type": "integer" },
            "godMode": { "type": "integer" },
            "total": { "type": "integer" }
          }
        },
        "modeSwitches": {
          "type": "object",
          "properties": {
            "cockpitToDashboard": { "type": "integer" },
            "dashboardToCockpit": { "type": "integer" },
            "toSleepPod": { "type": "integer" },
            "fromSleepPod": { "type": "integer" }
          }
        },
        "censorInteraction": {
          "type": "object",
          "properties": {
            "adopt": { "type": "integer" },
            "ignore": { "type": "integer" },
            "selfModify": { "type": "integer" },
            "appeal": { "type": "integer" },
            "total": { "type": "integer" }
          }
        },
        "kernelUsage": {
          "type": "object",
          "properties": {
            "ACTION": { "type": "integer" },
            "MYSTERY": { "type": "integer" },
            "RELATIONSHIP": { "type": "integer" },
            "HORROR": { "type": "integer" }
          }
        },
        "frictionPoints": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "location": { "type": "string" },
              "severity": { "type": "number" },
              "indicators": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "type": { "type": "string" },
                    "severity": { "type": "number" }
                  }
                }
              }
            }
          }
        },
        "habitProfile": {
          "type": "object",
          "description": "作者习惯画像（聚合匿名）",
          "properties": {
            "preferredHourRanges": {
              "type": "array",
              "items": { "type": "string" },
              "description": "如 ['20:00-23:00']，不暴露具体日期"
            },
            "avgSessionMinutes": { "type": "integer" },
            "style": { "type": "string", "enum": ["TRUSTING", "PERFECTIONIST", "HANDS_ON", "EXPERIMENTAL", "BALANCED"] },
            "preferredKernel": { "type": "string" }
          }
        }
      }
    }
  }
}
```

---

## 5. 需求挖掘器（NeedMiner）

### 5.1 被动需求发现引擎

被动需求发现通过分析异常模式和摩擦点，自动推导出系统改进需求。

#### 5.1.1 规则映射表

| 触发信号 | 推导逻辑 | 生成需求 | 影响面 | 优先级因子 |
|----------|----------|----------|--------|-----------|
| 频繁 RETRY (>30% 操作) | 可能性清单质量不佳 | 优化叙事增强器（NarrativeBooster）参数 | 所有生成阶段 | 0.8 |
| 频繁 REVISE (>25% 操作) | 正文生成质量不佳 | 调整 AMA 模型温度/Top-p；增强指令遵循 | 工作室引擎 | 0.9 |
| 长时间 waiting (>5min均值) | 决策信息不足 | 增强选项说明；增加预览功能；添加推荐理由 | 交互层 | 0.7 |
| 频繁跳过谏官 (>50%忽略) | 谏官过于保守 | 校准风险偏好阈值；调整违规检测敏感度 | 谏官系统 | 0.6 |
| 频繁 Oracle 介入 | 谏官-Oracle 分歧大 | 优化谏官训练数据；缩小判断偏差 | 谏官系统 | 0.6 |
| LLM 延迟 P99 > 30s | 模型响应慢 | 优化提示缓存；启用流式响应；预生成 | LLM层 | 0.8 |
| DB 慢查询增多 | 数据量增长 | 优化pgvector索引；添加覆盖索引 | 数据层 | 0.7 |
| 状态死锁频发 | 状态机设计缺陷 | 重构状态转换规则；添加超时释放 | 状态机层 | 0.9 |
| 内存持续增长 | 存在泄漏 | 修复未释放引用；优化缓存策略 | 系统层 | 0.9 |
| 频繁模式切换 | 界面不满足需求 | 增强单模式信息密度；减少切换必要 | UI层 | 0.5 |
| 单内核过度使用 | 其他内核未被发现价值 | 添加内核推荐引导；展示内核效果对比 | 内核层 | 0.4 |
| 审批通过率低 | 生成与预期偏差大 | 增强世界设定注入；优化上下文长度 | 工作室引擎 | 0.8 |

#### 5.1.2 需求推导算法

```
ALGORITHM: passiveNeedDiscovery(errorAggregates, frictionPoints, metrics, config)
─────────────────────────────────────────────────────────────────────────────
INPUT:
  - errorAggregates : 聚合异常数据
  - frictionPoints  : 摩擦点列表
  - metrics         : 性能指标
  - config          : 规则配置
OUTPUT:
  - derivedNeeds : 推导出的需求列表

STEPS:
  1. 加载规则库：
     rules = loadDiscoveryRules(config.rulesPath)

  2. 对每个规则评估触发条件：
     derivedNeeds = []
     FOR EACH rule IN rules:
       triggerScore = evaluateRule(rule, errorAggregates, frictionPoints, metrics)
       IF triggerScore >= rule.threshold:
         derivedNeeds.push({
           needId: generateNeedId(),
           source: "PASSIVE",
           triggerSignals: rule.triggerSignals,
           triggerScore,
           title: rule.needTitle,
           description: rule.needDescription,
           affectedComponents: rule.affectedComponents,
           impactScope: calculateImpactScope(rule, errorAggregates),
           frequencyScore: calculateFrequencyScore(rule, frictionPoints),
           confidence: min(triggerScore, 0.95),
           createdAt: now()
         })

  3. 去重与合并：
     mergedNeeds = mergeSimilarNeeds(derivedNeeds, similarityThreshold=0.7)

  4. RETURN mergedNeeds.sortBy(confidence, DESC)

辅助函数 evaluateRule(rule, errors, frictions, metrics):
  score = 0
  FOR EACH condition IN rule.conditions:
    IF condition.source == "error":
      matchingErrors = filter(errors, e => matches(e, condition.pattern))
      score += condition.weight * min(matchingErrors.length / condition.threshold, 1.0)
    ELSE IF condition.source == "friction":
      matchingFrictions = filter(frictions, f => matches(f, condition.pattern))
      score += condition.weight * min(sum(matchingFrictions.severity) / condition.threshold, 1.0)
    ELSE IF condition.source == "metric":
      metricValue = getMetric(metrics, condition.metricName)
      IF metricValue > condition.threshold:
        score += condition.weight * min(metricValue / condition.threshold - 1, 1.0)
  RETURN score
```

### 5.2 主动需求发现

#### 5.2.1 技术趋势追踪

```
ALGORITHM: trackTechnologyTrends(currentCapabilities, trendSources)
─────────────────────────────────────────────────────────────
INPUT:
  - currentCapabilities : 当前系统能力清单
  - trendSources       : 技术趋势源配置
OUTPUT:
  - trendGaps : 技术差距列表

STEPS:
  1. 定期抓取趋势源（每7天执行一次）：
     FOR EACH source IN trendSources:
       IF source.type == "arxiv":
         papers = searchArxiv(source.keywords, source.dateRange)
       ELSE IF source.type == "hacker_news":
         discussions = searchHN(source.keywords)
       ELSE IF source.type == "model_release":
         releases = checkModelReleases(source.providers)

  2. 提取技术能力项：
     newCapabilities = extractCapabilities(papers, discussions, releases)

  3. 与当前能力对比：
     FOR EACH cap IN newCapabilities:
       IF cap.type NOT IN currentCapabilities:
         trendGaps.push({
           source: "ACTIVE_TECH_TREND",
           gapType: "MISSING_CAPABILITY",
           description: cap.description,
           evidence: cap.sourceUrls,
           relevanceScore: calculateRelevance(cap, currentSystemContext),
           effortEstimate: cap.effortLevel,  // LOW/MEDIUM/HIGH
           recommendation: cap.integrationSuggestion
         })
       ELSE IF cap.performanceImprovement > 0.3:  // 30%+ 提升
         trendGaps.push({
           source: "ACTIVE_TECH_TREND",
           gapType: "PERFORMANCE_GAP",
           description: `${cap.type} 新技术可提升 ${cap.performanceImprovement * 100}%`,
           currentPerformance: currentCapabilities[cap.type].performance,
           potentialPerformance: cap.performance,
           relevanceScore: cap.performanceImprovement
         })

  4. RETURN trendGaps.sortBy(relevanceScore, DESC)
```

#### 5.2.2 竞品差距分析

```
ALGORITHM: competitiveGapAnalysis(ourFeatures, competitorFeatures)
─────────────────────────────────────────────────────────────
INPUT:
  - ourFeatures       : 我们的功能矩阵
  - competitorFeatures : 竞品功能矩阵
OUTPUT:
  - gaps : 差距列表

STEPS:
  1. 构建功能对比矩阵：
     allFeatures = union(ourFeatures.keys, competitorFeatures.keys)
     FOR EACH feature IN allFeatures:
       ourScore = ourFeatures[feature]?.maturity ?? 0    // 0-5
       compScore = max(competitorFeatures[feature]?.map(f => f.maturity) ?? [0])

       IF compScore > ourScore + 1:  // 竞品领先至少1个等级
         gaps.push({
           source: "ACTIVE_COMPETITIVE",
           gapType: "FEATURE_GAP",
           feature: feature.name,
           ourMaturity: ourScore,
           competitorMaturity: compScore,
           gapSize: compScore - ourScore,
           userValue: feature.userValue,     // 用户价值 1-5
           strategicImportance: feature.strategicImportance
         })

  2. RETURN gaps.sortBy(g => g.gapSize * g.userValue, DESC)
```

### 5.3 需求优先级算法

```
ALGORITHM: calculateNeedPriority(need, context)
─────────────────────────────────────────────────────────────
INPUT:
  - need    : 需求对象
  - context : 系统上下文 {currentFocus, resourceAvailability, strategicGoals}
OUTPUT:
  - priorityScore : 0-100 的优先级分数

FORMULA:
  priorityScore = (
    impactWeight     * normalize(need.impactScope,     0, 100) * 0.30 +
    frequencyWeight  * normalize(need.frequencyScore,  0, 100) * 0.25 +
    costWeight       * (1 - normalize(need.effortEstimate, 1, 5)) * 0.20 +
    strategicWeight  * need.strategicValue * 0.15 +
    confidenceWeight * need.confidence * 0.10
  ) * 100

WHERE:
  - impactScope     : 影响面（受影响作者数/功能模块数）
  - frequencyScore  : 频率分（每日触发次数）
  - effortEstimate  : 实现成本估计（1=低, 5=高）
  - strategicValue  : 战略价值（0-1，由产品目标映射）
  - confidence      : 需求存在置信度（0-1）

权重默认值：
  impactWeight     = 1.0
  frequencyWeight  = 1.0
  costWeight       = 1.0
  strategicWeight  = 1.0
  confidenceWeight = 1.0

// 战略价值映射
strategicValue = MAP(need.category, {
  "NARRATIVE_QUALITY":  0.9,   // 叙事质量是核心
  "SYSTEM_STABILITY":   0.85,  // 系统稳定性是底线
  "AUTHOR_EXPERIENCE":  0.8,   // 作者体验是差异化
  "COST_EFFICIENCY":    0.6,   // 成本效率是优化项
  "TECH_DEBT":          0.5,   // 技术债是维护项
})

优先级分级：
  priorityScore >= 80: PRIORITY-1 "立即规划"
  priorityScore >= 60: PRIORITY-2 "近期实现"
  priorityScore >= 40: PRIORITY-3 "中期规划"
  priorityScore >= 20: PRIORITY-4 "长期考虑"
  priorityScore <  20: PRIORITY-5 "暂不处理"
```

### 5.4 需求上报数据结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://narrativeos.dev/schemas/telemetry-need-v1",
  "title": "NarrativeOS Derived Need Report",
  "type": "object",
  "required": ["needId", "eventType", "timestamp", "source", "title", "priority"],
  "properties": {
    "needId": { "type": "string" },
    "eventType": { "type": "string", "const": "DERIVED_NEED" },
    "timestamp": { "type": "string", "format": "date-time" },
    "source": {
      "type": "string",
      "enum": ["PASSIVE_SIGNAL", "ACTIVE_TECH_TREND", "ACTIVE_COMPETITIVE", "ACTIVE_COMMUNITY"]
    },
    "title": { "type": "string", "description": "需求标题" },
    "description": { "type": "string", "description": "需求详细描述" },
    "triggerSignals": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "enum": ["ERROR_PATTERN", "FRICTION_POINT", "METRIC_ANOMALY", "TECH_TREND", "COMPETITOR_GAP"] },
          "description": { "type": "string" },
          "evidence": { "type": "string" }
        }
      }
    },
    "affectedComponents": {
      "type": "array",
      "items": { "type": "string" }
    },
    "impactAnalysis": {
      "type": "object",
      "properties": {
        "impactScope": { "type": "number", "description": "影响范围 0-100" },
        "frequencyScore": { "type": "number", "description": "频率分 0-100" },
        "affectedUsers": { "type": "integer", "description": "受影响用户数" },
        "severityDescription": { "type": "string" }
      }
    },
    "effortEstimate": {
      "type": "object",
      "properties": {
        "level": { "type": "string", "enum": ["LOW", "MEDIUM", "HIGH", "EPIC"] },
        "storyPoints": { "type": "integer" },
        "durationDays": { "type": "integer" }
      }
    },
    "priority": {
      "type": "object",
      "properties": {
        "score": { "type": "number" },
        "level": { "type": "string", "enum": ["P1", "P2", "P3", "P4", "P5"] },
        "label": { "type": "string", "enum": ["立即规划", "近期实现", "中期规划", "长期考虑", "暂不处理"] }
      }
    },
    "strategicValue": { "type": "number" },
    "confidence": { "type": "number" },
    "recommendation": { "type": "string" },
    "privacy": {
      "type": "object",
      "properties": {
        "containsUserBehavior": { "type": "boolean" },
        "approvedForUpload": { "type": "boolean" }
      }
    }
  }
}
```

---

## 6. 上报管道设计

### 6.1 上报通道架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        上报管道架构                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐         │
│  │  实时通道     │    │  批量通道     │    │  离线通道     │         │
│  │  Realtime    │    │  Batch       │    │  Offline     │         │
│  │              │    │              │    │              │         │
│  │ P0/P1 异常   │───►│ P2-P4 异常   │◄───│ 启动时扫描   │         │
│  │ 关键指标告警 │    │ 性能指标     │    │ 历史日志     │         │
│  │              │    │ 使用模式     │    │ 未上报数据   │         │
│  │ 频率: 即时   │    │ 频率: 15min  │    │ 频率: 启动时 │         │
│  │ TTL: 30s     │    │ TTL: 5min    │    │ TTL: 24h     │         │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘         │
│         │                   │                   │                   │
│         └───────────────────┼───────────────────┘                   │
│                             ▼                                       │
│               ┌─────────────────────────────┐                       │
│               │      协议处理层              │                       │
│               │  • JSON序列化                │                       │
│               │  • LZ4压缩                   │                       │
│               │  • AES-256-GCM加密           │                       │
│               │  • Ed25519数字签名           │                       │
│               └─────────────┬───────────────┘                       │
│                             ▼                                       │
│               ┌─────────────────────────────┐                       │
│               │      网络传输层              │                       │
│               │  • WebSocket (实时)          │                       │
│               │  • HTTPS POST (批量/离线)    │                       │
│               │  • 指数退避重试              │                       │
│               │  • 断线缓存                  │                       │
│               └─────────────┬───────────────┘                       │
│                             ▼                                       │
│               ┌─────────────────────────────┐                       │
│               │      接收确认层              │                       │
│               │  • 服务端ACK                 │                       │
│               │  • 本地标记已上报            │                       │
│               │  • 失败回滚至待上报队列      │                       │
│               └─────────────────────────────┘                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 上报协议完整格式

#### 6.2.1 信封结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://narrativeos.dev/schemas/telemetry-envelope-v1",
  "title": "NarrativeOS Telemetry Envelope",
  "type": "object",
  "required": ["envelopeVersion", "envelopeId", "timestamp", "sender", "payload"],
  "properties": {
    "envelopeVersion": { "type": "string", "const": "1.0" },
    "envelopeId": { "type": "string", "description": "ULID格式信封ID" },
    "timestamp": { "type": "string", "format": "date-time" },
    "sender": {
      "type": "object",
      "required": ["installationId"],
      "properties": {
        "installationId": { "type": "string", "description": "安装实例哈希标识（SHA-256 of machineId+installTime）" },
        "version": { "type": "string" },
        "platform": { "type": "string", "enum": ["win32", "darwin", "linux"] },
        "runtime": { "type": "string", "enum": ["node", "electron", "docker"] }
      }
    },
    "channel": { "type": "string", "enum": ["realtime", "batch", "offline"] },
    "sequence": { "type": "integer", "description": "批次序列号（用于重排序和去重）" },
    "payload": {
      "type": "object",
      "required": ["type", "data"],
      "properties": {
        "type": { "type": "string", "enum": ["ERROR", "METRICS", "USAGE_PATTERN", "DERIVED_NEED"] },
        "data": { "type": "array", "description": "具体数据项数组" },
        "metadata": {
          "type": "object",
          "properties": {
            "itemCount": { "type": "integer" },
            "compressedSize": { "type": "integer", "description": "压缩后字节数" },
            "originalSize": { "type": "integer", "description": "原始字节数" },
            "compressionRatio": { "type": "number" }
          }
        }
      }
    },
    "security": {
      "type": "object",
      "description": "安全相关字段",
      "properties": {
        "encryption": {
          "type": "object",
          "properties": {
            "algorithm": { "type": "string", "const": "AES-256-GCM" },
            "iv": { "type": "string", "description": "Base64编码初始化向量" },
            "authTag": { "type": "string", "description": "Base64认证标签" },
            "keyId": { "type": "string", "description": "密钥标识符" }
          }
        },
        "signature": {
          "type": "object",
          "properties": {
            "algorithm": { "type": "string", "const": "Ed25519" },
            "publicKeyFingerprint": { "type": "string" },
            "value": { "type": "string", "description": "Base64编码签名" }
          }
        }
      }
    }
  }
}
```

#### 6.2.2 处理流程

```
ALGORITHM: processTelemetryPayload(dataItems, channel, config)
─────────────────────────────────────────────────────────────
INPUT:
  - dataItems : 待上报数据项数组
  - channel   : "realtime" | "batch" | "offline"
  - config    : 上报配置
OUTPUT:
  - envelope : 完整的信封对象

STEPS:
  1. 数据预处理：
     a. 去重：filter(dataItems, not alreadyReported)
     b. 脱敏：forEach(dataItems, sanitize)
     c. 验证：forEach(dataItems, validateSchema)

  2. JSON序列化：
     rawJson = JSON.stringify({ type: inferType(dataItems), data: dataItems })
     originalSize = byteLength(rawJson)

  3. 压缩（LZ4）：
     compressed = lz4Compress(rawJson)
     compressedSize = byteLength(compressed)

  4. 加密（AES-256-GCM）：
     iv = generateRandomBytes(12)
     { ciphertext, authTag } = aes256gcmEncrypt(compressed, config.encryptionKey, iv)

  5. 签名（Ed25519）：
     toSign = concat(iv, ciphertext, timestamp, envelopeId)
     signature = ed25519Sign(toSign, config.signingPrivateKey)

  6. 构建信封：
     envelope = {
       envelopeVersion: "1.0",
       envelopeId: generateULID(),
       timestamp: new Date().toISOString(),
       sender: {
         installationId: config.installationId,
         version: config.appVersion,
         platform: process.platform,
         runtime: detectRuntime()
       },
       channel,
       sequence: getNextSequence(),
       payload: {
         type: inferType(dataItems),
         data: dataItems,  // 实际传输中这里放加密后的数据
         metadata: { itemCount: dataItems.length, compressedSize, originalSize, compressionRatio: compressedSize/originalSize }
       },
       security: {
         encryption: { algorithm: "AES-256-GCM", iv: base64(iv), authTag: base64(authTag), keyId: config.keyId },
         signature: { algorithm: "Ed25519", publicKeyFingerprint: config.publicKeyFingerprint, value: base64(signature) }
       }
     }

  7. RETURN envelope

传输时信封转为紧凑格式（减少网络开销）：
  compactEnvelope = base64(msgpackEncode(envelope))
```

### 6.3 网络故障降级策略

```
ALGORITHM: resilientTransmit(envelope, transport, retryConfig)
─────────────────────────────────────────────────────────────
INPUT:
  - envelope    : 待传输的信封
  - transport   : 传输适配器（WebSocket / HTTP）
  - retryConfig : 重试配置
OUTPUT:
  - result : { success, deliveryId, retryCount, latencyMs }

STEPS:
  1. 初始状态：
     retryCount = 0
     maxRetries = retryConfig.maxRetries  // 实时=3, 批量=5, 离线=10
     baseDelay = retryConfig.baseDelayMs  // 1000ms
     maxDelay = retryConfig.maxDelayMs    // 60000ms
     deadline = now() + retryConfig.totalTimeoutMs

  2. 传输循环：
     WHILE retryCount <= maxRetries AND now() < deadline:
       TRY:
         result = await transport.send(envelope, timeout=15000)
         IF result.status == "ACK":
           markAsDelivered(envelope.envelopeId, result.deliveryId)
           RETURN { success: true, deliveryId: result.deliveryId, retryCount, latencyMs: elapsed() }
         ELSE IF result.status == "RATE_LIMITED":
           delay = result.retryAfterMs ?? exponentialBackoff(retryCount, baseDelay, maxDelay)
           await sleep(delay)
         ELSE IF result.status == "REJECTED":
           // 服务端拒绝，不再重试
           logPermanentFailure(envelope, result.reason)
           RETURN { success: false, error: result.reason }

       CATCH networkError:
         IF isFatalError(networkError):
           // DNS解析失败、SSL证书错误等不可恢复错误
           logPermanentFailure(envelope, networkError.message)
           RETURN { success: false, error: networkError.message }

         // 指数退避
         delay = exponentialBackoff(retryCount, baseDelay, maxDelay)
         // 添加抖动 (±25%)
         jitteredDelay = delay * (0.75 + Math.random() * 0.5)
         await sleep(jitteredDelay)
         retryCount++

  3. 所有重试耗尽：
     persistToLocalQueue(envelope)
     scheduleOfflineRetry(envelope.envelopeId, retryAt=now()+3600000)
     RETURN { success: false, error: "MAX_RETRIES_EXHAUSTED", willRetryOffline: true }

辅助函数 exponentialBackoff(retryCount, baseDelay, maxDelay):
  delay = baseDelay * Math.pow(2, retryCount)  // 1s, 2s, 4s, 8s, 16s...
  RETURN Math.min(delay, maxDelay)
```

#### 降级状态机

```
上报系统健康状态机:

┌─────────────┐     首次连接失败      ┌──────────────┐
│   HEALTHY   │────────────────────►│  DEGRADED    │
│  (正常上报)  │                     │ (降频+队列)   │
└──────┬──────┘                     └──────┬───────┘
       ▲                                    │
       │     恢复连接                       │ 连续失败 > 3次
       └────────────────────────────────────┘
                                            ▼
                                     ┌──────────────┐
                                     │   OFFLINE    │◄──── 网络完全不可用
                                     │ (仅本地存储)  │
                                     └──────┬───────┘
                                            │
                                            │ 网络恢复
                                            ▼
                                     ┌──────────────┐
                                     │   RECOVER    │
                                     │  (离线数据同步)│
                                     └──────┬───────┘
                                            │
                                            │ 同步完成
                                            ▼
                                     ┌──────────────┐
                                     │   HEALTHY    │
                                     └──────────────┘

各状态下的行为：
  HEALTHY:   正常频率上报，实时+批量通道全开
  DEGRADED:  实时通道降为每30秒1次；批量通道合并为更大批次；使用本地队列缓冲
  OFFLINE:   所有数据仅写入SQLite；不上报任何数据
  RECOVER:   启动时扫描未上报数据；按时间顺序批量补报；优先上报P0/P1
```

### 6.4 作者控制面板

#### 6.4.1 可控制的上报项

| 上报项 | 默认状态 | 作者可关闭 | 关闭影响 |
|--------|----------|-----------|----------|
| P0 异常实时上报 | ✅ 开 | ❌ 不可关闭 | 无（安全必须） |
| P1 异常实时上报 | ✅ 开 | ✅ 可关闭 | 可能延迟发现严重问题 |
| P2-P4 异常批量上报 | ✅ 开 | ✅ 可关闭 | 无法获取中低异常趋势 |
| LLM 性能指标 | ✅ 开 | ✅ 可关闭 | 无法优化LLM调用策略 |
| DB 性能指标 | ✅ 开 | ✅ 可关闭 | 无法优化数据库性能 |
| 引擎性能指标 | ✅ 开 | ✅ 可关闭 | 无法优化引擎效率 |
| 业务指标 | ⚠️ 需授权 | ✅ 可关闭 | 无法分析工作流瓶颈 |
| 使用模式分析 | ❌ 关 | ✅ 可开启 | 无法学习作者偏好 |
| 摩擦点检测 | ⚠️ 需授权 | ✅ 可关闭 | 无法识别改进点 |
| 被动需求发现 | ✅ 开 | ✅ 可关闭 | 无法自动推导改进需求 |
| 主动需求发现 | ❌ 关 | ✅ 可开启 | 无法获取技术趋势差距 |

#### 6.4.2 控制面板数据结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Author Telemetry Control Panel",
  "type": "object",
  "properties": {
    "authorId": { "type": "string" },
    "lastModified": { "type": "string", "format": "date-time" },
    "globalSwitch": {
      "type": "object",
      "properties": {
        "emergencyReporting": { "type": "boolean", "description": "P0紧急上报，不可关闭" },
        "errorReporting": { "type": "boolean" },
        "metricsReporting": { "type": "boolean" },
        "usagePatternReporting": { "type": "boolean" },
        "needDiscoveryReporting": { "type": "boolean" }
      }
    },
    "granularControls": {
      "type": "object",
      "properties": {
        "errorSeverity": {
          "type": "object",
          "properties": {
            "P0": { "type": "boolean", "readOnly": true },
            "P1": { "type": "boolean" },
            "P2": { "type": "boolean" },
            "P3": { "type": "boolean" },
            "P4": { "type": "boolean" }
          }
        },
        "metricCategories": {
          "type": "object",
          "properties": {
            "llm": { "type": "boolean" },
            "database": { "type": "boolean" },
            "engine": { "type": "boolean" },
            "business": { "type": "boolean" },
            "system": { "type": "boolean" }
          }
        },
        "usagePatternDetail": {
          "type": "object",
          "properties": {
            "mouDwellTime": { "type": "boolean" },
            "buttonUsage": { "type": "boolean" },
            "modeSwitch": { "type": "boolean" },
            "censorInteraction": { "type": "boolean" },
            "kernelUsage": { "type": "boolean" },
            "frictionPoint": { "type": "boolean" },
            "habitProfile": { "type": "boolean" }
          }
        }
      }
    },
    "pendingReview": {
      "type": "array",
      "description": "待作者审批的上报数据",
      "items": {
        "type": "object",
        "properties": {
          "itemId": { "type": "string" },
          "itemType": { "type": "string" },
          "createdAt": { "type": "string" },
          "preview": { "type": "string", "description": "数据摘要（脱敏后预览）" },
          "status": { "type": "string", "enum": ["pending", "approved", "rejected"] }
        }
      }
    },
    "uploadHistory": {
      "type": "array",
      "description": "已上报历史记录",
      "items": {
        "type": "object",
        "properties": {
          "uploadId": { "type": "string" },
          "uploadedAt": { "type": "string" },
          "itemTypes": { "type": "array", "items": { "type": "string" } },
          "itemCount": { "type": "integer" },
          "sizeBytes": { "type": "integer" }
        }
      }
    }
  }
}
```

---

## 7. 数据存储设计

### 7.1 SQLite 数据库设计

#### 7.1.1 数据库文件组织

```
~/.narrativeos/telemetry/
├── telemetry.db              # 主数据库（活跃数据）
├── telemetry.db-wal          # WAL 日志
└── archive/
    ├── telemetry_2025_01.db  # 月度归档
    ├── telemetry_2025_02.db
    └── ...
```

#### 7.1.2 表结构定义

```sql
-- ============================================
-- 1. 异常事件表 (error_events)
-- ============================================
CREATE TABLE error_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id        TEXT NOT NULL UNIQUE,           -- ULID
    event_type      TEXT NOT NULL DEFAULT 'ERROR',
    timestamp       INTEGER NOT NULL,                -- Unix timestamp (ms)
    severity        TEXT NOT NULL CHECK(severity IN ('P0','P1','P2','P3','P4')),
    category        TEXT NOT NULL CHECK(category IN ('LLM_ERR','DB_ERR','STATE_ERR','ENGINE_ERR','SYS_ERR')),
    error_code      TEXT NOT NULL,                   -- e.g., 'LLM-001'
    error_type      TEXT NOT NULL,                   -- e.g., 'LLM_TIMEOUT'
    component       TEXT NOT NULL,                   -- 组件名
    version         TEXT,
    session_hash    TEXT,                            -- 会话ID哈希
    mou_state       TEXT,
    operation_phase TEXT,
    chapter_number  INTEGER,
    kernel_type     TEXT,
    elapsed_ms      INTEGER,
    message_hash    TEXT,                            -- 错误消息哈希
    stack_fingerprint TEXT,                          -- 堆栈指纹(sha256)
    llm_model_id    TEXT,
    llm_provider    TEXT,
    llm_latency_ms  INTEGER,
    llm_retry_count INTEGER DEFAULT 0,
    db_query_hash   TEXT,
    db_query_type   TEXT,
    db_exec_time_ms INTEGER,
    db_pool_used    INTEGER,
    db_pool_total   INTEGER,
    state_from      TEXT,
    state_to        TEXT,
    engine_type     TEXT,
    sys_memory_mb   INTEGER,
    sys_heap_mb     INTEGER,
    sys_event_loop_lag_ms REAL,
    fingerprint     TEXT NOT NULL,                   -- 聚合指纹
    occurrence_count INTEGER DEFAULT 1,
    trend           TEXT CHECK(trend IN ('increasing','stable','decreasing','spike')),
    sensitivity_level TEXT DEFAULT 'internal',
    approved_for_upload INTEGER DEFAULT 0,           -- 0=pending, 1=approved, 2=rejected
    uploaded_at     INTEGER,                         -- 实际上报时间
    upload_status   TEXT DEFAULT 'pending' CHECK(upload_status IN ('pending','queued','uploading','uploaded','failed','rejected')),
    created_at      INTEGER DEFAULT (unixepoch() * 1000),
    -- 索引
    INDEX idx_error_timestamp ON error_events(timestamp),
    INDEX idx_error_severity ON error_events(severity),
    INDEX idx_error_fingerprint ON error_events(fingerprint),
    INDEX idx_error_upload_status ON error_events(upload_status),
    INDEX idx_error_category_code ON error_events(category, error_code)
);

-- ============================================
-- 2. 性能指标表 (metrics_snapshots)
-- ============================================
CREATE TABLE metrics_snapshots (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id        TEXT NOT NULL,
    metric_name     TEXT NOT NULL,                   -- e.g., 'llm.latency_p99'
    metric_type     TEXT NOT NULL CHECK(metric_type IN ('counter','gauge','histogram')),
    value_number    REAL,
    value_json      TEXT,                            -- JSON for histogram/complex values
    unit            TEXT,
    timestamp       INTEGER NOT NULL,
    collection_interval_ms INTEGER,
    dimensions_json TEXT,                            -- JSON: {modelId, provider, kernelType, ...}
    -- 直方图专用字段
    histogram_count INTEGER,
    histogram_sum   REAL,
    histogram_min   REAL,
    histogram_max   REAL,
    histogram_p50   REAL,
    histogram_p90   REAL,
    histogram_p99   REAL,
    -- 上报控制
    approved_for_upload INTEGER DEFAULT 0,
    uploaded_at     INTEGER,
    upload_status   TEXT DEFAULT 'pending',
    created_at      INTEGER DEFAULT (unixepoch() * 1000),
    -- 索引
    INDEX idx_metric_name_ts ON metrics_snapshots(metric_name, timestamp),
    INDEX idx_metric_type ON metrics_snapshots(metric_type),
    INDEX idx_metric_upload ON metrics_snapshots(upload_status)
);

-- 指标基线表 (metric_baselines)
CREATE TABLE metric_baselines (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name     TEXT NOT NULL,
    dimensions_hash TEXT,                            -- dimensions的哈希
    expected_value  REAL NOT NULL,
    lower_bound     REAL NOT NULL,
    upper_bound     REAL NOT NULL,
    std_dev         REAL,
    sample_count    INTEGER NOT NULL,
    window_start    INTEGER NOT NULL,
    window_end      INTEGER NOT NULL,
    trend_slope     REAL DEFAULT 0,
    seasonality_json TEXT,                           -- JSON: {hourPattern}
    confidence      REAL DEFAULT 0.8,
    last_updated    INTEGER NOT NULL,
    UNIQUE(metric_name, dimensions_hash),
    INDEX idx_baseline_metric ON metric_baselines(metric_name)
);

-- ============================================
-- 3. 使用模式表 (usage_patterns)
-- ============================================
CREATE TABLE usage_patterns (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id       TEXT NOT NULL UNIQUE,
    period_start    INTEGER NOT NULL,
    period_end      INTEGER NOT NULL,
    period_label    TEXT CHECK(period_label IN ('hourly','daily','weekly')),
    -- MOU 停留时间统计 (JSON)
    mou_dwell_stats TEXT,                            -- JSON: {planning: {mean,p50,p90,count}, ...}
    -- 按钮使用统计
    btn_choose      INTEGER DEFAULT 0,
    btn_retry       INTEGER DEFAULT 0,
    btn_revise      INTEGER DEFAULT 0,
    btn_approve     INTEGER DEFAULT 0,
    btn_god_mode    INTEGER DEFAULT 0,
    -- 模式切换
    mode_cockpit_to_dashboard INTEGER DEFAULT 0,
    mode_dashboard_to_cockpit INTEGER DEFAULT 0,
    mode_to_sleep   INTEGER DEFAULT 0,
    mode_from_sleep INTEGER DEFAULT 0,
    -- 谏官交互
    censor_adopt    INTEGER DEFAULT 0,
    censor_ignore   INTEGER DEFAULT 0,
    censor_self_modify INTEGER DEFAULT 0,
    censor_appeal   INTEGER DEFAULT 0,
    -- 内核使用
    kernel_action   INTEGER DEFAULT 0,
    kernel_mystery  INTEGER DEFAULT 0,
    kernel_relationship INTEGER DEFAULT 0,
    kernel_horror   INTEGER DEFAULT 0,
    -- 摩擦点 (JSON)
    friction_points TEXT,                            -- JSON array
    -- 习惯画像 (JSON, 匿名)
    habit_profile   TEXT,                            -- JSON: {preferredHours, style, ...}
    -- 上报控制
    approved_for_upload INTEGER DEFAULT 0,
    uploaded_at     INTEGER,
    upload_status   TEXT DEFAULT 'pending',
    created_at      INTEGER DEFAULT (unixepoch() * 1000),
    INDEX idx_usage_period ON usage_patterns(period_start, period_end),
    INDEX idx_usage_upload ON usage_patterns(upload_status)
);

-- ============================================
-- 4. 需求推导表 (derived_needs)
-- ============================================
CREATE TABLE derived_needs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    need_id         TEXT NOT NULL UNIQUE,
    source          TEXT NOT NULL CHECK(source IN ('PASSIVE_SIGNAL','ACTIVE_TECH_TREND','ACTIVE_COMPETITIVE','ACTIVE_COMMUNITY')),
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    trigger_signals TEXT NOT NULL,                   -- JSON array
    affected_components TEXT,                        -- JSON array
    impact_scope    REAL DEFAULT 0,
    frequency_score REAL DEFAULT 0,
    effort_level    TEXT CHECK(effort_level IN ('LOW','MEDIUM','HIGH','EPIC')),
    story_points    INTEGER,
    priority_score  REAL DEFAULT 0,
    priority_level  TEXT CHECK(priority_level IN ('P1','P2','P3','P4','P5')),
    priority_label  TEXT,
    strategic_value REAL DEFAULT 0,
    confidence      REAL DEFAULT 0,
    recommendation  TEXT,
    status          TEXT DEFAULT 'open' CHECK(status IN ('open','under_review','planned','rejected','implemented')),
    -- 上报控制
    approved_for_upload INTEGER DEFAULT 0,
    uploaded_at     INTEGER,
    upload_status   TEXT DEFAULT 'pending',
    created_at      INTEGER DEFAULT (unixepoch() * 1000),
    updated_at      INTEGER,
    INDEX idx_need_priority ON derived_needs(priority_score DESC),
    INDEX idx_need_status ON derived_needs(status),
    INDEX idx_need_upload ON derived_needs(upload_status)
);

-- ============================================
-- 5. 上报队列表 (upload_queue)
-- ============================================
CREATE TABLE upload_queue (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_id        TEXT NOT NULL UNIQUE,
    envelope_id     TEXT NOT NULL,
    channel         TEXT NOT NULL CHECK(channel IN ('realtime','batch','offline')),
    payload_type    TEXT NOT NULL,                   -- ERROR/METRICS/USAGE_PATTERN/DERIVED_NEED
    payload_size    INTEGER NOT NULL,
    priority        INTEGER DEFAULT 0,               -- 数值越大优先级越高
    retry_count     INTEGER DEFAULT 0,
    next_retry_at   INTEGER,                         -- 下次重试时间
    last_error      TEXT,
    status          TEXT DEFAULT 'queued' CHECK(status IN ('queued','uploading','delivered','failed','cancelled')),
    created_at      INTEGER DEFAULT (unixepoch() * 1000),
    updated_at      INTEGER,
    INDEX idx_queue_status ON upload_queue(status),
    INDEX idx_queue_priority ON upload_queue(priority DESC, created_at ASC),
    INDEX idx_queue_retry ON upload_queue(next_retry_at)
);

-- ============================================
-- 6. 作者控制配置表 (author_telemetry_config)
-- ============================================
CREATE TABLE author_telemetry_config (
    id              INTEGER PRIMARY KEY CHECK(id = 1),  -- 单行配置
    emergency_reporting INTEGER DEFAULT 1,             -- P0, 不可关闭
    error_reporting   INTEGER DEFAULT 1,
    metrics_reporting INTEGER DEFAULT 1,
    usage_reporting   INTEGER DEFAULT 0,               -- 默认关闭
    need_reporting    INTEGER DEFAULT 1,
    -- 细粒度控制 (JSON)
    granular_settings TEXT,                            -- JSON
    last_modified     INTEGER,
    created_at        INTEGER DEFAULT (unixepoch() * 1000)
);

-- 初始化默认配置
INSERT INTO author_telemetry_config (id, granular_settings) VALUES (1, '{}');

-- ============================================
-- 7. 上报历史表 (upload_history)
-- ============================================
CREATE TABLE upload_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id       TEXT NOT NULL UNIQUE,
    envelope_id     TEXT NOT NULL,
    uploaded_at     INTEGER NOT NULL,
    channel         TEXT NOT NULL,
    payload_types   TEXT NOT NULL,                     -- JSON array
    item_count      INTEGER,
    size_bytes      INTEGER,
    delivery_id     TEXT,                              -- 服务端返回的投递ID
    status          TEXT DEFAULT 'success',
    created_at      INTEGER DEFAULT (unixepoch() * 1000),
    INDEX idx_history_uploaded ON upload_history(uploaded_at)
);

-- ============================================
-- 8. 数据保留策略元数据表 (retention_policy)
-- ============================================
CREATE TABLE retention_policy (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name      TEXT NOT NULL,
    severity_filter TEXT,                              -- e.g., 'P0,P1' or null for all
    data_type       TEXT NOT NULL,                     -- error/metrics/usage/need
    retention_days  INTEGER NOT NULL,
    archive_before_delete INTEGER DEFAULT 1,
    last_cleanup_at INTEGER,
    next_cleanup_at INTEGER,
    created_at      INTEGER DEFAULT (unixepoch() * 1000),
    UNIQUE(table_name, severity_filter)
);

-- 初始化保留策略
INSERT INTO retention_policy (table_name, severity_filter, data_type, retention_days) VALUES
('error_events', 'P0', 'error', 365),        -- P0 保留1年
('error_events', 'P1', 'error', 90),         -- P1 保留90天
('error_events', 'P2', 'error', 30),         -- P2 保留30天
('error_events', 'P3,P4', 'error', 7),       -- P3/P4 保留7天
('metrics_snapshots', NULL, 'metrics', 30),  -- 指标快照30天
('metric_baselines', NULL, 'baseline', 90),  -- 基线90天
('usage_patterns', NULL, 'usage', 60),       -- 使用模式60天
('derived_needs', NULL, 'need', 180),        -- 需求推导180天
('upload_queue', NULL, 'queue', 3),          -- 队列3天（已交付的）
('upload_history', NULL, 'history', 90);     -- 上报历史90天
```

### 7.2 数据保留与清理策略

```
ALGORITHM: executeDataRetentionPolicy(db, policy)
─────────────────────────────────────────────────────────────
INPUT:
  - db     : SQLite数据库连接
  - policy : 保留策略配置
OUTPUT:
  - cleanupReport : 清理报告

STEPS:
  1. 加载所有保留策略：
     policies = db.query("SELECT * FROM retention_policy")

  2. 对每个策略执行清理：
     totalDeleted = 0
     totalArchived = 0

     FOR EACH policy IN policies:
       cutoffTime = now() - policy.retention_days * 86400000

       IF policy.table_name == 'error_events' AND policy.severity_filter:
         severities = policy.severity_filter.split(',')
         placeholders = severities.map(() => '?').join(',')

         // 先归档（如果启用）
         IF policy.archive_before_delete:
           archived = db.execute(`
             INSERT INTO archive.${policy.table_name}_${formatDate(now(), 'YYYY_MM')}
             SELECT * FROM ${policy.table_name}
             WHERE severity IN (${placeholders}) AND timestamp < ?
           `, [...severities, cutoffTime])
           totalArchived += archived.changes

         // 然后删除
         deleted = db.execute(`
           DELETE FROM ${policy.table_name}
           WHERE severity IN (${placeholders}) AND timestamp < ?
         `, [...severities, cutoffTime])
         totalDeleted += deleted.changes

       ELSE:
         // 非分severity的表
         IF policy.archive_before_delete:
           archived = db.execute(`
             INSERT INTO archive.${policy.table_name}_${formatDate(now(), 'YYYY_MM')}
             SELECT * FROM ${policy.table_name}
             WHERE timestamp < ?
           `, [cutoffTime])

         deleted = db.execute(`
           DELETE FROM ${policy.table_name}
           WHERE timestamp < ?
         `, [cutoffTime])
         totalDeleted += deleted.changes

       // 更新清理时间
       db.execute(`
         UPDATE retention_policy
         SET last_cleanup_at = ?, next_cleanup_at = ?
         WHERE id = ?
       `, [now(), now() + 86400000, policy.id])

  3. 执行VACUUM（如果删除量超过10%）：
     IF totalDeleted > dbSize * 0.1:
       db.execute("VACUUM")

  4. RETURN { totalDeleted, totalArchived, executionTimeMs }

调度策略：
  - 每日凌晨 3:00 自动执行
  - 使用 SQLite 的 WAL 模式避免长时间锁定
  - 清理时暂停新的归档写入（短暂的读锁）
  - 月度归档数据库单独存储，不参与日常VACUUM
```

### 7.3 本地缓存策略

```typescript
// cache-manager.ts

interface CacheStrategy {
  hot: { maxAge: number; maxSize: number };    // 热数据：内存缓存
  warm: { maxAge: number; maxSize: number };   // 温数据：SQLite内存表
  cold: { maxAge: number; maxSize: number };   // 冷数据：SQLite磁盘表
}

const DEFAULT_CACHE_STRATEGY: Record<string, CacheStrategy> = {
  error_events: {
    hot:  { maxAge: 300_000,  maxSize: 100 },   // 5分钟, 100条
    warm: { maxAge: 3_600_000, maxSize: 1000 },  // 1小时, 1000条
    cold: { maxAge: 86_400_000, maxSize: 10000 } // 1天, 10000条
  },
  metrics_snapshots: {
    hot:  { maxAge: 60_000,    maxSize: 200 },   // 1分钟, 200条
    warm: { maxAge: 3_600_000, maxSize: 5000 },  // 1小时, 5000条
    cold: { maxAge: 7 * 86_400_000, maxSize: 50000 } // 7天
  },
  usage_patterns: {
    hot:  { maxAge: 300_000,  maxSize: 10 },     // 5分钟, 10条
    warm: { maxAge: 3_600_000, maxSize: 100 },   // 1小时, 100条
    cold: { maxAge: 60 * 86_400_000, maxSize: 1000 } // 60天
  }
};

class TieredCache<T> {
  private hot: LRUCache<string, T>;    // 内存LRU
  private db: SQLiteDatabase;           // SQLite

  async get(key: string): Promise<T | null> {
    // 1. 查热缓存
    const hotVal = this.hot.get(key);
    if (hotVal) return hotVal;

    // 2. 查数据库
    const row = await this.db.get(`SELECT * FROM cache WHERE key = ? AND expires_at > ?`, [key, now()]);
    if (row) {
      // 回填热缓存
      this.hot.set(key, row.value);
      return row.value;
    }
    return null;
  }

  async set(key: string, value: T, tier: 'hot' | 'warm' | 'cold'): Promise<void> {
    const strategy = DEFAULT_CACHE_STRATEGY[this.tableName][tier];
    const expiresAt = now() + strategy.maxAge;

    // 写入热缓存
    if (tier === 'hot') {
      this.hot.set(key, value);
    }

    // 异步写入数据库
    await this.db.run(
      `INSERT OR REPLACE INTO cache (key, value, tier, expires_at) VALUES (?, ?, ?, ?)`,
      [key, JSON.stringify(value), tier, expiresAt]
    );
  }

  // 定时清理过期数据
  async evictExpired(): Promise<number> {
    const result = await this.db.run(
      `DELETE FROM cache WHERE expires_at < ?`,
      [now()]
    );
    return result.changes;
  }
}
```

---

## 8. TypeScript 核心类型定义汇总

### 8.1 异常收集器类型

```typescript
// types/error-collector.ts

// 异常大类
export type ErrorCategory = 'LLM_ERR' | 'DB_ERR' | 'STATE_ERR' | 'ENGINE_ERR' | 'SYS_ERR';

// 严重等级
export type SeverityLevel = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

// 趋势方向
export type TrendDirection = 'increasing' | 'stable' | 'decreasing' | 'spike';

// 敏感度等级
export type SensitivityLevel = 'public' | 'internal' | 'restricted' | 'secret';

// 脱敏方法
export type RedactionMethod = 'hash' | 'truncate' | 'replace' | 'drop' | 'aggregate';

// 异常来源信息
export interface ErrorSource {
  component: string;
  version: string;
  module?: string;
  function?: string;
}

// 异常上下文
export interface ErrorContext {
  sessionId: string;
  mouState?: 'planning' | 'generating' | 'censoring' | 'waiting' | 'oracling' | 'approving' | 'executing' | 'failed' | 'completed' | 'idle';
  operationPhase?: string;
  chapterNumber?: number;
  currentKernelType?: 'ACTION' | 'MYSTERY' | 'RELATIONSHIP' | 'HORROR' | 'NONE';
  elapsedMs?: number;
}

// LLM元数据
export interface LLMErrorMeta {
  modelId?: string;
  provider?: 'openai' | 'anthropic' | 'deepseek' | 'local';
  requestTokens?: number;
  responseTokens?: number;
  latencyMs?: number;
  retryCount?: number;
  statusCode?: number;
}

// 数据库元数据
export interface DBErrorMeta {
  queryHash?: string;
  queryType?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'VECTOR_SEARCH' | 'INDEX_OP' | 'MIGRATION';
  tableName?: string;
  executionTimeMs?: number;
  rowsAffected?: number;
  poolUsed?: number;
  poolTotal?: number;
}

// 状态机元数据
export interface StateErrorMeta {
  fromState?: string;
  toState?: string;
  trigger?: string;
  mouId?: string;
  waitDurationMs?: number;
}

// 引擎元数据
export interface EngineErrorMeta {
  engineType?: 'world' | 'studio' | 'censor' | 'ensemble';
  kernelTypes?: Array<'ACTION' | 'MYSTERY' | 'RELATIONSHIP' | 'HORROR'>;
  inputLength?: number;
  qualityScore?: number;
}

// 系统元数据
export interface SystemErrorMeta {
  memoryUsedMB?: number;
  memoryTotalMB?: number;
  heapUsedMB?: number;
  eventLoopLagMs?: number;
  openHandles?: number;
  diskFreeGB?: number;
  cpuUsage?: number;
}

// 脱敏操作记录
export interface RedactionEntry {
  field: string;
  method: RedactionMethod;
  reason: string;
}

// 隐私记录
export interface PrivacyRecord {
  sensitivityLevel: SensitivityLevel;
  redactionLog: RedactionEntry[];
  approvedForUpload: boolean;
}

// 聚合统计
export interface AggregationInfo {
  fingerprint: string;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  windowCount: number;
  trend: TrendDirection;
}

// 完整异常事件
export interface ErrorEvent {
  eventId: string;
  eventType: 'ERROR';
  timestamp: string;
  severity: SeverityLevel;
  category: ErrorCategory;
  errorCode: string;
  errorType: string;
  source: ErrorSource;
  context: ErrorContext;
  details: {
    message?: string;
    stackHash?: string;
    stackFrames?: Array<{ moduleHash: string; lineNumber: number; columnNumber: number; functionHash: string }>;
    llmMeta?: LLMErrorMeta;
    dbMeta?: DBErrorMeta;
    stateMeta?: StateErrorMeta;
    engineMeta?: EngineErrorMeta;
    systemMeta?: SystemErrorMeta;
  };
  aggregation?: AggregationInfo;
  privacy?: PrivacyRecord;
}

// 异常指纹
export interface ErrorFingerprint {
  fingerprint: string;
  category: ErrorCategory;
  errorCode: string;
  component: string;
  stackHash: string;
  firstSeen: number;
  lastSeen: number;
  totalCount: number;
  uniqueSessions: number;
  severityDistribution: Record<SeverityLevel, number>;
  trend: TrendDirection;
}

// 聚合批次
export interface ErrorAggregationBatch {
  fingerprint: string;
  totalCount: number;
  uniqueSessions: number;
  severityDistribution: Record<SeverityLevel, number>;
  affectedComponents: string[];
  errorCodeSet: string[];
  timeSpanMs: number;
  trend: TrendDirection;
  events: ErrorEvent[];
}
```

### 8.2 性能指标采集器类型

```typescript
// types/metrics-collector.ts

export type MetricType = 'counter' | 'gauge' | 'histogram';

export type MetricDimension = {
  modelId?: string;
  provider?: string;
  kernelType?: 'ACTION' | 'MYSTERY' | 'RELATIONSHIP' | 'HORROR' | 'NONE';
  mouState?: string;
  operation?: string;
  component?: string;
};

export interface HistogramBuckets {
  upperBound: number;
  count: number;
}

export interface HistogramValue {
  count: number;
  sum: number;
  min: number;
  max: number;
  buckets: HistogramBuckets[];
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

export interface MetricSnapshot {
  name: string;
  value: number | HistogramValue;
  type: MetricType;
  timestamp: string;
  unit?: string;
  dimensions?: MetricDimension;
  histogram?: HistogramValue;
}

export interface MetricsBatch {
  batchId: string;
  eventType: 'METRICS';
  timestamp: string;
  collectionInterval: {
    startTime: string;
    endTime: string;
    durationMs: number;
  };
  metrics: MetricSnapshot[];
  metadata?: {
    sdkVersion: string;
    collectorVersion: string;
    samplesCollected: number;
    samplesDropped: number;
  };
}

export interface MetricBaseline {
  metricName: string;
  dimensionsHash?: string;
  expectedValue: number;
  lowerBound: number;
  upperBound: number;
  stdDev: number;
  sampleCount: number;
  windowStart: number;
  windowEnd: number;
  trendSlope: number;
  seasonalityPattern?: Record<number, number>;  // hour -> seasonal offset
  confidence: number;
  lastUpdated: number;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  severity?: 'critical' | 'warning' | 'minor';
  direction?: 'up' | 'down';
  confidence: number;
  zScore?: number;
  momChange?: number;
  deviation?: number;
}
```

### 8.3 使用模式分析器类型

```typescript
// types/usage-analyzer.ts

export type ButtonType = 'CHOOSE' | 'RETRY' | 'REVISE' | 'APPROVE' | 'GOD_MODE';

export type MOUState = 'planning' | 'generating' | 'censoring' | 'waiting' | 'oracling' | 'approving' | 'executing' | 'failed' | 'completed' | 'idle';

export type AppMode = 'cockpit' | 'dashboard' | 'sleep_pod';

export type OperationStyle = 'TRUSTING' | 'PERFECTIONIST' | 'HANDS_ON' | 'EXPERIMENTAL' | 'BALANCED';

export type CensorAction = 'adopt' | 'ignore' | 'selfModify' | 'appeal';

export type KernelType = 'ACTION' | 'MYSTERY' | 'RELATIONSHIP' | 'HORROR';

export interface MOUDwellStats {
  meanMs: number;
  p50Ms: number;
  p90Ms: number;
  p99Ms: number;
  count: number;
}

export interface FrictionIndicator {
  type: string;
  severity: number;
  data?: Record<string, unknown>;
}

export interface FrictionPoint {
  location: string;
  severity: number;
  indicators: FrictionIndicator[];
  timestamp: string;
  recommendation: string;
}

export interface HabitProfile {
  preferredHourRanges: string[];
  avgSessionMinutes: number;
  style: OperationStyle;
  preferredKernel: KernelType;
  kernelDiversity: number;
  avgDecisionTime: number;
  frictionTolerance: number;
  censorRelationship: 'COOPERATIVE' | 'ADVERSARIAL' | 'NEUTRAL';
  oracleDependency: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface UsagePatternReport {
  reportId: string;
  eventType: 'USAGE_PATTERN';
  timestamp: string;
  period: {
    start: string;
    end: string;
    label: 'hourly' | 'daily' | 'weekly';
  };
  patterns: {
    mouDwellTimes: Partial<Record<MOUState, MOUDwellStats>>;
    buttonUsage: Record<ButtonType | 'total', number>;
    modeSwitches: {
      cockpitToDashboard: number;
      dashboardToCockpit: number;
      toSleepPod: number;
      fromSleepPod: number;
    };
    censorInteraction: Record<CensorAction | 'total', number>;
    kernelUsage: Partial<Record<KernelType, number>>;
    frictionPoints: FrictionPoint[];
    habitProfile: HabitProfile;
  };
}
```

### 8.4 需求挖掘器类型

```typescript
// types/need-miner.ts

export type NeedSource = 'PASSIVE_SIGNAL' | 'ACTIVE_TECH_TREND' | 'ACTIVE_COMPETITIVE' | 'ACTIVE_COMMUNITY';

export type NeedGapType = 'MISSING_CAPABILITY' | 'PERFORMANCE_GAP' | 'FEATURE_GAP' | 'UX_GAP' | 'STABILITY_GAP';

export type EffortLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EPIC';

export type PriorityLevel = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export type NeedStatus = 'open' | 'under_review' | 'planned' | 'rejected' | 'implemented';

export interface TriggerSignal {
  type: 'ERROR_PATTERN' | 'FRICTION_POINT' | 'METRIC_ANOMALY' | 'TECH_TREND' | 'COMPETITOR_GAP';
  description: string;
  evidence: string;
}

export interface ImpactAnalysis {
  impactScope: number;
  frequencyScore: number;
  affectedUsers: number;
  severityDescription: string;
}

export interface EffortEstimate {
  level: EffortLevel;
  storyPoints?: number;
  durationDays?: number;
}

export interface NeedPriority {
  score: number;
  level: PriorityLevel;
  label: string;
}

export interface DerivedNeed {
  needId: string;
  eventType: 'DERIVED_NEED';
  timestamp: string;
  source: NeedSource;
  title: string;
  description: string;
  triggerSignals: TriggerSignal[];
  affectedComponents: string[];
  impactAnalysis: ImpactAnalysis;
  effortEstimate: EffortEstimate;
  priority: NeedPriority;
  strategicValue: number;
  confidence: number;
  recommendation: string;
  status: NeedStatus;
  privacy: {
    containsUserBehavior: boolean;
    approvedForUpload: boolean;
  };
}

// 被动需求发现规则
export interface DiscoveryRule {
  id: string;
  needTitle: string;
  needDescription: string;
  affectedComponents: string[];
  triggerSignals: string[];
  conditions: RuleCondition[];
  threshold: number;
  category: 'NARRATIVE_QUALITY' | 'SYSTEM_STABILITY' | 'AUTHOR_EXPERIENCE' | 'COST_EFFICIENCY' | 'TECH_DEBT';
}

export interface RuleCondition {
  source: 'error' | 'friction' | 'metric';
  pattern: string;
  metricName?: string;
  threshold: number;
  weight: number;
}
```

### 8.5 上报管道类型

```typescript
// types/reporter-pipeline.ts

export type UploadChannel = 'realtime' | 'batch' | 'offline';

export type UploadStatus = 'pending' | 'queued' | 'uploading' | 'uploaded' | 'failed' | 'rejected';

export type PipelineHealth = 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'RECOVER';

export interface SenderInfo {
  installationId: string;
  version: string;
  platform: 'win32' | 'darwin' | 'linux';
  runtime: 'node' | 'electron' | 'docker';
}

export interface PayloadMeta {
  itemCount: number;
  compressedSize: number;
  originalSize: number;
  compressionRatio: number;
}

export interface SecurityEnvelope {
  encryption: {
    algorithm: 'AES-256-GCM';
    iv: string;
    authTag: string;
    keyId: string;
  };
  signature: {
    algorithm: 'Ed25519';
    publicKeyFingerprint: string;
    value: string;
  };
}

export interface TelemetryEnvelope {
  envelopeVersion: '1.0';
  envelopeId: string;
  timestamp: string;
  sender: SenderInfo;
  channel: UploadChannel;
  sequence: number;
  payload: {
    type: 'ERROR' | 'METRICS' | 'USAGE_PATTERN' | 'DERIVED_NEED';
    data: unknown[];
    metadata: PayloadMeta;
  };
  security: SecurityEnvelope;
}

export interface UploadResult {
  success: boolean;
  deliveryId?: string;
  retryCount: number;
  latencyMs?: number;
  willRetryOffline?: boolean;
  error?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  totalTimeoutMs: number;
}

export interface AuthorTelemetryConfig {
  globalSwitch: {
    emergencyReporting: boolean;  // 只读，始终为true
    errorReporting: boolean;
    metricsReporting: boolean;
    usagePatternReporting: boolean;
    needDiscoveryReporting: boolean;
  };
  granularControls: {
    errorSeverity: Record<SeverityLevel, boolean>;
    metricCategories: Record<string, boolean>;
    usagePatternDetail: Record<string, boolean>;
  };
}

export interface PendingReviewItem {
  itemId: string;
  itemType: string;
  createdAt: string;
  preview: string;
  status: 'pending' | 'approved' | 'rejected';
}
```

---

## 9. 核心算法伪代码汇总

### 9.1 异常收集器算法

```typescript
// error-collector.ts

class ErrorCollector {
  private errorStream: EventEmitter;
  private windows: Map<string, WindowStats>;
  private windowSize: number = 300_000;   // 5分钟
  private slideInterval: number = 60_000;  // 1分钟

  // 收集异常
  async collect(error: RawError): Promise<ErrorEvent> {
    // 1. 分类
    const category = this.classifyError(error);
    const errorCode = this.getErrorCode(error);
    const errorType = error.name;

    // 2. 评估严重度
    const severity = this.autoSeverity(error, category, errorCode);

    // 3. 构建事件
    const event: ErrorEvent = {
      eventId: generateULID(),
      eventType: 'ERROR',
      timestamp: new Date().toISOString(),
      severity,
      category,
      errorCode,
      errorType,
      source: this.extractSource(error),
      context: await this.extractContext(error),
      details: this.extractDetails(error, category),
    };

    // 4. 脱敏处理
    const sanitized = this.sanitizer.sanitize(event);

    // 5. 生成指纹
    const fingerprint = this.generateFingerprint(sanitized);
    sanitized.aggregation = {
      fingerprint,
      occurrenceCount: 1,
      firstSeenAt: sanitized.timestamp,
      lastSeenAt: sanitized.timestamp,
      windowCount: 1,
      trend: 'stable',
    };

    // 6. 存入聚合窗口
    this.addToWindow(fingerprint, sanitized);

    // 7. 严重异常立即触发
    if (severity === 'P0' || severity === 'P1') {
      this.emitUrgent(sanitized);
    }

    // 8. 持久化到SQLite
    await this.db.insertError(sanitized);

    return sanitized;
  }

  // 异常分类
  classifyError(error: RawError): ErrorCategory {
    if (error.name.includes('LLM') || error.source?.includes('llm')) return 'LLM_ERR';
    if (error.name.includes('DB') || error.source?.includes('db')) return 'DB_ERR';
    if (error.name.includes('State') || error.source?.includes('state')) return 'STATE_ERR';
    if (error.source?.includes('engine')) return 'ENGINE_ERR';
    return 'SYS_ERR';
  }

  // 指纹生成
  generateFingerprint(event: ErrorEvent): string {
    const stackHash = event.details.stackHash ?? 'unknown';
    const canonical = `${event.category}|${event.errorCode}|${event.source.component}|${stackHash}`;
    return sha256(canonical);
  }

  // 严重度自动判定
  autoSeverity(error: RawError, category: ErrorCategory, code: string): SeverityLevel {
    // P0 判定
    if (code === 'SYS-005') return 'P0';
    if (code === 'DB-005' && error.meta?.poolUsed === 0) return 'P0';
    if (category === 'LLM_ERR' && error.meta?.retryCount >= 5) return 'P0';
    if (code === 'ST-002' && error.meta?.affectedMOUCount > 3) return 'P0';

    // P1 判定
    if (code === 'LLM-002') return 'P1';
    if (code === 'DB-001' && error.meta?.poolUtilization > 0.95) return 'P1';
    if (code === 'ENG-004') return 'P1';
    if (code === 'SYS-001' && error.meta?.heapRatio > 0.85) return 'P1';

    // P2 判定
    if (category === 'LLM_ERR' && error.meta?.retryCount >= 2) return 'P2';
    if (code === 'DB-003' && error.meta?.executionTimeMs > 3000) return 'P2';
    if (category === 'ENGINE_ERR') return 'P2';

    // P3 判定
    if (category === 'LLM_ERR' && error.meta?.retryCount === 1) return 'P3';
    if (code === 'SYS-003' && error.meta?.lagMs > 100) return 'P3';

    // 默认 P4
    return 'P4';
  }
}
```

### 9.2 性能指标采集器算法

```typescript
// metrics-collector.ts

class MetricsCollector {
  private ringBuffer: RingBuffer<MetricSnapshot>;
  private baselines: Map<string, MetricBaseline>;
  private histograms: Map<string, TDigest>;

  // 记录指标
  record(name: string, value: number, type: MetricType, dimensions?: MetricDimension): void {
    const snapshot: MetricSnapshot = {
      name,
      value,
      type,
      timestamp: new Date().toISOString(),
      unit: this.inferUnit(name),
      dimensions,
    };

    // 写入环形缓冲
    this.ringBuffer.push(snapshot);

    // 如果是直方图类型，更新TDigest
    if (type === 'histogram') {
      const key = this.buildMetricKey(name, dimensions);
      let digest = this.histograms.get(key);
      if (!digest) {
        digest = new TDigest();
        this.histograms.set(key, digest);
      }
      digest.push(value);
    }

    // Counter 增量持久化
    if (type === 'counter') {
      this.db.incrementCounter(name, value, dimensions);
    }
  }

  // 生成分钟级批量
  async generateMinuteBatch(): Promise<MetricsBatch> {
    const windowEnd = Date.now();
    const windowStart = windowEnd - 60_000;

    // 从环形缓冲提取数据
    const snapshots = this.ringBuffer.extractRange(windowStart, windowEnd);

    // 按指标名聚合
    const aggregated = this.aggregateByName(snapshots);

    // 计算直方图分位值
    for (const metric of aggregated) {
      if (metric.type === 'histogram') {
        const key = this.buildMetricKey(metric.name, metric.dimensions);
        const digest = this.histograms.get(key);
        if (digest) {
          metric.histogram = {
            count: digest.count(),
            sum: digest.sum(),
            min: digest.min(),
            max: digest.max(),
            buckets: digest.toBuckets(),
            percentiles: {
              p50: digest.percentile(0.5),
              p90: digest.percentile(0.9),
              p95: digest.percentile(0.95),
              p99: digest.percentile(0.99),
            },
          };
          metric.value = metric.histogram;
        }
      }
    }

    return {
      batchId: generateULID(),
      eventType: 'METRICS',
      timestamp: new Date(windowEnd).toISOString(),
      collectionInterval: {
        startTime: new Date(windowStart).toISOString(),
        endTime: new Date(windowEnd).toISOString(),
        durationMs: windowEnd - windowStart,
      },
      metrics: aggregated,
      metadata: {
        sdkVersion: SDK_VERSION,
        collectorVersion: COLLECTOR_VERSION,
        samplesCollected: snapshots.length,
        samplesDropped: this.ringBuffer.droppedCount,
      },
    };
  }

  // 动态基线更新（每日执行）
  async updateBaselines(): Promise<void> {
    const windowEnd = Date.now();
    const windowStart = windowEnd - 7 * 86400_000; // 7天

    for (const metricName of this.getAllMetricNames()) {
      const history = await this.db.getMetricHistory(metricName, windowStart, windowEnd);
      if (history.length < 24) continue; // 数据不足

      // 去噪
      const clean = this.removeOutliers(history);

      // 趋势分解
      const trend = this.calculateMovingAverage(clean, 24);
      const detrended = clean.map((v, i) => v.value - trend[i]);

      // 季节性检测
      const hourlyPattern = this.extractHourlyPattern(detrended, clean);

      // 计算统计量
      const expected = mean(detrended) + trend[trend.length - 1];
      const std = stdDev(detrended);

      const baseline: MetricBaseline = {
        metricName,
        expectedValue: expected,
        lowerBound: expected - 2 * std,
        upperBound: expected + 2 * std,
        stdDev: std,
        sampleCount: clean.length,
        windowStart,
        windowEnd,
        trendSlope: linearRegressionSlope(trend.slice(-24)),
        seasonalityPattern: hourlyPattern,
        confidence: Math.min(clean.length / 168, 1.0), // 168 = 7天*24小时
        lastUpdated: windowEnd,
      };

      this.baselines.set(metricName, baseline);
      await this.db.upsertBaseline(baseline);
    }
  }

  // 异常检测
  detectAnomaly(metricName: string, currentValue: number, dimensions?: MetricDimension): AnomalyResult {
    const baseline = this.baselines.get(this.buildMetricKey(metricName, dimensions));
    if (!baseline || baseline.confidence < 0.5) {
      return { isAnomaly: false, confidence: 0 };
    }

    // 季节性调整
    let adjusted = currentValue;
    const hour = new Date().getHours();
    if (baseline.seasonalityPattern && baseline.seasonalityPattern[hour]) {
      adjusted -= baseline.seasonalityPattern[hour];
    }

    // Z-Score
    const deviation = adjusted - baseline.expectedValue;
    const zScore = baseline.stdDev > 0 ? deviation / baseline.stdDev : 0;

    // 综合评分
    let anomalyScore = 0;
    if (Math.abs(zScore) > 3) anomalyScore += 1.0;
    else if (Math.abs(zScore) > 2) anomalyScore += 0.7;
    else if (Math.abs(zScore) > 1.5) anomalyScore += 0.4;

    const threshold = 0.9; // medium sensitivity

    if (anomalyScore >= threshold) {
      return {
        isAnomaly: true,
        severity: anomalyScore >= 1.5 ? 'critical' : anomalyScore >= 1.0 ? 'warning' : 'minor',
        direction: deviation > 0 ? 'up' : 'down',
        confidence: Math.min(anomalyScore, 1.0),
        zScore,
        deviation,
      };
    }

    return { isAnomaly: false, confidence: 1 - anomalyScore };
  }
}
```

### 9.3 上报管道算法

```typescript
// reporter-pipeline.ts

class ReporterPipeline {
  private health: PipelineHealth = 'HEALTHY';
  private offlineQueue: UploadQueue;
  private wsConnection?: WebSocket;

  // 主上报入口
  async report(dataItems: unknown[], channel: UploadChannel): Promise<UploadResult> {
    // 1. 检查健康状态
    if (this.health === 'OFFLINE' && channel !== 'offline') {
      await this.persistToLocalQueue(dataItems, channel);
      return { success: false, retryCount: 0, willRetryOffline: true, error: 'PIPELINE_OFFLINE' };
    }

    // 2. 构建信封
    const envelope = await this.buildEnvelope(dataItems, channel);

    // 3. 选择传输通道
    const transport = this.selectTransport(channel);

    // 4. 弹性传输
    const result = await this.resilientTransmit(envelope, transport, this.getRetryConfig(channel));

    // 5. 更新健康状态
    this.updateHealth(result);

    return result;
  }

  // 构建信封
  async buildEnvelope(dataItems: unknown[], channel: UploadChannel): Promise<TelemetryEnvelope> {
    // 预处理
    const processed = dataItems
      .filter(item => !this.isAlreadyReported(item))
      .map(item => this.sanitizer.sanitize(item));

    // 序列化 + 压缩 + 加密 + 签名
    const rawJson = JSON.stringify({
      type: this.inferPayloadType(processed),
      data: processed,
    });
    const compressed = lz4Compress(Buffer.from(rawJson));
    const iv = crypto.randomBytes(12);
    const { ciphertext, authTag } = this.encrypt(compressed, iv);
    const toSign = Buffer.concat([iv, ciphertext, Buffer.from(Date.now().toString())]);
    const signature = ed25519Sign(toSign, this.config.signingKey);

    return {
      envelopeVersion: '1.0',
      envelopeId: generateULID(),
      timestamp: new Date().toISOString(),
      sender: {
        installationId: this.config.installationId,
        version: this.config.appVersion,
        platform: process.platform as 'win32' | 'darwin' | 'linux',
        runtime: this.detectRuntime(),
      },
      channel,
      sequence: this.getNextSequence(),
      payload: {
        type: this.inferPayloadType(processed),
        data: processed,
        metadata: {
          itemCount: processed.length,
          compressedSize: compressed.length,
          originalSize: rawJson.length,
          compressionRatio: compressed.length / rawJson.length,
        },
      },
      security: {
        encryption: {
          algorithm: 'AES-256-GCM',
          iv: iv.toString('base64'),
          authTag: authTag.toString('base64'),
          keyId: this.config.keyId,
        },
        signature: {
          algorithm: 'Ed25519',
          publicKeyFingerprint: this.config.publicKeyFingerprint,
          value: signature.toString('base64'),
        },
      },
    };
  }

  // 弹性传输
  async resilientTransmit(
    envelope: TelemetryEnvelope,
    transport: TransportAdapter,
    retryConfig: RetryConfig
  ): Promise<UploadResult> {
    let retryCount = 0;
    const deadline = Date.now() + retryConfig.totalTimeoutMs;

    while (retryCount <= retryConfig.maxRetries && Date.now() < deadline) {
      try {
        const result = await transport.send(envelope, { timeout: 15000 });

        if (result.status === 'ACK') {
          this.markAsDelivered(envelope.envelopeId, result.deliveryId);
          return { success: true, deliveryId: result.deliveryId, retryCount, latencyMs: Date.now() - start };
        }

        if (result.status === 'RATE_LIMITED') {
          await sleep(result.retryAfterMs ?? this.exponentialBackoff(retryCount, retryConfig));
          continue;
        }

        if (result.status === 'REJECTED') {
          return { success: false, retryCount, error: result.reason };
        }
      } catch (error) {
        if (this.isFatalError(error)) {
          return { success: false, retryCount, error: error.message };
        }

        const delay = this.exponentialBackoff(retryCount, retryConfig);
        await sleep(delay * (0.75 + Math.random() * 0.5)); // 添加抖动
        retryCount++;
      }
    }

    // 重试耗尽，存入离线队列
    await this.persistToLocalQueue([envelope], envelope.channel);
    this.scheduleOfflineRetry(envelope.envelopeId);
    return { success: false, retryCount, willRetryOffline: true, error: 'MAX_RETRIES_EXHAUSTED' };
  }

  // 指数退避
  exponentialBackoff(retryCount: number, config: RetryConfig): number {
    const delay = config.baseDelayMs * Math.pow(2, retryCount);
    return Math.min(delay, config.maxDelayMs);
  }

  // 健康状态管理
  private updateHealth(result: UploadResult): void {
    if (result.success) {
      if (this.health === 'DEGRADED' || this.health === 'OFFLINE') {
        this.health = 'RECOVER';
        this.triggerOfflineSync();
      } else if (this.health === 'RECOVER') {
        this.health = 'HEALTHY';
      }
    } else {
      this.consecutiveFailures++;
      if (this.consecutiveFailures > 3) {
        this.health = 'DEGRADED';
      }
      if (this.consecutiveFailures > 10) {
        this.health = 'OFFLINE';
      }
    }
  }

  // 离线数据同步
  async triggerOfflineSync(): Promise<void> {
    const pending = await this.db.getPendingUploads(100);
    for (const batch of chunk(pending, 10)) {
      await this.report(batch, 'offline');
    }
    if (pending.length === 100) {
      // 还有更多，继续同步
      setTimeout(() => this.triggerOfflineSync(), 5000);
    }
  }
}
```

---

## 附录

### A. 指标命名规范

所有指标统一采用 `维度.指标名` 的命名格式：

```
llm.call_count           -- LLM调用次数
db.qps                   -- 数据库QPS
eng.world_sim_duration   -- 世界引擎推演耗时
biz.chapter_gen_time     -- 章节生成时间
sys.cpu_percent          -- CPU使用率
```

### B. 事件类型编码

| 事件类型 | 编码 | 说明 |
|----------|------|------|
| ERROR | `ERROR` | 异常事件 |
| METRICS | `METRICS` | 性能指标批量 |
| USAGE_PATTERN | `USAGE_PATTERN` | 使用模式报告 |
| DERIVED_NEED | `DERIVED_NEED` | 推导需求 |

### C. 异常编码对照表

| 大类前缀 | 范围 | 说明 |
|----------|------|------|
| LLM- | 001-099 | LLM调用异常 |
| DB- | 001-099 | 数据库异常 |
| ST- | 001-099 | 状态机异常 |
| ENG- | 001-099 | 引擎异常 |
| SYS- | 001-099 | 系统异常 |

### D. 数据量估算

| 数据类型 | 单条大小 | 每日生成量 | 日存储需求 |
|----------|----------|-----------|-----------|
| P0-P1 异常 | 2-5 KB | 0-10 条 | 0-50 KB |
| P2-P4 异常 | 1-3 KB | 50-200 条 | 50-600 KB |
| 分钟级指标 | 5-10 KB | 1440 批次 | 7-14 MB |
| 使用模式 | 3-5 KB | 24-48 份 | 72-240 KB |
| 需求推导 | 2-4 KB | 0-5 条 | 0-20 KB |
| **合计** | — | — | **~8-15 MB/天** |

按 P2 保留 30 天、P0 保留 365 天计算，SQLite 数据库峰值约 **500 MB**，完全在本地存储可接受范围内。

---

> **文档结束**  
> 本设计文档为 DevAgent Cluster 的 Runtime Telemetry Layer 提供了完整的技术规范。后续实现应严格遵循本文档定义的 Schema、接口和算法。所有组件的实现代码须通过隐私合规审查后方可集成到主分支。
