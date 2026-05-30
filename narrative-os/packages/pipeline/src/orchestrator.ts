import { db, aiProposals, mouStates, settingItems, settingItemRelations, projectSettings, notifications, projects, sessions } from "@narrative-os/database";
import { eq, and, isNull, ne } from "drizzle-orm";
import type { Proposal, EngineResult } from "@narrative-os/engines";
import { bus } from "./event-bus";
import { fuzzyMatchInCandidates } from "./shared";
import { findHandler } from "./handlers";
import { validateCrossReferences, type BrokenReference } from "./validators/cross-engine-validator";
import { evaluateMouSpectrum, canAutoApprove } from "./validators/mou-spectrum-evaluator";
import type { HandlerResult } from "./handlers";
import { WORLD_ENGINES } from "@narrative-os/engines";

export type OnProposalsStaged = (projectId: string, proposalIds: string[]) => void;

/**
 * 将跨引擎引用校验发现的错误名称自动修正为最相似的正确名称。
 * 只修正 relation 的 sourceName/targetName（直接替换即可），
 * item content 字段的引用不做自动修正（风险较高，需人工确认）。
 *
 * 修正策略（按优先级）：
 * 1. DB 已确认条目模糊匹配（fixName 来自 NameRegistry.getBestFix）
 * 2. 同提案内条目模糊匹配（LLM 经常在 relation 中写缩写或变体）
 */
function applyCrossRefFix(
  proposalTitle: string,
  brokenRef: BrokenReference,
  proposals: Proposal[],
): boolean {
  const target = proposals.find((p) => p.title === proposalTitle);
  if (!target) return false;

  const payload = (target.content?.payload || {}) as Record<string, unknown>;
  const relations = (payload?.relations || []) as { sourceName?: string; targetName?: string; label?: string }[];

  // 如果是同提案 item 的字段引用（非 relation），跳过自动修复
  if (brokenRef.fieldPath !== "sourceName" && brokenRef.fieldPath !== "targetName") {
    return false;
  }

  // 确定修复名称：优先用 DB 模糊匹配结果，其次尝试同提案条目名
  let fixName = brokenRef.fixName;
  let fixConfidence = brokenRef.fixConfidence;

  if (!fixName || fixConfidence < 1) {
    // 在同提案的 items 中做模糊匹配
    const items = (payload?.items || []) as { name?: string }[];
    const candidates = items.map((i) => i.name).filter(Boolean) as string[];
    fixName = fuzzyMatchInCandidates(brokenRef.unresolvedName, candidates)?.name || null;
    fixConfidence = fixName ? 1 : 0; // 同提案匹配默认为置信度 1
  }

  if (!fixName || fixConfidence < 1) return false;

  for (const rel of relations) {
    if (brokenRef.fieldPath === "sourceName" && rel.sourceName === brokenRef.unresolvedName) {
      rel.sourceName = fixName;
      return true;
    }
    if (brokenRef.fieldPath === "targetName" && rel.targetName === brokenRef.unresolvedName) {
      rel.targetName = fixName;
      return true;
    }
  }

  return false;
}

export class Orchestrator {
  private onProposalsStaged?: OnProposalsStaged;

  constructor(hooks?: { onProposalsStaged?: OnProposalsStaged }) {
    this.onProposalsStaged = hooks?.onProposalsStaged;
  }
  /**
   * 将 Node 产出的提案写入 ai_proposals + mou_states（事务保护）
   */
  async stageProposals(
    projectId: string,
    sessionId: string,
    result: EngineResult,
    sourceNode: string
  ): Promise<string[]> {
    const ids: string[] = [];

    // ── 旧 pending 提案清理策略 ──
    //
    // 可重复引擎（chapter-outline/chapter-writer）：每次新运行意味着旧 pending 提案已过时，
    // 自动 supersede 旧 pending 提案。
    //
    // 不可重复引擎（世界引擎）：如果有旧 pending 提案，同样需要 supersede。
    // 因为这通常意味着用户刷新页面或中断后重新执行了同一引擎。
    // 路由层的 guardEngineExecution 负责在前端触发时进行此检查，
    // 此处作为兜底安全网——即使绕过路由直接调用 stageProposals 也能处理。
    //
    // 唯一保留旧 pending 的情况：细化模式（refinement），
    // 同一引擎的不同父条目细化产生不同的 pending 提案，不应互相 supersede。
    const REPEATABLE_ENGINES = new Set([
      "chapter-outline", "chapter-writer",
      // 所有世界引擎也纳入——stageProposals 会清理上一个 session 的旧 pending
      "tone", "geography", "power-system",
      "faction", "race", "culture", "history", "technique",
      "economy", "rules", "character", "conflict", "causality",
      "item-system", "story-blueprint",
      // 工作室引擎
      "outline-generator", "volume-outline", "foreshadowing",
    ]);
    if (REPEATABLE_ENGINES.has(sourceNode)) {
      const oldPending = await db
        .select({ id: aiProposals.id })
        .from(aiProposals)
        .where(
          and(
            eq(aiProposals.projectId, projectId),
            eq(aiProposals.sourceNode, sourceNode),
            eq(aiProposals.status, "pending"),
          )
        );
      // 合并到一个事务中批量 supersede，避免 N 条旧提案 = N 个独立事务
      if (oldPending.length > 0) {
        const oldIds = oldPending.map((o) => o.id);
        await db.transaction(async (tx) => {
          await tx
            .update(aiProposals)
            .set({ status: "superseded" })
            .where(
              and(
                eq(aiProposals.projectId, projectId),
                eq(aiProposals.sourceNode, sourceNode),
                eq(aiProposals.status, "pending"),
              )
            );
          for (const oldId of oldIds) {
            await tx
              .update(mouStates)
              .set({ status: "superseded", decidedAt: new Date() })
              .where(eq(mouStates.proposalId, oldId));
          }
        });
      }
    }

    // Group proposals by type to detect multi-option sets
    const groups = new Map<string, Proposal[]>();
    for (const proposal of result.proposals) {
      if (proposal.type === "error") continue;
      const existing = groups.get(proposal.type) || [];
      existing.push(proposal);
      groups.set(proposal.type, existing);
    }

    for (const [, groupProposals] of groups) {
      // Same type with 2+ proposals = multi-option, share an optionGroup
      const optionGroup = groupProposals.length > 1
        ? `${sessionId}-${groupProposals[0].type}`
        : null;

      // ═══════════════════════════════════════════════════════════
      // 跨引擎一致性校验：自动检查提案中引用的名称是否在已确认条目中存在
      // ═══════════════════════════════════════════════════════════
      const validationResults = await validateCrossReferences(projectId, groupProposals, sourceNode);
      let autoFixedCount = 0;
      for (const vr of validationResults) {
        if (!vr.valid) {
          // 自动修复：有最佳修正建议的直接替换
          for (const br of vr.brokenRefs) {
            if (br.fixName && br.fixConfidence >= 1) {
              const fixed = applyCrossRefFix(vr.proposalTitle, br, groupProposals);
              if (fixed) {
                autoFixedCount++;
                console.warn(`[cross-ref] ${sourceNode} → "${vr.proposalTitle}": 🔧 自动修正 ${br.fieldPath} "${br.unresolvedName}" → "${br.fixName}" (置信度 ${br.fixConfidence})`);
              }
            }
          }
          // 仍未修复的引用才报 warning
          const remaining = vr.brokenRefs.filter((br) => !br.fixName || br.fixConfidence < 1);
          if (remaining.length > 0) {
            console.warn(`[cross-ref] ${sourceNode} → "${vr.proposalTitle}": ${remaining.length} 个无法自动修复的引用`);
            for (const br of remaining) {
              console.warn(`  - ${br.itemName}.${br.fieldPath} = "${br.unresolvedName}" 不存在${br.expectedTargetEngine ? `于 [${br.expectedTargetEngine}] 中` : ""}`);
              if (br.suggestions.length > 0) {
                console.warn(`    💡 最相似的已确认名称: ${br.suggestions.join(", ")}`);
              }
            }
          }
        }
      }
      if (autoFixedCount > 0) {
        console.warn(`[cross-ref] ${sourceNode}: ✅ 自动修复了 ${autoFixedCount} 个引用`);
      }

      // v4.0: MOU 频谱评估
      const spectrumEvaluations = await evaluateMouSpectrum(projectId, groupProposals, sourceNode);

      for (const proposal of groupProposals) {
        const evaluation = spectrumEvaluations.get(proposal.title);
        const approvalMode = evaluation && canAutoApprove(evaluation) ? "threshold" : "manual";

        if (evaluation) {
          console.log(`[spectrum] ${sourceNode} → "${proposal.title}": ${evaluation.band} (${evaluation.overallScore}分)${evaluation.checkpointTriggered ? ' [检查点]' : ''}`);
        }

        await db.transaction(async (tx) => {
          const [inserted] = await tx
            .insert(aiProposals)
            .values({
              projectId,
              sessionId,
              type: proposal.type,
              title: proposal.title,
              content: proposal.content,
              payload: proposal.content.payload,
              targetTable: proposal.targetTable || null,
              targetAction: proposal.targetAction || null,
              targetId: proposal.targetId || null,
              sourceNode,
              pipeline: result.pipeline || null,
              optionGroup,
              approvalMode,
              impactScore: evaluation?.overallScore ?? null,
              mouSpectrum: evaluation || null,
              status: "pending",
            })
            .returning({ id: aiProposals.id });

          if (inserted) {
            ids.push(inserted.id);
            await tx.insert(mouStates).values({
              projectId,
              proposalId: inserted.id,
              status: "pending",
            });
          }
        });
      }
    }

    // Notify listeners (e.g. WebSocket bus) that new proposals are ready
    if (ids.length > 0 && this.onProposalsStaged) {
      this.onProposalsStaged(projectId, ids);
    }
    if (ids.length > 0) {
      bus.emit({ type: "proposals.staged", projectId, proposalIds: ids, sourceNode });
    }

    return ids;
  }

  /**
   * 作者拍板：approved（事务保护 + 状态守卫 + handler 策略模式）
   */
  async approveProposal(
    proposalId: string,
    authorDecision?: string
  ): Promise<{ executed: boolean; settingItemsCreated: number }> {
    // Transaction provides serializable isolation: if two concurrent approvals
    // race, the second one will see status='executing' (set by the first) and
    // throw at the status guard below, preventing double-execution.
    return db.transaction(async (tx) => {
      // ── 1. 状态守卫 ──
      const [existing] = await tx
        .select({ status: aiProposals.status, projectId: aiProposals.projectId })
        .from(aiProposals)
        .where(eq(aiProposals.id, proposalId));

      if (!existing) {
        throw new Error(`Proposal ${proposalId} not found`);
      }
      if (existing.status !== "pending" && existing.status !== "revision_requested") {
        throw new Error(`Proposal ${proposalId} status is "${existing.status}", cannot approve`);
      }

      // ── 2. 更新 mou_states ──
      await tx
        .update(mouStates)
        .set({
          status: "approved",
          authorDecision: authorDecision || "作者确认",
          decidedAt: new Date(),
        })
        .where(eq(mouStates.proposalId, proposalId));

      // ── 3. 更新为 EXECUTING（中间状态，防止长时间执行时状态不一致） ──
      // 仅 ai_proposals 需要 executing 状态（其 CHECK 约束已包含 executing）
      // mou_states 不设 executing（其 CHECK 约束不含 executing，设了会回滚事务）
      await tx
        .update(aiProposals)
        .set({ status: "executing", approvedAt: new Date() })
        .where(eq(aiProposals.id, proposalId));

      // ── 4. 读取提案内容 ──
      const [proposal] = await tx
        .select()
        .from(aiProposals)
        .where(eq(aiProposals.id, proposalId));

      if (!proposal || !proposal.payload) {
        return { executed: false, settingItemsCreated: 0 };
      }

      // ── 5. 查找并执行 handler ──
      const handler = findHandler(proposal.type, proposal.targetAction);
      if (!handler) {
        throw new Error(`No handler registered for proposal type "${proposal.type}" with targetAction "${proposal.targetAction}"`);
      }

      const handlerCtx = {
        tx,
        proposal: {
          id: proposal.id,
          projectId: proposal.projectId,
          type: proposal.type,
          title: proposal.title,
          content: proposal.content as { reasoning: string; payload: any },
          payload: proposal.payload,
          sourceNode: proposal.sourceNode,
          targetAction: proposal.targetAction,
          targetId: proposal.targetId,
          optionGroup: proposal.optionGroup,
        },
        emit: (event: Parameters<typeof bus.emit>[0]) => bus.emit(event),
      };

      const result: HandlerResult = await handler.execute(handlerCtx);

      // ── 6. handler 必须成功执行，否则回滚整个事务 ──
      if (!result.executed) {
        throw new Error(
          `Handler execution failed for proposal ${proposalId}: ${JSON.stringify(result.executionResult)}`
        );
      }

      // ── 7. 更新为 APPROVED 并标记已执行 ──
      await tx
        .update(aiProposals)
        .set({ status: "approved" })
        .where(eq(aiProposals.id, proposalId));

      await tx
        .update(mouStates)
        .set({ status: "approved" })
        .where(eq(mouStates.proposalId, proposalId));

      // ── 8. 标记 mou_states 已执行 ──
      await tx
        .update(mouStates)
        .set({ executedAt: new Date(), executionResult: result.executionResult })
        .where(eq(mouStates.proposalId, proposalId));

      // ── 9. 推送通知 ──
      if (result.notification) {
        await this.pushNotification(tx, {
          projectId: proposal.projectId,
          priority: result.notification.priority,
          category: result.notification.category,
          title: result.notification.title,
          body: result.notification.body,
          sourceNode: result.notification.sourceNode,
          relatedEntityType: result.notification.relatedEntityType,
          relatedEntityId: result.notification.relatedEntityId,
        });
      }

      // ── 10. Auto-supersede siblings in the same optionGroup ──
      // Always supersede regardless of itemsCreated — the user chose one option,
      // so all other options in the same group are no longer actionable.
      if (proposal.optionGroup) {
        await tx
          .update(aiProposals)
          .set({ status: "superseded" })
          .where(
            and(
              eq(aiProposals.optionGroup, proposal.optionGroup),
              ne(aiProposals.id, proposalId),
              eq(aiProposals.status, "pending")
            )
          );

        const supersededProposals = await tx
          .select({ id: aiProposals.id })
          .from(aiProposals)
          .where(
            and(
              eq(aiProposals.optionGroup, proposal.optionGroup),
              ne(aiProposals.id, proposalId),
              eq(aiProposals.status, "superseded")
            )
          );
        for (const sp of supersededProposals) {
          await tx
            .update(mouStates)
            .set({ status: "superseded", decidedAt: new Date() })
            .where(eq(mouStates.proposalId, sp.id));
        }
      }

      // Only check project locking when setting_items were created
      if (result.itemsCreated > 0) {
        await this.maybeLockProject(proposal.projectId, tx);
      }

      // ── 11. 发布领域事件 ──
      bus.emit({
        type: "proposal.approved",
        projectId: proposal.projectId,
        proposalId,
        proposalType: proposal.type,
        sourceNode: proposal.sourceNode || undefined,
      });

      // ── 12. 异步触发向量嵌入 ──
      // 设定条目确认/更新后自动嵌入
      if (result.itemsCreated > 0) {
        const { EmbeddingPipeline } = await import("@narrative-os/database");
        const pipeline = EmbeddingPipeline.getInstance();
        if (pipeline) {
          // 获取刚创建的 setting_items 并嵌入
          const createdItems = (result.executionResult as any)?.itemIds as string[] | undefined;
          if (createdItems && createdItems.length > 0) {
            for (const itemId of createdItems) {
              pipeline.embedSettingItem(proposal.projectId, itemId).catch((err: any) => {
                console.error(`[orchestrator] Embedding failed for item ${itemId}:`, err.message);
              });
            }
          }
          // 目标更新也触发嵌入
          if (proposal.targetId && proposal.targetAction === "update") {
            pipeline.embedSettingItem(proposal.projectId, proposal.targetId).catch((err: any) => {
              console.error(`[orchestrator] Embedding failed for updated item ${proposal.targetId}:`, err.message);
            });
          }
        }
      }

      return { executed: result.executed, settingItemsCreated: result.itemsCreated };
    });
  }

  /**
   * 作者要求修改（事务保护 + 状态守卫）
   * mou_states 和 ai_proposals 统一使用 revision_requested
   */
  async reviseProposal(
    proposalId: string,
    notes: string
  ): Promise<{ success: boolean; projectId: string | null }> {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ status: aiProposals.status })
        .from(aiProposals)
        .where(eq(aiProposals.id, proposalId));

      if (!existing || (existing.status !== "pending" && existing.status !== "revision_requested")) {
        return { success: false, projectId: null };
      }

      await tx
        .update(mouStates)
        .set({ status: "revision_requested", rejectionNote: notes, decidedAt: new Date() })
        .where(eq(mouStates.proposalId, proposalId));

      const [updated] = await tx
        .update(aiProposals)
        .set({ status: "revision_requested", revisionNotes: notes })
        .where(eq(aiProposals.id, proposalId))
        .returning({ projectId: aiProposals.projectId });

      if (updated) {
        await this.pushNotification(tx, {
          projectId: updated.projectId,
          priority: "p1",
          category: "proposal",
          title: "提案需要修改",
          body: `作者对提案提出修改意见：${notes.substring(0, 200)}`,
          relatedEntityType: "proposal",
          relatedEntityId: proposalId,
        });
      }

      if (updated) {
        bus.emit({ type: "proposal.revised", projectId: updated.projectId, proposalId, notes });
      }

      return { success: !!updated, projectId: updated?.projectId || null };
    });
  }

  /**
   * 作者拒绝（事务保护 + 状态守卫）
   */
  async rejectProposal(
    proposalId: string,
    reason: string
  ): Promise<void> {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ status: aiProposals.status })
        .from(aiProposals)
        .where(eq(aiProposals.id, proposalId));

      const [proposal] = await tx
        .select({ projectId: aiProposals.projectId })
        .from(aiProposals)
        .where(eq(aiProposals.id, proposalId));

      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`);
      }
      if (existing.status !== "pending" && existing.status !== "revision_requested") {
        throw new Error(`Proposal ${proposalId} status is "${existing.status}", cannot reject`);
      }

      await tx
        .update(mouStates)
        .set({ status: "rejected", rejectionNote: reason, decidedAt: new Date() })
        .where(eq(mouStates.proposalId, proposalId));

      await tx
        .update(aiProposals)
        .set({ status: "rejected", rejectionNote: reason })
        .where(eq(aiProposals.id, proposalId));

      bus.emit({ type: "proposal.rejected", projectId: proposal.projectId, proposalId });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async pushNotification(tx: any, opts: {
    projectId: string;
    priority: "p0" | "p1" | "p2" | "p3" | "p4";
    category: "conflict" | "proposal" | "system" | "retcon" | "preview" | "setting";
    title: string;
    body: string;
    sourceNode?: string;
    relatedEntityType?: "proposal" | "setting" | "chapter" | "session" | "project";
    relatedEntityId?: string;
  }): Promise<string | null> {
    const [inserted] = await tx
      .insert(notifications)
      .values({
        projectId: opts.projectId,
        priority: opts.priority,
        category: opts.category,
        title: opts.title,
        body: opts.body,
        sourceNode: opts.sourceNode,
        relatedEntityType: opts.relatedEntityType,
        relatedEntityId: opts.relatedEntityId,
        status: "unread",
      })
      .returning({ id: notifications.id });

    return inserted?.id || null;
  }

  /**
   * 检查项目是否所有提案都已处理（包括 revision_requested 和 executing），如果是则锁定
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async maybeLockProject(projectId: string, tx?: any): Promise<void> {
    const ddb = tx || db;

    // 检查是否还有 pending 或 revision_requested 或 executing 的 MOU
    const unresolved = await ddb
      .select({ id: mouStates.id, status: mouStates.status })
      .from(mouStates)
      .where(
        and(
          eq(mouStates.projectId, projectId),
          eq(mouStates.status, "pending")
        )
      );

    if (unresolved.length > 0) return;

    const revisionPending = await ddb
      .select({ id: mouStates.id })
      .from(mouStates)
      .where(
        and(
          eq(mouStates.projectId, projectId),
          eq(mouStates.status, "revision_requested")
        )
      );

    if (revisionPending.length > 0) return;

    // 检查是否有正在执行的提案（ai_proposals 有 executing 状态）
    // mou_states 不再设 executing（其 CHECK 约束不含 executing）
    const executing = await ddb
      .select({ id: aiProposals.id })
      .from(aiProposals)
      .where(
        and(
          eq(aiProposals.projectId, projectId),
          eq(aiProposals.status, "executing")
        )
      );

    if (executing.length > 0) return;

    // 查询已确认的设定项
    const confirmedItems = await ddb
      .select()
      .from(settingItems)
      .where(
        and(
          eq(settingItems.projectId, projectId),
          eq(settingItems.status, "confirmed")
        )
      );

    // 检查是否所有世界引擎都有 confirmed 产出
    const requiredEngines = WORLD_ENGINES;
    const confirmedEngineSources = new Set(
      confirmedItems.map((i: any) => i.engineSource).filter(Boolean) as string[]
    );
    const missingEngines = requiredEngines.filter(
      (e) => !confirmedEngineSources.has(e.name)
    );
    if (missingEngines.length > 0) {
      const missingNames = missingEngines.map((e) => e.name).join(", ");
      const confirmedNames = [...confirmedEngineSources].join(", ") || "none";
      console.log(
        `[orchestrator] Project ${projectId} not locking: ${missingEngines.length} world engines missing (${missingNames}). ` +
        `Confirmed sources: ${confirmedNames}. ` +
        `Total confirmed items: ${confirmedItems.length}`
      );
      return;
    }

    // 所有提案已处理且所有孵化引擎已确认，构建 world_bible 快照

    // 查询关系网络
    const itemIds = confirmedItems.map((i: any) => i.id);
    const relations = itemIds.length > 0
      ? await ddb
          .select()
          .from(settingItemRelations)
          .where(eq(settingItemRelations.projectId, projectId))
      : [];

    // 构建 name 查找表
    const nameMap = new Map(confirmedItems.map((i: any) => [i.id, i.name]));

    // 同类型合并为数组，包含完整元数据
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const worldBible: Record<string, any[]> = {};
    for (const item of confirmedItems) {
      if (!worldBible[item.type]) {
        worldBible[item.type] = [];
      }
      worldBible[item.type].push({
        name: item.name,
        summary: item.summary,
        content: item.content,
        subtype: item.itemSubtype,
        engineSource: item.engineSource,
        parentName: item.parentItemId ? nameMap.get(item.parentItemId) : null,
      });
    }

    // 追加关系网络
    if (relations.length > 0) {
      worldBible._relations = relations.map((r: any) => ({
        source: nameMap.get(r.sourceItemId) || "?",
        target: nameMap.get(r.targetItemId) || "?",
        type: r.relationType,
        label: r.label,
      }));
    }

    await ddb
      .insert(projectSettings)
      .values({
        projectId,
        worldBible,
        lockedAt: new Date(),
        hatchSummary: {
          totalProposals: confirmedItems.length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          types: [...new Set(confirmedItems.map((i: any) => i.type))],
        },
      })
      .onConflictDoUpdate({
        target: projectSettings.projectId,
        set: {
          worldBible,
          lockedAt: new Date(),
          hatchSummary: {
            totalProposals: confirmedItems.length,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            types: [...new Set(confirmedItems.map((i: any) => i.type))],
          },
          updatedAt: new Date(),
        },
      });

    // 项目状态从 hatching → active
    await ddb
      .update(projects)
      .set({ status: "active", updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.status, "hatching")));

    // 关闭该项目所有未关闭的 hatching 类型会话
    await ddb
      .update(sessions)
      .set({ status: "closed", closedAt: new Date() })
      .where(
        and(
          eq(sessions.projectId, projectId),
          isNull(sessions.closedAt)
        )
      );

    // 通知：孵化完成，项目已激活
    await this.pushNotification(ddb, {
      projectId,
      priority: "p1",
      category: "system",
      title: "孵化完成",
      body: `世界观已锁定（${confirmedItems.length} 条设定），项目已进入写作模式。`,
      relatedEntityType: "project",
      relatedEntityId: projectId,
    });

    bus.emit({ type: "project.activated", projectId });
  }
}
