# 修复孵化阶段静默失败 —— 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复导致 tone 引擎及后续世界引擎流式输出结束后无 MOU 弹窗、回退到"正在准备..."状态的 5 个相互关联的根因。

**Architecture:** 这是一个"补丁式修复"计划——不重构架构，只修复已识别的具体缺陷。修复集中在 3 个文件：`packages/llm-client/src/client.ts`（tier 配置）、`packages/engines/src/base.ts`（JSON 扫描 + 工具模式 + 错误传播）、`apps/web/src/stores/hatch.ts`（前端错误展示）。

**Tech Stack:** TypeScript, pnpm monorepo, OpenAI SDK (DeepSeek API), Zustand

---

## 文件结构映射

| 文件 | 当前职责 | 计划修改 |
|------|---------|---------|
| `packages/llm-client/src/client.ts` | LLMClient.stream() — 硬编码 `tier="lightweight"` | 恢复使用 `options.tier` |
| `packages/engines/src/base.ts` | Engine 基类 — streamRun、parseJsonProposals、_hasCompleteProposals、streamRunWithTools | 修复 JSON 扫描、为无依赖引擎禁用工具模式、parseOutput 失败时发送 error 事件 |
| `packages/engines/src/world/tone/generator.ts` | ToneEngine — 世界观基调引擎 | 覆盖 `usesToolBasedContext()` 返回 `false` |
| `apps/web/src/stores/hatch.ts` | 孵化状态管理 — _executeEngineSSE、fetchProposals | 增加 proposalCount===0 时的错误状态 |
| `apps/web/src/components/hatching/HatchingView.tsx` | 孵化流程 UI | 增加错误状态渲染分支 |

---

### Task 1: 修复 LLMClient 强制 lightweight 模型

**问题根因：** `LLMClient.stream()` 中硬编码 `const tier = "lightweight"`，无视引擎通过 `getModelTier()` 配置的 `"pro"` tier。

**Files:**
- Modify: `packages/llm-client/src/client.ts:59-62`

- [ ] **Step 1: 修改 stream() 方法，恢复使用 options.tier**

```typescript
// 修改前（packages/llm-client/src/client.ts:55-69）
  async *stream(
    messages: Message[],
    options: LLMOptions & { tier?: ModelTier; timeoutMs?: number }
  ): AsyncGenerator<LLMStreamChunk> {
    // 开发阶段：强制使用轻量模型以节省成本，上线前恢复为动态 tier 切换
    const tier = "lightweight";
    const provider = options.provider || this.lightweightProvider;

// 修改后
  async *stream(
    messages: Message[],
    options: LLMOptions & { tier?: ModelTier; timeoutMs?: number }
  ): AsyncGenerator<LLMStreamChunk> {
    // 使用引擎配置的 tier，默认 lightweight
    const tier = options.tier || "lightweight";
    const provider = options.provider || (
      tier === "pro" ? this.proProvider : this.lightweightProvider
    );
```

- [ ] **Step 2: 验证编译通过**

Run: `cd "C:/Users/10652/Documents/person/NarrativeOS/narrative-os" && pnpm --filter @narrative-os/llm-client build`
Expected: 编译成功，无类型错误

- [ ] **Step 3: Commit**

```bash
git add packages/llm-client/src/client.ts
git commit -m "fix: 恢复 LLMClient 使用引擎配置的 tier 模型

修复强制 lightweight 覆盖 pro tier 的问题，tone 等需要 pro 模型的引擎现在会正确调用 pro 模型。"
```

---

### Task 2: 修复 parseJsonProposals 的 JSON 字符串扫描 Bug

**问题根因：** `parseJsonProposals` 使用简单的 `{`/`}` 字符计数来找到 JSON 结束位置，没有处理 JSON 字符串内部的大括号（如 `"规则：{特殊标记}"`），导致解析范围计算错误。

**Files:**
- Modify: `packages/engines/src/base.ts:270-351`（parseJsonProposals 方法）

- [ ] **Step 1: 添加 JSON 字符串感知的大括号计数辅助函数**

在 `packages/engines/src/base.ts` 中，`trimMessagesByBudget` 函数之后、`parseJsonProposals` 方法之前，添加以下辅助函数：

```typescript
/**
 * JSON 字符串感用的括号匹配 — 正确跳过字符串内部的 { 和 }
 * 返回从 startIdx 开始的外层 JSON 对象的结束索引（exclusive），找不到返回 -1
 */
function findJsonObjectEnd(raw: string, startIdx: number): number {
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIdx; i < raw.length; i++) {
    const ch = raw[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (ch === "\\") {
      escapeNext = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{" || ch === "[") {
      depth++;
    } else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        return i + 1;
      }
    }
  }

  return -1;
}
```

- [ ] **Step 2: 替换 parseJsonProposals 中的策略1扫描逻辑**

在 `packages/engines/src/base.ts` 的 `parseJsonProposals` 方法中，替换策略1的扫描代码：

```typescript
// 修改前（base.ts 策略1，约第275-291行）
      const proposalsMatch = cleaned.match(/\{\s*"proposals"\s*:\s*\[/);
      if (proposalsMatch) {
        const startIdx = proposalsMatch.index!;
        let depth = 0;
        let endIdx = -1;
        for (let i = startIdx; i < cleaned.length; i++) {
          if (cleaned[i] === "{") depth++;
          else if (cleaned[i] === "}") {
            depth--;
            if (depth === 0) { endIdx = i + 1; break; }
          }
        }
        if (endIdx !== -1) {
          const json = cleaned.substring(startIdx, endIdx);
          const proposals = JSON.parse(json).proposals || [];
          return proposals.slice(0, maxProposals);
        }
      }

// 修改后
      const proposalsMatch = cleaned.match(/\{\s*"proposals"\s*:\s*\[/);
      if (proposalsMatch) {
        const startIdx = proposalsMatch.index!;
        const endIdx = findJsonObjectEnd(cleaned, startIdx);
        if (endIdx !== -1) {
          const json = cleaned.substring(startIdx, endIdx);
          const proposals = JSON.parse(json).proposals || [];
          return proposals.slice(0, maxProposals);
        }
      }
```

- [ ] **Step 3: 替换 parseJsonProposals 中的策略3回退扫描逻辑**

同样在 `parseJsonProposals` 方法中，替换策略3的扫描代码：

```typescript
// 修改前（策略3，约第328-343行）
      const firstBrace = cleaned.indexOf("{");
      if (firstBrace === -1) throw new Error("No JSON found");
      let depth = 0;
      let endIdx = -1;
      for (let i = firstBrace; i < cleaned.length; i++) {
        if (cleaned[i] === "{") depth++;
        else if (cleaned[i] === "}") {
          depth--;
          if (depth === 0) { endIdx = i + 1; break; }
        }
      }

// 修改后
      const firstBrace = cleaned.indexOf("{");
      if (firstBrace === -1) throw new Error("No JSON found");
      const endIdx = findJsonObjectEnd(cleaned, firstBrace);
```

- [ ] **Step 4: 替换 _hasCompleteProposals 中的扫描逻辑**

在 `packages/engines/src/base.ts` 的 `_hasCompleteProposals` 方法中，替换两处扫描代码。

第一处（约第368-382行）：

```typescript
// 修改前
      const proposalsMatch = cleaned.match(/\{\s*"proposals"\s*:\s*\[/);
      if (proposalsMatch) {
        const startIdx = proposalsMatch.index!;
        let depth = 0;
        let endIdx = -1;
        for (let i = startIdx; i < cleaned.length; i++) {
          if (cleaned[i] === "{") depth++;
          else if (cleaned[i] === "}") {
            depth--;
            if (depth === 0) { endIdx = i + 1; break; }
          }
        }
        if (endIdx !== -1) {
          const parsed = JSON.parse(cleaned.substring(startIdx, endIdx));
          const proposals = parsed.proposals || [];
          return proposals.length >= 2;
        }
      }

// 修改后
      const proposalsMatch = cleaned.match(/\{\s*"proposals"\s*:\s*\[/);
      if (proposalsMatch) {
        const startIdx = proposalsMatch.index!;
        const endIdx = findJsonObjectEnd(cleaned, startIdx);
        if (endIdx !== -1) {
          const parsed = JSON.parse(cleaned.substring(startIdx, endIdx));
          const proposals = parsed.proposals || [];
          return proposals.length >= 2;
        }
      }
```

第二处（约第388-407行，独立 JSON 对象提取）：

```typescript
// 修改前
      const typeRegex = /\{\s*"type"\s*:\s*"/g;
      let match;
      let count = 0;
      while ((match = typeRegex.exec(cleaned)) !== null) {
        const startIdx = match.index;
        let depth = 0;
        let endIdx = -1;
        for (let i = startIdx; i < cleaned.length; i++) {
          if (cleaned[i] === "{") depth++;
          else if (cleaned[i] === "}") {
            depth--;
            if (depth === 0) { endIdx = i + 1; break; }
          }
        }
        if (endIdx !== -1) {
          try {
            const proposal = JSON.parse(cleaned.substring(startIdx, endIdx));
            if (proposal.type && proposal.content) count++;
          } catch { /* skip */ }
        }
      }

// 修改后
      const typeRegex = /\{\s*"type"\s*:\s*"/g;
      let match;
      let count = 0;
      while ((match = typeRegex.exec(cleaned)) !== null) {
        const startIdx = match.index;
        const endIdx = findJsonObjectEnd(cleaned, startIdx);
        if (endIdx !== -1) {
          try {
            const proposal = JSON.parse(cleaned.substring(startIdx, endIdx));
            if (proposal.type && proposal.content) count++;
          } catch { /* skip */ }
        }
      }
```

- [ ] **Step 5: 验证编译通过**

Run: `cd "C:/Users/10652/Documents/person/NarrativeOS/narrative-os" && pnpm --filter @narrative-os/engines build`
Expected: 编译成功

- [ ] **Step 6: Commit**

```bash
git add packages/engines/src/base.ts
git commit -m "fix: 修复 parseJsonProposals 和 _hasCompleteProposals 的 JSON 字符串扫描 bug

添加 JSON 字符串感知的括号匹配函数 findJsonObjectEnd，正确跳过字符串内部的 { 和 }，避免解析范围计算错误导致 JSON 解析失败。"
```

---

### Task 3: 为 ToneEngine 禁用工具模式

**问题根因：** 所有引擎默认 `usesToolBasedContext() = true`。Tone 引擎没有依赖（`dependsOn: []`），不需要查询任何世界观数据，但工具指南鼓励 LLM "先查询再生成"，导致 LLM 可能反复调用空查询。

**Files:**
- Modify: `packages/engines/src/world/tone/generator.ts:14-17`

- [ ] **Step 1: 在 ToneEngine 中覆盖 usesToolBasedContext 返回 false**

```typescript
// 在 packages/engines/src/world/tone/generator.ts 中，getModelTier() 之后添加：

export class ToneEngine extends Engine {
  constructor() { super("tone"); }
  protected getModelTier(): "lightweight" | "pro" { return "pro"; }
  protected getContextEngines(): string[] { return []; }
  protected usesToolBasedContext(): boolean {
    return false;  // tone 没有依赖，不需要查询数据
  }
```

- [ ] **Step 2: 验证编译通过**

Run: `cd "C:/Users/10652/Documents/person/NarrativeOS/narrative-os" && pnpm --filter @narrative-os/engines build`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add packages/engines/src/world/tone/generator.ts
git commit -m "fix: 为 ToneEngine 禁用工具模式

tone 引擎没有依赖引擎，不需要查询世界观数据。禁用工具模式避免 LLM 被误导反复调用 query_world_setting 查询空数据集。"
```

---

### Task 4: parseOutput 失败时发送明确的 error SSE 事件

**问题根因：** `parseJsonProposals` 解析失败时返回 `{type: "error", ...}` 提案，被 `stageProposals` 跳过。前端看不到任何错误，只是静默显示"正在准备..."。

**Files:**
- Modify: `packages/engines/src/base.ts:555-580`（streamRun 的 done 处理）
- Modify: `packages/engines/src/base.ts:793-820`（streamRunWithTools 的 done 处理）

- [ ] **Step 1: 在 streamRun 中，parseOutput 后检查提案有效性**

在 `packages/engines/src/base.ts` 的 `streamRun` 方法中（约第559-580行），找到：

```typescript
      const proposals = this.parseOutput(raw);
      // 细化模式：强制注入 scale 和 needs_refinement
      this.injectRefinementMeta(proposals, ctx);
```

替换为：

```typescript
      const proposals = this.parseOutput(raw);

      // 如果解析失败（返回 error 提案或空数组），发送明确的 error 事件
      if (proposals.length === 0 || proposals.every((p) => p.type === "error")) {
        const errorMsg = proposals.length > 0
          ? `引擎 ${this.name} 解析失败：${proposals[0]?.content?.reasoning || "无法解析 LLM 输出"}`
          : `引擎 ${this.name} 未生成任何提案`;
        yield {
          type: "error",
          message: errorMsg,
          fallbackTier: currentTier,
        };
        const result: EngineResult = {
          proposals: [],
          latencyMs: Date.now() - startTime,
          pipeline: {
            systemPrompt: fullSystemPrompt,
            userPrompt: userMessage,
            rawOutput: raw,
            model: capturedModel,
            promptTokens: finalPromptTokens,
            completionTokens: finalCompletionTokens,
            totalTokens: capturedUsage?.totalTokens || (finalPromptTokens + finalCompletionTokens),
            latencyMs: Date.now() - startTime,
          },
        };
        yield { type: "done", result };
        return result;
      }

      // 细化模式：强制注入 scale 和 needs_refinement
      this.injectRefinementMeta(proposals, ctx);
```

- [ ] **Step 2: 在 streamRunWithTools 中，parseOutput 后检查提案有效性**

在 `packages/engines/src/base.ts` 的 `streamRunWithTools` 方法中（约第800-820行），找到：

```typescript
      const proposals = this.parseOutput(rawOutput);
      this.injectRefinementMeta(proposals, ctx);
```

替换为：

```typescript
      const proposals = this.parseOutput(rawOutput);

      // 如果解析失败，发送明确的 error 事件
      if (proposals.length === 0 || proposals.every((p) => p.type === "error")) {
        const errorMsg = proposals.length > 0
          ? `引擎 ${this.name} 解析失败：${proposals[0]?.content?.reasoning || "无法解析 LLM 输出"}`
          : `引擎 ${this.name} 未生成任何提案`;
        yield {
          type: "error",
          message: errorMsg,
          fallbackTier: currentTier,
        };
        const finalPromptTokens = capturedUsage?.promptTokens || estimateTokens(fullSystemPrompt + userMessage);
        const finalCompletionTokens = capturedUsage?.completionTokens || estimateTokens(rawOutput);
        const result: EngineResult = {
          proposals: [],
          latencyMs: Date.now() - startTime,
          pipeline: {
            systemPrompt: fullSystemPrompt,
            userPrompt: userMessage,
            rawOutput: rawOutput,
            model: capturedModel,
            promptTokens: finalPromptTokens,
            completionTokens: finalCompletionTokens,
            totalTokens: capturedUsage?.totalTokens || (finalPromptTokens + finalCompletionTokens),
            latencyMs: Date.now() - startTime,
          },
        };
        yield { type: "done", result };
        return result;
      }

      this.injectRefinementMeta(proposals, ctx);
```

- [ ] **Step 3: 验证编译通过**

Run: `cd "C:/Users/10652/Documents/person/NarrativeOS/narrative-os" && pnpm --filter @narrative-os/engines build`
Expected: 编译成功

- [ ] **Step 4: Commit**

```bash
git add packages/engines/src/base.ts
git commit -m "fix: parseOutput 失败时发送明确的 error SSE 事件

当引擎未能生成有效提案时，不再静默返回空数组，而是通过 SSE error 事件将错误信息传递给前端，避免用户看到无尽的'正在准备...'。"
```

---

### Task 5: 前端增加 proposalCount===0 时的错误状态展示

**问题根因：** `_executeEngineSSE` 完成后的状态回退逻辑把"解析失败"和"正常等待"视为同一种情况，都显示"正在准备..."。

**Files:**
- Modify: `apps/web/src/stores/hatch.ts:490-498`
- Modify: `apps/web/src/components/hatching/HatchingView.tsx:543-632`

- [ ] **Step 1: 在 _executeEngineSSE 中，当 proposalCount===0 时设置明确的错误**

在 `apps/web/src/stores/hatch.ts` 的 `_executeEngineSSE` 方法中，找到 done 事件处理（约第436-464行）：

```typescript
        onDone: (parsed) => {
          // 从后端返回的数据中提取实际引擎名
          const backendEngine = parsed.engine as string
          const effectiveEngine = backendEngine || engine
          if (effectiveEngine && effectiveEngine !== 'advance') {
            if (!get().currentEngine || get().currentEngine === 'advance') {
              set({ currentEngine: effectiveEngine })
            }
          }
          // 更新 LLM job 标签
          const engines = get().engines
          const displayEngine = get().currentEngine || effectiveEngine
          const engLabel = engines.find((e: any) => e.name === displayEngine)?.label || displayEngine
          if (engLabel) get().updateLLMJob(jobId, { jobLabel: engLabel } as any)

          // 嵌入提案
          if (parsed.proposals && Array.isArray(parsed.proposals)) {
            const existingIds = new Set(get().proposals.map((p) => p.id))
            const embedded: Proposal[] = (parsed.proposals as any[])
              .filter((p: any) => !existingIds.has(p.id))
              .map((p: any) => ({
                ...p, projectId,
                sourceNode: p.sourceNode || displayEngine || engine,
                content: p.content || { reasoning: p.reasoning },
                createdAt: new Date().toISOString(),
              }))
            if (embedded.length > 0) set({ proposals: [...get().proposals, ...embedded] })
          }

          // 新增：检查 proposalCount，如果为 0 且没有 error 字段，记录错误
          const proposalCount = (parsed.proposalCount as number) ?? 0
          if (proposalCount === 0 && !parsed.error) {
            set({ error: `引擎运行完成，但未生成任何提案。可能原因：LLM 输出格式不正确或解析失败。` })
          }
        },
```

- [ ] **Step 2: 在 _executeEngineSSE 的 finally 块中，当 finalPending 为空且 proposals 不为空时检查是否是错误**

在 `apps/web/src/stores/hatch.ts` 的 `_executeEngineSSE` 方法中，找到 SSE 完成后的处理（约第467-498行），修改最后的 else 分支：

```typescript
// 修改前
      } else {
        // 无 pending 提案 → 后端自动推进中（细化循环/下一引擎），前端保持等待
        set({ phase: 'waiting', streamText: '', currentEngine: null })
      }

// 修改后
      } else if (get().error) {
        // 有错误信息 → 保持等待但显示错误
        set({ phase: 'waiting', streamText: '', currentEngine: null })
      } else {
        // 无 pending 提案且无错误 → 后端自动推进中
        set({ phase: 'waiting', streamText: '', currentEngine: null })
      }
```

- [ ] **Step 3: 在 HatchingView 的 waiting 状态渲染中，增加错误信息展示**

在 `apps/web/src/components/hatching/HatchingView.tsx` 中，找到 waiting 状态的渲染代码（约第543-632行），在返回的 JSX 中，在"Action prompt" div 之前添加错误展示：

```tsx
        {/* Error display */}
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
```

将其插入到现有的 Action prompt div 之前，即约第595行（`{pending.length > 0 ? (` 之前）。

具体插入位置：在 `</details>` 结束标签之后，`<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, ...` 开始之前。

- [ ] **Step 4: 验证前端编译通过**

Run: `cd "C:/Users/10652/Documents/person/NarrativeOS/narrative-os" && pnpm --filter @narrative-os/web build`
Expected: 编译成功

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/stores/hatch.ts apps/web/src/components/hatching/HatchingView.tsx
git commit -m "fix: 前端增加引擎空提案时的错误状态展示

当引擎运行完成但未生成提案时，不再显示模糊的'正在准备...'，而是显示具体错误信息和重试按钮。"
```

---

## Self-Review

### 1. Spec Coverage

| 根因 | 任务 | 状态 |
|------|------|------|
| LLMClient 强制 lightweight | Task 1 | ✅ 覆盖 |
| parseJsonProposals JSON 扫描 bug | Task 2 | ✅ 覆盖 |
| _hasCompleteProposals 相同 bug | Task 2 | ✅ 覆盖 |
| 工具模式与无依赖引擎冲突 | Task 3 | ✅ 覆盖 |
| error 提案被静默跳过 | Task 4 | ✅ 覆盖 |
| 前端不区分等待和错误 | Task 5 | ✅ 覆盖 |

### 2. Placeholder Scan

- 无 "TBD"、"TODO"、"implement later"
- 所有代码修改都包含完整的代码块
- 所有步骤都包含具体的文件路径和行号
- 没有模糊的 "add appropriate error handling"

### 3. Type Consistency

- `findJsonObjectEnd` 参数类型 `(raw: string, startIdx: number): number` 在所有调用处一致
- `usesToolBasedContext(): boolean` 返回类型与基类一致
- `Proposal` 类型在前后端代码中没有新增字段，保持一致
- `HatchPhase` 没有新增值，错误展示使用现有的 `error` 字段

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-27-fix-hatching-silent-failure.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
