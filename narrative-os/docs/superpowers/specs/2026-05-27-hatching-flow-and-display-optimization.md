# 孵化阶段流转与前端显示优化设计文档

> 日期：2026-05-27
> 范围：前端状态管理重构 + 细化引擎友好显示 + 项目标题同步 + 竞态修复
> 关联问题：审批后标题未更新、细化引擎显示为技术标识、后端运行中但前端显示"正在准备"、孵化阶段流转不连贯

---

## 1. 问题定义

### 1.1 项目标题不同步

审批 tone（世界观基调）提案后，`orchestrator.approveProposal` 创建 settingItems 但不会更新 `projects.title`。前端 HatchingView 始终显示 `project.title`，标题保持创建项目时的旧值。

### 1.2 细化引擎显示为技术标识

`scheduler.ts` 中细化引擎的 node 名为 `geography:refine`，但 `engineLabelMap` 中没有此键。HatchingView、BottomBar、LLMStatusPopup 均直接显示原始字符串 `geography:refine`。

### 1.3 竞态：后端运行中但前端显示"正在准备"

审批通过后，后端异步调用 `onProposalsResolved` → `runRefinementLoop` → `runRefinementEngine`。细化引擎启动时 emit `engine_started` WS 事件，但前端同时调用 `fetchProposals` HTTP 请求。由于 HTTP 响应通常比 WS 推送更快返回，`fetchProposals` 的回调覆盖了 WS 设置的 `streaming` 状态，导致前端显示 `waiting`（"正在准备..."），而实际后端正在运行细化引擎。

时序冲突：

```
T0  用户审批
T1  前端 fetchProposals ──→ 后端
T2  后端开始运行细化引擎，emit WS engine_started
T3  前端 fetchProposals 返回 ←── 后端（pending=0）
    → fetchProposals 回调设置 phase='waiting'
T4  WS engine_started 到达 ←──── 后端
    → handleWSEvent 设置 phase='streaming'
T5  engine_done 到达 ←────────── 后端
    → handleWSEvent 设置 phase='waiting', currentEngine=null
```

T3/T4 的执行顺序不确定，导致状态闪烁或被错误覆盖。

### 1.4 细化引擎非流式，前端显示不恰当

细化引擎使用 `node.run(ctx)`（非流式），前端不会收到 `engine_chunk` 事件。`streamText` 为空时显示"AI 正在思考，请稍候..."，但细化实际上是"后台处理"而非"流式生成"。

### 1.5 页面刷新后状态丢失

`phase` 和 `currentEngine` 是纯前端运行时状态，页面刷新后丢失。重新加载时前端根据 `fetchProposals` 判定 phase，但 fetch 已不再设置 phase（状态分离后），需要独立的恢复机制。

---

## 2. 设计目标

1. **标题同步**：审批 tone 提案后，项目标题同步更新为新审批的内容
2. **状态分离**：`fetchProposals`/`fetchEngines` 只更新数据，不判定 `phase`。`phase` 完全由事件驱动
3. **友好显示**：细化引擎显示为"细化「巨城星图」→ 城市板块"而非 `geography:refine`
4. **竞态消除**：fetch 回调不再覆盖运行时事件设置的 streaming 状态
5. **流转连贯**：引擎完成后正确衔接下一步（pending 弹窗 / 等待下一事件）
6. **刷新恢复**：页面刷新后能根据 DB 数据恢复合理的初始 phase

---

## 3. 架构设计

### 3.1 状态分离原则

前端 store 中状态分为两类：

| 类型 | 字段 | 更新来源 |
|------|------|---------|
| 持久状态 | `proposals`, `engines`, `settingItems` | HTTP fetch（DB 数据） |
| 运行时状态 | `phase`, `currentEngine`, `streamText`, `_refinementContext` | WS/SSE 事件 |

**规则**：fetch 只更新持久状态，不碰运行时状态。运行时状态由事件驱动，事件可以覆盖 fetch 的结果。

### 3.2 事件驱动的状态流转

```
engine_started (WS) → phase='streaming', currentEngine=xxx, streamText=''
  ↓
engine_chunk (WS/SSE) → streamText += chunk
  ↓
engine_done (WS) → fetchProposals() → 根据 pending 决定下一步
  ├─ pending > 0 → phase='waiting', autoPopup
  └─ pending = 0 → currentEngine=null, streamText='', phase 保持原样
```

### 3.3 细化引擎事件增强

后端 `runRefinementEngine` emit 的事件附带细化上下文：

```typescript
{
  type: "engine_started",
  projectId,
  node: "geography:refine",
  payload: {
    refinement: {
      parentName: "巨城星图",
      parentScale: "continent",
      targetScale: "city"
    }
  }
}
```

---

## 4. 详细设计

### 4.1 后端改动

#### 4.1.1 审批时同步更新项目标题

**文件**：`apps/server/src/routes/hatch.ts`（approve handler 或 orchestrator）

**位置**：POST `/proposals/:id/approve` handler 中，`orchestrator.approveProposal` 成功后。

**逻辑**：

```typescript
if (result.executed && scheduler) {
  const [proposal] = await db
    .select({ projectId: aiProposals.projectId, type: aiProposals.type, sourceNode: aiProposals.sourceNode, title: aiProposals.title })
    .from(aiProposals)
    .where(eq(aiProposals.id, proposalId));

  // 审批世界观基调提案时，同步更新项目标题
  if (proposal?.projectId && (proposal.type === 'tone' || proposal.sourceNode === 'tone')) {
    await db.update(projects)
      .set({ title: proposal.title, updatedAt: new Date() })
      .where(eq(projects.id, proposal.projectId));
  }

  if (proposal?.projectId) {
    scheduler.onProposalsResolved(proposal.projectId).catch(...);
  }
}
```

#### 4.1.2 细化引擎事件附带上下文

**文件**：`packages/pipeline/src/scheduler.ts`

**位置**：`runRefinementEngine` 方法。

**当前代码**（第 878-879 行）：

```typescript
this.emit({ type: "engine_started", projectId, node: `${engineName}:refine` });
```

**改为**：

```typescript
this.emit({
  type: "engine_started",
  projectId,
  node: `${engineName}:refine`,
  payload: {
    refinement: {
      parentName: refinement.parentName,
      parentScale: refinement.parentScale,
      targetScale: refinement.targetScale,
    }
  }
});
```

同样修改 `engine_done` emit（第 915 行）：

```typescript
this.emit({
  type: "engine_done",
  projectId,
  node: `${engineName}:refine`,
  payload: {
    engine: `${engineName}:refine`,
    refinement: {
      parentName: refinement.parentName,
      parentScale: refinement.parentScale,
      targetScale: refinement.targetScale,
    }
  }
});
```

### 4.2 前端改动

#### 4.2.1 Store 新增细化上下文字段

**文件**：`apps/web/src/stores/hatch.ts`

**在 `HatchStore` interface 中新增**：

```typescript
_refinementContext: { parentName: string; parentScale: string; targetScale: string } | null
```

**在 `useHatchStore` 初始值中新增**：

```typescript
_refinementContext: null,
```

#### 4.2.2 fetchProposals 移除 phase 设置

**文件**：`apps/web/src/stores/hatch.ts`

**当前代码**（第 596-633 行）：

```typescript
// 阶段判定：简化 — 有 pending 弹窗，无 pending 则 idle/waiting
let phase: HatchPhase
if (pending.length > 0) {
  phase = 'waiting'
} else if (phaseBeforeFetch === 'streaming') {
  phase = 'streaming'
} else if (get().locked) {
  phase = 'complete'
} else if (proposals.length > 0) {
  phase = get().phase === 'streaming' ? 'streaming' : 'waiting'
} else {
  phase = 'idle'
}

// 保留 waiting_phase_confirmation 状态
if (get().phase === 'waiting_phase_confirmation' && pending.length === 0) {
  phase = 'waiting_phase_confirmation'
}

// 保留 waiting_user_action 状态
if (get().phase === 'waiting_user_action' && pending.length === 0) {
  phase = 'waiting_user_action'
}

set({ proposals, phase, hatchGroup, autoPopupProposalId: autoPopupId, error: null })
```

**改为**：

```typescript
// 状态分离：fetch 只更新 proposals，不碰 phase
// phase 由 WS/SSE 事件驱动
const updates: Partial<HatchStore> = {
  proposals,
  autoPopupProposalId: autoPopupId,
  error: null,
}

// 页面恢复场景：当前为 idle 且有 pending 时，需要切到 waiting
if (pending.length > 0 && get().phase === 'idle') {
  updates.phase = 'waiting'
  updates.autoPopupProposalId = pending[0].id
}

set(updates)
```

#### 4.2.3 fetchEngines 移除 phase 设置

**文件**：`apps/web/src/stores/hatch.ts`

**当前代码**（第 657-665 行）：

```typescript
set({ engines })
const proposals = get().proposals
if (proposals.length > 0) {
  const pending = proposals.filter((p) => p.status === 'pending')
  if (phaseBeforeFetch !== 'streaming') {
    set({ phase: pending.length > 0 ? 'waiting' : get().phase })
  }
}
```

**改为**：

```typescript
// 只更新 engines，不碰 phase
set({ engines })
```

#### 4.2.4 handleWSEvent 存储细化上下文

**文件**：`apps/web/src/stores/hatch.ts`

**当前代码**（第 258-264 行）：

```typescript
case 'engine_started': {
  const engineName = payload.node as string
  if (engineName && engineName !== 'refinement') {
    set({ currentEngine: engineName, phase: 'streaming', streamText: '' })
  }
  break
}
```

**改为**：

```typescript
case 'engine_started': {
  const engineName = payload.node as string
  if (engineName) {
    set({
      currentEngine: engineName,
      phase: 'streaming',
      streamText: '',
      _refinementContext: (payload.refinement as { parentName: string; parentScale: string; targetScale: string }) || null,
    })
  }
  break
}
```

#### 4.2.5 handleWSEvent 中 engine_done 正确衔接

**文件**：`apps/web/src/stores/hatch.ts`

**当前代码**（第 316-339 行）：

```typescript
case 'engine_done': {
  const engine = payload.engine as string
  const existingJobId = Object.entries(get().activeLLMJobs).find(
    ([id]) => !id.endsWith(':ws')
  )?.[0]
  const jobId = existingJobId || `engine:${engine}:ws`
  get().updateLLMJob(jobId, { active: false })
  const projectId = get().proposals[0]?.projectId
  if (projectId) {
    get().fetchProposals(projectId).then(() => {
      const pending = get().proposals.filter((p) => p.status === 'pending')
      if (pending.length > 0) {
        set({ phase: 'waiting', autoPopupProposalId: pending[0].id, currentEngine: null, streamText: '' })
      } else {
        set({ phase: 'waiting', currentEngine: null, streamText: '' })
      }
    })
    get().fetchEngines(projectId)
  } else {
    set({ phase: 'waiting', currentEngine: null, streamText: '' })
  }
  break
}
```

**改为**：

```typescript
case 'engine_done': {
  const engine = payload.engine as string
  const existingJobId = Object.entries(get().activeLLMJobs).find(
    ([id]) => !id.endsWith(':ws')
  )?.[0]
  const jobId = existingJobId || `engine:${engine}:ws`
  get().updateLLMJob(jobId, { active: false })
  const projectId = get().proposals[0]?.projectId
  if (projectId) {
    get().fetchProposals(projectId).then(() => {
      const pending = get().proposals.filter((p) => p.status === 'pending')
      if (pending.length > 0) {
        set({ phase: 'waiting', autoPopupProposalId: pending[0].id, currentEngine: null, streamText: '', _refinementContext: null })
      } else {
        // 无 pending → 后端可能在运行下一引擎，不清 phase，等待新事件
        set({ currentEngine: null, streamText: '', _refinementContext: null })
      }
    })
    get().fetchEngines(projectId)
  } else {
    set({ currentEngine: null, streamText: '', _refinementContext: null })
  }
  break
}
```

关键变化：
- 有 pending 时：正常切到 waiting
- 无 pending 时：只清 `currentEngine`/`streamText`/`_refinementContext`，**不**设置 `phase: 'waiting'`。保持当前 phase（streaming 等待下一个 engine_started，waiting 也合理）。

#### 4.2.6 新增动态标签生成函数

**文件**：`apps/web/src/utils/engineConfig.ts`

**新增函数**：

```typescript
/**
 * 获取引擎的友好显示标签
 * @param engineName 引擎名（如 'geography' 或 'geography:refine'）
 * @param refinementCtx 细化上下文（可选）
 * @returns 用户友好的显示标签
 */
export function getEngineDisplayLabel(
  engineName: string | null,
  refinementCtx?: { parentName: string; targetScale: string } | null
): string {
  if (!engineName) return '...'

  // 主引擎
  if (!engineName.includes(':refine')) {
    return engineLabelMap[engineName] || engineName
  }

  // 细化引擎
  const baseEngine = engineName.split(':')[0]
  const baseLabel = engineLabelMap[baseEngine] || baseEngine

  if (refinementCtx) {
    return `${baseLabel}细化：「${refinementCtx.parentName}」→ ${refinementCtx.targetScale}`
  }

  return `${baseLabel}细化`
}
```

#### 4.2.7 HatchingView 使用动态标签

**文件**：`apps/web/src/components/hatching/HatchingView.tsx`

**第 364 行**：

```typescript
// 当前
const currentEngineLabel = currentEngine ? (engineLabelMap[currentEngine] || currentEngine) : null

// 改为
const currentEngineLabel = getEngineDisplayLabel(currentEngine, _refinementContext)
```

**streaming 阶段空内容显示**（第 452 行）：

```typescript
// 当前
{streamText || 'AI 正在思考，请稍候...'}

// 改为
{streamText || (currentEngine?.includes(':refine')
  ? `AI 正在细化「${_refinementContext?.parentName || ''}」...`
  : 'AI 正在思考，请稍候...'
)}
```

#### 4.2.8 BottomBar 使用动态标签

**文件**：`apps/web/src/components/layout/BottomBar.tsx`

**第 93 行**：

```typescript
// 当前
生成:${engineLabelMap[currentEngine] || currentEngine}

// 改为
生成:${getEngineDisplayLabel(currentEngine)}
```

注意：BottomBar 组件需要能访问 `_refinementContext`。由于当前 BottomBar 只订阅了 `currentEngine`，不订阅 `_refinementContext`，有两种方案：

1. BottomBar 也订阅 `_refinementContext`
2. `currentEngine` 中直接包含显示标签（但这会改变数据格式）

推荐方案 1：BottomBar 增加对 `_refinementContext` 的订阅。

#### 4.2.9 approveProposal 中刷新项目数据

**文件**：`apps/web/src/stores/hatch.ts`

**当前代码**（第 846-852 行）：

```typescript
await Promise.all([
  get().fetchProposals(projectId),
  get().fetchEngines(projectId),
  get().fetchSettings(projectId),
])
```

**改为**：

```typescript
await Promise.all([
  get().fetchProposals(projectId),
  get().fetchEngines(projectId),
  get().fetchSettings(projectId),
])

// 审批可能更新了项目标题（如 tone 提案），刷新 project 数据
const { useProjectStore } = await import('./projects')
useProjectStore.getState().fetchProject?.(projectId)
```

#### 4.2.10 页面刷新状态恢复

**文件**：`apps/web/src/stores/hatch.ts`

在 `fetchProposals` 中增加恢复逻辑（紧接在状态分离代码之后）：

```typescript
// 页面恢复场景：当前为 idle 时，根据 proposals 数据恢复合理的 phase
if (get().phase === 'idle' && proposals.length > 0) {
  // 有历史提案但 phase 是 idle → 可能是页面刷新后的恢复
  const hasPending = proposals.some((p) => p.status === 'pending')
  if (hasPending) {
    set({ phase: 'waiting' })
  }
  // 无 pending 但已审批过 → 保守保持 idle，等待 /advance 或事件触发
}
```

或者在 `ProjectEditor.tsx` 中通过 `useEffect` 统一处理恢复逻辑。推荐在 `fetchProposals` 中处理，因为所有页面加载都会调用它。

---

## 5. 数据流示例

### 5.1 审批 tone 提案 → 自动细化

```
1. 用户在 MOU 中审批 tone 提案
   → 前端 POST /proposals/:id/approve
   → 后端：
     a. orchestrator.approveProposal → 创建 settingItems
     b. 更新 projects.title = 提案标题
     c. 异步调用 scheduler.onProposalsResolved
   → 后端返回 { success: true }

2. 前端 approveProposal：
   → 本地更新 proposals
   → Promise.all([fetchProposals, fetchEngines, fetchSettings])
   → fetchProposals 返回：只更新 proposals，不碰 phase
   → 刷新 project 数据（标题更新）

3. 后端 onProposalsResolved：
   → 发现有待细化条目
   → 调用 runRefinementLoop → runRefinementEngine
   → emit engine_started { node: "geography:refine", payload: { refinement: {...} } }

4. 前端 WS engine_started：
   → handleWSEvent
   → set({ phase: 'streaming', currentEngine: 'geography:refine', _refinementContext: {...} })
   → HatchingView 显示："AI 正在细化「巨城星图」→ 城市板块..."
   → BottomBar 显示："生成:地理环境细化：「巨城星图」→ city"

5. 后端细化完成：
   → stageProposals → 提案写入 DB
   → emit engine_done
   → emit proposals_staged

6. 前端 WS proposals_staged：
   → handleWSEvent → fetchProposals
   → fetchProposals 返回：pending > 0
   → 由于 phase 当前是 'streaming'，不覆盖（状态分离）
   → 但 proposals_staged 事件本身不设置 phase

7. 前端 WS engine_done：
   → handleWSEvent
   → fetchProposals().then(() => {
       pending > 0 → set({ phase: 'waiting', autoPopupProposalId: pending[0].id, currentEngine: null })
     })
   → MOU 弹窗弹出，显示细化生成的子条目提案
```

### 5.2 页面刷新恢复

```
1. 用户刷新页面
2. ProjectEditor mount → 调用 fetchProposals
3. fetchProposals 返回：
   → proposals 有数据，phase 当前是 idle
   → 恢复逻辑：有 pending → set({ phase: 'waiting' })
   → 无 pending → 保持 idle（等待用户操作或事件）
4. 如果有 running 引擎，后端 WS engine_started 会随后到达，正确设置 phase
```

---

## 6. 边界情况

| 场景 | 预期行为 |
|------|---------|
| fetchProposals 在 engine_started 之前返回 | fetch 不设置 phase，engine_started 到达后正确设置 streaming |
| fetchProposals 在 engine_started 之后返回 | fetch 检测到 phase 不为 idle，不覆盖。保持 streaming |
| engine_done 后没有 pending（细化完成） | currentEngine 清空，phase 保持原样。等待 runMissingEngines 触发下一个 engine_started |
| engine_done 后有 pending（细化生成新提案） | phase 设为 waiting，弹出 MOU |
| 多个细化条目连续运行 | 每个细化 engine_done 后，fetchProposals 发现无 pending（当前批次的），phase 不清。下一个 engine_started 到达后重新设置 streaming |
| 页面刷新时后端正在运行细化 | fetchProposals 恢复为 idle/waiting，随后 WS engine_started 到达，正确设置 streaming |
| 审批非 tone 提案 | 不更新 projects.title |
| 驳回细化提案 | 触发 reviseProposal → sourceNode 为引擎名（如 'geography'），重新运行该引擎 |

---

## 7. 测试要点

1. **标题同步**：审批 tone 提案后，HatchingView 标题立即更新为新内容
2. **状态分离**：fetchProposals 返回时，不覆盖 WS engine_started 设置的 streaming
3. **细化显示**：细化引擎运行时，HatchingView 显示"细化「xxx」→ yyy"而非技术标识
4. **BottomBar 显示**：细化运行时底部状态栏显示友好的细化标签
5. **engine_done 衔接**：细化完成后，如果有 pending 提案，正确弹出 MOU
6. **engine_done 无 pending**：细化完成后无 pending，不清 phase，等待下一事件
7. **页面刷新**：刷新页面后，根据 proposals 状态恢复正确的 phase
8. **主引擎流式**：主引擎运行时 streaming 状态正常，不受 fetch 影响
9. **审批后流转**：tone 审批 → 细化 → 细化审批 → geography 运行的完整流程
10. **驳回细化**：驳回细化提案后，重新运行细化引擎，显示正确

---

## 8. 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `apps/server/src/routes/hatch.ts` | 修改 | 审批 handler 中同步更新 projects.title |
| `packages/pipeline/src/scheduler.ts` | 修改 | runRefinementEngine emit 事件附带细化上下文 |
| `apps/web/src/stores/hatch.ts` | 修改 | 状态分离 + handleWSEvent 增强 + approveProposal 刷新 project |
| `apps/web/src/utils/engineConfig.ts` | 新增 | getEngineDisplayLabel 函数 |
| `apps/web/src/components/hatching/HatchingView.tsx` | 修改 | 使用动态标签 + 细化引擎空内容文案 |
| `apps/web/src/components/layout/BottomBar.tsx` | 修改 | 使用动态标签 + 订阅细化上下文 |
