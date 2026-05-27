import { outlines, volumes, chapters, outlineItems } from "@narrative-os/database";
import { eq, and } from "drizzle-orm";
import type { ProposalHandler, ProposalHandlerContext, HandlerResult } from "./types";

// Handles: outline, volume_outline, chapter_outline proposal types
export class OutlineHandler implements ProposalHandler {
  canHandle(type: string): boolean {
    return type === "outline" || type === "volume_outline" || type === "chapter_outline";
  }

  async execute(ctx: ProposalHandlerContext): Promise<HandlerResult> {
    const { tx, proposal } = ctx;
    const payload = proposal.payload as Record<string, unknown>;

    if (proposal.type === "outline") {
      const [inserted] = await tx
        .insert(outlines)
        .values({
          projectId: proposal.projectId,
          proposalId: proposal.id,
          title: proposal.title,
          summary: (payload.summary as string) || proposal.content?.reasoning?.substring(0, 200) || proposal.title,
          content: proposal.payload,
          status: "confirmed",
        })
        .returning({ id: outlines.id });

      return {
        executed: true,
        itemsCreated: 0,
        executionResult: { outlineId: inserted?.id },
        notification: {
          priority: "p1",
          category: "system",
          title: `大纲已确认：${proposal.title}`,
          body: `全局故事大纲已入库。`,
          sourceNode: proposal.sourceNode || undefined,
        },
      };
    }

    if (proposal.type === "volume_outline") {
      const volumeNumber = (payload.volumeNumber as number) || 1;
      const [inserted] = await tx
        .insert(volumes)
        .values({
          projectId: proposal.projectId,
          proposalId: proposal.id,
          volumeNumber,
          title: (payload.title as string) || proposal.title,
          summary: (payload.summary as string) || proposal.content?.reasoning?.substring(0, 200) || "",
          outline: proposal.payload,
          wordCountTarget: (payload.targetWords as number) || null,
          status: "confirmed",
        })
        .returning({ id: volumes.id });

      return {
        executed: true,
        itemsCreated: 0,
        executionResult: { volumeId: inserted?.id },
        notification: {
          priority: "p1",
          category: "system",
          title: `卷纲已确认：${proposal.title}`,
          body: `第${volumeNumber}卷卷纲已入库。`,
          sourceNode: proposal.sourceNode || undefined,
        },
      };
    }

    if (proposal.type === "chapter_outline") {
      const volumeNumber = (payload.volumeNumber as number) || 1;
      const chapterNumber = (payload.chapterNumber as number) || 1;

      const [volume] = await tx
        .select({ id: volumes.id })
        .from(volumes)
        .where(
          and(
            eq(volumes.projectId, proposal.projectId),
            eq(volumes.volumeNumber, volumeNumber),
            eq(volumes.status, "confirmed"),
          ),
        );

      if (!volume) {
        return {
          executed: false,
          itemsCreated: 0,
          executionResult: { error: `Volume ${volumeNumber} not found` },
          notification: {
            priority: "p1",
            category: "conflict",
            title: `章纲入库失败：未找到第${volumeNumber}卷`,
            body: `请先生成第${volumeNumber}卷的卷纲。`,
            sourceNode: proposal.sourceNode || undefined,
          },
        };
      }

      // Check for existing chapter with same volume+number (prevent duplicates)
      const [existingChapter] = await tx
        .select({ id: chapters.id })
        .from(chapters)
        .where(
          and(
            eq(chapters.volumeId, volume.id),
            eq(chapters.chapterNumber, chapterNumber),
          ),
        );

      let inserted;
      if (existingChapter) {
        // Update existing chapter instead of inserting duplicate
        [inserted] = await tx
          .update(chapters)
          .set({
            proposalId: proposal.id,
            title: (payload.title as string) || proposal.title,
            summary: (payload.summary as string) || proposal.content?.reasoning?.substring(0, 200) || "",
            outline: proposal.payload,
            wordCountTarget: (payload.wordCountTarget as number) || null,
            updatedAt: new Date(),
          })
          .where(eq(chapters.id, existingChapter.id))
          .returning({ id: chapters.id });
      } else {
        [inserted] = await tx
          .insert(chapters)
          .values({
            projectId: proposal.projectId,
            volumeId: volume.id,
            proposalId: proposal.id,
            chapterNumber,
            title: (payload.title as string) || proposal.title,
            summary: (payload.summary as string) || proposal.content?.reasoning?.substring(0, 200) || "",
            outline: proposal.payload,
            wordCountTarget: (payload.wordCountTarget as number) || null,
            status: "confirmed",
          })
          .returning({ id: chapters.id });
      }

      // Create outline_item entry for this chapter
      let itemsCreated = 0;
      if (inserted?.id) {
        // Find the current outline for this project
        const [currentOutline] = await tx
          .select({ id: outlines.id })
          .from(outlines)
          .where(
            and(
              eq(outlines.projectId, proposal.projectId),
              eq(outlines.status, "confirmed")
            )
          )
          .limit(1);

        if (currentOutline) {
          // Get sort order: count existing items for this outline
          const existing = await tx
            .select({ id: outlineItems.id })
            .from(outlineItems)
            .where(eq(outlineItems.outlineId, currentOutline.id));

          await tx.insert(outlineItems).values({
            outlineId: currentOutline.id,
            volumeNumber,
            chapterNumber,
            title: (payload.title as string) || proposal.title,
            roughSummary: (payload.summary as string) || null,
            detailedPlot: (payload.detailedPlot || payload.detailed_plot || null) as string | null,
            plotPoints: (payload.plotPoints || payload.plot_points) as Record<string, unknown>[] | null,
            emotionOverall: (payload.emotionOverall || payload.emotion_overall || null) as string | null,
            emotionPoints: (payload.emotionPoints || payload.emotion_points) as Record<string, unknown>[] | null,
            narrativePace: (payload.narrativePace || payload.narrative_pace || "medium") as string,
            keyCharacters: (payload.keyCharacters || payload.key_characters) as string[] | null,
            keyLocations: (payload.keyLocations || payload.key_locations) as string[] | null,
            keyItems: (payload.keyItems || payload.key_items) as string[] | null,
            keyEvents: (payload.keyEvents || payload.key_events) as Record<string, unknown>[] | null,
            toPlantForeshadowings: (payload.toPlantForeshadowings || payload.to_plant_foreshadowings) as string[] | null,
            toResolveForeshadowings: (payload.toResolveForeshadowings || payload.to_resolve_foreshadowings) as string[] | null,
            toReferenceForeshadowings: (payload.toReferenceForeshadowings || payload.to_reference_foreshadowings) as string[] | null,
            targetWords: (payload.targetWords || payload.target_words || payload.wordCountTarget || 3000) as number,
            linkedChapterId: inserted.id,
            executionStatus: "pending",
            sortOrder: existing.length,
          });
          itemsCreated = 1;
        }
      }

      return {
        executed: true,
        itemsCreated,
        executionResult: { chapterId: inserted?.id },
        notification: {
          priority: "p2",
          category: "system",
          title: `章纲已确认：${proposal.title}`,
          body: `第${volumeNumber}卷第${chapterNumber}章章纲已入库。`,
          sourceNode: proposal.sourceNode || undefined,
        },
      };
    }

    return {
      executed: false,
      itemsCreated: 0,
      executionResult: null,
      notification: null,
    };
  }
}
