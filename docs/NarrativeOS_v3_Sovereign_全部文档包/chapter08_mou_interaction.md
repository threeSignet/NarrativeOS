> [!NOTE] **本文档的"三模式 UI 实现"部分已作废 · MOU 状态机契约仍有效**
> 文中 `SWITCH_MODE: 'cockpit' | 'dashboard' | 'hibernation'` 等三模式 UI 模式枚举与新美学的"小说宇宙 → 项目门厅 → 三堂 + 提案台 + 心法台"信息架构不一致。
> MOU 状态机本身（10 状态、HumanEvent、状态守卫、确认机制）仍是真理源；但模式字面值绑定的 UI 命名需后续以"司天监位面"重新映射。
> 2026-05-19 起前端真理源：`docs/imperial-design-system.md`。

---

# NarrativeOS v3.0 Sovereign —— 第八章：MOU（最小指挥单元）与交互系统设计文档

> 版本：v3.0.0-RC1 | 状态：设计定稿 | 适用范围：100万字以上长篇网文创作

---

## 目录

1. [术语与概念定义](#1-术语与概念定义)
2. [系统架构概述](#2-系统架构概述)
3. [XState v5 状态机完整配置](#3-xstate-v5-状态机完整配置)
4. [Oracle 子流程状态机](#4-oracle-子流程状态机)
5. [状态详细行为规格](#5-状态详细行为规格)
6. [异常处理完整规格](#6-异常处理完整规格)
7. [三模式控制台交互设计](#7-三模式控制台交互设计)
8. [关键页面详细设计](#8-关键页面详细设计)
9. [WebSocket 消息协议](#9-websocket-消息协议)
10. [本地化存储策略](#10-本地化存储策略)
11. [附录](#11-附录)

---

## 1. 术语与概念定义

| 术语 | 英文 | 定义 |
|------|------|------|
| MOU | Minimal Operating Unit | 最小指挥单元，系统与作者交互的最小完整闭环 |
| Flow Guardian | Flow Guardian | 流程守护者，负责心流保护、超时召回、温和提醒的AI角色 |
| Remonstrator | Remonstrator | 谏官，负责内容风险审查和策略建议的AI角色 |
| Oracle | Oracle | 神谕系统，在创作僵局时提供突破性能量（混沌种子）的机制 |
| God Mode | God Mode | 作者完全接管模式，绕过所有AI建议直接下达指令 |
| Brief | Brief | 创作简报，包含方向确认、情节纲要、角色行为逻辑的预处理文档 |
| Possibility | Possibility | 可能性，AI为创作困境生成的多条可选路径 |
| Chaos Seed | Chaos Seed | 混沌种子，Oracle机制生成的非常规创作参数，用于打破僵局 |
| Ghost Anchor | Ghost Anchor | 幽灵锚点，上一轮创作参数的灰色残影显示，供作者参考对比 |
| Soul Guardian | Soul Guardian | 灵魂守护者，负责长期记忆、作者风格一致性、世界观完整性的AI角色 |
| Metarecursion | Metarecursion | 元级召回，当系统检测到自身死锁时的自反性诊断与恢复机制 |

---

## 2. 系统架构概述

### 2.1 核心设计哲学

**NarrativeOS v3.0 Sovereign** 围绕"作者主权"原则构建：

1. **作者始终拥有最终决策权** —— 所有AI产出必须经过作者显式确认（APPROVE/CHOOSE等）方可进入下一流程
2. **心流保护优先于效率** —— 系统绝不自动推进，等待状态的阻塞是设计意图而非技术缺陷
3. **渐进式授权而非自动化** —— AI提供可能性空间，作者决定行动方向
4. **异常即信息** —— 每一次异常都是系统与作者深度对话的契机

### 2.2 MOU 交互闭环模型

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MOU 交互闭环                                 │
│                                                                      │
│   ┌────────┐    AI生成     ┌──────────────┐    人类决策    ┌────────┐ │
│   │  idle  │ ──────────→ │ waiting_XXX  │ ──────────→ │  ???   │ │
│   └────────┘              └──────────────┘              └────────┘ │
│      ↑                                                    │          │
│      └────────────────────────────────────────────────────┘          │
│                         commit 后回归 idle                           │
└─────────────────────────────────────────────────────────────────────┘
```

每个MOU循环遵循严格的 **AI生成 → 人类等待 → 人类决策 → 状态转换** 四步节律。所有 `waiting_*` 状态均为**严格阻塞态**：系统不执行任何与当前决策相关的自动推进，仅维持心跳、超时监控和辅助信息更新。

### 2.3 状态机层级结构

```
mou_state_machine (父状态机)
├── idle
├── generating_possibilities
├── waiting_author_choice
│   └── [子入口: oracle_flow (条件触发)]
├── generating_brief
├── waiting_brief_approval
├── generating_content
├── waiting_final_review
│   └── [子入口: oracle_flow (条件触发)]
├── revising_content
│   └── [可循环至 generating_content]
├── remonstrator_intervention
├── waiting_author_verdict
├── committing
└── [终态: idle]

oracle_flow (子状态机)
├── oracle_cost_calculation
├── waiting_oracle_confirmation
├── chaos_seed_generation
├── rule_update_application
└── [出口: 返回父状态机 waiting_author_choice 或 waiting_final_review]
```

---

## 3. XState v5 状态机完整配置

### 3.1 上下文（Context）类型定义

```typescript
// ============================================================
// Context 类型定义 —— MouContext
// ============================================================

interface MouContext {
  // ── 核心创作上下文 ──
  chapterId: string;           // 当前章节ID
  sectionIndex: number;        // 当前段落索引
  novelId: string;             // 所属作品ID
  authorId: string;            // 作者ID

  // ── 状态追踪 ──
  currentPhase: 'outline' | 'draft' | 'revision' | 'final';
  loopCount: number;           // 当前MOU循环次数（每次idle→idle为1次）
  
  // ── 可能性管理 ──
  possibilities: Possibility[]; // 生成的可能性列表
  selectedPossibilityId: string | null;
  
  // ── Brief管理 ──
  brief: Brief | null;         // 当前Brief
  briefHistory: Brief[];       // Brief修订历史
  
  // ── 内容管理 ──
  generatedContent: string | null;    // 生成的正文
  contentHistory: ContentRevision[];  // 正文修订历史
  
  // ── 谏官系统 ──
  remonstratorReport: RemonstratorReport | null;
  
  // ── 异常计数器 ──
  retryCount: number;          // 连续RETRY次数（waiting_author_choice中）
  reviseCount: number;         // 连续REVISE次数（waiting_final_review中）
  llmFailureCount: number;     // 当前LLM调用连续失败次数
  
  // ── Oracle系统 ──
  oracleCooldown: boolean;     // Oracle冷却中
  oracleCost: OracleCost | null;       // 本次Oracle代价
  chaosSeedsActive: ChaosSeed[];       // 已激活的混沌种子
  
  // ── 心流与超时 ──
  lastAuthorActionAt: number;  // 作者最后操作时间戳（ms）
  flowState: 'engaged' | 'distracted' | 'away';  // 心流状态
  guardianMessage: string | null;  // Flow Guardian当前消息
  
  // ── 滑动条状态 ──
  sliderState: SliderState | null;     // 终审滑动条状态
  ghostAnchors: GhostAnchor[];         // 幽灵锚点数组
  
  // ── 元级诊断 ──
  deadlockDetected: boolean;
  metarecursionDepth: number;
  
  // ── 系统配置 ──
  config: MouConfig;
}

// ── 子类型定义 ──

interface Possibility {
  id: string;
  title: string;
  summary: string;
  preview: string;        // 200字预览
  confidence: number;     // 0-1
  tags: string[];
  divergence: number;     // 偏离当前轨道程度
  emotionalTone: string;
}

interface Brief {
  id: string;
  direction: string;      // 创作方向
  plotPoints: PlotPoint[];
  characterArcs: CharacterArc[];
  sceneNotes: string;
  pacing: 'slow' | 'medium' | 'fast';
  mood: string;
}

interface ContentRevision {
  id: string;
  content: string;
  revisionIndex: number;
  timestamp: number;
  revisionNotes: string;
  approved: boolean;
}

interface RemonstratorReport {
  severity: 'info' | 'caution' | 'warning' | 'critical';
  issues: RemonstratorIssue[];
  suggestedFixes: SuggestedFix[];
  overallAssessment: string;
}

interface RemonstratorIssue {
  id: string;
  category: 'consistency' | 'character' | 'pacing' | 'tone' | 'logic' | 'lore';
  description: string;
  evidence: string;
  severity: 'low' | 'medium' | 'high';
}

interface SuggestedFix {
  issueId: string;
  strategy: string;
  implementation: string;
  tradeOffs: string[];
}

interface OracleCost {
  coherenceBudget: number;    // 消耗的世界观一致性预算
  emotionalTax: number;       // 情感税（对叙事情感基调的影响）
  narrativeDebt: string[];    // 产生的叙事债务（需要后续填补的坑）
  cooldownDuration: number;   // 冷却时长（ms）
}

interface ChaosSeed {
  id: string;
  parameter: string;          // 被扰动的参数名
  originalValue: unknown;
  perturbedValue: unknown;
  intensity: number;          // 扰动强度 0-1
  description: string;
  expiresAt: number;          // 过期时间戳
}

interface SliderState {
  position: number;           // 0-100
  label: string;
  markers: SliderMarker[];
  confirmed: boolean;
}

interface SliderMarker {
  position: number;
  label: string;
  color: string;
}

interface GhostAnchor {
  id: string;
  parameter: string;
  previousValue: number;
  displayValue: string;
  opacity: number;            // 默认0.3
}

interface MouConfig {
  maxRetries: number;         // 默认3
  maxRevises: number;         // 默认5
  maxLLMFailures: number;     // 默认3
  authorTimeoutMs: number;    // 默认300000 (5分钟)
  oracleCooldownMs: number;   // 默认1800000 (30分钟)
  deadlockCheckIntervalMs: number;  // 默认10000 (10秒)
  flowGuardianEnabled: boolean;
  remonstratorEnabled: boolean;
  metarecursionEnabled: boolean;
}
```

### 3.2 事件类型定义

```typescript
// ============================================================
// 事件类型定义 —— MouEvent
// ============================================================

type MouEvent =
  // ── 作者决策事件（核心人机交互事件） ──
  | { type: 'CHOOSE'; possibilityId: string }      // 选择某个可能性
  | { type: 'GOD_MODE'; command: string }          // 神降模式：作者直接下达指令
  | { type: 'RETRY' }                              // 重新生成可能性
  | { type: 'APPROVE' }                            // 批准（Brief/正文均可）
  | { type: 'MODIFY'; modifications: Modification[] }  // 修改请求
  | { type: 'REJECT'; reason: string }             // 拒绝并重来
  | { type: 'REVISE'; revisionNotes: string }      // 修订正文
  | { type: 'TRIGGER_REMONSTRATOR' }               // 手动触发谏官审查
  | { type: 'IGNORE_REMONSTRATOR' }                // 忽略谏官建议
  | { type: 'COMMIT_CONFIRM' }                     // 确认提交

  // ── Oracle相关事件 ──
  | { type: 'REQUEST_ORACLE' }                     // 请求下神谕
  | { type: 'CONFIRM_ORACLE' }                     // 确认承受代价
  | { type: 'CANCEL_ORACLE' }                      // 取消神谕
  | { type: 'APPLY_CHAOS_SEED'; seedId: string }   // 应用混沌种子
  | { type: 'DISCARD_CHAOS_SEED'; seedId: string } // 丢弃混沌种子

  // ── 滑动条交互事件 ──
  | { type: 'SLIDER_DRAG'; position: number }      // 拖动滑动条
  | { type: 'SLIDER_CONFIRM' }                     // 确认滑动条位置
  | { type: 'SLIDER_RESET' }                       // 重置滑动条

  // ── 系统内部事件 ──
  | { type: 'POSSIBILITIES_GENERATED'; data: Possibility[] }
  | { type: 'BRIEF_GENERATED'; data: Brief }
  | { type: 'CONTENT_GENERATED'; data: string }
  | { type: 'CONTENT_REVISED'; data: string }
  | { type: 'REMONSTRATOR_COMPLETE'; data: RemonstratorReport }
  | { type: 'LLM_CALL_SUCCESS'; result: unknown }
  | { type: 'LLM_CALL_FAILURE'; error: Error; recoverable: boolean }
  | { type: 'LLM_CALL_DEGRADED'; result: unknown; model: string }

  // ── 异常与超时事件 ──
  | { type: 'AUTHOR_TIMEOUT' }                     // 作者超时
  | { type: 'RECOVERED_FROM_DEADLOCK' }            // 死锁恢复
  | { type: 'METARECURSION_TRIGGERED' }            // 元级召回触发

  // ── 控制台模式事件 ──
  | { type: 'SWITCH_MODE'; mode: 'cockpit' | 'dashboard' | 'hibernation' }
  | { type: 'WAKE_UP' }                            // 从休眠舱唤醒

  // ── 生命周期事件 ──
  | { type: 'INITIALIZE'; ctx: Partial<MouContext> }
  | { type: 'RESET' };

interface Modification {
  field: string;
  original: string;
  proposed: string;
  reason: string;
}
```

### 3.3 完整状态机配置（XState v5 JSON格式）

```json
{
  "$schema": "https://stately.ai/schema.json",
  "id": "mou_state_machine",
  "initial": "idle",
  "context": {
    "chapterId": "",
    "sectionIndex": 0,
    "novelId": "",
    "authorId": "",
    "currentPhase": "outline",
    "loopCount": 0,
    "possibilities": [],
    "selectedPossibilityId": null,
    "brief": null,
    "briefHistory": [],
    "generatedContent": null,
    "contentHistory": [],
    "remonstratorReport": null,
    "retryCount": 0,
    "reviseCount": 0,
    "llmFailureCount": 0,
    "oracleCooldown": false,
    "oracleCost": null,
    "chaosSeedsActive": [],
    "lastAuthorActionAt": 0,
    "flowState": "engaged",
    "guardianMessage": null,
    "sliderState": null,
    "ghostAnchors": [],
    "deadlockDetected": false,
    "metarecursionDepth": 0,
    "config": {
      "maxRetries": 3,
      "maxRevises": 5,
      "maxLLMFailures": 3,
      "authorTimeoutMs": 300000,
      "oracleCooldownMs": 1800000,
      "deadlockCheckIntervalMs": 10000,
      "flowGuardianEnabled": true,
      "remonstratorEnabled": true,
      "metarecursionEnabled": true
    }
  },
  "states": {
    "idle": {
      "id": "idle",
      "type": "atomic",
      "description": "等待作者发起新一轮创作指令",
      "entry": [
        { "type": "incrementLoopCount" },
        { "type": "resetRetryCount" },
        { "type": "resetReviseCount" },
        { "type": "resetLLMFailureCount" },
        { "type": "clearRemonstratorReport" },
        { "type": "updateFlowState", "params": { "state": "engaged" } },
        { "type": "emitStatusToClient", "params": { "status": "IDLE_READY" } }
      ],
      "on": {
        "INITIALIZE": {
          "actions": { "type": "mergeContext" }
        },
        "GOD_MODE": {
          "target": "generating_content",
          "actions": [
            { "type": "storeGodModeCommand" },
            { "type": "logTransition", "params": { "from": "idle", "via": "GOD_MODE" } }
          ],
          "guard": "isValidGodModeCommand"
        },
        "SWITCH_MODE": {
          "actions": { "type": "switchConsoleMode" }
        },
        "RESET": {
          "target": "idle",
          "actions": { "type": "resetContext" }
        }
      },
      "invoke": {
        "src": "idleHeartbeatService",
        "input": ({ context }) => ({
          chapterId: context.chapterId,
          heartbeatIntervalMs: 30000
        })
      }
    },

    "generating_possibilities": {
      "id": "generating_possibilities",
      "type": "atomic",
      "description": "AI正在为当前创作困境生成多条可能性路径",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "GENERATING_POSSIBILITIES" } },
        { "type": "showGeneratingIndicator" },
        { "type": "updateFlowState", "params": { "state": "engaged" } }
      ],
      "exit": [
        { "type": "hideGeneratingIndicator" }
      ],
      "invoke": {
        "src": "generatePossibilitiesService",
        "input": ({ context }) => ({
          chapterId: context.chapterId,
          sectionIndex: context.sectionIndex,
          currentPhase: context.currentPhase,
          previousBrief: context.brief,
          activeChaosSeeds: context.chaosSeedsActive,
          maxAttempts: 3
        }),
        "onDone": {
          "target": "waiting_author_choice",
          "actions": [
            { "type": "storePossibilities", "params": ({ event }) => ({ possibilities: event.output }) },
            { "type": "resetLLMFailureCount" }
          ]
        },
        "onError": {
          "target": "llm_failure_handler",
          "actions": [
            { "type": "incrementLLMFailureCount" },
            { "type": "logError", "params": ({ event }) => ({ error: event.error }) }
          ]
        }
      }
    },

    "waiting_author_choice": {
      "id": "waiting_author_choice",
      "type": "atomic",
      "description": "严格阻塞态：等待作者从可能性中做出选择或决定其他行动",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "WAITING_AUTHOR_CHOICE" } },
        { "type": "renderPossibilityCards" },
        { "type": "updateLastAuthorAction" },
        { "type": "updateFlowState", "params": { "state": "engaged" } },
        { "type": "startAuthorTimeout", "params": ({ context }) => ({ timeoutMs: context.config.authorTimeoutMs }) }
      ],
      "exit": [
        { "type": "clearPossibilityCards" },
        { "type": "stopAuthorTimeout" }
      ],
      "on": {
        "CHOOSE": {
          "target": "generating_brief",
          "actions": [
            { "type": "storeSelectedPossibility", "params": ({ event }) => ({ possibilityId: event.possibilityId }) },
            { "type": "resetRetryCount" },
            { "type": "logTransition", "params": { "from": "waiting_author_choice", "via": "CHOOSE" } }
          ],
          "guard": "isValidPossibilityId"
        },
        "GOD_MODE": {
          "target": "generating_content",
          "actions": [
            { "type": "storeGodModeCommand", "params": ({ event }) => ({ command: event.command }) },
            { "type": "resetRetryCount" }
          ],
          "guard": "isValidGodModeCommand"
        },
        "RETRY": {
          "target": "generating_possibilities",
          "actions": [
            { "type": "incrementRetryCount" },
            { "type": "logTransition", "params": { "from": "waiting_author_choice", "via": "RETRY" } }
          ],
          "guard": "canRetry"
        },
        "REQUEST_ORACLE": {
          "target": "oracle_flow",
          "actions": [
            { "type": "setOracleEntryPoint", "params": { "returnTo": "waiting_author_choice" } }
          ],
          "guard": "isOracleAvailable"
        },
        "SWITCH_MODE": {
          "actions": { "type": "switchConsoleMode" }
        },
        "AUTHOR_TIMEOUT": {
          "actions": [
            { "type": "generateGuardianRecallMessage" },
            { "type": "emitStatusToClient", "params": { "status": "AUTHOR_TIMEOUT_RECALL" } }
          ]
        }
      }
    },

    "generating_brief": {
      "id": "generating_brief",
      "type": "atomic",
      "description": "基于选定可能性生成创作简报",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "GENERATING_BRIEF" } },
        { "type": "showGeneratingIndicator", "params": { "message": "正在编织创作简报..." } }
      ],
      "exit": [
        { "type": "hideGeneratingIndicator" }
      ],
      "invoke": {
        "src": "generateBriefService",
        "input": ({ context }) => ({
          chapterId: context.chapterId,
          sectionIndex: context.sectionIndex,
          selectedPossibility: context.possibilities.find(p => p.id === context.selectedPossibilityId),
          briefHistory: context.briefHistory,
          activeChaosSeeds: context.chaosSeedsActive
        }),
        "onDone": {
          "target": "waiting_brief_approval",
          "actions": [
            { "type": "storeBrief", "params": ({ event }) => ({ brief: event.output }) },
            { "type": "resetLLMFailureCount" }
          ]
        },
        "onError": {
          "target": "llm_failure_handler",
          "actions": { "type": "incrementLLMFailureCount" }
        }
      }
    },

    "waiting_brief_approval": {
      "id": "waiting_brief_approval",
      "type": "atomic",
      "description": "严格阻塞态：等待作者对Brief的审批决策",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "WAITING_BRIEF_APPROVAL" } },
        { "type": "renderBriefEditor" },
        { "type": "updateLastAuthorAction" },
        { "type": "startAuthorTimeout", "params": ({ context }) => ({ timeoutMs: context.config.authorTimeoutMs }) }
      ],
      "exit": [
        { "type": "clearBriefEditor" },
        { "type": "stopAuthorTimeout" }
      ],
      "on": {
        "APPROVE": {
          "target": "generating_content",
          "actions": [
            { "type": "archiveBriefToHistory" },
            { "type": "logTransition", "params": { "from": "waiting_brief_approval", "via": "APPROVE" } }
        },
        "MODIFY": {
          "target": "generating_brief",
          "actions": [
            { "type": "storeBriefModifications", "params": ({ event }) => ({ modifications: event.modifications }) },
            { "type": "logTransition", "params": { "from": "waiting_brief_approval", "via": "MODIFY" } }
          ],
          "guard": "hasValidModifications"
        },
        "REJECT": {
          "target": "generating_possibilities",
          "actions": [
            { "type": "logRejectionReason", "params": ({ event }) => ({ reason: event.reason }) },
            { "type": "clearSelectedPossibility" },
            { "type": "logTransition", "params": { "from": "waiting_brief_approval", "via": "REJECT" } }
          ]
        },
        "GOD_MODE": {
          "target": "generating_content",
          "actions": [
            { "type": "storeGodModeCommand", "params": ({ event }) => ({ command: event.command }) }
          ]
        },
        "SWITCH_MODE": {
          "actions": { "type": "switchConsoleMode" }
        },
        "AUTHOR_TIMEOUT": {
          "actions": [
            { "type": "generateGuardianRecallMessage" }
          ]
        }
      }
    },

    "generating_content": {
      "id": "generating_content",
      "type": "atomic",
      "description": "基于Brief和上下文生成正文内容",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "GENERATING_CONTENT" } },
        { "type": "showGeneratingIndicator", "params": { "message": "正在撰写正文..." } }
      ],
      "exit": [
        { "type": "hideGeneratingIndicator" }
      ],
      "invoke": {
        "src": "generateContentService",
        "input": ({ context }) => ({
          chapterId: context.chapterId,
          sectionIndex: context.sectionIndex,
          brief: context.brief,
          godModeCommand: (context as any)._godModeCommand || null,
          contentHistory: context.contentHistory,
          activeChaosSeeds: context.chaosSeedsActive,
          remonstratorNotes: context.remonstratorReport?.issues || []
        }),
        "onDone": {
          "target": "waiting_final_review",
          "actions": [
            { "type": "storeGeneratedContent", "params": ({ event }) => ({ content: event.output }) },
            { "type": "resetLLMFailureCount" }
          ]
        },
        "onError": {
          "target": "llm_failure_handler",
          "actions": { "type": "incrementLLMFailureCount" }
        }
      }
    },

    "waiting_final_review": {
      "id": "waiting_final_review",
      "type": "atomic",
      "description": "严格阻塞态：仪式化终审环境，等待作者对生成内容的最终裁决",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "WAITING_FINAL_REVIEW" } },
        { "type": "enterRitualReadingMode" },
        { "type": "initializeSlider", "params": { "defaultPosition": 50 } },
        { "type": "loadGhostAnchors" },
        { "type": "updateLastAuthorAction" },
        { "type": "startAuthorTimeout", "params": ({ context }) => ({ timeoutMs: context.config.authorTimeoutMs }) }
      ],
      "exit": [
        { "type": "exitRitualReadingMode" },
        { "type": "saveSliderState" },
        { "type": "stopAuthorTimeout" }
      ],
      "on": {
        "APPROVE": {
          "target": "remonstrator_gate",
          "actions": [
            { "type": "saveSliderState" },
            { "type": "resetReviseCount" },
            { "type": "logTransition", "params": { "from": "waiting_final_review", "via": "APPROVE" } }
          ],
          "guard": "isSliderConfirmed"
        },
        "REVISE": {
          "target": "revising_content",
          "actions": [
            { "type": "storeRevisionNotes", "params": ({ event }) => ({ notes: event.revisionNotes }) },
            { "type": "incrementReviseCount" },
            { "type": "logTransition", "params": { "from": "waiting_final_review", "via": "REVISE" } }
          ],
          "guard": "canRevise"
        },
        "TRIGGER_REMONSTRATOR": {
          "target": "remonstrator_intervention",
          "actions": [
            { "type": "logTransition", "params": { "from": "waiting_final_review", "via": "TRIGGER_REMONSTRATOR" } }
          ]
        },
        "SLIDER_DRAG": {
          "actions": [
            { "type": "updateSliderPosition", "params": ({ event }) => ({ position: event.position }) }
          ]
        },
        "SLIDER_CONFIRM": {
          "actions": [
            { "type": "confirmSliderPosition" }
          ]
        },
        "SLIDER_RESET": {
          "actions": [
            { "type": "resetSlider" }
          ]
        },
        "REQUEST_ORACLE": {
          "target": "oracle_flow",
          "actions": [
            { "type": "setOracleEntryPoint", "params": { "returnTo": "waiting_final_review" } }
          ],
          "guard": "isOracleAvailable"
        },
        "SWITCH_MODE": {
          "actions": { "type": "switchConsoleMode" }
        },
        "AUTHOR_TIMEOUT": {
          "actions": [
            { "type": "generateGuardianRecallMessage" }
          ]
        }
      }
    },

    "remonstrator_gate": {
      "id": "remonstrator_gate",
      "type": "atomic",
      "description": "谏官门控：检查谏官是否启用，决定是否需要谏官审查",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "REMONSTRATOR_GATE" } }
      ],
      "always": [
        {
          "target": "committing",
          "guard": "isRemonstratorDisabled"
        },
        {
          "target": "remonstrator_intervention"
        }
      ]
    },

    "revising_content": {
      "id": "revising_content",
      "type": "atomic",
      "description": "根据作者修订意见重新调整内容",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "REVISING_CONTENT" } },
        { "type": "showGeneratingIndicator", "params": { "message": "正在根据修订意见调整..." } }
      ],
      "exit": [
        { "type": "hideGeneratingIndicator" }
      ],
      "invoke": {
        "src": "reviseContentService",
        "input": ({ context }) => ({
          chapterId: context.chapterId,
          sectionIndex: context.sectionIndex,
          currentContent: context.generatedContent,
          revisionNotes: (context as any)._revisionNotes || '',
          contentHistory: context.contentHistory,
          reviseCount: context.reviseCount
        }),
        "onDone": {
          "target": "waiting_final_review",
          "actions": [
            { "type": "storeRevisedContent", "params": ({ event }) => ({ content: event.output }) },
            { "type": "resetLLMFailureCount" }
          ]
        },
        "onError": {
          "target": "llm_failure_handler",
          "actions": { "type": "incrementLLMFailureCount" }
        }
      }
    },

    "remonstrator_intervention": {
      "id": "remonstrator_intervention",
      "type": "atomic",
      "description": "谏官审查：对内容进行全面的风险与质量审查",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "REMONSTRATOR_INTERVENTION" } },
        { "type": "showGeneratingIndicator", "params": { "message": "谏官正在审阅..." } }
      ],
      "exit": [
        { "type": "hideGeneratingIndicator" }
      ],
      "invoke": {
        "src": "remonstratorReviewService",
        "input": ({ context }) => ({
          chapterId: context.chapterId,
          sectionIndex: context.sectionIndex,
          content: context.generatedContent,
          brief: context.brief,
          novelId: context.novelId
        }),
        "onDone": {
          "target": "waiting_author_verdict",
          "actions": [
            { "type": "storeRemonstratorReport", "params": ({ event }) => ({ report: event.output }) }
          ]
        },
        "onError": {
          "target": "llm_failure_handler",
          "actions": { "type": "incrementLLMFailureCount" }
        }
      }
    },

    "waiting_author_verdict": {
      "id": "waiting_author_verdict",
      "type": "atomic",
      "description": "严格阻塞态：等待作者对谏官报告的裁决",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "WAITING_AUTHOR_VERDICT" } },
        { "type": "renderRemonstratorReport" },
        { "type": "updateLastAuthorAction" },
        { "type": "startAuthorTimeout", "params": ({ context }) => ({ timeoutMs: context.config.authorTimeoutMs }) }
      ],
      "exit": [
        { "type": "clearRemonstratorReport" },
        { "type": "stopAuthorTimeout" }
      ],
      "on": {
        "APPROVE": {
          "target": "committing",
          "actions": [
            { "type": "logTransition", "params": { "from": "waiting_author_verdict", "via": "APPROVE" } }
          ]
        },
        "MODIFY": {
          "target": "revising_content",
          "actions": [
            { "type": "storeRevisionNotes", "params": ({ event }) => ({ notes: event.modifications.map((m: Modification) => m.reason).join('; ') }) },
            { "type": "incrementReviseCount" }
          ]
        },
        "IGNORE_REMONSTRATOR": {
          "target": "committing",
          "actions": [
            { "type": "logIgnoredRemonstrator" },
            { "type": "logTransition", "params": { "from": "waiting_author_verdict", "via": "IGNORE_REMONSTRATOR" } }
          ]
        },
        "GOD_MODE": {
          "target": "generating_content",
          "actions": [
            { "type": "storeGodModeCommand", "params": ({ event }) => ({ command: event.command }) }
          ]
        },
        "SWITCH_MODE": {
          "actions": { "type": "switchConsoleMode" }
        },
        "AUTHOR_TIMEOUT": {
          "actions": [
            { "type": "generateGuardianRecallMessage" }
          ]
        }
      }
    },

    "committing": {
      "id": "committing",
      "type": "atomic",
      "description": "将最终内容持久化到存储系统",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "COMMITTING" } },
        { "type": "showGeneratingIndicator", "params": { "message": "正在保存..." } }
      ],
      "exit": [
        { "type": "hideGeneratingIndicator" },
        { "type": "clearGodModeCommand" }
      ],
      "invoke": {
        "src": "commitContentService",
        "input": ({ context }) => ({
          chapterId: context.chapterId,
          sectionIndex: context.sectionIndex,
          content: context.generatedContent,
          brief: context.brief,
          novelId: context.novelId,
          remonstratorReport: context.remonstratorReport,
          loopCount: context.loopCount
        }),
        "onDone": {
          "target": "idle",
          "actions": [
            { "type": "clearGeneratedContent" },
            { "type": "clearBrief" },
            { "type": "clearPossibilities" },
            { "type": "clearRemonstratorReport" },
            { "type": "incrementSectionIndex" },
            { "type": "logCommitSuccess" }
          ]
        },
        "onError": {
          "target": "commit_failure_handler",
          "actions": { "type": "logCommitFailure" }
        }
      }
    },

    "llm_failure_handler": {
      "id": "llm_failure_handler",
      "type": "atomic",
      "description": "LLM调用失败的统一处理节点",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "LLM_FAILURE_HANDLER" } }
      ],
      "always": [
        {
          "target": "metarecursion_intervention",
          "guard": "hasExceededMaxLLMFailures",
          "actions": { "type": "logMetarecursionTrigger", "params": { "reason": "llm_max_failures" } }
        },
        {
          "target": "generating_possibilities",
          "guard": "cameFromGeneratingPossibilities",
          "actions": { "type": "applyDegradedModel" }
        },
        {
          "target": "generating_brief",
          "guard": "cameFromGeneratingBrief",
          "actions": { "type": "applyDegradedModel" }
        },
        {
          "target": "generating_content",
          "guard": "cameFromGeneratingContent",
          "actions": { "type": "applyDegradedModel" }
        },
        {
          "target": "revising_content",
          "guard": "cameFromRevisingContent",
          "actions": { "type": "applyDegradedModel" }
        }
      ]
    },

    "commit_failure_handler": {
      "id": "commit_failure_handler",
      "type": "atomic",
      "description": "内容提交失败的恢复处理",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "COMMIT_FAILURE" } }
      ],
      "invoke": {
        "src": "retryCommitService",
        "input": ({ context }) => ({
          chapterId: context.chapterId,
          sectionIndex: context.sectionIndex,
          content: context.generatedContent,
          maxRetries: 3
        }),
        "onDone": {
          "target": "idle",
          "actions": [
            { "type": "clearGeneratedContent" },
            { "type": "clearBrief" },
            { "type": "incrementSectionIndex" }
          ]
        },
        "onError": {
          "target": "metarecursion_intervention",
          "actions": { "type": "logMetarecursionTrigger", "params": { "reason": "commit_fatal" } }
        }
      }
    },

    "metarecursion_intervention": {
      "id": "metarecursion_intervention",
      "type": "atomic",
      "description": "元级召回：系统级死锁的自反性诊断与恢复",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "METARECURSION" } },
        { "type": "setDeadlockDetected", "params": { "value": true } },
        { "type": "incrementMetarecursionDepth" },
        { "type": "generateMetarecursionReport" }
      ],
      "invoke": {
        "src": "metarecursionRecoveryService",
        "input": ({ context }) => ({
          context: context,
          depth: context.metarecursionDepth,
          maxDepth: 3
        }),
        "onDone": {
          "target": "idle",
          "actions": [
            { "type": "clearDeadlockDetected" },
            { "type": "resetLLMFailureCount" },
            { "type": "resetRetryCount" },
            { "type": "resetReviseCount" }
          ]
        },
        "onError": {
          "actions": [
            { "type": "emitFatalError", "params": { "message": "元级召回失败，请手动重启MOU循环" } }
          ]
        }
      }
    }
  }
}
```

### 3.4 Guard 条件函数定义

```typescript
// ============================================================
// Guard 条件函数完整定义
// ============================================================

/**
 * 检查可能性ID是否有效
 */
const isValidPossibilityId = ({ context, event }: GuardArgs<MouContext, MouEvent>) => {
  if (event.type !== 'CHOOSE') return false;
  return context.possibilities.some(p => p.id === event.possibilityId);
};

/**
 * 检查God Mode指令是否有效（非空且长度合理）
 */
const isValidGodModeCommand = ({ event }: GuardArgs<MouContext, MouEvent>) => {
  if (event.type !== 'GOD_MODE') return false;
  return event.command && event.command.trim().length > 0 && event.command.length <= 5000;
};

/**
 * 检查是否允许重试（未超过最大重试次数）
 */
const canRetry = ({ context }: GuardArgs<MouContext, MouEvent>) => {
  return context.retryCount < context.config.maxRetries;
};

/**
 * 检查是否允许修订（未超过最大修订次数）
 */
const canRevise = ({ context }: GuardArgs<MouContext, MouEvent>) => {
  return context.reviseCount < context.config.maxRevises;
};

/**
 * 检查Oracle是否可用（不在冷却期）
 */
const isOracleAvailable = ({ context }: GuardArgs<MouContext, MouEvent>) => {
  return !context.oracleCooldown && context.config.metarecursionEnabled;
};

/**
 * 检查滑动条是否已确认
 */
const isSliderConfirmed = ({ context }: GuardArgs<MouContext, MouEvent>) => {
  return context.sliderState?.confirmed === true;
};

/**
 * 检查修改请求是否有效
 */
const hasValidModifications = ({ event }: GuardArgs<MouContext, MouEvent>) => {
  if (event.type !== 'MODIFY') return false;
  return event.modifications && event.modifications.length > 0 &&
    event.modifications.every(m => m.field && m.proposed);
};

/**
 * 检查谏官是否被禁用
 */
const isRemonstratorDisabled = ({ context }: GuardArgs<MouContext, MouEvent>) => {
  return !context.config.remonstratorEnabled;
};

/**
 * 检查是否超过最大LLM失败次数
 */
const hasExceededMaxLLMFailures = ({ context }: GuardArgs<MouContext, MouEvent>) => {
  return context.llmFailureCount >= context.config.maxLLMFailures;
};

/**
 * 追踪状态来源的辅助guard（需要结合历史状态）
 */
const cameFromGeneratingPossibilities = ({ context, event }: GuardArgs<MouContext, MouEvent>) => {
  return (context as any)._previousState === 'generating_possibilities';
};

const cameFromGeneratingBrief = ({ context }: GuardArgs<MouContext, MouEvent>) => {
  return (context as any)._previousState === 'generating_brief';
};

const cameFromGeneratingContent = ({ context }: GuardArgs<MouContext, MouEvent>) => {
  return (context as any)._previousState === 'generating_content';
};

const cameFromRevisingContent = ({ context }: GuardArgs<MouContext, MouEvent>) => {
  return (context as any)._previousState === 'revising_content';
};
```

### 3.5 Invoke 异步服务定义

```typescript
// ============================================================
// Invoke 异步服务完整实现
// ============================================================

/**
 * idleHeartbeatService —— idle状态心跳服务
 * 定期向客户端推送系统状态，维持连接活性
 */
const idleHeartbeatService = fromCallback(
  ({ sendBack, input }: { sendBack: any; input: { chapterId: string; heartbeatIntervalMs: number } }) => {
    const interval = setInterval(() => {
      sendBack({ type: 'HEARTBEAT', timestamp: Date.now() });
    }, input.heartbeatIntervalMs);
    return () => clearInterval(interval);
  }
);

/**
 * generatePossibilitiesService —— 生成可能性服务
 * 调用LLM为当前创作困境生成多条可选路径
 */
const generatePossibilitiesService = fromPromise(
  async ({ input }: { input: GeneratePossibilitiesInput }) => {
    const { chapterId, sectionIndex, currentPhase, previousBrief, activeChaosSeeds, maxAttempts } = input;
    
    // 指数退避重试策略
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await callLLM('generatePossibilities', {
          chapterId,
          sectionIndex,
          currentPhase,
          previousBrief,
          activeChaosSeeds,
          temperature: 0.8 + (attempt * 0.1) // 逐次增加创造性
        });
        
        // 验证返回结果
        const possibilities = validatePossibilities(result);
        if (possibilities.length >= 3) {
          return possibilities;
        }
        throw new Error(`仅生成 ${possibilities.length} 条可能性，需要至少3条`);
      } catch (error) {
        if (attempt === maxAttempts - 1) throw error;
        await delay(Math.pow(2, attempt) * 1000); // 指数退避
      }
    }
    throw new Error('生成可能性失败：已达最大重试次数');
  }
);

/**
 * generateBriefService —— 生成Brief服务
 */
const generateBriefService = fromPromise(
  async ({ input }: { input: GenerateBriefInput }) => {
    const { chapterId, sectionIndex, selectedPossibility, briefHistory, activeChaosSeeds } = input;
    
    try {
      const result = await callLLM('generateBrief', {
        chapterId,
        sectionIndex,
        selectedPossibility,
        briefHistory: briefHistory.slice(-5), // 最近5条历史
        activeChaosSeeds
      });
      return validateBrief(result);
    } catch (error) {
      // 降级到简化模型
      console.warn('Brief生成主模型失败，尝试降级模型');
      const degradedResult = await callLLM('generateBrief', {
        chapterId,
        sectionIndex,
        selectedPossibility,
        model: 'degraded',
        briefHistory: briefHistory.slice(-3)
      });
      return validateBrief(degradedResult);
    }
  }
);

/**
 * generateContentService —— 生成正文服务
 */
const generateContentService = fromPromise(
  async ({ input }: { input: GenerateContentInput }) => {
    const { chapterId, sectionIndex, brief, godModeCommand, contentHistory, activeChaosSeeds } = input;
    
    // God Mode优先级最高：直接执行作者指令
    if (godModeCommand) {
      const result = await callLLM('generateContent', {
        chapterId,
        sectionIndex,
        godModeCommand,
        activeChaosSeeds,
        mode: 'god_mode'
      });
      return validateContent(result);
    }
    
    // 正常Brief驱动生成
    const result = await callLLM('generateContent', {
      chapterId,
      sectionIndex,
      brief,
      contentHistory: contentHistory.slice(-3),
      activeChaosSeeds,
      mode: 'brief_driven'
    });
    return validateContent(result);
  }
);

/**
 * reviseContentService —— 修订内容服务
 */
const reviseContentService = fromPromise(
  async ({ input }: { input: ReviseContentInput }) => {
    const { chapterId, sectionIndex, currentContent, revisionNotes, contentHistory, reviseCount } = input;
    
    const result = await callLLM('reviseContent', {
      chapterId,
      sectionIndex,
      currentContent,
      revisionNotes,
      contentHistory: contentHistory.slice(-3),
      reviseCount, // 传入修订次数用于调整策略
      urgency: reviseCount >= 3 ? 'high' : 'normal' // 多次修订后提高紧迫感
    });
    return validateContent(result);
  }
);

/**
 * remonstratorReviewService —— 谏官审查服务
 */
const remonstratorReviewService = fromPromise(
  async ({ input }: { input: RemonstratorInput }) => {
    const { chapterId, sectionIndex, content, brief, novelId } = input;
    
    // 并行执行多个审查维度
    const [consistencyCheck, characterCheck, pacingCheck, loreCheck] = await Promise.all([
      callLLM('checkConsistency', { chapterId, sectionIndex, content, brief, novelId }),
      callLLM('checkCharacterConsistency', { chapterId, sectionIndex, content, novelId }),
      callLLM('checkPacing', { chapterId, sectionIndex, content, brief }),
      callLLM('checkLore', { chapterId, sectionIndex, content, novelId })
    ]);
    
    return compileRemonstratorReport({
      consistencyCheck,
      characterCheck,
      pacingCheck,
      loreCheck
    });
  }
);

/**
 * commitContentService —— 内容提交服务
 */
const commitContentService = fromPromise(
  async ({ input }: { input: CommitInput }) => {
    const { chapterId, sectionIndex, content, brief, novelId, remonstratorReport, loopCount } = input;
    
    const commitRecord = {
      chapterId,
      sectionIndex,
      content,
      briefId: brief?.id,
      novelId,
      remonstratorSeverity: remonstratorReport?.severity || 'none',
      loopCount,
      committedAt: Date.now()
    };
    
    await persistToStorage('chapter_content', commitRecord);
    await updateNovelProgress(novelId, chapterId, sectionIndex);
    
    return { success: true, commitId: generateId() };
  }
);

/**
 * retryCommitService —— 提交重试服务
 */
const retryCommitService = fromPromise(
  async ({ input }: { input: RetryCommitInput }) => {
    const { chapterId, sectionIndex, content, maxRetries } = input;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        await persistToStorage('chapter_content', { chapterId, sectionIndex, content });
        return { success: true };
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await delay(Math.pow(2, i) * 500);
      }
    }
  }
);

/**
 * metarecursionRecoveryService —— 元级召回恢复服务
 */
const metarecursionRecoveryService = fromPromise(
  async ({ input }: { input: MetarecursionInput }) => {
    const { context, depth, maxDepth } = input;
    
    if (depth >= maxDepth) {
      throw new Error(`元级递归深度 ${depth} 超过最大限制 ${maxDepth}`);
    }
    
    // 生成诊断报告
    const diagnosis = await callLLM('metarecursionDiagnosis', {
      context: serializeContext(context),
      depth
    });
    
    // 执行恢复策略
    const recoveryPlan = generateRecoveryPlan(diagnosis);
    
    // 重置所有异常计数器
    return {
      diagnosis,
      recoveryPlan,
      resetCounters: true,
      appliedAt: Date.now()
    };
  }
);
```

### 3.6 Actions 完整定义

```typescript
// ============================================================
// Actions 完整定义
// ============================================================

const mouActions = {
  // ── 计数器管理 ──
  incrementLoopCount: assign(({ context }) => ({
    loopCount: context.loopCount + 1
  })),
  
  incrementRetryCount: assign(({ context }) => ({
    retryCount: context.retryCount + 1
  })),
  
  resetRetryCount: assign({ retryCount: 0 }),
  
  incrementReviseCount: assign(({ context }) => ({
    reviseCount: context.reviseCount + 1
  })),
  
  resetReviseCount: assign({ reviseCount: 0 }),
  
  incrementLLMFailureCount: assign(({ context }) => ({
    llmFailureCount: context.llmFailureCount + 1
  })),
  
  resetLLMFailureCount: assign({ llmFailureCount: 0 }),
  
  incrementMetarecursionDepth: assign(({ context }) => ({
    metarecursionDepth: context.metarecursionDepth + 1
  })),
  
  incrementSectionIndex: assign(({ context }) => ({
    sectionIndex: context.sectionIndex + 1
  })),
  
  // ── 数据存储 ──
  storePossibilities: assign((_, params: { possibilities: Possibility[] }) => ({
    possibilities: params.possibilities
  })),
  
  clearPossibilities: assign({ possibilities: [], selectedPossibilityId: null }),
  
  storeSelectedPossibility: assign((_, params: { possibilityId: string }) => ({
    selectedPossibilityId: params.possibilityId
  })),
  
  clearSelectedPossibility: assign({ selectedPossibilityId: null }),
  
  storeBrief: assign((_, params: { brief: Brief }) => ({
    brief: params.brief
  })),
  
  clearBrief: assign({ brief: null }),
  
  archiveBriefToHistory: assign(({ context }) => ({
    briefHistory: context.brief ? [...context.briefHistory, context.brief] : context.briefHistory
  })),
  
  storeBriefModifications: assign((_, params: { modifications: Modification[] }) => ({
    _pendingModifications: params.modifications
  })),
  
  storeGeneratedContent: assign((_, params: { content: string }) => ({
    generatedContent: params.content
  })),
  
  storeRevisedContent: assign(({ context }, params: { content: string }) => ({
    generatedContent: params.content,
    contentHistory: [...context.contentHistory, {
      id: generateId(),
      content: context.generatedContent!,
      revisionIndex: context.reviseCount,
      timestamp: Date.now(),
      revisionNotes: (context as any)._revisionNotes || '',
      approved: false
    }]
  })),
  
  clearGeneratedContent: assign({ generatedContent: null }),
  
  storeGodModeCommand: assign((_, params: { command: string }) => ({
    _godModeCommand: params.command
  })),
  
  clearGodModeCommand: assign({ _godModeCommand: undefined }),
  
  storeRevisionNotes: assign((_, params: { notes: string }) => ({
    _revisionNotes: params.notes
  })),
  
  storeRemonstratorReport: assign((_, params: { report: RemonstratorReport }) => ({
    remonstratorReport: params.report
  })),
  
  clearRemonstratorReport: assign({ remonstratorReport: null }),
  
  logIgnoredRemonstrator: assign(({ context }) => ({
    _ignoredRemonstratorAt: Date.now(),
    _ignoredRemonstratorSeverity: context.remonstratorReport?.severity
  })),
  
  // ── Oracle系统 ──
  setOracleEntryPoint: assign((_, params: { returnTo: string }) => ({
    _oracleReturnTo: params.returnTo
  })),
  
  storeOracleCost: assign((_, params: { cost: OracleCost }) => ({
    oracleCost: params.cost
  })),
  
  activateChaosSeed: assign(({ context }, params: { seed: ChaosSeed }) => ({
    chaosSeedsActive: [...context.chaosSeedsActive, params.seed],
    oracleCooldown: true
  })),
  
  discardChaosSeed: assign(({ context }, params: { seedId: string }) => ({
    chaosSeedsActive: context.chaosSeedsActive.filter(s => s.id !== params.seedId)
  })),
  
  setOracleCooldown: assign({ oracleCooldown: true }),
  
  // ── 滑动条 ──
  initializeSlider: assign({
    sliderState: { position: 50, label: '叙事张力', markers: [], confirmed: false }
  }),
  
  updateSliderPosition: assign(({ context }, params: { position: number }) => ({
    sliderState: context.sliderState ? {
      ...context.sliderState,
      position: params.position,
      confirmed: false
    } : null
  })),
  
  confirmSliderPosition: assign(({ context }) => ({
    sliderState: context.sliderState ? {
      ...context.sliderState,
      confirmed: true
    } : null
  })),
  
  resetSlider: assign({
    sliderState: { position: 50, label: '叙事张力', markers: [], confirmed: false }
  }),
  
  saveSliderState: assign(({ context }) => ({
    _savedSliderState: context.sliderState
  })),
  
  loadGhostAnchors: assign(({ context }) => ({
    ghostAnchors: generateGhostAnchors(context)
  })),
  
  // ── 心流与超时 ──
  updateFlowState: assign((_, params: { state: MouContext['flowState'] }) => ({
    flowState: params.state
  })),
  
  updateLastAuthorAction: assign({
    lastAuthorActionAt: Date.now()
  }),
  
  generateGuardianRecallMessage: assign(() => ({
    guardianMessage: generateRecallMessage()
  })),
  
  // ── 元级诊断 ──
  setDeadlockDetected: assign((_, params: { value: boolean }) => ({
    deadlockDetected: params.value
  })),
  
  clearDeadlockDetected: assign({ deadlockDetected: false }),
  
  generateMetarecursionReport: assign(() => ({
    _metarecursionReport: generateDiagnosticReport()
  })),
  
  // ── 降级处理 ──
  applyDegradedModel: assign(() => ({
    _useDegradedModel: true
  })),
  
  // ── 客户端通信 ──
  emitStatusToClient: (_, params: { status: string }) => {
    websocket.emit('mou:status_change', { status: params.status, timestamp: Date.now() });
  },
  
  // ── UI控制 ──
  showGeneratingIndicator: (_, params?: { message?: string }) => {
    websocket.emit('ui:show_loading', { message: params?.message || '正在生成...' });
  },
  
  hideGeneratingIndicator: () => {
    websocket.emit('ui:hide_loading', {});
  },
  
  renderPossibilityCards: ({ context }) => {
    websocket.emit('ui:render_possibilities', { 
      possibilities: context.possibilities,
      ghostAnchors: context.ghostAnchors 
    });
  },
  
  clearPossibilityCards: () => {
    websocket.emit('ui:clear_possibilities', {});
  },
  
  renderBriefEditor: ({ context }) => {
    websocket.emit('ui:render_brief_editor', { brief: context.brief });
  },
  
  clearBriefEditor: () => {
    websocket.emit('ui:clear_brief_editor', {});
  },
  
  enterRitualReadingMode: ({ context }) => {
    websocket.emit('ui:enter_ritual_reading', { 
      content: context.generatedContent,
      sliderState: context.sliderState 
    });
  },
  
  exitRitualReadingMode: () => {
    websocket.emit('ui:exit_ritual_reading', {});
  },
  
  renderRemonstratorReport: ({ context }) => {
    websocket.emit('ui:render_remonstrator', { 
      report: context.remonstratorReport 
    });
  },
  
  clearRemonstratorReport: () => {
    websocket.emit('ui:clear_remonstrator', {});
  },
  
  emitFatalError: (_, params: { message: string }) => {
    websocket.emit('system:fatal_error', { 
      message: params.message,
      timestamp: Date.now()
    });
  },
  
  // ── 控制台模式 ──
  switchConsoleMode: (_, params: { mode: string }) => {
    websocket.emit('ui:switch_mode', { mode: params.mode });
  },
  
  // ── 日志 ──
  logTransition: (_, params: { from: string; via: string }) => {
    logger.info(`[MOU] 状态转换: ${params.from} --${params.via}→ [下一状态]`);
  },
  
  logError: (_, params: { error: Error }) => {
    logger.error('[MOU] 错误:', params.error);
  },
  
  logRejectionReason: (_, params: { reason: string }) => {
    logger.info(`[MOU] Brief被拒绝，原因: ${params.reason}`);
  },
  
  logCommitSuccess: () => {
    logger.info('[MOU] 内容提交成功');
  },
  
  logCommitFailure: () => {
    logger.error('[MOU] 内容提交失败');
  },
  
  logMetarecursionTrigger: (_, params: { reason: string }) => {
    logger.critical(`[MOU] 元级召回触发，原因: ${params.reason}`);
  },
  
  // ── 工具函数 ──
  mergeContext: assign((_, params: { ctx: Partial<MouContext> }) => {
    return params.ctx;
  }),
  
  resetContext: assign(() => ({
    // 保留配置和基础ID，重置所有运行时状态
    chapterId: '',
    sectionIndex: 0,
    novelId: '',
    authorId: '',
    currentPhase: 'outline',
    loopCount: 0,
    possibilities: [],
    selectedPossibilityId: null,
    brief: null,
    briefHistory: [],
    generatedContent: null,
    contentHistory: [],
    remonstratorReport: null,
    retryCount: 0,
    reviseCount: 0,
    llmFailureCount: 0,
    oracleCooldown: false,
    oracleCost: null,
    chaosSeedsActive: [],
    lastAuthorActionAt: 0,
    flowState: 'engaged',
    guardianMessage: null,
    sliderState: null,
    ghostAnchors: [],
    deadlockDetected: false,
    metarecursionDepth: 0
  }))
};
```

---


## 4. Oracle 子流程状态机

### 4.1 设计哲学

Oracle（神谕）系统是 NarrativeOS 的**危机干预机制**。当作者连续多次无法做出满意选择（RETRY次数用尽）、或创作陷入深度僵局时，Oracle提供一次"破局"机会——以可控的叙事代价换取创作突破。

Oracle的核心原则：
- **代价可视化**：每次下神谕都有明确的叙事代价，作者必须在知情下确认
- **混沌可控**：混沌种子的扰动强度可配置，不会彻底摧毁已有叙事结构
- **债务追踪**：产生的叙事债务会被记录，后续需由作者或Soul Guardian填补
- **冷却机制**：神谕有冷却期，防止过度依赖

### 4.2 完整状态机配置

```json
{
  "$schema": "https://stately.ai/schema.json",
  "id": "oracle_flow",
  "initial": "oracle_cost_calculation",
  "context": {
    "entryPoint": "waiting_author_choice",
    "costCalculated": false,
    "authorConfirmed": false,
    "chaosSeedsGenerated": [],
    "rulesUpdated": false,
    "appliedAt": null
  },
  "states": {
    "oracle_cost_calculation": {
      "id": "oracle_cost_calculation",
      "type": "atomic",
      "description": "计算本次下神谕的叙事代价",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "ORACLE_CALCULATING_COST" } },
        { "type": "showGeneratingIndicator", "params": { "message": "Oracle正在计算代价..." } }
      ],
      "invoke": {
        "src": "calculateOracleCostService",
        "input": ({ context }: { context: MouContext }) => ({
          chapterId: context.chapterId,
          sectionIndex: context.sectionIndex,
          novelId: context.novelId,
          retryCount: context.retryCount,
          reviseCount: context.reviseCount,
          previousOracleUses: context.chaosSeedsActive.length,
          narrativeState: extractNarrativeState(context)
        }),
        "onDone": {
          "target": "waiting_oracle_confirmation",
          "actions": [
            { "type": "storeOracleCost", "params": ({ event }: { event: any }) => ({ cost: event.output }) }
          ]
        },
        "onError": {
          "actions": [
            { "type": "emitFatalError", "params": { "message": "Oracle代价计算失败" } }
          ]
        }
      }
    },

    "waiting_oracle_confirmation": {
      "id": "waiting_oracle_confirmation",
      "type": "atomic",
      "description": "严格阻塞态：等待作者确认是否承受代价以换取神谕",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "WAITING_ORACLE_CONFIRMATION" } },
        { "type": "renderOracleCostDisplay", "params": ({ context }: { context: MouContext }) => ({ cost: context.oracleCost }) },
        { "type": "updateLastAuthorAction" },
        { "type": "startAuthorTimeout", "params": ({ context }: { context: MouContext }) => ({ timeoutMs: context.config.authorTimeoutMs * 2 }) }
      ],
      "exit": [
        { "type": "clearOracleCostDisplay" },
        { "type": "stopAuthorTimeout" }
      ],
      "on": {
        "CONFIRM_ORACLE": {
          "target": "chaos_seed_generation",
          "actions": [
            { "type": "markOracleConfirmed", "params": { "confirmed": true } },
            { "type": "deductCoherenceBudget", "params": ({ context }: { context: MouContext }) => ({ amount: context.oracleCost?.coherenceBudget || 0 }) },
            { "type": "logTransition", "params": { "from": "waiting_oracle_confirmation", "via": "CONFIRM_ORACLE" } }
          ]
        },
        "CANCEL_ORACLE": {
          "target": "#mou_state_machine.waiting_author_choice",
          "actions": [
            { "type": "clearOracleCost" },
            { "type": "logTransition", "params": { "from": "waiting_oracle_confirmation", "via": "CANCEL_ORACLE" } }
          ]
        },
        "AUTHOR_TIMEOUT": {
          "actions": [
            { "type": "generateGuardianRecallMessage", "params": { "variant": "oracle_timeout" } }
          ]
        }
      }
    },

    "chaos_seed_generation": {
      "id": "chaos_seed_generation",
      "type": "atomic",
      "description": "生成混沌种子——非常规创作参数的扰动集合",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "CHAOS_SEED_GENERATING" } },
        { "type": "showGeneratingIndicator", "params": { "message": "混沌种子正在萌发..." } }
      ],
      "invoke": {
        "src": "generateChaosSeedsService",
        "input": ({ context }: { context: MouContext }) => ({
          chapterId: context.chapterId,
          sectionIndex: context.sectionIndex,
          oracleCost: context.oracleCost,
          narrativeState: extractNarrativeState(context),
          seedCount: Math.min(3 + Math.floor(context.retryCount / 2), 7) // 1-7个种子
        }),
        "onDone": {
          "target": "rule_update_application",
          "actions": [
            { "type": "storeChaosSeeds", "params": ({ event }: { event: any }) => ({ seeds: event.output }) }
          ]
        },
        "onError": {
          "actions": [
            { "type": "emitFatalError", "params": { "message": "混沌种子生成失败" } }
          ]
        }
      }
    },

    "rule_update_application": {
      "id": "rule_update_application",
      "type": "atomic",
      "description": "将混沌种子映射为创作规则更新",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "RULE_UPDATING" } },
        { "type": "showGeneratingIndicator", "params": { "message": "正在更新创作规则..." } }
      ],
      "invoke": {
        "src": "applyRuleUpdatesService",
        "input": ({ context }: { context: MouContext }) => ({
          chaosSeeds: context._pendingChaosSeeds || [],
          currentRules: extractCurrentRules(context),
          novelId: context.novelId
        }),
        "onDone": {
          "target": "oracle_complete",
          "actions": [
            { "type": "activateChaosSeeds", "params": ({ event }: { event: any }) => ({ ruleUpdates: event.output }) },
            { "type": "setOracleCooldown", "params": ({ context }: { context: MouContext }) => ({ duration: context.config.oracleCooldownMs }) }
          ]
        }
      }
    },

    "oracle_complete": {
      "id": "oracle_complete",
      "type": "final",
      "description": "神谕流程完成，返回父状态机",
      "entry": [
        { "type": "emitStatusToClient", "params": { "status": "ORACLE_COMPLETE" } },
        { "type": "renderChaosSeedSummary", "params": ({ context }: { context: MouContext }) => ({ seeds: context.chaosSeedsActive }) }
      ],
      "data": ({ context, event }: { context: MouContext; event: any }) => ({
        returnTo: context._oracleReturnTo || 'waiting_author_choice',
        chaosSeeds: context.chaosSeedsActive,
        oracleCost: context.oracleCost
      })
    }
  }
}
```

### 4.3 Oracle 异步服务实现

```typescript
// ============================================================
// Oracle 子流程异步服务
// ============================================================

/**
 * calculateOracleCostService —— 计算神谕代价
 * 基于当前叙事状态、历史使用情况和创作困境深度计算代价
 */
const calculateOracleCostService = fromPromise(
  async ({ input }: { input: CalculateOracleCostInput }) => {
    const { chapterId, sectionIndex, novelId, retryCount, reviseCount, previousOracleUses, narrativeState } = input;
    
    // 基础代价计算
    const baseCoherenceCost = 0.05; // 5%世界观一致性
    const retryMultiplier = 1 + (retryCount * 0.3); // 每次RETRY增加30%
    const previousUsePenalty = 1 + (previousOracleUses * 0.5); // 每次历史使用增加50%
    
    const coherenceBudget = Math.min(baseCoherenceCost * retryMultiplier * previousUsePenalty, 0.5); // 上限50%
    
    const emotionalTax = Math.min(0.02 * retryMultiplier, 0.15); // 情感税
    
    // 叙事债务（AI预测可能产生的叙事漏洞）
    const narrativeDebt = await callLLM('predictNarrativeDebt', {
      chapterId,
      sectionIndex,
      narrativeState,
      coherenceCost: coherenceBudget
    });
    
    return {
      coherenceBudget: Math.round(coherenceBudget * 100) / 100,
      emotionalTax: Math.round(emotionalTax * 100) / 100,
      narrativeDebt: narrativeDebt.items || [],
      cooldownDuration: Math.min(600000 * retryMultiplier, 3600000), // 10-60分钟
      description: generateCostDescription(coherenceBudget, emotionalTax, narrativeDebt.items)
    };
  }
);

/**
 * generateChaosSeedsService —— 生成混沌种子
 */
const generateChaosSeedsService = fromPromise(
  async ({ input }: { input: GenerateChaosSeedsInput }) => {
    const { chapterId, sectionIndex, oracleCost, narrativeState, seedCount } = input;
    
    const result = await callLLM('generateChaosSeeds', {
      chapterId,
      sectionIndex,
      oracleCost,
      narrativeState,
      seedCount,
      // 混沌种子类型分布
      seedTypes: [
        'perspective_shift',   // 视角切换
        'temporal_jump',       // 时间跳跃
        'character_deviation', // 角色行为偏离
        'atmosphere_inject',   // 氛围注入
        'logic_break',         // 逻辑断裂（高风险）
        'lore_twist',          // 设定扭转
        'emotional_surge'      // 情感爆发
      ]
    });
    
    return result.seeds.map((seed: any) => ({
      id: generateId(),
      parameter: seed.parameter,
      originalValue: seed.originalValue,
      perturbedValue: seed.perturbedValue,
      intensity: seed.intensity,
      description: seed.description,
      expiresAt: Date.now() + 86400000 // 24小时过期
    }));
  }
);

/**
 * applyRuleUpdatesService —— 应用规则更新
 */
const applyRuleUpdatesService = fromPromise(
  async ({ input }: { input: ApplyRuleUpdatesInput }) => {
    const { chaosSeeds, currentRules, novelId } = input;
    
    // 将每个混沌种子映射为创作规则的临时更新
    const ruleUpdates = chaosSeeds.map((seed: ChaosSeed) => ({
      seedId: seed.id,
      targetRule: seed.parameter,
      originalValue: currentRules[seed.parameter],
      updatedValue: seed.perturbedValue,
      effectiveUntil: seed.expiresAt,
      rollbackPlan: generateRollbackPlan(seed, currentRules)
    }));
    
    // 持久化临时规则
    await persistToStorage('oracle_rule_updates', {
      novelId,
      updates: ruleUpdates,
      createdAt: Date.now()
    });
    
    return ruleUpdates;
  }
);
```

### 4.4 滑动条交互状态管理

```typescript
// ============================================================
// 终审滑动条 —— 完整状态管理
// ============================================================

interface SliderInteractionState {
  // 视觉状态
  trackWidth: number;         // 轨道总宽度(px)
  thumbPosition: number;      // 滑块位置 0-100
  thumbDragging: boolean;     // 是否正在拖动
  
  // 逻辑状态
  confirmedPosition: number | null;  // 已确认的位置
  pendingPosition: number;    // 待确认位置
  
  // 幽灵锚点
  ghostAnchors: Array<{
    position: number;
    value: string;
    opacity: number;
    label: string;
  }>;
  
  // 标记点
  markers: Array<{
    position: number;
    label: string;
    color: string;
    type: 'preset' | 'author' | 'ai_suggested';
  }>;
  
  // 交互历史
  dragHistory: Array<{
    from: number;
    to: number;
    timestamp: number;
  }>;
}

/**
 * 滑动条状态机（内嵌于 waiting_final_review）
 */
const sliderMachine = createMachine({
  id: 'slider_interaction',
  initial: 'blank',
  context: {
    position: 50,
    confirmed: false,
    ghostAnchors: [],
    markers: []
  },
  states: {
    blank: {
      description: "滑动条初始状态：轨道空白，无确认值",
      entry: [
        assign({
          position: 50,
          confirmed: false
        })
      ],
      on: {
        SLIDER_DRAG: {
          target: 'dragging',
          actions: assign(({ event }: { event: any }) => ({
            position: event.position
          }))
        }
      }
    },
    
    dragging: {
      description: "作者正在拖动滑块",
      on: {
        SLIDER_DRAG: {
          actions: assign(({ event }: { event: any }) => ({
            position: clamp(event.position, 0, 100)
          }))
        },
        SLIDER_CONFIRM: {
          target: 'confirmed',
          actions: assign({
            confirmed: true
          })
        },
        SLIDER_RESET: {
          target: 'blank',
          actions: assign({
            position: 50,
            confirmed: false
          })
        }
      }
    },
    
    confirmed: {
      description: "滑块位置已确认，显示绿色标记",
      entry: [
        assign(({ context }: { context: any }) => ({
          confirmed: true
        }))
      ],
      on: {
        SLIDER_DRAG: {
          target: 'dragging',
          actions: assign(({ event }: { event: any }) => ({
            position: event.position,
            confirmed: false
          }))
        },
        SLIDER_RESET: {
          target: 'blank',
          actions: assign({
            position: 50,
            confirmed: false
          })
        }
      }
    }
  }
});

/**
 * 幽灵锚点显示逻辑
 * 
 * 规则：
 * 1. 每次终审确认后，当前滑块位置被记录为"幽灵锚点"
 * 2. 下一轮终审时，所有历史锚点以30%透明度灰色显示在轨道上
 * 3. 锚点按时间顺序排列，最新锚点显示标签"上一轮"
 * 4. 超过5轮的锚点自动淡出不再显示
 * 5. 锚点位置不可交互，仅作为视觉参考
 */
function generateGhostAnchors(context: MouContext): GhostAnchor[] {
  const history = context._savedSliderState ? [context._savedSliderState] : [];
  
  return history.map((state, index) => ({
    id: `ghost_${index}`,
    parameter: 'narrative_tension',
    previousValue: state.position,
    displayValue: `T${state.position}`,
    opacity: 0.3 * Math.pow(0.8, index) // 逐轮衰减
  }));
}

/**
 * 滑动条渲染规格
 */
interface SliderRenderSpec {
  // 轨道
  track: {
    height: 8;           // px
    borderRadius: 4;     // px
    background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ef4444 100%)';
  };
  
  // 滑块
  thumb: {
    width: 24;           // px
    height: 24;          // px
    borderRadius: 12;    // px (圆形)
    background: '#ffffff';
    border: '2px solid #6366f1';
    shadow: '0 2px 8px rgba(0,0,0,0.15)';
  };
  
  // 幽灵锚点
  ghostAnchor: {
    width: 16;           // px
    height: 16;          // px
    borderRadius: 8;     // px
    background: '#9ca3af';
    opacity: 0.3;        // 基础透明度
    label: {
      fontSize: 10;      // px
      color: '#6b7280';
      offset: { x: 0, y: -20 }
    };
  };
  
  // 标记点
  marker: {
    width: 12;
    height: 12;
    borderRadius: 6;
    colors: {
      preset: '#10b981',      // 绿色
      author: '#f59e0b',      // 琥珀色
      ai_suggested: '#3b82f6' // 蓝色
    };
  };
  
  // 确认状态
  confirmed: {
    thumbBorder: '#10b981',   // 绿色边框
    pulseAnimation: true,
    checkmark: true
  };
  
  // 刻度标签
  labels: {
    left: '收敛/内敛',
    center: '平衡',
    right: '发散/激烈',
    fontSize: 12,
    color: '#6b7280'
  };
}
```

### 4.5 代价可视化组件规格

```typescript
// ============================================================
// Oracle代价显示组件
// ============================================================

interface OracleCostDisplayProps {
  cost: OracleCost;
  onConfirm: () => void;
  onCancel: () => void;
  timeoutMs: number;
}

/**
 * 代价显示布局规格
 * 
 * ┌─────────────────────────────────────────────────┐
 * │  ⚡ Oracle 神谕召唤                              │
 * │                                                  │
 * │  当创作陷入僵局时，Oracle将注入混沌能量            │
 * │  打破既定轨道，开辟新的可能性空间。                │
 * │                                                  │
 * │  ┌─────────────────────────────────────────┐    │
 * │  │ 📊 本次代价评估                          │    │
 * │  │                                          │    │
 * │  │ 世界观一致性预算    [████████░░]  -12%   │    │
 * │  │ 情感税              [██░░░░░░░░]  -3%    │    │
 * │  │                                          │    │
 * │  │ 📝 可能产生的叙事债务：                   │    │
 * │  │ • 第X章时间线可能需要调整                 │    │
 * │  │ • 角色Y的动机需要后续补充说明             │    │
 * │  │ • 场景Z的氛围一致性可能受损               │    │
 * │  │                                          │    │
 * │  │ ⏱️ 冷却时间：30分钟                      │    │
 * │  └─────────────────────────────────────────┘    │
 * │                                                  │
 * │  ⚠️ 警告：混沌种子的影响将持续24小时             │
 * │                                                  │
 * │  [确认承受代价]        [取消，返回选择]           │
 * └─────────────────────────────────────────────────┘
 */
```

---

## 5. 状态详细行为规格

### 5.1 idle 状态

| 属性 | 规格 |
|------|------|
| **类型** | atomic |
| **阻塞性** | 否（系统就绪态） |
| **视觉状态** | 控制台显示"就绪"指示灯（绿色呼吸灯效果） |

**Entry Actions（进入时执行）**：
1. `incrementLoopCount` —— MOU循环计数器+1
2. `resetRetryCount` —— 重置连续重试计数器
3. `resetReviseCount` —— 重置连续修订计数器
4. `resetLLMFailureCount` —— 重置LLM失败计数器
5. `clearRemonstratorReport` —— 清空谏官报告
6. `updateFlowState(engaged)` —— 更新心流状态为"投入"
7. `emitStatusToClient(IDLE_READY)` —— 推送就绪状态到客户端

**Exit Actions（退出时执行）**：无

**Invoke（持续运行）**：
- `idleHeartbeatService` —— 每30秒发送一次心跳

**可接收事件**：
| 事件 | 条件 | 目标状态 | 效果 |
|------|------|---------|------|
| `INITIALIZE` | — | idle | 合并上下文参数 |
| `GOD_MODE` | `isValidGodModeCommand` | generating_content | 绕过所有中间流程，直接生成 |
| `SWITCH_MODE` | — | — | 切换控制台模式 |
| `RESET` | — | idle | 重置所有运行时状态 |

**系统在此状态的行为**：
- 维持WebSocket心跳连接
- 监听作者的新指令
- 定期同步云端进度
- Flow Guardian处于休眠，不发送消息

---

### 5.2 generating_possibilities 状态

| 属性 | 规格 |
|------|------|
| **类型** | atomic |
| **阻塞性** | 是（AI独占运行，作者等待） |
| **视觉状态** | 全屏加载动画，显示"正在探索可能性空间..." |

**Entry Actions**：
1. `emitStatusToClient(GENERATING_POSSIBILITIES)`
2. `showGeneratingIndicator` —— 显示旋转指示器和诗意提示语
3. `updateFlowState(engaged)`

**Exit Actions**：
1. `hideGeneratingIndicator`

**Invoke**：
- `generatePossibilitiesService` —— 异步调用LLM生成3-7条可能性
  - **onDone**: → `waiting_author_choice`，存储可能性列表，重置LLM失败计数
  - **onError**: → `llm_failure_handler`，增加LLM失败计数

**可接收事件**：无（AI独占运行中，不接收人类事件）

**系统在此状态的行为**：
- 调用LLM生成可能性（最多3次尝试，指数退避）
- 每次尝试增加temperature以获得更多样性
- 验证返回结果：必须≥3条有效可能性
- 向客户端推送进度更新（尝试1/3、尝试2/3等）

---

### 5.3 waiting_author_choice 状态

| 属性 | 规格 |
|------|------|
| **类型** | atomic |
| **阻塞性** | **严格阻塞** —— 所有流程在此暂停等待人类决策 |
| **视觉状态** | 可能性卡片网格布局，Oracle入口按钮 |

**Entry Actions**：
1. `emitStatusToClient(WAITING_AUTHOR_CHOICE)`
2. `renderPossibilityCards` —— 渲染可能性卡片
3. `updateLastAuthorAction` —— 记录作者最后操作时间
4. `updateFlowState(engaged)`
5. `startAuthorTimeout` —— 启动超时计时器

**Exit Actions**：
1. `clearPossibilityCards` —— 清除卡片
2. `stopAuthorTimeout` —— 停止超时计时器

**可接收事件**：
| 事件 | 条件 | 目标状态 | 效果 |
|------|------|---------|------|
| `CHOOSE` | `isValidPossibilityId` | generating_brief | 存储选择，重置重试计数 |
| `GOD_MODE` | `isValidGodModeCommand` | generating_content | 存储指令，直接生成 |
| `RETRY` | `canRetry` (retryCount < 3) | generating_possibilities | 增加重试计数，重新生成 |
| `REQUEST_ORACLE` | `isOracleAvailable` | oracle_flow | 进入神谕子流程 |
| `SWITCH_MODE` | — | — | 切换控制台模式 |
| `AUTHOR_TIMEOUT` | — | — | 生成Flow Guardian召回语 |

**关键行为——连续RETRY下神谕提示**：
```
RETRY计数器: 0 → 1 → 2 → 3(上限)

第1次RETRY后: 无特殊提示，正常重新生成
第2次RETRY后: Flow Guardian温和提示"还没有满意的方向吗？再试试看"
第3次RETRY后(用尽): 
  - 禁用RETRY按钮（置灰）
  - 显示Oracle入口按钮（闪烁动画，金色边框）
  - Flow Guardian提示"已连续三次未能找到满意的方向。Oracle或许能提供新的视角。"
  - 如果作者仍不选择Oracle，可选择GOD_MODE直接下达指令
```

**系统在此状态的行为**：
- 维持可能性卡片UI的交互响应
- 监控作者超时（默认5分钟）
- 心跳频率降至10秒/次（节省资源）
- 如果配置了Soul Guardian，在后台进行世界观一致性预检

---

### 5.4 oracle_flow 子流程（整体行为）

| 属性 | 规格 |
|------|------|
| **类型** | compound / 子状态机 |
| **阻塞性** | 子状态内部可能有阻塞态 |
| **入口条件** | `isOracleAvailable` guard通过 |

**整体流程**：
```
waiting_author_choice/final_review
  → REQUEST_ORACLE
  → oracle_cost_calculation (AI计算代价)
  → waiting_oracle_confirmation (严格阻塞：作者确认)
  → chaos_seed_generation (AI生成混沌种子)
  → rule_update_application (AI更新规则)
  → oracle_complete (完成，返回父状态机)
```

**返回父状态机后的行为**：
- 恢复父状态的等待界面
- 在可能性卡片/终审界面上叠加混沌种子效果指示器
- 所有AI生成服务自动读取激活的混沌种子

---

### 5.5 generating_brief 状态

| 属性 | 规格 |
|------|------|
| **类型** | atomic |
| **阻塞性** | 是 |
| **视觉状态** | 加载动画，显示"正在编织创作简报..." |

**Entry Actions**：
1. `emitStatusToClient(GENERATING_BRIEF)`
2. `showGeneratingIndicator("正在编织创作简报...")`

**Invoke**：
- `generateBriefService`
  - **onDone**: → `waiting_brief_approval`，存储Brief，重置LLM失败计数
  - **onError**: → `llm_failure_handler`

**输入参数**：
- 选定的可能性对象（含方向、信心度、标签等）
- 最近5条Brief历史（避免重复）
- 激活的混沌种子（影响Brief风格）

**输出格式**：
```typescript
interface Brief {
  id: string;
  direction: string;      // 200字以内的创作方向概述
  plotPoints: Array<{     // 3-7个情节点
    index: number;
    description: string;  // 每点50-100字
    emotionalBeat: string; // 情感节拍
  }>;
  characterArcs: Array<{  // 涉及的角色弧线
    characterId: string;
    arcNote: string;      // 本段中的角色发展
  }>;
  sceneNotes: string;     // 场景氛围、节奏、视角等技术备注
  pacing: 'slow' | 'medium' | 'fast';
  mood: string;           // 情感基调关键词
}
```

---

### 5.6 waiting_brief_approval 状态

| 属性 | 规格 |
|------|------|
| **类型** | atomic |
| **阻塞性** | **严格阻塞** |
| **视觉状态** | Brief编辑器，分区域显示 |

**Entry Actions**：
1. `emitStatusToClient(WAITING_BRIEF_APPROVAL)`
2. `renderBriefEditor` —— 渲染Brief编辑界面
3. `updateLastAuthorAction`
4. `startAuthorTimeout`

**可接收事件**：
| 事件 | 条件 | 目标状态 | 效果 |
|------|------|---------|------|
| `APPROVE` | — | generating_content | 归档Brief历史 |
| `MODIFY` | `hasValidModifications` | generating_brief | 存储修改请求，重新生成 |
| `REJECT` | — | generating_possibilities | 记录拒绝原因，清除选择 |
| `GOD_MODE` | — | generating_content | 直接生成 |
| `AUTHOR_TIMEOUT` | — | — | 生成召回语 |

**Brief编辑器UI布局**：
```
┌─────────────────────────────────────────────────────┐
│  📋 创作简报审批                                     │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ 🧭 创作方向                                    │    │
│  │ [可编辑文本区域 - 200字]                       │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ 🎯 情节点 (3-7个)                             │    │
│  │ ① [描述...] [🗑️] [➕]                        │    │
│  │ ② [描述...] [🗑️] [➕]                        │    │
│  │ ...                                          │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ 👤 角色弧线                                     │    │
│  │ [角色列表和弧线备注]                            │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ 🎬 技术备注                                     │    │
│  │ 节奏: [慢●○○快]  基调: [输入框]                │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  [✅ 批准并生成]  [📝 提交修改]  [❌ 拒绝重来]       │
└─────────────────────────────────────────────────────┘
```

---

### 5.7 generating_content 状态

| 属性 | 规格 |
|------|------|
| **类型** | atomic |
| **阻塞性** | 是 |
| **视觉状态** | 全屏加载，显示写作进度条 |

**Entry Actions**：
1. `emitStatusToClient(GENERATING_CONTENT)`
2. `showGeneratingIndicator("正在撰写正文...")`

**Invoke**：
- `generateContentService`
  - **onDone**: → `waiting_final_review`，存储内容，重置LLM失败计数
  - **onError**: → `llm_failure_handler`

**生成策略**：
- **Brief驱动模式**（默认）：严格遵循Brief的情节点和角色弧线
- **God Mode模式**：以作者指令为最高优先级，Brief降级为参考
- **混沌种子模式**：读取所有激活的混沌种子，应用到生成参数

**流式输出**：
- 正文采用流式传输（SSE），作者可实时看到生成过程
- 每完成一个情节点，推送一次进度更新
- 预计生成时间显示（基于历史数据统计）

---

### 5.8 waiting_final_review 状态（仪式化终审）

| 属性 | 规格 |
|------|------|
| **类型** | atomic |
| **阻塞性** | **严格阻塞** —— 最关键的人类决策点 |
| **视觉状态** | **仪式化阅读环境** —— 沉浸式审稿界面 |

**Entry Actions**：
1. `emitStatusToClient(WAITING_FINAL_REVIEW)`
2. `enterRitualReadingMode` —— 进入仪式化阅读环境
3. `initializeSlider` —— 初始化终审滑动条
4. `loadGhostAnchors` —— 加载上一轮幽灵锚点
5. `updateLastAuthorAction`
6. `startAuthorTimeout`

**Exit Actions**：
1. `exitRitualReadingMode`
2. `saveSliderState` —— 保存滑动条状态用于下一轮幽灵锚点
3. `stopAuthorTimeout`

**可接收事件**：
| 事件 | 条件 | 目标状态 | 效果 |
|------|------|---------|------|
| `APPROVE` | `isSliderConfirmed` | remonstrator_gate | 保存滑动条，重置修订计数 |
| `REVISE` | `canRevise` (reviseCount < 5) | revising_content | 存储修订意见 |
| `TRIGGER_REMONSTRATOR` | — | remonstrator_intervention | 手动触发谏官 |
| `SLIDER_DRAG` | — | — | 更新滑块位置 |
| `SLIDER_CONFIRM` | — | — | 确认当前位置 |
| `SLIDER_RESET` | — | — | 重置到50 |
| `REQUEST_ORACLE` | `isOracleAvailable` | oracle_flow | 进入神谕子流程 |
| `AUTHOR_TIMEOUT` | — | — | 生成召回语 |

**仪式化阅读环境规格**：
```
┌──────────────────────────────────────────────────────────────┐
│  [沉浸模式 - 所有UI元素已最小化]                                │
│                                                               │
│  第X章 · 第Y段                                                │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │                                                     │     │
│  │              [正文内容 - 排版优化]                     │     │
│  │                                                     │     │
│  │  - 字体：思源宋体 18px                                │     │
│  │  - 行高：1.8                                          │     │
│  │  - 段落间距：1.5em                                    │     │
│  │  - 背景：#faf9f7 (护眼纸色)                           │     │
│  │                                                     │     │
│  │  [情节点标记 - 侧边彩色竖线]                            │     │
│  │  [角色名高亮 - 悬停显示弧线信息]                         │     │
│  │                                                     │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌──────────┐  ┌──────────────────────────────────┐          │
│  │ 终审滑动条 │  │ 叙事张力                         │          │
│  │ ○━━━━━━━━○ │  │ 内敛 ←━━━━━━━━━━━━━━━━━━━━━━→ 激烈 │          │
│  │            │  │      ▲                           │          │
│  │ [确认位置]  │  │  上一轮●                        │          │
│  └──────────┘  └──────────────────────────────────┘          │
│                                                               │
│  [✅ 批准]  [📝 修订...]  [🔍 谏官审查]  [⚡ Oracle]           │
└──────────────────────────────────────────────────────────────┘
```

**滑动条交互规则**：
1. 初始状态：滑块位于轨道中央（50），轨道空白无色彩
2. 作者拖动时：轨道实时填充渐变色（左蓝→中紫→右红），表示叙事张力
3. 幽灵锚点：上一轮位置以灰色圆点显示（透明度30%）
4. 确认前：滑块边框为蓝色虚线
5. 确认后：滑块边框变绿色实线，显示✓标记，播放轻微确认音效
6. **APPROVE必须满足**：`isSliderConfirmed`为true（已确认滑块位置）

---

### 5.9 revising_content 状态

| 属性 | 规格 |
|------|------|
| **类型** | atomic |
| **阻塞性** | 是 |
| **视觉状态** | 加载动画 + 修订对比预览 |

**Invoke**：
- `reviseContentService`
  - **onDone**: → `waiting_final_review`，存储修订后内容
  - **onError**: → `llm_failure_handler`

**修订策略（随reviseCount递增变化）**：
```
reviseCount: 1 → 正常修订，精确执行作者意见
reviseCount: 2 → 增加自我审查，主动检查修订副作用
reviseCount: 3 → Flow Guardian介入，在修订前给出建议
reviseCount: 4 → 采用更保守的修订策略，最小化改动范围
reviseCount: 5 → 上限，Flow Guardian强制提示"已连续5次修订，建议换个方向思考"
```

---

### 5.10 remonstrator_intervention 状态

| 属性 | 规格 |
|------|------|
| **类型** | atomic |
| **阻塞性** | 是 |
| **视觉状态** | 谏官审阅动画（卷轴展开效果） |

**Invoke**：
- `remonstratorReviewService` —— 并行执行4个审查维度
  - **onDone**: → `waiting_author_verdict`，存储谏官报告
  - **onError**: → `llm_failure_handler`

**审查维度**：
1. **一致性检查**（consistency）：时间线、因果关系、前文引用
2. **角色检查**（character）：角色行为是否符合已建立的个性
3. **节奏检查**（pacing）：段落节奏与Brief设定是否匹配
4. **设定检查**（lore）：世界观设定的一致性

---

### 5.11 waiting_author_verdict 状态

| 属性 | 规格 |
|------|------|
| **类型** | atomic |
| **阻塞性** | **严格阻塞** |
| **视觉状态** | 谏官报告展示界面 |

**可接收事件**：
| 事件 | 目标状态 | 效果 |
|------|---------|------|
| `APPROVE` | committing | 批准，进入提交 |
| `MODIFY` | revising_content | 根据谏官建议修订 |
| `IGNORE_REMONSTRATOR` | committing | 忽略谏官，强制提交 |
| `GOD_MODE` | generating_content | 用新指令重新生成 |
| `AUTHOR_TIMEOUT` | — | 召回语 |

**谏官报告UI**：
```
┌──────────────────────────────────────────────────────────────┐
│  📜 谏官报告                                                    │
│  风险等级: [🔴 严重 / 🟠 警告 / 🟡 注意 / 🟢 正常]              │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ ⚠️ 发现问题 (N个)                                    │     │
│  │                                                      │     │
│  │ [1] [一致性] 第3段提到"X已死"，但第7段X再次说话         │     │
│  │     严重程度: 🔴 高    证据: "..."                    │     │
│  │                                                      │     │
│  │ [2] [角色] 角色Y的行为不符合第15章建立的性格特征         │     │
│  │     严重程度: 🟠 中    证据: "..."                    │     │
│  │     ...                                              │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ 💡 修复策略对比                                       │     │
│  │                                                      │     │
│  │ 问题1:                                               │     │
│  │   策略A: [最小改动 - 删除第7段X的台词]                    │     │
│  │   策略B: [叙事修复 - 增加"X的灵魂残影"设定]                │     │
│  │   策略C: [重写 - 重写第7段相关场景]                      │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  [✅ 批准并提交]  [📝 按建议修订]  [⏭️ 忽略谏官]              │
└──────────────────────────────────────────────────────────────┘
```

---

### 5.12 committing 状态

| 属性 | 规格 |
|------|------|
| **类型** | atomic |
| **阻塞性** | 是（短暂） |
| **视觉状态** | 保存动画，进度条 |

**Invoke**：
- `commitContentService` —— 持久化到存储
  - **onDone**: → `idle`，清空运行时状态，段落索引+1
  - **onError**: → `commit_failure_handler`

**提交数据**：
```typescript
interface CommitRecord {
  chapterId: string;
  sectionIndex: number;
  content: string;           // 最终正文
  briefId: string | null;    // 关联Brief
  novelId: string;
  remonstratorSeverity: string;
  loopCount: number;         // 本段经过几次MOU循环
  committedAt: number;       // 时间戳
  
  // 元数据
  metadata: {
    totalTimeMs: number;     // 从idle到commit的总耗时
    revisionCount: number;   // 修订次数
    oracleUsed: boolean;     // 是否使用过Oracle
    chaosSeeds: string[];    // 激活的混沌种子ID
    sliderPosition: number;  // 终审滑动条位置
  };
}
```

---

## 6. 异常处理完整规格

### 6.1 异常分类体系

```
NarrativeOS 异常分类
├── AI服务异常
│   ├── LLM调用失败（网络/超时/内容过滤）
│   ├── LLM返回格式错误
│   ├── LLM输出质量不合格
│   └── 降级模型也失败
├── 人机交互异常
│   ├── 作者超时无响应
│   ├── 连续RETRY达上限
│   ├── 连续REVISE达上限
│   └── 滑动条未确认就APPROVE
├── 系统级异常
│   ├── 状态机死锁
│   ├── 存储提交失败
│   ├── WebSocket断开
│   └── 内存/性能阈值超限
└── 叙事级异常
    ├── Oracle代价超出预算
    ├── 混沌种子产生冲突
    └── 谏官报告全部通过但作者主观不满
```

### 6.2 LLM调用失败重试策略

```typescript
// ============================================================
// LLM调用失败 - 完整重试策略
// ============================================================

interface LLMRetryConfig {
  maxAttempts: 3;                    // 最大重试次数
  baseDelayMs: 1000;                 // 基础延迟1秒
  backoffMultiplier: 2;              // 指数退避乘数
  maxDelayMs: 30000;                 // 最大延迟30秒
  degradedModel: 'gpt-3.5-turbo';    // 降级模型
  finalFallback: 'manual_intervention'; // 最终回退
}

/**
 * 完整重试流程
 */
async function callLLMWithRetry(
  task: string,
  params: any,
  config: LLMRetryConfig
): Promise<any> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      // 尝试主模型
      const result = await callLLM(task, {
        ...params,
        model: params.model || 'primary'
      });
      return { result, model: 'primary', attempt: attempt + 1 };
    } catch (error) {
      lastError = error as Error;
      
      // 分类错误
      const errorType = classifyLLMError(error);
      
      switch (errorType) {
        case 'network':
          // 网络错误：指数退避后重试
          await delay(Math.min(
            config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
            config.maxDelayMs
          ));
          continue;
          
        case 'timeout':
          // 超时：增加超时时间后重试
          await callLLM(task, {
            ...params,
            timeout: (params.timeout || 30000) * 1.5
          });
          continue;
          
        case 'content_filter':
          // 内容过滤：修改提示词后重试
          await callLLM(task, {
            ...params,
            prompt: sanitizePrompt(params.prompt)
          });
          continue;
          
        case 'format_error':
          // 格式错误：增加格式约束后重试
          await callLLM(task, {
            ...params,
            responseFormat: 'json_strict',
            formatExample: getFormatExample(task)
          });
          continue;
          
        case 'rate_limit':
          // 限流：等待更长时间
          await delay(60000); // 等待1分钟
          continue;
          
        default:
          // 未知错误：继续重试
          await delay(config.baseDelayMs * Math.pow(2, attempt));
          continue;
      }
    }
  }
  
  // 所有重试失败：尝试降级模型
  try {
    console.warn(`[LLM] 主模型 ${config.maxAttempts} 次尝试失败，降级到 ${config.degradedModel}`);
    const degradedResult = await callLLM(task, {
      ...params,
      model: config.degradedModel,
      simplified: true // 简化请求以提高成功率
    });
    return { result: degradedResult, model: config.degradedModel, attempt: 'degraded' };
  } catch (degradedError) {
    // 降级模型也失败：进入LLM_FAILURE_HANDLER
    throw new LLMFatalError(`LLM完全不可用`, {
      primaryError: lastError,
      degradedError,
      task,
      params
    });
  }
}

/**
 * 错误分类
 */
function classifyLLMError(error: unknown): LLMErrorType {
  if (error instanceof NetworkError) return 'network';
  if (error instanceof TimeoutError) return 'timeout';
  if (error instanceof ContentFilterError) return 'content_filter';
  if (error instanceof FormatError) return 'format_error';
  if (error instanceof RateLimitError) return 'rate_limit';
  return 'unknown';
}
```

### 6.3 连续RETRY计数器管理

```typescript
// ============================================================
// 连续RETRY - 计数器管理与下神谕提示
// ============================================================

interface RetryCounterManager {
  count: number;           // 当前计数
  maxCount: number;        // 最大允许次数 (默认3)
  history: number[];       // 历史计数时间戳
}

/**
 * RETRY状态转换图
 * 
 * waiting_author_choice
 *   → RETRY (count: 0→1) → generating_possibilities → waiting_author_choice
 *   → RETRY (count: 1→2) → generating_possibilities → waiting_author_choice  
 *   → RETRY (count: 2→3) → generating_possibilities → waiting_author_choice (RETRY禁用)
 *   → REQUEST_ORACLE → oracle_flow
 *   → GOD_MODE → generating_content
 *   → CHOOSE → generating_brief
 * 
 * count在以下事件时重置：
 * - 进入idle时 (resetRetryCount)
 * - CHOOSE时
 * - GOD_MODE时
 */

/**
 * RETRY用尽时的UI状态
 */
function renderRetryExhaustedUI(counter: RetryCounterManager): UIState {
  return {
    retryButton: {
      enabled: false,
      visual: 'disabled',
      tooltip: `已连续${counter.maxCount}次重试，请做出选择或使用Oracle`
    },
    oracleButton: {
      enabled: true,
      visual: 'highlighted',  // 金色边框 + 微弱脉动
      animation: 'pulse_gold',
      tooltip: 'Oracle可以打破当前僵局'
    },
    flowGuardianMessage: generateRetryExhaustedMessage(counter),
    possibilityCards: {
      filter: 'all',
      sort: 'relevance',
      highlightFresh: true  // 新批次可能性高亮
    }
  };
}

/**
 * Flow Guardian 连续RETRY提示语
 */
function generateRetryExhaustedMessage(counter: RetryCounterManager): string {
  const messages = [
    "已经连续三次重新探索了。有时候，最好的选择就藏在已有的可能性中。",
    "三次尝试未果...这往往意味着当前的困境需要更高维度的突破。Oracle或许能带来新的视角。",
    "创作就像迷宫，有时候我们需要一扇新的大门而非更多的小路。试试Oracle吧。",
    "你的坚持令人敬佩。但也请记住：换一个方向前进，不是放弃，而是智慧。"
  ];
  return messages[Math.min(counter.count - 1, messages.length - 1)];
}

/**
 * 在waiting_author_choice中随RETRY次数变化的Flow Guardian消息
 */
const retryGuardianMessages: Record<number, GuardianMessage> = {
  0: null, // 无消息
  1: {
    tone: 'neutral',
    text: '重新生成了新的可能性，希望这次有更合适的方向。',
    priority: 'low'
  },
  2: {
    tone: 'concerned',
    text: '这已经是第二次重试了。如果新的可能性仍不满意，也许该换个思路——试试直接表达你想要的（God Mode），或者让Oracle来打破常规。',
    priority: 'medium',
    suggestedActions: ['GOD_MODE', 'REQUEST_ORACLE']
  },
  3: {
    tone: 'gentle_urgency',
    text: '三次探索都未能找到满意的方向。这很正常——创作中最深的困境往往需要最勇敢的突破。Oracle已为你准备好，或者你也可以直接下达指令。',
    priority: 'high',
    suggestedActions: ['REQUEST_ORACLE', 'GOD_MODE'],
    highlightOracleButton: true
  }
};
```

### 6.4 连续REVISE计数器管理

```typescript
// ============================================================
// 连续REVISE - 计数器管理与Flow Guardian介入
// ============================================================

interface ReviseCounterManager {
  count: number;           // 当前计数
  maxCount: number;        // 最大允许次数 (默认5)
  revisionNotes: string[]; // 历史修订意见
  timestamps: number[];    // 历史修订时间戳
}

/**
 * REVISE状态转换图
 * 
 * waiting_final_review
 *   → REVISE (count: 0→1) → revising_content → waiting_final_review
 *   → REVISE (count: 1→2) → revising_content → waiting_final_review
 *   → ...
 *   → REVISE (count: 4→5) → revising_content → waiting_final_review (REVISE禁用)
 *   → TRIGGER_REMONSTRATOR → remonstrator_intervention
 *   → REQUEST_ORACLE → oracle_flow
 *   → GOD_MODE → generating_content (重写)
 * 
 * count在以下事件时重置：
 * - 进入idle时 (resetReviseCount)
 * - APPROVE时
 */

/**
 * Flow Guardian 连续REVISE温和提醒
 */
const reviseGuardianMessages: Record<number, GuardianMessage> = {
  0: null,
  1: null, // 第一次修订不提示
  2: {
    tone: 'gentle',
    text: '这是第二次修订了。小小的调整是打磨的必要过程，继续吧。',
    priority: 'low'
  },
  3: {
    tone: 'observational',
    text: '第三次修订了。我注意到你非常追求完美——这是好事。不过，如果细微的调整始终无法达到理想效果，也许是方向需要微调而非执行。',
    priority: 'medium',
    suggestedActions: ['TRIGGER_REMONSTRATOR']
  },
  4: {
    tone: 'concerned',
    text: '已经是第四次修订了。有时候"好"比"完美"更重要，尤其是初稿。谏官的报告或许能提供一些有用的视角。',
    priority: 'medium',
    suggestedActions: ['TRIGGER_REMONSTRATOR', 'APPROVE']
  },
  5: {
    tone: 'gentle_firm',
    text: '连续五次修订了。作为你的Flow Guardian，我必须诚实地告诉你：继续微调的边际效益正在递减。\n\n我有三个建议：\n1. 接受当前的版本，前进比完美更重要\n2. 让谏官从另一个角度审视\n3. 用God Mode直接表达你理想的样子，从头重写这一段\n\n你不需要做出完美的选择，只需要做出一个选择。',
    priority: 'high',
    suggestedActions: ['APPROVE', 'TRIGGER_REMONSTRATOR', 'GOD_MODE'],
    blockFurtherRevise: true
  }
};

/**
 * REVISE用尽时的UI状态
 */
function renderReviseExhaustedUI(counter: ReviseCounterManager): UIState {
  return {
    reviseButton: {
      enabled: false,
      visual: 'disabled',
      tooltip: `已连续${counter.maxCount}次修订，建议批准或使用其他方式`
    },
    approveButton: {
      visual: 'highlighted',
      animation: 'gentle_pulse',
      tooltip: '接受当前版本，继续前进'
    },
    remonstratorButton: {
      visual: 'highlighted',
      tooltip: '让谏官从另一个角度审视'
    },
    flowGuardianPanel: {
      visible: true,
      message: reviseGuardianMessages[counter.maxCount],
      collapsible: false
    }
  };
}
```

### 6.5 死锁检测与元级召回

```typescript
// ============================================================
// 死锁检测与元级召回
// ============================================================

/**
 * 死锁定义
 * 
 * 在NarrativeOS中，死锁指系统进入一种无法自行恢复的状态：
 * - 所有可能的状态转换都被guard条件阻止
 * - 作者无法通过正常事件推进流程
 * - AI服务持续失败且降级策略无效
 * 
 * 死锁触发条件（满足任一即触发）：
 */
const DEADLOCK_CONDITIONS = {
  // 条件1: LLM完全不可用
  llmCompleteFailure: (ctx: MouContext) => 
    ctx.llmFailureCount >= ctx.config.maxLLMFailures + 1, // 连降级模型也失败
  
  // 条件2: 状态循环陷阱
  stateCycleTrap: (ctx: MouContext, history: string[]) => {
    // 检查最近20次状态转换是否陷入A→B→A→B循环
    if (history.length < 6) return false;
    const recent = history.slice(-6);
    const pattern1 = recent[0] === recent[2] && recent[2] === recent[4];
    const pattern2 = recent[1] === recent[3] && recent[3] === recent[5];
    return pattern1 && pattern2;
  },
  
  // 条件3: 所有决策路径被封死
  allPathsBlocked: (ctx: MouContext) => {
    const inChoice = ctx.currentPhase === 'outline' && ctx.retryCount >= ctx.config.maxRetries;
    const inRevise = ctx.currentPhase === 'revision' && ctx.reviseCount >= ctx.config.maxRevises;
    const oracleUnavailable = ctx.oracleCooldown;
    return (inChoice || inRevise) && oracleUnavailable;
  },
  
  // 条件4: 上下文数据损坏
  contextCorruption: (ctx: MouContext) => {
    return !ctx.chapterId || !ctx.novelId || 
           (ctx.possibilities.length === 0 && ctx.currentPhase === 'outline');
  }
};

/**
 * 死锁检测算法
 */
class DeadlockDetector {
  private history: string[] = [];
  private checkInterval: number;
  
  constructor(intervalMs: number = 10000) {
    this.checkInterval = intervalMs;
  }
  
  recordTransition(from: string, event: string, to: string) {
    this.history.push(`${from}:${event}:${to}`);
    if (this.history.length > 50) this.history.shift(); // 保留最近50次
  }
  
  detect(context: MouContext): DeadlockReport | null {
    const triggeredConditions: string[] = [];
    
    if (DEADLOCK_CONDITIONS.llmCompleteFailure(context)) {
      triggeredConditions.push('llmCompleteFailure');
    }
    if (DEADLOCK_CONDITIONS.stateCycleTrap(context, this.history)) {
      triggeredConditions.push('stateCycleTrap');
    }
    if (DEADLOCK_CONDITIONS.allPathsBlocked(context)) {
      triggeredConditions.push('allPathsBlocked');
    }
    if (DEADLOCK_CONDITIONS.contextCorruption(context)) {
      triggeredConditions.push('contextCorruption');
    }
    
    if (triggeredConditions.length > 0) {
      return {
        detectedAt: Date.now(),
        conditions: triggeredConditions,
        currentState: this.getCurrentState(),
        history: [...this.history],
        context: serializeContext(context),
        severity: triggeredConditions.includes('contextCorruption') ? 'critical' : 'high'
      };
    }
    
    return null;
  }
}

/**
 * 元级召回流程
 */
interface MetarecursionFlow {
  // 阶段1: 死锁确认与报告
  phase1_confirm: {
    action: 'generate_diagnostic_report';
    output: DeadlockReport;
    notifyAuthor: true;  // 通知作者系统遇到困境
  };
  
  // 阶段2: 自反性诊断
  phase2_diagnose: {
    action: 'llm_self_diagnosis';
    prompt: string;      // 让LLM分析死锁原因
    context: SerializedContext;
    output: DiagnosisResult;
  };
  
  // 阶段3: 恢复策略生成
  phase3_recovery: {
    action: 'generate_recovery_plan';
    basedOn: DiagnosisResult;
    strategies: RecoveryStrategy[];
  };
  
  // 阶段4: 策略执行与验证
  phase4_execute: {
    action: 'execute_recovery';
    strategy: RecoveryStrategy;
    verification: 'state_reachable';  // 验证状态机可达
  };
}

/**
 * 恢复策略库
 */
const RECOVERY_STRATEGIES: RecoveryStrategy[] = [
  {
    id: 'soft_reset',
    name: '软重置',
    description: '清空当前运行时状态，返回idle',
    effect: '丢失未提交的生成内容，保留已提交历史',
    risk: 'low'
  },
  {
    id: 'context_repair',
    name: '上下文修复',
    description: '修复损坏的上下文数据',
    effect: '恢复基本运行能力',
    risk: 'low'
  },
  {
    id: 'model_rotation',
    name: '模型轮换',
    description: '切换到完全不同的LLM提供商',
    effect: '绕过特定模型的故障',
    risk: 'medium'
  },
  {
    id: 'emergency_oracle',
    name: '紧急Oracle',
    description: '绕过冷却限制强制启用Oracle',
    effect: '以双倍代价获得破局机会',
    risk: 'high'
  },
  {
    id: 'full_reset',
    name: '完整重置',
    description: '完全重置MOU循环',
    effect: '从头开始当前段落',
    risk: 'high'
  }
];

/**
 * 元级召回UI
 */
const metarecursionUI = {
  overlay: {
    visible: true,
    background: 'rgba(15, 23, 42, 0.95)',  // 深色半透明遮罩
    animation: 'fade_in'
  },
  panel: {
    title: '🔮 元级召回 —— 系统自诊断',
    sections: [
      {
        name: '诊断结果',
        content: '{{diagnosis_report}}',
        collapsible: false
      },
      {
        name: '恢复策略',
        content: '{{recovery_strategies}}',
        interaction: 'single_select'
      },
      {
        name: '操作日志',
        content: '{{transition_history}}',
        collapsible: true,
        defaultCollapsed: true
      }
    ],
    actions: [
      { label: '执行恢复', type: 'primary', enabled: 'strategy_selected' },
      { label: '联系支持', type: 'secondary', enabled: true },
      { label: '手动重置', type: 'danger', enabled: true, confirm: true }
    ]
  }
};
```

### 6.6 作者无响应超时处理

```typescript
// ============================================================
// 作者无响应 —— 超时配置与召回语
// ============================================================

interface AuthorTimeoutConfig {
  defaultTimeoutMs: 300000;       // 5分钟默认超时
  ritualReviewTimeoutMs: 600000;  // 仪式化终审延长至10分钟
  oracleTimeoutMs: 600000;        // Oracle确认延长至10分钟
  checkIntervalMs: 10000;         // 每10秒检查一次
  
  // 多级召回策略
  recallTiers: RecallTier[];
}

interface RecallTier {
  atPercentage: number;    // 超时进度的百分比
  action: 'gentle_nudge' | 'explicit_prompt' | 'flow_guardian_message' | 'sound_notification';
  message?: string;
  sound?: boolean;
  visualHighlight?: boolean;
}

const DEFAULT_RECALL_TIERS: RecallTier[] = [
  {
    atPercentage: 50,  // 50% = 2.5分钟
    action: 'gentle_nudge',
    message: null,  // 仅微妙UI提示
    visualHighlight: true  // 等待指示灯缓慢呼吸
  },
  {
    atPercentage: 80,  // 80% = 4分钟
    action: 'explicit_prompt',
    message: '还在思考吗？不急，我等你。',
    visualHighlight: true
  },
  {
    atPercentage: 100,  // 100% = 5分钟
    action: 'flow_guardian_message',
    message: null,  // 由Flow Guardian动态生成
    sound: true,
    visualHighlight: true
  },
  {
    atPercentage: 120,  // 120% = 6分钟（已超时）
    action: 'sound_notification',
    message: '如果需要休息，可以先保存当前进度。',
    sound: true
  }
];

/**
 * Flow Guardian 动态召回语生成
 */
function generateDynamicRecallMessage(context: MouContext): string {
  const state = context.currentPhase;
  const elapsed = Date.now() - context.lastAuthorActionAt;
  const minutes = Math.floor(elapsed / 60000);
  
  // 基于当前状态的个性化召回语
  const stateSpecificMessages: Record<string, string[]> = {
    outline: [
      `方向的选择确实不容易。已经${minutes}分钟了，需要我重新生成一批可能性吗？`,
      `选择困难？这很正常。每个选项都有其独特的叙事魅力。`,
      `如果现在的选择让你感到压力，试试God Mode直接告诉我你想要的。`
    ],
    draft: [
      `创作需要沉淀。已经${minutes}分钟了，慢慢想，我不着急。`,
      `Brief不满意的地方可以直接编辑，不需要 perfectionism。`,
      `有时候离开一下再回来会有新的灵感——需要保存当前进度吗？`
    ],
    revision: [
      `终审是重要的一环。已经${minutes}分钟了，慢慢品味。`,
      `如果不确定，可以先批准再后续调整。完美是完成的敌人。`,
      ` sliding bar 可以帮你找到最舒适的感觉。`
    ],
    final: [
      `谏官的报告可能信息量很大。需要我总结一下关键发现吗？`,
      `已经${minutes}分钟了。每个问题都有解决方案，不用太担心。`,
      `你的判断是最重要的。谏官只是提供参考。`
    ]
  };
  
  const messages = stateSpecificMessages[state] || stateSpecificMessages.outline;
  
  // 根据作者历史行为选择最合适的消息
  // （如果有历史数据，优先选择作者过去响应较好的风格）
  return selectBestMessage(messages, context);
}

/**
 * 超时处理原则
 * 
 * 1. 从不自动推进 —— 即使超时1小时，系统也只发送召回语，不自动做任何决策
 * 2. 保存草稿 —— 超时20分钟后，自动保存当前所有未提交内容到本地缓存
 * 3. 心流保护 —— 超时期间不弹出干扰性通知，仅通过微妙的UI变化提醒
 * 4. 离线友好 —— 超时期间如果WebSocket断开，恢复后从缓存恢复状态
 */
```

### 6.7 错误恢复路径汇总

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        异常恢复路径全景图                                 │
│                                                                          │
│  LLM调用失败                                                              │
│  ├── 第1次失败 ──→ 指数退避(1s) ──→ 重试                                │
│  ├── 第2次失败 ──→ 指数退避(2s) ──→ 重试                                │
│  ├── 第3次失败 ──→ 指数退避(4s) ──→ 重试                                │
│  └── 降级模型失败 ──→ LLM_FAILURE_HANDLER ──→ metarecursion_intervention  │
│                                                    │                     │
│  连续RETRY                                                                │
│  ├── count=1 ──→ 正常重新生成                                             │
│  ├── count=2 ──→ Flow Guardian温和提示                                    │
│  └── count=3 ──→ RETRY禁用, Oracle入口高亮, 建议GOD_MODE                  │
│                                                                          │
│  连续REVISE                                                               │
│  ├── count=1-2 ──→ 正常修订                                               │
│  ├── count=3 ──→ Flow Guardian建议谏官审查                                 │
│  ├── count=4 ──→ Flow Guardian建议接受或审查                               │
│  └── count=5 ──→ REVISE禁用, 强制选择APPROVE/TRIGGER_REMONSTRATOR/GOD_MODE │
│                                                                          │
│  死锁                                                                     │
│  ├── 检测到死锁 ──→ 生成诊断报告 ──→ 通知作者                               │
│  ├── LLM自诊断 ──→ 生成恢复策略列表                                        │
│  ├── 作者选择策略 ──→ 执行恢复                                            │
│  └── 恢复验证 ──→ 成功:返回idle / 失败:再次诊断(最多3次)                    │
│                                                                          │
│  作者超时                                                                 │
│  ├── 50% ──→ 微妙UI提示(呼吸灯)                                           │
│  ├── 80% ──→ 温和文字提示                                                 │
│  ├── 100% ──→ Flow Guardian动态召回语 + 音效                              │
│  ├── 120% ──→ 保存草稿到本地缓存                                          │
│  └── ∞ ──→ 保持状态，持续发送召回语（频率逐渐降低）                         │
│                                                                          │
│  提交失败                                                                 │
│  ├── 第1次失败 ──→ 1秒后重试                                              │
│  ├── 第2次失败 ──→ 2秒后重试                                              │
│  ├── 第3次失败 ──→ 4秒后重试                                              │
│  └── 全部失败 ──→ 导出本地备份 + 提示手动保存 + 进入metarecursion          │
└─────────────────────────────────────────────────────────────────────────┘
```



---

## 7. 三模式控制台交互设计

### 7.1 模式切换架构

```typescript
// ============================================================
// 控制台模式管理
// ============================================================

type ConsoleMode = 'cockpit' | 'dashboard' | 'hibernation';

interface ModeTransition {
  from: ConsoleMode;
  to: ConsoleMode;
  trigger: 'author_command' | 'auto_timeout' | 'system_event' | 'manual_switch';
  animation: string;
  dataPreserve: 'full' | 'minimal' | 'none';
}

/**
 * 模式切换规则
 * 
 * 有效切换: 
 *   cockpit ↔ dashboard ↔ hibernation (任意双向)
 *   任何模式 → cockpit (紧急切换)
 * 
 * 自动切换:
 *   cockpit → dashboard: 作者15分钟无操作
 *   dashboard → hibernation: 作者30分钟无操作
 *   hibernation → cockpit: 作者发送任何交互事件
 */

const MODE_TRANSITIONS: ModeTransition[] = [
  { from: 'cockpit', to: 'dashboard', trigger: 'auto_timeout', animation: 'collapse_sidebar', dataPreserve: 'full' },
  { from: 'dashboard', to: 'hibernation', trigger: 'auto_timeout', animation: 'fade_to_minimal', dataPreserve: 'minimal' },
  { from: 'hibernation', to: 'cockpit', trigger: 'author_command', animation: 'expand_full', dataPreserve: 'full' },
  { from: 'dashboard', to: 'cockpit', trigger: 'author_command', animation: 'expand_sidebar', dataPreserve: 'full' },
  { from: 'cockpit', to: 'hibernation', trigger: 'manual_switch', animation: 'fade_to_minimal', dataPreserve: 'minimal' },
  { from: 'hibernation', to: 'dashboard', trigger: 'manual_switch', animation: 'expand_partial', dataPreserve: 'minimal' }
];
```

### 7.2 驾驶舱模式（Cockpit Mode）

> **定位**：全功能创作指挥界面， author's primary workspace

#### 7.2.1 整体布局

```
┌────────────────────────────────────────────────────────────────────────────┐
│  🟢 驾驶舱模式  [📊仪表盘] [💤休眠舱]  [👤作者名]  [⚙️设置]          [?]  │ ← 顶部导航栏
├──────────┬─────────────────────────────────────────────────────┬───────────┤
│          │                                                      │           │
│  📑 章节  │     🎯 主工作区（根据当前MOU状态动态变化）              │  🤖 AI面板 │
│  导航栏   │                                                      │           │
│          │  ┌─────────────────────────────────────────────┐    │ ┌───────┐ │
│  第1章   │  │                                             │    │ │ Flow  │ │
│  第2章   │  │   [可能性卡片 / Brief编辑器 / 仪式化阅读       │    │ │Guardi-│ │
│  ▶第3章  │  │    / 谏官报告 / 空闲就绪界面]                 │    │ │  an   │ │
│  第4章   │  │                                             │    │ └───────┘ │
│  第5章   │  └─────────────────────────────────────────────┘    │ ┌───────┐ │
│          │                                                      │ │当前状态│ │
│          │  ┌─────────────────────────────────────────────┐    │ │指示器 │ │
│          │  │  📊 滑动条 / 操作按钮 / 辅助信息              │    │ └───────┘ │
│          │  └─────────────────────────────────────────────┘    │ ┌───────┐ │
│          │                                                      │ │Oracle │ │
│          │                                                      │ │状态  │ │
│          │                                                      │ └───────┘ │
├──────────┴─────────────────────────────────────────────────────┴───────────┤
│  📈 底部状态栏: [MOU循环: 12] [字数: 45,230] [📡在线] [⏱️本次用时: 23分]    │
└────────────────────────────────────────────────────────────────────────────┘

布局比例: 左侧15% | 主区60% | 右侧面板25%
```

#### 7.2.2 顶部导航栏

| 元素 | 类型 | 功能 |
|------|------|------|
| 模式指示器 | 标签 | 显示当前模式图标+名称，绿色呼吸灯表示活跃 |
| 模式切换按钮组 | 按钮组 | 📊仪表盘 / 💤休眠舱 切换按钮 |
| 作者信息 | 头像+名称 | 点击展开作者菜单（设置/退出/帮助） |
| 设置按钮 | 图标按钮 | 打开系统设置面板 |
| 帮助按钮 | 图标按钮 | 打开上下文帮助 |

#### 7.2.3 左侧章节导航栏

| 元素 | 类型 | 功能 |
|------|------|------|
| 章节列表 | 可滚动列表 | 显示所有章节，当前章节高亮 |
| 章节状态指示 | 颜色标记 | 🟢已提交 🟡进行中 ⚪未开始 🔴有谏官警告 |
| 段落预览 | 悬停提示 | 鼠标悬停显示该段前50字 |
| 快速跳转 | 点击 | 点击章节/段落直接跳转 |
| 新建章节 | 底部按钮 | 创建新章节 |

#### 7.2.4 主工作区（动态内容区）

主工作区根据当前MOU状态动态渲染不同内容：

**idle状态**：
```
┌─────────────────────────────────────────────┐
│                                             │
│         ✨ 准备就绪                          │
│                                             │
│    "每一段旅程都始于一个决定。"               │
│                                             │
│         [开始创作]  [继续上一段]              │
│                                             │
│    今日统计: 已完成3段 · 共2,450字            │
│                                             │
└─────────────────────────────────────────────┘
```

**waiting_author_choice状态**（可能性卡片）：
```
┌─────────────────────────────────────────────┐
│  🧭 选择下一段的方向 (3个可能性)              │
│                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │ 可能性A  │  │ 可能性B  │  │ 可能性C  │    │
│  │ [预览]  │  │ [预览]  │  │ [预览]  │    │
│  │ 信心85% │  │ 信心72% │  │ 信心68% │    │
│  │ [选择]  │  │ [选择]  │  │ [选择]  │    │
│  └─────────┘  └─────────┘  └─────────┘    │
│                                             │
│  [🔄 重新生成]  [⚡ Oracle]  [👑 God Mode]   │
└─────────────────────────────────────────────┘
```

**waiting_final_review状态**（仪式化阅读）：见5.8节

#### 7.2.5 右侧AI面板

| 区域 | 内容 | 更新频率 |
|------|------|---------|
| Flow Guardian | 当前守护消息、心流状态指示 | 实时 |
| 状态指示器 | 当前MOU状态、阻塞/运行指示 | 实时 |
| Oracle状态 | 冷却倒计时、已激活混沌种子 | 每秒 |
| 快捷操作 | 根据当前状态显示的快捷按钮 | 状态切换时 |

#### 7.2.6 底部状态栏

| 指标 | 说明 | 数据来源 |
|------|------|---------|
| MOU循环数 | 本段经历的完整循环次数 | 状态机context.loopCount |
| 字数统计 | 本章/本段/总计字数 | 实时计算 |
| 连接状态 | WebSocket连接状态 | 心跳检测 |
| 本次用时 | 从idle开始的持续时间 | 计时器 |
| 异常计数 | 当前重试/修订/失败次数 | 状态机context |

### 7.3 仪表盘模式（Dashboard Mode）

> **定位**：创作数据概览与全局管理， author's command center

#### 7.3.1 整体布局

```
┌────────────────────────────────────────────────────────────────────────────┐
│  📊 仪表盘模式  [✈️驾驶舱] [💤休眠舱]  [👤作者名]  [⚙️设置]          [?]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌───────────────────┐  │
│  │ 📈 创作进度概览      │  │ 🎯 今日目标          │  │ ⚡ 系统健康度      │  │
│  │                     │  │                     │  │                   │  │
│  │ 总进度 ████████░░ 80%│  │ 目标: 5000字        │  │ LLM: 🟢正常       │  │
│  │ 第3章/共5章          │  │ 已完成: 2450字      │  │ 存储: 🟢正常      │  │
│  │                     │  │ 剩余: 2550字        │  │ WebSocket: 🟢正常 │  │
│  │ [展开详情]          │  │                     │  │ 缓存: 🟡 78%      │  │
│  └─────────────────────┘  └─────────────────────┘  └───────────────────┘  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📅 最近7天创作热力图                                                  │   │
│  │ 一  二  三  四  五  六  日                                           │   │
│  │ ██  ░░  ██  ██  ░░  ███ ███                                         │   │
│  │ [颜色深度表示创作时长]                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌──────────────────────────┐  ┌───────────────────────────────────────┐  │
│  │ 🔔 告警与通知             │  │ 📜 最近活动日志                        │  │
│  │                          │  │                                       │  │
│  │ 🔴 世界观一致性低于阈值   │  │ 14:32  提交了第3章第12段              │  │
│  │ 🟡 已连续2次修订         │  │ 14:15  使用了Oracle                   │  │
│  │ 🟢 Oracle已冷却完毕      │  │ 13:58  批准了Brief                    │  │
│  │                          │  │ 13:40  选择了可能性B                  │  │
│  │ [查看全部]               │  │ 13:25  开始第3章第12段                │  │
│  └──────────────────────────┘  └───────────────────────────────────────┘  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🌍 全局叙事状态                                                      │   │
│  │                                                                      │   │
│  │ 角色关系图 [交互式力导向图]  时间线 [可缩放]  世界观完整性 [环形进度]   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

#### 7.3.2 显示指标与更新频率

| 指标类别 | 具体指标 | 更新频率 | 告警阈值 |
|----------|---------|---------|---------|
| **进度** | 总字数、章节完成率、段落完成率 | 每次commit | 无 |
| **进度** | 今日字数、本周字数、本月字数 | 每5分钟 | 日目标未达成>80%时🟡 |
| **质量** | 谏官历史平均风险等级 | 每次谏官完成 | >"warning"时🟠 |
| **质量** | 修订频率（平均每次MOU的REVISE次数） | 每10次MOU | >2次时🟡 |
| **系统** | LLM响应时间(P50/P99) | 实时 | P99>10s时🟠 |
| **系统** | WebSocket连接质量 | 实时 | 断开时🔴 |
| **系统** | 本地缓存使用率 | 每5分钟 | >90%时🟠 |
| **叙事** | 世界观一致性评分 | 每小时 | <70%时🔴 |
| **叙事** | 角色行为一致性评分 | 每小时 | <80%时🟡 |
| **叙事** | 时间线一致性 | 每小时 | 发现冲突时🔴 |

#### 7.3.3 告警系统

```typescript
// ============================================================
// 告警系统
// ============================================================

interface Alert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  category: 'system' | 'narrative' | 'flow' | 'quality';
  title: string;
  description: string;
  timestamp: number;
  acknowledged: boolean;
  autoDismiss: boolean;
  dismissAfterMs?: number;
  suggestedAction?: string;
}

// 告警级别视觉规格
const ALERT_VISUALS = {
  info: {
    borderColor: '#3b82f6',    // 蓝色
    background: '#eff6ff',
    icon: 'ℹ️',
    sound: false,
    vibration: false
  },
  warning: {
    borderColor: '#f59e0b',    // 琥珀色
    background: '#fffbeb',
    icon: '⚠️',
    sound: true,               // 轻柔提示音
    vibration: false
  },
  critical: {
    borderColor: '#ef4444',    // 红色
    background: '#fef2f2',
    icon: '🔴',
    sound: true,               // 明显告警音
    vibration: true,
    pulseAnimation: true       // 红色脉动边框
  }
};
```

### 7.4 休眠舱模式（Hibernation Mode）

> **定位**：最小化运行，后台保持同步， author's background mode

#### 7.4.1 整体布局

```
┌─────────────────────────────────────────────────────┐
│  💤 休眠舱  [✈️驾驶舱] [📊仪表盘]          [⚙️]  [?]  │
├─────────────────────────────────────────────────────┤
│                                                      │
│           ┌─────────────────────────┐                │
│           │                         │                │
│           │    💤 NarrativeOS       │                │
│           │                         │                │
│           │    已进入休眠模式        │                │
│           │                         │                │
│           │    后台同步: 🟢 运行中   │                │
│           │    最后活动: 2小时前     │                │
│           │                         │                │
│           │    [点击任意处唤醒]      │                │
│           │                         │                │
│           └─────────────────────────┘                │
│                                                      │
│  最小化信息栏:                                       │
│  [📡] [💾自动保存中] [🔔2条未读]  [⏱️今日: 45分]    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

#### 7.4.2 休眠舱运行功能

| 功能 | 状态 | 说明 |
|------|------|------|
| WebSocket连接 | 保持 | 心跳间隔延长至60秒 |
| 本地缓存同步 | 运行 | 持续同步到本地IndexedDB |
| 云端同步 | 运行 | 每5分钟推送一次变更 |
| 自动保存 | 运行 | 每30秒保存工作区快照 |
| 通知接收 | 运行 | 接收系统通知（静默） |
| AI预计算 | 可选 | 可配置在后台预生成可能性 |
| UI渲染 | 暂停 | 主工作区不渲染，节省GPU |
| 心跳监控 | 运行 | 维持最小化心跳 |

#### 7.4.3 唤醒条件

| 触发源 | 唤醒方式 | 目标模式 |
|--------|---------|---------|
| 作者点击界面 | 全屏展开动画 | cockpit |
| 作者发送键盘事件 | 快速展开 | cockpit |
| 收到紧急通知 | 弹出通知 + 半唤醒 | dashboard |
| 系统告警（critical） | 声音 + 红色脉动 | cockpit |
| 定时唤醒（可配置） | 静默切换到dashboard | dashboard |

#### 7.4.4 唤醒动画规格

```typescript
interface WakeUpAnimation {
  // 休眠舱 → 驾驶舱
  hibernation_to_cockpit: {
    duration: 800,           // ms
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    steps: [
      { at: 0,   state: 'full_minimal', opacity: 1 },
      { at: 200, state: 'center_expand', opacity: 1, scale: 1.05 },
      { at: 500, state: 'sidebar_slide_in', leftPanel: 'translateX(0)' },
      { at: 700, state: 'right_panel_slide_in', rightPanel: 'translateX(0)' },
      { at: 800, state: 'full_active', opacity: 1, scale: 1 }
    ]
  };
  
  // 休眠舱 → 仪表盘
  hibernation_to_dashboard: {
    duration: 600,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    steps: [
      { at: 0,   state: 'full_minimal' },
      { at: 300, state: 'content_fade', opacity: 0 },
      { at: 400, state: 'dashboard_layout', gridVisible: true },
      { at: 600, state: 'full_dashboard', opacity: 1 }
    ]
  };
}
```

---

## 8. 关键页面详细设计

### 8.1 可能性选择页面

#### 8.1.1 布局规格

```
┌─────────────────────────────────────────────────────────────────────┐
│  🧭 可能性空间 —— 第3章 · 第12段                                     │
│                                                                      │
│  Flow Guardian: "基于当前剧情走向，我为你找到了这些可能性..."         │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 筛选: [全部▼]  排序: [相关度▼]  视图: [卡片▦|列表▧|对比◫]   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ 🔮 可能性 #1      │  │ 🔮 可能性 #2      │  │ 🔮 可能性 #3      │   │
│  │                  │  │                  │  │                  │   │
│  │ 「龙与少年」      │  │ 「暗夜抉择」      │  │ 「意外的盟友」    │   │
│  │                  │  │                  │  │                  │   │
│  │ 信心: 85% ████░  │  │ 信心: 72% ███░░  │  │ 信心: 68% ███░░  │   │
│  │ 偏离度: 中        │  │ 偏离度: 高        │  │ 偏离度: 低        │   │
│  │                  │  │                  │  │                  │   │
│  │ ┌──────────────┐ │  │ ┌──────────────┐ │  │ ┌──────────────┐ │   │
│  │ │ 预览...      │ │  │ │ 预览...      │ │  │ │ 预览...      │ │   │
│  │ │ 少年在月光下  │ │  │ │ 黑暗中，主角  │ │  │ │ 一位神秘的旅人  │   │
│  │ │ 发现了龙的    │ │  │ │ 面临着艰难    │ │  │ │ 出现在主角面前  │   │
│  │ │ 踪迹，追踪    │ │  │ │ 的抉择...    │ │  │ │ 提供了意外的    │   │
│  │ │ 至古老森林    │ │  │ │              │ │  │ │ 帮助...        │   │
│  │ └──────────────┘ │  │ └──────────────┘ │  │ └──────────────┘ │   │
│  │                  │  │                  │  │                  │   │
│  │ 标签: #主线 #奇幻 │  │ 标签: #内心 #黑暗 │  │ 标签: #支线 #悬疑 │   │
│  │ 情感: 好奇→紧张   │  │ 情感: 焦虑→决绝   │  │ 情感: 疑惑→信任   │   │
│  │                  │  │                  │  │                  │   │
│  │  [🔍 展开详情]   │  │  [🔍 展开详情]   │  │  [🔍 展开详情]   │   │
│  │                  │  │                  │  │                  │   │
│  │  [✨ 选择这个方向] │  │  [✨ 选择这个方向] │  │  [✨ 选择这个方向] │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 对比模式（当选择2个可能性时显示）                              │    │
│  │ 特性 	 可能性#1    	 可能性#2                            │    │
│  │ 偏离度 	 中    		 高                                  │    │
│  │ 信心度 	 85%   		 72%                                 │    │
│  │ 情感基调 	 好奇    	 焦虑                                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 其他选项:                                                     │    │
│  │ [🔄 重新生成可能性]  [⚡ Oracle打破僵局]  [👑 God Mode直接指令] │    │
│  │                                                             │    │
│  │ 提示: 已连续重试 X/3 次                                     │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 8.1.2 卡片规格

```typescript
interface PossibilityCardSpec {
  // 容器
  container: {
    width: 320;              // px
    minHeight: 400;          // px
    borderRadius: 16;        // px
    background: '#ffffff';
    border: '1px solid #e5e7eb';
    shadow: '0 1px 3px rgba(0,0,0,0.1)';
    hoverShadow: '0 8px 25px rgba(0,0,0,0.15)';
    hoverTransform: 'translateY(-4px)';
    transition: 'all 0.3s ease';
  };
  
  // 选中状态
  selected: {
    border: '2px solid #6366f1';
    shadow: '0 0 0 4px rgba(99, 102, 241, 0.2)';
    checkmark: true;         // 右上角✓标记
  };
  
  // 信心度条
  confidenceBar: {
    height: 6;               // px
    borderRadius: 3;         // px
    colors: {
      high: '#10b981',     // >80% 绿色
      medium: '#f59e0b',   // 50-80% 琥珀色
      low: '#ef4444'       // <50% 红色
    }
  };
  
  // 标签
  tag: {
    padding: '2px 8px';
    borderRadius: 12;        // px
    fontSize: 12;            // px
    background: '#f3f4f6';
    color: '#4b5563';
  };
  
  // 预览区域
  preview: {
    maxHeight: 120;          // px
    fontSize: 14;            // px
    lineHeight: 1.6;
    color: '#6b7280';
    overflow: 'hidden';
    mask: 'linear-gradient(to bottom, black 80%, transparent 100%)'
  };
}
```

#### 8.1.3 筛选与排序

```typescript
// 筛选选项
const FILTER_OPTIONS = [
  { id: 'all', label: '全部' },
  { id: 'mainline', label: '主线' },
  { id: 'side', label: '支线' },
  { id: 'high_confidence', label: '高信心(>80%)' },
  { id: 'low_divergence', label: '低偏离' },
  { id: 'emotional', label: '情感向' },
  { id: 'action', label: '动作向' }
];

// 排序选项
const SORT_OPTIONS = [
  { id: 'relevance', label: '相关度' },
  { id: 'confidence', label: '信心度(高→低)' },
  { id: 'divergence', label: '偏离度(低→高)' },
  { id: 'emotional_intensity', label: '情感强度' }
];

// 视图模式
const VIEW_MODES = [
  { id: 'card', label: '卡片', icon: '▦' },
  { id: 'list', label: '列表', icon: '▧' },
  { id: 'compare', label: '对比', icon: '◫' }
];
```

#### 8.1.4 对比视图

对比视图允许作者选择2-3个可能性进行并排比较，高亮显示关键差异：

| 对比维度 | 显示方式 |
|---------|---------|
| 信心度 | 水平条形图并排 |
| 偏离度 | 偏离程度指示条 |
| 情感基调 | 情感轮盘标记点 |
| 涉及角色 | 角色头像对比 |
| 预估字数 | 数字对比 |
| 标签交集 | 维恩图风格显示 |

### 8.2 Brief审批页面

#### 8.2.1 布局规格

```
┌─────────────────────────────────────────────────────────────────────┐
│  📋 创作简报审批 —— 第3章 · 第12段                                   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 基于可能性: 「龙与少年」  信心85%                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🧭 创作方向                                                   │    │
│  │ ┌─────────────────────────────────────────────────────────┐ │    │
│  │ │ 本段围绕少年与龙的初次相遇展开，通过追踪踪迹的悬念设计，    │ │    │
│  │ │ 营造从好奇到紧张的情感弧线。龙的出现应打破日常节奏，       │ │    │
│  │ │ 带来世界观层面的冲击... [编辑✏️]                           │ │    │
│  │ └─────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🎯 情节点 (4个)                                               │    │
│  │                                                              │    │
│  │ ① 月光下的发现  [展开▼] [🗑️]                                │    │
│  │    少年在庭院中发现不属于任何已知动物的巨大爪印...             │    │
│  │    情感: 好奇 → 疑惑                                          │    │
│  │                                                              │    │
│  │ ② 追踪踪迹     [展开▼] [🗑️]                                │    │
│  │    沿着踪迹进入禁忌森林，环境逐渐变得诡异...                  │    │
│  │    情感: 疑惑 → 紧张                                          │    │
│  │                                                              │    │
│  │ ③ [➕ 添加情节点]                                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 👤 角色弧线                                                   │    │
│  │                                                              │    │
│  │ ┌─────────┐ ┌─────────┐                                    │    │
│  │ │ 林小凡   │ │ 苍龙·渊  │                                    │    │
│  │ │ 少年主角 │ │ 神秘存在 │                                    │    │
│  │ │          │ │          │                                    │    │
│  │ │ 弧线:    │ │ 弧线:    │                                    │    │
│  │ │ 从胆怯到 │ │ 从神秘到 │                                    │    │
│  │ │ 勇敢的第一步│ 展现善意 │                                    │    │
│  │ └─────────┘ └─────────┘                                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🎬 技术备注                                                   │    │
│  │ 节奏: [慢●○○快]  基调: [奇幻悬疑▼]  视角: [第三人称有限▼]      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 📜 历史对比                                                   │    │
│  │ [显示与上一轮Brief的diff，绿色=新增 红色=删除]                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  [✅ 批准并生成正文]  [📝 提交修改]  [❌ 拒绝，重新选择可能性]        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 8.2.2 编辑功能

| 可编辑区域 | 编辑方式 | 验证规则 |
|-----------|---------|---------|
| 创作方向 | 行内编辑 | 10-200字 |
| 情节点描述 | 行内编辑 + 展开 | 每个情节点50-100字 |
| 情节点情感 | 下拉选择 | 从预定义情感列表选择 |
| 角色弧线 | 行内编辑 | 每个角色20-50字 |
| 节奏 | 滑动条 | 慢/中/快三档 |
| 基调 | 下拉选择 | 从预定义基调列表选择 |
| 视角 | 下拉选择 | 第一/第三人称等 |

#### 8.2.3 历史对比（Diff视图）

```typescript
interface BriefDiffView {
  // 差异显示
  diffMode: 'inline' | 'side_by_side';
  
  // 变更类型
  changeTypes: {
    added: { color: '#10b981', background: '#ecfdf5' },      // 绿色
    removed: { color: '#ef4444', background: '#fef2f2' },    // 红色
    modified: { color: '#f59e0b', background: '#fffbeb' },   // 琥珀色
    unchanged: { color: '#6b7280', background: 'transparent' } // 灰色
  };
  
  // 交互
  features: {
    collapseUnchanged: true;   // 可折叠未变更部分
    acceptChange: true;        // 可单独接受某处变更
    rejectChange: true;        // 可单独拒绝某处变更
    jumpToNextChange: true;    // 跳转到下一处变更
  };
}
```

### 8.3 正文终审页面（仪式化阅读环境）

#### 8.3.1 仪式化阅读环境规格

```typescript
// ============================================================
// 仪式化阅读环境 —— 完整规格
// ============================================================

interface RitualReadingSpec {
  // ── 视觉环境 ──
  visual: {
    backgroundColor: '#faf9f7';           // 护眼纸色
    fontFamily: '"Source Han Serif CN", "Noto Serif SC", serif';
    fontSize: 18;                         // px
    lineHeight: 1.8;
    paragraphSpacing: '1.5em';
    maxContentWidth: 720;                 // px，最佳阅读宽度
    marginHorizontal: 'auto';
    paddingVertical: 60;                  // px
    
    // 情节点标记
    plotPointMarker: {
      width: 3;                           // px
      color: '#6366f1';                   // 靛蓝色
      offset: -20;                        // px，左侧偏移
      animation: 'fade_in_on_scroll'
    };
    
    // 角色名高亮
    characterHighlight: {
      color: '#4f46e5';
      fontWeight: 500;
      hoverCard: true                     // 悬停显示角色信息卡片
    };
    
    // 滚动条
    scrollbar: {
      width: 6;                           // px
      trackColor: 'transparent';
      thumbColor: '#d1d5db';
      thumbHoverColor: '#9ca3af'
    }
  };
  
  // ── 交互行为 ──
  interaction: {
    // 双击批注
    doubleClickAnnotate: true;
    
    // 选中文字操作
    selectionActions: ['annotate', 'revise', 'ask_ai'];
    
    // 键盘快捷键
    shortcuts: {
      'Space': 'scroll_down',
      'j': 'scroll_down',
      'k': 'scroll_up',
      'a': 'approve',
      'r': 'revise',
      'o': 'trigger_oracle',
      'Escape': 'exit_ritual_mode'
    };
    
    // 进度指示
    progressIndicator: {
      type: 'reading_position',           // 阅读位置指示
      showPercentage: true,
      showEstimatedTime: true
    };
  };
  
  // ── 音效（可选） ──
  audio: {
    ambientSound: false;                  // 可配置环境音
    pageTurnSound: true;                  // 滚动到底时的翻页音效
    approvalChime: true;                  // 批准时的确认音
    sliderTick: true;                     // 滑动条刻度音
  };
}
```

#### 8.3.2 完整布局

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│   [最小化顶部栏 - 半透明]                                                     │
│   第3章 · 第12段    仪式化审阅    [退出审阅✕]                                │
│                                                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│                    第3章 龙的影子                                              │
│                                                                               │
│                    十二                                                        │
│                                                                               │
│    月光像一层薄纱铺在青石板上，林小凡蹲在院子的角落里，                        │
│    手指轻轻抚过那片不属于自己的痕迹。                                          │
│                                                                               │
│    「这是……爪印？」                                                           │
│                                                                               │
│    他喃喃自语，心跳不由自主地加快了几分。那痕迹比任何猎犬                    │
│    的脚印都要大上三倍，而且形状奇特——不是犬科动物的四趾，                    │
│    而是五趾，每趾末端都有深深的沟壑，像是刀刃划过软泥。                      │
│                                                                               │
│    ┃ 情节点①: 月光下的发现                                                   │
│    ┃                                                                          │
│    林小凡站起身，环顾四周。月色如水，将他单薄的身影拉得很                    │
│    长。他本该回屋睡觉，明天还有早课。但那个爪印像是一个                      │
│    无声的邀请，引诱着他走向院门。                                              │
│                                                                               │
│    他深吸一口气，推开了那扇吱呀作响的木门。                                   │
│                                                                               │
│    ┃ 情节点②: 追踪踪迹                                                       │
│    ┃                                                                          │
│    林间的空气带着露水的湿润和腐朽落叶的气息。他循着那行                     │
│    脚印前行，心跳声在寂静中格外清晰。                                           │
│                                                                               │
│    [继续阅读...]                                                              │
│                                                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  📊 终审滑动条                                                                 │
│                                                                               │
│  叙事张力: 内敛 ←━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━→ 激烈                         │
│              ○━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━○                            │
│                    ▲                                                          │
│                 当前(62)                                                      │
│                    ●                                                          │
│                 上一轮(45)  ← 幽灵锚点                                         │
│                                                                               │
│  标签建议: [戏剧化▸] [紧张▸] [悬疑▸]                                          │
│                                                                               │
│  [✅ 批准提交]  [📝 提出修订...]  [🔍 谏官审查]  [⚡ Oracle]                   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### 8.3.3 批注功能

```typescript
// ============================================================
// 批注系统
// ============================================================

interface Annotation {
  id: string;
  type: 'revision_request' | 'question' | 'praise' | 'note';
  range: TextRange;           // 批注的文本范围
  text: string;               // 批注内容
  author: 'author' | 'ai';    // 批注者
  timestamp: number;
  resolved: boolean;
  replies: AnnotationReply[];
}

interface TextRange {
  startParagraph: number;
  startOffset: number;
  endParagraph: number;
  endOffset: number;
  selectedText: string;
}

// 批注UI
/**
 * 批注交互流程：
 * 
 * 1. 作者在正文中选中一段文字
 * 2. 弹出浮动工具栏: [批注📝] [修订✏️] [问AI🤖]
 * 3. 选择"批注"后，侧边弹出批注输入框
 * 4. 输入批注内容，确认后：
 *    - 被批注的文本添加下划线和高亮背景
 * *    - 右侧显示批注卡片
 * 5. 批注可以被回复、解决或删除
 */
```

### 8.4 谏官报告页面

#### 8.4.1 布局规格

```
┌─────────────────────────────────────────────────────────────────────┐
│  📜 谏官报告 —— 第3章 · 第12段                                       │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 总体评估:                                                     │    │
│  │                                                              │    │
│  │ 风险等级: 🟠 警告                                            │    │
│  │ 发现 3 个问题，建议关注 2 个                                 │    │
│  │ 整体评价: "段落整体质量良好，但存在角色一致性和时间线问题      │    │
│  │           需要关注。"                                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🔴 严重问题 (1个)                                             │    │
│  │                                                              │    │
│  │ ┌─────────────────────────────────────────────────────────┐ │    │
│  │ │ [一致性] 时间线矛盾                                        │ │    │
│  │ │                                                          │ │    │
│  │ │ 位置: 第3章第12段第7行                                    │ │    │
│  │ │ 问题: "前文第2章第15段明确提到\"X在三年前就已经离开\"，      │ │    │
│  │ │        但本段写\"X yesterday 还在镇上出现\"，两者矛盾。"    │ │    │
│  │ │                                                          │ │    │
│  │ │ 证据: [点击展开原文对比]                                   │ │    │
│  │ │                                                          │ │    │
│  │ │ ┌─────────────────────────────────────────────────────┐  │ │    │
│  │ │ │ 修复策略对比:                                         │  │ │    │
│  │ │ │                                                      │  │ │    │
│  │ │ │ 策略A - 最小改动:                                      │  │ │    │
│  │ │ │ 将"昨天"改为"三年前的一天"，与第2章保持一致             │  │ │    │
│  │ │ │ 影响范围: 仅本段1处                                     │  │ │    │
│  │ │ │ [采用此策略]                                           │  │ │    │
│  │ │ │                                                      │  │ │    │
│  │ │ │ 策略B - 叙事修复:                                      │  │ │    │
│  │ │ │ 增加一个时间魔法/幻觉情节解释这个矛盾                    │  │ │    │
│  │ │ │ 影响范围: 需要新增约200字                               │  │ │    │
│  │ │ │ [采用此策略]                                           │  │ │    │
│  │ │ │                                                      │  │ │    │
│  │ │ │ 策略C - 重写段落:                                      │  │ │    │
│  │ │ │ 完全重写涉及矛盾的段落                                  │  │ │    │
│  │ │ │ 影响范围: 本段整段重写                                  │  │ │    │
│  │ │ │ [采用此策略]                                           │  │ │    │
│  │ │ └─────────────────────────────────────────────────────┘  │ │    │
│  │ └─────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🟡 注意问题 (2个)                                             │    │
│  │ [可折叠列表，类似上面格式]                                     │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🟢 正面发现                                                   │    │
│  │ • 情感弧线设计自然，从好奇到紧张的过渡流畅                     │    │
│  │ • 环境描写细腻，禁忌森林的氛围营造成功                         │    │
│  │ • 对话符合角色性格设定                                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  [✅ 批准并提交]  [📝 选择策略修复]  [⏭️ 忽略谏官，继续提交]        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 8.4.2 风险分级体系

| 等级 | 颜色 | 图标 | 定义 | 处理建议 |
|------|------|------|------|---------|
| **Critical** | 红色 | 🔴 | 严重破坏叙事一致性，读者会明显注意到 | 必须修复才能提交 |
| **Warning** | 橙色 | 🟠 | 影响阅读体验，但可通过后续章节弥补 | 强烈建议修复 |
| **Caution** | 黄色 | 🟡 | 小问题，不影响整体体验 | 可选修复 |
| **Info** | 蓝色 | 🔵 | 风格建议或改进机会 | 参考即可 |

#### 8.4.3 修复策略对比

每个问题提供3种修复策略：

| 策略 | 特点 | 适用场景 |
|------|------|---------|
| **最小改动** | 改动范围最小，保持原有叙事 | 小问题，不想打乱现有结构 |
| **叙事修复** | 通过增加内容来圆回矛盾 | 需要保留矛盾双方的情况 |
| **重写段落** | 完全重写，自由度最高 | 问题严重或作者不满意当前版本 |

---

## 9. WebSocket 消息协议

### 9.1 消息类型定义

```typescript
// ============================================================
// WebSocket 消息协议 —— TypeScript Interfaces
// ============================================================

// ── 基础消息结构 ──
interface WebSocketMessage<T = unknown> {
  id: string;              // 消息唯一ID（用于确认和重排）
  type: string;            // 消息类型
  payload: T;              // 消息载荷
  timestamp: number;       // 发送时间戳
  sequence: number;        // 序列号（用于检测丢包和重排）
}

// ── 客户端 → 服务端 ──

// 作者决策事件
interface AuthorDecisionEvent {
  type: 'author:decision';
  payload: {
    sessionId: string;
    mouState: string;           // 当前MOU状态
    decision: 'CHOOSE' | 'APPROVE' | 'MODIFY' | 'REJECT' | 'REVISE' | 
              'RETRY' | 'GOD_MODE' | 'TRIGGER_REMONSTRATOR' | 'IGNORE_REMONSTRATOR' |
              'CONFIRM_ORACLE' | 'CANCEL_ORACLE';
    data?: {
      possibilityId?: string;
      modifications?: Modification[];
      revisionNotes?: string;
      command?: string;
      reason?: string;
    };
    timestamp: number;
  };
}

// 滑动条交互事件
interface SliderInteractionEvent {
  type: 'author:slider';
  payload: {
    sessionId: string;
    action: 'DRAG' | 'CONFIRM' | 'RESET';
    position?: number;
    timestamp: number;
  };
}

// Oracle请求事件
interface OracleRequestEvent {
  type: 'author:oracle';
  payload: {
    sessionId: string;
    action: 'REQUEST' | 'CONFIRM' | 'CANCEL' | 'APPLY_SEED' | 'DISCARD_SEED';
    seedId?: string;
    timestamp: number;
  };
}

// 控制台模式切换
interface ModeSwitchEvent {
  type: 'author:mode_switch';
  payload: {
    sessionId: string;
    from: 'cockpit' | 'dashboard' | 'hibernation';
    to: 'cockpit' | 'dashboard' | 'hibernation';
    trigger: 'manual' | 'auto' | 'shortcut';
  };
}

// 心跳（客户端主动发送）
interface ClientHeartbeat {
  type: 'client:heartbeat';
  payload: {
    sessionId: string;
    timestamp: number;
    currentState: string;       // 客户端当前显示的状态
    viewport: {                 // 视口信息
      mode: string;
      visibleSection?: string;
    };
  };
}

// ── 服务端 → 客户端 ──

// MOU状态变更推送
interface MouStateChangeEvent {
  type: 'server:state_change';
  payload: {
    sessionId: string;
    previousState: string;
    currentState: string;
    context: Partial<MouContext>;    // 变更后的上下文（增量或全量）
    triggeredBy: 'author_decision' | 'ai_complete' | 'timeout' | 'error' | 'system';
    timestamp: number;
  };
}

// AI生成进度推送
interface GenerationProgressEvent {
  type: 'server:generation_progress';
  payload: {
    sessionId: string;
    phase: 'possibilities' | 'brief' | 'content' | 'revision' | 'remonstrator';
    progress: number;           // 0-100
    currentStep: string;        // 当前步骤描述
    partialResult?: string;     // 流式输出（内容生成时）
    estimatedTimeRemaining?: number;  // 预计剩余时间(ms)
    timestamp: number;
  };
}

// 可能性生成完成
interface PossibilitiesReadyEvent {
  type: 'server:possibilities_ready';
  payload: {
    sessionId: string;
    possibilities: Possibility[];
    generationTimeMs: number;
    modelUsed: string;
    timestamp: number;
  };
}

// Brief生成完成
interface BriefReadyEvent {
  type: 'server:brief_ready';
  payload: {
    sessionId: string;
    brief: Brief;
    generationTimeMs: number;
    timestamp: number;
  };
}

// 内容生成完成（流式传输时，此消息表示结束）
interface ContentReadyEvent {
  type: 'server:content_ready';
  payload: {
    sessionId: string;
    content: string;
    wordCount: number;
    generationTimeMs: number;
    modelUsed: string;
    timestamp: number;
  };
}

// 谏官报告完成
interface RemonstratorReadyEvent {
  type: 'server:remonstrator_ready';
  payload: {
    sessionId: string;
    report: RemonstratorReport;
    reviewTimeMs: number;
    timestamp: number;
  };
}

// Oracle代价计算完成
interface OracleCostReadyEvent {
  type: 'server:oracle_cost_ready';
  payload: {
    sessionId: string;
    cost: OracleCost;
    timestamp: number;
  };
}

// 混沌种子生成完成
interface ChaosSeedsReadyEvent {
  type: 'server:chaos_seeds_ready';
  payload: {
    sessionId: string;
    seeds: ChaosSeed[];
    timestamp: number;
  };
}

// Flow Guardian消息
interface GuardianMessageEvent {
  type: 'server:guardian_message';
  payload: {
    sessionId: string;
    message: string;
    tone: 'gentle' | 'concerned' | 'urgent' | 'celebratory';
    priority: 'low' | 'medium' | 'high';
    suggestedActions?: string[];
    timestamp: number;
  };
}

// 作者超时召回
interface AuthorTimeoutRecallEvent {
  type: 'server:timeout_recall';
  payload: {
    sessionId: string;
    elapsedMs: number;          // 已等待时间
    recallMessage: string;
    recallTier: number;         // 召回级别(1-4)
    timestamp: number;
  };
}

// 系统告警
interface SystemAlertEvent {
  type: 'server:system_alert';
  payload: {
    sessionId: string;
    alert: Alert;
    timestamp: number;
  };
}

// 提交完成确认
interface CommitCompleteEvent {
  type: 'server:commit_complete';
  payload: {
    sessionId: string;
    commitId: string;
    chapterId: string;
    sectionIndex: number;
    wordCount: number;
    totalWordCount: number;
    nextState: 'idle';
    timestamp: number;
  };
}

// 心跳响应（服务端回复）
interface ServerHeartbeatResponse {
  type: 'server:heartbeat_ack';
  payload: {
    sessionId: string;
    clientTimestamp: number;    // 客户端发送的时间戳
    serverTimestamp: number;    // 服务端收到的时间戳
    latency: number;            // 计算出的延迟
    serverState: string;        // 服务端状态
  };
}

// 错误消息
interface ServerErrorEvent {
  type: 'server:error';
  payload: {
    sessionId: string;
    errorCode: string;
    errorMessage: string;
    recoverable: boolean;
    suggestedAction?: string;
    timestamp: number;
  };
}
```

### 9.2 状态推送触发条件

| 事件 | 推送消息类型 | 触发条件 | 推送方式 |
|------|-------------|---------|---------|
| MOU状态变更 | `server:state_change` | 任何状态转换完成后 | 即时推送 |
| AI开始生成 | `server:generation_progress` (progress: 0) | invoke服务启动时 | 即时推送 |
| AI生成中 | `server:generation_progress` | 每完成一个子任务 | 定期推送 |
| 可能性就绪 | `server:possibilities_ready` | generatePossibilitiesService完成 | 即时推送 |
| Brief就绪 | `server:brief_ready` | generateBriefService完成 | 即时推送 |
| 内容流式输出 | `server:generation_progress` (含partialResult) | 内容生成时每100ms或每50字 | 流式推送 |
| 内容完成 | `server:content_ready` | generateContentService完成 | 即时推送 |
| 谏官报告就绪 | `server:remonstrator_ready` | remonstratorReviewService完成 | 即时推送 |
| Oracle代价就绪 | `server:oracle_cost_ready` | calculateOracleCostService完成 | 即时推送 |
| 混沌种子就绪 | `server:chaos_seeds_ready` | generateChaosSeedsService完成 | 即时推送 |
| Flow Guardian消息 | `server:guardian_message` | 需要发送守护消息时 | 即时推送 |
| 作者超时召回 | `server:timeout_recall` | 超时计时器触发时 | 即时推送 |
| 提交完成 | `server:commit_complete` | commitContentService完成 | 即时推送 |
| 系统告警 | `server:system_alert` | 告警触发时 | 即时推送 |
| 客户端心跳确认 | `server:heartbeat_ack` | 收到客户端心跳后 | 即时回复 |

### 9.3 心跳和重连机制

```typescript
// ============================================================
// 心跳与重连机制
// ============================================================

interface HeartbeatConfig {
  // 心跳间隔（根据模式调整）
  interval: {
    cockpit: 10000;       // 驾驶舱: 10秒
    dashboard: 20000;     // 仪表盘: 20秒
    hibernation: 60000;   // 休眠舱: 60秒
  };
  
  // 超时判定
  timeout: {
    missingAck: 30000;    // 30秒未收到ACK视为超时
    maxMissedAcks: 3;     // 连续3次超时触发重连
  };
  
  // 重连策略
  reconnect: {
    maxAttempts: 10;      // 最大重连次数
    baseDelay: 1000;      // 基础延迟1秒
    maxDelay: 30000;      // 最大延迟30秒
    backoffMultiplier: 2; // 指数退避
  };
}

/**
 * 心跳流程
 * 
 * 客户端                                    服务端
 *    │ ──── client:heartbeat ────→ │
 *    │ ←─── server:heartbeat_ack ── │
 *    │                              │
 *    │ [10秒后]                     │
 *    │ ──── client:heartbeat ────→ │
 *    │ ←─── server:heartbeat_ack ── │
 *    │                              │
 *    │ [超时未收到ACK]              │
 *    │ [重试1次]                    │
 *    │ ──── client:heartbeat ────→ │
 *    │ [仍超时]                     │
 *    │ [触发重连]                   │
 *    │ ═══════ 断开连接 ═══════    │
 *    │ ═══════ 重连流程 ═══════    │
 */

/**
 * 重连流程
 */
interface ReconnectFlow {
  // 步骤1: 检测到连接中断
  step1_detect: {
    triggers: ['heartbeat_timeout', 'onclose_event', 'onerror_event'];
    immediateAction: 'update_ui_to_connecting';
  };
  
  // 步骤2: 开始重连
  step2_attempt: {
    strategy: 'exponential_backoff';
    delays: [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000, 30000, 30000];
    uiUpdate: 'show_reconnect_progress';
  };
  
  // 步骤3: 重连成功
  step3_success: {
    action: 'restore_session';
    process: [
      'send_session_restore_request',    // 发送会话恢复请求
      'receive_current_state',           // 接收服务端当前状态
      'sync_ui_to_state',                // 同步UI到当前状态
      'resume_heartbeat'                 // 恢复心跳
    ];
  };
  
  // 步骤4: 重连失败（用尽所有尝试）
  step4_failure: {
    action: 'enter_offline_mode';
    uiUpdate: 'show_offline_notification';
    functionality: 'limited_local_only';
    recoveryAction: 'periodic_reconnect_attempt_every_60s';
  };
}

/**
 * 会话恢复请求
 */
interface SessionRestoreRequest {
  type: 'client:restore_session';
  payload: {
    sessionId: string;
    lastKnownState: string;
    lastKnownSequence: number;    // 最后收到的消息序列号
    localCacheChecksum: string;   // 本地缓存校验和
  };
}

/**
 * 会话恢复响应
 */
interface SessionRestoreResponse {
  type: 'server:session_restored';
  payload: {
    sessionId: string;
    currentState: string;
    currentContext: MouContext;
    missedMessages: WebSocketMessage[];  // 重连期间错过的消息
    serverTimestamp: number;
  };
}
```

---

## 10. 本地化存储策略

### 10.1 数据分层

```
NarrativeOS 数据分层
├── 会话层 (Session Storage) —— 页面刷新即清除
│   ├── 当前WebSocket会话ID
│   ├── 当前MOU状态机快照
│   └── 未发送的待处理事件队列
│
├── 本地缓存层 (IndexedDB) —— 长期存储
│   ├── 章节内容缓存 (chapter_content)
│   ├── Brief历史 (brief_history)
│   ├── 可能性缓存 (possibilities_cache)
│   ├── 谏官报告历史 (remonstrator_history)
│   ├── 作者偏好设置 (author_preferences)
│   ├── 滑动条历史 (slider_history)
│   ├── 幽灵锚点 (ghost_anchors)
│   └── 离线操作队列 (offline_queue)
│
├── 本地状态层 (localStorage) —— 键值对，轻量
│   ├── 作者认证令牌
│   ├── 最后活跃时间戳
│   ├── 控制台模式偏好
│   ├── 主题设置
│   └── 首次使用标记
│
└── 云端同步层 (REST API / WebSocket)
    ├── 官方正文章节内容
    ├── 完整Brief历史
    ├── 谏官报告存档
    ├── 全局叙事状态
    └── 作者配置
```

### 10.2 IndexedDB Schema

```typescript
// ============================================================
// IndexedDB Schema —— 完整定义
// ============================================================

const DB_NAME = 'NarrativeOS_Local';
const DB_VERSION = 3;

interface NarrativeOSDB extends DBSchema {
  // ── 章节内容缓存 ──
  chapter_content: {
    key: string;              // `${novelId}_${chapterId}_${sectionIndex}`
    value: {
      novelId: string;
      chapterId: string;
      sectionIndex: number;
      content: string;
      brief: Brief | null;
      remonstratorReport: RemonstratorReport | null;
      committed: boolean;     // 是否已提交到云端
      committedAt: number | null;
      lastModified: number;
      checksum: string;       // 内容校验和
    };
    indexes: {
      by_novel: string;       // novelId
      by_chapter: string;     // chapterId
      by_commit_status: string; // 'committed' | 'uncommitted'
      by_last_modified: number;
    };
  };
  
  // ── Brief历史 ──
  brief_history: {
    key: string;              // brief.id
    value: {
      id: string;
      novelId: string;
      chapterId: string;
      sectionIndex: number;
      brief: Brief;
      selectedPossibilityId: string;
      createdAt: number;
      approved: boolean;
      modifications?: Modification[];
    };
    indexes: {
      by_novel_chapter: string; // `${novelId}_${chapterId}`
      by_created: number;
    };
  };
  
  // ── 可能性缓存 ──
  possibilities_cache: {
    key: string;              // cacheId
    value: {
      cacheId: string;
      novelId: string;
      chapterId: string;
      sectionIndex: number;
      phase: string;
      possibilities: Possibility[];
      generatedAt: number;
      expiresAt: number;      // 过期时间
      usedCount: number;      // 被使用次数
    };
    indexes: {
      by_location: string;    // `${novelId}_${chapterId}_${sectionIndex}`
      by_expires: number;
    };
  };
  
  // ── 谏官报告历史 ──
  remonstrator_history: {
    key: string;              // report.id
    value: {
      id: string;
      novelId: string;
      chapterId: string;
      sectionIndex: number;
      report: RemonstratorReport;
      generatedAt: number;
      authorVerdict: 'approved' | 'modified' | 'ignored' | null;
    };
    indexes: {
      by_novel_chapter: string;
      by_severity: string;
    };
  };
  
  // ── 作者偏好 ──
  author_preferences: {
    key: string;              // preference key
    value: {
      key: string;
      value: unknown;
      updatedAt: number;
    };
  };
  
  // ── 滑动条历史 ──
  slider_history: {
    key: string;              // `${novelId}_${chapterId}_${sectionIndex}`
    value: {
      location: string;
      position: number;
      confirmed: boolean;
      timestamp: number;
    };
    indexes: {
      by_timestamp: number;
    };
  };
  
  // ── 离线操作队列 ──
  offline_queue: {
    key: number;              // 自增ID
    value: {
      id: number;
      operation: 'author_decision' | 'brief_modify' | 'annotation_create' | 'setting_change';
      payload: unknown;
      createdAt: number;
      retryCount: number;
      lastRetryAt: number | null;
    };
    indexes: {
      by_created: number;
      by_retry: number;
    };
  };
}
```

### 10.3 离线编辑支持范围

| 功能 | 在线状态 | 离线状态 | 恢复行为 |
|------|---------|---------|---------|
| **阅读已有内容** | ✅ 完整 | ✅ 从缓存读取 | 自动 |
| **滑动条交互** | ✅ 完整 | ✅ 本地保存 | 重连后同步 |
| **批注创建** | ✅ 完整 | ✅ 本地队列 | 重连后批量同步 |
| **可能性选择(CHOOSE)** | ✅ 完整 | ❌ 不可操作 | — |
| **Brief审批(APPROVE/MODIFY/REJECT)** | ✅ 完整 | ⚠️ 仅APPROVE可本地缓存 | 重连后验证 |
| **终审操作(APPROVE/REVISE)** | ✅ 完整 | ⚠️ 仅REVISE意见可缓存 | 重连后执行 |
| **Oracle请求** | ✅ 完整 | ❌ 不可操作 | — |
| **谏官触发** | ✅ 完整 | ❌ 不可操作 | — |
| **内容生成** | ✅ 完整 | ❌ 不可操作 | — |
| **设置修改** | ✅ 完整 | ✅ 本地保存 | 重连后同步 |

### 10.4 数据同步冲突解决

```typescript
// ============================================================
// 数据同步冲突解决策略
// ============================================================

/**
 * 冲突检测
 */
interface SyncConflict {
  type: 'concurrent_edit' | 'server_overwrite' | 'local_stale';
  entity: string;           // 冲突实体类型
  entityId: string;         // 实体ID
  localVersion: {
    data: unknown;
    timestamp: number;
    checksum: string;
  };
  serverVersion: {
    data: unknown;
    timestamp: number;
    checksum: string;
  };
}

/**
 * 冲突解决策略
 */
const CONFLICT_RESOLUTION_STRATEGIES: Record<string, ConflictStrategy> = {
  // 策略1: 作者决策事件 —— 严格时间优先
  author_decision: {
    strategy: 'timestamp_wins',
    description: '以时间戳最新的为准。如果服务端版本更新，说明作者在其他设备上操作了，以服务端为准。',
    fallback: 'manual_resolve'
  },
  
  // 策略2: 章节内容 —— 三路合并
  chapter_content: {
    strategy: 'three_way_merge',
    description: '使用三路合并算法，标记冲突位置供作者手动解决。',
    fallback: 'manual_resolve'
  },
  
  // 策略3: 批注 —— 合并
  annotation: {
    strategy: 'merge_collections',
    description: '批注是追加式的，合并双方的批注集合。',
    fallback: null  // 追加式无冲突
  },
  
  // 策略4: 设置 —— 按字段时间戳
  setting: {
    strategy: 'field_level_timestamp',
    description: '按字段级别的时间戳决定，每个设置项独立判断。',
    fallback: 'manual_resolve'
  }
};

/**
 * 冲突解决UI
 */
interface ConflictResolutionUI {
  // 冲突提示面板
  panel: {
    title: '数据同步冲突';
    description: '检测到本地数据与服务端数据存在冲突，请选择保留哪个版本。';
    sections: [
      {
        name: '本地版本';
        timestamp: number;
        preview: string;    // 内容预览
        action: 'keep_local';
      },
      {
        name: '服务端版本';
        timestamp: number;
        preview: string;
        action: 'keep_server';
      },
      {
        name: '差异对比';
        diffView: boolean;  // 显示diff视图
      }
    ];
    actions: [
      { label: '使用本地版本', type: 'primary' },
      { label: '使用服务端版本', type: 'primary' },
      { label: '手动合并', type: 'secondary' },
      { label: '查看差异', type: 'text' }
    ];
  };
}

/**
 * 自动同步流程
 */
interface AutoSyncFlow {
  // 触发条件
  triggers: {
    on_reconnect: 'immediate_full_sync';     // 重连后即时全量同步
    periodic: 'every_5_minutes_when_online'; // 在线时每5分钟
    on_state_change: 'sync_context';         // MOU状态变更时
    on_author_action: 'sync_decision';       // 作者决策时
  };
  
  // 同步优先级
  priority: [
    'author_decisions',       // 作者决策（最高优先级）
    'chapter_content',        // 章节内容
    'brief_history',          // Brief历史
    'annotations',            // 批注
    'slider_states',          // 滑动条状态
    'preferences',            // 偏好设置
    'possibilities_cache',    // 可能性缓存（最低优先级）
  ];
  
  // 批处理
  batching: {
    maxBatchSize: 10;         // 每批最多10个操作
    maxWaitMs: 500;           // 最多等待500ms聚合成批
  };
}
```

### 10.5 缓存清理策略

```typescript
// ============================================================
// 缓存清理策略
// ============================================================

interface CacheCleanupPolicy {
  // 可能性缓存
  possibilitiesCache: {
    maxAge: 86400000;         // 24小时过期
    maxEntries: 50;           // 最多保留50条
    evictionPolicy: 'LRU';    // 最近最少使用
  };
  
  // 谏官报告
  remonstratorHistory: {
    maxAge: 2592000000;       // 30天过期
    maxEntries: 200;          // 最多200条
    keepApproved: true;       // 已批准的永久保留
  };
  
  // 章节内容（已提交到云端的可清理）
  chapterContent: {
    keepCommitted: false;     // 已提交的可清理（云端有权威副本）
    keepUncommitted: true;    // 未提交的永久保留
    maxUncommittedAge: Infinity; // 未提交的永不过期
  };
  
  // Brief历史
  briefHistory: {
    maxAge: 604800000;        // 7天过期
    keepApproved: true;       // 已批准的保留30天
  };
  
  // 滑动条历史
  sliderHistory: {
    maxAge: 604800000;        // 7天过期
    maxEntries: 500;
  };
  
  // 离线队列
  offlineQueue: {
    maxRetries: 10;           // 最大重试10次
    maxAge: 604800000;        // 7天后丢弃
    retryInterval: 30000;     // 每30秒重试一次
  };
}
```

---

## 11. 附录

### 11.1 状态机可视化参考

```
完整MOU状态转换图

                    ┌─────────────────────────────────────────────────────────┐
                    │                                                         │
  ┌──────────────┐  │  ┌──────────────────┐    CHOOSE     ┌──────────────┐   │
  │    idle      │◄─┘  │generating_       │──────────────►│ generating_  │   │
  │  (就绪态)     │     │ possibilities    │               │   brief      │   │
  └──────┬───────┘     └──────────────────┘               └──────┬───────┘   │
         │                          ▲                    MODIFY   │           │
         │     ┌────────────────────┘                           ▼           │
         │     │ RETRY                               ┌──────────────┐      │
         │     │ (最多3次)                           │waiting_brief_ │      │
         │     │                                     │  approval    │      │
         │     │                                     └──────┬───────┘      │
         │     │                               APPROVE/REJECT│             │
         │     │                                     │        │             │
         │     │            ┌────────────────────────┘        │             │
         │     │            ▼                                 ▼             │
         │     │   ┌──────────────────┐           ┌──────────────────┐      │
         │     └───┤ waiting_author_  │           │ generating_      │      │
         │         │    choice        │           │   content        │      │
         │         │  (严格阻塞)       │           └──────┬───────────┘      │
         │         └──────┬───────────┘                  │                  │
         │                │ GOD_MODE                     │                  │
         │                ▼                              ▼                  │
         │    ┌──────────────────┐           ┌──────────────────┐          │
         │    │ oracle_flow      │           │waiting_final_    │          │
         │    │  (子状态机)       │◄──────────│   review         │          │
         │    └──────────────────┘  REQUEST   │  (严格阻塞)       │          │
         │              │            _ORACLE  └──────┬───────────┘          │
         │              │                            │                      │
         │              └────────────────────────────┤                      │
         │                              TRIGGER      │  APPROVE             │
         │                              _REMONSTRATOR│                      │
         │                                           ▼                      │
         │                              ┌──────────────────┐               │
         │                              │remonstrator_     │               │
         │                              │   intervention   │               │
         │                              └──────┬───────────┘               │
         │                                     │                           │
         │                                     ▼                           │
         │                              ┌──────────────────┐              │
         │                              │waiting_author_   │              │
         │                              │   verdict        │──────────────┘
         │                              │  (严格阻塞)       │   APPROVE
         │                              └──────┬───────────┘   IGNORE
         │                                     │
         │                                     ▼ APPROVE
         │                              ┌──────────────────┐
         └──────────────────────────────┤    committing    │
                                        │   (提交中)       │
                                        └──────────────────┘
```

### 11.2 事件总览表

| 事件类型 | 发送方向 | 触发状态 | 目标状态 | 阻塞性 | 备注 |
|---------|---------|---------|---------|--------|------|
| `CHOOSE` | C→S | waiting_author_choice | generating_brief | 人类决策 | 需valid possibilityId |
| `GOD_MODE` | C→S | 多个waiting状态 | generating_content | 人类决策 | 最高优先级 |
| `RETRY` | C→S | waiting_author_choice | generating_possibilities | 人类决策 | 最多3次 |
| `APPROVE` | C→S | waiting_brief_approval | generating_content | 人类决策 | — |
| `APPROVE` | C→S | waiting_final_review | remonstrator_gate | 人类决策 | 需slider confirmed |
| `APPROVE` | C→S | waiting_author_verdict | committing | 人类决策 | — |
| `MODIFY` | C→S | waiting_brief_approval | generating_brief | 人类决策 | 需valid modifications |
| `REJECT` | C→S | waiting_brief_approval | generating_possibilities | 人类决策 | 记录原因 |
| `REVISE` | C→S | waiting_final_review | revising_content | 人类决策 | 最多5次 |
| `TRIGGER_REMONSTRATOR` | C→S | waiting_final_review | remonstrator_intervention | 人类决策 | 手动触发 |
| `IGNORE_REMONSTRATOR` | C→S | waiting_author_verdict | committing | 人类决策 | 强制提交 |
| `CONFIRM_ORACLE` | C→S | waiting_oracle_confirmation | chaos_seed_generation | 人类决策 | 承受代价 |
| `CANCEL_ORACLE` | C→S | waiting_oracle_confirmation | (返回父状态) | 人类决策 | 取消 |
| `SLIDER_DRAG` | C→S | waiting_final_review | — | 即时响应 | 仅更新UI |
| `SLIDER_CONFIRM` | C→S | waiting_final_review | — | 即时响应 | 标记confirmed |
| `AUTHOR_TIMEOUT` | S→C | 任意waiting状态 | — | 系统触发 | 不引起状态转换 |

> **图例**: C=Client(客户端), S=Server(服务端), C→S=客户端发送, S→C=服务端推送

### 11.3 配置文件模板

```json
{
  "mou": {
    "maxRetries": 3,
    "maxRevises": 5,
    "maxLLMFailures": 3,
    "authorTimeoutMs": 300000,
    "oracleCooldownMs": 1800000,
    "deadlockCheckIntervalMs": 10000,
    "flowGuardianEnabled": true,
    "remonstratorEnabled": true,
    "metarecursionEnabled": true
  },
  "llm": {
    "primaryModel": "gpt-4o",
    "degradedModel": "gpt-4o-mini",
    "maxTokens": 4096,
    "temperature": {
      "possibilities": 0.8,
      "brief": 0.6,
      "content": 0.7,
      "revision": 0.5,
      "remonstrator": 0.3
    },
    "timeoutMs": 30000,
    "retryConfig": {
      "maxAttempts": 3,
      "baseDelayMs": 1000,
      "backoffMultiplier": 2,
      "maxDelayMs": 30000
    }
  },
  "websocket": {
    "heartbeatIntervalMs": 10000,
    "heartbeatTimeoutMs": 30000,
    "maxMissedAcks": 3,
    "reconnectMaxAttempts": 10,
    "reconnectBaseDelayMs": 1000,
    "reconnectMaxDelayMs": 30000
  },
  "flowGuardian": {
    "enabled": true,
    "recallTiers": [
      { "atPercentage": 50, "action": "gentle_nudge" },
      { "atPercentage": 80, "action": "explicit_prompt" },
      { "atPercentage": 100, "action": "flow_guardian_message" },
      { "atPercentage": 120, "action": "sound_notification" }
    ],
    "messageStyle": "gentle",
    "suggestedActionsEnabled": true
  },
  "remonstrator": {
    "enabled": true,
    "autoTriggerOnApprove": false,
    "reviewDimensions": ["consistency", "character", "pacing", "lore"],
    "minSeverityToReport": "info"
  },
  "ui": {
    "ritualReadingFontSize": 18,
    "ritualReadingLineHeight": 1.8,
    "ritualReadingMaxWidth": 720,
    "showGhostAnchors": true,
    "soundEffects": true,
    "ambientSound": false,
    "theme": "paper"
  }
}
```

### 11.4 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| v3.0.0-RC1 | 2024-01-15 | 初始完整MOU设计文档定稿 |

---

> **文档结束**
>
> NarrativeOS v3.0 Sovereign —— 让百万字长篇创作如呼吸般自然。
