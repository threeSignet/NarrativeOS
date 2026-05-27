# 孵化阶段 UI 简化与细化 MOU 审批 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 简化孵化阶段前端展示，修复引擎重复调度，恢复自动细化循环，细化提案走 MOU 审批。

**Architecture:** 最小改动方案。前端只改 HatchingView.tsx 的 waiting/waiting_phase_confirmation 渲染分支；后端只改 scheduler.ts 的三处逻辑（引擎过滤、自动细化、去掉自动审批）。

**Tech Stack:** TypeScript, React, pnpm monorepo, Zustand, Drizzle ORM

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/web/src/components/hatching/HatchingView.tsx` | 修改 | 简化 waiting / waiting_phase_confirmation 渲染逻辑 |
| `packages/pipeline/src/scheduler.ts` | 修改 | 引擎去重过滤、恢复自动细化、细化走 MOU |

---

### Task 1: 前端简化 waiting 阶段渲染

**Files:**
- Modify: `apps/web/src/components/hatching/HatchingView.tsx:545-651`

**Context:** 当前 `waiting` 阶段（第545-651行）包含 4 层元素：状态行、AI推理过程折叠面板、错误提示、Action prompt 大卡片。需要简化为和 `streaming` 阶段一致的布局：状态标题 + 流式输出框 + 错误提示。

- [ ] **Step 1: 替换 waiting 分支的渲染逻辑**

打开 `apps/web/src/components/hatching/HatchingView.tsx`，找到第545行的 `// ── WAITING ──` 注释，将第546-651行的整个 `return (...)` 替换为：

```tsx
    // ── WAITING ──
    const waitingEngine = currentEngine || pipeline.find((s) => s.status === 'waiting_approval')?.node || null
    const waitingLabel = waitingEngine ? (engineLabelMap[waitingEngine] || waitingEngine) : null

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 0' }}>
        {/* 状态标题 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {pending.length > 0 ? (
            <>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--accent-warm)',
                boxShadow: '0 0 8px var(--accent-warm)',
              }} />
              <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                「{waitingLabel || '...'}」方案待审批
              </span>
              <span style={{ fontSize: 12, color: 'var(--accent-warm)', fontWeight: 500 }}>
                {pending.length} 个方案
              </span>
            </>
          ) : (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-violet)' }} />
              <span style={{ fontSize: 14, color: 'var(--accent-violet)', fontWeight: 500 }}>
                正在准备「{waitingLabel || '下一阶段'}」...
              </span>
            </>
          )}
        </div>

        {/* 流式输出框 — 复用 streaming 阶段的样式 */}
        {displayText && (
          <div style={{
            height: 'calc(100vh - 400px)', minHeight: 280,
            padding: 20, borderRadius: 12,
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
            fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.8,
            color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', overflowY: 'auto',
          }}>
            {displayText}
          </div>
        )}

        {/* 错误提示 */}
        {hatchError && !pending.length && (
          <div style={{
            padding: '14px 18px', borderRadius: 10,
            background: 'rgba(252,165,165,0.06)', border: '1px solid rgba(252,165,165,0.15)',
            maxWidth: 480,
          }}>
            <div style={{ fontSize: 13, color: 'var(--accent-rose)', lineHeight: 1.6, marginBottom: 8 }}>
              {hatchError}
            </div>
            <button onClick={onStart} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8,
              background: 'rgba(252,165,165,0.12)', color: 'var(--accent-rose)',
              border: '1px solid rgba(252,165,165,0.25)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            }}>
              <Wand2 size={14} /> 重试
            </button>
          </div>
        )}
      </div>
    )
```

- [ ] **Step 2: 简化 waiting_phase_confirmation 阶段的布局**

找到第512行的 `// ── WAITING_PHASE_CONFIRMATION ──`，将内部的返回 JSX 中的内容区域简化为与 waiting 阶段一致的布局。保留"确认阶段完成"按钮，但将装饰性元素（大图标、居中标题等）改为更紧凑的样式。

将第512-543行替换为：

```tsx
    // ── WAITING_PHASE_CONFIRMATION ──
    if (phase === 'waiting_phase_confirmation') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 0' }}>
          {/* 状态标题 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--accent-warm)',
              boxShadow: '0 0 8px var(--accent-warm)',
            }} />
            <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
              「{engineLabelMap[phaseConfirmationTarget || ''] || phaseConfirmationTarget || '...'}」阶段完成，等待确认
            </span>
          </div>

          {/* 流式输出框 — 显示上次生成内容 */}
          {displayText && (
            <div style={{
              height: 'calc(100vh - 400px)', minHeight: 280,
              padding: 20, borderRadius: 12,
              background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
              fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.8,
              color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', overflowY: 'auto',
            }}>
              {displayText}
            </div>
          )}

          {/* 确认按钮 */}
          <button onClick={() => onCompletePhase?.(phaseConfirmationTarget || 'geography')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '14px 28px', borderRadius: 10,
            background: 'rgba(253,230,138,0.12)', color: 'var(--accent-warm)',
            border: '1px solid rgba(253,230,138,0.25)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            transition: 'all var(--duration) var(--ease)',
            alignSelf: 'center',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(253,230,138,0.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(253,230,138,0.12)' }}
          >
            <CheckCircle size={16} />
            确认阶段完成
          </button>
        </div>
      )
    }
```

- [ ] **Step 3: 验证前端 TypeScript 编译**

```bash
cd narrative-os/apps/web && npx tsc --noEmit
```

Expected: 无错误（0 errors）。

如果有 `Cannot find module` 错误，先运行 `pnpm install`。

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/hatching/HatchingView.tsx
git commit -m "feat: 简化孵化阶段 waiting 和 waiting_phase_confirmation 的 UI 布局

- 去掉 AI 推理过程折叠面板
- 去掉 Action prompt 大卡片
- 统一为状态标题 + 流式输出框 + 错误提示的三层结构
- waiting_phase_confirmation 同步简化

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 后端修复引擎重复调度

**Files:**
- Modify: `packages/pipeline/src/scheduler.ts:388-393`

**Context:** `runMissingEngines` 中 `getRunnableEngines` 只检查依赖是否满足，不检查引擎是否已有 `confirmed` 产出。需要增加过滤。

- [ ] **Step 1: 增加 confirmedEngines 过滤**

打开 `packages/pipeline/src/scheduler.ts`，找到第388-393行：

```typescript
    // 依赖图筛选：找出依赖已满足且未在跑的引擎
    const runnable = getRunnableEngines(confirmedEngines, pendingEngines);
    console.log(`[scheduler] Runnable engines: ${runnable.map((e) => e.name).join(", ") || "none"}`);

    // 只取属于孵化阶段的引擎
    const hatchRunnable = runnable.filter((e) => HATCH_ENGINE_NAMES.includes(e.name));
    console.log(`[scheduler] Hatch runnable: ${hatchRunnable.map((e) => e.name).join(", ") || "none"}`);
```

替换为：

```typescript
    // 依赖图筛选：找出依赖已满足且未在跑的引擎
    const runnable = getRunnableEngines(confirmedEngines, pendingEngines);
    console.log(`[scheduler] Runnable engines: ${runnable.map((e) => e.name).join(", ") || "none"}`);

    // 只取属于孵化阶段的引擎，且排除已有 confirmed 产出的引擎（防止重复调度）
    const hatchRunnable = runnable
      .filter((e) => HATCH_ENGINE_NAMES.includes(e.name))
      .filter((e) => !confirmedEngines.has(e.name));
    console.log(`[scheduler] Hatch runnable (filtered): ${hatchRunnable.map((e) => e.name).join(", ") || "none"}`);
```

- [ ] **Step 2: 验证后端 TypeScript 编译**

```bash
cd narrative-os/packages/pipeline && npx tsc --noEmit
```

Expected: 无错误（0 errors）。

- [ ] **Step 3: Commit**

```bash
git add packages/pipeline/src/scheduler.ts
git commit -m "fix: 过滤已有 confirmed 产出的引擎，防止重复调度

runMissingEngines 中 getRunnableEngines 只检查依赖是否满足，
不检查引擎是否已有 confirmed 产出。增加 .filter(e => !confirmedEngines.has(e.name))
防止 geography 等引擎被重复运行。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 后端恢复自动细化并走 MOU 审批

**Files:**
- Modify: `packages/pipeline/src/scheduler.ts:430-451` (onProposalsResolved)
- Modify: `packages/pipeline/src/scheduler.ts:457-507` (runRefinementLoop)

**Context:** `onProposalsResolved` 明确跳过了细化（第446行注释）。需要恢复自动细化调用。`runRefinementLoop` 中自动审批所有细化提案，需要改为 stage 后等待用户审批。

- [ ] **Step 1: 修改 onProposalsResolved 恢复自动细化**

找到 `onProposalsResolved` 方法（第430-451行），将第446-450行：

```typescript
    // 2. 不再自动运行细化循环 — 细化由用户手动触发
    //    用户通过前端按钮或 API 调用 scheduler.refineItem() 触发细化

    // 3. 没有 pending 且没有待细化 → 推进到下一个引擎
    await this.runMissingEngines(projectId);
```

替换为：

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

- [ ] **Step 2: 修改 runRefinementLoop 去掉自动审批**

找到 `runRefinementLoop` 方法（第457-507行），将整个方法体替换为：

```typescript
  private async runRefinementLoop(projectId: string): Promise<void> {
    const refinableItems = await this.getItemsNeedingRefinement(projectId);
    if (refinableItems.length === 0) {
      console.log(`[scheduler] 细化完成：无待细化条目`);
      // 细化全部完成，触发下一引擎
      await this.runMissingEngines(projectId);
      return;
    }

    const first = refinableItems[0];
    console.log(`[scheduler] 细化: ${first.engineSource}/${first.name} (${first.scale}→${first.targetScale})`);

    // 运行细化引擎
    const proposalIds = await this.refineItem(projectId, first.id);

    if (proposalIds.length === 0) {
      console.warn(`[scheduler] 细化循环：${first.name} 未产生提案，跳过`);
      // 清除父条目的 needs_refinement 防止死循环
      await db
        .update(settingItems)
        .set({ content: sql`jsonb_set(${settingItems.content}, '{needs_refinement}', 'false')`, updatedAt: new Date() })
        .where(eq(settingItems.id, first.id));
      // 递归继续下一个
      await this.runRefinementLoop(projectId);
      return;
    }

    // 关键改动：不再自动审批。提案已 stage 为 pending，等待用户 MOU 审批。
    // 用户审批后，approveProposal 端点会触发 onProposalsResolved，继续下一个细化条目。
    console.log(`[scheduler] 细化提案已 stage (${proposalIds.length} 个)，等待用户审批`);
    this.emit({ type: "proposals_staged", projectId, proposalIds });
  }
```

- [ ] **Step 3: 验证后端 TypeScript 编译**

```bash
cd narrative-os/packages/pipeline && npx tsc --noEmit
```

Expected: 无错误（0 errors）。

- [ ] **Step 4: Commit**

```bash
git add packages/pipeline/src/scheduler.ts
git commit -m "feat: 恢复自动细化循环，细化提案走 MOU 审批

- onProposalsResolved: pending 清空后自动检查待细化条目并启动细化
- runRefinementLoop: 去掉自动审批逻辑，提案 stage 为 pending 后停止
- 用户审批细化提案后，onProposalsResolved 再次被调用，继续下一个细化
- 所有细化完成后才推进到下一引擎

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 端到端验证

**Files:**
- None (manual verification)

- [ ] **Step 1: 启动 dev server**

确保数据库和 Redis 已启动：

```bash
cd narrative-os
pnpm db:up
```

启动开发服务器：

```bash
pnpm dev
```

Expected: 两个服务都启动成功
- `apps/server dev: NarrativeOS Phase 1 server running on http://localhost:3001`
- `apps/web dev: Local: http://localhost:5173/`

- [ ] **Step 2: 创建测试项目并验证 UI 简化**

1. 打开浏览器访问 `http://localhost:5173/`
2. 创建一个新项目（都市类型）
3. 进入孵化阶段，点击"开始世界引擎孵化"
4. **验证 tone 阶段**：
   - 页面应显示简洁的流式输出框（和修改前一致）
   - tone 完成后 MOU 弹窗出现
5. **验证 UI 简化（waiting 阶段）**：
   - 审批 tone 提案后，进入 geography 运行
   - geography 完成后，页面进入 waiting 阶段
   - **预期**：不再显示"AI推理过程（点击展开/收起）"折叠面板
   - **预期**：不再显示"MOU 弹窗提示"大卡片
   - **预期**：只显示状态标题 + 流式输出框
6. 审批 geography 提案

- [ ] **Step 3: 验证自动细化 + MOU 审批**

1. 审批 geography 顶层提案后，观察后端日志：
   - **预期日志**：`[scheduler] 发现 N 个待细化条目，启动细化...`
   - **预期日志**：`[scheduler] 细化: geography/xxx (continent→country)`
   - **预期日志**：`[scheduler] 细化提案已 stage (X 个)，等待用户审批`
2. 观察前端：
   - **预期**：MOU 弹窗自动弹出，显示细化生成的子条目提案
   - **预期**：审批细化提案后，如果还有待细化条目，继续弹出 MOU
3. 全部细化完成后：
   - **预期日志**：`[scheduler] 细化完成：无待细化条目`
   - **预期**：自动推进到下一引擎（power-system）

- [ ] **Step 4: 验证引擎不重复调度**

1. 观察 scheduler 日志：
   - **预期**：geography 完成后，日志应显示 `Hatch runnable (filtered): power-system`（不含 geography）
   - **预期**：不应再出现 `Running next engine: geography`

- [ ] **Step 5: 完成验证后停止服务**

```bash
# 按 Ctrl+C 停止 dev server
```

---

## Self-Review

### 1. Spec Coverage

| Spec 要求 | 对应 Task |
|-----------|----------|
| 前端 waiting 阶段去掉 AI 推理折叠面板 | Task 1, Step 1 |
| 前端 waiting 阶段去掉 Action prompt 大卡片 | Task 1, Step 1 |
| 前端统一为状态标题 + 流式输出框 + 错误提示 | Task 1, Step 1-2 |
| 后端修复引擎重复调度（confirmedEngines 过滤） | Task 2, Step 1 |
| 后端恢复自动细化（onProposalsResolved） | Task 3, Step 1 |
| 细化提案走 MOU 审批（runRefinementLoop） | Task 3, Step 2 |
| 端到端验证流程 | Task 4 |

**无遗漏。**

### 2. Placeholder Scan

- [x] 无 "TBD", "TODO", "implement later"
- [x] 无 "Add appropriate error handling" 等模糊描述
- [x] 每个代码步骤包含完整代码
- [x] 每个命令包含预期输出

### 3. Type Consistency

- `confirmedEngines` 是 `Set<string>`，`.has(e.name)` 正确使用
- `refinable` 是数组，`.length` 检查一致
- `proposalIds` 是 `string[]`，与 `proposals_staged` 事件格式一致

---

## 执行选项

**Plan complete and saved to `docs/superpowers/plans/2026-05-27-hatching-ui-simplify-and-refinement-mou.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
