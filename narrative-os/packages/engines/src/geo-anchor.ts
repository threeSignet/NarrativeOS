// narrative-os/packages/engines/src/geo-anchor.ts
import { db, settingItems } from "@narrative-os/database";
import { eq, and } from "drizzle-orm";
import type { EngineContext, Proposal } from "./types";

export interface GeoAnchor {
  parentLocationId: string | null;
  scaleLevel: string;
  relativePosition: string;
  coordinates?: {
    type: "point" | "region" | "path";
    relativePosition: string;
  };
}

const ENGINE_DEFAULT_SCALE: Record<string, string> = {
  geography: "continent",
  character: "city",
  faction: "region",
  item_system: "scene",
  power_system: "planet",
  race: "region",
  culture: "city",
  history: "continent",
  technique: "city",
  economy: "region",
  rules: "planet",
  conflict: "region",
  causality: "region",
  story_blueprint: "planet",
  tone: "universe",
};

export function inferDefaultScale(engineName: string): string {
  return ENGINE_DEFAULT_SCALE[engineName] || "scene";
}

export async function buildGeoAnchor(
  item: Record<string, unknown>,
  engineName: string,
  ctx: EngineContext
): Promise<GeoAnchor> {
  const content = (item.content || {}) as Record<string, unknown>;
  const locationName = (content.location ||
    content.origin ||
    content.hometown ||
    content.territory) as string | undefined;

  if (ctx.refinement?.parentItemId) {
    return {
      parentLocationId: ctx.refinement.parentItemId,
      scaleLevel: ctx.refinement.targetScale,
      relativePosition: `细化自 ${ctx.refinement.parentName}（${ctx.refinement.parentScale}）`,
    };
  }

  // 尝试匹配已确认的地理条目作为 parentLocationId
  let parentLocationId: string | null = null;
  if (locationName && engineName !== "geography") {
    const [geoItem] = await db
      .select({ id: settingItems.id })
      .from(settingItems)
      .where(
        and(
          eq(settingItems.projectId, ctx.projectId),
          eq(settingItems.status, "confirmed"),
          eq(settingItems.type, "geography")
        )
      );
    if (geoItem) parentLocationId = geoItem.id;
  }

  return {
    parentLocationId,
    scaleLevel: (content.scale as string) || inferDefaultScale(engineName),
    relativePosition: locationName ? `位于 ${locationName}` : "未指定地理位置",
  };
}

export async function injectGeoAnchors(
  proposals: Proposal[],
  engineName: string,
  ctx: EngineContext
): Promise<Proposal[]> {
  for (const p of proposals) {
    const payload = p.content?.payload as Record<string, unknown>;
    if (!payload) continue;
    const items = (payload.items || []) as Array<Record<string, unknown>>;
    for (const item of items) {
      const content = (item.content || {}) as Record<string, unknown>;
      if (!content.geoAnchor) {
        content.geoAnchor = await buildGeoAnchor(item, engineName, ctx);
      }
      item.content = content;
    }
  }
  return proposals;
}
