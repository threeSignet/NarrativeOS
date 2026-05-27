# NarrativeOS 项目创建到孵化全流程梳理文档

> 梳理范围：项目创建 → 孵化完成（世界引擎 + 工作室引擎）
> 梳理粒度：全细节（前端交互、API 契约、调度逻辑、数据变更、状态转换）
> 梳理日期：2026-05-27

---

## 目录

1. [项目创建与初始化](#1-项目创建与初始化)
2. [孵化入口：ProjectEditor 加载与数据初始化](#2-孵化入口projecteditor-加载与数据初始化)
3. [引擎推进：/advance 端到端流程](#3-引擎推进advance-端到端流程)
4. [MOU 审批流程](#4-mou-审批流程)
5. [设定入库与 Handler 执行](#5-设定入库与-handler-执行)
6. [细化（Refinement）流程](#6-细化refinement流程)
7. [阶段确认与世界完成](#7-阶段确认与世界完成)
8. [工作室阶段（Studio Engines）](#8-工作室阶段studio-engines)
9. [端到端状态机总结](#9-端到端状态机总结)
10. [代码审计发现](#10-代码审计发现)

---

## 1. 项目创建与初始化

### 1.1 前端：项目创建表单

**入口页面**：`apps/web/src/pages/CreateProject.tsx`（假设存在，基于 projects store 推断）

**表单字段**（基于 `apps/server/src/routes/projects.ts` POST / 端点）：

| 字段 | 必填 | 说明 |
|------|------|------|
| title | 是 | 作品标题 |
| genre | 是 | 题材类型（如仙侠、都市、科幻） |
| style | 否 | 写作风格 |
| target_words | 否 | 目标字数 |
| core_creativity | 否 | 核心创意 |
| novel_type | 否 | 细分类型 |
| synopsis | 否 | 简介 |
| tags | 否 | 标签（JSON 数组） |
| target_audience | 否 | 目标读者 |

**前端 Store**：`useProjectStore`（`apps/web/src/stores/projects.ts`）
- `createProject(body)` → POST `/api/projects` → 成功后 `navigate(/project/${id})`

### 1.2 后端：项目创建 API

**端点**：`POST /projects`
**文件**：`apps/server/src/routes/projects.ts:17-72`

```
请求体 → projects INSERT → 返回完整项目对象
```

**数据库写入**：
- `projects` 表：插入新记录，status 默认为 `"hatching"`
- 注意：**不自动创建** `project_settings` 记录（首次进入 ProjectEditor 时 lazy 创建，见 hatch.ts /settings/:id GET）

**关键字段默认值**（来自 schema.ts）：
```
status: "hatching"
totalWords: 0
totalChapters: 0
totalVolumes: 0
version: 1
targetDailyWords: 2000
targetChapterWords: 3000
```

### 1.3 创建后导航

前端路由跳转：`/project/:id` → 渲染 `ProjectEditor`

---

## 2. 孵化入口：ProjectEditor 加载与数据初始化

### 2.1 页面挂载时的数据瀑布

**文件**：`apps/web/src/pages/ProjectEditor.tsx:60-70`

```tsx
useEffect(() => {
  if (!id || !project) return
  fetchProposals(project.id)   // GET /hatch/:id/proposals
  fetchSettings(project.id)    // GET /settings/:id
  fetchEngines(project.id)     // GET /hatch/:id/engines
}, [id, project])
```

**三个并行的数据请求**：

| 请求 | 端点 | Store Action | 用途 |
|------|------|-------------|------|
| fetchProposals | GET /hatch/:id/proposals | `useHatchStore.fetchProposals` | 加载所有提案（pending/approved/rejected） |
| fetchSettings | GET /settings/:id | `useHatchStore.fetchSettings` | 加载已确认设定 + 关系网络 |
| fetchEngines | GET /hatch/:id/engines | `useHatchStore.fetchEngines` | 加载引擎状态（哪些有数据、哪些 pending） |

### 2.2 WebSocket 连接

**文件**：`apps/web/src/pages/ProjectEditor.tsx:78-82`, `apps/web/src/stores/realtime.ts`

```tsx
useEffect(() => {
  if (!id) return
  realtimeConnect(id)          // 连接到 ws://host:3001/ws/:projectId
  return () => { realtimeDisconnect() }
}, [id])
```

**WS 重连策略**：3 秒间隔自动重连（`realtime.ts:72-76`）

**WS 事件订阅**（`ProjectEditor.tsx:84-117`）：
- `new_proposals` → 刷新 proposals + engines（streaming 期间忽略）
- `engine_started` → 更新 currentEngine
- `engine_chunk/model/usage/done/error` → 转发给 hatch store
- `phase_changed` → 转发给 hatch store

### 2.3 后端：引擎状态查询

**端点**：`GET /hatch/:id/engines`
**文件**：`apps/server/src/routes/hatch.ts:342-347`

返回每个引擎的以下信息：
- `hasData`：是否有 confirmed 的 setting_items
- `itemCount`：confirmed 条目数量
- `hasPending`：是否有 pending 提案
- `dependsOn`：依赖引擎列表

**实现**：`apps/server/src/services/hatch-service.ts` 中的 `queryEngineStates`
- 查询 `settingItems` 按 `engineSource` 聚合
- 查询 `aiProposals` 按 `sourceNode` 和 `status` 聚合
- 结合 `ENGINE_REGISTRY` 依赖图组装响应

### 2.4 前端状态初始化

**初始状态**（`useHatchStore`）：
```
phase: 'idle'
hatchGroup: 'world'
proposals: []
settingItems: []
engines: []
streamText: ''
currentEngine: null
```

**渲染分支**（`ProjectEditor.tsx:285-312`）：
- `isHatching || phase === 'streaming' || phase === 'waiting'` → 显示 `HatchingView`
- 否则显示 `ActiveView`（写作界面）

---

## 3. 引擎推进：/advance 端到端流程

### 3.1 前端：用户点击"开始孵化"

**触发点**：`HatchingView` 中的按钮 → `onStart()` → `startHatching(project.id)`

**文件**：`apps/web/src/stores/hatch.ts:755-758`

```ts
startHatching: async (projectId) => {
  await get().advanceHatching(projectId)
}
```

### 3.2 前端：advanceHatching → SSE 连接

**文件**：`apps/web/src/stores/hatch.ts:735-753`

```ts
advanceHatching: async (projectId) => {
  // 1. 取消之前的请求（AbortController）
  const prevController = get()._abortController
  if (prevController) prevController.abort()

  // 2. 创建新的 AbortController
  const controller = new AbortController()
  const jobId = `advance:${projectId}`

  // 3. 清除上一轮已完成的 job，注册新 job
  get()._clearCompletedJobs()
  set({
    phase: 'streaming',
    streamText: '',
    currentEngine: null,
    _abortController: controller,
  })
  get().registerLLMJob(jobId, '孵化推进', { /* ... */ })

  // 4. 执行 SSE
  await get()._executeEngineSSE(
    projectId, 'advance', jobId, controller,
    `/api/hatch/${projectId}/advance`,
  )
}
```

### 3.3 后端：POST /hatch/:id/advance

**文件**：`apps/server/src/routes/hatch.ts:193-320`

**核心逻辑**：

```
1. 参数校验（projectId UUID）
2. 获取项目信息（genre, title）
3. 查询当前阶段：scheduler.getNextPhase(projectId)
4. 所有响应统一为 SSE 格式
5. 根据 phase 分支处理：
   - waiting_approval → SSE: phase(waiting_approval) → SSE: done
   - waiting_revision → 清理旧提案 → 运行引擎 SSE 流式
   - engine_ready → 运行引擎 SSE 流式
   - studio_engine → SSE: phase(studio_engine) → SSE: done
   - waiting_user_action → SSE: phase(waiting_user_action) → SSE: done
   - waiting_phase_confirmation → SSE: phase(waiting_phase_confirmation) → SSE: done
   - complete → SSE: phase(complete) → SSE: done
```

### 3.4 后端：getNextPhase 状态机

**文件**：`packages/pipeline/src/scheduler.ts:209-274`

**6 种阶段判定**（按优先级顺序）：

```
1. 有待审批提案 → waiting_approval (pendingCount)
2. 有 revision_requested → waiting_revision (engine=sourceNode)
3. 有待细化条目 → waiting_user_action (refinableCount + refinement info)
4. 有可运行引擎 → engine_ready (engine=name)
5. geography 有产出但未确认 → waiting_phase_confirmation
6. 全部完成 → complete
```

### 3.5 后端：执行引擎 SSE 流

**文件**：`apps/server/src/routes/hatch.ts:44-166` (`executeEngineSSEStream`)

**流程**：

```
1. 获取引擎节点：getEngine(engineName)
2. 创建 sessions 记录
3. 调用 node.streamRun(ctx) → 异步生成器
4. 逐事件处理：
   - chunk → SSE: chunk → 仅 SSE，不推 WS（避免双写）
   - model → SSE: model + WS: engine_model
   - usage → SSE: usage + WS: engine_usage
   - error → SSE: error + WS: engine_error
   - tool_call → SSE: tool_call + WS: engine_tool_call
   - tool_result → SSE: tool_result + WS: engine_tool_result
   - generation → SSE: generation + WS: engine_generation_start
   - done → result = event.result
5. orchestrator.stageProposals(projectId, session.id, result, engineName)
6. SSE: staged (proposalCount)
7. SSE: done (success + proposals 列表)
8. WS: engine_done + new_proposals
```

### 3.6 引擎流式执行：streamRun

**文件**：`packages/engines/src/base.ts:455-585`

**标准模式（非工具模式）**：

```
1. acquireLock(sessionId) — 会话级并发锁
2. buildSystemPrompt(ctx) — 子类覆盖
3. loadRevisionNotes(projectId) — 加载修改意见
4. injectMemory(projectId) — 注入依赖引擎的上下文
5. buildProjectMeta(ctx) — 项目元信息
6. buildExtraMessages(ctx) — 额外消息（章节内容等）
7. buildUserMessage(ctx) — 子类覆盖
8. 组装 messages 数组
9. 检查 token 预算，超预算则裁剪
10. LLM stream 调用（支持 tier fallback：lightweight → pro）
11. 逐 chunk 输出（支持 _hasCompleteProposals 提前中断）
12. parseOutput(raw) → Proposal[]
13. injectRefinementMeta(proposals, ctx) — 细化模式注入 scale
14. 组装 EngineResult（含 pipeline snapshot）
15. yield done
```

**工具模式（usesToolBasedContext = true）**：

```
1-7. 同上，但不调用 injectMemory()
8. 增加引擎地图 + query_world_setting 工具使用指南
9. 多轮工具循环（最多 15 轮）：
   a. LLM stream 调用（含 tools 参数）
   b. 如果 LLM 返回 tool_calls → 执行工具 → 追加 tool result → 下一轮
   c. 如果无 tool_calls → 生成最终提案
10. 首轮未调工具且引擎有依赖 → 强制提醒查询
11. parseOutput(raw) → Proposal[]
```

### 3.7 前端：SSE 事件处理

**文件**：`apps/web/src/stores/hatch.ts:338-515` (`_executeEngineSSE`)

**SSE 事件 → Store 状态映射**：

| SSE 事件 | 处理 |
|---------|------|
| model | updateLLMJob(provider, model, label) |
| usage | updateLLMJob(tokens, active: false) |
| chunk | streamText += text（每 100ms 估算 token） |
| error | set(error: message) |
| staged | fetchEngines + updateLLMJob label |
| phase | 特殊阶段处理（waiting_phase_confirmation / studio_engine / waiting_user_action） |
| engine_name | set(currentEngine) |
| tool_call | updateLLMJob label |
| done | 嵌入 proposals → fetchProposals + fetchEngines + fetchSettings |

**SSE 完成后的状态切换**：

```
if (specialPhase === 'waiting_phase_confirmation')
  → phase: 'waiting_phase_confirmation'
else if (pending proposals > 0)
  → phase: 'waiting', autoPopupProposalId: firstPending.id
else if (no proposals at all)
  → phase: 'waiting', console.warn
else
  → phase: 'waiting' (后端自动推进中)
```

---

## 4. MOU 审批流程

### 4.1 前端：MOU 弹窗触发

**文件**：`apps/web/src/pages/ProjectEditor.tsx:178-185`

```tsx
useEffect(() => {
  if (autoPopupProposalId && !mouProposal && phase !== 'streaming') {
    const p = proposals.find((p) => p.id === autoPopupProposalId)
    if (p) setMouProposal(p)
  }
}, [autoPopupProposalId, proposals, mouProposal])
```

**触发条件**：
- `autoPopupProposalId` 被设置（来自 fetchProposals 或 SSE done 后的状态更新）
- 当前不在 streaming 状态
- MOU 弹窗未打开

### 4.2 前端：MOU 弹窗组件

**文件**：`apps/web/src/components/editor/MOUModal.tsx`

**交互选项**：
- **拍板**（Approve）→ 关闭弹窗 → `approveProposal(proposalId)`
- **驳回**（Reject）→ `rejectProposal(proposalId)` → 关闭弹窗
- **修改**（Revise）→ `reviseProposal(proposalId, notes)` → 关闭弹窗
- **商讨**（Discuss）→ `reviseProposal(proposalId, [商讨] message)`

### 4.3 前端：approveProposal

**文件**：`apps/web/src/stores/hatch.ts:776-813`

```ts
approveProposal: async (proposalId, projectId) => {
  // 1. POST /proposals/:id/approve
  const res = await apiPost(`/proposals/${proposalId}/approve`, {})

  // 2. 检查后端返回的 executed 状态
  if (!res.success) throw new Error('审批执行失败')

  // 3. 本地更新提案状态
  proposals = proposals.map(p => p.id === proposalId ? {...p, status: 'approved'} : p)

  // 4. optionGroup  siblings 标记为 superseded
  if (approved.optionGroup) {
    for (p of same group) p.status = 'superseded'
  }

  // 5. 同步后端数据（后端已自动触发 onProposalsResolved）
  await Promise.all([fetchProposals, fetchEngines, fetchSettings])
}
```

### 4.4 后端：审批 API

**端点**：`POST /proposals/:id/approve`
**文件**：`apps/server/src/routes/hatch.ts:728-760`

```
1. 调用 orchestrator.approveProposal(proposalId, decision)
2. 如果 executed 且 scheduler 存在：
   a. 查询 proposal.projectId
   b. scheduler.onProposalsResolved(projectId) → 自动推进下一阶段
3. 返回 {success, proposalId, settingItemsCreated}
```

### 4.5 后端：Orchestrator.approveProposal

**文件**：`packages/pipeline/src/orchestrator.ts:237-422`

**事务内执行（串行化隔离）**：

```
1. 状态守卫：status 必须为 pending 或 revision_requested
2. 更新 mou_states → approved
3. 更新 ai_proposals → executing（中间状态，防并发）
4. 读取完整提案内容
5. 查找 Handler：findHandler(proposal.type, proposal.targetAction)
6. Handler.execute(ctx) → 创建/更新 setting_items
7. Handler 必须成功，否则回滚整个事务
8. 更新 ai_proposals → approved
9. 更新 mou_states → executedAt + executionResult
10. 推送通知（如有）
11. optionGroup siblings → superseded
12. 如果 itemsCreated > 0：maybeLockProject()
13. 发布领域事件：proposal.approved
14. 异步触发向量嵌入
```

---

## 5. 设定入库与 Handler 执行

### 5.1 Handler 注册与查找

**文件**：`packages/pipeline/src/handlers/index.ts`

**Handler 策略模式**：
- `proposal.type` + `proposal.targetAction` → 查找对应 Handler
- 默认 Handler：`SettingItemHandler`（处理大部分世界引擎产出）

### 5.2 SettingItemHandler

**文件**：`packages/pipeline/src/handlers/setting-item.ts`

**执行逻辑**：

```
1. 解析 payload.items（Proposal 中的设定条目列表）
2. 每个 item → 创建 setting_items 记录：
   - projectId, proposalId
   - type, name, summary, content（JSONB）
   - engineSource = proposal.sourceNode
   - parentItemId（来自 _refinementParentId 或 payload）
   - status = "confirmed"（直接确认，不经过 draft）
3. 解析 payload.relations → 创建 setting_item_relations 记录
4. 如果 content.scale 存在且 needs_refinement === true：
   - 后续由 scheduler.getItemsNeedingRefinement() 发现
5. 返回 {executed: true, itemsCreated, itemIds, relationIds}
```

### 5.3 跨引擎引用校验

**文件**：`packages/pipeline/src/orchestrator.ts:156-188`, `validators/cross-engine-validator.ts`

**在 stageProposals 时执行**：
- 检查提案中引用的名称是否在已确认条目中存在
- 自动修正：模糊匹配到最相似的名称（置信度 1 时自动替换）
- 无法自动修正的报 warning 日志

### 5.4 项目锁定检查

**文件**：`packages/pipeline/src/orchestrator.ts:545-713`

**maybeLockProject 触发条件**：
1. 所有 MOU 已处理（无 pending / revision_requested / executing）
2. 所有世界引擎都有 confirmed 产出
3. 构建 world_bible 快照（所有 confirmed items + relations）
4. 写入 project_settings（lockedAt + worldBible + hatchSummary）
5. 更新 projects.status → "active"
6. 关闭所有未关闭的 hatching 会话
7. 推送"孵化完成"通知
8. 发布 project.activated 领域事件

---

## 6. 细化（Refinement）流程

### 6.1 细化的触发条件

**来源 1：用户手动触发**
- 前端：地图视图中点击"细化此区域"按钮
- 调用 `POST /geography/refine/:parentItemId`

**来源 2：引擎产出时自动标记**
- 引擎生成的 item 如果 `content.needs_refinement === true`，自动进入待细化队列
- `content.scale` 决定当前尺度，`SCALE_CHAIN` 或 `projectScales` 决定下一级

### 6.2 后端：细化 API

**端点**：`POST /geography/refine/:parentItemId`
**文件**：`apps/server/src/routes/hatch.ts:1126-1146`

```
1. 查找父条目（settingItems.id = parentItemId）
2. 获取 engineSource（如 "geography"）
3. 调用 scheduler.refineItem(projectId, parentItemId)
4. 返回 {success, parentItemId, proposalIds}
```

### 6.3 后端：Scheduler.refineItem

**文件**：`packages/pipeline/src/scheduler.ts:643-701`

```
1. 查询父条目（confirmed + 有 engineSource）
2. 获取 parentScale（content.scale，默认为 "continent"）
3. 查询下一级尺度：
   a. 优先项目自定义尺度（projectScales）
   b. 回退 SCALE_CHAIN（continent → region → city → district → scene）
4. 调用 runRefinementEngine(projectId, engineName, refinement)
```

### 6.4 后端：runRefinementEngine

**文件**：`packages/pipeline/src/scheduler.ts:832-893`

```
1. 并发锁检查
2. 创建 session（type = "{engine}:refine"）
3. 调用 node.run(ctx) 其中 ctx.refinement = {parentItemId, parentName, parentScale, targetScale, depth}
4. orchestrator.stageProposals()
5. 返回 proposalIds
```

### 6.5 引擎：细化模式处理

**文件**：`packages/engines/src/base.ts:210-229`, `252-259`

```
1. streamRun 保存 ctx.refinement → this.currentRefinement
2. parseOutput 后调用 injectRefinementMeta()：
   - 强制注入 scale = targetScale
   - 强制注入 needs_refinement = true
3. injectRefinementParentId()：
   - 向 payload 注入 _refinementParentId
4. Handler 创建 item 时使用 _refinementParentId 设置 parentItemId
```

### 6.6 前端：等待细化状态

**文件**：`apps/web/src/stores/hatch.ts:397-404`

```ts
// SSE phase 事件：waiting_user_action
if (eventType === 'phase' && data.phase === 'waiting_user_action') {
  specialPhase = 'waiting_user_action'
  // 保持 waiting，用户需在地图视图中手动触发细化
}
```

**HatchingView 渲染**：显示"有 X 个条目待细化，请在地图视图中点击'细化此区域'手动触发"

### 6.7 后端：获取待细化条目

**端点**：`GET /geography/refinable/:projectId`
**文件**：`apps/server/src/routes/hatch.ts:1152-1160`

调用 `scheduler.getItemsNeedingRefinement(projectId)`

**判定逻辑**（`scheduler.ts:707-827`）：

```
1. 查询所有 confirmed items
2. 排除已有子条目的父条目（防止重复细化）
3. 筛选 needs_refinement === true 的条目
4. 检查是否可继续细化（有下一级尺度）
5. 返回 [{id, name, scale, targetScale, engineSource}]
```

---

## 7. 阶段确认与世界完成

### 7.1 Geography 阶段确认

**设计意图**：geography 引擎产出后，用户需要确认是否满意，才能推进到后续引擎。

**触发条件**：`scheduler.getNextPhase` 中检查：
```
geographyHasOutput = confirmedEngines.has("geography")
geographyPhaseCompleted = phaseStatus.geography === "completed"
if (geographyHasOutput && !geographyPhaseCompleted)
  → waiting_phase_confirmation
```

### 7.2 前端：阶段确认 UI

**文件**：`apps/web/src/components/hatching/HatchingView.tsx:511-541`

```tsx
if (phase === 'waiting_phase_confirmation') {
  return (
    <div>
      <h2>地理环境阶段完成</h2>
      <p>确认完成后，系统将推进到后续世界观引擎。</p>
      <button onClick={() => onCompletePhase('geography')}>
        确认阶段完成
      </button>
    </div>
  )
}
```

### 7.3 后端：阶段确认 API

**端点**：`POST /hatch/:id/complete-phase/:phase`
**文件**：`apps/server/src/routes/hatch.ts:1328-1360`

```
1. 校验 phase 在 ALLOWED_PHASES 白名单中
2. 读取 projectSettings.hatchSummary.phaseStatus
3. phaseStatus[phase] = "completed"
4. UPDATE projectSettings
5. 自动调用 advanceHatching（前端在 completePhase store action 中执行）
```

### 7.4 世界完成 → 工作室阶段

**触发条件**：`scheduler.getNextEngine` 中检查：

```
allWorldDone = WORLD_ENGINES.every(e => confirmedEngines.has(e.name))
if (allWorldDone) {
  anyStudioDone = STUDIO_ENGINES.some(e => confirmedEngines.has(e.name))
  if (!anyStudioDone)
    → {name: "outline-generator", phase: "world_complete", hatchGroup: "studio"}
}
```

**前端**：`HatchingView` 显示"世界构建完成"+"进入工作室阶段"按钮

**点击后**：`startStudioPhase()` → `hatchGroup = 'studio'` → `advanceHatching()`

---

## 8. 工作室阶段（Studio Engines）

### 8.1 工作室引擎列表

| 引擎 | 依赖 | 产出 |
|------|------|------|
| outline-generator | story-blueprint | 全局大纲 (outline) |
| volume-outline | outline-generator | 卷纲 (volume_outline) |
| chapter-outline | volume-outline + foreshadowing | 章纲 (chapter_outline) |
| foreshadowing | story-blueprint + volume-outline | 伏笔追踪 (plant/payoff/red_herring) |
| chapter-writer | chapter-outline + foreshadowing | 章节草稿 (chapter_draft/scene_draft) |

### 8.2 工作室引擎的特殊处理

**文件**：`apps/server/src/routes/hatch.ts:267-284`

```ts
if (engineDef?.engineGroup === "studio") {
  // 发送 handoff 事件让前端用 outline store 接管
  safeWrite(`event: phase\ndata: ${JSON.stringify({
    phase: "studio_engine",
    engine: phaseInfo.engine,
  })}\n\n`)
  return
}
```

**前端**：`useHatchStore.runEngine` 中检查 `OUTLINE_ENGINES.has(engine)`

```ts
if (OUTLINE_ENGINES.has(engine)) {
  // 使用 outline store 的 SSE 端点
  const { useOutlineStore } = await import('./outline')
  // ... 调用 outlineStore.generateOutline / generateVolumeOutline 等
}
```

### 8.3 孵化完成

**触发条件**：所有 HATCH_ENGINES（world + studio）都有 confirmed 产出

**状态**：`phase: 'complete'`

**前端**：`HatchingView` 显示"创作准备完成"

**后端**：`maybeLockProject` 已触发，项目状态为 "active"

---

## 9. 端到端状态机总结

### 9.1 前端 HatchPhase

```
idle → streaming → waiting → [循环]
                    ↓
         waiting_phase_confirmation ──确认──┐
                    ↓                        │
         waiting_user_action ──手动细化─────┤
                    ↓                        │
         world_complete ──进入工作室───────┤
                    ↓                        │
         complete ←─────────────────────────┘
```

### 9.2 后端 getNextPhase 状态机

```
waiting_approval ──全部审批──→ engine_ready
      ↑                              │
      │                    ┌─────────┘
      │                    ↓
      │              waiting_revision ──修改后重跑──┐
      │                    ↑                        │
      │                    └────────────────────────┤
      │                                             │
      │              waiting_user_action ──手动细化─┤
      │                                             │
      │              waiting_phase_confirmation ────┤
      │                                             │
      └─────────────────────────────────────────────┘
```

### 9.3 引擎依赖图（简化）

```
tone
└── geography
    └── power-system
        ├── race ───────────────────────────┐
        ├── technique ──────────────────────┤
        └── faction ─┬── culture ───────────┤
                     ├── history ───────────┤
                     ├── economy ───────────┤
                     └── character ─────────┤
                         └── conflict ──────┤
                             └── item-system┤
                                 └── story-blueprint (全部汇聚)
                                     └── outline-generator
                                         └── volume-outline
                                             ├── chapter-outline
                                             └── foreshadowing
```

### 9.4 数据流全景

```
[用户] ──点击"开始孵化"──→ [前端 hatch store]
                              │ phase: streaming
                              │ POST /hatch/:id/advance (SSE)
                              ↓
[后端 hatch.ts] ──getNextPhase──→ [Scheduler]
                              │
                              │ streamRun(ctx)
                              ↓
[引擎 Engine] ──LLM stream──→ 生成 proposals
                              │
                              │ stageProposals()
                              ↓
[Orchestrator] ──INSERT──→ ai_proposals + mou_states
                              │
                              │ SSE: done
                              ↓
[前端] ──fetchProposals──→ 发现 pending
                              │
                              │ MOU 弹窗
                              ↓
[用户] ──拍板──→ [前端] approveProposal()
                              │
                              │ POST /proposals/:id/approve
                              ↓
[后端 Orchestrator] ──Handler──→ setting_items INSERT
                              │
                              │ onProposalsResolved()
                              ↓
[Scheduler] ──getNextPhase──→ 下一个引擎
                              │
                              └────→ 循环直到 complete
```

---

## 10. 代码审计发现

### 10.1 架构层面的观察

#### A1. 双通道通信模型清晰但有重叠风险

**现状**：SSE（单连接流式）+ WebSocket（多 tab 广播）双通道
- SSE 负责：引擎流式输出（chunk/text）、单个前端的实时渲染
- WS 负责：跨 tab 同步（new_proposals、engine_done）、引擎状态广播

**风险**：前端 `handleWSEvent` 和 SSE `onChunk` 都可能更新 `streamText`，虽然代码中通过 `:ws` job ID 后缀做了区分，但如果 WS 收到 chunk 事件时 SSE 也在写入，可能导致内容重复。

**建议**：明确区分 SSE 和 WS 的职责，SSE 负责当前 tab 的流式内容，WS 仅用于非流式状态同步。

#### A2. 前端编排逻辑已后移，但仍有残留

**现状**：大部分编排逻辑在后端 `scheduler.getNextPhase`，但前端仍有：
- `fetchProposals` 中的 phase 判定逻辑（`hatch.ts:557-582`）
- `runEngine` 中的大纲引擎路由逻辑

**建议**：进一步清理前端的编排逻辑，使其纯粹为"展示层"，所有阶段判定由后端驱动。

#### A3. 细化循环已改为手动触发，但 old code 仍有自动细化逻辑

**现状**：
- `scheduler.ts:422-443`（onProposalsResolved）注释说明"不再自动运行细化循环"
- 但 `scheduler.ts:449-499`（runRefinementLoop）方法仍然存在，只是没有被调用

**建议**：清理未使用的 `runRefinementLoop` 方法，或明确保留用于未来配置开关。

### 10.2 具体代码问题

#### B1. `getNextPhase` 中的 `getNextEngine` 调用可能返回不一致结果

**文件**：`scheduler.ts:259-263`

```ts
const next = await this.getNextEngine(projectId);
if (next && (next.phase === "streaming" || next.phase === "world_complete")) {
  return { phase: "engine_ready", engine: next.name };
}
```

**问题**：`getNextEngine` 返回的 `phase` 字段语义不清晰（"streaming"/"world_complete"），但外层包装为 "engine_ready"。这种映射增加了理解成本。

#### B2. 前端 `fetchProposals` 的 phase 判定与后端可能不一致

**文件**：`hatch.ts:557-582`

前端在 fetchProposals 后会自行判定 phase，这与后端 getNextPhase 的判定逻辑可能产生分歧。例如：
- 后端认为当前是 "waiting_user_action"
- 但前端 fetchProposals 发现 pending.length === 0，可能覆盖为 "idle"

**问题**：代码中有保护逻辑（保留 waiting_phase_confirmation 和 waiting_user_action），但保护不完整。

#### B3. `HatchingView` 的 `computePipeline` 对世界引擎和工作室引擎使用不同的完成判定

**文件**：`HatchingView.tsx:47-77`

```ts
if (hatchGroup === 'world') {
  if (e.hasData) return completed
} else {
  if (approvedSources.has(e.name)) return completed
}
```

**问题**：世界引擎用 `hasData`（setting_items 存在），工作室引擎用 `approvedSources`（提案 approved）。这种不一致可能导致进度显示偏差。

#### B4. `maybeLockProject` 检查条件过于严格

**文件**：`orchestrator.ts:598-614`

```ts
const missingEngines = requiredEngines.filter(
  (e) => !confirmedEngineSources.has(e.name)
);
```

**问题**：`requiredEngines` = `WORLD_ENGINES`（所有世界引擎），这意味着**所有**世界引擎都必须有产出才能锁定项目。如果某个引擎没有产出（如用户跳过了 economy），项目永远不会自动锁定。

**建议**：考虑允许部分引擎可选，或在 UI 中明确提示用户哪些引擎必须完成。

#### B5. `runEngine` 前端阻止逻辑有 race condition

**文件**：`hatch.ts:708-714`

```ts
const _approvedEngines = new Set(
  get().proposals.filter((p) => p.status === 'approved').map((p) => p.sourceNode)
)
if (_approvedEngines.has(engine)) {
  console.warn(`runEngine blocked: ${engine} already has an approved proposal`)
  return
}
```

**问题**：这个检查基于前端本地 state，如果用户刷新页面后 state 未同步，可能允许重复运行。后端 `advance` 端点虽然有并发锁（`advanceLocks`），但没有检查"该引擎是否已有 approved 提案"。

#### B6. `injectRefinementMeta` 只在标准 streamRun 中调用，不在工具模式中

**文件**：`base.ts:561`（streamRun）vs `base.ts:800`（streamRunWithTools）

**问题**：工具模式下也调用了 `injectRefinementMeta`（line 800），但 `injectRefinementParentId` 只在 `parseOutput` 中由子类调用。如果子类忘记调用，细化条目不会正确挂到父条目下。

#### B7. `projectSettings` lazy 创建可能导致竞态

**文件**：`hatch.ts:577-633`（GET /settings/:id）

**问题**：如果多个请求同时访问 `/settings/:id` 且 projectSettings 不存在，可能产生重复 INSERT。

### 10.3 安全与边界情况

#### C1. `advanceLocks` 只在 `needsLock` 时添加，但所有分支都释放

**文件**：`hatch.ts:211-219, 228`

```ts
const needsLock = phaseInfo.phase === "engine_ready" || phaseInfo.phase === "waiting_revision"
if (needsLock && advanceLocks.has(projectId)) { ... }
if (needsLock) advanceLocks.add(projectId)
```

**问题**：如果 `needsLock` 为 false，不会添加锁，但 `releaseLock()` 总是调用 `advanceLocks.delete()`（无副作用）。逻辑正确但需确认：非引擎运行阶段（如 waiting_approval）是否可能并发调用？

#### C2. `validateUUID` 使用简单正则，不是 RFC4122 严格校验

**文件**：`apps/server/src/validation.ts`（假设）

**建议**：考虑使用 `uuid` 库的 validate 函数。

#### C3. `fuzzyMatchInCandidates` 的自动修正可能导致数据污染

**文件**：`orchestrator.ts:22-64`

**问题**：跨引擎引用校验的自动修正替换的是内存中的对象，如果修正错误，可能导致错误的关系数据入库。

### 10.4 性能考虑

#### D1. `getItemsNeedingRefinement` 对每个 item 单独查询 projectScales

**文件**：`scheduler.ts:707-827`

**问题**：在循环中对每个 item 调用 `loadProjectScales(projectId)`，虽然函数内部可能有缓存，但 N+1 查询风险存在。

#### D2. `fetchSettings` 每次都返回全部 settingItems

**文件**：`hatch.ts:577-633`

**问题**：项目规模增大后，settings API 返回的数据量可能很大。建议考虑分页或按需加载。

#### D3. `executeEngineSSEStream` 中每收到一个 tool_call 都推送 WS

**文件**：`hatch.ts:111-116`

**问题**：如果 LLM 在一轮中调用多个工具，会产生多个 WS 推送，前端可能频繁刷新。

### 10.5 可维护性问题

#### E1. 引擎名、settingType、sourceNode 的命名映射分散在多处

- `engine-config.ts`：ENGINE_REGISTRY[].name（kebab-case）+ .settingType（snake_case）
- `hatch.ts`：ALLOWED_PHASES / ALLOWED_CREATE_ENGINES（硬编码集合）
- `HatchingView.tsx`：STEP_ICONS（硬编码映射）
- `engineConfig.ts`（前端 utils）：engineLabelMap

**建议**：考虑统一引擎元数据中心，前后端共享。

#### E2. `engineLabelMap` 在前端重复定义

**文件**：`apps/web/src/utils/engineConfig.ts`

**问题**：引擎标签在 `engine-config.ts`（后端）和 `engineConfig.ts`（前端）中分别定义，容易不一致。

#### E3. `PhaseBadge` 组件中的 `config` 硬编码了阶段标签

**文件**：`HatchingView.tsx:86-94`

**问题**：新增阶段需要修改多处代码。

---

## 附录

### A. 关键文件清单

| 文件 | 职责 |
|------|------|
| `apps/web/src/pages/ProjectEditor.tsx` | 项目编辑器主页面，协调所有子组件 |
| `apps/web/src/stores/hatch.ts` | 孵化状态管理（phase、proposals、SSE） |
| `apps/web/src/stores/realtime.ts` | WebSocket 连接管理 |
| `apps/web/src/components/hatching/HatchingView.tsx` | 孵化流程 UI（流水线、状态展示） |
| `apps/server/src/routes/hatch.ts` | 孵化相关 API（/advance、/proposals、/engines 等） |
| `apps/server/src/index.ts` | 服务器入口（Scheduler + WS + 向量服务初始化） |
| `packages/pipeline/src/scheduler.ts` | 引擎调度器（getNextPhase、依赖图驱动） |
| `packages/pipeline/src/orchestrator.ts` | 提案编排器（stage、approve、reject、revise） |
| `packages/pipeline/src/event-bus.ts` | 领域事件总线 |
| `packages/engines/src/base.ts` | 引擎基类（streamRun、工具循环、token 管理） |
| `packages/engines/src/engine-config.ts` | 引擎注册表 + 依赖图 |
| `packages/engines/src/index.ts` | 引擎导出 + 注册 |
| `packages/database/src/schema.ts` | 数据库表结构定义 |

### B. 关键数据表关系

```
projects (1)
├── sessions (N)
│   └── discussions (N)
├── ai_proposals (N)
│   └── mou_states (1:1)
├── setting_items (N)
│   └── setting_item_versions (N)
│   └── settingItemRelations → setting_items (M:N)
├── projectSettings (1:1)
├── notifications (N)
│   └── notification_reads (N)
├── outlines (N)
│   └── outline_items (N)
├── volumes (N)
│   └── chapters (N)
└── llm_logs (N)
```

### C. API 端点清单（孵化相关）

| 方法 | 端点 | 职责 |
|------|------|------|
| POST | /hatch/:id/advance | 孵化推进主入口（SSE） |
| GET | /hatch/:id/proposals | 查询项目所有提案 |
| GET | /hatch/:id/engines | 查询引擎状态 |
| POST | /proposals/bulk/approve | 批量拍板 |
| POST | /proposals/:id/approve | 单条拍板 |
| POST | /proposals/:id/reject | 拒绝 |
| POST | /proposals/:id/revise | 要求修改 |
| GET | /settings/:id | 查询已锁定设定集 |
| PATCH | /settings/items/:id | 更新设定条目 |
| POST | /settings/items/:id/propose-update | MOU 流程修改设定 |
| POST | /settings/items/:id/propose-delete | MOU 流程删除设定 |
| POST | /hatch/:id/engine/:engine/create-item | 手动创建设定条目 |
| POST | /geography/refine/:parentItemId | 细化条目 |
| GET | /geography/refinable/:projectId | 获取待细化条目 |
| POST | /hatch/:id/complete-phase/:phase | 确认阶段完成 |
| POST | /settings/items/:id/complete-refinement | 标记细化完成 |
| GET | /world/query/:projectId | 查询世界上下文 |
| GET | /memory/query/:projectId | 灵活查询设定条目 |
