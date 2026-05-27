import { settingItems, settingItemRelations, aiProposals, mouStates, projectScales } from "@narrative-os/database";
import { eq, and } from "drizzle-orm";
import type { ProposalHandler, ProposalHandlerContext, HandlerResult } from "./types";
import type { ItemBlueprint, RelationBlueprint } from "@narrative-os/engines";
import { SCALE_CHAIN, VALID_RELATION_TYPES, getProjectChildScale } from "@narrative-os/engines";

function stripSchemePrefix(title: string): string {
  return title.replace(/^方案[A-Z][:：]\s*/, '')
}

// Handles: targetAction === "update" (modify existing setting_item)
//          and the default fallback (create new setting_item)
//          including multi-item decomposition
export class SettingItemHandler implements ProposalHandler {
  canHandle(type: string, targetAction?: string | null): boolean {
    if (targetAction === "update") return true;
    if (targetAction === "delete") return true;
    if (type === "memory_extraction") return true;
    // Fallback: any type that doesn't have a more specific handler
    return true;
  }

  async execute(ctx: ProposalHandlerContext): Promise<HandlerResult> {
    const { tx, proposal } = ctx;

    // ── Memory extraction: process affected_world_items into update proposals ──
    if (proposal.type === "memory_extraction") {
      return this.executeMemoryExtraction(ctx);
    }

    // Delete setting_item
    if (proposal.targetAction === "delete" && proposal.targetId) {
      await tx
        .update(settingItems)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(settingItems.id, proposal.targetId));

      // Archive related relations
      const relations = await tx
        .select({ id: settingItemRelations.id })
        .from(settingItemRelations)
        .where(eq(settingItemRelations.sourceItemId, proposal.targetId));

      const targetRelations = await tx
        .select({ id: settingItemRelations.id })
        .from(settingItemRelations)
        .where(eq(settingItemRelations.targetItemId, proposal.targetId));

      for (const rel of [...relations, ...targetRelations]) {
        await tx
          .update(settingItemRelations)
          .set({ metadata: { archived: true, archivedAt: new Date().toISOString(), reason: "source_item_deleted" } })
          .where(eq(settingItemRelations.id, rel.id));
      }

      ctx.emit({ type: "setting.deleted", projectId: proposal.projectId, settingItemId: proposal.targetId });

      return {
        executed: true,
        itemsCreated: 0,
        executionResult: {
          deletedItemId: proposal.targetId,
          archivedRelations: relations.length + targetRelations.length,
        },
        notification: {
          priority: "p1",
          category: "setting",
          title: `设定已删除：${proposal.title}`,
          body: `通过 MOU 审批删除了设定条目，已归档 ${relations.length + targetRelations.length} 条关联关系。`,
          sourceNode: proposal.sourceNode || undefined,
          relatedEntityType: "setting",
          relatedEntityId: proposal.targetId,
        },
      };
    }

    // Update existing setting_item
    if (proposal.targetAction === "update" && proposal.targetId) {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (proposal.payload.name !== undefined) updates.name = proposal.payload.name;
      if (proposal.payload.summary !== undefined) updates.summary = proposal.payload.summary;
      if (proposal.payload.content !== undefined) updates.content = proposal.payload.content;

      if (Object.keys(updates).length > 1) {
        await tx
          .update(settingItems)
          .set(updates)
          .where(eq(settingItems.id, proposal.targetId));
      }

      ctx.emit({ type: "setting.updated", projectId: proposal.projectId, settingItemId: proposal.targetId });

      return {
        executed: true,
        itemsCreated: 0,
        executionResult: { updatedItemId: proposal.targetId },
        notification: {
          priority: "p2",
          category: "setting",
          title: `设定已更新：${proposal.title}`,
          body: `通过 MOU 审批更新了设定条目。`,
          sourceNode: proposal.sourceNode || undefined,
          relatedEntityType: "setting",
          relatedEntityId: proposal.targetId,
        },
      };
    }

    const payload = proposal.payload as Record<string, unknown>;
    const items = payload?.items as ItemBlueprint[] | undefined;

    // ── Multi-Item decomposition ──
    if (items && Array.isArray(items) && items.length > 0) {
      return this.executeMultiItem(ctx, proposal, payload, items);
    }

    // ── Legacy single-item path ──
    const [inserted] = await tx.insert(settingItems).values({
      projectId: proposal.projectId,
      proposalId: proposal.id,
      type: proposal.type,
      name: stripSchemePrefix(proposal.title),
      summary: proposal.content?.reasoning?.substring(0, 200) || stripSchemePrefix(proposal.title),
      content: proposal.payload,
      status: "confirmed",
      engineSource: proposal.sourceNode || undefined,
    }).returning({ id: settingItems.id });

    return {
      executed: true,
      itemsCreated: 1,
      executionResult: { settingItemId: inserted?.id },
      notification: {
        priority: "p2",
        category: "setting",
        title: `设定已确认：${stripSchemePrefix(proposal.title)}`,
        body: `类型：${proposal.type}，已入库为 confirmed 状态。`,
        sourceNode: proposal.sourceNode || undefined,
        relatedEntityType: "proposal",
        relatedEntityId: proposal.id,
      },
    };
  }

  /**
   * Decompose a multi-item proposal into multiple setting_items + relations.
   * Archives old items from the same engine source before creating new ones.
   */
  /**
   * 处理 memory_extraction 提案：提取受影响的世界条目并创建更新提案。
   * 从每个事件的 affected_world_items 中生成独立的 setting_update 提案，
   * 供用户在 MOU 中审批是否更新世界设定。
   */
  private async executeMemoryExtraction(ctx: ProposalHandlerContext): Promise<HandlerResult> {
    const { tx, proposal } = ctx;
    const payload = (proposal.payload || {}) as Record<string, unknown>;
    const items = (payload.items || []) as Array<Record<string, unknown>>;

    let updateProposalsCreated = 0;

    for (const item of items) {
      const affectedItems = (item.content as any)?.affected_world_items as Array<any> | undefined;
      if (!affectedItems || affectedItems.length === 0) continue;

      for (const affected of affectedItems) {
        // 优先使用 item_id 精确查找，回退到 item_name
        let existingId: string | undefined = affected.item_id;

        if (existingId) {
          // 验证 ID 是否存在于当前项目
          const [found] = await tx
            .select({ id: settingItems.id })
            .from(settingItems)
            .where(and(
              eq(settingItems.projectId, proposal.projectId),
              eq(settingItems.id, existingId),
              eq(settingItems.status, "confirmed")
            ))
            .limit(1);
          if (!found) existingId = undefined; // ID 无效，回退到名称查找
        }

        if (!existingId && affected.item_name) {
          const [found] = await tx
            .select({ id: settingItems.id })
            .from(settingItems)
            .where(and(
              eq(settingItems.projectId, proposal.projectId),
              eq(settingItems.name, affected.item_name),
              eq(settingItems.status, "confirmed")
            ))
            .limit(1);
          existingId = found?.id;
        }

        if (!existingId) continue;

        // 创建更新提案 — 为 memory_extraction 子提案使用独立 session 标识
        const chapterNum = (item.content as any)?.chapter_number || 0;
        const [inserted] = await tx.insert(aiProposals).values({
          projectId: proposal.projectId,
          sessionId: proposal.id, // 使用 memory_extraction 的 proposal.id 作为关联标识
          type: "setting_update",
          title: `[第${chapterNum}章] ${affected.item_name || "设定更新"} 状态更新`,
          content: {
            reasoning: `基于第${chapterNum}章事件 "${item.name}"：${affected.change_description || ""}`,
            payload: { suggestedUpdate: affected.suggested_update, changeDescription: affected.change_description },
          },
          sourceNode: "memory-extractor",
          approvalMode: "manual",
          status: "pending",
          targetId: existingId,
          targetAction: "update",
          targetTable: "setting_items",
        }).returning({ id: aiProposals.id });

        // 同步创建 MOU 状态记录，确保前端能展示审批状态
        if (inserted) {
          await tx.insert(mouStates).values({
            projectId: proposal.projectId,
            proposalId: inserted.id,
            status: "pending",
          });
        }
        updateProposalsCreated++;
      }
    }

    ctx.emit({
      type: "setting.items_created",
      projectId: proposal.projectId,
      proposalId: proposal.id,
      itemIds: [],
      relationIds: [],
    } as any);

    return {
      executed: true,
      itemsCreated: 0,
      executionResult: { updateProposalsCreated },
      notification: updateProposalsCreated > 0 ? {
        priority: "p2" as const,
        category: "setting" as const,
        title: `记忆提取：发现 ${updateProposalsCreated} 个世界条目变化`,
        body: `第${(items[0]?.content as any)?.chapter_number || "?"}章的记忆提取发现了 ${updateProposalsCreated} 个可能的世界设定变化。`,
        sourceNode: "memory-extractor",
        relatedEntityType: "proposal" as const,
        relatedEntityId: proposal.id,
      } : null,
    };
  }

  private async executeMultiItem(
    ctx: ProposalHandlerContext,
    proposal: ProposalHandlerContext["proposal"],
    payload: Record<string, unknown>,
    blueprints: ItemBlueprint[]
  ): Promise<HandlerResult> {
    const { tx } = ctx;

    // 细化模式：如果指定了 _refinementParentId，子条目直接挂到已有父条目下
    // 不创建新的 parent，不归档已有条目
    const refinementParentId = payload._refinementParentId as string | undefined;

    if (refinementParentId) {
      return this.executeRefinementItems(ctx, proposal, payload, blueprints, refinementParentId);
    }

    // 0. Scales 写入 — 如果 payload 中包含 scales 数组（如 geography 初始 pass），
    //    先写入 project_scales 表，确保细化阶段的尺度链可用
    const scales = payload.scales as Array<{
      key: string; label: string; parentKey: string | null; sortOrder: number; description: string;
    }> | undefined;
    if (scales && Array.isArray(scales) && scales.length > 0) {
      // 清除旧的 project_scales 数据（同项目多轮生成时）
      await tx
        .delete(projectScales)
        .where(eq(projectScales.projectId, proposal.projectId));
      // 写入新尺度
      for (const s of scales) {
        await tx.insert(projectScales).values({
          projectId: proposal.projectId,
          key: s.key,
          label: s.label,
          parentKey: s.parentKey || null,
          sortOrder: s.sortOrder ?? 0,
          description: s.description || null,
          isEditable: true,
        });
      }
      console.log(`[setting-item] 写入 ${scales.length} 级尺度到 project_scales（项目 ${proposal.projectId}）`);
    }

    // 1. Archive old items from this engine source (re-run scenario)
    // 但仅在 proposal 未明确指定保留旧数据时执行
    const shouldArchive = payload.archivePrevious !== false;

    if (shouldArchive && proposal.sourceNode) {
      await tx
        .update(settingItems)
        .set({ status: "archived", updatedAt: new Date() })
        .where(
          and(
            eq(settingItems.projectId, proposal.projectId),
            eq(settingItems.engineSource, proposal.sourceNode),
            eq(settingItems.status, "confirmed")
          )
        );
    }

    // 2. Create parent item (the overall option)
    const createdIds = new Map<string, string>(); // name -> id
    const parentName = (payload.name as string) || proposal.title;

    const [parentItem] = await tx
      .insert(settingItems)
      .values({
        projectId: proposal.projectId,
        proposalId: proposal.id,
        type: proposal.type,
        name: parentName,
        summary: proposal.content?.reasoning?.substring(0, 200) || proposal.title,
        content: proposal.payload,
        status: "confirmed",
        engineSource: proposal.sourceNode || undefined,
        itemSubtype: "parent",
      })
      .returning({ id: settingItems.id });

    if (parentItem) createdIds.set(parentName, parentItem.id);

    // 3. Create child items — 确保 needs_refinement 存在（LLM 忘记时兜底）
    for (const bp of blueprints) {
      const bpContent = { ...bp.content };
      if (bpContent.needs_refinement === undefined) bpContent.needs_refinement = true;

      const [inserted] = await tx
        .insert(settingItems)
        .values({
          projectId: proposal.projectId,
          proposalId: proposal.id,
          type: proposal.type,
          name: bp.name,
          summary: bp.summary,
          content: bpContent,
          status: "confirmed",
          tags: bp.tags || null,
          parentItemId: parentItem?.id,
          engineSource: proposal.sourceNode || undefined,
          itemSubtype: bp.subtype,
        })
        .returning({ id: settingItems.id });

      if (inserted) createdIds.set(bp.name, inserted.id);
    }

    // 4. Resolve and create relations
    const relationBlueprints = (payload?.relations || []) as RelationBlueprint[];
    const relationIds: string[] = [];

    for (const rel of relationBlueprints) {
      const sourceId = createdIds.get(rel.sourceName);
      let targetId = createdIds.get(rel.targetName);

      // Target not in current batch → look up in confirmed items
      if (!targetId) {
        const [found] = await tx
          .select({ id: settingItems.id })
          .from(settingItems)
          .where(
            and(
              eq(settingItems.projectId, proposal.projectId),
              eq(settingItems.name, rel.targetName),
              eq(settingItems.status, "confirmed")
            )
          )
          .limit(1);
        targetId = found?.id;
      }

      if (sourceId && targetId) {
        // 验证 relationType，未知类型降级为 reference
        const relationType = VALID_RELATION_TYPES.includes(rel.relationType as any) ? rel.relationType : "reference";
        if (!VALID_RELATION_TYPES.includes(rel.relationType as any)) {
          console.warn(`[setting-item] Unknown relationType "${rel.relationType}", fallback to "reference"`);
        }

        const [inserted] = await tx
          .insert(settingItemRelations)
          .values({
            projectId: proposal.projectId,
            sourceItemId: sourceId,
            targetItemId: targetId,
            relationType,
            label: rel.label,
            metadata: rel.metadata || null,
          })
          .returning({ id: settingItemRelations.id });
        if (inserted) relationIds.push(inserted.id);
      }
    }

    ctx.emit({
      type: "setting.items_created",
      projectId: proposal.projectId,
      proposalId: proposal.id,
      itemIds: Array.from(createdIds.values()),
      relationIds,
    });

    return {
      executed: true,
      itemsCreated: createdIds.size,
      executionResult: {
        itemIds: Array.from(createdIds.values()),
        relationIds,
        parentItemId: parentItem?.id,
      },
      notification: {
        priority: "p2",
        category: "setting",
        title: `设定已确认：${stripSchemePrefix(proposal.title)}`,
        body: `创建了 ${createdIds.size} 个设定条目，${relationIds.length} 条关系。`,
        sourceNode: proposal.sourceNode || undefined,
        relatedEntityType: "proposal",
        relatedEntityId: proposal.id,
      },
    };
  }

  /**
   * 细化模式：将子条目直接挂到已存在的父条目下。
   * 不创建新的 parent item，不归档已有条目。
   */
  private async executeRefinementItems(
    ctx: ProposalHandlerContext,
    proposal: ProposalHandlerContext["proposal"],
    payload: Record<string, unknown>,
    blueprints: ItemBlueprint[],
    refinementParentId: string
  ): Promise<HandlerResult> {
    const { tx } = ctx;

    // 查找父条目，确认它存在（需查 content 以获取 scale，用于推断子条目的 targetScale 兜底）
    const [parentItem] = await tx
      .select({ id: settingItems.id, name: settingItems.name, content: settingItems.content })
      .from(settingItems)
      .where(eq(settingItems.id, refinementParentId));

    if (!parentItem) {
      throw new Error(`Refinement parent ${refinementParentId} not found`);
    }

    const createdIds = new Map<string, string>();
    // 将父条目加入 createdIds，这样 relations 中引用父条目名称时可以解析
    createdIds.set(parentItem.name, parentItem.id);

    // 创建子条目，parentItemId 指向细化目标
    // 从父条目的 scale 推算 targetScale 作为兜底（优先项目自定义，回退 SCALE_CHAIN）
    const parentContent = (parentItem as any).content as Record<string, unknown> || {};
    const parentScale = (parentContent.scale as string) || "";
    const childScale = await getProjectChildScale(proposal.projectId, parentScale);
    const inferredTargetScale = childScale?.key
      ?? (() => {
        const parentIdx = SCALE_CHAIN.indexOf(parentScale as typeof SCALE_CHAIN[number]);
        return parentIdx >= 0 && parentIdx < SCALE_CHAIN.length - 1
          ? SCALE_CHAIN[parentIdx + 1] : undefined;
      })();

    for (const bp of blueprints) {
      // 确保 needs_refinement 和 scale 存在
      const content = { ...bp.content };
      if (content.needs_refinement === undefined) content.needs_refinement = true;
      if (!content.scale && inferredTargetScale) {
        content.scale = inferredTargetScale;
      }

      const [inserted] = await tx
        .insert(settingItems)
        .values({
          projectId: proposal.projectId,
          proposalId: proposal.id,
          type: proposal.type,
          name: bp.name,
          summary: bp.summary,
          content,
          status: "confirmed",
          tags: bp.tags || null,
          parentItemId: parentItem.id,
          engineSource: proposal.sourceNode || undefined,
          itemSubtype: bp.subtype,
        })
        .returning({ id: settingItems.id });

      if (inserted) createdIds.set(bp.name, inserted.id);
    }

    // 细化完成后，清除父条目的 needs_refinement 标记，防止重复细化同一父条目
    // 新创建的子条目会继续携带 needs_refinement: true，驱动下一级细化
    const updatedParentContent = { ...parentContent, needs_refinement: false };
    await tx
      .update(settingItems)
      .set({ content: updatedParentContent, updatedAt: new Date() })
      .where(eq(settingItems.id, parentItem.id));

    // 创建关系
    const relationBlueprints = (payload?.relations || []) as RelationBlueprint[];
    const relationIds: string[] = [];

    for (const rel of relationBlueprints) {
      const sourceId = createdIds.get(rel.sourceName);
      let targetId = createdIds.get(rel.targetName);

      if (!targetId) {
        const [found] = await tx
          .select({ id: settingItems.id })
          .from(settingItems)
          .where(
            and(
              eq(settingItems.projectId, proposal.projectId),
              eq(settingItems.name, rel.targetName),
              eq(settingItems.status, "confirmed")
            )
          )
          .limit(1);
        targetId = found?.id;
      }

      if (sourceId && targetId) {
        const relationType = VALID_RELATION_TYPES.includes(rel.relationType as any) ? rel.relationType : "reference";

        const [inserted] = await tx
          .insert(settingItemRelations)
          .values({
            projectId: proposal.projectId,
            sourceItemId: sourceId,
            targetItemId: targetId,
            relationType,
            label: rel.label,
            metadata: rel.metadata || null,
          })
          .returning({ id: settingItemRelations.id });
        if (inserted) relationIds.push(inserted.id);
      }
    }

    ctx.emit({
      type: "setting.items_created",
      projectId: proposal.projectId,
      proposalId: proposal.id,
      itemIds: Array.from(createdIds.values()),
      relationIds,
    });

    return {
      executed: true,
      itemsCreated: blueprints.length,
      executionResult: {
        itemIds: Array.from(createdIds.values()),
        relationIds,
        refinementParentId: parentItem.id,
      },
      notification: {
        priority: "p2",
        category: "setting",
        title: `地理细化：${stripSchemePrefix(proposal.title)}`,
        body: `为「${parentItem.name}」生成了 ${blueprints.length} 个子条目，${relationIds.length} 条关系。`,
        sourceNode: proposal.sourceNode || undefined,
        relatedEntityType: "setting",
        relatedEntityId: parentItem.id,
      },
    };
  }
}
