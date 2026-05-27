import { projectScales } from "@narrative-os/database";
import { eq } from "drizzle-orm";
import type { ProposalHandler, ProposalHandlerContext, HandlerResult } from "./types";

/**
 * ScaleDesignHandler — 处理 scale_design 类型提案
 * 将 LLM 生成的尺度树写入 project_scales 表
 */
export class ScaleDesignHandler implements ProposalHandler {
  canHandle(type: string): boolean {
    return type === "scale_design";
  }

  async execute(ctx: ProposalHandlerContext): Promise<HandlerResult> {
    const { tx, proposal } = ctx;
    const contentPayload = (proposal.content?.payload || proposal.payload || {}) as Record<string, unknown>;
    const scales = (contentPayload.scales || []) as Array<{
      key: string;
      label: string;
      parentKey?: string | null;
      sortOrder?: number;
      description?: string;
    }>;

    if (!scales || scales.length === 0) {
      return { executed: false, itemsCreated: 0, executionResult: { error: "no scales" }, notification: null };
    }

    // 先删除该项目的旧尺度（重跑场景）
    await tx
      .delete(projectScales)
      .where(eq(projectScales.projectId, proposal.projectId));

    // 写入新尺度
    for (let i = 0; i < scales.length; i++) {
      const s = scales[i];
      await tx.insert(projectScales).values({
        projectId: proposal.projectId,
        key: s.key,
        label: s.label,
        parentKey: s.parentKey ?? null,
        sortOrder: s.sortOrder ?? i,
        description: s.description ?? null,
        isEditable: true,
      });
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
      itemsCreated: scales.length,
      executionResult: { scaleCount: scales.length },
      notification: {
        priority: "p2",
        category: "setting",
        title: `空间尺度体系已确认`,
        body: `为项目创建了 ${scales.length} 级空间尺度：${scales.map((s) => s.label).join(" → ")}`,
        sourceNode: proposal.sourceNode || undefined,
        relatedEntityType: "proposal",
        relatedEntityId: proposal.id,
      },
    };
  }
}
