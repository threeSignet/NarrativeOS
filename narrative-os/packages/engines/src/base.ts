import { LLMClient, type Message, type ToolCall } from "@narrative-os/llm-client";
import type { Proposal, EngineContext, EngineResult, ToolCallEvent, ToolResultEvent } from "./types";
import { buildWorldContext, buildProjectMetaContext, buildDependencyNameRegistry } from "./context";
import { db, aiProposals, projects } from "@narrative-os/database";
import { eq, and } from "drizzle-orm";
import { executeToolCall } from "./engine-tool-executor";
import { buildQueryWorldSettingToolDef, buildToolSystemPromptSection } from "./tools";
import { getEngineDef } from "./engine-config";
import { loadCreationCharter, formatCharterForPrompt } from "./creation-charter";
import { injectGeoAnchors } from "./geo-anchor";

// Session-level concurrency lock
const locks = new Map<string, boolean>();

function acquireLock(sessionId: string): boolean {
  if (locks.get(sessionId)) return false;
  locks.set(sessionId, true);
  return true;
}

function releaseLock(sessionId: string): void {
  locks.delete(sessionId);
}

// Token estimation
function estimateTokens(text: string): number {
  let count = 0;
  for (const char of text) {
    count += char.charCodeAt(0) > 127 ? 1.5 : 0.3;
  }
  return Math.ceil(count);
}

function estimateMessagesTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
}

function trimMessagesByBudget(messages: Message[], budgetTokens: number): Message[] {
  if (messages.length <= 2) return messages;
  let currentTokens = estimateMessagesTokens(messages);
  if (currentTokens <= budgetTokens) return messages;

  // 保留 system prompt（index 0）和 user message（index last），交替从左右删除中间消息
  const result = [...messages];
  const lastIdx = result.length - 1;
  let left = 1;
  let right = lastIdx - 1;
  let toggle = false;

  while (currentTokens > budgetTokens && left <= right) {
    const removeIdx = toggle ? left++ : right--;
    const removed = result.splice(removeIdx, 1)[0];
    currentTokens -= estimateTokens(removed.content) + 4;
    right = Math.min(right, result.length - 2);
    toggle = !toggle;
  }

  // 最后手段：只保留 system prompt + user message
  if (currentTokens > budgetTokens && result.length > 2) {
    return [result[0], result[result.length - 1]];
  }
  return result;
}

/**
 * 工具循环专用消息裁剪器 — 在保持 tool call/result 配对完整性的前提下压缩历史。
 *
 * 裁剪策略（逐级加码）：
 * 1. 截断旧轮次的工具结果：只保留 item 的 name + summary，丢弃完整 content
 * 2. 仍超预算则整轮删除最旧的 assistant(tool_calls) + tool result 消息
 * 3. 始终保留首条 system prompt 和最新一轮工具交互
 */
function trimToolLoopMessages(messages: Message[], budgetTokens: number): Message[] {
  if (estimateMessagesTokens(messages) <= budgetTokens) return messages;

  // 定位所有工具轮次：assistant[tool_calls] + 紧随的 tool messages
  const rounds: Array<{ assistantIdx: number; toolIdxs: number[] }> = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i] as any;
    if (m.role === "assistant" && m.tool_calls?.length > 0) {
      const toolIdxs: number[] = [];
      for (let j = i + 1; j < messages.length && messages[j].role === "tool"; j++) {
        toolIdxs.push(j);
      }
      if (toolIdxs.length > 0) rounds.push({ assistantIdx: i, toolIdxs });
    }
  }

  if (rounds.length <= 1) return messages;

  const result = messages.map(m => ({ ...m }));

  // Phase 1：截断旧轮次（保留最新 2 轮完整），将工具结果缩减为 name + summary
  const truncateUntil = Math.max(0, rounds.length - 2);
  for (let r = 0; r < truncateUntil; r++) {
    if (estimateMessagesTokens(result) <= budgetTokens) break;
    for (const idx of rounds[r].toolIdxs) {
      try {
        const parsed = JSON.parse(result[idx].content);
        if (Array.isArray(parsed.items)) {
          parsed.items = parsed.items.map((it: any) => ({ name: it.name, summary: it.summary }));
          delete parsed.relations;
          parsed._truncated = true;
          result[idx] = { ...result[idx], content: JSON.stringify(parsed) };
        }
      } catch { /* 非 JSON，跳过 */ }
    }
  }

  // Phase 2：仍超预算 → 从最旧轮次开始整轮移除（assistant + 对应 tool messages 配对），
  // 保留最新 1 轮，确保不破坏 tool_call/tool_result 配对完整性
  while (estimateMessagesTokens(result) > budgetTokens && rounds.length > 1) {
    const oldest = rounds.shift()!;
    // 找到 assistant 消息和所有对应 tool 消息的索引，按降序排列安全删除
    const toRemove = [oldest.assistantIdx, ...oldest.toolIdxs].sort((a, b) => b - a);
    for (const idx of toRemove) {
      // 验证索引有效性，防止错位删除
      if (idx < result.length) {
        result.splice(idx, 1);
      }
    }
    const delta = toRemove.length;
    // 更新剩余轮次的索引偏移
    for (const round of rounds) {
      round.assistantIdx -= delta;
      round.toolIdxs = round.toolIdxs.map(i => i - delta);
    }
  }

  return result;
}

/**
 * JSON 字符串感知的括号匹配 — 正确跳过字符串内部的 { 和 }
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

export interface PipelineSnapshot {
  systemPrompt: string;
  userPrompt: string;
  rawOutput: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
}

/**
 * Engine — the only thing an engine does:
 *   1. Build a system prompt
 *   2. Call the LLM
 *   3. Parse the output into proposals
 */
export abstract class Engine {
  protected llm = new LLMClient();
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  /** v4.0: 引擎默认协作模式 */
  readonly defaultCollaborationMode: "plan" | "auto" | "full_auto" = "auto";

  /** v4.0: 当前执行模式 */
  protected currentMode: "plan" | "auto" | "full_auto" = "auto";

  /** Override: which model tier to use */
  protected getModelTier(): "lightweight" | "pro" {
    return "lightweight";
  }

  /** Override: token budget — 默认 200K，确保依赖引擎的全量上下文不会被裁剪 */
  protected getTokenBudget(): number {
    return 200000;
  }

  /** Override: proposal type for revision notes lookup（与 engine name 不同时需重写） */
  protected getProposalType(): string {
    return this.name.replace(/-/g, "_");
  }

  /** Override: which world engine outputs to include as context */
  protected getContextEngines(): string[] {
    return [];
  }

  /**
   * Override: 是否使用基于工具的上下文拉取（拉取模型）。
   * 默认 false（向后兼容）。返回 true 时：
   * - 不调用 injectMemory() 批量注入
   * - 系统提示中增加引擎地图 + query_world_setting 工具使用指南
   * - LLM 通过多轮工具调用按需拉取所需数据
   */
  protected usesToolBasedContext(): boolean {
    return false;
  }

  /**
   * 获取章节快照 ID（写作引擎覆盖使用）。
   * 返回非空时，query_world_setting 工具自动从该章节的快照查询数据。
   */
  protected getSnapshotChapterId(_ctx: EngineContext): string | undefined {
    return undefined;
  }

  /** Override: build the system prompt */
  abstract buildSystemPrompt(ctx: EngineContext): Promise<string>;

  /** Override: build a rich user message (the trigger prompt) */
  protected async buildUserMessage(ctx: EngineContext): Promise<string> {
    return ctx.caller;
  }

  /** Override: parse raw LLM output into proposals */
  abstract parseOutput(raw: string): Proposal[];

  /**
   * 强制注入 scale 和 needs_refinement：在细化模式下，确保所有 item
   * 都有正确的 scale 和 needs_refinement 字段，不依赖 LLM 输出。
   */
  protected injectRefinementMeta(proposals: Proposal[], ctx: EngineContext): Proposal[] {
    if (!ctx.refinement) return proposals;
    const targetScale = ctx.refinement.targetScale;

    for (const p of proposals) {
      const payload = (p.content?.payload || {}) as Record<string, unknown>;
      const items = (payload?.items || []) as Array<Record<string, unknown>>;
      for (const item of items) {
        const content = (item.content || {}) as Record<string, unknown>;
        if (content.scale === undefined || content.scale === null || content.scale === '') {
          content.scale = targetScale;
        }
        if (content.needs_refinement === undefined) {
          content.needs_refinement = true;
        }
        item.content = content;
      }
    }
    return proposals;
  }

  /**
   * 获取尺度的中文标签（共享工具方法，替代各引擎中的重复定义）
   */
  protected getScaleLabel(scale: string): string {
    const labels: Record<string, string> = {
      universe: "宇宙", galaxy: "星系", star_system: "恒星系", planet: "星球",
      continent: "大陆", region: "区域", city: "城市", district: "街区", scene: "场景",
    };
    return labels[scale] || scale;
  }

  /**
   * 保存当前执行上下文中的 refinement 信息，供 parseOutput 使用。
   * streamRun() 在开始时自动保存，子引擎通过 injectRefinementParentId() 使用。
   */
  protected currentRefinement: EngineContext["refinement"] = undefined;

  /**
   * 向 proposals 注入 _refinementParentId，将子条目挂到已有父条目下。
   * 子引擎在 parseOutput 中调用此方法即可，无需各自维护 currentRefinement。
   */
  protected injectRefinementParentId(proposals: Proposal[]): void {
    if (!this.currentRefinement) return;
    for (const p of proposals) {
      if (p.content?.payload && typeof p.content.payload === "object") {
        (p.content.payload as Record<string, unknown>)._refinementParentId = this.currentRefinement.parentItemId;
      }
    }
  }

  /**
   * v4.0: 解析当前应使用的协作模式
   */
  protected async resolveMode(ctx: EngineContext): Promise<"plan" | "auto" | "full_auto"> {
    if (ctx.collaborationMode) return ctx.collaborationMode;
    const [project] = await db
      .select({ collaborationMode: projects.collaborationMode })
      .from(projects)
      .where(eq(projects.id, ctx.projectId));
    if (project?.collaborationMode === "full_auto") return "full_auto";
    if (project?.collaborationMode === "plan") return "plan";
    // 优先使用引擎自身的默认协作模式
    const engineDef = getEngineDef(this.name);
    return engineDef?.defaultCollaborationMode || this.defaultCollaborationMode;
  }

  /**
   * v4.0: 将作者意图注入 system prompt
   */
  protected injectAuthorNotes(systemPrompt: string, authorNotes?: string): string {
    if (!authorNotes || authorNotes.trim().length === 0) return systemPrompt;
    return `${systemPrompt}\n\n## 作者意图\n作者对本次生成有以下想法和要求，请在生成方案时充分考虑：\n${authorNotes.trim()}`;
  }

  /**
   * v4.0: 规范化提案输出 — 强制注入 scale 和 geoAnchor
   */
  protected async normalizeProposals(proposals: Proposal[], ctx: EngineContext): Promise<Proposal[]> {
    proposals = this.injectRefinementMeta(proposals, ctx);
    proposals = await injectGeoAnchors(proposals, this.name, ctx);
    return proposals;
  }

  /**
   * v4.0: 构建带创作宪章的系统提示词
   */
  protected async buildSystemPromptWithCharter(ctx: EngineContext, basePrompt: string): Promise<string> {
    const charter = await loadCreationCharter(ctx.projectId);
    if (!charter) return basePrompt;
    const charterSection = formatCharterForPrompt(charter);
    return `${charterSection}\n\n${basePrompt}`;
  }

  /**
   * 通用 JSON 解析辅助方法 — 处理 markdown 代码块包裹的 JSON，
   * 提取 .proposals 数组。
   * - 优先查找 {"proposals": [...]} 包裹格式
   * - 回退：如果 LLM 输出了多个独立的 proposal JSON 对象（文本+JSON 混合），
   *   逐个提取并包装为 proposals 数组
   * - maxProposals 限制提案数量，防止 LLM 生成过多提案
   * - 解析失败时返回错误占位提案
   */
  protected parseJsonProposals(raw: string, errorLabel: string, maxProposals = 3): Proposal[] {
    try {
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

      // 策略1：查找所有 {"proposals": [...]} 包裹格式
      // LLM 可能将每个方案输出为独立的 {"proposals":[...]} 块，需全部收集
      const allProposals: Proposal[] = [];
      const proposalsRegex = /\{\s*"proposals"\s*:\s*\[/g;
      let pMatch;
      while ((pMatch = proposalsRegex.exec(cleaned)) !== null && allProposals.length < maxProposals) {
        const startIdx = pMatch.index;
        const endIdx = findJsonObjectEnd(cleaned, startIdx);
        if (endIdx !== -1) {
          try {
            const json = cleaned.substring(startIdx, endIdx);
            const proposals = JSON.parse(json).proposals || [];
            allProposals.push(...proposals);
          } catch { /* 跳过无效 JSON 块 */ }
        }
      }
      if (allProposals.length > 0) return allProposals.slice(0, maxProposals);

      // 策略2：LLM 输出了多个独立的 proposal JSON（文本与 JSON 混合）
      // 逐个提取包含 "type"、"title" 和 "content" 的完整 JSON 对象
      //
      // 重要：必须同时检查 title 字段，防止将提案 content.payload 内嵌的 
      // `{"type": "...", "content": {...}}` 结构误识别为独立提案。
      // 提案级别一定会有 title，而内嵌数据通常没有。
      const individualProposals: Proposal[] = [];
      const typeRegex = /\{\s*"type"\s*:\s*"/g;
      let match;
      while ((match = typeRegex.exec(cleaned)) !== null) {
        if (individualProposals.length >= maxProposals) break;
        const startIdx = match.index;
        const endIdx = findJsonObjectEnd(cleaned, startIdx);
        if (endIdx !== -1) {
          try {
            const json = cleaned.substring(startIdx, endIdx);
            const proposal = JSON.parse(json);
            // title 是提案级别的必需字段，内嵌 payload 数据没有 title
            if (proposal.type && proposal.title && proposal.content) {
              individualProposals.push(proposal);
            }
          } catch { /* 跳过无法解析的 JSON 块 */ }
        }
      }
      if (individualProposals.length > 0) return individualProposals;

      // 策略3：回退 — 使用括号计数提取第一个完整 JSON 对象
      const firstBrace = cleaned.indexOf('{');
      if (firstBrace === -1) throw new Error('No JSON found');
      const endIdx = findJsonObjectEnd(cleaned, firstBrace);
      if (endIdx === -1) throw new Error('Unterminated JSON');
      const firstJson = cleaned.substring(firstBrace, endIdx);
      const proposals = JSON.parse(firstJson).proposals || [];
      return proposals.slice(0, maxProposals);
    } catch {
      return [{
        type: "error",
        title: errorLabel,
        content: { reasoning: "解析失败", payload: { raw: raw.substring(0, 500) } },
      }];
    }
  }

  /** Override: inject extra messages (e.g. revision notes, chapter content) */
  protected async buildExtraMessages(_ctx: EngineContext): Promise<Message[]> {
    return [];
  }

  /**
   * 检测 raw 文本中是否已包含完整 JSON 且含有有效提案。
   * 用于在 LLM 流式输出过程中提前中断，节省 token 消耗。
   * 返回 true 表示可以提前终止流式调用。
   * 子类可覆盖以调整提案数量阈值。
   */
  protected _hasCompleteProposals(raw: string): boolean {
    try {
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      // 检查包裹格式：收集所有 {"proposals": [...]} 块中的提案
      const allProposals: unknown[] = [];
      const proposalsRegex = /\{\s*"proposals"\s*:\s*\[/g;
      let pMatch;
      while ((pMatch = proposalsRegex.exec(cleaned)) !== null) {
        const startIdx = pMatch.index;
        const endIdx = findJsonObjectEnd(cleaned, startIdx);
        if (endIdx !== -1) {
          try {
            const parsed = JSON.parse(cleaned.substring(startIdx, endIdx));
            const proposals = parsed.proposals || [];
            allProposals.push(...proposals);
          } catch { /* skip */ }
        }
      }
      if (allProposals.length >= 3) return true;
      // 检查独立 JSON 格式：至少找到 3 个完整的 proposal JSON 对象才触发
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
      return count >= 3;
    } catch {
      return false;
    }
  }

  /** Build project metadata context — delegates to shared context builder by default */
  protected async buildProjectMeta(ctx: EngineContext): Promise<string> {
    if (!ctx.projectId) return "";
    return buildProjectMetaContext(ctx.projectId);
  }

  /** World context injection */
  protected async injectMemory(projectId: string): Promise<Message[]> {
    const engines = this.getContextEngines();
    if (engines.length === 0) return [];
    return buildWorldContext(projectId, { includeEngines: engines, detailLevel: "structured" });
  }

  /**
   * Load revision notes for this engine from ai_proposals.
   * Returns a formatted string to append to the system prompt, or "" if none.
   */
  protected async loadRevisionNotes(projectId: string, proposalType?: string): Promise<string> {
    try {
      const type = proposalType || this.getProposalType();
      const revisions = await db
        .select()
        .from(aiProposals)
        .where(
          and(
            eq(aiProposals.projectId, projectId),
            eq(aiProposals.type, type),
            eq(aiProposals.status, "revision_requested")
          )
        );
      if (revisions.length === 0) return "";
      return `\n\n## 修改意见（必须优先响应）\n${revisions
        .map((r) => `[${r.type}] ${r.title}：${r.revisionNotes || "作者要求修改"}`)
        .join("\n")}`;
    } catch {
      return "";
    }
  }

  /** Stream execution: yields LLM chunks, ends with EngineResult */
  async *streamRun(ctx: EngineContext): AsyncGenerator<
    { type: "start" } |
    { type: "model"; info: { provider: string; model: string; contextLimit: number; label: string } } |
    { type: "chunk"; text: string } |
    { type: "usage"; usage: { promptTokens: number; completionTokens: number; totalTokens: number } } |
    { type: "error"; message: string; fallbackTier: string } |
    ToolCallEvent |
    ToolResultEvent |
    { type: "generation"; start: boolean } |
    { type: "done"; result: EngineResult }
  > {
    // 保存 refinement 上下文，供 parseOutput 中 injectRefinementParentId() 使用
    this.currentRefinement = ctx.refinement;

    // 使用工具模式时分派到多轮工具循环
    if (this.usesToolBasedContext()) {
      yield* this.streamRunWithTools(ctx);
      return;
    }

    if (!acquireLock(ctx.sessionId)) {
      throw new Error(`Session ${ctx.sessionId} already has an engine running`);
    }

    const startTime = Date.now();
    const tier = this.getModelTier();
    const tokenBudget = this.getTokenBudget();
    let capturedModel: string | undefined;
    let capturedUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
    const MAX_FALLBACK_ATTEMPTS = 1;
    let fallbackAttempts = 0;

    try {
      yield { type: "start" };

      // v4.0: 解析当前协作模式
      this.currentMode = await this.resolveMode(ctx);

      let systemPrompt = await this.buildSystemPrompt(ctx);
      // v4.0: 注入创作宪章到 system prompt
      systemPrompt = await this.buildSystemPromptWithCharter(ctx, systemPrompt);
      // v4.0: 注入作者意图
      systemPrompt = this.injectAuthorNotes(systemPrompt, ctx.authorNotes);
      const revisionNotes = await this.loadRevisionNotes(ctx.projectId);
      const memory = await this.injectMemory(ctx.projectId);
      const projectMeta = await this.buildProjectMeta(ctx);
      const extra = await this.buildExtraMessages(ctx);
      const userMessage = await this.buildUserMessage(ctx);

      // 项目信息放在最前面，作为基础上下文；引擎指令 + 修改意见紧随其后
      const fullSystemPrompt = [projectMeta, systemPrompt, revisionNotes]
        .filter(Boolean)
        .join("\n\n");

      let messages: Message[] = [
        { role: "system", content: fullSystemPrompt },
        ...memory,
        ...extra,
        { role: "user", content: userMessage },
      ];

      const estimatedTokens = estimateMessagesTokens(messages);
      if (estimatedTokens > tokenBudget) {
        console.warn(`[${this.name}] Token budget exceeded: ${estimatedTokens} > ${tokenBudget}, trimming`);
        messages = trimMessagesByBudget(messages, tokenBudget);
        console.warn(`[${this.name}] After trim: ${estimateMessagesTokens(messages)}`);
      }

      let raw = "";
      let currentTier = tier;

      streamLoop: while (true) {
        try {
          for await (const chunk of this.llm.stream(messages, {
            caller: this.name,
            projectId: ctx.projectId,
            sessionId: ctx.sessionId,
            callerRefId: ctx.sessionId,
            callerRefType: "engine",
            tier: currentTier,
          })) {
            if (chunk.modelInfo) {
              capturedModel = chunk.modelInfo.model;
              yield { type: "model", info: chunk.modelInfo };
            }
            if (chunk.usage) {
              capturedUsage = chunk.usage;
              yield { type: "usage", usage: chunk.usage };
            }
            if (!chunk.done && chunk.text) {
              raw += chunk.text;
              yield { type: "chunk", text: chunk.text };
              // 检测到完整 JSON 提案后立即中断 LLM 流，节省 token 消耗
              if (this._hasCompleteProposals(raw)) break streamLoop;
            }
          }
          break;
        } catch (err: any) {
          if (fallbackAttempts >= MAX_FALLBACK_ATTEMPTS) {
            throw new Error(`[${this.name}] LLM call failed (${fallbackAttempts + 1} attempts): ${err.message}`);
          }
          fallbackAttempts++;
          const fallbackTier = currentTier === "lightweight" ? "pro" : "lightweight";
          console.error(`[${this.name}] ${currentTier} failed, falling back to ${fallbackTier}:`, err.message);
          yield { type: "error", message: err.message, fallbackTier };
          currentTier = fallbackTier;
          raw = "";
          capturedUsage = undefined;
        }
      }

      const rawProposals = this.parseOutput(raw);
      // v4.0: 规范化提案输出（注入 scale、geoAnchor、refinement meta）
      const proposals = await this.normalizeProposals(rawProposals, ctx);

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
        const finalPromptTokens = capturedUsage?.promptTokens || estimateTokens(fullSystemPrompt + userMessage);
        const finalCompletionTokens = capturedUsage?.completionTokens || estimateTokens(raw);
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

      // 规范化已完成（normalizeProposals 已包含 injectRefinementMeta + injectGeoAnchors）
      // 提前中断时 capturedUsage 可能不完整，使用本地估算作为兜底
      const finalPromptTokens = capturedUsage?.promptTokens || estimateTokens(fullSystemPrompt + userMessage);
      const finalCompletionTokens = capturedUsage?.completionTokens || estimateTokens(raw);
      const result: EngineResult = {
        proposals,
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
    } finally {
      releaseLock(ctx.sessionId);
    }
  }

  /**
   * 基于工具的流式执行 — 多轮工具循环（最多 15 轮）
   *
   * 与标准 streamRun 的区别：
   * - 不调用 injectMemory()，不批量注入上下文
   * - 系统提示中增加引擎地图 + query_world_setting 工具使用指南
   * - LLM 可以多轮调用 query_world_setting 工具按需拉取数据
   * - 适用于高依赖引擎（如 character、conflict、story-blueprint）和写作引擎
   */
  private async *streamRunWithTools(
    ctx: EngineContext,
    maxIterations: number = 15
  ): AsyncGenerator<
    { type: "start" } |
    { type: "model"; info: { provider: string; model: string; contextLimit: number; label: string } } |
    { type: "chunk"; text: string } |
    { type: "usage"; usage: { promptTokens: number; completionTokens: number; totalTokens: number } } |
    { type: "error"; message: string; fallbackTier: string } |
    ToolCallEvent |
    ToolResultEvent |
    { type: "generation"; start: boolean } |
    { type: "done"; result: EngineResult }
  > {
    if (!acquireLock(ctx.sessionId)) {
      throw new Error(`Session ${ctx.sessionId} already has an engine running`);
    }

    const startTime = Date.now();
    const tier = this.getModelTier();
    const tokenBudget = this.getTokenBudget();
    let capturedModel: string | undefined;
    let capturedUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
    const MAX_FALLBACK_ATTEMPTS = 1;
    let fallbackAttempts = 0;

    // 获取快照 ID（写作引擎使用）
    const snapshotChapterId = this.getSnapshotChapterId(ctx);

    try {
      yield { type: "start" };

      // v4.0: 解析当前协作模式
      this.currentMode = await this.resolveMode(ctx);

      // 构建系统提示（含引擎地图 + 工具使用指南，不含批量上下文注入）
      let systemPrompt = await this.buildSystemPrompt(ctx);
      // v4.0: 注入创作宪章到 system prompt
      systemPrompt = await this.buildSystemPromptWithCharter(ctx, systemPrompt);
      // v4.0: 注入作者意图
      systemPrompt = this.injectAuthorNotes(systemPrompt, ctx.authorNotes);
      const revisionNotes = await this.loadRevisionNotes(ctx.projectId);
      const projectMeta = await this.buildProjectMeta(ctx);
      const toolSection = buildToolSystemPromptSection();
      const extraMessages = await this.buildExtraMessages(ctx);
      const userMessage = await this.buildUserMessage(ctx);

      const fullSystemPrompt = [systemPrompt, revisionNotes, toolSection]
        .filter(Boolean)
        .join("\n\n");

      // 项目元信息作为独立的 system 消息放在最前面，
      // 防止被后续数百行的格式规范、工具指南淹没
      const engineDef = getEngineDef(this.name);
      const depNameRegistry = engineDef?.dependsOn?.length
        ? await buildDependencyNameRegistry(ctx.projectId, engineDef.dependsOn)
        : "";

      let messages: Message[] = [
        ...(projectMeta ? [{ role: "system" as const, content: projectMeta }] : []),
        { role: "system", content: fullSystemPrompt },
        ...extraMessages,
        ...(depNameRegistry ? [{ role: "system" as const, content: depNameRegistry }] : []),
        { role: "user", content: userMessage },
      ];

      // ── 多轮工具循环（最多 50 轮） ──
      let rawOutput = "";
      const toolDefs = [buildQueryWorldSettingToolDef()];
      const toolExecCtx = {
        projectId: ctx.projectId,
        sessionId: ctx.sessionId,
        snapshotChapterId,
      };

      for (let iteration = 0; iteration < maxIterations; iteration++) {
        let chunkRaw = "";
        let chunkToolCalls: ToolCall[] | undefined;
        let chunkReasoning: string | undefined;
        let totalToolCalls = 0; // 累计工具调用次数，用于判断 LLM 是否主动查询过数据

        let currentTier = tier;
        let streamSuccess = false;

        while (!streamSuccess) {
          try {
            for await (const chunk of this.llm.stream(messages, {
              caller: this.name,
              projectId: ctx.projectId,
              sessionId: ctx.sessionId,
              callerRefId: ctx.sessionId,
              callerRefType: "engine",
              tier: currentTier,
              tools: toolDefs,
            })) {
              if (chunk.modelInfo && !capturedModel) {
                capturedModel = chunk.modelInfo.model;
                yield { type: "model", info: chunk.modelInfo };
              }
              if (chunk.usage) {
                capturedUsage = chunk.usage;
                yield { type: "usage", usage: chunk.usage };
              }
              if (!chunk.done && chunk.text) {
                chunkRaw += chunk.text;
                yield { type: "chunk", text: chunk.text };
              }
              if (chunk.reasoning) {
                chunkReasoning = chunk.reasoning;  // DeepSeek thinking 模式：需要原样传回
              }
              if (chunk.done) {
                chunkToolCalls = chunk.toolCalls;
              }
              // 检测到完整 JSON 提案后立即中断 LLM 流
              // 仅在流已结束（done）且无工具调用时生效，防止 tool_calls 丢失
              if (chunk.done && !chunk.toolCalls?.length && this._hasCompleteProposals(chunkRaw)) break;
            }
            streamSuccess = true;
          } catch (err: any) {
            if (fallbackAttempts >= MAX_FALLBACK_ATTEMPTS) {
              throw new Error(`[${this.name}] LLM call failed after ${fallbackAttempts + 1} attempts: ${err.message}`);
            }
            fallbackAttempts++;
            const fallbackTier = currentTier === "lightweight" ? "pro" : "lightweight";
            console.error(`[${this.name}] ${currentTier} failed, falling back to ${fallbackTier}:`, err.message);
            yield { type: "error", message: err.message, fallbackTier };
            currentTier = fallbackTier;
            chunkRaw = "";
            chunkReasoning = undefined;
            capturedUsage = undefined;
          }
        }

        // 无工具调用 → LLM 已生成最终提案，结束循环
        if (!chunkToolCalls || chunkToolCalls.length === 0) {
          // 首轮直接输出、引擎有依赖且从未调过工具 → 强制提醒查询依赖数据
          if (iteration === 0 && engineDef?.dependsOn?.length && totalToolCalls === 0) {
            console.warn(`[${this.name}] 首轮未调用 query_world_setting，强制提醒查询依赖数据`);
            messages.push({
              role: "user",
              content: `在生成提案之前，请先使用 query_world_setting 工具查询已确认的依赖数据。你的引擎依赖以下引擎的产出：${engineDef.dependsOn.join("、")}。请至少查询一轮后再生成提案。`,
            });
            continue; // 回到循环顶部，让 LLM 重新处理
          }
          rawOutput = chunkRaw;
          break;
        }

        // 追加助手消息（含 tool_calls 和 reasoning_content）
        messages.push({
          role: "assistant",
          content: chunkRaw,
          tool_calls: chunkToolCalls,
          ...(chunkReasoning ? { reasoning_content: chunkReasoning } : {}),
        });

        // 执行每个工具调用
        totalToolCalls += chunkToolCalls.length;
        for (const tc of chunkToolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          } catch {
            // 参数解析失败，传给执行器处理
          }

          yield {
            type: "tool_call",
            toolCallId: tc.id,
            toolName: tc.function.name,
            args,
          };

          const execResult = await executeToolCall(tc, toolExecCtx);

          yield {
            type: "tool_result",
            toolCallId: tc.id,
            summary: `查询完成`,
          };

          messages.push({
            role: "tool",
            content: execResult.content,
            tool_call_id: tc.id,
          });
        }

        // ── 工具调用完成，下一轮 LLM 将进入实际内容生成阶段 ──
        // 前端收到此事件后可以显示"正在撰写生成提案..."而非"数据查询中"状态
        // 解决了"流式未结束就弹出MOU"的用户感知问题
        yield { type: "generation", start: true };

        // 工具结果追加后，检查 token 预算并裁剪旧的历史消息
        const currentTokens = estimateMessagesTokens(messages);
        if (currentTokens > tokenBudget) {
          console.warn(`[${this.name}] 工具循环 token 超预算: ${currentTokens} > ${tokenBudget}，裁剪历史消息`);
          messages = trimToolLoopMessages(messages, tokenBudget);
          console.warn(`[${this.name}] 裁剪后: ${estimateMessagesTokens(messages)} tokens`);
        }

        // 倒数第二轮时强制输出提示，确保最后一轮 LLM 产出 JSON 而非继续调工具
        if (iteration === maxIterations - 2 && maxIterations > 2) {
          console.warn(`[${this.name}] 即将达到最大工具迭代次数 (${maxIterations})，提示 LLM 输出结果`);
          messages.push({
            role: "user",
            content: `你已进行了 ${maxIterations - 1} 轮数据查询，现在请基于已获取的信息直接生成提案。不要再调用工具，直接输出 JSON。`,
          });
        }
      }

      const rawProposals = this.parseOutput(rawOutput);
      // v4.0: 规范化提案输出
      const proposals = await this.normalizeProposals(rawProposals, ctx);

      // 如果解析失败，发送明确的 error 事件
      if (proposals.length === 0 || proposals.every((p) => p.type === "error")) {
        const errorMsg = proposals.length > 0
          ? `引擎 ${this.name} 解析失败：${proposals[0]?.content?.reasoning || "无法解析 LLM 输出"}`
          : `引擎 ${this.name} 未生成任何提案`;
        yield {
          type: "error",
          message: errorMsg,
          fallbackTier: tier,
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

      // 规范化已完成（normalizeProposals 已包含 injectRefinementMeta + injectGeoAnchors）
      const finalPromptTokens = capturedUsage?.promptTokens || estimateTokens(fullSystemPrompt + userMessage);
      const finalCompletionTokens = capturedUsage?.completionTokens || estimateTokens(rawOutput);
      const result: EngineResult = {
        proposals,
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
    } finally {
      releaseLock(ctx.sessionId);
    }
  }

  /**
   * 可选的提案后处理（如语义去重）。子类可覆盖。
   */
  protected async postProcessProposals(proposals: Proposal[], _ctx: EngineContext): Promise<Proposal[]> {
    return proposals;
  }

  /** Non-streaming wrapper */
  async run(ctx: EngineContext): Promise<EngineResult> {
    const gen = this.streamRun(ctx);
    let final: EngineResult = { proposals: [] };
    for await (const event of gen) {
      if (event.type === "done") final = event.result;
    }
    // 后处理：语义去重等
    final.proposals = await this.postProcessProposals(final.proposals, ctx);
    return final;
  }
}
