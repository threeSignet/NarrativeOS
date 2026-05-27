# 事件驱动 vs 前端驱动：本项目的架构路径选择

> 创建日期：2026-05-24
> 基于：后端孵化阶段深度审计（2026-05-24）
> 范围：NarrativeOSPlus 整个系统的流程编排策略

---

## 一、两种架构模式

### 前端驱动型（当前架构）

```
用户操作 → 前端调用 API → 后端处理 → SSE/WS 返回结果 → 前端决定下一步
                                                    ↑
                                    事件总线是"旁路广播"，不影响主流程
```

**特征：**
- 流程编排逻辑在前端
- 后端提供原子化的 API 端点
- 前端知道"下一步该做什么"
- 事件总线只做通知，不做流程推进

### 事件驱动型

```
用户操作 → 前端调用 API → 后端发射事件 → 事件链自动推进流程
                                         ├─ 监听器A：自动运行下一个引擎
                                         ├─ 监听器B：推送通知
                                         ├─ 监听器C：写入审计日志
                                         └─ 监听器D：更新仪表盘
                    前端订阅事件流，被动更新 UI
```

**特征：**
- 流程编排逻辑在后端事件链
- 前端退化为"订阅者 + 渲染器"
- 事件是可重放的（replayable）
- 系统可以在无人值守时自行推进

---

## 二、本项目为什么不能用纯事件驱动

### 硬约束：孵化阶段有"人类审批节点"

每个世界引擎产出 2-3 个世界观方案后，**必须等人来选择一个**。这是创意写作的本质要求——AI 不能替作者决定故事的世界观基调、势力分布、角色体系。

```
事件链的理想状态:
  tone完成 ──→ geography完成 ──→ power-system完成 ──→ faction完成 ──→ ...

事件链的现实:
  tone完成 ──→ [人类必须选择] ──→ geography完成 ──→ [人类必须选择] ──→ ...
                    ↑
              这个节点事件链无法自动跨越
```

纯事件驱动在遇到"硬同步点"时会断裂。你需要一个状态机等在那里，直到人类决策进来，这本质上又回到了前端驱动——因为决策入口在前端。

### 用户体验的考量

创意工具的用户需要**可控感**。如果用户点击"批准"后系统自动跑了一串引擎、生成了一大堆内容，用户会感到失控。每个人都需要看到每个引擎的结果，理解它，然后决定：

- **批准**：这个方案好，采纳
- **修订**：方向对但细节不行，让 AI 重新出
- **拒绝**：完全不行，可能选择另一个方案

这三个决策是创意流程的核心，不能被自动化掉。

### 调试和可观测性

事件驱动的故障排查困难：
- "为什么 faction 引擎没有运行？" → 需要追踪完整事件链，看哪个监听器没触发
- 前端驱动："因为前端没调用 `POST /scheduler/:projectId/run`" → 直接看网络日志

---

## 三、混合型架构：本项目的最佳路径

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         前端                                │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ 项目仪表盘│  │ 提案审批卡│  │ 世界观浏览│  │ 大纲编辑器 │ │
│  └─────┬─────┘  └─────┬────┘  └─────┬────┘  └──────┬─────┘ │
│        │              │             │              │        │
│        │    SSE 流式   │   HTTP API  │  WebSocket   │        │
│        │    (实时LLM)  │   (决策)    │  (事件推送)  │        │
└────────┼──────────────┼─────────────┼──────────────┼────────┘
         │              │             │              │
         ▼              ▼             ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                         后端                                │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    主流程（前端驱动）                  │  │
│  │                                                      │  │
│  │  POST /hatch  →  POST /approve  →  POST /scheduler/run  │
│  │      │                │                    │          │  │
│  │      ▼                ▼                    ▼          │  │
│  │  Engine.run()    Handler.execute()   getRunnableEngines│  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                   │
│                         │ emit                              │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  事件总线（副作用协调层）              │  │
│  │                                                      │  │
│  │  proposal.approved ──→ 推送通知                      │  │
│  │  proposal.revised  ──→ 推送通知                      │  │
│  │  proposal.rejected ──→ 推送通知                      │  │
│  │  project.activated ──→ 调度器转发 + WebSocket        │  │
│  │  chapter.committed ──→ 触发 proactive 引擎           │  │
│  │  setting.items_created ──→ 未来：缓存失效            │  │
│  │  engine.completed   ──→ 未来：仪表盘更新             │  │
│  │  outline.generated  ──→ 未来：自动推进大纲流水线     │  │
│  │  ...                ──→ 未来：审计日志/webhook/告警  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 核心原则

```
主流程（前端驱动）     ← 需要人类决策的流程 →  前端显式调用 API
副作用（事件驱动）     ← 不需人类决策的事   →  事件监听器自动处理
```

| 什么归前端驱动 | 什么归事件驱动 |
|---|---|
| 运行引擎 | 推送通知 |
| 批准/拒绝/修订提案 | 更新仪表盘缓存 |
| 推进到下一个引擎 | 触发主动引擎（memory/censor） |
| 提交章节 | 跨引擎引用复验 |
| 手动创建设定项 | 写入审计日志 |
| | 发送 external webhook |

---

## 四、事件总线消费计划

### 当前状态（已有消费者）

| 事件 | 消费者 | 动作 |
|---|---|---|
| `project.activated` | Scheduler | 转发为调度器事件 → WebSocket 推送 |
| `chapter.committed` | Scheduler | 触发 proactive 引擎（memory-extractor, censor-checker） |

### 短期计划（有明确场景时实现）

| 事件 | 消费者 | 动作 | 触发条件 |
|---|---|---|---|
| `proposal.approved` | 通知服务 | 推送"提案已采纳"通知 | 有人需要知道审批结果 |
| `proposal.revised` | 通知服务 | 推送"提案需修改"通知 | 同上 |
| `proposal.rejected` | 通知服务 | 推送"提案已拒绝"通知 | 同上 |
| `setting.items_created` | 缓存失效器 | 标记 world_bible 缓存过期 | 设定项更新时 |
| `engine.started` | 仪表盘服务 | WebSocket 推送引擎运行状态 | 前端显示"运行中" |
| `engine.completed` | 仪表盘服务 | WebSocket 推送引擎完成状态 | 前端更新进度条 |
| `engine.error` | 告警服务 | 记录错误 + 可选告警 | 引擎失败时 |

> **注意：** 通知目前内联在 `orchestrator` 中（`pushNotification` 直接调用）。重构为事件驱动是可选的改进——移除 `orchestrator` 对通知的直接依赖，改为 `bus.emit` + 独立通知监听器。这符合"一个模块只做一件事"的原则。

### 长期计划（产品成熟后）

| 事件 | 消费者 | 动作 |
|---|---|---|
| `outline.generated` | 大纲流水线 | 自动推进到 volume-outline |
| `volume.created` | 大纲流水线 | 自动推进到 chapter-outline |
| `chapter.created` | 写作统计 | 更新项目进度统计 |
| `proposal.*` | 审计日志 | 写入不可篡改的决策日志（合规/追溯） |
| `engine.*` | 分析服务 | 统计引擎成功率、平均耗时、模型消耗 |
| `notification.created` | Webhook | 转发到 Discord/Slack/企业微信 |
| `setting.updated` | 搜索索引 | 更新全文搜索索引 |
| `setting.deleted` | 关联清理 | 自动处理孤儿引用 |

---

## 五、当前事件总线全景

### 已定义的 16 种领域事件

| 事件 | 发射者 | 发射位置 | 已消费？ |
|---|---|---|---|
| `proposals.staged` | Orchestrator | `stageProposals()` | 否 |
| `proposal.approved` | Orchestrator | `approveProposal()` | 否 |
| `proposal.revised` | Orchestrator | `reviseProposal()` | 否 |
| `proposal.rejected` | Orchestrator | `rejectProposal()` | 否 |
| `project.activated` | Orchestrator | `maybeLockProject()` | ✅ Scheduler |
| `chapter.committed` | hatch 路由 | `POST /chapters/:id/commit` | ✅ Scheduler |
| `setting.updated` | SettingItemHandler | `execute()` | 否 |
| `setting.items_created` | SettingItemHandler | `executeMultiItem()` | 否 |
| `setting.deleted` | SettingItemHandler | `execute()` | 否 |
| `engine.started` | EngineScheduler | `runSingleEngine()` | 否 |
| `engine.completed` | EngineScheduler | `runSingleEngine()` | 否 |
| `engine.error` | EngineScheduler | `runSingleEngine()` | 否 |
| `outline.generated` | OutlineHandler | `execute()` | 否 |
| `volume.created` | OutlineHandler | `execute()` | 否 |
| `chapter.created` | OutlineHandler | `execute()` | 否 |
| `notification.created` | 通知系统 | 通知写入后 | 否 |

### 事件数据结构

```typescript
// 事件总线定义（packages/pipeline/src/event-bus.ts）
interface DomainEventMap {
  "proposals.staged":     { type, projectId, proposalIds: string[], sourceNode }
  "proposal.approved":    { type, projectId, proposalId, proposalType, sourceNode? }
  "proposal.revised":     { type, projectId, proposalId, notes }
  "proposal.rejected":    { type, projectId, proposalId }
  "project.activated":    { type, projectId }
  "chapter.committed":    { type, projectId, chapterId }
  "setting.updated":      { type, projectId, settingItemId }
  "setting.items_created":{ type, projectId, proposalId, itemIds[], relationIds[] }
  "setting.deleted":      { type, projectId, settingItemId }
  "engine.started":       { type, projectId, engineName }
  "engine.completed":     { type, projectId, engineName, proposalCount }
  "engine.error":         { type, projectId, engineName, error }
  "outline.generated":    { type, projectId, proposalId, outlineId? }
  "volume.created":       { type, projectId, volumeId, volumeNumber }
  "chapter.created":      { type, projectId, chapterId, chapterNumber }
  "notification.created": { type, projectId, notificationId, priority, category }
}
```

---

## 六、WebSocket 总线（wsBus）

事件总线（`bus`）和 WebSocket 总线（`wsBus`）是**两层独立的推送通道**：

| | 事件总线（bus） | WebSocket 总线（wsBus） |
|---|---|---|
| 作用域 | 后端内部 | 后端 → 前端 |
| 存储 | 内存（Map） | 内存（连接池） |
| 持久化 | 无 | 无 |
| 消费者 | 后端代码 | 前端浏览器 |
| 协议 | 函数调用 | WebSocket |
| 重放 | 不支持 | 不支持 |

当前 wsBus 推送的事件类型（24 种）：`new_proposals`、`proposals_staged`、`proposal_status_changed`、`engine_started`、`engine_completed`、`engine_error`、`error`、`project_activated`、`chapter_committed`、`setting_updated`、`setting_items_created`、`outline_generated`、`volume_created`、`chapter_created`、`notification`、`proactive_triggered`、`ping`、`pong`

---

## 七、不推荐的做法

### 不要做的事：让事件总线驱动主流程

```typescript
// ❌ 危险：事件链自动推进引擎
bus.on("engine.completed", async (event) => {
  // 自动运行下一个引擎 —— 绕过了用户的审批！
  await scheduler.runMissingEngines(event.projectId);
});
```

如果这样做：
- 用户还没看到当前引擎的产出，下一个引擎已经跑起来了
- 2-3 个方案还没被选择，引擎依赖已经变了
- 用户失去对孵化节奏的掌控

### 不要做的事：用事件总线替代 API 返回值

```typescript
// ❌ 错误：前端靠事件拿结果
// 前端调用 POST /approve（fire-and-forget）
// 然后等 WebSocket 推送 "proposal.approved" 才知道结果
```

这样做会导致：
- 前端无法处理 HTTP 错误（404、500 等）
- 请求-响应模型被破坏
- 调试极其困难（"到底是没批准还是事件丢了？"）

---

## 八、何时从"计划"升级为"实现"

每个事件消费者的实现门槛：

```
有真实使用场景 + 事件数据完备 + 不破坏主流程 = 可以加消费者
```

具体判断：
- ✅ **通知去内联化**：当通知逻辑变复杂时（多渠道、频率限制、用户偏好），从 orchestrator 中抽出来
- ✅ **仪表盘**：当前端需要"引擎运行状态"实时显示时
- ✅ **告警**：当引擎错误需要人工介入时
- ❌ **自动推进引擎**：永远不要（原因见第七条）
- ❌ **自动处理提案**：永远不要（AI 不能替作者做创意决策）

---

## 九、服务重启与状态恢复

当前行为：
- 服务重启 → 内存状态清空（running Map、事件监听器、wsBus 连接）
- 数据库状态完整保留
- 前端重新调用 API 后，`runMissingEngines` 从数据库读取状态继续

不需要增加"事件重放"或"状态恢复"——孵化流程的进度在数据库中（projects.status、proposals.status、settingItems），不在内存中。

---

## 十、总结

| 决策 | 结论 |
|---|---|
| 架构模式 | **混合型**：前端驱动主流程 + 事件总线驱动副作用 |
| 为什么不用纯事件驱动 | 人类审批节点是硬同步点，事件链无法自动跨越 |
| 事件总线的定位 | 副作用协调层（通知、缓存、告警、统计），不是流程引擎 |
| 何时扩展消费者 | 等真实场景触发，不预加 |
| 服务重启后的行为 | 保持现状，数据库状态足以支持断点续跑 |
| 13 个未消费事件 | 骨架正确，留作未来基础设施 |
