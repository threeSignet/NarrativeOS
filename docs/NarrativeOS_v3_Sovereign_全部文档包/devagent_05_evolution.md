> [!WARNING] **[DEPRECATED] 本文档已废弃 — 2026-05-20**
> 原 P9 DevAgent 集群（5 层架构）不再另建代码实现。Claude Code 直接担任开发维护角色（见 `CLAUDE.md` §"自动化开发维护角色"）。
> 知识库与进化功能已通过 Claude Code 的 session memory（`C:\Users\10652\.claude\projects\...\memory\`）实现。
> 本文档保留为参考档案，其中知识库设计理念可作为未来需要时参考，但不做实现承诺。

# NarrativeOS v3.0 Sovereign — 第五层：知识库与进化引擎

## Knowledge & Evolution Engine (KEE)

> **版本**: v3.0.0-design  
> **作者**: DevAgent Cluster — Architecture Layer  
> **状态**: [DEPRECATED] 设计规格文档（参考档案，不实现）  
> **技术栈**: TypeScript + PostgreSQL 16 + pgvector + XState + LLM API  

---

## 目录

1. [架构总览](#1-架构总览)
2. [问题知识库 IssueKnowledgeBase](#2-问题知识库-issueknowledgebase)
3. [代码记忆库 CodeMemory](#3-代码记忆库-codememory)
4. [进化历史树 EvolutionHistoryTree](#4-进化历史树-evolutionhistorytree)
5. [能力成长追踪 CapabilityGrowthTracker](#5-能力成长追踪-capabilitygrowthtracker)
6. [进化策略引擎 EvolutionStrategyEngine](#6-进化策略引擎-evolutionstrategyengine)
7. [知识共享与学习](#7-知识共享与学习)
8. [隐私保护方案](#8-隐私保护方案)
9. [TypeScript 接口定义](#9-typescript-接口定义)
10. [可视化面板设计规格](#10-可视化面板设计规格)
11. [PostgreSQL 数据库 Schema](#11-postgresql-数据库-schema)
12. [XState 状态机定义](#12-xstate-状态机定义)

---

## 1. 架构总览

### 1.1 设计哲学

知识库与进化引擎遵循四个核心信念：

| 信念 | 含义 | 工程表达 |
|------|------|----------|
| **经验即资产** | 每次修复都是学习机会 | 每次运维事件自动入库，形成可检索的知识 |
| **模式可复用** | 相似问题应有相似解法 | 向量语义检索 + 签名精确匹配双路召回 |
| **能力可量化** | 系统知道自己会什么 | 五维能力评分 + 成长曲线追踪 |
| **进化有方向** | 朝着更好的作者体验进化 | 三层进化策略 + 约束护栏 + 刹车机制 |

### 1.2 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                    第五层：知识库与进化引擎 (KEE)                     │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ IssueKnowledge   │  │   CodeMemory     │  │EvolutionHistory  │  │
│  │     Base         │  │                  │  │      Tree        │  │
│  │  (问题知识库)     │  │  (代码记忆库)     │  │   (进化历史树)    │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                     │                     │            │
│           └─────────────────────┼─────────────────────┘            │
│                                 ▼                                  │
│                    ┌────────────────────────┐                      │
│                    │  CapabilityGrowth      │                      │
│                    │      Tracker           │                      │
│                    │   (能力成长追踪)        │                      │
│                    └───────────┬────────────┘                      │
│                                ▼                                   │
│                    ┌────────────────────────┐                      │
│                    │  EvolutionStrategy     │                      │
│                    │      Engine            │                      │
│                    │   (进化策略引擎)        │                      │
│                    └───────────┬────────────┘                      │
│                                ▼                                   │
│           ┌──────────────────────────────────────┐                 │
│           │     Knowledge Sharing & Privacy      │                 │
│           │        (知识共享与隐私保护)            │                 │
│           └──────────────────────────────────────┘                 │
│                                ▼                                   │
│           ┌──────────────────────────────────────┐                 │
│           │     Evolution Dashboard (可视化面板)  │                 │
│           └──────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL 16 + pgvector                    │
│              (知识持久化存储 + 向量语义检索)                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 数据流转图

```
运维事件产生 ──▶ 问题签名生成 ──┬──▶ IssueKnowledgeBase (入库)
                              │
                              ├──▶ CodeMemory (代码变更记录)
                              │
                              ├──▶ EvolutionHistoryTree (版本节点)
                              │
                              └──▶ CapabilityGrowthTracker (能力评分)
                                           │
                                           ▼
                              EvolutionStrategyEngine (进化决策)
                                           │
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                           被动进化      主动进化      探索进化
                           (问题驱动)   (目标驱动)    (实验驱动)
                              │            │            │
                              └────────────┼────────────┘
                                           ▼
                                   知识复用与共享
                                           │
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                           经验复用      模式学习      联邦优化
```

### 1.4 核心数据流向

| 源组件 | 目标组件 | 数据内容 | 触发时机 |
|--------|----------|----------|----------|
| 运维事件 | IssueKnowledgeBase | 问题签名、根因、修复方案 | 每次问题解决后 |
| 代码变更 | CodeMemory | diff、变更原因、结果 | 每次代码提交 |
| 部署事件 | EvolutionHistoryTree | 版本信息、性能基线 | 每次部署 |
| 所有组件 | CapabilityGrowthTracker | 能力指标、评分 | 实时/定期 |
| CapabilityGrowthTracker | EvolutionStrategyEngine | 成长报告、瓶颈分析 | 定期触发 |
| EvolutionStrategyEngine | 所有组件 | 进化指令、策略调整 | 决策触发 |

---

## 2. 问题知识库 IssueKnowledgeBase

### 2.1 核心设计理念

IssueKnowledgeBase 是系统的"集体记忆"。每个问题都被赋予一个**问题签名（IssueSignature）**，这是由问题类型、错误模式和上下文特征组合而成的唯一指纹。当新问题出现时，系统通过签名精确匹配和语义向量相似度双路检索，找到最相似的历史问题，推荐修复方案。

### 2.2 问题签名算法 (IssueSignature)

```
问题签名 = hash(问题类型分类 + 错误模式编码 + 上下文特征向量)

问题类型分类（层级）:
  L1: 系统层 / 应用层 / 数据层 / 网络层 / 外部依赖
  L2: 错误 / 性能 / 安全 / 兼容性 / 资源
  L3: 具体细分 (如: 数据库连接池耗尽)

错误模式编码（标准化）:
  - 错误代码规范化 (如将 ECONNRESET → "连接重置")
  - 堆栈跟踪哈希（取前5帧的函数名组合哈希）
  - 错误消息模板化（将变量部分替换为占位符）

上下文特征:
  - 运行时环境 (Node版本、OS、架构)
  - 系统状态 (内存使用、CPU负载、连接数)
  - 时间特征 (时段、是否高峰期)
  - 操作上下文 (哪个模块、什么操作)
```

### 2.3 完整 JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "IssueKnowledgeEntry",
  "description": "问题知识库单条记录结构",
  "type": "object",
  "required": ["id", "signature", "description", "rootCause", "fix", "metadata"],
  "properties": {
    "id": {
      "type": "string",
      "description": "知识条目唯一ID，格式: ISS-{timestamp}-{hash}",
      "pattern": "^ISS-[0-9]{14}-[a-f0-9]{8}$"
    },
    "signature": {
      "type": "object",
      "description": "问题签名——唯一指纹",
      "required": ["typeHash", "patternHash", "contextHash", "fullSignature"],
      "properties": {
        "typeHash": {
          "type": "string",
          "description": "L1+L2+L3类型哈希",
          "example": "app.error.db-connection-pool-exhausted"
        },
        "patternHash": {
          "type": "string", 
          "description": "错误模式哈希（标准化后的错误）"
        },
        "contextHash": {
          "type": "string",
          "description": "上下文特征哈希"
        },
        "fullSignature": {
          "type": "string",
          "description": "完整签名 = SHA256(typeHash + patternHash + contextHash)"
        },
        "confidence": {
          "type": "number",
          "description": "签名置信度 (0-1)",
          "minimum": 0,
          "maximum": 1
        }
      }
    },
    "description": {
      "type": "object",
      "required": ["title", "detail"],
      "properties": {
        "title": {
          "type": "string",
          "description": "问题标题（标准化）",
          "maxLength": 200
        },
        "detail": {
          "type": "string",
          "description": "详细问题描述"
        },
        "impact": {
          "type": "object",
          "properties": {
            "severity": {
              "type": "string",
              "enum": ["critical", "high", "medium", "low"]
            },
            "scope": {
              "type": "array",
              "items": { "type": "string" },
              "description": "影响范围 (模块列表)"
            },
            "affectedUsers": {
              "type": "string",
              "enum": ["all", "some", "single", "none"]
            }
          }
        }
      }
    },
    "rootCause": {
      "type": "object",
      "required": ["category", "analysis"],
      "properties": {
        "category": {
          "type": "string",
          "enum": ["technical", "architectural", "external_dependency", "configuration", "human_error", "unknown"]
        },
        "analysis": {
          "type": "string",
          "description": "根因分析文字描述"
        },
        "technical": {
          "type": "object",
          "description": "技术原因详情",
          "properties": {
            "component": { "type": "string" },
            "errorCode": { "type": "string" },
            "errorMessage": { "type": "string" },
            "stackTraceHash": { "type": "string" }
          }
        },
        "architectural": {
          "type": "object",
          "description": "架构原因详情",
          "properties": {
            "missingPattern": { "type": "string", "description": "缺失的设计模式" },
            "couplingIssue": { "type": "string" },
            "scalabilityLimit": { "type": "string" }
          }
        },
        "externalDependency": {
          "type": "object",
          "description": "外部依赖原因",
          "properties": {
            "service": { "type": "string" },
            "version": { "type": "string" },
            "changeDescription": { "type": "string" }
          }
        }
      }
    },
    "fix": {
      "type": "object",
      "required": ["applied"],
      "properties": {
        "applied": {
          "type": "object",
          "description": "采用的修复方案",
          "required": ["strategy", "description"],
          "properties": {
            "strategy": {
              "type": "string",
              "enum": ["code_fix", "config_change", "rollback", "workaround", "dependency_upgrade", "architecture_refactor", "monitoring_enhancement"]
            },
            "description": { "type": "string" },
            "codeDiff": { "type": "string", "description": "代码diff（patch格式）" },
            "keySnippet": { "type": "string", "description": "关键代码片段" },
            "filesChanged": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "path": { "type": "string" },
                  "changeType": { "type": "string", "enum": ["add", "modify", "delete"] },
                  "linesAdded": { "type": "number" },
                  "linesRemoved": { "type": "number" }
                }
              }
            }
          }
        },
        "alternatives": {
          "type": "array",
          "description": "备选方案",
          "items": {
            "type": "object",
            "properties": {
              "strategy": { "type": "string" },
              "description": { "type": "string" },
              "rejectedReason": { "type": "string" }
            }
          }
        },
        "selectionRationale": {
          "type": "string",
          "description": "方案选择理由"
        }
      }
    },
    "verification": {
      "type": "object",
      "description": "验证结果",
      "properties": {
        "testReport": {
          "type": "object",
          "properties": {
            "testsPassed": { "type": "number" },
            "testsFailed": { "type": "number" },
            "coverage": { "type": "number" }
          }
        },
        "deploymentResult": {
          "type": "string",
          "enum": ["success", "partial", "failed", "rolled_back"]
        },
        "authorFeedback": {
          "type": "object",
          "properties": {
            "rating": { "type": "number", "minimum": 1, "maximum": 5 },
            "comment": { "type": "string" },
            "wouldRecommend": { "type": "boolean" }
          }
        },
        "metricsBefore": {
          "type": "object",
          "description": "修复前指标"
        },
        "metricsAfter": {
          "type": "object",
          "description": "修复后指标"
        }
      }
    },
    "metadata": {
      "type": "object",
      "required": ["createdAt", "status"],
      "properties": {
        "createdAt": { "type": "string", "format": "date-time" },
        "resolvedAt": { "type": "string", "format": "date-time" },
        "resolutionTime": { "type": "number", "description": "解决耗时（分钟）" },
        "status": {
          "type": "string",
          "enum": ["open", "analyzing", "fixing", "verifying", "resolved", "closed", "reopened"]
        },
        "source": {
          "type": "string",
          "enum": ["auto_detected", "author_reported", "monitoring_alert", "proactive_check"]
        },
        "relatedTickets": {
          "type": "array",
          "items": { "type": "string" }
        },
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        },
        "relatedIssues": {
          "type": "array",
          "items": { "type": "string" },
          "description": "关联的其他知识条目ID"
        },
        "autoResolved": { "type": "boolean" },
        "authorApproved": { "type": "boolean" }
      }
    },
    "embeddings": {
      "type": "object",
      "description": "pgvector 嵌入向量",
      "properties": {
        "description": {
          "type": "array",
          "description": "问题描述的向量表示 (1536维)",
          "items": { "type": "number" }
        },
        "stackTrace": {
          "type": "array", 
          "description": "堆栈跟踪的向量表示 (1536维)",
          "items": { "type": "number" }
        },
        "solution": {
          "type": "array",
          "description": "解决方案的向量表示 (1536维)",
          "items": { "type": "number" }
        }
      }
    }
  }
}
```

### 2.4 知识检索策略

#### 2.4.1 双路召回检索

```typescript
// 检索流程
async function retrieveSimilarIssues(query: IssueQuery): Promise<RetrievalResult> {
  // 第一路：精确签名匹配（高置信度，快速）
  const signatureMatches = await exactSignatureMatch(query.signature);
  
  // 第二路：语义向量检索（发现相似但非相同的问题）
  const semanticMatches = await semanticVectorSearch(query.description);
  
  // 融合排序
  const fused = fusionRank(signatureMatches, semanticMatches, {
    signatureWeight: 0.6,   // 精确匹配权重更高
    semanticWeight: 0.4,    // 语义匹配补充
    crossEncoderRerank: true // 使用交叉编码器重排序
  });
  
  return fused;
}
```

#### 2.4.2 pgvector 检索 SQL

```sql
-- 语义相似度检索（使用pgvector）
SELECT 
  id,
  signature->>'fullSignature' as signature,
  description->>'title' as title,
  1 - (embeddings_description <=> $1::vector) as similarity_score,
  fix->'applied'->>'strategy' as fix_strategy,
  verification->>'deploymentResult' as deploy_result
FROM issue_knowledge_base
WHERE 1 - (embeddings_description <=> $1::vector) > $2  -- 阈值过滤
ORDER BY embeddings_description <=> $1::vector
LIMIT $3;

-- 组合检索：签名匹配 + 语义相似度
SELECT 
  id,
  description->>'title' as title,
  CASE 
    WHEN signature->>'fullSignature' = $1 THEN 1.0
    ELSE 1 - (embeddings_description <=> $2::vector)
  END as relevance_score
FROM issue_knowledge_base
WHERE signature->>'fullSignature' = $1 
   OR 1 - (embeddings_description <=> $2::vector) > 0.7
ORDER BY relevance_score DESC
LIMIT 10;
```

### 2.5 知识进化流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  新问题产生  │────▶│  签名生成    │────▶│  知识库检索  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                          ┌─────────────────────┼─────────────────────┐
                          ▼                     ▼                     ▼
                    ┌───────────┐        ┌───────────┐        ┌───────────┐
                    │ 完全匹配   │        │ 部分匹配   │        │ 全新问题   │
                    │ (签名一致) │        │ (语义相似) │        │ (无匹配)   │
                    └─────┬─────┘        └─────┬─────┘        └─────┬─────┘
                          │                     │                     │
                          ▼                     ▼                     ▼
                    ┌───────────┐        ┌───────────┐        ┌───────────┐
                    │ 推荐历史   │        │ 推荐相似   │        │ 创建新条目 │
                    │ 方案复用   │        │ 方案参考   │        │ 启动分析   │
                    └─────┬─────┘        └─────┬─────┘        └─────┬─────┘
                          │                     │                     │
                          └─────────────────────┼─────────────────────┘
                                                ▼
                                          ┌───────────┐
                                          │  修复执行  │
                                          └─────┬─────┘
                                                │
                                                ▼
                                          ┌───────────┐
                                          │  结果验证  │
                                          └─────┬─────┘
                                                │
                          ┌─────────────────────┼─────────────────────┐
                          ▼                     ▼                     ▼
                    ┌───────────┐        ┌───────────┐        ┌───────────┐
                    │ 修复成功   │        │ 修复失败   │        │ 需要回滚   │
                    │ 更新验证   │        │ 标记失败   │        │ 记录教训   │
                    └───────────┘        └───────────┘        └───────────┘
                          │                     │                     │
                          └─────────────────────┼─────────────────────┘
                                                ▼
                                          ┌───────────┐
                                          │ 聚类分析   │
                                          │ 发现模式   │
                                          └───────────┘
```

### 2.6 知识聚类分析

```sql
-- 定期执行：发现系统性问题模式
WITH issue_clusters AS (
  SELECT 
    signature->>'typeHash' as issue_type,
    COUNT(*) as occurrence_count,
    AVG(
      EXTRACT(EPOCH FROM (resolved_at - created_at))/60
    ) as avg_resolution_time,
    STRING_AGG(DISTINCT description->>'title', ' | ') as titles
  FROM issue_knowledge_base
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY signature->>'typeHash'
  HAVING COUNT(*) >= 3  -- 出现3次以上视为系统性问题
)
SELECT * FROM issue_clusters ORDER BY occurrence_count DESC;
```

---

## 3. 代码记忆库 CodeMemory

### 3.1 核心设计理念

CodeMemory 是系统的"肌肉记忆"。它不仅记录代码变更了什么，更重要的是记录**为什么变更**以及**变更的结果如何**。通过长期积累，系统能学习到常见的修复模式、bug 模式和最佳实践。

### 3.2 完整 JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CodeMemoryEntry",
  "description": "代码记忆库单条记录——记录一次完整的代码变更",
  "type": "object",
  "required": ["id", "change", "impact", "result", "patterns"],
  "properties": {
    "id": {
      "type": "string",
      "description": "变更唯一ID，格式: CM-{timestamp}-{hash}",
      "pattern": "^CM-[0-9]{14}-[a-f0-9]{8}$"
    },
    "change": {
      "type": "object",
      "description": "代码变更详情",
      "required": ["before", "after", "reason", "diff"],
      "properties": {
        "before": {
          "type": "object",
          "description": "变更前状态",
          "properties": {
            "files": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "path": { "type": "string" },
                  "content": { "type": "string" },
                  "checksum": { "type": "string" }
                }
              }
            },
            "version": { "type": "string" }
          }
        },
        "after": {
          "type": "object",
          "description": "变更后状态",
          "properties": {
            "files": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "path": { "type": "string" },
                  "content": { "type": "string" },
                  "checksum": { "type": "string" }
                }
              }
            },
            "version": { "type": "string" }
          }
        },
        "diff": {
          "type": "string",
          "description": "统一diff格式 (unified diff)"
        },
        "reason": {
          "type": "object",
          "required": ["trigger", "description"],
          "properties": {
            "trigger": {
              "type": "string",
              "enum": ["bug_fix", "performance", "security", "refactor", "feature", "dependency_update", "author_request"]
            },
            "description": { "type": "string" },
            "issueId": { "type": "string", "description": "关联的问题知识条目ID" }
          }
        },
        "timestamp": { "type": "string", "format": "date-time" }
      }
    },
    "impact": {
      "type": "object",
      "description": "变更影响范围分析",
      "properties": {
        "filesModified": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "path": { "type": "string" },
              "linesAdded": { "type": "number" },
              "linesRemoved": { "type": "number" },
              "linesModified": { "type": "number" },
              "complexityDelta": { "type": "number" }
            }
          }
        },
        "modulesAffected": {
          "type": "array",
          "items": { "type": "string" }
        },
        "dependenciesChanged": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "oldVersion": { "type": "string" },
              "newVersion": { "type": "string" }
            }
          }
        },
        "riskAssessment": {
          "type": "object",
          "properties": {
            "level": { "type": "string", "enum": ["low", "medium", "high", "critical"] },
            " blastRadius": { "type": "string" },
            "rollbackComplexity": { "type": "string", "enum": ["easy", "moderate", "complex", "very_complex"] }
          }
        }
      }
    },
    "result": {
      "type": "object",
      "description": "变更执行结果",
      "required": ["status"],
      "properties": {
        "status": {
          "type": "string",
          "enum": ["success", "partial_success", "failed", "rolled_back"]
        },
        "deploymentInfo": {
          "type": "object",
          "properties": {
            "deployedAt": { "type": "string", "format": "date-time" },
            "deployDuration": { "type": "number" },
            "versionTag": { "type": "string" }
          }
        },
        "metricsDelta": {
          "type": "object",
          "description": "关键指标变化",
          "properties": {
            "responseTime": { "type": "number" },
            "errorRate": { "type": "number" },
            "throughput": { "type": "number" },
            "memoryUsage": { "type": "number" },
            "cpuUsage": { "type": "number" }
          }
        },
        "authorReview": {
          "type": "object",
          "description": "作者审批/评价（如果经过审批）",
          "properties": {
            "approved": { "type": "boolean" },
            "approvalTime": { "type": "string", "format": "date-time" },
            "rating": { "type": "number", "minimum": 1, "maximum": 5 },
            "feedback": { "type": "string" },
            "modificationsRequested": { "type": "array", "items": { "type": "string" } }
          }
        }
      }
    },
    "patterns": {
      "type": "object",
      "description": "从本次变更中提取的模式",
      "properties": {
        "fixPattern": {
          "type": "object",
          "description": "修复模式（如果是修复类变更）",
          "properties": {
            "pattern": { "type": "string" },
            "description": { "type": "string" },
            "applicableTo": { "type": "array", "items": { "type": "string" } },
            "confidence": { "type": "number" }
          }
        },
        "bugPattern": {
          "type": "object",
          "description": "Bug模式（导致问题的原因模式）",
          "properties": {
            "pattern": { "type": "string" },
            "category": { "type": "string" },
            "description": { "type": "string" }
          }
        },
        "bestPractice": {
          "type": "object",
          "description": "最佳实践（高质量修复的特征）",
          "properties": {
            "practice": { "type": "string" },
            "rationale": { "type": "string" }
          }
        }
      }
    },
    "embeddings": {
      "type": "object",
      "description": "pgvector嵌入向量",
      "properties": {
        "codeChange": {
          "type": "array",
          "description": "代码变更的向量表示",
          "items": { "type": "number" }
        },
        "reason": {
          "type": "array",
          "description": "变更原因的向量表示",
          "items": { "type": "number" }
        }
      }
    }
  }
}
```

### 3.3 代码模式学习引擎

```typescript
// 模式提取器接口
interface PatternExtractor {
  // 从代码变更中提取修复模式
  extractFixPattern(entry: CodeMemoryEntry): FixPattern | null;
  
  // 从代码变更中提取bug模式  
  extractBugPattern(entry: CodeMemoryEntry): BugPattern | null;
  
  // 提取最佳实践
  extractBestPractice(entry: CodeMemoryEntry): BestPractice | null;
}

// 修复模式示例库
const FIX_PATTERN_TEMPLATES = [
  {
    id: "null-check-addition",
    name: "增加空值检查",
    pattern: "+ if (x !== null && x !== undefined)",
    applicability: ["TypeError", "cannot read property"],
    frequency: 0  // 动态统计
  },
  {
    id: "retry-mechanism",
    name: "添加错误重试",
    pattern: "+ retry(async () => { ... }, { retries: 3 })",
    applicability: ["ECONNRESET", "ETIMEDOUT", "network error"],
    frequency: 0
  },
  {
    id: "resource-cleanup",
    name: "资源清理保证",
    pattern: "+ try { ... } finally { release() }",
    applicability: ["connection leak", "memory leak"],
    frequency: 0
  },
  {
    id: "async-await-fix",
    name: "异步操作等待",
    pattern: "- fn()  + await fn()",
    applicability: ["Promise not awaited"],
    frequency: 0
  },
  {
    id: "boundary-check",
    name: "边界条件检查",
    pattern: "+ if (index >= 0 && index < array.length)",
    applicability: ["out of bounds", "index error"],
    frequency: 0
  }
];

// Bug模式模板库
const BUG_PATTERN_TEMPLATES = [
  {
    id: "missing-await",
    name: "异步操作未await",
    signature: "async function.*\n.*[^await ]\w+\(",
    severity: "high"
  },
  {
    id: "connection-leak",
    name: "数据库连接未释放",
    signature: "pool\.connect\(.*\)(?!.*release)",
    severity: "critical"
  },
  {
    id: "race-condition",
    name: "竞态条件",
    signature: "read.*modify.*write",
    severity: "high"
  }
];
```

### 3.4 代码检索接口

```typescript
interface CodeMemoryQuery {
  // 按模块检索
  module?: string;
  
  // 按变更类型检索
  changeType?: "bug_fix" | "performance" | "security" | "refactor" | "feature";
  
  // 按结果检索
  resultStatus?: "success" | "failed" | "rolled_back";
  
  // 按模式检索
  patternType?: "fix" | "bug" | "best_practice";
  
  // 时间范围
  timeRange?: { start: Date; end: Date };
  
  // 语义检索查询
  semanticQuery?: string;
  
  // 分页
  limit?: number;
  offset?: number;
}

// pgvector语义检索SQL
const SEMANTIC_CODE_SEARCH_SQL = `
SELECT 
  cm.id,
  cm.change->>'diff' as diff_preview,
  cm.change->'reason'->>'description' as reason,
  cm.result->>'status' as result_status,
  1 - (cm.embeddings_code_change <=> $1::vector) as similarity
FROM code_memory cm
WHERE ($2::text IS NULL OR $2 = ANY(
  SELECT jsonb_array_elements_text(cm.impact->'modulesAffected')
))
AND ($3::text IS NULL OR cm.change->'reason'->>'trigger' = $3)
AND ($4::text IS NULL OR cm.result->>'status' = $4)
AND 1 - (cm.embeddings_code_change <=> $1::vector) > 0.6
ORDER BY cm.embeddings_code_change <=> $1::vector
LIMIT $5 OFFSET $6;
`;
```



---

## 4. 进化历史树 EvolutionHistoryTree

### 4.1 核心设计理念

进化历史树将系统的每次部署视为树上的一个节点。根节点是 v3.0 的初始版本，子节点代表在该版本基础上的变更。分支表示并行变更线，合并表示多条线的整合。通过这棵树，系统可以：追踪演进路径、快速回滚、比较版本差异、找到最优升级路径。

### 4.2 树形数据结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "EvolutionHistoryTree",
  "description": "进化历史树——完整的版本演进记录",
  "type": "object",
  "required": ["root", "nodes", "edges"],
  "properties": {
    "root": {
      "type": "string",
      "description": "根节点ID"
    },
    "nodes": {
      "type": "array",
      "description": "所有版本节点",
      "items": {
        "$ref": "#/definitions/VersionNode"
      }
    },
    "edges": {
      "type": "array",
      "description": "节点间的父子/合并关系",
      "items": {
        "$ref": "#/definitions/VersionEdge"
      }
    },
    "currentHead": {
      "type": "string",
      "description": "当前部署的节点ID"
    }
  },
  "definitions": {
    "VersionNode": {
      "type": "object",
      "required": ["id", "version", "deployedAt"],
      "properties": {
        "id": {
          "type": "string",
          "description": "节点唯一ID",
          "pattern": "^VN-[0-9]{14}-[a-f0-9]{6}$"
        },
        "version": {
          "type": "string",
          "description": "语义化版本号",
          "pattern": "^v\\d+\\.\\d+\\.\\d+(-\\w+)?$"
        },
        "parentIds": {
          "type": "array",
          "items": { "type": "string" },
          "description": "父节点ID列表（多个表示合并）"
        },
        "deployedAt": {
          "type": "string",
          "format": "date-time"
        },
        "deployedBy": {
          "type": "string",
          "enum": ["auto", "author", "system"]
        },
        "changeSummary": {
          "type": "object",
          "description": "变更摘要",
          "properties": {
            "title": { "type": "string" },
            "description": { "type": "string" },
            "changeType": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": ["bug_fix", "optimization", "refactor", "feature", "dependency_update", "config_change", "security_patch"]
              }
            },
            "filesChanged": { "type": "number" },
            "linesAdded": { "type": "number" },
            "linesRemoved": { "type": "number" }
          }
        },
        "performanceBaseline": {
          "type": "object",
          "description": "该版本的性能基线",
          "properties": {
            "responseTimeP50": { "type": "number" },
            "responseTimeP95": { "type": "number" },
            "responseTimeP99": { "type": "number" },
            "throughputRPS": { "type": "number" },
            "errorRate": { "type": "number" },
            "cpuUsage": { "type": "number" },
            "memoryUsageMB": { "type": "number" },
            "dbConnectionPoolUsage": { "type": "number" }
          }
        },
        "stabilityScore": {
          "type": "object",
          "description": "稳定性评分",
          "properties": {
            "score": { "type": "number", "minimum": 0, "maximum": 100 },
            "errorRate": { "type": "number" },
            "rollbackCount": { "type": "number" },
            "uptimeHours": { "type": "number" },
            "incidentCount": { "type": "number" }
          }
        },
        "authorSatisfaction": {
          "type": "object",
          "description": "作者满意度（如果使用反馈数据）",
          "properties": {
            "rating": { "type": "number", "minimum": 1, "maximum": 5 },
            "feedbackCount": { "type": "number" },
            "wouldRecommend": { "type": "number", "minimum": 0, "maximum": 1 }
          }
        },
        "labels": {
          "type": "array",
          "items": { "type": "string" },
          "description": "标签，如 stable, experimental, rollback-point"
        },
        "metadata": {
          "type": "object",
          "properties": {
            "deploymentDuration": { "type": "number" },
            "rollbackTargetId": { "type": "string" },
            "associatedIssueIds": {
              "type": "array",
              "items": { "type": "string" }
            },
            "associatedCodeMemoryIds": {
              "type": "array",
              "items": { "type": "string" }
            }
          }
        }
      }
    },
    "VersionEdge": {
      "type": "object",
      "required": ["from", "to", "type"],
      "properties": {
        "from": { "type": "string", "description": "源节点ID" },
        "to": { "type": "string", "description": "目标节点ID" },
        "type": {
          "type": "string",
          "enum": ["parent_child", "merge", "rollback"],
          "description": "关系类型"
        },
        "metadata": {
          "type": "object",
          "properties": {
            "mergeStrategy": {
              "type": "string",
              "enum": ["auto_merge", "manual_resolve"]
            },
            "rollbackReason": { "type": "string" }
          }
        }
      }
    }
  }
}
```

### 4.3 树操作接口

```typescript
interface EvolutionHistoryTreeOps {
  // 添加新节点（新部署）
  addNode(params: {
    version: string;
    parentIds: string[];
    changeSummary: ChangeSummary;
    performanceBaseline: PerformanceBaseline;
    deployedBy: "auto" | "author" | "system";
  }): VersionNode;

  // 回滚到指定节点
  rollbackTo(nodeId: string): {
    targetNode: VersionNode;
    rollbackPlan: RollbackPlan;
    affectedNodes: VersionNode[];
  };

  // 比较两个节点
  compareNodes(nodeA: string, nodeB: string): {
    codeDiff: string;
    performanceDelta: PerformanceDelta;
    stabilityDelta: StabilityDelta;
    changeList: ChangeSummary[];
  };

  // 查找最优升级路径
  findOptimalPath(fromNode: string, toTarget: string): {
    path: string[];  // 节点ID序列
    estimatedRisk: number;
    estimatedTime: number;
    recommendedSteps: string[];
  };

  // 获取当前分支的所有祖先
  getAncestors(nodeId: string): VersionNode[];

  // 获取当前分支的所有后代
  getDescendants(nodeId: string): VersionNode[];

  // 获取叶子节点（活跃分支末端）
  getLeafNodes(): VersionNode[];

  // 查找最稳定的历史版本
  findMostStableVersion(minAge?: number): VersionNode;

  // 查找性能最好的版本
  findBestPerformanceVersion(): VersionNode;
}
```

### 4.4 树的可视化JSON表示

```json
{
  "tree": {
    "root": "VN-20240101000000-abc123",
    "currentHead": "VN-20240315000000-xyz789",
    "nodes": {
      "VN-20240101000000-abc123": {
        "version": "v3.0.0",
        "label": "初始版本",
        "status": "stable",
        "stabilityScore": 85
      },
      "VN-20240115000000-def456": {
        "version": "v3.0.1",
        "parent": "VN-20240101000000-abc123",
        "label": "Bug修复",
        "status": "stable",
        "stabilityScore": 92
      },
      "VN-20240201000000-ghi789": {
        "version": "v3.1.0",
        "parent": "VN-20240115000000-def456",
        "label": "性能优化",
        "status": "stable",
        "stabilityScore": 95
      },
      "VN-20240210000000-jkl012": {
        "version": "v3.1.1-hotfix",
        "parent": "VN-20240115000000-def456",
        "label": "紧急热修",
        "status": "rolled_back",
        "stabilityScore": 30
      },
      "VN-20240215000000-mno345": {
        "version": "v3.1.1",
        "parent": "VN-20240201000000-ghi789",
        "label": "稳定版本",
        "status": "stable",
        "stabilityScore": 96
      },
      "VN-20240315000000-xyz789": {
        "version": "v3.2.0",
        "parent": "VN-20240215000000-mno345",
        "label": "当前版本",
        "status": "current",
        "stabilityScore": 94
      }
    },
    "layout": {
      "type": "tree",
      "direction": "top-down",
      "nodeSpacing": 60,
      "levelSpacing": 100
    }
  }
}
```

### 4.5 PostgreSQL 树存储

```sql
-- 版本节点表（使用ltree扩展支持树查询）
CREATE EXTENSION IF NOT EXISTS ltree;

CREATE TABLE version_nodes (
  id VARCHAR(32) PRIMARY KEY,
  version VARCHAR(32) NOT NULL,
  parent_ids TEXT[] DEFAULT '{}',
  tree_path LTREE,  -- 树路径，用于快速祖先/后代查询
  deployed_at TIMESTAMPTZ DEFAULT NOW(),
  deployed_by VARCHAR(10) CHECK (deployed_by IN ('auto', 'author', 'system')),
  change_summary JSONB NOT NULL DEFAULT '{}',
  performance_baseline JSONB NOT NULL DEFAULT '{}',
  stability_score JSONB NOT NULL DEFAULT '{}',
  author_satisfaction JSONB,
  labels TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  is_current_head BOOLEAN DEFAULT FALSE,
  is_rollback_point BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 树查询索引
CREATE INDEX idx_version_nodes_path ON version_nodes USING GIST (tree_path);
CREATE INDEX idx_version_nodes_version ON version_nodes (version);
CREATE INDEX idx_version_nodes_current ON version_nodes (is_current_head) WHERE is_current_head = TRUE;

-- 版本边表（显式关系）
CREATE TABLE version_edges (
  id SERIAL PRIMARY KEY,
  from_node VARCHAR(32) REFERENCES version_nodes(id),
  to_node VARCHAR(32) REFERENCES version_nodes(id),
  edge_type VARCHAR(20) CHECK (edge_type IN ('parent_child', 'merge', 'rollback')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 查找某节点的所有祖先
CREATE OR REPLACE FUNCTION get_ancestor_nodes(node_id VARCHAR)
RETURNS TABLE (ancestor_id VARCHAR, version VARCHAR, tree_path LTREE) AS $$
BEGIN
  RETURN QUERY
  SELECT v.id, v.version, v.tree_path
  FROM version_nodes v,
       (SELECT tree_path FROM version_nodes WHERE id = node_id) target
  WHERE v.tree_path @> target.tree_path
    AND v.id != node_id
  ORDER BY v.tree_path;
END;
$$ LANGUAGE plpgsql;

-- 查找某节点的所有后代
CREATE OR REPLACE FUNCTION get_descendant_nodes(node_id VARCHAR)
RETURNS TABLE (descendant_id VARCHAR, version VARCHAR, tree_path LTREE) AS $$
BEGIN
  RETURN QUERY
  SELECT v.id, v.version, v.tree_path
  FROM version_nodes v,
       (SELECT tree_path FROM version_nodes WHERE id = node_id) target
  WHERE v.tree_path <@ target.tree_path
    AND v.id != node_id
  ORDER BY v.tree_path;
END;
$$ LANGUAGE plpgsql;

-- 查找最优路径（Dijkstra简化版）
CREATE OR REPLACE FUNCTION find_optimal_path(from_id VARCHAR, to_id VARCHAR)
RETURNS TABLE (step_number INT, node_id VARCHAR, version VARCHAR, risk_score NUMERIC) AS $$
DECLARE
  from_path LTREE;
  to_path LTREE;
  lca LTREE;
BEGIN
  SELECT v.tree_path INTO from_path FROM version_nodes v WHERE v.id = from_id;
  SELECT v.tree_path INTO to_path FROM version_nodes v WHERE v.id = to_id;
  
  -- 找到最近公共祖先
  lca := CASE 
    WHEN from_path <@ to_path THEN from_path
    WHEN to_path <@ from_path THEN to_path
    ELSE (
      SELECT v.tree_path FROM version_nodes v
      WHERE v.tree_path @> from_path AND v.tree_path @> to_path
      ORDER BY nlevel(v.tree_path) DESC LIMIT 1
    )
  END;
  
  -- 返回从from_id到to_id的路径
  RETURN QUERY
  WITH path_up AS (
    SELECT v.id, v.version, v.tree_path, 
           100 - (v.stability_score->>'score')::numeric as risk
    FROM version_nodes v
    WHERE v.tree_path @> lca AND v.tree_path <@ from_path
    ORDER BY nlevel(v.tree_path) DESC
  ),
  path_down AS (
    SELECT v.id, v.version, v.tree_path,
           100 - (v.stability_score->>'score')::numeric as risk
    FROM version_nodes v
    WHERE v.tree_path @> lca AND v.tree_path <@ to_path
      AND v.tree_path != lca
    ORDER BY nlevel(v.tree_path) ASC
  )
  SELECT ROW_NUMBER() OVER ()::int, id, version, risk
  FROM (SELECT * FROM path_up UNION ALL SELECT * FROM path_down) combined;
END;
$$ LANGUAGE plpgsql;
```

---

## 5. 能力成长追踪 CapabilityGrowthTracker

### 5.1 核心设计理念

能力成长追踪是系统的"自我认知"。通过五维能力模型，系统可以量化自己在修复、优化、学习、适应、协作五个维度上的成长。这不仅为作者提供透明的系统状态报告，也为进化策略引擎提供数据输入。

### 5.2 五维能力模型

```typescript
// 能力维度定义
interface CapabilityDimensions {
  // 修复能力：系统解决问题的能力
  repair: {
    score: number;           // 0-100 综合评分
    successRate: number;     // 修复成功率
    avgFixTime: number;      // 平均修复时间（分钟）
    complexityScore: number; // 能处理的平均复杂度
    metrics: {
      totalAttempts: number;    // 总尝试次数
      successfulFixes: number;  // 成功修复数
      failedFixes: number;      // 失败修复数
      rolledBackFixes: number;  // 回滚数
      avgTimeToFix: number;     // 平均修复耗时
      maxComplexityHandled: number; // 处理过的最高复杂度
    };
  };

  // 优化能力：系统提升性能的能力
  optimization: {
    score: number;
    avgPerformanceGain: number; // 平均性能提升幅度（%）
    stabilityScore: number;     // 优化后的稳定性
    metrics: {
      totalOptimizations: number;
      successfulOptimizations: number;
      avgResponseTimeImprovement: number;
      avgThroughputImprovement: number;
      optimizationRegressionRate: number; // 优化后回退率
    };
  };

  // 学习能力：系统从经验中学习的能力
  learning: {
    score: number;
    newPatternRecognitionSpeed: number; // 新模式识别速度（天）
    patternReuseRate: number;           // 模式复用率
    metrics: {
      totalPatternsLearned: number;     // 学会的模式数
      patternsReused: number;           // 复用次数
      avgRecognitionTime: number;       // 平均识别时间
      knowledgeBaseGrowthRate: number;  // 知识库增长率
    };
  };

  // 适应能力：系统适应变化的能力
  adaptation: {
    score: number;
    newTechAdoptionRate: number;   // 新技术采用率
    envChangeAdaptation: number;   // 环境变化适应评分
    metrics: {
      adaptationsCompleted: number;
      adaptationSuccessRate: number;
      avgAdaptationTime: number;
      breakingChangesHandled: number;
    };
  };

  // 协作能力：多Agent协作的效率
  collaboration: {
    score: number;
    multiAgentEfficiency: number;  // 多Agent协作效率
    conflictResolutionRate: number; // 冲突解决率
    metrics: {
      collaborativeTasks: number;
      conflictsEncountered: number;
      conflictsResolved: number;
      avgCollaborationTime: number;
    };
  };
}
```

### 5.3 能力评分算法

```typescript
class CapabilityScorer {
  // 修复能力评分
  calculateRepairScore(metrics: RepairMetrics): number {
    const successWeight = 0.35;
    const speedWeight = 0.25;
    const complexityWeight = 0.25;
    const stabilityWeight = 0.15;

    const successScore = Math.min(100, (metrics.successfulFixes / Math.max(1, metrics.totalAttempts)) * 100);
    const speedScore = Math.max(0, 100 - (metrics.avgTimeToFix / 60) * 10); // 超过60分钟开始扣分
    const complexityScore = Math.min(100, metrics.maxComplexityHandled * 10);
    const stabilityScore = Math.max(0, 100 - (metrics.rolledBackFixes / Math.max(1, metrics.totalAttempts)) * 200);

    return Math.round(
      successScore * successWeight +
      speedScore * speedWeight +
      complexityScore * complexityWeight +
      stabilityScore * stabilityWeight
    );
  }

  // 优化能力评分
  calculateOptimizationScore(metrics: OptimizationMetrics): number {
    const gainWeight = 0.4;
    const stabilityWeight = 0.35;
    const consistencyWeight = 0.25;

    const gainScore = Math.min(100, metrics.avgResponseTimeImprovement * 5 + 50);
    const stabilityScore = Math.max(0, 100 - metrics.optimizationRegressionRate * 100);
    const consistencyScore = (metrics.successfulOptimizations / Math.max(1, metrics.totalOptimizations)) * 100;

    return Math.round(
      gainScore * gainWeight +
      stabilityScore * stabilityWeight +
      consistencyScore * consistencyWeight
    );
  }

  // 学习能力评分
  calculateLearningScore(metrics: LearningMetrics): number {
    const recognitionWeight = 0.3;
    const reuseWeight = 0.35;
    const growthWeight = 0.35;

    const recognitionScore = Math.max(0, 100 - metrics.avgRecognitionTime * 10);
    const reuseScore = Math.min(100, metrics.patternsReused * 5);
    const growthScore = Math.min(100, metrics.knowledgeBaseGrowthRate * 10);

    return Math.round(
      recognitionScore * recognitionWeight +
      reuseScore * reuseWeight +
      growthScore * growthWeight
    );
  }

  // 适应能力评分
  calculateAdaptationScore(metrics: AdaptationMetrics): number {
    const adoptionWeight = 0.4;
    const successWeight = 0.35;
    const speedWeight = 0.25;

    const adoptionScore = Math.min(100, metrics.adaptationsCompleted * 10);
    const successScore = (metrics.adaptationSuccessRate || 0) * 100;
    const speedScore = Math.max(0, 100 - (metrics.avgAdaptationTime || 0) * 5);

    return Math.round(
      adoptionScore * adoptionWeight +
      successScore * successWeight +
      speedScore * speedWeight
    );
  }

  // 协作能力评分
  calculateCollaborationScore(metrics: CollaborationMetrics): number {
    const efficiencyWeight = 0.4;
    const resolutionWeight = 0.35;
    const frequencyWeight = 0.25;

    const efficiencyScore = Math.max(0, 100 - (metrics.avgCollaborationTime || 0) * 2);
    const resolutionScore = (metrics.conflictsResolved / Math.max(1, metrics.conflictsEncountered)) * 100;
    const frequencyScore = Math.min(100, (metrics.collaborativeTasks || 0) * 5);

    return Math.round(
      efficiencyScore * efficiencyWeight +
      resolutionScore * resolutionWeight +
      frequencyScore * frequencyWeight
    );
  }

  // 计算综合成长指数 (CGI - Comprehensive Growth Index)
  calculateCGI(dimensions: CapabilityDimensions): number {
    const weights = { repair: 0.3, optimization: 0.2, learning: 0.2, adaptation: 0.15, collaboration: 0.15 };
    return Math.round(
      dimensions.repair.score * weights.repair +
      dimensions.optimization.score * weights.optimization +
      dimensions.learning.score * weights.learning +
      dimensions.adaptation.score * weights.adaptation +
      dimensions.collaboration.score * weights.collaboration
    );
  }
}
```

### 5.4 成长曲线追踪

```typescript
interface GrowthCurve {
  dimension: keyof CapabilityDimensions;
  dataPoints: Array<{
    timestamp: Date;
    score: number;
    event?: string;  // 导致变化的关键事件
  }>;
  trend: {
    direction: "improving" | "stable" | "declining";
    slope: number;           // 线性回归斜率
    weeklyGrowthRate: number; // 每周成长率（百分点）
    acceleration: number;     // 加速度（二阶导数）
  };
  bottlenecks: Array<{
    description: string;
    severity: "low" | "medium" | "high";
    identifiedAt: Date;
  }>;
}

// 成长瓶颈检测
class BottleneckDetector {
  detectBottlenecks(curve: GrowthCurve): GrowthBottleneck[] {
    const bottlenecks: GrowthBottleneck[] = [];
    
    // 检测长期停滞
    const recentPoints = curve.dataPoints.slice(-4); // 最近4个数据点
    if (recentPoints.length >= 4) {
      const variance = this.calculateVariance(recentPoints.map(p => p.score));
      const avgScore = recentPoints.reduce((s, p) => s + p.score, 0) / recentPoints.length;
      
      if (variance < 2 && avgScore < 80) {
        bottlenecks.push({
          type: "plateau",
          description: `${curve.dimension}能力陷入平台期，连续4期变化不超过2分`,
          severity: avgScore < 50 ? "high" : "medium",
          recommendation: "建议引入新的学习策略或增加该维度的训练数据"
        });
      }
    }
    
    // 检测倒退
    if (curve.trend.direction === "declining") {
      bottlenecks.push({
        type: "regression",
        description: `${curve.dimension}能力出现倒退趋势，斜率: ${curve.trend.slope.toFixed(2)}`,
        severity: "high",
        recommendation: "立即审查最近的变更，可能需要回退某些改动"
      });
    }
    
    // 检测成长减速
    if (curve.trend.acceleration < -0.5) {
      bottlenecks.push({
        type: "deceleration",
        description: `${curve.dimension}能力成长正在减速`,
        severity: "medium",
        recommendation: "检查是否存在资源竞争或优先级冲突"
      });
    }
    
    return bottlenecks;
  }
}
```

### 5.5 能力报告生成

```typescript
interface CapabilityReport {
  generatedAt: Date;
  period: { start: Date; end: Date };
  summary: {
    overallCGI: number;
    previousCGI: number;
    cgiDelta: number;
    strongestDimension: string;
    weakestDimension: string;
  };
  dimensions: Record<string, {
    currentScore: number;
    previousScore: number;
    delta: number;
    weeklyGrowthRate: number;
    bottlenecks: string[];
    highlights: string[];
  }>;
  predictions: {
    nextWeekCGI: number;
    nextMonthCGI: number;
    confidence: number;
    assumptions: string[];
  };
  recommendations: Array<{
    priority: "high" | "medium" | "low";
    action: string;
    expectedImpact: string;
  }>;
}

// 使用线性回归预测未来能力
function predictFutureScore(dataPoints: Array<{ timestamp: Date; score: number }>, daysAhead: number): number {
  const n = dataPoints.length;
  if (n < 2) return dataPoints[0]?.score ?? 50;
  
  const x = dataPoints.map((p, i) => i);
  const y = dataPoints.map(p => p.score);
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((s, xi, i) => s + xi * y[i], 0);
  const sumXX = x.reduce((s, xi) => s + xi * xi, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  const futureX = n - 1 + daysAhead / 7; // 假设数据点间隔为一周
  return Math.min(100, Math.max(0, slope * futureX + intercept));
}
```

### 5.6 PostgreSQL 能力追踪表

```sql
-- 能力评分快照表（定期记录）
CREATE TABLE capability_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_at TIMESTAMPTZ DEFAULT NOW(),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  
  -- 修复能力
  repair_score NUMERIC(5,2),
  repair_success_rate NUMERIC(5,2),
  repair_avg_fix_time NUMERIC(8,2),
  repair_complexity_score NUMERIC(5,2),
  
  -- 优化能力
  optimization_score NUMERIC(5,2),
  optimization_avg_gain NUMERIC(5,2),
  optimization_stability NUMERIC(5,2),
  
  -- 学习能力
  learning_score NUMERIC(5,2),
  learning_recognition_speed NUMERIC(5,2),
  learning_reuse_rate NUMERIC(5,2),
  
  -- 适应能力
  adaptation_score NUMERIC(5,2),
  adaptation_adoption_rate NUMERIC(5,2),
  adaptation_env_score NUMERIC(5,2),
  
  -- 协作能力
  collaboration_score NUMERIC(5,2),
  collaboration_efficiency NUMERIC(5,2),
  collaboration_conflict_resolution NUMERIC(5,2),
  
  -- 综合指数
  cgi NUMERIC(5,2),
  
  -- 元数据
  raw_metrics JSONB,
  events JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_capability_snapshots_time ON capability_snapshots (snapshot_at DESC);

-- 成长事件记录表
CREATE TABLE growth_events (
  id SERIAL PRIMARY KEY,
  event_at TIMESTAMPTZ DEFAULT NOW(),
  dimension VARCHAR(20) CHECK (dimension IN ('repair', 'optimization', 'learning', 'adaptation', 'collaboration', 'overall')),
  event_type VARCHAR(30) CHECK (event_type IN ('milestone', 'bottleneck_detected', 'regression', 'breakthrough', 'plateau_resolved')),
  description TEXT,
  score_delta NUMERIC(5,2),
  related_issue_id VARCHAR(32),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_growth_events_dimension ON growth_events (dimension, event_at DESC);
```



---

## 6. 进化策略引擎 EvolutionStrategyEngine

### 6.1 核心设计理念

进化策略引擎是整个 KEE 的"大脑"。它基于能力成长追踪的数据，制定系统的进化方向和策略。进化不是随机的，而是有目标的、受约束的、可刹车的。

### 6.2 三层进化模型

```typescript
interface EvolutionModel {
  // 被动进化：问题驱动
  passive: {
    trigger: "issue_occurred";           // 触发条件
    flow: "detect → fix → learn → prevent";  // 流程
    priority: "reactive";                 // 响应式
    frequency: "continuous";              // 持续进行
  };

  // 主动进化：目标驱动
  active: {
    trigger: "capability_gap" | "goal_set";  // 触发条件
    flow: "assess → plan → execute → measure"; // 流程
    priority: "planned";                    // 计划式
    frequency: "weekly";                    // 定期执行
  };

  // 探索进化：实验驱动
  exploratory: {
    trigger: "opportunity" | "experiment";   // 触发条件
    flow: "hypothesis → experiment → evaluate → adopt|discard"; // 流程
    priority: "opportunistic";               // 机会式
    frequency: "on_demand";                  // 按需触发
  };
}
```

### 6.3 长期进化目标

```typescript
interface LongTermEvolutionGoals {
  // 目标1：减少人工干预
  reduceHumanIntervention: {
    description: "从每次审批到信任后自动";
    stages: Array<{
      name: string;
      automationLevel: number;  // 0-100
      criteria: string;         // 达到该阶段的条件
    }>;
    metrics: ["autoApprovalRate", "avgInterventionFrequency", "authorTrustScore"];
  };

  // 目标2：提高修复质量
  improveFixQuality: {
    description: "从能修到修好到不复发";
    stages: [
      { name: "能修复", criteria: "修复成功率 > 80%" },
      { name: "修得好", criteria: "修复成功率 > 95% AND 作者评分 > 4.0" },
      { name: "不复发", criteria: "同一问题不复发率 > 95%" }
    ];
    metrics: ["fixSuccessRate", "authorRating", "recurrenceRate"];
  };

  // 目标3：扩展能力边界
  expandCapabilityBoundary: {
    description: "从修复到优化到创新";
    stages: [
      { name: "修复", criteria: "自动修复常见bug" },
      { name: "优化", criteria: "主动发现并优化性能" },
      { name: "创新", criteria: "提出架构改进建议" }
    ];
    metrics: ["innovationScore", "proactiveImprovementRate", "authorAdoptionOfSuggestions"];
  };
}
```

### 6.4 进化约束（不可违反的公理）

```typescript
interface EvolutionConstraints {
  // 第一公理：叙事裁决权永远在作者
  firstAxiom: {
    rule: "Author is the sole arbiter of narrative";
    description: "系统永远不得擅自改变小说的叙事内容、角色性格、情节走向";
    enforce: (proposedChange: any) => {
      isCompliant: boolean;
      violationDetails?: string[];
    };
    penalty: "REJECT_CHANGE_AND_ALERT";
  };

  // 架构原则不可违反
  architecturalPrinciples: {
    rules: [
      "分层原则：严格遵守Layer 1-7的分层边界，不允许跨层直接调用",
      "无状态原则：所有Agent状态必须通过PostgreSQL持久化，不允许内存状态",
      "单向数据流：数据只能从上层流向下层，反馈通过独立通道",
      "事件驱动：所有组件间通信通过事件总线，不允许直接引用"
    ];
    enforce: (proposedChange: any) => {
      isCompliant: boolean;
      violations: string[];
    };
    penalty: "REJECT_CHANGE";
  };

  // 安全底线不可违反
  securityBaseline: {
    rules: [
      "数据不泄露：任何情况下不得将作者的小说内容发送到外部服务（除非作者明确授权）",
      "权限不越界：DevAgent只能修改系统代码，不能访问或修改作者的作品数据",
      "审计可追踪：所有变更必须可追溯、可回滚、可审计"
    ];
    enforce: (proposedChange: any) => {
      isCompliant: boolean;
      securityRisks: string[];
    };
    penalty: "REJECT_CHANGE_AND_LOCK";
  };

  // 作者控制不可剥夺
  authorControl: {
    rules: [
      "作者随时可以关闭自动进化",
      "作者随时可以回退到任何历史版本",
      "作者对每次自动变更有否决权（在信任建立之前）",
      "系统必须在重大变更前通知作者"
    ];
    enforce: (proposedChange: any, authorSettings: AuthorSettings) => {
      isCompliant: boolean;
      requiredApprovals: string[];
    };
    penalty: "PAUSE_EVOLUTION_AND_NOTIFY";
  };
}
```

### 6.5 进化刹车机制

```typescript
interface EvolutionBrakeMechanism {
  // 刹车触发条件
  triggers: Array<{
    id: string;
    name: string;
    condition: string;
    severity: "warning" | "critical" | "emergency";
    action: BrakeAction;
  }>;

  // 刹车动作
  brakeActions: {
    // 警告级：发出预警但不停止
    warning: {
      action: "ALERT";
      notify: ["author", "system_log"];
      continue: true;
    };

    // 严重级：暂停进化
    critical: {
      action: "PAUSE";
      notify: ["author", "dashboard", "email"];
      continue: false;
      autoResume: "never";
      require: "author_approval";
    };

    // 紧急级：回退并锁定
    emergency: {
      action: "ROLLBACK_AND_LOCK";
      notify: ["author", "dashboard", "email", "sms"];
      continue: false;
      autoResume: "never";
      require: "manual_investigation";
      execute: async () => {
        await rollbackToLastStableVersion();
        await lockEvolutionEngine();
        await createIncidentReport();
      };
    };
  };
}

// 具体刹车触发器定义
const BRAKE_TRIGGERS: EvolutionBrakeMechanism["triggers"] = [
  {
    id: "BT-001",
    name: "进化方向偏离约束",
    condition: "即将提交的变更违反任何进化约束（公理/架构/安全/控制）",
    severity: "critical",
    action: "PAUSE"
  },
  {
    id: "BT-002",
    name: "能力成长倒退",
    condition: "任意维度的能力评分连续2期下降，或单期下降超过10分",
    severity: "warning",
    action: "ALERT"
  },
  {
    id: "BT-003",
    name: "作者满意度下降",
    condition: "作者评分连续3次低于3星，或单次低于2星",
    severity: "critical",
    action: "PAUSE"
  },
  {
    id: "BT-004",
    name: "错误率异常飙升",
    condition: "部署后错误率超过基线的200%",
    severity: "emergency",
    action: "ROLLBACK_AND_LOCK"
  },
  {
    id: "BT-005",
    name: "自动化率超过阈值",
    condition: "自动化率超过当前信任阶段的允许上限",
    severity: "warning",
    action: "ALERT"
  },
  {
    id: "BT-006",
    name: "回滚次数过多",
    condition: "7天内回滚超过3次",
    severity: "critical",
    action: "PAUSE"
  }
];
```

### 6.6 进化策略决策流程

```typescript
interface StrategyDecisionEngine {
  // 决策输入
  inputs: {
    capabilityReport: CapabilityReport;
    recentIssues: IssueKnowledgeEntry[];
    recentChanges: CodeMemoryEntry[];
    authorSettings: AuthorSettings;
    currentVersion: VersionNode;
    evolutionConstraints: EvolutionConstraints;
  };

  // 决策输出
  outputs: {
    strategyType: "passive" | "active" | "exploratory";
    priority: number;  // 0-100
    proposedActions: EvolutionAction[];
    riskAssessment: RiskAssessment;
    estimatedImpact: ImpactEstimation;
    requiredApprovals: ApprovalRequirement[];
  };
}

// 决策流程
async function makeEvolutionDecision(inputs: StrategyDecisionEngine["inputs"]): Promise<StrategyDecisionEngine["outputs"]> {
  // 步骤1：评估当前状态
  const state = assessCurrentState(inputs.capabilityReport);
  
  // 步骤2：识别机会和问题
  const opportunities = identifyOpportunities(state, inputs.recentIssues);
  const problems = identifyProblems(state, inputs.recentChanges);
  
  // 步骤3：约束检查
  const constraintCheck = checkConstraints(inputs.evolutionConstraints, opportunities, problems);
  if (!constraintCheck.isCompliant) {
    return createBrakeResponse(constraintCheck.violations);
  }
  
  // 步骤4：策略选择
  const strategy = selectStrategy({
    priority: calculatePriority(opportunities, problems),
    authorTrust: inputs.authorSettings.trustLevel,
    capabilityGaps: inputs.capabilityReport.summary.weakestDimension
  });
  
  // 步骤5：生成行动计划
  const actions = generateActions(strategy, inputs);
  
  // 步骤6：风险评估
  const risk = assessRisk(actions, inputs.currentVersion);
  
  // 步骤7：确定审批需求
  const approvals = determineApprovals(actions, inputs.authorSettings, risk);
  
  return {
    strategyType: strategy.type,
    priority: strategy.priority,
    proposedActions: actions,
    riskAssessment: risk,
    estimatedImpact: estimateImpact(actions),
    requiredApprovals: approvals
  };
}
```

### 6.7 XState 进化策略状态机

```typescript
const evolutionStrategyMachine = createMachine({
  id: "evolutionStrategy",
  initial: "idle",
  states: {
    idle: {
      on: {
        TICK: { target: "assessing", guard: "isTimeToAssess" },
        ISSUE_TRIGGERED: { target: "passiveEvolving" },
        GOAL_SET: { target: "activePlanning" },
        EXPERIMENT_REQUESTED: { target: "exploratoryHypothesis" }
      }
    },
    
    assessing: {
      entry: ["loadCapabilityData", "loadRecentEvents"],
      invoke: {
        src: "assessCurrentState",
        onDone: { target: "deciding" },
        onError: { target: "error" }
      }
    },
    
    deciding: {
      invoke: {
        src: "makeEvolutionDecision",
        onDone: [
          { target: "braking", guard: "brakeConditionMet" },
          { target: "passiveEvolving", guard: "isPassiveStrategy" },
          { target: "activePlanning", guard: "isActiveStrategy" },
          { target: "exploratoryHypothesis", guard: "isExploratoryStrategy" },
          { target: "idle" }
        ]
      }
    },
    
    passiveEvolving: {
      entry: ["logPassiveStart"],
      invoke: {
        src: "executePassiveEvolution",
        onDone: { target: "verifying" },
        onError: { target: "braking", actions: "setBrakeTrigger" }
      }
    },
    
    activePlanning: {
      entry: ["logActiveStart"],
      invoke: {
        src: "createActivePlan",
        onDone: { target: "awaitingApproval", actions: "setPendingPlan" },
        onError: { target: "error" }
      }
    },
    
    exploratoryHypothesis: {
      entry: ["logExploratoryStart"],
      invoke: {
        src: "createHypothesis",
        onDone: { target: "awaitingApproval", actions: "setPendingExperiment" },
        onError: { target: "error" }
      }
    },
    
    awaitingApproval: {
      on: {
        APPROVED: { target: "executing", actions: "recordApproval" },
        REJECTED: { target: "idle", actions: "recordRejection" },
        TIMEOUT: { target: "idle", actions: "recordTimeout" }
      },
      after: {
        86400000: { target: "idle", actions: "recordTimeout" } // 24小时超时
      }
    },
    
    executing: {
      invoke: {
        src: "executeEvolutionPlan",
        onDone: { target: "verifying" },
        onError: { target: "braking", actions: "setBrakeTrigger" }
      }
    },
    
    verifying: {
      invoke: {
        src: "verifyEvolutionResult",
        onDone: [
          { target: "success", guard: "verificationPassed" },
          { target: "braking", guard: "verificationFailed" }
        ]
      }
    },
    
    success: {
      entry: ["recordSuccess", "updateCapabilityScores"],
      after: { 5000: { target: "idle" } }
    },
    
    braking: {
      entry: ["executeBrakeAction", "notifyAuthor"],
      on: {
        RESUME_APPROVED: { target: "idle", guard: "isCriticalOrLower" },
        INVESTIGATION_COMPLETE: { target: "idle", guard: "isEmergencyResolved" }
      }
    },
    
    error: {
      entry: ["logError", "notifySystemAdmin"],
      on: {
        RETRY: { target: "assessing" },
        ABORT: { target: "idle" }
      }
    }
  }
});
```

---

## 7. 知识共享与学习

### 7.1 跨实例学习（联邦学习模式）

```typescript
interface CrossInstanceLearning {
  // 数据共享协议
  protocol: {
    // 共享内容（严格匿名化）
    shareableData: [
      "issue_signatures_only",       // 仅共享问题签名（不含具体内容）
      "fix_patterns",                 // 修复模式（去上下文）
      "success_metrics",              // 修复成功率统计
      "model_parameters_aggregated"   // 聚合后的模型参数
    ];
    
    // 绝不共享的内容
    neverShareable: [
      "小说内容",          // 任何作者作品
      "个人身份信息",       // 作者身份
      "具体代码路径",       // 可能暴露项目结构
      "错误日志原始内容",    // 可能包含敏感信息
      "作者偏好设置"        // 个人配置
    ];
  };

  // 联邦学习流程
  federatedLearning: {
    rounds: Array<{
      round: number;
      localTraining: {
        dataset: "本地问题知识库";
        epochs: number;
        model: "issue_classifier";
      };
      aggregation: {
        method: "fedavg" | "fedprox";
        participants: number;  // 参与聚合的实例数
        differentialPrivacy: {
          epsilon: number;     // 隐私预算
          noiseMechanism: "gaussian";
        };
      };
      globalModel: {
        accuracy: number;
        version: string;
        deploymentStrategy: "immediate" | "canary" | "manual";
      };
    }>;
  };

  // 差分隐私保护
  differentialPrivacy: {
    mechanism: {
      type: "gaussian";
      epsilon: 1.0;       // 隐私预算
      delta: 1e-5;        // 失败概率
      maxGradientNorm: 1.0; // 梯度裁剪
    };
    dataAnonymization: {
      kAnonymity: 5;      // K-匿名性保证
      lDiversity: 2;      // L-多样性
      suppressionThreshold: 0.01; // 抑制阈值
    };
  };
}
```

### 7.2 本地学习（单作者实例）

```typescript
interface LocalLearning {
  // 作者偏好学习
  authorPreference: {
    learningTargets: [
      {
        target: "author_fix_approval_patterns";
        description: "从作者对修复方案的审批中学习偏好";
        method: "supervised_learning";
        features: ["变更类型", "变更范围", "修改行数", "是否涉及核心模块"];
        output: "作者可能的审批倾向";
      },
      {
        target: "author_coding_style";
        description: "学习作者的代码风格偏好";
        method: "pattern_extraction";
        features: ["命名约定", "注释习惯", "错误处理风格", "async模式"];
        output: "风格适配规则";
      }
    ];
  };

  // 作品特征学习（仅限系统行为优化，不涉及内容分析）
  workUsagePatterns: {
    learningTargets: [
      {
        target: "usage_patterns";
        description: "学习系统的使用模式以优化性能";
        method: "time_series_analysis";
        features: ["活跃时段", "操作频率", "模块使用分布"];
        output: "性能优化策略";
        privacyNote: "仅统计操作类型和频率，不记录操作的具体内容";
      }
    ];
  };

  // 环境适配学习
  environmentAdaptation: {
    learningTargets: [
      {
        target: "hardware_adaptation";
        description: "适配作者的硬件环境";
        method: "auto_tuning";
        features: ["CPU核心数", "内存大小", "磁盘速度", "网络带宽"];
        output: "系统参数优化配置";
      },
      {
        target: "workflow_adaptation";
        description: "适配作者的工作习惯";
        method: "habit_detection";
        features: ["常用快捷键", "偏好界面", "工作节奏"];
        output: "界面和工作流优化";
      }
    ];
  };
}
```

### 7.3 知识共享协议

```typescript
interface KnowledgeSharingProtocol {
  // 共享级别
  sharingLevels: {
    LEVEL_0_NONE: {
      description: "不共享任何数据";
      shared: [];
      benefits: "最高隐私";
      tradeoffs: "无法获得社区经验";
    };
    LEVEL_1_ANONYMOUS_METRICS: {
      description: "仅共享匿名化指标";
      shared: ["修复成功率统计", "性能指标分布"];
      benefits: "帮助改进全局模型";
      tradeoffs: "隐私影响极低";
    };
    LEVEL_2_PATTERN_SHARE: {
      description: "共享修复模式（脱敏）";
      shared: ["修复模式模板", "问题签名模式", "解决方案类型分布"];
      benefits: "可以获得社区修复模式推荐";
      tradeoffs: "需要信任脱敏机制";
    };
    LEVEL_3_FEDERATED_LEARNING: {
      description: "参与联邦学习";
      shared: ["本地训练后的模型参数（差分隐私保护）"];
      benefits: "获得改进的全局模型";
      tradeoffs: "需要信任差分隐私机制";
    };
    LEVEL_4_FULL_CONTRIBUTE: {
      description: "完全贡献（需要作者明确同意）";
      shared: ["匿名化的问题知识（经审核）"];
      benefits: "最大化社区收益";
      tradeoffs: "需要额外审核保障";
    };
  };

  // 数据脱敏流程
  sanitizationPipeline: [
    { step: "标识符移除", method: "regex_patterns", target: "ip,email,uuid,path" },
    { step: "内容替换", method: "named_entity_replacement", target: "project_names,author_names" },
    { step: "K-匿名化检查", method: "k_anonymity_verification", target: "all_fields" },
    { step: "差分隐私噪声", method: "gaussian_noise", target: "numerical_fields" },
    { step: "人工审核（Level 4）", method: "manual_review", target: "all_shared_data" }
  ];
}
```

---

## 8. 隐私保护方案

### 8.1 隐私保护架构

```
┌─────────────────────────────────────────────────────────────┐
│                    隐私保护架构                               │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │   本地数据    │   │  共享数据     │   │  禁止数据     │    │
│  │ (不上传)      │   │ (脱敏后)     │   │ (永不离开)   │    │
│  │              │   │              │   │              │    │
│  │ • 小说内容   │   │ • 问题签名   │   │ • 原始错误   │    │
│  │ • 代码内容   │   │ • 修复模式   │   │   日志内容   │    │
│  │ • 作者偏好   │   │ • 成功率     │   │ • 作者身份   │    │
│  │ • 使用模式   │   │ • 性能指标   │   │ • 项目路径   │    │
│  │ • 环境信息   │   │ • 聚合统计   │   │ • 个人配置   │    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│          │                   │                   │            │
│          ▼                   ▼                   ▼            │
│  ┌──────────────────────────────────────────────────┐       │
│  │              脱敏管道 (Sanitization Pipeline)     │       │
│  │                                                   │       │
│  │  1. 标识符移除 → 2. 内容替换 → 3. K-匿名化检查    │       │
│  │     → 4. 差分隐私噪声 → 5. 合规性验证             │       │
│  └──────────────────────────────────────────────────┘       │
│                              │                               │
│                              ▼                               │
│  ┌──────────────────────────────────────────────────┐       │
│  │              作者控制权                           │       │
│  │                                                   │       │
│  │  • 共享级别设置 (0-4级)                           │       │
│  │  • 每次共享前的确认提示                           │       │
│  │  • 历史共享记录查看                               │       │
│  │  • 一键撤回所有共享数据                           │       │
│  │  • 共享内容预览（脱敏后）                         │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 脱敏实现

```typescript
interface DataSanitizer {
  // 标识符移除
  removeIdentifiers(text: string): string {
    return text
      // IP地址
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[IP_REDACTED]")
      // 邮箱
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]")
      // UUID
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[UUID_REDACTED]")
      // 文件路径
      .replace(/\/([\w-]+\/)+[\w-]+\.[\w]+/g, "[PATH_REDACTED]")
      // 项目名称（需要配置替换映射）
      .replaceProjectNames(this.projectNameMap);
  }

  // K-匿名化检查
  checkKAnonymity(records: any[], k: number, quasiIdentifiers: string[]): boolean {
    const groups = groupBy(records, quasiIdentifiers);
    return Object.values(groups).every(group => group.length >= k);
  }

  // 差分隐私噪声注入
  addDifferentialPrivacyNoise(
    value: number,
    epsilon: number,
    sensitivity: number
  ): number {
    const scale = sensitivity / epsilon;
    const noise = this.sampleLaplace(0, scale);
    return value + noise;
  }

  // 完整脱敏流程
  async sanitize(data: ShareableData, level: SharingLevel): Promise<SanitizedData> {
    let sanitized = { ...data };
    
    // 步骤1：移除所有标识符
    sanitized = this.removeIdentifiersFromAllFields(sanitized);
    
    // 步骤2：根据共享级别决定共享内容
    if (level <= SharingLevel.LEVEL_1) {
      sanitized = this.retainMetricsOnly(sanitized);
    }
    
    // 步骤3：K-匿名化检查
    if (!this.checkKAnonymity([sanitized], 5, ["issueType", "fixStrategy"])) {
      sanitized = this.generalizeQuasiIdentifiers(sanitized);
    }
    
    // 步骤4：差分隐私噪声
    sanitized = this.addNoiseToNumericalFields(sanitized, { epsilon: 1.0 });
    
    // 步骤5：合规验证
    const compliance = this.verifyCompliance(sanitized);
    if (!compliance.passed) {
      throw new PrivacyViolationError(compliance.violations);
    }
    
    return sanitized;
  }
}
```

### 8.3 作者隐私控制面板

```typescript
interface PrivacyControlPanel {
  // 共享级别设置
  sharingLevel: {
    current: SharingLevel;
    options: SharingLevel[];
    description: string;
    impact: string;
  };

  // 共享历史
  sharingHistory: Array<{
    timestamp: Date;
    dataType: string;
    sharingLevel: SharingLevel;
    sanitized: boolean;
    recipient: string;
  }>;

  // 共享数据预览
  dataPreview: {
    beforeSanitization: any;
    afterSanitization: any;
    diff: string;
  };

  // 撤回功能
  revokeAll: () => Promise<{ revoked: boolean; affectedRecords: number }>;
}
```



---

## 9. TypeScript 接口定义

### 9.1 核心类型定义

```typescript
// ============================================================================
// 问题知识库类型
// ============================================================================

/** 问题签名 */
interface IssueSignature {
  typeHash: string;        // L1+L2+L3类型哈希
  patternHash: string;     // 错误模式哈希
  contextHash: string;     // 上下文特征哈希
  fullSignature: string;   // SHA256(typeHash + patternHash + contextHash)
  confidence: number;      // 签名置信度 0-1
}

/** 问题影响范围 */
interface IssueImpact {
  severity: "critical" | "high" | "medium" | "low";
  scope: string[];         // 影响模块
  affectedUsers: "all" | "some" | "single" | "none";
}

/** 问题描述 */
interface IssueDescription {
  title: string;
  detail: string;
  impact?: IssueImpact;
}

/** 根因分析 */
interface RootCauseAnalysis {
  category: "technical" | "architectural" | "external_dependency" | "configuration" | "human_error" | "unknown";
  analysis: string;
  technical?: {
    component: string;
    errorCode: string;
    errorMessage: string;
    stackTraceHash: string;
  };
  architectural?: {
    missingPattern: string;
    couplingIssue: string;
    scalabilityLimit: string;
  };
  externalDependency?: {
    service: string;
    version: string;
    changeDescription: string;
  };
}

/** 修复方案 */
interface FixSolution {
  strategy: FixStrategy;
  description: string;
  codeDiff?: string;
  keySnippet?: string;
  filesChanged?: FileChange[];
}

type FixStrategy = 
  | "code_fix" 
  | "config_change" 
  | "rollback" 
  | "workaround" 
  | "dependency_upgrade" 
  | "architecture_refactor" 
  | "monitoring_enhancement";

/** 文件变更 */
interface FileChange {
  path: string;
  changeType: "add" | "modify" | "delete";
  linesAdded: number;
  linesRemoved: number;
}

/** 验证结果 */
interface VerificationResult {
  testReport?: {
    testsPassed: number;
    testsFailed: number;
    coverage: number;
  };
  deploymentResult: "success" | "partial" | "failed" | "rolled_back";
  authorFeedback?: {
    rating: number;
    comment: string;
    wouldRecommend: boolean;
  };
  metricsBefore?: Record<string, number>;
  metricsAfter?: Record<string, number>;
}

/** 知识条目元数据 */
interface KnowledgeMetadata {
  createdAt: string;
  resolvedAt?: string;
  resolutionTime?: number;     // 分钟
  status: KnowledgeStatus;
  source: "auto_detected" | "author_reported" | "monitoring_alert" | "proactive_check";
  relatedTickets: string[];
  tags: string[];
  relatedIssues: string[];
  autoResolved: boolean;
  authorApproved: boolean;
}

type KnowledgeStatus = 
  | "open" 
  | "analyzing" 
  | "fixing" 
  | "verifying" 
  | "resolved" 
  | "closed" 
  | "reopened";

/** 问题知识条目（完整） */
interface IssueKnowledgeEntry {
  id: string;
  signature: IssueSignature;
  description: IssueDescription;
  rootCause: RootCauseAnalysis;
  fix: {
    applied: FixSolution;
    alternatives: Array<{
      strategy: string;
      description: string;
      rejectedReason: string;
    }>;
    selectionRationale: string;
  };
  verification: VerificationResult;
  metadata: KnowledgeMetadata;
  embeddings: {
    description: number[];     // 1536维
    stackTrace: number[];      // 1536维
    solution: number[];        // 1536维
  };
}

// ============================================================================
// 代码记忆库类型
// ============================================================================

/** 代码变更记录 */
interface CodeMemoryEntry {
  id: string;
  change: {
    before: CodeSnapshot;
    after: CodeSnapshot;
    diff: string;
    reason: {
      trigger: ChangeTrigger;
      description: string;
      issueId?: string;
    };
    timestamp: string;
  };
  impact: {
    filesModified: FileImpact[];
    modulesAffected: string[];
    dependenciesChanged: DependencyChange[];
    riskAssessment: RiskAssessment;
  };
  result: {
    status: "success" | "partial_success" | "failed" | "rolled_back";
    deploymentInfo?: DeploymentInfo;
    metricsDelta?: MetricsDelta;
    authorReview?: AuthorReview;
  };
  patterns: {
    fixPattern?: FixPattern;
    bugPattern?: BugPattern;
    bestPractice?: BestPractice;
  };
  embeddings: {
    codeChange: number[];
    reason: number[];
  };
}

interface CodeSnapshot {
  files: Array<{ path: string; content: string; checksum: string }>;
  version: string;
}

interface FileImpact {
  path: string;
  linesAdded: number;
  linesRemoved: number;
  linesModified: number;
  complexityDelta: number;
}

interface DependencyChange {
  name: string;
  oldVersion: string;
  newVersion: string;
}

interface RiskAssessment {
  level: "low" | "medium" | "high" | "critical";
  blastRadius: string;
  rollbackComplexity: "easy" | "moderate" | "complex" | "very_complex";
}

interface DeploymentInfo {
  deployedAt: string;
  deployDuration: number;
  versionTag: string;
}

interface MetricsDelta {
  responseTime?: number;
  errorRate?: number;
  throughput?: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

interface AuthorReview {
  approved: boolean;
  approvalTime?: string;
  rating?: number;
  feedback?: string;
  modificationsRequested?: string[];
}

interface FixPattern {
  pattern: string;
  description: string;
  applicableTo: string[];
  confidence: number;
}

interface BugPattern {
  pattern: string;
  category: string;
  description: string;
}

interface BestPractice {
  practice: string;
  rationale: string;
}

type ChangeTrigger = 
  | "bug_fix" 
  | "performance" 
  | "security" 
  | "refactor" 
  | "feature" 
  | "dependency_update" 
  | "author_request";

// ============================================================================
// 进化历史树类型
// ============================================================================

/** 版本节点 */
interface VersionNode {
  id: string;
  version: string;
  parentIds: string[];
  deployedAt: string;
  deployedBy: "auto" | "author" | "system";
  changeSummary: ChangeSummary;
  performanceBaseline: PerformanceBaseline;
  stabilityScore: StabilityScore;
  authorSatisfaction?: AuthorSatisfaction;
  labels: string[];
  metadata: VersionMetadata;
}

interface ChangeSummary {
  title: string;
  description: string;
  changeType: ChangeType[];
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
}

type ChangeType = 
  | "bug_fix" 
  | "optimization" 
  | "refactor" 
  | "feature" 
  | "dependency_update" 
  | "config_change" 
  | "security_patch";

interface PerformanceBaseline {
  responseTimeP50: number;
  responseTimeP95: number;
  responseTimeP99: number;
  throughputRPS: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsageMB: number;
  dbConnectionPoolUsage: number;
}

interface StabilityScore {
  score: number;
  errorRate: number;
  rollbackCount: number;
  uptimeHours: number;
  incidentCount: number;
}

interface AuthorSatisfaction {
  rating: number;
  feedbackCount: number;
  wouldRecommend: number;
}

interface VersionMetadata {
  deploymentDuration?: number;
  rollbackTargetId?: string;
  associatedIssueIds: string[];
  associatedCodeMemoryIds: string[];
}

/** 版本边 */
interface VersionEdge {
  from: string;
  to: string;
  type: "parent_child" | "merge" | "rollback";
  metadata?: {
    mergeStrategy?: "auto_merge" | "manual_resolve";
    rollbackReason?: string;
  };
}

// ============================================================================
// 能力成长追踪类型
// ============================================================================

/** 能力维度 */
interface CapabilityDimensions {
  repair: RepairCapability;
  optimization: OptimizationCapability;
  learning: LearningCapability;
  adaptation: AdaptationCapability;
  collaboration: CollaborationCapability;
}

interface RepairCapability {
  score: number;
  successRate: number;
  avgFixTime: number;
  complexityScore: number;
  metrics: RepairMetrics;
}

interface RepairMetrics {
  totalAttempts: number;
  successfulFixes: number;
  failedFixes: number;
  rolledBackFixes: number;
  avgTimeToFix: number;
  maxComplexityHandled: number;
}

interface OptimizationCapability {
  score: number;
  avgPerformanceGain: number;
  stabilityScore: number;
  metrics: OptimizationMetrics;
}

interface OptimizationMetrics {
  totalOptimizations: number;
  successfulOptimizations: number;
  avgResponseTimeImprovement: number;
  avgThroughputImprovement: number;
  optimizationRegressionRate: number;
}

interface LearningCapability {
  score: number;
  newPatternRecognitionSpeed: number;
  patternReuseRate: number;
  metrics: LearningMetrics;
}

interface LearningMetrics {
  totalPatternsLearned: number;
  patternsReused: number;
  avgRecognitionTime: number;
  knowledgeBaseGrowthRate: number;
}

interface AdaptationCapability {
  score: number;
  newTechAdoptionRate: number;
  envChangeAdaptation: number;
  metrics: AdaptationMetrics;
}

interface AdaptationMetrics {
  adaptationsCompleted: number;
  adaptationSuccessRate: number;
  avgAdaptationTime: number;
  breakingChangesHandled: number;
}

interface CollaborationCapability {
  score: number;
  multiAgentEfficiency: number;
  conflictResolutionRate: number;
  metrics: CollaborationMetrics;
}

interface CollaborationMetrics {
  collaborativeTasks: number;
  conflictsEncountered: number;
  conflictsResolved: number;
  avgCollaborationTime: number;
}

/** 能力报告 */
interface CapabilityReport {
  generatedAt: Date;
  period: { start: Date; end: Date };
  summary: {
    overallCGI: number;
    previousCGI: number;
    cgiDelta: number;
    strongestDimension: string;
    weakestDimension: string;
  };
  dimensions: Record<string, DimensionReport>;
  predictions: {
    nextWeekCGI: number;
    nextMonthCGI: number;
    confidence: number;
    assumptions: string[];
  };
  recommendations: EvolutionRecommendation[];
}

interface DimensionReport {
  currentScore: number;
  previousScore: number;
  delta: number;
  weeklyGrowthRate: number;
  bottlenecks: string[];
  highlights: string[];
}

interface EvolutionRecommendation {
  priority: "high" | "medium" | "low";
  action: string;
  expectedImpact: string;
}

// ============================================================================
// 进化策略引擎类型
// ============================================================================

/** 进化动作 */
interface EvolutionAction {
  id: string;
  type: "code_change" | "config_change" | "learning_task" | "experiment";
  description: string;
  priority: number;
  estimatedRisk: number;
  estimatedImpact: number;
  requiresApproval: boolean;
  targetDimension?: string;
}

/** 风险评估 */
interface RiskAssessment {
  overallRisk: "low" | "medium" | "high" | "critical";
  riskFactors: Array<{
    factor: string;
    severity: "low" | "medium" | "high";
    mitigation: string;
  }>;
  rollbackPlan?: RollbackPlan;
}

interface RollbackPlan {
  targetVersion: string;
  estimatedTime: number;
  steps: string[];
  risk: "low" | "medium" | "high";
}

/** 影响评估 */
interface ImpactEstimation {
  performance: { metric: string; estimatedChange: number }[];
  stability: { metric: string; estimatedChange: number }[];
  capability: { dimension: string; estimatedChange: number }[];
}

/** 审批需求 */
interface ApprovalRequirement {
  type: "author" | "system_admin";
  reason: string;
  urgency: "immediate" | "within_24h" | "within_72h";
}

/** 作者设置 */
interface AuthorSettings {
  trustLevel: number;           // 0-100，作者对系统的信任度
  evolutionEnabled: boolean;     // 总开关
  evolutionSpeed: "conservative" | "balanced" | "aggressive";
  evolutionDirection: "stability" | "features" | "performance";
  autoApproveLevel: number;      // 自动审批的阈值
  sharingLevel: SharingLevel;
  notificationPreferences: NotificationPreferences;
}

enum SharingLevel {
  LEVEL_0_NONE = 0,
  LEVEL_1_ANONYMOUS_METRICS = 1,
  LEVEL_2_PATTERN_SHARE = 2,
  LEVEL_3_FEDERATED_LEARNING = 3,
  LEVEL_4_FULL_CONTRIBUTE = 4
}

interface NotificationPreferences {
  evolutionStarted: boolean;
  evolutionCompleted: boolean;
  evolutionFailed: boolean;
  brakeTriggered: boolean;
  weeklyReport: boolean;
  capabilityMilestone: boolean;
  channel: "in_app" | "email" | "both";
}

// ============================================================================
// 知识共享类型
// ============================================================================

/** 共享数据 */
interface ShareableData {
  issueSignature: string;
  fixPattern: string;
  successMetrics: {
    totalAttempts: number;
    successRate: number;
    avgFixTime: number;
  };
  patternFeatures: Record<string, number>;
}

/** 联邦学习轮次 */
interface FederatedLearningRound {
  round: number;
  localTraining: {
    dataset: string;
    epochs: number;
    model: string;
  };
  aggregation: {
    method: "fedavg" | "fedprox";
    participants: number;
    differentialPrivacy: {
      epsilon: number;
      noiseMechanism: "gaussian";
    };
  };
  globalModel: {
    accuracy: number;
    version: string;
    deploymentStrategy: "immediate" | "canary" | "manual";
  };
}

// ============================================================================
// 可视化面板类型
// ============================================================================

/** 可视化面板数据 */
interface DashboardData {
  capabilityRadar: CapabilityRadarData;
  evolutionTimeline: EvolutionTimelineData;
  knowledgeGrowth: KnowledgeGrowthData;
  autoFixTrend: AutoFixTrendData;
}

interface CapabilityRadarData {
  dimensions: Array<{
    name: string;
    current: number;
    previous: number;
    baseline: number;
  }>;
  updatedAt: string;
}

interface EvolutionTimelineData {
  events: Array<{
    id: string;
    timestamp: string;
    type: "deployment" | "rollback" | "fix" | "optimization" | "milestone";
    title: string;
    description: string;
    status: "success" | "warning" | "error";
  }>;
  currentVersion: string;
}

interface KnowledgeGrowthData {
  totalEntries: number;
  weeklyGrowth: number;
  mostCommonIssueType: string;
  patternReuseRate: number;
  history: Array<{ date: string; count: number }>;
}

interface AutoFixTrendData {
  successRate: number;
  avgFixTime: number;
  autoApprovalRate: number;
  history: Array<{
    date: string;
    successRate: number;
    fixCount: number;
  }>;
}

/** 作者控制面板 */
interface AuthorControlPanel {
  evolutionToggle: {
    master: boolean;
    dimensions: Record<string, boolean>;
  };
  speedSelector: "conservative" | "balanced" | "aggressive";
  directionSelector: "stability" | "features" | "performance";
  rollbackSelector: {
    availableVersions: Array<{
      id: string;
      version: string;
      deployedAt: string;
      stabilityScore: number;
    }>;
    selectedVersion: string | null;
  };
  sharingLevelSelector: SharingLevel;
  privacyPreview: {
    raw: any;
    sanitized: any;
  };
}
```

### 9.2 服务接口定义

```typescript
// ============================================================================
// 问题知识库服务接口
// ============================================================================

interface IIssueKnowledgeService {
  // 存储
  store(entry: IssueKnowledgeEntry): Promise<{ id: string; signature: string }>;
  storeBatch(entries: IssueKnowledgeEntry[]): Promise<Array<{ id: string; signature: string }>>;
  
  // 检索
  findBySignature(signature: string): Promise<IssueKnowledgeEntry | null>;
  semanticSearch(query: string, limit?: number, threshold?: number): Promise<Array<{
    entry: IssueKnowledgeEntry;
    similarity: number;
  }>>;
  hybridSearch(query: IssueQuery, options?: SearchOptions): Promise<Array<{
    entry: IssueKnowledgeEntry;
    relevance: number;
    matchType: "exact" | "semantic" | "hybrid";
  }>>;
  
  // 更新
  updateVerification(id: string, verification: VerificationResult): Promise<void>;
  updateMetadata(id: string, metadata: Partial<KnowledgeMetadata>): Promise<void>;
  
  // 聚类分析
  findClusters(timeWindow: number, minOccurrences: number): Promise<Array<{
    issueType: string;
    count: number;
    avgResolutionTime: number;
    titles: string[];
  }>>;
  
  // 统计
  getStats(timeRange?: { start: Date; end: Date }): Promise<{
    totalIssues: number;
    resolvedIssues: number;
    autoResolvedRate: number;
    avgResolutionTime: number;
    topIssueTypes: Array<{ type: string; count: number }>;
  }>;
}

// ============================================================================
// 代码记忆服务接口
// ============================================================================

interface ICodeMemoryService {
  // 存储
  store(entry: CodeMemoryEntry): Promise<{ id: string }>;
  
  // 检索
  findById(id: string): Promise<CodeMemoryEntry | null>;
  query(query: CodeMemoryQuery): Promise<CodeMemoryEntry[]>;
  semanticSearch(query: string, limit?: number): Promise<Array<{
    entry: CodeMemoryEntry;
    similarity: number;
  }>>;
  
  // 模式提取
  extractPatterns(entryId: string): Promise<{
    fixPattern: FixPattern | null;
    bugPattern: BugPattern | null;
    bestPractice: BestPractice | null;
  }>;
  getCommonPatterns(type: "fix" | "bug" | "best_practice", limit?: number): Promise<Array<{
    pattern: FixPattern | BugPattern | BestPractice;
    frequency: number;
    successRate: number;
  }>>;
  
  // 统计
  getStats(): Promise<{
    totalChanges: number;
    successRate: number;
    mostModifiedFiles: Array<{ path: string; count: number }>;
    patternDistribution: Record<string, number>;
  }>;
}

// ============================================================================
// 进化历史树服务接口
// ============================================================================

interface IEvolutionHistoryService {
  // 节点操作
  addNode(params: CreateNodeParams): Promise<VersionNode>;
  getNode(id: string): Promise<VersionNode | null>;
  getCurrentHead(): Promise<VersionNode>;
  
  // 树操作
  rollbackTo(nodeId: string): Promise<RollbackResult>;
  compareNodes(nodeA: string, nodeB: string): Promise<VersionComparison>;
  findOptimalPath(fromNode: string, toTarget: string): Promise<UpgradePath>;
  getAncestors(nodeId: string): Promise<VersionNode[]>;
  getDescendants(nodeId: string): Promise<VersionNode[]>;
  
  // 树状态
  getTreeState(): Promise<{
    root: VersionNode;
    currentHead: VersionNode;
    leafNodes: VersionNode[];
    totalNodes: number;
    branches: number;
  }>;
  
  // 推荐
  findMostStableVersion(minAge?: number): Promise<VersionNode>;
  findBestPerformanceVersion(): Promise<VersionNode>;
  suggestRollbackPoint(): Promise<VersionNode | null>;
}

// ============================================================================
// 能力追踪服务接口
// ============================================================================

interface ICapabilityTrackingService {
  // 记录
  recordSnapshot(snapshot: CapabilitySnapshot): Promise<void>;
  recordEvent(event: GrowthEvent): Promise<void>;
  
  // 查询
  getLatestSnapshot(): Promise<CapabilitySnapshot>;
  getSnapshots(timeRange: { start: Date; end: Date }): Promise<CapabilitySnapshot[]>;
  getGrowthCurve(dimension: string, timeRange?: { start: Date; end: Date }): Promise<GrowthCurve>;
  
  // 分析
  detectBottlenecks(): Promise<GrowthBottleneck[]>;
  predictFutureScore(dimension: string, daysAhead: number): Promise<number>;
  
  // 报告
  generateReport(period: { start: Date; end: Date }): Promise<CapabilityReport>;
}

// ============================================================================
// 进化策略服务接口
// ============================================================================

interface IEvolutionStrategyService {
  // 策略
  assessCurrentState(): Promise<SystemState>;
  makeDecision(): Promise<StrategyDecision>;
  executePlan(plan: EvolutionPlan): Promise<ExecutionResult>;
  
  // 约束检查
  checkConstraints(proposedChange: any): Promise<ConstraintCheckResult>;
  
  // 刹车
  checkBrakeTriggers(): Promise<BrakeTrigger[]>;
  applyBrake(trigger: BrakeTrigger): Promise<void>;
  
  // 目标管理
  getCurrentGoals(): Promise<EvolutionGoal[]>;
  setGoal(goal: EvolutionGoal): Promise<void>;
  
  // 设置
  updateSettings(settings: Partial<AuthorSettings>): Promise<void>;
  getSettings(): Promise<AuthorSettings>;
}

// ============================================================================
// 知识共享服务接口
// ============================================================================

interface IKnowledgeSharingService {
  // 本地数据准备
  prepareShareableData(): Promise<ShareableData[]>;
  
  // 脱敏
  sanitize(data: ShareableData[], level: SharingLevel): Promise<SanitizedData[]>;
  previewSanitized(data: ShareableData): Promise<any>;
  
  // 联邦学习
  participateInFederatedLearning(round: FederatedLearningRound): Promise<{
    modelUpdate: any;
    metrics: { loss: number; accuracy: number; samples: number };
  }>;
  applyGlobalModel(model: any): Promise<void>;
  
  // 共享控制
  setSharingLevel(level: SharingLevel): Promise<void>;
  getSharingLevel(): Promise<SharingLevel>;
  getSharingHistory(): Promise<SharingRecord[]>;
  revokeAllSharing(): Promise<{ revoked: boolean; affectedRecords: number }>;
}
```



---

## 10. 可视化面板设计规格

### 10.1 仪表板布局

```
┌─────────────────────────────────────────────────────────────────────┐
│  Evolution Engine Dashboard                          [User: Author]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 能力成长雷达图 (Capability Radar)                              │ │
│  │                                                               │ │
│  │          优化能力                                              │ │
│  │          (Optimization)                                        │ │
│  │              ▲                                                │ │
│  │             /│\                                               │ │
│  │            / │ \        当前分数    上期分数    基线           │ │
│  │           /  │  \      ──────────────────────────────         │ │
│  │  修复能力 ───┼─── 学习能力   修复 ████████░░ 82   78   60     │ │
│  │  (Repair)   │   (Learning)   优化 ██████░░░░ 65   62   55     │ │
│  │             │                学习 ████████░░ 78   75   50     │ │
│  │             │                适应 ███████░░░ 58   55   45     │ │
│  │             │                协作 ██████░░░░ 62   60   50     │ │
│  │             │       综合CGI: 69  ▲5%                         │ │
│  │  协作能力 ───┘─── 适应能力                                    │ │
│  │(Collaboration) (Adaptation)                                  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ 进化历史时间线              │  │ 知识库增长曲线                │  │
│  │ (Evolution Timeline)       │  │ (Knowledge Growth)           │  │
│  │                             │  │                               │  │
│  │  ●───●───●═══●───●         │  │  ┌─────────────────────────┐  │  │
│  │  │   │   │ M  │   │         │  │  │ ▓▓▓▓░░░░░░░░░░░░░░░░░░░ │  │  │
│  │ v3.0 v3.1 v3.2^ v3.3 v3.4  │  │  │ ▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░ │  │  │
│  │  │   │   │ │  │   │         │  │  │ ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░ │  │  │
│  │  └───┴───┘ │  └───┘         │  │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░ │  │  │
│  │      │   merge               │  │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░ │  │  │
│  │   rollback (热修失败)        │  │  └─────────────────────────┘  │  │
│  │                             │  │  条目: 156  ▲12%  复用率: 34% │  │
│  │  当前: v3.4  稳定           │  │                               │  │
│  └────────────────────────────┘  └──────────────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ 自动修复成功率趋势          │  │ 本周进化摘要                  │  │
│  │ (Auto-Fix Success Rate)    │  │ (Weekly Summary)             │  │
│  │                             │  │                               │  │
│  │  100%│       ╭─╮           │  │  修复次数: 12    成功率: 92%  │  │
│  │   90%│    ╭──╯ ╰──╮        │  │  新增知识: 8     复用: 4      │  │
│  │   80%│╭───╯        ╰──╮    │  │  优化: 2次       回滚: 0     │  │
│  │   70%│                ╰──╮ │  │  能力成长: +5%   CGI: 69     │  │
│  │      └─────────────────── │  │  最弱维度: 适应能力 (+3)      │  │
│  │       W1  W2  W3  W4  W5  │  │  建议: 关注环境适配训练        │  │
│  │                             │  │                               │  │
│  │  目标: 95%  当前: 88%       │  │  [查看详细报告] [导出PDF]      │  │
│  └────────────────────────────┘  └──────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.2 作者控制面板

```
┌─────────────────────────────────────────────────────────────────────┐
│                    进化控制台 (Evolution Control Panel)              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  主开关                                                            │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  [🟢 进化引擎运行中]    [🔴 停止进化]    [⏸️ 暂停]          │ │
│  │  运行时间: 14天  累计进化: 23次  成功率: 87%                  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  进化速度                                                          │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  [保守]────[平衡●]----[激进]                                   │ │
│  │  自动审批阈值: 低风险变更 (<30%风险) 置信度>90%               │ │
│  │  审批等待: 24小时超时自动取消                                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  进化方向优先级                                                    │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  [稳定性●]  [功能]  [性能]  [平衡]                             │ │
│  │  当前: 优先保证系统稳定，减少变更风险                           │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  各维度独立开关                                                    │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  ☑ 自动修复 (当前: 开启)   ☑ 性能优化 (当前: 开启)           │ │
│  │  ☑ 模式学习 (当前: 开启)   ☐ 主动探索 (当前: 关闭)           │ │
│  │  ☑ 架构进化 (当前: 开启)   ☐ 联邦学习 (当前: 关闭)           │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  版本回退                                                          │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  可回退版本:                                                  │ │
│  │  ○ v3.4.2 (当前)  稳定分: 96   部署于: 2024-03-15           │ │
│  │  ○ v3.4.1         稳定分: 94   部署于: 2024-03-10           │ │
│  │  ● v3.4.0         稳定分: 95   部署于: 2024-03-08 [推荐]    │ │
│  │  ○ v3.3.2         稳定分: 92   部署于: 2024-02-28           │ │
│  │  [回退到选中版本]  [查看完整历史]                             │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  隐私与共享                                                         │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  共享级别: [不共享●] [匿名指标] [修复模式] [联邦学习] [完整]   │ │
│  │  [预览共享数据] [查看共享历史] [撤回所有共享数据]              │ │
│  │  已共享数据: 0条  最后共享: 无                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.3 前端组件接口

```typescript
// 雷达图组件
interface CapabilityRadarProps {
  data: Array<{
    dimension: string;
    current: number;
    previous: number;
    baseline: number;
  }>;
  size?: number;
  animated?: boolean;
  onDimensionClick?: (dimension: string) => void;
}

// 时间线组件
interface EvolutionTimelineProps {
  events: Array<{
    id: string;
    timestamp: string;
    type: "deployment" | "rollback" | "fix" | "optimization" | "milestone";
    title: string;
    status: "success" | "warning" | "error";
  }>;
  currentVersion: string;
  onEventClick?: (eventId: string) => void;
  onVersionSelect?: (versionId: string) => void;
}

// 知识增长曲线组件
interface KnowledgeGrowthChartProps {
  data: Array<{ date: string; count: number }>;
  growthRate: number;
  totalEntries: number;
  patternReuseRate: number;
  timeRange?: "1w" | "1m" | "3m" | "6m" | "1y";
}

// 自动修复趋势组件
interface AutoFixTrendProps {
  data: Array<{
    date: string;
    successRate: number;
    fixCount: number;
  }>;
  targetRate: number;
  currentRate: number;
  showConfidenceInterval?: boolean;
}

// 控制面板组件
interface EvolutionControlProps {
  settings: AuthorSettings;
  status: {
    isRunning: boolean;
    uptime: number;
    totalEvolutions: number;
    successRate: number;
  };
  onToggleEvolution: (enabled: boolean) => void;
  onSpeedChange: (speed: string) => void;
  onDirectionChange: (direction: string) => void;
  onDimensionToggle: (dimension: string, enabled: boolean) => void;
  onRollback: (versionId: string) => void;
  onSharingLevelChange: (level: number) => void;
}
```

### 10.4 可视化数据端点

```typescript
// Dashboard API 端点
interface DashboardAPI {
  // GET /api/v1/dashboard/overview
  getOverview(): Promise<{
    cgi: number;
    cgiDelta: number;
    uptime: number;
    totalKnowledge: number;
    successRate: number;
    currentVersion: string;
    evolutionStatus: "running" | "paused" | "braking" | "stopped";
    alerts: Array<{
      level: "warning" | "critical";
      message: string;
      timestamp: string;
    }>;
  }>;

  // GET /api/v1/dashboard/capabilities
  getCapabilities(): Promise<CapabilityRadarData>;

  // GET /api/v1/dashboard/timeline
  getTimeline(params?: { 
    limit?: number; 
    type?: string[];
    from?: string;
    to?: string;
  }): Promise<EvolutionTimelineData>;

  // GET /api/v1/dashboard/knowledge-growth
  getKnowledgeGrowth(params?: {
    timeRange?: "1w" | "1m" | "3m" | "6m" | "1y";
  }): Promise<KnowledgeGrowthData>;

  // GET /api/v1/dashboard/auto-fix-trend
  getAutoFixTrend(params?: {
    timeRange?: "1w" | "1m" | "3m";
  }): Promise<AutoFixTrendData>;

  // GET /api/v1/dashboard/reports/weekly
  getWeeklyReport(): Promise<CapabilityReport>;

  // WebSocket 实时更新
  subscribeRealtime(): WebSocket;
}

// WebSocket 实时推送消息
interface DashboardRealtimeMessage {
  type: "capability_update" | "new_evolution" | "brake_triggered" | "knowledge_added" | "milestone";
  timestamp: string;
  data: any;
}
```

### 10.5 响应式布局

```typescript
// 断点定义
interface ResponsiveBreakpoints {
  mobile: "< 768px";       // 单列堆叠布局
  tablet: "768px - 1024px"; // 两列布局
  desktop: "1024px - 1440px"; // 三列布局
  wide: "> 1440px";         // 四列布局
}

// 布局配置
const DASHBOARD_LAYOUT = {
  mobile: {
    columns: 1,
    componentOrder: [
      "status_bar",
      "capability_radar",
      "weekly_summary",
      "auto_fix_trend",
      "evolution_timeline",
      "knowledge_growth"
    ]
  },
  tablet: {
    columns: 2,
    grid: [
      ["capability_radar", "weekly_summary"],
      ["auto_fix_trend", "auto_fix_trend"],
      ["evolution_timeline", "knowledge_growth"]
    ]
  },
  desktop: {
    columns: 3,
    grid: [
      ["capability_radar", "capability_radar", "weekly_summary"],
      ["auto_fix_trend", "evolution_timeline", "knowledge_growth"]
    ]
  },
  wide: {
    columns: 4,
    grid: [
      ["capability_radar", "capability_radar", "weekly_summary", "weekly_summary"],
      ["auto_fix_trend", "auto_fix_trend", "evolution_timeline", "knowledge_growth"]
    ]
  }
};
```

---

## 11. PostgreSQL 数据库 Schema

### 11.1 完整数据库 Schema

```sql
-- ============================================================
-- 扩展
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "ltree";

-- ============================================================
-- 1. 问题知识库表
-- ============================================================

CREATE TABLE issue_knowledge_base (
  id VARCHAR(32) PRIMARY KEY,
  
  -- 签名
  signature_type_hash VARCHAR(128) NOT NULL,
  signature_pattern_hash VARCHAR(128) NOT NULL,
  signature_context_hash VARCHAR(128) NOT NULL,
  signature_full VARCHAR(256) NOT NULL,
  signature_confidence NUMERIC(3,2) DEFAULT 1.0,
  
  -- 描述
  description_title VARCHAR(200) NOT NULL,
  description_detail TEXT,
  description_impact JSONB DEFAULT '{}',
  
  -- 根因
  root_cause_category VARCHAR(20) CHECK (root_cause_category IN ('technical', 'architectural', 'external_dependency', 'configuration', 'human_error', 'unknown')),
  root_cause_analysis TEXT,
  root_cause_technical JSONB,
  root_cause_architectural JSONB,
  root_cause_external JSONB,
  
  -- 修复
  fix_applied JSONB NOT NULL DEFAULT '{}',
  fix_alternatives JSONB DEFAULT '[]',
  fix_selection_rationale TEXT,
  
  -- 验证
  verification_test_report JSONB,
  verification_deployment_result VARCHAR(20),
  verification_author_feedback JSONB,
  verification_metrics_before JSONB,
  verification_metrics_after JSONB,
  
  -- 元数据
  metadata_created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata_resolved_at TIMESTAMPTZ,
  metadata_resolution_time NUMERIC(8,2),
  metadata_status VARCHAR(20) DEFAULT 'open' CHECK (metadata_status IN ('open', 'analyzing', 'fixing', 'verifying', 'resolved', 'closed', 'reopened')),
  metadata_source VARCHAR(20) CHECK (metadata_source IN ('auto_detected', 'author_reported', 'monitoring_alert', 'proactive_check')),
  metadata_related_tickets TEXT[],
  metadata_tags TEXT[],
  metadata_auto_resolved BOOLEAN DEFAULT FALSE,
  metadata_author_approved BOOLEAN DEFAULT FALSE,
  
  -- pgvector 嵌入向量
  embeddings_description VECTOR(1536),
  embeddings_stack_trace VECTOR(1536),
  embeddings_solution VECTOR(1536),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE UNIQUE INDEX idx_issue_kb_full_signature ON issue_knowledge_base (signature_full);
CREATE INDEX idx_issue_kb_type_hash ON issue_knowledge_base (signature_type_hash);
CREATE INDEX idx_issue_kb_status ON issue_knowledge_base (metadata_status);
CREATE INDEX idx_issue_kb_created ON issue_knowledge_base (metadata_created_at DESC);
CREATE INDEX idx_issue_kb_tags ON issue_knowledge_base USING GIN (metadata_tags);

-- pgvector HNSW 索引（更快近似搜索）
CREATE INDEX idx_issue_kb_embedding_desc ON issue_knowledge_base 
  USING hnsw (embeddings_description vector_cosine_ops);
CREATE INDEX idx_issue_kb_embedding_solution ON issue_knowledge_base 
  USING hnsw (embeddings_solution vector_cosine_ops);

-- ============================================================
-- 2. 代码记忆库表
-- ============================================================

CREATE TABLE code_memory (
  id VARCHAR(32) PRIMARY KEY,
  
  -- 变更信息
  change_before JSONB NOT NULL DEFAULT '{}',
  change_after JSONB NOT NULL DEFAULT '{}',
  change_diff TEXT,
  change_reason JSONB NOT NULL DEFAULT '{}',
  change_timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  -- 影响
  impact_files_modified JSONB DEFAULT '[]',
  impact_modules_affected TEXT[],
  impact_dependencies_changed JSONB DEFAULT '[]',
  impact_risk_assessment JSONB,
  
  -- 结果
  result_status VARCHAR(20) CHECK (result_status IN ('success', 'partial_success', 'failed', 'rolled_back')),
  result_deployment_info JSONB,
  result_metrics_delta JSONB,
  result_author_review JSONB,
  
  -- 模式
  patterns_fix JSONB,
  patterns_bug JSONB,
  patterns_best_practice JSONB,
  
  -- 嵌入向量
  embeddings_code_change VECTOR(1536),
  embeddings_reason VECTOR(1536),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_code_memory_trigger ON code_memory ((change_reason->>'trigger'));
CREATE INDEX idx_code_memory_status ON code_memory (result_status);
CREATE INDEX idx_code_memory_timestamp ON code_memory (change_timestamp DESC);
CREATE INDEX idx_code_memory_modules ON code_memory USING GIN (impact_modules_affected);

-- pgvector 索引
CREATE INDEX idx_code_memory_embedding_code ON code_memory 
  USING hnsw (embeddings_code_change vector_cosine_ops);

-- ============================================================
-- 3. 进化历史树表
-- ============================================================

CREATE TABLE version_nodes (
  id VARCHAR(32) PRIMARY KEY,
  version VARCHAR(32) NOT NULL,
  parent_ids TEXT[] DEFAULT '{}',
  tree_path LTREE,
  deployed_at TIMESTAMPTZ DEFAULT NOW(),
  deployed_by VARCHAR(10) CHECK (deployed_by IN ('auto', 'author', 'system')),
  change_summary JSONB NOT NULL DEFAULT '{}',
  performance_baseline JSONB NOT NULL DEFAULT '{}',
  stability_score JSONB NOT NULL DEFAULT '{}',
  author_satisfaction JSONB,
  labels TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  is_current_head BOOLEAN DEFAULT FALSE,
  is_rollback_point BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE version_edges (
  id SERIAL PRIMARY KEY,
  from_node VARCHAR(32) REFERENCES version_nodes(id),
  to_node VARCHAR(32) REFERENCES version_nodes(id),
  edge_type VARCHAR(20) CHECK (edge_type IN ('parent_child', 'merge', 'rollback')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_version_nodes_path ON version_nodes USING GIST (tree_path);
CREATE INDEX idx_version_nodes_version ON version_nodes (version);
CREATE INDEX idx_version_nodes_current ON version_nodes (is_current_head) WHERE is_current_head = TRUE;
CREATE INDEX idx_version_nodes_labels ON version_nodes USING GIN (labels);
CREATE INDEX idx_version_edges_from ON version_edges (from_node);
CREATE INDEX idx_version_edges_to ON version_edges (to_node);

-- ============================================================
-- 4. 能力追踪表
-- ============================================================

CREATE TABLE capability_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_at TIMESTAMPTZ DEFAULT NOW(),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  
  -- 修复能力
  repair_score NUMERIC(5,2),
  repair_success_rate NUMERIC(5,2),
  repair_avg_fix_time NUMERIC(8,2),
  repair_complexity_score NUMERIC(5,2),
  repair_metrics JSONB,
  
  -- 优化能力
  optimization_score NUMERIC(5,2),
  optimization_avg_gain NUMERIC(5,2),
  optimization_stability NUMERIC(5,2),
  optimization_metrics JSONB,
  
  -- 学习能力
  learning_score NUMERIC(5,2),
  learning_recognition_speed NUMERIC(5,2),
  learning_reuse_rate NUMERIC(5,2),
  learning_metrics JSONB,
  
  -- 适应能力
  adaptation_score NUMERIC(5,2),
  adaptation_adoption_rate NUMERIC(5,2),
  adaptation_env_score NUMERIC(5,2),
  adaptation_metrics JSONB,
  
  -- 协作能力
  collaboration_score NUMERIC(5,2),
  collaboration_efficiency NUMERIC(5,2),
  collaboration_conflict_resolution NUMERIC(5,2),
  collaboration_metrics JSONB,
  
  -- 综合指数
  cgi NUMERIC(5,2),
  
  -- 事件
  events JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE growth_events (
  id SERIAL PRIMARY KEY,
  event_at TIMESTAMPTZ DEFAULT NOW(),
  dimension VARCHAR(20) CHECK (dimension IN ('repair', 'optimization', 'learning', 'adaptation', 'collaboration', 'overall')),
  event_type VARCHAR(30) CHECK (event_type IN ('milestone', 'bottleneck_detected', 'regression', 'breakthrough', 'plateau_resolved')),
  description TEXT,
  score_delta NUMERIC(5,2),
  related_issue_id VARCHAR(32),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_capability_snapshots_time ON capability_snapshots (snapshot_at DESC);
CREATE INDEX idx_growth_events_dimension ON growth_events (dimension, event_at DESC);

-- ============================================================
-- 5. 进化策略表
-- ============================================================

CREATE TABLE evolution_plans (
  id VARCHAR(32) PRIMARY KEY,
  strategy_type VARCHAR(20) CHECK (strategy_type IN ('passive', 'active', 'exploratory')),
  priority NUMERIC(3,0),
  proposed_actions JSONB NOT NULL DEFAULT '[]',
  risk_assessment JSONB,
  estimated_impact JSONB,
  required_approvals JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executing', 'completed', 'failed', 'cancelled')),
  approved_by VARCHAR(10),
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE brake_events (
  id SERIAL PRIMARY KEY,
  trigger_id VARCHAR(20) NOT NULL,
  trigger_name VARCHAR(100) NOT NULL,
  severity VARCHAR(20) CHECK (severity IN ('warning', 'critical', 'emergency')),
  action_taken VARCHAR(20) NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(10),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evolution_plans_status ON evolution_plans (status);
CREATE INDEX idx_evolution_plans_type ON evolution_plans (strategy_type);
CREATE INDEX idx_brake_events_severity ON brake_events (severity, created_at DESC);

-- ============================================================
-- 6. 作者设置表
-- ============================================================

CREATE TABLE author_settings (
  id SERIAL PRIMARY KEY,
  author_id VARCHAR(64) UNIQUE NOT NULL,
  trust_level NUMERIC(5,2) DEFAULT 0,
  evolution_enabled BOOLEAN DEFAULT TRUE,
  evolution_speed VARCHAR(20) DEFAULT 'balanced' CHECK (evolution_speed IN ('conservative', 'balanced', 'aggressive')),
  evolution_direction VARCHAR(20) DEFAULT 'balanced' CHECK (evolution_direction IN ('stability', 'features', 'performance', 'balanced')),
  auto_approve_level NUMERIC(5,2) DEFAULT 0,
  sharing_level INTEGER DEFAULT 0 CHECK (sharing_level BETWEEN 0 AND 4),
  notification_preferences JSONB DEFAULT '{
    "evolutionStarted": true,
    "evolutionCompleted": true,
    "evolutionFailed": true,
    "brakeTriggered": true,
    "weeklyReport": true,
    "capabilityMilestone": true,
    "channel": "in_app"
  }',
  dimension_toggles JSONB DEFAULT '{
    "autoFix": true,
    "performanceOptimization": true,
    "patternLearning": true,
    "activeExploration": false,
    "architectureEvolution": true,
    "federatedLearning": false
  }',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. 知识共享记录表
-- ============================================================

CREATE TABLE sharing_records (
  id SERIAL PRIMARY KEY,
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  data_type VARCHAR(50) NOT NULL,
  sharing_level INTEGER NOT NULL,
  sanitized BOOLEAN DEFAULT TRUE,
  recipient VARCHAR(50),
  data_hash VARCHAR(64),  -- 脱敏后数据的哈希
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_sharing_records_time ON sharing_records (shared_at DESC);

-- ============================================================
-- 8. 联邦学习表
-- ============================================================

CREATE TABLE federated_learning_rounds (
  id SERIAL PRIMARY KEY,
  round_number INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  aggregation_method VARCHAR(20) DEFAULT 'fedavg',
  participants_count INTEGER DEFAULT 0,
  global_model_accuracy NUMERIC(5,2),
  global_model_version VARCHAR(32),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE local_model_updates (
  id SERIAL PRIMARY KEY,
  round_id INTEGER REFERENCES federated_learning_rounds(id),
  update_data JSONB NOT NULL,
  metrics JSONB,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 存储过程
-- ============================================================

-- 查找某节点的所有祖先
CREATE OR REPLACE FUNCTION get_ancestor_nodes(p_node_id VARCHAR)
RETURNS TABLE (ancestor_id VARCHAR, version VARCHAR, tree_path LTREE) AS $$
BEGIN
  RETURN QUERY
  SELECT v.id, v.version, v.tree_path
  FROM version_nodes v,
       (SELECT t.tree_path FROM version_nodes t WHERE t.id = p_node_id) target
  WHERE v.tree_path @> target.tree_path
    AND v.id != p_node_id
  ORDER BY v.tree_path;
END;
$$ LANGUAGE plpgsql;

-- 查找某节点的所有后代
CREATE OR REPLACE FUNCTION get_descendant_nodes(p_node_id VARCHAR)
RETURNS TABLE (descendant_id VARCHAR, version VARCHAR, tree_path LTREE) AS $$
BEGIN
  RETURN QUERY
  SELECT v.id, v.version, v.tree_path
  FROM version_nodes v,
       (SELECT t.tree_path FROM version_nodes t WHERE t.id = p_node_id) target
  WHERE v.tree_path <@ target.tree_path
    AND v.id != p_node_id
  ORDER BY v.tree_path;
END;
$$ LANGUAGE plpgsql;

-- 查找最优路径
CREATE OR REPLACE FUNCTION find_optimal_path(p_from_id VARCHAR, p_to_id VARCHAR)
RETURNS TABLE (step_number INT, node_id VARCHAR, version VARCHAR, risk_score NUMERIC) AS $$
DECLARE
  from_path LTREE;
  to_path LTREE;
  lca_path LTREE;
BEGIN
  SELECT v.tree_path INTO from_path FROM version_nodes v WHERE v.id = p_from_id;
  SELECT v.tree_path INTO to_path FROM version_nodes v WHERE v.id = p_to_id;
  
  lca_path := CASE 
    WHEN from_path <@ to_path THEN from_path
    WHEN to_path <@ from_path THEN to_path
    ELSE (
      SELECT v.tree_path FROM version_nodes v
      WHERE v.tree_path @> from_path AND v.tree_path @> to_path
      ORDER BY nlevel(v.tree_path) DESC LIMIT 1
    )
  END;
  
  RETURN QUERY
  WITH path_up AS (
    SELECT v.id, v.version, v.tree_path, 
           COALESCE(100 - (v.stability_score->>'score')::numeric, 50) as risk
    FROM version_nodes v
    WHERE v.tree_path @> lca_path AND v.tree_path <@ from_path
    ORDER BY nlevel(v.tree_path) DESC
  ),
  path_down AS (
    SELECT v.id, v.version, v.tree_path,
           COALESCE(100 - (v.stability_score->>'score')::numeric, 50) as risk
    FROM version_nodes v
    WHERE v.tree_path @> lca_path AND v.tree_path <@ to_path
      AND v.tree_path != lca_path
    ORDER BY nlevel(v.tree_path) ASC
  )
  SELECT ROW_NUMBER() OVER ()::int, p.id, p.version, p.risk
  FROM (SELECT * FROM path_up UNION ALL SELECT * FROM path_down) p;
END;
$$ LANGUAGE plpgsql;

-- 知识库聚类分析
CREATE OR REPLACE FUNCTION analyze_issue_clusters(
  p_days INTEGER DEFAULT 30,
  p_min_occurrences INTEGER DEFAULT 3
)
RETURNS TABLE (
  issue_type VARCHAR,
  occurrence_count BIGINT,
  avg_resolution_time NUMERIC,
  titles TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    signature_type_hash::VARCHAR,
    COUNT(*)::BIGINT,
    AVG(COALESCE(metadata_resolution_time, 0))::NUMERIC,
    STRING_AGG(DISTINCT description_title, ' | ')::TEXT
  FROM issue_knowledge_base
  WHERE metadata_created_at > NOW() - (p_days || ' days')::INTERVAL
    AND metadata_status IN ('resolved', 'closed')
  GROUP BY signature_type_hash
  HAVING COUNT(*) >= p_min_occurrences
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

-- 更新能力快照
CREATE OR REPLACE FUNCTION calculate_cgi()
RETURNS TRIGGER AS $$
BEGIN
  NEW.cgi := ROUND((
    COALESCE(NEW.repair_score, 0) * 0.30 +
    COALESCE(NEW.optimization_score, 0) * 0.20 +
    COALESCE(NEW.learning_score, 0) * 0.20 +
    COALESCE(NEW.adaptation_score, 0) * 0.15 +
    COALESCE(NEW.collaboration_score, 0) * 0.15
  )::numeric, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_cgi
BEFORE INSERT OR UPDATE ON capability_snapshots
FOR EACH ROW EXECUTE FUNCTION calculate_cgi();

-- 设置更新时间
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_issue_kb_updated_at
BEFORE UPDATE ON issue_knowledge_base
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_author_settings_updated_at
BEFORE UPDATE ON author_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 语义检索函数
CREATE OR REPLACE FUNCTION search_issues_semantic(
  p_query_vector VECTOR(1536),
  p_threshold NUMERIC DEFAULT 0.6,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id VARCHAR,
  title VARCHAR,
  similarity NUMERIC,
  fix_strategy VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.description_title::VARCHAR,
    (1 - (i.embeddings_description <=> p_query_vector))::NUMERIC,
    (i.fix_applied->>'strategy')::VARCHAR
  FROM issue_knowledge_base i
  WHERE 1 - (i.embeddings_description <=> p_query_vector) > p_threshold
  ORDER BY i.embeddings_description <=> p_query_vector
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

---

## 12. XState 状态机定义

### 12.1 知识库操作状态机

```typescript
import { createMachine, assign } from "xstate";

// 知识条目生命周期状态机
const knowledgeEntryLifecycleMachine = createMachine({
  id: "knowledgeEntryLifecycle",
  initial: "detected",
  context: {
    entryId: null as string | null,
    signature: null as string | null,
    similarIssues: [] as any[],
    fixApplied: null as any | null,
    verificationResult: null as any | null,
    retryCount: 0
  },
  states: {
    // 检测到新问题
    detected: {
      entry: assign({ entryId: (_, event: any) => event.entryId }),
      invoke: {
        src: "generateSignature",
        onDone: {
          target: "searching",
          actions: assign({ signature: (_, event: any) => event.data })
        },
        onError: "signatureFailed"
      }
    },

    // 签名生成失败
    signatureFailed: {
      entry: ["logSignatureFailure"],
      after: { 5000: "detected" }  // 5秒后重试
    },

    // 在知识库中搜索
    searching: {
      invoke: {
        src: "searchSimilarIssues",
        onDone: [
          {
            target: "exactMatch",
            guard: "hasExactMatch",
            actions: assign({ similarIssues: (_, event: any) => event.data })
          },
          {
            target: "similarFound",
            guard: "hasSimilarMatch",
            actions: assign({ similarIssues: (_, event: any) => event.data })
          },
          {
            target: "newIssue",
            actions: assign({ similarIssues: [] })
          }
        ],
        onError: "searchFailed"
      }
    },

    searchFailed: {
      entry: ["logSearchFailure"],
      after: { 3000: "searching" }
    },

    // 发现精确匹配
    exactMatch: {
      entry: ["recommendHistoricalFix"],
      on: {
        APPLY_RECOMMENDED: "fixing",
        REJECT_RECOMMENDED: "analyzing",
        VIEW_SIMILAR: "similarFound"
      }
    },

    // 发现相似问题
    similarFound: {
      entry: ["showSimilarIssues"],
      on: {
        SELECT_FIX: "fixing",
        CUSTOM_FIX: "analyzing",
        ESCALATE: "analyzing"
      }
    },

    // 全新问题
    newIssue: {
      entry: ["createNewEntry"],
      on: {
        START_ANALYSIS: "analyzing"
      }
    },

    // 分析中
    analyzing: {
      invoke: {
        src: "analyzeIssue",
        onDone: {
          target: "fixing",
          actions: assign({ fixApplied: (_, event: any) => event.data })
        },
        onError: "analysisFailed"
      }
    },

    analysisFailed: {
      entry: ["logAnalysisFailure", "notifyAuthor"],
      on: {
        RETRY: {
          target: "analyzing",
          guard: "canRetry",
          actions: assign({ retryCount: (ctx) => ctx.retryCount + 1 })
        },
        ESCALATE: "escalated"
      }
    },

    // 修复中
    fixing: {
      invoke: {
        src: "applyFix",
        onDone: "verifying",
        onError: "fixFailed"
      }
    },

    fixFailed: {
      entry: ["logFixFailure"],
      on: {
        RETRY: {
          target: "fixing",
          guard: "canRetry",
          actions: assign({ retryCount: (ctx) => ctx.retryCount + 1 })
        },
        ROLLBACK: "rolledBack",
        ESCALATE: "escalated"
      }
    },

    // 验证中
    verifying: {
      invoke: {
        src: "verifyFix",
        onDone: [
          {
            target: "resolved",
            guard: "verificationPassed"
          },
          {
            target: "fixFailed",
            guard: "verificationFailed"
          }
        ]
      }
    },

    // 已解决
    resolved: {
      entry: [
        "updateKnowledgeEntry",
        "notifyAuthor",
        "updateCapabilityScores"
      ],
      on: {
        AUTHOR_APPROVES: "closed",
        AUTHOR_REJECTS: "reopened",
        REGRESSION_DETECTED: "reopened"
      }
    },

    // 已关闭
    closed: {
      type: "final",
      entry: ["archiveEntry"]
    },

    // 已重新打开
    reopened: {
      entry: ["logReopenReason"],
      on: {
        RE_ANALYZE: "analyzing",
        ESCALATE: "escalated"
      }
    },

    // 已回滚
    rolledBack: {
      entry: ["logRollback", "updateEntryWithRollback"],
      on: {
        RE_ANALYZE: "analyzing",
        CLOSE: "closed"
      }
    },

    // 已升级（需要人工介入）
    escalated: {
      entry: ["notifyAuthor", "createSupportTicket"],
      on: {
        AUTHOR_PROVIDES_FIX: "fixing",
        AUTHOR_CLOSES: "closed"
      }
    }
  }
}, {
  guards: {
    hasExactMatch: (_, event: any) => event.data.some((m: any) => m.matchType === "exact"),
    hasSimilarMatch: (_, event: any) => event.data.length > 0,
    canRetry: (ctx) => ctx.retryCount < 3,
    verificationPassed: (_, event: any) => event.data.passed,
    verificationFailed: (_, event: any) => !event.data.passed
  }
});
```

### 12.2 进化引擎主状态机

```typescript
// 进化引擎主状态机
const evolutionEngineMasterMachine = createMachine({
  id: "evolutionEngine",
  initial: "initializing",
  context: {
    currentStrategy: null as string | null,
    pendingPlan: null as any | null,
    brakeTrigger: null as any | null,
    authorSettings: null as any | null,
    isLocked: false
  },
  states: {
    // 初始化
    initializing: {
      invoke: {
        src: "loadAuthorSettings",
        onDone: {
          target: "idle",
          actions: assign({ authorSettings: (_, event: any) => event.data })
        },
        onError: "fatalError"
      }
    },

    // 空闲等待
    idle: {
      on: {
        SCHEDULED_ASSESSMENT: {
          target: "assessing",
          guard: "evolutionEnabled"
        },
        ISSUE_TRIGGERED: {
          target: "passiveEvolving",
          guard: "evolutionEnabled"
        },
        GOAL_SET: {
          target: "activePlanning",
          guard: "evolutionEnabled"
        },
        EXPERIMENT_REQUESTED: {
          target: "exploratoryHypothesis",
          guard: "evolutionEnabled"
        },
        UPDATE_SETTINGS: {
          actions: assign({ authorSettings: (_, event: any) => event.settings })
        },
        TOGGLE_EVOLUTION: {
          actions: ["toggleEvolution", assign({ authorSettings: (ctx, event: any) => ({
            ...ctx.authorSettings,
            evolutionEnabled: event.enabled
          })})]
        }
      }
    },

    // 状态评估
    assessing: {
      invoke: {
        src: "assessSystemState",
        onDone: "deciding",
        onError: { target: "idle", actions: "logAssessmentError" }
      }
    },

    // 决策制定
    deciding: {
      invoke: {
        src: "makeEvolutionDecision",
        onDone: [
          {
            target: "braking",
            guard: "brakeConditionMet",
            actions: assign({ brakeTrigger: (_, event: any) => event.data.brakeTrigger })
          },
          {
            target: "passiveEvolving",
            guard: "isPassiveStrategy",
            actions: assign({ currentStrategy: "passive" })
          },
          {
            target: "activePlanning",
            guard: "isActiveStrategy",
            actions: assign({ currentStrategy: "active" })
          },
          {
            target: "exploratoryHypothesis",
            guard: "isExploratoryStrategy",
            actions: assign({ currentStrategy: "exploratory" })
          },
          { target: "idle" }
        ],
        onError: { target: "idle", actions: "logDecisionError" }
      }
    },

    // 被动进化（问题驱动）
    passiveEvolving: {
      entry: ["logPassiveStart"],
      invoke: {
        src: "executePassiveEvolution",
        onDone: "verifying",
        onError: {
          target: "braking",
          actions: assign({
            brakeTrigger: () => ({
              id: "BT-PASSIVE-FAIL",
              name: "被动进化执行失败",
              severity: "critical"
            })
          })
        }
      }
    },

    // 主动规划（目标驱动）
    activePlanning: {
      entry: ["logActiveStart"],
      invoke: {
        src: "createActivePlan",
        onDone: {
          target: "awaitingApproval",
          actions: assign({ pendingPlan: (_, event: any) => event.data })
        },
        onError: { target: "idle", actions: "logPlanningError" }
      }
    },

    // 探索假设（实验驱动）
    exploratoryHypothesis: {
      entry: ["logExploratoryStart"],
      invoke: {
        src: "createHypothesis",
        onDone: {
          target: "awaitingApproval",
          actions: assign({ pendingPlan: (_, event: any) => event.data })
        },
        onError: { target: "idle", actions: "logHypothesisError" }
      }
    },

    // 等待审批
    awaitingApproval: {
      entry: ["sendApprovalRequest"],
      on: {
        APPROVED: {
          target: "executing",
          actions: ["recordApproval", assign({ pendingPlan: null })]
        },
        REJECTED: {
          target: "idle",
          actions: ["recordRejection", "notifyAuthor", assign({ pendingPlan: null })]
        },
        AUTO_APPROVED: {
          target: "executing",
          guard: "canAutoApprove",
          actions: ["recordAutoApproval"]
        }
      },
      after: {
        86400000: {  // 24小时超时
          target: "idle",
          actions: ["recordTimeout", assign({ pendingPlan: null })]
        }
      }
    },

    // 执行中
    executing: {
      invoke: {
        src: "executeEvolutionPlan",
        onDone: "verifying",
        onError: {
          target: "braking",
          actions: assign({
            brakeTrigger: () => ({
              id: "BT-EXEC-FAIL",
              name: "进化执行失败",
              severity: "critical"
            })
          })
        }
      }
    },

    // 验证中
    verifying: {
      invoke: {
        src: "verifyEvolutionResult",
        onDone: [
          {
            target: "success",
            guard: "verificationPassed"
          },
          {
            target: "braking",
            guard: "verificationFailed",
            actions: assign({
              brakeTrigger: () => ({
                id: "BT-VERIFY-FAIL",
                name: "进化验证失败",
                severity: "critical"
              })
            })
          }
        ]
      }
    },

    // 成功
    success: {
      entry: [
        "recordSuccess",
        "updateCapabilityScores",
        "notifyAuthorSuccess"
      ],
      after: { 2000: "idle" }
    },

    // 刹车状态
    braking: {
      entry: ["executeBrakeAction", "notifyAuthor"],
      invoke: {
        src: "brakeHold",
        onDone: "brakeHold"
      }
    },

    brakeHold: {
      on: {
        RESUME_APPROVED: {
          target: "idle",
          guard: "isNotEmergency"
        },
        INVESTIGATION_COMPLETE: {
          target: "idle",
          guard: "emergencyResolved"
        },
        EMERGENCY_ROLLBACK: {
          target: "emergencyRollback"
        }
      }
    },

    // 紧急回滚
    emergencyRollback: {
      invoke: {
        src: "performEmergencyRollback",
        onDone: "idle",
        onError: "fatalError"
      }
    },

    // 致命错误
    fatalError: {
      entry: ["logFatalError", "notifySystemAdmin"],
      type: "final"
    }
  }
}, {
  guards: {
    evolutionEnabled: (ctx) => ctx.authorSettings?.evolutionEnabled ?? false,
    brakeConditionMet: (_, event: any) => event.data.brakeTrigger != null,
    isPassiveStrategy: (_, event: any) => event.data.strategyType === "passive",
    isActiveStrategy: (_, event: any) => event.data.strategyType === "active",
    isExploratoryStrategy: (_, event: any) => event.data.strategyType === "exploratory",
    canAutoApprove: (ctx, event: any) => {
      const plan = event.plan || ctx.pendingPlan;
      const trust = ctx.authorSettings?.trustLevel ?? 0;
      const risk = plan?.riskAssessment?.overallRisk;
      return trust > 80 && risk === "low";
    },
    verificationPassed: (_, event: any) => event.data.passed,
    verificationFailed: (_, event: any) => !event.data.passed,
    isNotEmergency: (ctx) => ctx.brakeTrigger?.severity !== "emergency",
    emergencyResolved: (_, event: any) => event.data.resolved === true
  }
});
```

### 12.3 刹车机制状态机

```typescript
// 刹车机制状态机
const brakeMechanismMachine = createMachine({
  id: "brakeMechanism",
  initial: "monitoring",
  context: {
    activeBrake: null as any | null,
    triggerCount: 0,
    lastBrakeTime: null as Date | null
  },
  states: {
    monitoring: {
      on: {
        CHECK_TRIGGERS: {
          actions: "evaluateTriggers"
        },
        WARNING_TRIGGERED: "warning",
        CRITICAL_TRIGGERED: "critical",
        EMERGENCY_TRIGGERED: "emergency"
      }
    },

    warning: {
      entry: ["sendWarningAlert", "logWarning"],
      invoke: {
        src: "warningHold",
        onDone: "monitoring"
      }
    },

    critical: {
      entry: [
        "pauseEvolution",
        "notifyAuthor",
        "updateDashboard",
        assign({ 
          activeBrake: (_, event: any) => event.trigger,
          triggerCount: (ctx) => ctx.triggerCount + 1,
          lastBrakeTime: () => new Date()
        })
      ],
      on: {
        RESUME_REQUESTED: [
          {
            target: "resumePending",
            guard: "authorHasPermission"
          }
        ],
        EMERGENCY_TRIGGERED: "emergency"
      }
    },

    resumePending: {
      invoke: {
        src: "validateResumeConditions",
        onDone: {
          target: "monitoring",
          entry: ["resumeEvolution", "clearActiveBrake"]
        },
        onError: {
          target: "critical",
          entry: "notifyResumeFailed"
        }
      }
    },

    emergency: {
      entry: [
        "performEmergencyRollback",
        "lockEvolution",
        "notifyAuthorAllChannels",
        "createIncidentReport",
        assign({ 
          activeBrake: (_, event: any) => event.trigger 
        })
      ],
      on: {
        INVESTIGATION_COMPLETE: [
          {
            target: "monitoring",
            guard: "investigationPassed",
            entry: ["unlockEvolution", "clearActiveBrake"]
          }
        ]
      }
    }
  }
}, {
  guards: {
    authorHasPermission: () => true  // 简化检查
  }
});
```

---

## 附录 A：术语表

| 术语 | 英文 | 定义 |
|------|------|------|
| 知识库 | Knowledge Base | 存储问题解决方案的数据库，支持语义检索 |
| 问题签名 | Issue Signature | 唯一标识问题类型的哈希指纹 |
| 代码记忆 | Code Memory | 记录代码变更历史及结果的数据库 |
| 进化树 | Evolution Tree | 记录系统版本演进历史的树形结构 |
| 能力成长指数 | CGI | Comprehensive Growth Index，综合成长评分 |
| 进化策略 | Evolution Strategy | 指导系统进化的三层策略模型 |
| 刹车机制 | Brake Mechanism | 防止进化偏离约束的安全机制 |
| 联邦学习 | Federated Learning | 跨实例协同学习，保护数据隐私 |
| 差分隐私 | Differential Privacy | 在数据共享中添加噪声保护隐私 |
| pgvector | pgvector | PostgreSQL 的向量扩展，支持语义检索 |

## 附录 B：演进路线图

| 阶段 | 版本 | 功能 |
|------|------|------|
| MVP | v3.0.0 | 基础问题记录、简单检索、手动知识入库 |
| 增强 | v3.1.0 | 自动签名生成、pgvector语义检索、模式提取 |
| 智能 | v3.2.0 | 自动修复推荐、能力追踪、进化策略引擎 |
| 自治 | v3.3.0 | 三层进化模型、刹车机制、作者信任系统 |
| 协同 | v3.4.0 | 联邦学习、跨实例知识共享、隐私保护 |

## 附录 C：设计原则检查清单

- [x] **叙事裁决权**：所有进化变更不涉及小说内容修改
- [x] **分层架构**：KEE 层通过事件与其他层通信
- [x] **无状态设计**：所有状态持久化到 PostgreSQL
- [x] **单向数据流**：进化策略输出通过事件分发
- [x] **作者控制**：完整的开关、审批、回退机制
- [x] **隐私保护**：差分隐私 + K-匿名 + 数据脱敏
- [x] **审计追踪**：所有变更可追溯、可回滚
- [x] **安全约束**：架构/安全/控制三重约束

---

*本文档为 NarrativeOS v3.0 Sovereign 第五层设计规格，所有接口和 Schema 均为设计蓝图，实际实现可能需要根据开发迭代调整。*

**文档版本**: v3.0.0-design  
**最后更新**: 2024  
**状态**: 设计完成
