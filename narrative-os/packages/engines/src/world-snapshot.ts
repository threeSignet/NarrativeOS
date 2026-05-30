// narrative-os/packages/engines/src/world-snapshot.ts
import { db, projects, settingItems, settingItemRelations, geoAnchors, chapters } from "@narrative-os/database";
import { eq, and } from "drizzle-orm";
import type { CreationCharter } from "./types";

export interface WorldSnapshotData {
  items: Array<{
    id: string;
    type: string;
    name: string;
    summary: string;
    scaleLevel: string;
    geoAnchor: Record<string, unknown> | null;
    content: Record<string, unknown>;
    engineSource: string | null;
    parentItemId: string | null;
  }>;
  relations: Array<{
    sourceItemId: string;
    targetItemId: string;
    relationType: string;
    label: string | null;
  }>;
  creationCharter: CreationCharter | null;
  chapterMeta?: {
    chapterNumber: number;
    title: string;
    appearingCharacters: string[];
    appearingLocations: string[];
  };
}

export async function buildWorldSnapshot(
  projectId: string,
  chapterId?: string
): Promise<WorldSnapshotData> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));

  const items = await db
    .select()
    .from(settingItems)
    .where(and(eq(settingItems.projectId, projectId), eq(settingItems.status, "confirmed")));

  const relations = await db
    .select()
    .from(settingItemRelations)
    .where(eq(settingItemRelations.projectId, projectId));

  const anchors = await db
    .select()
    .from(geoAnchors)
    .where(eq(geoAnchors.projectId, projectId));

  const anchorMap = new Map(anchors.map((a) => [a.settingItemId, a]));

  const snapshotData: WorldSnapshotData = {
    items: items.map((item) => ({
      id: item.id,
      type: item.type,
      name: item.name,
      summary: item.summary,
      scaleLevel: (item.content as any)?.scale || "unknown",
      geoAnchor: anchorMap.get(item.id)
        ? {
            parentLocationId: anchorMap.get(item.id)!.parentLocationId,
            scaleLevel: anchorMap.get(item.id)!.scaleLevel,
            relativePosition: anchorMap.get(item.id)!.relativePosition,
          }
        : null,
      content: item.content as Record<string, unknown>,
      engineSource: item.engineSource,
      parentItemId: item.parentItemId,
    })),
    relations: relations.map((r) => ({
      sourceItemId: r.sourceItemId,
      targetItemId: r.targetItemId,
      relationType: r.relationType,
      label: r.label,
    })),
    creationCharter: (project?.creationCharter as CreationCharter) || null,
  };

  if (chapterId) {
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId));
    if (chapter) {
      snapshotData.chapterMeta = {
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        appearingCharacters: (chapter.appearingCharacters as string[]) || [],
        appearingLocations: (chapter.appearingLocations as string[]) || [],
      };
    }
  }

  return snapshotData;
}
