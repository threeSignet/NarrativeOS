# 孵化阶段 UI 简化与细化 MOU 审批设计文档

> 日期：2026-05-27
> 范围：前端展示统一简化 + 后端细化自动流转 + 细化提案走 MOU 审批
> 关联问题：地理环境及后续引擎阶段前端展示复杂、引擎重复调度、细化未自动执行

---

## 1. 问题定义

### 1.1 前端展示不一致

- **世界观基调（tone）阶段**：`phase === 'streaming'` 时展示简洁——一个状态标题 + 流式输出框
- **地理环境及后续阶段**：`phase === 'waiting'` 时展示复杂——状态行 + AI 推理过程折叠面板 + Action prompt 大卡片 + 加载动画

用户期望：所有阶段的 UI 保持一致的简洁布局，只保留状态标题和流式输出框。

### 1.2 引擎重复调度

`runMissingEngines` 中 `getRunnableEngines` 只检查依赖是否满足，不检查引擎是否已有 `confirmed` 产出。导致 geography 顶层提案审批后，geography 引擎又被调度运行一次。

### 1.3 细化未自动执行

`onProposalsResolved` 明确注释"不再自动运行细化循环"，导致 geography 顶层审批后直接进入下一引擎（power-system），跳过了地理环境子条目的细化。

### 1.4 细化提案自动通过

`runRefinementLoop` 中调用 `orchestrator.approveProposal(pid, "细化自动审批")` 自动通过所有细化提案，用户无法参与子条目的方案选择。

---

## 2. 设计目标

1. **UI 统一**：所有孵化阶段（streaming / waiting / waiting_phase_confirmation）使用同一套简洁布局
2. **引擎去重**：已有 `confirmed` 产出的引擎不再被重复调度为主运行
3. **自动细化**：顶层提案审批后，自动触发细化循环生成子条目
4. **细化审批**：细化生成的提案走 MOU 审批，用户可选择、修改、驳回
5. **流程连贯**：细化完成后才进入下一引擎，保持"生成 → 审批 → 细化 → 审批 → 下一引擎"的节奏

---

## 3. 前端设计

### 3.1 改动文件

`apps/web/src/components/hatching/HatchingView.tsx`

### 3.2 统一渲染逻辑

将 `waiting` 阶段（第546-651行）的复杂 4 层结构简化为 3 层：

```
┌─ 状态标题行
│   streaming:  "AI 正在生成「地理环境」..."
│   waiting + pending:  "「地理环境」方案待审批 · 3 个方案"
│   waiting + no pending: "正在准备「力量体系」..."
├─ 流式输出框（显示 streamText / lastStreamText / displayText）
│   复用 streaming 阶段的样式：等宽字体、深色背景、自动滚动
└─ 错误提示（如有）+ 重试按钮
```

### 3.3 移除的元素

| 元素 | 位置 | 移除原因 |
|------|------|---------|
| AI 推理过程折叠面板 | 第576-595行 | 与流式输出框重复，增加认知负担 |
| Action prompt 大卡片 | 第619-649行 | "MOU 弹窗提示文字"和"加载动画"与状态标题重复 |
| `lastStreamText` 单独展示 | 状态管理 | 不再单独展示在折叠面板中，直接合并到输出框显示。`lastStreamText` 状态字段保留，用于引擎切换时保留参考内容 |

### 3.4 保留的元素

- MOU 弹窗触发机制（`autoPopupProposalId`）—— 只改变弹窗触发源，不改变弹窗本身
- `waiting_phase_confirmation` 的"确认阶段完成"按钮
- 错误提示和重试按钮
- PipelineBar 进度条（顶部导航不变）
- EngineMapPanel 数据地图（可折叠，不变）

### 3.5 `waiting_phase_confirmation` 同步简化

保留阶段确认按钮，但布局与 waiting 统一：状态标题 + 输出框（显示上次生成内容）+ 确认按钮。

---

## 4. 后端设计

### 4.1 改动文件

`packages/pipeline/src/scheduler.ts`

### 4.2 修改点 1：修复引擎重复调度（`runMissingEngines`）

**位置**：第388-393行

**当前代码**：

```typescript
const runnable = getRunnableEngines(confirmedEngines, pendingEngines);
const hatchRunnable = runnable.filter((e) => HATCH_ENGINE_NAMES.includes(e.name));
```

**问题**：`getRunnableEngines` 只检查依赖是否满足。geography 的依赖（tone）已满足，即使 geography 已有 confirmed 产出，仍会被认为是 runnable。

**修复**：在过滤后增加 `confirmedEngines` 排除：

```typescript
const runnable = getRunnableEngines(confirmedEngines, pendingEngines);
const hatchRunnable = runnable
  .filter((e) => HATCH_ENGINE_NAMES.includes(e.name))
  .filter((e) => !confirmedEngines.has(e.name));
console.log(`[scheduler] Hatch runnable (filtered): ${hatchRunnable.map((e) => e.name).join(", ") || "none"}`);
```

### 4.3 修改点 2：恢复自动细化（`onProposalsResolved`）

**位置**：第430-451行

**当前代码**：

```typescript
// 2. 不再自动运行细化循环 — 细化由用户手动触发
//    用户通过前端按钮或 API 调用 scheduler.refineItem() 触发细化

// 3. 没有 pending 且没有待细化 → 推进到下一个引擎
await this.runMissingEngines(projectId);
```

**修复**：pending 清空后，先检查待细化条目：

```typescript
// 2. 检查是否有待细化条目 → 自动运行细化
const refinable = await this.getItemsNeedingRefinement(projectId);
if (refinable.length > 0) {
  console.log(`[scheduler] 发现 ${refinable.length} 个待细化条目，启动细化...`);
  await this.runRefinementLoop(projectId);
  return;
}

// 3. 没有 pending 且没有待细化 → 推进到下一个引擎
await this.runMissingEngines(projectId);
```

### 4.4 修改点 3：细化走 MOU 审批（`runRefinementLoop`）

**位置**：第457-507行

**当前逻辑**：生成提案 → 自动审批全部 → 继续下一个细化条目

**新逻辑**：生成提案 → stage 为 pending → 停止等待用户审批 → 审批后继续

```typescript
private async runRefinementLoop(projectId: string): Promise<void> {
  const refinableItems = await this.getItemsNeedingRefinement(projectId);
  if (refinableItems.length === 0) {
    console.log(`[scheduler] 细化完成：无待细化条目`);
    await this.runMissingEngines(projectId);
    return;
  }

  const first = refinableItems[0];
  console.log(`[scheduler] 细化: ${first.engineSource}/${first.name} (${first.scale}→${first.targetScale})`);

  const proposalIds = await this.refineItem(projectId, first.id);

  if (proposalIds.length === 0) {
    console.warn(`[scheduler] 细化循环：${first.name} 未产生提案，跳过`);
    await db
      .update(settingItems)
      .set({ content: sql`jsonb_set(${settingItems.content}, '{needs_refinement}', 'false')`, updatedAt: new Date() })
      .where(eq(settingItems.id, first.id));
    await this.runRefinementLoop(projectId);
    return;
  }

  // 关键改动：不再自动审批。提案已 stage 为 pending，等待用户 MOU 审批。
  // 用户审批后，approveProposal 端点会触发 onProposalsResolved，继续下一个细化条目。
  console.log(`[scheduler] 细化提案已 stage (${proposalIds.length} 个)，等待用户审批`);
  this.emit({ type: "proposals_staged", projectId, proposalIds });
}
```

### 4.5 移除的代码

`runRefinementLoop` 中原有的自动审批逻辑（第483-496行）全部移除：

```typescript
// 移除以下代码：
// for (const pid of proposalIds) {
//   try {
//     await this.orchestrator.approveProposal(pid, "细化自动审批");
//     ...
//   }
// }
// bus.emit({ type: "setting.items_created" ... });
```

---

## 5. 完整数据流

### 5.1 主引擎流程（以 tone → geography 为例）

```
1. 用户点击"开始孵化"
   → advanceHatching → /advance
   → scheduler.getNextPhase → engine_ready: tone
   → runSingleEngine("tone") → streamRun
   → 前端：phase=streaming，显示流式输出

2. tone 完成，staged 3 个提案
   → proposals_staged WS 事件
   → 前端：fetchProposals → 发现 pending → phase=waiting，MOU 弹窗

3. 用户在 MOU 中审批 tone 提案
   → /proposals/:id/approve
   → handler 写入 settingItems，触发 onProposalsResolved
   → onProposalsResolved:
     a. 检查 pending → 无
     b. 检查 refinable → tone 条目 needs_refinement=true
     c. 调用 runRefinementLoop

4. runRefinementLoop 细化 tone 条目
   → refineItem → runRefinementEngine → run("tone", refinementContext)
   → 生成子条目提案 → stageProposals
   → 不自动审批，留在 pending
   → proposals_staged 事件
   → 前端：fetchProposals → 发现 pending → phase=waiting，MOU 弹窗

5. 用户审批细化提案
   → onProposalsResolved:
     a. 检查 pending → 无
     b. 检查 refinable → tone 子条目已细化完成，无更多
     c. 调用 runMissingEngines

6. runMissingEngines
   → confirmedEngines = {tone}
   → getRunnableEngines → geography（依赖 tone 已满足）
   → 过滤 confirmedEngines → geography 不在其中
   → 运行 geography
   → 前端：phase=streaming，显示流式输出

7. geography 完成...
   （循环重复步骤 2-6）
```

### 5.2 细化阶段的前端状态

细化引擎使用 `node.run(ctx)`（非流式），前端不会收到 `engine_chunk` 事件。因此细化期间：
- 前端 `phase` 保持 `waiting`
- 流式输出框显示 `lastStreamText`（上次主引擎的流式输出内容），作为上下文参考
- 底部状态栏通过 `activeLLMJobs` 显示细化任务运行中

细化完成后 `proposals_staged` 事件到达，前端 `fetchProposals` 发现 pending，弹出 MOU。

**设计决策**：保持细化非流式（改动最小）。细化通常是短文本生成（单一条目展开为子条目），不需要流式展示。如果未来需要，可将 `runRefinementEngine` 改为 `streamRun`。

---

## 6. 错误处理

### 6.1 细化未产生提案

`runRefinementLoop` 中如果 `proposalIds.length === 0`：
- 将父条目的 `needs_refinement` 设为 `false`
- 递归调用 `runRefinementLoop` 继续下一个条目
- 不阻塞整体流程

### 6.2 细化引擎运行失败

`runRefinementEngine` 的 catch 块已处理：
- 记录错误日志
- 发送 `engine_error` 事件到前端
- 返回空数组
- `runRefinementLoop` 会递归继续下一个条目

### 6.3 引擎重复运行（防御性）

即使 `runMissingEngines` 的过滤修复后，仍保留 `isRunning` 检查（第288-291行）作为最终防线：

```typescript
if (this.isRunning(projectId)) {
  console.log(`[scheduler] Project ${projectId} already has running engines, skip`);
  return;
}
```

### 6.4 前端错误展示

所有错误统一通过 `hatchError` 状态展示在流式输出框下方，保持布局一致。

---

## 7. 边界情况

| 场景 | 预期行为 |
|------|---------|
| 细化生成多个子条目提案 | 全部 stage 为 pending，MOU 弹窗让用户逐个或批量审批 |
| 用户驳回细化提案 | 触发 `rejectProposal` → 同引擎重新运行细化（revision） |
| 用户要求修改细化提案 | 触发 `reviseProposal` → 存储 revision notes → 重新细化 |
| 所有细化条目完成但还有 pending | 等待 pending 清空后再推进 |
| geography 阶段未确认完成 | 保持 `waiting_phase_confirmation`，不推进到后续引擎 |
| 项目从 idle 恢复（服务重启） | 检测 confirmed engines → 检查 refinable → 自动恢复细化或推进 |

---

## 8. 测试要点

1. **前端**：waiting 阶段不再显示 AI 推理过程折叠面板
2. **前端**：waiting 阶段显示 lastStreamText 在输出框中
3. **后端**：geography confirmed 后不再被 `runMissingEngines` 重复调度
4. **后端**：tone 审批后自动触发细化
5. **端到端**：细化提案到达前端时为 pending 状态，触发 MOU 弹窗
6. **端到端**：细化审批完成后才进入下一引擎
7. **端到端**：驳回细化提案后重新细化
